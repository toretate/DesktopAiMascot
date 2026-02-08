using System;

namespace DesktopAiMascot.views.aiservice
{
    /// <summary>
    /// モデル一覧更新完了時のイベント引数
    /// </summary>
    public class ModelsUpdatedEventArgs : EventArgs
    {
        public bool Success { get; set; }
        public int ModelCount { get; set; }
        public string? ErrorMessage { get; set; }

        public ModelsUpdatedEventArgs(bool success, int modelCount, string? errorMessage = null)
        {
            Success = success;
            ModelCount = modelCount;
            ErrorMessage = errorMessage;
        }
    }
}
