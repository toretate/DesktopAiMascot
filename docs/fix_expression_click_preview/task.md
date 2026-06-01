# 表情クリック時のプレビュー機能実装 タスクリスト

- [x] 表情スロットのクリックイベントハンドラーを `@click="selectExpressionForPreview(expr)"` に変更し、大画面エディタの遷移を抑止
- [x] 左側リストアバター（高さ200px）向けの表情スケール補正プロパティ `computedListPreviewExpressionStyle` の定義
- [x] プレビュー切り替えおよび Electron API を介したデスクトップマスコットへのリアルタイム同期通知の実装
- [x] 左側アバター表示コンテナ (`avatar-container`) に対し、表情画像を絶対配置で重ね合わせる Vue テンプレートの追加
- [x] ビルド検証 (`cmd /c npm run build`) を行い、エラーなしで正常終了することを確認
