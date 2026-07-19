# @tonarice/expression-alignment

マスコット表情スプライトの自動位置合わせライブラリ。

- **framework / DOM 非依存・決定論的**（同入力→同出力）。
- コアは `RasterImage`（RGBA 配列）だけを受け取る純粋関数。画像デコードは `ImageLoader` アダプタに委譲する。
- 全プラットフォーム（Electron renderer / Web / WebView）で同一コアを共有（仕様書 11章）。

仕様: `docs/specs/マスコット表情スプライト自動位置合わせ仕様書.md`

## 構成

```
src/
  types.ts               型定義・クランプ定数
  image-input.ts         ImageLoader インターフェース（DOM/Node 非依存）
  solve-transform.ts     位置合わせコア（A/B分離・2モード）※本体は実装中
  index.ts               公開バレル
adapters/
  canvas-node.ts         Node 用 ImageLoader（canvas npm / テスト・サーバ）
  canvas-browser.ts      ブラウザ/WebView 用 ImageLoader
__tests__/
  contract.test.ts       スキャフォルドのスモークテスト
```

## 開発

```bash
npm install
npm test        # vitest run
npm run typecheck
```

## 実装ステップ

仕様書 第12章を参照。本パッケージは「ライブラリ先行・テスト駆動」で完成させ、UI/Server からは最後に結線する。
