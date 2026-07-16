let checkInterval: any = null;

interface MeetingSchedule {
    categoryId?: string;
    completed?: boolean;
    status?: string;
    scheduledAt?: string;
    scheduledEndAt?: string;
}

export const isMeetingInProgress = (tasks: MeetingSchedule[], now = new Date()) => {
    const nowTime = now.getTime();
    return tasks.some(task => {
        if (
            task.categoryId !== 'meeting' ||
            task.completed ||
            task.status === 'done' ||
            !task.scheduledAt ||
            !task.scheduledEndAt
        ) {
            return false;
        }

        const startTime = new Date(task.scheduledAt).getTime();
        const endTime = new Date(task.scheduledEndAt).getTime();
        return Number.isFinite(startTime) &&
            Number.isFinite(endTime) &&
            startTime <= nowTime &&
            nowTime < endTime;
    });
};

export const shouldSpeakTaskNotification = (
    muteNotificationsDuringMeetings: boolean,
    tasks: MeetingSchedule[],
    now = new Date()
) => !muteNotificationsDuringMeetings || !isMeetingInProgress(tasks, now);

// 定期監視関数
export const startNotificationCheck = () => {
    if (typeof window === 'undefined') return;
    if (checkInterval) clearInterval(checkInterval);

    checkInterval = setInterval(async () => {
        // useTaskStore を動的インポートして状態を取得
        const taskStore = (await import('../store/task')).useTaskStore();

        if (!taskStore.enableNotification) return;

        const now = new Date();
        const minutesBefore = taskStore.notificationMinutes;

        // 予定日時があり、まだ通知されておらず、現在時刻が「予定時刻の n 分前」を過ぎているタスクを検索
        const tasksToNotify = taskStore.tasks.filter((t: any) => {
            if (!t.scheduledAt || t.completed || t.notified) return false;
            
            try {
                const scheduledTime = new Date(t.scheduledAt);
                const notifyThresholdTime = new Date(scheduledTime.getTime() - minutesBefore * 60 * 1000);
                const tenMinutesAfter = new Date(scheduledTime.getTime() + 10 * 60 * 1000);
                
                return now >= notifyThresholdTime && now <= tenMinutesAfter;
            } catch (e) {
                return false;
            }
        });

        for (const task of tasksToNotify) {
            // 即座に通知済みフラグを立てて保存 (二重通知防止)
            task.notified = true;
            taskStore.saveToLocalStorage();

            const text = `予定の、${minutesBefore}分前になりました。${task.title}、の時間です。`;
            console.log(`[TaskNotification] Notifying task: ${task.title}`);
            
            if (window.electronAPI) {
                window.electronAPI.triggerTimerNotification(text, {
                    notificationId: `task-reminder:${task.id}:${task.scheduledAt}`,
                    speak: shouldSpeakTaskNotification(
                        taskStore.muteNotificationsDuringMeetings,
                        taskStore.tasks,
                        now
                    )
                });
            }
        }
    }, 10000); // 10秒に1回チェック
};

export const stopNotificationCheck = () => {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
};
