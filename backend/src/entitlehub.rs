use crate::{
    config::AppConfig,
    error::{ApiError, ApiResult},
    models::{
        AssetFolderDto, AssetItemDto, AssetUploadDto, AssetsResponse, AuthorDto, BillingDto,
        CreateAssetFolderRequest, CreateAssetUploadRequest, CreateGenerationJobRequest, JobStatus,
        MediaItemDto, MediaType, ModelCapabilitiesDto, ModelProductDto, SourceMode,
        UploadedAssetDto, WorkDownloadResponse, WorkVisibility,
    },
};
use reqwest::{
    Method,
    header::{AUTHORIZATION, CONTENT_TYPE, HeaderMap, HeaderName, HeaderValue},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(Clone)]
pub struct EntitleHubClient {
    http: reqwest::Client,
    config: AppConfig,
}

#[derive(Clone, Debug)]
pub struct EntitleHubCustomerSession {
    pub customer_id: String,
    pub email: String,
    pub name: String,
}

#[derive(Clone, Debug, Default)]
pub struct EntitleHubCustomerProfile {
    pub customer_id: String,
    pub email: Option<String>,
    pub name: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub struct EntitleHubBalanceSummary {
    pub balance_minor: i64,
    pub held_minor: i64,
    pub available_minor: i64,
}

#[derive(Clone, Debug, Default)]
pub struct EntitleHubPlanSummary {
    pub name: Option<String>,
    pub credits_total: Option<i64>,
}

#[derive(Clone, Debug, Default)]
pub struct EntitleHubUsageSummary {
    pub generated: i64,
    pub charged_minor: i64,
    pub image_count: i64,
    pub video_count: i64,
    pub audio_count: i64,
    pub daily_credits: Vec<i64>,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct AssetListFilters<'a> {
    pub kind: Option<&'a str>,
    pub source: Option<&'a str>,
    pub asset_role: Option<&'a str>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct EntitleHubJob {
    pub id: String,
    #[serde(default, alias = "jobType", alias = "job_type", alias = "type")]
    pub job_type: Option<MediaType>,
    pub status: String,
    #[serde(default, alias = "providerJobId", alias = "provider_job_id")]
    pub provider_job_id: Option<String>,
    #[serde(default, alias = "chargeMode", alias = "charge_mode")]
    pub charge_mode: Option<String>,
    #[serde(default)]
    pub quantity: Option<i64>,
    #[serde(default, alias = "heldMinor", alias = "held_minor")]
    pub held_minor: Option<i64>,
    #[serde(default, alias = "chargedMinor", alias = "charged_minor")]
    pub charged_minor: Option<i64>,
    #[serde(default, alias = "assetUrls", alias = "asset_urls")]
    pub asset_urls: Vec<String>,
    #[serde(default, alias = "createdAt", alias = "created_at")]
    pub created_at: Option<String>,
    #[serde(default, alias = "updatedAt", alias = "updated_at")]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub prompt: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default, alias = "aspectRatio", alias = "aspect_ratio")]
    pub aspect_ratio: Option<String>,
    #[serde(default)]
    pub ratio: Option<String>,
    #[serde(default)]
    pub resolution: Option<String>,
    #[serde(default)]
    pub size: Option<String>,
    #[serde(default)]
    pub count: Option<u32>,
    #[serde(default)]
    pub n: Option<u32>,
    #[serde(default, alias = "durationSec", alias = "duration_sec")]
    pub duration_sec: Option<u32>,
    #[serde(default)]
    pub duration: Option<u32>,
    #[serde(default)]
    pub progress: Option<u8>,
    #[serde(default)]
    pub assets: Vec<EntitleHubAsset>,
    #[serde(default, alias = "workId", alias = "work_id")]
    pub work_id: Option<String>,
    #[serde(default, alias = "sourceMode", alias = "source_mode")]
    pub source_mode: Option<SourceMode>,
    #[serde(default, alias = "referenceCount", alias = "reference_count")]
    pub reference_count: Option<u32>,
    #[serde(default, alias = "hasFirstFrame", alias = "has_first_frame")]
    pub has_first_frame: Option<bool>,
    #[serde(default, alias = "hasLastFrame", alias = "has_last_frame")]
    pub has_last_frame: Option<bool>,
    #[serde(
        default,
        alias = "failureReason",
        alias = "failure_reason",
        alias = "error"
    )]
    pub failure_reason: Option<String>,
    #[serde(default, alias = "requestPayload", alias = "request_payload")]
    pub request_payload: Option<Value>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct EntitleHubAssetFolder {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub metadata: Option<Value>,
    #[serde(default, alias = "asset_count", alias = "assetCount")]
    pub asset_count: Option<i64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[allow(dead_code)]
pub struct EntitleHubAsset {
    pub id: String,
    #[serde(default, alias = "file_name", alias = "fileName")]
    pub file_name: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, alias = "folder_id", alias = "folderId")]
    pub folder_id: Option<String>,
    #[serde(default, alias = "asset_type", alias = "assetType")]
    pub asset_type: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default, alias = "asset_role", alias = "assetRole")]
    pub asset_role: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default, alias = "source_alias", alias = "sourceAlias")]
    pub source_alias: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default, alias = "asset_url", alias = "assetUrl")]
    pub asset_url: Option<String>,
    #[serde(default, alias = "download_url", alias = "downloadUrl")]
    pub download_url: Option<String>,
    #[serde(default, alias = "public_url", alias = "publicUrl")]
    pub public_url: Option<String>,
    #[serde(default, alias = "thumbnail_url", alias = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    #[serde(default, alias = "cover_url", alias = "coverUrl")]
    pub cover_url: Option<String>,
    #[serde(default, alias = "cover_asset_url", alias = "coverAssetUrl")]
    pub cover_asset_url: Option<String>,
    #[serde(default, alias = "poster_url", alias = "posterUrl")]
    pub poster_url: Option<String>,
    #[serde(default, alias = "mime_type", alias = "mimeType")]
    pub mime_type: Option<String>,
    #[serde(default, alias = "file_size", alias = "fileSize")]
    pub file_size: Option<i64>,
    #[serde(default)]
    pub duration: Option<i64>,
    #[serde(default, alias = "duration_sec", alias = "durationSec")]
    pub duration_sec: Option<i64>,
    #[serde(default, alias = "duration_seconds", alias = "durationSeconds")]
    pub duration_seconds: Option<i64>,
    #[serde(default)]
    pub width: Option<i64>,
    #[serde(default)]
    pub height: Option<i64>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

#[derive(Clone, Debug, Deserialize)]
#[allow(dead_code)]
pub struct EntitleHubWork {
    pub id: String,
    #[serde(default, alias = "owner_customer_id", alias = "ownerCustomerId")]
    pub owner_customer_id: Option<String>,
    #[serde(default, alias = "source_job_id", alias = "sourceJobId")]
    pub source_job_id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, alias = "work_type", alias = "workType", alias = "type")]
    pub work_type: Option<MediaType>,
    #[serde(default)]
    pub visibility: Option<String>,
    #[serde(default, alias = "primary_asset_id", alias = "primaryAssetId")]
    pub primary_asset_id: Option<String>,
    #[serde(default, alias = "primary_asset_url", alias = "primaryAssetUrl")]
    pub primary_asset_url: Option<String>,
    #[serde(default, alias = "cover_asset_url", alias = "coverAssetUrl")]
    pub cover_asset_url: Option<String>,
    #[serde(default, alias = "favorite_count", alias = "favoriteCount")]
    pub favorite_count: Option<i64>,
    #[serde(default)]
    pub favorited: Option<bool>,
    #[serde(default, alias = "sourceMode")]
    pub source_mode: Option<SourceMode>,
    #[serde(default, alias = "referenceCount")]
    pub reference_count: Option<u32>,
    #[serde(default, alias = "hasFirstFrame")]
    pub has_first_frame: Option<bool>,
    #[serde(default, alias = "hasLastFrame")]
    pub has_last_frame: Option<bool>,
    #[serde(default, alias = "publishedAt")]
    pub published_at_camel: Option<String>,
    #[serde(default, alias = "favoritedAt")]
    pub favorited_at: Option<String>,
    #[serde(default, alias = "downloadedAt")]
    pub downloaded_at: Option<String>,
    #[serde(default, alias = "publication_status", alias = "publicationStatus")]
    pub publication_status: Option<String>,
    #[serde(default, alias = "published_at")]
    pub published_at: Option<String>,
    #[serde(default, alias = "publication_tags", alias = "publicationTags")]
    pub publication_tags: Vec<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
    #[serde(default)]
    pub prompt: Option<String>,
    #[serde(default, alias = "full_prompt", alias = "fullPrompt")]
    pub full_prompt: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default, alias = "model_id", alias = "modelId")]
    pub model_id: Option<String>,
    #[serde(default, alias = "model_name", alias = "modelName")]
    pub model_name: Option<String>,
    #[serde(default, alias = "aspect_ratio", alias = "aspectRatio")]
    pub aspect_ratio: Option<String>,
    #[serde(default)]
    pub ratio: Option<String>,
    #[serde(default)]
    pub resolution: Option<String>,
    #[serde(default, alias = "duration_sec", alias = "durationSec")]
    pub duration_sec: Option<i64>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default, alias = "created_at", alias = "createdAt")]
    pub created_at: Option<Value>,
}

impl EntitleHubClient {
    pub fn new(config: AppConfig) -> Self {
        Self {
            http: reqwest::Client::new(),
            config,
        }
    }

    pub fn is_mock(&self) -> bool {
        self.config.mock_entitlehub
    }

    pub async fn login_customer(
        &self,
        email: &str,
        password: &str,
    ) -> ApiResult<EntitleHubCustomerSession> {
        if self.is_mock() {
            return Ok(EntitleHubCustomerSession {
                customer_id: self.config.demo_customer_id.clone(),
                email: email.to_string(),
                name: email.split('@').next().unwrap_or("影织用户").to_string(),
            });
        }

        let base = self.base_url()?;
        let response = self
            .http
            .post(format!("{base}/api/server/web/v1/customers/login"))
            .headers(self.server_headers(None)?)
            .json(&json!({
                "email": email,
                "password": password,
            }))
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let customer = data
            .get("customer")
            .or_else(|| data.get("user"))
            .cloned()
            .unwrap_or_else(|| data.clone());

        let customer_id = value_string(
            &data,
            &["customer_id", "customerId", "id"],
        )
        .or_else(|| value_string(&customer, &["customer_id", "customerId", "id"]))
        .ok_or_else(|| ApiError::Upstream {
            code: "ENTITLEHUB_LOGIN_RESPONSE_INVALID",
            message: "EntitleHub 登录成功但未返回 customer_id".to_string(),
        })?;
        let email = value_string(&data, &["email"])
            .or_else(|| value_string(&customer, &["email"]))
            .unwrap_or_else(|| email.to_string());
        let name = value_string(&data, &["name", "customer_name", "customerName"])
            .or_else(|| value_string(&customer, &["name", "customer_name", "customerName"]))
            .unwrap_or_else(|| email.split('@').next().unwrap_or("影织用户").to_string());

        Ok(EntitleHubCustomerSession {
            customer_id,
            email,
            name,
        })
    }

    pub async fn get_customer_profile(
        &self,
        customer_id: &str,
    ) -> ApiResult<EntitleHubCustomerProfile> {
        if self.is_mock() {
            return Ok(EntitleHubCustomerProfile {
                customer_id: self.config.demo_customer_id.clone(),
                email: None,
                name: None,
            });
        }

        let base = self.base_url()?;
        let response = self
            .http
            .get(format!("{base}/api/server/web/v1/customers/{customer_id}"))
            .headers(self.server_headers(None)?)
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let customer = data
            .get("customer")
            .or_else(|| data.get("user"))
            .cloned()
            .unwrap_or_else(|| data.clone());

        Ok(EntitleHubCustomerProfile {
            customer_id: value_string(&data, &["customer_id", "customerId", "id"])
                .or_else(|| value_string(&customer, &["customer_id", "customerId", "id"]))
                .unwrap_or_else(|| customer_id.to_string()),
            email: value_string(&data, &["email"])
                .or_else(|| value_string(&customer, &["email"])),
            name: value_string(&data, &["name", "customer_name", "customerName"])
                .or_else(|| value_string(&customer, &["name", "customer_name", "customerName"])),
        })
    }

    pub async fn get_customer_balance(
        &self,
        customer_id: &str,
    ) -> ApiResult<EntitleHubBalanceSummary> {
        if self.is_mock() {
            return Ok(EntitleHubBalanceSummary::default());
        }

        let base = self.base_url()?;
        let response = self
            .http
            .get(format!(
                "{base}/api/server/web/v1/customers/{customer_id}/balance"
            ))
            .headers(self.server_headers(None)?)
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let balance = data
            .get("balance")
            .or_else(|| data.get("wallet"))
            .cloned()
            .unwrap_or_else(|| data.clone());
        let balance_minor = value_i64(
            &balance,
            &[
                "balance_minor",
                "balanceMinor",
                "total_minor",
                "totalMinor",
                "credits",
                "balance",
            ],
        )
        .unwrap_or(0);
        let held_minor = value_i64(
            &balance,
            &[
                "held_minor",
                "heldMinor",
                "frozen_minor",
                "frozenMinor",
                "reserved_minor",
                "reservedMinor",
            ],
        )
        .unwrap_or(0);
        let available_minor = value_i64(
            &balance,
            &[
                "available_minor",
                "availableMinor",
                "available",
                "available_balance",
                "availableBalance",
            ],
        )
        .unwrap_or_else(|| balance_minor.saturating_sub(held_minor));

        Ok(EntitleHubBalanceSummary {
            balance_minor,
            held_minor,
            available_minor,
        })
    }

    pub async fn get_customer_plan(
        &self,
        customer_id: &str,
    ) -> ApiResult<EntitleHubPlanSummary> {
        if self.is_mock() {
            return Ok(EntitleHubPlanSummary::default());
        }

        let base = self.base_url()?;
        let response = self
            .http
            .get(format!("{base}/api/server/web/v1/customers/{customer_id}/plan"))
            .headers(self.server_headers(None)?)
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        if data.is_null() {
            return Ok(EntitleHubPlanSummary::default());
        }
        let plan = data
            .get("plan")
            .cloned()
            .unwrap_or_else(|| data.clone());

        Ok(EntitleHubPlanSummary {
            name: value_string(&plan, &["name", "plan_name", "planName", "title"]),
            credits_total: value_i64(
                &plan,
                &[
                    "credits_total",
                    "creditsTotal",
                    "credits",
                    "monthly_credits",
                    "monthlyCredits",
                    "quota",
                    "quota_minor",
                    "quotaMinor",
                ],
            ),
        })
    }

    pub async fn get_customer_usage(
        &self,
        customer_id: &str,
    ) -> ApiResult<EntitleHubUsageSummary> {
        if self.is_mock() {
            return Ok(EntitleHubUsageSummary::default());
        }

        let base = self.base_url()?;
        let response = self
            .http
            .get(format!(
                "{base}/api/server/web/v1/customers/{customer_id}/usage?page=1&page_size=100"
            ))
            .headers(self.server_headers(None)?)
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        Ok(usage_summary_from_value(data))
    }

    pub async fn list_models(&self, customer_id: Option<&str>) -> ApiResult<Vec<ModelProductDto>> {
        if self.is_mock() {
            return Ok(mock_models());
        }

        let base = self.base_url()?;
        let response = match self
            .http
            .get(format!("{base}/api/server/web/v1/ai/models"))
            .headers(self.server_headers_for_customer(customer_id.unwrap_or_default(), None)?)
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => response,
            _ => {
                self.http
                    .get(format!("{base}/api/server/ai/v1/models"))
                    .headers(self.server_headers_for_customer(customer_id.unwrap_or_default(), None)?)
                    .send()
                    .await?
            }
        };

        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let models_data = data.get("data").cloned().unwrap_or(data);
        serde_json::from_value(models_data).map_err(ApiError::from)
    }

    pub async fn create_job(
        &self,
        customer_id: &str,
        idempotency_key: &str,
        input: &CreateGenerationJobRequest,
    ) -> ApiResult<EntitleHubJob> {
        if self.is_mock() {
            return Ok(EntitleHubJob {
                id: Uuid::new_v4().to_string(),
                job_type: Some(input.media_type.clone()),
                status: "submitted".to_string(),
                provider_job_id: Some(format!("mock-{}", Uuid::new_v4())),
                charge_mode: Some(
                    match input.media_type {
                        MediaType::Image => "image_per_item",
                        MediaType::Video => "video_per_second",
                        MediaType::Audio => "audio_per_second",
                    }
                    .to_string(),
                ),
                quantity: Some(match input.media_type {
                    MediaType::Image => input.count.unwrap_or(1) as i64,
                    MediaType::Video => input.duration_sec.unwrap_or(8) as i64,
                    MediaType::Audio => input.duration_sec.unwrap_or(1) as i64,
                }),
                held_minor: Some(match input.media_type {
                    MediaType::Image => input.count.unwrap_or(1) as i64 * 80,
                    MediaType::Video => input.duration_sec.unwrap_or(8) as i64 * 20,
                    MediaType::Audio => input.duration_sec.unwrap_or(1) as i64 * 10,
                }),
                charged_minor: Some(0),
                asset_urls: vec![],
                created_at: None,
                updated_at: None,
                prompt: Some(input.prompt.clone()),
                model: Some(input.model.clone()),
                aspect_ratio: Some(input.aspect_ratio.clone()),
                ratio: Some(input.aspect_ratio.clone()),
                resolution: input.resolution.clone(),
                size: input.resolution.clone(),
                count: input.count,
                n: input.count,
                duration_sec: input.duration_sec,
                duration: input.duration_sec,
                progress: None,
                assets: vec![],
                work_id: None,
                source_mode: input.source_mode.clone(),
                reference_count: reference_asset_count(input),
                has_first_frame: Some(input.first_frame_asset_id.is_some()),
                has_last_frame: Some(input.last_frame_asset_id.is_some()),
                failure_reason: None,
                request_payload: None,
            });
        }

        let base = self.base_url()?;
        let mut payload = json!({
            "customer_id": customer_id,
            "type": input.media_type,
            "model": input.model,
            "prompt": input.prompt,
            "ratio": input.aspect_ratio,
        });

        if let Some(obj) = payload.as_object_mut() {
            if let Some(source_mode) = &input.source_mode {
                obj.insert("inputMode".to_string(), json!(source_mode));
                obj.insert("sourceMode".to_string(), json!(source_mode));
            }
            let reference_assets = normalized_reference_assets(input);
            if !reference_assets.is_empty() {
                obj.insert("referenceAssets".to_string(), json!(reference_assets));
            }
            if let Some(reference_asset_ids) = &input.reference_asset_ids {
                if !reference_asset_ids.is_empty() {
                    obj.insert("referenceAssetIds".to_string(), json!(reference_asset_ids));
                }
            }
            if let Some(first_frame_asset_id) = &input.first_frame_asset_id {
                obj.insert("firstFrameAssetId".to_string(), json!(first_frame_asset_id));
            }
            if let Some(last_frame_asset_id) = &input.last_frame_asset_id {
                obj.insert("lastFrameAssetId".to_string(), json!(last_frame_asset_id));
            }
            if let Some(resolution) = &input.resolution {
                obj.insert("resolution".to_string(), json!(resolution));
            }
            obj.insert("aspectRatio".to_string(), json!(input.aspect_ratio));
            match input.media_type {
                MediaType::Image => {
                    obj.insert("n".to_string(), json!(input.count.unwrap_or(1)));
                    if let Some(resolution) = &input.resolution {
                        obj.insert("size".to_string(), json!(resolution));
                    }
                }
                MediaType::Video => {
                    obj.insert(
                        "duration".to_string(),
                        json!(input.duration_sec.unwrap_or(8)),
                    );
                    obj.insert(
                        "durationSec".to_string(),
                        json!(input.duration_sec.unwrap_or(8)),
                    );
                }
                MediaType::Audio => {
                    if let Some(duration_sec) = input.duration_sec {
                        obj.insert("duration".to_string(), json!(duration_sec));
                        obj.insert("durationSec".to_string(), json!(duration_sec));
                    }
                }
            }
        }

        let response = self
            .http
            .post(format!("{base}/api/server/web/v1/ai/jobs"))
            .headers(self.server_headers(Some(idempotency_key))?)
            .json(&payload)
            .send()
            .await?;

        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let job = data.get("job").cloned().unwrap_or(data);
        serde_json::from_value(job).map_err(ApiError::from)
    }

    pub async fn get_job(&self, customer_id: &str, job_id: &str) -> ApiResult<EntitleHubJob> {
        if self.is_mock() {
            return Err(ApiError::BadRequest {
                code: "MOCK_JOB_QUERY_UNSUPPORTED",
                message: "mock EntitleHub jobs are advanced by local state".to_string(),
            });
        }

        let base = self.base_url()?;
        let response = self
            .http
            .get(format!(
                "{base}/api/server/web/v1/ai/jobs/{job_id}?customer_id={customer_id}"
            ))
            .headers(self.server_headers(None)?)
            .send()
            .await?;

        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let job = data.get("job").cloned().unwrap_or(data);
        serde_json::from_value(job).map_err(ApiError::from)
    }

    pub async fn list_jobs(
        &self,
        customer_id: &str,
        media_type: Option<MediaType>,
    ) -> ApiResult<Vec<EntitleHubJob>> {
        if self.is_mock() {
            return Ok(vec![]);
        }

        let base = self.base_url()?;
        let mut url = format!(
            "{base}/api/server/web/v1/ai/jobs?customer_id={customer_id}&page=1&page_size=50"
        );
        if let Some(media_type) = media_type {
            url.push_str(&format!("&type={}", media_type_label(&media_type)));
        }
        let response = self
            .http
            .get(url)
            .headers(self.server_headers(None)?)
            .send()
            .await?;

        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let jobs = list_value(data, &["jobs", "data", "items"]);
        serde_json::from_value(jobs).map_err(ApiError::from)
    }

    pub async fn list_works(
        &self,
        customer_id: &str,
        media_type: Option<MediaType>,
        favorite: bool,
    ) -> ApiResult<Vec<MediaItemDto>> {
        if self.is_mock() {
            return Ok(vec![]);
        }

        let base = self.base_url()?;
        let mut url =
            format!("{base}/api/server/web/v1/works?customer_id={customer_id}&page=1&page_size=50");
        if let Some(media_type) = media_type {
            url.push_str(&format!("&type={}", media_type_label(&media_type)));
        }
        if favorite {
            url.push_str("&favorite=true");
        }

        let response = self
            .http
            .get(url)
            .headers(self.server_headers(None)?)
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        Ok(parse_work_list(data, customer_id))
    }

    pub async fn list_gallery(
        &self,
        customer_id: Option<&str>,
        media_type: Option<MediaType>,
    ) -> ApiResult<Vec<MediaItemDto>> {
        if self.is_mock() {
            return Ok(vec![]);
        }

        let base = self.base_url()?;
        let mut url = format!("{base}/api/server/web/v1/gallery?page=1&page_size=50");
        if let Some(customer_id) = customer_id.filter(|value| !value.trim().is_empty()) {
            url.push_str(&format!("&customer_id={customer_id}"));
        }
        if let Some(media_type) = media_type {
            url.push_str(&format!("&type={}", media_type_label(&media_type)));
        }

        let response = self
            .http
            .get(url)
            .headers(self.server_headers(None)?)
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        Ok(parse_work_list(data, customer_id.unwrap_or_default()))
    }

    pub async fn list_assets(
        &self,
        customer_id: &str,
        filters: AssetListFilters<'_>,
    ) -> ApiResult<AssetsResponse> {
        if self.is_mock() {
            return Ok(AssetsResponse {
                folders: vec![],
                materials: vec![],
            });
        }

        let base = self.base_url()?;
        let folders_response = self
            .http
            .get(format!(
                "{base}/api/server/web/v1/asset-folders?customer_id={customer_id}"
            ))
            .headers(self.server_headers(None)?)
            .send()
            .await?;
        let mut query: Vec<(&str, String)> = vec![
            ("customer_id", customer_id.to_string()),
            ("page", filters.page.unwrap_or(1).to_string()),
            ("page_size", filters.page_size.unwrap_or(100).to_string()),
        ];
        if let Some(kind) = filters.kind.filter(|value| !value.trim().is_empty()) {
            query.push(("kind", kind.to_string()));
        }
        if let Some(source) = filters.source.filter(|value| !value.trim().is_empty()) {
            query.push(("source", source.to_string()));
        }
        if let Some(asset_role) = filters.asset_role.filter(|value| !value.trim().is_empty()) {
            query.push(("asset_role", asset_role.to_string()));
        }
        let assets_response = self
            .http
            .get(format!("{base}/api/server/web/v1/assets"))
            .headers(self.server_headers(None)?)
            .query(&query)
            .send()
            .await?;

        let folders_data = unwrap_entitlehub_data(folders_response.json::<Value>().await?)?;
        let assets_data = unwrap_entitlehub_data(assets_response.json::<Value>().await?)?;
        let folders_raw: Vec<EntitleHubAssetFolder> =
            serde_json::from_value(list_value(folders_data, &["folders", "items"]))
                .map_err(ApiError::from)?;
        let assets_raw: Vec<EntitleHubAsset> =
            serde_json::from_value(list_value(assets_data, &["assets", "items"]))
                .map_err(ApiError::from)?;

        let folders = folders_raw
            .into_iter()
            .map(|folder| AssetFolderDto {
                id: folder.id,
                name: folder.name,
                kind: folder
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get("scene"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("folder")
                    .to_string(),
                count: folder.asset_count.unwrap_or(0),
            })
            .collect();
        let materials = assets_raw
            .into_iter()
            .map(|asset| asset_to_item(asset))
            .collect();

        Ok(AssetsResponse { folders, materials })
    }

    pub async fn create_asset_folder(
        &self,
        customer_id: &str,
        input: &CreateAssetFolderRequest,
    ) -> ApiResult<AssetFolderDto> {
        if self.is_mock() {
            return Ok(AssetFolderDto {
                id: Uuid::new_v4().to_string(),
                name: input.name.trim().to_string(),
                kind: input.kind.clone().unwrap_or_else(|| "folder".to_string()),
                count: 0,
            });
        }

        let base = self.base_url()?;
        let payload = json!({
            "customer_id": customer_id,
            "parent_id": input.parent_id,
            "name": input.name,
            "metadata": {
                "scene": input.kind.clone().unwrap_or_else(|| "folder".to_string())
            }
        });
        let response = self
            .http
            .post(format!("{base}/api/server/web/v1/asset-folders"))
            .headers(self.server_headers(None)?)
            .json(&payload)
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let folder = data.get("folder").cloned().unwrap_or(data);
        let raw: EntitleHubAssetFolder = serde_json::from_value(folder)?;
        Ok(AssetFolderDto {
            id: raw.id,
            name: raw.name,
            kind: raw
                .metadata
                .as_ref()
                .and_then(|m| m.get("scene"))
                .and_then(|v| v.as_str())
                .unwrap_or("folder")
                .to_string(),
            count: raw.asset_count.unwrap_or(0),
        })
    }

    pub async fn create_asset_upload(
        &self,
        customer_id: &str,
        input: &CreateAssetUploadRequest,
    ) -> ApiResult<AssetUploadDto> {
        if self.is_mock() {
            return Ok(AssetUploadDto {
                upload_id: Uuid::new_v4().to_string(),
                method: "PUT".to_string(),
                url: "mock://upload".to_string(),
                upload_token: "mock-upload-token".to_string(),
                token_prefix: Some("mock".to_string()),
                expires_at: None,
                max_bytes: Some(input.file_size),
                headers: json!({}),
            });
        }

        let base = self.base_url()?;
        let payload = json!({
            "customer_id": customer_id,
            "folder_id": input.folder_id,
            "file_name": input.file_name,
            "kind": input.asset_type,
            "asset_type": input.asset_type,
            "asset_role": input.asset_role.clone().unwrap_or_else(|| "reference".to_string()),
            "mime_type": input.mime_type,
            "file_size": input.file_size,
            "metadata": {
                "source": "shadowweave"
            }
        });
        let response = self
            .http
            .post(format!("{base}/api/server/web/v1/assets/upload-url"))
            .headers(self.server_headers(None)?)
            .json(&payload)
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let upload = data.get("upload").cloned().unwrap_or(data);
        serde_json::from_value(upload).map_err(ApiError::from)
    }

    pub async fn upload_asset_file(
        &self,
        customer_id: &str,
        input: &CreateAssetUploadRequest,
        bytes: Vec<u8>,
    ) -> ApiResult<UploadedAssetDto> {
        if self.is_mock() {
            let asset_id = Uuid::new_v4().to_string();
            return Ok(UploadedAssetDto {
                asset_id: asset_id.clone(),
                url: Some(format!("mock://asset/{asset_id}")),
                asset_type: Some(input.asset_type.clone()),
                mime_type: Some(input.mime_type.clone()),
                asset: Some(AssetItemDto {
                    id: asset_id.clone(),
                    seed: asset_id,
                    name: input.file_name.clone(),
                    folder_id: input
                        .folder_id
                        .clone()
                        .unwrap_or_else(|| "root".to_string()),
                    kind: input.asset_type.clone(),
                    url: None,
                    thumbnail_url: None,
                    mime_type: Some(input.mime_type.clone()),
                    file_size: Some(input.file_size),
                    status: Some("ready".to_string()),
                    duration: None,
                    duration_sec: None,
                    duration_seconds: None,
                    role: input.asset_role.clone(),
                    source: Some("mock".to_string()),
                    source_alias: Some("upload".to_string()),
                    width: None,
                    height: None,
                }),
            });
        }

        let base = self.base_url()?;
        let url = format!("{base}/api/server/web/v1/assets/upload");
        let mut headers = self.server_headers(None)?;
        headers.remove(CONTENT_TYPE);
        let response = self
            .http
            .post(url)
            .headers(headers)
            .query(&[
                ("customer_id", customer_id),
                ("file_name", input.file_name.as_str()),
                ("kind", input.asset_type.as_str()),
                ("asset_type", input.asset_type.as_str()),
                (
                    "asset_role",
                    input.asset_role.as_deref().unwrap_or("reference"),
                ),
                ("mime_type", input.mime_type.as_str()),
            ])
            .header(CONTENT_TYPE, input.mime_type.as_str())
            .body(bytes.clone())
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        match unwrap_entitlehub_data(body) {
            Ok(data) => asset_upload_result(data, &input.asset_type, &input.mime_type),
            Err(direct_err) => {
                let upload = self
                    .create_asset_upload(customer_id, input)
                    .await
                    .map_err(|session_err| upload_unavailable_error(&direct_err, &session_err))?;
                self.put_asset_upload(upload, input, bytes)
                    .await
                    .map_err(|put_err| upload_unavailable_error(&direct_err, &put_err))
            }
        }
    }

    pub async fn get_asset(&self, customer_id: &str, asset_id: &str) -> ApiResult<AssetItemDto> {
        if self.is_mock() {
            return Ok(AssetItemDto {
                id: asset_id.to_string(),
                seed: asset_id.to_string(),
                name: "模拟素材".to_string(),
                folder_id: "root".to_string(),
                kind: "file".to_string(),
                url: Some(format!("mock://asset/{asset_id}")),
                thumbnail_url: None,
                mime_type: None,
                file_size: None,
                status: Some("ready".to_string()),
                duration: None,
                duration_sec: None,
                duration_seconds: None,
                role: None,
                source: Some("mock".to_string()),
                source_alias: Some("upload".to_string()),
                width: None,
                height: None,
            });
        }

        let base = self.base_url()?;
        let response = self
            .http
            .get(format!(
                "{base}/api/server/web/v1/assets/{asset_id}?customer_id={customer_id}"
            ))
            .headers(self.server_headers(None)?)
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let asset_value = data.get("asset").cloned().unwrap_or(data);
        let asset: EntitleHubAsset = serde_json::from_value(asset_value)?;
        Ok(asset_to_item(asset))
    }

    async fn put_asset_upload(
        &self,
        upload: AssetUploadDto,
        input: &CreateAssetUploadRequest,
        bytes: Vec<u8>,
    ) -> ApiResult<UploadedAssetDto> {
        let method = upload.method.parse::<Method>().unwrap_or(Method::PUT);
        let mut request = self.http.request(method, upload.url);

        if let Some(headers) = upload.headers.as_object() {
            for (name, value) in headers {
                let Some(value) = value.as_str() else {
                    continue;
                };
                let Ok(name) = HeaderName::from_bytes(name.as_bytes()) else {
                    continue;
                };
                let Ok(value) = HeaderValue::from_str(value) else {
                    continue;
                };
                request = request.header(name, value);
            }
        }
        request = request.header(CONTENT_TYPE, input.mime_type.as_str());

        let response = request.body(bytes).send().await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        asset_upload_result(data, &input.asset_type, &input.mime_type)
    }

    pub async fn delete_asset(&self, customer_id: &str, asset_id: &str) -> ApiResult<()> {
        if self.is_mock() {
            return Ok(());
        }

        let base = self.base_url()?;
        let response = self
            .http
            .delete(format!(
                "{base}/api/server/web/v1/assets/{asset_id}?customer_id={customer_id}"
            ))
            .headers(self.server_headers(None)?)
            .send()
            .await?;
        let body = response.json::<Value>().await.unwrap_or(Value::Null);
        unwrap_entitlehub_data(body)?;
        Ok(())
    }

    pub async fn delete_work(&self, customer_id: &str, work_id: &str) -> ApiResult<()> {
        self.work_customer_action(customer_id, work_id, reqwest::Method::DELETE, None)
            .await
            .map(|_| ())
    }

    pub async fn favorite_work(
        &self,
        customer_id: &str,
        work_id: &str,
        favorite: bool,
    ) -> ApiResult<Option<MediaItemDto>> {
        let method = if favorite {
            reqwest::Method::POST
        } else {
            reqwest::Method::DELETE
        };
        self.work_customer_action(
            customer_id,
            &format!("{work_id}/favorite"),
            method,
            Some(json!({ "customer_id": customer_id })),
        )
        .await
    }

    pub async fn publish_work(
        &self,
        customer_id: &str,
        work_id: &str,
        tags: Vec<String>,
    ) -> ApiResult<Option<MediaItemDto>> {
        self.work_customer_action(
            customer_id,
            &format!("{work_id}/publish"),
            reqwest::Method::POST,
            Some(json!({ "customer_id": customer_id, "tags": tags })),
        )
        .await
    }

    pub async fn unpublish_work(
        &self,
        customer_id: &str,
        work_id: &str,
    ) -> ApiResult<Option<MediaItemDto>> {
        self.work_customer_action(
            customer_id,
            &format!("{work_id}/unpublish"),
            reqwest::Method::POST,
            Some(json!({ "customer_id": customer_id })),
        )
        .await
    }

    pub async fn download_work(
        &self,
        customer_id: &str,
        work_id: &str,
    ) -> ApiResult<WorkDownloadResponse> {
        if self.is_mock() {
            return Ok(WorkDownloadResponse {
                download_url: String::new(),
                downloaded_at: Some(chrono::Utc::now().timestamp_millis()),
                work: None,
            });
        }

        let base = self.base_url()?;
        let response = self
            .http
            .post(format!("{base}/api/server/web/v1/works/{work_id}/download"))
            .headers(self.server_headers(None)?)
            .json(&json!({ "customer_id": customer_id }))
            .send()
            .await?;
        let body = response.json::<Value>().await?;
        let data = unwrap_entitlehub_data(body)?;
        let download_url =
            value_string(&data, &["downloadUrl", "download_url"]).unwrap_or_default();
        let downloaded_at = value_time_millis(&data, &["downloadedAt", "downloaded_at"]);
        let work = data
            .get("work")
            .cloned()
            .and_then(|value| serde_json::from_value::<EntitleHubWork>(value).ok())
            .map(|work| work_to_media_item(work, customer_id));
        Ok(WorkDownloadResponse {
            download_url,
            downloaded_at,
            work,
        })
    }

    async fn work_customer_action(
        &self,
        customer_id: &str,
        path: &str,
        method: reqwest::Method,
        body: Option<Value>,
    ) -> ApiResult<Option<MediaItemDto>> {
        if self.is_mock() {
            return Ok(None);
        }

        let base = self.base_url()?;
        let url = format!("{base}/api/server/web/v1/works/{path}");
        let mut request = self
            .http
            .request(method, url)
            .headers(self.server_headers(None)?);
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request.send().await?;
        let body = response.json::<Value>().await.unwrap_or(Value::Null);
        let data = unwrap_entitlehub_data(body)?;
        Ok(data
            .get("work")
            .cloned()
            .or_else(|| data.get("data").cloned())
            .and_then(|value| serde_json::from_value::<EntitleHubWork>(value).ok())
            .map(|work| work_to_media_item(work, customer_id)))
    }

    fn base_url(&self) -> ApiResult<String> {
        self.config.entitlehub_base_url.clone().ok_or_else(|| {
            ApiError::Internal(
                "ENTITLEHUB_BASE_URL is required when ENTITLEHUB_MOCK=false".to_string(),
            )
        })
    }

    fn server_headers(&self, idempotency_key: Option<&str>) -> ApiResult<HeaderMap> {
        self.server_headers_for_customer("", idempotency_key)
    }

    fn server_headers_for_customer(
        &self,
        customer_id: &str,
        idempotency_key: Option<&str>,
    ) -> ApiResult<HeaderMap> {
        let key = self.config.entitlehub_server_key.clone().ok_or_else(|| {
            ApiError::Internal(
                "ENTITLEHUB_SERVER_KEY is required when ENTITLEHUB_MOCK=false".to_string(),
            )
        })?;

        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {key}")).map_err(|err| {
                ApiError::Internal(format!("invalid EntitleHub server key header: {err}"))
            })?,
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if !customer_id.trim().is_empty() {
            headers.insert(
                "X-EntitleHub-Customer-Id",
                HeaderValue::from_str(customer_id).map_err(|err| {
                    ApiError::Internal(format!("invalid customer id header: {err}"))
                })?,
            );
        }
        if let Some(key) = idempotency_key {
            headers.insert(
                "Idempotency-Key",
                HeaderValue::from_str(key).map_err(|err| {
                    ApiError::Internal(format!("invalid idempotency key header: {err}"))
                })?,
            );
        }
        Ok(headers)
    }
}

pub fn map_entitlehub_status(status: &str) -> JobStatus {
    match status {
        "submitted" => JobStatus::Queued,
        "running" => JobStatus::Running,
        "caching" => JobStatus::Caching,
        "succeeded" => JobStatus::Succeeded,
        "provider_failed" | "failed" => JobStatus::Failed,
        "timeout_review" => JobStatus::Review,
        "cancelled" => JobStatus::Cancelled,
        _ => JobStatus::Running,
    }
}

fn unwrap_entitlehub_data(body: Value) -> ApiResult<Value> {
    if let Some(code) = body.get("code").and_then(|v| v.as_i64()) {
        if code != 0 {
            let message = body
                .get("message")
                .and_then(|v| v.as_str())
                .unwrap_or("EntitleHub request failed")
                .to_string();
            let error_code = body
                .get("errorCode")
                .or_else(|| body.get("error_code"))
                .and_then(|v| v.as_str());
            return Err(ApiError::Upstream {
                code: "ENTITLEHUB_ERROR",
                message: error_code
                    .map(|code| format!("{code}: {message}"))
                    .unwrap_or(message),
            });
        }
        return Ok(body.get("data").cloned().unwrap_or(Value::Null));
    }
    Ok(body)
}

fn asset_upload_result(
    data: Value,
    fallback_type: &str,
    fallback_mime_type: &str,
) -> ApiResult<UploadedAssetDto> {
    let asset = data.get("asset").cloned().or_else(|| {
        if data.get("id").and_then(|v| v.as_str()).is_some() {
            Some(data.clone())
        } else {
            None
        }
    });
    let asset_id = data
        .get("assetId")
        .or_else(|| data.get("asset_id"))
        .or_else(|| data.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            asset
                .as_ref()
                .and_then(|asset| asset.get("id"))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .ok_or_else(|| ApiError::Upstream {
            code: "ENTITLEHUB_UPLOAD_RESPONSE_INVALID",
            message: "上传成功但 EntitleHub 未返回素材 ID".to_string(),
        })?;

    let url = data
        .get("url")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            asset
                .as_ref()
                .and_then(|asset| {
                    asset
                        .get("public_url")
                        .or_else(|| asset.get("publicUrl"))
                        .or_else(|| asset.get("download_url"))
                        .or_else(|| asset.get("downloadUrl"))
                        .or_else(|| asset.get("url"))
                })
                .and_then(|v| v.as_str())
                .map(str::to_string)
        });
    let asset_type = data
        .get("type")
        .or_else(|| data.get("assetType"))
        .or_else(|| data.get("asset_type"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            asset
                .as_ref()
                .and_then(|asset| {
                    asset
                        .get("asset_type")
                        .or_else(|| asset.get("assetType"))
                        .or_else(|| asset.get("type"))
                })
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .or_else(|| Some(fallback_type.to_string()));
    let mime_type = data
        .get("mimeType")
        .or_else(|| data.get("mime_type"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            asset
                .as_ref()
                .and_then(|asset| asset.get("mime_type").or_else(|| asset.get("mimeType")))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .or_else(|| Some(fallback_mime_type.to_string()));

    let normalized_asset = asset
        .and_then(|value| serde_json::from_value::<EntitleHubAsset>(value).ok())
        .map(asset_to_item);

    Ok(UploadedAssetDto {
        asset_id,
        url,
        asset_type,
        mime_type,
        asset: normalized_asset,
    })
}

fn upload_unavailable_error(direct_err: &ApiError, fallback_err: &ApiError) -> ApiError {
    let direct_message = api_error_message(direct_err);
    let fallback_message = api_error_message(fallback_err);
    if direct_message == "not_found" && fallback_message == "not_found" {
        return ApiError::Upstream {
            code: "ENTITLEHUB_UPLOAD_UNAVAILABLE",
            message: "EntitleHub 上传失败：当前 customer_id 不存在，或上传接口尚未开放；请配置真实 EntitleHub customer_id 后重试。"
                .to_string(),
        };
    }

    ApiError::Upstream {
        code: "ENTITLEHUB_UPLOAD_UNAVAILABLE",
        message: format!(
            "EntitleHub 上传接口不可用：直传失败（{}），上传会话失败（{}）",
            direct_message, fallback_message
        ),
    }
}

fn api_error_message(err: &ApiError) -> String {
    match err {
        ApiError::BadRequest { message, .. }
        | ApiError::Unauthenticated { message, .. }
        | ApiError::NotFound { message, .. }
        | ApiError::Upstream { message, .. }
        | ApiError::Internal(message) => message.clone(),
    }
}

fn list_value(data: Value, keys: &[&str]) -> Value {
    if data.is_array() {
        return data;
    }
    if let Some(items) = data.get("items").filter(|v| v.is_array()) {
        return items.clone();
    }
    for key in keys {
        if let Some(value) = data.get(key) {
            if value.is_array() {
                return value.clone();
            }
            if let Some(nested) = value.get("items").filter(|v| v.is_array()) {
                return nested.clone();
            }
        }
    }
    Value::Array(vec![])
}

fn normalized_reference_assets(input: &CreateGenerationJobRequest) -> Vec<Value> {
    if let Some(reference_assets) = &input.reference_assets {
        if !reference_assets.is_empty() {
            return reference_assets
                .iter()
                .filter(|asset| !asset.asset_id.trim().is_empty())
                .map(|asset| {
                    json!({
                        "assetId": asset.asset_id,
                        "kind": asset.kind,
                        "role": asset.role,
                    })
                })
                .collect();
        }
    }

    let mut assets = vec![];
    let reference_kind = match input.source_mode.as_ref() {
        Some(SourceMode::Video) => "video",
        Some(SourceMode::Audio) => "audio",
        _ => "image",
    };
    if let Some(reference_asset_ids) = &input.reference_asset_ids {
        assets.extend(
            reference_asset_ids
                .iter()
                .filter(|id| !id.trim().is_empty())
                .map(|id| {
                    json!({
                        "assetId": id,
                        "kind": reference_kind,
                        "role": "reference",
                    })
                }),
        );
    }
    if let Some(asset_id) = &input.first_frame_asset_id {
        assets.push(json!({
            "assetId": asset_id,
            "kind": "image",
            "role": "first_frame",
        }));
    }
    if let Some(asset_id) = &input.last_frame_asset_id {
        assets.push(json!({
            "assetId": asset_id,
            "kind": "image",
            "role": "last_frame",
        }));
    }
    assets
}

fn reference_asset_count(input: &CreateGenerationJobRequest) -> Option<u32> {
    input
        .reference_assets
        .as_ref()
        .map(|assets| assets.len() as u32)
        .or_else(|| {
            input
                .reference_asset_ids
                .as_ref()
                .map(|ids| ids.len() as u32)
        })
}

fn asset_to_item(asset: EntitleHubAsset) -> AssetItemDto {
    let id = asset.id.clone();
    let url = asset
        .url
        .clone()
        .or(asset.asset_url.clone())
        .or(asset.download_url.clone())
        .or(asset.public_url.clone());
    let thumbnail_url = asset
        .thumbnail_url
        .clone()
        .or(asset.cover_url.clone())
        .or(asset.cover_asset_url.clone())
        .or(asset.poster_url.clone())
        .or_else(|| metadata_string(&asset.metadata, &["thumbnailUrl", "thumbnail_url"]))
        .or_else(|| metadata_string(&asset.metadata, &["coverUrl", "cover_url"]))
        .or_else(|| metadata_string(&asset.metadata, &["posterUrl", "poster_url"]))
        .or_else(|| {
            let kind = asset
                .kind
                .as_deref()
                .or(asset.asset_type.as_deref())
                .unwrap_or_default();
            if kind == "image" { url.clone() } else { None }
        });
    let duration_sec = asset
        .duration_sec
        .or(asset.duration_seconds)
        .or(asset.duration)
        .or_else(|| {
            metadata_i64(
                &asset.metadata,
                &[
                    "durationSec",
                    "duration_sec",
                    "durationSeconds",
                    "duration_seconds",
                    "duration",
                    "seconds",
                ],
            )
        });
    let kind = asset
        .kind
        .clone()
        .or(asset.asset_type.clone())
        .or_else(|| {
            asset.mime_type.as_deref().and_then(|mime_type| {
                if mime_type.starts_with("image/") {
                    Some("image".to_string())
                } else if mime_type.starts_with("video/") {
                    Some("video".to_string())
                } else if mime_type.starts_with("audio/") {
                    Some("audio".to_string())
                } else {
                    None
                }
            })
        })
        .unwrap_or_else(|| "file".to_string());

    AssetItemDto {
        id,
        seed: thumbnail_url
            .clone()
            .or(url.clone())
            .unwrap_or_else(|| asset.id.clone()),
        name: asset
            .name
            .or(asset.file_name)
            .unwrap_or_else(|| "未命名素材".to_string()),
        folder_id: asset.folder_id.unwrap_or_else(|| "root".to_string()),
        kind,
        url,
        thumbnail_url,
        mime_type: asset.mime_type,
        file_size: asset.file_size,
        status: asset.status,
        duration: asset.duration,
        duration_sec,
        duration_seconds: duration_sec,
        role: asset.asset_role,
        source: asset.source,
        source_alias: asset.source_alias,
        width: asset
            .width
            .or_else(|| metadata_i64(&asset.metadata, &["width"])),
        height: asset
            .height
            .or_else(|| metadata_i64(&asset.metadata, &["height"])),
    }
}

fn value_string(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(value) = value.get(key).and_then(|v| v.as_str()) {
            return Some(value.to_string());
        }
    }
    None
}

fn value_i64(value: &Value, keys: &[&str]) -> Option<i64> {
    for key in keys {
        if let Some(value) = value.get(key) {
            if let Some(number) = numeric_value_i64(value) {
                return Some(number);
            }
        }
    }
    None
}

fn numeric_value_i64(value: &Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|v| i64::try_from(v).ok()))
        .or_else(|| value.as_f64().map(|v| v.round() as i64))
        .or_else(|| value.as_str().and_then(|v| v.parse::<i64>().ok()))
}

fn value_time_millis(value: &Value, keys: &[&str]) -> Option<i64> {
    for key in keys {
        if let Some(value) = value.get(key) {
            if let Some(timestamp) = parse_value_timestamp(value) {
                return Some(timestamp);
            }
        }
    }
    None
}

fn usage_summary_from_value(data: Value) -> EntitleHubUsageSummary {
    let summary = data
        .get("summary")
        .or_else(|| data.get("stats"))
        .cloned()
        .unwrap_or_else(|| data.clone());
    let records = list_value(data.clone(), &["records", "usage", "items", "data"]);

    let mut usage = EntitleHubUsageSummary {
        generated: value_i64(
            &summary,
            &[
                "generated",
                "generation_count",
                "generationCount",
                "total_count",
                "totalCount",
            ],
        )
        .unwrap_or(0),
        charged_minor: value_i64(
            &summary,
            &[
                "charged_minor",
                "chargedMinor",
                "used_minor",
                "usedMinor",
                "total_charged_minor",
                "totalChargedMinor",
                "cost_minor",
                "costMinor",
            ],
        )
        .unwrap_or(0),
        image_count: value_i64(&summary, &["image_count", "imageCount", "images"]).unwrap_or(0),
        video_count: value_i64(&summary, &["video_count", "videoCount", "videos"]).unwrap_or(0),
        audio_count: value_i64(&summary, &["audio_count", "audioCount", "audios"]).unwrap_or(0),
        daily_credits: daily_usage_values(&data),
    };

    if let Value::Array(items) = records {
        for item in items {
            usage.generated += 1;
            usage.charged_minor += value_i64(
                &item,
                &[
                    "charged_minor",
                    "chargedMinor",
                    "amount_minor",
                    "amountMinor",
                    "cost_minor",
                    "costMinor",
                ],
            )
            .unwrap_or(0)
            .max(0);

            match value_string(&item, &["type", "job_type", "jobType", "modality"]).as_deref() {
                Some("image") => usage.image_count += 1,
                Some("video") => usage.video_count += 1,
                Some("audio") => usage.audio_count += 1,
                _ => {}
            }
        }
    }

    usage
}

fn daily_usage_values(data: &Value) -> Vec<i64> {
    let daily = data
        .get("daily")
        .or_else(|| data.get("dailyCredits"))
        .or_else(|| data.get("daily_credits"))
        .or_else(|| data.get("daily_usage"))
        .or_else(|| data.get("dailyUsage"));
    let Some(Value::Array(items)) = daily else {
        return vec![];
    };

    items
        .iter()
        .filter_map(|item| {
            numeric_value_i64(item).or_else(|| {
                value_i64(
                    item,
                    &[
                        "credits",
                        "charged_minor",
                        "chargedMinor",
                        "used_minor",
                        "usedMinor",
                        "cost_minor",
                        "costMinor",
                        "value",
                    ],
                )
            })
        })
        .collect()
}

fn parse_work_list(data: Value, customer_id: &str) -> Vec<MediaItemDto> {
    let works_value = list_value(data, &["works", "gallery", "data", "items"]);
    let works: Vec<EntitleHubWork> = serde_json::from_value(works_value).unwrap_or_default();
    works
        .into_iter()
        .map(|work| work_to_media_item(work, customer_id))
        .collect()
}

fn work_to_media_item(work: EntitleHubWork, customer_id: &str) -> MediaItemDto {
    let media_type = work.work_type.clone().unwrap_or(MediaType::Image);
    let prompt = work_prompt(&work);
    let asset_url = work
        .cover_asset_url
        .clone()
        .or(work.primary_asset_url.clone());
    let model = work
        .model_name
        .clone()
        .or(work.model.clone())
        .or(work.model_id.clone())
        .unwrap_or_else(|| "未知模型".to_string());
    let author = AuthorDto {
        id: work
            .owner_customer_id
            .clone()
            .unwrap_or_else(|| customer_id.to_string()),
        name: "影织用户".to_string(),
        avatar_seed: work
            .owner_customer_id
            .clone()
            .unwrap_or_else(|| customer_id.to_string()),
    };
    let visibility = work
        .publication_status
        .as_deref()
        .and_then(|value| work_visibility(Some(value)))
        .or_else(|| work_visibility(work.visibility.as_deref()));
    let published_at = work
        .published_at
        .as_deref()
        .or(work.published_at_camel.as_deref())
        .and_then(parse_string_timestamp);
    let created_at = parse_timestamp(work.created_at.as_ref());
    let favorited_at = work
        .favorited_at
        .as_deref()
        .and_then(parse_string_timestamp)
        .or_else(|| {
            if work.favorited.unwrap_or(false) {
                Some(published_at.unwrap_or(created_at))
            } else {
                None
            }
        });
    let downloaded_at = work
        .downloaded_at
        .as_deref()
        .and_then(parse_string_timestamp)
        .or_else(|| metadata_i64(&work.metadata, &["downloaded_at", "downloadedAt"]));

    MediaItemDto {
        id: work.id.clone(),
        media_type: media_type.clone(),
        asset_id: work.primary_asset_id.clone(),
        seed: asset_url.clone().unwrap_or_else(|| work.id.clone()),
        url: asset_url,
        prompt,
        full_prompt: work.full_prompt.clone(),
        model,
        category: work
            .category
            .clone()
            .or_else(|| {
                work.publication_tags
                    .first()
                    .map(|tag| category_from_tag(tag).to_string())
            })
            .unwrap_or_else(|| default_category(&media_type).to_string()),
        aspect_ratio: work
            .aspect_ratio
            .clone()
            .or(work.ratio.clone())
            .or_else(|| metadata_string(&work.metadata, &["aspect_ratio", "ratio"]))
            .unwrap_or_else(|| default_ratio(&media_type).to_string()),
        resolution: work
            .resolution
            .clone()
            .or_else(|| metadata_string(&work.metadata, &["resolution", "size"])),
        author,
        likes: work.favorite_count.unwrap_or(0),
        created_at,
        duration_sec: work
            .duration_sec
            .or_else(|| metadata_i64(&work.metadata, &["duration_sec", "duration"])),
        source_mode: work
            .source_mode
            .clone()
            .or_else(|| metadata_source_mode(&work.metadata)),
        reference_count: work
            .reference_count
            .or_else(|| metadata_u32(&work.metadata, &["reference_count", "referenceCount"])),
        has_first_frame: work
            .has_first_frame
            .or_else(|| metadata_bool(&work.metadata, &["has_first_frame", "hasFirstFrame"])),
        has_last_frame: work
            .has_last_frame
            .or_else(|| metadata_bool(&work.metadata, &["has_last_frame", "hasLastFrame"])),
        visibility,
        published_at,
        favorited_at,
        downloaded_at,
        demo: false,
    }
}

fn work_prompt(work: &EntitleHubWork) -> String {
    work.prompt
        .clone()
        .or_else(|| metadata_string(&work.metadata, &["prompt", "full_prompt"]))
        .or(work.description.clone())
        .or(work.title.clone())
        .unwrap_or_else(|| "未命名作品".to_string())
}

fn metadata_string(metadata: &Option<Value>, keys: &[&str]) -> Option<String> {
    let metadata = metadata.as_ref()?;
    for key in keys {
        if let Some(value) = metadata.get(key).and_then(|v| v.as_str()) {
            return Some(value.to_string());
        }
    }
    None
}

fn metadata_i64(metadata: &Option<Value>, keys: &[&str]) -> Option<i64> {
    let metadata = metadata.as_ref()?;
    for key in keys {
        if let Some(value) = metadata.get(key).and_then(|v| v.as_i64()) {
            return Some(value);
        }
    }
    None
}

fn metadata_u32(metadata: &Option<Value>, keys: &[&str]) -> Option<u32> {
    metadata_i64(metadata, keys).and_then(|value| u32::try_from(value).ok())
}

fn metadata_bool(metadata: &Option<Value>, keys: &[&str]) -> Option<bool> {
    let metadata = metadata.as_ref()?;
    for key in keys {
        if let Some(value) = metadata.get(key).and_then(|v| v.as_bool()) {
            return Some(value);
        }
    }
    None
}

fn metadata_source_mode(metadata: &Option<Value>) -> Option<SourceMode> {
    match metadata_string(
        metadata,
        &["source_mode", "sourceMode", "input_mode", "inputMode"],
    )
    .as_deref()
    {
        Some("image") => Some(SourceMode::Image),
        Some("video") => Some(SourceMode::Video),
        Some("audio") => Some(SourceMode::Audio),
        Some("frames") => Some(SourceMode::Frames),
        Some("text") => Some(SourceMode::Text),
        _ => None,
    }
}

fn work_visibility(value: Option<&str>) -> Option<WorkVisibility> {
    match value {
        Some("gallery") | Some("public") => Some(WorkVisibility::Gallery),
        Some("private") => Some(WorkVisibility::Private),
        _ => None,
    }
}

fn parse_timestamp(value: Option<&Value>) -> i64 {
    value.and_then(parse_value_timestamp).unwrap_or(0)
}

fn parse_value_timestamp(value: &Value) -> Option<i64> {
    match value {
        Value::Number(n) => n.as_i64(),
        Value::String(s) => parse_string_timestamp(s),
        _ => None,
    }
}

fn parse_string_timestamp(value: &str) -> Option<i64> {
    value.parse::<i64>().ok().or_else(|| {
        chrono::DateTime::parse_from_rfc3339(value)
            .map(|dt| dt.timestamp_millis())
            .ok()
    })
}

fn default_category(media_type: &MediaType) -> &'static str {
    match media_type {
        MediaType::Image => "abstract",
        MediaType::Video => "landscape",
        MediaType::Audio => "abstract",
    }
}

fn default_ratio(media_type: &MediaType) -> &'static str {
    match media_type {
        MediaType::Image => "1:1",
        MediaType::Video => "16:9",
        MediaType::Audio => "1:1",
    }
}

fn category_from_tag(tag: &str) -> &'static str {
    match tag {
        "人像" | "portrait" => "portrait",
        "风景" | "landscape" => "landscape",
        "产品" | "product" => "product",
        "动漫" | "anime" => "anime",
        "建筑" | "architecture" => "architecture",
        _ => "abstract",
    }
}

fn media_type_label(media_type: &MediaType) -> &'static str {
    match media_type {
        MediaType::Image => "image",
        MediaType::Video => "video",
        MediaType::Audio => "audio",
    }
}

fn mock_models() -> Vec<ModelProductDto> {
    vec![
        ModelProductDto {
            id: "yingzhi-image-x".to_string(),
            name: "影织图片 X".to_string(),
            modality: MediaType::Image,
            provider_model: Some("mock_image_x".to_string()),
            billing: BillingDto {
                currency: "CNY".to_string(),
                mode: "image_per_item".to_string(),
                second_price_minor: None,
                request_price_minor: Some(0),
                image_price_minor: Some(80),
            },
            capabilities: ModelCapabilitiesDto {
                ratios: vec![
                    "1:1".to_string(),
                    "3:4".to_string(),
                    "4:3".to_string(),
                    "16:9".to_string(),
                    "9:16".to_string(),
                    "21:9".to_string(),
                ],
                resolutions: vec!["1k".to_string(), "2k".to_string()],
                durations: vec![],
                default_duration_seconds: None,
                image_counts: vec![1, 2, 3, 4],
                max_images: Some(4),
                input_modes: vec![SourceMode::Text, SourceMode::Image],
                max_reference_images: Some(4),
                max_reference_videos: Some(0),
                max_reference_audios: Some(0),
                supports_reference_video: Some(false),
                supports_reference_audio: Some(false),
                supports_first_frame: Some(false),
                supports_last_frame: Some(false),
                accepted_mime_types: vec!["image/png".to_string(), "image/jpeg".to_string()],
                max_asset_size_mb: Some(20),
                max_image_asset_size_mb: Some(20),
                max_video_asset_size_mb: None,
                max_audio_asset_size_mb: None,
                min_reference_video_seconds: None,
                max_reference_video_seconds: None,
                total_reference_video_seconds: None,
                min_reference_audio_seconds: None,
                max_reference_audio_seconds: None,
                total_reference_audio_seconds: None,
            },
        },
        ModelProductDto {
            id: "yingzhi-video-fast".to_string(),
            name: "影织快速视频".to_string(),
            modality: MediaType::Video,
            provider_model: Some("mock_video_fast".to_string()),
            billing: BillingDto {
                currency: "CNY".to_string(),
                mode: "video_per_second".to_string(),
                second_price_minor: Some(20),
                request_price_minor: Some(0),
                image_price_minor: None,
            },
            capabilities: ModelCapabilitiesDto {
                ratios: vec!["16:9".to_string(), "9:16".to_string(), "1:1".to_string()],
                resolutions: vec!["720p".to_string(), "1080p".to_string()],
                durations: vec![5, 8, 10],
                default_duration_seconds: Some(8),
                image_counts: vec![],
                max_images: None,
                input_modes: vec![SourceMode::Text, SourceMode::Image, SourceMode::Frames],
                max_reference_images: Some(1),
                max_reference_videos: Some(0),
                max_reference_audios: Some(0),
                supports_reference_video: Some(false),
                supports_reference_audio: Some(false),
                supports_first_frame: Some(true),
                supports_last_frame: Some(true),
                accepted_mime_types: vec!["image/png".to_string(), "image/jpeg".to_string()],
                max_asset_size_mb: Some(20),
                max_image_asset_size_mb: Some(20),
                max_video_asset_size_mb: None,
                max_audio_asset_size_mb: None,
                min_reference_video_seconds: None,
                max_reference_video_seconds: None,
                total_reference_video_seconds: None,
                min_reference_audio_seconds: None,
                max_reference_audio_seconds: None,
                total_reference_audio_seconds: None,
            },
        },
        ModelProductDto {
            id: "yingzhi-audio-tts".to_string(),
            name: "影织音频 TTS".to_string(),
            modality: MediaType::Audio,
            provider_model: Some("mock_audio_tts".to_string()),
            billing: BillingDto {
                currency: "CNY".to_string(),
                mode: "audio_per_second".to_string(),
                second_price_minor: Some(10),
                request_price_minor: Some(0),
                image_price_minor: None,
            },
            capabilities: ModelCapabilitiesDto {
                ratios: vec![],
                resolutions: vec![],
                durations: vec![10, 30, 60],
                default_duration_seconds: Some(30),
                image_counts: vec![],
                max_images: None,
                input_modes: vec![SourceMode::Text, SourceMode::Audio],
                max_reference_images: Some(0),
                max_reference_videos: Some(0),
                max_reference_audios: Some(1),
                supports_reference_video: Some(false),
                supports_reference_audio: Some(true),
                supports_first_frame: Some(false),
                supports_last_frame: Some(false),
                accepted_mime_types: vec![
                    "audio/mpeg".to_string(),
                    "audio/mp3".to_string(),
                    "audio/wav".to_string(),
                ],
                max_asset_size_mb: Some(50),
                max_image_asset_size_mb: None,
                max_video_asset_size_mb: None,
                max_audio_asset_size_mb: Some(50),
                min_reference_video_seconds: None,
                max_reference_video_seconds: None,
                total_reference_video_seconds: None,
                min_reference_audio_seconds: None,
                max_reference_audio_seconds: None,
                total_reference_audio_seconds: None,
            },
        },
    ]
}
