using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using ImageMagick;
using System.Collections.Generic;
using System.Diagnostics;

namespace DesktopAiMascot.mascots
{
    /**
     * マスコットのインスタンスを表すクラス
     */
    public class Mascot : IDisposable
    {
        // 現在のマスコットモデル
        public MascotModel? Model { get; private set; }
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
            // Initially load nothing or default if needed. 
            // Caller should call Reload with a model.
        }

        public void Reload(MascotModel newModel)
        {
            Model?.Dispose();    // キャッシュ破棄

            Model = newModel;
            images = newModel.LoadImages();
            
            // Log for debugging
            Debug.WriteLine($"Mascot reloaded: {newModel.Name}, {frameCount} images.");
        }

        // 描画
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
                    var img = images[CurrentFrame];
                    // アスペクト比を維持しつつ、Size内に収める (Contain)
                    float ratio = Math.Min((float)Size.Width / img.Width, (float)Size.Height / img.Height);
                    int w = (int)(img.Width * ratio);
                    int h = (int)(img.Height * ratio);

                    // 中央揃え
                    int x = Position.X + (Size.Width - w) / 2;
                    int y = Position.Y + (Size.Height - h) / 2;

                    g.DrawImage(img, x, y, w, h);
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

        // Return a clone of the currently displayed image (or null if none).
        public Image? GetCurrentImageClone()
        {
            try
            {
                if (images == null || images.Length == 0) return null;
                var current = images[CurrentFrame];
                if (current == null) return null;
                return new Bitmap(current);
            }
            catch
            {
                return null;
            }
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
