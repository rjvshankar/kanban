using Api.Models;
using Dapper;
namespace Api.Data;

public sealed class UserRepository(IDbConnectionFactory db) : IUserRepository
{
    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            """
            SELECT u.Id, u.FirstName, u.LastName, u.Email, u.PhoneNumber, u.PasswordHash, u.CreatedAt,
                   CASE WHEN a.UserId IS NULL THEN NULL
                        ELSE DATEDIFF_BIG(MILLISECOND, '1970-01-01', a.UpdatedAt) END AS AvatarVersion
            FROM dbo.Users u
            LEFT JOIN dbo.UserAvatars a ON a.UserId = u.Id
            WHERE u.Email = @Email
            """,
            new { Email = email },
            cancellationToken: ct));
    }

    public async Task<User?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            """
            SELECT u.Id, u.FirstName, u.LastName, u.Email, u.PhoneNumber, u.PasswordHash, u.CreatedAt,
                   CASE WHEN a.UserId IS NULL THEN NULL
                        ELSE DATEDIFF_BIG(MILLISECOND, '1970-01-01', a.UpdatedAt) END AS AvatarVersion
            FROM dbo.Users u
            LEFT JOIN dbo.UserAvatars a ON a.UserId = u.Id
            WHERE u.Id = @Id
            """,
            new { Id = id },
            cancellationToken: ct));
    }

    public async Task<int> CreateAsync(User user, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.ExecuteScalarAsync<int>(new CommandDefinition(
            """
            INSERT INTO dbo.Users (FirstName, LastName, Email, PhoneNumber, PasswordHash)
            OUTPUT INSERTED.Id
            VALUES (@FirstName, @LastName, @Email, @PhoneNumber, @PasswordHash)
            """,
            user,
            cancellationToken: ct));
    }

    public async Task UpdateNameAsync(int id, string firstName, string lastName, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(
            "UPDATE dbo.Users SET FirstName = @FirstName, LastName = @LastName WHERE Id = @Id",
            new { Id = id, FirstName = firstName, LastName = lastName },
            cancellationToken: ct));
    }

    public async Task<Avatar?> GetAvatarAsync(int userId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<Avatar>(new CommandDefinition(
            "SELECT ContentType, Data, UpdatedAt FROM dbo.UserAvatars WHERE UserId = @UserId",
            new { UserId = userId },
            cancellationToken: ct));
    }

    public async Task SetAvatarAsync(int userId, string contentType, byte[] data, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        await conn.ExecuteAsync(new CommandDefinition(
            """
            MERGE dbo.UserAvatars AS t
            USING (SELECT @UserId AS UserId) AS s ON t.UserId = s.UserId
            WHEN MATCHED THEN UPDATE SET ContentType = @ContentType, Data = @Data, UpdatedAt = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN INSERT (UserId, ContentType, Data) VALUES (@UserId, @ContentType, @Data);
            """,
            new { UserId = userId, ContentType = contentType, Data = data },
            cancellationToken: ct));
    }

    public async Task<bool> DeleteAvatarAsync(int userId, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.ExecuteAsync(new CommandDefinition(
            "DELETE FROM dbo.UserAvatars WHERE UserId = @UserId",
            new { UserId = userId },
            cancellationToken: ct)) > 0;
    }
}
