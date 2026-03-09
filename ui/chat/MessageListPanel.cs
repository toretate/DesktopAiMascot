using Godot;
using System;
using System.Collections.Generic;
using Control = Godot.Control;
using Color = Godot.Color;
using Panel = Godot.Panel;

namespace DesktopAiMascot.ui.chat
{
    public partial class MessageListPanel : Control
    {
        private VBoxContainer? _messageContainer;
        private ScrollContainer? _scrollContainer;
        private List<MessageBubble> _bubbles = new();

        private IDisposable? _currentPlayer = null;
        private MessageBubble? _currentPlayingBubble = null;

        [Signal]
        public delegate void TtsRequestedEventHandler(MessageBubble bubble);

        public override void _Ready()
        {
            _scrollContainer = GetNode<ScrollContainer>("%ScrollContainer");
            _messageContainer = GetNode<VBoxContainer>("%MessageContainer");
        }

        public void AddMessage(ChatMessage msg)
        {
            if (_messageContainer == null) return;

            var bubble = new MessageBubble();
            _messageContainer.AddChild(bubble);
            bubble.SetMessage(msg);
            bubble.PlayRequested += OnPlayRequested;
            _bubbles.Add(bubble);

            ScrollToBottom();
        }

        public void ClearMessages()
        {
            if (_messageContainer == null) return;

            StopPlayback();
            foreach (var b in _bubbles)
            {
                b.QueueFree();
            }
            _bubbles.Clear();
        }

        private async void ScrollToBottom()
        {
            if (_scrollContainer == null) return;
            // 描画更新のフレーム後まで待機して限界値までスクロール
            await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
            _scrollContainer.ScrollVertical = (int)_scrollContainer.GetVScrollBar().MaxValue;
        }

        private void OnPlayRequested(MessageBubble bubble)
        {
            if (_currentPlayingBubble == bubble && _currentPlayer != null)
            {
                StopPlayback();
                return;
            }

            StopPlayback();

            if (bubble.Message?.VoiceFilePath != null && System.IO.File.Exists(bubble.Message.VoiceFilePath))
            {
                PlayVoice(bubble);
            }
            else
            {
                EmitSignal(SignalName.TtsRequested, bubble);
            }
        }

        public void PlayVoice(MessageBubble bubble)
        {
            try
            {
                if (bubble.Message?.VoiceFilePath != null)
                {
                    _currentPlayer = AudioHelper.Play(bubble.Message.VoiceFilePath);
                    _currentPlayingBubble = bubble;
                    bubble.UpdatePlayButtonState(true);
                }
            }
            catch (Exception ex)
            {
                GD.PrintErr("音声再生エラー", ex.Message);
            }
        }

        public void StopPlayback()
        {
            if (_currentPlayer != null)
            {
                try
                {
                    AudioHelper.Stop(_currentPlayer);
                }
                catch { }
                _currentPlayer = null;
            }
            if (_currentPlayingBubble != null)
            {
                _currentPlayingBubble.UpdatePlayButtonState(false);
                _currentPlayingBubble = null;
            }
        }
    }

    internal static class AudioHelper
    {
        [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
        public static IDisposable? Play(string path)
        {
            try
            {
                var player = new System.Media.SoundPlayer(path);
                player.LoadAsync();
                player.Play();
                return player;
            }
            catch
            {
                return null;
            }
        }

        [System.Runtime.CompilerServices.MethodImpl(System.Runtime.CompilerServices.MethodImplOptions.NoInlining)]
        public static void Stop(IDisposable player)
        {
            if (player is System.Media.SoundPlayer sp)
            {
                sp.Stop();
                sp.Dispose();
            }
        }
    }
}
