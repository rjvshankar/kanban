using System.Collections.Concurrent;
using Api.Services;

namespace Api.Tests.Infrastructure;

/// <summary>Captures outgoing emails instead of talking to SMTP.</summary>
public sealed class FakeEmailSender : IEmailSender
{
    public sealed record Message(string To, string Subject, string Body);

    private readonly ConcurrentQueue<Message> _sent = new();

    public IReadOnlyCollection<Message> Sent => _sent.ToArray();

    public Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        _sent.Enqueue(new Message(to, subject, body));
        return Task.CompletedTask;
    }
}
