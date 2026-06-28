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
import radioIcon from '../assets/radio_icon.svg';
import { extractImagePrompt, extractImageParameters } from '../utils/png-metadata';

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
    isRadioMode,
    isSecretMode
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
const imageParametersText = ref('');
const showInfoPanel = ref(false);
const copied = ref(false);

const openImageModal = (url: string) => {
    activeImageUrl.value = url;
    showInfoPanel.value = false;
    copied.value = false;
    
    if (window.electronAPI && window.electronAPI.logDebug) {
        window.electronAPI.logDebug(`openImageModal URL length: ${url?.length}, startsWithData: ${url?.startsWith('data:')}`);
        try {
            const parts = url.split(',');
            const base64 = (parts[1] || '').replace(/\s/g, '');
            const bin = atob(base64.substring(0, 100));
            const header = [];
            for (let i = 0; i < Math.min(bin.length, 8); i++) {
                header.push(bin.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase());
            }
            window.electronAPI.logDebug(`Image Header: ${header.join(' ')}`);
        } catch (e: any) {
            window.electronAPI.logDebug(`Failed to read header: ${e.message}`);
        }
    }
    
    try {
        const params = extractImageParameters(url);
        imageParametersText.value = params;
        
        if (window.electronAPI && window.electronAPI.logDebug) {
            window.electronAPI.logDebug(`Parsed parameters length: ${params?.length}`);
            if (params) {
                window.electronAPI.logDebug(`Parsed parameters text:\n${params}`);
            }
        }
    } catch (e: any) {
        if (window.electronAPI && window.electronAPI.logDebug) {
            window.electronAPI.logDebug(`Failed to extract parameters: ${e.message}`);
        }
    }
};

const openDownloadsFolder = () => {
    if (window.electronAPI && window.electronAPI.openDownloadsFolder) {
        window.electronAPI.openDownloadsFolder();
    }
};

const closeImageModal = () => {
    activeImageUrl.value = null;
    imageParametersText.value = '';
    showInfoPanel.value = false;
    copied.value = false;
};

const copyParameters = async () => {
    if (!imageParametersText.value) return;
    try {
        await navigator.clipboard.writeText(imageParametersText.value);
        copied.value = true;
        setTimeout(() => {
            copied.value = false;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text:', err);
    }
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

    document.addEventListener('click', handleDocumentClick);
});

onUnmounted(() => {
    window.removeEventListener('mousemove', handleChatMouseMove);
    document.removeEventListener('click', handleDocumentClick);
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
const showImageMenu = ref(false);
const imageGenDialogVisible = ref(false);

const toggleImageMenu = (e: MouseEvent) => {
    e.stopPropagation();
    showImageMenu.value = !showImageMenu.value;
};

const handleDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.image-menu-wrapper')) {
        showImageMenu.value = false;
    }
};

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
    <div class="chat-wrapper" @mousedown="focusWindow" :style="{ fontFamily: chatFontFamily, border: getBorderStyle }" :class="{ 'secret-mode': isSecretMode }">
        <!-- 背景レイヤー -->
        <div class="chat-background" :style="chatBackgroundStyle"></div>
        <!-- グラスモーフィズム調のヘッダー -->
        <header class="chat-header" @mousedown="onHeaderMouseDown">
            <span class="chat-title">
                {{ activeMascot ? `${activeMascot.name} Chat` : 'Mascot Chat' }}
                <span v-if="isSecretMode" class="secret-badge" title="シークレットモード有効中">
                    <i class="pi pi-eye-slash"></i> Secret
                </span>
            </span>
            <div class="header-actions">
                <button class="icon-btn" @click="mascotStore.setSecretMode(!isSecretMode)" :class="{ 'active-secret-btn': isSecretMode }" title="シークレットモード ON/OFF">
                    <i :class="isSecretMode ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
                </button>
                <button class="icon-btn" @click="configStore.updateConfig({ useTts: !useTts }); configStore.saveConfig()" :class="{ 'active-btn': useTts }" title="音声読み上げ (TTS) ON/OFF">
                    <i :class="useTts ? 'pi pi-volume-up' : 'pi pi-volume-off'"></i>
                </button>
                <!-- 画像生成・編集メニュー -->
                <div class="image-menu-wrapper">
                    <button type="button" class="icon-btn" @click="toggleImageMenu" :class="{ 'active-btn': imageGenMode !== null }" title="画像生成・編集メニュー">
                        <i class="pi pi-image"></i>
                    </button>
                    <div v-if="showImageMenu" class="image-dropdown-menu">
                        <div class="menu-item" @click="imageGenMode = 't2i'; showImageMenu = false">
                            <i class="pi pi-pencil"></i> テキストから画像生成 (t2i)
                            <i v-if="imageGenMode === 't2i'" class="pi pi-check active-check"></i>
                        </div>
                        <div class="menu-item" @click="imageGenMode = 'i2i'; showImageMenu = false">
                            <i class="pi pi-image"></i> 画像から画像生成 (i2i)
                            <i v-if="imageGenMode === 'i2i'" class="pi pi-check active-check"></i>
                        </div>
                        <div class="menu-divider"></div>
                        <div class="menu-item" @click="imageGenDialogVisible = true; showImageMenu = false">
                            <i class="pi pi-cog"></i> 生成パラメータ設定
                        </div>
                    </div>
                </div>
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
                                <button type="button" class="use-i2i-btn" @click.stop="useAsI2iSource(att.url)" title="この画像を画像編集 (i2i) の元画像に設定">
                                    <i class="pi pi-pencil"></i> i2i元画像に設定
                                </button>
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
            <!-- 画像生成・編集モードインジケーター -->
            <div v-if="imageGenMode" class="image-gen-indicator" :class="{ 'i2i-indicator': imageGenMode === 'i2i' }">
                <div class="indicator-main">
                    <span class="indicator-text">
                        <i class="pi" :class="imageGenMode === 't2i' ? 'pi-pencil' : 'pi-image'"></i>
                        {{ imageGenMode === 't2i' ? '画像生成 (t2i) モード' : '画像編集 (i2i) モード' }} 有効中
                    </span>
                    <button type="button" class="cancel-mode-btn" @click="imageGenMode = null" title="チャットに戻る">
                        チャットに戻る <i class="pi pi-times"></i>
                    </button>
                </div>
                <!-- i2i時のみ Denoise (ノイズ強度) スライダーを表示 -->
                <div v-if="imageGenMode === 'i2i'" class="denoise-slider-box">
                    <span class="denoise-label">Denoise (変化度): <span class="denoise-val">{{ (configStore.forgeDenoisingStrength !== undefined ? configStore.forgeDenoisingStrength : 0.7).toFixed(2) }}</span></span>
                    <input 
                        type="range" 
                        min="0.0" 
                        max="1.0" 
                        step="0.05" 
                        v-model.number="configStore.forgeDenoisingStrength" 
                        class="denoise-slider"
                        @change="configStore.saveConfig()"
                    />
                </div>
            </div>
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
                    :placeholder="imageGenMode ? (imageGenMode === 't2i' ? '[画像生成] プロンプトを入力...' : '[画像編集] 編集指示を入力...（元画像が必要です）') : 'メッセージを入力...'" 
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
            <div class="image-modal-content" @click.stop>
                <img :src="activeImageUrl" class="full-image" @click="closeImageModal" />
                
                <div class="modal-action-bar">
                    <button type="button" class="modal-action-btn i2i-btn" @click="useAsI2iSource(activeImageUrl); closeImageModal()" title="この画像を画像編集 (i2i) の元画像に設定">
                        <i class="pi pi-pencil"></i> この画像を i2i 元画像に設定
                    </button>
                    
                    <button v-if="imageParametersText" type="button" class="modal-action-btn info-btn" :class="{ 'active-info': showInfoPanel }" @click="showInfoPanel = !showInfoPanel" title="生成パラメータを表示">
                        <i class="pi pi-info-circle"></i> 生成パラメータ
                    </button>

                    <button type="button" class="modal-action-btn folder-btn" @click="openDownloadsFolder" title="画像の保存先（ダウンロード）フォルダを開く">
                        <i class="pi pi-folder-open"></i> 保存先を開く
                    </button>
                </div>

                <!-- パラメータ詳細表示パネル -->
                <div v-if="showInfoPanel && imageParametersText" class="info-panel-overlay">
                    <div class="info-panel-header">
                        <span class="info-panel-title"><i class="pi pi-info-circle"></i> 生成パラメータ詳細</span>
                        <div class="info-panel-actions">
                            <button type="button" class="panel-icon-btn" @click="copyParameters" title="パラメータをコピー">
                                <i class="pi" :class="copied ? 'pi-check text-green-500' : 'pi-copy'"></i>
                            </button>
                            <button type="button" class="panel-icon-btn" @click="showInfoPanel = false" title="閉じる">
                                <i class="pi pi-times"></i>
                            </button>
                        </div>
                    </div>
                    <div class="info-panel-body">
                        <pre class="parameters-pre">{{ imageParametersText }}</pre>
                    </div>
                </div>
            </div>
        </div>

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
    min-height: 0;
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
    position: relative;
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
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
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
    width: 100%;
    height: 100%;
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

/* シークレットヘッダー */
.chat-wrapper.secret-mode .chat-header {
    background: rgba(30, 27, 75, 0.4);
    border-bottom: 1px solid rgba(168, 85, 247, 0.15);
}

.chat-wrapper.secret-mode .chat-title {
    color: #e9d5ff; /* 淡い紫 */
    font-weight: 600;
    text-shadow: 0 0 8px rgba(168, 85, 247, 0.3);
}

.chat-wrapper.secret-mode .secret-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(168, 85, 247, 0.2);
    color: #e9d5ff;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 10px;
    border: 1px solid rgba(168, 85, 247, 0.3);
    margin-left: 8px;
}

/* シークレットモードのヘッダーボタン */
.chat-wrapper.secret-mode .icon-btn {
    color: #a78bfa;
}

.chat-wrapper.secret-mode .icon-btn:hover {
    color: #c084fc;
    background: rgba(168, 85, 247, 0.2);
}

.chat-wrapper.secret-mode .icon-btn.active-btn {
    color: #fff;
    background: rgba(168, 85, 247, 0.4);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.4);
}

.chat-wrapper.secret-mode .icon-btn.active-secret-btn {
    color: #fff;
    background: rgba(168, 85, 247, 0.5);
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.6);
}

/* メッセージエリア */
.chat-wrapper.secret-mode .message-container {
    background: transparent;
}

.chat-wrapper.secret-mode .message-row.user .bubble {
    background: linear-gradient(135deg, #7c3aed, #a855f7); /* 明るめの紫グラデーション */
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
}

.chat-wrapper.secret-mode .message-row.mascot .bubble {
    background: rgba(46, 37, 84, 0.8);
    color: #e9d5ff;
    border: 1px solid rgba(168, 85, 247, 0.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* 入力エリア（フッター） */
.chat-wrapper.secret-mode .chat-footer {
    background: rgba(30, 27, 75, 0.4);
    border-top: 1px solid rgba(168, 85, 247, 0.15);
}

.chat-wrapper.secret-mode .input-wrapper {
    background: rgba(15, 12, 30, 0.6);
    border: 1px solid rgba(168, 85, 247, 0.25);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.chat-wrapper.secret-mode .message-input {
    color: #f3e8ff;
}

.chat-wrapper.secret-mode .message-input::placeholder {
    color: #7c3aed;
    opacity: 0.6;
}

.chat-wrapper.secret-mode .send-btn {
    color: #ffffff;
    background: #8b5cf6;
}

.chat-wrapper.secret-mode .send-btn:hover:not(:disabled) {
    background: #a78bfa;
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
}

.chat-wrapper.secret-mode .attach-btn {
    color: #a78bfa;
}

.chat-wrapper.secret-mode .attach-btn:hover {
    color: #c084fc;
    background: rgba(168, 85, 247, 0.15);
}

/* ---- 画像生成・編集メニュー（ドロップダウン） ---- */
.image-menu-wrapper {
    position: relative;
    display: inline-block;
}

.image-dropdown-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 200px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(168, 85, 247, 0.2);
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    padding: 6px;
    z-index: 110;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.chat-wrapper.secret-mode .image-dropdown-menu {
    background: rgba(30, 27, 75, 0.95);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 12px;
    color: #475569;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    position: relative;
}

.chat-wrapper.secret-mode .menu-item {
    color: #e2e8f0;
}

.menu-item:hover {
    background: rgba(168, 85, 247, 0.08);
    color: #8b5cf6;
}

.chat-wrapper.secret-mode .menu-item:hover {
    background: rgba(168, 85, 247, 0.2);
    color: #f3e8ff;
}

.menu-item i:first-child {
    font-size: 13px;
    width: 14px;
    text-align: center;
}

.active-check {
    position: absolute;
    right: 12px;
    color: #a855f7;
    font-size: 12px;
}

.chat-wrapper.secret-mode .active-check {
    color: #c084fc;
}

.menu-divider {
    height: 1px;
    background: rgba(0, 0, 0, 0.06);
    margin: 4px 6px;
}

.chat-wrapper.secret-mode .menu-divider {
    background: rgba(255, 255, 255, 0.08);
}

/* ---- 画像生成・編集モードインジケーター ---- */
.image-gen-indicator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(168, 85, 247, 0.06);
    border: 1px solid rgba(168, 85, 247, 0.15);
    border-radius: 8px;
    padding: 6px 12px;
    margin-bottom: 8px;
    box-sizing: border-box;
    animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.chat-wrapper.secret-mode .image-gen-indicator {
    background: rgba(168, 85, 247, 0.12);
    border-color: rgba(168, 85, 247, 0.3);
}

.indicator-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: #7c3aed;
}

.chat-wrapper.secret-mode .indicator-text {
    color: #d8b4fe;
}

.cancel-mode-btn {
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 10px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.chat-wrapper.secret-mode .cancel-mode-btn {
    color: #cbd5e1;
}

.cancel-mode-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #0f172a;
}

.chat-wrapper.secret-mode .cancel-mode-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.image-gen-indicator.i2i-indicator {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
}

.indicator-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.denoise-slider-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 6px;
    border-top: 1px dashed rgba(168, 85, 247, 0.15);
}

.chat-wrapper.secret-mode .denoise-slider-box {
    border-top-color: rgba(168, 85, 247, 0.25);
}

.denoise-label {
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
    white-space: nowrap;
    user-select: none;
}

.chat-wrapper.secret-mode .denoise-label {
    color: #cbd5e1;
}

.denoise-val {
    font-family: monospace;
    font-weight: bold;
    color: #7c3aed;
}

.chat-wrapper.secret-mode .denoise-val {
    color: #d8b4fe;
}

.denoise-slider {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: rgba(168, 85, 247, 0.15);
    outline: none;
    -webkit-appearance: none;
    cursor: pointer;
}

.denoise-slider::-webkit-slider-runnable-track {
    width: 100%;
    height: 4px;
    cursor: pointer;
    background: transparent;
    border-radius: 2px;
}

.denoise-slider::-webkit-slider-thumb {
    height: 12px;
    width: 12px;
    border-radius: 50%;
    background: #a855f7;
    cursor: pointer;
    -webkit-appearance: none;
    margin-top: -4px;
    transition: transform 0.1s ease;
}

.denoise-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
}

.chat-wrapper.secret-mode .denoise-slider::-webkit-slider-thumb {
    background: #c084fc;
}

/* ---- チャット画像ホバー時のi2i設定ボタン ---- */
.use-i2i-btn {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(124, 58, 237, 0.85);
    color: white;
    border: none;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.2s ease, visibility 0.2s ease, background 0.2s ease, transform 0.2s ease;
    backdrop-filter: blur(4px);
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.attachment-image-box:hover .use-i2i-btn {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
}

.use-i2i-btn:hover {
    background: rgba(124, 58, 237, 1);
    transform: scale(1.05);
}

/* ---- 拡大モーダル用i2iボタン・アクションバー ---- */
.image-modal-content {
    position: relative;
}

.modal-action-bar {
    position: absolute;
    bottom: 20px;
    display: flex;
    gap: 12px;
    z-index: 10000;
}

.modal-action-btn {
    border: none;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
    color: white;
}

.modal-action-btn.i2i-btn {
    background: #8b5cf6;
}

.modal-action-btn.i2i-btn:hover {
    background: #7c3aed;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
}

.modal-action-btn.info-btn {
    background: rgba(30, 41, 59, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(4px);
}

.modal-action-btn.info-btn:hover {
    background: rgba(30, 41, 59, 1);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

.modal-action-btn.info-btn.active-info {
    background: #0ea5e9;
    border-color: #38bdf8;
    box-shadow: 0 0 12px rgba(14, 165, 233, 0.5);
}

.modal-action-btn.folder-btn {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(4px);
}

.modal-action-btn.folder-btn:hover {
    background: rgba(15, 23, 42, 0.9);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

/* ---- パラメータ詳細表示パネル ---- */
.info-panel-overlay {
    position: absolute;
    top: 5%;
    left: 5%;
    width: 90%;
    height: 90%;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    z-index: 10001;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    animation: fadeIn 0.15s ease;
}

.info-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.info-panel-title {
    font-size: 13px;
    font-weight: 600;
    color: #f1f5f9;
    display: flex;
    align-items: center;
    gap: 6px;
}

.info-panel-actions {
    display: flex;
    gap: 8px;
}

.panel-icon-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 14px;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.panel-icon-btn:hover {
    color: #f1f5f9;
    background: rgba(255, 255, 255, 0.08);
}

.info-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
}

.parameters-pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: Consolas, Monaco, monospace;
    font-size: 11px;
    line-height: 1.6;
    color: #cbd5e1;
}

.text-green-500 {
    color: #10b981 !important;
}
</style>
