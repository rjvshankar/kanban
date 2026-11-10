using Api.Data;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Api.Controllers;

[ApiController]
[Authorize]
public abstract class BoardScopedController(IBoardRepository boards) : ControllerBase
{
    /// <summary>
    /// Null when the caller passes the role check; otherwise the response to return:
    /// 401 (bad token), 404 (missing board or not a member, so ids can't be probed), 403 (role too low).
    /// </summary>
    private async Task<IActionResult?> RequireAsync(int? boardId, Func<string, bool> allowed, CancellationToken ct)
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();
        if (boardId is null) return NotFound();

        var role = await boards.GetRoleAsync(userId, boardId.Value, ct);
        if (role is null) return NotFound();
        return allowed(role) ? null : Forbid();
    }

    /// <summary>Owner or editor (card operations).</summary>
    protected Task<IActionResult?> RequireEditorAsync(int? boardId, CancellationToken ct)
        => RequireAsync(boardId, BoardRole.CanEditCards, ct);

    /// <summary>Owner only (columns, board settings, members).</summary>
    protected Task<IActionResult?> RequireOwnerAsync(int? boardId, CancellationToken ct)
        => RequireAsync(boardId, BoardRole.IsOwner, ct);
}
