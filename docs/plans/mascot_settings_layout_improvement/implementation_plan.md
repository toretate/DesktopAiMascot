# マスコット設定画面のレイアウト改良実装計画

マスコット設定画面（マスコット編集画面）のレイアウトをユーザーからご提示いただいた改良案の画像に基づき、デザインガイドラインに沿ってモダンかつプレミアムなビジュアルに改修します。

---

## ユーザーレビューが必要な項目

> [!IMPORTANT]
> - フッターボタンのテキスト変更: 画像の通り「保存」→「Save」、「キャンセル」→「Cancel」に変更します。
> - タブ名称の英語化: 「角度」はそのままに、「背景削除」→「Bg Remove」、「画像追加」→「Add Image」、「表情差分作成」は日本語のまま、画像の通りに変更します。
> - レイアウトの左右分割化: 「角度」タブは、左側に3Dアングルの十字レイアウト、右側に「画像編集ツール設定」を配置する左右分割型のレスポンシブな構成に作り直します。

---

## オープンな質問

> [!NOTE]
> - UIコンポーネントのカラーパレット: モダンで清潔感のある白・グレー系のプレミアムカードデザインをベースとし、アクティブなドロップダウンやボタンには柔らかなブルーやグレーのアクセントカラーを適用します。

---

## 提案される変更

### マスコット編集ウィンドウ (MascotEditWindow)

#### [MODIFY] [MascotEditWindow.tscn](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/mascot_edit/MascotEditWindow.tscn)
- 左側のサイドバーにおける `CoverPanel` および `CoverTextureRect` を囲むパネルを、白を基調とした角丸のカード風デザイン（`StyleBoxFlat`）にします。
- `ImageList` の外観を角丸でモダンなスタイルに調整します。
- フッターの「保存」「キャンセル」ボタンのテキストを「Save」「Cancel」に変更し、プレミアムなフラットボタン（角丸、マウスホバー時の色の変化）にします。

#### [MODIFY] [MascotEditWindow.cs](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/mascot_edit/MascotEditWindow.cs)
- ボタンテキストやUIレイアウトの変更に伴うノード参照やハンドラの整合性を確認します。

---

### マスコット設定コントロール (MascotEditSettingControl)

#### [MODIFY] [MascotEditSettingControl.tscn](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/mascot_edit/MascotEditSettingControl.tscn)
- 名前入力欄（`DisplayNameLineEdit`）のサイズやマージンを調整し、見栄えを良くします。
- 「プロフィールなど」セクション:
    - 設定ファイルの「エディタ起動」ボタンのテキストを「Editor」に変更し、コンパクトに右側に配置します。
    - 「ファイルからプロフィールを生成」セクション: LineEdit、生成ボタン（ペンのような文字またはアイコン）、ドロップダウンを美しく横並びに配置します。
- プロファイル情報セクション:
    - ラベルを「プロファイル情報」に変更します。
    - `ProfileTextEdit`（YAMLエディタ）の枠線や背景をモダンで目に優しいダーク/ライトブレンドのスタイルにします。
- `TabContainer` のタブ名を以下のように変更します:
    - `角度` -> `角度`
    - `背景削除` -> `Bg Remove`
    - `画像追加` -> `Add Image`
    - `表情差分作成` -> `表情差分作成`

#### [MODIFY] [MascotEditSettingControl.cs](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/mascot_edit/MascotEditSettingControl.cs)
- ボタンやコントロールの名称・文言変更に合わせて、C#コード内のイベントハンドラやノード取得パスを調整します。

---

### 角度画像表示コントロール (AngleViewControl)

#### [MODIFY] [AngleViewControl.tscn](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/mascot_edit/AngleViewControl.tscn)
- 画面を `HBoxContainer` で左右に分割します。
- **左側（3Dアングル配置）**:
    - `GridContainer` を使用し、各アングル（TOP, LEFT, FRONT (中央), RIGHT, BEHIND, BOTTOM）を綺麗に十字配置します。
    - 各画像コンテナ（フロント以外）は、白の角丸カード（`StyleBoxFlat`）スタイルとし、綺麗な影（Shadow）を落とします。
    - 各画像の横や下に、おしゃれな細字フォントで「TOP」「LEFT」「RIGHT」「BEHIND」「BOTTOM」のラベルを適切に配置します。
- **右側（画像編集ツール設定）**:
    - 白い角丸カードの `PanelContainer` を配置します。
    - 「画像編集ツール設定」のタイトルラベルをボールドで配置し、その下に「選択中の画像生成モデル」ラベル、そしてドロップダウン（`ImageModelComboBox`）を縦に美しく配置します。
- 全体として絶対座標配置を廃止し、Godotのコンテナシステムをフル活用したレスポンシブなプレミアムレイアウトに置き換えます。

#### [MODIFY] [AngleViewControl.cs](file:///C:/workspace/workspace-win/DesktopAiMascot/ui/mascot_edit/AngleViewControl.cs)
- シーンファイルのノード構造変更（左右分割化）に伴い、ノード参照パス（`GetNode`）を更新します。
- C#コード内での挙動やシグナルハンドリングに影響がないことを保証します。

---

## 検証計画

### ユニットテスト
- `DesktopAiMascotTest` プロジェクトにビルドエラーや回帰がないことを確認するため、`dotnet build` および `dotnet test` を実行します。

### 手動確認
- 改修したUIが意図通り表示され、設定の編集、保存（Save）、キャンセル（Cancel）が正常に機能することを確認します。
- 「角度」タブでの画像クリックによる画像生成処理や、画像の読み込み表示が正しく動作することを確認します。
