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
            SELECT Id, FirstName, LastName, Email, PhoneNumber, PasswordHash, CreatedAt
            FROM dbo.Users
            WHERE Email = @Email
            """,
            new { Email = email },
            cancellationToken: ct));
    }

    public async Task<User?> GetByIdAsync(int id, CancellationToken ct = default)
    {
        await using var conn = await db.OpenAsync(ct);
        return await conn.QuerySingleOrDefaultAsync<User>(new CommandDefinition(
            """
            SELECT Id, FirstName, LastName, Email, PhoneNumber, PasswordHash, CreatedAt
            FROM dbo.Users
            WHERE Id = @Id
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
}
