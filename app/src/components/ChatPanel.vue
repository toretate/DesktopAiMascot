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

const inputText = ref('');
const messageListRef = ref<any>(null);

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
    const color = chatBorderColor.value || '#a855f7';
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



// ---- 能動的発話（アクティブトーク）タイマー ----
const ACTIVE_TALK_INTERVAL = 30000; // 30秒
let activeTalkTimer: any = null;

const startActiveTalkTimer = () => {
    stopActiveTalkTimer();
    if (!isRadioMode.value || isAiResponding.value || mascotStore.isSpeaking || inputText.value.trim() !== '') {
        return;
    }
    activeTalkTimer = setTimeout(async () => {
        if (isRadioMode.value && !isAiResponding.value && !mascotStore.isSpeaking && inputText.value.trim() === '') {
            await sendMessage(true);
        }
    }, ACTIVE_TALK_INTERVAL);
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
let isResizing = false;
let resizeDirection = '';
let startWidth = 0;
let startHeight = 0;
let startMouseX = 0;
let startMouseY = 0;

const initResize = (e: MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    resizeDirection = direction;
    startWidth = window.innerWidth;
    startHeight = window.innerHeight;
    startMouseX = e.clientX;
    startMouseY = e.clientY;

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', stopResize);
};

const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    let newWidth = startWidth;
    let newHeight = startHeight;

    if (resizeDirection === 'right' || resizeDirection === 'corner') {
        newWidth = Math.max(300, startWidth + dx); // 最小幅 300
    }
    if (resizeDirection === 'bottom' || resizeDirection === 'corner') {
        newHeight = Math.max(300, startHeight + dy); // 最小高 300
    }

    if (window.electronAPI && window.electronAPI.resizeChatWindow) {
        window.electronAPI.resizeChatWindow({ width: newWidth, height: newHeight });
    }
};

const stopResize = () => {
    isResizing = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', stopResize);
};

onUnmounted(() => {
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
    <div class="chat-wrapper" @mousedown="focusWindow" :style="{ fontFamily: chatFontFamily, border: getBorderStyle }" :class="{ 'secret-mode': isSecretMode }">
        <!-- 背景レイヤー -->
        <div class="chat-background" :style="chatBackgroundStyle"></div>
        <!-- グラスモーフィズム調のヘッダー -->
        <ChatHeader
            v-model:imageGenMode="imageGenMode"
            v-model:showHistoryList="showHistoryList"
            @clear-history="clearHistory"
            @open-image-gen-dialog="imageGenDialogVisible = true"
        />

        <!-- メッセージスクロール領域 -->
        <MessageList
            v-if="!showHistoryList"
            ref="messageListRef"
            :messages="messages"
            :isSecretMode="isSecretMode"
            @open-image="openImageModal"
            @use-i2i="useAsI2iSource"
            @delete-message="deleteMessage"
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

        <!-- 画像拡大モーダル -->
        <AttachmentImageModal :url="activeImageUrl" @close="activeImageUrl = null" @use-i2i="useAsI2iSource" />

        <!-- リサイズ用ハンドル -->
        <div class="resize-handle right" @mousedown="initResize($event, 'right')"></div>
        <div class="resize-handle bottom" @mousedown="initResize($event, 'bottom')"></div>
        <div class="resize-handle corner" @mousedown="initResize($event, 'corner')"></div>

        <!-- 画像生成パラメータ設定ダイアログ -->
        <ForgeImageGeneratorDialog :visible="imageGenDialogVisible" @close="imageGenDialogVisible = false" />
    </div>
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

/* リサイズハンドル */
.resize-handle {
    position: absolute;
    background: transparent;
    z-index: 9999;
}
.resize-handle.right {
    top: 0;
    right: 0;
    width: 6px;
    height: calc(100% - 10px);
    cursor: e-resize;
    -webkit-app-region: no-drag;
}
.resize-handle.bottom {
    bottom: 0;
    left: 0;
    width: calc(100% - 10px);
    height: 6px;
    cursor: s-resize;
    -webkit-app-region: no-drag;
}
.resize-handle.corner {
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    cursor: se-resize;
    -webkit-app-region: no-drag;
}

/* シークレットモードのスタイル定義 */
.chat-wrapper.secret-mode {
    background: rgba(26, 21, 44, 0.75) !important; /* グラスモーフィズム調のダークパープル */
    box-shadow: 0 8px 32px 0 rgba(168, 85, 247, 0.15) !important;
}

/* シークレットモード中の背景レイヤー調整 */
.chat-wrapper.secret-mode .chat-background {
    opacity: 0.15 !important;
    background-color: #0f0b21 !important;
}
</style>

