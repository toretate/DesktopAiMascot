import type { MusicRestoreMode } from '../../store/music';

export interface MusicTrack {
    id: string;
    url: string;
    title: string;
    artist: string;
    key: string;
    size: number;
    lastModified: number;
}

export interface ElectronMusicFolderResult {
    success: boolean;
    folderPath?: string;
    files?: Array<{
        name: string;
        relativePath: string;
        size: number;
        lastModified: number;
        url: string;
    }>;
    error?: string;
}

export interface MusicTrackCollection {
    tracks: MusicTrack[];
    folderName: string;
    restoreMode: MusicRestoreMode;
    autoplayForNewFolder: boolean;
}

export type RestoreStatus = 'idle' | 'checking' | 'permission-required' | 'reselect-required';
