<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useConfigStore } from '../store/config';
import { useMusicStore } from '../store/music';
import type { MusicRestoreMode } from '../store/music';
import MusicWidgetSettingsPanel from './settings/MusicWidgetSettingsPanel.vue';
import { formatPlaybackTime, getNextTrackIndex, parseMusicTrackLabel, shouldPersistPlaybackPosition } from '../utils/music-player';
import {
    clearMusicDirectoryHandle,
    loadMusicDirectoryHandle,
    saveMusicDirectoryHandle,
    scanMusicDirectory,
    supportsMusicDirectoryPicker,
    type MusicDirectoryHandle
} from '../utils/music-directory-handle';

interface MusicTrack {
    id: string;
    url: string;
    title: string;
    artist: string;
    key: string;
    size: number;
    lastModified: number;
}

interface ElectronMusicFolderResult {
    success: boolean;
    folderPath?: string;
    files?: Array<{ name: string; relativePath: string; size: number; lastModified: number; url: string }>;
    error?: string;
}

type RestoreStatus = 'idle' | 'checking' | 'permission-required' | 'reselect-required';

const configStore = useConfigStore();
const musicStore = useMusicStore();
const { windowMode } = storeToRefs(configStore);
const {
    volume,
    repeatMode,
    shuffle,
    opacity,
    playlistExpanded,
    muted,
    restoreMode,
    folderName,
    trackKey,
    trackSize,
    trackLastModified,
    playbackPosition
} = storeToRefs(musicStore);

const audioRef = ref<HTMLAudioElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const tracks = ref<MusicTrack[]>([]);
const currentIndex = ref(-1);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const playbackError = ref('');
const persistenceWarning = ref('');
const showInlineSettings = ref(false);
const restoreStatus = ref<RestoreStatus>('idle');
const loadedFolderName = ref('');
const loadedRestoreMode = ref<MusicRestoreMode>('none');
let shouldAutoplayAfterLoad = false;
let pendingSeekTime: number | null = null;
let lastPositionSavedAt = 0;
let activeDirectoryHandle: MusicDirectoryHandle | null = null;

const AUDIO_FILE_PATTERN = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i;

const currentTrack = computed(() => tracks.value[currentIndex.value] ?? null);
const isStandalone = computed(() => window.location.hash === '#music');
const isIntegrated = computed(() => !isStandalone.value && windowMode.value === 'integrated');
const isCompact = computed(() => !isStandalone.value && windowMode.value === 'compact');
const repeatTitle = computed(() => ({
    off: 'リピートなし',
    all: '全曲リピート',
    one: '1曲リピート'
}[repeatMode.value]));
const progressPercentage = computed(() => {
    if (!duration.value || !Number.isFinite(duration.value)) return 0;
    return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100));
});
const restoreActionLabel = computed(() => {
    if (restoreStatus.value === 'checking') return '前回のフォルダを確認中...';
    if (restoreStatus.value === 'permission-required') return '前回のフォルダを再開';
    if (restoreStatus.value === 'reselect-required') return `前回のフォルダ「${folderName.value}」を再選択`;
    return 'フォルダを選択';
});

const persistCurrentTrack = (position = currentTime.value) => {
    const track = currentTrack.value;
    if (!track || loadedRestoreMode.value === 'none') return;
    musicStore.setRestoreTarget({
        mode: loadedRestoreMode.value,
        folderName: loadedFolderName.value,
        trackKey: track.key,
        size: track.size,
        lastModified: track.lastModified,
        position
    });
};

const setMediaSessionMetadata = () => {
    if (!currentTrack.value || !('mediaSession' in navigator) || !('MediaMetadata' in window)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.value.title,
        artist: currentTrack.value.artist || 'ローカル音源'
    });
};

const handleLoadedMetadata = () => {
    const loadedDuration = audioRef.value?.duration ?? 0;
    duration.value = Number.isFinite(loadedDuration) ? loadedDuration : 0;
    if (pendingSeekTime !== null && audioRef.value) {
        const restoredTime = Math.min(Math.max(0, pendingSeekTime), duration.value || pendingSeekTime);
        audioRef.value.currentTime = restoredTime;
        currentTime.value = restoredTime;
        pendingSeekTime = null;
        persistCurrentTrack(restoredTime);
    }
    setMediaSessionMetadata();
    if (shouldAutoplayAfterLoad) {
        shouldAutoplayAfterLoad = false;
        void play();
    }
};

const play = async () => {
    const audio = audioRef.value;
    if (!audio || !currentTrack.value) return;

    try {
        playbackError.value = '';
        await audio.play();
    } catch (error) {
        console.warn('ローカル音楽の再生に失敗しました:', error);
        playbackError.value = 'この音声ファイルを再生できませんでした。';
    }
};

const selectTrack = async (index: number, autoplay = true, restoreTime = 0) => {
    if (index < 0 || index >= tracks.value.length) return;
    shouldAutoplayAfterLoad = autoplay;
    pendingSeekTime = restoreTime;
    currentTime.value = restoreTime;
    duration.value = 0;

    if (currentIndex.value === index) {
        const audio = audioRef.value;
        if (audio) audio.currentTime = restoreTime;
        pendingSeekTime = null;
        persistCurrentTrack(restoreTime);
        if (autoplay) await play();
        return;
    }

    currentIndex.value = index;
    persistCurrentTrack(restoreTime);
    await nextTick();
    audioRef.value?.load();
};

const moveTrack = (direction: 1 | -1, autoplay = isPlaying.value) => {
    const nextIndex = getNextTrackIndex(currentIndex.value, tracks.value.length, {
        direction,
        shuffle: shuffle.value
    });
    if (nextIndex >= 0) void selectTrack(nextIndex, autoplay);
};

const togglePlayback = () => {
    const audio = audioRef.value;
    if (!audio) return;
    if (isPlaying.value) audio.pause();
    else void play();
};

const releaseTrackUrl = (url: string) => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
};

const resetPlaylist = () => {
    audioRef.value?.pause();
    tracks.value.forEach(track => releaseTrackUrl(track.url));
    tracks.value = [];
    currentIndex.value = -1;
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    pendingSeekTime = null;
    playbackError.value = '';
};

const restoreOrSelectFirstTrack = (autoplayForNewFolder: boolean) => {
    if (tracks.value.length === 0) {
        playbackError.value = '選択したフォルダに対応する音声ファイルがありません。';
        return;
    }

    const isSameFolder = folderName.value === loadedFolderName.value && restoreMode.value === loadedRestoreMode.value;
    const restoredIndex = isSameFolder && trackKey.value
        ? tracks.value.findIndex(track => track.key === trackKey.value)
        : -1;
    if (restoredIndex >= 0) {
        const restoredTrack = tracks.value[restoredIndex];
        const fileUnchanged = restoredTrack.size === trackSize.value && restoredTrack.lastModified === trackLastModified.value;
        void selectTrack(restoredIndex, false, fileUnchanged ? playbackPosition.value : 0);
        return;
    }
    void selectTrack(0, isSameFolder ? false : autoplayForNewFolder, 0);
};

const createBrowserTrack = (file: File, key: string, index: number): MusicTrack => ({
    id: `${key}-${file.size}-${file.lastModified}-${index}`,
    key,
    size: file.size,
    lastModified: file.lastModified,
    url: URL.createObjectURL(file),
    ...parseMusicTrackLabel(file.name)
});

const applyBrowserFiles = (
    files: Array<{ file: File; relativePath: string }>,
    selectedFolderName: string,
    mode: Extract<MusicRestoreMode, 'file-system-access' | 'directory-input'>,
    autoplayForNewFolder: boolean
) => {
    resetPlaylist();
    loadedFolderName.value = selectedFolderName;
    loadedRestoreMode.value = mode;
    tracks.value = files
        .filter(({ file }) => file.type.startsWith('audio/') || AUDIO_FILE_PATTERN.test(file.name))
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'ja', { numeric: true, sensitivity: 'base' }))
        .map(({ file, relativePath }, index) => createBrowserTrack(file, relativePath, index));
    restoreStatus.value = 'idle';
    restoreOrSelectFirstTrack(autoplayForNewFolder);
};

const handleFiles = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const selectedFiles = Array.from(input.files ?? []).filter(file => file.type.startsWith('audio/') || AUDIO_FILE_PATTERN.test(file.name));
    if (selectedFiles.length === 0) return;

    const firstRelativePath = (selectedFiles[0] as File & { webkitRelativePath?: string }).webkitRelativePath || selectedFiles[0].name;
    const firstParts = firstRelativePath.split('/').filter(Boolean);
    const selectedFolderName = firstParts.length > 1 ? firstParts[0] : '選択した音楽';
    const files = selectedFiles.map(file => {
        const webkitRelativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const parts = webkitRelativePath.split('/').filter(Boolean);
        return { file, relativePath: parts.length > 1 ? parts.slice(1).join('/') : file.name };
    });
    input.value = '';
    applyBrowserFiles(files, selectedFolderName, 'directory-input', true);
};

const applyElectronFolder = (result: ElectronMusicFolderResult, autoplay: boolean) => {
    if (!result.success) {
        playbackError.value = result.error || '音楽フォルダの読み込みに失敗しました。';
        return;
    }

    resetPlaylist();
    const selectedFolderName = result.folderPath?.split(/[\\/]/).filter(Boolean).at(-1) || '音楽フォルダ';
    loadedFolderName.value = selectedFolderName;
    loadedRestoreMode.value = 'electron';
    const loadedTracks = (result.files ?? []).map((file, index) => ({
        id: `${file.relativePath || file.name}-${file.size}-${file.lastModified}-${index}`,
        key: file.relativePath || file.name,
        size: file.size,
        lastModified: file.lastModified,
        url: file.url,
        ...parseMusicTrackLabel(file.name)
    }));
    tracks.value.push(...loadedTracks);
    restoreStatus.value = 'idle';
    restoreOrSelectFirstTrack(autoplay);
};

const applyDirectoryHandle = async (handle: MusicDirectoryHandle, autoplayForNewFolder: boolean) => {
    restoreStatus.value = 'checking';
    const files = await scanMusicDirectory(handle);
    activeDirectoryHandle = handle;
    applyBrowserFiles(files, handle.name, 'file-system-access', autoplayForNewFolder);
};

const openFolderPicker = async () => {
    if (window.electronAPI?.selectMusicFolder && !window.electronAPI.isWeb) {
        const result = await window.electronAPI.selectMusicFolder();
        if (result) applyElectronFolder(result, true);
        return;
    }
    if (supportsMusicDirectoryPicker()) {
        try {
            const handle = await window.showDirectoryPicker?.({ id: 'music-library', mode: 'read' });
            if (!handle) return;
            persistenceWarning.value = '';
            try {
                await saveMusicDirectoryHandle(handle);
            } catch (error) {
                console.warn('音楽フォルダのハンドルを保存できませんでした:', error);
                persistenceWarning.value = 'このフォルダは再生できますが、次回起動時に自動復元できません。';
            }
            await applyDirectoryHandle(handle, true);
        } catch (error) {
            if ((error as DOMException).name !== 'AbortError') {
                console.warn('音楽フォルダを選択できませんでした:', error);
                playbackError.value = 'フォルダを選択できませんでした。';
            }
        }
        return;
    }
    fileInputRef.value?.click();
};

const resumePreviousFolder = async () => {
    if (!supportsMusicDirectoryPicker()) {
        fileInputRef.value?.click();
        return;
    }

    try {
        const handle = activeDirectoryHandle ?? await loadMusicDirectoryHandle();
        if (!handle) {
            restoreStatus.value = 'idle';
            playbackError.value = '前回選択したフォルダ情報が見つかりません。';
            return;
        }
        activeDirectoryHandle = handle;
        const permission = handle.queryPermission ? await handle.queryPermission({ mode: 'read' }) : 'prompt';
        const granted = permission === 'granted'
            || (handle.requestPermission && await handle.requestPermission({ mode: 'read' }) === 'granted');
        if (!granted) {
            restoreStatus.value = 'permission-required';
            playbackError.value = '前回のフォルダを開く権限がありません。';
            return;
        }
        await applyDirectoryHandle(handle, false);
    } catch (error) {
        console.warn('前回の音楽フォルダを再開できませんでした:', error);
        restoreStatus.value = 'idle';
        playbackError.value = '前回のフォルダを再開できませんでした。';
    }
};

const handleEmptyAction = () => {
    if (restoreStatus.value === 'permission-required') {
        void resumePreviousFolder();
    } else if (restoreStatus.value !== 'checking') {
        void openFolderPicker();
    }
};

const initializeWebRestore = async () => {
    if (!folderName.value || restoreMode.value === 'none' || restoreMode.value === 'electron') return;

    if (restoreMode.value === 'file-system-access' && supportsMusicDirectoryPicker()) {
        restoreStatus.value = 'checking';
        try {
            const handle = await loadMusicDirectoryHandle();
            if (!handle) {
                restoreStatus.value = 'idle';
                playbackError.value = '前回選択したフォルダ情報が見つかりません。';
                return;
            }
            activeDirectoryHandle = handle;
            const permission = handle.queryPermission ? await handle.queryPermission({ mode: 'read' }) : 'prompt';
            if (permission === 'granted') {
                await applyDirectoryHandle(handle, false);
            } else {
                restoreStatus.value = 'permission-required';
            }
        } catch (error) {
            console.warn('保存した音楽フォルダを確認できませんでした:', error);
            restoreStatus.value = 'idle';
            playbackError.value = '前回のフォルダ情報を読み込めませんでした。';
        }
        return;
    }

    restoreStatus.value = 'reselect-required';
};

const removeTrack = (index: number) => {
    const track = tracks.value[index];
    if (!track) return;
    releaseTrackUrl(track.url);

    const removingCurrent = index === currentIndex.value;
    const resumePlayback = removingCurrent && isPlaying.value;
    tracks.value.splice(index, 1);

    if (tracks.value.length === 0) {
        currentIndex.value = -1;
        isPlaying.value = false;
        currentTime.value = 0;
        duration.value = 0;
    } else if (index < currentIndex.value) {
        currentIndex.value -= 1;
    } else if (removingCurrent) {
        currentIndex.value = Math.min(index, tracks.value.length - 1);
        shouldAutoplayAfterLoad = resumePlayback;
        void nextTick(() => audioRef.value?.load());
    }
};

const clearPlaylist = () => {
    resetPlaylist();
    loadedFolderName.value = '';
    loadedRestoreMode.value = 'none';
    activeDirectoryHandle = null;
    restoreStatus.value = 'idle';
    musicStore.clearRestoreState();
    if (window.electronAPI?.clearLastMusicFolder && !window.electronAPI.isWeb) {
        void window.electronAPI.clearLastMusicFolder();
    }
    if (typeof indexedDB !== 'undefined') {
        void clearMusicDirectoryHandle().catch(error => console.warn('音楽フォルダの保存情報を削除できませんでした:', error));
    }
};

const handleEnded = () => {
    if (repeatMode.value === 'one') {
        if (audioRef.value) audioRef.value.currentTime = 0;
        void play();
        return;
    }

    const isLastTrack = currentIndex.value === tracks.value.length - 1;
    if (isLastTrack && repeatMode.value === 'off' && !shuffle.value) {
        isPlaying.value = false;
        return;
    }
    moveTrack(1, true);
};

const seek = (event: Event) => {
    const audio = audioRef.value;
    if (!audio) return;
    const nextTime = Number((event.target as HTMLInputElement).value);
    audio.currentTime = nextTime;
    currentTime.value = nextTime;
    persistCurrentTrack(nextTime);
};

const toggleMute = () => {
    muted.value = !muted.value;
    if (audioRef.value) audioRef.value.muted = muted.value;
};

const handleTimeUpdate = () => {
    currentTime.value = audioRef.value?.currentTime ?? 0;
    const now = Date.now();
    if (shouldPersistPlaybackPosition(lastPositionSavedAt, now)) {
        lastPositionSavedAt = now;
        persistCurrentTrack();
    }
};

const handlePause = () => {
    isPlaying.value = false;
    persistCurrentTrack();
};

const handleBeforeUnload = () => persistCurrentTrack();

watch(volume, value => {
    if (audioRef.value) audioRef.value.volume = value;
});

watch(muted, value => {
    if (audioRef.value) audioRef.value.muted = value;
});

const closeWidget = () => {
    musicStore.showMusicWidget = false;
    audioRef.value?.pause();
    if (isStandalone.value) {
        window.electronAPI?.toggleMusic?.();
    }
};

let isElectronDragging = false;
let electronDragX = 0;
let electronDragY = 0;

const startWidgetDrag = (event: MouseEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, input')) return;
    if (!isStandalone.value) return;
    event.preventDefault();
    isElectronDragging = true;
    electronDragX = event.screenX;
    electronDragY = event.screenY;
    window.electronAPI?.dragWindow?.({ dx: 0, dy: 0, isStart: true });
    window.addEventListener('mousemove', handleElectronDrag);
    window.addEventListener('mouseup', stopElectronDrag);
};

const handleElectronDrag = (event: MouseEvent) => {
    if (!isElectronDragging) return;
    if (event.buttons !== 1) {
        stopElectronDrag();
        return;
    }

    const dx = event.screenX - electronDragX;
    const dy = event.screenY - electronDragY;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        window.electronAPI?.dragWindow?.({ dx, dy });
        electronDragX = event.screenX;
        electronDragY = event.screenY;
    }
};

const stopElectronDrag = () => {
    if (!isElectronDragging) return;
    isElectronDragging = false;
    window.electronAPI?.dragWindow?.({ dx: 0, dy: 0, isEnd: true });
    window.removeEventListener('mousemove', handleElectronDrag);
    window.removeEventListener('mouseup', stopElectronDrag);
};

const widgetStyle = computed(() => {
    const transparentStyle = { opacity: String(opacity.value) };
    if (isIntegrated.value) {
        return {
            ...transparentStyle,
            left: '12px',
            right: '12px',
            bottom: '12px',
            top: 'auto',
            width: 'auto',
            height: playlistExpanded.value || showInlineSettings.value ? '196px' : '76px'
        };
    }
    if (isCompact.value) {
        return { ...transparentStyle, left: '8px', right: '8px', top: '52px', width: 'auto', height: '38px' };
    }
    return { ...transparentStyle, left: '0', top: '0', width: '100%', height: '100%' };
});

const toggleMusicSettings = () => {
    showInlineSettings.value = !showInlineSettings.value;
};

onMounted(async () => {
    if (!musicStore.isLoaded) musicStore.loadFromLocalStorage();
    if (audioRef.value) {
        audioRef.value.volume = volume.value;
        audioRef.value.muted = muted.value;
    }
    window.addEventListener('beforeunload', handleBeforeUnload);

    if (window.electronAPI?.loadLastMusicFolder && !window.electronAPI.isWeb) {
        const result = await window.electronAPI.loadLastMusicFolder();
        if (result) applyElectronFolder(result, false);
    } else {
        await initializeWebRestore();
    }

    if ('mediaSession' in navigator) {
        try {
            navigator.mediaSession.setActionHandler('play', () => void play());
            navigator.mediaSession.setActionHandler('pause', () => audioRef.value?.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => moveTrack(-1));
            navigator.mediaSession.setActionHandler('nexttrack', () => moveTrack(1));
        } catch (error) {
            console.warn('メディアキー操作の登録に失敗しました:', error);
        }
    }
});

onUnmounted(() => {
    persistCurrentTrack();
    audioRef.value?.pause();
    tracks.value.forEach(track => releaseTrackUrl(track.url));
    window.removeEventListener('mousemove', handleElectronDrag);
    window.removeEventListener('mouseup', stopElectronDrag);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    stopElectronDrag();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        for (const action of ['play', 'pause', 'previoustrack', 'nexttrack'] as MediaSessionAction[]) {
            try {
                navigator.mediaSession.setActionHandler(action, null);
            } catch {
                // 未対応のアクションは解除不要です。
            }
        }
    }
});
</script>

<template>
    <section class="music-widget" :class="{ integrated: isIntegrated, compact: isCompact, 'playlist-expanded': isIntegrated && playlistExpanded, 'settings-open': showInlineSettings }" :style="widgetStyle">
        <header v-if="!isCompact" class="widget-header" @mousedown="startWidgetDrag">
            <div class="widget-title"><i class="pi pi-headphones"></i><span>MUSIC PLAYER</span></div>
            <div class="header-actions">
                <button type="button" title="フォルダを選択" @click="openFolderPicker"><i class="pi pi-folder-open"></i></button>
                <button
                    type="button"
                    :class="{ active: showInlineSettings }"
                    :title="showInlineSettings ? '設定を閉じる' : '音楽ウィジェット設定'"
                    :aria-expanded="showInlineSettings"
                    @click="toggleMusicSettings"
                ><i class="pi pi-cog"></i></button>
                <button type="button" title="閉じる" @click="closeWidget"><i class="pi pi-times"></i></button>
            </div>
        </header>

        <input
            ref="fileInputRef"
            class="file-input"
            type="file"
            webkitdirectory
            directory
            multiple
            @change="handleFiles"
        />
        <audio
            ref="audioRef"
            :src="currentTrack?.url"
            @loadedmetadata="handleLoadedMetadata"
            @timeupdate="handleTimeUpdate"
            @play="isPlaying = true"
            @pause="handlePause"
            @ended="handleEnded"
            @error="playbackError = currentTrack ? 'この音声ファイルを再生できませんでした。' : ''"
        ></audio>

        <div v-if="showInlineSettings && !isCompact" class="inline-settings">
            <MusicWidgetSettingsPanel embedded />
        </div>

        <template v-if="!showInlineSettings">
        <div v-if="isCompact" class="compact-player-row">
            <button
                type="button"
                class="compact-track-title"
                :title="currentTrack ? currentTrack.title : restoreActionLabel"
                @click="!currentTrack && handleEmptyAction()"
            >
                <i class="pi pi-music"></i>
                <span>{{ currentTrack?.title || restoreActionLabel }}</span>
            </button>
            <button type="button" class="compact-control" :title="isPlaying ? '一時停止' : '再生'" :disabled="!currentTrack" @click="togglePlayback">
                <i :class="isPlaying ? 'pi pi-pause' : 'pi pi-play'"></i>
            </button>
            <button type="button" class="compact-control" title="次の曲" :disabled="!currentTrack" @click="moveTrack(1)">
                <i class="pi pi-step-forward"></i>
            </button>
        </div>

        <div v-if="currentTrack && !isCompact" class="now-playing">
            <div class="cover"><i class="pi pi-music"></i></div>
            <div class="track-text">
                <strong :title="currentTrack.title">{{ currentTrack.title }}</strong>
                <span :title="currentTrack.artist">{{ currentTrack.artist || 'ローカル音源' }}</span>
            </div>
        </div>
        <button v-else-if="!isCompact" type="button" class="empty-state" :disabled="restoreStatus === 'checking'" @click="handleEmptyAction">
            <i class="pi pi-folder-open"></i>
            <span>{{ restoreActionLabel }}</span>
            <small>{{ restoreStatus === 'reselect-required' ? '同じフォルダを選ぶと前回位置を復元します' : 'フォルダ内の対応音源を読み込みます' }}</small>
        </button>

        <div v-if="!isCompact && !isIntegrated" class="progress-row">
            <span>{{ formatPlaybackTime(currentTime) }}</span>
            <input type="range" min="0" :max="duration || 0" step="0.1" :value="currentTime" :disabled="!currentTrack" aria-label="再生位置" @input="seek" />
            <span>{{ formatPlaybackTime(duration) }}</span>
        </div>

        <div v-if="!isCompact" class="player-controls">
            <button type="button" :class="{ active: shuffle }" title="シャッフル" @click="shuffle = !shuffle"><i class="pi pi-sort-alt"></i></button>
            <button type="button" title="前の曲" :disabled="!currentTrack" @click="moveTrack(-1)"><i class="pi pi-step-backward"></i></button>
            <button type="button" class="play-button" :title="isPlaying ? '一時停止' : '再生'" :disabled="!currentTrack" @click="togglePlayback"><i :class="isPlaying ? 'pi pi-pause' : 'pi pi-play'"></i></button>
            <button type="button" title="次の曲" :disabled="!currentTrack" @click="moveTrack(1)"><i class="pi pi-step-forward"></i></button>
            <button type="button" :class="{ active: repeatMode !== 'off' }" :title="repeatTitle" @click="musicStore.cycleRepeatMode()"><i class="pi pi-replay"></i><small v-if="repeatMode === 'one'">1</small></button>
        </div>

        <div v-if="!isCompact" class="volume-row">
            <button
                type="button"
                class="mute-button"
                :class="{ active: muted }"
                :title="muted ? 'ミュートを解除' : 'ミュート'"
                :aria-pressed="muted"
                @click="toggleMute"
            >
                <i :class="muted || volume === 0 ? 'pi pi-volume-off' : 'pi pi-volume-up'"></i>
            </button>
            <input v-model.number="volume" type="range" min="0" max="1" step="0.01" aria-label="音量" />
            <span>{{ Math.round(volume * 100) }}%</span>
        </div>

        <p v-if="persistenceWarning && !isCompact" class="warning-message" role="status">{{ persistenceWarning }}</p>
        <p v-if="playbackError && !isCompact" class="error-message">{{ playbackError }}</p>

        <div v-if="!isCompact" class="playlist-header">
            <div
                v-if="isIntegrated"
                class="integrated-progress"
                role="progressbar"
                aria-label="再生位置"
                :aria-valuemin="0"
                :aria-valuemax="Math.round(duration)"
                :aria-valuenow="Math.round(currentTime)"
            >
                <span>{{ formatPlaybackTime(currentTime) }}</span>
                <span class="integrated-progress-track" aria-hidden="true">
                    <span :style="{ width: `${progressPercentage}%` }"></span>
                </span>
                <span>{{ formatPlaybackTime(duration) }}</span>
            </div>
            <button type="button" class="playlist-toggle" :aria-expanded="playlistExpanded" @click="playlistExpanded = !playlistExpanded">
                <i :class="playlistExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
                <span>PLAYLIST <small>{{ tracks.length }}</small></span>
            </button>
            <button v-if="tracks.length" type="button" @click="clearPlaylist()">すべて削除</button>
        </div>
        <ol v-if="playlistExpanded && !isCompact" class="playlist">
            <li v-for="(track, index) in tracks" :key="track.id" :class="{ current: index === currentIndex }">
                <button type="button" class="track-button" @click="selectTrack(index, true)">
                    <i :class="index === currentIndex && isPlaying ? 'pi pi-volume-up' : 'pi pi-music'"></i>
                    <span>{{ track.title }}</span>
                </button>
                <button type="button" class="remove-button" :title="`${track.title}を削除`" @click="removeTrack(index)"><i class="pi pi-times"></i></button>
            </li>
        </ol>
        </template>
    </section>
</template>

<style scoped>
.music-widget {
    position: absolute;
    width: 340px;
    height: 440px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
    color: #334155;
    font-family: 'Outfit', 'Inter', sans-serif;
    box-sizing: border-box;
}

.widget-header, .widget-title, .header-actions, .now-playing, .progress-row, .player-controls, .volume-row, .playlist-header, .playlist li, .track-button {
    display: flex;
    align-items: center;
}

.widget-header { justify-content: space-between; min-height: 46px; padding: 0 12px; cursor: grab; border-bottom: 1px solid #f1f5f9; user-select: none; }
.widget-header:active { cursor: grabbing; }
.widget-title { gap: 8px; font-size: 14px; font-weight: 700; letter-spacing: 0.05em; color: #475569; }
.widget-title i { color: #8b5cf6; }
.header-actions { gap: 4px; }
button { border: 0; color: inherit; cursor: pointer; }
.header-actions button, .player-controls button { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: transparent; color: #64748b; }
.header-actions button:hover, .header-actions button.active, .player-controls button:hover:not(:disabled) { background: #f1f5f9; color: #334155; }
.file-input, audio { display: none; }
.inline-settings { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; background: rgba(248, 250, 252, 0.98); }
.now-playing { gap: 12px; padding: 15px 16px 8px; }
.cover { display: grid; place-items: center; flex: 0 0 54px; height: 54px; border-radius: 10px; background: linear-gradient(135deg, #dbeafe, #ede9fe); color: #7c3aed; font-size: 21px; }
.track-text { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.track-text strong, .track-text span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-text strong { color: #334155; font-size: 14px; }
.track-text span { color: #94a3b8; font-size: 12px; }
.empty-state { margin: 14px 16px 8px; min-height: 68px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border: 1px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; color: #475569; }
.empty-state:hover { border-color: #8b5cf6; background: #faf5ff; }
.empty-state i { color: #8b5cf6; font-size: 18px; }
.empty-state small { color: #94a3b8; }
.progress-row { gap: 8px; padding: 4px 16px 0; color: #94a3b8; font-size: 10px; }
.progress-row input { flex: 1; min-width: 0; accent-color: #8b5cf6; }
.player-controls { justify-content: center; gap: 8px; padding: 4px 12px; }
.player-controls button:disabled { opacity: 0.35; cursor: default; }
.player-controls button.active { background: #f3e8ff; color: #7c3aed; }
.player-controls .play-button { width: 42px; height: 42px; border-radius: 50%; background: #8b5cf6; color: #ffffff; font-size: 16px; }
.player-controls .play-button:hover:not(:disabled) { background: #7c3aed; color: #ffffff; }
.player-controls small { position: absolute; margin: 0 0 9px 11px; font-size: 8px; font-weight: 800; }
.volume-row { gap: 8px; padding: 0 18px 8px; color: #94a3b8; font-size: 10px; }
.volume-row input { flex: 1; accent-color: #8b5cf6; }
.volume-row span { width: 30px; text-align: right; }
.mute-button { display: grid; place-items: center; flex: 0 0 24px; width: 24px; height: 24px; padding: 0; border-radius: 6px; background: transparent; color: #94a3b8; }
.mute-button:hover, .mute-button.active { background: #f3e8ff; color: #7c3aed; }
.error-message { margin: 0 16px 6px; color: #e11d48; font-size: 11px; }
.warning-message { margin: 0 16px 6px; color: #a16207; font-size: 11px; }
.playlist-header { justify-content: space-between; padding: 8px 16px 5px; border-top: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; }
.playlist-header small { padding: 1px 5px; border-radius: 999px; background: #e2e8f0; color: #64748b; }
.playlist-header button { padding: 2px 0; background: transparent; color: #7c3aed; font-size: 10px; }
.playlist { flex: 1; min-height: 0; overflow-y: auto; margin: 0; padding: 0 8px 10px; background: #f8fafc; list-style: none; }
.playlist li { min-height: 34px; margin-top: 4px; border: 1px solid transparent; border-radius: 8px; color: #475569; }
.playlist li.current { border-color: #ddd6fe; border-left: 3px solid #8b5cf6; background: #ffffff; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05); color: #5b21b6; }
.track-button { flex: 1; min-width: 0; gap: 8px; padding: 7px 8px; background: transparent; text-align: left; }
.track-button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.track-button i { flex: 0 0 14px; color: #8b5cf6; font-size: 11px; }
.remove-button { opacity: 0; width: 28px; height: 28px; background: transparent; color: #94a3b8; }
.playlist li:hover .remove-button, .remove-button:focus { opacity: 1; }
input[type="range"] { height: 4px; }

.playlist-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0 !important;
    color: #64748b !important;
    font-weight: 700;
}

.playlist-toggle i {
    font-size: 9px;
}

/* 統合モードでは画面下部に固定する横長プレイヤー */
.music-widget.integrated {
    z-index: 20;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(260px, 1fr) minmax(0, 1fr);
    grid-template-rows: 54px 20px;
    align-items: center;
    max-height: min(196px, calc(100vh - 24px));
}

.integrated .playlist-header,
.integrated .playlist,
.integrated .error-message,
.integrated .warning-message {
    grid-column: 1 / -1;
}

.integrated .inline-settings {
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 30px 10px 8px;
}

.integrated .warning-message {
    position: absolute;
    z-index: 3;
    right: 92px;
    bottom: 21px;
    left: 10px;
    overflow: hidden;
    margin: 0;
    padding: 2px 6px;
    border-radius: 5px;
    background: rgba(254, 249, 195, 0.96);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.integrated .widget-header {
    position: absolute;
    z-index: 2;
    top: 2px;
    right: 6px;
    min-height: 28px;
    padding: 0;
    border-bottom: 0;
    cursor: default;
}

.integrated .widget-title {
    display: none;
}

.integrated .header-actions {
    gap: 0;
}

.integrated .header-actions button,
.integrated .player-controls button {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    font-size: 12px;
}

.integrated .now-playing {
    grid-column: 1;
    grid-row: 1;
    min-width: 0;
    gap: 8px;
    padding: 5px 10px;
}

.integrated .cover {
    flex-basis: 36px;
    height: 36px;
    border-radius: 7px;
    font-size: 14px;
}

.integrated .track-text {
    gap: 1px;
}

.integrated .track-text strong {
    font-size: 12px;
}

.integrated .track-text span {
    font-size: 10px;
}

.integrated .empty-state {
    grid-column: 1;
    grid-row: 1;
    min-height: 38px;
    margin: 5px 10px;
    gap: 0;
    font-size: 11px;
}

.integrated .empty-state i {
    font-size: 13px;
}

.integrated .empty-state small {
    font-size: 9px;
}

.integrated .progress-row {
    grid-column: 2;
    grid-row: 1;
    align-self: start;
    min-width: 0;
    padding: 3px 8px 0;
    font-size: 9px;
}

.integrated .player-controls {
    grid-column: 2;
    grid-row: 1;
    align-self: end;
    justify-self: stretch;
    gap: 4px;
    padding: 0 6px 2px;
    white-space: nowrap;
}

.integrated .player-controls .play-button {
    width: 32px;
    height: 32px;
    font-size: 13px;
}

.integrated .volume-row {
    grid-column: 3;
    grid-row: 1;
    align-self: end;
    min-width: 0;
    padding: 0 12px 8px;
}

.integrated .playlist-header {
    position: relative;
    grid-row: 2;
    height: 20px;
    padding: 1px 12px;
    box-sizing: border-box;
}

.integrated-progress {
    position: absolute;
    top: -7px;
    left: 12px;
    right: 12px;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) 28px;
    align-items: center;
    gap: 6px;
    height: 12px;
    color: #94a3b8;
    font-size: 8px;
    font-weight: 500;
    letter-spacing: normal;
}

.integrated-progress > span:first-child,
.integrated-progress > span:last-child {
    background: #f8fafc;
    text-align: center;
}

.integrated-progress-track {
    height: 2px;
    overflow: hidden;
    border-radius: 999px;
    background: #dbe2ea;
}

.integrated-progress-track > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #8b5cf6;
    transition: width 0.15s linear;
}

.integrated .playlist {
    grid-row: 3;
    max-height: 120px;
}

.music-widget.integrated.playlist-expanded {
    grid-template-rows: 54px 20px minmax(0, 1fr);
}

/* コンパクトモードではチャットヘッダー直下の1行だけを表示する */
.music-widget.compact {
    z-index: 30;
    display: block;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
}

.compact-player-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 34px 34px;
    align-items: center;
    height: 100%;
    padding: 2px 5px 2px 10px;
    box-sizing: border-box;
}

.compact-track-title {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0;
    overflow: hidden;
    background: transparent;
    color: #475569;
    text-align: left;
}

.compact-track-title i {
    flex: 0 0 auto;
    color: #8b5cf6;
    font-size: 12px;
}

.compact-track-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 600;
}

.compact-control {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: transparent;
    color: #64748b;
}

.compact-control:hover:not(:disabled) {
    background: #f3e8ff;
    color: #7c3aed;
}

.compact-control:disabled {
    opacity: 0.35;
    cursor: default;
}

@media (max-width: 760px) {
    .music-widget.integrated {
        grid-template-columns: minmax(140px, 1fr) minmax(210px, 1.2fr);
    }

    .integrated .volume-row {
        display: none;
    }
}
</style>
