# タスクリスト (Task List) - 画像トリミング復元機能の実装

- [x] `MascotAsset` インターフェースの拡張
    - [x] [MascotSettings.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/MascotSettings.vue) 内の `MascotAsset` に `originalPath?: string;` を追加
    - [x] [ExpressionEditorModal.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/ExpressionEditorModal.vue) 内の `MascotAsset` に `originalPath?: string;` を追加
- [x] 表情編集モーダルからの新規クロップ対象スロット連携
    - [x] [ExpressionEditorModal.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/ExpressionEditorModal.vue) の `emit('crop-new')` に `selectedModalExpression` を渡すように変更
- [x] マスコット設定側のクロップ制御の修正
    - [x] [MascotSettings.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/MascotSettings.vue) の `handleCropNew` で引数 `slot` を受け取り、`selectedCropExpression` にセットするように変更
    - [x] `handleCropCurrent` で `slot.originalPath` があれば `cropImageSrc.value` に優先的にセットするように修正
    - [x] `handleCropDone` でクロップ保存時に `targetSlot.originalPath = cropImageSrc.value;` を保存するように修正
- [x] 表情スプライトの拡大率（Scale）の最大値制限と微調整コントロール追加
    - [x] [ExpressionEditorModal.vue](file:///c:/workspace/workspace-win/DesktopAiMascot/src/components/settings/ExpressionEditorModal.vue) 内の `Slider` の `max` を `2.0` に変更
    - [x] 拡大率表示バッジ（紫色）の右側に 0.01 刻みで調整可能な `chevron-up`/`chevron-down` マイクロコントロールを追加
    - [x] 誤差を排した `adjustScale` 加減算ヘルパーメソッドをスクリプトに追加
- [x] 動作確認・ビルドテスト
    - [x] `npm run build` によるビルドエラーなしの確認
    - [x] 手動での表情トリミングリセット機能の検証
    - [x] 拡大率の上限および微調整山形コントロールの動作検証

