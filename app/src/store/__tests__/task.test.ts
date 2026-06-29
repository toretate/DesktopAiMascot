// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTaskStore } from '../task';

describe('useTaskStore', () => {
    beforeEach(() => {
        // Piniaの初期化
        setActivePinia(createPinia());
        // localStorageのモック（テスト環境用）
        if (typeof window !== 'undefined') {
            localStorage.clear();
        }
    });

    describe('addCategory - カテゴリ追加機能', () => {
        it('addCategory_新規カテゴリが追加されアクティブになること', () => {
            const store = useTaskStore();
            store.loadFromLocalStorage(); // 初期化

            const initialLength = store.categories.length;
            store.addCategory('新規カテゴリ');

            expect(store.categories.length).toBe(initialLength + 1);
            expect(store.categories[store.categories.length - 1].name).toBe('新規カテゴリ');
            expect(store.activeCategoryId).toBe(store.categories[store.categories.length - 1].id);
        });
    });

    describe('updateCategory - カテゴリ編集機能', () => {
        it('updateCategory_指定したカテゴリの名前が更新されること', () => {
            const store = useTaskStore();
            store.loadFromLocalStorage();

            store.addCategory('編集前カテゴリ');
            const catId = store.activeCategoryId;

            store.updateCategory(catId, '編集後カテゴリ');
            const cat = store.categories.find(c => c.id === catId);

            expect(cat?.name).toBe('編集後カテゴリ');
        });
    });

    describe('deleteCategory - カテゴリ削除機能', () => {
        it('deleteCategory_指定したカテゴリと属するタスクが一緒に削除されること', () => {
            const store = useTaskStore();
            store.loadFromLocalStorage();

            store.addCategory('削除対象カテゴリ');
            const catId = store.activeCategoryId;

            // タスクを追加
            store.addTask(catId, '削除されるタスク');
            expect(store.tasks.filter(t => t.categoryId === catId).length).toBe(1);

            store.deleteCategory(catId);

            expect(store.categories.some(c => c.id === catId)).toBe(false);
            expect(store.tasks.filter(t => t.categoryId === catId).length).toBe(0);
        });
    });

    describe('addTask - タスク追加機能', () => {
        it('addTask_指定カテゴリに親タスクが追加されること', () => {
            const store = useTaskStore();
            store.loadFromLocalStorage();

            const catId = store.categories[0].id;
            store.addTask(catId, 'テスト用親タスク');

            const activeTasks = store.tasks.filter(t => t.categoryId === catId);
            expect(activeTasks.length).toBe(1);
            expect(activeTasks[0].title).toBe('テスト用親タスク');
            expect(activeTasks[0].completed).toBe(false);
        });
    });

    describe('toggleTask - タスク完了トグル機能', () => {
        it('toggleTask_タスクの完了状態が切り替わり配下のサブタスクも連動すること', () => {
            const store = useTaskStore();
            store.loadFromLocalStorage();

            const catId = store.categories[0].id;
            store.addTask(catId, 'トグル親タスク');
            const task = store.tasks[0];

            // サブタスクを追加
            store.addSubTask(task.id, 'サブタスク1');
            store.addSubTask(task.id, 'サブタスク2');

            // 親を完了トグル
            store.toggleTask(task.id);
            expect(task.completed).toBe(true);
            expect(task.steps.every(s => s.completed)).toBe(true);

            // 親を未完了トグル
            store.toggleTask(task.id);
            expect(task.completed).toBe(false);
            expect(task.steps.every(s => !s.completed)).toBe(true);
        });
    });

    describe('addSubTask / toggleSubTask - サブタスク追加とトグル自動完了機能', () => {
        it('addSubTask_サブタスクが正常に追加されること', () => {
            const store = useTaskStore();
            store.loadFromLocalStorage();

            const catId = store.categories[0].id;
            store.addTask(catId, '親タスク');
            const task = store.tasks[0];

            store.addSubTask(task.id, '新規サブタスク');
            expect(task.steps.length).toBe(1);
            expect(task.steps[0].title).toBe('新規サブタスク');
        });

        it('toggleSubTask_すべてのサブタスクが完了になった時のみ親タスクが自動的に完了になること', () => {
            const store = useTaskStore();
            store.loadFromLocalStorage();

            const catId = store.categories[0].id;
            store.addTask(catId, '親タスク');
            const task = store.tasks[0];

            store.addSubTask(task.id, 'サブタスク1');
            store.addSubTask(task.id, 'サブタスク2');

            const s1 = task.steps[0].id;
            const s2 = task.steps[1].id;

            // サブタスク1だけ完了
            store.toggleSubTask(task.id, s1);
            expect(task.completed).toBe(false);

            // サブタスク2も完了 -> 親が自動完了
            store.toggleSubTask(task.id, s2);
            expect(task.completed).toBe(true);

            // サブタスク1を未完了に戻す -> 親も未完了に戻る
            store.toggleSubTask(task.id, s1);
            expect(task.completed).toBe(false);
        });
    });

    describe('showTaskWidget - ウィジェット表示フラグ', () => {
        it('showTaskWidget_表示フラグの初期値がfalseであり変更可能なこと', () => {
            const store = useTaskStore();
            expect(store.showTaskWidget).toBe(false);
            
            store.showTaskWidget = true;
            expect(store.showTaskWidget).toBe(true);
        });
    });
});
