# tool-use 実装レビュー（Claude）— 未対応事項

| 項目 | 内容 |
| --- | --- |
| 初回レビュー | 2026-07-12（基準: `c84d495` + 作業ツリー） |
| 最終更新 | 2026-07-12 |
| 対象 | `app/src/server/utils/chat-ai-service.ts` の tool-use ファイル分割、および tool-use 実装全体 |

> 本文書は**未対応の指摘のみ**を保持する。修正済み項目（vitest エイリアス、`$` 対策、擬似ツール記法除去の走査化、manageMemos 同期漏れ、二重ツリー統合、temperature 低温化、timeInstruction 位置・粒度）は削除済み。修正の詳細と検証結果は `fix_instructions_codex.md` の対応状況テーブルを参照（最終テスト: 対象スイート 24 passed）。
> OpenAI / Gemini レビューとの突き合わせ経緯も解消済みのため削除した。Gemini 提案のうち採用不可と判定した事項は本書末尾の「実装上の制約」として残す。

---

## 未対応の指摘

### A. 🟡 ツール定義の二重抽象化（`@lmstudio/sdk` → Vercel 変換）の型消失
ツール定義は `@lmstudio/sdk` の `tool()` で行われ、(1) connector の `llm.act` ネイティブ経路（`lmstudio-connector.ts:189`）でそのまま、(2) ChatAiService の Vercel 経路で `convertLmStudioToolToVercel`（全部 `any`）変換して、の2経路で共用されている。定義共有自体は合理的だが、Vercel 経路では **`any` により型安全な `execute` 引数推論が失われている**。改善するなら「両経路の統合」または「Vercel 経路のみ薄い型付きラッパ」の検討（SDK 撤去は不可 — 末尾の制約参照）。

### B. 🟡 手動同期が必要なレジストリ構造（P3 で対応予定）
manageMemos の同期漏れ・ツリー乖離という**症状は修正済み**だが、1ツール追加時に「ツール実装＋prompt ファイル＋`TOOL_PROMPTS`＋2箇所の filteredTools switch＋index」を手で揃える**構造自体は残っている**。`configKey`/`prompt` をツールオブジェクトのメタデータに統合してデータ駆動化する（`fix_instructions_codex.md` P3、別PR）。

### C. 🟡 ツール誘導が native function-calling ではなくプロンプト作文に依存
標準では `description` + JSONスキーマがモデルを誘導し、system prompt で「〜のとき呼べ」とは基本書かない。本実装は手書きガイドラインが主役で、**同じ意図がツールの `description` とガイドライン prompt に二重化しドリフトし得る**。ローカルモデルの弱さを埋める必要悪だが、cloud モデルには過剰。

### D. 🟡 ツール結果を SDK ではなく副次キャッシュ（`executedTools`）で取得
標準は `response.steps[].toolResults` を読む。本実装は execute コールバックで別配列に溜めるため、**通知が「execute が走ったか」に結びつき、モデルが結果を無視したケースと区別できない**。SDK更新時に見直す価値あり。

### E. 🟡 生成後サニタイズが広範かつ壊れやすい
思考タグ・擬似ツール記法・ループ検出・空応答フォールバックと後処理が厚い。ローカルモデルが reasoning を本文に漏らす／ツール呼び出しを文字列で捏造することへの対症療法で、cloud には通常不要。温度低減（対応済み）で緩和されたが、構造的解は「reasoning分離endpoint + `reasoning_format:'none'` 常用」で汚れを発生させないこと。

### G. 🟢 その他
- 全体 `any` 型（vercelTools/generateOptions/response/adapter）で Vercel SDK の型の恩恵を放棄。
- 60秒固定タイムアウトが5ステップ＋外部API（天気/Web検索）を含むループ全体に掛かり、多段ツール時に窮屈・設定不可。
- 構造化ツールエラーが無い（各ツールが日本語文字列を返す）。framework がエラーを tool-result としてモデルに返す回復ループは使えていない。
- `@prompt` エイリアス定義が tsconfig / nuxt.config / vitest.config の3か所に重複しており、追加漏れの温床（実際に vitest 分の漏れが発生した）。一元化を検討。
- `manageTasks` と `manageMemos` に有効/無効フラグが無く常時有効（両経路の switch とも `default: return true`）。意図どおりか要確認 → P3 の `configKey` 設計時に判断。

---

## 残りの改善提案

1. ⬜ **ツールのメタデータ統合でレジストリを単一化**（項目B。`fix_instructions_codex.md` P3、別PRで対応予定）
2. ⬜ 中期的に**後処理スクラブへの依存を「reasoning分離 + 良い endpoint」で低減**（項目E。低温化のみ実施済み）

---

## 実装上の制約（今後の変更で守ること）

1. **`@lmstudio/sdk` を削除・置換しない。** connector の `llm.act` 経路が SDK の `tool()` 定義を現役利用している。撤去は connector 経路の移行計画とセットでのみ検討可能。
2. **変動する時刻を「履歴途中の system メッセージ」として挿入しない。** `@ai-sdk/google`（v3.0.83 で確認）は先頭以外の system メッセージで throw する。時刻は system prompt 末尾（静的部分の後ろ）に置く（現行実装）。
3. **タイマータグとの相互排他ルールを共通ガイドラインへ移さない。** manageTasks 固有ルールをツール別プロンプトに置くことで「ツール無効時にはルールごと消える」のが現設計の利点。
