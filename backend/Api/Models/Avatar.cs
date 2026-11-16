namespace Api.Models;

public sealed record Avatar(string ContentType, byte[] Data, DateTime UpdatedAt);
