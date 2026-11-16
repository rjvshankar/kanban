namespace Api.Models;

public sealed class User
{
    public int Id { get; set; }
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? PhoneNumber { get; set; }
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    /// <summary>Changes whenever the avatar changes (used to bust caches); null when the user has no avatar.</summary>
    public long? AvatarVersion { get; set; }
}
