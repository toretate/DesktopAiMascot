// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import DayTimelinePicker from '../DayTimelinePicker.vue';

const mountTimelinePicker = (initialStart = 9 * 60, initialEnd = 10 * 60) => {
    return mount(defineComponent({
        components: { DayTimelinePicker },
        setup() {
            const startMinute = ref(initialStart);
            const endMinute = ref(initialEnd);
            return { startMinute, endMinute };
        },
        template: `
            <DayTimelinePicker
                v-model:start-minute="startMinute"
                v-model:end-minute="endMinute"
                :default-duration-minutes="60"
            />
        `
    }));
};

const mockTimelineBounds = (wrapper: ReturnType<typeof mountTimelinePicker>) => {
    const timeline = wrapper.find('.timeline-surface');
    timeline.element.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 300,
        bottom: 1152,
        width: 300,
        height: 1152,
        x: 0,
        y: 0,
        toJSON: () => ({})
    });
    return timeline;
};

describe('DayTimelinePicker', () => {
    it('選択中の開始時刻と終了時刻を表示すること', () => {
        const wrapper = mountTimelinePicker(17 * 60, 19 * 60 + 15);

        expect(wrapper.get('.selected-time-range').text()).toContain('17:00〜19:15');
        expect(wrapper.get('[aria-label="開始時刻"]').attributes('value')).toBe('17:00');
        expect(wrapper.get('[aria-label="終了時刻"]').attributes('value')).toBe('19:15');
    });

    it('クリック時に既定所要時間の範囲を設定すること', async () => {
        const wrapper = mountTimelinePicker();
        const timeline = mockTimelineBounds(wrapper);

        await timeline.trigger('pointerdown', { button: 0, clientY: 576 });
        window.dispatchEvent(new PointerEvent('pointerup'));
        await nextTick();

        expect((wrapper.vm as unknown as { startMinute: number }).startMinute).toBe(12 * 60);
        expect((wrapper.vm as unknown as { endMinute: number }).endMinute).toBe(13 * 60);
    });

    it('ドラッグした範囲を15分単位で設定すること', async () => {
        const wrapper = mountTimelinePicker();
        const timeline = mockTimelineBounds(wrapper);

        await timeline.trigger('pointerdown', { button: 0, clientY: 17 * 48 });
        window.dispatchEvent(new PointerEvent('pointermove', { clientY: 19.25 * 48 }));
        window.dispatchEvent(new PointerEvent('pointerup'));
        await nextTick();

        expect((wrapper.vm as unknown as { startMinute: number }).startMinute).toBe(17 * 60);
        expect((wrapper.vm as unknown as { endMinute: number }).endMinute).toBe(19 * 60 + 15);
    });

    it('時刻入力欄から開始と終了を変更できること', async () => {
        const wrapper = mountTimelinePicker();
        const startInput = wrapper.get('[aria-label="開始時刻"]');
        const endInput = wrapper.get('[aria-label="終了時刻"]');

        await startInput.setValue('10:15');
        await startInput.trigger('change');
        await endInput.setValue('11:45');
        await endInput.trigger('change');

        expect((wrapper.vm as unknown as { startMinute: number }).startMinute).toBe(10 * 60 + 15);
        expect((wrapper.vm as unknown as { endMinute: number }).endMinute).toBe(11 * 60 + 45);
    });
});
