// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import { describe, expect, it } from 'vitest';
import SubTaskEditorPanel from '../SubTaskEditorPanel.vue';

describe('SubTaskEditorPanel', () => {
    it('save_タイトルと内容と日時をISO文字列で通知すること', async () => {
        const wrapper = mount(SubTaskEditorPanel, {
            props: {
                subTask: {
                    id: 'step-1',
                    title: '変更前',
                    completed: false,
                    status: 'todo'
                }
            },
            global: {
                plugins: [PrimeVue]
            }
        });

        await wrapper.find('input[type="text"]').setValue('変更後');
        await wrapper.find('textarea').setValue('サブタスクの詳細');
        const dateInputs = wrapper.findAll('input[type="datetime-local"]');
        await dateInputs[0].setValue('2026-07-24T10:00');
        await dateInputs[1].setValue('2026-07-24T11:30');
        await wrapper.findAll('button').at(-1)!.trigger('click');

        const updates = wrapper.emitted('save')?.[0]?.[0] as Record<string, string>;
        expect(updates.title).toBe('変更後');
        expect(updates.memo).toBe('サブタスクの詳細');
        expect(updates.scheduledAt).toBe(new Date('2026-07-24T10:00').toISOString());
        expect(updates.scheduledEndAt).toBe(new Date('2026-07-24T11:30').toISOString());
    });

    it('save_終了日時が開始日時以前の場合は保存できないこと', async () => {
        const wrapper = mount(SubTaskEditorPanel, {
            props: {
                subTask: {
                    id: 'step-1',
                    title: 'サブタスク',
                    completed: false,
                    status: 'todo'
                }
            },
            global: {
                plugins: [PrimeVue]
            }
        });

        const dateInputs = wrapper.findAll('input[type="datetime-local"]');
        await dateInputs[0].setValue('2026-07-24T11:00');
        await dateInputs[1].setValue('2026-07-24T10:00');

        expect(wrapper.text()).toContain('終了日時は開始日時より後に設定してください。');
        expect(wrapper.findAll('button').at(-1)!.attributes('disabled')).toBeDefined();
    });

    it('autoFocusSchedule_日時設定から開いた場合は開始日時へフォーカスすること', async () => {
        const wrapper = mount(SubTaskEditorPanel, {
            props: {
                subTask: {
                    id: 'step-1',
                    title: 'サブタスク',
                    completed: false,
                    status: 'todo'
                },
                autoFocusSchedule: true
            },
            global: {
                plugins: [PrimeVue]
            },
            attachTo: document.body
        });

        await wrapper.vm.$nextTick();

        expect(document.activeElement).toBe(wrapper.find('input[type="datetime-local"]').element);
        wrapper.unmount();
    });
});
