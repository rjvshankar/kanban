using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
namespace Api.Services;

public sealed class SmtpEmailSender(IOptions<SmtpOptions> options) : IEmailSender
{
    private readonly SmtpOptions _smtp = options.Value;

    public async Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_smtp.FromName, _smtp.FromAddress));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        using var client = new SmtpClient();
        await client.ConnectAsync(
            _smtp.Host, _smtp.Port,
            _smtp.UseSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None, ct);

        if (!string.IsNullOrEmpty(_smtp.Username) && !string.IsNullOrEmpty(_smtp.Password))
            await client.AuthenticateAsync(_smtp.Username, _smtp.Password, ct);

        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
