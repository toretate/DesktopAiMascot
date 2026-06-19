const EMOJI_ANNOTATION = {
    "👂": "Whisper, sounds close to the ear",
    "😮‍💨": "Breath, sigh, sleeping breath",
    "⏸️": "Pause, silence",
    "🤭": "Chuckle, giggle, suppressed laugh",
    "🥵": "Panting, moan, groan",
    "📢": "Echo, reverb",
    "😏": "Teasing, playfully sweet / coaxing",
    "🥺": "Trembling voice, timidly / uncertainly",
    "🌬️": "Shortness of breath, heavy breathing",
    "😮": "Gasp",
    "👅": "Licking sound, chewing sound, wet sound",
    "💋": "Lip smack / lip noise",
    "🫶": "Gently, tenderly",
    "😭": "Sobbing, crying, sorrowfully / sadly",
    "😱": "Scream, shout, shriek",
    "😪": "Sleepily, sluggishly / languidly",
    "⏩": "Fast-speaking, rapid-fire, hurriedly",
    "📞": "Over the phone, through a speaker",
    "🐢": "Slowly",
    "🥤": "Gulp, swallowing sound",
    "🤧": "Coughing, sniffling, sneeze, clearing throat",
    "😒": "Tutting, clicking tongue",
    "😰": "Panicked, agitated, nervous, stuttering",
    "😆": "Joyfully, happily",
    "😠": "Angry, displeased, sulking",
    "😲": "Surprise, awe / exclamation",
    "🥱": "Yawn",
    "😖": "Painfully, agonizingly",
    "😟": "Anxiously, worriedly",
    "🫣": "Shyly, bashfully",
    "🙄": "Exasperatedly, rolling eyes",
    "😊": "Cheerfully, gladly",
    "👌": "Backchanneling, sound of agreement",
    "🙏": "Pleadingly, begging",
    "🥴": "Drunkenly",
    "🎵": "Humming",
    "🤐": "Muffled (mouth covered)",
    "😌": "Relieved, contentedly",
    "🤔": "Questioning voice, wondering"
}





export default (): string => {
    let prompt = `
# System Instructions
回答の感情として、現在の感情や話すスタイルに合わせて、以下の感情・スタイルタグを含めてください。例:「こんにちは！ [joy]」
利用可能なタグ:
[Whisper]: Whisper, sounds close to the ear
[Breath] : Breath, sigh, sleeping breath
[Pause] : Pause, silence
[Chuckle] : Chuckle, giggle, suppressed laugh
[Panting] : Panting, moan, groan
[Echo]: Echo, reverb
[Teasing] : Teasing, playfully sweet / coaxing
[Trembling] : Trembling voice, timidly / uncertainly
[Shortness of breath] : Shortness of breath, heavy breathing
[Gasp]: Gasp
[Licking sound]: Licking sound, chewing sound, wet sound
[Lip smack]: Lip smack / lip noise
[Gently]: Gently, tenderly
[Sobbing]: Sobbing, crying, sorrowfully / sadly
[Scream]: Scream, shout, shriek
[Sleepily]: Sleepily, sluggishly / languidly
[Fast-speaking]: Fast-speaking, rapid-fire, hurriedly
[Over the phone]: Over the phone, through a speaker
[Slowly]: Slowly
[Gulp]: Gulp, swallowing sound
[Coughing]: Coughing, sniffling, sneeze, clearing throat
[Tutting]: Tutting, clicking tongue
[Panicked]: Panicked, agitated, nervous, stuttering
[Joyfully]: Joyfully, happily
[Angry]: Angry, displeased, sulking
[Surprise]: Surprise, awe / exclamation
[Yawn]: Yawn
[Painfully]: Painfully, agonizingly
[Anxiously]: Anxiously, worriedly
[Shyly]: Shyly, bashfully
[Exasperatedly]: Exasperatedly, rolling eyes
[Cheerfully]: Cheerfully, gladly
[Backchanneling]: Backchanneling, sound of agreement
[Pleadingly]: Pleadingly, begging
[Drunkenly]: Drunkenly
[Humming]: Humming
[Muffled]: Muffled (mouth covered)
[Relieved]: Relieved, contentedly
[Questioning voice]: Questioning voice, wondering
`
    return prompt;
}