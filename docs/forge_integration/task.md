# タスクリスト (メニュー拡張＆チャット入力統合版)

- [x] `app/src/config/config-data.ts` および `store/config.ts` に設定項目 (`forgeSteps`, `forgeCfgScale`, `forgeWidth`, `forgeHeight`) を追加
- [x] `app/src/connector/forge-connector.ts` の拡張 (i2i 対応: `/sdapi/v1/img2img` 呼び出しロジック of 追加)
- [x] `app/src/connector/__tests__/forge-connector.test.ts` に i2i テストを追加して Vitest 実行
- [x] `app/electron/main.ts` の `forge:generate` IPC ハンドラの更新（t2i / i2i 振り分け対応）
- [x] `ForgeImageGeneratorDialog.vue` の改修 (画像生成パラメータの設定ダイアログ化)
- [x] `ChatPanel.vue` の改修
    - [x] クリップ添付メニューの4項目化
    - [x] t2i / i2i モード状態管理の実装
    - [x] チャット入力欄でのプロンプト受付＆送信時の画像生成ロジックの実装
- [x] モデル一覧・LoRA一覧のドロップダウン連携
    - [x] `ImageGenSettingsPanel.vue` で取得したモデル・LoRA一覧を `configStore` に保存・反映
    - [x] `ImageGenSettingsPanel.vue` および `ForgeImageGeneratorDialog.vue` の入力欄を `<datalist>` で候補選択可能に改修
- [x] 動作確認と `walkthrough.md` の更新
