<script setup lang="ts">
import { ref, nextTick, onMounted, computed } from 'vue';
import { useConfigStore } from '../store/config';
import { useMascotStore } from '../store/mascot';
import { storeToRefs } from 'pinia';

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

// ---- Stores ----
const configStore = useConfigStore();
const mascotStore = useMascotStore();

const {
    chatSendKey,
    chatFontFamily,
    chatOpacity,
    activeMascot
} = storeToRefs(configStore);

const {
    isLoading: isAiResponding
} = storeToRefs(mascotStore);

const sendMessage = async () => {
    if (!inputText.value.trim() || isAiResponding.value) return;

    const userQuery = inputText.value;
    inputText.value = '';

    messages.value.push({
        id: Date.now(),
        sender: 'user',
        text: userQuery
    });

    mascotStore.setLoading(true);

    await nextTick();
    scrollToBottom();

    // アクティブなマスコットとそのAI設定を取得
    const mascot = activeMascot.value;
    
    // エンジン選択：マスコット個別の設定を優先し、無ければシステム設定を使用
    const engine = mascot?.aiConfig?.chat?.engine || configStore.selectedEngine || 'gemini';
    
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

    // モデル名：マスコット個別のモデル名を優先
    let model = '';
    if (mascot?.aiConfig?.chat?.model) {
        model = mascot.aiConfig.chat.model;
    } else {
        if (engine === 'lmstudio') model = configStore.lmstudioModel || '';
        else if (engine === 'gemini') model = configStore.geminiModel || 'gemini-2.0-flash-exp';
        else if (engine === 'openai') model = configStore.openaiModel || 'gpt-4o';
        else if (engine === 'anthropic') model = configStore.anthropicModel || 'claude-3-5-sonnet-latest';
    }

    // 音声話者：マスコット個別の話者IDを優先
    const voicevoxSpeakerId = mascot?.aiConfig?.voice?.speaker_id !== undefined 
        ? mascot.aiConfig.voice.speaker_id 
        : (configStore.voicevoxSpeaker !== undefined ? configStore.voicevoxSpeaker : 2);

    // システムプロンプト：マスコットのプロフィールを優先
    let systemPrompt = '';
    if (mascot && mascot.profile) {
        systemPrompt = mascot.profile;
        if (!systemPrompt.includes('[happy]') && !systemPrompt.includes('感情タグ')) {
            systemPrompt += "\n回答の最後に、自分の現在の感情に合わせて [happy], [sad], [angry], [surprised], [neutral] のいずれかの感情タグを必ず1つ含めて終了してください。例:「こんにちは！ [happy]」";
        }
    } else {
        systemPrompt = `あなたは対話型のAIデスクトップマスコットです。親しみやすく返答してください。回答の最後に、自分の現在の感情に合わせて [happy], [sad], [angry], [surprised], [neutral] のいずれかの感情タグを必ず1つ含めて終了してください。例:「こんにちは！ [happy]」`;
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

    try {
        let reply = '';
        if (window.electronAPI) {
            if (engine === 'lmstudio') {
                reply = await window.electronAPI.askLmStudio(userQuery, systemPrompt, model, lmsEndpoint);
            } else {
                if (!apiKey) {
                    throw new Error(`${engine.toUpperCase()} APIキーが未設定です。右クリックから設定画面を開き、APIキーを登録してください。`);
                }
                reply = await window.electronAPI.askGemini(userQuery, apiKey, systemPrompt, model);
            }
        } else {
            reply = 'ブラウザ実行時のモック回答です。[happy]';
        }

        // メッセージを実際の応答で更新
        const mascotMsg = messages.value.find(m => m.id === aiMessageId);
        if (mascotMsg) {
            mascotMsg.text = reply;
        }

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
            const speechText = reply.replace(/\[\w+\]/g, '').trim();
            
            // 発話中フラグをON
            mascotStore.setSpeaking(true);

            const base64Audio = await window.electronAPI.synthesizeVoicevox(speechText, voicevoxSpeakerId, voicevoxEndpointUrl);
            if (base64Audio) {
                const audio = new Audio(`data:audio/wav;base64,${base64Audio}`);
                
                // 再生終了時に発話中フラグをOFF
                audio.onended = () => {
                    mascotStore.setSpeaking(false);
                };
                audio.onerror = () => {
                    mascotStore.setSpeaking(false);
                };

                await audio.play();
            } else {
                mascotStore.setSpeaking(false);
            }
        }

    } catch (error: any) {
        const mascotMsg = messages.value.find(m => m.id === aiMessageId);
        if (mascotMsg) {
            mascotMsg.text = `接続に失敗しました: ${error.message}`;
        }
        mascotStore.setSpeaking(false);
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

onMounted(async () => {
    // ストアの設定データを読み込み
    if (!configStore.isLoaded) {
        await configStore.loadConfig();
    }
});
</script>

<template>
    <div class="chat-wrapper" :style="{ fontFamily: chatFontFamily, backgroundColor: `rgba(255, 255, 255, ${chatOpacity})` }">
        <!-- グラスモーフィズム調のヘッダー -->
        <header class="chat-header drag-area">
            <span class="chat-title">{{ activeMascot ? `${activeMascot.name} Chat` : 'Mascot Chat' }}</span>
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
