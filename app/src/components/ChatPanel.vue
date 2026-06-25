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
import radioIcon from '../assets/radio_icon.svg';

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
    isRadioMode
} = storeToRefs(mascotStore);

const scrollToBottom = () => {
    if (messageContainer.value) {
        messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
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

const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => {
    if (fileInput.value) {
        fileInput.value.click();
    }
};

const activeImageUrl = ref<string | null>(null);
const openImageModal = (url: string) => {
    activeImageUrl.value = url;
};
const closeImageModal = () => {
    activeImageUrl.value = null;
};

const downloadFile = (att: any) => {
    const link = document.createElement('a');
    link.href = att.url;
    link.download = att.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const formatFileSize = (bytes?: number) => {
    if (bytes === undefined) return '';
    if (bytes < 1024) return bytes + ' B';
    const kb = bytes / 1024;
    if (kb < 1024) return kb.toFixed(1) + ' KB';
    const mb = kb / 1024;
    return mb.toFixed(1) + ' MB';
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

onUnmounted(() => {
    window.removeEventListener('mousemove', handleChatMouseMove);
    disconnectWebSocket();
    if (unsubscribeConfig) {
        unsubscribeConfig();
    }
    stopActiveTalkTimer();
});

const openSettings = () => {
    if (window.electronAPI && window.electronAPI.openSettings) {
        window.electronAPI.openSettings();
    }
};

// ---- 画像生成 (t2i) モードフロー ----
const isT2iMode = ref(false);

const generateImageFlow = async () => {
    const userPrompt = inputText.value.trim();
    if (!userPrompt) return;
    
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
        text: '画像を生成しています...'
    });

    mascotStore.setLoading(true);
    await nextTick();
    scrollToBottom();

    try {
        const host = configStore.forgeEndpoint || 'http://127.0.0.1:5555';
        const params = {
            prompt: userPrompt,
            steps: Number(configStore.forgeSteps) || 25,
            cfgScale: Number(configStore.forgeCfgScale) || 7.0,
            width: Number(configStore.forgeWidth) || 1024,
            height: Number(configStore.forgeHeight) || 1024,
            modelCheckpoint: configStore.forgeModel || undefined,
            negativePrompt: 'nsfw, low quality, worst quality, deformed, bad anatomy'
        };

        let base64Image = '';
        if (window.electronAPI && window.electronAPI.forgeGenerateImage) {
            base64Image = await window.electronAPI.forgeGenerateImage(params, host);
        } else {
            throw new Error('window.electronAPI.forgeGenerateImage が定義されていません。この実行環境（Webブラウザなど）ではローカル画像生成機能は利用できません。');
        }

        const imgDataUrl = `data:image/png;base64,${base64Image}`;
        const aiMsg = messages.value.find(m => m.id === aiMessageId);
        if (aiMsg) {
            aiMsg.text = '画像を生成しました。';
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
            aiMsg.text = `画像の生成に失敗しました。理由: ${error.message || error}`;
        }
    } finally {
        mascotStore.setLoading(false);
        await saveHistory();
        await nextTick();
        scrollToBottom();
    }
};

const handleFormSubmit = async () => {
    if (!inputText.value.trim() && pendingAttachments.value.length === 0) return;
    if (isAiResponding.value) return;

    if (isT2iMode.value) {
        await generateImageFlow();
    } else {
        await sendMessage();
    }
};

const onTextareaKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;

    if (chatSendKey.value === 'enter') {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleFormSubmit();
        }
    } else {
        if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            handleFormSubmit();
        }
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

// --- ヘッダードラッグ制御 (カスタムドラッグ実装により、-webkit-app-regionのクリック透過バグを回避) ---
let isHeaderDragging = false;
let startHeaderMouseX = 0;
let startHeaderMouseY = 0;

const onHeaderMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // 左クリックかつ、ボタン類（header-actions の中の要素）以外をクリックした場合のみドラッグ開始
    if (e.button !== 0 || target.closest('.header-actions')) return;

    e.preventDefault(); // ドラッグ中にヘッダーのテキスト選択が発生するのを防ぐ

    isHeaderDragging = true;
    startHeaderMouseX = e.screenX;
    startHeaderMouseY = e.screenY;

    if (window.electronAPI && window.electronAPI.dragWindow) {
        window.electronAPI.dragWindow({ dx: 0, dy: 0, isStart: true });
    }

    window.addEventListener('mousemove', onHeaderMouseMove);
    window.addEventListener('mouseup', onHeaderMouseUp);
};

const onHeaderMouseMove = (e: MouseEvent) => {
    if (!isHeaderDragging) return;

    if (e.buttons !== 1) { // 左ボタンが押されていない場合はドラッグ終了
        onHeaderMouseUp();
        return;
    }

    const dx = e.screenX - startHeaderMouseX;
    const dy = e.screenY - startHeaderMouseY;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        if (window.electronAPI && window.electronAPI.dragWindow) {
            window.electronAPI.dragWindow({ dx, dy });
        }
        startHeaderMouseX = e.screenX;
        startHeaderMouseY = e.screenY;
    }
};

const onHeaderMouseUp = () => {
    if (!isHeaderDragging) return;
    isHeaderDragging = false;

    window.removeEventListener('mousemove', onHeaderMouseMove);
    window.removeEventListener('mouseup', onHeaderMouseUp);

    if (window.electronAPI && window.electronAPI.dragWindow) {
        window.electronAPI.dragWindow({ dx: 0, dy: 0, isEnd: true });
    }
};

const focusWindow = () => {
    if (window.electronAPI && window.electronAPI.focusWindow) {
        window.electronAPI.focusWindow();
    }
};
</script>

<template>
    <div class="chat-wrapper" @mousedown="focusWindow" :style="{ fontFamily: chatFontFamily, border: getBorderStyle }">
        <!-- 背景レイヤー -->
        <div class="chat-background" :style="chatBackgroundStyle"></div>
        <!-- グラスモーフィズム調のヘッダー -->
        <header class="chat-header" @mousedown="onHeaderMouseDown">
            <span class="chat-title">{{ activeMascot ? `${activeMascot.name} Chat` : 'Mascot Chat' }}</span>
            <div class="header-actions">
                <button class="icon-btn" @click="configStore.updateConfig({ useTts: !useTts }); configStore.saveConfig()" :class="{ 'active-btn': useTts }" title="音声読み上げ (TTS) ON/OFF">
                    <i :class="useTts ? 'pi pi-volume-up' : 'pi pi-volume-off'"></i>
                </button>
                <button class="icon-btn" @click="isT2iMode = !isT2iMode" :class="{ 'active-btn': isT2iMode }" title="画像生成 (t2i) モード ON/OFF">
                    <i class="pi pi-image"></i>
                </button>
                <button class="icon-btn" @click="mascotStore.setRadioMode(!isRadioMode)" :class="{ 'active-radio-btn': isRadioMode }" title="ラジオモード ON/OFF">
                    <img :src="radioIcon" class="radio-svg-icon" alt="ラジオ" />
                </button>
                <button class="icon-btn" @click="clearHistory" title="新規話題"><i class="pi pi-plus"></i></button>
                <button class="icon-btn" @click="toggleHistoryList" :class="{ 'active-btn': showHistoryList }" title="履歴一覧"><i class="pi pi-history"></i></button>
                <button class="icon-btn" @click="openSettings" title="設定"><i class="pi pi-cog"></i></button>
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
                    <div class="message-text">{{ msg.text }}</div>
                    
                    <!-- 添付ファイル・画像一覧 -->
                    <div v-if="msg.attachments && msg.attachments.length > 0" class="attachments-wrapper">
                        <div 
                            v-for="(att, attIndex) in msg.attachments" 
                            :key="attIndex" 
                            class="attachment-item"
                        >
                            <!-- 画像の場合 -->
                            <div v-if="att.type === 'image'" class="attachment-image-box">
                                <img :src="att.url" :alt="att.name" class="message-image" @click="openImageModal(att.url)" />
                            </div>
                            <!-- ファイルの場合 -->
                            <div v-else class="attachment-file-box" @click="downloadFile(att)" :title="att.name">
                                <i class="pi pi-file"></i>
                                <span class="file-name">{{ att.name }}</span>
                                <span v-if="att.size" class="file-size">({{ formatFileSize(att.size) }})</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

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
        <footer v-if="!showHistoryList" class="chat-footer">
            <!-- 送信前プレビュー一覧 -->
            <div v-if="pendingAttachments.length > 0" class="preview-panel">
                <div v-for="(att, idx) in pendingAttachments" :key="idx" class="preview-item">
                    <img v-if="att.type === 'image'" :src="att.url" class="preview-thumb" />
                    <div v-else class="preview-file-icon">
                        <i class="pi pi-file"></i>
                        <span class="preview-file-name" :title="att.name">{{ att.name }}</span>
                    </div>
                    <button class="remove-preview-btn" @click="removeAttachment(idx)" type="button">
                        <i class="pi pi-times"></i>
                    </button>
                </div>
            </div>
            <form @submit.prevent="handleFormSubmit()" class="input-form">
                <!-- ファイル選択用の隠しinput -->
                <input 
                    type="file" 
                    ref="fileInput" 
                    style="display: none" 
                    multiple 
                    @change="attachFiles" 
                />
                <button type="button" class="attach-btn" @click="triggerFileInput" title="ファイル・画像を添付">
                    <i class="pi pi-paperclip"></i>
                </button>
                <textarea 
                    v-model="inputText" 
                    placeholder="メッセージを入力..." 
                    class="message-input"
                    rows="1"
                    @keydown="onTextareaKeyDown"
                ></textarea>
                <button type="submit" class="send-btn" :disabled="!inputText.trim() && pendingAttachments.length === 0">
                    <i class="pi pi-send"></i>
                </button>
            </form>
        </footer>

        <!-- 画像拡大モーダル -->
        <div v-if="activeImageUrl" class="image-modal" @click="closeImageModal">
            <div class="image-modal-content">
                <img :src="activeImageUrl" class="full-image" />
            </div>
        </div>

        <!-- リサイズ用ハンドル -->
        <div class="resize-handle right" @mousedown="initResize($event, 'right')"></div>
        <div class="resize-handle bottom" @mousedown="initResize($event, 'bottom')"></div>
        <div class="resize-handle corner" @mousedown="initResize($event, 'corner')"></div>
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

.chat-header {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    background: rgba(255, 255, 255, 0.3);
    cursor: move;
    user-select: none;
    -webkit-user-select: none;
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



.active-btn {
    color: #a855f7 !important;
    background: rgba(168, 85, 247, 0.1) !important;
}

.active-radio-btn {
    color: #ef4444 !important;
    background: rgba(239, 68, 68, 0.15) !important;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
    animation: pulse 2s infinite;
}

.radio-svg-icon {
    width: 20px;
    height: 20px;
    display: inline-block;
    object-fit: contain;
    opacity: 0.7;
    transition: opacity 0.2s ease, filter 0.2s ease;
}

.icon-btn:hover .radio-svg-icon {
    opacity: 1;
}

.active-radio-btn .radio-svg-icon {
    opacity: 1;
    filter: invert(36%) sepia(84%) saturate(4782%) hue-rotate(345deg) brightness(99%) contrast(93%);
}

@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
    }
    70% {
        box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
    }
}

/* 添付ファイル・画像一覧スタイル */
.attachments-wrapper {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.attachment-item {
    max-width: 100%;
}

.attachment-image-box {
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid rgba(0, 0, 0, 0.05);
    transition: transform 0.2s ease;
}

.attachment-image-box:hover {
    transform: scale(1.02);
}

.message-image {
    display: block;
    max-width: 200px;
    max-height: 150px;
    object-fit: cover;
}

.attachment-file-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 8px;
    padding: 6px 10px;
    cursor: pointer;
    font-size: 12px;
    color: #475569;
    transition: all 0.2s ease;
    word-break: break-all;
}

.attachment-file-box:hover {
    background: rgba(255, 255, 255, 0.8);
    border-color: #a855f7;
}

.attachment-file-box i {
    color: #a855f7;
    font-size: 14px;
}

.file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.file-size {
    color: #94a3b8;
    font-size: 10px;
    white-space: nowrap;
}

/* 送信前プレビューパネル */
.preview-panel {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.3);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    overflow-x: auto;
}

.preview-item {
    position: relative;
    width: 60px;
    height: 60px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    flex-shrink: 0;
}

.preview-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 6px;
}

.preview-file-icon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 4px;
    color: #64748b;
}

.preview-file-icon i {
    font-size: 20px;
    color: #a855f7;
}

.preview-file-name {
    font-size: 8px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 4px;
}

.remove-preview-btn {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.remove-preview-btn:hover {
    background: #dc2626;
}

/* アタッチボタン */
.attach-btn {
    background: transparent;
    border: none;
    color: #64748b;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.attach-btn:hover {
    color: #a855f7;
    background: rgba(168, 85, 247, 0.08);
}

/* 画像拡大モーダル */
.image-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    cursor: zoom-out;
    animation: fadeIn 0.2s ease;
}

.image-modal-content {
    max-width: 90%;
    max-height: 90%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.full-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
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
</style>
