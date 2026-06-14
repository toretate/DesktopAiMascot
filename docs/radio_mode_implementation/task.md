# タスクリスト：ラジオモードの実装

- [x] Pinia ストアへの状態追加 (`mascot.ts`)
  - [x] `isRadioMode` ref (デフォルト `false`) を追加
  - [x] `setRadioMode` アクションを追加
- [x] UIへの切り替えアイコン追加とデザイン調整 (`ChatPanel.vue`)
  - [x] `useMascotStore` から `isRadioMode` を取得
  - [x] ヘッダーのアクションエリアに `pi-microphone` ボタンを追加
  - [x] ラジオモードON時のアクティブスタイル（カラー、アニメーション等）を追加
- [x] チャットメッセージの送信制御と指示検出 (`useChatConnection.ts`)
  - [x] `sendMessage` の中で `userQuery` を判定して `mascotStore.setRadioMode` を自動トグルするロジックを実装
  - [x] ラジオモードONの際に `systemPrompt` にラジオパーソナリティ用のプロンプトを動的注入するロジックを実装
- [x] 動作確認・動作検証
  - [x] アイコンクリックによるトグル動作の確認（実装ベースの静的検証）
  - [x] 「ラジオモードを開始して」「ラジオモードを終了して」による自動オン・オフ切り替えの確認（実装ベースの静的検証）
  - [x] ラジオモードON時のマスコットの発言（DJ風）の確認（実装ベースの静的検証）
