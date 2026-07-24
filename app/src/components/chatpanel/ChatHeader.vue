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
    showMemoManagement: boolean;
    showMusicPlayer: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:imageGenMode', value: 't2i' | 'i2i' | null): void;
    (e: 'update:showHistoryList', value: boolean): void;
    (e: 'update:showTaskManagement', value: boolean): void;
    (e: 'update:showMemoManagement', value: boolean): void;
    (e: 'update:showMusicPlayer', value: boolean): void;
    (e: 'clear-history'): void;
    (e: 'open-image-gen-dialog'): void;
}>();

const configStore = useConfigStore();
const mascotStore = useMascotStore();

const { activeMascot, useTts } = storeToRefs(configStore);
const { isSecretMode, isRadioMode } = storeToRefs(mascotStore);

const showImageMenu = ref(false);
const showMobileMenu = ref(false);

const toggleImageMenu = (e: MouseEvent) => {
    e.stopPropagation();
    showMobileMenu.value = false;
    showImageMenu.value = !showImageMenu.value;
};

const toggleMobileMenu = (e: MouseEvent) => {
    e.stopPropagation();
    showImageMenu.value = false;
    showMobileMenu.value = !showMobileMenu.value;
};

const closeMobileMenu = () => {
    showMobileMenu.value = false;
};

const handleDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.image-menu-wrapper')) {
        showImageMenu.value = false;
    }
    if (!target.closest('.mobile-menu-wrapper')) {
        showMobileMenu.value = false;
    }
};

const handleDocumentKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
        showImageMenu.value = false;
        showMobileMenu.value = false;
    }
};

const setImageGenMode = (mode: 't2i' | 'i2i') => {
    emit('update:imageGenMode', mode);
    showImageMenu.value = false;
};

const openImageGenDialog = () => {
    emit('open-image-gen-dialog');
    showImageMenu.value = false;
    closeMobileMenu();
};

const triggerClearHistory = () => {
    emit('clear-history');
    closeMobileMenu();
};

const toggleHistory = () => {
    emit('update:showHistoryList', !props.showHistoryList);
    closeMobileMenu();
};

const toggleTts = () => {
    configStore.updateConfig({ useTts: !useTts.value });
    configStore.saveConfig();
};

const toggleRadio = () => {
    mascotStore.setRadioMode(!isRadioMode.value);
    closeMobileMenu();
};

const toggleMemo = () => {
    emit('update:showMemoManagement', !props.showMemoManagement);
    closeMobileMenu();
};

const toggleMusic = () => {
    emit('update:showMusicPlayer', !props.showMusicPlayer);
    closeMobileMenu();
};

const toggleTasks = () => {
    emit('update:showTaskManagement', !props.showTaskManagement);
    closeMobileMenu();
};

const openSettings = () => {
    if (window.electronAPI && window.electronAPI.openSettings) {
        window.electronAPI.openSettings();
    } else {
        window.location.hash = '#settings';
    }
    closeMobileMenu();
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
    document.addEventListener('keydown', handleDocumentKeydown);
});

onUnmounted(() => {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('keydown', handleDocumentKeydown);
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
            <button class="icon-btn" aria-label="シークレットモードを切り替える" :aria-pressed="isSecretMode" @click="mascotStore.setSecretMode(!isSecretMode)" :class="{ 'active-secret-btn': isSecretMode, 'secret-mode': isSecretMode }" title="シークレットモード ON/OFF">
                <i aria-hidden="true" :class="isSecretMode ? 'pi pi-eye-slash' : 'pi pi-eye'"></i>
            </button>
            <button class="icon-btn" aria-label="音声読み上げを切り替える" :aria-pressed="useTts" @click="toggleTts" :class="{ 'active-btn': useTts, 'secret-mode': isSecretMode }" title="アプリ全体の音声 ON/OFF">
                <i aria-hidden="true" :class="useTts ? 'pi pi-volume-up' : 'pi pi-volume-off'"></i>
            </button>
            <!-- 画像生成・編集メニュー -->
            <div class="image-menu-wrapper mobile-collapsible-action">
                <button
                    type="button"
                    class="icon-btn"
                    :class="{ 'active-btn': imageGenMode !== null, 'secret-mode': isSecretMode }"
                    title="画像生成・編集メニュー"
                    aria-label="画像生成・編集メニューを開く"
                    aria-controls="image-generation-menu"
                    :aria-expanded="showImageMenu"
                    @click="toggleImageMenu"
                >
                    <i aria-hidden="true" class="pi pi-image"></i>
                </button>
                <div v-if="showImageMenu" id="image-generation-menu" class="image-dropdown-menu" :class="{ 'secret-mode': isSecretMode }">
                    <button type="button" class="menu-item" :class="{ 'secret-mode': isSecretMode }" @click="setImageGenMode('t2i')">
                        <i class="pi pi-pencil"></i> テキストから画像生成 (t2i)
                        <i v-if="imageGenMode === 't2i'" class="pi pi-check active-check" :class="{ 'secret-mode': isSecretMode }"></i>
                    </button>
                    <button type="button" class="menu-item" :class="{ 'secret-mode': isSecretMode }" @click="setImageGenMode('i2i')">
                        <i class="pi pi-image"></i> 画像から画像生成 (i2i)
                        <i v-if="imageGenMode === 'i2i'" class="pi pi-check active-check" :class="{ 'secret-mode': isSecretMode }"></i>
                    </button>
                    <div class="menu-divider" :class="{ 'secret-mode': isSecretMode }"></div>
                    <button type="button" class="menu-item" :class="{ 'secret-mode': isSecretMode }" @click="openImageGenDialog">
                        <i class="pi pi-cog"></i> 生成パラメータ設定
                    </button>
                </div>
            </div>
            <button class="icon-btn mobile-collapsible-action" aria-label="ラジオモードを切り替える" :aria-pressed="isRadioMode" @click="toggleRadio" :class="{ 'active-radio-btn': isRadioMode, 'secret-mode': isSecretMode }" title="ラジオモード ON/OFF">
                <img :src="radioIcon" class="radio-svg-icon" :class="{ 'active-radio-btn': isRadioMode }" alt="" aria-hidden="true" />
            </button>
            <button class="icon-btn mobile-collapsible-action" aria-label="メモを切り替える" :aria-pressed="showMemoManagement" @click="toggleMemo" :class="{ 'active-btn': showMemoManagement, 'secret-mode': isSecretMode }" title="メモ ON/OFF">
                <i aria-hidden="true" class="pi pi-file-edit"></i>
            </button>
            <button class="icon-btn mobile-collapsible-action" aria-label="音楽プレイヤーを切り替える" :aria-pressed="showMusicPlayer" @click="toggleMusic" :class="{ 'active-btn': showMusicPlayer, 'secret-mode': isSecretMode }" title="音楽プレイヤー ON/OFF">
                <i aria-hidden="true" class="pi pi-headphones"></i>
            </button>
            <button class="icon-btn mobile-collapsible-action" aria-label="タスク管理を切り替える" :aria-pressed="showTaskManagement" @click="toggleTasks" :class="{ 'active-btn': showTaskManagement, 'secret-mode': isSecretMode }" title="タスク管理 ON/OFF">
                <i aria-hidden="true" class="pi pi-check-square"></i>
            </button>
            <button class="icon-btn mobile-collapsible-action" aria-label="新しい話題を開始する" @click="triggerClearHistory" :class="{ 'secret-mode': isSecretMode }" title="新規話題"><i aria-hidden="true" class="pi pi-plus"></i></button>
            <button class="icon-btn mobile-collapsible-action" aria-label="対話履歴を切り替える" :aria-pressed="showHistoryList" @click="toggleHistory" :class="{ 'active-btn': showHistoryList, 'secret-mode': isSecretMode }" title="履歴一覧"><i aria-hidden="true" class="pi pi-history"></i></button>
            <button class="icon-btn mobile-collapsible-action" aria-label="設定を開く" @click="openSettings" :class="{ 'secret-mode': isSecretMode }" title="設定"><i aria-hidden="true" class="pi pi-cog"></i></button>

            <div class="mobile-menu-wrapper">
                <button
                    type="button"
                    class="icon-btn mobile-menu-trigger"
                    :class="{ 'secret-mode': isSecretMode }"
                    aria-label="その他の操作"
                    aria-controls="mobile-chat-actions"
                    :aria-expanded="showMobileMenu"
                    @click="toggleMobileMenu"
                >
                    <i class="pi pi-ellipsis-v"></i>
                </button>
                <div
                    v-if="showMobileMenu"
                    id="mobile-chat-actions"
                    class="mobile-actions-panel"
                    :class="{ 'secret-mode': isSecretMode }"
                >
                    <button type="button" @click="setImageGenMode('t2i'); closeMobileMenu()"><i class="pi pi-pencil"></i><span>テキストから画像生成</span></button>
                    <button type="button" @click="setImageGenMode('i2i'); closeMobileMenu()"><i class="pi pi-image"></i><span>画像から画像生成</span></button>
                    <button type="button" @click="openImageGenDialog"><i class="pi pi-sliders-h"></i><span>画像生成設定</span></button>
                    <button type="button" :class="{ active: isRadioMode }" @click="toggleRadio"><i class="pi pi-desktop"></i><span>ラジオモード</span><i v-if="isRadioMode" class="pi pi-check state-check"></i></button>
                    <button type="button" :class="{ active: showMemoManagement }" @click="toggleMemo"><i class="pi pi-file-edit"></i><span>メモ</span><i v-if="showMemoManagement" class="pi pi-check state-check"></i></button>
                    <button type="button" :class="{ active: showMusicPlayer }" @click="toggleMusic"><i class="pi pi-headphones"></i><span>音楽プレイヤー</span><i v-if="showMusicPlayer" class="pi pi-check state-check"></i></button>
                    <button type="button" :class="{ active: showTaskManagement }" @click="toggleTasks"><i class="pi pi-check-square"></i><span>タスク管理</span><i v-if="showTaskManagement" class="pi pi-check state-check"></i></button>
                    <div class="mobile-menu-divider"></div>
                    <button type="button" @click="triggerClearHistory"><i class="pi pi-plus"></i><span>新規話題</span></button>
                    <button type="button" :class="{ active: showHistoryList }" @click="toggleHistory"><i class="pi pi-history"></i><span>履歴一覧</span></button>
                    <button type="button" @click="openSettings"><i class="pi pi-cog"></i><span>設定</span></button>
                </div>
            </div>
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
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-ink);
}

.header-actions {
    display: flex;
    gap: 4px;
}

.mobile-menu-wrapper {
    display: none;
    position: relative;
}

.icon-btn {
    background: transparent;
    border: none;
    color: var(--color-ink-muted);
    cursor: pointer;
    font-size: 14px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s ease, background-color 0.2s ease;
}

.icon-btn:hover {
    color: var(--color-ink-strong);
    background: var(--color-border-soft);
}

.active-btn {
    color: var(--color-primary) !important;
    background: var(--color-primary-alpha-10) !important;
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
    background: var(--color-surface-overlay);
    backdrop-filter: blur(12px);
    border: 1px solid var(--color-primary-alpha-20);
    border-radius: 12px;
    box-shadow: var(--shadow-raised);
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
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--color-ink);
    font: inherit;
    text-align: left;
    border-radius: 8px;
    cursor: pointer;
    transition: color 0.2s ease, background-color 0.2s ease;
    user-select: none;
    position: relative;
}

.menu-item:hover {
    background: var(--color-primary-alpha-08);
    color: var(--color-primary);
}

.icon-btn:focus-visible,
.menu-item:focus-visible,
.mobile-actions-panel > button:focus-visible {
    outline: 2px solid var(--control-focus-color);
    outline-offset: 2px;
}

.menu-item i:first-child {
    font-size: 13px;
    width: 14px;
    text-align: center;
}

.active-check {
    position: absolute;
    right: 12px;
    color: var(--color-primary);
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
    border-bottom: 1px solid var(--color-primary-alpha-15);
}

.chat-title.secret-mode {
    color: var(--theme-accent-200); /* 淡い紫 */
    font-weight: 600;
    text-shadow: 0 0 8px var(--color-primary-alpha-30);
}

.secret-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--color-primary-alpha-20);
    color: var(--theme-accent-200);
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 10px;
    border: 1px solid var(--color-primary-alpha-30);
    margin-left: 8px;
}

.icon-btn.secret-mode {
    color: var(--theme-accent-400);
}

.icon-btn.secret-mode:hover {
    color: var(--theme-accent-400);
    background: var(--color-primary-alpha-20);
}

.icon-btn.secret-mode.active-btn {
    color: #fff;
    background: var(--color-primary-alpha-40);
    box-shadow: 0 0 10px var(--color-primary-alpha-40);
}

.icon-btn.secret-mode.active-secret-btn {
    color: #fff;
    background: var(--color-primary-alpha-50);
    box-shadow: 0 0 12px var(--color-primary-alpha-60);
}

.image-dropdown-menu.secret-mode {
    background: rgba(30, 27, 75, 0.95);
    border-color: var(--color-primary-alpha-40);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
}

.menu-item.secret-mode {
    color: #e2e8f0;
}

.menu-item.secret-mode:hover {
    background: var(--color-primary-alpha-20);
    color: var(--color-primary-soft);
}

.active-check.secret-mode {
    color: var(--theme-accent-400);
}

.menu-divider.secret-mode {
    background: rgba(255, 255, 255, 0.08);
}

@media (max-width: 768px) {
    .chat-header {
        padding-inline: 12px;
    }

    .chat-title {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .header-actions {
        flex: 0 0 auto;
        gap: 4px;
    }

    .mobile-collapsible-action {
        display: none;
    }

    .mobile-menu-wrapper {
        display: block;
    }

    .mobile-actions-panel {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 120;
        display: grid;
        width: min(280px, calc(100vw - 24px));
        max-height: min(70dvh, 520px);
        padding: 6px;
        overflow-y: auto;
        overscroll-behavior: contain;
        border: 1px solid var(--color-primary-alpha-20);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.98);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
    }

    .mobile-actions-panel > button {
        display: grid;
        grid-template-columns: 24px minmax(0, 1fr) 20px;
        align-items: center;
        min-height: 44px;
        padding-inline: 12px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #475569;
        text-align: left;
    }

    .mobile-actions-panel > button:active,
    .mobile-actions-panel > button.active {
        background: var(--color-primary-alpha-10);
        color: var(--color-primary);
    }

    .mobile-actions-panel > button > span {
        grid-column: 2;
    }

    .mobile-actions-panel .state-check {
        grid-column: 3;
    }

    .mobile-menu-divider {
        height: 1px;
        margin: 4px 8px;
        background: rgba(0, 0, 0, 0.08);
    }

    .mobile-actions-panel.secret-mode {
        border-color: var(--color-primary-alpha-40);
        background: rgba(30, 27, 75, 0.98);
    }

    .mobile-actions-panel.secret-mode > button {
        color: #e2e8f0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .active-radio-btn {
        animation: none;
    }
}
</style>
