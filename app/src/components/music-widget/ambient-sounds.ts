export const AMBIENT_SOUND_IDS = [
    'rain-light',
    'rain-heavy',
    'campfire',
    'vinyl',
    'wind',
    'river',
    'waves',
    'forest-night',
    'forest-day'
] as const;

export type AmbientSoundId = typeof AMBIENT_SOUND_IDS[number];

export interface AmbientSoundDefinition {
    id: AmbientSoundId;
    label: string;
    icon: string;
    variantGroup?: string;
    source: string | null;
}

/** 音源を追加したら source に public ディレクトリからのURLを設定する。 */
export const AMBIENT_SOUNDS: AmbientSoundDefinition[] = [
    { id: 'rain-light', label: '雨・弱', icon: 'pi-cloud', variantGroup: 'rain', source: null },
    { id: 'rain-heavy', label: '雨・強', icon: 'pi-cloud', variantGroup: 'rain', source: null },
    { id: 'campfire', label: '焚き火', icon: 'pi-sun', source: null },
    { id: 'vinyl', label: 'レコードノイズ', icon: 'pi-circle', source: null },
    { id: 'wind', label: '風', icon: 'pi-send', source: null },
    { id: 'river', label: '川', icon: 'pi-wave-pulse', source: null },
    { id: 'waves', label: '波', icon: 'pi-wave-pulse', source: null },
    { id: 'forest-night', label: '夜の森', icon: 'pi-moon', source: null },
    { id: 'forest-day', label: '昼の森', icon: 'pi-sun', source: null }
];
