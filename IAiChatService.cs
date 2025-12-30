using System.Threading.Tasks;

namespace DesktopAiMascot
{
    public interface IAiChatService
    {
        // チャットメッセージを送信する
        Task<string?> SendMessageAsync(string message);

        // チャット履歴をクリアする
        void ClearConversation();
    }
}
