# Mascot について

Mascot は下記のパラメータを持つ

* Model: マスコットモデル
* Position: マスコットが配置されているデスクトップ上の位置情報
* Size: マスコットを配置するサイズ
* images: 現在のマスコット画像セット
* coverImage: 現在のマスコットカバー画像

# MascotModel について

MascotModel は下記のパラメータを持つ

* Name: マスコット名
* Prompt: マスコットの性格設定などのLLMプロンプト
* ImagePaths: マスコット画像ファイルパス
* Config: マスコット設定
* ConfigPath: マスコット設定ファイルの保存パス
* DirectoryPath: マスコットが配置されているファイルパス
* ImageCache: 画像キャッシュ

# MascotConfig について

マスコットの設定情報。保存されるファイルは YAML で保存される

* SystemPrompt: 性格設定プロンプト
* Voice: Voice AI を使う場合の声設定

# MascotImageSet について

マスコットの画像情報。

* Name: 画像セット名
* Image: 画像セットのカバー画像
* AngleImages: キャラクターの各方向の画像
* EmotionFaceItems: 表情画像（顔や、バストアップのみ）
* EmotionFullbodyImages: 表情画像（EmotionFaceItemsの全身画像版）
* PoseSet: キャラクターのポーズ画像

## PoseSetについて

キャラクターの各種ポーズが、代表画像とアニメーション用画像などが含まれる
またその Pose についての タグ情報 を持つ
例えば、チャットのResponseとしてPose指定があった場合（走る、座る、寝る・・・など）
どの Pose を使うのか、検索条件として使われる。Prompot Tag List。
寝るにしても机に座って寝るのか、床に寝るのかによって Prompt が変わるように状態のタグ情報を持つ

* PoseList: List<PoseName, Pose>。各ポーズが入る
* 