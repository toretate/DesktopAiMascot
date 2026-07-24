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
    status: 'todo' | 'doing' | 'paused' | 'done';
    scheduledAt?: string;
    scheduledEndAt?: string;
    memo?: string;
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
    scheduledEndAt?: string;
    notified?: boolean;
    memo?: string;
}

export const MEETING_CATEGORY_ID = 'meeting';

export const useTaskStore = defineStore('task', () => {
    // 状態管理
    const categories = ref<Category[]>([]);
    const tasks = ref<Task[]>([]);
    const activeCategoryId = ref<string>('default');
    const currentView = ref<'todo' | 'timeline' | 'completed'>('todo');
    const showTaskWidget = ref<boolean>(false);
    const enableNotification = ref<boolean>(true);
    const notificationMinutes = ref<number>(5);
    // TODOでDONEにしてから実際に完了(COMPへ移動)するまでの猶予秒数
    const completionGraceSeconds = ref<number>(5);
    // タスク詳細で所要時間を新規設定するときの既定値
    const defaultDurationHours = ref<number>(1);
    const muteNotificationsDuringMeetings = ref<boolean>(false);
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
            if (savedView === 'todo' || savedView === 'timeline' || savedView === 'completed') {
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
            const savedGrace = localStorage.getItem('desktop-mascot-completion-grace-seconds');
            if (savedGrace !== null) {
                const g = parseInt(savedGrace, 10);
                completionGraceSeconds.value = isNaN(g) || g < 0 ? 5 : g;
            }
            const savedDefaultDuration = localStorage.getItem('desktop-mascot-default-duration-hours');
            if (savedDefaultDuration !== null) {
                const duration = Number(savedDefaultDuration);
                defaultDurationHours.value = Number.isFinite(duration) && duration > 0 ? duration : 1;
            }
            const savedMuteDuringMeetings = localStorage.getItem('desktop-mascot-mute-during-meetings');
            if (savedMuteDuringMeetings !== null) {
                muteNotificationsDuringMeetings.value = savedMuteDuringMeetings === 'true';
            }
        } catch (error) {
            console.warn('LocalStorageからの初期タスク読み込みエラー:', error);
        }

        // 2. 次にサーバー（API）から最新データをロードする
        let recoveredFromLocal = false;
        let addedMeetingCategory = false;
        let migratedScheduledTimes = false;
        try {
            const res = await fetch('/api/tasks', { credentials: 'include' });
            if (res.ok) {
                const resJson = await res.json();
                if (resJson.success) {
                    // データ消失防止:
                    // このアプリは変更のたびにローカルとサーバーへ同時保存するため、
                    // 「ローカルに存在するのにサーバーが空」= サーバー側の欠落/破損とみなし、ローカルを優先する。
                    // （サーバーが空を返した瞬間にローカルを空で上書き→初期化→空を保存、という消失連鎖を防ぐ）
                    const serverCategories = Array.isArray(resJson.categories) ? resJson.categories : [];
                    const serverTasks = Array.isArray(resJson.tasks) ? resJson.tasks : [];

                    if (serverTasks.length > 0 || tasks.value.length === 0) {
                        tasks.value = serverTasks;
                    } else {
                        recoveredFromLocal = true;
                        console.warn('[TaskStore] サーバーのタスクが空のため、ローカルの既存データを保持しました（データ消失防止）。');
                    }

                    if (serverCategories.length > 0 || categories.value.length === 0) {
                        categories.value = serverCategories;
                    } else {
                        recoveredFromLocal = true;
                    }

                    if (resJson.enableNotification !== undefined) {
                        enableNotification.value = resJson.enableNotification;
                    }
                    if (resJson.notificationMinutes !== undefined) {
                        notificationMinutes.value = resJson.notificationMinutes;
                    }
                    if (resJson.completionGraceSeconds !== undefined) {
                        completionGraceSeconds.value = resJson.completionGraceSeconds;
                    }
                    if (resJson.defaultDurationHours !== undefined) {
                        const duration = Number(resJson.defaultDurationHours);
                        defaultDurationHours.value = Number.isFinite(duration) && duration > 0 ? duration : 1;
                    }
                    if (resJson.muteNotificationsDuringMeetings !== undefined) {
                        muteNotificationsDuringMeetings.value = !!resJson.muteNotificationsDuringMeetings;
                    }
                    // 同期のために LocalStorage にも書き込んでおく
                    localStorage.setItem('desktop-mascot-categories', JSON.stringify(categories.value));
                    localStorage.setItem('desktop-mascot-tasks', JSON.stringify(tasks.value));
                    localStorage.setItem('desktop-mascot-enable-notification', String(enableNotification.value));
                    localStorage.setItem('desktop-mascot-notification-minutes', String(notificationMinutes.value));
                    localStorage.setItem('desktop-mascot-completion-grace-seconds', String(completionGraceSeconds.value));
                    localStorage.setItem('desktop-mascot-default-duration-hours', String(defaultDurationHours.value));
                    localStorage.setItem('desktop-mascot-mute-during-meetings', String(muteNotificationsDuringMeetings.value));
                }
            } else if (tasks.value.length > 0) {
                // サーバーがエラー（tasks.json 破損時の 500 など）を返した場合もローカルを保持し、修復を試みる
                recoveredFromLocal = true;
                console.warn('[TaskStore] サーバー応答が異常のため、ローカルデータを保持し修復します。');
            }
        } catch (error) {
            console.warn('サーバーからのタスクロードに失敗しました (LocalStorageを使用します):', error);
        } finally {
            // デフォルトカテゴリの初期化
            if (categories.value.length === 0) {
                categories.value = [
                    { id: 'default', name: 'Work', order: 0 },
                    { id: 'private', name: 'Private', order: 1 },
                    { id: MEETING_CATEGORY_ID, name: '会議', order: 2 }
                ];
            }
            const meetingCategory = categories.value.find(category => category.id === MEETING_CATEGORY_ID);
            if (meetingCategory) {
                meetingCategory.name = '会議';
            } else {
                categories.value.push({
                    id: MEETING_CATEGORY_ID,
                    name: '会議',
                    order: categories.value.length
                });
                addedMeetingCategory = true;
            }
            // 旧詳細画面で予定日時が実績フィールドへ保存された未着手タスクを移行する。
            tasks.value.forEach(task => {
                const isUnstartedTask = !task.completed && (task.status === 'todo' || !task.status);
                if (isUnstartedTask && task.startedAt && task.endedAt && !task.scheduledEndAt) {
                    task.scheduledAt = task.scheduledAt || task.startedAt;
                    task.scheduledEndAt = task.endedAt;
                    task.startedAt = undefined;
                    task.endedAt = undefined;
                    migratedScheduledTimes = true;
                }

                if (task.categoryId === MEETING_CATEGORY_ID && task.scheduledAt && !task.scheduledEndAt) {
                    const startTime = new Date(task.scheduledAt).getTime();
                    if (Number.isFinite(startTime)) {
                        task.scheduledEndAt = new Date(
                            startTime + defaultDurationHours.value * 3_600_000
                        ).toISOString();
                        migratedScheduledTimes = true;
                    }
                }
            });
            if (!activeCategoryId.value && categories.value.length > 0) {
                activeCategoryId.value = categories.value[0].id;
            }
            isLoaded.value = true;
            // サーバー側が空/欠落でローカルを復旧した場合、正しいデータをサーバーへ書き戻して修復する
            if (recoveredFromLocal || addedMeetingCategory || migratedScheduledTimes) {
                saveToLocalStorage();
            }
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
            localStorage.setItem('desktop-mascot-default-duration-hours', String(defaultDurationHours.value));
            localStorage.setItem('desktop-mascot-mute-during-meetings', String(muteNotificationsDuringMeetings.value));

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
                    notificationMinutes: notificationMinutes.value,
                    completionGraceSeconds: completionGraceSeconds.value,
                    defaultDurationHours: defaultDurationHours.value,
                    muteNotificationsDuringMeetings: muteNotificationsDuringMeetings.value
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
            () => notificationMinutes.value,
            () => completionGraceSeconds.value,
            () => defaultDurationHours.value,
            () => muteNotificationsDuringMeetings.value
        ],
        () => {
            saveToLocalStorage();
        },
        { deep: true }
    );

    // ゲッター：アクティブなカテゴリに属する未完了タスクを順序順に取得
    // （完了済みタスクは COMP ビューにのみ表示するため TODO からは除外する）
    const filteredTasks = computed(() => {
        return tasks.value
            .filter(t => (activeCategoryId.value === 'all' || t.categoryId === activeCategoryId.value) && !(t.completed || t.status === 'done'))
            .sort((a, b) => a.order - b.order);
    });

    // ゲッター：予定時刻順のタスクリスト（タイムライン用）
    // DOM上は上から下へ「未来 → 現在 → 過去(期限切れ)」の順に並べ、
    // 表示側で下詰めにすることで現在時刻の近いものが下部に集まるようにする。
    const timelineTasks = computed(() => {
        const activeTasks = tasks.value.filter(t => !(t.completed || t.status === 'done'));
        const scheduled = activeTasks.filter(t => t.scheduledAt);
        const unscheduled = activeTasks.filter(t => !t.scheduledAt);
        // 予定ありは予定時刻の降順（未来ほど上・過去ほど下）
        scheduled.sort((a, b) => new Date(b.scheduledAt!).getTime() - new Date(a.scheduledAt!).getTime());
        // 予定なしは期限の概念がないため、作成日時の降順で最上部にまとめる
        unscheduled.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return [...unscheduled, ...scheduled];
    });

    // ゲッター：完了済みタスクのリスト（COMPビュー用・全カテゴリ横断、完了日時の新しい順）
    const completedTasks = computed(() => {
        return tasks.value
            .filter(t => t.completed || t.status === 'done')
            .sort((a, b) => {
                const at = new Date(a.endedAt || a.createdAt).getTime();
                const bt = new Date(b.endedAt || b.createdAt).getTime();
                return bt - at;
            });
    });

    // ゲッター：完了済みタスクを完了日ごとにグループ化（COMPビュー用・日付降順）
    const completedTasksByDate = computed(() => {
        const groups: Record<string, { key: string; label: string; tasks: Task[] }> = {};
        for (const t of completedTasks.value) {
            const d = new Date(t.endedAt || t.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!groups[key]) {
                groups[key] = { key, label: `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`, tasks: [] };
            }
            groups[key].tasks.push(t);
        }
        return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
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
        if (id === MEETING_CATEGORY_ID) return;
        const cat = categories.value.find(c => c.id === id);
        if (cat) {
            cat.name = name;
        }
    };

    const deleteCategory = (id: string) => {
        if (id === MEETING_CATEGORY_ID) return;
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
    const addTask = (
        categoryId: string,
        title: string,
        priority: 'normal' | 'star' | 'thunder' = 'normal',
        scheduledAt?: string,
        specifiedScheduledEndAt?: string
    ) => {
        const id = 'task_' + Math.random().toString(36).substring(2, 11);
        let targetCategoryId = categoryId;
        if (categoryId === 'all') {
            targetCategoryId = categories.value[0]?.id || 'default';
        }
        const order = tasks.value.filter(t => t.categoryId === targetCategoryId).length;
        const scheduledEndAt = specifiedScheduledEndAt || (
            targetCategoryId === MEETING_CATEGORY_ID && scheduledAt
                ? new Date(new Date(scheduledAt).getTime() + defaultDurationHours.value * 3_600_000).toISOString()
                : undefined
        );
        tasks.value.push({
            id,
            categoryId: targetCategoryId,
            title,
            completed: false,
            priority,
            steps: [],
            expanded: false,
            order,
            createdAt: new Date().toISOString(),
            status: 'todo',
            scheduledAt,
            scheduledEndAt
        });
    };

    const addTaskFromServer = (task: Task, updatedCategories?: Category[]) => {
        if (updatedCategories) {
            categories.value = updatedCategories;
        }
        const exists = tasks.value.some(t => t.id === task.id);
        if (!exists) {
            tasks.value.push(task);
        } else {
            const idx = tasks.value.findIndex(t => t.id === task.id);
            if (idx !== -1) {
                tasks.value[idx] = task;
            }
        }
    };

    const updateTask = (id: string, updates: Partial<Task>) => {
        const task = tasks.value.find(t => t.id === id);
        if (task) {
            const hasScheduledAtUpdate = Object.prototype.hasOwnProperty.call(updates, 'scheduledAt');
            const hasScheduledEndAtUpdate = Object.prototype.hasOwnProperty.call(updates, 'scheduledEndAt');
            if (hasScheduledAtUpdate && updates.scheduledAt !== task.scheduledAt) {
                task.notified = false;
                if (!hasScheduledEndAtUpdate) {
                    const oldStartTime = task.scheduledAt ? new Date(task.scheduledAt).getTime() : Number.NaN;
                    const oldEndTime = task.scheduledEndAt ? new Date(task.scheduledEndAt).getTime() : Number.NaN;
                    const newStartTime = updates.scheduledAt ? new Date(updates.scheduledAt).getTime() : Number.NaN;

                    if (Number.isFinite(newStartTime) && Number.isFinite(oldStartTime) && Number.isFinite(oldEndTime)) {
                        task.scheduledEndAt = new Date(newStartTime + oldEndTime - oldStartTime).toISOString();
                    } else if (Number.isFinite(newStartTime) && task.categoryId === MEETING_CATEGORY_ID) {
                        task.scheduledEndAt = new Date(
                            newStartTime + defaultDurationHours.value * 3_600_000
                        ).toISOString();
                    } else if (!updates.scheduledAt) {
                        task.scheduledEndAt = undefined;
                    }
                }
            }
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
            status: sourceTask.status === 'done'
                ? 'done'
                : (sourceTask.status === 'doing' || sourceTask.status === 'paused' ? sourceTask.status : 'todo'),
            scheduledAt: sourceTask.scheduledAt,
            scheduledEndAt: sourceTask.scheduledEndAt,
            memo: sourceTask.memo
        };
        targetTask.steps.push(newStep);
        targetTask.expanded = true;
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
            status: step.status,
            scheduledAt: step.scheduledAt,
            scheduledEndAt: step.scheduledEndAt,
            memo: step.memo
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
            task.expanded = true;
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

    const updateSubTaskStatus = (taskId: string, subTaskId: string, status: SubTask['status']) => {
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

    const pauseSubTask = (taskId: string, subTaskId: string) => {
        updateSubTaskStatus(taskId, subTaskId, 'paused');
    };

    const resumeSubTask = (taskId: string, subTaskId: string) => {
        updateSubTaskStatus(taskId, subTaskId, 'doing');
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

    const reorderSubTask = (
        taskId: string,
        subTaskId: string,
        targetSubTaskId: string,
        placeAfter: boolean
    ) => {
        const task = tasks.value.find(t => t.id === taskId);
        if (!task || subTaskId === targetSubTaskId) return;

        const sourceIndex = task.steps.findIndex(step => step.id === subTaskId);
        if (sourceIndex < 0) return;

        const reorderedSteps = [...task.steps];
        const [movedStep] = reorderedSteps.splice(sourceIndex, 1);
        const targetIndex = reorderedSteps.findIndex(step => step.id === targetSubTaskId);
        if (targetIndex < 0) return;

        reorderedSteps.splice(targetIndex + (placeAfter ? 1 : 0), 0, movedStep);
        task.steps = reorderedSteps;
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
                e.key === 'desktop-mascot-notification-minutes' ||
                e.key === 'desktop-mascot-default-duration-hours' ||
                e.key === 'desktop-mascot-mute-during-meetings'
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
        completionGraceSeconds,
        defaultDurationHours,
        muteNotificationsDuringMeetings,
        isLoaded,
        filteredTasks,
        timelineTasks,
        completedTasks,
        completedTasksByDate,
        activeCategoryCompletionRate,
        loadFromLocalStorage,
        saveToLocalStorage,
        addCategory,
        updateCategory,
        deleteCategory,
        updateCategoriesOrder,
        addTask,
        addTaskFromServer,
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
        pauseSubTask,
        resumeSubTask,
        updateSubTask,
        reorderSubTask
    };
});
