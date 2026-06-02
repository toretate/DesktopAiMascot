# マスコットのサイズ変更機能の実装計画

マスコットウィンドウとマスコットキャラクターのサイズを変更する機能を実装します。設定画面でのスライダーによる数値的なサイズ調整と、マスコット上での `Ctrl + マウスホイール` による直感的なその場リサイズを組み合わせて実現します。

## ユーザーレビュー要求事項

> [!IMPORTANT]
> 1. **最小・最大スケール制限**: スケールの範囲は `0.5`（半分）から `2.0`（2倍）までに制限します。この範囲について問題ないかご確認ください。
> 2. **ホイール操作の感度**: `Ctrl + マウスホイール` によるリサイズ時は `0.1` 刻みで変更する予定です。より滑らかにするために `0.05` 刻みにすることも可能です。

## オープンクエスチョン

現在はありません。

## 提案する変更

### バックエンド (Electron)

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/main.ts)
* `ConfigData` に `mascotScale: number` を追加します（デフォルトは `1.0`）。
* ウィンドウ作成時 (`createWindows`) に、保存された `mascotScale` を読み込んでマスコットウィンドウのサイズを `defaultMascotW * mascotScale` / `defaultMascotH * mascotScale` で初期化します。
* チャットウィンドウの追従初期位置である `chatOffsetX` も `defaultMascotW * mascotScale` に同期します。
* IPCイベント `set-mascot-scale` を新規実装します。このハンドラーは以下の処理を実行します。
  1. `config.update({ mascotScale: scale })` による設定値の保存。
  2. `mascotWindow.setSize` によるマスコットウィンドウの動的リサイズ。
  3. `chatOffsetX` の更新と `syncChatWindowPosition()` によるチャットウィンドウ位置の再計算・再配置。
  4. 全てのウィンドウ（マスコット、チャット、設定）に対して最新の設定データ (`config-updated`) をブロードキャスト。

#### [MODIFY] [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/preload.ts)
* `electronAPI` に `setMascotScale` を追加し、メインプロセスの `set-mascot-scale` にスケール値を送信できるようにします。

---

### フロントエンド (Vue 3 / Pinia)

#### [MODIFY] [electron.d.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/electron.d.ts)
* TypeScriptコンパイルエラーを防ぐため、`IElectronAPI` インターフェースに `setMascotScale(scale: number): void;` の型定義を追加します。

#### [MODIFY] [config.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/store/config.ts)
* Piniaストアの `AppConfig` および `State` に `mascotScale: number` を追加します。
* `loadConfig`, `saveConfig`, `updateConfig` アクション内で `mascotScale` が正しくロード・保存・反映されるようにします。

#### [MODIFY] [MascotViewer.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/MascotViewer.vue)
* マスコット描画要素である `.mascot-visual` のインラインスタイルを変更し、`mascotScale` に応じたサイズ（幅・高さ、`font-size`、表情画像の幅・高さ）を適用します。
* `Ctrl + マウスホイール` 操作を検知する `@wheel` イベントリスナーを追加します。
  * `e.ctrlKey` が `true` の場合、ブラウザの標準ズームの動作を抑制し、`deltaY` の方向に応じてスケールを `0.1` 刻みで変更します。
  * 計算後の新しいスケールを `window.electronAPI.setMascotScale(newScale)` 経由でメインプロセスに送信します。

#### [MODIFY] [SettingsWindow.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/SettingsWindow.vue)
* サイドメニューの「**チャットウィンドウ** (`chatwindow`)」タブの名称・表記を「**ウィンドウ設定**」に変更します。
* その設定パネルの中に「**マスコットサイズ設定**」セクションを追加します。
  * **スライダー**: 50%〜200%（0.5〜2.0）の間で `mascotScale` をリアルタイム調整するスライダーを設置。
  * **プリセットボタン**: 「小 (50%)」「中 (100%)」「大 (150%)」「特大 (200%)」を設定可能なクイック選択ボタン。
* スライダー等の変更イベントで、`window.electronAPI.setMascotScale` を呼び出します。

## 検証計画

### 自動テスト / コンパイル確認
* `npm run build` または `npm run dev` によるビルドおよび動作に問題がないか確認します。

### 手動検証
1. 設定画面の「ウィンドウ設定」タブを開き、スライダーをドラッグしてマスコットウィンドウとキャラクターがリアルタイムに拡大・縮小することを確認します。
2. プリセットボタン（小・中・大・特大）をクリックして、対応するサイズに一瞬で切り替わることを確認します。
3. マスコットウィンドウにカーソルを合わせ、`Ctrl` キーを押しながらマウスホイールを回転させたときに、その場でマスコットサイズが大きくなる・小さくなることを確認します。
4. チャットウィンドウが表示されている状態でサイズを変更した際、チャットウィンドウの位置がマスコットの大きさに合わせて適切に追従し、重なったり離れたりしないことを確認します。
5. アプリケーションを一度終了し、再起動した後に前回変更したサイズが維持されていることを確認します。
