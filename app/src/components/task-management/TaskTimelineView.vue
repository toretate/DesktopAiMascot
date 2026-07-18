<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useTaskStore, type Task } from '../../store/task';
import TaskActionButtons from './TaskActionButtons.vue';
import { getScheduledDisplay, isTaskOverdue } from './taskDisplayUtils';

const props = defineProps<{
    pendingComplete: Record<string, number>;
    showDeleteMode: boolean;
}>();

const emit = defineEmits<{
    cycleStatus: [task: Task];
    editTask: [task: Task];
}>();

const taskStore = useTaskStore();
const nowTimestamp = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | null = null;

const isPendingComplete = (task: Task) => props.pendingComplete[task.id] !== undefined;
const isOverdue = (task: Task) => isTaskOverdue(task, nowTimestamp.value);
const getCategoryName = (categoryId: string) => {
    return taskStore.categories.find(category => category.id === categoryId)?.name ?? '未分類';
};

onMounted(() => {
    nowTimer = setInterval(() => { nowTimestamp.value = Date.now(); }, 30_000);
});

onUnmounted(() => {
    if (nowTimer) clearInterval(nowTimer);
});
</script>

<template>
    <div class="timeline-view">
        <div v-for="task in taskStore.timelineTasks" :key="task.id" class="timeline-item">
            <div class="timeline-marker">
                <i :class="task.completed ? 'pi pi-check-circle checked' : (isOverdue(task) ? 'pi pi-exclamation-circle overdue-icon' : 'pi pi-circle-off unchecked')"></i>
                <div class="timeline-line"></div>
            </div>
            <div class="timeline-limit" :class="{ overdue: isOverdue(task) }">
                <span v-if="task.scheduledAt">{{ getScheduledDisplay(task.scheduledAt) }}</span>
                <span v-else class="unscheduled">—</span>
            </div>
            <div class="timeline-content-card" :class="{ completed: task.completed, overdue: isOverdue(task) }">
                <div class="timeline-row-main">
                    <button
                        class="status-badge"
                        :class="isPendingComplete(task) ? 'pending-done' : (task.completed || task.status === 'done' ? 'done' : (task.status === 'doing' || task.status === 'paused' ? 'doing' : 'todo'))"
                        :title="isPendingComplete(task) ? 'クリックでTODOに戻す' : `ステータスをサイクル: ${task.status || 'todo'}`"
                        @click.stop="emit('cycleStatus', task)"
                    >
                        <span v-if="isPendingComplete(task)">取消 {{ pendingComplete[task.id] }}</span>
                        <span v-else-if="task.completed || task.status === 'done'">DONE</span>
                        <span v-else-if="task.status === 'doing'">DOING</span>
                        <span v-else-if="task.status === 'paused'">PAUSED</span>
                        <span v-else>TODO</span>
                    </button>
                    <h4 class="timeline-task-title" :class="{ completed: task.completed }">{{ task.title }}</h4>
                    <span class="timeline-cat-badge">{{ getCategoryName(task.categoryId) }}</span>
                    <TaskActionButtons
                        :task="task"
                        :show-delete-mode="showDeleteMode"
                        @edit="emit('editTask', $event)"
                        @delete="taskStore.deleteTask($event.id)"
                    />
                </div>
            </div>
        </div>
        <div v-if="taskStore.tasks.length === 0" class="empty-state">タスクがありません。</div>
    </div>
</template>

<style scoped>
.timeline-view { display: flex; flex-direction: column; padding-left: 6px; flex-grow: 1; justify-content: flex-end; }
.timeline-item { display: flex; gap: 8px; position: relative; }
.timeline-marker { display: flex; flex-direction: column; align-items: center; }
.timeline-marker i { font-size: 12px; }
.timeline-marker i.overdue-icon { color: #ef4444; }
.timeline-line { width: 2px; background: #e2e8f0; flex-grow: 1; min-height: 12px; }
.timeline-item:last-child .timeline-line { display: none; }
.timeline-limit { display: flex; align-items: flex-start; justify-content: flex-end; padding-top: 5px; min-width: 52px; flex-shrink: 0; font-size: 10px; font-weight: 600; color: #3b82f6; white-space: nowrap; }
.timeline-limit.overdue { color: #dc2626; }
.unscheduled { color: #cbd5e1; font-weight: 500; }
.timeline-content-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px 8px; margin-bottom: 5px; flex-grow: 1; min-width: 0; }
.timeline-content-card.overdue { background: #fef2f2; border-color: #fecaca; border-left: 3px solid #ef4444; }
.timeline-content-card.completed { background: #f8fafc; }
.timeline-row-main { display: flex; align-items: center; gap: 6px; min-width: 0; }
.timeline-task-title { flex-grow: 1; min-width: 0; font-size: 12px; font-weight: 600; color: #334155; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.timeline-task-title.completed { color: #94a3b8; text-decoration: line-through; }
.timeline-cat-badge { font-size: 9px; font-weight: 600; color: #3b82f6; background: #eff6ff; padding: 1px 4px; border-radius: 3px; flex-shrink: 0; }
.status-badge { border: none; border-radius: 3px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; height: 16px; padding: 0 5px; flex-shrink: 0; font-size: 9px; font-weight: 700; }
.status-badge.todo { color: #64748b; background: #f1f5f9; }
.status-badge.doing { color: #d97706; background: #fef3c7; }
.status-badge.done { color: #059669; background: #d1fae5; }
.status-badge.pending-done { color: #dc2626; background: #fee2e2; }
.empty-state { text-align: center; color: #64748b; padding: 24px 0; font-size: 12px; }
</style>
