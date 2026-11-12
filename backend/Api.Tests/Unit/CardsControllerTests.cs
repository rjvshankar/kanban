using Api.Controllers;
using Api.Data;
using Api.Dtos;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class CardsControllerTests
{
    private readonly IBoardRepository _boards = Substitute.For<IBoardRepository>();
    private readonly IColumnRepository _columns = Substitute.For<IColumnRepository>();
    private readonly ICardRepository _cards = Substitute.For<ICardRepository>();
    private readonly IBoardNotifier _notifier = Substitute.For<IBoardNotifier>();
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private CardsController Controller() => new CardsController(_boards, _columns, _cards, _notifier).AsUser(1);

    private void Role(string? role) => _boards.GetRoleAsync(1, 10, Arg.Any<CancellationToken>()).Returns(role);

    [Theory]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData("  hello  ", "hello")]
    public async Task Blank_descriptions_are_stored_as_null_and_others_trimmed(string? input, string? stored)
    {
        _columns.GetBoardIdAsync(3, Arg.Any<CancellationToken>()).Returns(10);
        Role("editor");
        _cards.CreateAsync(3, "Title", stored, null, Arg.Any<CancellationToken>()).Returns((9, 1000));

        var result = await Controller().Create(3, new CardRequest("  Title ", input, null), Ct);

        result.Status().ShouldBe(201);
        await _cards.Received(1).CreateAsync(3, "Title", stored, null, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Viewer_cannot_create_cards()
    {
        _columns.GetBoardIdAsync(3, Arg.Any<CancellationToken>()).Returns(10);
        Role("viewer");

        (await Controller().Create(3, new CardRequest("T", null, null), Ct)).ShouldBeOfType<ForbidResult>();

        await _cards.DidNotReceiveWithAnyArgs().CreateAsync(default, default!, default, default, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Creating_in_unknown_column_is_404()
    {
        _columns.GetBoardIdAsync(3, Arg.Any<CancellationToken>()).Returns((int?)null);
        (await Controller().Create(3, new CardRequest("T", null, null), Ct)).ShouldBeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Moving_to_a_column_on_another_board_is_400_before_any_move()
    {
        _cards.GetContextAsync(5, Arg.Any<CancellationToken>()).Returns(new CardContext(BoardId: 10, ColumnId: 3));
        Role("editor");
        _columns.GetBoardIdAsync(8, Arg.Any<CancellationToken>()).Returns(99); // other board

        (await Controller().Move(5, new MoveCardRequest(8, null), Ct)).ShouldBeOfType<BadRequestObjectResult>();

        await _cards.DidNotReceiveWithAnyArgs().MoveAsync(default, default, default, TestContext.Current.CancellationToken);
        await _notifier.DidNotReceiveWithAnyArgs().NotifyChangedAsync(default);
    }

    [Fact]
    public async Task Moving_to_a_missing_column_is_400()
    {
        _cards.GetContextAsync(5, Arg.Any<CancellationToken>()).Returns(new CardContext(10, 3));
        Role("editor");
        _columns.GetBoardIdAsync(8, Arg.Any<CancellationToken>()).Returns((int?)null);

        (await Controller().Move(5, new MoveCardRequest(8, null), Ct)).ShouldBeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Successful_move_notifies_the_board()
    {
        _cards.GetContextAsync(5, Arg.Any<CancellationToken>()).Returns(new CardContext(10, 3));
        Role("editor");
        _columns.GetBoardIdAsync(8, Arg.Any<CancellationToken>()).Returns(10);
        _cards.MoveAsync(5, 8, 4, Arg.Any<CancellationToken>()).Returns(true);

        (await Controller().Move(5, new MoveCardRequest(8, 4), Ct)).ShouldBeOfType<NoContentResult>();

        await _notifier.Received(1).NotifyChangedAsync(10);
    }

    [Fact]
    public async Task Invalid_position_is_400()
    {
        _cards.GetContextAsync(5, Arg.Any<CancellationToken>()).Returns(new CardContext(10, 3));
        Role("editor");
        _columns.GetBoardIdAsync(3, Arg.Any<CancellationToken>()).Returns(10);
        _cards.MoveAsync(5, 3, 77, Arg.Any<CancellationToken>()).Returns(false);

        (await Controller().Move(5, new MoveCardRequest(3, 77), Ct)).ShouldBeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Unknown_card_is_404_for_update_and_delete()
    {
        _cards.GetContextAsync(5, Arg.Any<CancellationToken>()).Returns((CardContext?)null);

        (await Controller().Update(5, new CardRequest("T", null, null), Ct)).ShouldBeOfType<NotFoundResult>();
        (await Controller().Delete(5, Ct)).ShouldBeOfType<NotFoundResult>();
    }
}
