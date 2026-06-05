# 修正内容の確認 (Walkthrough): 音声ストリーミング再生

音声合成（VOICEVOX）の順次再生（ストリーミング再生／キュー再生）の実装を完了しました。以下に実装内容と検証結果をまとめます。

## 変更内容

### 1. フロントエンド共通プレイヤー
- **[AudioPlaylist.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/utils/AudioPlaylist.ts) の新規作成**
  - 音声データの連続再生を管理するプレイリストクラスを作成しました。
  - 再生キューを保持し、音声の再生終了（`onended`）およびエラー発生時に自動で次の音声を再生します。
  - 新しいメッセージの送信などのタイミングで `stop()` を呼ぶことで、現在再生中の音声を停止しキューをクリアできます。

### 2. クライアント側（非サーバーモード）
- **[ChatPanel.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/ChatPanel.vue) の修正**
  - 新たに `AudioPlaylist` インスタンスを統合し、発話状態（`speaking`）フラグの管理を委ねるようにしました。
  - メッセージ送信時に `playlist.stop()` を実行し、古い音声の再生を中断するようにしました。
  - AI応答文を句読点（`。！？\n`）で文節ごとに分割し、各文に対する音声合成（`synthesizeVoicevox`）リクエストを並行して開始するようにしました。
  - 合成が完了した順にプレイリストに追加し、順次再生します。

### 3. サーバー側（サーバーモード）
- **[websocket.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/routes/websocket.ts) の修正**
  - テキストを文節ごとに分割し、並行して `VoiceAiService.synthesize` 呼び出しを行います。
  - 完了した順（テキスト内の登場順）にクライアントへ `chat-audio` イベントで音声データを順次送信します。
  - フロント側（`ChatPanel.vue`）では、送られてきた音声データをそのまま `AudioPlaylist` に追加して連続再生を行います。

---

## 検証結果

### 1. 自動ビルドとテスト
- サーバー（`tsc`）およびフロントエンド（`vue-tsc && vite build`）のビルドが正常に完了することを確認しました。
- 既存のすべてのテスト（`vitest run`）が正常にパスすることを確認しました。
