<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useConfigStore } from '../../store/config';
import { useMascotStore } from '../../store/mascot';
import radioIcon from '../../assets/radio_icon.svg';

const props = defineProps<{
    imageGenMode: 't2i' | 'i2i' | null;
    showHistoryList: boolean;
    showTaskManagement: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:imageGenMode', value: 't2i' | 'i2i' | null): void;
    (e: 'update:showHistoryList', value: boolean): void;
    (e: 'update:showTaskManagement', value: boolean): void;
    (e: 'clear-history'): void;
    (e: 'open-image-gen-dialog'): void;
}>();

const configStore = useConfigStore();
const mascotStore = useMascotStore();

const { activeMascot, useTts } = storeToRefs(configStore);
const { isSecretMode, isRadioMode } = storeToRefs(mascotStore);

const showImageMenu = ref(false);

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

const setImageGenMode = (mode: 't2i' | 'i2i') => {
    emit('update:imageGenMode', mode);
    showImageMenu.value = false;
};

const openImageGenDialog = () => {
    emit('open-image-gen-dialog');
    showImageMenu.value = false;
};

const triggerClearHistory = () => {
    emit('clear-history');
};

const toggleHistory = () => {
    emit('update:showHistoryList', !props.showHistoryList);
};

const openSettings = () => {
    if (window.electronAPI && window.electronAPI.openSettings) {
        window.electronAPI.openSettings();
    }
};

// ---- ヘッダードラッグ制御 ----
let isHeaderDragging = false;
let startHeaderMouseX = 0;
let startHeaderMouseY = 0;

const onHeaderMouseDown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // 左クリックかつ、ボタン類（header-actions の中の要素）以外をクリックした場合のみドラッグ開始
    if (e.button !== 0 || target.closest('.header-actions')) return;

    e.preventDefault();

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

    if (e.buttons !== 1) {
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

onMounted(() => {
    document.addEventListener('click', handleDocumentClick);
});

onUnmounted(() => {
    document.removeEventListener('click', handleDocumentClick);
    window.removeEventListener('mousemove', onHeaderMouseMove);
    window.removeEventListener('mouseup', onHeaderMouseUp);
});
</script>

<template>
    <header class="chat-header" :class="{ 'secret-mode': isSecretMode }" @mousedown="onHeaderMouseDown">
        <span class="chat-title" :class="{ 'secret-mode': isSecretMode }">
            {{ activeMascot ? `${activeMascot.name} Chat` : 'Mascot Chat' }}
            <span v-if="isSecretMode" class="secret-badge" title="シークレットモード有効中">
                <i class="pi pi-eye-slash"></i> Secret
            </span>
        </span>
        <div class="header-actions">
            <button class="icon-btn" @click="mascotStore.setSecretMode(!isSecretMode)" :class="{ 'active-secret-btn': isSecretMode, 'secret-mode': isSecretMode }" title="シークレットモード ON/OFF">
                <i :class="isSecretMode ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
            <button class="icon-btn" @click="configStore.updateConfig({ useTts: !useTts }); configStore.saveConfig()" :class="{ 'active-btn': useTts, 'secret-mode': isSecretMode }" title="音声読み上げ (TTS) ON/OFF">
                <i :class="useTts ? 'pi pi-volume-up' : 'pi pi-volume-off'"></i>
            </button>
            <!-- 画像生成・編集メニュー -->
            <div class="image-menu-wrapper">
                <button type="button" class="icon-btn" @click="toggleImageMenu" :class="{ 'active-btn': imageGenMode !== null, 'secret-mode': isSecretMode }" title="画像生成・編集メニュー">
                    <i class="pi pi-image"></i>
                </button>
                <div v-if="showImageMenu" class="image-dropdown-menu" :class="{ 'secret-mode': isSecretMode }">
                    <div class="menu-item" :class="{ 'secret-mode': isSecretMode }" @click="setImageGenMode('t2i')">
                        <i class="pi pi-pencil"></i> テキストから画像生成 (t2i)
                        <i v-if="imageGenMode === 't2i'" class="pi pi-check active-check" :class="{ 'secret-mode': isSecretMode }"></i>
                    </div>
                    <div class="menu-item" :class="{ 'secret-mode': isSecretMode }" @click="setImageGenMode('i2i')">
                        <i class="pi pi-image"></i> 画像から画像生成 (i2i)
                        <i v-if="imageGenMode === 'i2i'" class="pi pi-check active-check" :class="{ 'secret-mode': isSecretMode }"></i>
                    </div>
                    <div class="menu-divider" :class="{ 'secret-mode': isSecretMode }"></div>
                    <div class="menu-item" :class="{ 'secret-mode': isSecretMode }" @click="openImageGenDialog">
                        <i class="pi pi-cog"></i> 生成パラメータ設定
                    </div>
                </div>
            </div>
            <button class="icon-btn" @click="mascotStore.setRadioMode(!isRadioMode)" :class="{ 'active-radio-btn': isRadioMode, 'secret-mode': isSecretMode }" title="ラジオモード ON/OFF">
                <img :src="radioIcon" class="radio-svg-icon" :class="{ 'active-radio-btn': isRadioMode }" alt="ラジオ" />
            </button>
            <button class="icon-btn" @click="emit('update:showTaskManagement', !showTaskManagement)" :class="{ 'active-btn': showTaskManagement, 'secret-mode': isSecretMode }" title="タスク管理 ON/OFF">
                <i class="pi pi-check-square"></i>
            </button>
            <button class="icon-btn" @click="triggerClearHistory" :class="{ 'secret-mode': isSecretMode }" title="新規話題"><i class="pi pi-plus"></i></button>
            <button class="icon-btn" @click="toggleHistory" :class="{ 'active-btn': showHistoryList, 'secret-mode': isSecretMode }" title="履歴一覧"><i class="pi pi-history"></i></button>
            <button class="icon-btn" @click="openSettings" :class="{ 'secret-mode': isSecretMode }" title="設定"><i class="pi pi-cog"></i></button>
        </div>
    </header>
</template>

<style scoped>
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

.menu-item:hover {
    background: rgba(168, 85, 247, 0.08);
    color: #8b5cf6;
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

.menu-divider {
    height: 1px;
    background: rgba(0, 0, 0, 0.06);
    margin: 4px 6px;
}

/* シークレットモードスタイル */
.chat-header.secret-mode {
    background: rgba(30, 27, 75, 0.4);
    border-bottom: 1px solid rgba(168, 85, 247, 0.15);
}

.chat-title.secret-mode {
    color: #e9d5ff; /* 淡い紫 */
    font-weight: 600;
    text-shadow: 0 0 8px rgba(168, 85, 247, 0.3);
}

.secret-badge {
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

.icon-btn.secret-mode {
    color: #a78bfa;
}

.icon-btn.secret-mode:hover {
    color: #c084fc;
    background: rgba(168, 85, 247, 0.2);
}

.icon-btn.secret-mode.active-btn {
    color: #fff;
    background: rgba(168, 85, 247, 0.4);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.4);
}

.icon-btn.secret-mode.active-secret-btn {
    color: #fff;
    background: rgba(168, 85, 247, 0.5);
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.6);
}

.image-dropdown-menu.secret-mode {
    background: rgba(30, 27, 75, 0.95);
    border-color: rgba(168, 85, 247, 0.4);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
}

.menu-item.secret-mode {
    color: #e2e8f0;
}

.menu-item.secret-mode:hover {
    background: rgba(168, 85, 247, 0.2);
    color: #f3e8ff;
}

.active-check.secret-mode {
    color: #c084fc;
}

.menu-divider.secret-mode {
    background: rgba(255, 255, 255, 0.08);
}
</style>
