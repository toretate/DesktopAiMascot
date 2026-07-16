import type { Task } from '../../store/task';

export const isTaskOverdue = (task: Task, nowTimestamp: number) => {
    if (!task.scheduledAt || task.completed || task.status === 'done') return false;
    return new Date(task.scheduledAt).getTime() < nowTimestamp;
};

export const formatTaskTime = (isoString: string) => {
    const date = new Date(isoString);
    if (!Number.isFinite(date.getTime())) return '';

    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const formatScheduledDate = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (!Number.isFinite(date.getTime())) return '';

    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const getScheduledDisplay = (scheduledAtIso: string, now = new Date()) => {
    if (!scheduledAtIso) return '';
    const scheduled = new Date(scheduledAtIso);
    const diffMs = scheduled.getTime() - now.getTime();
    if (!Number.isFinite(diffMs)) return '';

    const diffMin = Math.floor(diffMs / 60_000);
    const diffHour = Math.floor(diffMs / 3_600_000);
    const diffDay = Math.floor(diffMs / 86_400_000);

    if (diffMs < 0) {
        const absoluteDiffMs = Math.abs(diffMs);
        const absoluteDiffMin = Math.floor(absoluteDiffMs / 60_000);
        const absoluteDiffHour = Math.floor(absoluteDiffMs / 3_600_000);
        const absoluteDiffDay = Math.floor(absoluteDiffMs / 86_400_000);

        if (absoluteDiffMin < 60) return `${absoluteDiffMin}分超過`;
        if (absoluteDiffHour < 24) return `${absoluteDiffHour}時間超過`;
        return `${absoluteDiffDay}日超過`;
    }

    if (diffMin <= 60) return `後${diffMin}分[${scheduled.getMinutes()}分]`;
    if (diffHour <= 24) return `後${diffHour}時[${scheduled.getHours()}時]`;

    if (diffDay <= 6) {
        if (diffDay === 1 || (scheduled.getDate() - now.getDate() === 1 && diffDay <= 1.5)) {
            return '明日';
        }
        return `後${diffDay}日[${scheduled.getDate()}日]`;
    }

    const isSameYear = now.getFullYear() === scheduled.getFullYear();
    const isSameMonth = isSameYear && now.getMonth() === scheduled.getMonth();
    if (isSameMonth) return `${scheduled.getDate()}日`;
    if (isSameYear) return `${scheduled.getMonth() + 1}/${scheduled.getDate()}`;

    return `${String(scheduled.getFullYear()).slice(-2)}/${scheduled.getMonth() + 1}/${scheduled.getDate()}`;
};
