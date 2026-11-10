using Api.Models;
using Dapper;
namespace Api.Data;

public sealed class MemberRepository(IDbConnectionFactory db) : IMemberRepository
{
    public async Task<List<MemberRow>> ListAsync(int boardId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        var rows = await conn.QueryAsync<MemberRow>(new CommandDefinition(
            """
            SELECT u.Id AS UserId, u.FirstName, u.LastName, u.Email, m.Role
            FROM dbo.BoardMembers m
            JOIN dbo.Users u ON u.Id = m.UserId
            WHERE m.BoardId = @BoardId
            ORDER BY u.FirstName, u.LastName, u.Id
            """,
            new { BoardId = boardId }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<List<MemberRow>> SearchCandidatesAsync(int boardId, string term, int limit, CancellationToken ct = default)
    {
        // Escape LIKE wildcards so the term is matched literally.
        var like = "%" + term.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]") + "%";
        await using var conn = await db.OpenAsync(ct);
        var rows = await conn.QueryAsync<MemberRow>(new CommandDefinition(
            """
            SELECT TOP (@Limit) u.Id AS UserId, u.FirstName, u.LastName, u.Email, '' AS Role
            FROM dbo.Users u
            WHERE (u.Email LIKE @Like OR u.FirstName LIKE @Like OR u.LastName LIKE @Like
                   OR u.FirstName + ' ' + u.LastName LIKE @Like)
              AND NOT EXISTS (SELECT 1 FROM dbo.BoardMembers m WHERE m.BoardId = @BoardId AND m.UserId = u.Id)
            ORDER BY u.FirstName, u.LastName, u.Id
            """,
            new { BoardId = boardId, Like = like, Limit = limit }, cancellationToken: ct));
        return rows.AsList();
    }

    public async Task<bool> AddAsync(int boardId, int userId, string role, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        var added = await conn.ExecuteAsync(new CommandDefinition(
            """
            INSERT INTO dbo.BoardMembers (BoardId, UserId, Role)
            SELECT @BoardId, u.Id, @Role
            FROM dbo.Users u
            WHERE u.Id = @UserId
              AND NOT EXISTS (SELECT 1 FROM dbo.BoardMembers m WHERE m.BoardId = @BoardId AND m.UserId = @UserId)
            """,
            new { BoardId = boardId, UserId = userId, Role = role }, cancellationToken: ct));
        return added == 1;
    }

    public async Task<MemberChangeResult> ChangeRoleAsync(int boardId, int userId, string role, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var current = await LockAndGetRoleAsync(conn, tx, boardId, userId, ct);
        if (current is null) return MemberChangeResult.NotFound;
        if (current == BoardRole.Owner && role != BoardRole.Owner && await OwnerCountAsync(conn, tx, boardId, ct) <= 1)
            return MemberChangeResult.LastOwner;

        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.BoardMembers SET Role = @Role WHERE BoardId = @BoardId AND UserId = @UserId",
            new { BoardId = boardId, UserId = userId, Role = role }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
        return MemberChangeResult.Ok;
    }

    public async Task<MemberChangeResult> RemoveAsync(int boardId, int userId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        var current = await LockAndGetRoleAsync(conn, tx, boardId, userId, ct);
        if (current is null) return MemberChangeResult.NotFound;
        if (current == BoardRole.Owner && await OwnerCountAsync(conn, tx, boardId, ct) <= 1)
            return MemberChangeResult.LastOwner;

        await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.BoardMembers WHERE BoardId = @BoardId AND UserId = @UserId",
            new { BoardId = boardId, UserId = userId }, tx, cancellationToken: ct));
        await tx.CommitAsync(ct);
        return MemberChangeResult.Ok;
    }

    private static Task<string?> LockAndGetRoleAsync(
        System.Data.Common.DbConnection conn, System.Data.Common.DbTransaction tx, int boardId, int userId, CancellationToken ct)
        => conn.QuerySingleOrDefaultAsync<string>(new CommandDefinition(
            "SELECT Role FROM dbo.BoardMembers WITH (UPDLOCK, HOLDLOCK) WHERE BoardId = @BoardId AND UserId = @UserId",
            new { BoardId = boardId, UserId = userId }, tx, cancellationToken: ct));

    // UPDLOCK + HOLDLOCK serialises concurrent demotions, so two owners can't remove each other at once.
    private static Task<int> OwnerCountAsync(
        System.Data.Common.DbConnection conn, System.Data.Common.DbTransaction tx, int boardId, CancellationToken ct)
        => conn.ExecuteScalarAsync<int>(new CommandDefinition(
            "SELECT COUNT(*) FROM dbo.BoardMembers WITH (UPDLOCK, HOLDLOCK) WHERE BoardId = @BoardId AND Role = 'owner'",
            new { BoardId = boardId }, tx, cancellationToken: ct));
}
