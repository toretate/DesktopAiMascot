# タスクリスト (マスコットのサイズ変更機能実装)

- [x] バックエンド (Electron) 実装
    - [x] `main.ts` に `mascotScale` を追加し、ウィンドウサイズ設定と `chatOffsetX` 追従位置計算に組み込む
    - [x] `main.ts` に `set-mascot-scale` IPCハンドラーを追加し、設定の更新・ウィンドウサイズ変更・ブロードキャストを実装する
    - [x] `preload.ts` に `setMascotScale` 呼び出しブリッジ関数を追加する
- [x] フロントエンド (Vue 3 / Pinia) 実装
    - [x] `electron.d.ts` に `setMascotScale` の型定義を追加する
    - [x] `config.ts` ストアに `mascotScale` を追加し、保存・読み込みロジックを統合する
    - [x] `MascotViewer.vue` に `Ctrl + マウスホイール` イベントリスナーを追加し、スケール変更IPC送信を実装する
    - [x] `MascotViewer.vue` のマスコット・表情描画部分（`.mascot-visual` など）をスケールに応じたサイズに動的拡張する
    - [x] `SettingsWindow.vue` の「チャットウィンドウ」タブを「ウィンドウ設定」に拡張し、サイズ調整用のスライダーとプリセットボタンを追加する
- [x] 動作検証とクリーンアップ
    - [x] ビルドテストと警告の確認
    - [x] 設定画面でのサイズ調整（スライダーとプリセット）の動作検証
    - [x] `Ctrl + Wheel` によるサイズ調整の動作検証
    - [x] チャットウィンドウの追従・オフセット同期の動作検証
    - [x] アプリ再起動時のサイズ維持の動作検証
    - [x] 修正内容の確認（Walkthrough）ドキュメント `walkthrough.md` を作成する
