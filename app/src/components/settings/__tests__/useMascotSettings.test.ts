// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMascotSettings } from '../composables/useMascotSettings';
import { createPinia, setActivePinia } from 'pinia';
import { useConfigStore } from '../../../store/config';

vi.mock('../../../skills/expression-alignment/auto-align-v2', () => ({
    autoAlignBatch: vi.fn(),
    CONFIDENCE_THRESHOLD: 0.5
}));
vi.mock('../../../skills/expression-alignment/expression-auto-align', () => ({
    isValidImageSource: vi.fn().mockReturnValue(true)
}));
vi.mock('../../../mascots/MascotImageSetBuilder', () => ({
    MascotImageSetBuilder: {
        CreateFromAssets: vi.fn().mockReturnValue({
            getFrontImage: vi.fn().mockReturnValue({ path: 'front.png' })
        })
    }
}));

describe('useMascotSettings', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        
        // window.electronAPI のモックを設定
        (window as any).electronAPI = {
            getMascotPrompts: vi.fn().mockResolvedValue({
                identity: 'テストの役割設定',
                soul: 'テストの性格',
                user: 'テストの関係性',
                agents: 'テストの行動規範',
                memory: 'テストの長期記憶'
            }),
            previewMascotState: vi.fn(),
            getAppConfig: vi.fn().mockResolvedValue({
                googleAiStudioApiKey: 'test-api-key'
            })
        };
    });

    it('initEditingMascot - マスコット設定の初期ロード時に指定されたアクティブマスコットが読み込まれること', () => {
        const configStore = useConfigStore();
        configStore.mascots = [
            {
                id: 'mascot_a',
                name: 'マスコットA',
                avatar: '🤖',
                profile: 'プロフィールA',
                currentOutfitId: 'outfit_a',
                aiConfig: {
                    chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                    voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
                },
                assets: { outfits: [], expressions: [], poses: [] }
            }
        ];

        const props = {
            mascots: configStore.mascots,
            activeMascotId: 'mascot_a',
            geminiApiKey: 'test-api-key'
        };

        const emit = vi.fn();

        const { editingMascot, initEditingMascot } = useMascotSettings(props, emit);
        initEditingMascot();

        expect(editingMascot.value.id).toBe('mascot_a');
        expect(editingMascot.value.name).toBe('マスコットA');
    });

    it('setDefaultExpression - 指定した表情IDが通常表示の表情として保存され、プレビューと設定保存イベントが送信されること', () => {
        const configStore = useConfigStore();
        const mascotMock = {
            id: 'mascot_b',
            name: 'マスコットB',
            avatar: '🐱',
            profile: 'プロフィールB',
            currentOutfitId: 'outfit_b',
            aiConfig: {
                chat: { engine: 'gemini', model: 'gemini-2.0-flash-exp', temperature: 0.7 },
                voice: { engine: 'voicevox', speaker_id: 2, style: 'normal' }
            },
            assets: {
                outfits: [],
                expressions: [
                    { id: 'expr_normal', name: '通常', path: 'normal.png' },
                    { id: 'expr_joy', name: '喜び', path: 'joy.png' }
                ],
                poses: []
            }
        };
        configStore.mascots = [mascotMock];

        const props = {
            mascots: configStore.mascots,
            activeMascotId: 'mascot_b',
            geminiApiKey: 'test-api-key'
        };

        const emit = vi.fn();

        const { editingMascot, initEditingMascot, setDefaultExpression } = useMascotSettings(props, emit);
        initEditingMascot();

        // 通常表示の表情を「喜び」に設定
        setDefaultExpression('expr_joy');

        expect(editingMascot.value.defaultExpressionId).toBe('expr_joy');
        expect(window.electronAPI!.previewMascotState).toHaveBeenCalled();
        expect(emit).toHaveBeenCalledWith('save-settings');
    });
});
