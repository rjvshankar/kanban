using System.Net.Http.Json;
using Api.Dtos;
using Api.Tests.Infrastructure;
using Shouldly;

namespace Api.Tests.Integration;

/// <summary>
/// Cards and columns use gapped integer positions (gap 1000). Repeatedly inserting at the same spot halves
/// the gap until it runs out and the whole container is renumbered. These tests push past that point.
/// </summary>
public sealed class OrderingTests(ApiFixture fixture) : IntegrationTest(fixture)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static void ShouldBeStrictlyIncreasing(IEnumerable<int> positions) =>
        positions.Zip(positions.Skip(1)).ShouldAllBe(p => p.First < p.Second);

    [Fact]
    public async Task Cards_keep_order_when_repeatedly_moved_to_the_top_past_gap_exhaustion()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var column = await CreateColumnAsync(owner, board);
        var order = new List<int>();
        for (var i = 0; i < 4; i++) order.Add(await CreateCardAsync(owner, column, $"c{i}"));

        for (var i = 0; i < 30; i++) // 1000 halves to <2 after ~10 moves, so this renumbers at least twice
        {
            var last = order[^1];
            order.RemoveAt(order.Count - 1);
            order.Insert(0, last);
            (await owner.Client.PostAsJsonAsync($"/api/cards/{last}/move", new MoveCardRequest(column, null), Ct)).EnsureSuccessStatusCode();

            var cards = (await GetBoardAsync(owner, board)).Columns.Single().Cards;
            cards.Select(c => c.Id).ShouldBe(order, $"after move {i}");
            ShouldBeStrictlyIncreasing(cards.Select(c => c.Position));
        }
    }

    [Fact]
    public async Task Cards_keep_order_when_repeatedly_inserted_between_the_same_neighbours()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var column = await CreateColumnAsync(owner, board);
        var order = new List<int>();
        for (var i = 0; i < 4; i++) order.Add(await CreateCardAsync(owner, column, $"c{i}"));

        for (var i = 0; i < 30; i++) // always slot the last card right after the first
        {
            var last = order[^1];
            order.RemoveAt(order.Count - 1);
            order.Insert(1, last);
            (await owner.Client.PostAsJsonAsync($"/api/cards/{last}/move", new MoveCardRequest(column, order[0]), Ct)).EnsureSuccessStatusCode();

            var cards = (await GetBoardAsync(owner, board)).Columns.Single().Cards;
            cards.Select(c => c.Id).ShouldBe(order, $"after move {i}");
            ShouldBeStrictlyIncreasing(cards.Select(c => c.Position));
        }
    }

    [Fact]
    public async Task Columns_keep_order_when_repeatedly_moved_to_the_front_past_gap_exhaustion()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var order = new List<int>();
        for (var i = 0; i < 4; i++) order.Add(await CreateColumnAsync(owner, board, $"col{i}"));

        for (var i = 0; i < 30; i++)
        {
            var last = order[^1];
            order.RemoveAt(order.Count - 1);
            order.Insert(0, last);
            (await owner.Client.PostAsJsonAsync($"/api/columns/{last}/move", new MoveColumnRequest(null), Ct)).EnsureSuccessStatusCode();

            var columns = (await GetBoardAsync(owner, board)).Columns;
            columns.Select(c => c.Id).ShouldBe(order, $"after move {i}");
            ShouldBeStrictlyIncreasing(columns.Select(c => c.Position));
        }
    }

    [Fact]
    public async Task Moving_a_card_between_columns_leaves_both_orders_intact()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var a = await CreateColumnAsync(owner, board, "A");
        var b = await CreateColumnAsync(owner, board, "B");
        var a1 = await CreateCardAsync(owner, a, "a1");
        var a2 = await CreateCardAsync(owner, a, "a2");
        var b1 = await CreateCardAsync(owner, b, "b1");
        var b2 = await CreateCardAsync(owner, b, "b2");

        (await owner.Client.PostAsJsonAsync($"/api/cards/{a1}/move", new MoveCardRequest(b, b1), Ct)).EnsureSuccessStatusCode();

        var cols = (await GetBoardAsync(owner, board)).Columns;
        cols.Single(c => c.Id == a).Cards.Select(c => c.Id).ShouldBe([a2]);
        cols.Single(c => c.Id == b).Cards.Select(c => c.Id).ShouldBe([b1, a1, b2]);
    }

    [Fact]
    public async Task After_a_neighbour_is_deleted_new_cards_still_append_at_the_end()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var column = await CreateColumnAsync(owner, board);
        var c1 = await CreateCardAsync(owner, column, "c1");
        var c2 = await CreateCardAsync(owner, column, "c2");
        await owner.Client.DeleteAsync($"/api/cards/{c2}", Ct);

        var c3 = await CreateCardAsync(owner, column, "c3");

        (await GetBoardAsync(owner, board)).Columns.Single().Cards.Select(c => c.Id).ShouldBe([c1, c3]);
    }
}
