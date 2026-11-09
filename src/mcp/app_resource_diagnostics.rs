//! Payload-free observations of static App resource delivery, not proof that
//! the Host mounted the App or received its initialization acknowledgement.
use super::{app_registry, protocol, resources, JsonRpcRequest, McpOutcome, McpProtocolEra};
use crate::action_audit::{ActionAudit, ActionAuditRecord};
use salvo::prelude::*;
use serde_json::json;

pub(super) struct AppResourceAudit {
    observation: Option<(ActionAudit, String, &'static str)>,
    ui_capability_present: bool,
}

impl AppResourceAudit {
    pub fn start(req: &Request, depot: &Depot, request: &JsonRpcRequest) -> Self {
        let observation = (request.method == "resources/read" && request.id.is_some())
            .then(|| request.params.get("uri").and_then(|uri| uri.as_str()))
            .flatten()
            .and_then(|uri| {
                app_registry::for_diagnostic_uri(uri).map(|app| {
                    (
                        ActionAudit::start(req, depot, "/mcp", "resourcesRead"),
                        uri.to_string(),
                        app.uri,
                    )
                })
            });
        Self {
            observation,
            ui_capability_present: resources::request_supports_mcp_apps(&request.params),
        }
    }

    pub fn record(
        &self,
        protocol_era: &str,
        status: StatusCode,
        mcp_error_code: Option<i64>,
        outcome_stage: &'static str,
    ) {
        let Some((audit, uri, current_uri)) = self.observation.as_ref() else {
            return;
        };
        // Preserve the existing Computer diagnostic event for its consumers.
        let computer = uri.as_str() == app_registry::MCP_COMPUTER_UI_RESOURCE_URI;
        let operation = if computer {
            "computer_app_resource_read"
        } else {
            "mcp_app_resource_read"
        };
        tracing::info!(
            target: "webcodex::mcp",
            uri,
            current_resource_uri = current_uri,
            protocol_era,
            ui_capability_present = self.ui_capability_present,
            http_status = status.as_u16(),
            mcp_error_code = mcp_error_code.unwrap_or(-1),
            outcome_stage,
            "{}",
            if computer { "mcp_computer_app_resource_delivery" } else { "mcp_app_resource_delivery" },
        );
        audit.record(
            ActionAuditRecord::new(
                operation,
                status.is_success() && mcp_error_code.is_none(),
                status,
            )
            .summary(json!({
                "transport": "mcp",
                "resource_uri": uri,
                "resource_version": uri.rsplit('/').next().unwrap_or("unknown"),
                "current_resource_uri": current_uri,
                "resource_registered": uri.as_str() == *current_uri,
                "protocol_era": protocol_era,
                "ui_capability_present": self.ui_capability_present,
                "mcp_error_code": mcp_error_code,
                "outcome_stage": outcome_stage,
            })),
        );
    }

    pub fn record_outcome(&self, era: McpProtocolEra, outcome: &McpOutcome) {
        let (status, code) = match outcome {
            McpOutcome::Ok(_) | McpOutcome::ArtifactExportStream { .. } => (StatusCode::OK, None),
            McpOutcome::BadRequest(body) => {
                (StatusCode::BAD_REQUEST, body["error"]["code"].as_i64())
            }
            McpOutcome::NotFound(body) => (StatusCode::NOT_FOUND, body["error"]["code"].as_i64()),
            McpOutcome::Forbidden { .. } => (StatusCode::FORBIDDEN, None),
            McpOutcome::Notification => (StatusCode::ACCEPTED, None),
        };
        self.record(protocol::era_label(era), status, code, "response");
    }
}

#[cfg(test)]
mod tests {
    use super::app_registry;

    #[test]
    fn app_resource_diagnostics_only_classify_bounded_registry_families() {
        for uri in [
            app_registry::MCP_WORK_RESULT_UI_RESOURCE_URI,
            "ui://webcodex/work-result/v1",
        ] {
            assert!(app_registry::for_diagnostic_uri(uri).is_some());
        }
        assert!(app_registry::for_uri("ui://webcodex/work-result/v1").is_none());
        for uri in [
            "ui://webcodex/work-result/v1?token=private",
            "ui://webcodex/work-result/v1#private",
            "ui://webcodex/work-result/v1/private",
            "ui://webcodex/work-result/v0001",
            "ui://webcodex/work-result/v10000",
            "ui://webcodex/work-result/v0",
            "ui://webcodex/private/v1",
            "file:///private/project",
            "webcodex-artifact://export/private",
        ] {
            assert!(app_registry::for_diagnostic_uri(uri).is_none(), "{uri}");
        }
    }
}
