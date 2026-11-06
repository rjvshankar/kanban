using System.Security.Claims;
namespace Api.Services;

public static class ClaimsPrincipalExtensions
{
    // The JWT "sub" claim holds the user id (inbound claim mapping is off, see Program.cs).
    public static bool TryGetUserId(this ClaimsPrincipal user, out int id) =>
        int.TryParse(user.FindFirst("sub")?.Value, out id);
}
