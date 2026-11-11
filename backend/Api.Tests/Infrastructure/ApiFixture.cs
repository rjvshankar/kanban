using Dapper;
using Microsoft.Data.SqlClient;
using Respawn;
using Testcontainers.MsSql;

namespace Api.Tests.Infrastructure;

/// <summary>
/// One throwaway SQL Server container for the whole test run. DbUp migrations run when the API
/// first starts. <see cref="ResetAsync"/> wipes data between tests (the DbUp journal is kept).
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    private const string Database = "KanbanTests";

    private readonly MsSqlContainer _sql = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest").Build();
    private Respawner? _respawner;

    public string ConnectionString { get; private set; } = "";
    public ApiFactory Factory { get; private set; } = null!;

    public async ValueTask InitializeAsync()
    {
        await _sql.StartAsync();

        ConnectionString = new SqlConnectionStringBuilder(_sql.GetConnectionString())
        {
            InitialCatalog = Database,
            TrustServerCertificate = true
        }.ConnectionString;

        Environment.SetEnvironmentVariable("ConnectionStrings__Default", ConnectionString);
        Environment.SetEnvironmentVariable("Jwt__Key", "test-only-signing-key-at-least-32-bytes-long!!");
        Environment.SetEnvironmentVariable("Smtp__Host", "localhost");
        Environment.SetEnvironmentVariable("Smtp__FromAddress", "noreply@kanban.test");

        Factory = new ApiFactory();
        _ = Factory.Server; // start the host: creates the DB and runs the migrations

        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        _respawner = await Respawner.CreateAsync(conn, new RespawnerOptions
        {
            DbAdapter = DbAdapter.SqlServer,
            TablesToIgnore = [new("SchemaVersions")]
        });
    }

    public async Task ResetAsync()
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await _respawner!.ResetAsync(conn);
    }

    /// <summary>A second host with fresh in-memory state (e.g. rate limiter counters) on the same database.</summary>
    public ApiFactory CreateIsolatedFactory()
    {
        var factory = new ApiFactory();
        _ = factory.Server;
        return factory;
    }

    public async Task<int> ExecuteAsync(string sql, object? args = null)
    {
        await using var conn = new SqlConnection(ConnectionString);
        return await conn.ExecuteAsync(sql, args);
    }

    public async Task<T> ScalarAsync<T>(string sql, object? args = null)
    {
        await using var conn = new SqlConnection(ConnectionString);
        return await conn.ExecuteScalarAsync<T>(sql, args) ?? throw new InvalidOperationException("No row.");
    }

    public async ValueTask DisposeAsync()
    {
        if (Factory is not null) await Factory.DisposeAsync();
        await _sql.DisposeAsync();
    }
}
