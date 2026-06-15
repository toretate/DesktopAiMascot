<script setup lang="ts">
import { computed } from 'vue';
import MascotViewer from '../MascotViewer.vue';
import ChatPanel from '../ChatPanel.vue';
import { useConfigStore } from '../../store/config';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
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
    configVersion
} = storeToRefs(configStore);

// アセットURLの解決
const resolveImageUrl = (path: string | undefined | null): string => {
    if (!path) return '';
    if (path.startsWith('data:image/')) {
        return path;
    }
    let resolved = path;
    if (path.startsWith('/mascots/') && useServer.value) {
        resolved = `http://${serverHost.value}:${serverPort.value}${path}`;
    }
    if (/^[a-zA-Z]:\\/.test(resolved)) {
        return resolved;
    }
    const separator = resolved.includes('?') ? '&' : '?';
    return `${resolved}${separator}v=${configVersion.value}`;
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
    <div class="integrated-container">
        <!-- 背景レイヤー -->
        <div class="integrated-background" :style="integratedBackgroundStyle"></div>
        
        <!-- マスコット表示エリア -->
        <div v-if="windowMode !== 'compact'" class="mascot-section">
            <MascotViewer />
        </div>
        <!-- チャット表示エリア -->
        <div class="chat-section" :class="{ 'is-compact': windowMode === 'compact' }">
            <ChatPanel />
        </div>
    </div>
</template>

<style scoped>
.integrated-container {
    display: flex;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
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
    flex: 4;
    height: 100%;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    overflow: hidden;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 1;
}

.chat-section {
    flex: 6;
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
</style>
