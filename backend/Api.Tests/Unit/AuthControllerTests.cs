using Api.Controllers;
using Api.Data;
using Api.Dtos;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class AuthControllerTests
{
    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly IPasswordHasher<User> _hasher = Substitute.For<IPasswordHasher<User>>();
    private readonly ITokenService _tokens = Substitute.For<ITokenService>();
    private readonly IWebHostEnvironment _env = Substitute.For<IWebHostEnvironment>();
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private AuthController Controller(string env = "Development", int? userId = null)
    {
        _env.EnvironmentName.Returns(env);
        var c = new AuthController(_users, _hasher, _tokens, _env).AsUser(userId);
        return c;
    }

    private static readonly User Ada = new() { Id = 7, FirstName = "Ada", LastName = "L", Email = "ada@example.com", PasswordHash = "stored" };

    [Fact]
    public async Task Register_normalizes_email_trims_names_and_hashes_password()
    {
        _hasher.HashPassword(Arg.Any<User>(), "Password123!").Returns("HASHED");
        _users.CreateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>()).Returns(9);

        var result = await Controller().Register(new RegisterRequest(" Ada ", " L ", "  ADA@Example.COM ", " 123 ", "Password123!"), Ct);

        result.Status().ShouldBe(201);
        await _users.Received(1).CreateAsync(
            Arg.Is<User>(u => u.Email == "ada@example.com" && u.FirstName == "Ada" && u.LastName == "L"
                              && u.PhoneNumber == "123" && u.PasswordHash == "HASHED"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Register_existing_email_is_conflict_and_nothing_is_created()
    {
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns(Ada);

        var result = await Controller().Register(new RegisterRequest("A", "B", "ADA@example.com", null, "Password123!"), Ct);

        result.ShouldBeOfType<ConflictObjectResult>();
        await _users.DidNotReceiveWithAnyArgs().CreateAsync(default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Login_unknown_user_and_wrong_password_look_identical()
    {
        _users.GetByEmailAsync("nobody@example.com", Arg.Any<CancellationToken>()).Returns((User?)null);
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns(Ada);
        _hasher.VerifyHashedPassword(Ada, "stored", "bad").Returns(PasswordVerificationResult.Failed);

        var unknown = (await Controller().Login(new LoginRequest("nobody@example.com", "bad"), Ct)).ShouldBeOfType<UnauthorizedObjectResult>();
        var wrong = (await Controller().Login(new LoginRequest("ada@example.com", "bad"), Ct)).ShouldBeOfType<UnauthorizedObjectResult>();

        wrong.Value!.ToString().ShouldBe(unknown.Value!.ToString());
        _tokens.DidNotReceiveWithAnyArgs().CreateAccessToken(default!);
    }

    [Fact]
    public async Task Login_normalizes_email_before_lookup()
    {
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns((User?)null);

        await Controller().Login(new LoginRequest("  ADA@Example.com ", "x"), Ct);

        await _users.Received(1).GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>());
    }

    private async Task<string> LoginCookieAsync(string env)
    {
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns(Ada);
        _hasher.VerifyHashedPassword(Ada, "stored", "ok").Returns(PasswordVerificationResult.Success);
        _tokens.CreateAccessToken(Ada).Returns(("jwt-value", DateTime.UtcNow.AddHours(1)));

        var controller = Controller(env);
        (await controller.Login(new LoginRequest("ada@example.com", "ok"), Ct)).ShouldBeOfType<OkObjectResult>();
        return controller.Response.Headers.SetCookie.ToString().ToLowerInvariant();
    }

    [Fact]
    public async Task Login_cookie_is_httpOnly_strict_and_not_secure_in_development()
    {
        var cookie = await LoginCookieAsync("Development");

        cookie.ShouldContain("kanban_auth=jwt-value");
        cookie.ShouldContain("httponly");
        cookie.ShouldContain("samesite=strict");
        cookie.ShouldNotContain("secure;");
        cookie.ShouldNotEndWith("secure");
    }

    [Fact]
    public async Task Login_cookie_is_secure_outside_development()
    {
        var cookie = await LoginCookieAsync("Production");

        cookie.ShouldContain("secure");
        cookie.ShouldContain("httponly");
    }

    [Fact]
    public async Task Login_rehash_result_still_counts_as_success()
    {
        _users.GetByEmailAsync("ada@example.com", Arg.Any<CancellationToken>()).Returns(Ada);
        _hasher.VerifyHashedPassword(Ada, "stored", "ok").Returns(PasswordVerificationResult.SuccessRehashNeeded);
        _tokens.CreateAccessToken(Ada).Returns(("t", DateTime.UtcNow.AddHours(1)));

        (await Controller().Login(new LoginRequest("ada@example.com", "ok"), Ct)).ShouldBeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task Me_rejects_missing_sub_and_deleted_user()
    {
        (await Controller(userId: null).Me(Ct)).ShouldBeOfType<UnauthorizedResult>();

        _users.GetByIdAsync(7, Arg.Any<CancellationToken>()).Returns((User?)null);
        (await Controller(userId: 7).Me(Ct)).ShouldBeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task Me_never_returns_the_password_hash()
    {
        _users.GetByIdAsync(7, Arg.Any<CancellationToken>()).Returns(Ada);

        var ok = (await Controller(userId: 7).Me(Ct)).ShouldBeOfType<OkObjectResult>();

        ok.Value!.ToString()!.ShouldNotContain("stored");
        ok.Value.ToString()!.ShouldContain("ada@example.com");
    }

    [Fact]
    public void Logout_expires_the_cookie()
    {
        var controller = Controller();
        controller.Logout().ShouldBeOfType<NoContentResult>();
        controller.Response.Headers.SetCookie.ToString().ShouldContain("kanban_auth=;");
    }
}
