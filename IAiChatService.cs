using System.Threading.Tasks;

namespace DesktopAiMascot
{
    // AIチャットサービスのインターフェース
    public interface IAiChatService
    {
        // AIにチャットメッセージを送信する
        Task<string?> SendMessageAsync(string message);

        // チャット履歴をクリアする
        void ClearConversation();
    }
}
