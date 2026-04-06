using DesktopAiMascot.mascots;
using System.Linq;
using Xunit;

namespace DesktopAiMascotTest.mascots
{
    public class MascotImageSetBuilderTests
    {
        [Fact]
        public void CreateFromItems_方向画像と表情画像をセット単位で分類できる()
        {
            var items = new[]
            {
                CreateImageItem("hero.png"),
                CreateImageItem("hero_left.png"),
                CreateImageItem("hero_right.png"),
                CreateImageItem("hero_face_joy.png"),
                CreateImageItem("hero_anger_fullbody.png"),
                CreateImageItem("cover.png"),
            };

            var heroSet = MascotImageSetBuilder.CreateFromItems("hero", items);

            Assert.Equal("hero.png", heroSet.Image?.FileName);
            Assert.Equal("hero_left.png", heroSet.AngleImages["left"].FileName);
            Assert.Equal("hero_right.png", heroSet.AngleImages["right"].FileName);
            Assert.Equal("hero_face_joy.png", heroSet.EmotionFaceImages["joy"].FileName);
            Assert.Equal("hero_anger_fullbody.png", heroSet.EmotionFullbodyImages["anger"].FileName);
            Assert.DoesNotContain(heroSet.GetAllImages(), image => image.FileName == "cover.png");
        }

        [Fact]
        public void GetPrimaryImage_代表画像が無い場合は角度画像をフォールバックする()
        {
            var imageSet = new MascotImageSet("hero");
            imageSet.AngleImages["left"] = CreateImageItem("hero_left.png");
            imageSet.AngleImages["front"] = CreateImageItem("hero_front.png");

            var primaryImage = imageSet.GetPrimaryImage();

            Assert.NotNull(primaryImage);
            Assert.Equal("hero_front.png", primaryImage!.FileName);
        }

        private static MascotImageItem CreateImageItem(string fileName)
        {
            return new MascotImageItem
            {
                FileName = fileName,
                ImagePath = fileName,
            };
        }
    }
}