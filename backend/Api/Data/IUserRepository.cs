using Api.Models;
namespace Api.Data;

public interface IUserRepository
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<int> CreateAsync(User user, CancellationToken ct = default);
}
