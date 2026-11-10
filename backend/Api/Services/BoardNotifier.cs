using Api.Hubs;
using Microsoft.AspNetCore.SignalR;
namespace Api.Services;

public sealed class BoardNotifier(IHubContext<BoardHub> hub, ILogger<BoardNotifier> logger) : IBoardNotifier
{
    public async Task NotifyChangedAsync(int boardId)
    {
        try
        {
            await hub.Clients.Group(BoardHub.GroupName(boardId)).SendAsync(BoardHub.ChangedEvent);
        }
        catch (Exception ex)
        {
            // The change itself already succeeded; a failed ping must not turn that into an error response.
            logger.LogWarning(ex, "Failed to notify board {BoardId} subscribers", boardId);
        }
    }
}
