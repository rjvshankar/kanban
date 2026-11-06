namespace Api.Data;

public sealed record CardContext(int BoardId, int ColumnId);

public interface ICardRepository
{
    /// <summary>Board and column of a non-deleted card (in a non-deleted column and board), else null.</summary>
    Task<CardContext?> GetContextAsync(int cardId, CancellationToken ct = default);
    Task<(int Id, int Position)> CreateAsync(int columnId, string title, string? description, DateOnly? dueDate, CancellationToken ct = default);
    Task<bool> UpdateAsync(int cardId, string title, string? description, DateOnly? dueDate, CancellationToken ct = default);
    /// <summary>Moves the card into <paramref name="toColumnId"/> right after <paramref name="afterCardId"/> (null = top). False if afterCardId isn't in that column.</summary>
    Task<bool> MoveAsync(int cardId, int toColumnId, int? afterCardId, CancellationToken ct = default);
    Task<bool> SoftDeleteAsync(int cardId, CancellationToken ct = default);
}
