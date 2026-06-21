# 実装計画: Nuxtプロジェクトへの移行とElectron統合

## 1. 全体アプローチ
既存の `server` プロジェクトを廃止し、`ui` プロジェクトをベースに Nuxt 3 化を行い、バックエンド機能を Nitro サーバーに統合します。
また、開発・本番ともに Electron から Nitro サーバーへの通信を行い、完全な Server/Client モデルにします。

## 2. 移行ステップ
1. **パッケージ構成と依存関係の整理**:
   - `ui` の `package.json` で Nuxt 3 を導入（Nuxt 3.15.0 にピン留め）。
   - バックエンドで使用していた AI API、WS、画像処理ライブラリなどを統合。
2. **バックエンド API ルートの移植**:
   - Express のミドルウェアやコントローラを、Nitro サーバー用のイベントハンドラー形式（`defineEventHandler`）に変換。
   - `ui/src/server/api/` 以下に移植（例: 背景除去、顔認証、設定保存など）。
   - WebSocket 接続用に `defineWebSocketHandler` を用いて `ui/src/server/routes/ws.ts` を作成。
3. **パス解決の修正**:
   - アプリケーションの実行環境（Dev / Production / ASAR）に合わせて、プロジェクトルートやマスコットリソースの絶対パスを動的に解決する `paths.ts` を実装。
4. **Electron メインプロセスの修正**:
   - 本番ビルド時に、自動的に Nitro サーバー（`.output/server/index.mjs`）をバックグラウンドでスポーンする機能を追加。
   - 空きポートを自動検出し、環境変数 `PORT` を介して Nitro サーバーに引き渡す。
   - すべての Electron ウィンドウの URL ロードを、Vite の dev URL もしくは Nitro サーバーのローカル URL に統一。
5. **CJS/ESM 問題への対策**:
   - `package.json` が `"type": "module"` であるのに対し、Electron のメインプロセスやプリロードスクリプトは CommonJS (`.cjs`) として出力されるよう、`tsup.config.ts` で出力拡張子を `.cjs` に制御。
   - `tsup.config.ts` 内で `electron` や dependencies パッケージを external にマークし、バンドルエラーを防止。

## 3. テスト・検証項目
- 開発サーバー（`npm run dev:electron`）で正常に Electron と Nuxt 開発環境が連動すること。
- 本番ビルド（`npm run build`）を行い、バイナリ起動時に Nitro サーバープロセスが自動で起動・終了すること。
- チャット、音声合成、WebSocket 切断検知が正常に動作すること。
