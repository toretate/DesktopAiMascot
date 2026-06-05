# Piniaの導入と初期セットアップの実装計画

本計画では、Vue 3 の推奨状態管理ライブラリである Pinia をプロジェクトに導入し、アプリケーション全体でグローバル状態利用できるように初期セットアップを行います。

## ユーザー確認事項

> [!NOTE]
> 今回は Pinia のパッケージ導入と初期設定（および動作確認用のテストコード）を追加します。既存のリアクティブオブジェクト等の移行は、本タスクの範囲外とし、Pinia が正常に動作する基盤を整えることにフォーカスします。

## オープンクエスチョン

特にありません。計画がよろしければ承認をお願いいたします。

## 提案される変更

---

### 1. 依存関係の追加

#### [MODIFY] [package.json](file:///c:/workspace/workspace-win/DesktopAiMascot/package.json)
- `dependencies` に `pinia` (最新の安定版 `^2.1.7` 付近) を追加します。

---

### 2. アプリケーションの初期化設定

#### [MODIFY] [main.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/main.ts)
- `createPinia` をインポートし、Vue アプリケーションインスタンスに `app.use(createPinia())` を適用して登録します。

---

### 3. サンプルストアの作成

#### [NEW] [counter.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/stores/counter.ts)
- Pinia が正しく型安全に動作することを実証するため、シンプルなカウンター（値、アクション、ゲッター）を定義したテスト用ストアを作成します。

---

### 4. ストアの単体テストの追加

#### [NEW] [counter.test.ts](file:///c:/workspace/workspace-win/DesktopAiMascot/src/stores/__tests__/counter.test.ts)
- `vitest` を用いて、作成したストアのアクションやゲッターが期待通りに動作することを確認するテストコードを追加します。

---

## 検証計画

### 自動テスト
- `npm run test` を実行し、追加したストアのユニットテストが成功することを確認します。
- `npm run build` を実行し、TypeScriptの型エラーやコンパイルエラーがないことを確認します。

### 手動検証
- `npm run dev` で開発サーバーを起動し、コンソールにエラーが出力されないことを確認します。
