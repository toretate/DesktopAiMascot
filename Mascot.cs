using System;
using System.Drawing;
using System.IO;
using ImageMagick;

namespace DesktopAiMascot
{
    public class Mascot
    {
        public Point Position { get; set; }
        public Size Size { get; set; }
        public int CurrentFrame { get; private set; }
        private int frameCount = 1;
        private Image[]? images;

        public Mascot(Point position, Size size)
        {
            Position = position;
            Size = size;
            CurrentFrame = 0;
            LoadImages();
        }

        private void LoadImages()
        {
            images = new Image[frameCount];
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            for (int i = 0; i < frameCount; i++)
            {
                string imagePath = Path.Combine(baseDir, "images", $"mascot{i + 1}.webp");
                try
                {
                    if (!File.Exists(imagePath))
                    {
                        Console.WriteLine($"Image not found: {imagePath}");
                        continue;
                    }

                    using (var magick = new MagickImage(imagePath))
                    {
                        byte[] data = magick.ToByteArray();
                        using (var stream = new MemoryStream(data))
                        {
                            using (var img = Image.FromStream(stream))
                            {
                                // Clone into a Bitmap so the underlying stream can be disposed safely
                                images[i] = new Bitmap(img);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    // Handle error, maybe use a default image or log
                    Console.WriteLine($"Error loading image {imagePath}: {ex.Message}");
                    // For now, keep as null or use a placeholder
                }
            }
        }

        public void UpdateAnimation()
        {
            // Static image, no animation
            CurrentFrame = 0;
        }

        public void Draw(Graphics g)
        {
            if (images != null && images[CurrentFrame] != null)
            {
                g.DrawImage(images[CurrentFrame], Position.X, Position.Y, Size.Width, Size.Height);
            }
            else
            {
                // Fallback to drawing a circle if image not loaded
                int x = Position.X + CurrentFrame * 10;
                int y = Position.Y;
                g.FillEllipse(Brushes.Blue, x, y, Size.Width, Size.Height);
            }
        }

        public void MoveTo(Point newPosition)
        {
            Position = newPosition;
        }

        public bool IsClicked(Point clickPoint)
        {
            Rectangle bounds = new Rectangle(Position, Size);
            return bounds.Contains(clickPoint);
        }
    }
}