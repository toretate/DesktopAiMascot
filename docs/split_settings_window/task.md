# タスクリスト: 設定画面のコンポーネント分割 & 表情エディタの白基調（ライトモード）化

- [x] **フェーズ 1: 新規子コンポーネントの作成と実装**
    - [x] `ImageCropModal.vue` の新規作成とライトテーマ移植
    - [x] `EmotionAssignmentModal.vue` の新規作成とライトテーマ移植
    - [x] `ExpressionEditorModal.vue` の新規作成とライトテーマ移植
    - [x] `MascotSettings.vue` の新規作成（上記モーダルのホスト化）
- [x] **フェーズ 2: 親コンポーネント `SettingsWindow.vue` のスリム化と連携**
    - [x] `SettingsWindow.vue` の余分なコード削除
    - [x] `MascotSettings` コンポーネントの統合・インポートとプロップス連携
- [x] **フェーズ 3: 動作検証と微調整**
    - [x] `npm run build` によるビルドチェック (TypeScript型チェック含む完璧なビルド成功)
    - [x] 表情エディタを開き、白基調のデザイン・スクロール・調整機能のテスト
    - [x] クロップ機能、AI感情割り当て、マスコットプロファイルの保存テスト
