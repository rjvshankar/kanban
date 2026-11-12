using Api.Models;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class BoardRoleTests
{
    [Theory]
    [InlineData("owner", true)]
    [InlineData("editor", true)]
    [InlineData("viewer", true)]
    [InlineData("admin", false)]
    [InlineData("Owner", false)] // case-sensitive, matches the DB CHECK constraint
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsValid(string? role, bool expected) => BoardRole.IsValid(role).ShouldBe(expected);

    [Theory]
    [InlineData("owner", true)]
    [InlineData("editor", true)]
    [InlineData("viewer", false)]
    public void CanEditCards(string role, bool expected) => BoardRole.CanEditCards(role).ShouldBe(expected);

    [Theory]
    [InlineData("owner", true)]
    [InlineData("editor", false)]
    [InlineData("viewer", false)]
    public void IsOwner(string role, bool expected) => BoardRole.IsOwner(role).ShouldBe(expected);

    [Fact]
    public void Retention_window_is_30_days() => ArchivePolicy.RetentionDays.ShouldBe(30);
}
