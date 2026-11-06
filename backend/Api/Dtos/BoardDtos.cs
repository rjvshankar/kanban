using System.ComponentModel.DataAnnotations;
namespace Api.Dtos;

public sealed record CreateBoardRequest([Required, StringLength(200)] string Name);

public sealed record UpdateBoardRequest([Required, StringLength(200)] string Name);

public sealed record BoardSummaryResponse(int Id, string Name, string Role, DateTime CreatedAt);

public sealed record CardResponse(int Id, string Title, string? Description, DateOnly? DueDate, int Position);

public sealed record ColumnResponse(int Id, string Name, int Position, List<CardResponse> Cards);

public sealed record BoardResponse(int Id, string Name, string Role, DateTime CreatedAt, List<ColumnResponse> Columns);
