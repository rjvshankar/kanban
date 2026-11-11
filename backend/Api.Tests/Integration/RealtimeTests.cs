using System.Net.Http.Json;
using Api.Dtos;
using Api.Hubs;
using Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.SignalR.Client;
using Shouldly;

namespace Api.Tests.Integration;

public sealed class RealtimeTests(ApiFixture fixture) : IntegrationTest(fixture)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    // Long polling keeps this on the in-memory TestServer (no real sockets needed).
    private async Task<(HubConnection Connection, Func<Task> Changed)> ConnectAsync(TestUser user)
    {
        var received = new SemaphoreSlim(0);
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(Factory.Server.BaseAddress, "hubs/board"), o =>
            {
                o.Transports = HttpTransportType.LongPolling;
                o.HttpMessageHandlerFactory = _ => Factory.Server.CreateHandler();
                o.Headers["Cookie"] = user.Cookie;
            })
            .Build();
        connection.On(BoardHub.ChangedEvent, () => received.Release());
        await connection.StartAsync();
        return (connection, async () => (await received.WaitAsync(Timeout)).ShouldBeTrue("no BoardChanged ping received"));
    }

    [Fact]
    public async Task Member_is_pinged_when_another_member_changes_the_board()
    {
        var owner = await NewUserAsync();
        var editor = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var column = await CreateColumnAsync(owner, board);
        await AddMemberAsync(owner, board, editor, "editor");

        var (conn, changed) = await ConnectAsync(owner);
        await using var _ = conn;
        await conn.InvokeAsync("JoinBoard", board, TestContext.Current.CancellationToken);

        (await editor.Client.PostAsJsonAsync($"/api/columns/{column}/cards", new CardRequest("Live", null, null), TestContext.Current.CancellationToken)).EnsureSuccessStatusCode();

        await changed();
    }

    [Fact]
    public async Task Non_member_cannot_join_board_group()
    {
        var owner = await NewUserAsync();
        var stranger = await NewUserAsync();
        var board = await CreateBoardAsync(owner);

        var (conn, _) = await ConnectAsync(stranger);
        await using var _ = conn;

        var ex = await Should.ThrowAsync<HubException>(() => conn.InvokeAsync("JoinBoard", board));
        ex.Message.ShouldContain("Board not found");
    }

    [Fact]
    public async Task Unauthenticated_connection_is_refused()
    {
        var connection = new HubConnectionBuilder()
            .WithUrl(new Uri(Factory.Server.BaseAddress, "hubs/board"), o =>
            {
                o.Transports = HttpTransportType.LongPolling;
                o.HttpMessageHandlerFactory = _ => Factory.Server.CreateHandler();
            })
            .Build();
        await using var _ = connection;

        await Should.ThrowAsync<HttpRequestException>(() => connection.StartAsync());
    }
}
