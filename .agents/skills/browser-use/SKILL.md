---
name: browser-use
description: AIエージェントにWebブラウザを操作させるためのPythonライブラリ browser-use のセットアップと基本的な使用方法についての指示と知見。
---

# browser-use 統合ガイドライン

このドキュメントは、AIエージェントがWebブラウザを自動的・自律的に操作するためのライブラリ `browser-use` のインストール、セットアップ、および使用方法に関する知見をまとめたスキルファイルです。

> [!IMPORTANT]
> **用途の限定について**
> 本プロジェクトにおける `browser-use` の利用は、開発中の webapps（Webアプリケーション）の動作確認や検証・テスト目的での利用に**限定**してください。一般的なブラウジングやスクレイピング、その他の自動化タスクには使用しないでください。

---

## 1. セットアップとインストール

`browser-use` はPythonのライブラリです。動作させるには Python 3.11 以上が推奨されます。

### 必要なパッケージのインストール

以下のコマンドを実行して、ライブラリおよびブラウザ自動化のための Playwright をインストールします。

```bash
pip install browser-use
playwright install
```

---

## 2. 基本的な実装例

以下は、`browser-use` を使用してGoogle検索を行い、結果を取得する最小構成のコード例です。

```python
import asyncio
from browser_use import Agent
from langchain_openai import ChatOpenAI

async def main():
    # LLMに LM Studio 上の qwen/qwen3-vl-8b を指定
    agent = Agent(
        task="Googleで 'browser-use python' を検索し、最初の検索結果 of タイトルとURLを教えてください。",
        llm=ChatOpenAI(
            model="qwen/qwen3-vl-8b",              # LM Studioでロードしたモデル名
            base_url="http://localhost:1234/v1",  # LM StudioのローカルサーバーURL
            api_key="lm-studio"
        ),
    )
    result = await agent.run()
    print(result)

if __name__ == '__main__':
    asyncio.run(main())
```

---

## 3. 主な機能とカスタマイズ

### 3.1. ブラウザ設定 (BrowserConfig)
エージェントが起動するブラウザの動作（ヘッドレスモードの有無、ブラウザの永続化、プロキシ設定など）をカスタマイズできます。

```python
from browser_use import Browser, BrowserConfig

config = BrowserConfig(
    headless=False,  # ブラウザ画面を表示する
    disable_security=True,
)
browser = Browser(config=config)

agent = Agent(
    task="...",
    llm=llm,
    browser=browser
)
```

### 3.2. コンテキスト設定 (BrowserContextConfig)
Cookieの保存場所（セッションの維持）や画面解像度などを設定できます。

```python
from browser_use import BrowserContextConfig

context_config = BrowserContextConfig(
    user_data_dir="./chrome-profile",  # ログイン状態を保持する場合に指定
)
```

### 3.3. カスタムツールの追加 (Controller)
エージェントに独自の操作（特定のAPIの呼び出しやファイルの保存など）を許可するには、`Controller` を使用してアクションを登録します。

```python
from browser_use import Controller

controller = Controller()

@controller.action('ローカルのテキストファイルに保存する')
def save_text(text: str):
    with open('output.txt', 'w', encoding='utf-8') as f:
        f.write(text)
    return '保存完了'

agent = Agent(
    task="...",
    llm=llm,
    controller=controller
)
```

---

## 4. 開発における注意点

- **用途の限定（重要）**: `browser-use` の利用は、開発した webapps の動作確認やE2E検証テストに限定し、一般的なスクレイピングや外部サービスの自動操作など他の目的には使用しないでください。
- **LLMの選定**: `browser-use` はページのDOM構造やビジュアル要素（スクリーンショット等）を理解するため、モデルにはビジュアル対応（VLM）である LM Studio 上の `qwen/qwen3-vl-8b` などの利用が推奨されます。
- **ログイン状態の保持**: ログインが必要なサイトを扱う場合は、`BrowserContextConfig` の `user_data_dir` を指定して、初回起動時に手動でログインするか、Cookieを適用します。
- **待機処理**: 動的コンテンツの読み込み（JavaScriptの実行待ちなど）は `browser-use` が自動的に判断しますが、ページのロードに時間がかかる場合はタイムアウト設定やステップ数を適切に調整してください。
