# Gemini (Google AI Studio) 連携機能の実装計画

Google AI Studio (Gemini) を使用して、デスクトップマスコットがスムーズかつ知的に会話できるようにするための実装およびバグ修正の計画です。

## ユーザー確認事項

> [!NOTE]
> Google AI Studio の API KEY はすでに設定済みとのことですので、追加のAPIキー設定操作は不要です。実装完了後、すぐに「Gemini (AI Studio)」を選択して動作確認を行っていただけます。

## 解決する問題と変更内容

### 1. `ChatAiServiceBase.cs` における無限再帰（スタックオーバーフロー）の修正
`ChatAiServiceBase` 内の `SendMessageAsync(string message, string? modelName)` メソッドが、自身のオーバーロードではなく自分自身を全く同じ引数で再帰的に呼び出しており、派生クラスでオーバーライドされていない場合に無限ループを引き起こす致命的なバグがあります。これを安全な呼び出しに修正します。

### 2. `GoogleAiStudioChatService.cs` の Gemini SDK 連携の高度化
現状の `GoogleAiStudioChatService` は、会話履歴（コンテキスト）を全く保持せず、最新のメッセージにシステムプロンプトを単純に文字列結合して送信しています。これでは過去の会話を反映した自然な対話ができません。
* **会話履歴の対応**: `ChatHistory.GetMessages()` から取得した会話履歴を、Gemini SDK の `Content`/`Part` 構造に変換して送信するよう実装します。
* **システムプロンプトの適切な設定**: 文字列結合ではなく、Gemini API 本来の機能である `GenerateContentConfig.SystemInstruction` を使用してシステムプロンプトを渡します。これにより、AIが「マスコットキャラクターとしての役割」をより正確に理解し振る舞うようになります。
* **オーバーロードの追加**: `SendMessageAsync(string message, string? modelName)` を正しくオーバーライドし、UIから指定されたモデル名で送信できるようにします。
* **例外処理の強化**: 接続エラー、APIキー無効（401/403）、レート制限（429）などのエラー発生時、ユーザーに分かりやすいメッセージを返せるよう例外処理を整備します。

---

## 提案される変更

### [Component: AI Service (Chat)]

#### [MODIFY] [ChatAiService.cs](file:///c:/workspace/workspace-win/DesktopAiMascot/aiservice/chat/ChatAiService.cs)
* 無限再帰になっている `SendMessageAsync(string message, string? modelName)` の実装を、デフォルトで単一メッセージ送信 `SendMessageAsync(message)` にフォールバックするよう修正します。

#### [MODIFY] [GoogleAiStudioChatService.cs](file:///c:/workspace/workspace-win/DesktopAiMascot/aiservice/chat/GoogleAiStudioChatService.cs)
* 会話履歴の取得と Gemini `Content` 形式へのマッピング。
* `GenerateContentConfig.SystemInstruction` を用いたシステムプロンプトの適用。
* `SendMessageAsync(string message, string? modelName)` のオーバーライド追加。
* `Google.GenAI` SDK の最新仕様（0.14.0）に合わせたAPI呼び出し。

---

## 検証計画

### 自動テスト / コンパイル確認
* `dotnet build` を実行し、すべてのプロジェクトが警告なくコンパイルできることを確認します。

### 手動検証（ユーザー様にお願いしたい操作）
1. 設定画面を開き、API Key ページに Google AI Studio の API KEY が正しく設定されていることを確認します。
2. キャラクターの対話エンジン設定で「Gemini (AI Studio)」を選択します。
3. モデル一覧から動作させたいモデル（例: `gemini-1.5-flash` や `gemini-2.0-flash` など）を選択します。
4. チャットウィンドウから話しかけ、マスコットが過去の会話を記憶しつつ、設定されたキャラクターの口調で正しく応答するかを確認します。
