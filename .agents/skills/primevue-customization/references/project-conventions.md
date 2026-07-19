# DesktopAiMascot固有のPrimeVue規約

## 現在の構成

- UI: Nuxt 3 / Vue 3 / PrimeVue 4系 / `@primevue/themes` 4系 / PrimeFlex 4系。
- PrimeVue初期化: `app/src/plugins/primevue.ts`。
- ベースpreset: Aura。
- アクセントpreset: `definePreset(Aura, ...)` の `semantic.primary` を `--theme-accent-*` へ接続。
- dark mode selector: `.app-dark`。
- アプリtoken: `app/src/styles/main.css`。
- テーマ定義と切替: `app/src/config/theme.ts`。
- デザインガイド: `docs/design_guidlines/DESIGN_GUIDELINES.md`。パスの綴りを変更しない。

依存はsemver範囲で宣言されているため、作業時にはlockfileまたは `npm ls primevue @primevue/themes primeflex` で実解決版を確認する。

## トークン階層

1. `--palette-purple-*`: Purple固有の原値。
2. `--theme-accent-*`: 現在のテーマが供給するアクセント階調。
3. `--color-primary*`: 用途を表すアプリsemantic token。
4. `--selection-*` など: アプリ共通部品token。
5. PrimeVue preset: 必要なアプリtokenをPrimeVue semantic/component tokenへ接続。

固定Purple値をVueコンポーネントへ増やさない。Tailwindでは固定 `purple-*` より `brand-*` を優先する。成功、警告、エラーなど意味を持つ色をアクセント色に置き換えない。

## プロジェクトでの優先順位

1. 既存のアプリtokenまたは共通Vueコンポーネントを再利用する。
2. PrimeVue全体の意味なら `app/src/plugins/primevue.ts` のpresetへ接続する。
3. 特定PrimeVueインスタンスなら `dt`、内部DOMなら `pt` を検討する。
4. アプリ独自レイアウトだけをSFCのscoped CSSへ置く。
5. `:deep()` と `!important` は競合相手を確認したうえで限定的に使用する。

既存の `app/src/main.ts` にある素のAura初期化を、Nuxt実行時の正規設定と誤認しない。現在のNuxtアプリでは `app/src/plugins/primevue.ts` を基準にする。削除判断は別途entry pointを確認して行う。

## 検証

- 変更に近いVitestを先に実行する。
- `app/` で `npm run lint`。
- Vue/Nuxt変更は `npm run typecheck`、Electronのみなら `npm run typecheck:electron`。
- `git diff --check`。
- テーマ変更は既定Purple、別テーマ、`.app-dark` を確認する。
- PrimeVue変更は通常、hover、focus-visible、disabled、invalidを確認する。
- レスポンシブ変更はデスクトップとモバイルを確認する。

開発サーバーやElectronは、HMRで確認できない場合を除いて再起動しない。
