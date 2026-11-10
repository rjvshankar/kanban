using Api.Data;
using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
namespace Api.Hubs;

/// <summary>
/// Real-time channel for board pages. Clients join the group of the board they are viewing;
/// the server pushes a "BoardChanged" ping to that group after every change (see BoardNotifier).
/// Auth uses the same httpOnly cookie as the REST API.
/// </summary>
[Authorize]
public sealed class BoardHub(IBoardRepository boards) : Hub
{
    public const string ChangedEvent = "BoardChanged";

    public static string GroupName(int boardId) => $"board-{boardId}";

    /// <summary>Subscribes this connection to a board's changes. Only members may join.</summary>
    public async Task JoinBoard(int boardId)
    {
        if (!Context.User!.TryGetUserId(out var userId))
            throw new HubException("Unauthorized.");

        // Same message for "no such board" and "not a member", so ids can't be probed.
        if (await boards.GetRoleAsync(userId, boardId, Context.ConnectionAborted) is null)
            throw new HubException("Board not found.");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(boardId));
    }

    public Task LeaveBoard(int boardId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(boardId));
}
