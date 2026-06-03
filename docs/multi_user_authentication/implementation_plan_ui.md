# 実装計画: 将来的なマルチユーザー対応のための認証の仕組み（BFF Cookie / UI対応編）

サーバー側の認証基盤プロトタイプの完了に伴い、セキュリティ要件（XSS対策）を強化した **BFF (Backend for Frontend) パターン**による **httpOnly Cookie 認証**を導入します。また、将来的な iOS/Android アプリ開発を見据え、**Authorizationヘッダー（Token）**によるアクセスも同時に受け入れ可能なハイブリッド設計とします。

## 設計のポイント

### 1. ハイブリッド認証ミドルウェア
Expressの認証ミドルウェアおよびWebSocket接続検証処理において、以下の順序で認証情報を探します。
1. `Authorization: Bearer <IDトークン>` ヘッダー（iOS/Androidなどのモバイルアプリ向け）
2. `session_token` Cookie（ElectronやWebブラウザなどのWeb技術ベースクライアント向け）

これにより、将来的にモバイルアプリを開発した際にもサーバー側のコードを変更することなく対応可能です。また、外部パッケージを増やさないよう、Cookieのパースは標準機能（手動パース）で行います。

### 2. Google OAuth2 フローのサーバー集約 (BFF)
Google ログイン処理自体をサーバー（Express）側に集約し、Electronはシステムの既定ブラウザでサーバーのエンドポイントを開くのみとします。
1. **ログイン開始**: Electronからブラウザで `http://localhost:3000/api/auth/login` を開く。
2. **認証処理**: サーバーが Google ログイン画面へリダイレクト。
3. **コールバック処理**: Google認証完了後、ブラウザが `http://localhost:3000/api/auth/callback` に遷移。
4. **Cookie設定**: サーバーが Google IDトークンから本システム用のJWT（`session_token`）を生成し、`Set-Cookie`（`HttpOnly`, `Secure`, `SameSite=Lax` ※開発時Lax、本番None）で返します。
5. **完了通知**: ログイン完了画面をブラウザに表示し、Electronにログイン完了を伝えます。

---

## 提案する変更内容

### サーバーサイド (server/src)

#### [NEW] [routes/auth.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/routes/auth.ts)
*   **`/api/auth/login`**: GoogleのOAuth2認可URLへリダイレクトするエンドポイント。
*   **`/api/auth/callback`**: Googleから戻ってきた `code`（認可コード）を受け取り、Google API からIDトークンを取得して検証します。成功時、`users.json` と照合し、独自の署名済みJWTを `session_token` Cookieとして設定（HttpOnly, Secure, SameSite）します。
*   **`/api/auth/status`**: 現在のCookieセッションの有効性を確認し、ログイン中のユーザー情報を返すエンドポイント。

#### [MODIFY] [middlewares/auth-middleware.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/middlewares/auth-middleware.ts)
*   `Authorization` ヘッダーまたは Cookie から `session_token` を抽出して検証するハイブリッド型に改修します。

#### [MODIFY] [routes/websocket.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/routes/websocket.ts)
*   接続時の `req.headers.cookie` から `session_token` を抽出し、WebSocketの接続時認証をCookieで行うようにします。

---

### クライアントサイド（Electron / Vite / Vue.js）

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/ui/electron/main.ts)
*   ログイン開始用のIPCハンドラ（`auth:login`）が呼ばれた際、`shell.openExternal("http://localhost:3000/api/auth/login")` でシステムのブラウザを開きます。

#### [NEW] `ui/src/stores/auth.ts` (Pinia Store)
*   BFF サーバーの `/api/auth/status` を呼び出してログイン状態を管理するストアを作成。

#### [MODIFY] API通信およびWebSocket通信ロジック
*   **API通信**: サーバーへのリクエスト（マスコット設定の保存等）に `credentials: 'include'` を付与します。
*   **WebSocket接続**: 接続時、自動的にCookieが送信されるため、特別なパラメータ付与は不要になります。

---

## 検証計画

### 1. 動作検証項目
1.  **ログイン開始**: UIの「ログイン」ボタンからブラウザでGoogleログイン画面が開き、完了画面が表示されること。
2.  **Cookieの自動送信**: ログイン完了後、フロントエンドからのAPIリクエストに `session_token` Cookieが自動で付与され、認証が成功すること。
3.  **WebSocket認証**: WebSocket接続開始時にCookie経由で自動的に接続が認証され、チャットができること。
4.  **ヘッダー認証の維持**: テストスクリプトから `Authorization` ヘッダーを用いてAPIを叩き、モバイルアプリ等を想定したヘッダー認証も引き続き正常に機能すること。

