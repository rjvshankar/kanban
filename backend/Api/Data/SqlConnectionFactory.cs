// Data/SqlConnectionFactory.cs
using System.Data.Common;
using Microsoft.Data.SqlClient;
namespace Api.Data;

public sealed class SqlConnectionFactory(IConfiguration config) : IDbConnectionFactory
{
    private readonly string _cs = config.GetConnectionString("Default")
        ?? throw new InvalidOperationException("Missing connection string 'Default'.");

    public async Task<DbConnection> OpenAsync(CancellationToken ct = default)
    {
        var conn = new SqlConnection(_cs);
        try { await conn.OpenAsync(ct); return conn; }
        catch { await conn.DisposeAsync(); throw; }
    }
}