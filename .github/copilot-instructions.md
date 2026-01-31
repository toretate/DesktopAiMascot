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

- [x] UIコンポーネントは cs, resx, Designer.cs に分割する (Windows Forms の場合)
	<!-- Windows Forms の UI コンポーネントは、cs, resx, designer.cs に分割してください。 -->

- [x] 仕様書は docs ディレクトリに保存する
	<!-- 仕様書や設計書などのドキュメントは、プロジェクトルートの docs ディレクトリに保存してください。 -->

- [x] テストコードの作成を積極的に行う
	<!-- 可能な限り、ユニットテストや統合テストなどのテストコードを作成してください。 -->

- [x] 仕様書や設計書を最新の状態に保つ
	<!-- 仕様書や設計書などのドキュメントは、常に最新の状態に保ってください。 -->

- [x] 外部通信を行うときはログを残す
	<!-- 外部APIとの通信やネットワーク通信を行う場合は、通信内容のログを適切に残してください。 -->

- [x] 改行コードはCRLFに統一する
	<!-- プロジェクト内のすべてのファイルの改行コードは、CRLF（Windowsスタイル）に統一してください。 -->

- [x] インデントはスペース4つに統一する
- [x] 文字コードはUTF-8に統一する
- [x] テストコードのメソッド名はテスト対象のメソッド名と、テスト内容を日本語で記述する
- [x] マスコット固有の設定値は各マスコットの config.yaml に保存する。カバー画像やアニメーション設定、音声設定など。
- [x] アプリケーションの設定値(ウィンドウ位置、現在の選択マスコットなど)は SystemConfig を使用して管理する
