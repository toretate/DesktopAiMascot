// Web版のエントリーポイント
// アプリ起動前にElectronのIPCをブラウザAPIでエミュレートするポリフィルをロードする
import '../src/utils/browser-polyfill';
// 既存のメインアプリケーションをロード
import '../src/main';
