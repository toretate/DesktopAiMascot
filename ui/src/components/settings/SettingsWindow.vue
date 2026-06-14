<script setup lang="ts">
import Card from 'primevue/card';

// リファクタリング済みコンポーネントおよび composable のインポート
import SettingsSideBar from './components/SettingsSideBar.vue';
import MascotSettings from './MascotSettings.vue';
import VoiceGenSettingsPanel from './VoiceGenSettingsPanel.vue';
import ImageGenSettingsPanel from './ImageGenSettingsPanel.vue';
import MovieGenSettingsPanel from './MovieGenSettingsPanel.vue';
import ApiKeySettingsPanel from './ApiKeySettingsPanel.vue';
import ChatGenSettingsPanel from './ChatGenSettingsPanel.vue';
import WindowSettingsPanel from './WindowSettingsPanel.vue';
import { useSettingsWindow } from './composables/useSettingsWindow';

const {
    geminiApiKey,
    mascots,
    activeMascotId,
    activeMenu,
    saveStatus,
    isSaving,
    menuItems,
    handleLiveUpdate,
    addMascot,
    deleteMascot,
    saveSettings,
    goBack
} = useSettingsWindow();
</script>

<template>
    <div class="settings-layout">
        <!-- 閉じるフローティングボタン -->
        <button class="close-floating-btn" @click="goBack" title="設定を閉じる">
            <i class="pi pi-times"></i>
        </button>

        <!-- 1. 左サイドバー -->
        <SettingsSideBar 
            v-model:activeMenu="activeMenu"
            :menuItems="menuItems"
            @back="goBack"
        />

        <!-- 2. 右側メインコンテンツエリア -->
        <main class="main-content" :class="{ 'mascot-active': activeMenu === 'mascot' }">
            <div class="content-container" :class="{ 'full-width': activeMenu === 'mascot' }">
                <!-- パネル1: マスコット (リファクタリング済み子コンポーネント) -->
                <div v-if="activeMenu === 'mascot'" class="panel-section">
                    <MascotSettings 
                        :mascots="mascots"
                        v-model:activeMascotId="activeMascotId"
                        :geminiApiKey="geminiApiKey"
                        @live-update="handleLiveUpdate"
                        @save-settings="saveSettings"
                        @add-mascot="addMascot"
                        @delete-mascot="deleteMascot"
                    />
                </div>

                <!-- パネル2: チャットAI -->
                <div v-else-if="activeMenu === 'chat'" class="panel-section">
                    <ChatGenSettingsPanel />
                </div>

                <!-- パネル2.5: ウィンドウ・ディスプレイ設定 -->
                <div v-else-if="activeMenu === 'chatwindow'" class="panel-section">
                    <WindowSettingsPanel />
                </div>

                <!-- パネル3: 音声AI -->
                <div v-else-if="activeMenu === 'voice'" class="panel-section">
                    <VoiceGenSettingsPanel />
                </div>

                <!-- パネル4: 画像AI -->
                <div v-else-if="activeMenu === 'image'" class="panel-section">
                    <ImageGenSettingsPanel />
                </div>

                <!-- パネル5: 動画AI -->
                <div v-else-if="activeMenu === 'video'" class="panel-section">
                    <MovieGenSettingsPanel />
                </div>

                <!-- パネル6: APIキー -->
                <div v-else-if="activeMenu === 'apikey'" class="panel-section">
                    <ApiKeySettingsPanel />
                </div>
            </div>
        </main>
    </div>
</template>

<style>
/* --- 全体レイアウト & ライトテーマ調プレミアムCSS --- */
.settings-layout {
    display: flex;
    height: 100vh;
    background: #f8fafc; /* ライトスレートグレー */
    color: #334155;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
}

/* 左サイドバー */
.sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 240px;
    background: #0f172a; /* ダークネイビー (コントラスト用) */
    color: #cbd5e1;
    display: flex;
    flex-direction: column;
    padding: 1.5rem 1rem;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    box-shadow: 4px 0 25px rgba(0, 0, 0, 0.15);
}
.sidebar.collapsed {
    width: 72px;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.08);
}

.brand h2 {
    font-size: 16px;
    font-weight: 800;
    margin: 0;
    color: #ffffff;
}
.brand p {
    font-size: 10px;
    margin: 0;
    color: #64748b;
}

.menu {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 2rem;
    flex-grow: 1;
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    font-weight: 500;
    transition: all 0.2s ease;
    width: 100%;
}
.menu-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
}
.menu-item.active {
    background: #a855f7;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.25);
}

.sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.relaunch-btn {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: transparent;
    border: none;
    color: #eab308;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    font-weight: 600;
    transition: all 0.2s ease;
}
.relaunch-btn:hover {
    background: rgba(234, 179, 8, 0.1);
}

.quit-btn {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: transparent;
    border: none;
    color: #ef4444;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    width: 100%;
    font-weight: 600;
}
.quit-btn:hover {
    background: rgba(239, 68, 68, 0.1);
}

/* メインコンテンツ */
.main-content {
    flex-grow: 1;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 2rem;
    margin-left: 72px; /* 折りたたみ時のサイドバー幅分の固定余白を確保してオーバーレイ化 */
    box-sizing: border-box;
    overflow: hidden;
}
.main-content.mascot-active {
    padding: 24px 48px 24px 24px !important; /* 閉じるボタンと重ならない適度な余白に最適化 */
}

.content-container {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    height: 100%;
    display: flex;
    flex-direction: column;
}
.content-container.full-width {
    max-width: 100%;
}

.panel-section {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.premium-card {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    border-radius: 16px !important;
    box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05) !important;
    padding: 1.5rem !important;
}

/* 各フォーム項目 */
.form-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}
.form-field label {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
}

/* 閉じるフローティングボタン */
.close-floating-btn {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 1010;
    transition: all 0.2s ease-in-out;
}

.close-floating-btn:hover {
    color: #0f172a;
    background: #f1f5f9;
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.close-floating-btn i {
    font-size: 16px;
    font-weight: bold;
}
</style>
