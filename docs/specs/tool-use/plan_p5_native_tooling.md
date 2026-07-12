# P5 実装計画: ツール誘導の native function-calling 化（プロンプト作文依存の低減）

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-13 |
| 基準コミット | `dfb8989`（refactor: ツールアダプタを型安全化し any を排除（P4）） |
| 根拠文書 | `review_claude.md` 項目C |
| 前提文書 | `walkthrough_opus.md`（アーキテクチャ現状）、`plan_opus.md`（P3 のメタデータ統合設計） |
| 実装指示 | `fix_instructions_p5.md` |

---

## 1. 背景（対応するレビュー指摘）

`review_claude.md` 項目C:

> **C. 🟡 ツール誘導が native function-calling ではなくプロンプト作文に依存**
> 標準では `description` + JSON スキーマがモデルを誘導し、system prompt で「〜のとき呼べ」とは基本書かない。本実装は手書きガイドラインが主役で、**同じ意図がツールの `description` とガイドライン prompt に二重化しドリフトし得る**。ローカルモデルの弱さを埋める必要悪だが、cloud モデルには過剰。

問題は2つに分解できる:

1. **ドリフト（二重化）**: 「何をするツールか／いつ呼ぶか」が `tool()` の `description` と `@prompt/*.prompt.ts` の2箇所（連携経路によっては connector の英語 `label` も）に書かれ、片方だけ更新される事故が起こり得る。
2. **cloud への過剰**: gemini / openai は `description` + JSON スキーマだけで十分にツールを誘導できるのに、chat-ai-service は日本語の手書きガイドライン（`prompt`）を毎回 system prompt に注入している。これは弱いローカルモデル向けの補償であり、cloud には不要なノイズ。

---

## 2. 現状の事実整理（どのテキストがどの経路で使われているか）

ツール1つあたり「誘導文言」は最大3種類存在する。

| 文言の所在 | 実体 | 使う経路 |
| --- | --- | --- |
| `tool().description`（+ zod `.describe()`） | 各 `*-tool.ts` / `*-tools-shared.ts` | **両経路**（native function-calling の唯一の標準入力）。Vercel 経路は `convertLmStudioToolToVercel` が `description`/`inputSchema` に転写、connector 経路は `llm.act` が `tool()` を直接使用 |
| `@prompt/*.prompt.ts`（日本語ガイドライン `MascotTool.prompt`） | `src/skills/tool-use/prompts/*.prompt.ts` | **chat-ai-service のみ**（`toolUseSection` に全ツール分を連結して system prompt へ注入）。gemini / openai / lmstudio-OpenAI 互換すべてに同一注入 |
| `MascotTool.label`（英語ラベル） | `src/skills/tool-use/index.ts` | **connector のみ**（`# Tool Use Guidelines` の英語一文を組み立てる材料。個別 `prompt` は使わない） |

事実確認（実装読み取り）:

- **connector 経路（`lmstudio-connector.ts:149-166`）は既に native-first 寄り**。日本語 `prompt` を一切注入せず、`label` から作る汎用英語ガイドライン1〜2文＋`llm.act` に渡す `tool()` の `description` に依存している。
- **過剰注入が起きているのは chat-ai-service 経路（`chat-ai-service.ts:186-203`）だけ**。ここが gemini / openai（native で十分なモデル）にも日本語の全ツール `prompt` を注入している。
- **`description` は「いつ呼ぶか」の要点をほぼ保持している**。特に routing の肝である「manageTasks vs manageMemos vs タイマー」の区別は、`task-tools-shared.ts:6` と `memo-tools-shared.ts:6` の `description` に明記済み。
- **ただし例外が1つある（Codex レビューで検出）**: 「**会話履歴中の過去の実行依頼を再実行しない／最新メッセージで依頼された場合のみ実行する**」という履歴の扱いのルールは、`manageTasks.prompt.ts:3`（per-tool prompt）**にしか無く、description には無い**。この規則は per-tool prompt を落とすと cloud から失われる。したがって「description だけで安全」は完全には成立せず、このルールを cloud にも残す手当てが必要（→ D6）。なお、このルールは横断的（履歴の扱い）で manageTasks 固有ではないため、共通ガイドラインへ移してよい（禁止事項の対象はタイマー相互排他ルールのみ）。

---

## 3. ゴール

1. **native function-calling を主役にする**: `description` + JSON スキーマを「いつ・何を呼ぶか」の唯一の正とし、cloud モデルへの手書きガイドライン注入を撤廃する。
2. **ドリフトの低減**: 「何をするツールか」を `description` に一本化し、`prompt` からは description の単なる言い換えを減らす。`prompt` は「native では埋められない、弱いローカルモデル向けの補強」を持つ役割に寄せる。※`prompt` に imperative／routing 強調が残る以上、意味的ドリフトの余地はゼロにはならない（完全排除ではなく低減）。
3. **既存のローカルモデル体験を退行させない**: lmstudio 経路（両経路とも）の誘導強度は現状維持。native 化はあくまで native を信頼できる cloud に限定する。

---

## 4. 設計判断

### D1. アプローチ — 「モデル階層別の注入（tier-aware injection）」を採用

| 案 | 内容 | 判定 |
| --- | --- | --- |
| A: tier-aware injection | エンジンごとに誘導モードを切り替える。cloud（gemini/openai）＝native モード（`prompt` を注入しない）、local（lmstudio）＝prompted モード（現状維持） | **採用** |
| B: `prompt` を全廃し description に一本化 | 全モデルで `prompt` 注入をやめる | 不採用: 弱いローカルモデルの誘導が退行する（後処理サニタイズ E への依存が増える）。レビューも「ローカルの弱さを埋める必要悪」と明記 |
| C: `prompt` を description から自動生成 | description を system prompt にも流用し単一ソース化 | 不採用: description は長文（manageTasks で顕著）で system prompt にそのまま流すとキャッシュ効率・ノイズが悪化。imperative な誘導（「必ず呼べ」）と declarative な description の役割分離が失われる |

**理由**: 問題は「cloud への過剰」であって「local の誘導」ではない。過剰が起きている chat-ai-service の1経路・エンジン分岐だけを直せば、影響範囲が局所化され、connector 経路・ローカルモデル体験に一切触れずに済む。

### D2. 誘導モードの判定 — エンジンで決める

```typescript
// chat-ai-service.ts 内。currentEngine の解決を toolUseSection 構築より前に移動する
const currentEngine = engine || 'gemini';
// native function-calling を信頼できるモデルか（cloud=true, ローカル弱モデル=false）
const preferNativeToolGuidance = currentEngine !== 'lmstudio';
```

- 判定材料は既存の `engine` パラメータのみ。新規設定・UI 追加は不要（スコープ外）。
- 「ローカルでも強いモデルがある／cloud でも弱いモデルがある」ケースは、将来 `enableThinking` 同様のユーザートグル（例: `forcePromptedToolGuidance`）で上書き可能にできるが、**本 P5 では実装しない**（YAGNI、プロダクト判断待ち）。設計上は分岐を1関数に閉じておき、後から差し込めるようにする。

### D3. `toolUseSection` の分岐 — native モードは「ツール一覧＋汎用1行」のみ

現状（`chat-ai-service.ts:194-200`）を次の分岐に置き換える。**共通ガイドラインテンプレート（`tool-use-guideline.ts`）の出力ルール（思考タグ禁止・日本語・マスコット口調・「登録しました」応答）は両モードとも不変**——落とすのは per-tool の日本語 `prompt` 連結だけ。

```typescript
let toolUseSection = '';
if (filteredTools.length === 0) {
    toolUseSection = '- 利用可能なツールはありません。';
} else if (preferNativeToolGuidance) {
    // native モード（cloud）: description + JSON スキーマに誘導を委ねる。
    // per-tool の日本語ガイドラインは注入せず、ツール一覧と最小限の一文のみ。
    toolUseSection =
        `- 以下のツールが使用可能です: ${toolListStr}\n` +
        `- 適切な状況では推測で会話を完結させず、対応するツールを呼び出してください。`;
} else {
    // prompted モード（ローカル弱モデル）: 現状維持（per-tool ガイドラインを連結）
    toolUseSection = `- 以下のツールが使用可能です: ${toolListStr}\n` + activeToolPrompts.join('\n');
}
```

- native モードの「推測で済ませず呼べ」の一文は、connector 経路の英語ガイドライン（`lmstudio-connector.ts:156` `Always call tools to get accurate information instead of guessing.`）と意味を揃えた最小限の総則。per-tool ではなく汎用なのでドリフトしない。

### D4. `prompt` の役割純化（Phase B）— description の言い換えを除去

native 化後、per-tool `prompt` は **lmstudio 経路でしか使われない**。その前提で各 `prompt` を「description の単なる言い換え」から「ローカルモデル補強（imperative / 禁止事項 / routing 強調）」へ整理する。

| tool | 現 `prompt` の性質 | Phase B での方針 |
| --- | --- | --- |
| getWeather / adjustVolume / launchApp / getGPSLocation / searchWeb | description のほぼ言い換え（1文） | 内容が description と重複。ローカル補強として**現状維持でも可**だが、ドリフト源。**description を正とし、prompt は「必ずツールを呼ぶ」ことを促す短い imperative に寄せる**（言い換えの重複を減らす） |
| manageTasks | TIMER 区別・履歴の扱いを含む長文。TIMER 区別は description にも重複 | routing の肝はローカル補強として残す価値が高い。**description を正とし、prompt では重複する説明文を削り「タイマーではなく manageTasks を使う」判断だけを短く強調**。※タイマー相互排他ルールを共通ガイドラインへ移すことは禁止（制約参照）。per-tool prompt に置いたままにする |
| manageMemos | manageTasks / タイマーとの区別 | 同上。description（`memo-tools-shared.ts:6`）に区別があるので、prompt は補強の最小限に |

**Phase B は文言変更でありローカルモデル挙動に影響する**ため、Phase A と分離し、実機（LM Studio）スモークテストを通してから適用する（後述リスク表）。

### D5. connector 経路 — 変更しない

connector は既に native-first（`prompt` 非注入、`label` + description 依存）。本 P5 で触ると回帰リスクだけ増える。**変更対象外**とする。

### D6. 履歴再実行防止ルールを共通ガイドラインへ抽出（Codex 指摘1への対応）— P5-A に含める

「会話履歴中の過去の実行依頼を再実行しない」というルール（現状 `manageTasks.prompt.ts:3` のみ）は、per-tool prompt を落とす cloud から失われる。これは routing ではなく**履歴の扱いという横断的な実行規則**なので、per-tool ではなく **`toolUseSection` の末尾（native / prompted の両モード共通）に注入**し、cloud/local 両方に効かせる。

**配置は「ツールが1つ以上有効なときのみ」注入する**（`filteredTools.length > 0` の分岐内。Gemini 懸念C対応）。ツールが皆無のときに「過去のタスク追加を再実行するな」という指示が出るノイズを避けるため。この方式なら `tool-use-guideline.ts`（常時注入テンプレート）は**変更不要**で、変更は chat-ai-service の1関数に閉じる。

- 文言は manageTasks 固有表現（「タスク追加・予定登録」）を一般化し、タスク／メモ等の実行系ツール全般に効く形にする。**かつ「完了済み依頼の重複防止」と「未完了依頼の継続（確認・承認フロー）」を区別する**（Codex 指摘）。単に「最新メッセージで依頼された場合のみ実行」とすると、「削除していい？→はい」のような正当な確認応答までツール実行できなくなるため。例:

  > `- 会話履歴中で既にツール実行または完了応答まで済んだ依頼を、重複して再実行しないでください。ただし、確認・追加情報の提示・承認など、最新のユーザーメッセージが未完了の依頼を継続する内容である場合は、履歴の文脈を踏まえて実行してください。`

- **これはタイマー相互排他ルールではない**ため、共通側へ置くことは禁止事項4に抵触しない（禁止対象はタイマー相互排他ルールのみ）。タイマールールは引き続き `manageTasks.prompt.ts` に残す。
- **P5-A は `toolUseSection` への追加のみ**とし、`manageTasks.prompt.ts` からの重複削除は行わない（local は toolUseSection 末尾＋per-tool の二重になるが無害）。重複解消は P5-B（実機スモーク後）で行う。これにより P5-A は cloud に対しては履歴ルールを新規獲得、local に対しては（位置は変わるが）内容不変になり安全。
- connector 経路は元々このルールを持たない（`label` のみ注入）ため、本 P5 では手当てしない（既存の欠落・スコープ外。connector は変更対象外）。
- モックテストではモデルの履歴判断そのものは検証できないため、ルールが system prompt に**含まれること**をユニットで固定し、実際の再実行防止挙動は cloud（Gemini/OpenAI）スモーク項目で確認する。

---

## 5. フェーズ分割

| フェーズ | 内容 | 影響 | リスク | 検証 |
| --- | --- | --- | --- | --- |
| **P5-A** | chat-ai-service に tier-aware 分岐を導入（D2/D3）＋履歴再実行防止ルールを `toolUseSection` 末尾へ追加（D6、ツール有効時のみ） | chat-ai-service.ts の1関数のみ。`tool-use-guideline.ts`・connector・per-tool prompt・tool 定義は不変 | 低（cloud への per-tool prose 除去は description の routing＋履歴ルールで担保。local は履歴ルールの位置が変わるだけで内容不変） | ユニット（gemini/openai=非注入 / lmstudio=注入、履歴ルールが両モードに含まれる）。既存テスト277番の期待反転。cloud スモーク（履歴再実行防止＋確認フロー継続） |
| **P5-B** | per-tool `prompt` から description の言い換えを減らし補強に純化（D4）＋ D6 で共通化した履歴ルールの重複を manageTasks.prompt から削除 | `prompts/*.prompt.ts` の文言。lmstudio 経路の挙動に影響 | 中（ローカルモデルの routing 精度） | LM Studio 実機スモーク（天気/タスク追加/タイマー区別/完了済み依頼の再登録防止/確認フロー継続）。退行あれば prompt を戻す |

P5-A のみでレビュー指摘Cの主要部（cloud への過剰／native 主役化）は解消し、かつ履歴ルールの欠落（Codex 指摘1）も塞ぐ。P5-B はドリフトを更に低減する追い込みで、**P5-A 単独でも独立して価値がありマージ可能**。

---

## 6. 受け入れ条件

**P5-A:**
- `engine: 'gemini'` **および `'openai'`** で `generateText` に渡る `system` に per-tool の日本語 `prompt` 本文（例: `期限のない自由メモ`）が**含まれない**。ツール一覧（ツール名）と共通出力ルールは含まれる。
- `engine: 'lmstudio'` で `system` に per-tool `prompt` 本文が**従来どおり含まれる**。
- 両モードとも `generateText` の `tools` には全有効ツールが登録される（native function-calling 自体は不変）。
- **履歴再実行防止ルール（D6）が cloud / local の両モードの `system` に含まれる**（`toolUseSection` 経由・ツール有効時）。
- `tool-use-guideline.ts` の出力ルール（思考タグ禁止・日本語・マスコット口調・「登録しました」）は両モードで system に残る。
- system prompt 順序（ペルソナ→ガイドライン→時刻）とキャッシュ配慮（時刻は末尾・分単位）は不変。
- 対象2スイートが全て成功（既存 chat-ai-service テストは期待反転する1件を除き無修正で通過）。

**P5-B:**
- 各 `prompt` から description の逐語的言い換えが減っている（レビューで確認）。
- manageTasks / manageMemos の **TIMER 区別**は per-tool prompt に残置（共通ガイドラインへ移さない）。**履歴ルールは D6 で共通化済みなので manageTasks.prompt からは削除**（重複解消）。
- LM Studio 実機スモークで以下が退行しない: 「天気を聞く→getWeather 呼び出し」「タスク追加→manageTasks 呼び出し」「N分後通知→タイマータグ（manageTasks を呼ばない）」「**完了済み**タスク追加の後に『うん』→再登録しない」「**削除確認の後に『はい』→削除ツールを実行する**（確認フローの継続を止めない）」。

---

## 7. リスクと対策

| リスク | 対策 |
| --- | --- |
| cloud で per-tool prompt を落としたら routing（タスク vs タイマー等）が退行 | `description` に区別が明記（`task-tools-shared.ts:6` / `memo-tools-shared.ts:6`）。native モードの汎用一文で「推測で済ませず呼べ」を担保。退行時は D2 のフラグを一時的に `false` 側へ寄せて切り戻せる |
| cloud で per-tool prompt を落としたら**履歴再実行防止**が失われる（Codex 指摘1）— description に無い唯一の要点 | D6 で履歴ルールを共通ガイドラインへ抽出し両モードに常に注入。ユニットで注入有無を固定し、実挙動は cloud スモークで確認 |
| 既存テスト277番（gemini で `期限のない自由メモ` 注入を期待）が壊れる | **意図した期待反転**。テストを「gemini=非注入／lmstudio=注入」に書き換え（fix_instructions 参照）。CHANGELOG/PR に破壊的でない仕様変更として明記 |
| `currentEngine` 解決位置の移動で副作用 | `currentEngine` は元々 `engine || 'gemini'`。前方移動しても後段の provider 分岐は同じ値を使うだけ。移動後に provider 分岐が二重宣言にならないよう既存 `const currentEngine`（:297）を削除し1箇所に統合 |
| P5-B でローカルモデル挙動が退行 | P5-A と分離し実機スモーク後に適用。prompt は git で即戻せる粒度に留める |

---

## 8. スコープ外（やらないこと）

- ユーザー設定による誘導モード上書きトグル（`forcePromptedToolGuidance` 等）の新設 — YAGNI。設計上は差し込み可能にしておくのみ。
- connector 経路の変更（既に native-first）。
- 後処理サニタイズ（項目E）の削減 — 別タスク。native 化で cloud のサニタイズ必要性は下がるが、除去は E の計画で扱う。
- `description` 文言自体の再設計・多言語化 — 現状の description は routing を保持しており十分。
- **クライアント側 `useChatConnection.ts` の Timer Instructions の変更・一元化**（Gemini 懸念A）。影響範囲を広げないため本 P5 では触らない（→ §9 で将来課題として記録）。
- ツール名・フィルタ意味論・`@lmstudio/sdk` に関する変更（禁止事項）。

---

## 9. 既知の残存ドリフトと将来課題（Phase C 候補 — Gemini レビュー由来）

本 P5 は **chat-ai-service（バックエンド）に閉じた改修**であり、これは意図的なスコープ限定である。以下のドリフトは P5 完了後も残る。将来のリファクタリング課題（Phase C）としてバックログに記録する。

### 懸念A: クライアント側 Timer Instructions とのツール名ハードコード（最大の残存ドリフト）

`app/src/components/chatpanel/useChatConnection.ts:397` が、送信前の `systemPrompt` に `# Timer Instructions` ブロックを直接連結しており、その中に **`manageTasks` というツール名と使い分けルール（プロンプト作文）がハードコード**されている。

- 影響: バックエンドを native 化しても、クライアントが渡す `systemPrompt` 側に「manageTasks を使う/使わない」の routing 作文が残る。**クライアント⇔バックエンド間のプロンプト二重管理と意味的ドリフトは P5 では解消されない。**
- 本来 native-first を徹底するなら、この使い分けは manageTasks の `description`（既に保持）に委ね、クライアント側はタイマータグの**書式指示**だけに縮小すべき。ただしクライアント改修は影響範囲が広く（感情タグ等と同居、TTS 分岐等）、P5 のリスクを不必要に膨らませるため分離する。

### 懸念B: 「履歴の扱い」ルールの多重定義

P5-A 適用時点で、履歴関連ルールは概念的に3箇所に散在する:

| # | 場所 | スコープ | P5 での扱い |
| --- | --- | --- | --- |
| 1 | `useChatConnection.ts:397`（Timer Instructions 内 【履歴の扱い】） | タイマー再設定の抑止 | 変更しない（懸念A と一体・Phase C） |
| 2 | `toolUseSection` 末尾（P5-A で追加） | ツール実行全般の重複抑止 | P5-A で新設 |
| 3 | `manageTasks.prompt.ts:3`（【履歴の扱い】） | タスク再登録の抑止 | P5-B で削除（2 に一本化） |

- P5-B で 3 は 2 に統合されるが、1 は懸念A と同じ理由で残る。Phase C でクライアント側を整理する際に、1 と 2 の統合（あるいは 1 の書式指示への縮小）を検討する。

### Phase C（将来）の方向性

クライアント側 `systemPrompt` 構築（Timer Instructions・感情タグ等）を、バックエンド／共通プロンプト定義へ一元化し、ツール名ハードコードと履歴ルールの多重定義を解消する。**本 P5 のスコープ外**。

---

## 10. 制約（守ること — walkthrough §8 / review_claude 実装上の制約より）

1. **`@lmstudio/sdk` を撤去・置換しない**（`llm.act` が現役）。
2. **ツール名文字列を変更しない**（`ws.ts` が名前で分岐、`stripPseudoToolCalls` も名前でマッチ）。
3. **フィルタの意味論を変更しない**（`!tools`→全有効、`key !== false`、`configKey` 無し→常時有効）。
4. **タイマー相互排他ルールを共通ガイドライン（`tool-use-guideline.ts`）へ移さない**。manageTasks/manageMemos の per-tool prompt に置いたままにする（ツール無効時にルールごと消える利点を維持）。
5. **時刻注入を「履歴途中の system メッセージ」にしない**（`@ai-sdk/google` が throw）。時刻は system prompt 末尾・分単位のまま。
6. 適用済み修正（P1〜P4）を巻き戻さない。
