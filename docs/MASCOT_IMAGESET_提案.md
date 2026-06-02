# MASCOT_IMAGESET 提案

## 概要

`MascotImageSet` に `Pose` の概念を追加し、マスコットの姿勢ごとの画像管理をできるようにする提案です。

現在の `MascotImageSet` は、下記の 3 軸を直接持っています。

- 方向 (`AngleImages`)
- 感情差分の顔画像 (`EmotionFaceImages`)
- 感情差分の全身画像 (`EmotionFullbodyImages`)

ここに `Pose` を同列で追加すると、立ち・座り・寝るごとに方向や感情の組み合わせが増え、管理軸が混ざりやすくなります。

そのため、`Pose` を `ImageSet` の 1 段下に配置し、責務を分離する構造を推奨します。

## 推奨する責務分割

- `Pose`: 何をしているか
- `Angle`: どこから見ているか
- `Emotion`: どんな表情か

例えば、`sleep` という `Pose` の中に `front` や `left` があり、さらに `sleepy` や `joy` などの感情差分がある、という構造にします。

これにより、下記のような組み合わせで自然に扱えます。

- 寝る + 正面 + 眠そうな顔
- 座る + 右向き + 喜びの表情
- 走る + 左向き + 真顔

## 提案するクラス構成

### MascotImageSet

マスコット全体の画像資産の入口です。

持つもの:

- `DefaultPoseName`
- `PoseImages`
- `CoverImage`
- 必要に応じて共通タグ

### MascotPoseImageSet

1 つの `Pose` に対応する完全な画像セットです。

持つもの:

- `Name`
- `Tags`
- `PrimaryImage`
- `AngleImages`
- `EmotionFaceImages`
- `EmotionFullbodyImages`
- `AnimationFrames`

### MascotPoseTag

LLM や検索用の意味タグです。

例:

- `standing`
- `sitting`
- `sleeping`
- `desk`
- `floor`
- `running`
- `formal`
- `casual`

## 推奨する API

`ImageSet` 直下にすべてを平置きするのではなく、`Pose` を起点に取得する API を用意することを推奨します。

- `GetPose(name)`
- `GetDefaultPose()`
- `GetPoseByTags(tags)`
- `GetChatImage(pose, emotion)`
- `GetPoseAngleImage(pose, angle)`
- `GetPoseEmotionFaceImage(pose, emotion)`
- `GetPoseEmotionFullbodyImage(pose, emotion)`

特に `GetPoseByTags(tags)` を用意しておくと、LLM が「床で寝ている」「机に突っ伏して寝る」などの指示を返した時に扱いやすくなります。

`Pose` 名だけで管理すると表現力が足りないため、`Pose` 名 + タグ検索の二段構えが望ましいです。

## 推奨するファイル命名規則

`Pose` を前提にした場合、ファイル名は下記のような規則に寄せると Builder で解析しやすくなります。

- `mascot_stand.png`
- `mascot_stand_front.png`
- `mascot_stand_left.png`
- `mascot_stand_face_joy.png`
- `mascot_stand_fullbody_anger.png`
- `mascot_sleep_floor_front.png`
- `mascot_sleep_floor_face_sleepy.png`
- `mascot_sleep_desk_front.png`

この規則であれば、先頭側を `Pose` 名、末尾側を `angle` / `face` / `fullbody` / `emotion` として解析できます。

## Builder の拡張方針

現在の `MascotImageSetBuilder` は 1 つの `MascotImageSet` に対して、方向と感情を直接分類しています。

`Pose` 対応後は、Builder が下記を行う構造に拡張するのがよいです。

- ファイル名から `Pose` 名を抽出する
- `Pose` ごとに `MascotPoseImageSet` を生成する
- 各 `Pose` の中で `Angle` と `Emotion` を分類する
- `cover.png` は引き続き代表画像として扱い、チャット用セットからは除外する

## 後方互換の方針

いきなり全面置換するのではなく、段階移行を推奨します。

### 段階移行案

1. `MascotImageSet` に `PoseImages` を追加する
2. 既存の `Image`、`AngleImages`、`EmotionFaceImages`、`EmotionFullbodyImages` は `DefaultPose` への後方互換ビューとして残す
3. Builder を `Pose` 対応にする
4. 呼び出し側を少しずつ `GetDefaultPose()` 経由へ寄せる
5. 旧フラット構造を段階的に縮退させる

### 当面の互換動作

- `ImageSet.Image` は `DefaultPose.PrimaryImage` を返す
- `ImageSet.AngleImages` は `DefaultPose.AngleImages` を返す
- `ImageSet.EmotionFaceImages` は `DefaultPose.EmotionFaceImages` を返す
- `ImageSet.EmotionFullbodyImages` は `DefaultPose.EmotionFullbodyImages` を返す

これにより、既存のチャット表示や設定画面を大きく壊さずに `Pose` 導入を進められます。

## 設計上の注意点

### Pose と Emotion を分ける

`sleep` と `sleepy` のように、姿勢と感情は別概念です。

- `sleep`: Pose
- `sleepy`: Emotion

この分離を守ることで、意味の衝突を防げます。

### Animation は Pose 配下に置く

走る、手を振る、瞬きなどのアニメーションは `Pose` 単位でまとまるため、`ImageSet` 全体ではなく `Pose` の下に持たせるのが自然です。

## 結論

最もバランスがよい構成は下記です。

- `MascotImageSet`: マスコット全体の画像カタログ
- `MascotPoseImageSet`: 1 つの姿勢ごとの完全セット
- `Angle` と `Emotion` は `Pose` の下に置く
- 現在の API は `DefaultPose` への互換レイヤとして残す

この構成であれば、現在の `front` / `emotion` / `angle` ベースの運用を維持しつつ、将来的に「座る」「寝る」「走る」などの `Pose` を無理なく管理できます。
