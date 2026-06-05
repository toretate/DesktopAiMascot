# Gemini (Google AI Studio) 連携実装タスク

- [x] `ChatAiServiceBase.cs` 内の無限再帰バグの修正
- [x] `GoogleAiStudioChatService.cs` における会話履歴対応（`ChatHistory.GetMessages()` の反映）
- [x] `GoogleAiStudioChatService.cs` 内での `SystemInstruction` によるシステムプロンプト設定
- [x] `GoogleAiStudioChatService.cs` への `SendMessageAsync(string message, string? modelName)` のオーバーライド追加
- [x] 例外処理の強化（APIキー無効、ネットワークエラーなどのハンドリング向上）
- [x] プロジェクトのビルド検証 (`dotnet build`)
- [x] 修正内容の確認（`walkthrough.md`）の作成
