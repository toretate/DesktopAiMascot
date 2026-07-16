import { onUnmounted, ref } from 'vue';
import { useTaskStore, type Task } from '../../../store/task';

export const useTaskCompletionGrace = (taskStore: ReturnType<typeof useTaskStore>) => {
    const pendingComplete = ref<Record<string, number>>({});
    const pendingTimers: Record<string, ReturnType<typeof setTimeout>> = {};
    const pendingIntervals: Record<string, ReturnType<typeof setInterval>> = {};

    const isPendingComplete = (task: Task) => pendingComplete.value[task.id] !== undefined;

    const clearPendingTimers = (taskId: string) => {
        if (pendingTimers[taskId]) {
            clearTimeout(pendingTimers[taskId]);
            delete pendingTimers[taskId];
        }
        if (pendingIntervals[taskId]) {
            clearInterval(pendingIntervals[taskId]);
            delete pendingIntervals[taskId];
        }
        if (pendingComplete.value[taskId] !== undefined) {
            const nextPending = { ...pendingComplete.value };
            delete nextPending[taskId];
            pendingComplete.value = nextPending;
        }
    };

    const startPendingComplete = (task: Task) => {
        const graceSeconds = taskStore.completionGraceSeconds ?? 5;
        if (graceSeconds <= 0) {
            taskStore.completeTask(task.id);
            return;
        }

        clearPendingTimers(task.id);
        pendingComplete.value = { ...pendingComplete.value, [task.id]: graceSeconds };
        pendingIntervals[task.id] = setInterval(() => {
            const remaining = (pendingComplete.value[task.id] ?? 1) - 1;
            if (remaining > 0) {
                pendingComplete.value = { ...pendingComplete.value, [task.id]: remaining };
            }
        }, 1000);
        pendingTimers[task.id] = setTimeout(() => {
            clearPendingTimers(task.id);
            taskStore.completeTask(task.id);
        }, graceSeconds * 1000);
    };

    const cancelPendingComplete = (task: Task) => {
        clearPendingTimers(task.id);
        taskStore.resetTask(task.id);
    };

    const cycleTaskStatus = (task: Task) => {
        if (isPendingComplete(task)) {
            cancelPendingComplete(task);
            return;
        }
        if (task.completed || task.status === 'done') {
            taskStore.resetTask(task.id);
        } else if (task.status === 'todo' || !task.status) {
            taskStore.startTask(task.id);
        } else if (task.status === 'doing' || task.status === 'paused') {
            startPendingComplete(task);
        }
    };

    onUnmounted(() => {
        Object.keys(pendingTimers).forEach(clearPendingTimers);
        Object.keys(pendingIntervals).forEach(clearPendingTimers);
    });

    return {
        pendingComplete,
        isPendingComplete,
        cycleTaskStatus,
        clearPendingTimers
    };
};
