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
public sealed class BoardHub(IBoardRepository boards, IUserRepository users, PresenceTracker presence) : Hub
{
    public const string ChangedEvent = "BoardChanged";
    public const string PresenceEvent = "PresenceChanged";

    public static string GroupName(int boardId) => $"board-{boardId}";

    /// <summary>Subscribes this connection to a board's changes. Only members may join. Returns who is viewing the board.</summary>
    public async Task<IReadOnlyList<PresenceViewer>> JoinBoard(int boardId)
    {
        if (!Context.User!.TryGetUserId(out var userId))
            throw new HubException("Unauthorized.");

        // Same message for "no such board" and "not a member", so ids can't be probed.
        if (await boards.GetRoleAsync(userId, boardId, Context.ConnectionAborted) is null)
            throw new HubException("Board not found.");

        var user = await users.GetByIdAsync(userId, Context.ConnectionAborted)
            ?? throw new HubException("Unauthorized.");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(boardId));
        var viewer = new PresenceViewer(user.Id, user.FirstName, user.LastName, user.AvatarVersion);
        foreach (var changed in presence.Join(boardId, viewer, Context.ConnectionId))
            await BroadcastPresenceAsync(changed);
        return presence.Viewers(boardId);
    }

    public async Task LeaveBoard(int boardId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(boardId));
        if (presence.Leave(Context.ConnectionId) is { } changed) await BroadcastPresenceAsync(changed);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (presence.Leave(Context.ConnectionId) is { } changed) await BroadcastPresenceAsync(changed);
        await base.OnDisconnectedAsync(exception);
    }

    // Sends the full viewer list (not a delta), so a client can never drift out of sync.
    private Task BroadcastPresenceAsync(int boardId) =>
        Clients.Group(GroupName(boardId)).SendAsync(PresenceEvent, presence.Viewers(boardId));
}
