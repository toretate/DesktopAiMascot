# Android 移植設計・ロードマップ

本ドキュメントは、現在 Electron + Vite + Vue3 + TypeScript で構築されている `Desktop AI Mascot` アプリケーションを Android プラットフォームへ移植し、動作可能にするための設計およびロードマップを定義します。

---

## 1. 移植方針とアプローチ

### 1.1. UI/ロジックの共有化（ハイブリッドアプリ化）
既存 of Web フロントエンド共通層（`ui/src`）の資産を最大限活かすため、**Capacitor (by Ionic)** を採用し、HTML5/JS/TS (Vue3) ベースのハイブリッドモバイルアプリケーションとしてパッケージングします。

- **Capacitorの採用理由**:
    - Vite および Vue3 プロジェクトとの親和性が非常に高い
    - iOS/Android 向けバイナリを容易にビルド可能
    - 各種ネイティブAPI（ファイルシステム、ストレージ、通知など）へのアクセスがプラグイン経由で標準化されている

### 1.2. プラットフォーム抽象化レイヤー (Platform Adapter) の導入
現在、Electron 環境依存の処理（IPC通信、ファイル入出力、暗号化など）は `window.electronAPI` 等の Electron 固有のインターフェースを通じて行われています。これを Android (Capacitor) や通常のブラウザ (Web) 環境でも動作するように、インターフェースを介した抽象化レイヤーを導入します。

```
[ ui/src (Vue 3 / TS) ]
        |
        v
[ Platform Adapter Interface ]
        |
   +----+--------------------+
   |                         |
   v                         v
[ Electron Adapter ]    [ Capacitor Adapter (Android) ]
   |                         |
   v                         v
(Electron Main / IPC)   (Capacitor Plugins / Android Native)
```

---

## 2. Android 固有の要件と対応設計

### 2.1. モバイル向け画面構成・レイアウトの最適化
本アプリは他のアプリの上に重ねるフローティングウィンドウ形式ではなく、**通常の単体（全画面）アプリ**として実装します。これに伴い、デスクトップ（Windows）版での「マスコットとチャットウィンドウがそれぞれ独立した透過ウィンドウとして存在する」レイアウトから、スマートフォンの画面に最適化したレイアウトへ再設計します。

- **レイアウト案**:
    - 画面を「マスコット表示エリア」と「チャット履歴＆入力エリア」に分割（縦画面では上部がマスコット、下部がチャット領域等）するレスポンシブな構成とします。
    - チャット領域は必要に応じてスワイプやボタンで開閉（折りたたみ）できるようにし、マスコットを大きく表示するモードと対話モードをシームレスに切り替えられるようにします。
- **背景処理**:
    - 単体アプリとして動作するため、OSレベルの背景透過は不要です。アプリ内の背景には、キャラクターに合わせたカラーグラデーションやカスタム背景画像を配置できるようにします。

### 2.2. データストレージと暗号化
Windows では API キーの保存に DPAPI を使用していますが、Android では OS 提供の安全な暗号化ストレージを使用します。

- **API キーなどの機密情報**:
    - `@capacitor-community/secure-storage` を使用し、Android の `KeyStore` システムおよび `EncryptedSharedPreferences` を用いて暗号化保存します。
- **一般設定（JSON/YAML）**:
    - `@capacitor/preferences` (Key-Value型) または `@capacitor/filesystem` を使用し、アプリの内部ストレージ（`Directory.Data`）に保存します。

### 2.3. マスコットアセット（画像・アニメーション）の管理
ユーザーが任意のマスコットを追加・編集できるようにするためのファイル管理設計です。

- **デフォルトマスコット**:
    - アプリケーションパッケージ内（`assets/`）に同梱し、初期起動時に読み込みます。
- **ユーザー追加マスコット**:
    - `@capacitor/filesystem` を使用し、アプリ専用ストレージ（`Directory.Documents` または `Directory.Data`）にディレクトリを作成して保存します。
    - Android のファイルピッカー（`@capacitor/file-picker`）を使用して、端末内の PNG/WebP 画像をインポートする機能を UI に追加します。

### 2.4. ネットワーク通信（外部AIサービス連携）
LM Studio や Style-Bert-VITS2 などのローカルサーバーは Android 端末内部では動作しないため、通信設定の調整が必要です。

- **接続方法**:
    - Android 端末とサーバーPCを**同一のローカルネットワーク (Wi-Fi)** に接続し、PCのプライベートIPアドレス（例: `http://192.168.x.x:1234`）を設定画面で指定します。
    - クラウドサービス（Gemini API、OpenAI API 等）との通信もサポートします。
- **セキュリティポリシー設定 (Cleartext Traffic)**:
    - Android 9 (API 28) 以降、デフォルトで暗号化されていない HTTP 通信（`http://`）が禁止されているため、`AndroidManifest.xml` および `network_security_config.xml` で特定のローカルIP帯へのクリアテキスト通信を明示的に許可します。

---

## 3. 実装ロードマップ

### フェーズ 1: Capacitor 導入とベースビルド（全画面アプリ化）
まずは全画面アプリとして Android 端末上で動作することを目指します。

1. **Capacitor の初期化**:
    - `npm install @capacitor/core @capacitor/cli`
    - `npx cap init tonarice jp.toretate.tonarice --web-dir=dist`
    - Android プラットフォームの追加: `npx cap add android`
2. **ビルド設定の調整**:
    - `vite.config.ts` を修正し、Android 向けの相対パス出力やアセット配置に対応。
3. **Android Studio での起動確認**:
    - `npm run build` 後に `npx cap sync` を実行し、エミュレータまたは実機で起動確認。

### フェーズ 2: プラットフォーム抽象化と基本機能の移植
OS 依存 of 処理を Android 用に実装し直します。

1. **Platform Adapter の実装**:
    - `StorageService`, `SecureStorageService`, `MascotAssetService` などのインターフェースを定義。
    - Electron 用実装（既存の IPC 経由）と Capacitor 用実装（各種プラグイン経由）を作成し、実行環境に応じて動的にインジェクション。
2. **クリアテキスト通信の許可**:
    - `android/app/src/main/res/xml/network_security_config.xml` を作成。
    - `AndroidManifest.xml` の `application` タグに `android:networkSecurityConfig="@xml/network_security_config"` を追加。

### フェーズ 3: モバイルUIの最適化とポーリッシュ
モバイル端末の操作性（タッチ、スワイプ、画面サイズなど）に合わせた調整を行います。

1. **レスポンシブ・レイアウトの適用**:
    - CSS メディアクエリを使用し、縦画面（スマートフォン）および横画面（タブレット/PC）のそれぞれで最適な分割レイアウトを表示。
2. **ジェスチャー操作の統合**:
    - モバイルでの操作性を考慮し、フリック・スワイプによるチャット履歴パネルの開閉ジェスチャーや、マスコットのタップリアクションの実装。
3. **パフォーマンスチューニング**:
    - モバイルブラウザ環境で描画負荷（WebGL アニメーションなど）が高くなりすぎないよう、フレームレート制御（FPS制限）や省電力モードの実装。

---

## 4. 懸案事項と考慮すべきリスク

- **アスペクト比と画面サイズ**:
    - 多種多様な画面解像度が存在するため、マスコット画像が歪んだりチャットウィンドウが見切れたりしないよう、十分なCSSレイアウトのテストが必要です。
- **バックグラウンド制限**:
    - アプリがバックグラウンドに移行した際、OSによってWebSocketやHTTP接続が切断される場合があります。バックグラウンドでの対話継続が必要な場合は、Android のフォアグラウンドサービスやローカル通知の設計を後日検討する必要があります。
- **バッテリー消費**:
    - アニメーションが頻繁に走るとバッテリー消費が増大します。画面非表示時や端末のスリープ時にはレンダリングループを完全に停止するなどの省電力対策が必須となります。
