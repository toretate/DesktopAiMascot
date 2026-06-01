import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

/**
 * 動作確認用のサンプルカウンター初期ストア
 */
export const useCounterStore = defineStore('counter', () => {
    // 状態（State）
    const count = ref(0);
    
    // ゲッター（Getters）
    const doubleCount = computed(() => count.value * 2);
    
    // アクション（Actions）
    function increment() {
        count.value++;
    }
    
    function decrement() {
        count.value--;
    }
    
    function reset() {
        count.value = 0;
    }

    return {
        count,
        doubleCount,
        increment,
        decrement,
        reset
    };
});
