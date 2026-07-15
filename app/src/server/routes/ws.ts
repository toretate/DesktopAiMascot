import { defineWebSocketHandler } from 'h3';
import * as fs from 'fs';
import * as path from 'path';
import { ChatAiService } from '../utils/chat-ai-service';
import { VoiceAiService } from '../utils/voice-ai-service';
import { splitSentences } from '../utils/sentence-splitter';
import { sanitizeForIrodoriTTS } from '../utils/irodori-sanitizer';
import { filterDialogue } from '../utils/dialogue-filter';
import { authenticateUserToken } from '../middleware/auth';
import { normalizeTextForTts, stripResidualAsterisks } from '../utils/tts-normalizer';
import { PROJECT_ROOT, USERS_DIR } from '../utils/paths';
import { executeMemosTool, executeTasksTool } from '../utils/tool-executor';
import { updateTaskInDb } from '../utils/tasks-service';
import { isAuthBypassAllowed } from '../utils/auth-bypass';


// ユーザーごとの接続管理（crosswsのPeerオブジェクトをSetに保存）
const userConnections = new Map<string, Set<any>>();

function addConnection(userId: string, peer: any) {
    if (!userConnections.has(userId)) {
        userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(peer);
}

function removeConnection(userId: string, peer: any) {
    const conns = userConnections.get(userId);
    if (conns) {
        conns.delete(peer);
        if (conns.size === 0) {
            userConnections.delete(userId);
        }
    }
}

function broadcastToUser(userId: string, event: string, data: any) {
    const conns = userConnections.get(userId);
    if (conns) {
        const payload = JSON.stringify({ event, data });
        conns.forEach((peer) => {
            peer.send(payload);
        });
    }
}

function getPeerUserId(peer: { context: Record<string, unknown> }): string {
    const userId = peer.context.userId;
    return typeof userId === 'string' ? userId : 'anonymous';
}

// Cookieを手動でパースするヘルパー関数
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;
    cookieHeader.split(';').forEach(cookie => {
        const parts = cookie.split('=');
        const key = parts.shift()?.trim();
        if (key) {
            list[key] = decodeURIComponent(parts.join('='));
        }
    });
    return list;
}

export default defineWebSocketHandler({
    async open(peer) {
        console.log('[WS] Client connecting via Nitro...');
        
        const requestUrl = peer.request.url || '';
        const urlObj = new URL(requestUrl, 'http://localhost');
        
        // 1. クエリパラメータから token を取得
        let token = urlObj.searchParams.get('token') || '';

        // 2. Cookie から取得
        if (!token) {
            const cookieHeader = peer.request.headers.get('cookie') || '';
            const cookies = parseCookies(cookieHeader);
            token = cookies['session_token'] || '';
        }

        let userId = 'anonymous';
        try {
            if (isAuthBypassAllowed()) {
                userId = 'usr_local_dev_bypass';
                console.warn(`[WS] ALLOW_AUTH_BYPASS=true のため認証をバイパスします。User ID: ${userId}`);
            } else {
                if (!token) {
                    console.log('[WS] Authentication failed: No token provided');
                    peer.close(4001, 'Unauthorized: Token is required');
                    return;
                }
                const user = await authenticateUserToken(token);
                console.log(`[WS] Authentication successful for user: ${user.id}`);
                userId = user.id;
            }
        } catch (authError: any) {
            console.error('[WS] Authentication failed:', authError.message);
            peer.close(4003, `Forbidden: ${authError.message}`);
            return;
        }

        // コネクションの登録
        peer.context.userId = userId;
        addConnection(userId, peer);
        console.log(`[WS] Client connected successfully (User: ${userId})`);
    },

    async message(peer, msg) {
        const userId = getPeerUserId(peer);
        try {
            const rawMessage = msg.text();
            const parsed = JSON.parse(rawMessage);
            const { event, data } = parsed;

            if (event === 'chat-send') {
                const {
                    message,
                    apiKey,
                    systemPrompt,
                    model,
                    voicevoxSpeakerId,
                    voicevoxEndpoint,
                    selectedVoiceEngine,
                    irodoriEndpoint,
                    irodoriModel,
                    irodoriVoice,
                    engine,
                    lmstudioEndpoint,
                    history,
                    useTts,
                    ttsReadNarrative,
                    saveVoice,
                    showVoiceLog,
                    attachments,
                    tools,
                    temperature,
                    frequencyPenalty,
                    repetitionPenalty,
                    maxOutputTokens,
                    enableThinking,
                    ttsDictionary
                } = data;

                console.log(`=========================================`);
                console.log(`[WS] chat-send received (Nitro)!`);
                console.log(` - Message: "${message}"`);
                console.log(` - Engine: "${engine}"`);
                console.log(` - Model: "${model}"`);
                console.log(` - Temperature: ${temperature}`);
                console.log(` - Frequency Penalty: ${frequencyPenalty}`);
                console.log(` - Repetition Penalty: ${repetitionPenalty}`);
                console.log(` - Max Output Tokens: ${maxOutputTokens}`);
                console.log(` - Enable Thinking: ${enableThinking}`);
                console.log(` - API Key: "${apiKey ? '***(設定あり)***' : '(設定なし)'}"`);
                console.log(` - LM Studio Endpoint: "${lmstudioEndpoint}"`);
                console.log(` - History elements: ${history ? history.length : 0}`);
                console.log(` - Attachments count: ${attachments ? attachments.length : 0}`);
                console.log(`=========================================`);

                // 1. 考え中ステータスをプッシュ
                peer.send(JSON.stringify({
                    event: 'chat-status',
                    data: { status: 'thinking' }
                }));

                let reply = '';
                try {
                    reply = await ChatAiService.generateResponse({
                        message,
                        apiKey,
                        systemPrompt,
                        model,
                        temperature,
                        frequencyPenalty,
                        repetitionPenalty,
                        maxOutputTokens,
                        enableThinking,
                        engine,
                        lmstudioEndpoint,
                        history,
                        attachments,
                        tools,
                        onToolExecute: async (toolName, args) => {
                            const userId = ((peer as any).ctx && (peer as any).ctx.userId) || 'anonymous';
                            console.log(`[WS] Tool execution intercept: ${toolName}`, args);
                            if (toolName !== 'manageTasks' && toolName !== 'manageMemos') {
                                return null;
                            }
                            try {
                                if (toolName === 'manageMemos') {
                                    return await executeMemosTool(userId, args);
                                }
                                return await executeTasksTool(userId, args);
                            } catch (e: any) {
                                console.error(`[WS] Intercepted tool ${toolName} (action: ${args.action}) failed:`, e.message);
                                return JSON.stringify({
                                    success: false,
                                    error: e.message
                                });
                            }
                        },
                        onToolResult: (toolName, input, output) => {
                            const userId = ((peer as any).ctx && (peer as any).ctx.userId) || 'anonymous';
                            if (toolName !== 'manageTasks' && toolName !== 'manageMemos') {
                                return;
                            }
                            if (toolName === 'manageMemos') {
                                try {
                                    const parsedOutput = typeof output === 'string' ? JSON.parse(output) : output;
                                    if (!parsedOutput || !parsedOutput.success) return;
                                    console.log(`[WS] Tool execution detected in ws.ts: ${toolName} (action: ${input.action})`, input);
                                    peer.send(JSON.stringify({
                                        event: 'memo-action',
                                        data: {
                                            action: input.action,
                                            memoId: parsedOutput.id || input.id,
                                            memo: parsedOutput.memo
                                        }
                                    }));
                                } catch (e: any) {
                                    console.error('[WS] Failed to sync tool memo action to client:', e.message);
                                }
                                return;
                            }
                            try {
                                const parsedOutput = typeof output === 'string' ? JSON.parse(output) : output;
                                if (!parsedOutput || !parsedOutput.success) {
                                    return;
                                }
                                console.log(`[WS] Tool execution detected in ws.ts: ${toolName} (action: ${input.action})`, input);
                                if (input.action === 'add' || input.action === 'update') {
                                    // カテゴリの最新スナップショットを取得するため、無害な空更新でDBから再取得する
                                    const saved = updateTaskInDb(userId, parsedOutput.id, {});
                                    peer.send(JSON.stringify({
                                        event: 'task-action',
                                        data: {
                                            action: input.action === 'add' ? (input.scheduledAt ? 'addSchedule' : 'addTask') : 'updateTask',
                                            categories: saved.categories,
                                            task: saved.task
                                        }
                                    }));
                                } else if (input.action === 'delete') {
                                    peer.send(JSON.stringify({
                                        event: 'task-action',
                                        data: {
                                            action: 'deleteTask',
                                            taskId: input.id
                                        }
                                    }));
                                }
                            } catch (e: any) {
                                console.error('[WS] Failed to sync tool task action to client:', e.message);
                            }
                        }
                    });
                } catch (aiError: any) {
                    console.error('[WS] AI Engine Error:', aiError.message);
                    let detailMessage = aiError.message;
                    const responseBodyStr = aiError.responseBody || '';
                    const errorStr = (detailMessage + ' ' + responseBodyStr).toLowerCase();

                    // コンテキスト制限エラーのときは分かりやすい日本語メッセージにする
                    if (
                        errorStr.includes('context size') ||
                        errorStr.includes('context length') ||
                        errorStr.includes('context_length_exceeded') ||
                        errorStr.includes('context exceeded')
                    ) {
                        detailMessage = 'AIのコンテキスト長（一度に処理できる会話量）の上限を超えました。LM Studio等の設定画面で「Context Length」を 4096 や 8192 以上に引き上げてください。';
                    } else if (aiError.responseBody) {
                        try {
                            const parsedBody = JSON.parse(aiError.responseBody);
                            if (parsedBody.error) {
                                detailMessage += ` (${parsedBody.error})`;
                            } else {
                                detailMessage += ` (${aiError.responseBody})`;
                            }
                        } catch {
                            detailMessage += ` (${aiError.responseBody})`;
                        }
                    }
                    peer.send(JSON.stringify({
                        event: 'chat-error',
                        data: { message: `AIサーバーとの通信エラー: ${detailMessage}` }
                    }));
                    return;
                }

                let timerData: { seconds: number; memo: string } | null = null;
                const timerMatch = reply.match(/\[TIMER:(\d+),(.+?)\]/i);
                if (timerMatch && timerMatch[1] && timerMatch[2]) {
                    timerData = {
                        seconds: parseInt(timerMatch[1], 10),
                        memo: timerMatch[2].trim()
                    };
                }

                const cleanReply = reply.replace(/\[TIMER:.*?\]/gi, '').trim();

                let detectedEmotion = 'neutral';
                const emotionMatch = cleanReply.match(/\[(\w+)\]/);
                if (emotionMatch && emotionMatch[1]) {
                    detectedEmotion = emotionMatch[1].toLowerCase().trim();
                }

                // 表情対応処理（detectedEmotionの抽出）を行ってから、表示用テキストと音声テキストから表情タグを除去
                const speechText = cleanReply.replace(/\[\w+\]/g, '').trim();

                peer.send(JSON.stringify({
                    event: 'chat-response',
                    data: {
                        text: speechText,
                        speechText: speechText,
                        emotion: detectedEmotion
                    }
                }));

                if (timerData) {
                    const durationMs = timerData.seconds * 1000;
                    console.log(`[WS] Timer registered for user ${userId}: ${timerData.seconds}s, Memo: "${timerData.memo}"`);
                    setTimeout(() => {
                        console.log(`[WS] Timer triggered for user ${userId}: "${timerData!.memo}"`);
                        broadcastToUser(userId, 'timer-trigger', {
                            memo: timerData!.memo
                        });
                    }, durationMs);
                }

                if (speechText && useTts !== false) {
                    const voiceEngine = selectedVoiceEngine || 'voicevox';
                    const baseUrl = voicevoxEndpoint || 'http://localhost:50021';
                    const speaker = voicevoxSpeakerId !== undefined ? voicevoxSpeakerId : 2;
                    const irodoriUrl = irodoriEndpoint || 'http://localhost:7861';
                    const irodoriModelName = irodoriModel || 'irodori-tts-500m-v3';
                    const irodoriVoiceName = irodoriVoice || 'default';

                    const normalized = normalizeTextForTts(speechText, ttsDictionary);
                    const dialogueFiltered = ttsReadNarrative === false ? filterDialogue(normalized) : normalized;
                    const targetSpeechText = stripResidualAsterisks(dialogueFiltered);

                    if (targetSpeechText.trim()) {
                        const processedSentences = splitSentences(targetSpeechText)
                            .map(sentence => voiceEngine === 'irodori' ? sanitizeForIrodoriTTS(sentence).trim() : sentence)
                            .filter(sentence => sentence.length > 0);

                        const synthPromises = processedSentences.map(sentence => {
                            if (voiceEngine === 'irodori') {
                                return VoiceAiService.synthesizeIrodori(sentence, irodoriUrl, irodoriModelName, irodoriVoiceName, detectedEmotion, showVoiceLog !== false);
                            } else {
                                return VoiceAiService.synthesize(sentence, speaker, baseUrl, showVoiceLog !== false);
                            }
                        });

                        (async () => {
                            for (const promise of synthPromises) {
                                try {
                                    const base64Audio = await promise;
                                    if (base64Audio) {
                                        peer.send(JSON.stringify({
                                            event: 'chat-audio',
                                            data: { audio: base64Audio }
                                        }));

                                        if (data.saveVoice) {
                                            try {
                                                const today = new Date();
                                                const yyyy = today.getFullYear();
                                                const mm = String(today.getMonth() + 1).padStart(2, '0');
                                                const dd = String(today.getDate()).padStart(2, '0');
                                                const dateStr = `${yyyy}${mm}${dd}`;

                                                const mascotId = data.activeMascotId || 'default';
                                                const dirPath = path.join(USERS_DIR, userId, 'mascots', mascotId, 'voices', dateStr);
                                                
                                                if (!fs.existsSync(dirPath)) {
                                                    fs.mkdirSync(dirPath, { recursive: true });
                                                }

                                                const extension = voiceEngine === 'irodori' ? 'mp3' : 'wav';
                                                const filename = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
                                                const filePath = path.join(dirPath, filename);

                                                fs.writeFileSync(filePath, Buffer.from(base64Audio, 'base64'));
                                                console.log(`[WS] Voice saved to: ${filePath}`);
                                            } catch (saveErr: any) {
                                                console.error('[WS] Failed to save voice file:', saveErr.message);
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.error('[WS] VOICEVOX並行合成エラー:', err);
                                }
                            }
                        })();
                    }
                }
            }
        } catch (e: any) {
            console.error('[WS] Error processing message:', e.message);
        }
    },

    close(peer, details) {
        const userId = getPeerUserId(peer);
        console.log(`[WS] Client disconnected (User: ${userId}, Details: ${JSON.stringify(details)})`);
        removeConnection(userId, peer);
    }
});
