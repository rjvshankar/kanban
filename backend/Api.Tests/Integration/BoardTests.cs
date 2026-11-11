using System.Net;
using System.Net.Http.Json;
using Api.Dtos;
using Api.Tests.Infrastructure;
using Shouldly;

namespace Api.Tests.Integration;

public sealed class BoardTests(ApiFixture fixture) : IntegrationTest(fixture)
{
    [Fact]
    public async Task Create_board_makes_caller_owner_and_lists_it()
    {
        var owner = await NewUserAsync();
        var id = await CreateBoardAsync(owner, "Roadmap");

        var list = await owner.Client.GetFromJsonAsync<List<BoardSummaryResponse>>("/api/boards", TestContext.Current.CancellationToken);
        var board = list!.ShouldHaveSingleItem();
        board.Id.ShouldBe(id);
        board.Name.ShouldBe("Roadmap");
        board.Role.ShouldBe("owner");
    }

    [Fact]
    public async Task Board_name_is_trimmed_and_validated()
    {
        var owner = await NewUserAsync();
        var res = await owner.Client.PostAsJsonAsync("/api/boards", new CreateBoardRequest("  Padded  "), TestContext.Current.CancellationToken);
        res.StatusCode.ShouldBe(HttpStatusCode.Created);
        (await GetBoardAsync(owner, await CreateBoardAsync(owner, "  Padded  "))).Name.ShouldBe("Padded");

        (await owner.Client.PostAsJsonAsync("/api/boards", new CreateBoardRequest(""), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Non_member_gets_404_not_403()
    {
        var owner = await NewUserAsync();
        var stranger = await NewUserAsync();
        var id = await CreateBoardAsync(owner);

        (await stranger.Client.GetAsync($"/api/boards/{id}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await stranger.Client.GetFromJsonAsync<List<BoardSummaryResponse>>("/api/boards", TestContext.Current.CancellationToken))!.ShouldBeEmpty();
    }

    [Fact]
    public async Task Board_returns_columns_and_cards_in_order()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var todo = await CreateColumnAsync(owner, board, "To do");
        var done = await CreateColumnAsync(owner, board, "Done");
        await CreateCardAsync(owner, todo, "First");
        await CreateCardAsync(owner, todo, "Second");

        var contents = await GetBoardAsync(owner, board);
        contents.Columns.Select(c => c.Name).ShouldBe(["To do", "Done"]);
        contents.Columns.First(c => c.Id == done).Cards.ShouldBeEmpty();
        contents.Columns.First(c => c.Id == todo).Cards.Select(c => c.Title).ShouldBe(["First", "Second"]);
    }

    [Fact]
    public async Task Rename_and_delete_are_owner_only()
    {
        var owner = await NewUserAsync();
        var editor = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        await AddMemberAsync(owner, board, editor, "editor");

        (await editor.Client.PatchAsJsonAsync($"/api/boards/{board}", new UpdateBoardRequest("Hacked"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await editor.Client.DeleteAsync($"/api/boards/{board}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        (await owner.Client.PatchAsJsonAsync($"/api/boards/{board}", new UpdateBoardRequest("Renamed"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await GetBoardAsync(owner, board)).Name.ShouldBe("Renamed");
    }
}
