# 修正内容の確認 (Walkthrough)

本修正では、コードの凝集度を高め、責務を適切に分離するため、ComfyUI サーバーとの低レベルな接続処理（画像のアップロード、WebSocket での進行確認、ワークフローのキュー登録および結果バイナリの受信）を **`server/src/connector/comfy-connector.ts`** にカプセル化しました。

## 変更内容

### 1. ComfyUI コネクタの新規作成 (`server/src/connector/comfy-connector.ts`)
- ComfyUI サーバーとの直接の接続・やり取りを担う以下の関数を実装しました。
  - `uploadImage(imageBuffer: Buffer, filename: string): Promise<string>`: 画像を ComfyUI の `/upload/image` API でアップロードする。
  - `runWorkflow(workflowJson: any): Promise<Buffer>`: 指定されたワークフローを ComfyUI に送信し、WebSocket を介して最終結果（バイナリPNG）を受信する。

### 2. 背景除去サービス (`server/src/services/remove-bg-service.ts`) の修正
- ComfyUI との接続詳細が `comfy-connector.ts` に隠蔽されたため、`remove-bg-service.ts` から WebSocket や crypto の直接インポートを削除しました。
- コネクタから `uploadImage` と `runWorkflow` をインポートし、ComfyUI を用いた背景除去ロジックを簡潔に呼び出す構造に整理しました。

---

## 動作確認手順

1. **アプリおよび API サーバーの再起動**  
   - 変更が正しく反映されるよう、API サーバーを再起動してください。
2. **背景除去の実行**  
   - 以前と同様に、アセットの「背景削除」モーダルから「Comfy UI」エンジンを選択して実行し、画像が ComfyUI にアップロードされ、背景が正常に透過された状態でプレビューに帰ってくることを確認してください。
