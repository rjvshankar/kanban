using System.Net.Http.Json;
using Api.Dtos;

namespace Api.Tests.Infrastructure;

[CollectionDefinition(Name)]
public sealed class IntegrationCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "integration";
}

/// <summary>Base class: wipes the database before every test and offers helpers to create logged-in users.</summary>
[Collection(IntegrationCollection.Name)]
public abstract class IntegrationTest(ApiFixture fixture) : IAsyncLifetime
{
    protected ApiFixture Fixture { get; } = fixture;
    protected ApiFactory Factory => Fixture.Factory;

    private int _userCounter;

    public virtual ValueTask InitializeAsync() => new(Fixture.ResetAsync());
    public virtual ValueTask DisposeAsync() => ValueTask.CompletedTask;

    /// <summary>Registers a new user and returns a client holding that user's login cookie.</summary>
    protected Task<TestUser> NewUserAsync(string? name = null) => NewUserAsync(Factory, name);

    protected async Task<TestUser> NewUserAsync(ApiFactory factory, string? name = null)
    {
        name ??= $"user{Interlocked.Increment(ref _userCounter)}";
        var email = $"{name}@example.com";
        const string password = "Password123!";

        var client = factory.CreateClient();
        var register = await client.PostAsJsonAsync("/api/auth/register",
            new RegisterRequest("Test", name, email, null, password));
        register.EnsureSuccessStatusCode();
        var created = await register.Content.ReadFromJsonAsync<RegisteredUser>();

        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        login.EnsureSuccessStatusCode();
        var cookie = login.Headers.GetValues("Set-Cookie").First().Split(';')[0];

        return new TestUser(created!.Id, email, password, client, cookie);
    }

    protected static async Task<int> CreateBoardAsync(TestUser owner, string name = "Board")
    {
        var res = await owner.Client.PostAsJsonAsync("/api/boards", new CreateBoardRequest(name));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<CreatedBoard>())!.Id;
    }

    protected static async Task<int> CreateColumnAsync(TestUser owner, int boardId, string name = "To do")
    {
        var res = await owner.Client.PostAsJsonAsync($"/api/boards/{boardId}/columns", new ColumnNameRequest(name));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<ColumnResponse>())!.Id;
    }

    protected static async Task<int> CreateCardAsync(TestUser user, int columnId, string title = "Card")
    {
        var res = await user.Client.PostAsJsonAsync($"/api/columns/{columnId}/cards", new CardRequest(title, null, null));
        res.EnsureSuccessStatusCode();
        return (await res.Content.ReadFromJsonAsync<CardResponse>())!.Id;
    }

    protected static async Task AddMemberAsync(TestUser owner, int boardId, TestUser member, string role)
    {
        var res = await owner.Client.PostAsJsonAsync($"/api/boards/{boardId}/members", new AddMemberRequest(member.Id, role));
        res.EnsureSuccessStatusCode();
    }

    protected static async Task<BoardResponse> GetBoardAsync(TestUser user, int boardId)
        => (await user.Client.GetFromJsonAsync<BoardResponse>($"/api/boards/{boardId}"))!;

    private sealed record RegisteredUser(int Id, string Email);
    private sealed record CreatedBoard(int Id, string Name, string Role);
}

public sealed record TestUser(int Id, string Email, string Password, HttpClient Client, string Cookie);
