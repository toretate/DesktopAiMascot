# C# (Godot) から TypeScript (Electron/Vue3) へのコード変換ガイドライン

C# + Godot で実装された既存ロジックを、TypeScript + Electron + Vue3 環境へスムーズに移植・変換するための設計およびコーディングガイドラインです。

---

## 1. 基本フォーマットルール

プロジェクトの共通ルールに従い、新規に記述する TypeScript および Vue コードは以下のフォーマットに統一します。

- **文字コード**: UTF-8
- **改行コード**: CRLF (`\r\n`)
- **インデント**: 半角スペース 4つ
- **コメント**: ソースコード内の各種ドキュメンテーションコメント、および説明コメントはすべて**日本語**で記述します。

---

## 2. 言語要素の置き換え方針

| C# (Godot) 要素 | TypeScript (Vue3) 移行先 | 移行のアプローチ |
| :--- | :--- | :--- |
| `System.IO` (ファイル操作) | Node.js `fs` / `fs/promises` | メインプロセス（`electron/main.ts`）にファイルI/O処理を集約し、プリロードを介してセキュアに呼び出します。 |
| `SystemConfig.cs` (設定) | `electron-store` (JSON) | 設定データの読み書きは JSON ファイル（`config.json`）ベースに置き換え、Vueからは Pinia/ストア経由で透過的に操作します。 |
| `Godot.Signal` (イベント) | Vue `defineEmits` / IPC | コンポーネント間は Vue 3 の標準的な `emit` を使用し、メインプロセスとレンダープロセス間は `ipcRenderer.send/on` で通信します。 |
| `AnimatedSprite2D` (アニメ) | PixiJS / WebGL Canvas | Canvas / WebGL を使用し、瞬きや呼吸といったアニメーションループ処理を Vue コンポーネント（`MascotViewer`）内で直接実装します。 |
| `GD.Print` / `GD.PrintErr` | `console.log` / `console.warn` | Web標準のコンソール出力を使用します。エラー発生時はスタックトラースを出さず、シンプルな文言でログを出力します。 |

---

## 3. API通信およびエラーハンドリングの移植ルール

グローバルルールに則り、LLM APIや音声合成API（VOICEVOX等）との通信部を移植する際は以下のハンドリングを行います。

1. **例外処理の記述**:
   - ネットワークエラー（`HttpRequestException` 相当）とタイムアウト（`TaskCanceledException` 相当）はそれぞれ個別の catch ブロックに分け、明確に分類してログ出力を行います。
2. **スタックトレースの隠蔽**:
   - サーバー接続不可などのエラー時、ユーザーにエラーを表示する際はスタックトレースを出力せず、`「${AIサービス名}との接続エラー」` のような簡潔で分かりやすいメッセージのみを出力します。
3. **Node.jsとブラウザの切り分け**:
   - クロスプラットフォーム（ブラウザ単体動作）も見据え、APIキーが必要な通信は極力ブラウザ側（Client-side fetch）でも動作するよう抽象化インターフェースを作成して実装します。
