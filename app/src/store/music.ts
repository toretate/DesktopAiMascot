import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { RepeatMode } from '../utils/music-player';

export type MusicRestoreMode = 'none' | 'electron' | 'file-system-access' | 'directory-input';

const STORAGE_KEYS = {
    visible: 'desktop-mascot-show-music-widget',
    volume: 'desktop-mascot-music-volume',
    repeatMode: 'desktop-mascot-music-repeat-mode',
    shuffle: 'desktop-mascot-music-shuffle',
    opacity: 'desktop-mascot-music-opacity',
    playlistExpanded: 'desktop-mascot-music-playlist-expanded',
    muted: 'desktop-mascot-music-muted',
    restoreMode: 'desktop-mascot-music-restore-mode',
    folderName: 'desktop-mascot-music-folder-name',
    trackKey: 'desktop-mascot-music-track-key',
    trackSize: 'desktop-mascot-music-track-size',
    trackLastModified: 'desktop-mascot-music-track-last-modified',
    playbackPosition: 'desktop-mascot-music-playback-position'
} as const;

const clampVolume = (value: number) => Math.min(1, Math.max(0, value));

export const useMusicStore = defineStore('music', () => {
    const showMusicWidget = ref(false);
    const volume = ref(0.8);
    const repeatMode = ref<RepeatMode>('off');
    const shuffle = ref(false);
    const opacity = ref(0.92);
    const playlistExpanded = ref(false);
    const contentPanelExpanded = ref(false);
    const muted = ref(false);
    const restoreMode = ref<MusicRestoreMode>('none');
    const folderName = ref('');
    const trackKey = ref('');
    const trackSize = ref(0);
    const trackLastModified = ref(0);
    const playbackPosition = ref(0);
    const isLoaded = ref(false);

    const loadFromLocalStorage = () => {
        if (typeof window === 'undefined') return;

        try {
            showMusicWidget.value = localStorage.getItem(STORAGE_KEYS.visible) === 'true';

            const savedVolume = Number.parseFloat(localStorage.getItem(STORAGE_KEYS.volume) ?? '');
            if (Number.isFinite(savedVolume)) volume.value = clampVolume(savedVolume);

            const savedRepeatMode = localStorage.getItem(STORAGE_KEYS.repeatMode);
            if (savedRepeatMode === 'off' || savedRepeatMode === 'all' || savedRepeatMode === 'one') {
                repeatMode.value = savedRepeatMode;
            }

            shuffle.value = localStorage.getItem(STORAGE_KEYS.shuffle) === 'true';

            const savedOpacity = Number.parseFloat(localStorage.getItem(STORAGE_KEYS.opacity) ?? '');
            if (Number.isFinite(savedOpacity)) opacity.value = clampVolume(savedOpacity);

            const savedPlaylistExpanded = localStorage.getItem(STORAGE_KEYS.playlistExpanded);
            if (savedPlaylistExpanded !== null) playlistExpanded.value = savedPlaylistExpanded === 'true';

            muted.value = localStorage.getItem(STORAGE_KEYS.muted) === 'true';

            const savedRestoreMode = localStorage.getItem(STORAGE_KEYS.restoreMode);
            if (savedRestoreMode === 'electron' || savedRestoreMode === 'file-system-access' || savedRestoreMode === 'directory-input') {
                restoreMode.value = savedRestoreMode;
            }
            folderName.value = localStorage.getItem(STORAGE_KEYS.folderName) ?? '';
            trackKey.value = localStorage.getItem(STORAGE_KEYS.trackKey) ?? '';

            const savedTrackSize = Number.parseFloat(localStorage.getItem(STORAGE_KEYS.trackSize) ?? '');
            if (Number.isFinite(savedTrackSize)) trackSize.value = Math.max(0, savedTrackSize);
            const savedTrackLastModified = Number.parseFloat(localStorage.getItem(STORAGE_KEYS.trackLastModified) ?? '');
            if (Number.isFinite(savedTrackLastModified)) trackLastModified.value = Math.max(0, savedTrackLastModified);
            const savedPlaybackPosition = Number.parseFloat(localStorage.getItem(STORAGE_KEYS.playbackPosition) ?? '');
            if (Number.isFinite(savedPlaybackPosition)) playbackPosition.value = Math.max(0, savedPlaybackPosition);
        } catch (error) {
            console.warn('LocalStorageからの音楽設定読み込みエラー:', error);
        } finally {
            isLoaded.value = true;
        }
    };

    const saveToLocalStorage = () => {
        if (typeof window === 'undefined' || !isLoaded.value) return;

        try {
            localStorage.setItem(STORAGE_KEYS.visible, String(showMusicWidget.value));
            localStorage.setItem(STORAGE_KEYS.volume, String(clampVolume(volume.value)));
            localStorage.setItem(STORAGE_KEYS.repeatMode, repeatMode.value);
            localStorage.setItem(STORAGE_KEYS.shuffle, String(shuffle.value));
            localStorage.setItem(STORAGE_KEYS.opacity, String(clampVolume(opacity.value)));
            localStorage.setItem(STORAGE_KEYS.playlistExpanded, String(playlistExpanded.value));
            localStorage.setItem(STORAGE_KEYS.muted, String(muted.value));
            localStorage.setItem(STORAGE_KEYS.restoreMode, restoreMode.value);
            localStorage.setItem(STORAGE_KEYS.folderName, folderName.value);
            localStorage.setItem(STORAGE_KEYS.trackKey, trackKey.value);
            localStorage.setItem(STORAGE_KEYS.trackSize, String(trackSize.value));
            localStorage.setItem(STORAGE_KEYS.trackLastModified, String(trackLastModified.value));
            localStorage.setItem(STORAGE_KEYS.playbackPosition, String(playbackPosition.value));
        } catch (error) {
            console.error('LocalStorageへの音楽設定保存エラー:', error);
        }
    };

    watch([
        showMusicWidget,
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
    ], saveToLocalStorage);

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', event => {
            if (event.key && Object.values(STORAGE_KEYS).includes(event.key as typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS])) {
                loadFromLocalStorage();
            }
        });
    }

    const cycleRepeatMode = () => {
        const modes: RepeatMode[] = ['off', 'all', 'one'];
        repeatMode.value = modes[(modes.indexOf(repeatMode.value) + 1) % modes.length];
    };

    const setRestoreTarget = (target: {
        mode: MusicRestoreMode;
        folderName: string;
        trackKey: string;
        size: number;
        lastModified: number;
        position?: number;
    }) => {
        restoreMode.value = target.mode;
        folderName.value = target.folderName;
        trackKey.value = target.trackKey;
        trackSize.value = target.size;
        trackLastModified.value = target.lastModified;
        playbackPosition.value = Math.max(0, target.position ?? 0);
    };

    const clearRestoreState = () => {
        restoreMode.value = 'none';
        folderName.value = '';
        trackKey.value = '';
        trackSize.value = 0;
        trackLastModified.value = 0;
        playbackPosition.value = 0;
    };

    return {
        showMusicWidget,
        volume,
        repeatMode,
        shuffle,
        opacity,
        playlistExpanded,
        contentPanelExpanded,
        muted,
        restoreMode,
        folderName,
        trackKey,
        trackSize,
        trackLastModified,
        playbackPosition,
        isLoaded,
        loadFromLocalStorage,
        saveToLocalStorage,
        cycleRepeatMode,
        setRestoreTarget,
        clearRestoreState
    };
});
