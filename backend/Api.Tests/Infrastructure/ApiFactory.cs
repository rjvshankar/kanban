using Api.Services;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Api.Tests.Infrastructure;

/// <summary>
/// Boots the real API in-process. The connection string and JWT key come from environment
/// variables set by <see cref="ApiFixture"/> (Program.cs reads config eagerly, so they must exist
/// before the host is built). Only outgoing email is replaced.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public FakeEmailSender Emails { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Emails);
        });
    }
}
