# アプリケーション再起動機能の修正内容確認（Walkthrough）

「アプリ終了」の上に「再起動」ボタンを追加し、アプリの再起動プロセスを実行できるよう実装しました。また、開発環境におけるプロセス監視の仕様によるクラッシュを防止するため、開発環境ではダイアログ警告を出してアプリをクローズする仕様に調整しました。

## 変更内容

### Electron メインプロセスおよびプリロード

#### [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/preload.ts)
- `relaunchApp` 関数を `electronAPI` に追加し、IPC経由で `relaunch-app` イベントをメインプロセスへ送信できるようにしました。

#### [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
- `relaunch-app` メッセージリスナーを追加し、`app.relaunch()` を実行してから `app.exit(0)` で安全に現在のアプリケーションプロセスを終了して再起動する処理を実装しました。
- 開発環境（Vite 開発サーバー経由）では、`app.relaunch()` が呼び出されて古いプロセスが死ぬと `vite-plugin-electron` のクリーンアップ処理によりコマンドラインが強制終了（クラッシュ）します。これを防止するため、開発環境時は警告ダイアログ（`dialog.showMessageBoxSync`）を表示し、手動で再度起動するようアナウンスしてから安全に `app.quit()` を実行するフォールバック処理を実装しました。
- 本番パッケージング環境では、従来どおり自動的に `app.relaunch()` と `app.exit(0)` を行い自動再起動します。

#### [electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/electron.d.ts)
- `IElectronAPI` に `relaunchApp: () => void;` の型定義を追加し、TypeScript のコンパイルエラーを解消しました。

### 設定画面 UI (設定ウィンドウ)

#### [SettingsWindow.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/src/components/settings/SettingsWindow.vue)
- 設定画面のサイドバーフッターに「再起動」ボタンを追加しました。
- 再起動ボタンのCSSクラス `.relaunch-btn` を追加し、警告・注意を促すカラー (黄色 `#eab308`) でスタイリングしました。また、サイドバーが折りたたまれている場合のツールチップ表示もサポートしています。

---

## 検像結果

- `npm run build` を実行し、TypeScriptの型チェックおよびViteによるビルドがエラーなしで正常に完了することを確認しました。
