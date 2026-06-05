<script setup lang="ts">
import { computed } from 'vue';
import MascotViewer from '../MascotViewer.vue';
import ChatPanel from '../ChatPanel.vue';
import { useConfigStore } from '../../store/config';
import { storeToRefs } from 'pinia';

const configStore = useConfigStore();
const { chatBackgroundColor } = storeToRefs(configStore);

// 将来的な背景画像設定のためのプレースホルダー（将来的に configStore などに backgroundImageUrl を追加する想定）
const backgroundImageStyle = computed(() => {
    // 例: return { backgroundImage: `url(${backgroundImageUrl.value})`, backgroundSize: 'cover' };
    return {};
});

// チャットの背景色を設定値から適用
const containerStyle = computed(() => {
    return {
        backgroundColor: chatBackgroundColor.value || '#1e1e2e',
        ...backgroundImageStyle.value
    };
});
</script>

<template>
    <div class="integrated-container" :style="containerStyle">
        <!-- マスコット表示エリア -->
        <div class="mascot-section">
            <MascotViewer />
        </div>
        <!-- チャット表示エリア -->
        <div class="chat-section">
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
    background-position: center;
    background-repeat: no-repeat;
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
}

.chat-section {
    flex: 6;
    height: 100%;
    position: relative;
    overflow: hidden;
    padding: 16px;
    box-sizing: border-box;
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
