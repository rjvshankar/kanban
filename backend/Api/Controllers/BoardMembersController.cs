using Api.Data;
using Api.Dtos;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Mvc;
namespace Api.Controllers;

// Owner-only. Non-members and missing boards get 404 (see BoardScopedController).
[Route("api/boards/{boardId:int}/members")]
public sealed class BoardMembersController(IBoardRepository boards, IMemberRepository members, IBoardNotifier notifier)
    : BoardScopedController(boards)
{
    private const int MinSearchLength = 2;
    private const int MaxSearchResults = 10;

    private static MemberResponse ToResponse(MemberRow m) => new(m.UserId, m.FirstName, m.LastName, m.Email, m.Role);

    [HttpGet]
    public async Task<IActionResult> List(int boardId, CancellationToken ct)
    {
        if (await RequireOwnerAsync(boardId, ct) is { } denied) return denied;
        return Ok((await members.ListAsync(boardId, ct)).Select(ToResponse));
    }

    // Users who could be added: not already on the board. Needs a search term so the user list can't be dumped.
    [HttpGet("candidates")]
    public async Task<IActionResult> Candidates(int boardId, [FromQuery] string? q, CancellationToken ct)
    {
        if (await RequireOwnerAsync(boardId, ct) is { } denied) return denied;

        var term = q?.Trim() ?? "";
        if (term.Length < MinSearchLength) return Ok(Array.Empty<MemberResponse>());
        return Ok((await members.SearchCandidatesAsync(boardId, term, MaxSearchResults, ct)).Select(ToResponse));
    }

    [HttpPost]
    public async Task<IActionResult> Add(int boardId, AddMemberRequest req, CancellationToken ct)
    {
        if (await RequireOwnerAsync(boardId, ct) is { } denied) return denied;
        if (!BoardRole.IsValid(req.Role)) return BadRequest(new { error = "Invalid role." });

        if (!await members.AddAsync(boardId, req.UserId, req.Role, ct))
            return Conflict(new { error = "User not found or already a member." });

        await notifier.NotifyChangedAsync(boardId);
        return NoContent();
    }

    [HttpPatch("{userId:int}")]
    public async Task<IActionResult> ChangeRole(int boardId, int userId, ChangeRoleRequest req, CancellationToken ct)
    {
        if (await RequireOwnerAsync(boardId, ct) is { } denied) return denied;
        if (!BoardRole.IsValid(req.Role)) return BadRequest(new { error = "Invalid role." });

        var result = await members.ChangeRoleAsync(boardId, userId, req.Role, ct);
        if (result == MemberChangeResult.Ok) await notifier.NotifyChangedAsync(boardId);
        return ToResult(result);
    }

    [HttpDelete("{userId:int}")]
    public async Task<IActionResult> Remove(int boardId, int userId, CancellationToken ct)
    {
        if (await RequireOwnerAsync(boardId, ct) is { } denied) return denied;

        var result = await members.RemoveAsync(boardId, userId, ct);
        if (result == MemberChangeResult.Ok) await notifier.NotifyChangedAsync(boardId);
        return ToResult(result);
    }

    private IActionResult ToResult(MemberChangeResult result) => result switch
    {
        MemberChangeResult.Ok => NoContent(),
        MemberChangeResult.NotFound => NotFound(),
        _ => Conflict(new { error = "A board needs at least one owner." }),
    };
}
