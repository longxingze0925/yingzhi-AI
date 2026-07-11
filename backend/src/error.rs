use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("{message}")]
    Unauthenticated { code: &'static str, message: String },
    #[error("{message}")]
    BadRequest { code: &'static str, message: String },
    #[error("{message}")]
    NotFound { code: &'static str, message: String },
    #[error("{message}")]
    Upstream { code: &'static str, message: String },
    #[error("{message}")]
    UpstreamResponse {
        status: StatusCode,
        code: String,
        message: String,
        request_id: Option<String>,
        upstream_status: Option<u16>,
    },
    #[error("{0}")]
    Internal(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorBody {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    upstream_status: Option<u16>,
}

pub type ApiResult<T> = Result<T, ApiError>;

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message, request_id, upstream_status) = match self {
            ApiError::Unauthenticated { code, message } => (
                StatusCode::UNAUTHORIZED,
                code.to_string(),
                message,
                None,
                None,
            ),
            ApiError::BadRequest { code, message } => (
                StatusCode::BAD_REQUEST,
                code.to_string(),
                message,
                None,
                None,
            ),
            ApiError::NotFound { code, message } => {
                (StatusCode::NOT_FOUND, code.to_string(), message, None, None)
            }
            ApiError::Upstream { code, message } => (
                StatusCode::BAD_GATEWAY,
                code.to_string(),
                message,
                None,
                None,
            ),
            ApiError::UpstreamResponse {
                status,
                code,
                message,
                request_id,
                upstream_status,
            } => (status, code, message, request_id, upstream_status),
            ApiError::Internal(message) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR".to_string(),
                message,
                None,
                None,
            ),
        };

        (
            status,
            Json(ErrorBody {
                code,
                message,
                request_id,
                upstream_status,
            }),
        )
            .into_response()
    }
}

impl From<reqwest::Error> for ApiError {
    fn from(err: reqwest::Error) -> Self {
        ApiError::Upstream {
            code: "AISAAS_REQUEST_FAILED",
            message: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::Upstream {
            code: "AISAAS_RESPONSE_INVALID",
            message: err.to_string(),
        }
    }
}
