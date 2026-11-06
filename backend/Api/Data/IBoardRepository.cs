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
}
