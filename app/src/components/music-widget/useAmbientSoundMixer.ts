import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { AMBIENT_SOUNDS, type AmbientSoundId } from './ambient-sounds';
import { useAmbientSoundStore } from '../../store/ambient-sound';

/** 独立したAudio要素を重ね、音楽プレイヤーとは別系統で環境音を再生する。 */
export function useAmbientSoundMixer() {
    const store = useAmbientSoundStore();
    const { masterVolume, muted, selectedChannels, channelVolumes } = storeToRefs(store);
    const audioElements = new Map<AmbientSoundId, HTMLAudioElement>();
    const isRunning = ref(false);
    const playbackError = ref('');
    const availableCount = computed(() => AMBIENT_SOUNDS.filter(sound => Boolean(sound.source)).length);
    const playableSelectionCount = computed(() => AMBIENT_SOUNDS.filter(sound => sound.source && selectedChannels.value[sound.id]).length);

    const applyVolumes = () => {
        for (const [id, audio] of audioElements) {
            audio.muted = muted.value;
            audio.volume = Math.min(1, masterVolume.value * channelVolumes.value[id]);
        }
    };

    const stopChannel = (id: AmbientSoundId) => {
        const audio = audioElements.get(id);
        if (!audio) return;
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        audioElements.delete(id);
    };

    const startChannel = async (id: AmbientSoundId) => {
        const sound = AMBIENT_SOUNDS.find(item => item.id === id);
        if (!sound?.source || audioElements.has(id)) return;
        const audio = new Audio(sound.source);
        audio.loop = true;
        audio.preload = 'auto';
        audioElements.set(id, audio);
        applyVolumes();
        try {
            await audio.play();
        } catch (error) {
            const playbackWasCancelled = audioElements.get(id) !== audio || !selectedChannels.value[id];
            if (playbackWasCancelled) return;
            console.warn(`${sound.label}の再生を開始できませんでした:`, error);
            playbackError.value = `${sound.label}を再生できませんでした。`;
            stopChannel(id);
        }
    };

    const startSelected = async () => {
        isRunning.value = true;
        await Promise.all(AMBIENT_SOUNDS
            .filter(sound => sound.source && selectedChannels.value[sound.id])
            .map(sound => startChannel(sound.id)));
        isRunning.value = audioElements.size > 0;
    };

    const stopAll = () => {
        for (const id of [...audioElements.keys()]) stopChannel(id);
        isRunning.value = false;
    };

    const toggleRunning = async () => {
        playbackError.value = '';
        if (isRunning.value) stopAll();
        else await startSelected();
    };

    const initializeMixer = () => store.loadFromLocalStorage();
    const disposeMixer = () => stopAll();

    watch([masterVolume, muted, channelVolumes], applyVolumes);
    watch(selectedChannels, async next => {
        const shouldContinue = isRunning.value;
        const startTasks: Promise<void>[] = [];
        playbackError.value = '';
        for (const sound of AMBIENT_SOUNDS) {
            if (!next[sound.id]) stopChannel(sound.id);
            else if (shouldContinue) startTasks.push(startChannel(sound.id));
        }
        await Promise.all(startTasks);
        if (shouldContinue) isRunning.value = audioElements.size > 0;
    }, { flush: 'sync' });

    return {
        masterVolume,
        muted,
        selectedChannels,
        channelVolumes,
        isRunning,
        playbackError,
        availableCount,
        playableSelectionCount,
        setChannelSelected: store.setChannelSelected,
        setChannelVolume: store.setChannelVolume,
        toggleRunning,
        initializeMixer,
        disposeMixer
    };
}
