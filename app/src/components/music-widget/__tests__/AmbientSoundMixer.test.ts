// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AmbientSoundMixer from '../AmbientSoundMixer.vue';
import { AMBIENT_SOUND_IDS, type AmbientSoundId } from '../ambient-sounds';

const selectedChannels = Object.fromEntries(AMBIENT_SOUND_IDS.map(id => [id, false])) as Record<AmbientSoundId, boolean>;
const channelVolumes = Object.fromEntries(AMBIENT_SOUND_IDS.map(id => [id, 0.6])) as Record<AmbientSoundId, number>;

describe('AmbientSoundMixer', () => {
    it('channels_環境音の全チャンネルと音源準備中表示を出すこと', () => {
        const wrapper = mount(AmbientSoundMixer, {
            props: { masterVolume: 0.7, muted: false, selectedChannels, channelVolumes, isRunning: false, availableCount: 0, playbackError: '' }
        });

        expect(wrapper.findAll('.ambient-channel')).toHaveLength(9);
        expect(wrapper.text()).toContain('雨・弱');
        expect(wrapper.text()).toContain('夜の森');
        expect(wrapper.text()).toContain('音源準備中です');
        expect(wrapper.findAll('label.visually-hidden')).toHaveLength(10);
        expect(wrapper.get('.ambient-play').attributes('disabled')).toBeDefined();
    });

    it('channelToggle_選択イベントを通知すること', async () => {
        const wrapper = mount(AmbientSoundMixer, {
            props: { masterVolume: 0.7, muted: false, selectedChannels, channelVolumes, isRunning: false, availableCount: 0, playbackError: '' }
        });

        await wrapper.findAll('.channel-toggle')[0].trigger('click');

        expect(wrapper.emitted('select-channel')?.[0]).toEqual(['rain-light', true]);
    });

    it('selectedChannel_ON表示とチェックアイコンで選択状態を示すこと', () => {
        const selected = { ...selectedChannels, wind: true };
        const wrapper = mount(AmbientSoundMixer, {
            props: { masterVolume: 0.7, muted: false, selectedChannels: selected, channelVolumes, isRunning: false, availableCount: 0, playbackError: '' }
        });

        const windChannel = wrapper.findAll('.ambient-channel').find(channel => channel.text().includes('風'))!;
        expect(windChannel.classes()).toContain('selected');
        expect(windChannel.get('.channel-state').text()).toBe('ON');
        expect(windChannel.find('.channel-state .pi-check').exists()).toBe(true);
    });

    it('playbackError_再生エラーをステータスとして表示すること', () => {
        const wrapper = mount(AmbientSoundMixer, {
            props: {
                masterVolume: 0.7,
                muted: false,
                selectedChannels,
                channelVolumes,
                isRunning: false,
                availableCount: 1,
                playbackError: '風を再生できませんでした。'
            }
        });

        expect(wrapper.get('.ambient-error').attributes('role')).toBe('status');
        expect(wrapper.get('.ambient-error').text()).toContain('風を再生できませんでした');
    });
});
