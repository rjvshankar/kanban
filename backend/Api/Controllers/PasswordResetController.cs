using System.Security.Cryptography;
using System.Text;
using Api.Data;
using Api.Dtos;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class PasswordResetController(
    IUserRepository users,
    IPasswordResetRepository resets,
    IPasswordHasher<User> hasher,
    IEmailSender email,
    IConfiguration config) : ControllerBase
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);

    [HttpPost("forgot-password")]
    [EnableRateLimiting(RateLimitPolicies.ForgotPassword)]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest req, CancellationToken ct)
    {
        var user = await users.GetByEmailAsync(req.Email.Trim().ToLowerInvariant(), ct);

        if (user is not null)
        {
            var rawToken = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
            await resets.CreateAsync(user.Id, Hash(rawToken), DateTime.UtcNow.Add(TokenLifetime), ct);

            var baseUrl = config["App:FrontendUrl"] ?? "http://localhost:5173";
            var link = $"{baseUrl.TrimEnd('/')}/reset-password?token={rawToken}";

            await email.SendAsync(
                user.Email,
                "Reset your Kanban password",
                $"Hi {user.FirstName},\n\nUse this link to choose a new password (valid for 30 minutes):\n{link}\n\n" +
                "If you didn't ask for this, you can ignore this email.",
                ct);
        }

        // Identical response whether or not the email exists, so this can't be used to find registered emails.
        return Ok(new { message = "If that email is registered, a reset link has been sent." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest req, CancellationToken ct)
    {
        // Hash the new password using a throwaway User object (the hasher only needs a type).
        var newHash = hasher.HashPassword(new User(), req.NewPassword);

        var ok = await resets.ConsumeAsync(Hash(req.Token), newHash, ct);
        return ok
            ? NoContent()
            : BadRequest(new { error = "This reset link is invalid or has expired." });
    }

    private static string Hash(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))).ToLowerInvariant();
}
