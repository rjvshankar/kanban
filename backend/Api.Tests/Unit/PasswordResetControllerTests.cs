using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Api.Controllers;
using Api.Data;
using Api.Dtos;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class PasswordResetControllerTests
{
    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly IPasswordResetRepository _resets = Substitute.For<IPasswordResetRepository>();
    private readonly IPasswordHasher<User> _hasher = Substitute.For<IPasswordHasher<User>>();
    private readonly IEmailSender _email = Substitute.For<IEmailSender>();
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static readonly User Ada = new() { Id = 7, FirstName = "Ada", Email = "ada@example.com" };

    private PasswordResetController Controller(string? frontendUrl = "http://app.test")
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(frontendUrl is null ? [] : new Dictionary<string, string?> { ["App:FrontendUrl"] = frontendUrl })
            .Build();
        return new PasswordResetController(_users, _resets, _hasher, _email, config, NullLogger<PasswordResetController>.Instance);
    }

    private static string Sha256Hex(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s))).ToLowerInvariant();

    private (string RawToken, string Link, string Body) CapturedEmail()
    {
        var body = (string)_email.ReceivedCalls().Single().GetArguments()[2]!;
        var link = Regex.Match(body, @"https?://\S+").Value;
        return (Regex.Match(link, @"token=([\w-]+)").Groups[1].Value, link, body);
    }

    [Fact]
    public async Task Unknown_email_gets_ok_and_nothing_is_stored_or_sent()
    {
        _users.GetByEmailAsync("x@example.com", Arg.Any<CancellationToken>()).Returns((User?)null);

        (await Controller().ForgotPassword(new ForgotPasswordRequest("x@example.com"), Ct)).ShouldBeOfType<OkObjectResult>();

        await _resets.DidNotReceiveWithAnyArgs().CreateAsync(default, default!, default, TestContext.Current.CancellationToken);
        await _email.DidNotReceiveWithAnyArgs().SendAsync(default!, default!, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Email_is_normalized_before_lookup()
    {
        await Controller().ForgotPassword(new ForgotPasswordRequest("  ADA@Example.com "), Ct);

        await _users.Received(1).GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Only_the_hash_of_the_token_is_stored_and_the_raw_token_is_emailed()
    {
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns(Ada);
        string? storedHash = null; DateTime storedExpiry = default;
        await _resets.CreateAsync(7, Arg.Do<string>(h => storedHash = h), Arg.Do<DateTime>(e => storedExpiry = e), Arg.Any<CancellationToken>());

        var before = DateTime.UtcNow;
        await Controller().ForgotPassword(new ForgotPasswordRequest("ada@example.com"), Ct);

        var (raw, link, body) = CapturedEmail();
        raw.Length.ShouldBeGreaterThanOrEqualTo(43); // 32 random bytes, base64url
        storedHash.ShouldBe(Sha256Hex(raw));
        storedHash.ShouldNotBe(raw);
        link.ShouldBe($"http://app.test/reset-password?token={raw}");
        body.ShouldContain("Hi Ada");
        storedExpiry.ShouldBeInRange(before.AddMinutes(30), DateTime.UtcNow.AddMinutes(30));
    }

    [Fact]
    public async Task Every_request_generates_a_fresh_token()
    {
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns(Ada);
        var hashes = new List<string>();
        await _resets.CreateAsync(7, Arg.Do<string>(hashes.Add), Arg.Any<DateTime>(), Arg.Any<CancellationToken>());

        var c = Controller();
        await c.ForgotPassword(new ForgotPasswordRequest("ada@example.com"), Ct);
        await c.ForgotPassword(new ForgotPasswordRequest("ada@example.com"), Ct);

        hashes.Distinct().Count().ShouldBe(2);
    }

    [Theory]
    [InlineData("http://app.test/", "http://app.test/reset-password?token=")]
    [InlineData(null, "http://localhost:5173/reset-password?token=")]
    public async Task Link_uses_configured_frontend_url_without_double_slash(string? configured, string expectedPrefix)
    {
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns(Ada);

        await Controller(configured).ForgotPassword(new ForgotPasswordRequest("ada@example.com"), Ct);

        CapturedEmail().Link.ShouldStartWith(expectedPrefix);
    }

    [Fact]
    public async Task Email_outage_does_not_change_the_response()
    {
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns(Ada);
        _email.SendAsync(default!, default!, default!, TestContext.Current.CancellationToken).ReturnsForAnyArgs(Task.FromException(new IOException("smtp down")));

        (await Controller().ForgotPassword(new ForgotPasswordRequest("ada@example.com"), Ct)).ShouldBeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Response_is_identical_for_known_and_unknown_emails()
    {
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns(Ada);
        _users.GetByEmailAsync("x@example.com", Arg.Any<CancellationToken>()).Returns((User?)null);
        var c = Controller();

        var known = (OkObjectResult)await c.ForgotPassword(new ForgotPasswordRequest("ada@example.com"), Ct);
        var unknown = (OkObjectResult)await c.ForgotPassword(new ForgotPasswordRequest("x@example.com"), Ct);

        known.Value!.ToString().ShouldBe(unknown.Value!.ToString());
    }

    [Fact]
    public async Task Reset_consumes_the_hash_of_the_token_with_the_new_password_hash()
    {
        _hasher.HashPassword(Arg.Any<User>(), "NewPassword1!").Returns("NEWHASH");
        _resets.ConsumeAsync(Sha256Hex("raw-token"), "NEWHASH", Arg.Any<CancellationToken>()).Returns(true);

        (await Controller().ResetPassword(new ResetPasswordRequest("raw-token", "NewPassword1!"), Ct)).ShouldBeOfType<NoContentResult>();
    }

    [Fact]
    public async Task Invalid_token_is_400()
    {
        _resets.ConsumeAsync(default!, default!, TestContext.Current.CancellationToken).ReturnsForAnyArgs(false);

        (await Controller().ResetPassword(new ResetPasswordRequest("bad", "NewPassword1!"), Ct)).ShouldBeOfType<BadRequestObjectResult>();
    }
}
