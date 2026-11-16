using Api.Models;
namespace Api.Data;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<int> CreateAsync(User user, CancellationToken ct = default);
    Task UpdateNameAsync(int id, string firstName, string lastName, CancellationToken ct = default);
    Task<Avatar?> GetAvatarAsync(int userId, CancellationToken ct = default);
    Task SetAvatarAsync(int userId, string contentType, byte[] data, CancellationToken ct = default);
    Task<bool> DeleteAvatarAsync(int userId, CancellationToken ct = default);
}
