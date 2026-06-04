<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, computed, watch } from 'vue';
import { useConfigStore } from '../store/config';
import { useMascotStore } from '../store/mascot';
import { storeToRefs } from 'pinia';
import { AudioPlaylist } from '../utils/AudioPlaylist';

interface Message {
    id: number;
    sender: 'user' | 'mascot';
    text: string;
}

interface ChatSession {
    id: string;
    title: string;
    timestamp: number;
    messages: Message[];
    summary?: string;
}

interface MascotHistory {
    activeSessionId?: string;
    sessions: ChatSession[];
}

const allHistories = ref<Record<string, MascotHistory>>({});
const sessions = ref<ChatSession[]>([]);
const activeSessionId = ref<string | null>(null);
const messages = ref<Message[]>([]);
const showHistoryList = ref(false);

const inputText = ref('');
const messageContainer = ref<HTMLElement | null>(null);

// ---- Stores ----
const configStore = useConfigStore();
const mascotStore = useMascotStore();

const playlist = new AudioPlaylist((speaking) => {
    mascotStore.setSpeaking(speaking);
});

const {
    chatSendKey,
    chatFontFamily,
    chatOpacity,
    activeMascot
} = storeToRefs(configStore);

const {
    isLoading: isAiResponding
} = storeToRefs(mascotStore);

const getDefaultMessage = () => {
    return { id: 1, sender: 'mascot' as const, text: 'こんにちは！今日はどんなお話をしますか？' };
};

const createNewSession = (): ChatSession => {
    return {
        id: Date.now().toString(),
        title: '新しい話題',
        timestamp: Date.now(),
        messages: [getDefaultMessage()]
    };
};

const loadHistory = async () => {
    if (window.electronAPI) {
        try {
            const history = await window.electronAPI.getChatHistory();
            allHistories.value = history || {};
            applyActiveMascotHistory();
        } catch (e) {
            console.error('Failed to load chat history:', e);
        }
    } else {
        applyActiveMascotHistory();
    }
};

const applyActiveMascotHistory = () => {
    const mascotId = activeMascot.value?.id || 'default';
    if (!allHistories.value[mascotId]) {
        const initialSession = createNewSession();
        allHistories.value[mascotId] = {
            activeSessionId: initialSession.id,
            sessions: [initialSession]
        };
    }
    
    const mascotHistory = allHistories.value[mascotId];
    sessions.value = mascotHistory.sessions || [];
    
    let currentSession = sessions.value.find(s => s.id === mascotHistory.activeSessionId);
    if (!currentSession && sessions.value.length > 0) {
        currentSession = sessions.value[0];
    }
    
    if (currentSession) {
        activeSessionId.value = currentSession.id;
        messages.value = [...currentSession.messages];
    } else {
        const initialSession = createNewSession();
        sessions.value = [initialSession];
        allHistories.value[mascotId].sessions = sessions.value;
        allHistories.value[mascotId].activeSessionId = initialSession.id;
        activeSessionId.value = initialSession.id;
        messages.value = [...initialSession.messages];
    }
    nextTick(() => scrollToBottom());
};

const saveHistory = async () => {
    const mascotId = activeMascot.value?.id || 'default';
    
    if (activeSessionId.value) {
        const currentSession = sessions.value.find(s => s.id === activeSessionId.value);
        if (currentSession) {
            currentSession.messages = [...messages.value];
            const firstUserMsg = messages.value.find(m => m.sender === 'user');
            if (firstUserMsg && currentSession.title === '新しい話題') {
                currentSession.title = firstUserMsg.text.substring(0, 15) + (firstUserMsg.text.length > 15 ? '...' : '');
            }
        }
    }
    
    allHistories.value[mascotId] = {
        activeSessionId: activeSessionId.value || undefined,
        sessions: sessions.value
    };
    
    if (window.electronAPI) {
        try {
            await window.electronAPI.saveChatHistory(allHistories.value);
        } catch (e) {
            console.error('Failed to save chat history:', e);
        }
    }
};

const clearHistory = async () => {
    const newSession = createNewSession();
    sessions.value.unshift(newSession);
    activeSessionId.value = newSession.id;
    messages.value = [...newSession.messages];
    showHistoryList.value = false;
    await saveHistory();
};

const runCompaction = async (mascotId: string, sessionId: string) => {
    const session = sessions.value.find(s => s.id === sessionId);
    // メッセージが15件以上になったらコンパクションを実行
    const COMPACTION_THRESHOLD = 15;
    const PRESERVE_COUNT = 6; // 直近の6件はそのまま残す

    if (!session || session.messages.length < COMPACTION_THRESHOLD) return;

    // 最初の一件(デフォルト挨拶)と直近のPRESERVE_COUNT件以外のメッセージを要約対象にする
    const messagesToSummarize = session.messages.slice(1, -PRESERVE_COUNT);
    if (messagesToSummarize.length < 2) return;

    console.log(`[Compaction] Running compaction for session ${sessionId}. Messages to summarize: ${messagesToSummarize.length}`);

    // 要約用プロンプトの作成
    const chatText = messagesToSummarize.map(m => `${m.sender === 'user' ? 'ユーザー' : 'マスコット'}: ${m.text}`).join('\n');
    let summarizationPrompt = `以下の会話履歴を、今後の対話に必要な重要情報を残したまま、簡潔かつ日本語で1つの段落に要約してください。\n\n`;
    if (session.summary) {
        summarizationPrompt += `以前の要約:\n${session.summary}\n\n`;
    }
    summarizationPrompt += `要約対象の会話:\n${chatText}\n\n`;
    summarizationPrompt += `要約には、決定事項、重要な話題、マスターとの約束事などを含め、語尾などの不要な会話表現は取り除いてください。`;

    const mascot = activeMascot.value;
    const engine = configStore.selectedEngine || mascot?.aiConfig?.chat?.engine || 'gemini';
    let apiKey = '';
    if (engine === 'gemini') {
        apiKey = configStore.googleAiStudioApiKey || '';
    } else if (engine === 'openai') {
        apiKey = configStore.openaiApiKey || '';
    }
    const model = configStore.geminiModel || mascot?.aiConfig?.chat?.model || 'gemini-1.5-flash';
    const lmsEndpoint = configStore.lmstudioEndpoint || 'http://127.0.0.1:1234/v1/';

    let summary = '';
    try {
        if (window.electronAPI) {
            if (engine === 'lmstudio') {
                summary = await window.electronAPI.askLmStudio(summarizationPrompt, "あなたは優秀な対話要約アシスタントです。", model, lmsEndpoint);
            } else {
                if (!apiKey) return;
                summary = await window.electronAPI.askGemini(summarizationPrompt, apiKey, "あなたは優秀な対話要約アシスタントです。", model);
            }
        }
    } catch (e) {
        console.error('[Compaction] Summarization failed:', e);
        return;
    }

    if (summary && !summary.startsWith('Error:')) {
        summary = summary.replace(/\[\w+\]/g, '').trim();

        session.summary = summary;
        // 要約されたメッセージを削除し、最新のメッセージと最初のデフォルトメッセージだけを保持する
        const defaultMsg = session.messages[0];
        const preservedMessages = session.messages.slice(-PRESERVE_COUNT);
        session.messages = [defaultMsg, ...preservedMessages];
        
        // メッセージ表示を更新
        if (activeSessionId.value === sessionId) {
            messages.value = [...session.messages];
        }
        console.log('[Compaction] Compaction succeeded. New summary:', summary);
    }
};

const toggleHistoryList = () => {
    showHistoryList.value = !showHistoryList.value;
};

const selectSession = (sessionId: string) => {
    activeSessionId.value = sessionId;
    const currentSession = sessions.value.find(s => s.id === sessionId);
    if (currentSession) {
        messages.value = [...currentSession.messages];
    }
    showHistoryList.value = false;
    const mascotId = activeMascot.value?.id || 'default';
    if (allHistories.value[mascotId]) {
        allHistories.value[mascotId].activeSessionId = sessionId;
    }
    saveHistory();
    nextTick(() => scrollToBottom());
};

const deleteSession = async (sessionId: string, event: Event) => {
    event.stopPropagation();
    
    sessions.value = sessions.value.filter(s => s.id !== sessionId);
    
    if (sessions.value.length === 0) {
        const newSession = createNewSession();
        sessions.value = [newSession];
    }
    
    if (activeSessionId.value === sessionId) {
        activeSessionId.value = sessions.value[0].id;
        messages.value = [...sessions.value[0].messages];
    }
    
    const mascotId = activeMascot.value?.id || 'default';
    if (allHistories.value[mascotId]) {
        allHistories.value[mascotId].sessions = sessions.value;
        allHistories.value[mascotId].activeSessionId = activeSessionId.value || undefined;
    }
    
    await saveHistory();
};

const sendMessage = async () => {
    if (!inputText.value.trim() || isAiResponding.value) return;

    // 新しいメッセージの送信時は以前の再生を停止・クリアする
    playlist.stop();

    const userQuery = inputText.value;
    inputText.value = '';

    messages.value.push({
        id: Date.now(),
        sender: 'user',
        text: userQuery
    });

    // 履歴として送信するメッセージ（今回の送信分より前の、最大10件の過去メッセージ）
    const historyToSend = messages.value
        .filter(m => m.sender === 'user' || (m.sender === 'mascot' && m.text !== '考え中...' && !m.text.startsWith('接続に失敗しました') && !m.text.startsWith('サーバーに接続されていません') && !m.text.startsWith('接続エラー')))
        .slice(0, -1) // 最後のuserQueryを除く
        .slice(-10) // 最新10件を取得
        .map(m => ({ sender: m.sender, text: m.text }));

    mascotStore.setLoading(true);

    await nextTick();
    scrollToBottom();

    // アクティブなマスコットとそのAI設定を取得
    const mascot = activeMascot.value;
    
    // エンジン選択：システム全般設定の選択エンジンを最優先とし、無ければマスコット個別設定を使用
    const engine = configStore.selectedEngine || mascot?.aiConfig?.chat?.engine || 'gemini';
    
    // APIキーの取得
    let apiKey = '';
    if (engine === 'gemini') {
        apiKey = configStore.googleAiStudioApiKey || '';
    } else if (engine === 'openai') {
        apiKey = configStore.openaiApiKey || '';
    } else if (engine === 'anthropic') {
        apiKey = configStore.anthropicApiKey || '';
    }

    const lmsEndpoint = configStore.lmstudioEndpoint || 'http://127.0.0.1:1234/v1/';
    const voicevoxEndpointUrl = configStore.voicevoxEndpoint || 'http://localhost:50021';

    // モデル名：システム全般設定の選択モデルを最優先とし、無ければマスコット個別設定を使用
    let model = '';
    if (engine === 'lmstudio') {
        model = configStore.lmstudioModel || mascot?.aiConfig?.chat?.model || '';
    } else if (engine === 'gemini') {
        model = configStore.geminiModel || mascot?.aiConfig?.chat?.model || 'gemini-1.5-flash';
    } else if (engine === 'openai') {
        model = configStore.openaiModel || mascot?.aiConfig?.chat?.model || 'gpt-4o';
    } else if (engine === 'anthropic') {
        model = configStore.anthropicModel || mascot?.aiConfig?.chat?.model || 'claude-3-5-sonnet-latest';
    }

    // 音声話者：マスコット個別の話者IDを優先
    const voicevoxSpeakerId = mascot?.aiConfig?.voice?.speaker_id !== undefined 
        ? mascot.aiConfig.voice.speaker_id 
        : (configStore.voicevoxSpeaker !== undefined ? configStore.voicevoxSpeaker : 2);

    // システムプロンプト：マスコット個別の soul, identity, user 設定を読み込んで構築 (openclawスタイル)
    let systemPrompt = '';
    if (mascot && mascot.profile) {
        systemPrompt += `# Mascot Character Profile\n${mascot.profile}\n\n`;
    }

    if (window.electronAPI && window.electronAPI.getMascotPrompts && mascot) {
        try {
            const mascotPrompts = await window.electronAPI.getMascotPrompts(mascot.id);
            if (mascotPrompts.identity) {
                systemPrompt += `# Mascot Identity\n${mascotPrompts.identity}\n\n`;
            }
            if (mascotPrompts.soul) {
                systemPrompt += `# Mascot Soul / Tone / Personality\n${mascotPrompts.soul}\n\n`;
            }
            if (mascotPrompts.user) {
                systemPrompt += `# User Context & Relations\n${mascotPrompts.user}\n\n`;
            }
            if (mascotPrompts.agents) {
                systemPrompt += `# Mascot Rules & Action Guidelines\n${mascotPrompts.agents}\n\n`;
            }
            if (mascotPrompts.memory) {
                systemPrompt += `# Mascot Long-term Memory\n${mascotPrompts.memory}\n\n`;
            }
        } catch (e) {
            console.error('Failed to load mascot prompts via IPC:', e);
        }
    }

    if (!systemPrompt.trim()) {
        systemPrompt = `あなたは対話型のAIデスクトップマスコットです。親しみやすく返答してください。`;
    }

    // 感情タグの指示を追加（必須）
    if (!systemPrompt.includes('[happy]') && !systemPrompt.includes('感情タグ')) {
        systemPrompt += "\n# System Instructions\n回答の最後に、自分の現在の感情に合わせて [happy], [sad], [angry], [surprised], [neutral] のいずれかの感情タグを必ず1つ含めて終了してください。例:「こんにちは！ [happy]」";
    }

    // 会話要約（コンパクションされた履歴）がある場合はシステムプロンプトに組み込む
    const currentSession = sessions.value.find(s => s.id === activeSessionId.value);
    if (currentSession && currentSession.summary) {
        systemPrompt += `\n\n# Previous Conversation Summary\n以下はこれまでのマスターとの会話履歴の要約です。この文脈を考慮して返答してください。\n${currentSession.summary}\n`;
    }

    // AIの「考え中...」プレースホルダーを表示
    const aiMessageId = Date.now() + 1;
    messages.value.push({
        id: aiMessageId,
        sender: 'mascot',
        text: '考え中...'
    });
    
    await nextTick();
    scrollToBottom();

    // サーバー連携（WebSocket）の場合の送信処理
    if (configStore.useServer) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            connectWebSocket();
            const errorMsg = messages.value.find(m => m.id === aiMessageId);
            if (errorMsg) {
                errorMsg.text = 'サーバーに接続されていません。再接続を試みています。もう一度送信してください。';
            }
            mascotStore.setLoading(false);
            return;
        }

        socket.send(JSON.stringify({
            event: 'chat-send',
            data: {
                message: userQuery,
                apiKey: apiKey,
                systemPrompt: systemPrompt,
                model: model,
                voicevoxSpeakerId: voicevoxSpeakerId,
                voicevoxEndpoint: voicevoxEndpointUrl,
                engine: engine,
                lmstudioEndpoint: lmsEndpoint,
                history: historyToSend
            }
        }));
        await saveHistory();
        return;
    }

    try {
        let reply = '';
        if (window.electronAPI) {
            if (engine === 'lmstudio') {
                reply = await window.electronAPI.askLmStudio(userQuery, systemPrompt, model, lmsEndpoint, historyToSend);
            } else {
                if (!apiKey) {
                    throw new Error(`${engine.toUpperCase()} APIキーが未設定です。右クリックから設定画面を開き、APIキーを登録してください。`);
                }
                reply = await window.electronAPI.askGemini(userQuery, apiKey, systemPrompt, model, historyToSend);
            }
        } else {
            reply = 'ブラウザ実行時のモック回答です。[happy]';
        }

        // メッセージを実際の応答で更新
        const mascotMsg = messages.value.find(m => m.id === aiMessageId);
        if (mascotMsg) {
            mascotMsg.text = reply;
        }
        await runCompaction(mascot?.id || 'default', activeSessionId.value!);
        await saveHistory();

        // 応答テキストから感情タグ（[happy]など）をパースし、表情変更
        const emotionMatch = reply.match(/\[(\w+)\]/);
        if (emotionMatch && emotionMatch[1]) {
            const detectedEmotion = emotionMatch[1].toLowerCase();
            
            // ストア経由で表情を変更
            mascotStore.setEmotion(detectedEmotion);

            if (window.electronAPI) {
                // 必要であれば後方互換性のためにメインプロセスにも通知
                window.electronAPI.changeEmotion(detectedEmotion);
            }
        }

        await nextTick();
        scrollToBottom();

        // VOICEVOX音声合成と再生
        if (window.electronAPI) {
            const api = window.electronAPI;
            const speechText = reply.replace(/\[\w+\]/g, '').trim();
            
            // 文節ごとに分割
            const sentences = speechText
                .split(/(?<=[。！？\n])/)
                .map(s => s.trim())
                .filter(s => s.length > 0);

            // 並行して音声合成リクエストを開始
            const synthPromises = sentences.map(sentence =>
                api.synthesizeVoicevox(sentence, voicevoxSpeakerId, voicevoxEndpointUrl)
            );

            // 完了順（テキスト内の登場順）にプレイリストに追加していく
            (async () => {
                for (const promise of synthPromises) {
                    try {
                        const base64Audio = await promise;
                        if (base64Audio) {
                            playlist.push(base64Audio);
                        }
                    } catch (err) {
                        console.error('[ChatPanel] VOICEVOX並行合成エラー:', err);
                    }
                }
            })();
        }


    } catch (error: any) {
        const mascotMsg = messages.value.find(m => m.id === aiMessageId);
        if (mascotMsg) {
            mascotMsg.text = `接続に失敗しました: ${error.message}`;
        }
        mascotStore.setSpeaking(false);
        await saveHistory();
    } finally {
        mascotStore.setLoading(false);
        await nextTick();
        scrollToBottom();
    }
};

const scrollToBottom = () => {
    if (messageContainer.value) {
        messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
    }
};

const handleKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;

    if (chatSendKey.value === 'enter') {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    } else {
        if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }
};

let socket: WebSocket | null = null;
const isWsConnected = ref(false);

const connectWebSocket = () => {
    if (!configStore.useServer) {
        disconnectWebSocket();
        return;
    }

    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const wsUrl = `ws://${configStore.serverHost}:${configStore.serverPort}`;
    console.log(`[ChatPanel] Connecting to WebSocket: ${wsUrl}`);
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log('[ChatPanel] WebSocket connected');
        isWsConnected.value = true;
    };

    socket.onmessage = async (event) => {
        try {
            const parsed = JSON.parse(event.data);
            const { event: wsEvent, data } = parsed;

            if (wsEvent === 'chat-status') {
                if (data.status === 'thinking') {
                    mascotStore.setLoading(true);
                }
            } else if (wsEvent === 'chat-response') {
                const { text, emotion } = data;
                
                // メッセージを実際の応答で更新
                updateLastMascotMessage(text);
                const mascotId = activeMascot.value?.id || 'default';
                await runCompaction(mascotId, activeSessionId.value!);
                await saveHistory();
                
                // 表情を変更
                mascotStore.setEmotion(emotion);
                if (window.electronAPI) {
                    window.electronAPI.changeEmotion(emotion);
                }

                mascotStore.setLoading(false);
                await nextTick();
                scrollToBottom();
            } else if (wsEvent === 'chat-audio') {
                const { audio: base64Audio } = data;
                if (base64Audio) {
                    playlist.push(base64Audio);
                }
            } else if (wsEvent === 'chat-error') {
                updateLastMascotMessage(`接続エラー: ${data.message}`);
                await saveHistory();
                mascotStore.setLoading(false);
                mascotStore.setSpeaking(false);
            }
        } catch (e: any) {
            console.error('[ChatPanel] WebSocket message parsing error:', e.message);
        }
    };

    socket.onclose = () => {
        console.log('[ChatPanel] WebSocket disconnected');
        isWsConnected.value = false;
        socket = null;
        // 5秒後に自動再接続
        if (configStore.useServer) {
            setTimeout(connectWebSocket, 5000);
        }
    };

    socket.onerror = (err) => {
        console.error('[ChatPanel] WebSocket connection error:', err);
    };
};

const disconnectWebSocket = () => {
    if (socket) {
        socket.close();
        socket = null;
    }
    isWsConnected.value = false;
};

// mascot側メッセージの最後の一つを更新するヘルパー
const updateLastMascotMessage = (text: string) => {
    for (let i = messages.value.length - 1; i >= 0; i--) {
        if (messages.value[i].sender === 'mascot') {
            messages.value[i].text = text;
            break;
        }
    }
};

onMounted(async () => {
    // ストアの設定データを読み込み
    if (!configStore.isLoaded) {
        await configStore.loadConfig();
    }

    // チャット履歴の読み込み
    await loadHistory();

    // WebSocketの接続
    connectWebSocket();
});

onUnmounted(() => {
    disconnectWebSocket();
});

// マスコット切り替え時の履歴適用
watch(() => activeMascot.value?.id, () => {
    applyActiveMascotHistory();
});

// 設定変更時の再接続トリガーの監視
watch(() => configStore.useServer, (val) => {
    if (val) connectWebSocket();
    else disconnectWebSocket();
});

watch([() => configStore.serverHost, () => configStore.serverPort], () => {
    if (configStore.useServer) {
        disconnectWebSocket();
        connectWebSocket();
    }
});
</script>

<template>
    <div class="chat-wrapper" :style="{ fontFamily: chatFontFamily, backgroundColor: `rgba(255, 255, 255, ${chatOpacity})` }">
        <!-- グラスモーフィズム調のヘッダー -->
        <header class="chat-header drag-area">
            <span class="chat-title">{{ activeMascot ? `${activeMascot.name} Chat` : 'Mascot Chat' }}</span>
            <div class="header-actions no-drag">
                <button class="icon-btn" @click="clearHistory" title="新規話題"><i class="pi pi-plus"></i></button>
                <button class="icon-btn" @click="toggleHistoryList" :class="{ 'active-btn': showHistoryList }" title="履歴一覧"><i class="pi pi-history"></i></button>
            </div>
        </header>

        <!-- メッセージスクロール領域 -->
        <div v-if="!showHistoryList" class="message-container" ref="messageContainer">
            <div 
                v-for="msg in messages" 
                :key="msg.id" 
                class="message-row"
                :class="msg.sender"
            >
                <div class="bubble">
                    {{ msg.text }}
                </div>
            </div>
        </div>

        <!-- 履歴スレッド一覧領域 -->
        <div v-else class="history-container">
            <div class="history-list-header">
                <h3>対話履歴スレッド一覧</h3>
            </div>
            <div class="history-list">
                <div 
                    v-for="session in sessions" 
                    :key="session.id" 
                    class="history-item"
                    :class="{ active: session.id === activeSessionId }"
                    @click="selectSession(session.id)"
                >
                    <div class="history-item-content">
                        <span class="history-item-title">{{ session.title }}</span>
                        <span class="history-item-time">{{ new Date(session.timestamp).toLocaleString() }}</span>
                    </div>
                    <button class="delete-session-btn" @click="deleteSession(session.id, $event)" title="削除">
                        <i class="pi pi-trash"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- フッター（入力・送信） -->
        <footer v-if="!showHistoryList" class="chat-footer">
            <form @submit.prevent="sendMessage" class="input-form">
                <textarea 
                    v-model="inputText" 
                    placeholder="メッセージを入力..." 
                    class="message-input"
                    rows="1"
                    @keydown="handleKeyDown"
                ></textarea>
                <button type="submit" class="send-btn" :disabled="!inputText.trim()">
                    <i class="pi pi-send"></i>
                </button>
            </form>
        </footer>
    </div>
</template>

<style scoped>
.chat-wrapper {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.65);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 16px;
    box-sizing: border-box;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
}

.chat-header {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    background: rgba(255, 255, 255, 0.3);
    cursor: move;
}

.chat-title {
    font-size: 14px;
    font-weight: 600;
    color: #475569;
}

.header-actions {
    display: flex;
    gap: 8px;
}

.icon-btn {
    background: transparent;
    border: none;
    color: #64748b;
    cursor: pointer;
    font-size: 14px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.icon-btn:hover {
    color: #0f172a;
    background: rgba(0, 0, 0, 0.05);
}

.message-container {
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

/* スクロールバーのカスタマイズ */
.message-container::-webkit-scrollbar {
    width: 6px;
}
.message-container::-webkit-scrollbar-track {
    background: transparent;
}
.message-container::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.08);
    border-radius: 3px;
}

.message-row {
    display: flex;
    width: 100%;
}

.message-row.user {
    justify-content: flex-end;
}

.message-row.mascot {
    justify-content: flex-start;
}

.bubble {
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.4;
    word-break: break-all;
}

.user .bubble {
    background: #e9d5ff;
    color: #581c87;
    border-bottom-right-radius: 2px;
    box-shadow: 0 2px 8px rgba(168, 85, 247, 0.08);
}

.mascot .bubble {
    background: rgba(243, 232, 255, 0.7);
    color: #4a2c7a;
    border-bottom-left-radius: 2px;
    border: 1px solid rgba(168, 85, 247, 0.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.chat-footer {
    padding: 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    background: rgba(255, 255, 255, 0.2);
}

.input-form {
    display: flex;
    gap: 8px;
}

.message-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    padding: 8px 12px;
    color: #1e293b;
    font-size: 13px;
    outline: none;
    transition: all 0.2s ease;
    resize: none;
    font-family: inherit;
    height: 34px;
    box-sizing: border-box;
}

.message-input:focus {
    border-color: #a855f7;
    background: rgba(255, 255, 255, 0.8);
    box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.1);
}

.message-input::placeholder {
    color: #94a3b8;
}

.send-btn {
    background: #c084fc;
    border: none;
    color: #fff;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.send-btn:hover:not(:disabled) {
    background: #a855f7;
}

.send-btn:disabled {
    background: rgba(0, 0, 0, 0.05);
    color: rgba(0, 0, 0, 0.25);
    cursor: not-allowed;
}

/* 履歴スレッド一覧用スタイル */
.history-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: rgba(255, 255, 255, 0.4);
}

.history-list-header {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.history-list-header h3 {
    margin: 0;
    font-size: 13px;
    color: #475569;
    text-align: left;
}

.history-list {
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 8px;
}

.history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
}

.history-item:hover {
    background: rgba(168, 85, 247, 0.05);
    border-color: rgba(168, 85, 247, 0.2);
}

.history-item.active {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.3);
}

.history-item-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    overflow: hidden;
}

.history-item-title {
    font-size: 13px;
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
}

.history-item-time {
    font-size: 10px;
    color: #94a3b8;
    text-align: left;
}

.delete-session-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.delete-session-btn:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
}

.active-btn {
    color: #a855f7 !important;
    background: rgba(168, 85, 247, 0.1) !important;
}
</style>
