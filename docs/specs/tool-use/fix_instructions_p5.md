# tool-use 修正指示書 P5（for Codex / Gemini）— ツール誘導の native function-calling 化

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-13 |
| 対象ブランチ | `featue/tools/memo` |
| 基準コミット | `dfb8989` |
| 根拠文書 | `review_claude.md` 項目C |
| 設計文書 | `plan_p5_native_tooling.md`（**先に読むこと**） |
| アーキ現状 | `walkthrough_opus.md`（tool-use の2経路構成） |

## この作業の目的（1行）

cloud モデル（gemini / openai）への手書きツールガイドライン注入を撤廃し、`description` + JSON スキーマによる native function-calling を主役にする。ローカルモデル（lmstudio）の誘導は現状維持。

---

## 0. 前提・禁止事項（必読）

1. **`@lmstudio/sdk` を削除・置換しない。** `lmstudio-connector.ts:166` の `llm.act(chatInstance, filteredTools.map(t => t.tool), …)` が SDK の `tool()` を現役利用している。
2. **ツール名文字列（`getWeather` / `manageTasks` 等）を変更しない。** `ws.ts` が名前で分岐し、`stripPseudoToolCalls` も名前でマッチする。
3. **フィルタ意味論を変更しない。** `filterEnabledTools`（`src/skills/tool-use/index.ts:78`）の `!tools`→全有効 / `configKey === undefined`→常時有効 / `tools[key] !== false` をそのまま使う。
4. **タイマー相互排他ルールを共通ガイドライン（`tool-use-guideline.ts`）へ移さない。** manageTasks / manageMemos の per-tool prompt に残す。
5. **時刻注入を「履歴途中の system メッセージ」にしない。** `@ai-sdk/google`（v3.0.83）は先頭以外の system メッセージで throw する。時刻は system prompt 末尾・分単位のまま。
6. **connector（`lmstudio-connector.ts`）は変更しない。** 既に native-first（per-tool prompt 非注入）。
7. **クライアント側 `app/src/components/chatpanel/useChatConnection.ts:397` の Timer Instructions を変更しない。** ここには `manageTasks` のツール名と使い分けルールがハードコードされており（Gemini 懸念A）、本来 native-first 化で整理したい対象だが、クライアント改修は影響範囲が広く P5 のスコープ外（将来 Phase C。`plan_p5_native_tooling.md` §9 参照）。**このため P5 完了後もクライアント⇔バックエンド間のプロンプト二重管理は残る**（既知の残存ドリフト）。
8. P5-A（コード）と P5-B（prompt 文言）は**別コミットに分ける**。P5-B はローカル挙動に影響するため実機スモーク後にのみ適用（後述）。

**ベースライン**: 開始前に下記コマンドで対象2スイートを実行し、成功件数を記録すること（この件数を下回らないこと）。

```bash
cd app
npx vitest run src/server/__tests__/chat-ai-service.test.ts src/skills/tool-use/__tests__/tool-use.test.ts
```

---

## P5-A: chat-ai-service に tier-aware 分岐を導入（コード）＋履歴ルールの共通化

対象ファイル: `app/src/server/utils/chat-ai-service.ts` のみ（`tool-use-guideline.ts` は触らない）。

### 手順

1. **`currentEngine` の解決を前方へ移動する。**
   現在 `currentEngine` は `:297` で `const currentEngine = engine || 'gemini';` として宣言されている。これを **ツール使用ガイドライン構築（`:186` 付近）より前**に移動し、`:297` の宣言は削除して1箇所に統合する（provider 分岐は移動後の同名変数を参照するだけで挙動不変）。

2. **誘導モードのフラグを定義する。** 移動した `currentEngine` の直後に:

   ```typescript
   // native function-calling を信頼できるモデルか（cloud=true / ローカル弱モデル=false）。
   // cloud は description + JSON スキーマで十分に誘導できるため、手書きの per-tool
   // ガイドラインは注入しない。ローカル(lmstudio)は弱いため従来どおり注入する。
   const preferNativeToolGuidance = currentEngine !== 'lmstudio';
   ```

3. **`toolUseSection` の構築（現 `:194-200`）を分岐に置き換え、末尾に履歴ルールを追加する（D6 / Codex 指摘1 / Gemini 懸念C）。**
   共通テンプレート（`tool-use-guideline.ts`）は**触らない**。落とすのは per-tool の日本語 `prompt` 連結のみ。履歴ルールは `toolUseSection` 内＝**ツールが有効なときだけ**注入する（ツール皆無時のノイズ回避）。

   ```typescript
   const toolListStr = activeToolDescriptions.join(', ');
   let toolUseSection = '';
   if (activeToolDescriptions.length === 0) {
       toolUseSection = `- 利用可能なツールはありません。`;
   } else {
       if (preferNativeToolGuidance) {
           // native モード（cloud）: 誘導は description + JSON スキーマに委ねる。
           // per-tool の日本語ガイドラインは注入しない。
           toolUseSection =
               `- 以下のツールが使用可能です: ${toolListStr}\n` +
               `- 適切な状況では推測で会話を完結させず、対応するツールを呼び出してください。`;
       } else {
           // prompted モード（ローカル弱モデル）: 従来どおり per-tool ガイドラインを連結
           toolUseSection = `- 以下のツールが使用可能です: ${toolListStr}\n` + activeToolPrompts.join('\n');
       }
       // 履歴の重複実行防止（両モード共通・ツール有効時のみ）。
       // ⚠️ 「最新メッセージで新たに依頼された場合のみ実行」のような単純化は禁止。
       //    「削除していい？→はい」のような正当な確認・承認フローまで止めてしまうため、
       //    「完了済み依頼の重複防止」と「未完了依頼の継続」を必ず区別する。
       toolUseSection +=
           `\n- 会話履歴中で既にツール実行または完了応答まで済んだ依頼を、重複して再実行しないでください。` +
           `ただし、確認・追加情報の提示・承認など、最新のユーザーメッセージが未完了の依頼を継続する内容である場合は、履歴の文脈を踏まえて実行してください。`;
   }
   ```

   - `activeToolDescriptions` / `activeToolPrompts` を構築する `filteredTools.forEach(...)`（現 `:189-192`）は**そのまま残す**。
   - `{{toolUseSection}}` への置換（現 `:203`、関数形式 replace）は変更しない。
   - 履歴ルールの背景: このルールは現状 `manageTasks.prompt.ts:3` にしか無く、native モードで per-tool prompt を落とすと cloud から失われる（Codex 指摘1）。**タイマー相互排他ルールではない**ので禁止事項4に抵触しない（タイマールールは `manageTasks.prompt.ts` に残す）。
   - **P5-A では `manageTasks.prompt.ts` の履歴段落は削除しない**（local は toolUseSection 末尾＋per-tool の二重になるが無害。重複削除は P5-B）。

4. **それ以外（vercelTools 変換・`generateText` 呼び出し・後処理サニタイズ・時刻注入・順序）は一切変更しない。**

### P5-A のテスト更新（`app/src/server/__tests__/chat-ai-service.test.ts`）

1. **既存テスト `generateResponse_systemプロンプトにmanageMemosの個別ガイドラインが注入されること`（:277）を書き換える。**
   このテストは `engine: 'gemini'` で `options.system` が `期限のない自由メモ`（per-tool prompt 本文）を含むことを期待しているが、P5-A では **native モードなので含まれなくなる**。次の2点に反転・分割する:

   - gemini（native）: `options.system` は per-tool prompt 本文（`期限のない自由メモ`）を**含まない**。ただしツール一覧に `manageMemos` は載る（`options.system` が文字列 `manageMemos` を含む）し、`Object.keys(options.tools)` に `manageMemos` が含まれる（native function-calling 自体は不変）。
   - 新規テストを追加: `engine: 'lmstudio'`（`lmstudioEndpoint` 指定）では `options.system` が per-tool prompt 本文（`期限のない自由メモ`）を**含む**こと。

   ```typescript
   it('generateResponse_cloudエンジンではper-toolガイドライン本文を注入せずツール一覧のみになること', async () => {
       vi.mocked(generateText).mockReset().mockResolvedValueOnce({
           text: 'メモしたよ！', finishReason: 'stop',
           steps: [{ text: 'メモしたよ！', toolCalls: [], toolResults: [], finishReason: 'stop' }]
       } as any);
       await ChatAiService.generateResponse({
           message: '買い物メモに牛乳を追加して', apiKey: 'k',
           systemPrompt: 'あなたはアシスタントです。', model: 'gemini-1.5-flash', engine: 'gemini'
       });
       const options = vi.mocked(generateText).mock.calls[0][0] as any;
       // native: ツール自体は登録される
       expect(Object.keys(options.tools)).toContain('manageMemos');
       // native: ツール一覧には名前が載る
       expect(options.system).toContain('manageMemos');
       // native: per-tool の手書きガイドライン本文は注入されない
       expect(options.system).not.toContain('期限のない自由メモ');
   });

   it('generateResponse_ローカルエンジンではper-toolガイドライン本文が注入されること', async () => {
       vi.mocked(generateText).mockReset().mockResolvedValueOnce({
           text: 'メモしたよ！', finishReason: 'stop',
           steps: [{ text: 'メモしたよ！', toolCalls: [], toolResults: [], finishReason: 'stop' }]
       } as any);
       await ChatAiService.generateResponse({
           message: '買い物メモに牛乳を追加して', apiKey: 'k',
           systemPrompt: 'あなたはアシスタントです。', model: 'local-model',
           engine: 'lmstudio', lmstudioEndpoint: 'http://localhost:1234/v1'
       });
       const options = vi.mocked(generateText).mock.calls[0][0] as any;
       expect(options.system).toContain('期限のない自由メモ');
   });
   ```

3. **OpenAI エンジンのテストを追加する（Codex 指摘2）。** 受け入れ条件が OpenAI を名指しするので、`engine: 'openai'` でも per-tool prompt が非注入かつ `tools` が維持されることを固定する。

   ```typescript
   it('generateResponse_openaiエンジンでもnativeモードになりper-toolガイドライン本文を注入しないこと', async () => {
       vi.mocked(generateText).mockReset().mockResolvedValueOnce({
           text: 'メモしたよ！', finishReason: 'stop',
           steps: [{ text: 'メモしたよ！', toolCalls: [], toolResults: [], finishReason: 'stop' }]
       } as any);
       await ChatAiService.generateResponse({
           message: '買い物メモに牛乳を追加して', apiKey: 'k',
           systemPrompt: 'あなたはアシスタントです。', model: 'gpt-4o', engine: 'openai'
       });
       const options = vi.mocked(generateText).mock.calls[0][0] as any;
       expect(Object.keys(options.tools)).toContain('manageMemos');
       expect(options.system).not.toContain('期限のない自由メモ');
   });
   ```

4. **履歴再実行防止ルールが両モードに注入されることを固定する（D6）。** モデルの履歴判断そのものはモックでは検証できないため、ここでは system prompt にルール文が**含まれること**だけを固定する（実挙動は cloud スモークで確認）。

   ```typescript
   it('generateResponse_履歴再実行防止ルールがcloud/localの両モードのsystemに含まれること', async () => {
       const mk = () => ({ text: 'ok', finishReason: 'stop',
           steps: [{ text: 'ok', toolCalls: [], toolResults: [], finishReason: 'stop' }] } as any);
       const marker = '重複して再実行しない'; // tool-use-guideline.ts の追記文言に合わせる

       vi.mocked(generateText).mockReset().mockResolvedValueOnce(mk());
       await ChatAiService.generateResponse({
           message: 'こんにちは', apiKey: 'k', systemPrompt: 'x', model: 'gemini-1.5-flash', engine: 'gemini' });
       expect(((vi.mocked(generateText).mock.calls[0][0]) as any).system).toContain(marker);

       vi.mocked(generateText).mockReset().mockResolvedValueOnce(mk());
       await ChatAiService.generateResponse({
           message: 'こんにちは', apiKey: 'k', systemPrompt: 'x', model: 'local-model',
           engine: 'lmstudio', lmstudioEndpoint: 'http://localhost:1234/v1' });
       expect(((vi.mocked(generateText).mock.calls[0][0]) as any).system).toContain(marker);
   });
   ```

5. **他の既存テストは無修正で通過すること。** 特に順序テスト（`ペルソナ→ガイドライン→時刻`）と temperature テストは engine が gemini でも `# ツール使用ガイドライン` 見出し・時刻・temperature は不変なので通る。

### P5-A の受け入れ条件

- gemini **および openai** で `system` に per-tool prompt 本文が含まれない／ツール一覧と共通出力ルールは含まれる。
- lmstudio で per-tool prompt 本文が従来どおり含まれる。
- 履歴再実行防止ルールが cloud / local 両モードの `system` に含まれる。
- 両モードとも `tools` に全有効ツールが登録される。
- 対象2スイート成功（上記テスト反映後、ベースライン件数以上）。

---

## P5-B: per-tool `prompt` の役割純化（prompt 文言）※実機スモーク後に適用

対象: `app/src/skills/tool-use/prompts/*.prompt.ts`。**P5-A とは別コミット**。

### 方針

native 化後、per-tool `prompt` は lmstudio 経路でのみ使われる。各 `prompt` から `description` の逐語的言い換えを減らし、「ローカルモデルに確実にツールを呼ばせるための imperative／routing 強調」に純化する。

- 単純ツール（getWeather / adjustVolume / launchApp / getGPSLocation / searchWeb）: description とほぼ同義の1文。**大幅変更は不要**だが、description の言い換えではなく「必ず対応ツールを呼ぶ」ことを促す短文に寄せる（ドリフト源を減らす）。判断に迷う場合は現状維持でよい（P5-B の主眼は manageTasks/Memos）。
- manageTasks / manageMemos: description に既にある区別説明の重複を削り、**「タイマーではなく manageTasks/Memos を使う」という routing 判断の強調だけ**を残す。**TIMER 相互排他ルールは per-tool prompt に残置（禁止事項4）。**
- **履歴の扱いルールの重複削除（D6 の後始末）**: P5-A で `toolUseSection` 末尾に共通の履歴ルールを追加済みのため、`manageTasks.prompt.ts:3` の 【履歴の扱い】 段落を**削除**する（一本化＝ドリフト源を除去）。TIMER 段落は残す。※これは文言変更なので下記スモークゲートの対象。※クライアント側 `useChatConnection.ts` のタイマー版【履歴の扱い】は懸念A（Phase C）として残置し、本 P5 では触らない。

### 適用ゲート（重要）

P5-B は**ローカルモデル挙動を変える**ため、`docs/plans` や PR に結果を記録した上で、次の LM Studio 実機スモークで退行しないことを確認してからマージする:

1. 「東京の天気は？」→ `getWeather` が呼ばれる。
2. 「レポート作成を明日15時にタスク登録して」→ `manageTasks`（action=add, scheduledAt 付き）が呼ばれる。
3. 「3分後に通知して」→ **`manageTasks` を呼ばず**タイマータグで処理される。
4. 「買い物メモに牛乳を追加して」→ `manageMemos`（action=add）が呼ばれる。
5. **（重複防止）** 履歴に**完了応答まで済んだ**タスク追加があり、今回の発話が曖昧（例:「うん」「よろしく」）なとき、**過去の依頼を再登録しない**。
6. **（継続の維持）** 「明日の会議を削除して」→アシスタントが「削除していい？」と確認→ユーザー「はい」のとき、**manageTasks(action=delete) を実行する**（確認フローの継続を止めない）。

退行が出たら該当 prompt を戻す（git 粒度を prompt 単位に保つ）。実機が用意できない場合は **P5-B を保留し P5-A のみをマージ**してよい（P5-A 単独で指摘Cの主要部の解消＋履歴ルールの cloud 保持は達成される）。

### cloud スモーク（Codex 指摘1）— P5-A の検証として推奨

履歴再実行防止はモデル判断に依存するため、Gemini / OpenAI 実機で上記スモーク5・6の**両方**を確認する（モックでは system への注入有無しか検証できない）。特に6（確認・承認フローの継続）が止まらないことは、共通ルールの文言が「重複防止」と「継続」を正しく区別できているかの判定になる。実機が無い場合はユニット（履歴ルールが system に含まれること）で最低限を担保し、スモーク未実施を報告に明記する。

---

## 検証

```bash
cd app
# P5-A 後（必須）
npx vitest run src/server/__tests__/chat-ai-service.test.ts src/skills/tool-use/__tests__/tool-use.test.ts
# 型チェック（P4 で OOM リグレッションの前例あり。デフォルトヒープで完走すること）
npx tsc --noEmit
```

- フルスイートで既存失敗する5ファイル（connector / useChatConnection / useSettingsWindow / expression-alignment×2）は P1 以前からの既存問題。ベースラインと同一失敗なら無視してよい（新規失敗のみ問題）。

---

## レポート要件

- 完了/未完了、変更ファイル一覧、テスト結果（ベースライン件数 → 変更後件数）を報告すること。
- cloud スモーク（履歴の重複防止＝スモーク5／確認フロー継続＝スモーク6）を実施したか、未実施ならユニットで担保した旨を明記すること。
- P5-B を適用したか保留したか、適用時は実機スモーク6項目の結果を明記すること。
- 判断に迷う点（native モードの汎用一文の文言、履歴ルールの共通ガイドライン内での配置、単純ツール prompt の扱い等）は独断で確定せず列挙して報告すること。
