import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useMusicStore } from '../../store/music';
import type { MusicRestoreMode } from '../../store/music';
import { getNextTrackIndex, shouldPersistPlaybackPosition } from '../../utils/music-player';
import type { MusicTrack, MusicTrackCollection } from './types';

/** 音楽ウィジェットの再生状態とプレイリスト操作を管理する。 */
export function useMusicPlayback() {
    const musicStore = useMusicStore();
    const {
        volume,
        repeatMode,
        shuffle,
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
    const tracks = ref<MusicTrack[]>([]);
    const currentIndex = ref(-1);
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const playbackError = ref('');
    const loadedFolderName = ref('');
    const loadedRestoreMode = ref<MusicRestoreMode>('none');
    let shouldAutoplayAfterLoad = false;
    let pendingSeekTime: number | null = null;
    let lastPositionSavedAt = 0;

    const currentTrack = computed(() => tracks.value[currentIndex.value] ?? null);
    const repeatTitle = computed(() => ({
        off: 'リピートなし',
        all: '全曲リピート',
        one: '1曲リピート'
    }[repeatMode.value]));
    const progressPercentage = computed(() => {
        if (!duration.value || !Number.isFinite(duration.value)) return 0;
        return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100));
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

    const replaceTracks = (collection: MusicTrackCollection) => {
        resetPlaylist();
        loadedFolderName.value = collection.folderName;
        loadedRestoreMode.value = collection.restoreMode;
        tracks.value = collection.tracks;
        restoreOrSelectFirstTrack(collection.autoplayForNewFolder);
    };

    const clearTracks = () => {
        resetPlaylist();
        loadedFolderName.value = '';
        loadedRestoreMode.value = 'none';
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

    const initializePlayback = () => {
        if (!musicStore.isLoaded) musicStore.loadFromLocalStorage();
        if (audioRef.value) {
            audioRef.value.volume = volume.value;
            audioRef.value.muted = muted.value;
        }
        window.addEventListener('beforeunload', handleBeforeUnload);

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
    };

    const disposePlayback = () => {
        persistCurrentTrack();
        audioRef.value?.pause();
        tracks.value.forEach(track => releaseTrackUrl(track.url));
        window.removeEventListener('beforeunload', handleBeforeUnload);
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
    };

    return {
        musicStore,
        audioRef,
        tracks,
        currentIndex,
        isPlaying,
        currentTime,
        duration,
        playbackError,
        currentTrack,
        repeatTitle,
        progressPercentage,
        volume,
        repeatMode,
        shuffle,
        playlistExpanded,
        muted,
        handleLoadedMetadata,
        selectTrack,
        moveTrack,
        togglePlayback,
        replaceTracks,
        clearTracks,
        removeTrack,
        handleEnded,
        seek,
        toggleMute,
        handleTimeUpdate,
        handlePause,
        initializePlayback,
        disposePlayback
    };
}
