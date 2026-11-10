using Api.Data;
using Api.Dtos;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Api.Controllers;

[ApiController]
[Authorize]
[Route("api/boards")]
public sealed class BoardsController(IBoardRepository boards, IBoardNotifier notifier) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();

        var list = await boards.ListForUserAsync(userId, ct);
        return Ok(list.Select(b => new BoardSummaryResponse(b.Id, b.Name, b.Role, b.CreatedAt)));
    }

    // Boards you deleted that can still be restored (owners only, within the retention window).
    [HttpGet("archived")]
    public async Task<IActionResult> ListArchived(CancellationToken ct)
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();

        var now = DateTime.UtcNow;
        var list = await boards.ListArchivedAsync(userId, ct);
        return Ok(list.Select(b =>
        {
            var deletedAt = DateTime.SpecifyKind(b.DeletedAt, DateTimeKind.Utc);
            var daysLeft = (int)Math.Ceiling((deletedAt.AddDays(ArchivePolicy.RetentionDays) - now).TotalDays);
            return new ArchivedBoardResponse(b.Id, b.Name, deletedAt, Math.Max(daysLeft, 0));
        }));
    }

    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> Restore(int id, CancellationToken ct)
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();

        // 404 for everything that isn't restorable by this user, so deleted boards can't be probed.
        if (!await boards.RestoreAsync(userId, id, ct)) return NotFound();
        return NoContent();
    }

    [HttpPost]
    public async Task<IActionResult> Create(CreateBoardRequest req, CancellationToken ct)
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();

        var name = req.Name.Trim();
        var id = await boards.CreateAsync(name, userId, ct);
        return CreatedAtAction(nameof(Get), new { id }, new { id, name, role = BoardRole.Owner });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();

        // 404 (not 403) for non-members, so board ids can't be probed.
        var role = await boards.GetRoleAsync(userId, id, ct);
        if (role is null) return NotFound();

        var contents = await boards.GetContentsAsync(id, ct);
        if (contents is null) return NotFound();

        var cardsByColumn = contents.Cards.ToLookup(c => c.ColumnId);
        var columns = contents.Columns
            .Select(col => new ColumnResponse(
                col.Id, col.Name, col.Position,
                cardsByColumn[col.Id]
                    .Select(c => new CardResponse(
                        c.Id, c.Title, c.Description,
                        c.DueDate is { } d ? DateOnly.FromDateTime(d) : null,
                        c.Position))
                    .ToList()))
            .ToList();

        return Ok(new BoardResponse(contents.Board.Id, contents.Board.Name, role, contents.Board.CreatedAt, columns));
    }

    [HttpPatch("{id:int}")]
    public async Task<IActionResult> Rename(int id, UpdateBoardRequest req, CancellationToken ct)
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();

        var role = await boards.GetRoleAsync(userId, id, ct);
        if (role is null) return NotFound();
        if (!BoardRole.IsOwner(role)) return Forbid();

        if (!await boards.RenameAsync(id, req.Name.Trim(), ct)) return NotFound();

        await notifier.NotifyChangedAsync(id);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();

        var role = await boards.GetRoleAsync(userId, id, ct);
        if (role is null) return NotFound();
        if (!BoardRole.IsOwner(role)) return Forbid();

        if (!await boards.SoftDeleteAsync(id, ct)) return NotFound();

        // Anyone still viewing the board refetches and sees "Board not found".
        await notifier.NotifyChangedAsync(id);
        return NoContent();
    }
}
