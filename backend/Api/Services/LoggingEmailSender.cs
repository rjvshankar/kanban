namespace Api.Services;

/// <summary>Placeholder sender: writes the email to the API console instead of sending it.</summary>
public sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        logger.LogInformation("EMAIL to {To}\nSubject: {Subject}\n{Body}", to, subject, body);
        return Task.CompletedTask;
    }
}
