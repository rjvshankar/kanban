using Api.Data;
using Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class ArchivePurgeServiceTests
{
    private static readonly TimeSpan Wait = TimeSpan.FromSeconds(5);

    [Fact]
    public async Task Purges_immediately_on_startup()
    {
        var called = new TaskCompletionSource();
        var boards = Substitute.For<IBoardRepository>();
        boards.PurgeArchivedAsync(Arg.Any<CancellationToken>()).Returns(_ => { called.TrySetResult(); return Task.FromResult(3); });
        using var service = new ArchivePurgeService(boards, NullLogger<ArchivePurgeService>.Instance);

        await service.StartAsync(TestContext.Current.CancellationToken);
        await called.Task.WaitAsync(Wait, TestContext.Current.CancellationToken);
        await service.StopAsync(TestContext.Current.CancellationToken);

        await boards.Received(1).PurgeArchivedAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A_failing_purge_does_not_crash_the_service()
    {
        var called = new TaskCompletionSource();
        var boards = Substitute.For<IBoardRepository>();
        boards.PurgeArchivedAsync(Arg.Any<CancellationToken>())
            .Returns(_ => { called.TrySetResult(); return Task.FromException<int>(new InvalidOperationException("db down")); });
        using var service = new ArchivePurgeService(boards, NullLogger<ArchivePurgeService>.Instance);

        await service.StartAsync(TestContext.Current.CancellationToken);
        await called.Task.WaitAsync(Wait, TestContext.Current.CancellationToken);
        await Task.Delay(100, TestContext.Current.CancellationToken);

        service.ExecuteTask!.IsCompleted.ShouldBeFalse("service must keep running to retry in 24h");
        await service.StopAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Stops_cleanly_when_cancelled_during_a_purge()
    {
        var started = new TaskCompletionSource();
        var boards = Substitute.For<IBoardRepository>();
        boards.PurgeArchivedAsync(Arg.Any<CancellationToken>()).Returns(async call =>
        {
            started.TrySetResult();
            await Task.Delay(Timeout.Infinite, call.Arg<CancellationToken>());
            return 0;
        });
        using var service = new ArchivePurgeService(boards, NullLogger<ArchivePurgeService>.Instance);

        await service.StartAsync(TestContext.Current.CancellationToken);
        await started.Task.WaitAsync(Wait, TestContext.Current.CancellationToken);

        await Should.NotThrowAsync(() => service.StopAsync(TestContext.Current.CancellationToken).WaitAsync(Wait, TestContext.Current.CancellationToken));
    }
}
