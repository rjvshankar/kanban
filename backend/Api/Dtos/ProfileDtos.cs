using System.ComponentModel.DataAnnotations;
namespace Api.Dtos;

public sealed record UpdateProfileRequest(
    [Required, StringLength(100)] string FirstName,
    [Required, StringLength(100)] string LastName);
