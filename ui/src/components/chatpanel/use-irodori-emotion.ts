export interface IrodoriEmojiAnnotation {
    emoji: string;
    description: string;
    meaning: string;
}

export const IRODORI_ALLOWED_EMOJIS: readonly IrodoriEmojiAnnotation[] = [
    { emoji: "👂", description: "ささやき、耳元での内緒話のような声色", meaning: "Whisper, sounds close to the ear" },
    { emoji: "😮‍💨", description: "ため息、深い吐息、寝息", meaning: "Breath, sigh, sleeping breath" },
    { emoji: "⏸️", description: "沈黙、ためらい、短い間", meaning: "Pause, silence" },
    { emoji: "🤭", description: "くすくす笑い、含み笑い、忍び笑い", meaning: "Chuckle, giggle, suppressed laugh" },
    { emoji: "🥵", description: "息が荒い、うめき声、唸り声", meaning: "Panting, moan, groan" },
    { emoji: "📢", description: "エコー、リバーブ、響く声", meaning: "Echo, reverb" },
    { emoji: "😏", description: "からかうような、いたずらっぽく甘えるような声色", meaning: "Teasing, playfully sweet / coaxing" },
    { emoji: "🥺", description: "声を震わせる、自信なさげ、弱々しく甘えるような声色", meaning: "Trembling voice, timidly / uncertainly" },
    { emoji: "🌬️", description: "息切れ、激しい呼吸音、荒い息遣い", meaning: "Shortness of breath, heavy breathing" },
    { emoji: "😮", description: "息をのむ、ハッとする瞬間", meaning: "Gasp" },
    { emoji: "👅", description: "舐めるような、咀嚼するような水音", meaning: "Licking sound, chewing sound, wet sound" },
    { emoji: "💋", description: "リップノイズ、軽いキス音", meaning: "Lip smack / lip noise" },
    { emoji: "🫶", description: "優しく、温かみのある穏やかな声色", meaning: "Gently, tenderly" },
    { emoji: "😭", description: "嗚咽、泣き声、非常に悲しげな声色", meaning: "Sobbing, crying, sorrowfully / sadly" },
    { emoji: "😱", description: "悲鳴、叫び声、絶叫", meaning: "Scream, shout, shriek" },
    { emoji: "😪", description: "眠そうに、気だるげな声色", meaning: "Sleepily, sluggishly / languidly" },
    { emoji: "⏩", description: "早口で喋る、一気にまくしたてる", meaning: "Fast-speaking, rapid-fire, hurriedly" },
    { emoji: "📞", description: "電話越し、スピーカーを通したようなこもった音声", meaning: "Over the phone, through a speaker" },
    { emoji: "🐢", description: "ゆっくり、一言ずつ丁寧に喋る", meaning: "Slowly" },
    { emoji: "🥤", description: "つばを飲み込む音、ゴクリと息を飲む音", meaning: "Gulp, swallowing sound" },
    { emoji: "🤧", description: "咳き込む、鼻をすする、くしゃみ、咳払い", meaning: "Coughing, sniffling, sneeze, clearing throat" },
    { emoji: "😒", description: "舌打ち、不機嫌そうな音", meaning: "Tutting, clicking tongue" },
    { emoji: "😰", description: "慌てる、ひどく動揺・緊張する、言葉に詰まる（どもる）", meaning: "Panicked, agitated, nervous, stuttering" },
    { emoji: "😆", description: "とても嬉しそうに、喜びを爆発させた声色", meaning: "Joyfully, happily" },
    { emoji: "😠", description: "怒る、不満げ、拗ねたような声色", meaning: "Angry, displeased, sulking" },
    { emoji: "😲", description: "驚く、深く感嘆・敬服した声色", meaning: "Surprise, awe / exclamation" },
    { emoji: "🥱", description: "あくび、あくび混じりの声色", meaning: "Yawn" },
    { emoji: "😖", description: "苦しそうな声色、苦痛に耐える声", meaning: "Painfully, agonizingly" },
    { emoji: "😟", description: "心配そうな声色、不安を抱える声", meaning: "Anxiously, worriedly" },
    { emoji: "🫣", description: "恥ずかしそうな、照れ隠しのような声色", meaning: "Shyly, bashfully" },
    { emoji: "🙄", description: "呆れたような、あきらめ交じりの声色", meaning: "Exasperatedly, rolling eyes" },
    { emoji: "😊", description: "楽しげに、嬉しそうに微笑みながら喋る", meaning: "Cheerfully, gladly" },
    { emoji: "👌", description: "納得、相槌、小さく頷く音", meaning: "Backchanneling, sound of agreement" },
    { emoji: "🙏", description: "懇願するように、必死にお願いするような声色", meaning: "Pleadingly, begging" },
    { emoji: "🥴", description: "酔っ払ったような、呂律の回らない声色", meaning: "Drunkenly" },
    { emoji: "🎵", description: "鼻歌を歌う、歌うような軽いテンションでの発話", meaning: "Humming" },
    { emoji: "🤐", description: "口を塞がれたようなこもった声", meaning: "Muffled (mouth covered)" },
    { emoji: "😌", description: "安堵した、満足げに落ち着いた声色", meaning: "Relieved, contentedly" },
    { emoji: "🤔", description: "疑問に思う、考え込むような声色", meaning: "Questioning voice, wondering" }
] as const;

export default (): string => {
    const listStr = IRODORI_ALLOWED_EMOJIS
        .map(item => `- ${item.emoji} : ${item.description}`)
        .join('\n');

    let prompt = `
# Irodori-TTS Speech Tags Instructions
あなたの発話音声は、テキスト内の特定の絵文字を「音声・演技・効果音タグ」として解釈する音声合成システム（Irodori-TTS）に渡されます。
会話の文脈に合わせて、自分の感情、喋り方、呼吸や笑いなどの効果音として、以下の「許可された絵文字」を回答テキスト内の適切な場所にインライン挿入してください。

## 厳守事項
1. **絶対に、以下のリストにある「許可された絵文字」以外の絵文字を使用しないでください。** リストにない絵文字（例: 😢 や 💢 など）が混入すると、システムが正しく音声を合成できずエラーやハルシネーション（意図しない読み上げノイズ）を起こします。非対応絵文字は絶対に出力しないでください。
2. 絵文字は文中に自然に埋め込んでください。過剰な連打や、文脈と無関係な場所への過度な挿入は避けてください。

## 許可された絵文字と音声・演技効果リスト
${listStr}

## インライン挿入の具体例
- 例1 (ささやき): 「ねえねえ、ちょっと耳を貸して？ 👂 内緒話だよ 👂」
- 例2 (ため息/安堵): 「ふう、やっと仕事が終わったよ 😮‍💨 つかれたな……でも安心した 😌」
- 例3 (驚き/喜び): 「えっ、本当！？ 😲 それは知らなかったよ、すごく嬉しいな 😆」
- 例4 (甘え/懇願): 「ごめんなさい、うまくできなくて…… 🥺 許してくれる？ 🙏」
- 例5 (考え込む/笑い): 「うーん、どうすればいいんだろう？ 🤔 🤭 あ、いいこと思いついた！」
`;
    return prompt;
}