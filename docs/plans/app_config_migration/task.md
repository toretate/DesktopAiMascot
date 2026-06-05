# タスクリスト: AppConfig の移行

- [x] `ui/electron/app-config.ts` を新規作成し、`AppConfig` 関連のコードを定義する
- [x] `ui/electron/main.ts` から `AppConfig` 関連のコード（インターフェースとクラス定義）を削除する
- [x] `ui/electron/main.ts` で `app-config.ts` からインポートするように修正する
- [x] リファクタリング後にビルド検証を行う
