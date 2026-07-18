import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { AMBIENT_SOUND_IDS, AMBIENT_SOUNDS, type AmbientSoundId } from '../components/music-widget/ambient-sounds';

const STORAGE_KEY = 'desktop-mascot-ambient-mixer';
const clampVolume = (value: number) => Math.min(1, Math.max(0, value));

type ChannelState = Record<AmbientSoundId, boolean>;
type ChannelVolumes = Record<AmbientSoundId, number>;

const createChannelState = (): ChannelState => Object.fromEntries(AMBIENT_SOUND_IDS.map(id => [id, false])) as ChannelState;
const createChannelVolumes = (): ChannelVolumes => Object.fromEntries(AMBIENT_SOUND_IDS.map(id => [id, 0.6])) as ChannelVolumes;

export const useAmbientSoundStore = defineStore('ambient-sound', () => {
    const masterVolume = ref(0.7);
    const muted = ref(false);
    const selectedChannels = ref<ChannelState>(createChannelState());
    const channelVolumes = ref<ChannelVolumes>(createChannelVolumes());
    const isLoaded = ref(false);

    const loadFromLocalStorage = () => {
        if (typeof window === 'undefined') return;

        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;
            const parsed = JSON.parse(saved) as {
                masterVolume?: unknown;
                muted?: unknown;
                selectedChannels?: Record<string, unknown>;
                channelVolumes?: Record<string, unknown>;
            };

            if (typeof parsed.masterVolume === 'number' && Number.isFinite(parsed.masterVolume)) {
                masterVolume.value = clampVolume(parsed.masterVolume);
            }
            if (typeof parsed.muted === 'boolean') muted.value = parsed.muted;

            const nextSelected = createChannelState();
            const nextVolumes = createChannelVolumes();
            for (const id of AMBIENT_SOUND_IDS) {
                if (typeof parsed.selectedChannels?.[id] === 'boolean') nextSelected[id] = parsed.selectedChannels[id] as boolean;
                const savedVolume = parsed.channelVolumes?.[id];
                if (typeof savedVolume === 'number' && Number.isFinite(savedVolume)) nextVolumes[id] = clampVolume(savedVolume);
            }
            const selectedVariantGroups = new Set<string>();
            for (const sound of AMBIENT_SOUNDS) {
                if (!sound.variantGroup || !nextSelected[sound.id]) continue;
                if (selectedVariantGroups.has(sound.variantGroup)) nextSelected[sound.id] = false;
                else selectedVariantGroups.add(sound.variantGroup);
            }
            selectedChannels.value = nextSelected;
            channelVolumes.value = nextVolumes;
        } catch (error) {
            console.warn('環境音ミキサー設定の読み込みエラー:', error);
        } finally {
            isLoaded.value = true;
        }
    };

    const saveToLocalStorage = () => {
        if (typeof window === 'undefined' || !isLoaded.value) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                masterVolume: clampVolume(masterVolume.value),
                muted: muted.value,
                selectedChannels: selectedChannels.value,
                channelVolumes: channelVolumes.value
            }));
        } catch (error) {
            console.warn('環境音ミキサー設定の保存エラー:', error);
        }
    };

    const setChannelSelected = (id: AmbientSoundId, selected: boolean) => {
        const next = { ...selectedChannels.value };
        if (selected) {
            const definition = AMBIENT_SOUNDS.find(sound => sound.id === id);
            if (definition?.variantGroup) {
                for (const sound of AMBIENT_SOUNDS) {
                    if (sound.variantGroup === definition.variantGroup) next[sound.id] = false;
                }
            }
        }
        next[id] = selected;
        selectedChannels.value = next;
    };

    const setChannelVolume = (id: AmbientSoundId, volume: number) => {
        channelVolumes.value = { ...channelVolumes.value, [id]: clampVolume(volume) };
    };

    watch([masterVolume, muted, selectedChannels, channelVolumes], saveToLocalStorage);

    if (typeof window !== 'undefined') {
        window.addEventListener('storage', event => {
            if (event.key === STORAGE_KEY) loadFromLocalStorage();
        });
    }

    return {
        masterVolume,
        muted,
        selectedChannels,
        channelVolumes,
        isLoaded,
        loadFromLocalStorage,
        saveToLocalStorage,
        setChannelSelected,
        setChannelVolume
    };
});
