namespace Api.Services;

/// <summary>Who is looking at a board right now (what the avatars in the board header show).</summary>
public sealed record PresenceViewer(int Id, string FirstName, string LastName, long? AvatarVersion);

/// <summary>
/// In-memory record of which users have a board page open. Connections are counted per user, so a user with
/// two tabs is one viewer and only disappears when the last tab goes. Single API instance only (like the rate limiter).
/// </summary>
public sealed class PresenceTracker
{
    private readonly object _lock = new();
    // connection -> where it is. A connection watches at most one board.
    private readonly Dictionary<string, (int BoardId, int UserId)> _connections = [];
    // board -> user -> (viewer info, that user's connections on the board)
    private readonly Dictionary<int, Dictionary<int, (PresenceViewer Viewer, HashSet<string> Connections)>> _boards = [];

    /// <summary>Records a connection on a board (moving it if it was on another). Returns the boards whose viewer list changed.</summary>
    public IReadOnlyList<int> Join(int boardId, PresenceViewer viewer, string connectionId)
    {
        lock (_lock)
        {
            var changed = new List<int>();
            if (_connections.TryGetValue(connectionId, out var prev))
            {
                if (prev.BoardId == boardId && prev.UserId == viewer.Id) return changed; // already joined
                if (RemoveLocked(connectionId)) changed.Add(prev.BoardId);
            }

            if (!_boards.TryGetValue(boardId, out var users)) _boards[boardId] = users = [];
            if (users.TryGetValue(viewer.Id, out var entry))
            {
                entry.Connections.Add(connectionId);
                users[viewer.Id] = (viewer, entry.Connections); // refresh name/avatar
            }
            else
            {
                users[viewer.Id] = (viewer, [connectionId]);
                changed.Add(boardId);
            }
            _connections[connectionId] = (boardId, viewer.Id);
            return changed;
        }
    }

    /// <summary>Forgets a connection. Returns the board whose viewer list changed, or null if nothing visible changed.</summary>
    public int? Leave(string connectionId)
    {
        lock (_lock)
        {
            if (!_connections.TryGetValue(connectionId, out var where)) return null;
            return RemoveLocked(connectionId) ? where.BoardId : null;
        }
    }

    /// <summary>Viewers of a board, ordered by name so every client renders the same order.</summary>
    public IReadOnlyList<PresenceViewer> Viewers(int boardId)
    {
        lock (_lock)
        {
            if (!_boards.TryGetValue(boardId, out var users)) return [];
            return users.Values.Select(v => v.Viewer)
                .OrderBy(v => v.FirstName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(v => v.LastName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(v => v.Id)
                .ToList();
        }
    }

    // Returns true when the user has no connections left on the board (so they left the viewer list).
    private bool RemoveLocked(string connectionId)
    {
        var (boardId, userId) = _connections[connectionId];
        _connections.Remove(connectionId);
        var users = _boards[boardId];
        var entry = users[userId];
        entry.Connections.Remove(connectionId);
        if (entry.Connections.Count > 0) return false;
        users.Remove(userId);
        if (users.Count == 0) _boards.Remove(boardId);
        return true;
    }
}
