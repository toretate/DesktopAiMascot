# マスコット画像フォルダ

このフォルダにはマスコット画像とその設定ファイルを配置します。

## フォルダ構成

```
mascots/
├── default/           # デフォルトのマスコット（リポジトリに含まれる）
│   ├── config.yaml
│   └── mascot1.png
├── your-mascot/       # あなたのカスタムマスコット
│   ├── config.yaml
│   └── mascot1.png
└── config.template.yaml  # 設定ファイルのテンプレート
```

## カスタムマスコットの追加方法

1. 新しいフォルダを作成（例：`my-mascot/`）
2. `config.template.yaml` をコピーして `config.yaml` にリネーム
3. マスコット画像（PNG または WebP）を配置
4. `config.yaml` を編集してキャラクター設定を記述
5. アプリの設定画面から読み込み

## 画像の要件

- **形式**: PNG
- **推奨サイズ**: 1024x768 ピクセル
- **透過**: 背景透過を推奨
- **命名**: `mascot1.png`, `mascot2.png` など

## サンプル設定ファイル

`config.template.yaml` を参考に、以下の項目を設定できます：

- `system_prompt`: キャラクターのプロフィールや性格
- `profile`: 名前、年齢、誕生日など
- `personality`: 性格の特徴
- `speech_style`: 話し方、口調、語尾など

詳細は `config.template.yaml` を参照してください。
