using System.Collections.Generic;
using YamlDotNet.Serialization;

namespace DesktopAiMascot.mascots
{
    /// <summary>
    /// マスコットの設定情報ルート（YAML構造に対応）
    /// </summary>
    public class MascotConfig
    {
        /// <summary>
        /// システムプロンプト設定
        /// </summary>
        [YamlMember(Alias = "system_prompt")]
        public SystemPrompt SystemPrompt { get; set; } = new SystemPrompt();

        /// <summary>
        /// Voice AI サービスごとのモデルとスピーカー設定
        /// キー: Voice AI Service名 (例: "StyleBertVits2")
        /// 値: そのサービスのモデルとスピーカー設定
        /// </summary>
        [YamlMember(Alias = "voice")]
        public Dictionary<string, VoiceServiceConfig> Voice { get; set; } = new Dictionary<string, VoiceServiceConfig>();
    }

    /// <summary>
    /// システムプロンプト詳細
    /// </summary>
    public class SystemPrompt
    {
        [YamlMember(Alias = "profile")]
        public Profile Profile { get; set; } = new Profile();
        
        [YamlMember(Alias = "personality")]
        public List<string> Personality { get; set; } = new List<string>();
        
        [YamlMember(Alias = "speech_style")]
        public SpeechStyle SpeechStyle { get; set; } = new SpeechStyle();
        
        [YamlMember(Alias = "conversation_style")]
        public List<string> ConversationStyle { get; set; } = new List<string>();
        
        [YamlMember(Alias = "prohibitions")]
        public List<string> Prohibitions { get; set; } = new List<string>();
        
        [YamlMember(Alias = "examples")]
        public List<Example> Examples { get; set; } = new List<Example>();
        
        [YamlMember(Alias = "notes")]
        public List<string> Notes { get; set; } = new List<string>();
    }

    /// <summary>
    /// プロフィール情報
    /// </summary>
    public class Profile
    {
        public string Name { get; set; } = string.Empty;
        public string Sex { get; set; } = string.Empty;
        public string Age { get; set; } = string.Empty;
        public string Birthday { get; set; } = string.Empty;
        public string Height { get; set; } = string.Empty;
        public string Birthplace { get; set; } = string.Empty;
        public string Affiliation { get; set; } = string.Empty;
        public string Cv { get; set; } = string.Empty;
        
        [YamlMember(Alias = "hobbies")]
        public List<string> Hobbies { get; set; } = new List<string>();
        
        [YamlMember(Alias = "special_skills")]
        public List<string> SpecialSkills { get; set; } = new List<string>();
        
        public List<string> Software { get; set; } = new List<string>();
        public List<string> Possessions { get; set; } = new List<string>();
    }

    /// <summary>
    /// 話し方・口調設定
    /// </summary>
    public class SpeechStyle
    {
        [YamlMember(Alias = "first_person")]
        public string FirstPerson { get; set; } = string.Empty;
        
        [YamlMember(Alias = "second_person")]
        public List<string> SecondPerson { get; set; } = new List<string>();
        
        [YamlMember(Alias = "speech_patterns")]
        public List<string> SpeechPatterns { get; set; } = new List<string>();
    }

    /// <summary>
    /// 会話例
    /// </summary>
    public class Example
    {
        public string User { get; set; } = string.Empty;
        public string Assistant { get; set; } = string.Empty;
    }

    /// <summary>
    /// Voice AI サービスの設定（モデルとスピーカー）
    /// </summary>
    public class VoiceServiceConfig
    {
        /// <summary>
        /// モデル名（例: "jvnv-F1-jp"）
        /// </summary>
        public string Model { get; set; } = string.Empty;

        /// <summary>
        /// スピーカー名（例: "あみたろ"）
        /// </summary>
        public string Speaker { get; set; } = string.Empty;
    }
}
