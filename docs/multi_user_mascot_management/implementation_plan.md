# 実装計画：マルチユーザーマスコット管理

本ドキュメントは、デスクトップAIマスコットをマルチユーザー対応させ、将来的なマルチIDaaS（LINE、Facebook、メールアドレスなど）に対応できるようにするための設計と詳細な実装計画です。

## 1. 目的と設計コンセプト
外部認証プロバイダー（Google OAuthなど）のIDである `sub` を物理的なフォルダ名や内部データキーに直接使用すると、将来的に別の認証プロバイダーを追加した際や、同一ユーザーで複数の認証手段を紐付ける（アカウント連携）際に設計の破綻が生じます。
これを避けるため、システム内部に**「抽象化されたユーザー管理層」**を導入します。

- 外部プロバイダーのID（例: Googleの `sub`）は、内部で管理する「システム固有の内部ユーザーID（例: `usr_` プレフィックス付きのID）」にマッピングします。
- ファイルシステム、データベース、API、WebSocketなどのすべての内部処理では、この**「内部ユーザーID」**のみをキーとして使用します。

---

## 2. 影響範囲と変更対象ファイル
- `server/src/middlewares/auth-middleware.ts` (認証処理と内部ユーザーIDの引き当て・生成)
- `server/src/routes/config.ts` (設定ロード・セーブ、および画像アセットの保存処理)
- `server/src/routes/history.ts` (チャット履歴のロード・セーブ処理)
- `server/src/routes/websocket.ts` (音声合成結果のファイル保存処理)

---

## 3. 詳細設計と変更内容

### 3.1. ユーザー管理データ構造の拡張 (`server/users.json`)
従来の `allowedUsers` のフラットな構造から、システム固有のユーザー情報と、外部プロバイダー連携情報を分離した構造へと拡張します。

```json
{
    "users": [
        {
            "id": "usr_7a8b9c1d2e3f4a5b",
            "role": "user",
            "createdAt": "2026-06-21T11:30:00Z",
            "identities": [
                {
                    "provider": "google",
                    "providerUserId": "112233445566778899001",
                    "email": "test-user@gmail.com"
                }
            ]
        }
    ]
}
```

- `id`: システム独自のユーザーID。ファイル名やアセットディレクトリ名として使用。プレフィックス `usr_` とランダムな文字列（UUIDまたは短いハッシュなど）で構成。
- `identities`: 認証手段の配列。複数の認証プロバイダーを同一ユーザーIDに紐付けることを可能にします。

### 3.2. ユーザーデータの保存ディレクトリ設計
内部ユーザーID (`id`) を用いて、データおよびアセットの保存ディレクトリを隔離します。

- **ユーザー設定・チャット履歴**: 
  - `server/users/<internal_user_id>/config.json`
  - `server/users/<internal_user_id>/chat_history.json`
- **ユーザー個別マスコットアセット (画像・音声)**:
  - `mascots/users/<internal_user_id>/<mascot_id>/...`

> [!NOTE]
> ローカル環境でのテストや認証なし（バイパス）の場合は、固定の内部ユーザーID `usr_local_dev_bypass` を使用し、ローカルでの単一動作を担保します。

---

### 3.3. 各ファイルの具体的な変更内容

#### ① `server/src/middlewares/auth-middleware.ts` の変更
- `User` インターフェースを更新し、`id` (内部ID) を持つように定義します。
- `authenticateUserToken` 関数および `authMiddleware` 内での処理フロー：
    1. GoogleのIDトークンを検証し、`email` と `sub` (Googleのユーザー識別ID) を取得。
    2. `users.json` から `identities` の中に `provider: "google"` かつ `providerUserId: sub` を持つユーザーを検索。
    3. **存在する場合**: そのユーザーの内部ID (`id`) を取得。
    4. **存在しないが、メールアドレスが一致し、且つ `providerUserId` が未設定の仮登録ユーザーが存在する場合**: 新たに内部IDを生成（例: `usr_` + ランダム文字列）し、そのユーザー情報を `users.json` に反映。
    5. それ以外の場合は、新規登録処理として内部IDを自動生成して `users.json` に追加（またはアクセス拒否の仕様に従う）。
    6. 決定されたユーザー情報を `req.user` にセットします。
       ```typescript
       req.user = {
           id: matchedUser.id, // "usr_xxxxxxxx"
           role: matchedUser.role
       };
       ```
- `isLocal` (ローカルバイパス) 時は、`req.user` に以下を設定します。
  ```typescript
  req.user = {
      id: 'usr_local_dev_bypass',
      role: 'user'
  };
  ```

#### ② `server/src/routes/config.ts` の変更
- `CONFIG_PATH` の静的定義を廃止し、リクエストハンドラ内で動的にユーザーごとのパスを生成します。
- `saveBase64Image` 関数に `internalUserId` 引数を追加し、アセット保存先を `mascots/users/${internalUserId}/${mascotId}/${assetType}/` に変更します。
- **GET `/api/config`**:
  - `req.user.id` から `server/users/${req.user.id}/config.json` をロードします。
  - ディレクトリやファイルが存在しない（新規ユーザーの）場合：
    1. プロジェクトルートの既存 `config.json` をテンプレートとしてコピー。
    2. なければデフォルト値で初期化。
- **POST `/api/config`**:
  - `saveBase64Image` に `req.user.id` を渡して画像を保存し、設定データを `server/users/${req.user.id}/config.json` に書き込みます。

#### ③ `server/src/routes/history.ts` の変更
- **GET `/api/history`**:
  - `req.user.id` に基づく `server/users/${req.user.id}/chat_history.json` をロード。存在しない場合は空オブジェクトを返却。
- **POST `/api/history`**:
  - `server/users/${req.user.id}/chat_history.json` に履歴を書き込みます。

#### ④ `server/src/routes/websocket.ts` の変更
- WebSocket接続で音声ファイルを保存する際、マスコットIDの前に `users/<internal_user_id>/` を挿入します。
- 変更前: `path.join(baseCwd, 'mascots', mascotId, 'voices', dateStr)`
- 変更後: `path.join(baseCwd, 'mascots', 'users', userId, mascotId, 'voices', dateStr)` (※ `userId` は `ws` 接続時に `req.user.id` から特定して保持)

---

## 4. マイグレーションと互換性
- 新規ユーザーに対しては、プロジェクトのルートにある既存の `config.json` をコピーするため、これまでの動作設定を引き継げます。
- ローカル環境でも `usr_local_dev_bypass` というキーを使ってディレクトリが分離されるため、ローカルマシンの動作に支障はありません。

## 5. 将来のマルチIDaaSへの拡張ステップ
LINE等の新しいログイン手段を追加する場合は、以下の対応のみで完了します：
1. 各認証用ルート（例: `/api/auth/line/callback`）でLINEトークンを検証し、LINEの `userId` を取得。
2. 認証ミドルウェアで `identities` の `provider: "line"` 且つ `providerUserId` を検索。
3. 一致する内部ユーザーID (`usr_...`) を引き当てる。
4. 既存のアセット保存や設定読み書きロジックは一切変更せず、同一のユーザーデータにシームレスにアクセス可能です。
