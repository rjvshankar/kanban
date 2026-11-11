using Api.Data;

namespace Api.Services;

/// <summary>
/// Runs the purge once at startup (catches up after downtime), then every 24 hours.
/// All the logic lives in the dbo.PurgeArchivedBoards stored procedure; this only owns the timing.
/// </summary>
public sealed class ArchivePurgeService(IBoardRepository boards, ILogger<ArchivePurgeService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                var purged = await boards.PurgeArchivedAsync(stoppingToken);
                logger.LogInformation("Archive purge finished: {Count} board(s) moved to long-term archive.", purged);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Archive purge failed; will retry in {Hours}h.", Interval.TotalHours);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
