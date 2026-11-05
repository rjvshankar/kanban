// Data/IDbConnectionFactory.cs
using System.Data.Common;
namespace Api.Data;

public interface IDbConnectionFactory
{
    Task<DbConnection> OpenAsync(CancellationToken ct = default);
}