import { defineWebSocketHandler } from 'h3';
import * as fs from 'fs';
import * as path from 'path';
import { ChatAiService } from '../utils/chat-ai-service';
import { VoiceAiService } from '../utils/voice-ai-service';
import { splitSentences } from '../utils/sentence-splitter';
import { sanitizeForIrodoriTTS } from '../utils/irodori-sanitizer';
import { authenticateUserToken } from '../middleware/auth';
import { PROJECT_ROOT } from '../utils/paths';

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
        
        const requestUrl = peer.url || '';
        const urlObj = new URL(requestUrl, 'http://localhost');
        
        // 1. クエリパラメータから token を取得
        let token = urlObj.searchParams.get('token') || '';

        // 2. Cookie から取得
        if (!token) {
            const headers = (peer as any).headers || {};
            const cookieHeader = headers['cookie'] || headers['Cookie'] || '';
            const cookies = parseCookies(cookieHeader);
            token = cookies['session_token'] || '';
        }

        const host = urlObj.hostname || '';
        const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';

        let userId = 'anonymous';
        try {
            if (isLocal) {
                userId = 'usr_local_dev_bypass';
                console.log(`[WS] Local client connected via bypass. User ID set to: ${userId}`);
            } else if (!process.env.GOOGLE_CLIENT_ID) {
                console.warn('[WS] 警告: GOOGLE_CLIENT_ID が環境変数に設定されていません。認証なしで接続を許可します。');
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
        peer.ctx = peer.ctx || {};
        peer.ctx.userId = userId;
        addConnection(userId, peer);
        console.log(`[WS] Client connected successfully (User: ${userId})`);
    },

    async message(peer, msg) {
        const userId = (peer.ctx && peer.ctx.userId) || 'anonymous';
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
                    saveVoice,
                    showVoiceLog,
                    attachments,
                    tools
                } = data;

                console.log(`=========================================`);
                console.log(`[WS] chat-send received (Nitro)!`);
                console.log(` - Message: "${message}"`);
                console.log(` - Engine: "${engine}"`);
                console.log(` - Model: "${model}"`);
                console.log(` - API Key: ${apiKey ? '***(設定あり)***' : '(設定なし)'}`);
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
                        engine,
                        lmstudioEndpoint,
                        history,
                        attachments,
                        tools
                    });
                } catch (aiError: any) {
                    console.error('[WS] AI Engine Error:', aiError.message);
                    peer.send(JSON.stringify({
                        event: 'chat-error',
                        data: { message: `AIサーバーとの通信エラー: ${aiError.message}` }
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

                const speechText = cleanReply.replace(/\[\w+\]/g, '').trim();

                peer.send(JSON.stringify({
                    event: 'chat-response',
                    data: {
                        text: cleanReply,
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

                    const processedSentences = splitSentences(speechText);

                    const synthPromises = processedSentences.map(sentence => {
                        if (voiceEngine === 'irodori') {
                            const cleanSentence = sanitizeForIrodoriTTS(sentence);
                            return VoiceAiService.synthesizeIrodori(cleanSentence, irodoriUrl, irodoriModelName, irodoriVoiceName, detectedEmotion, showVoiceLog !== false);
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
                                            const dirPath = path.join(PROJECT_ROOT, 'mascots', 'users', userId, mascotId, 'voices', dateStr);
                                            
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
        } catch (e: any) {
            console.error('[WS] Error processing message:', e.message);
        }
    },

    close(peer, details) {
        const userId = (peer.ctx && peer.ctx.userId) || 'anonymous';
        console.log(`[WS] Client disconnected (User: ${userId}, Details: ${JSON.stringify(details)})`);
        removeConnection(userId, peer);
    }
});
