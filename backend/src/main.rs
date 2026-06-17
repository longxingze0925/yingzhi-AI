mod config;
mod entitlehub;
mod error;
mod models;
mod routes;
mod state;

use config::AppConfig;
use state::AppState;
use tower_http::{
    cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
                "shadowweave_backend=debug,backend=debug,tower_http=info".into()
            }),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = AppConfig::from_env();
    let bind_addr = config.bind_addr;
    let mock_entitlehub = config.mock_entitlehub;
    let state = AppState::new(config);

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::mirror_request())
        .allow_methods(AllowMethods::mirror_request())
        .allow_headers(AllowHeaders::mirror_request())
        .allow_credentials(true);

    let app = routes::router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let listener = tokio::net::TcpListener::bind(bind_addr)
        .await
        .expect("failed to bind backend address");
    info!(%bind_addr, mock_entitlehub, "shadowweave backend listening");

    axum::serve(listener, app)
        .await
        .expect("backend server stopped unexpectedly");
}
