use axum::{
    Json, Router,
    body::Bytes,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{
        header::{COOKIE, SET_COOKIE},
        HeaderMap, HeaderValue,
    },
    response::IntoResponse,
    routing::{get, post},
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    entitlehub::{AssetListFilters, EntitleHubJob, map_entitlehub_status},
    error::{ApiError, ApiResult},
    models::{
        ActionResponse, ApiKeyResponse, AssetFolderDto, AssetFolderResponse, AssetItemDto,
        AssetUploadResponse, AssetsResponse, AuthResponse, AuthorDto, CreateAssetFolderRequest,
        CreateAssetUploadRequest, CreateGenerationJobRequest, GenerationJobDto, HealthResponse,
        JobResponse, JobStatus, JobsResponse, LoginRequest, MediaItemDto, MediaType,
        ModelCapabilitiesDto, ModelProductDto, ModelsResponse, PricingPlanDto,
        PricingPlansResponse, PublishWorkRequest, ReferenceAssetInput, SourceMode, StylePresetDto,
        StylePresetsResponse, UploadedAssetDto, UsageResponse, UsageStatDto, UserResponse,
        WorkDownloadResponse, WorkResponse, WorkVisibility, WorksResponse,
    },
    state::{AppState, UserSession, now_millis},
};

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/auth/login", post(login))
        .route("/api/auth/me", get(auth_me))
        .route("/api/auth/logout", post(logout))
        .route("/api/me", get(me))
        .route("/api/me/usage", get(usage))
        .route("/api/me/api-key", get(api_key))
        .route("/api/billing/plans", get(billing_plans))
        .route("/api/ai/models", get(models))
        .route("/api/ai/styles", get(styles))
        .route("/api/gallery", get(gallery))
        .route("/api/me/favorites", get(favorites))
        .route("/api/assets", get(assets))
        .route("/api/assets/folders", post(create_asset_folder))
        .route("/api/assets/upload-url", post(create_asset_upload))
        .route(
            "/api/assets/upload-file",
            post(upload_asset_file).layer(DefaultBodyLimit::max(64 * 1024 * 1024)),
        )
        .route("/api/assets/:id", get(get_asset).delete(delete_asset))
        .route(
            "/api/generation/jobs",
            post(create_generation_job).get(list_jobs),
        )
        .route("/api/generation/jobs/:id", get(get_job))
        .route("/api/works", get(list_works))
        .route("/api/works/:id", axum::routing::delete(delete_work))
        .route(
            "/api/works/:id/favorite",
            post(favorite_work).delete(unfavorite_work),
        )
        .route("/api/works/:id/download", post(download_work))
        .route("/api/works/:id/publish", post(publish_work))
        .route("/api/works/:id/unpublish", post(unpublish_work))
        .with_state(state)
}

async fn healthz() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "shadowweave-backend",
    })
}

async fn login(
    State(state): State<AppState>,
    Json(input): Json<LoginRequest>,
) -> ApiResult<impl IntoResponse> {
    let email = input.email.trim();
    if email.is_empty() || input.password.is_empty() {
        return Err(ApiError::BadRequest {
            code: "LOGIN_REQUIRED",
            message: "请输入邮箱和密码".to_string(),
        });
    }

    let customer = state
        .entitlehub
        .login_customer(email, &input.password)
        .await?;
    let session = state
        .create_session(customer.customer_id, customer.email, customer.name)
        .await;
    let cookie = format!(
        "{}={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}",
        state.config.session_cookie_name, session.session_id, state.config.session_ttl_seconds
    );
    let user = state.user_from_session(&session);
    let mut headers = HeaderMap::new();
    headers.insert(
        SET_COOKIE,
        HeaderValue::from_str(&cookie)
            .map_err(|err| ApiError::Internal(format!("invalid session cookie: {err}")))?,
    );
    Ok((headers, Json(AuthResponse { user })))
}

async fn auth_me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<AuthResponse>> {
    let session = require_session(&state, &headers).await?;
    Ok(Json(AuthResponse {
        user: state.user_from_session(&session),
    }))
}

async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<impl IntoResponse> {
    if let Some(session_id) = session_id_from_headers(&state, &headers) {
        state.remove_session(&session_id).await;
    }
    let cookie = format!(
        "{}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
        state.config.session_cookie_name
    );
    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        SET_COOKIE,
        HeaderValue::from_str(&cookie)
            .map_err(|err| ApiError::Internal(format!("invalid session cookie: {err}")))?,
    );
    Ok((response_headers, Json(ActionResponse { ok: true })))
}

async fn me(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<UserResponse>> {
    let user = if state.entitlehub.is_mock() {
        current_session(&state, &headers)
            .await
            .map(|session| state.user_from_session(&session))
            .unwrap_or_else(|| state.demo_user())
    } else {
        let session = require_session(&state, &headers).await?;
        let profile = state.entitlehub.get_customer_profile(&session.customer_id).await.ok();
        let balance = state.entitlehub.get_customer_balance(&session.customer_id).await.ok();
        let plan = state.entitlehub.get_customer_plan(&session.customer_id).await.ok();
        let mut user = state.user_from_session(&session);
        if let Some(profile) = profile {
            user.id = profile.customer_id;
            if let Some(email) = profile.email {
                user.email = email;
            }
            if let Some(name) = profile.name.filter(|name| !name.trim().is_empty()) {
                user.name = name;
            }
        }
        if let Some(balance) = balance {
            user.credits = balance.available_minor;
            user.credits_total = balance.balance_minor.max(balance.available_minor + balance.held_minor);
        }
        if let Some(plan) = plan {
            user.plan = plan.name.unwrap_or_else(|| "未订阅".to_string());
            if let Some(credits_total) = plan.credits_total.filter(|credits| *credits > 0) {
                user.credits_total = user.credits_total.max(credits_total);
            }
        }
        user
    };
    Ok(Json(UserResponse { user }))
}

async fn usage(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<UsageResponse>> {
    if !state.entitlehub.is_mock() {
        let session = require_session(&state, &headers).await?;
        let upstream = state
            .entitlehub
            .get_customer_usage(&session.customer_id)
            .await
            .unwrap_or_default();
        let used_credits = upstream.charged_minor;
        return Ok(Json(UsageResponse {
            stats: vec![
                UsageStatDto {
                    label: "本月生成".to_string(),
                    value: upstream.generated.to_string(),
                    unit: "次".to_string(),
                    trend: Some("本月".to_string()),
                },
                UsageStatDto {
                    label: "已用算力".to_string(),
                    value: used_credits.to_string(),
                    unit: "点".to_string(),
                    trend: Some("本月".to_string()),
                },
                UsageStatDto {
                    label: "图片作品".to_string(),
                    value: upstream.image_count.to_string(),
                    unit: "张".to_string(),
                    trend: None,
                },
                UsageStatDto {
                    label: "音视频作品".to_string(),
                    value: (upstream.video_count + upstream.audio_count).to_string(),
                    unit: "个".to_string(),
                    trend: None,
                },
            ],
            daily_credits: if upstream.daily_credits.is_empty() {
                daily_credit_bars(used_credits)
            } else {
                upstream.daily_credits
            },
        }));
    }
    let jobs = state.jobs.read().await;
    let works = state.works.read().await;
    let user = state.demo_user();

    let generated = jobs
        .values()
        .filter(|job| matches!(job.status, JobStatus::Succeeded))
        .count() as i64;
    let charged_minor: i64 = jobs.values().map(|job| job.charged_minor).sum();
    let held_minor: i64 = jobs.values().map(|job| job.held_minor).sum();
    let used_credits = user
        .credits_total
        .saturating_sub(user.credits)
        .max(charged_minor + held_minor);
    let image_count = works
        .iter()
        .filter(|work| work.media_type == MediaType::Image)
        .count() as i64;
    let video_count = works
        .iter()
        .filter(|work| work.media_type == MediaType::Video)
        .count() as i64;
    let audio_count = works
        .iter()
        .filter(|work| work.media_type == MediaType::Audio)
        .count() as i64;

    Ok(Json(UsageResponse {
        stats: vec![
            UsageStatDto {
                label: "本月生成".to_string(),
                value: generated.to_string(),
                unit: "次".to_string(),
                trend: Some("本月".to_string()),
            },
            UsageStatDto {
                label: "已用算力".to_string(),
                value: used_credits.to_string(),
                unit: "点".to_string(),
                trend: Some("本月".to_string()),
            },
            UsageStatDto {
                label: "图片作品".to_string(),
                value: image_count.to_string(),
                unit: "张".to_string(),
                trend: None,
            },
            UsageStatDto {
                label: "音视频作品".to_string(),
                value: (video_count + audio_count).to_string(),
                unit: "个".to_string(),
                trend: None,
            },
        ],
        daily_credits: daily_credit_bars(used_credits),
    }))
}

async fn api_key(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<ApiKeyResponse>> {
    if !state.entitlehub.is_mock() {
        require_session(&state, &headers).await?;
        return Ok(Json(ApiKeyResponse {
            masked_key: "暂未开放".to_string(),
            endpoint: "".to_string(),
            enabled: false,
        }));
    }
    Ok(Json(ApiKeyResponse {
        masked_key: "sw_live_••••••••••••••••••••3f9a".to_string(),
        endpoint: "https://api.shadowweave.ai/v1/generate".to_string(),
        enabled: true,
    }))
}

async fn billing_plans(State(state): State<AppState>) -> Json<PricingPlansResponse> {
    if !state.entitlehub.is_mock() {
        return Json(PricingPlansResponse { plans: vec![] });
    }

    Json(PricingPlansResponse {
        plans: demo_pricing_plans(),
    })
}

async fn current_session(state: &AppState, headers: &HeaderMap) -> Option<UserSession> {
    let session_id = session_id_from_headers(state, headers)?;
    state.get_session(&session_id).await
}

async fn require_session(state: &AppState, headers: &HeaderMap) -> ApiResult<UserSession> {
    current_session(state, headers)
        .await
        .ok_or_else(|| ApiError::Unauthenticated {
            code: "UNAUTHENTICATED",
            message: "请先登录".to_string(),
        })
}

fn session_id_from_headers(state: &AppState, headers: &HeaderMap) -> Option<String> {
    let cookie = headers
        .get(COOKIE)
        .and_then(|value| value.to_str().ok())?;
    cookie.split(';').find_map(|part| {
        let mut parts = part.trim().splitn(2, '=');
        let name = parts.next()?.trim();
        let value = parts.next()?.trim();
        if name == state.config.session_cookie_name && !value.is_empty() {
            Some(value.to_string())
        } else {
            None
        }
    })
}

async fn request_customer_id(state: &AppState, headers: &HeaderMap) -> String {
    if let Some(session) = current_session(state, headers).await {
        return session.customer_id;
    }
    headers
        .get("x-entitlehub-customer-id")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| state.config.demo_customer_id.clone())
}

async fn require_customer_id(state: &AppState, headers: &HeaderMap) -> ApiResult<String> {
    if state.entitlehub.is_mock() {
        return Ok(request_customer_id(state, headers).await);
    }
    Ok(require_session(state, headers).await?.customer_id)
}

async fn gallery(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ModelsQuery>,
) -> ApiResult<Json<WorksResponse>> {
    if !state.entitlehub.is_mock() {
        let customer_id = current_session(&state, &headers).await.map(|session| session.customer_id);
        let works = state
            .entitlehub
            .list_gallery(customer_id.as_deref(), query.media_type.clone())
            .await?;
        return Ok(Json(WorksResponse { works }));
    }

    let mut works = demo_gallery();
    if let Some(media_type) = query.media_type {
        works.retain(|item| item.media_type == media_type);
    }
    Ok(Json(WorksResponse { works }))
}

async fn favorites(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<WorksResponse>> {
    if !state.entitlehub.is_mock() {
        let customer_id = require_customer_id(&state, &headers).await?;
        let works = state.entitlehub.list_works(&customer_id, None, true).await?;
        return Ok(Json(WorksResponse { works }));
    }

    let mut works = demo_gallery();
    works.sort_by(|a, b| b.likes.cmp(&a.likes));
    works.truncate(6);
    Ok(Json(WorksResponse { works }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AssetsQuery {
    kind: Option<String>,
    source: Option<String>,
    #[serde(default, alias = "asset_role")]
    asset_role: Option<String>,
    page: Option<u32>,
    #[serde(default, alias = "page_size")]
    page_size: Option<u32>,
}

async fn assets(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AssetsQuery>,
) -> ApiResult<Json<AssetsResponse>> {
    if !state.entitlehub.is_mock() {
        let customer_id = require_customer_id(&state, &headers).await?;
        let assets = state
            .entitlehub
            .list_assets(
                &customer_id,
                AssetListFilters {
                    kind: query.kind.as_deref(),
                    source: query.source.as_deref(),
                    asset_role: query.asset_role.as_deref(),
                    page: query.page,
                    page_size: query.page_size,
                },
            )
            .await?;
        return Ok(Json(assets));
    }

    let mut materials = demo_asset_items();
    if let Some(kind) = query.kind.as_deref() {
        materials.retain(|asset| asset.kind == kind);
    }
    if let Some(source) = query.source.as_deref() {
        materials.retain(|asset| {
            asset.source.as_deref() == Some(source) || asset.source_alias.as_deref() == Some(source)
        });
    }
    if let Some(role) = query.asset_role.as_deref() {
        materials.retain(|asset| asset.role.as_deref() == Some(role));
    }
    Ok(Json(AssetsResponse {
        folders: demo_asset_folders(),
        materials,
    }))
}

async fn get_asset(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<AssetItemDto>> {
    let customer_id = require_customer_id(&state, &headers).await?;
    let asset = state.entitlehub.get_asset(&customer_id, &id).await?;
    Ok(Json(asset))
}

async fn create_asset_folder(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CreateAssetFolderRequest>,
) -> ApiResult<Json<AssetFolderResponse>> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest {
            code: "FOLDER_NAME_REQUIRED",
            message: "文件夹名称不能为空".to_string(),
        });
    }

    let customer_id = require_customer_id(&state, &headers).await?;
    let folder = state
        .entitlehub
        .create_asset_folder(
            &customer_id,
            &CreateAssetFolderRequest {
                name: name.to_string(),
                ..input
            },
        )
        .await?;
    Ok(Json(AssetFolderResponse { folder }))
}

async fn create_asset_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CreateAssetUploadRequest>,
) -> ApiResult<Json<AssetUploadResponse>> {
    if input.file_name.trim().is_empty() {
        return Err(ApiError::BadRequest {
            code: "FILE_NAME_REQUIRED",
            message: "文件名不能为空".to_string(),
        });
    }
    if input.mime_type.trim().is_empty() {
        return Err(ApiError::BadRequest {
            code: "MIME_TYPE_REQUIRED",
            message: "文件类型不能为空".to_string(),
        });
    }
    if input.file_size <= 0 {
        return Err(ApiError::BadRequest {
            code: "FILE_SIZE_INVALID",
            message: "文件大小不正确".to_string(),
        });
    }

    let customer_id = require_customer_id(&state, &headers).await?;
    let upload = state
        .entitlehub
        .create_asset_upload(&customer_id, &input)
        .await?;
    Ok(Json(AssetUploadResponse { upload }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UploadAssetFileQuery {
    file_name: String,
    asset_type: String,
    asset_role: Option<String>,
    mime_type: Option<String>,
    folder_id: Option<String>,
}

async fn upload_asset_file(
    State(state): State<AppState>,
    Query(query): Query<UploadAssetFileQuery>,
    headers: HeaderMap,
    bytes: Bytes,
) -> ApiResult<Json<UploadedAssetDto>> {
    if query.file_name.trim().is_empty() {
        return Err(ApiError::BadRequest {
            code: "FILE_NAME_REQUIRED",
            message: "文件名不能为空".to_string(),
        });
    }
    if query.asset_type.trim().is_empty() {
        return Err(ApiError::BadRequest {
            code: "ASSET_TYPE_REQUIRED",
            message: "素材类型不能为空".to_string(),
        });
    }
    if bytes.is_empty() {
        return Err(ApiError::BadRequest {
            code: "FILE_SIZE_INVALID",
            message: "文件大小不正确".to_string(),
        });
    }

    let mime_type = query
        .mime_type
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            headers
                .get("content-type")
                .and_then(|value| value.to_str().ok())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "application/octet-stream".to_string());
    let file_size = i64::try_from(bytes.len()).map_err(|_| ApiError::BadRequest {
        code: "FILE_SIZE_INVALID",
        message: "文件过大".to_string(),
    })?;
    let input = CreateAssetUploadRequest {
        folder_id: query.folder_id,
        file_name: query.file_name,
        asset_type: query.asset_type,
        asset_role: query.asset_role,
        mime_type,
        file_size,
    };
    let customer_id = require_customer_id(&state, &headers).await?;
    let upload = state
        .entitlehub
        .upload_asset_file(&customer_id, &input, bytes.to_vec())
        .await?;
    Ok(Json(upload))
}

async fn delete_asset(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<ActionResponse>> {
    let customer_id = require_customer_id(&state, &headers).await?;
    state.entitlehub.delete_asset(&customer_id, &id).await?;
    Ok(Json(ActionResponse { ok: true }))
}

async fn styles(State(state): State<AppState>) -> Json<StylePresetsResponse> {
    if !state.entitlehub.is_mock() {
        return Json(StylePresetsResponse { styles: vec![] });
    }

    Json(StylePresetsResponse {
        styles: demo_style_presets(),
    })
}

#[derive(Deserialize)]
struct ModelsQuery {
    #[serde(rename = "type")]
    media_type: Option<MediaType>,
}

async fn models(
    State(state): State<AppState>,
    Query(query): Query<ModelsQuery>,
) -> ApiResult<Json<ModelsResponse>> {
    let mut data = state.entitlehub.list_models(None).await?;
    if let Some(media_type) = query.media_type {
        data.retain(|m| m.modality == media_type);
    }
    Ok(Json(ModelsResponse { data }))
}

async fn create_generation_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<CreateGenerationJobRequest>,
) -> ApiResult<Json<JobResponse>> {
    validate_prompt(&input.prompt)?;
    let customer_id = require_customer_id(&state, &headers).await?;
    let model = validate_against_models(&state, &customer_id, &input).await?;
    validate_reference_assets(&state, &customer_id, &model, &input).await?;
    let resolution = input
        .resolution
        .clone()
        .or_else(|| model.capabilities.resolutions.first().cloned());
    let duration_sec = if matches!(input.media_type, MediaType::Video | MediaType::Audio) {
        input
            .duration_sec
            .or(model.capabilities.default_duration_seconds)
    } else {
        None
    };
    let source_mode = input.source_mode.clone().unwrap_or(SourceMode::Text);
    let structured_assets = input.reference_assets.as_deref().unwrap_or(&[]);
    let reference_count = if !structured_assets.is_empty() {
        structured_assets.len() as u32
    } else {
        input
            .reference_asset_ids
            .as_ref()
            .map(|ids| ids.len() as u32)
            .unwrap_or(0)
    };
    let has_first_frame = input.first_frame_asset_id.is_some()
        || structured_assets
            .iter()
            .any(|asset| asset.role == "first_frame");
    let has_last_frame = input.last_frame_asset_id.is_some()
        || structured_assets
            .iter()
            .any(|asset| asset.role == "last_frame");

    let job_id = Uuid::new_v4().to_string();
    let idempotency_key = format!("shadowweave-{customer_id}-{job_id}-generate");
    let upstream_input = CreateGenerationJobRequest {
        resolution: resolution.clone(),
        duration_sec,
        ..input.clone()
    };
    let entitlehub_job = state
        .entitlehub
        .create_job(&customer_id, &idempotency_key, &upstream_input)
        .await?;

    let now = now_millis();
    let status = map_entitlehub_status(&entitlehub_job.status);
    let job = GenerationJobDto {
        id: job_id.clone(),
        customer_id: Some(customer_id.clone()),
        entitlehub_job_id: Some(entitlehub_job.id),
        media_type: input.media_type.clone(),
        status: status.clone(),
        progress: progress_for_status(&status),
        prompt: input.prompt.trim().to_string(),
        model: input.model,
        aspect_ratio: input.aspect_ratio,
        resolution,
        count: input.count.unwrap_or(1),
        created_at: now,
        updated_at: now,
        results: vec![],
        error: None,
        duration_sec,
        held_minor: entitlehub_job.held_minor.unwrap_or(0),
        charged_minor: entitlehub_job.charged_minor.unwrap_or(0),
        idempotency_key,
        source_mode: Some(source_mode),
        reference_count: Some(reference_count),
        has_first_frame: Some(has_first_frame),
        has_last_frame: Some(has_last_frame),
    };

    state.jobs.write().await.insert(job_id, job.clone());
    Ok(Json(JobResponse { job }))
}

async fn list_jobs(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<JobsResponse>> {
    let mut jobs: Vec<_> = if state.entitlehub.is_mock() {
        state.jobs.read().await.values().cloned().collect()
    } else {
        let customer_id = require_customer_id(&state, &headers).await?;
        let mut upstream_jobs: Vec<_> = state
            .entitlehub
            .list_jobs(&customer_id, None)
            .await?
            .into_iter()
            .map(|job| generation_job_from_entitlehub(job, &customer_id))
            .collect();
        let local_jobs: Vec<_> = state
            .jobs
            .read()
            .await
            .values()
            .filter(|job| job.customer_id.as_deref() == Some(customer_id.as_str()))
            .cloned()
            .collect();
        upstream_jobs.extend(local_jobs);
        upstream_jobs
    };

    if jobs.is_empty() && state.entitlehub.is_mock() {
        jobs = demo_generation_jobs();
    }
    jobs.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(Json(JobsResponse { jobs }))
}

async fn get_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<JobResponse>> {
    let mut job = {
        let jobs = state.jobs.read().await;
        jobs.get(&id).cloned().ok_or_else(|| ApiError::NotFound {
            code: "JOB_NOT_FOUND",
            message: "生成任务不存在".to_string(),
        })?
    };

    if state.entitlehub.is_mock() {
        advance_mock_job(&state, &mut job).await;
    } else if let Some(entitlehub_job_id) = job.entitlehub_job_id.clone() {
        let customer_id = require_customer_id(&state, &headers).await?;
        if job.customer_id.as_deref() != Some(customer_id.as_str()) {
            return Err(ApiError::NotFound {
                code: "JOB_NOT_FOUND",
                message: "生成任务不存在".to_string(),
            });
        }
        let upstream_job = state
            .entitlehub
            .get_job(&customer_id, &entitlehub_job_id)
            .await?;
        apply_entitlehub_job(&state, &mut job, upstream_job).await;
    }

    state.jobs.write().await.insert(id, job.clone());
    Ok(Json(JobResponse { job }))
}

async fn list_works(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<WorksResponse>> {
    if !state.entitlehub.is_mock() {
        let customer_id = require_customer_id(&state, &headers).await?;
        let works = state
            .entitlehub
            .list_works(&customer_id, None, false)
            .await?;
        return Ok(Json(WorksResponse { works }));
    }

    let mut works = state.works.read().await.clone();
    if works.is_empty() && state.entitlehub.is_mock() {
        works = demo_my_works(&state);
    }
    works.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(Json(WorksResponse { works }))
}

async fn delete_work(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<ActionResponse>> {
    if state.entitlehub.is_mock() {
        state.works.write().await.retain(|work| work.id != id);
        return Ok(Json(ActionResponse { ok: true }));
    }

    let customer_id = require_customer_id(&state, &headers).await?;
    state
        .entitlehub
        .delete_work(&customer_id, &id)
        .await?;
    Ok(Json(ActionResponse { ok: true }))
}

async fn favorite_work(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<WorkResponse>> {
    if state.entitlehub.is_mock() {
        let mut works = state.works.write().await;
        let work = works.iter_mut().find(|work| work.id == id).map(|work| {
            work.favorited_at = Some(now_millis());
            work.clone()
        });
        return Ok(Json(WorkResponse { work }));
    }

    let customer_id = require_customer_id(&state, &headers).await?;
    let work = state
        .entitlehub
        .favorite_work(&customer_id, &id, true)
        .await?;
    Ok(Json(WorkResponse { work }))
}

async fn unfavorite_work(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<WorkResponse>> {
    if state.entitlehub.is_mock() {
        let mut works = state.works.write().await;
        let work = works.iter_mut().find(|work| work.id == id).map(|work| {
            work.favorited_at = None;
            work.clone()
        });
        return Ok(Json(WorkResponse { work }));
    }

    let customer_id = require_customer_id(&state, &headers).await?;
    let work = state
        .entitlehub
        .favorite_work(&customer_id, &id, false)
        .await?;
    Ok(Json(WorkResponse { work }))
}

async fn download_work(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<WorkDownloadResponse>> {
    if state.entitlehub.is_mock() {
        let now = now_millis();
        let mut works = state.works.write().await;
        let work = works.iter_mut().find(|work| work.id == id).map(|work| {
            work.downloaded_at = Some(now);
            work.clone()
        });
        let download_url = work
            .as_ref()
            .and_then(|work| work.url.clone())
            .unwrap_or_default();
        return Ok(Json(WorkDownloadResponse {
            download_url,
            downloaded_at: Some(now),
            work,
        }));
    }

    let customer_id = require_customer_id(&state, &headers).await?;
    let download = state
        .entitlehub
        .download_work(&customer_id, &id)
        .await?;
    Ok(Json(download))
}

async fn publish_work(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(input): Json<PublishWorkRequest>,
) -> ApiResult<Json<WorkResponse>> {
    if state.entitlehub.is_mock() {
        let mut works = state.works.write().await;
        let work = works.iter_mut().find(|work| work.id == id).map(|work| {
            work.visibility = Some(WorkVisibility::Gallery);
            work.published_at = Some(now_millis());
            work.clone()
        });
        return Ok(Json(WorkResponse { work }));
    }

    let customer_id = require_customer_id(&state, &headers).await?;
    let work = state
        .entitlehub
        .publish_work(&customer_id, &id, input.tags)
        .await?;
    Ok(Json(WorkResponse { work }))
}

async fn unpublish_work(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> ApiResult<Json<WorkResponse>> {
    if state.entitlehub.is_mock() {
        let mut works = state.works.write().await;
        let work = works.iter_mut().find(|work| work.id == id).map(|work| {
            work.visibility = Some(WorkVisibility::Private);
            work.published_at = None;
            work.clone()
        });
        return Ok(Json(WorkResponse { work }));
    }

    let customer_id = require_customer_id(&state, &headers).await?;
    let work = state
        .entitlehub
        .unpublish_work(&customer_id, &id)
        .await?;
    Ok(Json(WorkResponse { work }))
}

fn validate_prompt(prompt: &str) -> ApiResult<()> {
    let prompt = prompt.trim();
    if prompt.is_empty() {
        return Err(ApiError::BadRequest {
            code: "PROMPT_REQUIRED",
            message: "提示词不能为空".to_string(),
        });
    }
    if prompt.chars().count() > 8000 {
        return Err(ApiError::BadRequest {
            code: "PROMPT_TOO_LONG",
            message: "提示词不能超过 8000 字".to_string(),
        });
    }
    Ok(())
}

fn generation_job_from_entitlehub(job: EntitleHubJob, customer_id: &str) -> GenerationJobDto {
    let media_type = job.job_type.clone().unwrap_or(MediaType::Image);
    let status = map_entitlehub_status(&job.status);
    let request = job.request_payload.as_ref();
    let count = job
        .count
        .or(job.n)
        .or_else(|| request_u32(request, &["count", "n"]))
        .unwrap_or(1);
    let duration_sec = job
        .duration_sec
        .or(job.duration)
        .or_else(|| request_u32(request, &["duration_sec", "duration"]));
    let prompt = job
        .prompt
        .clone()
        .or_else(|| request_string(request, &["prompt"]))
        .unwrap_or_else(|| "生成任务".to_string());
    let model = job
        .model
        .clone()
        .or_else(|| request_string(request, &["model"]))
        .unwrap_or_else(|| "unknown".to_string());
    let aspect_ratio = job
        .aspect_ratio
        .clone()
        .or(job.ratio.clone())
        .or_else(|| request_string(request, &["aspect_ratio", "ratio"]))
        .unwrap_or_else(|| default_ratio_for_type(&media_type).to_string());
    let resolution = job
        .resolution
        .clone()
        .or(job.size.clone())
        .or_else(|| request_string(request, &["resolution", "size"]));
    let created_at = parse_entitlehub_time(job.created_at.as_deref());
    let updated_at = parse_entitlehub_time(job.updated_at.as_deref()).max(created_at);
    let source_mode = job
        .source_mode
        .clone()
        .or_else(|| request_source_mode(request));
    let reference_count = job.reference_count.or_else(|| {
        request_array_len(
            request,
            &[
                "reference_assets",
                "referenceAssets",
                "reference_asset_ids",
                "referenceAssetIds",
            ],
        )
    });
    let has_first_frame = job
        .has_first_frame
        .or_else(|| request_bool(request, &["has_first_frame", "hasFirstFrame"]))
        .or_else(|| {
            request_string(request, &["first_frame_asset_id", "firstFrameAssetId"]).map(|_| true)
        });
    let has_last_frame = job
        .has_last_frame
        .or_else(|| request_bool(request, &["has_last_frame", "hasLastFrame"]))
        .or_else(|| {
            request_string(request, &["last_frame_asset_id", "lastFrameAssetId"]).map(|_| true)
        });
    let progress = job.progress.unwrap_or_else(|| progress_for_status(&status));
    let assets = job.assets.clone();
    let asset_urls = job.asset_urls.clone();
    let error = job.failure_reason.clone();

    let local_job = GenerationJobDto {
        id: job.id.clone(),
        customer_id: Some(customer_id.to_string()),
        entitlehub_job_id: Some(job.id),
        media_type,
        status: status.clone(),
        progress,
        prompt,
        model,
        aspect_ratio,
        resolution,
        count,
        created_at,
        updated_at,
        results: vec![],
        error,
        duration_sec,
        held_minor: job.held_minor.unwrap_or(0),
        charged_minor: job.charged_minor.unwrap_or(0),
        idempotency_key: format!("entitlehub-{customer_id}"),
        source_mode,
        reference_count,
        has_first_frame,
        has_last_frame,
    };

    let results = if local_job.status == JobStatus::Succeeded {
        build_results_from_assets(&local_job, assets, customer_id)
            .unwrap_or_else(|| build_results_from_urls(&local_job, asset_urls))
    } else {
        vec![]
    };

    GenerationJobDto {
        results,
        ..local_job
    }
}

fn build_results_from_assets(
    job: &GenerationJobDto,
    assets: Vec<crate::entitlehub::EntitleHubAsset>,
    customer_id: &str,
) -> Option<Vec<MediaItemDto>> {
    if assets.is_empty() {
        return None;
    }
    let author = AuthorDto {
        id: customer_id.to_string(),
        name: "影织用户".to_string(),
        avatar_seed: customer_id.to_string(),
    };
    let items = assets
        .into_iter()
        .map(|asset| {
            let url = asset
                .url
                .clone()
                .or(asset.asset_url.clone())
                .or(asset.download_url.clone())
                .or(asset.public_url.clone());
            MediaItemDto {
                id: asset.id.clone(),
                media_type: job.media_type.clone(),
                asset_id: Some(asset.id.clone()),
                seed: url.clone().unwrap_or_else(|| asset.id.clone()),
                url,
                prompt: job.prompt.clone(),
                full_prompt: None,
                model: job.model.clone(),
                category: match job.media_type {
                    MediaType::Image => "abstract",
                    MediaType::Video => "landscape",
                    MediaType::Audio => "abstract",
                }
                .to_string(),
                aspect_ratio: job.aspect_ratio.clone(),
                resolution: job.resolution.clone(),
                author: author.clone(),
                likes: 0,
                created_at: job.updated_at,
                duration_sec: asset
                    .duration_sec
                    .or(asset.duration_seconds)
                    .or(asset.duration)
                    .or_else(|| job.duration_sec.map(i64::from)),
                source_mode: job.source_mode.clone(),
                reference_count: job.reference_count,
                has_first_frame: job.has_first_frame,
                has_last_frame: job.has_last_frame,
                visibility: Some(WorkVisibility::Private),
                published_at: None,
                favorited_at: None,
                downloaded_at: None,
                demo: false,
            }
        })
        .collect();
    Some(items)
}

fn build_results_from_urls(job: &GenerationJobDto, asset_urls: Vec<String>) -> Vec<MediaItemDto> {
    let count = if asset_urls.is_empty() {
        0
    } else {
        asset_urls.len() as u32
    };
    let author = AuthorDto {
        id: "current".to_string(),
        name: "影织用户".to_string(),
        avatar_seed: "current-user".to_string(),
    };

    (0..count)
        .map(|i| MediaItemDto {
            id: format!("media_{}_{}", job.id, i),
            media_type: job.media_type.clone(),
            asset_id: None,
            seed: asset_urls
                .get(i as usize)
                .cloned()
                .unwrap_or_else(|| format!("{}-{i}", job.id)),
            url: asset_urls.get(i as usize).cloned(),
            prompt: job.prompt.clone(),
            full_prompt: None,
            model: job.model.clone(),
            category: match job.media_type {
                MediaType::Image => "abstract",
                MediaType::Video => "landscape",
                MediaType::Audio => "abstract",
            }
            .to_string(),
            aspect_ratio: job.aspect_ratio.clone(),
            resolution: job.resolution.clone(),
            author: author.clone(),
            likes: 0,
            created_at: job.updated_at,
            duration_sec: job.duration_sec.map(i64::from),
            source_mode: job.source_mode.clone(),
            reference_count: job.reference_count,
            has_first_frame: job.has_first_frame,
            has_last_frame: job.has_last_frame,
            visibility: Some(WorkVisibility::Private),
            published_at: None,
            favorited_at: None,
            downloaded_at: None,
            demo: false,
        })
        .collect()
}

fn request_string(request: Option<&serde_json::Value>, keys: &[&str]) -> Option<String> {
    let request = request?;
    for key in keys {
        if let Some(value) = request.get(key).and_then(|v| v.as_str()) {
            return Some(value.to_string());
        }
    }
    None
}

fn request_u32(request: Option<&serde_json::Value>, keys: &[&str]) -> Option<u32> {
    let request = request?;
    for key in keys {
        if let Some(value) = request.get(key).and_then(|v| v.as_u64()) {
            return Some(value as u32);
        }
    }
    None
}

fn request_bool(request: Option<&serde_json::Value>, keys: &[&str]) -> Option<bool> {
    let request = request?;
    for key in keys {
        if let Some(value) = request.get(key).and_then(|v| v.as_bool()) {
            return Some(value);
        }
    }
    None
}

fn request_array_len(request: Option<&serde_json::Value>, keys: &[&str]) -> Option<u32> {
    let request = request?;
    for key in keys {
        if let Some(value) = request.get(key).and_then(|v| v.as_array()) {
            return Some(value.len() as u32);
        }
    }
    None
}

fn request_source_mode(request: Option<&serde_json::Value>) -> Option<SourceMode> {
    match request_string(
        request,
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

fn parse_entitlehub_time(value: Option<&str>) -> i64 {
    value
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.timestamp_millis())
        .unwrap_or_else(now_millis)
}

fn default_ratio_for_type(media_type: &MediaType) -> &'static str {
    match media_type {
        MediaType::Image => "1:1",
        MediaType::Video => "16:9",
        MediaType::Audio => "1:1",
    }
}

async fn validate_against_models(
    state: &AppState,
    customer_id: &str,
    input: &CreateGenerationJobRequest,
) -> ApiResult<ModelProductDto> {
    let models = state.entitlehub.list_models(Some(customer_id)).await?;
    let model = models
        .into_iter()
        .find(|m| m.id == input.model && m.modality == input.media_type)
        .ok_or_else(|| ApiError::BadRequest {
            code: "MODEL_NOT_AVAILABLE",
            message: "模型不可用，请刷新模型列表".to_string(),
        })?;

    if !model.capabilities.ratios.is_empty()
        && !model.capabilities.ratios.contains(&input.aspect_ratio)
    {
        return Err(ApiError::BadRequest {
            code: "RATIO_NOT_ALLOWED",
            message: "当前模型不支持这个比例".to_string(),
        });
    }

    if let Some(resolution) = &input.resolution {
        if !model.capabilities.resolutions.is_empty()
            && !model.capabilities.resolutions.contains(resolution)
        {
            return Err(ApiError::BadRequest {
                code: "RESOLUTION_NOT_ALLOWED",
                message: "当前模型不支持这个分辨率".to_string(),
            });
        }
    }

    let source_mode = input.source_mode.clone().unwrap_or(SourceMode::Text);
    if !model.capabilities.input_modes.is_empty()
        && !model.capabilities.input_modes.contains(&source_mode)
    {
        return Err(ApiError::BadRequest {
            code: "INPUT_MODE_NOT_ALLOWED",
            message: "当前模型不支持这个输入方式".to_string(),
        });
    }

    if source_mode == SourceMode::Frames {
        if model.capabilities.supports_first_frame == Some(false)
            || model.capabilities.supports_last_frame == Some(false)
        {
            return Err(ApiError::BadRequest {
                code: "FRAMES_NOT_ALLOWED",
                message: "当前模型不支持首尾帧输入".to_string(),
            });
        }
    }

    if input.first_frame_asset_id.is_some()
        && model.capabilities.supports_first_frame == Some(false)
    {
        return Err(ApiError::BadRequest {
            code: "FIRST_FRAME_NOT_ALLOWED",
            message: "当前模型不支持首帧输入".to_string(),
        });
    }

    if input.last_frame_asset_id.is_some() && model.capabilities.supports_last_frame == Some(false)
    {
        return Err(ApiError::BadRequest {
            code: "LAST_FRAME_NOT_ALLOWED",
            message: "当前模型不支持尾帧输入".to_string(),
        });
    }

    let reference_assets = input.reference_assets.as_deref().unwrap_or(&[]);
    let reference_count = if !reference_assets.is_empty() {
        reference_assets.len() as u32
    } else {
        input
            .reference_asset_ids
            .as_ref()
            .map(|ids| ids.len() as u32)
            .unwrap_or(0)
    };
    let reference_image_count = reference_assets
        .iter()
        .filter(|asset| asset.kind == "image")
        .count() as u32;
    let reference_video_count = reference_assets
        .iter()
        .filter(|asset| asset.kind == "video")
        .count() as u32;
    let reference_audio_count = reference_assets
        .iter()
        .filter(|asset| asset.kind == "audio")
        .count() as u32;
    if reference_assets.iter().any(|asset| asset.kind == "video")
        && model.capabilities.supports_reference_video == Some(false)
    {
        return Err(ApiError::BadRequest {
            code: "REFERENCE_VIDEO_NOT_ALLOWED",
            message: "当前模型不支持参考视频".to_string(),
        });
    }
    if reference_assets.iter().any(|asset| asset.kind == "audio")
        && model.capabilities.supports_reference_audio == Some(false)
    {
        return Err(ApiError::BadRequest {
            code: "REFERENCE_AUDIO_NOT_ALLOWED",
            message: "当前模型不支持参考音频".to_string(),
        });
    }
    if reference_assets
        .iter()
        .any(|asset| asset.role == "first_frame")
        && model.capabilities.supports_first_frame == Some(false)
    {
        return Err(ApiError::BadRequest {
            code: "FIRST_FRAME_NOT_ALLOWED",
            message: "当前模型不支持首帧输入".to_string(),
        });
    }
    if reference_assets
        .iter()
        .any(|asset| asset.role == "last_frame")
        && model.capabilities.supports_last_frame == Some(false)
    {
        return Err(ApiError::BadRequest {
            code: "LAST_FRAME_NOT_ALLOWED",
            message: "当前模型不支持尾帧输入".to_string(),
        });
    }
    if let Some(max) = model.capabilities.max_reference_images {
        let checked_count = if reference_assets.is_empty() {
            reference_count
        } else {
            reference_image_count
        };
        if checked_count > max {
            return Err(ApiError::BadRequest {
                code: "REFERENCE_ASSET_LIMIT_EXCEEDED",
                message: "参考图片数量超过当前模型限制".to_string(),
            });
        }
    }
    if let Some(max) = model.capabilities.max_reference_videos {
        if reference_video_count > max {
            return Err(ApiError::BadRequest {
                code: "REFERENCE_VIDEO_LIMIT_EXCEEDED",
                message: "参考视频数量超过当前模型限制".to_string(),
            });
        }
    }
    if let Some(max) = model.capabilities.max_reference_audios {
        if reference_audio_count > max {
            return Err(ApiError::BadRequest {
                code: "REFERENCE_AUDIO_LIMIT_EXCEEDED",
                message: "参考音频数量超过当前模型限制".to_string(),
            });
        }
    }

    match input.media_type {
        MediaType::Image => {
            let count = input.count.unwrap_or(1);
            if !model.capabilities.image_counts.is_empty()
                && !model.capabilities.image_counts.contains(&count)
            {
                return Err(ApiError::BadRequest {
                    code: "COUNT_NOT_ALLOWED",
                    message: "当前模型不支持这个生成张数".to_string(),
                });
            }
            if let Some(max) = model.capabilities.max_images {
                if count > max {
                    return Err(ApiError::BadRequest {
                        code: "COUNT_NOT_ALLOWED",
                        message: "当前模型不支持这个生成张数".to_string(),
                    });
                }
            }
        }
        MediaType::Video => {
            let duration = input
                .duration_sec
                .or(model.capabilities.default_duration_seconds)
                .unwrap_or(8);
            if !model.capabilities.durations.is_empty()
                && !model.capabilities.durations.contains(&duration)
            {
                return Err(ApiError::BadRequest {
                    code: "DURATION_NOT_ALLOWED",
                    message: "当前模型不支持这个时长".to_string(),
                });
            }
        }
        MediaType::Audio => {
            if let Some(duration) = input.duration_sec {
                if !model.capabilities.durations.is_empty()
                    && !model.capabilities.durations.contains(&duration)
                {
                    return Err(ApiError::BadRequest {
                        code: "DURATION_NOT_ALLOWED",
                        message: "当前模型不支持这个时长".to_string(),
                    });
                }
            }
        }
    }

    Ok(model)
}

async fn validate_reference_assets(
    state: &AppState,
    customer_id: &str,
    model: &ModelProductDto,
    input: &CreateGenerationJobRequest,
) -> ApiResult<()> {
    if state.entitlehub.is_mock() {
        return Ok(());
    }

    let references = normalized_request_references(input);
    if references.is_empty() {
        return Ok(());
    }

    let mut total_video_seconds = 0_u32;
    let mut total_audio_seconds = 0_u32;
    for reference in references {
        let asset = state
            .entitlehub
            .get_asset(customer_id, &reference.asset_id)
            .await?;
        validate_reference_asset_metadata(&model.capabilities, &reference, &asset)?;
        match reference.kind.as_str() {
            "video" => {
                total_video_seconds += asset_duration_seconds(&asset).unwrap_or(0);
            }
            "audio" => {
                total_audio_seconds += asset_duration_seconds(&asset).unwrap_or(0);
            }
            _ => {}
        }
    }

    if let Some(max) = model.capabilities.total_reference_video_seconds {
        if total_video_seconds > max {
            return Err(ApiError::BadRequest {
                code: "REFERENCE_VIDEO_TOTAL_DURATION_EXCEEDED",
                message: format!("参考视频总时长不能超过 {max} 秒"),
            });
        }
    }
    if let Some(max) = model.capabilities.total_reference_audio_seconds {
        if total_audio_seconds > max {
            return Err(ApiError::BadRequest {
                code: "REFERENCE_AUDIO_TOTAL_DURATION_EXCEEDED",
                message: format!("参考音频总时长不能超过 {max} 秒"),
            });
        }
    }

    Ok(())
}

fn validate_reference_asset_metadata(
    capabilities: &ModelCapabilitiesDto,
    reference: &ReferenceAssetInput,
    asset: &AssetItemDto,
) -> ApiResult<()> {
    if asset.status.as_deref() != Some("ready") {
        return Err(ApiError::BadRequest {
            code: "ASSET_NOT_READY",
            message: "参考素材还在处理中，请稍后再生成".to_string(),
        });
    }

    if matches!(reference.role.as_str(), "first_frame" | "last_frame") && reference.kind != "image"
    {
        return Err(ApiError::BadRequest {
            code: "REFERENCE_ASSET_KIND_MISMATCH",
            message: "首帧和尾帧必须使用图片素材".to_string(),
        });
    }

    if !capabilities.accepted_mime_types.is_empty() {
        let mime_type = asset.mime_type.as_deref().unwrap_or_default();
        if !mime_type.is_empty()
            && !capabilities
                .accepted_mime_types
                .iter()
                .any(|allowed| allowed.eq_ignore_ascii_case(mime_type))
        {
            return Err(ApiError::BadRequest {
                code: "REFERENCE_ASSET_MIME_NOT_ALLOWED",
                message: "当前模型不支持这个素材文件类型".to_string(),
            });
        }
    }

    if let Some(max_mb) = max_asset_size_mb_for(capabilities, &reference.kind) {
        if let Some(file_size) = asset.file_size {
            let max_bytes = i64::from(max_mb) * 1024 * 1024;
            if file_size > max_bytes {
                return Err(ApiError::BadRequest {
                    code: "REFERENCE_ASSET_TOO_LARGE",
                    message: format!("参考素材不能超过 {max_mb}MB"),
                });
            }
        }
    }

    if reference.kind == "video" {
        validate_media_duration(
            asset_duration_seconds(asset),
            capabilities.min_reference_video_seconds,
            capabilities.max_reference_video_seconds,
            "REFERENCE_VIDEO_DURATION_NOT_ALLOWED",
            "参考视频",
        )?;
    }
    if reference.kind == "audio" {
        validate_media_duration(
            asset_duration_seconds(asset),
            capabilities.min_reference_audio_seconds,
            capabilities.max_reference_audio_seconds,
            "REFERENCE_AUDIO_DURATION_NOT_ALLOWED",
            "参考音频",
        )?;
    }

    Ok(())
}

fn validate_media_duration(
    duration: Option<u32>,
    min: Option<u32>,
    max: Option<u32>,
    code: &'static str,
    label: &str,
) -> ApiResult<()> {
    let Some(duration) = duration else {
        return Ok(());
    };
    if let Some(min) = min {
        if duration < min {
            return Err(ApiError::BadRequest {
                code,
                message: format!("{label}不能短于 {min} 秒"),
            });
        }
    }
    if let Some(max) = max {
        if duration > max {
            return Err(ApiError::BadRequest {
                code,
                message: format!("{label}不能超过 {max} 秒"),
            });
        }
    }
    Ok(())
}

fn max_asset_size_mb_for(capabilities: &ModelCapabilitiesDto, kind: &str) -> Option<u32> {
    match kind {
        "image" => capabilities
            .max_image_asset_size_mb
            .or(capabilities.max_asset_size_mb),
        "video" => capabilities
            .max_video_asset_size_mb
            .or(capabilities.max_asset_size_mb),
        "audio" => capabilities
            .max_audio_asset_size_mb
            .or(capabilities.max_asset_size_mb),
        _ => capabilities.max_asset_size_mb,
    }
}

fn asset_duration_seconds(asset: &AssetItemDto) -> Option<u32> {
    asset
        .duration_sec
        .or(asset.duration_seconds)
        .or(asset.duration)
        .and_then(|duration| u32::try_from(duration.max(0)).ok())
}

fn normalized_request_references(input: &CreateGenerationJobRequest) -> Vec<ReferenceAssetInput> {
    if let Some(reference_assets) = &input.reference_assets {
        if !reference_assets.is_empty() {
            return reference_assets
                .iter()
                .filter(|asset| !asset.asset_id.trim().is_empty())
                .cloned()
                .collect();
        }
    }

    let reference_kind = match input.source_mode.as_ref() {
        Some(SourceMode::Video) => "video",
        Some(SourceMode::Audio) => "audio",
        _ => "image",
    };
    let mut assets = vec![];
    if let Some(reference_asset_ids) = &input.reference_asset_ids {
        assets.extend(
            reference_asset_ids
                .iter()
                .filter(|id| !id.trim().is_empty())
                .map(|id| ReferenceAssetInput {
                    asset_id: id.clone(),
                    kind: reference_kind.to_string(),
                    role: "reference".to_string(),
                }),
        );
    }
    if let Some(asset_id) = &input.first_frame_asset_id {
        assets.push(ReferenceAssetInput {
            asset_id: asset_id.clone(),
            kind: "image".to_string(),
            role: "first_frame".to_string(),
        });
    }
    if let Some(asset_id) = &input.last_frame_asset_id {
        assets.push(ReferenceAssetInput {
            asset_id: asset_id.clone(),
            kind: "image".to_string(),
            role: "last_frame".to_string(),
        });
    }
    assets
}

async fn advance_mock_job(state: &AppState, job: &mut GenerationJobDto) {
    if matches!(job.status, JobStatus::Succeeded | JobStatus::Failed) {
        return;
    }

    let elapsed = now_millis() - job.created_at;
    let next = if elapsed < 1_500 {
        JobStatus::Queued
    } else if elapsed < 5_500 {
        JobStatus::Running
    } else if elapsed < 7_000 {
        JobStatus::Caching
    } else {
        JobStatus::Succeeded
    };

    job.status = next;
    job.progress = progress_for_status(&job.status);
    job.updated_at = now_millis();

    if job.status == JobStatus::Succeeded && job.results.is_empty() {
        job.results = build_results(state, job, vec![]).await;
        let mut works = state.works.write().await;
        works.extend(job.results.clone());
    }
}

async fn apply_entitlehub_job(
    state: &AppState,
    job: &mut GenerationJobDto,
    upstream: EntitleHubJob,
) {
    let status = map_entitlehub_status(&upstream.status);
    job.status = status;
    job.progress = progress_for_status(&job.status);
    job.updated_at = now_millis();
    job.held_minor = upstream.held_minor.unwrap_or(job.held_minor);
    job.charged_minor = upstream.charged_minor.unwrap_or(job.charged_minor);
    if let Some(prompt) = upstream.prompt.clone() {
        job.prompt = prompt;
    }
    if let Some(model) = upstream.model.clone() {
        job.model = model;
    }
    if let Some(aspect_ratio) = upstream.aspect_ratio.clone().or(upstream.ratio.clone()) {
        job.aspect_ratio = aspect_ratio;
    }
    if let Some(resolution) = upstream.resolution.clone().or(upstream.size.clone()) {
        job.resolution = Some(resolution);
    }
    if let Some(duration) = upstream.duration_sec.or(upstream.duration) {
        job.duration_sec = Some(duration);
    }
    if let Some(count) = upstream.count.or(upstream.n) {
        job.count = count;
    }

    if job.status == JobStatus::Succeeded && job.results.is_empty() {
        job.results = build_results(state, job, upstream.asset_urls).await;
        let mut works = state.works.write().await;
        works.extend(job.results.clone());
    }

    if job.status == JobStatus::Failed {
        job.error = Some("生成失败，请稍后重试".to_string());
    }
    if job.status == JobStatus::Review {
        job.error = Some("任务处理中，需要后台人工确认".to_string());
    }
}

async fn build_results(
    state: &AppState,
    job: &GenerationJobDto,
    asset_urls: Vec<String>,
) -> Vec<MediaItemDto> {
    let count = if asset_urls.is_empty() {
        job.count.max(1)
    } else {
        asset_urls.len() as u32
    };
    let author = state.demo_author();

    (0..count)
        .map(|i| MediaItemDto {
            id: format!("media_{}_{}", job.id, i),
            media_type: job.media_type.clone(),
            asset_id: None,
            seed: format!(
                "{}-{}-{i}",
                job.prompt.chars().take(12).collect::<String>(),
                job.id
            ),
            url: asset_urls.get(i as usize).cloned(),
            prompt: job.prompt.clone(),
            full_prompt: None,
            model: job.model.clone(),
            category: match job.media_type {
                MediaType::Image => "abstract",
                MediaType::Video => "landscape",
                MediaType::Audio => "abstract",
            }
            .to_string(),
            aspect_ratio: job.aspect_ratio.clone(),
            resolution: job.resolution.clone(),
            author: author.clone(),
            likes: 0,
            created_at: now_millis(),
            duration_sec: job.duration_sec.map(i64::from),
            source_mode: job.source_mode.clone(),
            reference_count: job.reference_count,
            has_first_frame: job.has_first_frame,
            has_last_frame: job.has_last_frame,
            visibility: Some(WorkVisibility::Private),
            published_at: None,
            favorited_at: None,
            downloaded_at: None,
            demo: false,
        })
        .collect()
}

fn daily_credit_bars(used_credits: i64) -> Vec<i64> {
    if used_credits <= 0 {
        return vec![0; 30];
    }

    let base = (used_credits / 30).max(1);
    (0..30)
        .map(|i| {
            let weight = 60 + ((i * 17) % 55) as i64;
            (base * weight / 100).max(1)
        })
        .collect()
}

fn demo_pricing_plans() -> Vec<PricingPlanDto> {
    vec![
        PricingPlanDto {
            id: "free".to_string(),
            name: "体验版".to_string(),
            tagline: "适合个人尝鲜与轻量创作".to_string(),
            price_monthly: 0,
            price_yearly: 0,
            credits: "每月 100 算力".to_string(),
            features: vec![
                "标准图片模型".to_string(),
                "基础视频模型（带水印）".to_string(),
                "公开作品至灵感广场".to_string(),
                "社区标准队列".to_string(),
            ],
            highlighted: false,
            cta: "免费开始".to_string(),
        },
        PricingPlanDto {
            id: "pro".to_string(),
            name: "专业版".to_string(),
            tagline: "为高频创作者与设计师打造".to_string(),
            price_monthly: 68,
            price_yearly: 680,
            credits: "每月 3,000 算力".to_string(),
            features: vec![
                "全部图片与视频模型".to_string(),
                "无水印 · 商用授权".to_string(),
                "优先生成队列".to_string(),
                "高清放大与批量导出".to_string(),
                "私有作品空间".to_string(),
            ],
            highlighted: true,
            cta: "升级专业版".to_string(),
        },
        PricingPlanDto {
            id: "team".to_string(),
            name: "团队版".to_string(),
            tagline: "面向工作室与品牌团队".to_string(),
            price_monthly: 298,
            price_yearly: 2980,
            credits: "每月 20,000 算力 · 多席位".to_string(),
            features: vec![
                "包含专业版全部能力".to_string(),
                "5 个协作席位起".to_string(),
                "团队素材资产库".to_string(),
                "API 接入与 Webhook".to_string(),
                "专属客户成功支持".to_string(),
            ],
            highlighted: false,
            cta: "联系销售".to_string(),
        },
    ]
}

struct GallerySeed {
    prompt: &'static str,
    media_type: MediaType,
    category: &'static str,
    ratio: &'static str,
    model: &'static str,
}

fn demo_gallery() -> Vec<MediaItemDto> {
    let authors = [
        ("a1", "苏野", "author-suye"),
        ("a2", "Mira", "author-mira"),
        ("a3", "陈墨", "author-chenmo"),
        ("a4", "Kade", "author-kade"),
        ("a5", "若水", "author-ruoshui"),
        ("a6", "Nova", "author-nova"),
        ("a7", "白川", "author-baichuan"),
        ("a8", "Iris", "author-iris"),
    ];
    let seeds = vec![
        GallerySeed {
            prompt: "霓虹雨夜的赛博都市，反光的街道与悬浮广告牌，电影级广角",
            media_type: MediaType::Image,
            category: "architecture",
            ratio: "16:9",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "东方水墨意境的孤舟与远山，留白极简，淡彩晕染",
            media_type: MediaType::Image,
            category: "landscape",
            ratio: "3:4",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "未来感人像，银色金属妆容，柔和棚拍光，杂志封面",
            media_type: MediaType::Image,
            category: "portrait",
            ratio: "3:4",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "悬浮于云海之上的水晶城堡，黄昏暖光，奇幻史诗",
            media_type: MediaType::Video,
            category: "landscape",
            ratio: "16:9",
            model: "织影动境 Pro",
        },
        GallerySeed {
            prompt: "极简产品摄影，香氛瓶置于水面，柔光倒影，高级质感",
            media_type: MediaType::Image,
            category: "product",
            ratio: "1:1",
            model: "织影 · 商业设计",
        },
        GallerySeed {
            prompt: "二次元少女站在樱花树下，风吹花瓣，清新赛璐璐",
            media_type: MediaType::Image,
            category: "anime",
            ratio: "9:16",
            model: "织影 · 二次元",
        },
        GallerySeed {
            prompt: "抽象流体艺术，紫金与青蓝交融的丝绸质感，4K 微距",
            media_type: MediaType::Image,
            category: "abstract",
            ratio: "1:1",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "雪山脚下的极光帐篷，星空璀璨，长曝光银河",
            media_type: MediaType::Image,
            category: "landscape",
            ratio: "21:9",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "复古胶片人像，逆光金色发丝，颗粒质感，70 年代",
            media_type: MediaType::Image,
            category: "portrait",
            ratio: "4:3",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "未来主义运动鞋广告，悬浮分解结构，工作室硬光",
            media_type: MediaType::Image,
            category: "product",
            ratio: "4:3",
            model: "织影 · 商业设计",
        },
        GallerySeed {
            prompt: "机甲战士在废土中行走，沙尘与夕阳，史诗运镜",
            media_type: MediaType::Video,
            category: "abstract",
            ratio: "21:9",
            model: "织影动境 Pro",
        },
        GallerySeed {
            prompt: "玻璃幕墙摩天楼仰拍，几何线条与蓝天，极简建筑",
            media_type: MediaType::Image,
            category: "architecture",
            ratio: "9:16",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "梦核风格的粉色房间，柔焦超现实，胶片光晕",
            media_type: MediaType::Image,
            category: "abstract",
            ratio: "1:1",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "森系少年肖像，斑驳树影光斑，自然柔光",
            media_type: MediaType::Image,
            category: "portrait",
            ratio: "3:4",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "潜水视角的珊瑚礁与光束，海水通透，纪录片质感",
            media_type: MediaType::Video,
            category: "landscape",
            ratio: "16:9",
            model: "织影动境 Lite",
        },
        GallerySeed {
            prompt: "国风插画 · 月下白衣剑客，工笔与水墨结合",
            media_type: MediaType::Image,
            category: "anime",
            ratio: "3:4",
            model: "织影 · 二次元",
        },
        GallerySeed {
            prompt: "悬浮的低多边形小岛，瀑布流入云端，等距视角",
            media_type: MediaType::Image,
            category: "abstract",
            ratio: "1:1",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "高级腕表微距特写，金属反光与水珠，黑金背景",
            media_type: MediaType::Image,
            category: "product",
            ratio: "1:1",
            model: "织影 · 商业设计",
        },
        GallerySeed {
            prompt: "雨中撑伞的女子背影，霓虹倒影湿地面，电影感",
            media_type: MediaType::Video,
            category: "portrait",
            ratio: "9:16",
            model: "织影动境 Pro",
        },
        GallerySeed {
            prompt: "极地科考站夜景，绿色极光下的圆顶建筑，科幻",
            media_type: MediaType::Image,
            category: "architecture",
            ratio: "16:9",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "抽象烟雾舞动，紫红到青蓝渐变，黑底高对比",
            media_type: MediaType::Image,
            category: "abstract",
            ratio: "9:16",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "盛开的多肉植物微观世界，露珠晶莹，柔焦背景",
            media_type: MediaType::Image,
            category: "product",
            ratio: "4:3",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "古风庭院中撑伞而行，飘雪与红墙，长卷构图",
            media_type: MediaType::Video,
            category: "landscape",
            ratio: "21:9",
            model: "织影动境 Lite",
        },
        GallerySeed {
            prompt: "未来都市天际线延时，车流光轨，蓝调时刻",
            media_type: MediaType::Video,
            category: "architecture",
            ratio: "16:9",
            model: "织影动境 Pro",
        },
        GallerySeed {
            prompt: "黄金时刻的海岸公路，胶片质感，3:2 经典画幅",
            media_type: MediaType::Image,
            category: "landscape",
            ratio: "3:2",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "竖构图都市人像，玻璃幕墙倒影，冷调通勤感",
            media_type: MediaType::Image,
            category: "portrait",
            ratio: "2:3",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "超宽全景雪山脉络，晨雾横铺，2:1 大画幅",
            media_type: MediaType::Image,
            category: "landscape",
            ratio: "2:1",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "长竖海报 · 极简香水主视觉，留白与光斑",
            media_type: MediaType::Image,
            category: "product",
            ratio: "1:2",
            model: "织影 · 商业设计",
        },
        GallerySeed {
            prompt: "横幅 banner · 抽象渐变光带，科技发布会主视觉",
            media_type: MediaType::Image,
            category: "abstract",
            ratio: "3:1",
            model: "织影 · 商业设计",
        },
        GallerySeed {
            prompt: "竖长幅卷轴 · 山水层峦由近及远，工笔晕染",
            media_type: MediaType::Image,
            category: "landscape",
            ratio: "1:3",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "极致竖影 · 高塔仰望直入云端，9:21 沉浸构图",
            media_type: MediaType::Image,
            category: "architecture",
            ratio: "9:21",
            model: "织影 X",
        },
        GallerySeed {
            prompt: "温暖女声朗读品牌片旁白，语速稳定，干净棚录质感",
            media_type: MediaType::Audio,
            category: "abstract",
            ratio: "1:1",
            model: "织影音色 TTS",
        },
        GallerySeed {
            prompt: "轻快电子氛围音乐，适合科技产品开场，节奏清晰",
            media_type: MediaType::Audio,
            category: "abstract",
            ratio: "1:1",
            model: "织影音频 Pro",
        },
    ];
    let base = 1_749_000_000_000_i64;

    seeds
        .into_iter()
        .enumerate()
        .map(|(i, seed)| {
            let author = authors[i % authors.len()];
            MediaItemDto {
                id: format!("m_{:03}", i + 1),
                media_type: seed.media_type.clone(),
                asset_id: None,
                seed: format!("gallery-{i}-{}", seed.category),
                url: None,
                prompt: seed.prompt.to_string(),
                full_prompt: Some(build_gallery_full_prompt(seed.prompt, &seed.media_type)),
                model: seed.model.to_string(),
                category: seed.category.to_string(),
                aspect_ratio: seed.ratio.to_string(),
                resolution: None,
                author: AuthorDto {
                    id: author.0.to_string(),
                    name: author.1.to_string(),
                    avatar_seed: author.2.to_string(),
                },
                likes: 120 + ((i as i64 * 37) % 880),
                created_at: base - i as i64 * 1000 * 60 * 47,
                duration_sec: if matches!(seed.media_type, MediaType::Video | MediaType::Audio) {
                    Some(if seed.media_type == MediaType::Audio {
                        20 + (i as i64 % 3) * 10
                    } else {
                        4 + (i as i64 % 3) * 2
                    })
                } else {
                    None
                },
                source_mode: demo_source_mode(i),
                reference_count: demo_reference_count(i),
                has_first_frame: Some(seed.media_type == MediaType::Video && i % 4 == 0),
                has_last_frame: Some(seed.media_type == MediaType::Video && i % 5 == 0),
                visibility: Some(if i % 3 == 0 {
                    WorkVisibility::Gallery
                } else {
                    WorkVisibility::Private
                }),
                published_at: if i % 3 == 0 {
                    Some(base - i as i64 * 1000 * 60 * 42)
                } else {
                    None
                },
                favorited_at: None,
                downloaded_at: if i % 6 == 0 {
                    Some(base - i as i64 * 1000 * 60 * 12)
                } else {
                    None
                },
                demo: true,
            }
        })
        .collect()
}

fn demo_source_mode(index: usize) -> Option<SourceMode> {
    Some(match index % 7 {
        1 | 4 => SourceMode::Image,
        3 => SourceMode::Frames,
        5 => SourceMode::Video,
        6 => SourceMode::Audio,
        _ => SourceMode::Text,
    })
}

fn demo_reference_count(index: usize) -> Option<u32> {
    Some(match index % 7 {
        1 | 4 => 1,
        3 => 2,
        5 => 1,
        6 => 1,
        _ => 0,
    })
}

fn build_gallery_full_prompt(prompt: &str, media_type: &MediaType) -> String {
    match media_type {
        MediaType::Audio => [
            format!("Audio generation brief: {prompt}."),
            "Voice/music direction: clean production, stable dynamics, no clipping.".to_string(),
            "Delivery: natural pacing, polished mix, ready for commercial preview.".to_string(),
        ]
        .join("\n"),
        MediaType::Video => [
            "[Equipment] Cinema-grade virtual camera, shallow depth of field".to_string(),
            format!("[Scene] {prompt}"),
            "[Camera Movement] Slow dolly-in with subtle parallax, ending on a steady hero framing".to_string(),
            "[Lighting] Motivated cinematic lighting, soft key with rim separation, volumetric atmosphere".to_string(),
            "[Pacing] Smooth 24fps motion, no abrupt cuts, gentle easing on every move".to_string(),
            "[Color] Filmic color grade, balanced highlights and rich shadow detail".to_string(),
            "[Consistency] Preserve subject shape, proportion, and material across every frame. 720P, 9:16 ready.".to_string(),
        ]
        .join("\n"),
        MediaType::Image => [
            format!("Cinematic key visual: {prompt}."),
            "CRITICAL: preserve the subject's exact shape, color, texture, and every detail.".to_string(),
            "Composition: deliberate angles, strategic cropping, balanced negative space reserved for text overlay.".to_string(),
            "Lighting: studio-grade cinematic lighting with soft falloff and crisp specular highlights.".to_string(),
            "Finish: refined styled background, true-to-life materials, high micro-contrast, 8K resolution.".to_string(),
        ]
        .join("\n"),
    }
}

fn demo_generation_jobs() -> Vec<GenerationJobDto> {
    let gallery = demo_gallery();
    let image_items: Vec<_> = gallery
        .iter()
        .filter(|item| item.media_type == MediaType::Image)
        .cloned()
        .collect();
    let video_items: Vec<_> = gallery
        .iter()
        .filter(|item| item.media_type == MediaType::Video)
        .cloned()
        .collect();
    let audio_items: Vec<_> = gallery
        .iter()
        .filter(|item| item.media_type == MediaType::Audio)
        .cloned()
        .collect();
    let mut jobs = Vec::new();

    jobs.extend(demo_jobs_for_type(MediaType::Image, &image_items));
    jobs.extend(demo_jobs_for_type(MediaType::Video, &video_items));
    jobs.extend(demo_jobs_for_type(MediaType::Audio, &audio_items));
    jobs
}

fn demo_my_works(state: &AppState) -> Vec<MediaItemDto> {
    let user = state.demo_user();
    demo_gallery()
        .into_iter()
        .enumerate()
        .take(16)
        .map(|(index, item)| MediaItemDto {
            id: format!("my_{index}"),
            author: AuthorDto {
                id: user.id.clone(),
                name: user.name.clone(),
                avatar_seed: user.avatar_seed.clone(),
            },
            demo: true,
            ..item
        })
        .collect()
}

fn demo_jobs_for_type(media_type: MediaType, items: &[MediaItemDto]) -> Vec<GenerationJobDto> {
    if items.is_empty() {
        return Vec::new();
    }

    let groups: Vec<Vec<MediaItemDto>> = match media_type {
        MediaType::Image => vec![
            items.iter().take(4).cloned().collect(),
            items.iter().skip(4).take(1).cloned().collect(),
            items.iter().skip(12).take(3).cloned().collect(),
            items.iter().skip(15).take(2).cloned().collect(),
            items.iter().skip(18).take(2).cloned().collect(),
        ],
        MediaType::Video => vec![
            items.iter().take(2).cloned().collect(),
            items.iter().skip(2).take(1).cloned().collect(),
            items.iter().skip(3).take(2).cloned().collect(),
            items.iter().skip(5).take(1).cloned().collect(),
        ],
        MediaType::Audio => vec![
            items.iter().take(1).cloned().collect(),
            items.iter().skip(1).take(1).cloned().collect(),
        ],
    };

    groups
        .into_iter()
        .enumerate()
        .filter_map(|(index, results)| {
            let head = results.first()?.clone();
            Some(GenerationJobDto {
                id: format!("demo_{}_{index}", media_type_label(&media_type)),
                customer_id: None,
                entitlehub_job_id: None,
                media_type: media_type.clone(),
                status: JobStatus::Succeeded,
                progress: 100,
                prompt: head.prompt.clone(),
                model: head.model.clone(),
                aspect_ratio: head.aspect_ratio.clone(),
                resolution: head.resolution.clone(),
                count: results.len() as u32,
                created_at: head.created_at,
                updated_at: head.created_at,
                results,
                error: None,
                duration_sec: head.duration_sec.map(|duration| duration as u32),
                held_minor: 0,
                charged_minor: 0,
                idempotency_key: format!("demo-{}-{index}", media_type_label(&media_type)),
                source_mode: head.source_mode.clone(),
                reference_count: head.reference_count,
                has_first_frame: head.has_first_frame,
                has_last_frame: head.has_last_frame,
            })
        })
        .collect()
}

fn media_type_label(media_type: &MediaType) -> &'static str {
    match media_type {
        MediaType::Image => "image",
        MediaType::Video => "video",
        MediaType::Audio => "audio",
    }
}

fn demo_asset_folders() -> Vec<AssetFolderDto> {
    vec![
        AssetFolderDto {
            id: "reference".to_string(),
            name: "参考图".to_string(),
            kind: "image".to_string(),
            count: 24,
        },
        AssetFolderDto {
            id: "keyframes".to_string(),
            name: "首帧素材".to_string(),
            kind: "video".to_string(),
            count: 12,
        },
        AssetFolderDto {
            id: "audio_refs".to_string(),
            name: "参考音频".to_string(),
            kind: "audio".to_string(),
            count: 8,
        },
        AssetFolderDto {
            id: "styles".to_string(),
            name: "风格 LoRA".to_string(),
            kind: "style".to_string(),
            count: 6,
        },
        AssetFolderDto {
            id: "brand".to_string(),
            name: "品牌资产".to_string(),
            kind: "folder".to_string(),
            count: 18,
        },
    ]
}

fn demo_asset_items() -> Vec<AssetItemDto> {
    let folders = ["reference", "keyframes", "audio_refs", "styles", "brand"];
    (0..12)
        .map(|i| AssetItemDto {
            id: format!("mat_{i}"),
            seed: format!("material-{i}"),
            name: format!("素材_{:02}", i + 1),
            folder_id: folders[i as usize % folders.len()].to_string(),
            kind: if i % 3 == 1 {
                "video".to_string()
            } else if i % 5 == 2 {
                "audio".to_string()
            } else {
                "image".to_string()
            },
            url: None,
            thumbnail_url: None,
            mime_type: if i % 5 == 2 {
                Some("audio/mpeg".to_string())
            } else {
                None
            },
            file_size: None,
            status: Some("ready".to_string()),
            duration: if i % 3 == 1 || i % 5 == 2 {
                Some(8 + i as i64)
            } else {
                None
            },
            duration_sec: if i % 3 == 1 || i % 5 == 2 {
                Some(8 + i as i64)
            } else {
                None
            },
            duration_seconds: if i % 3 == 1 || i % 5 == 2 {
                Some(8 + i as i64)
            } else {
                None
            },
            role: None,
            source: Some("demo".to_string()),
            source_alias: Some("upload".to_string()),
            width: None,
            height: None,
        })
        .collect()
}

fn demo_style_presets() -> Vec<StylePresetDto> {
    vec![
        StylePresetDto {
            id: "none".to_string(),
            name: "无风格".to_string(),
            seed: "style-none".to_string(),
        },
        StylePresetDto {
            id: "cinematic".to_string(),
            name: "电影质感".to_string(),
            seed: "style-cinema".to_string(),
        },
        StylePresetDto {
            id: "ink".to_string(),
            name: "东方水墨".to_string(),
            seed: "style-ink".to_string(),
        },
        StylePresetDto {
            id: "cyberpunk".to_string(),
            name: "赛博朋克".to_string(),
            seed: "style-cyber".to_string(),
        },
        StylePresetDto {
            id: "film".to_string(),
            name: "胶片颗粒".to_string(),
            seed: "style-film".to_string(),
        },
        StylePresetDto {
            id: "3d".to_string(),
            name: "3D 渲染".to_string(),
            seed: "style-3d".to_string(),
        },
        StylePresetDto {
            id: "watercolor".to_string(),
            name: "水彩".to_string(),
            seed: "style-water".to_string(),
        },
        StylePresetDto {
            id: "lowpoly".to_string(),
            name: "低多边形".to_string(),
            seed: "style-poly".to_string(),
        },
    ]
}

fn progress_for_status(status: &JobStatus) -> u8 {
    match status {
        JobStatus::Queued => 12,
        JobStatus::Running => 55,
        JobStatus::Caching => 90,
        JobStatus::Succeeded => 100,
        JobStatus::Failed | JobStatus::Cancelled => 0,
        JobStatus::Review => 95,
    }
}
