<script setup lang="ts">
import { computed } from 'vue';
import { AMBIENT_SOUNDS, type AmbientSoundId } from './ambient-sounds';

const props = defineProps<{
    masterVolume: number;
    muted: boolean;
    selectedChannels: Record<AmbientSoundId, boolean>;
    channelVolumes: Record<AmbientSoundId, number>;
    isRunning: boolean;
    availableCount: number;
    playbackError: string;
}>();

const emit = defineEmits<{
    'update:masterVolume': [value: number];
    'update:muted': [value: boolean];
    'select-channel': [id: AmbientSoundId, selected: boolean];
    'update-channel-volume': [id: AmbientSoundId, volume: number];
    'toggle-running': [];
}>();

const playableSelectionCount = computed(() => AMBIENT_SOUNDS.filter(sound => sound.source && props.selectedChannels[sound.id]).length);
const readRangeValue = (event: Event) => Number.parseFloat((event.target as HTMLInputElement).value);
</script>

<template>
    <section class="ambient-mixer" aria-labelledby="ambient-mixer-title">
        <div class="ambient-master">
            <div>
                <h2 id="ambient-mixer-title">AMBIENT MIXER</h2>
                <small>音楽とは別の音量で重ねて再生</small>
            </div>
            <button
                type="button"
                class="ambient-play"
                :disabled="availableCount === 0 || playableSelectionCount === 0"
                :title="isRunning ? '環境音を停止' : '選択した環境音を再生'"
                :aria-label="isRunning ? '環境音を停止' : '選択した環境音を再生'"
                @click="emit('toggle-running')"
            >
                <i :class="isRunning ? 'pi pi-stop' : 'pi pi-play'" aria-hidden="true"></i>
            </button>
        </div>

        <div class="ambient-master-volume">
            <button type="button" :class="{ active: muted }" :aria-pressed="muted" :title="muted ? '環境音のミュートを解除' : '環境音をミュート'" :aria-label="muted ? '環境音のミュートを解除' : '環境音をミュート'" @click="emit('update:muted', !muted)">
                <i :class="muted || masterVolume === 0 ? 'pi pi-volume-off' : 'pi pi-volume-up'" aria-hidden="true"></i>
            </button>
            <label class="visually-hidden" for="ambient-master-volume">環境音の全体音量</label>
            <input id="ambient-master-volume" :value="masterVolume" type="range" min="0" max="1" step="0.01" @input="emit('update:masterVolume', readRangeValue($event))" />
            <span>{{ Math.round(masterVolume * 100) }}%</span>
        </div>

        <p v-if="availableCount === 0" class="ambient-notice" role="status">音源準備中です。音量バランスと使用する音は先に設定できます。</p>
        <p v-if="playbackError" class="ambient-error" role="status">{{ playbackError }}</p>

        <ul class="ambient-channels" role="list">
            <li v-for="sound in AMBIENT_SOUNDS" :key="sound.id" class="ambient-channel" :class="{ selected: selectedChannels[sound.id] }">
                <button
                    type="button"
                    class="channel-toggle"
                    :aria-pressed="selectedChannels[sound.id]"
                    @click="emit('select-channel', sound.id, !selectedChannels[sound.id])"
                >
                    <i class="pi" :class="sound.icon" aria-hidden="true"></i>
                    <span>{{ sound.label }}</span>
                    <small class="channel-state"><i v-if="selectedChannels[sound.id]" class="pi pi-check" aria-hidden="true"></i>{{ selectedChannels[sound.id] ? 'ON' : 'OFF' }}</small>
                </button>
                <small v-if="!sound.source" class="source-status">音源準備中</small>
                <div class="channel-volume">
                    <label class="visually-hidden" :for="`ambient-volume-${sound.id}`">{{ sound.label }}の音量</label>
                    <input
                        :id="`ambient-volume-${sound.id}`"
                        :value="channelVolumes[sound.id]"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        @input="emit('update-channel-volume', sound.id, readRangeValue($event))"
                    />
                    <span>{{ Math.round(channelVolumes[sound.id] * 100) }}</span>
                </div>
            </li>
        </ul>
    </section>
</template>

<style scoped>
.ambient-mixer { --ambient-accent: #0369a1; --ambient-focus: #075985; flex: 1; min-height: 0; overflow-y: auto; padding: 12px; background: #f8fafc; }
.ambient-master, .ambient-master-volume, .channel-toggle, .channel-volume { display: flex; align-items: center; }
.ambient-master { justify-content: space-between; gap: 12px; }
.ambient-master > div { display: flex; flex-direction: column; gap: 2px; }
.ambient-master h2 { margin: 0; color: #334155; font-size: 0.75rem; letter-spacing: 0.08em; }
.ambient-master small { color: #475569; font-size: 0.6875rem; }
.ambient-play { display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 50%; background: var(--ambient-accent); color: #fff; cursor: pointer; }
.ambient-play:disabled { opacity: 0.35; cursor: default; }
.ambient-master-volume { gap: 8px; margin: 10px 0; }
.ambient-master-volume button { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #64748b; cursor: pointer; }
.ambient-master-volume button.active { background: #e0f2fe; color: var(--ambient-accent); }
.ambient-master-volume input, .channel-volume input { flex: 1; min-width: 0; accent-color: var(--ambient-accent); }
.ambient-master-volume span { width: 32px; color: #475569; font-size: 0.6875rem; text-align: right; }
.ambient-notice, .ambient-error { margin: 0 0 10px; padding: 7px 8px; border-radius: 7px; font-size: 0.6875rem; line-height: 1.4; }
.ambient-notice { background: #e0f2fe; color: #075985; }
.ambient-error { background: #ffe4e6; color: #9f1239; }
.ambient-channels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin: 0; padding: 0; list-style: none; }
.ambient-channel { min-width: 0; padding: 7px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
.ambient-channel.selected { border-color: var(--ambient-accent); background: #e0f2fe; }
.channel-toggle { width: 100%; min-width: 0; min-height: 24px; gap: 6px; padding: 0; border: 0; background: transparent; color: #475569; cursor: pointer; text-align: left; }
.channel-toggle > i { flex: 0 0 14px; color: var(--ambient-accent); font-size: 0.75rem; }
.channel-toggle > span { flex: 1; overflow: hidden; color: #334155; font-size: 0.6875rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.channel-state { display: inline-flex; align-items: center; gap: 2px; min-width: 25px; color: #475569; font-size: 0.625rem; font-weight: 700; }
.channel-state i { font-size: 0.625rem; }
.source-status { display: block; margin-top: 2px; color: #475569; font-size: 0.625rem; }
.channel-volume { gap: 6px; margin-top: 6px; }
.channel-volume span { width: 20px; color: #475569; font-size: 0.625rem; text-align: right; }
input[type="range"] { min-height: 24px; }
.ambient-mixer :where(button, input[type="range"]):focus-visible { outline: 2px solid var(--ambient-focus); outline-offset: 2px; }
.visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip-path: inset(50%) !important; border: 0 !important; white-space: nowrap !important; }
</style>
