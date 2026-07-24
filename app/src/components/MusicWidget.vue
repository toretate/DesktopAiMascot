<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useMusicStore } from '../store/music';
import MusicWidgetSettingsPanel from './settings/MusicWidgetSettingsPanel.vue';
import { formatPlaybackTime } from '../utils/music-player';
import { useMusicLibrary } from './music-widget/useMusicLibrary';
import { useMusicPlayback } from './music-widget/useMusicPlayback';
import { useMusicWidgetLayout } from './music-widget/useMusicWidgetLayout';
import { useAmbientSoundMixer } from './music-widget/useAmbientSoundMixer';
import AmbientSoundMixer from './music-widget/AmbientSoundMixer.vue';

const musicStore = useMusicStore();
const { opacity, contentPanelExpanded } = storeToRefs(musicStore);
const showAmbientMixer = ref(false);
const playback = useMusicPlayback();
const ambientMixer = useAmbientSoundMixer();
const {
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
    removeTrack,
    handleEnded,
    seek,
    toggleMute,
    handleTimeUpdate,
    handlePause,
    initializePlayback,
    disposePlayback
} = playback;

const {
    fileInputRef,
    persistenceWarning,
    restoreStatus,
    restoreActionLabel,
    handleFiles,
    openFolderPicker,
    handleEmptyAction,
    clearPlaylist,
    initializeLibrary
} = useMusicLibrary(playback);

const {
    isIntegrated,
    isCompact,
    showInlineSettings,
    widgetStyle,
    startWidgetDrag,
    toggleMusicSettings,
    closeWidget,
    disposeLayout
} = useMusicWidgetLayout({
    opacity,
    playlistExpanded,
    secondaryPanelExpanded: contentPanelExpanded,
    pausePlayback: () => {
        audioRef.value?.pause();
        ambientMixer.disposeMixer();
    }
});

const toggleSettingsPanel = () => {
    showAmbientMixer.value = false;
    toggleMusicSettings();
    contentPanelExpanded.value = showInlineSettings.value;
};

const toggleAmbientPanel = () => {
    if (!showAmbientMixer.value && showInlineSettings.value) toggleMusicSettings();
    showAmbientMixer.value = !showAmbientMixer.value;
    contentPanelExpanded.value = showAmbientMixer.value;
};

onMounted(async () => {
    contentPanelExpanded.value = false;
    initializePlayback();
    ambientMixer.initializeMixer();
    await initializeLibrary();
});

onUnmounted(() => {
    contentPanelExpanded.value = false;
    disposeLayout();
    disposePlayback();
    ambientMixer.disposeMixer();
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
                    :class="{ active: showAmbientMixer || ambientMixer.isRunning.value }"
                    :title="showAmbientMixer ? '環境音ミキサーを閉じる' : '環境音ミキサー'"
                    :aria-expanded="showAmbientMixer"
                    @click="toggleAmbientPanel"
                ><i class="pi pi-sliders-h"></i></button>
                <button
                    type="button"
                    :class="{ active: showInlineSettings }"
                    :title="showInlineSettings ? '設定を閉じる' : '音楽ウィジェット設定'"
                    :aria-expanded="showInlineSettings"
                    @click="toggleSettingsPanel"
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

        <AmbientSoundMixer
            v-if="showAmbientMixer && !isCompact"
            v-model:master-volume="ambientMixer.masterVolume.value"
            v-model:muted="ambientMixer.muted.value"
            :selected-channels="ambientMixer.selectedChannels.value"
            :channel-volumes="ambientMixer.channelVolumes.value"
            :is-running="ambientMixer.isRunning.value"
            :available-count="ambientMixer.availableCount.value"
            :playback-error="ambientMixer.playbackError.value"
            @select-channel="ambientMixer.setChannelSelected"
            @update-channel-volume="ambientMixer.setChannelVolume"
            @toggle-running="ambientMixer.toggleRunning"
        />

        <template v-if="!showInlineSettings && !showAmbientMixer">
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
            <button
                type="button"
                class="compact-control ambient-compact-control"
                :class="{ active: ambientMixer.isRunning.value }"
                :title="ambientMixer.isRunning.value ? '環境音を停止' : '環境音を再生'"
                :disabled="ambientMixer.playableSelectionCount.value === 0"
                @click="ambientMixer.toggleRunning"
            >
                <i class="pi pi-sliders-h"></i>
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
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-surface-overlay);
    box-shadow: var(--shadow-raised);
    color: var(--color-ink);
    font-family: var(--font-body);
    box-sizing: border-box;
}

.widget-header, .widget-title, .header-actions, .now-playing, .progress-row, .player-controls, .volume-row, .playlist-header, .playlist li, .track-button {
    display: flex;
    align-items: center;
}

.widget-header { justify-content: space-between; min-height: 46px; padding: 0 12px; cursor: grab; border-bottom: 1px solid var(--color-border-soft); user-select: none; }
.widget-header:active { cursor: grabbing; }
.widget-title { gap: 8px; color: var(--color-ink); font-family: var(--font-display); font-size: 14px; font-weight: 700; letter-spacing: 0.05em; }
.widget-title i { color: var(--color-primary); }
.header-actions { gap: 4px; }
button { border: 0; color: inherit; cursor: pointer; }
.header-actions button, .player-controls button { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: transparent; color: var(--color-ink-muted); }
.header-actions button:hover, .header-actions button.active, .player-controls button:hover:not(:disabled) { background: var(--color-surface-muted); color: var(--color-ink); }
.file-input, audio { display: none; }
.inline-settings { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; background: var(--color-surface-overlay); }
.now-playing { gap: 12px; padding: 15px 16px 8px; }
.cover { display: grid; place-items: center; flex: 0 0 54px; height: 54px; border-radius: 10px; background: var(--color-primary-subtle); color: var(--color-primary-hover); font-size: 21px; }
.track-text { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.track-text strong, .track-text span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track-text strong { color: var(--color-ink); font-size: 14px; }
.track-text span { color: var(--color-ink-subtle); font-size: 12px; }
.empty-state { margin: 14px 16px 8px; min-height: 68px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; border: 1px dashed var(--color-border); border-radius: 8px; background: var(--color-surface-muted); color: var(--color-ink); }
.empty-state:hover { border-color: var(--color-primary); background: var(--color-primary-subtle); }
.empty-state i { color: var(--color-primary); font-size: 18px; }
.empty-state small { color: var(--color-ink-subtle); }
.progress-row { gap: 8px; padding: 4px 16px 0; color: var(--color-ink-subtle); font-size: 10px; }
.progress-row input { flex: 1; min-width: 0; accent-color: var(--color-primary); }
.player-controls { justify-content: center; gap: 8px; padding: 4px 12px; }
.player-controls button:disabled { opacity: 0.35; cursor: default; }
.player-controls button.active { background: var(--color-primary-soft); color: var(--color-primary-hover); }
.player-controls .play-button { width: 42px; height: 42px; border-radius: 50%; background: var(--color-primary); color: var(--color-on-primary); font-size: 16px; }
.player-controls .play-button:hover:not(:disabled) { background: var(--color-primary-hover); color: var(--color-on-primary); }
.player-controls small { position: absolute; margin: 0 0 9px 11px; font-size: 8px; font-weight: 800; }
.volume-row { gap: 8px; padding: 0 18px 8px; color: var(--color-ink-subtle); font-size: 10px; }
.volume-row input { flex: 1; accent-color: var(--color-primary); }
.volume-row span { width: 30px; text-align: right; }
.mute-button { display: grid; place-items: center; flex: 0 0 24px; width: 24px; height: 24px; padding: 0; border-radius: 6px; background: transparent; color: var(--color-ink-subtle); }
.mute-button:hover, .mute-button.active { background: var(--color-primary-soft); color: var(--color-primary-hover); }
.error-message { margin: 0 16px 6px; color: var(--color-danger); font-size: 11px; }
.warning-message { margin: 0 16px 6px; color: var(--color-warning); font-size: 11px; }
.playlist-header { justify-content: space-between; padding: 8px 16px 5px; border-top: 1px solid var(--color-border); background: var(--color-surface-muted); color: var(--color-ink-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; }
.playlist-header small { padding: 1px 5px; border-radius: 999px; background: var(--color-border); color: var(--color-ink-muted); }
.playlist-header button { padding: 2px 0; background: transparent; color: var(--color-primary-hover); font-size: 10px; }
.playlist { flex: 1; min-height: 0; overflow-y: auto; margin: 0; padding: 0 8px 10px; background: var(--color-surface-muted); list-style: none; }
.playlist li { min-height: 34px; margin-top: 4px; border: 1px solid transparent; border-radius: 8px; color: var(--color-ink); }
.playlist li.current { border-color: var(--color-primary); background: var(--color-surface-raised); box-shadow: var(--shadow-inset-soft); color: var(--color-primary-strong); }
.track-button { flex: 1; min-width: 0; gap: 8px; padding: 7px 8px; background: transparent; text-align: left; }
.track-button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.track-button i { flex: 0 0 14px; color: var(--color-primary); font-size: 11px; }
.remove-button { width: 28px; height: 28px; background: transparent; color: var(--color-ink-subtle); opacity: 0.55; }
.playlist li:hover .remove-button, .remove-button:focus-visible { opacity: 1; }
.remove-button:focus-visible { outline: 2px solid var(--control-focus-color); outline-offset: 1px; }
input[type="range"] { height: 4px; }

.playlist-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0 !important;
    color: var(--color-ink-muted) !important;
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

.integrated :deep(.ambient-mixer) {
    position: absolute;
    inset: 28px 0 0;
    z-index: 2;
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
    background: var(--color-warning-overlay);
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
    color: var(--color-ink-subtle);
    font-size: 8px;
    font-weight: 500;
    letter-spacing: normal;
}

.integrated-progress > span:first-child,
.integrated-progress > span:last-child {
    background: var(--color-surface-muted);
    text-align: center;
}

.integrated-progress-track {
    height: 2px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--color-border);
}

.integrated-progress-track > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--color-primary);
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
    box-shadow: var(--shadow-compact);
}

.compact-player-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 34px 34px 34px;
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
    color: var(--color-ink);
    text-align: left;
}

.compact-track-title i {
    flex: 0 0 auto;
    color: var(--color-primary);
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
    color: var(--color-ink-muted);
}

.compact-control:hover:not(:disabled) {
    background: var(--color-primary-soft);
    color: var(--color-primary-hover);
}

.compact-control.active,
.ambient-compact-control.active {
    background: var(--color-primary-subtle);
    color: var(--color-primary-hover);
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

@media (hover: none), (pointer: coarse) {
    .remove-button {
        opacity: 1;
    }
}
</style>
