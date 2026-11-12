using Api.Hubs;
using Api.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class BoardNotifierTests
{
    private readonly IClientProxy _group = Substitute.For<IClientProxy>();
    private readonly IHubContext<BoardHub> _hub = Substitute.For<IHubContext<BoardHub>>();
    private readonly BoardNotifier _notifier;

    public BoardNotifierTests()
    {
        var clients = Substitute.For<IHubClients>();
        clients.Group(Arg.Any<string>()).Returns(_group);
        _hub.Clients.Returns(clients);
        _notifier = new BoardNotifier(_hub, NullLogger<BoardNotifier>.Instance);
    }

    [Fact]
    public async Task Pings_only_the_boards_group_with_the_changed_event()
    {
        await _notifier.NotifyChangedAsync(5);

        _hub.Clients.Received(1).Group("board-5");
        await _group.Received(1).SendCoreAsync("BoardChanged", Arg.Is<object?[]>(a => a.Length == 0), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Failed_ping_is_swallowed()
    {
        _group.SendCoreAsync(default!, default!, TestContext.Current.CancellationToken).ReturnsForAnyArgs(Task.FromException(new InvalidOperationException("boom")));

        await Should.NotThrowAsync(() => _notifier.NotifyChangedAsync(5));
    }

    [Fact]
    public async Task Failure_resolving_the_group_is_swallowed()
    {
        _hub.Clients.Throws(new InvalidOperationException("boom"));

        await Should.NotThrowAsync(() => _notifier.NotifyChangedAsync(5));
    }

    [Fact]
    public void Group_names_are_per_board() => BoardHub.GroupName(12).ShouldBe("board-12");
}
