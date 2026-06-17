use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Image,
    Video,
    Audio,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SourceMode {
    Text,
    Image,
    Video,
    Audio,
    Frames,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WorkVisibility {
    Private,
    Gallery,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Queued,
    Running,
    Caching,
    Succeeded,
    Failed,
    Review,
    Cancelled,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorDto {
    pub id: String,
    pub name: String,
    pub avatar_seed: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDto {
    pub id: String,
    pub name: String,
    pub email: String,
    pub avatar_seed: String,
    pub plan: String,
    pub credits: i64,
    pub credits_total: i64,
    pub entitlehub_customer_id: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaItemDto {
    pub id: String,
    #[serde(rename = "type")]
    pub media_type: MediaType,
    pub asset_id: Option<String>,
    pub seed: String,
    pub url: Option<String>,
    pub prompt: String,
    pub full_prompt: Option<String>,
    pub model: String,
    pub category: String,
    pub aspect_ratio: String,
    pub resolution: Option<String>,
    pub author: AuthorDto,
    pub likes: i64,
    pub created_at: i64,
    pub duration_sec: Option<i64>,
    pub source_mode: Option<SourceMode>,
    pub reference_count: Option<u32>,
    pub has_first_frame: Option<bool>,
    pub has_last_frame: Option<bool>,
    pub visibility: Option<WorkVisibility>,
    pub published_at: Option<i64>,
    pub favorited_at: Option<i64>,
    pub downloaded_at: Option<i64>,
    pub demo: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGenerationJobRequest {
    #[serde(rename = "type")]
    pub media_type: MediaType,
    pub prompt: String,
    pub model: String,
    pub aspect_ratio: String,
    pub resolution: Option<String>,
    pub count: Option<u32>,
    pub duration_sec: Option<u32>,
    pub style_id: Option<String>,
    pub source_mode: Option<SourceMode>,
    pub reference_assets: Option<Vec<ReferenceAssetInput>>,
    pub reference_asset_ids: Option<Vec<String>>,
    pub first_frame_asset_id: Option<String>,
    pub last_frame_asset_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceAssetInput {
    pub asset_id: String,
    pub kind: String,
    pub role: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationJobDto {
    pub id: String,
    #[serde(skip)]
    pub customer_id: Option<String>,
    pub entitlehub_job_id: Option<String>,
    #[serde(rename = "type")]
    pub media_type: MediaType,
    pub status: JobStatus,
    pub progress: u8,
    pub prompt: String,
    pub model: String,
    pub aspect_ratio: String,
    pub resolution: Option<String>,
    pub count: u32,
    pub created_at: i64,
    pub updated_at: i64,
    pub results: Vec<MediaItemDto>,
    pub error: Option<String>,
    pub duration_sec: Option<u32>,
    pub held_minor: i64,
    pub charged_minor: i64,
    pub idempotency_key: String,
    pub source_mode: Option<SourceMode>,
    pub reference_count: Option<u32>,
    pub has_first_frame: Option<bool>,
    pub has_last_frame: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelProductDto {
    pub id: String,
    pub name: String,
    #[serde(alias = "type")]
    pub modality: MediaType,
    #[serde(default, alias = "provider_model")]
    pub provider_model: Option<String>,
    #[serde(default)]
    pub billing: BillingDto,
    #[serde(default)]
    pub capabilities: ModelCapabilitiesDto,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BillingDto {
    #[serde(default = "default_billing_currency")]
    pub currency: String,
    #[serde(default = "default_billing_mode")]
    pub mode: String,
    #[serde(default, alias = "second_price_minor")]
    pub second_price_minor: Option<i64>,
    #[serde(default, alias = "request_price_minor")]
    pub request_price_minor: Option<i64>,
    #[serde(default, alias = "image_price_minor")]
    pub image_price_minor: Option<i64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCapabilitiesDto {
    #[serde(default)]
    pub ratios: Vec<String>,
    #[serde(default)]
    pub resolutions: Vec<String>,
    #[serde(default)]
    pub durations: Vec<u32>,
    #[serde(default, alias = "default_duration_seconds")]
    pub default_duration_seconds: Option<u32>,
    #[serde(default, alias = "image_counts")]
    pub image_counts: Vec<u32>,
    #[serde(default, alias = "max_images")]
    pub max_images: Option<u32>,
    #[serde(default, alias = "input_modes")]
    pub input_modes: Vec<SourceMode>,
    #[serde(default, alias = "max_reference_images")]
    pub max_reference_images: Option<u32>,
    #[serde(default, alias = "max_reference_videos")]
    pub max_reference_videos: Option<u32>,
    #[serde(default, alias = "max_reference_audios")]
    pub max_reference_audios: Option<u32>,
    #[serde(default, alias = "supports_reference_video")]
    pub supports_reference_video: Option<bool>,
    #[serde(default, alias = "supports_reference_audio")]
    pub supports_reference_audio: Option<bool>,
    #[serde(default, alias = "supports_first_frame")]
    pub supports_first_frame: Option<bool>,
    #[serde(default, alias = "supports_last_frame")]
    pub supports_last_frame: Option<bool>,
    #[serde(default, alias = "accepted_mime_types")]
    pub accepted_mime_types: Vec<String>,
    #[serde(default, alias = "max_asset_size_mb")]
    pub max_asset_size_mb: Option<u32>,
    #[serde(default, alias = "max_image_asset_size_mb")]
    pub max_image_asset_size_mb: Option<u32>,
    #[serde(default, alias = "max_video_asset_size_mb")]
    pub max_video_asset_size_mb: Option<u32>,
    #[serde(default, alias = "max_audio_asset_size_mb")]
    pub max_audio_asset_size_mb: Option<u32>,
    #[serde(default, alias = "min_reference_video_seconds")]
    pub min_reference_video_seconds: Option<u32>,
    #[serde(default, alias = "max_reference_video_seconds")]
    pub max_reference_video_seconds: Option<u32>,
    #[serde(default, alias = "total_reference_video_seconds")]
    pub total_reference_video_seconds: Option<u32>,
    #[serde(default, alias = "min_reference_audio_seconds")]
    pub min_reference_audio_seconds: Option<u32>,
    #[serde(default, alias = "max_reference_audio_seconds")]
    pub max_reference_audio_seconds: Option<u32>,
    #[serde(default, alias = "total_reference_audio_seconds")]
    pub total_reference_audio_seconds: Option<u32>,
}

impl Default for BillingDto {
    fn default() -> Self {
        Self {
            currency: default_billing_currency(),
            mode: default_billing_mode(),
            second_price_minor: None,
            request_price_minor: Some(0),
            image_price_minor: None,
        }
    }
}

fn default_billing_currency() -> String {
    "CNY".to_string()
}

fn default_billing_mode() -> String {
    "image_per_item".to_string()
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub user: UserDto,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub user: UserDto,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageStatDto {
    pub label: String,
    pub value: String,
    pub unit: String,
    pub trend: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageResponse {
    pub stats: Vec<UsageStatDto>,
    pub daily_credits: Vec<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyResponse {
    pub masked_key: String,
    pub endpoint: String,
    pub enabled: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingPlanDto {
    pub id: String,
    pub name: String,
    pub tagline: String,
    pub price_monthly: i64,
    pub price_yearly: i64,
    pub credits: String,
    pub features: Vec<String>,
    pub highlighted: bool,
    pub cta: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingPlansResponse {
    pub plans: Vec<PricingPlanDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetFolderDto {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub count: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetItemDto {
    pub id: String,
    pub seed: String,
    pub name: String,
    pub folder_id: String,
    pub kind: String,
    pub url: Option<String>,
    pub thumbnail_url: Option<String>,
    pub mime_type: Option<String>,
    pub file_size: Option<i64>,
    pub status: Option<String>,
    pub duration: Option<i64>,
    pub duration_sec: Option<i64>,
    pub duration_seconds: Option<i64>,
    pub role: Option<String>,
    pub source: Option<String>,
    pub source_alias: Option<String>,
    pub width: Option<i64>,
    pub height: Option<i64>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetsResponse {
    pub folders: Vec<AssetFolderDto>,
    pub materials: Vec<AssetItemDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetFolderResponse {
    pub folder: AssetFolderDto,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetFolderRequest {
    pub name: String,
    pub parent_id: Option<String>,
    pub kind: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetUploadRequest {
    pub folder_id: Option<String>,
    pub file_name: String,
    pub asset_type: String,
    pub asset_role: Option<String>,
    pub mime_type: String,
    pub file_size: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetUploadDto {
    #[serde(alias = "upload_id")]
    pub upload_id: String,
    pub method: String,
    pub url: String,
    #[serde(alias = "upload_token")]
    pub upload_token: String,
    #[serde(alias = "token_prefix")]
    pub token_prefix: Option<String>,
    #[serde(alias = "expires_at")]
    pub expires_at: Option<String>,
    #[serde(alias = "max_bytes")]
    pub max_bytes: Option<i64>,
    #[serde(default)]
    pub headers: serde_json::Value,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetUploadResponse {
    pub upload: AssetUploadDto,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedAssetDto {
    pub asset_id: String,
    pub url: Option<String>,
    #[serde(rename = "type")]
    pub asset_type: Option<String>,
    pub mime_type: Option<String>,
    pub asset: Option<AssetItemDto>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkDownloadResponse {
    pub download_url: String,
    pub downloaded_at: Option<i64>,
    pub work: Option<MediaItemDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkResponse {
    pub work: Option<MediaItemDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionResponse {
    pub ok: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishWorkRequest {
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StylePresetDto {
    pub id: String,
    pub name: String,
    pub seed: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StylePresetsResponse {
    pub styles: Vec<StylePresetDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelsResponse {
    pub data: Vec<ModelProductDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobResponse {
    pub job: GenerationJobDto,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobsResponse {
    pub jobs: Vec<GenerationJobDto>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorksResponse {
    pub works: Vec<MediaItemDto>,
}
