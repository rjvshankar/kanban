namespace Api.Services;

public sealed class SmtpOptions
{
    public const string Section = "Smtp";

    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string FromAddress { get; set; } = "";
    public string FromName { get; set; } = "Kanban";
}
