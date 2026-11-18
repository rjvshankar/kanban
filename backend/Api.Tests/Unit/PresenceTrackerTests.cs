using Api.Services;
using Shouldly;

namespace Api.Tests.Unit;

public sealed class PresenceTrackerTests
{
    private readonly PresenceTracker _tracker = new();
    private static PresenceViewer Ada => new(1, "Ada", "Lovelace", null);
    private static PresenceViewer Bob => new(2, "Bob", "Builder", 99);

    [Fact]
    public void First_connection_makes_the_user_a_viewer_and_reports_the_board_changed()
    {
        _tracker.Join(5, Ada, "c1").ShouldBe([5]);
        _tracker.Viewers(5).ShouldBe([Ada]);
    }

    [Fact]
    public void Second_tab_of_the_same_user_is_still_one_viewer_and_no_change()
    {
        _tracker.Join(5, Ada, "c1");
        _tracker.Join(5, Ada, "c2").ShouldBeEmpty();
        _tracker.Viewers(5).Count.ShouldBe(1);
    }

    [Fact]
    public void User_stays_until_the_last_tab_closes()
    {
        _tracker.Join(5, Ada, "c1");
        _tracker.Join(5, Ada, "c2");

        _tracker.Leave("c1").ShouldBeNull();
        _tracker.Viewers(5).Count.ShouldBe(1);

        _tracker.Leave("c2").ShouldBe(5);
        _tracker.Viewers(5).ShouldBeEmpty();
    }

    [Fact]
    public void Viewers_are_sorted_by_name_and_scoped_per_board()
    {
        _tracker.Join(5, Bob, "c1");
        _tracker.Join(5, Ada, "c2");
        _tracker.Join(6, Bob, "c3");

        _tracker.Viewers(5).ShouldBe([Ada, Bob]);
        _tracker.Viewers(6).ShouldBe([Bob]);
    }

    [Fact]
    public void Joining_the_same_board_twice_on_one_connection_is_a_no_op()
    {
        _tracker.Join(5, Ada, "c1");
        _tracker.Join(5, Ada, "c1").ShouldBeEmpty();
        _tracker.Leave("c1").ShouldBe(5);
    }

    [Fact]
    public void Moving_a_connection_to_another_board_removes_it_from_the_first()
    {
        _tracker.Join(5, Ada, "c1");

        _tracker.Join(6, Ada, "c1").ShouldBe([5, 6]);

        _tracker.Viewers(5).ShouldBeEmpty();
        _tracker.Viewers(6).ShouldBe([Ada]);
    }

    [Fact]
    public void Leaving_an_unknown_connection_changes_nothing()
    {
        _tracker.Leave("nope").ShouldBeNull();
        _tracker.Leave("nope").ShouldBeNull();
    }

    [Fact]
    public void Rejoining_refreshes_the_stored_name_and_avatar()
    {
        _tracker.Join(5, Ada, "c1");
        _tracker.Join(5, Ada with { AvatarVersion = 7 }, "c2");

        _tracker.Viewers(5).Single().AvatarVersion.ShouldBe(7);
    }
}
