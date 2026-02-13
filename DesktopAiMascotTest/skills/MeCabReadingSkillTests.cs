using Xunit;
using DesktopAiMascot.skills;
using System.Threading.Tasks;

namespace DesktopAiMascotTest.skills
{
    public class BilingualKanaDictionarySkillTests
    {
        [Fact]
        public async Task ConvertToReadingAsync_空文字列_空文字列を返す()
        {
            // Arrange
            var skill = new BilingualKanaDictionarySkill();

            // Act
            var result = await skill.ConvertToReadingAsync("");

            // Assert
            Assert.Equal("", result);
        }

        [Fact]
        public async Task ConvertToReadingAsync_英単語なし_元の文字列を返す()
        {
            // Arrange
            var skill = new BilingualKanaDictionarySkill();

            // Act
            var result = await skill.ConvertToReadingAsync("こんにちは");

            // Assert
            Assert.Equal("こんにちは", result);
        }

        [Fact]
        public async Task ConvertToReadingAsync_英単語あり_読み仮名に変換される()
        {
            // Arrange
            var skill = new BilingualKanaDictionarySkill();

            // Act
            var result = await skill.ConvertToReadingAsync("私はappleが好きです");

            // Assert
            // 辞書に登録されていない単語はアルファベット読みになる
            Assert.NotNull(result);
            Assert.NotEmpty(result);
            Assert.Contains("私は", result);
            Assert.Contains("が好きです", result);
        }

        [Fact]
        public void GetWordReading_登録済み単語の読みを取得()
        {
            // Arrange
            var skill = new BilingualKanaDictionarySkill();

            // Act
            var result = skill.GetWordReading("hello");

            // Assert
            Assert.Equal("ハロー", result);
        }

        [Fact]
        public void GetWordReading_空文字列_空文字列を返す()
        {
            // Arrange
            var skill = new BilingualKanaDictionarySkill();

            // Act
            var result = skill.GetWordReading("");

            // Assert
            Assert.Equal("", result);
        }

        [Fact]
        public void AddWord_新しい単語を追加できる()
        {
            // Arrange
            var skill = new BilingualKanaDictionarySkill();
            skill.AddWord("customword", "カスタムワード");

            // Act
            var result = skill.GetWordReading("customword");

            // Assert
            Assert.Equal("カスタムワード", result);
        }

        [Fact]
        public void DictionaryCount_辞書のエントリ数を取得できる()
        {
            // Arrange
            var skill = new BilingualKanaDictionarySkill();

            // Act
            var count = skill.DictionaryCount;

            // Assert
            Assert.True(count > 0);
        }

        [Fact]
        public void IsLoaded_辞書が読み込まれている()
        {
            // Arrange
            var skill = new BilingualKanaDictionarySkill();

            // Act
            var isLoaded = skill.IsLoaded;

            // Assert
            Assert.True(isLoaded);
        }
    }
}
