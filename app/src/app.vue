<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MascotViewer from './components/MascotViewer.vue';
import ChatPanel from './components/ChatPanel.vue';
import SettingsWindow from './components/settings/SettingsWindow.vue';
import IntegratedLayout from './components/layouts/IntegratedLayout.vue';
import CompactLayout from './components/layouts/CompactLayout.vue';
import TaskManagement from './components/TaskManagement.vue';

const currentHash = ref(window.location.hash);

const updateHash = () => {
    currentHash.value = window.location.hash;
};

onMounted(() => {
    window.addEventListener('hashchange', updateHash);
});

onUnmounted(() => {
    window.removeEventListener('hashchange', updateHash);
});
</script>

<template>
    <!-- ウィンドウのハッシュパラメータ（ルーティング）に応じて表示コンポーネントを切り替え -->
    <div class="app-root">
        <MascotViewer v-if="currentHash === '#mascot'" />
        <ChatPanel v-else-if="currentHash === '#chat'" />
        <SettingsWindow v-else-if="currentHash === '#settings'" />
        <TaskManagement v-else-if="currentHash === '#tasks'" />
        <IntegratedLayout v-else-if="currentHash === '#integrated' || currentHash === '' || currentHash === '#/' || currentHash === '#web'" />
        <CompactLayout v-else-if="currentHash === '#compact'" />
        <div v-else class="fallback-view">
            <p>不明なウィンドウハッシュ: {{ currentHash }}</p>
        </div>
    </div>
</template>

<style>
.app-root {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
}

.fallback-view {
    color: #fff;
    font-family: sans-serif;
    text-align: center;
    padding-top: 50px;
}
</style>
