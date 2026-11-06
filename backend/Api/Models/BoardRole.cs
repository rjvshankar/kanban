namespace Api.Models;

public static class BoardRole
{
    public const string Owner = "owner";
    public const string Editor = "editor";
    public const string Viewer = "viewer";

    public static bool CanEdit(string role) => role is Owner or Editor;
}
