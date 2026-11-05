using System.ComponentModel.DataAnnotations;
namespace Api.Dtos;

public sealed record ForgotPasswordRequest([Required, EmailAddress] string Email);
