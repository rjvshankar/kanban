namespace Api.Data;

public interface IColumnRepository
{
    /// <summary>Board id of a non-deleted column on a non-deleted board, else null.</summary>
    Task<int?> GetBoardIdAsync(int columnId, CancellationToken ct = default);
    Task<(int Id, int Position)> CreateAsync(int boardId, string name, CancellationToken ct = default);
    Task<bool> RenameAsync(int columnId, string name, CancellationToken ct = default);
    /// <summary>Places the column after <paramref name="afterColumnId"/> (null = first). False if that column isn't on the same board.</summary>
    Task<bool> MoveAsync(int columnId, int boardId, int? afterColumnId, CancellationToken ct = default);
    Task<bool> SoftDeleteAsync(int columnId, CancellationToken ct = default);
}
