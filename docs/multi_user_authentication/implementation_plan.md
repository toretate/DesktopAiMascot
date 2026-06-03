# 将来的なマルチユーザー対応のための認証の仕組みの実装計画（IDaaS/Google認証統合案・改善版）

将来的に複数のユーザーが同一のサーバーを共有し、それぞれの設定やマスコットデータを安全に管理・利用（マルチユーザー対応）できるようにするため、外部 IDaaS（Google ログイン等）に認証を委ねる仕組みのプロトタイプを導入します。

## 設計のポイント

### 1. ユーザーを一意に識別するキー（KEY）について
外部 IDaaS（Google 認証等）でログインした場合、トークンに含まれる **`sub` クレーム (Subject)** をユーザーの一意なキー（`userId`）として使用します。
- **理由**: メールアドレスはユーザーによる変更や再利用のリスクがあるため、永続的で一意な `sub` を最終的なキーとします。

### 2. 管理フロー（管理者が sub を知る方法）
管理者が事前にユーザーの `sub` 値を知ることは困難であるため、**「管理者によるメールアドレスの事前登録 ＋ 初回ログイン時の `sub` 自動紐付け」** 方式を採用します。

1. **管理者の事前登録**:
   - 管理者はサーバー内部の設定ファイル（`users.json`）に、許可したいユーザーの `email` のみを登録します（`sub` は空欄、または未定義状態）。
2. **初回ログイン（アクティベーション）**:
   - ユーザーが Google で初回ログインした際、サーバーは Google が検証した ID トークンから `email` と `sub` を取得します。
   - `users.json` にその `email` が存在し、`sub` が空である場合、サーバーは自動的に `sub` 値を書き込んで紐付けを完了します。
3. **2回目以降のログイン**:
   - 紐付けられた `sub` 値を用いてユーザーを特定し、認証を行います。

- 設定ファイル初期状態 (`server/users.json`):
  ```json
  {
    "allowedUsers": [
      {
        "email": "new-user@gmail.com",
        "sub": "",
        "role": "user"
      }
    ]
  }
  ```

- 初回ログイン後の状態 (`server/users.json`):
  ```json
  {
    "allowedUsers": [
      {
        "email": "new-user@gmail.com",
        "sub": "107623348123456789012",
        "role": "user"
      }
    ]
  }
  ```

---

## 提案する変更内容

### サーバーサイド (server/src)

#### [NEW] [auth-service.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/services/auth-service.ts)
Google が発行した ID トークン（JWT）の署名検証、および有効期限管理を行うサービス。
Google の公開鍵（JWKS エンドポイントから取得）を使用して署名を検証し、検証済みのペイロード（`sub`, `email` 等）を返します。

#### [NEW] [auth-middleware.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/middlewares/auth-middleware.ts)
Express の認証ミドルウェア。リクエストの `Authorization: Bearer <Google_ID_Token>` を検証し、`users.json` を用いて以下の処理を行います。
- `sub` が一致するユーザーが存在すれば認証成功。
- `sub` は一致しないが、`email` が一致し、かつ `sub` が未紐付け（空）の場合、`sub` を自動保存して認証成功。
- いずれにも該当しない場合は `401 Unauthorized` を返します。

#### [NEW] [users.json](file:///c:/workspace/workspace-win/DesktopAiMascot/server/users.json)
許可されたユーザーリストを保持するサーバー内部の設定ファイル。

#### [MODIFY] [routes/config.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/routes/config.ts)
設定のロード（`/config`）およびセーブ（`/config`）のエンドポイントに、認証ミドルウェアを適用します。

#### [MODIFY] [routes/websocket.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/server/src/routes/websocket.ts)
WebSocket 接続時にクエリパラメータ、または接続直後の認証イベントメッセージから Google ID トークンを受け取り、検証してユーザーセッションと紐づけます。

## セキュリティ設計（攻撃耐性）

本システムに導入する Google 認証検証では、以下の各種攻撃に対して十分な対策を行います。

| 攻撃名 | 脅威の内容 | 対策 |
| :--- | :--- | :--- |
| **トークンの改ざん・偽造** | 攻撃者がトークン内のユーザーID等を書き換え、別人に成りすましてアクセスする。 | **Googleの非対称鍵（RS256）署名の厳密な検証**<br>Googleが公式に提供する公開鍵（JWKS）を利用してリクエストごとに署名を検証し、偽造されたトークンを完全に拒否します。 |
| **他アプリ用のトークンの使い回し** | 他のGoogleサインイン対応アプリで取得した正当なトークンを本システムに送りつけ、認証を突破する。 | **`aud` (Audience) クレームの検証**<br>IDトークンに含まれる `aud` が本システム用のGoogleクライアントIDと一致することを確認します。 |
| **トークンの盗聴・再利用（リプレイ）** | 通信経路上で盗み取った、または過去に使用されたトークンを使い回して不正アクセスする。 | **`exp` (有効期限) の検証と HTTPS**<br>有効期限（通常発行から1時間）を厳密にチェックし、期限切れトークンを拒否します。また本番環境では HTTPS（TLS）で通信経路を暗号化します。 |
| **メールアドレスの偽装** | メールアドレスの所有権が確認されていない偽のアカウントのトークンで初回紐付け（アクティベーション）を行う。 | **`email_verified` クレームの検証**<br>初回アクティベーション時に、Google側で所有権が確認済みであること（`email_verified: true`）を必須条件とします。 |
| **総当たり（Brute Force）攻撃** | パスワードを総当たりで突破したり、DBからパスワードが漏洩する。 | **パスワードレス（IDaaSへの認証委譲）**<br>サーバー内にパスワード情報を一切保管しないため、漏洩リスクがありません。また、Google側の最先端の多要素認証や不正ログイン検知がそのまま適用されます。 |

---

## 検証計画

### コンパイルチェック
- `server` フォルダで `npm run build` を実行し、TypeScriptのコンパイルが正常に通るかチェックします。

### 手動検証
1. 認証トークンが無い、または無効なトークンで `/api/config` を要求し、`401 Unauthorized` が返ることを確認します。
2. 設定ファイル（`users.json`）にテスト用メールアドレスを `sub` 空欄で記載します。
3. 有効な Google ID トークン（事前登録されたメールアドレスのもの）をヘッダーに設定して API を呼び出し、正常に応答が返るとともに `users.json` に `sub` が自動記録されることを確認します。
4. 記録完了後、2回目のリクエストも正常に通ることを確認します。

