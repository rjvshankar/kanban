using System.Net;
using System.Net.Http.Json;
using Api.Data;
using Api.Dtos;
using Api.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;

namespace Api.Tests.Integration;

/// <summary>Soft delete, restore within 30 days, the purge stored proc, and restore from the long-term archive.</summary>
public sealed class ArchiveTests(ApiFixture fixture) : IntegrationTest(fixture)
{
    private async Task<int> PurgeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IBoardRepository>().PurgeArchivedAsync(CancellationToken.None);
    }

    private Task AgeBoardAsync(int boardId, int days) =>
        Fixture.ExecuteAsync("UPDATE dbo.Boards SET DeletedAt = DATEADD(day, -@days, SYSUTCDATETIME()) WHERE Id = @boardId",
            new { days, boardId });

    [Fact]
    public async Task Deleted_board_leaves_list_and_appears_in_archived()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner, "Old");
        (await owner.Client.DeleteAsync($"/api/boards/{board}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await owner.Client.GetFromJsonAsync<List<BoardSummaryResponse>>("/api/boards", TestContext.Current.CancellationToken))!.ShouldBeEmpty();
        (await owner.Client.GetAsync($"/api/boards/{board}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var archived = (await owner.Client.GetFromJsonAsync<List<ArchivedBoardResponse>>("/api/boards/archived", TestContext.Current.CancellationToken))!.ShouldHaveSingleItem();
        archived.Id.ShouldBe(board);
        archived.DaysLeft.ShouldBeInRange(29, 30);
    }

    [Fact]
    public async Task Owner_can_restore_with_contents_intact()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        await CreateCardAsync(owner, await CreateColumnAsync(owner, board), "Keep me");
        await owner.Client.DeleteAsync($"/api/boards/{board}", TestContext.Current.CancellationToken);

        (await owner.Client.PostAsync($"/api/boards/{board}/restore", null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await GetBoardAsync(owner, board)).Columns.Single().Cards.Single().Title.ShouldBe("Keep me");
    }

    [Fact]
    public async Task Only_owners_see_and_restore_archived_boards()
    {
        var owner = await NewUserAsync();
        var editor = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        await AddMemberAsync(owner, board, editor, "editor");
        await owner.Client.DeleteAsync($"/api/boards/{board}", TestContext.Current.CancellationToken);

        (await editor.Client.GetFromJsonAsync<List<ArchivedBoardResponse>>("/api/boards/archived", TestContext.Current.CancellationToken))!.ShouldBeEmpty();
        (await editor.Client.PostAsync($"/api/boards/{board}/restore", null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Restore_after_retention_window_fails()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        await owner.Client.DeleteAsync($"/api/boards/{board}", TestContext.Current.CancellationToken);
        await AgeBoardAsync(board, 31);

        (await owner.Client.PostAsync($"/api/boards/{board}/restore", null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Purge_moves_only_expired_boards_to_long_term_archive()
    {
        var owner = await NewUserAsync();
        var expired = await CreateBoardAsync(owner, "Expired");
        var recent = await CreateBoardAsync(owner, "Recent");
        var live = await CreateBoardAsync(owner, "Live");
        await CreateCardAsync(owner, await CreateColumnAsync(owner, expired), "c");
        await owner.Client.DeleteAsync($"/api/boards/{expired}", TestContext.Current.CancellationToken);
        await owner.Client.DeleteAsync($"/api/boards/{recent}", TestContext.Current.CancellationToken);
        await AgeBoardAsync(expired, 31);

        (await PurgeAsync()).ShouldBe(1);

        (await Fixture.ScalarAsync<int>("SELECT COUNT(*) FROM dbo.Boards WHERE Id = @expired", new { expired })).ShouldBe(0);
        (await Fixture.ScalarAsync<int>("SELECT COUNT(*) FROM dbo.DeletedBoards WHERE Id = @expired", new { expired })).ShouldBe(1);
        (await Fixture.ScalarAsync<int>("SELECT COUNT(*) FROM dbo.DeletedCards")).ShouldBe(1);
        (await Fixture.ScalarAsync<int>("SELECT COUNT(*) FROM dbo.Boards WHERE Id IN (@recent, @live)", new { recent, live })).ShouldBe(2);

        (await owner.Client.GetFromJsonAsync<List<PurgedBoardResponse>>("/api/boards/purged", TestContext.Current.CancellationToken))!.ShouldHaveSingleItem().Id.ShouldBe(expired);
        (await PurgeAsync()).ShouldBe(0); // idempotent
    }

    [Fact]
    public async Task Purged_board_restores_via_archive_then_normal_restore()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner, "Revived");
        await CreateCardAsync(owner, await CreateColumnAsync(owner, board), "Still here");
        await owner.Client.DeleteAsync($"/api/boards/{board}", TestContext.Current.CancellationToken);
        await AgeBoardAsync(board, 31);
        await PurgeAsync();

        (await owner.Client.PostAsync($"/api/boards/{board}/restore-purged", null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await owner.Client.GetFromJsonAsync<List<PurgedBoardResponse>>("/api/boards/purged", TestContext.Current.CancellationToken))!.ShouldBeEmpty();
        var archived = (await owner.Client.GetFromJsonAsync<List<ArchivedBoardResponse>>("/api/boards/archived", TestContext.Current.CancellationToken))!.ShouldHaveSingleItem();
        archived.DaysLeft.ShouldBeInRange(29, 30); // fresh window

        (await owner.Client.PostAsync($"/api/boards/{board}/restore", null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await GetBoardAsync(owner, board)).Columns.Single().Cards.Single().Title.ShouldBe("Still here");
    }

    [Fact]
    public async Task Only_former_owners_can_restore_purged_board()
    {
        var owner = await NewUserAsync();
        var editor = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        await AddMemberAsync(owner, board, editor, "editor");
        await owner.Client.DeleteAsync($"/api/boards/{board}", TestContext.Current.CancellationToken);
        await AgeBoardAsync(board, 31);
        await PurgeAsync();

        (await editor.Client.GetFromJsonAsync<List<PurgedBoardResponse>>("/api/boards/purged", TestContext.Current.CancellationToken))!.ShouldBeEmpty();
        (await editor.Client.PostAsync($"/api/boards/{board}/restore-purged", null, TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
