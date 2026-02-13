using System.Threading.Tasks;
using DesktopAiMascot.skills;

namespace DesktopAiMascot.aiservice.voice
{
    internal static class EnglishReadingConverter
    {
        private static readonly EnglishReadingSkill Skill = new EnglishReadingSkill();

        public static Task<string> ConvertAsync(string text)
        {
            return Skill.ConvertToReadingAsync(text);
        }
    }
}
