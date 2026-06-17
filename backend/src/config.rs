use std::{env, net::SocketAddr};

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub bind_addr: SocketAddr,
    pub entitlehub_base_url: Option<String>,
    pub entitlehub_server_key: Option<String>,
    pub demo_customer_id: String,
    pub mock_entitlehub: bool,
    pub session_cookie_name: String,
    pub session_ttl_seconds: i64,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let port = env::var("PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(18777);
        let bind_addr = format!("{host}:{port}")
            .parse()
            .expect("HOST/PORT must form a valid socket address");

        let entitlehub_base_url = env::var("ENTITLEHUB_BASE_URL")
            .ok()
            .filter(|v| !v.trim().is_empty());
        let entitlehub_server_key = env::var("ENTITLEHUB_SERVER_KEY")
            .ok()
            .filter(|v| !v.trim().is_empty());

        let mock_entitlehub = env::var("ENTITLEHUB_MOCK")
            .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or_else(|_| entitlehub_base_url.is_none() || entitlehub_server_key.is_none());

        Self {
            bind_addr,
            entitlehub_base_url,
            entitlehub_server_key,
            demo_customer_id: env::var("DEMO_ENTITLEHUB_CUSTOMER_ID")
                .unwrap_or_else(|_| "00000000-0000-0000-0000-000000000001".to_string()),
            mock_entitlehub,
            session_cookie_name: env::var("SHADOWWEAVE_SESSION_COOKIE")
                .unwrap_or_else(|_| "shadowweave_session".to_string()),
            session_ttl_seconds: env::var("SHADOWWEAVE_SESSION_TTL_SECONDS")
                .ok()
                .and_then(|v| v.parse::<i64>().ok())
                .unwrap_or(60 * 60 * 24 * 7),
        }
    }
}
