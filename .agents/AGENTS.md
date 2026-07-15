# AGENTS.md — ワークスペース共通のエージェント向け指示

# プログラム定義

デスクトップマスコットを表示して、ユーザーと対話するプログラム。

* デスクトップ上にマスコットキャラクターを表示する。
	* 画像サイズは 1024x768 ピクセル
	* 画像フォーマットは PNG または WebP。透過背景をサポートする。
* マスコットキャラクターは、ユーザーのマウスクリックやキーボード入力に反応する。
* マスコットをドラッグして移動できる。前回の位置を記憶し、次回起動時に同じ位置に表示する。
* システムトレイに常駐し、右クリックメニューから表示/非表示や終了ができる。

# Git 運用

* **コミット・プッシュはユーザーの明示的な指示があったときのみ**行う。変更や実装の後に自動で git commit / git push をしない。
* **master ブランチで直接編集しない**。ファイル変更を伴う作業は、必ず作業用ブランチを作成してから開始する。

# コーディング規約

* コメントは日本語で記述する（ソースコード・ドキュメントとも）。
* 1ファイルに機能を詰め込まず、可能な限り機能ごとにファイルを分割する。
* 改行コードは CRLF、インデントはスペース4つ、文字コードは UTF-8 に統一する。

# テスト

* ユニットテスト・統合テストなどのテストコードを積極的に作成する。
* テストメソッド名は「テスト対象のメソッド名＋テスト内容（日本語）」で記述する。

# 開発・ビルド・検証

* 開発中は既存の Nuxt / Electron 開発プロセスを維持し、ソース変更の反映はできるだけ HMR に任せる。
* lint、型チェック、対象テストは開発サーバーとは別のプロセスで実行し、検証のために開発サーバーや Electron を停止・再起動しない。
* `npm run kill`、開発サーバーの再起動、Electron の再起動など、クライアントとの通信を切断する操作は、HMR で反映できない変更に限って行う。
* 通常の型チェックは、`app/` で次の分離済みコマンドを使用する。同じ対象へ `tsc` と `vue-tsc` を重複実行しない。
	* Vue / Nuxt: `npm run typecheck`
	* Electron: `npm run typecheck:electron`
	* 全体: `npm run typecheck:all`
* 型チェックは incremental cache（`app/node_modules/.cache/typescript/`）を利用する。通常の Vue 型チェックでは、HMR が利用する Nuxt の生成処理を起動せず、直接 `vue-tsc` を実行する。
* lint は `app/` で `npm run lint` を使用する。Biome の formatter は使用しない。
* `npm run build` は配布物や本番ビルドの確認が必要な場合に限って実行する。日常的な変更確認には HMR、lint、分離型チェック、対象テストを優先する。
* テストは変更箇所に近い対象テストから実行する。外部サービスや常駐クライアントを必要とする全体テストは、必要性と接続状態を確認してから実行する。

# ドキュメント

* 仕様書・設計書は `docs/specs/` に保存し、常に最新の状態に保つ。
* 進捗管理・作業計画は `docs/plans/` 以下に作業ごとのフォルダを作成して保存する（`docs/plans` は .gitignore 済み）。
	* 実装計画: implementation_plan.md
	* 修正内容の確認: walkthrough.md
	* タスクリスト: task.md
* 作業計画やユーザー指示のうち、仕様書に転載すべき内容は仕様書へ転載する。
* 不要になった作業の `docs/plans/` 以下のディレクトリは削除する。

## 仕様書の場所

* デザインガイドライン: `docs/DESIGN_GUIDELINES.md`
* アプリケーション全体仕様: `docs/specs/Application.spec.md`
* マスコット編集画面: `docs/specs/マスコット編集画面仕様書.md`
* マスコット編集画面レイアウト: `docs/specs/マスコット編集画面レイアウト仕様書.md`
* Chat AI 設定画面: `docs/specs/ChatAIConfigWindow.spec.md`
* 音声 AI 設定画面: `docs/specs/VoiceAIConfigWindow.spec.md`
* 画像生成 AI 設定画面: `docs/specs/ImageGenAIConfigWindow.spec.md`
* 動画生成 AI 設定画面: `docs/specs/VideoGenAIConfigWindow.spec.md`
* API KEY 設定画面: `docs/specs/ApiKeyConfigWindow.spec.md`
* ウィジェット関連: `docs/specs/widgets/` 以下
* タスク管理: `docs/specs/widgets/task-management/` 以下

# 実装ルール

* **外部通信のログ**: 外部 API・ネットワーク通信を行う場合は通信内容のログを適切に残す。
	* サーバー応答がない場合、スタックトレースは出力せず「${AIサービス}との接続エラー」のようなシンプルなメッセージを Debug.WriteLine で出力する。
	* HttpRequestException と TaskCanceledException を分けてキャッチし、それぞれ適切なメッセージを出力する。
* **Vue 3 → Electron IPC**: オブジェクトや配列を IPC で送信する際は、必ずプレーンオブジェクトにシリアライズしてから送信する。
	* `ref` / `reactive` の Proxy をそのまま `window.electronAPI` 経由で送ると、構造化複製の制限でデータが欠落・空になる。`JSON.parse(JSON.stringify(data))` か `toRaw` を適用してから送信すること。
* **マスコット固有の設定値**（カバー画像、アニメーション設定、音声設定など）は各マスコットの `config.yaml` に保存する。
* **Comfy Workflow** の ID 指定のセパレータ文字は `:`。例: `10`、`29:40`
