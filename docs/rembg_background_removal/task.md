# タスクリスト: ComfyUI背景除去機能の実装

- [x] server/src/index.ts の修正
  - [x] ComfyUI疎通確認および画像アップロード処理の実装
  - [x] WebSocket接続によるワークフロー送信とバイナリ画像受信処理の実装
  - [x] `/api/remove-background` エンドポイントでの engine === 'comfy' 判定と呼び出し統合
- [x] src/components/settings/BackgroundRemovalModal.vue の修正
  - [x] 「Comfy UI [未実装]」の disabled 状態を解除し選択可能にする
  - [x] 背景削除実行時に選択された engine ('comfy') をサーバーに送信するようにする
- [ ] 動作確認
  - [ ] ComfyUI が起動している状態で「Comfy UI」エンジンを選択し、背景が綺麗に透過されることを検証
