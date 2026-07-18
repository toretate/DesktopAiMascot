<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { useTaskStore, type SubTask, type Task } from '../../store/task';
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
let nowTimer: ReturnType<typeof setInterval> | null = null;

const vFocus = { mounted: (element: HTMLElement) => element.focus() };

const {
    localTasks,
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
                        @click.stop="emit('openDatePicker', task.id)"
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

                <!-- 編集・削除ボタン群 -->
                <TaskActionButtons
                    :task="task"
                    :show-delete-mode="showDeleteMode"
                    @edit="emit('editTask', $event)"
                    @delete="taskStore.deleteTask($event.id)"
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
    </div>
</template>

<style scoped src="./TaskTodoView.css"></style>
