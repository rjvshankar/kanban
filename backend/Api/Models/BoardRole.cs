namespace Api.Models;

public static class ArchivePolicy
{
    /// <summary>Days a deleted board stays restorable. The daily purge job must use the same number.</summary>
    public const int RetentionDays = 30;
}

public static class BoardRole
{
    public const string Owner = "owner";
    public const string Editor = "editor";
    public const string Viewer = "viewer";

    public static bool IsValid(string? role) => role is Owner or Editor or Viewer;

    /// <summary>Cards: create, edit, move, delete.</summary>
    public static bool CanEditCards(string role) => role is Owner or Editor;

    /// <summary>Columns, board rename/delete, membership.</summary>
    public static bool IsOwner(string role) => role is Owner;
}
