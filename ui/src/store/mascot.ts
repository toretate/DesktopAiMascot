import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMascotStore = defineStore('mascot', () => {
    // ---- State ----
    // 現在の表情（sillyTavern28感情互換）
    const currentEmotion = ref('neutral');
    // 音声発声中フラグ
    const isSpeaking = ref(false);
    // アプリケーションローディング（応答生成中など）フラグ
    const isLoading = ref(false);
    // ラジオモード中フラグ
    const isRadioMode = ref(false);

    // ---- Actions ----
    const setEmotion = (emotion: string) => {
        currentEmotion.value = emotion;
    };

    const setSpeaking = (speaking: boolean) => {
        isSpeaking.value = speaking;
    };

    const setLoading = (loading: boolean) => {
        isLoading.value = loading;
    };

    const setRadioMode = (radioMode: boolean) => {
        isRadioMode.value = radioMode;
    };

    return {
        currentEmotion,
        isSpeaking,
        isLoading,
        isRadioMode,
        setEmotion,
        setSpeaking,
        setLoading,
        setRadioMode
    };
});
