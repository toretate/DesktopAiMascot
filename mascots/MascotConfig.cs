using System.Collections.Generic;

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
        public SystemPrompt SystemPrompt { get; set; } = new SystemPrompt();
    }

    /// <summary>
    /// システムプロンプト詳細
    /// </summary>
    public class SystemPrompt
    {
        public Profile Profile { get; set; } = new Profile();
        public List<string> Personality { get; set; } = new List<string>();
        public SpeechStyle SpeechStyle { get; set; } = new SpeechStyle();
        public List<string> ConversationStyle { get; set; } = new List<string>();
        public List<string> Prohibitions { get; set; } = new List<string>();
        public List<Example> Examples { get; set; } = new List<Example>();
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
        public List<string> Software { get; set; } = new List<string>();
        public List<string> Hobbies { get; set; } = new List<string>();
        public List<string> SpecialSkills { get; set; } = new List<string>();
        public List<string> Possessions { get; set; } = new List<string>();
    }

    /// <summary>
    /// 話し方・口調設定
    /// </summary>
    public class SpeechStyle
    {
        public string FirstPerson { get; set; } = string.Empty;
        public List<string> SecondPerson { get; set; } = new List<string>();
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
}