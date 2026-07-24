// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import HistoryPanel from '../HistoryPanel.vue';

describe('HistoryPanel', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('履歴選択をキーボード操作可能なボタンとして表示すること', async () => {
        const wrapper = mount(HistoryPanel, {
            props: {
                sessions: [{ id: 'session-1', title: '最初の会話', timestamp: 1, messages: [] }],
                activeSessionId: 'session-1',
            },
        });

        const selectButton = wrapper.get('.history-select-btn');
        expect(selectButton.element.tagName).toBe('BUTTON');
        expect(selectButton.attributes('aria-current')).toBe('true');

        await selectButton.trigger('click');
        expect(wrapper.emitted('select-session')).toEqual([['session-1']]);
    });
});
