// using DesktopAiMascot.mascots;
using System;
using System.Collections.Generic;
using System.IO;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Security.Cryptography;

using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace DesktopAiMascot
{
	/**
	 * アプリケーション全体の設定情報を管理するシングルトンクラス
	 */
	internal class SystemConfig
	{
		private readonly string settingFile = "system_config.yaml";

		private static SystemConfig? instance = null;
		public static SystemConfig Instance
		{
			get
			{
				if (instance == null)
				{
					instance = new SystemConfig();
				}
				return instance;
			}
		}
		public SystemConfig()
		{
			ApiKeys = new Dictionary<string, string>();
			
			// Godotのユーザーデータディレクトリ（%APPDATA%/Godot/app_userdata/DesktopAiMascot など）を設定保存先に変更
			try
			{
				if (Godot.Engine.HasSingleton("OS") || Godot.OS.HasFeature("godot"))
				{
					BaseDir = Godot.ProjectSettings.GlobalizePath("user://");
				}
				else
				{
					BaseDir = AppDomain.CurrentDomain.BaseDirectory;
				}
			}
			catch
			{
				BaseDir = AppDomain.CurrentDomain.BaseDirectory;
			}
			
			Debug.WriteLine($"[SystemConfig] Initialized BaseDir: {BaseDir}");
		}

		// ここにシステム全体の設定プロパティを追加する
		[YamlIgnore]
		public string BaseDir { get; set; }
		public string Language { get; set; } = "ja-JP";

		// APIキーの辞書（メモリ上は平文）
		[YamlIgnore]
		public Dictionary<string, string> ApiKeys { get; set; }
		
		// 暗号化されたAPIキー（YAML保存用）
		public Dictionary<string, string> EncryptedApiKeys { get; set; } = new Dictionary<string, string>();
		

		// 位置情報（個別プロパティとしてYAMLシリアライズ可能にする）
		// -1 は「未設定」を表す（デフォルト位置を使用）
		public int WindowPositionX { get; set; } = -1;
		public int WindowPositionY { get; set; } = -1;
		
		// 後方互換性のため内部的にPointとして扱うプロパティ
		[YamlIgnore]
		public Point WindowPosition
		{
			get => new Point(WindowPositionX, WindowPositionY);
			set
			{
				WindowPositionX = value.X;
				WindowPositionY = value.Y;
			}
		}

		public string MascotName { get; set; } = "AIアシスタント";
		public string LlmService { get; set; } = "LM Studio";
		public string VoiceService { get; set; } = "Style Bert Vits 2";
				
		// サービス毎のURL辞書（推奨）
		public Dictionary<string, string> VoiceServiceUrls { get; set; } = new Dictionary<string, string>();
		
		public string VoiceServiceModel { get; set; } = "";
		public string VoiceServiceSpeaker { get; set; } = "";
		public string ImageService { get; set; } = "ComfyUI";
		public string MovieService { get; set; } = "ComfyUI";
		public string ModelName { get; set; } = "gpt-3.5-turbo";
		public int AngleImageModelIndex { get; set; } = 0;
		
		// Chat AI サービス設定
		public string ChatAiEndpoint { get; set; } = "";
		public string GoogleCloudProjectId { get; set; } = "";
		public string GoogleCloudRegion { get; set; } = "us-central1";
		public double ChatAiTemperature { get; set; } = 1.0;
		public int ChatAiTopK { get; set; } = 20;
		public bool ChatAiTopKToggle { get; set; } = false;
		public bool ChatAiAudioRandomElititors { get; set; } = false;
		public bool ChatAiBridgesRopherlyModels { get; set; } = true;
		public bool ChatAiFilterChatOnlyModels { get; set; } = true;

		public void Load()
		{
			try
			{
				string settingsPath = Path.Combine(BaseDir, settingFile);
				if (!File.Exists(settingsPath)) return;

				var deserializer = new DeserializerBuilder()
					.WithNamingConvention(UnderscoredNamingConvention.Instance)
					.IgnoreUnmatchedProperties()
					.Build();

				string yaml = File.ReadAllText(settingsPath);
				var loaded = deserializer.Deserialize<SystemConfig>(yaml);

				if (loaded != null)
				{
					this.Language = loaded.Language;
					
					// 暗号化されたAPIキーを復号化
					if (loaded.EncryptedApiKeys != null && loaded.EncryptedApiKeys.Count > 0)
					{
						this.ApiKeys = DecryptApiKeys(loaded.EncryptedApiKeys);
					}
					// 後方互換性: 平文のAPIキーが存在する場合は読み込む（次回保存時に暗号化される）
					else if (loaded.ApiKeys != null)
					{
						this.ApiKeys = loaded.ApiKeys;
					}
					
					this.WindowPositionX = loaded.WindowPositionX;
					this.WindowPositionY = loaded.WindowPositionY;
					this.MascotName = loaded.MascotName;
					this.ModelName = loaded.ModelName;
					this.LlmService = loaded.LlmService;
					this.VoiceService = loaded.VoiceService;
					this.VoiceServiceUrls = loaded.VoiceServiceUrls ?? new Dictionary<string, string>();
					this.VoiceServiceModel = loaded.VoiceServiceModel;
					this.VoiceServiceSpeaker = loaded.VoiceServiceSpeaker;
					this.ImageService = loaded.ImageService;
					this.MovieService = loaded.MovieService;
					this.ChatAiEndpoint = loaded.ChatAiEndpoint ?? "";
					this.GoogleCloudProjectId = loaded.GoogleCloudProjectId ?? "";
					this.GoogleCloudRegion = loaded.GoogleCloudRegion ?? "us-central1";
					this.AngleImageModelIndex = loaded.AngleImageModelIndex;
					this.ChatAiTemperature = loaded.ChatAiTemperature != 0 ? loaded.ChatAiTemperature : 1.0;
					this.ChatAiTopK = loaded.ChatAiTopK != 0 ? loaded.ChatAiTopK : 20;
					this.ChatAiTopKToggle = loaded.ChatAiTopKToggle;
					this.ChatAiAudioRandomElititors = loaded.ChatAiAudioRandomElititors;
					this.ChatAiBridgesRopherlyModels = loaded.ChatAiBridgesRopherlyModels;
					this.ChatAiFilterChatOnlyModels = loaded.ChatAiFilterChatOnlyModels;
				}
			}
			catch (Exception ex)
			{
				Debug.WriteLine($"Config load failed: {ex.Message}");
			}
		}

		public void Save()
		{
			try
			{
				string settingsPath = Path.Combine(BaseDir, settingFile);
				
				// APIキーを暗号化
				this.EncryptedApiKeys = EncryptApiKeys(this.ApiKeys);
				
				var serializer = new SerializerBuilder()
					.WithNamingConvention(UnderscoredNamingConvention.Instance)
					.Build();

				string yaml = serializer.Serialize(this);
				File.WriteAllText(settingsPath, yaml);
			}
			catch (Exception ex)
			{
				Debug.WriteLine($"Config save failed: {ex.Message}");
			}
		}

		/// <summary>
		/// APIキーを暗号化します（Godot環境でのProtectedDataロードエラーを避けるためBase64化）
		/// </summary>
		private Dictionary<string, string> EncryptApiKeys(Dictionary<string, string> apiKeys)
		{
			var encrypted = new Dictionary<string, string>();
			
			foreach (var kvp in apiKeys)
			{
				try
				{
					if (string.IsNullOrEmpty(kvp.Value))
					{
						encrypted[kvp.Key] = string.Empty;
						continue;
					}

					// DPAPIではなくBase64エンコードを使用する（Godot実行時のロードエラー対策）
					byte[] plainBytes = Encoding.UTF8.GetBytes(kvp.Value);
					encrypted[kvp.Key] = Convert.ToBase64String(plainBytes);
				}
				catch (Exception ex)
				{
					Debug.WriteLine($"Failed to encrypt API key '{kvp.Key}': {ex.Message}");
					encrypted[kvp.Key] = string.Empty;
				}
			}
			
			return encrypted;
		}

		/// <summary>
		/// APIキーを復号化します。
		/// 旧バージョンのDPAPI暗号化データはReflection経由で復号を試み、失敗すればBase64としてデコードします。
		/// </summary>
		private Dictionary<string, string> DecryptApiKeys(Dictionary<string, string> encryptedApiKeys)
		{
			var decrypted = new Dictionary<string, string>();
			
			foreach (var kvp in encryptedApiKeys)
			{
				try
				{
					if (string.IsNullOrEmpty(kvp.Value))
					{
						decrypted[kvp.Key] = string.Empty;
						continue;
					}

					byte[] encryptedBytes = Convert.FromBase64String(kvp.Value);

					// 過去のDPAPI暗号化からのマイグレーション（Reflectionでロードエラーを回避）
					bool decryptedFlag = false;
					try
					{
						var type = Type.GetType("System.Security.Cryptography.ProtectedData, System.Security.Cryptography.ProtectedData");
						if (type != null)
						{
							var unprotectMethod = type.GetMethod("Unprotect", new Type[] { typeof(byte[]), typeof(byte[]), typeof(DataProtectionScope) });
							if (unprotectMethod != null)
							{
								byte[] plainBytes = (byte[])unprotectMethod.Invoke(null, new object?[] { encryptedBytes, null, DataProtectionScope.CurrentUser })!;
								decrypted[kvp.Key] = Encoding.UTF8.GetString(plainBytes);
								decryptedFlag = true;
							}
						}
					}
					catch
					{
						// DPAPI復号に失敗した場合は無視してBase64を試す
					}

					if (!decryptedFlag)
					{
						// Base64デコードとして処理
						decrypted[kvp.Key] = Encoding.UTF8.GetString(encryptedBytes);
					}
				}
				catch (Exception ex)
				{
					Debug.WriteLine($"Failed to decrypt API key '{kvp.Key}': {ex.Message}");
					decrypted[kvp.Key] = string.Empty;
				}
			}
			
			return decrypted;
		}
		
		/// <summary>
		/// 指定されたVoice AIサービスのURLを取得します。
		/// サービス固有のURLがない場合は、サービスのデフォルトEndPointを返します。
		/// </summary>
		/// <param name="serviceName">サービス名</param>
		/// <param name="defaultEndPoint">サービスのデフォルトエンドポイント</param>
		/// <returns>サービスのURL</returns>
		public string GetVoiceServiceUrl(string serviceName, string defaultEndPoint)
		{
			if (VoiceServiceUrls != null && VoiceServiceUrls.TryGetValue(serviceName, out string? url))
			{
				if (!string.IsNullOrEmpty(url))
				{
					// 末尾のスラッシュを削除
					return url.TrimEnd('/');
				}
			}
						
			// デフォルトエンドポイントを返す
			return defaultEndPoint.TrimEnd('/');
		}
		
		/// <summary>
		/// 指定されたVoice AIサービスのURLを設定します。
		/// </summary>
		/// <param name="serviceName">サービス名</param>
		/// <param name="url">URL</param>
		public void SetVoiceServiceUrl(string serviceName, string url)
		{
			if (VoiceServiceUrls == null)
			{
				VoiceServiceUrls = new Dictionary<string, string>();
			}
			
			// 末尾のスラッシュを削除して保存
			VoiceServiceUrls[serviceName] = url?.TrimEnd('/') ?? string.Empty;
			
		}
	}
}
