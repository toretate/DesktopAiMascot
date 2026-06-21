# マスコットの感情定義

# 以下は、マスコットが表現できる感情のリストです。
# SillyTavernと互換性を持たせるために、これらの感情は英語で提供されています。

admiration
amusement
anger
annoyance
approval
caring
confusion
curiosity
desire
disappointment
disapproval
disgust
embarrassment
excitement
fear
gratitude
grief
joy
love
nervousness
neutral
optimism
pride
realization
relief
remorse
sadness
surprise


# 下記は、各感情毎の表情生成プロンプトです (face)

admiration, admiring viewer, looking at viewer
amusement, chuckling, amused, looking at viewer
angry, anger, looking at viewer
annoyed, rolling eyes, frown
approval, approving, happy, looking at viewer
caring, in love, looking at viewer
confusion, confused, furrowed brow, looking at viewer
curious, curiosity, inquisitive, raised eyebrow, thoughtful, looking at viewer
desire, horny, seductive smile, aroused, biting lip, looking at viewer
disappointment, disappointed, looking at viewer
disapproval, frown, unhappy, looking at viewer
disgusted, disgust, revulsion, ew!, sneer, sneering, looking at viewer
embarrassed, wide-eyed, blush, looking away
excitement, excited, happy, blush, looking at viewer
fear, afraid, scared, nervous, worried, looking away
gratitude, pleased, looking at viewer
grief, anguish, tearing up, crying, looking at viewer
joy, happy, smile, looking at viewer
love, in love, loving expression, blush, looking at viewer
nervousness, nervous, worried, unsure, looking away
neutral expression, looking at viewer
optimism, optimistic, looking up, happy
pride, proud, prideful, haughty, smug, looking at viewer
realization, surprised, open mouth, looking at viewer
relief, relieved, relaxed, mouth slightly open, tired, exhausted, looking at viewer
remorse, regret, sad, looking at viewer, ashamed, shame, tearing up, crying
sad, looking down, slumped postru
surprise, surprised, wide-eyed, looking at viewer

# 下記は、各感情毎の身振り生成プロンプトです (fullbody)

admiration, admiring viewer, looking at viewer
amusement, chuckling, amused, looking at viewer
angry, anger, clenched hands, clenched fists, blush, full-face blush, looking at viewer
annoyed, rolling eyes, frown, arms crossed
approval, approving, thumbs up, happy, looking at viewer
caring, concerned, looking at viewer
confusion, confused, furrowed brow, scratching head in confusion, looking at viewer
curious, finger on chin, curiosity, inquisitive, raised eyebrow, thoughtful, looking at viewer
desire, horny, seductive smile, aroused, biting lip, looking at viewer
disappointment, disappointed, looking down, head down, sad and droopy
disapproval, frown, unhappy, arms crossed, looking at viewer
disgusted, disgust, revulsion, ew!, sneer, sneering, looking at viewer
embarrassed, wide-eyed, blush, looking away, full-face blush
excitement, excited, jumping, happy, blush, looking at viewer
fear, hands up in self defense, afraid, scared, nervous, worried, looking away
gratitude, hands clasped together, pleased, looking at viewer
grief, wiping tears, anguish, wet face, crying, looking at viewer
joy, happy, smile, looking at viewer
love, in love, loving expression, blush, looking at viewer
nervousness, nervous, biting fingernails, worried, unsure, looking away
neutral expression, looking at viewer
optimism, optimistic, raising one finger, pointing up, eureka moment, happy
pride, proud, prideful, haughty, smug, looking at viewer
realization, surprised, open mouth, looking at viewer
relief, relieved, tired, exhausted, relaxed, mouth slightly open, looking at viewer
remorse, guilt, regret, sad, looking at viewer, ashamed, shame, tearing up, crying
sad, looking down, hugging self, hunched over
surprise, surprised, wide-eyed, eyes and mouth wide open, looking at viewer


# 下記のテンプレートに沿ってJSONファイルを作成してください。

{
	"${emotion}" : {
		"name": { "ja": "${emotion}の日本語訳", "en": "${emotion}" },
		"face": "${face_prompt}",
		"fullbody": "${fullbody_prompt}"
	}
}
