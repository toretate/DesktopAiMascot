# irodori-tts-server health チェック & 起動コマンド案内(自動起動なし)

## Context(背景・目的)
TTS で「irodori」を選ぶと外部の irodori-tts-server(OpenAI互換 `POST /v1/audio/speech`、既定 `http://127.0.0.1:8088`)へ接続して合成する。lite化(INT4量子化)は **irodori-tts-server 側にパッチを当てて対応**する方針に決定したため、アプリ側は以下の軽量改善のみ:

- **(必須)** irodori-tts-server を health チェックし、落ちていれば **×アイコン**を表示。表示箇所 = TTS設定画面 + チャット中(TTS ON かつ engine=irodori かつ server down 時)。
- **(できれば)** server の起動コマンド/パスを TTS 設定画面に案内表示(静的テキスト)。
- **自動起動はしない**(ユーザが手動で起動する前提)。
- **エンジン値は既存 `irodori` のまま**(新エンジン・サイドカー・Python依存追加は一切なし)。

## 既存資産・制約
- `IrodoriTtsConnector.health(endpoint)`(`ui/src/connector/irodori-tts-connector.ts:78`)が `GET /health` を実装済みだが未使用 → 再利用。
- エラーアイコン表示パターンは既存(`VoiceGenSettingsPanel.vue:141-157` の `irodoriConnectionIcon/Class/Text`、`pi pi-times-circle text-red-400` 等)。現状は更新ボタン押下後のみ表示(`:337`)。
- **サーバーモード重要**: ブラウザから irodori server の `127.0.0.1:8088`(= Nodeサーバ機の localhost。リモートGPU機の可能性)へ直接到達できない。合成 `VoiceAiService.synthesizeIrodori`(`server/src/services/voice-ai-service.ts:81`)同様、health も Nodeサーバ側で実施。
- REST テンプレ `server/src/routes/ping.ts:5`、`index.ts:35-41` で `app.use('/api', ...)` 登録。
- Electron単体は `window.electronAPI` 経由(`VoiceGenSettingsPanel.vue:179`)。同機内なので renderer 直 fetch でも到達可。
- TTSトグルは `ChatPanel.vue:283-284`(`useTts`、`pi pi-volume-up/off`)→ ここに×バッジ併設。
- 軽微な不整合: `websocket.ts:195` と `useChatConnection.ts` の irodori fallback が `http://localhost:7861`、config 既定は `8088`。今回 health も同 endpoint を使うので fallback を `8088` に揃える(任意小修正)。

## 経路
health 状態は共有 `ref('unknown'|'ok'|'down')`。設定画面・チャット両方が同一 state を参照。
- Electron単体 = renderer 直(`IrodoriTtsConnector.health`)
- サーバーモード(web) = Node サーバ REST 経由(`GET /api/irodori/health?endpoint=`)→ サーバ側プローブ
分岐は `window.electronAPI` 有無で判定(既存合成コードと一貫)。

## 変更・新規ファイル

### A. サーバ側 health プローブ
- `server/src/services/voice-ai-service.ts`(変更) — `checkIrodoriHealth(endpoint): Promise<boolean>` を追加。`synthesizeIrodori` の AbortController+timeout(~5s)を流用し `GET ${endpoint}/health` の `response.ok` を返す。例外時 false。
- `server/src/routes/irodori-health.ts`(新規) — `ping.ts` テンプレで `router.get('/irodori/health', ...)`。`req.query.endpoint`(既定 `http://127.0.0.1:8088`)→ `checkIrodoriHealth` → `res.json({ ok })`。
- `server/src/index.ts`(変更) — import + `app.use('/api', irodoriHealthRoute)` を追加。

### B. UI 共有 health state + checker
- `ui/src/composables/useIrodoriHealth.ts`(新規・シングルトン) — モジュールスコープ共有 ref: `irodoriHealthState`('unknown'|'ok'|'down')、`irodoriHealthReason`、`isCheckingIrodori`。
  - `checkIrodoriHealth(endpoint)`: `window.electronAPI` 有り → `IrodoriTtsConnector.health`(try/catch で false 化)。無し → `fetch('/api/irodori/health?endpoint=' + encodeURIComponent(endpoint))` → `{ok}`。結果で state 更新、例外は 'down'。

### C. 設定画面(×アイコン + 起動コマンド案内)
- `ui/src/components/settings/VoiceGenSettingsPanel.vue`(変更、irodori ブロック `:294-342`)
  - `useIrodoriHealth()` を取り込み、**常設の health ステータス行**を endpoint 入力欄直下に追加(緑 `pi pi-check-circle text-green-400` / 赤 `pi pi-times-circle text-red-400` / unknown グレー)。
  - 契機: `onMounted`(engine===irodori 時) / `watch(irodoriEndpoint)` を debounce(~600ms) / 手動「接続確認」ボタン。
  - **起動コマンド案内(静的)**: 例 `uv run python -m irodori_openai_tts --host 0.0.0.0 --port 8088` と「lite(INT4)化は server 側パッチ」「自動起動しない/事前に手動起動が必要」注記。

### D. チャット中インジケータ
- `ui/src/components/ChatPanel.vue`(変更、TTSトグル `:283-284`)
  - `useIrodoriHealth()` + `selectedVoiceEngine`/`useTts`(storeToRefs に `selectedVoiceEngine` 追加)を使い、`useTts && selectedVoiceEngine==='irodori' && irodoriHealthState==='down'` の時にトグル横へ ×バッジ(`pi pi-times-circle text-red-400`、title="irodori-tts-server に接続できません")。
  - ポーリング: 条件成立中のみ `setInterval(~20s)`、解除/`onUnmounted` で clear。TTS ON 時にも1回チェック。

### E.(任意・小)整合
- `websocket.ts:195` と `useChatConnection.ts` の irodori fallback を `http://localhost:7861` → `http://127.0.0.1:8088` に統一。

## 想定リスク・対応
- サーバーモードでのブラウザ→irodori 到達不可 → Node REST 経由で回避(A/C)。
- Electron単体の到達 → 既存 listVoices と同設定で可。失敗時 down 表示。
- 過剰ポーリング → チャット側は「TTS ON かつ irodori」時のみ ~20s。設定画面は mount/変更(debounce)/手動のみ。
- 誤検知(初回ロード中) → `/health` はモデル非ロードの軽量EP。timeout ~5s。
- 非回帰 → 合成パスは無改修。追加はプローブと表示のみ。

## 実装順序
1. サーバ: `voice-ai-service.ts` に `checkIrodoriHealth` → `routes/irodori-health.ts` → `index.ts` 登録。`curl 'http://localhost:3000/api/irodori/health?endpoint=http://127.0.0.1:8088'` で確認。
2. UI: `composables/useIrodoriHealth.ts`。
3. UI: `VoiceGenSettingsPanel.vue`(常設ステータス + 契機 + 起動コマンド案内)。
4. UI: `ChatPanel.vue`(×バッジ + 条件付きポーリング)。
5.(任意)endpoint fallback 統一。

## 検証
- サーバーモード: server 起動 → 設定画面が緑、`/api/irodori/health` が `{ok:true}`。停止 → 赤×、TTS ON+irodori でチャットのトグル横にも×。
- Electron単体: server 起動/停止で設定・チャットの×切替確認。
- 回帰: 既存 irodori 合成・VOICEVOX が無改変で動作。`cd ui && npm run build` / `cd server && npm test` が通る。
