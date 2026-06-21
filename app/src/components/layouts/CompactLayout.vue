<script setup lang="ts">
import { computed } from 'vue';
import ChatPanel from '../ChatPanel.vue';
import { useConfigStore } from '../../store/config';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const { chatBackgroundColor } = storeToRefs(configStore);

// 将来的な背景画像設定のためのプレースホルダー
const backgroundImageStyle = computed(() => {
    return {};
});

// コンテナ全体の背景スタイル（設定された背景色）
const containerStyle = computed(() => {
    return {
        backgroundColor: chatBackgroundColor.value || '#ffffff',
        ...backgroundImageStyle.value
    };
});
</script>

<template>
    <div class="compact-container" :style="containerStyle">
        <ChatPanel />
    </div>
</template>

<style scoped>
.compact-container {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: relative;
    background-position: center;
    background-repeat: no-repeat;
}

/* ChatPanel 内の最外枠の背景を透明にして、containerStyle の背景色が活きるようにする */
:deep(.chat-wrapper) {
    background: transparent !important;
    backdrop-filter: none !important;
    border: none !important;
    box-shadow: none !important;
    height: 100% !important;
}
</style>
