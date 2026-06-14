<script setup lang="ts">
import { ref } from 'vue';

const activeMenu = defineModel<string>('activeMenu', { required: true });

defineProps<{
    menuItems: { name: string; value: string; icon: string }[];
}>();

const emit = defineEmits<{
    (e: 'back'): void;
}>();

const isSidebarCollapsed = ref(true);

const handleMouseEnter = () => {
    isSidebarCollapsed.value = false;
};

const handleMouseLeave = () => {
    isSidebarCollapsed.value = true;
};

const relaunchApp = () => {
    if (window.electronAPI && window.electronAPI.relaunchApp) {
        window.electronAPI.relaunchApp();
    }
};

const quitApp = () => {
    if (window.electronAPI && window.electronAPI.quitApp) {
        window.electronAPI.quitApp();
    }
};

const goBack = () => {
    emit('back');
};
</script>

<template>
    <!-- 1. 左サイドバー -->
    <aside 
        class="sidebar drag-area" 
        :class="{ 'collapsed': isSidebarCollapsed }"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
    >
        <div class="brand no-drag flex justify-content-between align-items-center">
            <div class="brand-info flex align-items-center gap-2" v-if="!isSidebarCollapsed">
                <span class="logo">🤖</span>
                <div class="brand-text">
                    <h2>Mascot App</h2>
                    <p>環境設定</p>
                </div>
            </div>
            <div class="brand-info flex align-items-center justify-content-center w-full" v-else>
                <span class="logo" style="font-size: 24px;">🤖</span>
            </div>
        </div>

        <!-- ナビゲーションメニュー -->
        <nav class="menu no-drag">
            <button 
                class="menu-item back-menu-item"
                :class="{ 'collapsed': isSidebarCollapsed }"
                @click="goBack"
                title="設定を閉じる"
            >
                <i class="pi pi-arrow-left"></i>
                <span v-if="!isSidebarCollapsed">設定を閉じる</span>
            </button>
            <div class="menu-divider" style="height: 1px; background: rgba(255, 255, 255, 0.1); margin: 0.5rem 0;"></div>
            <button 
                v-for="item in menuItems"
                :key="item.value"
                class="menu-item" 
                :class="{ active: activeMenu === item.value, 'collapsed': isSidebarCollapsed }"
                @click="activeMenu = item.value"
                :title="isSidebarCollapsed ? item.name : ''"
            >
                <i :class="item.icon"></i>
                <span v-if="!isSidebarCollapsed">{{ item.name }}</span>
            </button>
        </nav>

        <div class="sidebar-footer no-drag">
            <button class="relaunch-btn" @click="relaunchApp" :title="isSidebarCollapsed ? '再起動' : ''">
                <i class="pi pi-refresh"></i>
                <span v-if="!isSidebarCollapsed">再起動</span>
            </button>
            <button class="quit-btn" @click="quitApp" :title="isSidebarCollapsed ? 'アプリ終了' : ''">
                <i class="pi pi-power-off"></i>
                <span v-if="!isSidebarCollapsed">アプリ終了</span>
            </button>
        </div>
    </aside>
</template>
