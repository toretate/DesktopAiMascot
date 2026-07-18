import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import type { MusicRestoreMode } from '../../store/music';
import { useMusicStore } from '../../store/music';
import {
    clearMusicDirectoryHandle,
    loadMusicDirectoryHandle,
    saveMusicDirectoryHandle,
    scanMusicDirectory,
    supportsMusicDirectoryPicker,
    type MusicDirectoryHandle
} from '../../utils/music-directory-handle';
import { parseMusicTrackLabel } from '../../utils/music-player';
import type { ElectronMusicFolderResult, MusicTrack, RestoreStatus } from './types';
import type { useMusicPlayback } from './useMusicPlayback';

const AUDIO_FILE_PATTERN = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i;

/** Electronとブラウザの音楽フォルダ選択・復元処理を管理する。 */
export function useMusicLibrary(playback: ReturnType<typeof useMusicPlayback>) {
    const musicStore = useMusicStore();
    const { restoreMode, folderName } = storeToRefs(musicStore);
    const fileInputRef = ref<HTMLInputElement | null>(null);
    const persistenceWarning = ref('');
    const restoreStatus = ref<RestoreStatus>('idle');
    let activeDirectoryHandle: MusicDirectoryHandle | null = null;

    const restoreActionLabel = computed(() => {
        if (restoreStatus.value === 'checking') return '前回のフォルダを確認中...';
        if (restoreStatus.value === 'permission-required') return '前回のフォルダを再開';
        if (restoreStatus.value === 'reselect-required') return `前回のフォルダ「${folderName.value}」を再選択`;
        return 'フォルダを選択';
    });

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
        const tracks = files
            .filter(({ file }) => file.type.startsWith('audio/') || AUDIO_FILE_PATTERN.test(file.name))
            .sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'ja', { numeric: true, sensitivity: 'base' }))
            .map(({ file, relativePath }, index) => createBrowserTrack(file, relativePath, index));
        playback.replaceTracks({ tracks, folderName: selectedFolderName, restoreMode: mode, autoplayForNewFolder });
        restoreStatus.value = 'idle';
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
            playback.playbackError.value = result.error || '音楽フォルダの読み込みに失敗しました。';
            return;
        }

        const selectedFolderName = result.folderPath?.split(/[\\/]/).filter(Boolean).at(-1) || '音楽フォルダ';
        const tracks = (result.files ?? []).map((file, index) => ({
            id: `${file.relativePath || file.name}-${file.size}-${file.lastModified}-${index}`,
            key: file.relativePath || file.name,
            size: file.size,
            lastModified: file.lastModified,
            url: file.url,
            ...parseMusicTrackLabel(file.name)
        }));
        playback.replaceTracks({ tracks, folderName: selectedFolderName, restoreMode: 'electron', autoplayForNewFolder: autoplay });
        restoreStatus.value = 'idle';
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
                    playback.playbackError.value = 'フォルダを選択できませんでした。';
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
                playback.playbackError.value = '前回選択したフォルダ情報が見つかりません。';
                return;
            }
            activeDirectoryHandle = handle;
            const permission = handle.queryPermission ? await handle.queryPermission({ mode: 'read' }) : 'prompt';
            const granted = permission === 'granted'
                || (handle.requestPermission && await handle.requestPermission({ mode: 'read' }) === 'granted');
            if (!granted) {
                restoreStatus.value = 'permission-required';
                playback.playbackError.value = '前回のフォルダを開く権限がありません。';
                return;
            }
            await applyDirectoryHandle(handle, false);
        } catch (error) {
            console.warn('前回の音楽フォルダを再開できませんでした:', error);
            restoreStatus.value = 'idle';
            playback.playbackError.value = '前回のフォルダを再開できませんでした。';
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
                    playback.playbackError.value = '前回選択したフォルダ情報が見つかりません。';
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
                playback.playbackError.value = '前回のフォルダ情報を読み込めませんでした。';
            }
            return;
        }

        restoreStatus.value = 'reselect-required';
    };

    const initializeLibrary = async () => {
        if (window.electronAPI?.loadLastMusicFolder && !window.electronAPI.isWeb) {
            const result = await window.electronAPI.loadLastMusicFolder();
            if (result) applyElectronFolder(result, false);
        } else {
            await initializeWebRestore();
        }
    };

    const clearPlaylist = () => {
        playback.clearTracks();
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

    return {
        fileInputRef,
        persistenceWarning,
        restoreStatus,
        restoreActionLabel,
        handleFiles,
        openFolderPicker,
        handleEmptyAction,
        clearPlaylist,
        initializeLibrary
    };
}
