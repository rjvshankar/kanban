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
    /// Null when the caller may edit the board; otherwise the response to return:
    /// 401 (bad token), 404 (missing board or not a member, so ids can't be probed), 403 (viewer).
    /// </summary>
    protected async Task<IActionResult?> RequireEditAsync(int? boardId, CancellationToken ct)
    {
        if (!User.TryGetUserId(out var userId)) return Unauthorized();
        if (boardId is null) return NotFound();

        var role = await boards.GetRoleAsync(userId, boardId.Value, ct);
        if (role is null) return NotFound();
        return BoardRole.CanEdit(role) ? null : Forbid();
    }
}
