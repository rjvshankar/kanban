namespace Api.Services;

public interface IBoardNotifier
{
    /// <summary>Tells everyone viewing the board that something changed, so they should refetch it.</summary>
    Task NotifyChangedAsync(int boardId);
}
