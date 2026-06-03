import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { useCounterStore } from '../counter';

describe('useCounterStore', () => {
    beforeEach(() => {
        // テストごとに新しく Pinia インスタンスを作成してアクティブにする
        setActivePinia(createPinia());
    });

    it('count - 初期状態のカウント値は0であること', () => {
        const store = useCounterStore();
        expect(store.count).toBe(0);
    });

    it('doubleCount - 初期状態の2倍カウント値は0であること', () => {
        const store = useCounterStore();
        expect(store.doubleCount).toBe(0);
    });

    it('increment - カウント値を1増やすことができること', () => {
        const store = useCounterStore();
        store.increment();
        expect(store.count).toBe(1);
        expect(store.doubleCount).toBe(2);
    });

    it('decrement - カウント値を1減らすことができること', () => {
        const store = useCounterStore();
        store.decrement();
        expect(store.count).toBe(-1);
        expect(store.doubleCount).toBe(-2);
    });

    it('reset - カウント値を0にリセットできること', () => {
        const store = useCounterStore();
        store.increment();
        store.increment();
        expect(store.count).toBe(2);
        
        store.reset();
        expect(store.count).toBe(0);
    });
});
