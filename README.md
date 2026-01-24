# Desktop AI Mascot

デスクトップ上に常駐するAIマスコットアプリケーションです。C#とWPFで構築されており、ローカルLLM（LM Studio）や音声合成サービス（Style-Bert-VITS2）と連携して、キャラクターとの対話を楽しむことができます。

## 主な機能

- **デスクトップマスコット表示**: デスクトップ上にアニメーション可能なマスコットを表示
- **AI対話機能**: LM Studioと連携したチャット機能（LINE風の吹き出し表示）
- **音声合成**: Style-Bert-VITS2との連携による音声出力
- **マスコット管理**: 複数のマスコット画像の管理とアニメーション再生
- **ドラッグ移動**: マスコットをドラッグして自由に配置可能
- **位置記憶**: 前回の位置を記憶し、次回起動時に同じ位置に表示
- **システムトレイ常駐**: システムトレイから表示/非表示や終了が可能
- **設定画面**: API設定やマスコット設定をGUIで変更可能

## 動作要件

- **OS**: Windows 11
- **.NET**: .NET 8.0以降
- **外部サービス**（任意）:
  - チャット
      - LM Studio
      - Foundry Local
  - Text-To-Speach(TTS)（音声合成）
      - Style-Bert-VITS2（音声合成を使用する場合）

## インストールと実行

### 前提条件

1. [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) をインストール
2. （任意）LLMの用意
    - [LM Studio](https://lmstudio.ai/) をインストールしてローカルでLLMを実行
    - [Foundry Local](https://learn.microsoft.com/ja-jp/azure/ai-foundry/foundry-local/get-started?view=foundry-classic) をインストールし、サービス開始
        - [10分あればFoundry LocalをインストールしてローカルLLMで遊べるようになります](https://qiita.com/yoshiwatanabe/items/0b016c75541483fd7f17)
        - [Foundry Localをさわってみた](https://zenn.dev/headwaters/articles/546f40c1adbd15)
3. （任意）TTSの用意
    - [Style-Bert-VITS2](https://github.com/litagin02/Style-Bert-VITS2) をインストールして音声合成サーバーを実行

＊画像生成、動画生成などは未実装です。今後のバージョンで対応予定です。
＊キャラクター追加用のコンフィグや画像生成は今後のバージョンで対応予定です。


## 使い方

### 初回起動

1. アプリケーションを起動すると、デスクトップにマスコットが表示されます
2. システムトレイにアイコンが表示されます
3. マスコットをクリックすると対話パネルが開きます

### マスコットの操作

- **ドラッグ**: マスコットをドラッグして移動
- **クリック**: 対話パネルの表示/非表示を切り替え
- **システムトレイアイコン右クリック**: 
  - 表示/非表示の切り替え
  - 設定画面を開く
  - アプリケーションの終了

### チャット機能の使用

1. LM Studioを起動し、モデルをロード
2. LM Studioのローカルサーバーを起動（デフォルト: http://127.0.0.1:1234）
3. マスコットをクリックして対話パネルを開く
4. テキスト入力欄にメッセージを入力
5. `Shift + Enter` で送信（またはEnterキー）

### 設定画面

システムトレイアイコンから「設定」を選択すると、以下の設定が可能です：

#### APIキー設定
- 各種AIサービスのAPIキーを設定
- **セキュリティ**: APIキーはWindows Data Protection API (DPAPI)により暗号化されて保存されます
  - ユーザーアカウント固有の暗号化により、他のユーザーや別のPCでは復号化できません
  - 設定ファイルには暗号化されたBase64文字列として保存されます

#### チャットAI設定
- **エンドポイント**: LM StudioのAPIエンドポイント（デフォルト: http://127.0.0.1:1234）
- **モデル選択**: 利用可能なモデルの一覧から選択
- **最大履歴数**: 会話履歴の保持数
- **システムプロンプト**: AIの振る舞いを定義

#### 画像AI設定
- 画像生成AIサービスの設定

#### マスコット設定
- マスコット画像の追加/削除
- アニメーション設定
- サイズや表示設定

### マスコット画像のカスタマイズ

1. PNG または WebP 形式の画像を用意（透過背景推奨）
2. 推奨サイズ: 1024x768 ピクセル
3. 設定画面の「マスコット設定」から画像を追加
4. アニメーションの設定を行う（任意）

### ビルドと実行方法

#### Visual Studioを使用する場合

1. `DesktopAiMascot.sln` をVisual Studio 2026で開く
2. NuGetパッケージの復元（自動で実行されます）
3. F5キーまたは実行ボタンでデバッグ実行

#### VS Codeを使用する場合

1. VS Codeでプロジェクトフォルダを開く
2. C# Dev Kit拡張機能をインストール
3. F5キーでデバッグ実行

#### コマンドラインから実行する場合

```bash
# プロジェクトのビルド
dotnet build

# 実行
dotnet run

# リリースビルド
dotnet build -c Release

# 実行ファイルの生成
dotnet publish -c Release -r win-x64 --self-contained
```


## 配布フォルダ構成

アプリケーションの配布時（またはビルド後）のフォルダ構成：

```
DesktopAiMascot/
├── DesktopAiMascot.exe           # 実行ファイル
├── mascots/                       # マスコット設定（ユーザー編集可能）
│   ├── default/
│   │   ├── config.yaml           # マスコット設定ファイル
│   │   └── mascot1.png           # マスコット画像
│   └── ...
├── system_config.yaml             # システム設定ファイル
└── (その他のDLLファイルなど)
```

### フォルダの役割

- **`mascots/`**: ユーザーがマスコットを追加・編集できるフォルダ
  - 新しいマスコットを追加する場合は、このフォルダ内に新しいサブフォルダを作成してください
- **`system_config.yaml`**: アプリケーションの設定ファイル
  - APIキー（暗号化）、ウィンドウ位置などのユーザー設定が保存されます
  - APIキーはDPAPIにより暗号化されているため、同じユーザーアカウント以外では復号化できません

### アンインストール

フォルダごと削除するだけでアンインストールが完了します。レジストリなどには何も書き込まれません。

## プロジェクト構成

```
DesktopAiMascot/
├── MascotWindow.xaml(.cs)        # メインウィンドウ
├── controls/                      # カスタムコントロール
│   ├── MascotControl.xaml(.cs)   # マスコット表示コントロール
│   ├── MessageListPanel.xaml(.cs) # メッセージ一覧パネル
│   └── ChatMessage.cs            # チャットメッセージクラス
├── wpf/
│   └── InteractionPanel.xaml(.cs) # 対話パネル
├── views/                         # 設定画面
│   ├── SettingsDialog.xaml(.cs)  # 設定ダイアログ
│   ├── SettingsForm.xaml(.cs)    # 設定フォーム
│   ├── ApiKeyPropertyPage.xaml   # APIキー設定
│   ├── ChatAiPropertyPage.xaml   # チャットAI設定
│   ├── ImageAiPropertyPage.xaml  # 画像AI設定
│   └── MascotPropertyPage.xaml   # マスコット設定
├── aiservice/                     # AIサービス
│   ├── ChatAiService.cs          # チャットサービスインターフェース
│   ├── LmStudioChatService.cs    # LM Studio実装
│   └── voice/
│       ├── AiVoiceService.cs     # 音声サービスインターフェース
│       └── StyleBertVits2Service.cs # Style-Bert-VITS2実装
├── mascots/                       # マスコット関連
│   ├── Mascot.cs                 # マスコットクラス
│   ├── MascotAnimationManager.cs # アニメーション管理
│   └── MascotConfigIO.cs         # 設定の読み書き
└── assets/                        # リソースファイル
    └── icons/                     # アイコン画像
```

## 技術仕様

- **フレームワーク**: .NET 8.0 (WPF)
- **UI**: XAML
- **設定保存**: YAML形式（実行ファイルと同じディレクトリ）
- **APIキー保存**: Windows DPAPI暗号化
- **画像形式**: PNG（透過対応）

## トラブルシューティング

### チャット機能が動作しない

- LM Studioが起動しているか確認
- LM Studioでモデルがロードされているか確認
- エンドポイント設定が正しいか確認（デフォルト: http://127.0.0.1:1234）

### マスコットが表示されない

- 画像ファイルが正しく配置されているか確認
- 設定画面でマスコットが登録されているか確認
- ウィンドウが画面外に移動していないか確認（設定ファイルの削除で初期位置に戻ります）

### 設定ファイルの場所

設定ファイルは以下の場所に保存されます：
```
%APPDATA%\DesktopAiMascot\
```

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

### サードパーティライブラリ

このプロジェクトは以下のサードパーティライブラリを使用しています：

- **Google.GenAI** (Apache License 2.0)
- **Google.Protobuf** (BSD 3-Clause)
- **Magick.NET** (Apache License 2.0)
- **Microsoft.Extensions.AI** (MIT License)
- **Newtonsoft.Json** (MIT License)
- **OpenAI** (MIT License)
- **YamlDotNet** (MIT License)

詳細なライセンス情報は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を参照してください。

