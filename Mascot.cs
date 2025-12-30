using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using ImageMagick;

namespace DesktopAiMascot
{
    public class Mascot : IDisposable
    {
        public Point Position { get; set; }
        public Size Size { get; set; }
        public int CurrentFrame { get; private set; }
        private int frameCount = 1;
        private Image[]? images;
        private bool disposed = false;

        public Mascot(Point position, Size size)
        {
            Position = position;
            Size = size;
            CurrentFrame = 0;
            LoadImages();
        }

        private void LoadImages()
        {
            // Dispose any previously loaded images
            if (images != null)
            {
                foreach (var im in images)
                {
                    im?.Dispose();
                }
            }

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
                        // Ensure we export to a format System.Drawing can read (PNG)
                        magick.Format = MagickFormat.Png;
                        byte[] data = magick.ToByteArray();
                        using (var stream = new MemoryStream(data))
                        {
                            using (var img = Image.FromStream(stream))
                            {
                                // Clone into a Bitmap so the underlying stream can be disposed safely
                                images[i] = new Bitmap(img);
                                Console.WriteLine($"Loaded image: {imagePath}");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error loading image {imagePath}: {ex.Message}");
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
            // Save/restore graphics state to avoid side-effects
            var state = g.Save();
            try
            {
                // Improve rendering quality and support alpha compositing
                g.CompositingMode = CompositingMode.SourceOver;
                g.CompositingQuality = CompositingQuality.HighQuality;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;

                if (images != null && images.Length > 0 && images[CurrentFrame] != null)
                {
                    g.DrawImage(images[CurrentFrame], Position.X, Position.Y, Size.Width, Size.Height);
                }
                else
                {
                    int x = Position.X + CurrentFrame * 10;
                    int y = Position.Y;
                    g.FillEllipse(Brushes.Blue, x, y, Size.Width, Size.Height);
                }
            }
            finally
            {
                g.Restore(state);
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

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;

            if (images != null)
            {
                foreach (var im in images)
                {
                    im?.Dispose();
                }
                images = null;
            }

            GC.SuppressFinalize(this);
        }
    }
}