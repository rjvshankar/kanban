using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Api.Dtos;
using Api.Tests.Infrastructure;
using Shouldly;

namespace Api.Tests.Integration;

/// <summary>Uses its own host per test so the in-memory forgot-password rate limiter starts fresh.</summary>
public sealed class PasswordResetTests : IntegrationTest, IDisposable
{
    private readonly ApiFactory _factory;

    public PasswordResetTests(ApiFixture fixture) : base(fixture) => _factory = fixture.CreateIsolatedFactory();

    public void Dispose() => _factory.Dispose();

    private static string TokenFrom(string body) => Regex.Match(body, @"token=([\w-]+)").Groups[1].Value;

    [Fact]
    public async Task Full_reset_flow_changes_password_and_token_is_single_use()
    {
        var user = await NewUserAsync(_factory, "ada");
        var client = _factory.CreateClient();

        (await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest(user.Email), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

        var mail = _factory.Emails.Sent.Single();
        mail.To.ShouldBe(user.Email);
        var token = TokenFrom(mail.Body);
        token.ShouldNotBeEmpty();

        (await client.PostAsJsonAsync("/api/auth/reset-password", new ResetPasswordRequest(token, "NewPassword456!"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(user.Email, user.Password), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(user.Email, "NewPassword456!"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

        (await client.PostAsJsonAsync("/api/auth/reset-password", new ResetPasswordRequest(token, "Another789!"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Expired_token_is_rejected()
    {
        var user = await NewUserAsync(_factory, "ada");
        var client = _factory.CreateClient();
        await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest(user.Email), TestContext.Current.CancellationToken);
        var token = TokenFrom(_factory.Emails.Sent.Single().Body);

        await Fixture.ExecuteAsync("UPDATE dbo.PasswordResetTokens SET ExpiresAt = DATEADD(minute, -1, SYSUTCDATETIME())");

        (await client.PostAsJsonAsync("/api/auth/reset-password", new ResetPasswordRequest(token, "NewPassword456!"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Unknown_email_gets_same_response_and_no_mail()
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest("nobody@example.com"), TestContext.Current.CancellationToken);

        res.StatusCode.ShouldBe(HttpStatusCode.OK);
        _factory.Emails.Sent.ShouldBeEmpty();
    }

    [Fact]
    public async Task Forgot_password_is_rate_limited_per_ip()
    {
        var client = _factory.CreateClient();
        for (var i = 0; i < 3; i++)
            (await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest("x@example.com"), TestContext.Current.CancellationToken))
                .StatusCode.ShouldBe(HttpStatusCode.OK);

        var limited = await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest("x@example.com"), TestContext.Current.CancellationToken);
        limited.StatusCode.ShouldBe(HttpStatusCode.TooManyRequests);
        limited.Headers.Contains("Retry-After").ShouldBeTrue();
    }
}
