# タスクリスト

- [x] ドキュメントの整備と計画合意
    - [x] 実装計画（implementation_plan.md）の作成・保存
    - [x] タスクリスト（task.md）の作成・保存
- [x] MascotEditWindow のレイアウト改修
    - [x] `MascotEditWindow.tscn` の編集（フッターボタンを Save/Cancel に変更、CoverPanelのデザイン洗練、ImageListの角丸化）
    - [x] `MascotEditWindow.cs` の編集（ボタン文言変更に伴う修正の確認）
- [x] MascotEditSettingControl のレイアウト改修
    - [x] `MascotEditSettingControl.tscn` の編集（各ボタン・ドロップダウンの整理、「Editor」への名称変更、タブ名の変更 `角度`/`Bg Remove`/`Add Image`/`表情差分作成`）
    - [x] `MascotEditSettingControl.cs` の編集（コントロール取得パスやイベントハンドラ設定の整合性の確保）
- [x] AngleViewControl のレイアウト・デザイン改修
    - [x] `AngleViewControl.tscn` の編集（HBoxContainer による左右分割化、左エリアの十字型アングル配置とカード化、右エリアの画像編集ツール設定カード化）
    - [x] `AngleViewControl.cs` の編集（ノード取得パスの更新、モデルドロップダウン動作の確認）
- [x] 動作確認と検証
    - [x] プロジェクトのビルドチェック（ファイルロック問題の解消およびビルド成功の確認）
    - [x] ユニットテストの実行と整合性確認（Godot依存外の62件のユニットテストがすべて正常合格することを確認）
    - [x] 修正内容の確認（walkthrough.md）の作成・保存
