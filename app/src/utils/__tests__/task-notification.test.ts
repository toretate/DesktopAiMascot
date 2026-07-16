import { describe, expect, it } from 'vitest';
import { isMeetingInProgress, shouldSpeakTaskNotification } from '../task-notification';

const meetingTask = {
    categoryId: 'meeting',
    completed: false,
    status: 'todo',
    scheduledAt: '2026-07-16T10:00:00+09:00',
    scheduledEndAt: '2026-07-16T11:00:00+09:00'
};

describe('task-notification 会議中ミュート判定', () => {
    it('isMeetingInProgress - 会議の開始以上かつ終了未満なら会議中になること', () => {
        expect(isMeetingInProgress([meetingTask], new Date('2026-07-16T10:00:00+09:00'))).toBe(true);
        expect(isMeetingInProgress([meetingTask], new Date('2026-07-16T10:59:59+09:00'))).toBe(true);
        expect(isMeetingInProgress([meetingTask], new Date('2026-07-16T11:00:00+09:00'))).toBe(false);
    });

    it('isMeetingInProgress - 完了済みまたは会議以外のカテゴリは会議中にならないこと', () => {
        expect(isMeetingInProgress([{ ...meetingTask, completed: true }], new Date('2026-07-16T10:30:00+09:00'))).toBe(false);
        expect(isMeetingInProgress([{ ...meetingTask, categoryId: 'default' }], new Date('2026-07-16T10:30:00+09:00'))).toBe(false);
    });

    it('shouldSpeakTaskNotification - ミュート設定が有効な会議中だけ音声を抑制すること', () => {
        const duringMeeting = new Date('2026-07-16T10:30:00+09:00');

        expect(shouldSpeakTaskNotification(true, [meetingTask], duringMeeting)).toBe(false);
        expect(shouldSpeakTaskNotification(false, [meetingTask], duringMeeting)).toBe(true);
        expect(shouldSpeakTaskNotification(true, [meetingTask], new Date('2026-07-16T11:30:00+09:00'))).toBe(true);
    });
});
