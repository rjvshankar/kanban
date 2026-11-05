using Api.Data;
using Api.Dtos;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
namespace Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    IUserRepository users,
    IPasswordHasher<User> hasher,
    ITokenService tokens) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req, CancellationToken ct)
    {
        var email = req.Email.Trim().ToLowerInvariant();

        if (await users.GetByEmailAsync(email, ct) is not null)
            return Conflict(new { error = "Email is already registered." });

        var user = new User
        {
            FirstName = req.FirstName.Trim(),
            LastName = req.LastName.Trim(),
            Email = email,
            PhoneNumber = req.PhoneNumber?.Trim()
        };
        user.PasswordHash = hasher.HashPassword(user, req.Password);

        try
        {
            var id = await users.CreateAsync(user, ct);
            return StatusCode(StatusCodes.Status201Created, new { id, email });
        }
        catch (SqlException ex) when (ex.Number is 2627 or 2601)
        {
            // Two requests registered the same email at the same moment.
            return Conflict(new { error = "Email is already registered." });
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req, CancellationToken ct)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await users.GetByEmailAsync(email, ct);

        // Same response for "no such user" and "wrong password" so attackers can't probe for emails.
        if (user is null ||
            hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password) == PasswordVerificationResult.Failed)
            return Unauthorized(new { error = "Invalid email or password." });

        var (token, expiresAt) = tokens.CreateAccessToken(user);
        return Ok(new
        {
            accessToken = token,
            expiresAt,
            user = new { id = user.Id, email = user.Email, firstName = user.FirstName, lastName = user.LastName }
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirst("sub")?.Value, out var id)) return Unauthorized();

        var user = await users.GetByIdAsync(id, ct);
        if (user is null) return Unauthorized();

        return Ok(new { id = user.Id, email = user.Email, firstName = user.FirstName, lastName = user.LastName });
    }
}
