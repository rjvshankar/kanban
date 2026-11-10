using Api.Models;
namespace Api.Data;

public interface IMemberRepository
{
    Task<List<MemberRow>> ListAsync(int boardId, CancellationToken ct = default);

    /// <summary>Users not yet on the board whose name or email contains the term.</summary>
    Task<List<MemberRow>> SearchCandidatesAsync(int boardId, string term, int limit, CancellationToken ct = default);

    /// <summary>False if the user doesn't exist or is already a member.</summary>
    Task<bool> AddAsync(int boardId, int userId, string role, CancellationToken ct = default);

    /// <summary>Refuses (LastOwner) to demote the board's only owner.</summary>
    Task<MemberChangeResult> ChangeRoleAsync(int boardId, int userId, string role, CancellationToken ct = default);

    /// <summary>Refuses (LastOwner) to remove the board's only owner.</summary>
    Task<MemberChangeResult> RemoveAsync(int boardId, int userId, CancellationToken ct = default);
}
