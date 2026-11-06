using Api.Models;
using Dapper;
namespace Api.Data;

public sealed class BoardRepository(IDbConnectionFactory db) : IBoardRepository
{
    public async Task<List<BoardSummary>> ListForUserAsync(int userId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        var rows = await conn.QueryAsync<BoardSummary>(new CommandDefinition(
            """
            SELECT b.Id, b.Name, m.Role, b.CreatedAt
            FROM dbo.Boards b
            JOIN dbo.BoardMembers m ON m.BoardId = b.Id
            WHERE m.UserId = @UserId AND b.DeletedAt IS NULL
            ORDER BY b.CreatedAt DESC, b.Id DESC
            """,
            new { UserId = userId },
            cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<int> CreateAsync(string name, int userId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var id = await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            INSERT INTO dbo.Boards (Name, CreatedByUserId)
            OUTPUT INSERTED.Id
            VALUES (@Name, @UserId)
            """,
            new { Name = name, UserId = userId },
            tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            "INSERT INTO dbo.BoardMembers (BoardId, UserId, Role) VALUES (@BoardId, @UserId, @Role)",
            new { BoardId = id, UserId = userId, Role = BoardRole.Owner },
            tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return id;
    }

    public async Task<string?> GetRoleAsync(int userId, int boardId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<string>(new CommandDefinition(
            """
            SELECT m.Role
            FROM dbo.BoardMembers m
            JOIN dbo.Boards b ON b.Id = m.BoardId
            WHERE m.UserId = @UserId AND m.BoardId = @BoardId AND b.DeletedAt IS NULL
            """,
            new { UserId = userId, BoardId = boardId },
            cancellationToken: ct));
    }

    public async Task<BoardContents?> GetContentsAsync(int boardId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        using var multi = await conn.QueryMultipleAsync(new CommandDefinition(
            """
            SELECT Id, Name, CreatedAt FROM dbo.Boards WHERE Id = @BoardId AND DeletedAt IS NULL;

            SELECT Id, Name, Position
            FROM dbo.Columns
            WHERE BoardId = @BoardId AND DeletedAt IS NULL
            ORDER BY Position;

            SELECT c.Id, c.ColumnId, c.Title, c.Description, c.DueDate, c.Position
            FROM dbo.Cards c
            JOIN dbo.Columns col ON col.Id = c.ColumnId
            WHERE col.BoardId = @BoardId AND col.DeletedAt IS NULL AND c.DeletedAt IS NULL
            ORDER BY c.Position;
            """,
            new { BoardId = boardId },
            cancellationToken: ct));

        var board = await multi.ReadSingleOrDefaultAsync<BoardRow>();
        if (board is null) return null;

        var columns = (await multi.ReadAsync<ColumnRow>()).AsList();
        var cards = (await multi.ReadAsync<CardRow>()).AsList();
        return new BoardContents(board, columns, cards);
    }

    public async Task<bool> RenameAsync(int boardId, string name, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        var n = await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Boards SET Name = @Name WHERE Id = @BoardId AND DeletedAt IS NULL",
            new { Name = name, BoardId = boardId },
            cancellationToken: ct));
        return n > 0;
    }

    public async Task<bool> SoftDeleteAsync(int boardId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        var n = await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Boards SET DeletedAt = SYSUTCDATETIME() WHERE Id = @BoardId AND DeletedAt IS NULL",
            new { BoardId = boardId },
            cancellationToken: ct));
        return n > 0;
    }
}
