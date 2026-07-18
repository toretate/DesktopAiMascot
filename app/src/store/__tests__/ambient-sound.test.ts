// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useAmbientSoundStore } from '../ambient-sound';

describe('useAmbientSoundStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
    });

    it('loadFromLocalStorage_保存した音量とチャンネル選択を復元すること', () => {
        localStorage.setItem('desktop-mascot-ambient-mixer', JSON.stringify({
            masterVolume: 0.45,
            muted: true,
            selectedChannels: { wind: true },
            channelVolumes: { wind: 0.25 }
        }));

        const store = useAmbientSoundStore();
        store.loadFromLocalStorage();

        expect(store.masterVolume).toBe(0.45);
        expect(store.muted).toBe(true);
        expect(store.selectedChannels.wind).toBe(true);
        expect(store.channelVolumes.wind).toBe(0.25);
    });

    it('setChannelSelected_雨の強弱を同時選択しないこと', () => {
        const store = useAmbientSoundStore();
        store.loadFromLocalStorage();

        store.setChannelSelected('rain-light', true);
        store.setChannelSelected('rain-heavy', true);

        expect(store.selectedChannels['rain-light']).toBe(false);
        expect(store.selectedChannels['rain-heavy']).toBe(true);
    });

    it('setChannelVolume_音量を有効範囲に補正すること', () => {
        const store = useAmbientSoundStore();
        store.loadFromLocalStorage();

        store.setChannelVolume('river', 2);

        expect(store.channelVolumes.river).toBe(1);
    });
});
