<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import { useDraggable } from 'vue-draggable-plus';
import { useTaskStore, Task, SubTask } from '../store/task';
import { useConfigStore } from '../store/config';
import { storeToRefs } from 'pinia';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import SelectButton from 'primevue/selectbutton';
import Slider from 'primevue/slider';
import DatePicker from 'primevue/datepicker';

const taskStore = useTaskStore();
const configStore = useConfigStore();
const { windowMode } = storeToRefs(configStore);

// 自動フォーカス用ディレクティブ
const vFocus = {
    mounted: (el: HTMLElement) => el.focus()
};

// 表示制御
const showCategorySettings = ref(false); // インライン設定パネル表示トグル
const newTaskTitle = ref('');
const newTaskScheduledAt = ref<string | undefined>(undefined);
const newSubTaskTitleMap = ref<Record<string, string>>({});

// vue-draggable-plus用
const localTasks = ref<Task[]>([...taskStore.filteredTasks]);
const draggedNestTaskId = ref<string | null>(null);
const draggedSubTask = ref<{ parentId: string; subTaskId: string } | null>(null);
const dragStartX = ref<number>(0);
const isNesting = ref(false);
const parentRef = ref<HTMLElement | null>(null);

watch(() => taskStore.filteredTasks, (newTasks) => {
    if (!draggedNestTaskId.value && !draggedSubTask.value) {
        localTasks.value = [...newTasks];
    }
}, { deep: true });

const activeDropTargetTaskId = ref<string | null>(null);

const canNest = (targetTask: Task) => {
    if (!draggedNestTaskId.value) return false;
    if (targetTask.id === draggedNestTaskId.value) return false;
    const sourceTask = localTasks.value.find(t => t.id === draggedNestTaskId.value);
    if (!sourceTask) return false;
    if (sourceTask.steps && sourceTask.steps.length > 0) return false;
    return true;
};

const onParentDragOver = (event: DragEvent, taskId: string) => {
    if (draggedNestTaskId.value && isNesting.value) {
        const targetTask = localTasks.value.find(t => t.id === taskId);
        if (targetTask && canNest(targetTask)) {
            activeDropTargetTaskId.value = taskId;
        }
    }
};



useDraggable(parentRef, localTasks, {
    animation: 150,
    handle: '.drag-handle',
    onStart(evt) {
        if (evt.originalEvent) {
            dragStartX.value = evt.originalEvent.clientX;
        }
        draggedNestTaskId.value = localTasks.value[evt.oldIndex!].id;
    },
    onMove(evt, originalEvent) {
        if (originalEvent) {
            const deltaX = originalEvent.clientX - dragStartX.value;
            const threshold = 24; // 2文字分 (24px)
            if (deltaX >= threshold) {
                isNesting.value = true;
                return false; // 並び替えをキャンセル
            }
        }
        isNesting.value = false;
        activeDropTargetTaskId.value = null;
    },
    onEnd(evt) {
        // 並び替え完了時の同期
        taskStore.updateTasksOrder(localTasks.value);

        // ネスト化の処理
        if (isNesting.value && draggedNestTaskId.value && activeDropTargetTaskId.value) {
            taskStore.convertToSubTask(draggedNestTaskId.value, activeDropTargetTaskId.value);
        }

        // 状態クリア
        draggedNestTaskId.value = null;
        dragStartX.value = 0;
        isNesting.value = false;
        activeDropTargetTaskId.value = null;
    }
});

// インプレース編集用ステート
const editingTaskId = ref<string | null>(null);
const editingSubTaskId = ref<string | null>(null);
const activeCalendarTaskId = ref<string | null>(null);

// カレンダー・クロックピッカー用ステート
const calendarYear = ref(new Date().getFullYear());
const calendarMonth = ref(new Date().getMonth());
const selectedDate = ref<number | null>(null);
const timeStep = ref<'date' | 'hour' | 'minute'>('date');
const selectedHour = ref<number>(12);
const selectedMinute = ref<number>(0);

const daysInMonth = computed(() => {
    const year = calendarYear.value;
    const month = calendarMonth.value;
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
        days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
        days.push(d);
    }
    return days;
});

const prevMonth = () => {
    if (calendarMonth.value === 0) {
        calendarMonth.value = 11;
        calendarYear.value -= 1;
    } else {
        calendarMonth.value -= 1;
    }
};

const nextMonth = () => {
    if (calendarMonth.value === 11) {
        calendarMonth.value = 0;
        calendarYear.value += 1;
    } else {
        calendarMonth.value += 1;
    }
};

const openCalendarPanel = (task: Task) => {
    activeCalendarTaskId.value = task.id;
    timeStep.value = 'date';
    const initialDate = task.scheduledAt ? new Date(task.scheduledAt) : new Date();
    calendarYear.value = initialDate.getFullYear();
    calendarMonth.value = initialDate.getMonth();
    selectedDate.value = initialDate.getDate();
    selectedHour.value = initialDate.getHours();
    selectedMinute.value = Math.round(initialDate.getMinutes() / 5) * 5 % 60;
};

const selectDate = (day: number) => {
    selectedDate.value = day;
    timeStep.value = 'hour';
};

const selectHour = (hour: number) => {
    selectedHour.value = hour;
    timeStep.value = 'minute';
};

const selectMinute = (minute: number) => {
    selectedMinute.value = minute;
    saveScheduledDateTime();
};

const saveScheduledDateTime = () => {
    if (activeCalendarTaskId.value && selectedDate.value !== null) {
        const date = new Date(
            calendarYear.value,
            calendarMonth.value,
            selectedDate.value,
            selectedHour.value,
            selectedMinute.value
        );
        taskStore.updateTask(activeCalendarTaskId.value, { scheduledAt: date.toISOString() });
    }
    activeCalendarTaskId.value = null;
};
const editingTitle = ref('');

// 新規カテゴリ名
const newCategoryName = ref('');

// ドラッグ＆ドロップ用ステート (リスト内並び替え用)
const draggedTaskId = ref<string | null>(null);

// 統合モード用ドラッグ座標
const posX = ref(window.innerWidth - 400); // 画面右寄りに配置
const posY = ref(80);
const isLocalDragging = ref(false);
let localDragStartX = 0;
let localDragStartY = 0;

// ウィジェットのサイズ (統合・分離リサイズ用)
const width = ref(340);
const height = ref(480);
let isResizing = false;
let resizeDirection = '';
let startWidth = 0;
let startHeight = 0;
let startMouseX = 0;
let startMouseY = 0;

const initResize = (e: MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing = true;
    resizeDirection = direction;
    startWidth = width.value;
    startHeight = height.value;
    startMouseX = e.clientX;
    startMouseY = e.clientY;

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', stopResize);
};

const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    let newWidth = startWidth;
    let newHeight = startHeight;

    if (resizeDirection === 'right' || resizeDirection === 'corner') {
        newWidth = Math.max(300, startWidth + dx);
    }
    if (resizeDirection === 'bottom' || resizeDirection === 'corner') {
        newHeight = Math.max(350, startHeight + dy);
    }

    width.value = newWidth;
    height.value = newHeight;

    // 分離モード時はElectronウィンドウサイズを変更
    if (windowMode.value !== 'integrated' && windowMode.value !== 'compact') {
        if (window.electronAPI && window.electronAPI.resizeWindow) {
            window.electronAPI.resizeWindow({ width: newWidth, height: newHeight });
        }
    }
};

const stopResize = () => {
    isResizing = false;
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', stopResize);
};

// 閉じるアクション
const closeWidget = () => {
    taskStore.showTaskWidget = false;
    if (windowMode.value !== 'integrated' && windowMode.value !== 'compact') {
        if (window.electronAPI && window.electronAPI.toggleTasks) {
            window.electronAPI.toggleTasks();
        }
    }
};

// Electron用ウィンドウドラッグ状態
let isElectronDragging = false;
let electronDragStartX = 0;
let electronDragStartY = 0;

// ドラッグ開始ハンドラ
const startWidgetDrag = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // ボタンや入力欄、チェックボックス、進捗バー等ではドラッグ移動を開始しない
    if (
        e.button !== 0 || 
        target.closest('button') || 
        target.closest('input') || 
        target.closest('.category-tabs') || 
        target.closest('.completion-progress') ||
        target.closest('.view-selector') ||
        target.closest('.resize-handle')
    ) return;
    
    e.preventDefault();
    
    if (windowMode.value === 'integrated') {
        isLocalDragging.value = true;
        localDragStartX = e.clientX - posX.value;
        localDragStartY = e.clientY - posY.value;
        
        window.addEventListener('mousemove', onLocalMouseMove);
        window.addEventListener('mouseup', onLocalMouseUp);
    } else {
        if (window.electronAPI && window.electronAPI.dragWindow) {
            isElectronDragging = true;
            electronDragStartX = e.screenX;
            electronDragStartY = e.screenY;
            window.electronAPI.dragWindow({ dx: 0, dy: 0, isStart: true });
            
            window.addEventListener('mousemove', onElectronMouseMove);
            window.addEventListener('mouseup', onElectronMouseUp);
        }
    }
};

const onLocalMouseMove = (e: MouseEvent) => {
    if (!isLocalDragging.value) return;
    // 画面外への完全な消失を防ぐ境界制限
    const x = e.clientX - localDragStartX;
    const y = e.clientY - localDragStartY;
    posX.value = Math.max(10, Math.min(window.innerWidth - width.value - 10, x));
    posY.value = Math.max(10, Math.min(window.innerHeight - height.value - 10, y));
};

const onLocalMouseUp = () => {
    isLocalDragging.value = false;
    window.removeEventListener('mousemove', onLocalMouseMove);
    window.removeEventListener('mouseup', onLocalMouseUp);
    
    // ウィジェット位置の保存
    localStorage.setItem('task_widget_pos_x', posX.value.toString());
    localStorage.setItem('task_widget_pos_y', posY.value.toString());
};

const onElectronMouseMove = (e: MouseEvent) => {
    if (!isElectronDragging) return;
    if (e.buttons !== 1) {
        onElectronMouseUp();
        return;
    }
    const dx = e.screenX - electronDragStartX;
    const dy = e.screenY - electronDragStartY;
    
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        if (window.electronAPI && window.electronAPI.dragWindow) {
            window.electronAPI.dragWindow({ dx, dy });
        }
        electronDragStartX = e.screenX;
        electronDragStartY = e.screenY;
    }
};

const onElectronMouseUp = () => {
    if (!isElectronDragging) return;
    isElectronDragging = false;
    window.removeEventListener('mousemove', onElectronMouseMove);
    window.removeEventListener('mouseup', onElectronMouseUp);
    if (window.electronAPI && window.electronAPI.dragWindow) {
        window.electronAPI.dragWindow({ dx: 0, dy: 0, isEnd: true });
    }
};

// 統合モードと分離モードに応じたスタイルの計算
const widgetStyle = computed(() => {
    const opacityValue = configStore.taskOpacity !== undefined ? configStore.taskOpacity : 1.0;
    if (windowMode.value === 'integrated') {
        return {
            position: 'absolute' as const,
            left: `${posX.value}px`,
            top: `${posY.value}px`,
            width: `${width.value}px`,
            height: `${height.value}px`,
            opacity: opacityValue,
            zIndex: 100
        };
    }
    return {
        width: '100%',
        height: '100%',
        opacity: opacityValue
    };
});

// 初期データロード
onMounted(() => {
    taskStore.loadFromLocalStorage();

    // ウィジェット位置の復元
    const savedX = localStorage.getItem('task_widget_pos_x');
    const savedY = localStorage.getItem('task_widget_pos_y');
    if (savedX !== null) posX.value = parseInt(savedX, 10);
    if (savedY !== null) posY.value = parseInt(savedY, 10);

    // 現在時刻を30秒ごとに更新（タイムラインの期限切れ表示を追従させる）
    nowTimer = setInterval(() => { nowTs.value = Date.now(); }, 30000);
});

onUnmounted(() => {
    if (nowTimer) {
        clearInterval(nowTimer);
        nowTimer = null;
    }
    // 猶予タイマーの後始末
    Object.keys(pendingTimers).forEach(id => clearPendingTimers(id));
    Object.keys(pendingIntervals).forEach(id => clearPendingTimers(id));
});

// インプレース編集メソッド
let pressTimer: any = null;
const handlePressStart = (type: 'task' | 'subtask', item: any, parentId?: string) => {
    pressTimer = setTimeout(() => {
        if (type === 'task') {
            startEditTask(item);
        } else {
            startEditSubTask(parentId!, item);
        }
    }, 700);
};

const handlePressEnd = () => {
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
};

const startEditTask = (task: Task) => {
    editingTaskId.value = task.id;
    editingSubTaskId.value = null;
    editingTitle.value = task.title;
};

const startEditSubTask = (taskId: string, subTask: SubTask) => {
    editingTaskId.value = taskId;
    editingSubTaskId.value = subTask.id;
    editingTitle.value = subTask.title;
};

const saveTitleEdit = () => {
    if (!editingTaskId.value) return;
    const title = editingTitle.value.trim();
    if (title) {
        if (editingSubTaskId.value) {
            taskStore.updateSubTask(editingTaskId.value, editingSubTaskId.value, { title });
        } else {
            taskStore.updateTask(editingTaskId.value, { title });
        }
    }
    cancelTitleEdit();
};

const cancelTitleEdit = () => {
    editingTaskId.value = null;
    editingSubTaskId.value = null;
    editingTitle.value = '';
};

// カテゴリ編集インラインメソッド
const handleAddCategory = () => {
    const name = newCategoryName.value.trim();
    if (!name) return;
    taskStore.addCategory(name);
    newCategoryName.value = '';
};

const handleDeleteCategory = (id: string) => {
    if (confirm('このカテゴリを削除しますか？配下のタスクもすべて削除されます。')) {
        taskStore.deleteCategory(id);
    }
};

const moveUp = (index: number) => {
    if (index === 0) return;
    const cats = [...taskStore.categories];
    const temp = cats[index];
    cats[index] = cats[index - 1];
    cats[index - 1] = temp;
    taskStore.updateCategoriesOrder(cats);
};

const moveDown = (index: number) => {
    if (index === taskStore.categories.length - 1) return;
    const cats = [...taskStore.categories];
    const temp = cats[index];
    cats[index] = cats[index + 1];
    cats[index + 1] = temp;
    taskStore.updateCategoriesOrder(cats);
};

const closeSettingsPanel = () => {
    showCategorySettings.value = false;
    configStore.saveConfig();
};

// ビュー切り替えオプション
const viewOptions = [
    { label: 'TODO', value: 'todo' },
    { label: 'TIMELINE', value: 'timeline' },
    { label: 'COMP', value: 'completed' }
];

// タスク追加
const handleAddTask = () => {
    const title = newTaskTitle.value.trim();
    if (!title) return;
    taskStore.addTask(taskStore.activeCategoryId, title, 'normal', newTaskScheduledAt.value);
    newTaskTitle.value = '';
    newTaskScheduledAt.value = undefined;
};

// サブタスク追加
const handleAddSubTask = (taskId: string) => {
    const title = (newSubTaskTitleMap.value[taskId] || '').trim();
    if (!title) return;
    taskStore.addSubTask(taskId, title);
    newSubTaskTitleMap.value[taskId] = '';
};

// 優先度の切り替えサイクル
const cyclePriority = (task: Task) => {
    const priorities: ('normal' | 'star' | 'thunder')[] = ['normal', 'star', 'thunder'];
    const currentIndex = priorities.indexOf(task.priority);
    const nextPriority = priorities[(currentIndex + 1) % priorities.length];
    taskStore.updateTask(task.id, { priority: nextPriority });
};

// サブタスクのステータス切り替えサイクル
const cycleSubTaskStatus = (task: Task, step: SubTask) => {
    const statuses: ('todo' | 'doing' | 'done')[] = ['todo', 'doing', 'done'];
    const currentIndex = statuses.indexOf(step.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    taskStore.updateSubTaskStatus(task.id, step.id, nextStatus);
};

// ドラッグハンドラ (HTML5 ネイティブドラッグ)
const onSortDragStart = (event: DragEvent, taskId: string) => {
    dragStartX.value = event.clientX;
    draggedNestTaskId.value = taskId;
};

const onParentDrop = (event: DragEvent, targetTaskId: string) => {
    // 1. サブタスク（子タスク）のドラッグの場合 (昇格)
    if (draggedSubTask.value) {
        const sub = draggedSubTask.value;
        draggedSubTask.value = null; // watchがブロックされるのを防ぐため先にクリア
        taskStore.promoteSubTaskToParent(sub.parentId, sub.subTaskId);
        localTasks.value = [...taskStore.filteredTasks]; // 強制同期
    }
};

const onSubTaskDragStart = (parentId: string, subTaskId: string) => {
    draggedSubTask.value = { parentId, subTaskId };
};

const onSubTaskDragEnd = () => {
    draggedSubTask.value = null;
};

const onContainerDrop = (event: DragEvent) => {
    if (draggedSubTask.value) {
        const sub = draggedSubTask.value;
        draggedSubTask.value = null; // watchがブロックされるのを防ぐため先にクリア
        taskStore.promoteSubTaskToParent(sub.parentId, sub.subTaskId);
        localTasks.value = [...taskStore.filteredTasks]; // 強制同期
    }
};

// 現在時刻（一定間隔で更新し、期限切れ判定をリアクティブに保つ）
const nowTs = ref(Date.now());
let nowTimer: any = null;
const showDeleteMode = ref(false);

// タスクが予定時刻を過ぎている（かつ未完了）か
const isOverdue = (task: Task) => {
    if (!task.scheduledAt || task.completed || task.status === 'done') return false;
    return new Date(task.scheduledAt).getTime() < nowTs.value;
};

// カテゴリ名の取得（タイムライン表示用）
const getCategoryName = (catId: string) => {
    const cat = taskStore.categories.find(c => c.id === catId);
    return cat ? cat.name : '未分類';
};

// 時間フォーマット（タイムライン表示用）
const formatTime = (isoString: string) => {
    try {
        const date = new Date(isoString);
        return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch {
        return '';
    }
};

const getScheduledDisplay = (scheduledAtIso: string) => {
    if (!scheduledAtIso) return '';
    const now = new Date();
    const scheduled = new Date(scheduledAtIso);
    const diffMs = scheduled.getTime() - now.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    // 過去の予定の場合のフォールバック
    if (diffMs < 0) {
        const absDiffMs = Math.abs(diffMs);
        const absDiffMin = Math.floor(absDiffMs / 60000);
        const absDiffHour = Math.floor(absDiffMs / 3600000);
        const absDiffDay = Math.floor(absDiffMs / 86400000);

        if (absDiffMin < 60) {
            return `${absDiffMin}分超過`;
        } else if (absDiffHour < 24) {
            return `${absDiffHour}時間超過`;
        } else {
            return `${absDiffDay}日超過`;
        }
    }

    // 1. 60分以内
    if (diffMin <= 60) {
        return `後${diffMin}分[${scheduled.getMinutes()}分]`;
    }

    // 2. 24時間以内
    if (diffHour <= 24) {
        return `後${diffHour}時[${scheduled.getHours()}時]`;
    }

    // 3. 6日以内
    if (diffDay <= 6) {
        if (diffDay === 1 || (scheduled.getDate() - now.getDate() === 1 && diffDay <= 1.5)) {
            return '明日';
        }
        return `後${diffDay}日[${scheduled.getDate()}日]`;
    }

    // 4. 同月の場合
    const isSameYear = now.getFullYear() === scheduled.getFullYear();
    const isSameMonth = isSameYear && now.getMonth() === scheduled.getMonth();
    if (isSameMonth) {
        return `${scheduled.getDate()}日`;
    }

    // 5. 別月の場合
    if (isSameYear) {
        return `${scheduled.getMonth() + 1}/${scheduled.getDate()}`;
    }

    // 6. 別年の場合
    const yy = String(scheduled.getFullYear()).slice(-2);
    return `${yy}/${scheduled.getMonth() + 1}/${scheduled.getDate()}`;
};

const formatScheduledDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } catch {
        return '';
    }
};

// --- DONE猶予（TODOでDONEにしてから実際に完了(COMPへ移動)するまでの遅延）---
const pendingComplete = ref<Record<string, number>>({}); // taskId -> 残り秒数
const pendingTimers: Record<string, any> = {};
const pendingIntervals: Record<string, any> = {};

const isPendingComplete = (task: Task) => pendingComplete.value[task.id] !== undefined;

const clearPendingTimers = (taskId: string) => {
    if (pendingTimers[taskId]) { clearTimeout(pendingTimers[taskId]); delete pendingTimers[taskId]; }
    if (pendingIntervals[taskId]) { clearInterval(pendingIntervals[taskId]); delete pendingIntervals[taskId]; }
    if (pendingComplete.value[taskId] !== undefined) {
        const m = { ...pendingComplete.value };
        delete m[taskId];
        pendingComplete.value = m;
    }
};

const startPendingComplete = (task: Task) => {
    const graceSec = taskStore.completionGraceSeconds ?? 5;
    // 猶予0秒なら即完了
    if (!graceSec || graceSec <= 0) {
        taskStore.completeTask(task.id);
        return;
    }
    clearPendingTimers(task.id);
    pendingComplete.value = { ...pendingComplete.value, [task.id]: graceSec };
    pendingIntervals[task.id] = setInterval(() => {
        const remaining = (pendingComplete.value[task.id] ?? 1) - 1;
        if (remaining > 0) {
            pendingComplete.value = { ...pendingComplete.value, [task.id]: remaining };
        }
    }, 1000);
    pendingTimers[task.id] = setTimeout(() => {
        clearPendingTimers(task.id);
        taskStore.completeTask(task.id);
    }, graceSec * 1000);
};

// 猶予中のクリックで取り消し、TODO状態へ戻す
const cancelPendingComplete = (task: Task) => {
    clearPendingTimers(task.id);
    taskStore.resetTask(task.id);
};

const cycleTaskStatus = (task: Task) => {
    // 猶予カウントダウン中のクリックは取り消し（TODOへ戻す）
    if (isPendingComplete(task)) {
        cancelPendingComplete(task);
        return;
    }
    if (task.completed || task.status === 'done') {
        taskStore.resetTask(task.id);
    } else if (task.status === 'todo' || !task.status) {
        taskStore.startTask(task.id);
    } else if (task.status === 'doing' || task.status === 'paused') {
        // 即完了せず、猶予期間を挟んでから完了させる
        startPendingComplete(task);
    }
};

const tempCalendarDate = ref<Date | null>(null);
const calendarStep = ref<'date' | 'time'>('date');
const clockMode = ref<'hour' | 'minute'>('hour');
const selectedHour24 = ref(12);
const selectedMinuteVal = ref(0);
const isDragging = ref(false);

const innerHourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const outerHourNumbers = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const minuteNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const openDatePicker = (taskId: string | 'new_task') => {
    activeCalendarTaskId.value = taskId;
    calendarStep.value = 'date';
    clockMode.value = 'hour';
    
    let scheduledAt: string | undefined = undefined;
    if (taskId === 'new_task') {
        scheduledAt = newTaskScheduledAt.value;
    } else {
        const task = taskStore.tasks.find(t => t.id === taskId);
        scheduledAt = task?.scheduledAt;
    }
    
    if (scheduledAt) {
        const d = new Date(scheduledAt);
        tempCalendarDate.value = d;
        selectedHour24.value = d.getHours();
        selectedMinuteVal.value = d.getMinutes();
    } else {
        const d = new Date();
        d.setMinutes(d.getMinutes() >= 30 ? 30 : 0);
        d.setSeconds(0);
        tempCalendarDate.value = d;
        selectedHour24.value = d.getHours();
        selectedMinuteVal.value = d.getMinutes();
    }
};

const onDateSelect = () => {
    calendarStep.value = 'time';
    clockMode.value = 'hour';
};

const getActiveCalendarTaskTitle = () => {
    if (!activeCalendarTaskId.value) return '';
    if (activeCalendarTaskId.value === 'new_task') {
        return newTaskTitle.value.trim() || '新規タスク';
    }
    const task = taskStore.tasks.find(t => t.id === activeCalendarTaskId.value);
    return task ? task.title : '';
};

const saveFullscreenCalendarDate = () => {
    if (activeCalendarTaskId.value && tempCalendarDate.value) {
        const targetDate = new Date(tempCalendarDate.value);
        targetDate.setHours(selectedHour24.value);
        targetDate.setMinutes(selectedMinuteVal.value);
        targetDate.setSeconds(0);
        
        if (activeCalendarTaskId.value === 'new_task') {
            newTaskScheduledAt.value = targetDate.toISOString();
        } else {
            taskStore.updateTask(activeCalendarTaskId.value, { scheduledAt: targetDate.toISOString() });
        }
    }
    activeCalendarTaskId.value = null;
};

const clearFullscreenCalendarDate = () => {
    if (activeCalendarTaskId.value) {
        if (activeCalendarTaskId.value === 'new_task') {
            newTaskScheduledAt.value = undefined;
        } else {
            taskStore.updateTask(activeCalendarTaskId.value, { scheduledAt: undefined });
        }
    }
    activeCalendarTaskId.value = null;
};

const getClockHandStyle = () => {
    let angle = 0;
    let length = 66;
    if (clockMode.value === 'hour') {
        const h = selectedHour24.value;
        const isInner = h >= 1 && h <= 12;
        length = isInner ? 42 : 66;
        angle = (h % 12) * 30;
    } else {
        angle = selectedMinuteVal.value * 6;
    }
    return {
        transform: `rotate(${angle}deg)`,
        height: `${length}px`,
        transition: isDragging.value ? 'none' : 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), height 0.2s cubic-bezier(0.25, 1, 0.5, 1)'
    };
};

const getClockNumberStyle = (idx: number, isInner: boolean) => {
    const angle = (idx * 30 - 90) * (Math.PI / 180);
    const radius = isInner ? 42 : 66;
    const x = Math.round(Math.cos(angle) * radius);
    const y = Math.round(Math.sin(angle) * radius);
    return {
        transform: `translate(${x}px, ${y}px)`
    };
};

const handleNumberSelect = (val: number) => {
    if (clockMode.value === 'hour') {
        selectedHour24.value = val;
        clockMode.value = 'minute';
    } else {
        selectedMinuteVal.value = val;
    }
};

const adjustTime = (amount: number) => {
    if (clockMode.value === 'hour') {
        let h = selectedHour24.value + amount;
        if (h > 23) h = 0;
        if (h < 0) h = 23;
        selectedHour24.value = h;
    } else {
        let m = selectedMinuteVal.value + amount;
        if (m >= 60) {
            selectedMinuteVal.value = 0;
            adjustTime(1);
        } else if (m < 0) {
            selectedMinuteVal.value = 59;
            adjustTime(-1);
        } else {
            selectedMinuteVal.value = m;
        }
    }
};

// クロック盤ドラッグ操作ハンドラ
const handleClockStart = (e: MouseEvent | TouchEvent) => {
    isDragging.value = true;
    handleClockMove(e);
    window.addEventListener('mousemove', handleClockMove);
    window.addEventListener('mouseup', handleClockEnd);
    window.addEventListener('touchmove', handleClockMove, { passive: false });
    window.addEventListener('touchend', handleClockEnd);
};

const handleClockMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging.value) return;
    const dial = document.querySelector('.clock-dial');
    if (!dial) return;
    
    const rect = dial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - cx;
    const dy = clientY - cy;
    
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = angle + 90;
    if (angle < 0) angle += 360;
    
    if (clockMode.value === 'hour') {
        const d = Math.sqrt(dx * dx + dy * dy);
        const isInner = d < 54;
        let hIdx = Math.round(angle / 30);
        if (hIdx === 12) hIdx = 0;
        
        if (isInner) {
            selectedHour24.value = hIdx === 0 ? 12 : hIdx;
        } else {
            selectedHour24.value = hIdx === 0 ? 0 : hIdx + 12;
        }
    } else {
        let m = Math.round(angle / 6);
        if (m === 60) m = 0;
        if (m > 59) m = 59;
        selectedMinuteVal.value = m;
    }
    
    if (e.cancelable) {
        e.preventDefault();
    }
};

const handleClockEnd = () => {
    if (!isDragging.value) return;
    isDragging.value = false;
    window.removeEventListener('mousemove', handleClockMove);
    window.removeEventListener('mouseup', handleClockEnd);
    window.removeEventListener('touchmove', handleClockMove);
    window.removeEventListener('touchend', handleClockEnd);
    
    if (clockMode.value === 'hour') {
        clockMode.value = 'minute';
    }
};

onUnmounted(() => {
    window.removeEventListener('mousemove', handleClockMove);
    window.removeEventListener('mouseup', handleClockEnd);
    window.removeEventListener('touchmove', handleClockMove);
    window.removeEventListener('touchend', handleClockEnd);
});

// --- タスク編集（ウィジェット全面パネル）---
const editingFullTaskId = ref<string | null>(null);
const editForm = ref<{
    title: string;
    memo: string;
    categoryId: string;
    startedAt: Date | null;
    endedAt: Date | null;
}>({ title: '', memo: '', categoryId: '', startedAt: null, endedAt: null });

const openTaskEditor = (task: Task) => {
    editingFullTaskId.value = task.id;
    editForm.value = {
        title: task.title || '',
        memo: task.memo || '',
        categoryId: task.categoryId || (taskStore.categories[0]?.id ?? ''),
        startedAt: task.startedAt ? new Date(task.startedAt) : null,
        endedAt: task.endedAt ? new Date(task.endedAt) : null
    };
};

const closeTaskEditor = () => {
    editingFullTaskId.value = null;
};

const saveTaskEditor = () => {
    if (!editingFullTaskId.value) return;
    const title = editForm.value.title.trim();
    if (!title) return; // タイトルは必須
    taskStore.updateTask(editingFullTaskId.value, {
        title,
        memo: editForm.value.memo,
        categoryId: editForm.value.categoryId,
        startedAt: editForm.value.startedAt ? editForm.value.startedAt.toISOString() : undefined,
        endedAt: editForm.value.endedAt ? editForm.value.endedAt.toISOString() : undefined
    });
    editingFullTaskId.value = null;
};
</script>

<template>
    <div class="task-widget-container shadow-sm" :style="widgetStyle">
        <!-- 1. ヘッダー：タイトル ＆ 水平進捗バー -->
        <header class="widget-header" @mousedown="startWidgetDrag">
            <h2 class="title">TODO LIST</h2>
            <div class="progress-section" v-if="taskStore.currentView === 'todo'">
                <ProgressBar 
                    :value="taskStore.activeCategoryCompletionRate" 
                    class="completion-progress"
                />
                <span class="progress-label">{{ taskStore.activeCategoryCompletionRate }}%</span>
            </div>
            <!-- 閉じるボタン -->
            <Button
                icon="pi pi-times"
                class="p-button-text p-button-secondary widget-close-btn"
                @click="closeWidget"
                title="タスク管理を閉じる"
            />
        </header>

        <!-- 2. カスタムタブ列 ＋ タブ管理ボタン (TODO ビュー選択時のみ表示) -->
        <div class="tab-navigation-bar" v-if="taskStore.currentView === 'todo' && !showCategorySettings">
            <div class="category-tabs">
                <button
                    class="tab-btn"
                    :class="{ active: taskStore.activeCategoryId === 'all' }"
                    @click="taskStore.activeCategoryId = 'all'"
                >
                    ALL
                </button>
                <button
                    v-for="cat in taskStore.categories"
                    :key="cat.id"
                    class="tab-btn"
                    :class="{ active: taskStore.activeCategoryId === cat.id }"
                    @click="taskStore.activeCategoryId = cat.id"
                >
                    {{ cat.name }}
                </button>
            </div>
            <div class="tab-actions" style="display: flex; align-items: center; gap: 4px;">
                <Button
                    icon="pi pi-trash"
                    class="p-button-text tab-trash-btn"
                    :class="{ 'delete-mode-active': showDeleteMode }"
                    @click="showDeleteMode = !showDeleteMode"
                    :title="showDeleteMode ? '削除モードをオフにする' : '削除モードをオンにする'"
                />
                <Button
                    icon="pi pi-cog"
                    class="p-button-text p-button-secondary tab-settings-btn"
                    @click="showCategorySettings = true"
                    title="カテゴリ管理を開く"
                />
            </div>
        </div>

        <!-- 3. メインスクロールエリア -->
        <main class="main-scroll-area">
            <div v-show="!showCategorySettings" style="height: 100%; display: flex; flex-direction: column;">
            <!-- (A) TODOビュー (タスクツリー) -->
            <div class="todo-view" v-show="taskStore.currentView === 'todo'" ref="parentRef" @dragover.prevent @drop="onContainerDrop">
                <div 
                    v-for="task in localTasks" 
                    :key="task.id"
                    class="task-card"
                    :class="{ 'status-doing': task.status === 'doing', 'status-done': task.completed, 'drop-target-active': activeDropTargetTaskId === task.id && isNesting, 'overdue': isOverdue(task) }"
                    @dragover.prevent="onParentDragOver($event, task.id)"
                    @drop="onParentDrop($event, task.id)"
                >
                    <!-- ネスト化「子に追加」オーバーレイ -->
                    <div v-if="activeDropTargetTaskId === task.id && isNesting && canNest(task)" class="nest-overlay">
                        <span class="nest-overlay-text">子に追加</span>
                    </div>

                    <!-- 親タスク行 -->
                    <div class="parent-task-row">
                        <!-- ドラッグハンドル -->
                        <div class="drag-handle" title="ドラッグして並べ替え / 右にずらしてネスト" @dragstart="onSortDragStart($event, task.id)">
                            <i class="pi pi-bars"></i>
                        </div>

                        <!-- 状態サイクルボタン -->
                        <button class="status-badge"
                                :class="isPendingComplete(task) ? 'pending-done' : (task.completed || task.status === 'done' ? 'done' : (task.status === 'doing' ? 'doing' : (task.status === 'paused' ? 'doing' : 'todo')))"
                                @click.stop="cycleTaskStatus(task)"
                                :title="isPendingComplete(task) ? 'クリックでTODOに戻す' : ('ステータスをサイクル: ' + (task.status || 'todo'))"
                                style="border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 16px; line-height: 16px; padding: 0 5px;">
                            <span v-if="isPendingComplete(task)">取消 {{ pendingComplete[task.id] }}</span>
                            <span v-else-if="task.completed || task.status === 'done'">DONE</span>
                            <span v-else-if="task.status === 'doing'">DOING</span>
                            <span v-else-if="task.status === 'paused'">PAUSED</span>
                            <span v-else>TODO</span>
                        </button>

                        <!-- タイトル -->
                        <div class="task-title-container flex-grow-1" style="display: flex; align-items: center; overflow: hidden; min-width: 0; gap: 6px;">
                            <span 
                                v-if="editingTaskId !== task.id || editingSubTaskId !== null"
                                class="task-title" 
                                :class="{ completed: task.completed }"
                                @dblclick="startEditTask(task)"
                                @mousedown="handlePressStart('task', task)"
                                @mouseup="handlePressEnd"
                                @mouseleave="handlePressEnd"
                                @touchstart="handlePressStart('task', task)"
                                @touchend="handlePressEnd"
                                style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"
                            >
                                {{ task.title }}
                            </span>
                            <InputText
                                v-else
                                v-model="editingTitle"
                                class="p-inputtext-sm edit-title-input w-full"
                                @blur="saveTitleEdit"
                                @keyup.enter="saveTitleEdit"
                                @keyup.esc="cancelTitleEdit"
                                v-focus
                            />
                        </div>

                        <!-- 一時中断 / 再生 ボタン -->
                        <div class="pause-resume-buttons" style="display: flex; align-items: center; justify-content: center; width: 28px;">
                            <button v-if="task.status === 'doing'"
                                    class="action-icon-btn pause-task-btn"
                                    @click.stop="taskStore.pauseTask(task.id)"
                                    title="一時中断"
                                    style="font-size: 14px; padding: 0;">
                                <span>⏸️</span>
                            </button>
                            <button v-else-if="task.status === 'paused'"
                                    class="action-icon-btn resume-task-btn"
                                    @click.stop="taskStore.resumeTask(task.id)"
                                    title="タスクを再開"
                                    style="font-size: 14px; padding: 0;">
                                <span>▶️</span>
                            </button>
                        </div>

                        <!-- カレンダー設定ボタン / 予定日時表示 -->
                        <div style="display: flex; align-items: center; gap: 2px;">
                            <button 
                                class="action-icon-btn calendar-set-btn" 
                                @click.stop="openDatePicker(task.id)"
                                :title="task.scheduledAt ? '予定日時を変更' : '予定日時を設定'"
                                style="width: auto; padding: 0 4px;"
                            >
                                <span v-if="task.scheduledAt" :style="{ fontSize: '11px', fontWeight: '600', color: isOverdue(task) ? '#dc2626' : '#3b82f6', whiteSpace: 'nowrap' }">
                                    {{ getScheduledDisplay(task.scheduledAt) }}
                                </span>
                                <i v-else class="pi pi-calendar"></i>
                            </button>
                        </div>

                        <!-- サブタスク完了カウント -->
                        <div 
                            class="steps-badge"
                            v-if="task.steps.length > 0"
                        >
                            {{ task.steps.filter(s => s.completed).length }}/{{ task.steps.length }}
                        </div>

                        <!-- 編集ボタン -->
                        <Button
                            icon="pi pi-pencil"
                            class="p-button-text p-button-secondary p-button-sm task-edit-btn"
                            @click.stop="openTaskEditor(task)"
                            title="タスクを編集"
                        />

                        <!-- 削除ボタン (削除モード時のみ) -->
                        <Button
                            v-if="showDeleteMode"
                            icon="pi pi-trash"
                            class="p-button-text p-button-danger p-button-sm task-delete-btn"
                            @click.stop="taskStore.deleteTask(task.id)"
                            title="タスクを削除"
                        />
                    </div>



                    <!-- サブタスク（Step）展開エリア (子供がいれば常に表示) -->
                    <div class="subtasks-container" v-if="task.steps.length > 0">
                        <div class="subtask-list">
                            <!-- 接続線 -->
                            <div class="guide-line"></div>
                            
                            <!-- サブタスク項目 -->
                            <div 
                                v-for="step in task.steps" 
                                :key="step.id"
                                class="subtask-item"
                                draggable="true"
                                @dragstart="onSubTaskDragStart(task.id, step.id)"
                                @dragend="onSubTaskDragEnd"
                            >
                                <!-- 子タスク用ドラッグハンドル (〇から変更、戻すため) -->
                                <div class="drag-handle subtask-drag-handle" title="ドラッグして親タスクに戻す / 移動" style="cursor: grab; color: #94a3b8; padding: 4px; display: flex; align-items: center;">
                                    <i class="pi pi-bars"></i>
                                </div>

                                <!-- ステータスバッジ（todo, doing, done をクリックで切り替え） -->
                                <button 
                                    class="status-badge"
                                    :class="step.status"
                                    @click="cycleSubTaskStatus(task, step)"
                                    title="ステータスを切り替え"
                                >
                                    {{ step.status.toUpperCase() }}
                                </button>

                                <div class="subtask-title-container flex-grow-1" style="display: flex; align-items: center; overflow: hidden; min-width: 0; margin-right: 8px;">
                                    <span 
                                        v-if="editingTaskId !== task.id || editingSubTaskId !== step.id"
                                        class="subtask-title" 
                                        :class="{ completed: step.completed }"
                                        @dblclick="startEditSubTask(task.id, step)"
                                        @mousedown="handlePressStart('subtask', step, task.id)"
                                        @mouseup="handlePressEnd"
                                        @mouseleave="handlePressEnd"
                                        @touchstart="handlePressStart('subtask', step, task.id)"
                                        @touchend="handlePressEnd"
                                        style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap;"
                                    >
                                        {{ step.title }}
                                    </span>
                                    <InputText
                                        v-else
                                        v-model="editingTitle"
                                        class="p-inputtext-sm edit-title-input w-full"
                                        @blur="saveTitleEdit"
                                        @keyup.enter="saveTitleEdit"
                                        @keyup.esc="cancelTitleEdit"
                                        v-focus
                                    />
                                </div>

                                <Button 
                                    v-if="showDeleteMode"
                                    icon="pi pi-times" 
                                    class="p-button-text p-button-secondary p-button-sm step-delete-btn"
                                    @click="taskStore.deleteSubTask(task.id, step.id)"
                                    title="サブタスクを削除"
                                />
                            </div>

                            <!-- サブタスク追加フォーム -->
                            <div class="add-subtask-form">
                                <InputText 
                                    v-model="newSubTaskTitleMap[task.id]" 
                                    placeholder="新しいステップを追加..."
                                    class="p-inputtext-sm subtask-input"
                                    @keyup.enter="handleAddSubTask(task.id)"
                                />
                                <Button 
                                    icon="pi pi-plus" 
                                    class="p-button-text p-button-sm p-button-secondary"
                                    @click="handleAddSubTask(task.id)"
                                    :disabled="!(newSubTaskTitleMap[task.id] || '').trim()"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="taskStore.filteredTasks.length === 0" class="empty-state">
                    タスクがありません。下部フォームから追加しましょう！
                </div>
            </div>

            <!-- (B) TIMELINEビュー (予定時刻軸・下詰め: 下ほど現在に近い/期限切れ) -->
            <div class="timeline-view" v-show="taskStore.currentView === 'timeline'">
                <div
                    v-for="task in taskStore.timelineTasks"
                    :key="task.id"
                    class="timeline-item"
                >
                    <div class="timeline-marker">
                        <i :class="task.completed ? 'pi pi-check-circle checked' : (isOverdue(task) ? 'pi pi-exclamation-circle overdue-icon' : 'pi pi-circle-off unchecked')"></i>
                        <div class="timeline-line"></div>
                    </div>

                    <!-- 〇とタスクの間に予定(limit)時間を表示 -->
                    <div class="timeline-limit" :class="{ overdue: isOverdue(task) }">
                        <span v-if="task.scheduledAt">{{ getScheduledDisplay(task.scheduledAt) }}</span>
                        <span v-else class="unscheduled">—</span>
                    </div>

                    <div class="timeline-content-card" :class="{ completed: task.completed, overdue: isOverdue(task) }">
                        <div class="timeline-row-main">
                            <!-- ステータス変更コントロール (TODOビューと同様のサイクルボタン) -->
                            <button
                                class="status-badge"
                                :class="isPendingComplete(task) ? 'pending-done' : (task.completed || task.status === 'done' ? 'done' : (task.status === 'doing' ? 'doing' : (task.status === 'paused' ? 'doing' : 'todo')))"
                                @click.stop="cycleTaskStatus(task)"
                                :title="isPendingComplete(task) ? 'クリックでTODOに戻す' : ('ステータスをサイクル: ' + (task.status || 'todo'))"
                                style="border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 16px; line-height: 16px; padding: 0 5px; flex-shrink: 0;"
                            >
                                <span v-if="isPendingComplete(task)">取消 {{ pendingComplete[task.id] }}</span>
                                <span v-else-if="task.completed || task.status === 'done'">DONE</span>
                                <span v-else-if="task.status === 'doing'">DOING</span>
                                <span v-else-if="task.status === 'paused'">PAUSED</span>
                                <span v-else>TODO</span>
                            </button>
                            <h4 class="timeline-task-title" :class="{ completed: task.completed }">
                                {{ task.title }}
                            </h4>
                            <span class="timeline-cat-badge">{{ getCategoryName(task.categoryId) }}</span>
                            <Button
                                icon="pi pi-pencil"
                                class="p-button-text p-button-secondary p-button-sm task-edit-btn"
                                @click.stop="openTaskEditor(task)"
                                title="タスクを編集"
                            />
                            <Button
                                v-if="showDeleteMode"
                                icon="pi pi-trash"
                                class="p-button-text p-button-danger p-button-sm task-delete-btn"
                                @click.stop="taskStore.deleteTask(task.id)"
                                title="タスクを削除"
                            />
                        </div>
                    </div>
                </div>

                <div v-if="taskStore.tasks.length === 0" class="empty-state">
                    タスクがありません。
                </div>
            </div>

            <!-- (B') COMPビュー (完了済みタスクを完了日ごとにブロック表示・全カテゴリ横断) -->
            <div class="completed-view" v-show="taskStore.currentView === 'completed'">
                <div
                    v-for="group in taskStore.completedTasksByDate"
                    :key="group.key"
                    class="completed-date-block"
                >
                    <div class="completed-date-header">
                        <span class="completed-date-label">{{ group.label }}</span>
                        <span class="completed-date-count">{{ group.tasks.length }}</span>
                    </div>
                    <div class="completed-date-items">
                        <div
                            v-for="task in group.tasks"
                            :key="task.id"
                            class="completed-item"
                        >
                            <!-- ステータス変更コントロール (クリックで未完了に戻す) -->
                            <button
                                class="status-badge done"
                                @click.stop="cycleTaskStatus(task)"
                                title="クリックで未完了に戻す"
                                style="border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 16px; line-height: 16px; padding: 0 5px; flex-shrink: 0;"
                            >
                                DONE
                            </button>
                            <div class="completed-main">
                                <span class="completed-title">{{ task.title }}</span>
                                <div class="completed-meta">
                                    <span class="timeline-cat-badge">{{ getCategoryName(task.categoryId) }}</span>
                                    <span v-if="task.endedAt" class="completed-date">{{ formatTime(task.endedAt) }}</span>
                                </div>
                            </div>
                            <Button
                                icon="pi pi-pencil"
                                class="p-button-text p-button-secondary p-button-sm task-edit-btn"
                                @click.stop="openTaskEditor(task)"
                                title="タスクを編集"
                            />
                            <Button
                                icon="pi pi-trash"
                                class="p-button-text p-button-danger p-button-sm task-delete-btn"
                                @click.stop="taskStore.deleteTask(task.id)"
                                title="タスクを削除"
                            />
                        </div>
                    </div>
                </div>

                <div v-if="taskStore.completedTasks.length === 0" class="empty-state">
                    完了したタスクはまだありません。
                </div>
            </div>
            </div>

            <!-- (C) インライン設定パネル -->
            <div v-show="showCategorySettings" class="inline-settings-panel">
                <div class="settings-header">
                    <Button 
                        icon="pi pi-arrow-left" 
                        class="p-button-text p-button-secondary p-button-sm back-btn" 
                        @click="closeSettingsPanel" 
                        label="戻る" 
                    />
                </div>

                <div class="settings-content">
                    <!-- カテゴリ管理 -->
                    <div class="settings-section">
                        <span class="section-title">カテゴリの管理</span>
                        <div class="category-list">
                            <div 
                                v-for="(cat, idx) in taskStore.categories" 
                                :key="cat.id" 
                                class="category-item"
                            >
                                <div class="cat-left">
                                    <div class="order-buttons">
                                        <Button 
                                            icon="pi pi-chevron-up" 
                                            class="p-button-text p-button-sm p-button-secondary move-btn" 
                                            :disabled="idx === 0"
                                            @click="moveUp(idx)"
                                            title="上へ移動"
                                        />
                                        <Button 
                                            icon="pi pi-chevron-down" 
                                            class="p-button-text p-button-sm p-button-secondary move-btn" 
                                            :disabled="idx === taskStore.categories.length - 1"
                                            @click="moveDown(idx)"
                                            title="下へ移動"
                                        />
                                    </div>
                                    <InputText 
                                        v-model="cat.name" 
                                        class="p-inputtext-sm cat-name-input"
                                        @blur="taskStore.updateCategory(cat.id, cat.name)"
                                        placeholder="カテゴリ名"
                                    />
                                </div>
                                <Button 
                                    icon="pi pi-trash" 
                                    class="p-button-text p-button-danger p-button-sm delete-btn" 
                                    @click="handleDeleteCategory(cat.id)"
                                    title="削除"
                                />
                            </div>
                            <div v-if="taskStore.categories.length === 0" class="empty-message">
                                カテゴリが登録されていません。
                            </div>
                        </div>

                        <!-- カテゴリ追加 -->
                        <div class="add-category-form">
                            <InputText 
                                v-model="newCategoryName" 
                                placeholder="カテゴリを追加..."
                                class="p-inputtext-sm flex-grow-1"
                                @keyup.enter="handleAddCategory"
                            />
                            <Button 
                                icon="pi pi-plus" 
                                class="p-button-sm add-btn"
                                @click="handleAddCategory"
                                :disabled="!newCategoryName.trim()"
                            />
                        </div>
                    </div>

                    <div class="divider"></div>

                    <!-- 不透明度設定 -->
                    <div class="settings-section">
                        <span class="section-title">不透明度 (透明度)</span>
                        <div class="opacity-control">
                            <span class="opacity-value">{{ Math.round(configStore.taskOpacity * 100) }}%</span>
                            <Slider 
                                v-model="configStore.taskOpacity" 
                                :min="0.1" 
                                :max="1.0" 
                                :step="0.05"
                                class="opacity-slider"
                            />
                        </div>
                    </div>

                    <div class="divider"></div>

                    <!-- お知らせ設定 -->
                    <div class="settings-section">
                        <span class="section-title">予定のお知らせ</span>
                        <div class="notification-control">
                            <label class="checkbox-label">
                                <input 
                                    type="checkbox" 
                                    v-model="taskStore.enableNotification" 
                                    class="p-checkbox-input"
                                />
                                <span class="label-text">音声でお知らせする</span>
                            </label>
                            <div class="minutes-input-row" v-if="taskStore.enableNotification">
                                <InputText
                                    v-model.number="taskStore.notificationMinutes"
                                    type="number"
                                    min="0"
                                    max="60"
                                    class="p-inputtext-sm minutes-input"
                                />
                                <span class="minutes-text">分前にお知らせ</span>
                            </div>
                        </div>
                    </div>

                    <div class="divider"></div>

                    <!-- DONE猶予設定 -->
                    <div class="settings-section">
                        <span class="section-title">完了(DONE)の猶予</span>
                        <div class="notification-control">
                            <div class="minutes-input-row" style="padding-left: 0;">
                                <InputText
                                    v-model.number="taskStore.completionGraceSeconds"
                                    type="number"
                                    min="0"
                                    max="120"
                                    class="p-inputtext-sm minutes-input"
                                />
                                <span class="minutes-text">秒後にCOMPへ移動 (0で即時)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <!-- 4. ビュー切り替えタブ (TODO / TIMELINE) -->
        <div class="view-toggle-bar" v-if="!showCategorySettings">
            <SelectButton 
                v-model="taskStore.currentView" 
                :options="viewOptions" 
                optionLabel="label" 
                optionValue="value" 
                class="view-selector"
            />
        </div>

        <!-- 5. 最下部固定フォーム -->
        <footer class="widget-footer-form" v-if="!showCategorySettings">
            <div class="add-task-input-wrapper" style="position: relative; display: flex; align-items: center; flex-grow: 1; min-width: 0;">
                <InputText 
                    v-model="newTaskTitle" 
                    placeholder="新しいタスクを追加..." 
                    class="p-inputtext-sm w-full task-input-field"
                    @keyup.enter="handleAddTask"
                    style="padding-right: 32px;"
                />
                <button 
                    class="action-icon-btn calendar-set-btn" 
                    @click.stop="openDatePicker('new_task')"
                    :title="newTaskScheduledAt ? '予定日時を変更' : '予定日時を設定'"
                    style="position: absolute; right: 6px; padding: 4px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer;"
                    type="button"
                >
                    <i class="pi pi-calendar" :style="{ color: newTaskScheduledAt ? '#3b82f6' : '#94a3b8' }"></i>
                </button>
            </div>
            <Button 
                icon="pi pi-plus" 
                class="p-button-sm add-task-btn" 
                @click="handleAddTask"
                :disabled="!newTaskTitle.trim()"
            />
        </footer>

        <!-- 全面カレンダー設定パネル -->
        <div v-if="activeCalendarTaskId" class="fullscreen-calendar-panel">
            <div class="calendar-panel-header">
                <span class="panel-title">予定日時の設定</span>
                <Button 
                    icon="pi pi-times" 
                    class="p-button-text p-button-secondary close-btn" 
                    @click="activeCalendarTaskId = null" 
                />
            </div>
            <div class="calendar-panel-content">
                <div class="task-title-summary">
                    <span class="label">タスク: </span>
                    <span class="task-name">{{ getActiveCalendarTaskTitle() }}</span>
                </div>
                
                <!-- STEP 1: 日付選択 -->
                <div v-if="calendarStep === 'date'" class="datepicker-container">
                    <DatePicker 
                        v-model="tempCalendarDate"
                        inline
                        style="width: 100%; border: none;"
                        @date-select="onDateSelect"
                    />
                </div>
                
                <!-- STEP 2: 時刻選択 (クロックウィジェット) -->
                <div v-else class="clockpicker-container">
                    <div class="clockpicker-header">
                        <button class="back-to-date-btn" @click="calendarStep = 'date'" title="日付選択に戻る" type="button">
                            <i class="pi pi-angle-left"></i> 日付
                        </button>
                        <div class="digital-time-display">
                            <span 
                                class="time-part" 
                                :class="{ active: clockMode === 'hour' }" 
                                @click="clockMode = 'hour'"
                            >
                                {{ String(selectedHour24).padStart(2, '0') }}
                            </span>
                            <span class="colon">:</span>
                            <span 
                                class="time-part" 
                                :class="{ active: clockMode === 'minute' }" 
                                @click="clockMode = 'minute'"
                            >
                                {{ String(selectedMinuteVal).padStart(2, '0') }}
                            </span>
                        </div>
                    </div>
                    
                    <div class="clock-face-wrapper">
                        <div 
                            class="clock-dial"
                            @mousedown="handleClockStart"
                            @touchstart.prevent="handleClockStart"
                        >
                            <div class="clock-center-dot"></div>
                            <div class="clock-hand-line" :style="getClockHandStyle()">
                                <div class="clock-hand-pointer"></div>
                            </div>
                            
                            <div v-if="clockMode === 'hour'">
                                <button 
                                    v-for="(h, idx) in innerHourNumbers" 
                                    :key="'h-in-' + h"
                                    class="clock-num-btn inner"
                                    :class="{ active: selectedHour24 === h }"
                                    :style="getClockNumberStyle(idx, true)"
                                    type="button"
                                >
                                    {{ h }}
                                </button>
                                <button 
                                    v-for="(h, idx) in outerHourNumbers" 
                                    :key="'h-out-' + h"
                                    class="clock-num-btn outer"
                                    :class="{ active: selectedHour24 === h }"
                                    :style="getClockNumberStyle(idx, false)"
                                    type="button"
                                >
                                    {{ h }}
                                </button>
                            </div>
                            <div v-else>
                                <button 
                                    v-for="(m, idx) in minuteNumbers" 
                                    :key="'m-' + m"
                                    class="clock-num-btn"
                                    :class="{ active: selectedMinuteVal === m }"
                                    :style="getClockNumberStyle(idx)"
                                    @click="handleNumberSelect(m)"
                                    type="button"
                                >
                                    {{ String(m).padStart(2, '0') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="calendar-panel-footer">
                <Button 
                    label="クリア" 
                    class="p-button-outlined p-button-danger p-button-sm mr-auto" 
                    @click="clearFullscreenCalendarDate" 
                />
                <Button 
                    label="キャンセル" 
                    class="p-button-outlined p-button-secondary p-button-sm" 
                    @click="activeCalendarTaskId = null" 
                />
                <Button 
                    label="決定" 
                    class="p-button-primary p-button-sm" 
                    @click="saveFullscreenCalendarDate" 
                />
            </div>
        </div>

        <!-- タスク編集パネル (ウィジェット全面) -->
        <div v-if="editingFullTaskId" class="fullscreen-edit-panel">
            <div class="calendar-panel-header">
                <span class="panel-title">タスクの編集</span>
                <Button
                    icon="pi pi-times"
                    class="p-button-text p-button-secondary close-btn"
                    @click="closeTaskEditor"
                />
            </div>
            <div class="edit-panel-content">
                <label class="edit-field">
                    <span class="edit-label">タイトル</span>
                    <InputText v-model="editForm.title" class="p-inputtext-sm" placeholder="タイトル" />
                </label>
                <label class="edit-field">
                    <span class="edit-label">メモ</span>
                    <textarea v-model="editForm.memo" class="edit-textarea" rows="4" placeholder="メモ"></textarea>
                </label>
                <label class="edit-field">
                    <span class="edit-label">カテゴリ</span>
                    <select v-model="editForm.categoryId" class="edit-select">
                        <option v-for="cat in taskStore.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
                    </select>
                </label>
                <div class="edit-field-row">
                    <label class="edit-field">
                        <span class="edit-label">開始</span>
                        <DatePicker
                            v-model="editForm.startedAt"
                            showTime
                            hourFormat="24"
                            :stepMinute="5"
                            showButtonBar
                            placeholder="未設定"
                        />
                    </label>
                    <label class="edit-field">
                        <span class="edit-label">終了</span>
                        <DatePicker
                            v-model="editForm.endedAt"
                            showTime
                            hourFormat="24"
                            :stepMinute="5"
                            showButtonBar
                            placeholder="未設定"
                        />
                    </label>
                </div>
            </div>
            <div class="calendar-panel-footer">
                <Button
                    label="キャンセル"
                    class="p-button-outlined p-button-secondary p-button-sm"
                    @click="closeTaskEditor"
                />
                <Button
                    label="保存"
                    class="p-button-primary p-button-sm"
                    :disabled="!editForm.title.trim()"
                    @click="saveTaskEditor"
                />
            </div>
        </div>

        <!-- リサイズ用ハンドル -->
        <div class="resize-handle right" @mousedown="initResize($event, 'right')"></div>
        <div class="resize-handle bottom" @mousedown="initResize($event, 'bottom')"></div>
        <div class="resize-handle corner" @mousedown="initResize($event, 'corner')"></div>
    </div>
</template>

<style scoped>
.task-widget-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    font-family: 'Outfit', 'Inter', sans-serif;
    color: #1e293b;
}

/* 1. ヘッダー */
.widget-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid #f1f5f9;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
}

.widget-header:active {
    cursor: grabbing;
}

.title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #475569;
    margin: 0;
}

.progress-section {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 120px;
}

.completion-progress {
    height: 6px !important;
    background: #e2e8f0;
    flex-grow: 1;
}

:deep(.p-progressbar-value) {
    background: #3b82f6;
}

.progress-label {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    width: 28px;
    text-align: right;
}

/* 2. カスタムタブ列 */
.tab-navigation-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 8px;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
}

.category-tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
}

/* クロックピッカーUI */
.clockpicker-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    flex-shrink: 0;
}

.clockpicker-header {
    width: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    position: relative;
    padding: 0 4px;
}

.back-to-date-btn {
    align-self: center;
    background: transparent;
    border: none;
    color: #64748b;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border-radius: 4px;
}

.back-to-date-btn:hover {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.05);
}

.digital-time-display {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f1f5f9;
    border-radius: 6px;
    padding: 2px 8px;
    font-size: 16px;
    font-weight: 700;
    color: #334155;
    gap: 4px;
}

.digital-time-display .time-part {
    cursor: pointer;
    padding: 0 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.digital-time-display .time-part.active {
    color: #3b82f6;
    background: #eff6ff;
}

.digital-time-display .colon {
    color: #94a3b8;
    animation: blink-colon 1.5s infinite;
}

@keyframes blink-colon {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}

.ampm-toggle {
    display: flex;
    background: #e2e8f0;
    border-radius: 6px;
    padding: 2px;
}

.ampm-btn {
    border: none;
    background: transparent;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.ampm-btn.active {
    background: #ffffff;
    color: #3b82f6;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

/* クロック文字盤 */
.clock-face-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.clock-mode-label {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 600;
}

.clock-dial {
    position: relative;
    width: 170px;
    height: 170px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
    cursor: pointer;
    user-select: none;
}

.clock-center-dot {
    position: absolute;
    width: 6px;
    height: 6px;
    background: #3b82f6;
    border-radius: 50%;
    z-index: 10;
}

.clock-hand-line {
    position: absolute;
    bottom: 50%;
    left: calc(50% - 1px);
    width: 2px;
    height: 64px;
    background: #3b82f6;
    transform-origin: bottom center;
    z-index: 5;
}

.clock-hand-pointer {
    position: absolute;
    top: -12px;
    left: -11px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.18);
    border: 1px solid #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
}

.clock-hand-pointer::after {
    content: '';
    width: 6px;
    height: 6px;
    background: #3b82f6;
    border-radius: 50%;
}

.clock-num-btn {
    position: absolute;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: transparent;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 8;
    transition: all 0.2s ease;
    top: calc(50% - 12px);
    left: calc(50% - 12px);
    pointer-events: none; /* ドラッグ操作を妨げないようにする */
}

.clock-num-btn.inner {
    font-size: 8px;
    color: #64748b;
}

.clock-num-btn.outer {
    font-size: 10px;
    color: #334155;
}

.clock-num-btn:hover {
    background: rgba(59, 130, 246, 0.08);
    color: #3b82f6;
}

.clock-num-btn.active {
    background: #3b82f6;
    color: #ffffff !important;
}

/* カレンダーのコンパクト化（DatePicker） */
.datepicker-container :deep(.p-datepicker) {
    font-size: 11px !important;
    padding: 2px !important;
}

.datepicker-container :deep(.p-datepicker-header) {
    padding: 2px 4px !important;
    font-size: 11px !important;
}

.datepicker-container :deep(.p-datepicker-title) {
    line-height: 1.4 !important;
}

.datepicker-container :deep(.p-datepicker-prev-icon),
.datepicker-container :deep(.p-datepicker-next-icon) {
    width: 10px !important;
    height: 10px !important;
}

.datepicker-container :deep(.p-datepicker-calendar th) {
    padding: 2px !important;
    font-size: 9px !important;
}

.datepicker-container :deep(.p-datepicker-calendar td) {
    padding: 1px !important;
}

.datepicker-container :deep(.p-datepicker-calendar td > span) {
    width: 20px !important;
    height: 20px !important;
    line-height: 20px !important;
    font-size: 10px !important;
}

.time-adjust-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
}

.time-adjust-row .adjust-label {
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
}

.category-tabs::-webkit-scrollbar {
    display: none; /* Safari, Chrome */
}

.tab-btn {
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
}

.tab-btn:hover {
    color: #1e293b;
    background: #e2e8f0;
}

.tab-btn.active {
    color: #3b82f6;
    background: #eff6ff;
}

.tab-settings-btn {
    width: 24px !important;
    height: 24px !important;
    padding: 0 !important;
}

.tab-trash-btn {
    width: 24px !important;
    height: 24px !important;
    padding: 0 !important;
    color: #94a3b8 !important;
    transition: all 0.2s ease;
}

.tab-trash-btn:hover {
    color: #ef4444 !important;
    background: rgba(239, 68, 68, 0.08) !important;
}

.tab-trash-btn.delete-mode-active {
    color: #ef4444 !important;
    background: rgba(239, 68, 68, 0.12) !important;
}

/* 3. メインスクロールエリア */
.main-scroll-area {
    flex-grow: 1;
    overflow-y: auto;
    padding: 8px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.todo-view {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

/* タスクカード */
.task-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    overflow: hidden;
}

.parent-task-row {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    gap: 6px;
}

.drag-handle {
    cursor: grab;
    color: #94a3b8;
    padding: 2px;
    display: flex;
    align-items: center;
}

.drag-handle:active {
    cursor: grabbing;
}

.checkbox-wrapper {
    cursor: pointer;
    font-size: 16px;
    display: flex;
    align-items: center;
    color: #94a3b8;
}

.checkbox-wrapper i.checked {
    color: #10b981;
}

.task-title {
    flex-grow: 1;
    font-size: 13px;
    font-weight: 500;
    color: #334155;
    cursor: pointer;
    user-select: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.task-title.completed {
    color: #94a3b8;
    text-decoration: line-through;
}

.steps-badge {
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
}

.priority-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    font-size: 12px;
    display: flex;
    align-items: center;
    color: #94a3b8;
}

.priority-btn.thunder {
    color: #ef4444;
}

.priority-btn.star {
    color: #eab308;
}

.expand-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #64748b;
    font-size: 12px;
    padding: 4px;
}

.task-delete-btn {
    width: 20px !important;
    height: 20px !important;
    padding: 0 !important;
}

.task-edit-btn {
    width: 20px !important;
    height: 20px !important;
    padding: 0 !important;
}

/* タスク編集パネル (ウィジェット全面) */
.fullscreen-edit-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #ffffff;
    z-index: 150;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.2s ease-out;
}

.edit-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.edit-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.edit-label {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
}

.edit-textarea {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: inherit;
    color: #334155;
    background: #ffffff;
    resize: vertical;
    min-height: 60px;
}

.edit-textarea:focus {
    border-color: #3b82f6;
    outline: none;
}

.edit-select {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: inherit;
    color: #334155;
    background: #ffffff;
}

.edit-select:focus {
    border-color: #3b82f6;
    outline: none;
}

.edit-field-row {
    display: flex;
    gap: 12px;
}

.edit-field-row .edit-field {
    flex: 1;
    min-width: 0;
}

.edit-field-row :deep(.p-datepicker) {
    width: 100%;
}

.edit-field-row :deep(.p-datepicker-input),
.edit-field-row :deep(.p-inputtext) {
    width: 100%;
    font-size: 12px;
    padding: 4px 8px;
}

/* サブタスクエリア */
.subtasks-container {
    background: #f8fafc;
    border-top: 1px solid #f1f5f9;
    padding: 8px 12px 12px 12px;
}

.subtask-list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 20px;
}

.guide-line {
    position: absolute;
    left: 8px;
    top: 0;
    bottom: 20px;
    width: 1px;
    background: #cbd5e1;
}

.subtask-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
}

.status-badge {
    font-size: 9px;
    font-weight: 700;
    border: none;
    border-radius: 4px;
    padding: 2px 5px;
    cursor: pointer;
    white-space: nowrap;
}

.status-badge.todo {
    background: #e2e8f0;
    color: #475569;
}

.status-badge.doing {
    background: #dbeafe;
    color: #1d4ed8;
}

.status-badge.done {
    background: #d1fae5;
    color: #065f46;
}

/* DONE猶予中（クリックで取消） */
.status-badge.pending-done {
    background: #fef3c7;
    color: #b45309;
    animation: pendingPulse 1s ease-in-out infinite;
}

@keyframes pendingPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.subtask-title {
    flex-grow: 1;
    font-size: 12px;
    color: #475569;
}

.subtask-title.completed {
    color: #94a3b8;
    text-decoration: line-through;
}

.step-delete-btn {
    width: 20px !important;
    height: 20px !important;
    padding: 0 !important;
}

.add-subtask-form {
    display: flex;
    gap: 6px;
    padding-top: 4px;
}

.subtask-input {
    flex-grow: 1;
    height: 26px;
    font-size: 11px;
    border-color: #e2e8f0;
}

.empty-state {
    text-align: center;
    color: #64748b;
    padding: 24px 0;
    font-size: 12px;
}

/* TIMELINEビュー */
.timeline-view {
    display: flex;
    flex-direction: column;
    padding-left: 6px;
    flex-grow: 1;
    justify-content: flex-end; /* 下詰め: 現在時刻に近いものを下部へ集める */
}

.timeline-item {
    display: flex;
    gap: 8px;
    position: relative;
}

.timeline-marker {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.timeline-marker i {
    font-size: 12px;
}

.timeline-line {
    width: 2px;
    background: #e2e8f0;
    flex-grow: 1;
    min-height: 12px;
}

.timeline-item:last-child .timeline-line {
    display: none;
}

/* 〇とタスクの間の予定(limit)時間 */
.timeline-limit {
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding-top: 5px;
    min-width: 52px;
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 600;
    color: #3b82f6;
    white-space: nowrap;
}

.timeline-limit .unscheduled {
    color: #cbd5e1;
    font-weight: 500;
}

.timeline-limit.overdue {
    color: #dc2626;
}

.timeline-content-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 4px 8px;
    margin-bottom: 5px;
    flex-grow: 1;
    min-width: 0;
    box-shadow: 0 1px 2px rgba(0,0,0,0.01);
}

/* 期限切れ（未完了で予定時刻超過）の警告表示 */
.timeline-content-card.overdue {
    background: #fef2f2;
    border-color: #fecaca;
    border-left: 3px solid #ef4444;
}

.timeline-content-card.completed {
    background: #f8fafc;
}

.timeline-row-main {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

.timeline-cat-badge {
    font-size: 9px;
    font-weight: 600;
    color: #3b82f6;
    background: #eff6ff;
    padding: 1px 4px;
    border-radius: 3px;
    flex-shrink: 0;
}

.timeline-task-title {
    flex-grow: 1;
    min-width: 0;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    margin: 0;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.timeline-task-title.completed {
    color: #94a3b8;
    text-decoration: line-through;
}

.timeline-marker i.overdue-icon {
    color: #ef4444;
}

/* COMPビュー (完了済み一覧) */
.completed-view {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.completed-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 5px 8px;
}

.completed-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-grow: 1;
    min-width: 0;
}

.completed-title {
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
    text-decoration: line-through;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.completed-meta {
    display: flex;
    align-items: center;
    gap: 6px;
}

.completed-date {
    font-size: 10px;
    color: #94a3b8;
    font-weight: 500;
}

/* 4. ビュー切り替えタブ */
.view-toggle-bar {
    display: flex;
    justify-content: center;
    padding: 3px 12px;
    border-top: 1px solid #f1f5f9;
    background: #ffffff;
}

.view-selector {
    transform: scale(0.8);
}

:deep(.p-selectbutton .p-button) {
    font-size: 11px;
    padding: 4px 16px;
}

/* 5. 最下部固定フォーム */
.widget-footer-form {
    display: flex;
    padding: 8px;
    gap: 8px;
    border-top: 1px solid #e2e8f0;
    background: #ffffff;
}

.flex-grow-1 {
    flex-grow: 1;
}

.task-input-field {
    border-color: #cbd5e1;
    height: 30px;
    font-size: 12px;
}

.task-input-field:focus {
    border-color: #3b82f6;
}

.add-task-btn {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
}

.add-task-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
}

.widget-close-btn {
    width: 24px !important;
    height: 24px !important;
    padding: 0 !important;
}

/* リサイズハンドル */
.resize-handle {
    position: absolute;
    background: transparent;
    z-index: 9999;
}
.resize-handle.right {
    top: 0;
    right: 0;
    width: 6px;
    height: calc(100% - 10px);
    cursor: e-resize;
}
.resize-handle.bottom {
    bottom: 0;
    left: 0;
    width: calc(100% - 10px);
    height: 6px;
    cursor: s-resize;
}
.resize-handle.corner {
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    cursor: se-resize;
}

/* インプレース編集インプット */
.edit-title-input {
    padding: 2px 6px !important;
    font-size: 13px !important;
    height: 24px !important;
    border-color: #3b82f6 !important;
}

/* インライン設定パネル */
.inline-settings-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 8px;
}

.settings-header {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 8px;
}

.settings-header .back-btn {
    padding: 4px 8px !important;
    font-size: 12px !important;
    height: 28px !important;
}

.settings-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    flex-grow: 1;
}

.settings-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.section-title {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
}

.category-list {
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
}

.category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px 8px;
    gap: 12px;
}

.cat-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-grow: 1;
}

.order-buttons {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.move-btn {
    width: 18px !important;
    height: 18px !important;
    padding: 0 !important;
}

.cat-name-input {
    flex-grow: 1;
    border-color: #cbd5e1;
    background: #ffffff;
    padding: 4px 8px !important;
    font-size: 12px !important;
    height: 28px !important;
}

.cat-name-input:focus {
    border-color: #3b82f6;
}

.delete-btn {
    width: 28px !important;
    height: 28px !important;
    padding: 0 !important;
}

.empty-message {
    text-align: center;
    color: #64748b;
    padding: 12px 0;
    font-size: 12px;
}

.add-category-form {
    display: flex;
    gap: 8px;
    margin-top: 4px;
}

.add-btn {
    background: #3b82f6;
    border-color: #3b82f6;
    color: #ffffff;
    padding: 4px 12px !important;
    height: 28px !important;
}

.add-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
}

.divider {
    height: 1px;
    background: #f1f5f9;
    margin: 4px 0;
}

.opacity-control {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
}

.opacity-value {
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    width: 36px;
    text-align: right;
}

.opacity-slider {
    flex-grow: 1;
}

/* 開始・終了・カレンダー関連 */
.action-icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    font-size: 12px;
    color: #64748b;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    width: 20px;
    height: 20px;
}

.action-icon-btn:hover {
    background: #f1f5f9;
    color: #334155;
}

.start-task-btn {
    color: #10b981; /* 緑 */
}
.start-task-btn:hover {
    background: #ecfdf5;
    color: #059669;
}

.complete-task-btn {
    color: #ef4444; /* 赤 */
}
.complete-task-btn:hover {
    background: #fef2f2;
    color: #dc2626;
}

.calendar-set-btn {
    color: #3b82f6; /* 青 */
}
.calendar-set-btn:hover {
    background: #eff6ff;
    color: #2563eb;
}

/* 進行中のタスクスタイル */
.task-card.status-doing {
    border-left: 3px solid #f59e0b; /* オレンジ色の左枠線 */
    background: #fffbeb; /* 薄いオレンジの背景 */
}

/* 期限切れタスクのスタイル（警告色） */
.task-card.overdue {
    border-left: 3px solid #ef4444; /* 赤色の左枠線 */
    background: #fef2f2; /* 薄い赤の背景 */
    border-color: #fecaca;
}

.doing-badge-pill {
    font-size: 9px;
    font-weight: 600;
    color: #d97706;
    background: #fef3c7;
    padding: 2px 5px;
    border-radius: 9999px;
    white-space: nowrap;
    border: 1px solid #fde68a;
}

/* 予定日時行 */
.task-schedule-row {
    padding: 2px 12px 6px 36px;
    display: flex;
    align-items: center;
    font-size: 11px;
}

.scheduled-display {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #3b82f6;
    background: #eff6ff;
    padding: 2px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
    border: 1px dashed #bfdbfe;
}

.scheduled-display:hover {
    background: #dbeafe;
}

.icon-cal {
    font-size: 10px;
}

.date-clear-btn {
    width: 14px !important;
    height: 14px !important;
    padding: 0 !important;
    font-size: 8px !important;
}

.scheduled-picker-wrapper {
    width: 100%;
}

.scheduled-picker-wrapper :deep(.p-datepicker) {
    font-size: 11px;
    padding: 4px;
}

.scheduled-picker-wrapper :deep(.p-datepicker-header) {
    padding: 4px;
}

.scheduled-picker-wrapper :deep(.p-datepicker-title) {
    font-size: 11px;
    line-height: 1.2;
}

.scheduled-picker-wrapper :deep(.p-datepicker-calendar-container) {
    padding: 0;
}

.scheduled-picker-wrapper :deep(.p-datepicker-calendar) {
    font-size: 10px;
}

.scheduled-picker-wrapper :deep(.p-datepicker-day) {
    width: 22px;
    height: 22px;
    font-size: 10px;
    padding: 0;
}

.scheduled-picker-wrapper :deep(.p-datepicker-time-picker) {
    padding: 4px 0 0 0;
    gap: 2px;
    border-top: 1px solid #e2e8f0;
}

.scheduled-picker-wrapper :deep(.p-datepicker-time-picker button) {
    width: 14px;
    height: 14px;
    font-size: 8px;
    padding: 0;
}

.scheduled-picker-wrapper :deep(.p-datepicker-time-picker span) {
    font-size: 10px;
    font-weight: 600;
}

.datetime-picker-input {
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 11px;
    font-family: inherit;
    color: #334155;
    background: #ffffff;
    width: 170px;
    height: 24px;
}

.datetime-picker-input:focus {
    border-color: #3b82f6;
    outline: none;
}
/* ネスト「子に追加」オーバーレイ */
.task-card {
    position: relative;
}
.nest-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(59, 130, 246, 0.9); /* PrimeVue ブルー */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 8px;
    animation: fadeInNest 0.15s ease-out;
    pointer-events: none;
}
.nest-overlay-text {
    color: #ffffff;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.05em;
}
/* 全面カレンダー設定パネル */
.fullscreen-calendar-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #ffffff;
    z-index: 150;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.2s ease-out;
}

@keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

.calendar-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid #f1f5f9;
}

.calendar-panel-header .panel-title {
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
}

.calendar-panel-header .close-btn {
    width: 24px;
    height: 24px;
    padding: 0;
}

.calendar-panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.task-title-summary {
    background: #f8fafc;
    border-left: 3px solid #3b82f6;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.4;
    flex-shrink: 0;
    word-break: break-all;
    white-space: pre-wrap;
}

.task-title-summary .label {
    color: #64748b;
    font-weight: 600;
    margin-right: 6px;
}

.task-title-summary .task-name {
    color: #1e293b;
    font-weight: 500;
}

.datepicker-container {
    display: flex;
    justify-content: center;
    align-items: center;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: #ffffff;
    flex-shrink: 0;
}

/* 全面時もコンパクトに収まるようにスタイリング */
.datepicker-container :deep(.p-datepicker) {
    border: none;
    width: 100%;
}

.datepicker-container :deep(.p-datepicker-calendar-container) {
    padding: 0;
}

.datepicker-container :deep(.p-datepicker-time-picker) {
    border-top: 1px solid #f1f5f9;
    padding: 8px 0 0 0;
}

.calendar-panel-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid #f1f5f9;
    background: #f8fafc;
}

.notification-control {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
    user-select: none;
}

.p-checkbox-input {
    width: 16px;
    height: 16px;
    cursor: pointer;
}

.minutes-input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 24px;
}

.minutes-input {
    width: 60px !important;
    text-align: center;
    padding: 4px 8px !important;
}

.minutes-text {
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
}
</style>
