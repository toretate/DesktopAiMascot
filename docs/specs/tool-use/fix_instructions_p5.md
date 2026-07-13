# tool-use P5（完了記録）— ツール誘導の native function-calling 化

| 項目 | 内容 |
| --- | --- |
| 作成日 | 2026-07-13 |
| 状態 | **完了**（P5-A / P5-B ともコミット済み） |
| 対象ブランチ | `featue/tools/memo` |
| 根拠文書 | `review_claude.md` 項目C |
| 設計文書 | `plan_p5_native_tooling.md` |
| アーキ現状 | `walkthrough_opus.md`（tool-use の2経路構成） |

## 目的（1行）

cloud モデル（gemini / openai）への手書きツールガイドライン注入を撤廃し、`description` + JSON スキーマによる native function-calling を主役にする。ローカルモデル（lmstudio）の誘導は現状維持。

---

## 完了状況

| フェーズ | コミット | 内容 |
| --- | --- | --- |
| P5-A（コード） | `e9a90af` | `chat-ai-service.ts` に tier-aware 分岐（`preferNativeToolGuidance`）を導入。cloud は per-tool prompt 非注入・ツール一覧のみ、local は従来どおり注入。履歴再実行防止ルールを両モード共通で `toolUseSection` 末尾に注入。 |
| P5-B（prompt 文言） | `3c4686f` | per-tool `prompt` を純化（description の言い換えを削減し routing 強調に寄せる）。`manageTasks.prompt.ts` の【履歴の扱い】段落を削除して一本化（TIMER 相互排他ルールは残置）。実機テストのアサーション強化。 |

- 対象2スイート（`chat-ai-service.test.ts` / `tool-use.test.ts`）: **30 tests passed**。

---

## 残存事項（P5 スコープ外・将来対応）

1. **クライアント側プロンプトの二重管理（Phase C）**
   `app/src/components/chatpanel/useChatConnection.ts:397` の Timer Instructions に `manageTasks` のツール名と使い分けルールがハードコードされたまま。native-first 化で整理したい対象だが、クライアント改修は影響範囲が広いため P5 では未対応。**このためクライアント⇔バックエンド間のプロンプト二重管理（ドリフト源）が残存**。詳細は `plan_p5_native_tooling.md` §9。

2. **実機スモークの確認**
   履歴再実行防止・確認フロー継続はモデル判断依存のため、ユニットでは system への注入有無しか検証できない。以下は実機で退行しないことの確認が望ましい（未実施なら別途）:
   - cloud（gemini / openai）: 完了済み依頼の重複再実行をしない／「削除していい？→はい」の承認フローは継続する。
   - local（lmstudio）: 天気・タスク登録・タイマー（TIMERタグ）・メモ追加の routing、および上記の重複防止／継続。

---

## 恒久的な注意点（今後の改修で壊さないこと）

- **TIMER 相互排他ルールは per-tool prompt（`manageTasks` / `manageMemos`）に残す。** 共通ガイドライン（`tool-use-guideline.ts`）へは移さない。
- **時刻注入は system prompt 末尾・分単位のまま。** `@ai-sdk/google`（v3.0.83）は先頭以外の system メッセージで throw するため、「履歴途中の system メッセージ」にしない。
- **履歴再実行防止ルールの単純化禁止。** 「最新メッセージで新たに依頼された場合のみ実行」のような単純化は、正当な確認・承認フロー（「削除していい？→はい」）まで止めるため不可。「完了済み依頼の重複防止」と「未完了依頼の継続」を必ず区別する。
