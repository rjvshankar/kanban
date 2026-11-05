using System.ComponentModel.DataAnnotations;
namespace Api.Dtos;

public sealed record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);
