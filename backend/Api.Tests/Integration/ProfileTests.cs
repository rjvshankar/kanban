using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Dtos;
using Api.Tests.Infrastructure;
using Shouldly;

namespace Api.Tests.Integration;

public sealed class ProfileTests(ApiFixture fixture) : IntegrationTest(fixture)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // Smallest valid headers; the API only checks the magic bytes.
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4];
    private static readonly byte[] Webp = [(byte)'R', (byte)'I', (byte)'F', (byte)'F', 1, 0, 0, 0, (byte)'W', (byte)'E', (byte)'B', (byte)'P', 9];

    private static MultipartFormDataContent Form(byte[] bytes, string type = "image/png", string name = "a.png")
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(type);
        return new MultipartFormDataContent { { file, "file", name } };
    }

    private static async Task<JsonElement> JsonOf(HttpResponseMessage res) =>
        JsonDocument.Parse(await res.Content.ReadAsStringAsync(Ct)).RootElement;

    // ---- name ----

    [Fact]
    public async Task Update_name_trims_saves_and_me_reflects_it()
    {
        var u = await NewUserAsync();

        var res = await u.Client.PutAsJsonAsync("/api/auth/me", new UpdateProfileRequest("  Grace ", " Hopper ", " 555-1234 "), Ct);

        res.StatusCode.ShouldBe(HttpStatusCode.OK);
        var me = await JsonOf(await u.Client.GetAsync("/api/auth/me", Ct));
        me.GetProperty("firstName").GetString().ShouldBe("Grace");
        me.GetProperty("lastName").GetString().ShouldBe("Hopper");
        me.GetProperty("email").GetString().ShouldBe(u.Email);
        me.GetProperty("phoneNumber").GetString().ShouldBe("555-1234");
    }

    [Theory]
    [InlineData("", "Hopper")]
    [InlineData("Grace", "")]
    [InlineData("   ", "Hopper")]
    public async Task Update_name_rejects_blank(string first, string last)
    {
        var u = await NewUserAsync();
        (await u.Client.PutAsJsonAsync("/api/auth/me", new UpdateProfileRequest(first, last, null), Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Update_name_rejects_too_long()
    {
        var u = await NewUserAsync();
        var res = await u.Client.PutAsJsonAsync("/api/auth/me", new UpdateProfileRequest(new string('a', 101), "B", null), Ct);
        res.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Update_name_requires_login()
    {
        var res = await Factory.CreateClient().PutAsJsonAsync("/api/auth/me", new UpdateProfileRequest("A", "B", null), Ct);
        res.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Update_phone_can_be_changed_and_cleared()
    {
        var u = await NewUserAsync();
        (await JsonOf(await u.Client.GetAsync("/api/auth/me", Ct))).GetProperty("phoneNumber").ValueKind.ShouldBe(JsonValueKind.Null);

        await u.Client.PutAsJsonAsync("/api/auth/me", new UpdateProfileRequest("A", "B", "+1 (555) 123-4567"), Ct);
        (await JsonOf(await u.Client.GetAsync("/api/auth/me", Ct))).GetProperty("phoneNumber").GetString().ShouldBe("+1 (555) 123-4567");

        await u.Client.PutAsJsonAsync("/api/auth/me", new UpdateProfileRequest("A", "B", null), Ct);
        (await JsonOf(await u.Client.GetAsync("/api/auth/me", Ct))).GetProperty("phoneNumber").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Theory]
    [InlineData("not a phone")]
    [InlineData("1234567890123456789012345678901")] // 31 characters
    public async Task Update_phone_rejects_invalid_values(string phone)
    {
        var u = await NewUserAsync();
        var res = await u.Client.PutAsJsonAsync("/api/auth/me", new UpdateProfileRequest("A", "B", phone), Ct);
        res.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Registration_phone_shows_up_in_me()
    {
        var client = Factory.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("A", "B", "phone@example.com", "555-0000", "Password123!"), Ct);
        await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("phone@example.com", "Password123!"), Ct);
        (await JsonOf(await client.GetAsync("/api/auth/me", Ct))).GetProperty("phoneNumber").GetString().ShouldBe("555-0000");
    }

    // ---- avatar ----

    [Fact]
    public async Task New_user_has_no_avatar()
    {
        var u = await NewUserAsync();
        (await JsonOf(await u.Client.GetAsync("/api/auth/me", Ct))).GetProperty("avatarVersion").ValueKind.ShouldBe(JsonValueKind.Null);
        (await u.Client.GetAsync($"/api/users/{u.Id}/avatar", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData("png", "image/png")]
    [InlineData("jpeg", "image/jpeg")]
    [InlineData("webp", "image/webp")]
    public async Task Upload_stores_image_and_serves_it_back(string kind, string expectedType)
    {
        var bytes = kind switch { "png" => Png, "jpeg" => Jpeg, _ => Webp };
        var u = await NewUserAsync();

        var up = await u.Client.PutAsync("/api/auth/me/avatar", Form(bytes), Ct);

        up.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await JsonOf(up)).GetProperty("avatarVersion").GetInt64().ShouldBeGreaterThan(0);

        var get = await u.Client.GetAsync($"/api/users/{u.Id}/avatar", Ct);
        get.StatusCode.ShouldBe(HttpStatusCode.OK);
        get.Content.Headers.ContentType!.MediaType.ShouldBe(expectedType);
        (await get.Content.ReadAsByteArrayAsync(Ct)).ShouldBe(bytes);
        get.Headers.ETag.ShouldNotBeNull();
        (await JsonOf(await u.Client.GetAsync("/api/auth/me", Ct))).GetProperty("avatarVersion").GetInt64().ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task Upload_detects_type_from_bytes_not_from_the_client_header()
    {
        var u = await NewUserAsync();
        (await u.Client.PutAsync("/api/auth/me/avatar", Form(Png, "image/jpeg", "a.jpg"), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await u.Client.GetAsync($"/api/users/{u.Id}/avatar", Ct)).Content.Headers.ContentType!.MediaType.ShouldBe("image/png");
    }

    [Fact]
    public async Task Upload_rejects_non_image_even_with_image_header()
    {
        var u = await NewUserAsync();
        var res = await u.Client.PutAsync("/api/auth/me/avatar", Form("<svg onload=alert(1)>"u8.ToArray(), "image/png"), Ct);
        res.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await u.Client.GetAsync($"/api/users/{u.Id}/avatar", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Upload_rejects_too_large()
    {
        var u = await NewUserAsync();
        var big = new byte[(2 * 1024 * 1024) + 1];
        Png.CopyTo(big, 0);
        var res = await u.Client.PutAsync("/api/auth/me/avatar", Form(big), Ct);
        res.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
    }

    [Fact]
    public async Task Upload_rejects_missing_file()
    {
        var u = await NewUserAsync();
        var res = await u.Client.PutAsync("/api/auth/me/avatar", new MultipartFormDataContent { { new StringContent("x"), "other" } }, Ct);
        res.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Upload_replaces_existing_avatar_and_changes_version()
    {
        var u = await NewUserAsync();
        var v1 = (await JsonOf(await u.Client.PutAsync("/api/auth/me/avatar", Form(Png), Ct))).GetProperty("avatarVersion").GetInt64();
        await Task.Delay(20, Ct);
        var v2 = (await JsonOf(await u.Client.PutAsync("/api/auth/me/avatar", Form(Jpeg, "image/jpeg"), Ct))).GetProperty("avatarVersion").GetInt64();

        v2.ShouldBeGreaterThan(v1);
        (await u.Client.GetAsync($"/api/users/{u.Id}/avatar", Ct)).Content.Headers.ContentType!.MediaType.ShouldBe("image/jpeg");
    }

    [Fact]
    public async Task Delete_removes_avatar_and_is_idempotent()
    {
        var u = await NewUserAsync();
        await u.Client.PutAsync("/api/auth/me/avatar", Form(Png), Ct);

        (await u.Client.DeleteAsync("/api/auth/me/avatar", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await u.Client.DeleteAsync("/api/auth/me/avatar", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await u.Client.GetAsync($"/api/users/{u.Id}/avatar", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await JsonOf(await u.Client.GetAsync("/api/auth/me", Ct))).GetProperty("avatarVersion").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task Another_logged_in_user_can_view_an_avatar_but_cannot_change_it()
    {
        var a = await NewUserAsync();
        var b = await NewUserAsync();
        await a.Client.PutAsync("/api/auth/me/avatar", Form(Png), Ct);

        (await b.Client.GetAsync($"/api/users/{a.Id}/avatar", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        // b's upload only ever touches b's own avatar
        await b.Client.PutAsync("/api/auth/me/avatar", Form(Jpeg, "image/jpeg"), Ct);
        (await a.Client.GetAsync($"/api/users/{a.Id}/avatar", Ct)).Content.Headers.ContentType!.MediaType.ShouldBe("image/png");
    }

    [Fact]
    public async Task Avatar_endpoints_require_login()
    {
        var anon = Factory.CreateClient();
        (await anon.GetAsync("/api/users/1/avatar", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await anon.PutAsync("/api/auth/me/avatar", Form(Png), Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await anon.DeleteAsync("/api/auth/me/avatar", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_response_includes_avatar_version()
    {
        var u = await NewUserAsync();
        await u.Client.PutAsync("/api/auth/me/avatar", Form(Png), Ct);

        var login = await Factory.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(u.Email, u.Password), Ct);

        (await JsonOf(login)).GetProperty("avatarVersion").GetInt64().ShouldBeGreaterThan(0);
    }
}
