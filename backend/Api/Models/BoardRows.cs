namespace Api.Models;

// Plain row shapes Dapper fills from queries.
public sealed class BoardSummary
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class ArchivedBoardRow
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime DeletedAt { get; set; }
}

public sealed class PurgedBoardRow
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime PurgedAt { get; set; }
}

public sealed class BoardRow
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

public sealed class ColumnRow
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int Position { get; set; }
}

public sealed class CardRow
{
    public int Id { get; set; }
    public int ColumnId { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public DateTime? DueDate { get; set; }
    public int Position { get; set; }
}

public sealed record BoardContents(BoardRow Board, List<ColumnRow> Columns, List<CardRow> Cards);

public sealed class MemberRow
{
    public int UserId { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "";
}

public enum MemberChangeResult { Ok, NotFound, LastOwner }
