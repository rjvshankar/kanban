using System.Net;
using System.Net.Http.Json;
using Api.Dtos;
using Api.Tests.Infrastructure;
using Shouldly;

namespace Api.Tests.Integration;

public sealed class MemberTests(ApiFixture fixture) : IntegrationTest(fixture)
{
    [Fact]
    public async Task Added_member_sees_board_with_assigned_role()
    {
        var owner = await NewUserAsync();
        var viewer = await NewUserAsync();
        var board = await CreateBoardAsync(owner);

        await AddMemberAsync(owner, board, viewer, "viewer");

        (await GetBoardAsync(viewer, board)).Role.ShouldBe("viewer");
        (await viewer.Client.GetFromJsonAsync<List<BoardSummaryResponse>>("/api/boards", TestContext.Current.CancellationToken))!.ShouldHaveSingleItem();
    }

    [Fact]
    public async Task Adding_twice_or_with_bad_role_fails()
    {
        var owner = await NewUserAsync();
        var other = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        await AddMemberAsync(owner, board, other, "editor");

        (await owner.Client.PostAsJsonAsync($"/api/boards/{board}/members", new AddMemberRequest(other.Id, "editor"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await owner.Client.PostAsJsonAsync($"/api/boards/{board}/members", new AddMemberRequest(other.Id, "admin"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Role_change_takes_effect()
    {
        var owner = await NewUserAsync();
        var member = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        var column = await CreateColumnAsync(owner, board);
        await AddMemberAsync(owner, board, member, "viewer");

        (await member.Client.PostAsJsonAsync($"/api/columns/{column}/cards", new CardRequest("x", null, null), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        await owner.Client.PatchAsJsonAsync($"/api/boards/{board}/members/{member.Id}", new ChangeRoleRequest("editor"), TestContext.Current.CancellationToken);

        (await member.Client.PostAsJsonAsync($"/api/columns/{column}/cards", new CardRequest("x", null, null), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Last_owner_cannot_be_demoted_or_removed()
    {
        var owner = await NewUserAsync();
        var board = await CreateBoardAsync(owner);

        (await owner.Client.PatchAsJsonAsync($"/api/boards/{board}/members/{owner.Id}", new ChangeRoleRequest("editor"), TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await owner.Client.DeleteAsync($"/api/boards/{board}/members/{owner.Id}", TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Removed_member_loses_access()
    {
        var owner = await NewUserAsync();
        var member = await NewUserAsync();
        var board = await CreateBoardAsync(owner);
        await AddMemberAsync(owner, board, member, "editor");

        (await owner.Client.DeleteAsync($"/api/boards/{board}/members/{member.Id}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await member.Client.GetAsync($"/api/boards/{board}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Candidate_search_needs_two_chars_and_excludes_existing_members()
    {
        var owner = await NewUserAsync("owner");
        var bob = await NewUserAsync("bobby");
        var board = await CreateBoardAsync(owner);

        (await owner.Client.GetFromJsonAsync<List<MemberResponse>>($"/api/boards/{board}/members/candidates?q=b", TestContext.Current.CancellationToken))!.ShouldBeEmpty();
        (await owner.Client.GetFromJsonAsync<List<MemberResponse>>($"/api/boards/{board}/members/candidates?q=bobby", TestContext.Current.CancellationToken))!
            .ShouldHaveSingleItem().UserId.ShouldBe(bob.Id);

        await AddMemberAsync(owner, board, bob, "viewer");
        (await owner.Client.GetFromJsonAsync<List<MemberResponse>>($"/api/boards/{board}/members/candidates?q=bobby", TestContext.Current.CancellationToken))!.ShouldBeEmpty();
    }
}
