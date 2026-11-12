using System.Security.Claims;
using Api.Services;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class ClaimsPrincipalExtensionsTests
{
    private static ClaimsPrincipal Principal(params Claim[] claims) => new(new ClaimsIdentity(claims, "test"));

    [Fact]
    public void Reads_user_id_from_sub_claim()
    {
        Principal(new Claim("sub", "42")).TryGetUserId(out var id).ShouldBeTrue();
        id.ShouldBe(42);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("")]
    [InlineData("1.5")]
    public void Rejects_non_numeric_sub(string sub) =>
        Principal(new Claim("sub", sub)).TryGetUserId(out _).ShouldBeFalse();

    [Fact]
    public void Missing_sub_is_rejected() => Principal().TryGetUserId(out _).ShouldBeFalse();

    [Fact]
    public void Ignores_nameidentifier_claim() =>
        Principal(new Claim(ClaimTypes.NameIdentifier, "7")).TryGetUserId(out _).ShouldBeFalse();
}
