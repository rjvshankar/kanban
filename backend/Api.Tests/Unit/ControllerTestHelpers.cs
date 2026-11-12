using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;

namespace Api.Tests.Unit;

internal static class ControllerTestHelpers
{
    /// <summary>Gives the controller a logged-in user (sub claim) or, with null, an identity that has no user id.</summary>
    public static T AsUser<T>(this T controller, int? userId) where T : ControllerBase
    {
        var claims = userId is null ? [] : new[] { new Claim("sub", userId.Value.ToString()) };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) }
        };
        return controller;
    }

    public static int Status(this IActionResult result) => result switch
    {
        IStatusCodeActionResult s => s.StatusCode ?? 200,
        ForbidResult => 403,
        _ => throw new InvalidOperationException($"Unexpected result {result.GetType().Name}")
    };
}
