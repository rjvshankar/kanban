using System.Net;
using System.Net.Http.Json;
using Api.Dtos;
using Api.Tests.Infrastructure;
using Shouldly;

namespace Api.Tests.Integration;

/// <summary>owner: everything. editor: cards only. viewer: read-only.</summary>
public sealed class RolePermissionTests(ApiFixture fixture) : IntegrationTest(fixture)
{
    private async Task<(TestUser User, int Board, int Column, int Card)> SetUpAsync(string role)
    {
        var owner = await NewUserAsync("owner");
        var member = await NewUserAsync("member");
        var board = await CreateBoardAsync(owner);
        var column = await CreateColumnAsync(owner, board);
        var card = await CreateCardAsync(owner, column);
        if (role == "owner") return (owner, board, column, card);
        await AddMemberAsync(owner, board, member, role);
        return (member, board, column, card);
    }

    [Theory]
    [InlineData("owner", HttpStatusCode.Created)]
    [InlineData("editor", HttpStatusCode.Forbidden)]
    [InlineData("viewer", HttpStatusCode.Forbidden)]
    public async Task Create_column(string role, HttpStatusCode expected)
    {
        var (user, board, _, _) = await SetUpAsync(role);
        var res = await user.Client.PostAsJsonAsync($"/api/boards/{board}/columns", new ColumnNameRequest("New"), TestContext.Current.CancellationToken);
        res.StatusCode.ShouldBe(expected);
    }

    [Theory]
    [InlineData("owner", HttpStatusCode.NoContent)]
    [InlineData("editor", HttpStatusCode.Forbidden)]
    [InlineData("viewer", HttpStatusCode.Forbidden)]
    public async Task Delete_column(string role, HttpStatusCode expected)
    {
        var (user, _, column, _) = await SetUpAsync(role);
        (await user.Client.DeleteAsync($"/api/columns/{column}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(expected);
    }

    [Theory]
    [InlineData("owner", HttpStatusCode.Created)]
    [InlineData("editor", HttpStatusCode.Created)]
    [InlineData("viewer", HttpStatusCode.Forbidden)]
    public async Task Create_card(string role, HttpStatusCode expected)
    {
        var (user, _, column, _) = await SetUpAsync(role);
        var res = await user.Client.PostAsJsonAsync($"/api/columns/{column}/cards", new CardRequest("New", null, null), TestContext.Current.CancellationToken);
        res.StatusCode.ShouldBe(expected);
    }

    [Theory]
    [InlineData("owner", HttpStatusCode.NoContent)]
    [InlineData("editor", HttpStatusCode.NoContent)]
    [InlineData("viewer", HttpStatusCode.Forbidden)]
    public async Task Update_card(string role, HttpStatusCode expected)
    {
        var (user, _, _, card) = await SetUpAsync(role);
        var res = await user.Client.PatchAsJsonAsync($"/api/cards/{card}", new CardRequest("Edited", "d", null), TestContext.Current.CancellationToken);
        res.StatusCode.ShouldBe(expected);
    }

    [Theory]
    [InlineData("owner", HttpStatusCode.OK)]
    [InlineData("editor", HttpStatusCode.OK)]
    [InlineData("viewer", HttpStatusCode.OK)]
    public async Task Everyone_can_read_the_board(string role, HttpStatusCode expected)
    {
        var (user, board, _, _) = await SetUpAsync(role);
        (await user.Client.GetAsync($"/api/boards/{board}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(expected);
    }

    [Theory]
    [InlineData("editor")]
    [InlineData("viewer")]
    public async Task Only_owners_can_manage_members(string role)
    {
        var (user, board, _, _) = await SetUpAsync(role);
        (await user.Client.GetAsync($"/api/boards/{board}/members", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await user.Client.PostAsJsonAsync($"/api/boards/{board}/members", new AddMemberRequest(user.Id, "owner"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
