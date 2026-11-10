using System.ComponentModel.DataAnnotations;
namespace Api.Dtos;

public sealed record MemberResponse(int UserId, string FirstName, string LastName, string Email, string Role);

public sealed record AddMemberRequest([Required] int UserId, [Required] string Role);

public sealed record ChangeRoleRequest([Required] string Role);
