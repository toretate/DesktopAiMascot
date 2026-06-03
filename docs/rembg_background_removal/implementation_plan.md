# ComfyUI による背景除去機能の実装計画

本計画は、現在起動している ComfyUI サーバーの API（WebSocket/HTTP経由）を利用して、AI生成されたスプライト画像などの背景を自動的に除去する機能を実装するものです。
処理には `aiservice/image/comfy_workflows/remove_background_workflow.json` に定義されているワークフロー（`BiRefNetRMBG` + `SaveImageWebsocket`）を使用します。

## ユーザーレビュー要求

> [!IMPORTANT]
> - 本機能を利用するには、ローカルで ComfyUI が起動している必要があります（デフォルト: `http://127.0.0.1:8188`）。
> - ComfyUI 側に `comfyui-rembg` (または `BiRefNetRMBG` を含むカスタムノード) がインストールされており、モデル `BiRefNet_toonout` がロード可能である必要があります。

---

## 提案される変更点

### 1. Electron メインプロセスおよびプリロードの調整

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/main.ts)
以下の IPC ハンドラーを実装します：
- `check-comfyui-status`: ComfyUI サーバー（`http://127.0.0.1:8188`）が起動しているか疎通チェックを行う
- `remove-background-comfy`:
  1. 対象の画像（Base64）を ComfyUI の `/upload/image` エンドポイントにアップロード
  2. `remove_background_workflow.json` を読み込み、ロード画像ノードの入力をアップロードしたファイル名に書き換える
  3. WebSocket（`ws://127.0.0.1:8188/ws`）で接続し、UUIDをクライアントIDとして紐付ける
  4. `/prompt` エンドポイントへワークフローを送信して実行
  5. WebSocket 経由で返される `SaveImageWebsocket` のバイナリデータ（背景除去画像）を受信し、Base64 でフロントエンドに返す

#### [MODIFY] [preload.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/electron/preload.ts)
レンダラープロセスから上記 IPC ハンドラーを呼び出せるよう、`electronAPI` にブリッジ関数を追加します：
- `checkComfyUiStatus()`
- `removeBackgroundComfy(base64Image: string)`

### 2. UI コンポーネントの調整

#### [MODIFY] [AiExpressionGeneratorModal.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/AiExpressionGeneratorModal.vue)
- 生成画像プレビューエリアの右下に「背景除去 (ComfyUI)」ボタンを追加します。
- 背景除去処理の実行中は、ローディング状態を表示します。
- 処理が成功した場合、`generatedImage` を背景除去済みの画像データ（Base64）に更新し、プレビューに反映します。

---

## 検証計画

### 動作テスト
1. **疎通テスト**
   - ComfyUI サーバーが起動していない場合に、エラーメッセージ「ComfyUI サーバーが起動していないか、接続できません。」が表示されることを確認します。
2. **背景除去テスト**
   - ComfyUI を起動した状態で生成された画像を選択し、「背景除去 (ComfyUI)」を実行して、透過されたスプライト画像がプレビューに反映され、問題なくインポートできることを確認します。
