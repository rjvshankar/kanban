using System.Text;
using Api.Models;
using Api.Services;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class TokenServiceTests
{
    private const string Key = "unit-test-signing-key-at-least-32-bytes!!";

    private static JwtOptions Options(string key = Key, int minutes = 60) =>
        new() { Key = key, Issuer = "issuer", Audience = "audience", AccessTokenMinutes = minutes };

    private static TokenService Service(JwtOptions o) => new(Microsoft.Extensions.Options.Options.Create(o));

    private static readonly User Ada = new() { Id = 7, Email = "ada@example.com" };

    private static TokenValidationParameters Validation(string key) => new()
    {
        ValidIssuer = "issuer",
        ValidAudience = "audience",
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
        ClockSkew = TimeSpan.Zero
    };

    [Fact]
    public async Task Token_carries_sub_and_email_and_validates()
    {
        var (token, _) = Service(Options()).CreateAccessToken(Ada);

        var result = await new JsonWebTokenHandler().ValidateTokenAsync(token, Validation(Key));

        result.IsValid.ShouldBeTrue();
        result.Claims["sub"].ShouldBe("7");
        result.Claims["email"].ShouldBe("ada@example.com");
    }

    [Fact]
    public async Task Token_signed_with_another_key_is_rejected()
    {
        var (token, _) = Service(Options()).CreateAccessToken(Ada);

        var result = await new JsonWebTokenHandler().ValidateTokenAsync(token, Validation("a-completely-different-key-32-bytes!!!"));

        result.IsValid.ShouldBeFalse();
    }

    [Fact]
    public void Expiry_follows_configured_minutes()
    {
        var before = DateTime.UtcNow;
        var (_, expiresAt) = Service(Options(minutes: 15)).CreateAccessToken(Ada);

        expiresAt.ShouldBeInRange(before.AddMinutes(15), DateTime.UtcNow.AddMinutes(15));
    }

    [Fact]
    public async Task Expired_token_is_rejected()
    {
        var (token, _) = Service(Options(minutes: -5)).CreateAccessToken(Ada);

        (await new JsonWebTokenHandler().ValidateTokenAsync(token, new TokenValidationParameters
        {
            ValidIssuer = "issuer",
            ValidAudience = "audience",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)),
            ClockSkew = TimeSpan.Zero
        })).IsValid.ShouldBeFalse();
    }

    [Fact]
    public async Task Wrong_audience_is_rejected()
    {
        var (token, _) = Service(Options()).CreateAccessToken(Ada);
        var p = Validation(Key);
        p.ValidAudience = "someone-else";

        (await new JsonWebTokenHandler().ValidateTokenAsync(token, p)).IsValid.ShouldBeFalse();
    }
}
