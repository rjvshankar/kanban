using Dapper;
namespace Api.Data;

public sealed class ColumnRepository(IDbConnectionFactory db) : IColumnRepository
{
    public async Task<int?> GetBoardIdAsync(int columnId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<int?>(new CommandDefinition(
            """
            SELECT c.BoardId
            FROM dbo.Columns c
            JOIN dbo.Boards b ON b.Id = c.BoardId
            WHERE c.Id = @ColumnId AND c.DeletedAt IS NULL AND b.DeletedAt IS NULL
            """,
            new { ColumnId = columnId }, cancellationToken: ct));
    }

    public async Task<(int Id, int Position)> CreateAsync(int boardId, string name, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var position = await SiblingOrder.AppendAsync(conn, tx, "Columns", "BoardId", boardId, ct);
        var id = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            INSERT INTO dbo.Columns (BoardId, Name, Position)
            OUTPUT INSERTED.Id
            VALUES (@BoardId, @Name, @Position)
            """,
            new { BoardId = boardId, Name = name, Position = position },
            tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return (id, position);
    }

    public async Task<bool> RenameAsync(int columnId, string name, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Columns SET Name = @Name WHERE Id = @ColumnId AND DeletedAt IS NULL",
            new { Name = name, ColumnId = columnId }, cancellationToken: ct)) > 0;
    }

    public async Task<bool> MoveAsync(int columnId, int boardId, int? afterColumnId, CancellationToken ct = default)
    {
        if (afterColumnId == columnId) return false;

        await using var conn = await db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var position = await SiblingOrder.PlaceAsync(conn, tx, "Columns", "BoardId", boardId, columnId, afterColumnId, ct);
        if (position is null) return false;

        var n = await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Columns SET Position = @Position WHERE Id = @ColumnId AND DeletedAt IS NULL",
            new { Position = position, ColumnId = columnId }, tx, cancellationToken: ct));
        if (n == 0) return false;

        await tx.CommitAsync(ct);
        return true;
    }

    public async Task<bool> SoftDeleteAsync(int columnId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Columns SET DeletedAt = SYSUTCDATETIME() WHERE Id = @ColumnId AND DeletedAt IS NULL",
            new { ColumnId = columnId }, cancellationToken: ct)) > 0;
    }
}
