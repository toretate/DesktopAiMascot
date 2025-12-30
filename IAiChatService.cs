using System.Threading.Tasks;

namespace DesktopAiMascot
{
    public interface IAiChatService
    {
        Task<string?> SendMessageAsync(string message);
    }
}
