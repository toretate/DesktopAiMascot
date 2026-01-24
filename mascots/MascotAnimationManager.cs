using System;
using System.Windows.Threading;

namespace DesktopAiMascot.mascots
{
    /// <summary>
    /// マスコットのアニメーションを管理するシングルトンクラス
    /// </summary>
    public class MascotAnimationManager
    {
        private static readonly Lazy<MascotAnimationManager> _instance = 
            new Lazy<MascotAnimationManager>(() => new MascotAnimationManager());

        public static MascotAnimationManager Instance => _instance.Value;

        private DispatcherTimer? animationTimer;
        private bool isPaused = false;

        private MascotAnimationManager()
        {
        }

        /// <summary>
        /// アニメーションタイマーを登録
        /// </summary>
        public void RegisterAnimationTimer(DispatcherTimer timer)
        {
            animationTimer = timer;
        }

        /// <summary>
        /// アニメーションを一時停止
        /// </summary>
        public void PauseAnimation()
        {
            if (animationTimer != null && animationTimer.IsEnabled)
            {
                animationTimer.Stop();
                isPaused = true;
            }
        }

        /// <summary>
        /// アニメーションを再開
        /// </summary>
        public void ResumeAnimation()
        {
            if (animationTimer != null && isPaused)
            {
                animationTimer.Start();
                isPaused = false;
            }
        }

        /// <summary>
        /// アニメーションが一時停止中かどうか
        /// </summary>
        public bool IsPaused => isPaused;
    }
}





