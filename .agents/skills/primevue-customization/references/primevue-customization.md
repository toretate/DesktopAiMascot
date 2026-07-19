# PrimeVueカスタマイズ判断リファレンス

## 公式資料

- Styled Mode: https://primevue.org/theming/styled/
- Pass Through: https://primevue.org/passthrough/
- Configuration: https://primevue.org/configuration/
- 各コンポーネントのDesign Tokens / Pass Through欄

公式サイトは最新メジャー版へ更新される。実装前にプロジェクトのPrimeVueメジャー版とimport元を確認し、対応するAPIだけを使用する。

## 選択表

| 要求 | 第一候補 | 補足 |
| --- | --- | --- |
| ブランドパレット、surface、focus ring | `definePreset` のsemantic tokens | light/dark階層を元presetと一致させる |
| ButtonやInputText全体の外観 | component tokens | 全インスタンスへの影響を確認する |
| 特定の1コンポーネントだけtoken変更 | `dt` | `:deep()` より優先する |
| 内部要素へclass、属性、ARIAを付与 | `pt` | 対象版のPT section名を確認する |
| アプリ固有のレイアウト | scoped CSS | tokenに位置・構造を持ち込まない |
| アプリ共通の操作パターン | 共通Vueコンポーネント | PrimeVue component tokenとは責務が異なる |
| ライブラリCSSとの詳細度競合 | CSS layer / 読み込み順 / selector | `!important` は最後の手段 |
| 実行中のテーマ切替 | `usePreset` / `updatePreset` / palette更新API | 対応版のAPIを確認する |

## Design tokenの層

- primitive: 色階調など意味を持たない原値。
- semantic: primary、surface、focus ringなどアプリ全体の意味。
- component: button、inputtext、cardなど特定PrimeVueコンポーネントの値。
- application token: PrimeVue外も含むアプリ固有の意味。既存CSS変数からsemantic/component tokenへ接続してよい。

全体で共有される意味はsemanticへ置き、特定コンポーネントだけの微調整はcomponentへ置く。画面固有の配置はtoken化しない。

## 監査手順

1. `rg "definePreset|theme:|preset:|darkModeSelector|cssLayer"` で初期化を確認する。
2. `rg "!important|:deep|::v-deep|style=|:style=|:dt=|:pt="` で対象を列挙する。
3. 対象要素のPrimeVue component名と、付与されたPrimeFlex/Tailwind classを確認する。
4. 対応版ドキュメントまたはインストール済みtheme定義からtoken path / PT section名を確認する。
5. 全体影響ならpreset、局所なら `dt` / `pt`、構造ならscoped CSSを選ぶ。
6. hover、focus-visible、active、disabled、invalid、light/darkを確認する。
7. `!important` 削除は宣言群を小分けにし、差分ごとに回帰確認する。

## よくある失敗

- 元presetが `colorScheme.light/dark` で定義しているtokenを直値で上書きし、反映されない。
- component tokenで画面固有のサイズを変え、別画面まで変化させる。
- `pt` section名を別メジャー版の資料からコピーする。
- PrimeFlex/Tailwind utilityとSFC CSSで同じpropertyを競合させる。
- CSS変数へ値を移しただけで、selector詳細度も解決したと判断する。
- PrimeVueの内部class名を長い `:deep()` selectorで固定し、アップグレードで壊す。

## レビュー時の問い

- 同じ値を2画面以上で使うか。
- PrimeVue以外の要素にも同じ意味を適用するか。
- 全Button/Inputへ適用してよいか、それとも1インスタンスだけか。
- 内部DOMへのアクセスが必要か。公開PT sectionはあるか。
- `!important` は何と競合しているか。computed stylesで確認したか。
- light/darkと将来のテーマ切替で値が追従するか。
