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
    #[error("{0}")]
    Internal(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorBody {
    code: &'static str,
    message: String,
}

pub type ApiResult<T> = Result<T, ApiError>;

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message) = match self {
            ApiError::Unauthenticated { code, message } => {
                (StatusCode::UNAUTHORIZED, code, message)
            }
            ApiError::BadRequest { code, message } => (StatusCode::BAD_REQUEST, code, message),
            ApiError::NotFound { code, message } => (StatusCode::NOT_FOUND, code, message),
            ApiError::Upstream { code, message } => (StatusCode::BAD_GATEWAY, code, message),
            ApiError::Internal(message) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", message)
            }
        };

        (status, Json(ErrorBody { code, message })).into_response()
    }
}

impl From<reqwest::Error> for ApiError {
    fn from(err: reqwest::Error) -> Self {
        ApiError::Upstream {
            code: "ENTITLEHUB_REQUEST_FAILED",
            message: err.to_string(),
        }
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::Upstream {
            code: "ENTITLEHUB_RESPONSE_INVALID",
            message: err.to_string(),
        }
    }
}
