import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

// カテゴリ（タブ）のインターフェース
export interface Category {
    id: string;
    name: string;
    order: number;
}

// サブタスク（Step）のインターフェース
export interface SubTask {
    id: string;
    title: string;
    completed: boolean;
    status: 'todo' | 'doing' | 'done';
}

// 親タスク（Quest）のインターフェース
export interface Task {
    id: string;
    categoryId: string;
    title: string;
    completed: boolean;
    priority: 'normal' | 'star' | 'thunder';
    steps: SubTask[];
    expanded?: boolean;
    order: number;
    createdAt: string;
}

export const useTaskStore = defineStore('task', () => {
    // 状態管理
    const categories = ref<Category[]>([]);
    const tasks = ref<Task[]>([]);
    const activeCategoryId = ref<string>('default');
    const currentView = ref<'todo' | 'timeline'>('todo');
    const showTaskWidget = ref<boolean>(false);
    const isLoaded = ref(false);

    // LocalStorage からデータをロード
    const loadFromLocalStorage = () => {
        if (typeof window === 'undefined') return;

        try {
            const savedCategories = localStorage.getItem('desktop-mascot-categories');
            if (savedCategories) {
                categories.value = JSON.parse(savedCategories);
            } else {
                // デフォルト初期値
                categories.value = [
                    { id: 'default', name: 'Work', order: 0 },
                    { id: 'private', name: 'Private', order: 1 }
                ];
            }

            const savedTasks = localStorage.getItem('desktop-mascot-tasks');
            if (savedTasks) {
                tasks.value = JSON.parse(savedTasks);
            }

            const savedActiveId = localStorage.getItem('desktop-mascot-active-category');
            if (savedActiveId && categories.value.some(c => c.id === savedActiveId)) {
                activeCategoryId.value = savedActiveId;
            } else if (categories.value.length > 0) {
                activeCategoryId.value = categories.value[0].id;
            }

            const savedView = localStorage.getItem('desktop-mascot-task-view');
            if (savedView === 'todo' || savedView === 'timeline') {
                currentView.value = savedView;
            }

            const savedShowWidget = localStorage.getItem('desktop-mascot-show-task-widget');
            if (savedShowWidget) {
                showTaskWidget.value = savedShowWidget === 'true';
            }
        } catch (error) {
            console.error('LocalStorageからのタスク読み込みエラー:', error);
        } finally {
            isLoaded.value = true;
        }
    };

    // LocalStorage へデータを保存
    const saveToLocalStorage = () => {
        if (typeof window === 'undefined' || !isLoaded.value) return;

        try {
            localStorage.setItem('desktop-mascot-categories', JSON.stringify(categories.value));
            localStorage.setItem('desktop-mascot-tasks', JSON.stringify(tasks.value));
            localStorage.setItem('desktop-mascot-active-category', activeCategoryId.value);
            localStorage.setItem('desktop-mascot-task-view', currentView.value);
            localStorage.setItem('desktop-mascot-show-task-widget', String(showTaskWidget.value));
        } catch (error) {
            console.error('LocalStorageへのタスク保存エラー:', error);
        }
    };

    // 自動保存の設定
    watch([categories, tasks, activeCategoryId, currentView, showTaskWidget], () => {
        saveToLocalStorage();
    }, { deep: true });

    // ゲッター：アクティブなカテゴリに属するタスクを順序順に取得
    const filteredTasks = computed(() => {
        return tasks.value
            .filter(t => t.categoryId === activeCategoryId.value)
            .sort((a, b) => a.order - b.order);
    });

    // ゲッター：時系列順のタスクリスト（タイムライン用）
    const timelineTasks = computed(() => {
        return [...tasks.value].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    });

    // ゲッター：アクティブなカテゴリの全体完了度（ゲージ用）
    const activeCategoryCompletionRate = computed(() => {
        const currentTasks = filteredTasks.value;
        if (currentTasks.length === 0) return 0;
        const completedCount = currentTasks.filter(t => t.completed).length;
        return Math.round((completedCount / currentTasks.length) * 100);
    });

    // --- カテゴリ（タブ）操作 ---
    const addCategory = (name: string) => {
        const id = 'cat_' + Math.random().toString(36).substring(2, 11);
        const order = categories.value.length;
        categories.value.push({ id, name, order });
        activeCategoryId.value = id;
    };

    const updateCategory = (id: string, name: string) => {
        const cat = categories.value.find(c => c.id === id);
        if (cat) {
            cat.name = name;
        }
    };

    const deleteCategory = (id: string) => {
        categories.value = categories.value.filter(c => c.id !== id);
        // カテゴリ削除に伴い、属するタスクも削除
        tasks.value = tasks.value.filter(t => t.categoryId !== id);

        // アクティブなカテゴリが消えた場合、別のカテゴリへ移動
        if (activeCategoryId.value === id) {
            if (categories.value.length > 0) {
                activeCategoryId.value = categories.value[0].id;
            } else {
                // 最低限1つのデフォルトを作成
                addCategory('Work');
            }
        }
    };

    const updateCategoriesOrder = (orderedCats: Category[]) => {
        categories.value = orderedCats.map((cat, idx) => ({
            ...cat,
            order: idx
        }));
    };

    // --- タスク操作 ---
    const addTask = (categoryId: string, title: string, priority: 'normal' | 'star' | 'thunder' = 'normal') => {
        const id = 'task_' + Math.random().toString(36).substring(2, 11);
        const order = tasks.value.filter(t => t.categoryId === categoryId).length;
        tasks.value.push({
            id,
            categoryId,
            title,
            completed: false,
            priority,
            steps: [],
            expanded: false,
            order,
            createdAt: new Date().toISOString()
        });
    };

    const updateTask = (id: string, updates: Partial<Task>) => {
        const task = tasks.value.find(t => t.id === id);
        if (task) {
            Object.assign(task, updates);
        }
    };

    const deleteTask = (id: string) => {
        tasks.value = tasks.value.filter(t => t.id !== id);
    };

    const toggleTask = (id: string) => {
        const task = tasks.value.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            // 親タスクが完了になった場合、配下のサブタスクをすべて完了（done）にする。
            // 未完了になった場合は、配下のサブタスクをすべて未完了（todo）にする。
            task.steps.forEach(step => {
                step.completed = task.completed;
                step.status = task.completed ? 'done' : 'todo';
            });
        }
    };

    const updateTasksOrder = (orderedTasks: Task[]) => {
        // 並び替えられたタスクの順序を反映
        const orderMap = new Map(orderedTasks.map((t, idx) => [t.id, idx]));
        tasks.value.forEach(t => {
            if (t.categoryId === activeCategoryId.value && orderMap.has(t.id)) {
                t.order = orderMap.get(t.id)!;
            }
        });
    };

    // --- サブタスク（Step）操作 ---
    const addSubTask = (taskId: string, title: string) => {
        const task = tasks.value.find(t => t.id === taskId);
        if (task) {
            const step: SubTask = {
                id: 'step_' + Math.random().toString(36).substring(2, 11),
                title,
                completed: false,
                status: 'todo'
            };
            task.steps.push(step);
            // サブタスクが追加されたら、親の完了フラグを再計算
            recalculateTaskCompletion(task);
        }
    };

    const deleteSubTask = (taskId: string, subTaskId: string) => {
        const task = tasks.value.find(t => t.id === taskId);
        if (task) {
            task.steps = task.steps.filter(s => s.id !== subTaskId);
            recalculateTaskCompletion(task);
        }
    };

    const toggleSubTask = (taskId: string, subTaskId: string) => {
        const task = tasks.value.find(t => t.id === taskId);
        if (task) {
            const step = task.steps.find(s => s.id === subTaskId);
            if (step) {
                step.completed = !step.completed;
                step.status = step.completed ? 'done' : 'todo';
                recalculateTaskCompletion(task);
            }
        }
    };

    const updateSubTaskStatus = (taskId: string, subTaskId: string, status: 'todo' | 'doing' | 'done') => {
        const task = tasks.value.find(t => t.id === taskId);
        if (task) {
            const step = task.steps.find(s => s.id === subTaskId);
            if (step) {
                step.status = status;
                step.completed = (status === 'done');
                recalculateTaskCompletion(task);
            }
        }
    };

    // サブタスク状態から親タスクの完了を再計算
    const recalculateTaskCompletion = (task: Task) => {
        if (task.steps.length === 0) return;
        const allCompleted = task.steps.every(s => s.completed);
        task.completed = allCompleted;
    };

    return {
        categories,
        tasks,
        activeCategoryId,
        currentView,
        showTaskWidget,
        isLoaded,
        filteredTasks,
        timelineTasks,
        activeCategoryCompletionRate,
        loadFromLocalStorage,
        addCategory,
        updateCategory,
        deleteCategory,
        updateCategoriesOrder,
        addTask,
        updateTask,
        deleteTask,
        toggleTask,
        updateTasksOrder,
        addSubTask,
        deleteSubTask,
        toggleSubTask,
        updateSubTaskStatus
    };
});
