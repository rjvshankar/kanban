using Api.Controllers;
using Api.Data;
using Api.Dtos;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class ColumnsControllerTests
{
    private readonly IBoardRepository _boards = Substitute.For<IBoardRepository>();
    private readonly IColumnRepository _columns = Substitute.For<IColumnRepository>();
    private readonly IBoardNotifier _notifier = Substitute.For<IBoardNotifier>();
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private ColumnsController Controller(int? userId = 1) => new ColumnsController(_boards, _columns, _notifier).AsUser(userId);

    private void Role(string? role) => _boards.GetRoleAsync(1, 10, Arg.Any<CancellationToken>()).Returns(role);

    [Fact]
    public async Task Owner_creates_column_with_trimmed_name_and_board_is_notified()
    {
        Role("owner");
        _columns.CreateAsync(10, "Doing", Arg.Any<CancellationToken>()).Returns((55, 2000));

        var result = await Controller().Create(10, new ColumnNameRequest("  Doing  "), Ct);

        var created = result.ShouldBeOfType<ObjectResult>();
        created.StatusCode.ShouldBe(201);
        created.Value.ShouldBeOfType<ColumnResponse>().ShouldSatisfyAllConditions(
            c => c.Id.ShouldBe(55), c => c.Name.ShouldBe("Doing"), c => c.Position.ShouldBe(2000));
        await _notifier.Received(1).NotifyChangedAsync(10);
    }

    [Theory]
    [InlineData("editor")]
    [InlineData("viewer")]
    public async Task Non_owners_are_forbidden_and_nothing_happens(string role)
    {
        Role(role);

        var result = await Controller().Create(10, new ColumnNameRequest("X"), Ct);

        result.ShouldBeOfType<ForbidResult>();
        await _columns.DidNotReceiveWithAnyArgs().CreateAsync(default, default!, TestContext.Current.CancellationToken);
        await _notifier.DidNotReceiveWithAnyArgs().NotifyChangedAsync(default);
    }

    [Fact]
    public async Task Non_member_gets_404_not_403()
    {
        Role(null);
        (await Controller().Create(10, new ColumnNameRequest("X"), Ct)).ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Missing_user_id_is_unauthorized()
    {
        (await Controller(userId: null).Create(10, new ColumnNameRequest("X"), Ct)).ShouldBeOfType<UnauthorizedResult>();
    }

    [Fact]
    public async Task Renaming_an_unknown_column_is_404_without_touching_the_repo()
    {
        _columns.GetBoardIdAsync(99, Arg.Any<CancellationToken>()).Returns((int?)null);

        (await Controller().Rename(99, new ColumnNameRequest("X"), Ct)).ShouldBeOfType<NotFoundResult>();

        await _columns.DidNotReceiveWithAnyArgs().RenameAsync(default, default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Rename_notifies_the_columns_board()
    {
        _columns.GetBoardIdAsync(7, Arg.Any<CancellationToken>()).Returns(10);
        Role("owner");
        _columns.RenameAsync(7, "New", Arg.Any<CancellationToken>()).Returns(true);

        (await Controller().Rename(7, new ColumnNameRequest(" New "), Ct)).ShouldBeOfType<NoContentResult>();

        await _notifier.Received(1).NotifyChangedAsync(10);
    }

    [Fact]
    public async Task Invalid_move_position_is_400_and_does_not_notify()
    {
        _columns.GetBoardIdAsync(7, Arg.Any<CancellationToken>()).Returns(10);
        Role("owner");
        _columns.MoveAsync(7, 10, 3, Arg.Any<CancellationToken>()).Returns(false);

        (await Controller().Move(7, new MoveColumnRequest(3), Ct)).ShouldBeOfType<BadRequestObjectResult>();

        await _notifier.DidNotReceiveWithAnyArgs().NotifyChangedAsync(default);
    }

    [Fact]
    public async Task Delete_of_already_deleted_column_is_404_and_does_not_notify()
    {
        _columns.GetBoardIdAsync(7, Arg.Any<CancellationToken>()).Returns(10);
        Role("owner");
        _columns.SoftDeleteAsync(7, Arg.Any<CancellationToken>()).Returns(false);

        (await Controller().Delete(7, Ct)).ShouldBeOfType<NotFoundResult>();

        await _notifier.DidNotReceiveWithAnyArgs().NotifyChangedAsync(default);
    }
}
