# マスコットの定期タイマーお知らせ機能の実装計画（サーバー管理対応版）

ユーザーがチャットで「n分後にお知らせして」などと指示した際に、LLM（Gemini または LM Studio 等のローカルLLM）がそれを解釈し、指定時間経過後にデスクトップや接続中のデバイスでお知らせする機能を実装します。

複数端末での利用や将来的なスマホ通知を考慮し、**サーバー連携時はサーバーが中央でタイマーを管理・配信する設計**とし、**非連携時はローカル（Electronメインプロセス）でタイマーを管理するハイブリッド方式**を採用します。

## ユーザー確認が必要な事項

> [!IMPORTANT]
> - **タイマーの管理場所**:
>   - サーバー連携時 (`useServer: true`): サーバー側のメモリ上でタイマーを管理し、満了時に接続されている全クライアント（PCやスマホなど）にWebSocket経由で一斉に通知を送ります。
>   - サーバー非連携時 (`useServer: false`): 各PCのElectronメインプロセス側でタイマーを管理します。
> - **タイマー終了時の挙動**: マスコットがお知らせ内容を吹き出しに表示し、感情変化・音声合成とともにデスクトップにトースト通知を表示します。

## 提案される変更点

### 1. プロンプト制御とタグのパース (フロントエンド & バックエンド)

#### [MODIFY] [ChatPanel.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/ChatPanel.vue)
- 送信時の `systemPrompt` に、タイマー登録用タグ `[TIMER:秒数,お知らせ内容]` の返却ルールを注入する処理を追加します。
- サーバー非連携（ローカル）でのチャット返答から `[TIMER:...]` タグをパース・除去し、Electronメインプロセスへタイマー登録を要求します（`window.electronAPI.startTimer(seconds, memo)`）。
- サーバー連携時、サーバーから返されるクレンジング済みのテキストを受け取ります。

#### [MODIFY] [websocket.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/routes/websocket.ts)
- サーバー連携時のチャット返答から `[TIMER:秒数,お知らせ内容]` タグを検出します。
- 検出したタグは `reply` および `speechText` から除去します。
- タグが検出された場合、サーバー側で `setTimeout` を使用してタイマーをセットします。
- 時間が来たら、そのユーザー（または接続中）の全WebSocketクライアントに対して `timer-trigger` イベントを一斉送信します。

### 2. IPC通信の拡張 (プレロード)

#### [MODIFY] [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/preload.ts)
- ローカル動作時のための `startTimer` APIと、ローカル・サーバー共通のタイマー満了イベント（`on-timer-trigger`）を受け取るリスナー登録関数を追加します。

### 3. ローカル管理とOS通知の制御 (Electronメインプロセス)

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- ローカル動作用の `startTimer` IPCチャネルを処理し、`setTimeout` で管理します。
- タイマーが満了（ローカルタイマーの満了、またはサーバーからのイベント受信時）した際、OS標準の通知機能（`Notification`）を使って通知を表示するとともに、マスコットウィンドウにイベントを通知します。

### 4. マスコットのお知らせアクション (マスコットUI)

#### [MODIFY] [MascotViewer.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/MascotViewer.vue)
- サーバー（WebSocket経由）またはメインプロセス（IPC経由）から届く `timer-trigger` イベントを購読します。
- タイマー満了時、表情を変化させ、吹き出しにお知らせ内容を表示し、音声合成でメモ内容を喋らせます。

---

## 検証計画

### 手動検証
1. サーバー連携をOFFにした状態で「10秒後にテストと教えて」と話し、10秒後にローカルで正常にマスコット通知とOS通知が届くことを確認する。
2. サーバー連携をONにした状態で同様に「10秒後にテストと教えて」と話し、サーバー側でタイマーがセットされ、10秒後にWebSocket経由でマスコット通知とOS通知が届くことを確認する。
