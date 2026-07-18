// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import TaskActionButtons from '../TaskActionButtons.vue';
import type { Task } from '../../../store/task';

// モックタスク
const mockTask: Task = {
    id: 'test-task-1',
    title: 'テストタスク',
    status: 'todo',
    completed: false,
    categoryId: 'cat-1',
    createdAt: new Date().toISOString(),
    steps: [],
    priority: 'normal',
    order: 1
};

describe('TaskActionButtons', () => {
    it('TaskActionButtons_編集ボタンのaria-labelとtitleが正しく設定され、クリック時にeditイベントがemitされること', async () => {
        const wrapper = mount(TaskActionButtons, {
            props: {
                task: mockTask,
                showDeleteMode: false
            }
        });

        const editBtn = wrapper.findAll('.task-action-btn')[0];
        expect(editBtn.attributes('title')).toBe('タスクを編集');
        expect(editBtn.attributes('aria-label')).toBe('タスク「テストタスク」を編集');

        await editBtn.trigger('click');

        const emitted = wrapper.emitted('edit');
        expect(emitted).toBeTruthy();
        expect(emitted![0][0]).toEqual(mockTask);
    });

    it('TaskActionButtons_showDeleteModeがfalseの時、削除ボタンが表示されないこと', () => {
        const wrapper = mount(TaskActionButtons, {
            props: {
                task: mockTask,
                showDeleteMode: false
            }
        });

        const buttons = wrapper.findAll('.task-action-btn');
        expect(buttons.length).toBe(1);
    });

    it('TaskActionButtons_showDeleteModeがtrueの時、削除ボタンのaria-labelとtitleが正しく設定され、クリック時にdeleteイベントがemitされること', async () => {
        const wrapper = mount(TaskActionButtons, {
            props: {
                task: mockTask,
                showDeleteMode: true
            }
        });

        const buttons = wrapper.findAll('.task-action-btn');
        expect(buttons.length).toBe(2);

        const deleteBtn = buttons[1];
        expect(deleteBtn.attributes('title')).toBe('タスクを削除');
        expect(deleteBtn.attributes('aria-label')).toBe('タスク「テストタスク」を削除');

        await deleteBtn.trigger('click');

        const emitted = wrapper.emitted('delete');
        expect(emitted).toBeTruthy();
        expect(emitted![0][0]).toEqual(mockTask);
    });

    it('TaskActionButtons_ボタンクリックイベントが親へ伝播しないこと(click.stop)', async () => {
        const spy = vi.fn();
        const Parent = {
            components: { TaskActionButtons },
            template: `
                <div @click="onClick">
                    <TaskActionButtons :task="task" :show-delete-mode="true" />
                </div>
            `,
            data() {
                return { task: mockTask };
            },
            methods: {
                onClick: spy
            }
        };

        const wrapper = mount(Parent);
        const buttons = wrapper.findAll('.task-action-btn');

        // 編集ボタンのクリック
        await buttons[0].trigger('click');
        // 削除ボタンのクリック
        await buttons[1].trigger('click');

        // 親のclickイベントが発火していないこと
        expect(spy).not.toHaveBeenCalled();
    });
});
