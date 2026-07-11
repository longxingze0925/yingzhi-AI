use std::{env, net::SocketAddr};

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub bind_addr: SocketAddr,
    pub aisaas_base_url: Option<String>,
    pub aisaas_server_key: Option<String>,
    pub demo_customer_id: String,
    pub mock_aisaas: bool,
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

        let aisaas_base_url = env_non_empty("AISAAS_BASE_URL");
        let aisaas_server_key = env_non_empty("AISAAS_SERVER_KEY");

        let mock_aisaas = env_bool("AISAAS_MOCK")
            .unwrap_or_else(|| aisaas_base_url.is_none() || aisaas_server_key.is_none());

        Self {
            bind_addr,
            aisaas_base_url,
            aisaas_server_key,
            demo_customer_id: env_non_empty("DEMO_AISAAS_CUSTOMER_ID")
                .unwrap_or_else(|| "00000000-0000-0000-0000-000000000001".to_string()),
            mock_aisaas,
            session_cookie_name: env::var("SHADOWWEAVE_SESSION_COOKIE")
                .unwrap_or_else(|_| "shadowweave_session".to_string()),
            session_ttl_seconds: env::var("SHADOWWEAVE_SESSION_TTL_SECONDS")
                .ok()
                .and_then(|v| v.parse::<i64>().ok())
                .unwrap_or(60 * 60 * 24 * 7),
        }
    }
}

fn env_non_empty(name: &str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.trim().is_empty())
}

fn env_bool(name: &str) -> Option<bool> {
    env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
}
