---
name: primevue-customization
description: PrimeVueのテーマ、definePreset、design tokens、dtによるscoped tokens、Pass Through、CSS layer、scoped CSSを設計・実装・レビューする。PrimeVueコンポーネントの見た目変更、テーマ色追加、CSS上書き、!important削減、PrimeFlex/Tailwindとの競合、PrimeVueのアップグレードやカスタマイズ方針を扱うときに使用する。
---

# PrimeVue Customization

PrimeVueの公開APIを優先し、CSS詳細度への依存を最小化する。変更前に実装中のPrimeVueバージョンと既存テーマ構成を確認する。

## 必ず読む資料

- このリポジトリで作業する場合は [references/project-conventions.md](references/project-conventions.md) を読む。
- preset、token、Pass Through、CSSの選択判断が必要な場合は [references/primevue-customization.md](references/primevue-customization.md) を読む。
- HTML/CSSまたはクライアント側JavaScriptを変更する場合は、リポジトリの `modern-web-guidance` スキルも先に使用する。

## 作業フロー

1. `package.json` とlockfileからPrimeVue、themes、PrimeFlexの実解決バージョンを確認する。
2. PrimeVue初期化、preset、グローバルCSS、対象コンポーネント、既存の `dt` / `pt` / `:deep()` / `!important` を検索する。
3. 変更を次の優先順位で分類する。
   1. 全体のブランド・意味・状態: primitiveまたはsemantic token。
   2. 同種PrimeVueコンポーネント全体: component token。
   3. 1インスタンスだけのtoken差し替え: `dt` scoped tokens。
   4. コンポーネント内部DOMの属性・class・ARIA: `pt` Pass Through。
   5. アプリ独自の配置・サイズ・レスポンシブ構造: SFCのscoped CSSまたは共通アプリ部品。
   6. 既存ライブラリCSSとの競合: selector、cascade layer、読み込み順を確認してから最小限の上書き。
4. 既存の共通部品・variant・tokenで表現できない場合だけ新しいCSSクラスを作る。
5. 動作と見た目を検証し、変更した経路に近いテスト、lint、型チェック、`git diff --check` を実行する。

## 禁止事項

- 公式token名を推測して実装しない。インストール済みパッケージか対応版の公式資料で確認する。
- 最新公式資料の例を、プロジェクトのメジャーバージョン確認なしにコピーしない。
- `definePreset` に画面固有の幅、絶対配置、z-index、レスポンシブレイアウトを入れない。
- PrimeVue内部DOMを未確認の `:deep()` セレクタで上書きしない。まず公開token、`dt`、`pt` を確認する。
- 新しい `!important` や静的インライン `style` を安易に追加しない。
- アクセント色を固定Hex、`purple-*` utility、PrimeVue生成CSS変数へ直接重複定義しない。
- 複数テーマ対応を壊す値をコンポーネントへ埋め込まない。

## `!important` の扱い

削除前に、その宣言が次のどれかを判定する。

- token値の重複: presetまたは `dt` へ移す。
- PrimeVue内部要素の指定: `pt` へ移せるか確認する。
- PrimeFlex/Tailwindとの競合: DOM上のutility classを整理する。
- cascadeの競合: CSS layer、読み込み順、自然なselector詳細度を検討する。
- 画面固有の状態・モバイル上書き: 親状態classとメディアクエリの構造を整理する。

値の共通化と詳細度問題は別である。preset化しただけで `!important` が不要になるとは仮定しない。削除は小さい単位で行い、必要性を証明できない宣言は残して理由を報告する。

## 完了報告

次を簡潔に示す。

- 選択したカスタマイズ経路と理由
- preset / `dt` / `pt` / scoped CSSの変更範囲
- 削除・追加した `!important` と静的インラインstyleの件数
- light/dark、テーマ切替、hover/focus/disabled、モバイルへの影響
- 実行した検証と未確認事項
