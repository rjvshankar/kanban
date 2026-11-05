using Dapper;
namespace Api.Data;

public sealed class PasswordResetRepository(IDbConnectionFactory db) : IPasswordResetRepository
{
    public async Task CreateAsync(int userId, string tokenHash, DateTime expiresAt, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.PasswordResetTokens SET UsedAt = SYSUTCDATETIME() WHERE UserId = @UserId AND UsedAt IS NULL",
            new { UserId = userId }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            """
            INSERT INTO dbo.PasswordResetTokens (UserId, TokenHash, ExpiresAt)
            VALUES (@UserId, @TokenHash, @ExpiresAt)
            """,
            new { UserId = userId, TokenHash = tokenHash, ExpiresAt = expiresAt }, tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
    }

    public async Task<bool> ConsumeAsync(string tokenHash, string newPasswordHash, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        await using var tx = await conn.BeginTransactionAsync(ct);

        // The WHERE clause makes "use the token" atomic: if two requests race, only one gets a row back.
        var userId = await conn.QuerySingleOrDefaultAsync<int?>(new CommandDefinition(
            """
            UPDATE dbo.PasswordResetTokens
            SET UsedAt = SYSUTCDATETIME()
            OUTPUT INSERTED.UserId
            WHERE TokenHash = @TokenHash AND UsedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()
            """,
            new { TokenHash = tokenHash }, tx, cancellationToken: ct));

        if (userId is null)
        {
            await tx.RollbackAsync(ct);
            return false;
        }

        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Users SET PasswordHash = @Hash WHERE Id = @UserId",
            new { Hash = newPasswordHash, UserId = userId }, tx, cancellationToken: ct));

        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.PasswordResetTokens SET UsedAt = SYSUTCDATETIME() WHERE UserId = @UserId AND UsedAt IS NULL",
            new { UserId = userId }, tx, cancellationToken: ct));

        await tx.CommitAsync(ct);
        return true;
    }
}
