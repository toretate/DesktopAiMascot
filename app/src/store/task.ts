import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { startNotificationCheck } from '../utils/task-notification';

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
    status?: 'todo' | 'doing' | 'paused' | 'done';
    startedAt?: string;
    endedAt?: string;
    scheduledAt?: string;
    notified?: boolean;
}

export const useTaskStore = defineStore('task', () => {
    // 状態管理
    const categories = ref<Category[]>([]);
    const tasks = ref<Task[]>([]);
    const activeCategoryId = ref<string>('default');
    const currentView = ref<'todo' | 'timeline'>('todo');
    const showTaskWidget = ref<boolean>(false);
    const enableNotification = ref<boolean>(true);
    const notificationMinutes = ref<number>(5);
    const isLoaded = ref(false);

    // LocalStorage および サーバーからデータをロード
    const loadFromLocalStorage = async () => {
        if (typeof window === 'undefined') return;

        // 1. まず LocalStorage の値を読み込んで初期表示を高速にする
        try {
            const savedCategories = localStorage.getItem('desktop-mascot-categories');
            if (savedCategories) {
                categories.value = JSON.parse(savedCategories);
            }
            const savedTasks = localStorage.getItem('desktop-mascot-tasks');
            if (savedTasks) {
                tasks.value = JSON.parse(savedTasks);
            }
            const savedActiveId = localStorage.getItem('desktop-mascot-active-category');
            if (savedActiveId) {
                activeCategoryId.value = savedActiveId;
            }
            const savedView = localStorage.getItem('desktop-mascot-task-view');
            if (savedView === 'todo' || savedView === 'timeline') {
                currentView.value = savedView;
            }
            const savedShowWidget = localStorage.getItem('desktop-mascot-show-task-widget');
            if (savedShowWidget) {
                showTaskWidget.value = savedShowWidget === 'true';
            }
            const savedEnableNotif = localStorage.getItem('desktop-mascot-enable-notification');
            if (savedEnableNotif) {
                enableNotification.value = savedEnableNotif === 'true';
            }
            const savedNotifMin = localStorage.getItem('desktop-mascot-notification-minutes');
            if (savedNotifMin) {
                notificationMinutes.value = parseInt(savedNotifMin, 10) || 5;
            }
        } catch (error) {
            console.warn('LocalStorageからの初期タスク読み込みエラー:', error);
        }

        // 2. 次にサーバー（API）から最新データをロードする
        try {
            const res = await fetch('/api/tasks', { credentials: 'include' });
            if (res.ok) {
                const resJson = await res.json();
                if (resJson.success) {
                    if (Array.isArray(resJson.categories)) {
                        categories.value = resJson.categories;
                    }
                    if (Array.isArray(resJson.tasks)) {
                        tasks.value = resJson.tasks;
                    }
                    if (resJson.enableNotification !== undefined) {
                        enableNotification.value = resJson.enableNotification;
                    }
                    if (resJson.notificationMinutes !== undefined) {
                        notificationMinutes.value = resJson.notificationMinutes;
                    }
                    // 同期のために LocalStorage にも書き込んでおく
                    localStorage.setItem('desktop-mascot-categories', JSON.stringify(categories.value));
                    localStorage.setItem('desktop-mascot-tasks', JSON.stringify(tasks.value));
                    localStorage.setItem('desktop-mascot-enable-notification', String(enableNotification.value));
                    localStorage.setItem('desktop-mascot-notification-minutes', String(notificationMinutes.value));
                }
            }
        } catch (error) {
            console.warn('サーバーからのタスクロードに失敗しました (LocalStorageを使用します):', error);
        } finally {
            // デフォルトカテゴリの初期化
            if (categories.value.length === 0) {
                categories.value = [
                    { id: 'default', name: 'Work', order: 0 },
                    { id: 'private', name: 'Private', order: 1 }
                ];
            }
            if (!activeCategoryId.value && categories.value.length > 0) {
                activeCategoryId.value = categories.value[0].id;
            }
            isLoaded.value = true;
            // 監視タイマーの開始
            startNotificationCheck();
        }
    };

    // LocalStorage および サーバーへデータを保存
    const saveToLocalStorage = () => {
        if (typeof window === 'undefined' || !isLoaded.value) return;

        try {
            localStorage.setItem('desktop-mascot-categories', JSON.stringify(categories.value));
            localStorage.setItem('desktop-mascot-tasks', JSON.stringify(tasks.value));
            localStorage.setItem('desktop-mascot-active-category', activeCategoryId.value);
            localStorage.setItem('desktop-mascot-task-view', currentView.value);
            localStorage.setItem('desktop-mascot-show-task-widget', String(showTaskWidget.value));
            localStorage.setItem('desktop-mascot-enable-notification', String(enableNotification.value));
            localStorage.setItem('desktop-mascot-notification-minutes', String(notificationMinutes.value));

            // サーバーへ同期保存 (非同期実行)
            fetch('/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    categories: categories.value,
                    tasks: tasks.value,
                    enableNotification: enableNotification.value,
                    notificationMinutes: notificationMinutes.value
                }),
                credentials: 'include'
            }).catch(err => {
                console.warn('サーバーへのタスク保存に失敗しました:', err);
            });
        } catch (error) {
            console.error('LocalStorageへのタスク保存エラー:', error);
        }
    };

    // 自動保存の設定
    watch(
        [
            () => categories.value,
            () => tasks.value,
            () => activeCategoryId.value,
            () => currentView.value,
            () => showTaskWidget.value,
            () => enableNotification.value,
            () => notificationMinutes.value
        ],
        () => {
            saveToLocalStorage();
        },
        { deep: true }
    );

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
    const addTask = (categoryId: string, title: string, priority: 'normal' | 'star' | 'thunder' = 'normal', scheduledAt?: string) => {
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
            createdAt: new Date().toISOString(),
            status: 'todo',
            scheduledAt
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
            task.status = task.completed ? 'done' : 'todo';
            if (task.completed) {
                task.endedAt = new Date().toISOString();
            } else {
                task.endedAt = undefined;
            }
            // 親タスクが完了になった場合、配下のサブタスクをすべて完了（done）にする。
            // 未完了になった場合は、配下のサブタスクをすべて未完了（todo）にする。
            task.steps.forEach(step => {
                step.completed = task.completed;
                step.status = task.completed ? 'done' : 'todo';
            });
        }
    };

    const startTask = (id: string) => {
        console.log('startTask called for:', id);
        const task = tasks.value.find(t => t.id === id);
        if (task) {
            task.status = 'doing';
            task.startedAt = new Date().toISOString();
            task.completed = false;
            tasks.value = [...tasks.value];
        }
    };

    const pauseTask = (id: string) => {
        const task = tasks.value.find(t => t.id === id);
        if (task) {
            task.status = 'paused';
            tasks.value = [...tasks.value];
        }
    };

    const resumeTask = (id: string) => {
        const task = tasks.value.find(t => t.id === id);
        if (task) {
            task.status = 'doing';
            tasks.value = [...tasks.value];
        }
    };

    const completeTask = (id: string) => {
        console.log('completeTask called for:', id);
        const task = tasks.value.find(t => t.id === id);
        if (task) {
            task.status = 'done';
            task.completed = true;
            task.endedAt = new Date().toISOString();
            task.steps.forEach(step => {
                step.completed = true;
                step.status = 'done';
            });
            tasks.value = [...tasks.value];
        }
    };
    const resetTask = (id: string) => {
        console.log('resetTask called for:', id);
        const task = tasks.value.find(t => t.id === id);
        if (task) {
            task.status = 'todo';
            task.completed = false;
            task.startedAt = undefined;
            task.endedAt = undefined;
            // Reset subtask statuses as well
            task.steps.forEach(step => {
                step.completed = false;
                step.status = 'todo';
            });
            tasks.value = [...tasks.value];
        }
    };
    const convertToSubTask = (sourceTaskId: string, targetTaskId: string) => {
        const sourceTask = tasks.value.find(t => t.id === sourceTaskId);
        const targetTask = tasks.value.find(t => t.id === targetTaskId);
        if (!sourceTask || !targetTask) return false;
        
        // 制限：ドラッグ元が既にサブタスクを持っている場合はネスト不可
        if (sourceTask.steps && sourceTask.steps.length > 0) return false;

        const newStep: SubTask = {
            id: 'step_' + Math.random().toString(36).substring(2, 11),
            title: sourceTask.title,
            completed: sourceTask.completed,
            status: sourceTask.status === 'done' ? 'done' : (sourceTask.status === 'doing' ? 'doing' : 'todo')
        };
        targetTask.steps.push(newStep);
        recalculateTaskCompletion(targetTask);
        
        tasks.value = tasks.value.filter(t => t.id !== sourceTaskId);
        return true;
    };

    const promoteSubTaskToParent = (parentTaskId: string, subTaskId: string) => {
        const parentTask = tasks.value.find(t => t.id === parentTaskId);
        if (!parentTask) return;
        
        const stepIdx = parentTask.steps.findIndex(s => s.id === subTaskId);
        if (stepIdx === -1) return;
        
        const [step] = parentTask.steps.splice(stepIdx, 1);
        
        // 親タスクの完了状態を再計算
        recalculateTaskCompletion(parentTask);
        
        // 親タスク（Quest）として新規追加
        const id = 'task_' + Math.random().toString(36).substring(2, 11);
        const order = parentTask.order + 1;
        
        // 既存の他のタスクのorderをずらす
        tasks.value.forEach(t => {
            if (t.categoryId === parentTask.categoryId && t.order >= order) {
                t.order += 1;
            }
        });

        tasks.value.push({
            id,
            categoryId: parentTask.categoryId,
            title: step.title,
            completed: step.completed,
            priority: 'normal',
            steps: [],
            expanded: false,
            order,
            createdAt: new Date().toISOString(),
            status: step.status === 'done' ? 'done' : (step.status === 'doing' ? 'doing' : 'todo')
        });

        tasks.value = [...tasks.value];
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

    const updateSubTask = (taskId: string, subTaskId: string, updates: Partial<SubTask>) => {
        const task = tasks.value.find(t => t.id === taskId);
        if (task) {
            const step = task.steps.find(s => s.id === subTaskId);
            if (step) {
                Object.assign(step, updates);
            }
        }
    };

    // サブタスク状態から親タスクの完了を再計算
    const recalculateTaskCompletion = (task: Task) => {
        if (task.steps.length === 0) return;
        const allCompleted = task.steps.every(s => s.completed);
        task.completed = allCompleted;
    };

    // 他のウィンドウによる localStorage の変更を検知して自動で同期する
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
            if (
                e.key === 'desktop-mascot-tasks' || 
                e.key === 'desktop-mascot-categories' || 
                e.key === 'desktop-mascot-active-category' ||
                e.key === 'desktop-mascot-show-task-widget' ||
                e.key === 'desktop-mascot-enable-notification' ||
                e.key === 'desktop-mascot-notification-minutes'
            ) {
                console.log('[TaskStore] Detected storage change from another window, reloading...');
                isLoaded.value = false;
                loadFromLocalStorage();
            }
        });
    }

    return {
        categories,
        tasks,
        activeCategoryId,
        currentView,
        showTaskWidget,
        enableNotification,
        notificationMinutes,
        isLoaded,
        filteredTasks,
        timelineTasks,
        activeCategoryCompletionRate,
        loadFromLocalStorage,
        saveToLocalStorage,
        addCategory,
        updateCategory,
        deleteCategory,
        updateCategoriesOrder,
        addTask,
        updateTask,
        deleteTask,
        toggleTask,
        startTask,
        pauseTask,
        resumeTask,
        completeTask,
        resetTask,
        convertToSubTask,
        promoteSubTaskToParent,
        updateTasksOrder,
        addSubTask,
        deleteSubTask,
        toggleSubTask,
        updateSubTaskStatus,
        updateSubTask
    };
});
