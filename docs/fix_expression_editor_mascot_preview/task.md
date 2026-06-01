# 表情エディタのマスコットプレビュー不具合修正 タスクリスト

- [x] `SettingsWindow.vue` への `MascotImageSetBuilder` インポート追加
- [x] `SettingsWindow.vue` への `editingMascotImageSet` および `defaultFrontAvatar` computed プロパティの追加
- [x] `SettingsWindow.vue` 表情編集モーダルプレビュー部のテンプレート修正
- [x] `SettingsWindow.vue` への立ち絵（全身像）追加・削除・設定用関数の実装
- [x] `SettingsWindow.vue` 内 `selectMascot` のアクティブ立ち絵解決ロジック修正
- [x] `SettingsWindow.vue` マスコット詳細設定サブタブへの「立ち絵（全身像）」管理UIの実装
- [x] `MascotViewer.vue` に `onConfigUpdated` による設定変更購読を追加
- [x] `SettingsWindow.vue` 内での `splice` によるリアクティブ同期の確実化、および手動保存時の同期強制の実装
- [x] `SettingsWindow.vue` 内の `activeOutfit` と `activePose` を computed に変更し、手動代入を撤廃して同期を完全自動化
- [x] `SettingsWindow.vue` の `<style scoped>` に絶対配置用アセットプレビュースタイルを追加
- [x] 表情エディタ背景プレビューにおける画像アセット（data:image/）優先解決ロジックの実装
- [x] 全身像（立ち絵）がプレビューエリアの中央に完璧に収まるようにCSS絶対配置スタイル（top: 0; left: 0; max-width/max-height: 100%）を追加・調整
- [x] 表情パーツ（表情レイヤー）が立ち絵全身像の手前（前面）に正しく重ね合わされるように、z-index: 10をCSSスタイル（preview-layer-imgおよびpreview-layer）に追加
- [x] アプリケーションの動作確認（表情エディタでの全身像立ち絵プレビュー、位置調整機能の完全な動作確認）
