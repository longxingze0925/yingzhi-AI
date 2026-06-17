use std::{collections::HashMap, sync::Arc};

use chrono::Utc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{
    config::AppConfig,
    entitlehub::EntitleHubClient,
    models::{AuthorDto, MediaItemDto, UserDto},
};

#[derive(Clone, Debug)]
pub struct UserSession {
    pub session_id: String,
    pub customer_id: String,
    pub email: String,
    pub name: String,
    pub expires_at: i64,
}

#[derive(Clone)]
pub struct AppState {
    pub config: AppConfig,
    pub entitlehub: EntitleHubClient,
    pub jobs: Arc<RwLock<HashMap<String, crate::models::GenerationJobDto>>>,
    pub works: Arc<RwLock<Vec<MediaItemDto>>>,
    pub sessions: Arc<RwLock<HashMap<String, UserSession>>>,
}

impl AppState {
    pub fn new(config: AppConfig) -> Self {
        Self {
            entitlehub: EntitleHubClient::new(config.clone()),
            config,
            jobs: Arc::new(RwLock::new(HashMap::new())),
            works: Arc::new(RwLock::new(Vec::new())),
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_session(&self, customer_id: String, email: String, name: String) -> UserSession {
        let session = UserSession {
            session_id: Uuid::new_v4().to_string(),
            customer_id,
            email,
            name,
            expires_at: now_millis() + self.config.session_ttl_seconds * 1000,
        };
        self.sessions
            .write()
            .await
            .insert(session.session_id.clone(), session.clone());
        session
    }

    pub async fn get_session(&self, session_id: &str) -> Option<UserSession> {
        let session = self.sessions.read().await.get(session_id).cloned();
        match session {
            Some(session) if session.expires_at > now_millis() => Some(session),
            Some(_) => {
                self.sessions.write().await.remove(session_id);
                None
            }
            None => None,
        }
    }

    pub async fn remove_session(&self, session_id: &str) {
        self.sessions.write().await.remove(session_id);
    }

    pub fn demo_user(&self) -> UserDto {
        UserDto {
            id: "u_001".to_string(),
            name: "林一川".to_string(),
            email: "creator@shadowweave.ai".to_string(),
            avatar_seed: "user-linyichuan".to_string(),
            plan: "专业版".to_string(),
            credits: 2480,
            credits_total: 3000,
            entitlehub_customer_id: self.config.demo_customer_id.clone(),
        }
    }

    pub fn user_from_session(&self, session: &UserSession) -> UserDto {
        UserDto {
            id: session.customer_id.clone(),
            name: if session.name.trim().is_empty() {
                session.email.clone()
            } else {
                session.name.clone()
            },
            email: session.email.clone(),
            avatar_seed: session.customer_id.clone(),
            plan: "EntitleHub".to_string(),
            credits: 0,
            credits_total: 0,
            entitlehub_customer_id: session.customer_id.clone(),
        }
    }

    pub fn demo_author(&self) -> AuthorDto {
        let user = self.demo_user();
        AuthorDto {
            id: user.id,
            name: user.name,
            avatar_seed: user.avatar_seed,
        }
    }
}

pub fn now_millis() -> i64 {
    Utc::now().timestamp_millis()
}
