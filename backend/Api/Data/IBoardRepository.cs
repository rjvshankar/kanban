using Api.Models;
namespace Api.Data;

public interface IBoardRepository
{
    Task<List<BoardSummary>> ListForUserAsync(int userId, CancellationToken ct = default);

    /// <summary>Creates the board and adds the creator as its owner, in one transaction.</summary>
    Task<int> CreateAsync(string name, int userId, CancellationToken ct = default);

    /// <summary>The user's role on a non-deleted board, or null if they aren't a member (or it doesn't exist).</summary>
    Task<string?> GetRoleAsync(int userId, int boardId, CancellationToken ct = default);

    Task<BoardContents?> GetContentsAsync(int boardId, CancellationToken ct = default);
    Task<bool> RenameAsync(int boardId, string name, CancellationToken ct = default);
    Task<bool> SoftDeleteAsync(int boardId, CancellationToken ct = default);

    /// <summary>Boards the user owns that were deleted within the retention window (restorable).</summary>
    Task<List<ArchivedBoardRow>> ListArchivedAsync(int userId, CancellationToken ct = default);

    /// <summary>
    /// Un-deletes an archived board the user owns, if it's still inside the retention window.
    /// False if there is nothing to restore (not archived, expired, or the user isn't an owner).
    /// </summary>
    Task<bool> RestoreAsync(int userId, int boardId, CancellationToken ct = default);
}
