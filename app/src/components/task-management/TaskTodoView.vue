<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { useTaskStore, type SubTask, type Task } from '../../store/task';
import SubTaskEditorPanel from './SubTaskEditorPanel.vue';
import TaskActionButtons from './TaskActionButtons.vue';
import { useTaskInlineEdit } from './composables/useTaskInlineEdit';
import { useTaskTreeDrag } from './composables/useTaskTreeDrag';
import { getScheduledDisplay, isTaskOverdue } from './taskDisplayUtils';

const props = defineProps<{
    pendingComplete: Record<string, number>;
    showDeleteMode: boolean;
}>();

const emit = defineEmits<{
    cycleStatus: [task: Task];
    editTask: [task: Task];
    openDatePicker: [taskId: string];
}>();

const taskStore = useTaskStore();
const newSubTaskTitleMap = ref<Record<string, string>>({});
const nowTimestamp = ref(Date.now());
const editingSubTaskDetail = ref<{
    taskId: string;
    subTask: SubTask;
    autoFocusSchedule: boolean;
} | null>(null);
const activeSubTaskDrop = ref<{ subTaskId: string; placeAfter: boolean } | null>(null);
let nowTimer: ReturnType<typeof setInterval> | null = null;

const vFocus = { mounted: (element: HTMLElement) => element.focus() };

const {
    localTasks,
    draggedSubTask,
    isNesting,
    parentRef,
    activeDropTargetTaskId,
    canNest,
    onParentDragOver,
    onSortDragStart,
    onParentDrop,
    onSubTaskDragStart,
    onSubTaskDragEnd,
    onContainerDrop
} = useTaskTreeDrag(taskStore);

const {
    editingTaskId,
    editingSubTaskId,
    editingTitle,
    handlePressStart,
    handlePressEnd,
    startEditTask,
    startEditSubTask,
    saveTitleEdit,
    cancelTitleEdit
} = useTaskInlineEdit(taskStore);

const isPendingComplete = (task: Task) => props.pendingComplete[task.id] !== undefined;
const isOverdue = (task: Task) => isTaskOverdue(task, nowTimestamp.value);

const addSubTask = (taskId: string) => {
    const title = (newSubTaskTitleMap.value[taskId] || '').trim();
    if (!title) return;
    taskStore.addSubTask(taskId, title);
    newSubTaskTitleMap.value[taskId] = '';
};

const cycleSubTaskStatus = (task: Task, step: SubTask) => {
    const statuses: SubTask['status'][] = ['todo', 'doing', 'done'];
    const currentIndex = statuses.indexOf(step.status);
    taskStore.updateSubTaskStatus(task.id, step.id, statuses[(currentIndex + 1) % statuses.length]);
};

const toggleSubTasks = (task: Task) => {
    taskStore.updateTask(task.id, { expanded: !task.expanded });
};

const openSubTaskEditor = (taskId: string, subTask: SubTask, autoFocusSchedule = false) => {
    editingSubTaskDetail.value = { taskId, subTask, autoFocusSchedule };
};

const saveSubTaskEditor = (updates: Partial<SubTask>) => {
    if (!editingSubTaskDetail.value) return;
    taskStore.updateSubTask(editingSubTaskDetail.value.taskId, editingSubTaskDetail.value.subTask.id, updates);
    editingSubTaskDetail.value = null;
};

const updateSubTaskDropTarget = (event: DragEvent, taskId: string, targetSubTaskId: string) => {
    const dragged = draggedSubTask.value;
    if (!dragged || dragged.parentId !== taskId || dragged.subTaskId === targetSubTaskId) {
        activeSubTaskDrop.value = null;
        return;
    }

    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const target = event.currentTarget as HTMLElement;
    const bounds = target.getBoundingClientRect();
    activeSubTaskDrop.value = {
        subTaskId: targetSubTaskId,
        placeAfter: event.clientY >= bounds.top + bounds.height / 2
    };
};

const dropSubTask = (taskId: string, targetSubTaskId: string) => {
    const dragged = draggedSubTask.value;
    const dropTarget = activeSubTaskDrop.value;
    if (
        dragged
        && dragged.parentId === taskId
        && dragged.subTaskId !== targetSubTaskId
        && dropTarget?.subTaskId === targetSubTaskId
    ) {
        taskStore.reorderSubTask(taskId, dragged.subTaskId, targetSubTaskId, dropTarget.placeAfter);
    }
    activeSubTaskDrop.value = null;
};

const finishSubTaskDrag = () => {
    activeSubTaskDrop.value = null;
    onSubTaskDragEnd();
};

onMounted(() => {
    nowTimer = setInterval(() => { nowTimestamp.value = Date.now(); }, 30_000);
});

onUnmounted(() => {
    if (nowTimer) clearInterval(nowTimer);
});
</script>

<template>
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
                        @click.stop="emit('cycleStatus', task)"
                        :title="isPendingComplete(task) ? 'クリックでTODOに戻す' : ('ステータスをサイクル: ' + (task.status || 'todo'))">
                    <span v-if="isPendingComplete(task)">取消 {{ pendingComplete[task.id] }}</span>
                    <span v-else-if="task.completed || task.status === 'done'">DONE</span>
                    <span v-else-if="task.status === 'doing'">DOING</span>
                    <span v-else-if="task.status === 'paused'">PAUSED</span>
                    <span v-else>TODO</span>
                </button>

                <!-- タイトル -->
                <div class="task-title-container flex-grow-1">
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
                <div class="pause-resume-buttons">
                    <button v-if="task.status === 'doing'"
                            class="action-icon-btn pause-task-btn"
                            @click.stop="taskStore.pauseTask(task.id)"
                            title="一時中断">
                        <i class="pi pi-pause" aria-hidden="true"></i>
                    </button>
                    <button v-else-if="task.status === 'paused'"
                            class="action-icon-btn resume-task-btn"
                            @click.stop="taskStore.resumeTask(task.id)"
                            title="タスクを再開">
                        <i class="pi pi-play" aria-hidden="true"></i>
                    </button>
                </div>

                <!-- カレンダー設定ボタン / 予定日時表示 -->
                <div class="calendar-actions-wrapper">
                    <button
                        class="action-icon-btn calendar-set-btn"
                        @click.stop="emit('openDatePicker', task.id)"
                        :title="task.scheduledAt ? '予定日時を変更' : '予定日時を設定'"
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
                    role="button"
                    tabindex="0"
                    :aria-expanded="Boolean(task.expanded)"
                    :title="task.expanded ? 'サブタスクを折り畳む' : 'サブタスクを展開する'"
                    @click="toggleSubTasks(task)"
                    @keyup.enter="toggleSubTasks(task)"
                    @keyup.space.prevent="toggleSubTasks(task)"
                >
                    <i class="pi" :class="task.expanded ? 'pi-chevron-down' : 'pi-chevron-right'"></i>
                    {{ task.steps.filter(s => s.completed).length }}/{{ task.steps.length }}
                </div>

                <!-- 編集・削除ボタン群 -->
                <TaskActionButtons
                    :task="task"
                    :show-delete-mode="showDeleteMode"
                    @edit="emit('editTask', $event)"
                    @delete="taskStore.deleteTask($event.id)"
                />
            </div>



            <!-- サブタスク（Step）展開エリア -->
            <div class="subtasks-container" v-if="task.steps.length > 0 && task.expanded">
                <div class="subtask-list">
                    <!-- 接続線 -->
                    <div class="guide-line"></div>

                    <!-- サブタスク項目 -->
                    <div
                        v-for="step in task.steps"
                        :key="step.id"
                        class="subtask-item"
                        :class="{
                            'drop-before': activeSubTaskDrop?.subTaskId === step.id && !activeSubTaskDrop.placeAfter,
                            'drop-after': activeSubTaskDrop?.subTaskId === step.id && activeSubTaskDrop.placeAfter
                        }"
                        draggable="true"
                        @dragstart="onSubTaskDragStart($event, task.id, step.id)"
                        @dragover.prevent.stop="updateSubTaskDropTarget($event, task.id, step.id)"
                        @drop.prevent.stop="dropSubTask(task.id, step.id)"
                        @dragend="finishSubTaskDrag"
                    >
                        <!-- 子タスク用ドラッグハンドル (〇から変更、戻すため) -->
                        <div class="drag-handle subtask-drag-handle" title="ドラッグして並べ替え / 親タスクに戻す">
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

                        <div class="subtask-title-container flex-grow-1">
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

                        <span v-if="step.scheduledAt" class="subtask-schedule" :title="step.scheduledAt">
                            {{ getScheduledDisplay(step.scheduledAt) }}
                        </span>

                        <div class="subtask-controls">
                            <button
                                v-if="step.status === 'doing'"
                                class="action-icon-btn"
                                title="サブタスクを一時中断"
                                aria-label="サブタスクを一時中断"
                                @click.stop="taskStore.pauseSubTask(task.id, step.id)"
                            >
                                ⏸️
                            </button>
                            <button
                                v-else-if="step.status === 'paused'"
                                class="action-icon-btn"
                                title="サブタスクを再開"
                                aria-label="サブタスクを再開"
                                @click.stop="taskStore.resumeSubTask(task.id, step.id)"
                            >
                                ▶️
                            </button>
                            <button
                                class="action-icon-btn"
                                :class="{ 'has-schedule': Boolean(step.scheduledAt) }"
                                title="サブタスクの日時を設定"
                                :aria-label="`サブタスク「${step.title}」の日時を設定`"
                                @click.stop="openSubTaskEditor(task.id, step, true)"
                            >
                                <i class="pi pi-calendar"></i>
                            </button>
                            <button
                                class="action-icon-btn"
                                title="サブタスクを編集"
                                :aria-label="`サブタスク「${step.title}」を編集`"
                                @click.stop="openSubTaskEditor(task.id, step)"
                            >
                                <i class="pi pi-pencil"></i>
                            </button>
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
                            @keyup.enter="addSubTask(task.id)"
                        />
                        <Button
                            icon="pi pi-plus"
                            class="p-button-text p-button-sm p-button-secondary"
                            @click="addSubTask(task.id)"
                            :disabled="!(newSubTaskTitleMap[task.id] || '').trim()"
                        />
                    </div>
                </div>
            </div>
        </div>

        <div v-if="taskStore.filteredTasks.length === 0" class="empty-state">
            タスクがありません。下部フォームから追加しましょう！
        </div>

        <SubTaskEditorPanel
            v-if="editingSubTaskDetail"
            :sub-task="editingSubTaskDetail.subTask"
            :auto-focus-schedule="editingSubTaskDetail.autoFocusSchedule"
            @close="editingSubTaskDetail = null"
            @save="saveSubTaskEditor"
        />
    </div>
</template>

<style scoped src="./TaskTodoView.css"></style>
