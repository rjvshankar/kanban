using System.ComponentModel.DataAnnotations;
namespace Api.Dtos;

public sealed record ResetPasswordRequest(
    [Required] string Token,
    [Required, StringLength(128, MinimumLength = 8)] string NewPassword);
