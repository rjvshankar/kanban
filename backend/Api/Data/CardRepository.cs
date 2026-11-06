using Dapper;
namespace Api.Data;

public sealed class CardRepository(IDbConnectionFactory db) : ICardRepository
{
    public async Task<CardContext?> GetContextAsync(int cardId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<CardContext>(new CommandDefinition(
            """
            SELECT col.BoardId, c.ColumnId
            FROM dbo.Cards c
            JOIN dbo.Columns col ON col.Id = c.ColumnId
            JOIN dbo.Boards b ON b.Id = col.BoardId
            WHERE c.Id = @CardId AND c.DeletedAt IS NULL AND col.DeletedAt IS NULL AND b.DeletedAt IS NULL
            """,
            new { CardId = cardId }, cancellationToken: ct));
    }

    public async Task<(int Id, int Position)> CreateAsync(
        int columnId, string title, string? description, DateOnly? dueDate, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var position = await SiblingOrder.AppendAsync(conn, tx, "Cards", "ColumnId", columnId, ct);
        var id = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            INSERT INTO dbo.Cards (ColumnId, Title, Description, DueDate, Position)
            OUTPUT INSERTED.Id
            VALUES (@ColumnId, @Title, @Description, @DueDate, @Position)
            """,
            new { ColumnId = columnId, Title = title, Description = description, DueDate = ToDateTime(dueDate), Position = position },
            tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return (id, position);
    }

    public async Task<bool> UpdateAsync(int cardId, string title, string? description, DateOnly? dueDate, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.Cards
            SET Title = @Title, Description = @Description, DueDate = @DueDate, UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @CardId AND DeletedAt IS NULL
            """,
            new { CardId = cardId, Title = title, Description = description, DueDate = ToDateTime(dueDate) },
            cancellationToken: ct)) > 0;
    }

    public async Task<bool> MoveAsync(int cardId, int toColumnId, int? afterCardId, CancellationToken ct = default)
    {
        if (afterCardId == cardId) return false;

        await using var conn = await db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var position = await SiblingOrder.PlaceAsync(conn, tx, "Cards", "ColumnId", toColumnId, cardId, afterCardId, ct);
        if (position is null) return false;

        var n = await conn.ExecuteAsync(new CommandDefinition(
            """
            UPDATE dbo.Cards
            SET ColumnId = @ColumnId, Position = @Position, UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @CardId AND DeletedAt IS NULL
            """,
            new { ColumnId = toColumnId, Position = position, CardId = cardId }, tx, cancellationToken: ct));
        if (n == 0) return false;

        await tx.CommitAsync(ct);
        return true;
    }

    public async Task<bool> SoftDeleteAsync(int cardId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Cards SET DeletedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @CardId AND DeletedAt IS NULL",
            new { CardId = cardId }, cancellationToken: ct)) > 0;
    }

    private static DateTime? ToDateTime(DateOnly? d) => d?.ToDateTime(TimeOnly.MinValue);
}
