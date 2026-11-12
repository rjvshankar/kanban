using Api.Controllers;
using Api.Data;
using Api.Dtos;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class BoardsControllerTests
{
    private readonly IBoardRepository _boards = Substitute.For<IBoardRepository>();
    private readonly IBoardNotifier _notifier = Substitute.For<IBoardNotifier>();
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private BoardsController Controller(int? userId = 1) => new BoardsController(_boards, _notifier).AsUser(userId);

    [Theory]
    [InlineData(10, 20)]  // deleted 10 days ago -> 20 days left
    [InlineData(0, 30)]
    [InlineData(29, 1)]
    [InlineData(30, 0)]
    [InlineData(45, 0)]   // never negative
    public async Task Archived_days_left_counts_down_and_is_clamped(int daysAgo, int expectedLeft)
    {
        // SQL Server returns DateTime with Kind=Unspecified; the controller must treat it as UTC.
        var deletedAt = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-daysAgo).AddMinutes(-1), DateTimeKind.Unspecified);
        _boards.ListArchivedAsync(1, Arg.Any<CancellationToken>())
            .Returns([new ArchivedBoardRow { Id = 4, Name = "Old", DeletedAt = deletedAt }]);

        var ok = (await Controller().ListArchived(Ct)).ShouldBeOfType<OkObjectResult>();

        var item = ((IEnumerable<ArchivedBoardResponse>)ok.Value!).Single();
        item.DaysLeft.ShouldBe(expectedLeft);
        item.DeletedAt.Kind.ShouldBe(DateTimeKind.Utc);
    }

    [Fact]
    public async Task Purged_list_is_marked_utc()
    {
        _boards.ListPurgedAsync(1, Arg.Any<CancellationToken>())
            .Returns([new PurgedBoardRow { Id = 4, Name = "Gone", PurgedAt = new DateTime(2026, 1, 1) }]);

        var ok = (await Controller().ListPurged(Ct)).ShouldBeOfType<OkObjectResult>();

        ((IEnumerable<PurgedBoardResponse>)ok.Value!).Single().PurgedAt.Kind.ShouldBe(DateTimeKind.Utc);
    }

    [Fact]
    public async Task Get_maps_cards_to_their_columns_and_due_dates_to_dateonly()
    {
        _boards.GetRoleAsync(1, 10, Arg.Any<CancellationToken>()).Returns("editor");
        _boards.GetContentsAsync(10, Arg.Any<CancellationToken>()).Returns(new BoardContents(
            new BoardRow { Id = 10, Name = "B", CreatedAt = new DateTime(2026, 1, 1) },
            [new ColumnRow { Id = 1, Name = "A", Position = 1000 }, new ColumnRow { Id = 2, Name = "B", Position = 2000 }],
            [
                new CardRow { Id = 100, ColumnId = 2, Title = "in B", Position = 1000, DueDate = new DateTime(2030, 5, 6, 13, 0, 0) },
                new CardRow { Id = 101, ColumnId = 1, Title = "in A", Position = 1000 }
            ]));

        var ok = (await Controller().Get(10, Ct)).ShouldBeOfType<OkObjectResult>();

        var board = ok.Value.ShouldBeOfType<BoardResponse>();
        board.Role.ShouldBe("editor");
        board.Columns[0].Cards.Single().Title.ShouldBe("in A");
        board.Columns[0].Cards.Single().DueDate.ShouldBeNull();
        board.Columns[1].Cards.Single().DueDate.ShouldBe(new DateOnly(2030, 5, 6));
    }

    [Fact]
    public async Task Get_for_non_member_is_404_without_loading_contents()
    {
        _boards.GetRoleAsync(1, 10, Arg.Any<CancellationToken>()).Returns((string?)null);

        (await Controller().Get(10, Ct)).ShouldBeOfType<NotFoundResult>();

        await _boards.DidNotReceiveWithAnyArgs().GetContentsAsync(default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Get_when_board_vanishes_between_calls_is_404()
    {
        _boards.GetRoleAsync(1, 10, Arg.Any<CancellationToken>()).Returns("owner");
        _boards.GetContentsAsync(10, Arg.Any<CancellationToken>()).Returns((BoardContents?)null);

        (await Controller().Get(10, Ct)).ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Create_trims_name_and_makes_caller_owner()
    {
        _boards.CreateAsync("Roadmap", 1, Arg.Any<CancellationToken>()).Returns(33);

        var result = await Controller().Create(new CreateBoardRequest("  Roadmap "), Ct);

        var created = result.ShouldBeOfType<CreatedAtActionResult>();
        created.StatusCode.ShouldBe(201);
        created.RouteValues!["id"].ShouldBe(33);
    }

    [Theory]
    [InlineData("editor")]
    [InlineData("viewer")]
    public async Task Rename_and_delete_forbidden_for_non_owners(string role)
    {
        _boards.GetRoleAsync(1, 10, Arg.Any<CancellationToken>()).Returns(role);

        (await Controller().Rename(10, new UpdateBoardRequest("X"), Ct)).ShouldBeOfType<ForbidResult>();
        (await Controller().Delete(10, Ct)).ShouldBeOfType<ForbidResult>();

        await _boards.DidNotReceiveWithAnyArgs().RenameAsync(default, default!, TestContext.Current.CancellationToken);
        await _boards.DidNotReceiveWithAnyArgs().SoftDeleteAsync(default, TestContext.Current.CancellationToken);
        await _notifier.DidNotReceiveWithAnyArgs().NotifyChangedAsync(default);
    }

    [Fact]
    public async Task Delete_notifies_viewers_so_they_see_board_not_found()
    {
        _boards.GetRoleAsync(1, 10, Arg.Any<CancellationToken>()).Returns("owner");
        _boards.SoftDeleteAsync(10, Arg.Any<CancellationToken>()).Returns(true);

        (await Controller().Delete(10, Ct)).ShouldBeOfType<NoContentResult>();

        await _notifier.Received(1).NotifyChangedAsync(10);
    }

    [Fact]
    public async Task Restore_of_nothing_restorable_is_404()
    {
        _boards.RestoreAsync(1, 10, Arg.Any<CancellationToken>()).Returns(false);
        (await Controller().Restore(10, Ct)).ShouldBeOfType<NotFoundResult>();

        _boards.RestorePurgedAsync(1, 10, Arg.Any<CancellationToken>()).Returns(false);
        (await Controller().RestorePurged(10, Ct)).ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Every_endpoint_rejects_a_token_without_user_id()
    {
        var c = Controller(userId: null);

        (await c.List(Ct)).ShouldBeOfType<UnauthorizedResult>();
        (await c.ListArchived(Ct)).ShouldBeOfType<UnauthorizedResult>();
        (await c.Get(1, Ct)).ShouldBeOfType<UnauthorizedResult>();
        (await c.Restore(1, Ct)).ShouldBeOfType<UnauthorizedResult>();
        (await c.Delete(1, Ct)).ShouldBeOfType<UnauthorizedResult>();
    }
}
