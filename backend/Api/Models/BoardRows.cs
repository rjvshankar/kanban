namespace Api.Models;

// Plain row shapes Dapper fills from queries.
public sealed class BoardSummary
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public DateTime CreatedAt { get; set; }
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
