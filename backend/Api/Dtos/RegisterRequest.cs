using System.ComponentModel.DataAnnotations;
namespace Api.Dtos;

public sealed record RegisterRequest(
    [Required, StringLength(100)] string FirstName,
    [Required, StringLength(100)] string LastName,
    [Required, EmailAddress, StringLength(320)] string Email,
    [Phone, StringLength(30)] string? PhoneNumber,
    [Required, StringLength(128, MinimumLength = 8)] string Password);
