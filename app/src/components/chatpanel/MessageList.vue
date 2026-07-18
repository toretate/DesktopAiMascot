<script setup lang="ts">
import { ref, nextTick } from 'vue';
import MarkdownMessage from './MarkdownMessage.vue';

const props = defineProps<{
    messages: Array<{
        id: number;
        sender: 'user' | 'mascot';
        text: string;
        deliveryStatus?: 'sending' | 'failed';
        deliveryError?: string;
        attachments?: Array<{
            type: 'image' | 'file';
            name: string;
            url: string;
            size?: number;
        }>;
    }>;
    isSecretMode: boolean;
}>();

const emit = defineEmits<{
    (e: 'open-image', url: string): void;
    (e: 'use-i2i', url: string): void;
    (e: 'delete-message', id: number): void;
    (e: 'register-tts-readings', text: string): void;
    (e: 'replay-tts', text: string): void;
    (e: 'retry-message', id: number): void;
}>();

const messageContainer = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
    if (messageContainer.value) {
        messageContainer.value.scrollTop = messageContainer.value.scrollHeight;
    }
};

defineExpose({
    scrollToBottom
});

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

// --- カスタムコンテキストメニューの制御 ---
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const selectedMessage = ref<any>(null);
const selectedText = ref('');
const contextMenuRef = ref<HTMLElement | null>(null);
let touchTimeout: any = null;
let isTouchMoving = false;

// メニューを開く
const openMenu = (x: number, y: number, msg: any, text = '') => {
    contextMenuX.value = x;
    contextMenuY.value = y;
    selectedMessage.value = msg;
    selectedText.value = text.trim() || msg.text;
    contextMenuVisible.value = true;
    
    nextTick(() => {
        adjustMenuPosition();
    });

    // グローバルイベントの購読
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    if (messageContainer.value) {
        messageContainer.value.addEventListener('scroll', closeMenu);
    }
};

// 画面外へのはみ出し調整
const adjustMenuPosition = () => {
    if (!contextMenuRef.value) return;
    const menuWidth = contextMenuRef.value.offsetWidth;
    const menuHeight = contextMenuRef.value.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (contextMenuX.value + menuWidth > windowWidth) {
        contextMenuX.value = windowWidth - menuWidth - 8;
    }
    if (contextMenuY.value + menuHeight > windowHeight) {
        contextMenuY.value = windowHeight - menuHeight - 8;
    }
};

// メニューを閉じる
const closeMenu = () => {
    contextMenuVisible.value = false;
    window.removeEventListener('click', closeMenu);
    window.removeEventListener('contextmenu', closeMenu);
    if (messageContainer.value) {
        messageContainer.value.removeEventListener('scroll', closeMenu);
    }
};

const getSelectedMessageText = (event: MouseEvent, msg: any): string => {
    const bubble = event.currentTarget as HTMLElement;
    const selection = window.getSelection();
    const hasSelectionInBubble = selection
        && !selection.isCollapsed
        && selection.anchorNode
        && selection.focusNode
        && bubble.contains(selection.anchorNode)
        && bubble.contains(selection.focusNode);
    return hasSelectionInBubble ? selection.toString() : msg.text;
};

// 右クリックハンドラ
const handleContextMenu = (event: MouseEvent, msg: any) => {
    event.preventDefault();
    event.stopPropagation();
    openMenu(event.clientX, event.clientY, msg, getSelectedMessageText(event, msg));
};

// Electron側で contextmenu 発火が抑止される場合の右ボタンフォールバック
const handlePointerDown = (event: PointerEvent, msg: any) => {
    if (event.button !== 2) return;
    event.stopPropagation();
    openMenu(event.clientX, event.clientY, msg, getSelectedMessageText(event, msg));
};

// 長押し（Touch）ハンドラ
const handleTouchStart = (event: TouchEvent, msg: any) => {
    isTouchMoving = false;
    if (touchTimeout) clearTimeout(touchTimeout);
    
    touchTimeout = setTimeout(() => {
        if (!isTouchMoving) {
            event.preventDefault();
            const touch = event.touches[0];
            openMenu(touch.clientX, touch.clientY, msg);
        }
    }, 600); // 600ms の長押しでメニュー表示
};

const handleTouchEnd = () => {
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
};

const handleTouchMove = () => {
    isTouchMoving = true;
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
};

// メッセージ本文コピー処理
const copyMessageText = async () => {
    if (selectedMessage.value) {
        try {
            await navigator.clipboard.writeText(selectedMessage.value.text);
            console.log('[MessageList] Copied:', selectedMessage.value.text);
        } catch (err) {
            console.error('[MessageList] Copy failed:', err);
        }
    }
    closeMenu();
};

// AIに読みを問い合わせるため、選択部分（未選択時はメッセージ全体）を親へ渡す
const registerTtsReadings = () => {
    if (selectedMessage.value?.sender === 'mascot' && selectedText.value.trim()) {
        emit('register-tts-readings', selectedText.value.trim());
    }
    closeMenu();
};
</script>

<template>
    <div 
        class="message-container" 
        :class="{ 'secret-mode': isSecretMode }" 
        ref="messageContainer"
    >
        <div 
            v-for="msg in messages" 
            :key="msg.id" 
            class="message-row"
            :class="[msg.sender, { 'delivery-failed': msg.deliveryStatus === 'failed', 'delivery-sending': msg.deliveryStatus === 'sending' }]"
        >
            <div class="bubble-wrapper">
                <div 
                    class="bubble"
                    @pointerdown="handlePointerDown($event, msg)"
                    @contextmenu.stop.prevent="handleContextMenu($event, msg)"
                    @touchstart="handleTouchStart($event, msg)"
                    @touchend="handleTouchEnd"
                    @touchmove="handleTouchMove"
                >
                    <MarkdownMessage v-if="msg.sender === 'mascot'" class="message-text" :text="msg.text" />
                    <div v-else class="message-text">{{ msg.text }}</div>
                    
                    <!-- 添付ファイル・画像一覧 -->
                    <div v-if="msg.attachments && msg.attachments.length > 0" class="attachments-wrapper">
                        <div 
                            v-for="(att, attIndex) in msg.attachments" 
                            :key="attIndex" 
                            class="attachment-item"
                        >
                            <!-- 画像の場合 -->
                            <div v-if="att.type === 'image'" class="attachment-image-box">
                                <img :src="att.url" :alt="att.name" class="message-image" @click="emit('open-image', att.url)" />
                                <button type="button" class="use-i2i-btn" @click.stop="emit('use-i2i', att.url)" title="この画像を画像編集 (i2i) の元画像に設定">
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
                <div class="message-action-buttons">
                    <button
                        v-if="msg.sender === 'user' && msg.deliveryStatus === 'failed'"
                        type="button"
                        class="message-action-btn retry-message-btn"
                        @click="emit('retry-message', msg.id)"
                        title="メッセージを再送"
                    >
                        <i class="pi pi-refresh"></i>
                    </button>
                    <button
                        v-if="msg.sender === 'mascot'"
                        type="button"
                        class="message-action-btn replay-tts-btn"
                        @click="emit('replay-tts', msg.text)"
                        title="TTSへ再送して読み上げ"
                    >
                        <i class="pi pi-play"></i>
                    </button>
                    <button type="button" class="message-action-btn delete-msg-btn" @click="emit('delete-message', msg.id)" title="メッセージを削除">
                        <i class="pi pi-trash"></i>
                    </button>
                </div>
                <span v-if="msg.sender === 'user' && msg.deliveryStatus === 'failed'" class="delivery-error-label" :title="msg.deliveryError">
                    送信失敗
                </span>
            </div>
        </div>
    </div>

    <!-- overflow:hidden や backdrop-filter の影響を避けるため body 直下へ表示する -->
    <Teleport to="body">
        <div
            v-if="contextMenuVisible"
            ref="contextMenuRef"
            class="custom-context-menu"
            :class="{ 'secret-mode': isSecretMode }"
            :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
            @click.stop
            @contextmenu.stop.prevent
        >
            <div class="menu-item" @click="copyMessageText">
                <i class="pi pi-copy"></i>
                <span>コピー</span>
            </div>
            <div v-if="selectedMessage?.sender === 'mascot'" class="menu-item" @click="registerTtsReadings">
                <i class="pi pi-volume-up"></i>
                <span>英単語読みを辞書登録</span>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.message-container {
    flex: 1;
    min-height: 0;
    padding: 16px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    -webkit-app-region: no-drag;
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

.bubble-wrapper {
    position: relative;
    max-width: 85%;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
}

.message-row.user .bubble-wrapper {
    flex-direction: row-reverse;
}

.message-row.mascot .bubble-wrapper {
    flex-direction: row;
}

.message-action-buttons {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.message-action-btn {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 6px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
}

.bubble-wrapper:hover .message-action-buttons,
.message-action-buttons:focus-within {
    opacity: 1;
}

.delete-msg-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
}

.replay-tts-btn:hover {
    background: rgba(124, 58, 237, 0.1);
    color: var(--color-primary-hover);
}

.retry-message-btn {
    color: #dc2626;
}

.retry-message-btn:hover {
    background: rgba(239, 68, 68, 0.12);
    color: #b91c1c;
}

.message-row.delivery-failed .message-action-buttons {
    opacity: 1;
}

.delivery-error-label {
    color: #dc2626;
    font-size: 10px;
    white-space: nowrap;
}

.bubble {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.4;
    word-break: break-all;
    min-width: 0;
    max-width: 100%;
    -webkit-app-region: no-drag;
}

.message-text {
    cursor: text;
    user-select: text;
    -webkit-user-select: text;
}

.user .bubble {
    background: var(--theme-accent-200);
    color: var(--color-primary-strong);
    border-bottom-right-radius: 2px;
    box-shadow: 0 2px 8px var(--color-primary-alpha-08);
}

.message-row.user.delivery-failed .bubble {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fca5a5;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.16);
}

.message-row.user.delivery-sending .bubble {
    opacity: 0.72;
}

.mascot .bubble {
    background: rgba(243, 232, 255, 0.7);
    color: #4a2c7a;
    border-bottom-left-radius: 2px;
    border: 1px solid var(--color-primary-alpha-10);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
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
    border-color: var(--color-primary);
}

.attachment-file-box i {
    color: var(--color-primary);
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

/* チャット画像ホバー時のi2i設定ボタン */
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

/* シークレットモードスタイル */
.message-container.secret-mode {
    background: transparent;
}

.message-container.secret-mode .message-row.user .bubble {
    background: linear-gradient(135deg, var(--color-primary-hover), var(--color-primary));
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
}

.message-container.secret-mode .message-row.user.delivery-failed .bubble {
    background: rgba(127, 29, 29, 0.9);
    color: #fecaca;
    border: 1px solid #ef4444;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.24);
}

.message-container.secret-mode .message-row.mascot .bubble {
    background: rgba(46, 37, 84, 0.8);
    color: var(--theme-accent-200);
    border: 1px solid var(--color-primary-alpha-20);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* カスタムコンテキストメニュー */
.custom-context-menu {
    position: fixed;
    z-index: 2147483647;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    border-radius: 8px;
    padding: 4px 0;
    min-width: 120px;
    user-select: none;
    -webkit-app-region: no-drag;
}

.custom-context-menu .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 13px;
    color: #334155;
    cursor: pointer;
    transition: background 0.15s ease;
}

.custom-context-menu .menu-item:hover {
    background: #f1f5f9;
    color: var(--color-primary-hover);
}

.custom-context-menu .menu-item i {
    font-size: 13px;
}

/* シークレットモードでのコンテキストメニュー */
.custom-context-menu.secret-mode {
    background: #1e1e2f;
    border-color: #2d2d3f;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.custom-context-menu.secret-mode .menu-item {
    color: #cbd5e1;
}

.custom-context-menu.secret-mode .menu-item:hover {
    background: #2d2d3f;
    color: var(--theme-accent-400);
}
</style>
