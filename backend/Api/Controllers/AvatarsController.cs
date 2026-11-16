using Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace Api.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class AvatarsController(IUserRepository users) : ControllerBase
{
    public const int MaxBytes = 2 * 1024 * 1024;

    // Detected from the file's first bytes; the client-sent Content-Type is not trusted.
    private static string? Sniff(ReadOnlySpan<byte> b) => b switch
    {
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ..] => "image/png",
        [0xFF, 0xD8, 0xFF, ..] => "image/jpeg",
        [(byte)'R', (byte)'I', (byte)'F', (byte)'F', _, _, _, _, (byte)'W', (byte)'E', (byte)'B', (byte)'P', ..] => "image/webp",
        _ => null
    };

    [HttpPut("auth/me/avatar")]
    [RequestSizeLimit(MaxBytes + 64 * 1024)]
    public async Task<IActionResult> Upload(IFormFile? file, CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirst("sub")?.Value, out var id)) return Unauthorized();
        if (file is null || file.Length == 0) return BadRequest(new { error = "An image file is required." });
        if (file.Length > MaxBytes) return StatusCode(StatusCodes.Status413PayloadTooLarge, new { error = "Image must be 2 MB or smaller." });

        await using var stream = file.OpenReadStream();
        using var ms = new MemoryStream();
        await stream.CopyToAsync(ms, ct);
        var data = ms.ToArray();

        var type = Sniff(data);
        if (type is null) return BadRequest(new { error = "Only PNG, JPEG or WebP images are allowed." });

        await users.SetAvatarAsync(id, type, data, ct);
        var user = await users.GetByIdAsync(id, ct);
        return Ok(new { avatarVersion = user?.AvatarVersion });
    }

    [HttpDelete("auth/me/avatar")]
    public async Task<IActionResult> Remove(CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirst("sub")?.Value, out var id)) return Unauthorized();
        await users.DeleteAvatarAsync(id, ct);
        return NoContent();
    }

    // Any logged-in user may view any avatar (board members see each other).
    [HttpGet("users/{id:int}/avatar")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var avatar = await users.GetAvatarAsync(id, ct);
        if (avatar is null) return NotFound();

        Response.Headers.CacheControl = "private, max-age=86400";
        var etag = new Microsoft.Net.Http.Headers.EntityTagHeaderValue($"\"{new DateTimeOffset(avatar.UpdatedAt, TimeSpan.Zero).ToUnixTimeMilliseconds()}\"");
        return File(avatar.Data, avatar.ContentType, lastModified: null, entityTag: etag);
    }
}
