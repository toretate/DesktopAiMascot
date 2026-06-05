# Timer/Scheduler IPC ハンドラーの移行計画

`ui/electron/main.ts` に定義されているタイマー/スケジューラー関連の IPC ハンドラーおよび通知処理を、新規作成した `ui/electron/ipc-handlers/schedule-handler.ts` に移動し、モジュール化します。

## ユーザーレビューが必要な項目
特になし。

## Proposed Changes

### Electron UI

#### [NEW] [schedule-handler.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/ipc-handlers/schedule-handler.ts)
- `start-timer` および `trigger-timer-notification` の IPC ハンドラーを定義。
- タイマー満了時および通知要求時に OS のデスクトップ通知および各ウィンドウ（マスコット、チャット）へ通知を送る `triggerTimerNotifications` 関数を定義。
- マスコットウィンドウおよびチャットウィンドウの参照は、それぞれのモジュール (`mascot-window.ts`, `chat-window.ts`) の取得関数 (`getMascotWindow`, `getChatWindow`) を使用。

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- `main.ts` から `start-timer`, `trigger-timer-notification` ハンドラーおよび `triggerTimerNotifications` 関数を削除。
- `app.whenReady().then(...)` 内で `registerScheduleHandlers()` を呼び出すように変更。

## Verification Plan

### 自動テスト
- `ui` ディレクトリでの TypeScript ビルドがエラーなく成功することを確認する。
  - コマンド: `npm run build`

### 手動確認
- タイマー機能（「n分後に教えて」など）を呼び出し、指定時間後にデスクトップ通知が表示され、マスコット/チャットに通知イベントが伝達されることを確認。
