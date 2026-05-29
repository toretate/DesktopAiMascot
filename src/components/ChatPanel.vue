<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';

interface Message {
    id: number;
    sender: 'user' | 'mascot';
    text: string;
}

const messages = ref<Message[]>([
    { id: 1, sender: 'mascot', text: 'こんにちは！今日はどんなお話をしますか？' }
]);

const inputText = ref('');
const messageContainer = ref<HTMLElement | null>(null);

const isAiResponding = ref(false);

// --- チャットウィンドウの個別設定 ---
const chatSendKey = ref('enter');
const chatFontFamily = ref('sans-serif');
const chatOpacity = ref(0.65);
let unsubscribeConfig: (() => void) | null = null;

const loadChatSettings = (configData: any) => {
    if (!configData) return;
    chatSendKey.value = configData.chatSendKey || 'enter';
    chatFontFamily.value = configData.chatFontFamily || 'sans-serif';
    chatOpacity.value = configData.chatOpacity !== undefined ? configData.chatOpacity : 0.65;
};

const sendMessage = async () => {
    if (!inputText.value.trim() || isAiResponding.value) return;

    const userQuery = inputText.value;
    inputText.value = '';

    messages.value.push({
        id: Date.now(),
        sender: 'user',
        text: userQuery
    });

    isAiResponding.value = true;

    await nextTick();
    scrollToBottom();

    // 設定データのロード
    let apiKey = '';
    let engine = 'gemini';
    let lmsModel = '';
    let lmsEndpoint = 'http://127.0.0.1:1234/v1/';
    let geminiModel = 'gemini-2.0-flash-exp';
    let openaiModel = 'gpt-4o';
    let anthropicModel = 'claude-3-5-sonnet-latest';
    let voicevoxSpeakerId = 2;
    let voicevoxEndpointUrl = 'http://localhost:50021';

    if (window.electronAPI) {
        const configData = await window.electronAPI.getAppConfig();
        if (configData) {
            engine = configData.selectedEngine || 'gemini';
            if (engine === 'gemini') {
                apiKey = configData.googleAiStudioApiKey || '';
            } else if (engine === 'openai') {
                apiKey = configData.openaiApiKey || '';
            } else if (engine === 'anthropic') {
                apiKey = configData.anthropicApiKey || '';
            } else {
                apiKey = '';
            }
            lmsModel = configData.lmstudioModel || '';
            lmsEndpoint = configData.lmstudioEndpoint || 'http://127.0.0.1:1234/v1/';
            geminiModel = configData.geminiModel || 'gemini-2.0-flash-exp';
            openaiModel = configData.openaiModel || 'gpt-4o';
            anthropicModel = configData.anthropicModel || 'claude-3-5-sonnet-latest';
            voicevoxSpeakerId = configData.voicevoxSpeaker !== undefined ? configData.voicevoxSpeaker : 2;
            voicevoxEndpointUrl = configData.voicevoxEndpoint || 'http://localhost:50021';
        }
    } else {
        engine = localStorage.getItem('selectedEngine') || 'gemini';
        if (engine === 'gemini') {
            apiKey = localStorage.getItem('GoogleAiStudioApiKey') || '';
        } else if (engine === 'openai') {
            apiKey = localStorage.getItem('openaiApiKey') || '';
        } else if (engine === 'anthropic') {
            apiKey = localStorage.getItem('anthropicApiKey') || '';
        } else {
            apiKey = '';
        }
        lmsModel = localStorage.getItem('lmstudioModel') || '';
        lmsEndpoint = localStorage.getItem('lmstudioEndpoint') || 'http://127.0.0.1:1234/v1/';
        geminiModel = localStorage.getItem('geminiModel') || 'gemini-2.0-flash-exp';
        openaiModel = localStorage.getItem('openaiModel') || 'gpt-4o';
        anthropicModel = localStorage.getItem('anthropicModel') || 'claude-3-5-sonnet-latest';
        
        const savedSpeaker = localStorage.getItem('voicevoxSpeaker');
        voicevoxSpeakerId = savedSpeaker ? parseInt(savedSpeaker) : 2;
        voicevoxEndpointUrl = localStorage.getItem('voicevoxEndpoint') || 'http://localhost:50021';
    }

    // 表情タグを含むシステムプロンプトの指定
    const systemPrompt = `あなたは対話型のAIデスクトップマスコットです。親しみやすく返答してください。回答の最後に、自分の現在の感情に合わせて [happy], [sad], [angry], [surprised], [neutral] のいずれかの感情タグを必ず1つ含めて終了してください。例:「こんにちは！ [happy]」`;

    // AIの「考え中...」プレースホルダーを表示
    const aiMessageId = Date.now() + 1;
    messages.value.push({
        id: aiMessageId,
        sender: 'mascot',
        text: '考え中...'
    });
    
    await nextTick();
    scrollToBottom();

    try {
        let reply = '';
        if (window.electronAPI) {
            if (engine === 'lmstudio') {
                // 1. LM Studioの呼び出し
                reply = await window.electronAPI.askLmStudio(userQuery, systemPrompt, lmsModel, lmsEndpoint);
            } else {
                // 1. Gemini API呼び出し
                if (!apiKey) {
                    throw new Error(`${engine.toUpperCase()} APIキーが未設定です。右クリックから設定画面を開き、APIキーを登録してください。`);
                }
                const model = engine === 'gemini' 
                    ? geminiModel 
                    : (engine === 'openai' 
                        ? openaiModel 
                        : (engine === 'anthropic' 
                            ? anthropicModel 
                            : engine));
                reply = await window.electronAPI.askGemini(userQuery, apiKey, systemPrompt, model);
            }
        } else {
            reply = 'ブラウザ実行時のモック回答です。[happy]';
        }

        // 2. メッセージを実際の応答で更新
        const mascotMsg = messages.value.find(m => m.id === aiMessageId);
        if (mascotMsg) {
            mascotMsg.text = reply;
        }

        // 応答テキストから感情タグ（[happy]など）をパースし、表情変更イベントを送信
        const emotionMatch = reply.match(/\[(\w+)\]/);
        if (emotionMatch && emotionMatch[1]) {
            const detectedEmotion = emotionMatch[1].toLowerCase();
            if (window.electronAPI) {
                window.electronAPI.changeEmotion(detectedEmotion);
            }
        }

        await nextTick();
        scrollToBottom();

        // 3. VOICEVOX音声合成と再生
        if (window.electronAPI) {
            // 音声合成用に、感情タグ `[happy]` などを取り除く
            const speechText = reply.replace(/\[\w+\]/g, '').trim();
            const base64Audio = await window.electronAPI.synthesizeVoicevox(speechText, voicevoxSpeakerId, voicevoxEndpointUrl);
            if (base64Audio) {
                const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
                audio.play();
            }
        }

    } catch (error: any) {
        const mascotMsg = messages.value.find(m => m.id === aiMessageId);
        if (mascotMsg) {
            mascotMsg.text = `接続に失敗しました: ${error.message}`;
        }
    } finally {
        isAiResponding.value = false;
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
        // Enterで送信（Shift + Enterで改行）
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    } else {
        // Shift + Enterで送信（Enterで改行）
        if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    }
};

onMounted(async () => {
    // 初期ロード
    if (window.electronAPI) {
        const configData = await window.electronAPI.getAppConfig();
        loadChatSettings(configData);

        // 設定更新の購読
        unsubscribeConfig = window.electronAPI.onConfigUpdated((newConfig: any) => {
            loadChatSettings(newConfig);
        });
    } else {
        // ブラウザ環境でのフォールバック
        chatSendKey.value = localStorage.getItem('chatSendKey') || 'enter';
        chatFontFamily.value = localStorage.getItem('chatFontFamily') || 'sans-serif';
        const opacity = localStorage.getItem('chatOpacity');
        chatOpacity.value = opacity ? parseFloat(opacity) : 0.65;
    }
});

onUnmounted(() => {
    if (unsubscribeConfig) {
        unsubscribeConfig();
    }
});
</script>

<template>
    <div class="chat-wrapper" :style="{ fontFamily: chatFontFamily, backgroundColor: `rgba(255, 255, 255, ${chatOpacity})` }">
        <!-- グラスモーフィズム調のヘッダー -->
        <header class="chat-header drag-area">
            <span class="chat-title">Mascot Chat</span>
            <div class="header-actions no-drag">
                <button class="icon-btn"><i class="pi pi-plus"></i></button>
                <button class="icon-btn"><i class="pi pi-history"></i></button>
            </div>
        </header>

        <!-- メッセージスクロール領域 -->
        <div class="message-container" ref="messageContainer">
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

        <!-- フッター（入力・送信） -->
        <footer class="chat-footer">
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
</style>
