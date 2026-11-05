namespace Api.Data;

public interface IPasswordResetRepository
{
    /// <summary>Stores a new reset token and invalidates any earlier unused ones for that user.</summary>
    Task CreateAsync(int userId, string tokenHash, DateTime expiresAt, CancellationToken ct = default);

    /// <summary>
    /// If the token exists, is unused and not expired: marks it used, sets the user's new
    /// password hash, and invalidates the user's other tokens. All in one transaction.
    /// Returns false if the token was invalid.
    /// </summary>
    Task<bool> ConsumeAsync(string tokenHash, string newPasswordHash, CancellationToken ct = default);
}
