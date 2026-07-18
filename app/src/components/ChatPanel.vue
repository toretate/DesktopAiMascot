<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, computed, watch } from 'vue';
import { useConfigStore } from '../store/config';
import { useMascotStore } from '../store/mascot';
import { storeToRefs } from 'pinia';
import { AudioPlaylist } from '../utils/AudioPlaylist';
import { useChatHistory } from './chatpanel/useChatHistory';
import { useChatConnection } from './chatpanel/useChatConnection';
import HistoryPanel from './chatpanel/HistoryPanel.vue';
import MascotViewer from './MascotViewer.vue';
import ForgeImageGeneratorDialog from './ForgeImageGeneratorDialog.vue';
import AttachmentImageModal from './chatpanel/AttachmentImageModal.vue';
import ImageGenerationFooter from './chatpanel/ImageGenerationFooter.vue';
import ChatHeader from './chatpanel/ChatHeader.vue';
import MessageList from './chatpanel/MessageList.vue';
import ChatInputForm from './chatpanel/ChatInputForm.vue';
import { extractImagePrompt } from '../utils/png-metadata';
import TaskManagement from './TaskManagement.vue';
import { useTaskStore } from '../store/task';
import MemoWidget from './MemoWidget.vue';
import { useMemoStore } from '../store/memo';
import MusicWidget from './MusicWidget.vue';
import { useMusicStore } from '../store/music';
import { DEFAULT_ACCENT_COLOR } from '../config/theme';
import { useResizableFrame } from '../composables/useResizableFrame';
import WidgetFrame from './common/WidgetFrame.vue';

const inputText = ref('');
const messageListRef = ref<any>(null);
const showTaskManagement = ref(false);
const showMemoManagement = ref(false);
const showMusicPlayer = ref(false);
const ttsDictionaryNotice = ref<{ type: 'loading' | 'success' | 'error'; message: string } | null>(null);
let ttsDictionaryNoticeTimer: ReturnType<typeof setTimeout> | null = null;

const configStore = useConfigStore();
const mascotStore = useMascotStore();
const taskStore = useTaskStore();
const memoStore = useMemoStore();
const musicStore = useMusicStore();

// タスク管理ウィジェット表示のトグル制御
watch(showTaskManagement, (newVal) => {
    if (taskStore.showTaskWidget !== newVal) {
        taskStore.showTaskWidget = newVal;
    }
    if (configStore.windowMode !== 'integrated' && configStore.windowMode !== 'compact') {
        if (window.electronAPI && window.electronAPI.toggleTasks) {
            window.electronAPI.toggleTasks();
        }
    }
});

// ストア側変更からヘッダーのトグル状態へ同期
watch(() => taskStore.showTaskWidget, (newVal) => {
    if (showTaskManagement.value !== newVal) {
        showTaskManagement.value = newVal;
    }
});

// メモウィジェット表示のトグル制御
watch(showMemoManagement, (newVal) => {
    if (memoStore.showMemoWidget !== newVal) {
        memoStore.showMemoWidget = newVal;
    }
    if (configStore.windowMode !== 'integrated' && configStore.windowMode !== 'compact') {
        if (window.electronAPI && window.electronAPI.toggleMemo) {
            window.electronAPI.toggleMemo();
        }
    }
});

watch(() => memoStore.showMemoWidget, (newVal) => {
    if (showMemoManagement.value !== newVal) {
        showMemoManagement.value = newVal;
    }
});

// 音楽プレイヤー表示のトグル制御
watch(showMusicPlayer, (newVal) => {
    if (musicStore.showMusicWidget !== newVal) {
        musicStore.showMusicWidget = newVal;
    }
    if (configStore.windowMode !== 'integrated' && configStore.windowMode !== 'compact') {
        window.electronAPI?.toggleMusic?.();
    }
});

watch(() => musicStore.showMusicWidget, (newVal) => {
    if (showMusicPlayer.value !== newVal) {
        showMusicPlayer.value = newVal;
    }
});

const playlist = new AudioPlaylist((speaking) => {
    mascotStore.setSpeaking(speaking);
});

const {
    chatSendKey,
    chatFontFamily,
    chatOpacity,
    chatBorderShow,
    chatBorderColor,
    chatBorderWidth,
    chatBackgroundColor,
    chatBackgroundImage,
    chatBackgroundImageOpacity,
    chatBackgroundImageFit,
    activeMascot,
    windowMode,
    useTts
} = storeToRefs(configStore);

watch(useTts, (enabled) => {
    if (!enabled) playlist.stop();
});

const getRgbaBackground = computed(() => {
    const hex = chatBackgroundColor.value || '#ffffff';
    const opacity = chatOpacity.value !== undefined ? chatOpacity.value : 1.0;
    
    let r = 255, g = 255, b = 255;
    const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (match) {
        r = parseInt(match[1], 16);
        g = parseInt(match[2], 16);
        b = parseInt(match[3], 16);
    } else {
        const shortMatch = hex.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
        if (shortMatch) {
            r = parseInt(shortMatch[1] + shortMatch[1], 16);
            g = parseInt(shortMatch[2] + shortMatch[2], 16);
            b = parseInt(shortMatch[3] + shortMatch[3], 16);
        }
    }
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
});

const getBorderStyle = computed(() => {
    if (!chatBorderShow.value) {
        return 'none';
    }
    const width = chatBorderWidth.value !== undefined ? chatBorderWidth.value : 1;
    const color = chatBorderColor.value || DEFAULT_ACCENT_COLOR;
    return `${width}px solid ${color}`;
});

const chatBackgroundStyle = computed(() => {
    const styles: Record<string, any> = {
        backgroundColor: getRgbaBackground.value,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: -1
    };
    if (chatBackgroundImage.value) {
        styles.backgroundImage = `url(${chatBackgroundImage.value})`;
        styles.opacity = chatBackgroundImageOpacity.value;
        
        if (chatBackgroundImageFit.value === 'cover') {
            styles.backgroundSize = 'cover';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (chatBackgroundImageFit.value === 'contain') {
            styles.backgroundSize = 'contain';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (chatBackgroundImageFit.value === 'fill') {
            styles.backgroundSize = '100% 100%';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (chatBackgroundImageFit.value === 'tile') {
            styles.backgroundSize = 'auto';
            styles.backgroundPosition = 'top left';
            styles.backgroundRepeat = 'repeat';
        }
    }
    return styles;
});

const {
    isLoading: isAiResponding,
    isRadioMode,
    isSecretMode
} = storeToRefs(mascotStore);

const scrollToBottom = () => {
    if (messageListRef.value) {
        messageListRef.value.scrollToBottom();
    }
};

const {
    sessions,
    activeSessionId,
    messages,
    showHistoryList,
    isHistoryLoaded,
    loadHistory,
    saveHistory,
    clearHistory,
    selectSession,
    deleteSession,
    deleteMessage,
    runCompaction,
    toggleHistoryList,
    applyActiveMascotHistory
} = useChatHistory(scrollToBottom);

const {
    isWsConnected,
    sendMessage,
    retryMessage,
    connectWebSocket,
    disconnectWebSocket,
    handleKeyDown,
    pendingAttachments,
    attachFiles,
    removeAttachment
} = useChatConnection({
    messages,
    activeSessionId,
    sessions,
    inputText,
    saveHistory,
    runCompaction,
    scrollToBottom
});

const activeImageUrl = ref<string | null>(null);

const openImageModal = (url: string) => {
    activeImageUrl.value = url;
};

const showTtsDictionaryNotice = (type: 'loading' | 'success' | 'error', message: string) => {
    ttsDictionaryNotice.value = { type, message };
    if (ttsDictionaryNoticeTimer) clearTimeout(ttsDictionaryNoticeTimer);
    if (type !== 'loading') {
        ttsDictionaryNoticeTimer = setTimeout(() => {
            ttsDictionaryNotice.value = null;
            ttsDictionaryNoticeTimer = null;
        }, 5000);
    }
};

// 現在のチャットAIに選択語の読みを問い合わせ、マスコット個別辞書へ保存する
const registerTtsReadings = async (text: string) => {
    const mascot = activeMascot.value;
    if (!mascot) {
        showTtsDictionaryNotice('error', '登録先のマスコットが見つかりません。');
        return;
    }

    const engine = configStore.selectedEngine || mascot.aiConfig?.chat?.engine || 'gemini';
    const apiKey = engine === 'gemini'
        ? configStore.googleAiStudioApiKey
        : engine === 'openai'
            ? configStore.openaiApiKey
            : engine === 'anthropic'
                ? configStore.anthropicApiKey
                : '';
    const model = engine === 'lmstudio'
        ? (configStore.lmstudioModel || mascot.aiConfig?.chat?.model || '')
        : engine === 'gemini'
            ? (configStore.geminiModel || mascot.aiConfig?.chat?.model || '')
            : engine === 'openai'
                ? (configStore.openaiModel || mascot.aiConfig?.chat?.model || '')
                : (configStore.anthropicModel || mascot.aiConfig?.chat?.model || '');

    showTtsDictionaryNotice('loading', 'AIに英単語の読みを問い合わせています…');
    try {
        const response = await fetch('/api/tts-dictionary-suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                text,
                engine,
                model,
                apiKey: apiKey || '',
                lmstudioEndpoint: configStore.lmstudioEndpoint
            })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.statusMessage || result.message || 'AIから読みを取得できませんでした。');
        }

        const entries = Array.isArray(result.entries) ? result.entries : [];
        if (entries.length === 0) {
            showTtsDictionaryNotice('error', '登録できる英単語が選択範囲にありませんでした。');
            return;
        }

        const previousDictionary = mascot.aiConfig.ttsDictionary;
        const dictionary = { ...(previousDictionary || {}) };
        for (const entry of entries) {
            dictionary[entry.term] = entry.reading;
        }
        mascot.aiConfig.ttsDictionary = dictionary;
        const saved = await configStore.saveMascot(mascot.id);
        if (!saved) {
            mascot.aiConfig.ttsDictionary = previousDictionary;
            throw new Error('マスコット設定を保存できませんでした。');
        }

        const summary = entries
            .slice(0, 5)
            .map((entry: { term: string; reading: string }) => `${entry.term}→${entry.reading}`)
            .join('、');
        const remainder = entries.length > 5 ? `、ほか${entries.length - 5}件` : '';
        showTtsDictionaryNotice('success', `${entries.length}件の読みを登録しました: ${summary}${remainder}`);
    } catch (error: any) {
        showTtsDictionaryNotice('error', `読みの登録に失敗しました: ${error.message || error}`);
    }
};

// AIメッセージを現在の音声設定でTTSへ再送し、受信音声を再生する
const replayMessageTts = async (text: string) => {
    const mascot = activeMascot.value;
    if (!mascot || !text.trim()) return;

    const engine = mascot.aiConfig?.voice?.engine || configStore.selectedVoiceEngine || 'voicevox';
    const endpoint = engine === 'irodori'
        ? (configStore.irodoriEndpoint || 'http://127.0.0.1:8088')
        : (configStore.voicevoxEndpoint || 'http://localhost:50021');

    playlist.stop();
    showTtsDictionaryNotice('loading', 'TTSへメッセージを再送しています…');
    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                action: 'synthesizeBatch',
                engine,
                text,
                endpoint,
                model: mascot.aiConfig?.voice?.irodori_model || configStore.irodoriModel,
                voice: mascot.aiConfig?.voice?.irodori_voice || configStore.irodoriVoice,
                speakerId: mascot.aiConfig?.voice?.speaker_id ?? configStore.voicevoxSpeaker,
                emotion: 'neutral',
                ttsDictionary: mascot.aiConfig?.ttsDictionary,
                ttsReadNarrative: configStore.ttsReadNarrative,
                showVoiceLog: configStore.showVoiceLog
            })
        });
        const result = await response.json();
        const audios = Array.isArray(result.audios) ? result.audios.filter((audio: unknown) => typeof audio === 'string' && audio) : [];
        if (!response.ok || !result.success || audios.length === 0) {
            throw new Error(result.error || '音声を合成できませんでした。');
        }

        for (const audio of audios) playlist.push(audio);
        showTtsDictionaryNotice('success', 'TTSから受信した音声を再生します。');
    } catch (error: any) {
        showTtsDictionaryNotice('error', `TTS再送に失敗しました: ${error.message || error}`);
    }
};



// ---- 能動的発話（アクティブトーク）タイマー ----
let activeTalkTimer: any = null;

const startActiveTalkTimer = () => {
    stopActiveTalkTimer();
    if (!isRadioMode.value || isAiResponding.value || mascotStore.isSpeaking || inputText.value.trim() !== '') {
        return;
    }
    // 沈黙からアクティブトークを発火するまでの待機時間（UIから設定可能／秒単位）。
    // 発火のたびに最新の設定値を参照する。
    const intervalMs = (Number(configStore.radioActiveTalkInterval) || 30) * 1000;
    activeTalkTimer = setTimeout(async () => {
        if (isRadioMode.value && !isAiResponding.value && !mascotStore.isSpeaking && inputText.value.trim() === '') {
            await sendMessage(true);
        }
    }, intervalMs);
};

const stopActiveTalkTimer = () => {
    if (activeTalkTimer) {
        clearTimeout(activeTalkTimer);
        activeTalkTimer = null;
    }
};

watch(() => isRadioMode.value, (newVal) => {
    if (newVal) {
        startActiveTalkTimer();
    } else {
        stopActiveTalkTimer();
    }
});

watch(() => inputText.value, (newVal) => {
    if (newVal.trim() !== '') {
        stopActiveTalkTimer();
    } else {
        startActiveTalkTimer();
    }
});

watch([() => isAiResponding.value, () => mascotStore.isSpeaking], ([responding, speaking]) => {
    if (responding || speaking) {
        stopActiveTalkTimer();
    } else {
        startActiveTalkTimer();
    }
});

// アクティブトークの待機時間を設定で変更したら、待機中のタイマーを新しい値で再スタートする
watch(() => configStore.radioActiveTalkInterval, () => {
    if (isRadioMode.value) {
        startActiveTalkTimer();
    }
});

let unsubscribeConfig: (() => void) | null = null;

const handleChatMouseMove = () => {
    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
        window.electronAPI.setIgnoreMouseEvents(false);
    }
};

onMounted(async () => {
    console.log('[ChatPanel] window.electronAPI diagnostics:', typeof window.electronAPI, window.electronAPI ? JSON.stringify({ isWeb: (window.electronAPI as any).isWeb, keys: Object.keys(window.electronAPI) }) : 'undefined');

    // チャットウィンドウ自身のマウスイベント透過を強制解除するリスナーを追加
    window.addEventListener('mousemove', handleChatMouseMove);

    // ストアの設定データを読み込み
    if (!configStore.isLoaded) {
        await configStore.loadConfig();
    }

    // メモデータの読み込み
    if (!memoStore.isLoaded) {
        await memoStore.loadFromLocalStorage();
    }

    if (!musicStore.isLoaded) {
        musicStore.loadFromLocalStorage();
    }

    // 設定更新イベントの購読
    if (window.electronAPI && window.electronAPI.onConfigUpdated) {
        unsubscribeConfig = window.electronAPI.onConfigUpdated((newConfig) => {
            configStore.updateConfig(newConfig);
        });
    }

    // チャット履歴の読み込み
    await loadHistory();

    // WebSocketの接続
    connectWebSocket();

    // 初期化時にラジオモードがONならタイマー起動
    if (isRadioMode.value) {
        startActiveTalkTimer();
    }
});

const useAsI2iSource = (url: string) => {
    pendingAttachments.value = [{
        type: 'image',
        name: `i2i_source_${Date.now()}.png`,
        url: url
    }];
    imageGenMode.value = 'i2i';
    
    // 画像からメタデータプロンプトを取得して設定
    const loadedPrompt = extractImagePrompt(url);
    if (loadedPrompt) {
        inputText.value = loadedPrompt;
    }
    
    nextTick(() => {
        const textarea = document.querySelector('.message-input') as HTMLTextAreaElement;
        if (textarea) {
            textarea.focus();
        }
    });
};

// ---- 画像生成・編集 (t2i / i2i) モードフロー ----
const imageGenMode = ref<'t2i' | 'i2i' | null>(null);
const imageGenDialogVisible = ref(false);

const generateImageFlow = async (isI2i = false) => {
    const userPrompt = inputText.value.trim();
    if (!userPrompt) return;
    
    let initImageBase64 = '';
    if (isI2i) {
        const imgAttachment = pendingAttachments.value.find(a => a.type === 'image');
        if (!imgAttachment) {
            alert('画像編集 (i2i) モードには元となる画像が必要です。あらかじめ画像を添付してください。');
            return;
        }
        initImageBase64 = imgAttachment.url;
    }

    inputText.value = '';

    messages.value.push({
        id: Date.now(),
        sender: 'user',
        text: userPrompt
    });

    const aiMessageId = Date.now() + 1;
    messages.value.push({
        id: aiMessageId,
        sender: 'mascot',
        text: isI2i ? '画像を編集しています...' : '画像を生成しています...'
    });

    mascotStore.setLoading(true);
    await nextTick();
    scrollToBottom();

    try {
        const host = configStore.forgeEndpoint || 'http://127.0.0.1:5555';
        let finalPrompt = configStore.forgePrompt ? `${configStore.forgePrompt}, ${userPrompt}` : userPrompt;
        if (configStore.forgeLora) {
            const loraPromptParts = configStore.forgeLora
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(item => {
                    const parts = item.split(':');
                    let name = parts[0]?.trim();
                    const weight = parts[1] !== undefined ? parts[1].trim() : '1.00';
                    if (name) {
                        // パス区切り文字（/ や \）が含まれている場合は、ファイル名部分だけを抽出
                        const lastSlash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
                        if (lastSlash !== -1) {
                            name = name.substring(lastSlash + 1);
                        }
                        return `<lora:${name}:${weight}>`;
                    }
                    return '';
                })
                .filter(Boolean)
                .join(' ');
            if (loraPromptParts) {
                finalPrompt = `${finalPrompt} ${loraPromptParts}`;
            }
        }
        const params: any = {
            prompt: finalPrompt,
            steps: Number(configStore.forgeSteps) || 25,
            cfgScale: Number(configStore.forgeCfgScale) || 7.0,
            width: Number(configStore.forgeWidth) || 1024,
            height: Number(configStore.forgeHeight) || 1024,
            modelCheckpoint: configStore.forgeModel || undefined,
            negativePrompt: configStore.forgeNegativePrompt || undefined,
            samplerName: configStore.forgeSampler || undefined
        };

        if (isI2i && initImageBase64) {
            params.initImage = initImageBase64;
            params.denoisingStrength = Number(configStore.forgeDenoisingStrength) ?? 0.7;
        }

        let base64Image = '';
        if (window.electronAPI && window.electronAPI.forgeGenerateImage) {
            base64Image = await window.electronAPI.forgeGenerateImage(params, host);
        } else {
            throw new Error('window.electronAPI.forgeGenerateImage が定義されていません。この実行環境（Webブラウザなど）ではローカル画像生成機能は利用できません。');
        }

        const imgDataUrl = `data:image/png;base64,${base64Image}`;
        const aiMsg = messages.value.find(m => m.id === aiMessageId);
        if (aiMsg) {
            aiMsg.text = isI2i ? '画像を編集しました。' : '画像を生成しました。';
            aiMsg.attachments = [{
                type: 'image',
                name: `generated_${Date.now()}.png`,
                url: imgDataUrl
            }];
        }
    } catch (error: any) {
        console.error('[ChatPanel] Image generation failed:', error);
        const aiMsg = messages.value.find(m => m.id === aiMessageId);
        if (aiMsg) {
            aiMsg.text = `${isI2i ? '画像編集' : '画像生成'}に失敗しました。理由: ${error.message || error}`;
        }
    } finally {
        pendingAttachments.value = []; // 元画像をクリア
        mascotStore.setLoading(false);
        await saveHistory();
        await nextTick();
        scrollToBottom();
    }
};

const handleFormSubmit = async () => {
    if (!inputText.value.trim() && pendingAttachments.value.length === 0) return;
    if (isAiResponding.value) return;

    if (imageGenMode.value) {
        await generateImageFlow(imageGenMode.value === 'i2i');
    } else {
        await sendMessage();
    }
};

// ---- カスタムリサイズ処理 ----
const { initResize } = useResizableFrame({
    minWidth: 300,
    minHeight: 300,
    getStartSize: () => ({ width: window.innerWidth, height: window.innerHeight }),
    onResizeApply: (width, height) => {
        if (window.electronAPI && window.electronAPI.resizeChatWindow) {
            window.electronAPI.resizeChatWindow({ width, height });
        }
    },
    listenerTarget: document
});

onUnmounted(() => {
    if (ttsDictionaryNoticeTimer) clearTimeout(ttsDictionaryNoticeTimer);
    window.removeEventListener('mousemove', handleChatMouseMove);
    disconnectWebSocket();
    if (unsubscribeConfig) {
        unsubscribeConfig();
    }
    stopActiveTalkTimer();
});

const focusWindow = () => {
    if (window.electronAPI && window.electronAPI.focusWindow) {
        window.electronAPI.focusWindow();
    }
};
</script>

<template>
    <WidgetFrame class="chat-wrapper" @mousedown="focusWindow" :style="{ fontFamily: chatFontFamily, border: getBorderStyle }" :class="{ 'secret-mode': isSecretMode }" :show-handles="true" @init-resize="initResize">
        <!-- 背景レイヤー -->
        <div class="chat-background" :style="chatBackgroundStyle"></div>
        <!-- グラスモーフィズム調のヘッダー -->
        <ChatHeader
            v-model:imageGenMode="imageGenMode"
            v-model:showHistoryList="showHistoryList"
            v-model:showTaskManagement="showTaskManagement"
            v-model:showMemoManagement="showMemoManagement"
            v-model:showMusicPlayer="showMusicPlayer"
            @clear-history="clearHistory"
            @open-image-gen-dialog="imageGenDialogVisible = true"
        />

        <!-- コンパクトモードでは操作パネル直下に1行ミニプレイヤーを重ねる -->
        <MusicWidget v-if="showMusicPlayer && windowMode === 'compact'" />

        <!-- コンパクト表示かつタスク表示ONのときは画面切り替え -->
        <div v-if="showTaskManagement && windowMode === 'compact'" class="task-management-section">
            <TaskManagement />
        </div>
        <div v-else-if="showMemoManagement && windowMode === 'compact'" class="task-management-section">
            <MemoWidget />
        </div>
        <template v-else>
            <!-- メッセージスクロール領域 -->
            <MessageList
                v-if="!showHistoryList"
                ref="messageListRef"
                :messages="messages"
                :isSecretMode="isSecretMode"
                @open-image="openImageModal"
                @use-i2i="useAsI2iSource"
                @delete-message="deleteMessage"
                @register-tts-readings="registerTtsReadings"
                @replay-tts="replayMessageTts"
                @retry-message="retryMessage"
            />

            <!-- 履歴スレッド一覧領域 -->
            <HistoryPanel
                v-else
                :sessions="sessions"
                :activeSessionId="activeSessionId"
                @select-session="selectSession"
                @delete-session="({ sessionId, event }) => deleteSession(sessionId, event)"
            />

            <!-- コンパクトモード時のマスコット領域 -->
            <div v-if="!showHistoryList && windowMode === 'compact'" class="compact-mascot-container">
                <MascotViewer />
            </div>

            <!-- フッター（入力・送信） -->
            <ChatInputForm
                v-if="!showHistoryList"
                v-model:inputText="inputText"
                v-model:imageGenMode="imageGenMode"
                :isSecretMode="isSecretMode"
                :pendingAttachments="pendingAttachments"
                @attach-files="attachFiles"
                @remove-attachment="removeAttachment"
                @submit="handleFormSubmit"
            />
        </template>

        <!-- 画像拡大モーダル -->
        <AttachmentImageModal :url="activeImageUrl" @close="activeImageUrl = null" @use-i2i="useAsI2iSource" />

        <div v-if="ttsDictionaryNotice" class="tts-dictionary-notice" :class="ttsDictionaryNotice.type">
            <i :class="ttsDictionaryNotice.type === 'loading' ? 'pi pi-spin pi-spinner' : ttsDictionaryNotice.type === 'success' ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'"></i>
            <span>{{ ttsDictionaryNotice.message }}</span>
        </div>

        <!-- 画像生成パラメータ設定ダイアログ -->
        <ForgeImageGeneratorDialog :visible="imageGenDialogVisible" @close="imageGenDialogVisible = false" />
    </WidgetFrame>
</template>

<style scoped>
.chat-wrapper {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.001);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.4);
    border-radius: 16px;
    box-sizing: border-box;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
}

.chat-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: -1;
    pointer-events: none;
    border-radius: 15px;
}

/* コンパクトモード時のマスコットコンテナスタイル */
.compact-mascot-container {
    height: 280px;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    overflow: hidden;
    flex-shrink: 0;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    background: transparent;
}

:deep(.compact-mascot-container .mascot-wrapper) {
    width: 100% !important;
    height: 100% !important;
    background: transparent !important;
    justify-content: flex-end !important;
}

:deep(.compact-mascot-container .mascot-character) {
    transform-origin: bottom center;
}

/* シークレットモードのスタイル定義 */
.chat-wrapper.secret-mode {
    background: rgba(26, 21, 44, 0.75) !important; /* グラスモーフィズム調のダークパープル */
    box-shadow: 0 8px 32px 0 var(--color-primary-alpha-15) !important;
}

/* シークレットモード中の背景レイヤー調整 */
.chat-wrapper.secret-mode .chat-background {
    opacity: 0.15 !important;
    background-color: #0f0b21 !important;
}

.task-management-section {
    flex-grow: 1;
    overflow: hidden;
    height: 0;
}

.tts-dictionary-notice {
    position: absolute;
    right: 14px;
    bottom: 64px;
    z-index: 10000;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    max-width: min(420px, calc(100% - 28px));
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.96);
    color: #334155;
    font-size: 12px;
    line-height: 1.5;
    box-shadow: 0 6px 18px rgba(15, 23, 42, 0.16);
}

.tts-dictionary-notice.success {
    border-color: #86efac;
    color: #166534;
}

.tts-dictionary-notice.error {
    border-color: #fca5a5;
    color: #991b1b;
}
</style>
