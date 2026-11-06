using System.Data.Common;
using Dapper;
namespace Api.Data;

public sealed record PosRow(int Id, int Position);

/// <summary>
/// Gapped-integer ordering shared by Columns (within a board) and Cards (within a column).
/// Table/column names passed in are internal constants, never user input.
/// Callers must pass an open transaction; sibling reads take range locks so concurrent moves serialize.
/// </summary>
internal static class SiblingOrder
{
    public const int GAP = 1000;

    private static async Task<List<PosRow>> ReadSiblingsAsync(
        DbConnection conn, DbTransaction tx, string table, string containerCol, int containerId, int? excludeId, CancellationToken ct)
    {
        var rows = await conn.QueryAsync<PosRow>(new CommandDefinition(
            $"""
            SELECT Id, Position FROM dbo.{table} WITH (UPDLOCK, HOLDLOCK)
            WHERE {containerCol} = @ContainerId AND DeletedAt IS NULL AND (@ExcludeId IS NULL OR Id <> @ExcludeId)
            ORDER BY Position, Id
            """,
            new { ContainerId = containerId, ExcludeId = excludeId },
            tx, cancellationToken: ct));
        return rows.AsList();
    }

    /// <summary>Position for a new item at the end of the container.</summary>
    public static async Task<int> AppendAsync(
        DbConnection conn, DbTransaction tx, string table, string containerCol, int containerId, CancellationToken ct)
    {
        var siblings = await ReadSiblingsAsync(conn, tx, table, containerCol, containerId, null, ct);
        return (siblings.Count == 0 ? 0 : siblings[^1].Position) + GAP;
    }

    /// <summary>
    /// Position for <paramref name="itemId"/> placed right after <paramref name="afterId"/> (null = top) in the container.
    /// Rewrites sibling positions only if the gap has run out. Returns null if afterId isn't in the container.
    /// </summary>
    public static async Task<int?> PlaceAsync(
        DbConnection conn, DbTransaction tx, string table, string containerCol, int containerId,
        int itemId, int? afterId, CancellationToken ct)
    {
        var siblings = await ReadSiblingsAsync(conn, tx, table, containerCol, containerId, itemId, ct);

        var insertAt = 0; // index in siblings where the item goes
        if (afterId is not null)
        {
            var idx = siblings.FindIndex(s => s.Id == afterId);
            if (idx < 0) return null;
            insertAt = idx + 1;
        }

        var prev = insertAt == 0 ? 0 : siblings[insertAt - 1].Position;
        if (insertAt == siblings.Count) return prev + GAP;

        var next = siblings[insertAt].Position;
        if (next - prev >= 2) return prev + (next - prev) / 2;

        // No room: renumber the whole container with fresh gaps, leaving a slot for the item.
        for (var i = 0; i < siblings.Count; i++)
        {
            var slot = i < insertAt ? i : i + 1;
            await conn.ExecuteAsync(new CommandDefinition(
                $"UPDATE dbo.{table} SET Position = @Position WHERE Id = @Id",
                new { Position = (slot + 1) * GAP, siblings[i].Id },
                tx, cancellationToken: ct));
        }
        return (insertAt + 1) * GAP;
    }
}
