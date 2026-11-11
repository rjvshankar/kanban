using System.Net;
using System.Net.Http.Json;
using Api.Dtos;
using Api.Tests.Infrastructure;
using Shouldly;

namespace Api.Tests.Integration;

public sealed class CardTests(ApiFixture fixture) : IntegrationTest(fixture)
{
    [Fact]
    public async Task Update_changes_all_fields_and_null_clears_them()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var card = await CreateCardAsync(owner, await CreateColumnAsync(owner, board));

        await owner.Client.PatchAsJsonAsync($"/api/cards/{card}", new CardRequest("T", "desc", new DateOnly(2030, 1, 2)), TestContext.Current.CancellationToken);
        var after = (await GetBoardAsync(owner, board)).Columns.Single().Cards.Single();
        (after.Title, after.Description, after.DueDate).ShouldBe(("T", "desc", new DateOnly(2030, 1, 2)));

        await owner.Client.PatchAsJsonAsync($"/api/cards/{card}", new CardRequest("T", null, null), TestContext.Current.CancellationToken);
        var cleared = (await GetBoardAsync(owner, board)).Columns.Single().Cards.Single();
        cleared.Description.ShouldBeNull();
        cleared.DueDate.ShouldBeNull();
    }

    [Fact]
    public async Task Move_between_columns_and_reorder()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var a = await CreateColumnAsync(owner, board, "A");
        var b = await CreateColumnAsync(owner, board, "B");
        var c1 = await CreateCardAsync(owner, a, "c1");
        var c2 = await CreateCardAsync(owner, a, "c2");
        var c3 = await CreateCardAsync(owner, a, "c3");

        // c3 to the front of column B (empty), then c1 after c3.
        (await owner.Client.PostAsJsonAsync($"/api/cards/{c3}/move", new MoveCardRequest(b, null), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await owner.Client.PostAsJsonAsync($"/api/cards/{c1}/move", new MoveCardRequest(b, c3), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var cols = (await GetBoardAsync(owner, board)).Columns;
        cols.First(c => c.Id == a).Cards.Select(c => c.Id).ShouldBe([c2]);
        cols.First(c => c.Id == b).Cards.Select(c => c.Id).ShouldBe([c3, c1]);
    }

    [Fact]
    public async Task Move_to_column_on_another_board_is_rejected()
    {
        var owner = await NewUserAsync();
        var board1 = await CreateBoardAsync(owner);
        var board2 = await CreateBoardAsync(owner);
        var card = await CreateCardAsync(owner, await CreateColumnAsync(owner, board1));
        var foreign = await CreateColumnAsync(owner, board2);

        (await owner.Client.PostAsJsonAsync($"/api/cards/{card}/move", new MoveCardRequest(foreign, null), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Delete_removes_card_from_board()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var card = await CreateCardAsync(owner, await CreateColumnAsync(owner, board));

        (await owner.Client.DeleteAsync($"/api/cards/{card}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await GetBoardAsync(owner, board)).Columns.Single().Cards.ShouldBeEmpty();
        (await owner.Client.DeleteAsync($"/api/cards/{card}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Cards_on_other_users_boards_are_not_found()
    {
        var owner = await NewUserAsync();
        var stranger = await NewUserAsync();
        var card = await CreateCardAsync(owner, await CreateColumnAsync(owner, await CreateBoardAsync(owner)));

        (await stranger.Client.PatchAsJsonAsync($"/api/cards/{card}", new CardRequest("x", null, null), TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await stranger.Client.DeleteAsync($"/api/cards/{card}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
