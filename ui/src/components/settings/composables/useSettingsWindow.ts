import { ref, onMounted } from 'vue';
import { useConfigStore } from '../../../store/config';
import { storeToRefs } from 'pinia';

interface MascotAsset {
    id: string;
    name: string;
    path: string;
    originalPath?: string;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    rotation?: number;
    expressions?: MascotAsset[];
}

interface MascotData {
    id: string;
    name: string;
    avatar: string;
    profile: string;
    currentOutfitId?: string;
    currentPoseId?: string;
    defaultExpressionId?: string;
    aiConfig: {
        chat: { engine: string; model: string; temperature: number; };
        voice: { engine: string; speaker_id: number; style: string; };
    };
    assets: { outfits: MascotAsset[]; expressions: MascotAsset[]; poses: MascotAsset[]; };
}

export function useSettingsWindow() {
    const configStore = useConfigStore();

    const {
        googleAiStudioApiKey: geminiApiKey,
        mascots,
        activeMascotId
    } = storeToRefs(configStore);

    const activeMenu = ref('mascot');
    const saveStatus = ref('設定を保存');
    const isSaving = ref(false);

    // 28個の感情スロットの初期化保証
    const ensure28Expressions = (expressions: any[]): any[] => {
        const defaultEmotions = [
            '通常', '喜び', '怒り', '悲しみ', '驚き',
            '面白がり', '苛立ち', '賛同', '気遣い', '混乱',
            '好奇心', '欲求', '失望', '不賛成', '嫌悪',
            '当惑', '興奮', '恐れ', '感謝', '深い悲しみ',
            '愛情', '緊張', '楽観', '誇り', '気づき',
            '安堵', '後悔', '賞賛'
        ];
        
        const existingMap = new Map<string, any>();
        if (Array.isArray(expressions)) {
            expressions.forEach(e => {
                if (e && e.name) {
                    existingMap.set(e.name.trim(), e);
                }
            });
        }
        
        return defaultEmotions.map(emotion => {
            const existing = existingMap.get(emotion);
            return {
                id: existing?.id || 'expr_' + emotion,
                name: emotion,
                path: existing?.path || '',
                offsetX: existing?.offsetX ?? 0,
                offsetY: existing?.offsetY ?? 0,
                scale: existing?.scale ?? 1.0
            };
        });
    };

    // 設定データのロード
    onMounted(async () => {
        await configStore.loadConfig();

        if (mascots.value.length === 0) {
            mascots.value = [{
                id: 'mascot_default',
                name: 'デフォルトロボット',
                avatar: '🤖',
                profile: '親しみやすいベーシックなAIマスコットです。明るく元気にユーザーのお手伝いをします。',
                aiConfig: {
                    chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                    voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
                },
                assets: {
                    outfits: [],
                    expressions: ensure28Expressions([]),
                    poses: []
                }
            }];
        } else {
            mascots.value.forEach(m => {
                m.assets.expressions = ensure28Expressions(m.assets.expressions);
                if (Array.isArray(m.assets.outfits)) {
                    m.assets.outfits.forEach((o: any) => {
                        o.expressions = ensure28Expressions(o.expressions || []);
                    });
                }
            });
        }

        if (mascots.value.length > 0 && !activeMascotId.value) {
            activeMascotId.value = mascots.value[0].id;
        }
    });

    const handleLiveUpdate = () => {
        // ライブアップデートのプレースホルダー
    };

    // マスコットの追加処理
    const addMascot = () => {
        const newId = 'mascot_' + Date.now();
        const newMascot = {
            id: newId,
            name: '新しいマスコット',
            avatar: '🤖',
            profile: '新しいAIマスコットです。',
            aiConfig: {
                chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
            },
            assets: {
                outfits: [],
                expressions: ensure28Expressions([]),
                poses: []
            }
        };
        mascots.value.push(newMascot);
        activeMascotId.value = newId;
        saveSettings();
    };

    // マスコットの削除処理
    const deleteMascot = (mascotId: string) => {
        if (mascots.value.length <= 1) {
            alert('最後の1つのマスコットは削除できません。');
            return;
        }
        const targetMascot = mascots.value.find(m => m.id === mascotId);
        const mascotName = targetMascot ? targetMascot.name : 'このマスコット';
        if (!confirm(`マスコット「${mascotName}」を削除しますか？`)) {
            return;
        }
        
        mascots.value = mascots.value.filter(m => m.id !== mascotId);
        
        if (activeMascotId.value === mascotId) {
            activeMascotId.value = mascots.value[0].id;
        }
        saveSettings();
    };

    // 設定の保存処理
    const saveSettings = async () => {
        isSaving.value = true;
        saveStatus.value = '保存中...';

        await configStore.saveConfig();

        setTimeout(() => {
            saveStatus.value = '保存完了！';
            isSaving.value = false;

            setTimeout(() => {
                saveStatus.value = '設定を保存';
            }, 2000);
        }, 600);
    };

    const quitApp = () => {
        if (window.electronAPI) {
            window.electronAPI.quitApp();
        }
    };

    const menuItems = ref([
        { name: 'マスコット', value: 'mascot', icon: 'pi pi-user' },
        { name: 'チャットAI', value: 'chat', icon: 'pi pi-comments' },
        { name: 'ウィンドウ設定', value: 'chatwindow', icon: 'pi pi-window-maximize' },
        { name: '音声AI', value: 'voice', icon: 'pi pi-volume-up' },
        { name: '画像AI', value: 'image', icon: 'pi pi-image' },
        { name: '動画AI', value: 'video', icon: 'pi pi-video' },
        { name: 'ツール設定', value: 'tool', icon: 'pi pi-wrench' },
        { name: 'APIキー', value: 'apikey', icon: 'pi pi-key' }
    ]);

    const goBack = () => {
        if (window.electronAPI && !window.electronAPI.isWeb && window.location.hash.includes('settings')) {
            window.close();
        } else if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.hash = '#integrated';
        }
    };

    return {
        geminiApiKey,
        mascots,
        activeMascotId,
        activeMenu,
        saveStatus,
        isSaving,
        menuItems,
        ensure28Expressions,
        handleLiveUpdate,
        addMascot,
        deleteMascot,
        saveSettings,
        quitApp,
        goBack
    };
}
