using Api.Data;
using Api.Dtos;
using Microsoft.AspNetCore.Mvc;
namespace Api.Controllers;

public sealed class ColumnsController(IBoardRepository boards, IColumnRepository columns)
    : BoardScopedController(boards)
{
    [HttpPost("api/boards/{boardId:int}/columns")]
    public async Task<IActionResult> Create(int boardId, ColumnNameRequest req, CancellationToken ct)
    {
        if (await RequireEditAsync(boardId, ct) is { } denied) return denied;

        var name = req.Name.Trim();
        var (id, position) = await columns.CreateAsync(boardId, name, ct);
        return StatusCode(StatusCodes.Status201Created, new ColumnResponse(id, name, position, []));
    }

    [HttpPatch("api/columns/{id:int}")]
    public async Task<IActionResult> Rename(int id, ColumnNameRequest req, CancellationToken ct)
    {
        if (await RequireEditAsync(await columns.GetBoardIdAsync(id, ct), ct) is { } denied) return denied;
        return await columns.RenameAsync(id, req.Name.Trim(), ct) ? NoContent() : NotFound();
    }

    [HttpPost("api/columns/{id:int}/move")]
    public async Task<IActionResult> Move(int id, MoveColumnRequest req, CancellationToken ct)
    {
        var boardId = await columns.GetBoardIdAsync(id, ct);
        if (await RequireEditAsync(boardId, ct) is { } denied) return denied;

        return await columns.MoveAsync(id, boardId!.Value, req.AfterColumnId, ct)
            ? NoContent()
            : BadRequest(new { error = "Invalid position." });
    }

    [HttpDelete("api/columns/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (await RequireEditAsync(await columns.GetBoardIdAsync(id, ct), ct) is { } denied) return denied;
        return await columns.SoftDeleteAsync(id, ct) ? NoContent() : NotFound();
    }
}
