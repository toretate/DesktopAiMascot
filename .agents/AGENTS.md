
<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
	<!-- Project: C# desktop mascot using Windows Forms -->

- [x] Scaffold the Project
	<!-- Created .csproj, Program.cs, MascotForm.cs -->

- [x] Customize the Project
	<!-- Added basic mascot functionality with animation and tray icon -->

- [x] Install Required Extensions
	<!-- No extensions needed -->

- [x] Compile the Project
	<!-- Built successfully with dotnet build -->

- [x] Create and Run Task
	<!-- Not needed -->

- [x] Launch the Project
	<!-- Ran with dotnet run -->

- [x] Ensure Documentation is Complete
	<!-- README.md created -->

- [x] コメントは日本語で記述
	<!-- プロジェクト内のソースコードおよびドキュメントのコメントは日本語で記述してください。 -->

- [x] １ファイルに機能を詰め込まない
	<!-- 可能な限り、機能ごとにファイルを分割してください。 -->

- [x] 仕様書は docs/specs ディレクトリに保存する
	<!-- 仕様書や設計書などのドキュメントは、プロジェクトルートの docs/specs ディレクトリに保存してください。 -->

- [x] `docs/plans`は .gitignore に追加しておくこと 
- [x] 進捗管理や作業計画は docs/plans/ ディレクトリ以下にフォルダを作成し、保存する
  - 実装計画 (implementation_plan.md)  
  - 修正内容の確認 (walkthrough.md)  
  - タスクリスト (task.md)
- [x] 進捗管理や作業計画の内容から、仕様書に転載すべきものは仕様書に転載してください。
- [x] ユーザーからの指示の内、仕様書に転載すべきものは仕様書に転載してください。
- [x] 進捗管理や作業計画が不要になったら、その作業の docs/plans 以下のディレクトリは削除してください。

- [x] テストコードの作成を積極的に行う
	<!-- 可能な限り、ユニットテストや統合テストなどのテストコードを作成してください。 -->

- [x] 仕様書や設計書を最新の状態に保つ
	<!-- 仕様書や設計書などのドキュメントは、常に最新の状態に保ってください。 -->

- [x] 外部通信を行うときはログを残す
<!-- 外部APIとの通信やネットワーク通信を行う場合は、通信内容のログを適切に残してください。 -->
<!-- サーバー応答がなかった場合、スタックトレースは出力せず、「${AIサービス}との接続エラー」のようなシンプルなメッセージをDebug.WriteLineで出力してください。 -->
<!-- HttpRequestException と TaskCanceledException を分けてキャッチし、それぞれ適切なメッセージを出力してください。 -->

- [x] 改行コードはCRLFに統一する
	<!-- プロジェクト内のすべてのファイルの改行コードは、CRLF（Windowsスタイル）に統一してください。 -->

- [x] インデントはスペース4つに統一する
- [x] 文字コードはUTF-8に統一する
- [x] テストコードのメソッド名はテスト対象のメソッド名と、テスト内容を日本語で記述する
- [x] マスコット固有の設定値は各マスコットの config.yaml に保存する。カバー画像やアニメーション設定、音声設定など。

# Comfy Workflow
- [x] Comfy Workflow の ID 指定のセパレータ文字は":"です。例1) "10" 例2) "29:40" 

- [x] Vue 3からElectronのIPCでオブジェクトや配列を送信する際は、必ずプレーンオブジェクトにシリアライズしてから送信する
	<!-- Vue 3の `ref` や `reactive` が持つ `Proxy` オブジェクトを直接 `window.electronAPI` 経由で送信すると、Electronの構造化複製（Structured Clone）の制限によりデータが欠落または空のオブジェクトになるバグが発生します。そのため、送信するオブジェクトや配列に対して `JSON.parse(JSON.stringify(data))` や `toRaw` を適用し、確実にプレーンなJavaScriptオブジェクトにシリアライズした上で送信してください。 -->

# プログラム定義
デスクトップマスコットを表示して、ユーザーと対話するプログラムを作成します。このプログラムは、以下の機能を持ちます。

* デスクトップ上にマスコットキャラクターを表示する。
	* 画像サイズは 1024x768 ピクセル
	* 画像フォーマットは PNG または WebP。透過背景をサポートする。
* マスコットキャラクターは、ユーザーのマウスクリックやキーボード入力に反応する。
* マスコットをドラッグして移動できる。
	* 前回の位置を記憶し、次回起動時に同じ位置に表示する。
* システムトレイに常駐し、右クリックメニューから表示/非表示や終了ができる。

# 仕様書

* デザインガイドラインは docs/DESIGN_GUIDELINES.md に記載します
* アプリケーションの全体的な仕様は docs/specs/Application.spec.md に記載します
* マスコット編集画面の仕様は docs/specs/マスコット編集画面仕様書.md に記載します
* マスコット編集画面のレイアウト仕様は docs/specs/マスコット編集画面レイアウト仕様書.md に記載します
* Chat AI 設定画面の仕様は docs/specs/ChatAIConfigWindow.spec.md に記載します
* 音声 AI 設定画面の仕様は docs/specs/VoiceAIConfigWindow.spec.md に記載します
* 画像生成 AI 設定画面の仕様は docs/specs/ImageGenAIConfigWindow.spec.md に記載します
* 動画生成 AI 設定画面の仕様は docs/specs/VideoGenAIConfigWindow.spec.md に記載します
* API KEY 設定画面の仕様は docs/specs/ApiKeyConfigWindow.spec.md に記載します
* ウィジェット関連の仕様は docs/specs/widgets/ 以下に記載します
* タスク管理の仕様は docs/specs/widgets/task-management 以下に記載します

- [x] コミット・プッシュのタイミング制御
	<!-- 変更や実装の後、自動で git commit や git push を行わないでください。必ずユーザーから「コミットして」などの明示的な指示があったタイミングでのみ、ステージング、コミット、およびプッシュを実行してください。 -->

- [x] master ブランチでの直接編集制限
	<!-- master ブランチに滞在しているときに何らかのファイル変更を伴う作業を行う場合は、必ず新しく作業用ブランチを作成（チェックアウト）してから作業を開始してください。master ブランチでの直接のコード変更は避けてください。 -->