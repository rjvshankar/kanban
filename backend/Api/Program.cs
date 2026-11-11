using System.Threading.RateLimiting;
using System.Text;
using Api.Data;
using Api.Hubs;
using Api.Models;
using Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddSingleton<IDbConnectionFactory, SqlConnectionFactory>();
builder.Services.AddSingleton<IUserRepository, UserRepository>();
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddSingleton<IBoardRepository, BoardRepository>();
builder.Services.AddSingleton<IMemberRepository, MemberRepository>();
builder.Services.AddSingleton<IColumnRepository, ColumnRepository>();
builder.Services.AddSingleton<ICardRepository, CardRepository>();
builder.Services.AddSingleton<IPasswordResetRepository, PasswordResetRepository>();
builder.Services.AddOptions<SmtpOptions>()
    .Bind(builder.Configuration.GetSection(SmtpOptions.Section))
    .Validate(o => !string.IsNullOrWhiteSpace(o.Host) && !string.IsNullOrWhiteSpace(o.FromAddress),
        "Smtp:Host and Smtp:FromAddress must be configured.")
    .ValidateOnStart();
builder.Services.AddSingleton<IEmailSender, SmtpEmailSender>();
builder.Services.AddSingleton<ITokenService, TokenService>();
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddSingleton<IBoardNotifier, BoardNotifier>();
builder.Services.AddHostedService<ArchivePurgeService>();

builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.Section))
    .Validate(o => Encoding.UTF8.GetByteCount(o.Key) >= 32, "Jwt:Key must be at least 32 bytes.")
    .ValidateOnStart();

var jwt = builder.Configuration.GetSection(JwtOptions.Section).Get<JwtOptions>()!;
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.MapInboundClaims = false; // keep claim names exactly as in the token ("sub", "email")
        // Read the token from the httpOnly cookie. If there's no cookie, the default
        // Authorization: Bearer header handling still applies (handy for Api.http / tools).
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (ctx.Request.Cookies.TryGetValue(Api.Controllers.AuthController.CookieName, out var token))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Forgot-password: at most 3 requests per IP address in any 15-minute window.
    o.AddPolicy(RateLimitPolicies.ForgotPassword, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0 // over the limit: reject immediately, don't queue
            }));

    o.OnRejected = async (context, ct) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();

        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            """{"error":"Too many requests. Please try again later."}""", ct);
    };
});
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

DatabaseMigrator.Migrate(app.Configuration.GetConnectionString("Default")!);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

if (!app.Environment.IsDevelopment()) 
{
    app.UseHttpsRedirection();
}

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<BoardHub>("/hubs/board");

app.MapGet("/api/health", async (IDbConnectionFactory db, CancellationToken ct) =>
{
    await using var conn = await db.OpenAsync(ct);
    return Results.Ok(new { status = "healthy" });
});

app.Run();

// Exposes the top-level Program class to the test project (WebApplicationFactory<Program>).
public partial class Program;
