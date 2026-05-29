export interface IElectronAPI {
    toggleChat: () => void;
    openSettings: () => void;
    setIgnoreMouseEvents: (ignore: boolean) => void;
    startWindowDrag: () => void;
    onChatToggled: (callback: (visible: boolean) => void) => () => void;
}

declare global {
    interface Window {
        electronAPI?: IElectronAPI;
    }
}
