<script setup lang="ts">
import { computed, ref } from 'vue';
import MascotViewer from '../MascotViewer.vue';
import ChatPanel from '../ChatPanel.vue';
import TaskManagement from '../TaskManagement.vue';
import { useConfigStore } from '../../store/config';
import { useTaskStore } from '../../store/task';
import { useMemoStore } from '../../store/memo';
import MemoWidget from '../MemoWidget.vue';
import MusicWidget from '../MusicWidget.vue';
import { useMusicStore } from '../../store/music';
import { storeToRefs } from 'pinia';
import { resolveMascotImageUrl } from '../../utils/mascot-image-url';

const configStore = useConfigStore();
const taskStore = useTaskStore();
const memoStore = useMemoStore();
const musicStore = useMusicStore();
const { 
    windowMode,
    integratedBackgroundColor,
    integratedBackgroundOpacity,
    integratedBackgroundImage,
    integratedBackgroundImageOpacity,
    integratedBackgroundImageFit,
    useServer,
    serverHost,
    serverPort,
    integratedChatRatio
} = storeToRefs(configStore);

const { showTaskWidget } = storeToRefs(taskStore);
const { showMemoWidget } = storeToRefs(memoStore);
const { showMusicWidget, playlistExpanded, contentPanelExpanded } = storeToRefs(musicStore);

// チャット欄の幅比率の調整（スプリッターのドラッグ）
const MIN_CHAT_RATIO = 0.2;
const MAX_CHAT_RATIO = 0.8;
const containerRef = ref<HTMLElement | null>(null);
const isResizing = ref(false);

const chatSectionStyle = computed(() => {
    if (windowMode.value === 'compact') return {};
    const ratio = Math.min(MAX_CHAT_RATIO, Math.max(MIN_CHAT_RATIO, integratedChatRatio.value ?? 0.6));
    return { '--integrated-chat-size': `${(ratio * 100).toFixed(2)}%` };
});

const onSplitterPointerDown = (event: PointerEvent) => {
    const container = containerRef.value;
    if (!container) return;
    isResizing.value = true;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);

    const onMove = (e: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0) return;
        const ratio = (rect.right - e.clientX) / rect.width;
        integratedChatRatio.value = Math.min(MAX_CHAT_RATIO, Math.max(MIN_CHAT_RATIO, ratio));
    };
    const onUp = (e: PointerEvent) => {
        isResizing.value = false;
        (event.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        configStore.saveConfig();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
};

// アセットURLの解決
const resolveImageUrl = (path: string | undefined | null): string => {
    return resolveMascotImageUrl(path, {
        serverHost: serverHost.value,
        serverPort: serverPort.value,
        absoluteMascotUrl: useServer.value
    });
};

const getRgbaBackground = computed(() => {
    const hex = integratedBackgroundColor.value || '#1e1e2e';
    const opacity = integratedBackgroundOpacity.value !== undefined ? integratedBackgroundOpacity.value : 1.0;
    
    let r = 30, g = 30, b = 46;
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

const integratedBackgroundStyle = computed(() => {
    const styles: Record<string, any> = {
        backgroundColor: getRgbaBackground.value,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0
    };
    if (integratedBackgroundImage.value) {
        styles.backgroundImage = `url(${resolveImageUrl(integratedBackgroundImage.value)})`;
        styles.opacity = integratedBackgroundImageOpacity.value;
        
        if (integratedBackgroundImageFit.value === 'cover') {
            styles.backgroundSize = 'cover';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (integratedBackgroundImageFit.value === 'contain') {
            styles.backgroundSize = 'contain';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (integratedBackgroundImageFit.value === 'fill') {
            styles.backgroundSize = '100% 100%';
            styles.backgroundPosition = 'center';
            styles.backgroundRepeat = 'no-repeat';
        } else if (integratedBackgroundImageFit.value === 'tile') {
            styles.backgroundSize = 'auto';
            styles.backgroundPosition = 'top left';
            styles.backgroundRepeat = 'repeat';
        }
    }
    return styles;
});
</script>

<template>
    <div ref="containerRef" class="integrated-container" :class="{ 'is-resizing': isResizing }">
        <!-- 背景レイヤー -->
        <div class="integrated-background" :style="integratedBackgroundStyle"></div>

        <!-- マスコット表示エリア -->
        <div v-if="windowMode !== 'compact'" class="mascot-section">
            <MascotViewer />
        </div>
        <!-- チャット欄の幅を調整するスプリッター -->
        <div
            v-if="windowMode !== 'compact'"
            class="section-splitter"
            @pointerdown="onSplitterPointerDown"
        ></div>
        <!-- チャット表示エリア -->
        <div
            class="chat-section"
            :class="{
                'is-compact': windowMode === 'compact',
                'has-music-widget': showMusicWidget,
                'has-expanded-music-widget': showMusicWidget && (playlistExpanded || contentPanelExpanded)
            }"
            :style="chatSectionStyle"
        >
            <ChatPanel />
        </div>
        
        <!-- フローティングウィジェット用絶対配置レイヤー（Flexレイアウト干渉防止） -->
        <div class="floating-widgets-layer">
            <!-- タスク管理フローティングウィジェット -->
            <TaskManagement v-if="showTaskWidget" />

            <!-- メモ管理フローティングウィジェット -->
            <MemoWidget v-if="showMemoWidget" />

            <!-- ローカル音楽再生フローティングウィジェット -->
            <MusicWidget v-if="showMusicWidget" />
        </div>
    </div>
</template>

<style scoped>
.integrated-container {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    box-sizing: border-box;
}

.integrated-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
    pointer-events: none;
}

.mascot-section {
    flex: 1;
    min-width: 0;
    height: 100%;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    overflow: hidden;
    z-index: 1;
}

.section-splitter {
    flex: 0 0 6px;
    height: 100%;
    cursor: col-resize;
    background: rgba(255, 255, 255, 0.1);
    background-clip: content-box;
    padding: 0 2px;
    box-sizing: border-box;
    z-index: 2;
    touch-action: none;
    transition: background-color 0.15s;
}

.section-splitter:hover,
.integrated-container.is-resizing .section-splitter {
    background-color: rgba(255, 255, 255, 0.35);
}

/* ドラッグ中はマスコット/チャット内の canvas 等にイベントを奪われないようにする */
.integrated-container.is-resizing .mascot-section,
.integrated-container.is-resizing .chat-section {
    pointer-events: none;
    user-select: none;
}

.chat-section {
    flex: 0 0 var(--integrated-chat-size, 60%);
    min-width: 0;
    height: 100%;
    position: relative;
    overflow: hidden;
    padding: 16px;
    box-sizing: border-box;
    z-index: 1;
}

.chat-section.is-compact {
    flex: 1;
    padding: 0;
}

/* 下部プレイヤーの表示中はチャット入力欄まで含めて重ならない高さに収める */
.chat-section.has-music-widget:not(.is-compact) {
    padding-bottom: 100px;
}

.chat-section.has-expanded-music-widget:not(.is-compact) {
    padding-bottom: 220px;
}

/* 子コンポーネントの調整：MascotViewer が画面いっぱいに広がるようにする */
:deep(.mascot-container) {
    width: 100% !important;
    height: 100% !important;
    background: transparent !important;
}

/* ChatPanel 内の背景が二重にならないように透過させる（あるいは設定色をこちらでコントロールする） */
:deep(.chat-panel-container) {
    background: transparent !important;
    height: 100% !important;
}

/* フローティングウィジェット専用の絶対配置レイヤー */
.floating-widgets-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 10;
}

.floating-widgets-layer > * {
    pointer-events: auto;
}

@media (max-width: 768px) and (hover: none) and (pointer: coarse) {
    .integrated-container {
        padding-top: env(safe-area-inset-top, 0px);
        padding-right: env(safe-area-inset-right, 0px);
        padding-bottom: env(safe-area-inset-bottom, 0px);
        padding-left: env(safe-area-inset-left, 0px);
    }

    .chat-section:not(.is-compact) {
        padding: 8px 12px;
    }
}

@media (max-width: 480px) {
    .integrated-container {
        flex-direction: column;
    }

    .mascot-section {
        flex: 2 1 42%;
        width: 100%;
        min-height: 0;
    }

    .section-splitter {
        display: none;
    }

    .chat-section:not(.is-compact) {
        flex: 3 1 58%;
        width: 100%;
        min-height: 0;
    }
}
</style>
