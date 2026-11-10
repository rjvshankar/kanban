using Api.Data;
using Api.Dtos;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
namespace Api.Controllers;

public sealed class ColumnsController(IBoardRepository boards, IColumnRepository columns, IBoardNotifier notifier)
    : BoardScopedController(boards)
{
    [HttpPost("api/boards/{boardId:int}/columns")]
    public async Task<IActionResult> Create(int boardId, ColumnNameRequest req, CancellationToken ct)
    {
        if (await RequireEditAsync(boardId, ct) is { } denied) return denied;

        var name = req.Name.Trim();
        var (id, position) = await columns.CreateAsync(boardId, name, ct);
        await notifier.NotifyChangedAsync(boardId);
        return StatusCode(StatusCodes.Status201Created, new ColumnResponse(id, name, position, []));
    }

    [HttpPatch("api/columns/{id:int}")]
    public async Task<IActionResult> Rename(int id, ColumnNameRequest req, CancellationToken ct)
    {
        var boardId = await columns.GetBoardIdAsync(id, ct);
        if (await RequireEditAsync(boardId, ct) is { } denied) return denied;
        if (!await columns.RenameAsync(id, req.Name.Trim(), ct)) return NotFound();

        await notifier.NotifyChangedAsync(boardId!.Value);
        return NoContent();
    }

    [HttpPost("api/columns/{id:int}/move")]
    public async Task<IActionResult> Move(int id, MoveColumnRequest req, CancellationToken ct)
    {
        var boardId = await columns.GetBoardIdAsync(id, ct);
        if (await RequireEditAsync(boardId, ct) is { } denied) return denied;

        if (!await columns.MoveAsync(id, boardId!.Value, req.AfterColumnId, ct))
            return BadRequest(new { error = "Invalid position." });

        await notifier.NotifyChangedAsync(boardId.Value);
        return NoContent();
    }

    [HttpDelete("api/columns/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var boardId = await columns.GetBoardIdAsync(id, ct);
        if (await RequireEditAsync(boardId, ct) is { } denied) return denied;
        if (!await columns.SoftDeleteAsync(id, ct)) return NotFound();

        await notifier.NotifyChangedAsync(boardId!.Value);
        return NoContent();
    }
}
