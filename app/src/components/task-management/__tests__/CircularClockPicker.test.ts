// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import CircularClockPicker from '../CircularClockPicker.vue';

const mountClockPicker = (initialHour = 9, initialMinute = 30) => {
    return mount(defineComponent({
        components: { CircularClockPicker },
        setup() {
            const hour = ref(initialHour);
            const minute = ref(initialMinute);
            return { hour, minute };
        },
        template: `
            <CircularClockPicker
                v-model:hour="hour"
                v-model:minute="minute"
            />
        `
    }));
};

const mockDialBounds = (wrapper: ReturnType<typeof mountClockPicker>) => {
    const dial = wrapper.find('.clock-dial');
    dial.element.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 170,
        bottom: 170,
        width: 170,
        height: 170,
        x: 0,
        y: 0,
        toJSON: () => ({})
    });
    return dial;
};

describe('CircularClockPicker', () => {
    it('初期時刻を24時間表記で表示すること', () => {
        const wrapper = mountClockPicker(9, 5);

        expect(wrapper.get('[aria-label="選択時刻"]').text()).toContain('09:05');
        expect(wrapper.findAll('.time-part')[0].classes()).toContain('active');
    });

    it('文字盤のドラッグで時と分を更新すること', async () => {
        const wrapper = mountClockPicker();
        const dial = mockDialBounds(wrapper);

        await dial.trigger('mousedown', { clientX: 85, clientY: 0 });
        window.dispatchEvent(new MouseEvent('mouseup'));
        await nextTick();
        expect((wrapper.vm as unknown as { hour: number }).hour).toBe(0);
        expect(wrapper.findAll('.time-part')[1].classes()).toContain('active');

        await dial.trigger('mousedown', { clientX: 170, clientY: 85 });
        window.dispatchEvent(new MouseEvent('mouseup'));
        expect((wrapper.vm as unknown as { minute: number }).minute).toBe(15);
    });

    it('時刻表示の時部分を押すと時選択へ戻ること', async () => {
        const wrapper = mountClockPicker();
        const dial = mockDialBounds(wrapper);

        await dial.trigger('mousedown', { clientX: 85, clientY: 0 });
        window.dispatchEvent(new MouseEvent('mouseup'));
        await nextTick();
        await wrapper.findAll('.time-part')[0].trigger('click');

        expect(wrapper.findAll('.time-part')[0].classes()).toContain('active');
        expect(wrapper.findAll('.time-part')[1].classes()).not.toContain('active');
    });
});
