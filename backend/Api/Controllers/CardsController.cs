using Api.Data;
using Api.Dtos;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
namespace Api.Controllers;

public sealed class CardsController(
    IBoardRepository boards, IColumnRepository columns, ICardRepository cards, IBoardNotifier notifier)
    : BoardScopedController(boards)
{
    [HttpPost("api/columns/{columnId:int}/cards")]
    public async Task<IActionResult> Create(int columnId, CardRequest req, CancellationToken ct)
    {
        var boardId = await columns.GetBoardIdAsync(columnId, ct);
        if (await RequireEditorAsync(boardId, ct) is { } denied) return denied;

        var title = req.Title.Trim();
        var description = Clean(req.Description);
        var (id, position) = await cards.CreateAsync(columnId, title, description, req.DueDate, ct);
        await notifier.NotifyChangedAsync(boardId!.Value);
        return StatusCode(StatusCodes.Status201Created, new CardResponse(id, title, description, req.DueDate, position));
    }

    // Full update: the client sends all three fields (a null description/dueDate clears it).
    [HttpPatch("api/cards/{id:int}")]
    public async Task<IActionResult> Update(int id, CardRequest req, CancellationToken ct)
    {
        var ctx = await cards.GetContextAsync(id, ct);
        if (await RequireEditorAsync(ctx?.BoardId, ct) is { } denied) return denied;
        if (!await cards.UpdateAsync(id, req.Title.Trim(), Clean(req.Description), req.DueDate, ct)) return NotFound();

        await notifier.NotifyChangedAsync(ctx!.BoardId);
        return NoContent();
    }

    [HttpPost("api/cards/{id:int}/move")]
    public async Task<IActionResult> Move(int id, MoveCardRequest req, CancellationToken ct)
    {
        var ctx = await cards.GetContextAsync(id, ct);
        if (await RequireEditorAsync(ctx?.BoardId, ct) is { } denied) return denied;

        // Target column must be on the same board (same answer whether it's missing or elsewhere).
        if (await columns.GetBoardIdAsync(req.ToColumnId, ct) != ctx!.BoardId)
            return BadRequest(new { error = "Invalid target column." });

        if (!await cards.MoveAsync(id, req.ToColumnId, req.AfterCardId, ct))
            return BadRequest(new { error = "Invalid position." });

        await notifier.NotifyChangedAsync(ctx.BoardId);
        return NoContent();
    }

    [HttpDelete("api/cards/{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var ctx = await cards.GetContextAsync(id, ct);
        if (await RequireEditorAsync(ctx?.BoardId, ct) is { } denied) return denied;
        if (!await cards.SoftDeleteAsync(id, ct)) return NotFound();

        await notifier.NotifyChangedAsync(ctx!.BoardId);
        return NoContent();
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
