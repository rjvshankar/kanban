using System.Net;
using System.Net.Http.Json;
using Api.Dtos;
using Api.Tests.Infrastructure;
using Shouldly;

namespace Api.Tests.Integration;

public sealed class AuthTests(ApiFixture fixture) : IntegrationTest(fixture)
{
    private static RegisterRequest Reg(string email = "a@example.com", string password = "Password123!") =>
        new("Ada", "Lovelace", email, null, password);

    [Fact]
    public async Task Register_creates_user()
    {
        var res = await Factory.CreateClient().PostAsJsonAsync("/api/auth/register", Reg(), TestContext.Current.CancellationToken);
        res.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Register_duplicate_email_is_conflict_case_insensitive()
    {
        var client = Factory.CreateClient();
        (await client.PostAsJsonAsync("/api/auth/register", Reg("a@example.com"), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Created);
        (await client.PostAsJsonAsync("/api/auth/register", Reg("A@Example.com"), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("")]
    public async Task Register_rejects_bad_password(string password)
    {
        var res = await Factory.CreateClient().PostAsJsonAsync("/api/auth/register", Reg(password: password), TestContext.Current.CancellationToken);
        res.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Register_rejects_invalid_email()
    {
        var res = await Factory.CreateClient().PostAsJsonAsync("/api/auth/register", Reg("not-an-email"), TestContext.Current.CancellationToken);
        res.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Login_sets_httpOnly_cookie_and_me_works()
    {
        var user = await NewUserAsync("ada");

        var me = await user.Client.GetAsync("/api/auth/me", TestContext.Current.CancellationToken);
        me.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await me.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("ada@example.com");
        user.Cookie.ShouldStartWith("kanban_auth=");
    }

    [Fact]
    public async Task Login_cookie_is_httpOnly_and_strict()
    {
        var user = await NewUserAsync();
        var res = await Factory.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(user.Email, user.Password), TestContext.Current.CancellationToken);
        var setCookie = res.Headers.GetValues("Set-Cookie").Single().ToLowerInvariant();
        setCookie.ShouldContain("httponly");
        setCookie.ShouldContain("samesite=strict");
    }

    [Fact]
    public async Task Login_wrong_password_and_unknown_user_give_same_response()
    {
        var user = await NewUserAsync();
        var client = Factory.CreateClient();

        var wrong = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(user.Email, "WrongPassword1"), TestContext.Current.CancellationToken);
        var unknown = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("nobody@example.com", "WrongPassword1"), TestContext.Current.CancellationToken);

        wrong.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        unknown.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await wrong.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldBe(await unknown.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Me_without_login_is_unauthorized()
    {
        var res = await Factory.CreateClient().GetAsync("/api/auth/me", TestContext.Current.CancellationToken);
        res.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Logout_clears_session()
    {
        var user = await NewUserAsync();
        (await user.Client.PostAsync("/api/auth/logout", null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await user.Client.GetAsync("/api/auth/me", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("/api/boards")]
    [InlineData("/api/boards/archived")]
    [InlineData("/api/boards/purged")]
    public async Task Board_endpoints_require_login(string url)
    {
        (await Factory.CreateClient().GetAsync(url, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Health_endpoint_reports_healthy()
    {
        var res = await Factory.CreateClient().GetAsync("/api/health", TestContext.Current.CancellationToken);
        res.StatusCode.ShouldBe(HttpStatusCode.OK);
    }
}
