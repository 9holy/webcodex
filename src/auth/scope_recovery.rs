//! Recovery guidance for an already-rejected scope check. This module never
//! grants authority, retries a tool, or derives permissions from task text.

use super::{AuthContext, AuthKind};
use webcodex_core::authority::{
    SCOPE_CODING_AGENT_APPROVE, SCOPE_CODING_AGENT_RUN, SCOPE_JOB_DETACH, SCOPE_SSH_LOCAL,
};

/// One bounded, non-secret explanation shared by REST and MCP. The distinction
/// between the connection credential and the Runner/remote account is material:
/// granting WebCodex scopes cannot sign in to GitHub or grant remote sudo rights.
pub(crate) fn scope_recovery_hint(
    auth: Option<&AuthContext>,
    required_scope: Option<&str>,
) -> &'static str {
    let Some(auth) = auth else {
        return "Connect with an authorized WebCodex credential, then retry after the connection has been updated.";
    };
    if auth.is_project_scoped_model_subject() {
        return "Ask the project credential issuer to review this grant and issue an authorized credential; the current project credential cannot expand its own permissions.";
    }
    if auth.is_shared_key() || auth.is_oauth_shared_key_subject() {
        return "Check the shared-key connection identity and its fixed permission profile; use an authorized managed-user credential if this operation is outside that profile.";
    }
    if required_scope.is_none() {
        return "Review the original denial and the required connection type. Some operations require a first-party operator or bootstrap credential, or one of several explicit scopes. Reauthorization alone cannot change a credential's permitted interface; this fixed token or connection must satisfy that interface's policy.";
    }
    if auth.is_oauth_token() {
        return if super::oauth_scope_denial_is_delegable(required_scope) {
            "Reconnect or reauthorize this WebCodex connection with the required scope. The OAuth client's allowed scopes and the authorizing user credential must both permit it; if either is missing, the operator must update it before consent. Desktop Cloudflare connections expose this under Connections > Configure OAuth, with explicit credential replacement and Chat reauthorization. Retry only after the connection grant changes."
        } else {
            "This authority cannot be added through OAuth. Use the first-party operator interface with an appropriately authorized managed-user credential."
        };
    }
    if matches!(auth.kind, AuthKind::ApiToken) {
        return match required_scope {
            Some(SCOPE_JOB_DETACH) => "For a Desktop-managed local connection, authorize Long-running background processes in Settings > Files & permissions. For other connections, have the issuer replace this fixed token with one containing job:detach. Reconnect Chat if it uses a separate credential, then retry; job:run alone does not authorize detached processes.",
            Some(SCOPE_SSH_LOCAL) => "For a Desktop-managed local connection, select Authorize Runner capabilities in Extensions > SSH resources. For other connections, have the issuer replace this fixed token with one containing ssh:local. Reconnect Chat if it uses a separate credential. Configure the server login in the SSH panel; WebCodex scope and SSH account authentication are separate.",
            Some(SCOPE_CODING_AGENT_RUN) => "For a Desktop-managed local connection, authorize Coding agents in Extensions > Coding agents. For other connections, have the issuer replace this fixed token with one containing coding_agent:run. Reconnect Chat if it uses a separate credential. The provider must also be configured, signed in, enabled, and loaded by the Runner.",
            Some(SCOPE_CODING_AGENT_APPROVE) => "Authorize Coding agent approvals separately in the Desktop Coding agents panel, or have the issuer replace this fixed token with one containing coding_agent:approve. Reconnect Chat if it uses a separate credential. A callback still requires an explicit decision; coding_agent:run alone cannot approve it.",
            _ => "Use a token issued with the required scope; this fixed token cannot add scopes through OAuth. Check get_runtime_status authorization for the current connection and reconnect after its issuer updates the grant.",
        };
    }
    "Check the current connection identity and permissions; use an authorized managed-user credential. Runner transport and account-management credentials do not authorize model tool execution."
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixed_scope_recovery_names_reachable_explicit_authorization() {
        let auth = AuthContext::new(AuthKind::ApiToken);
        for (scope, entry) in [
            (SCOPE_JOB_DETACH, "Settings > Files & permissions"),
            (SCOPE_SSH_LOCAL, "Extensions > SSH"),
            (SCOPE_CODING_AGENT_RUN, "Extensions > Coding agents"),
            (SCOPE_CODING_AGENT_APPROVE, "approvals separately"),
        ] {
            let hint = scope_recovery_hint(Some(&auth), Some(scope));
            assert!(hint.contains(entry), "{hint}");
            assert!(hint.contains("fixed token"));
            assert!(hint.contains("separate credential"));
            assert!(!auth.has_scope(scope));
        }
    }

    #[test]
    fn scope_recovery_keeps_project_and_shared_subjects_out_of_owner_grants() {
        let mut bridge = AuthContext::new(AuthKind::OAuth2Token);
        bridge.token_kind = Some("oauth2_shared_key".into());
        for auth in [AuthContext::new(AuthKind::SharedKey), bridge] {
            let hint = scope_recovery_hint(Some(&auth), Some(SCOPE_JOB_DETACH));
            assert!(hint.contains("fixed permission profile"));
            assert!(!hint.contains("Settings"));
            assert!(!auth.has_scope(SCOPE_JOB_DETACH));
        }
        let mut project_oauth = AuthContext::new(AuthKind::OAuth2Token);
        project_oauth.token_kind = Some(super::super::PROJECT_SHARE_OAUTH_TOKEN_KIND.into());
        project_oauth.project_grant_id = Some("private-grant-not-for-output".into());
        for auth in [AuthContext::new(AuthKind::ProjectCredential), project_oauth] {
            let hint = scope_recovery_hint(Some(&auth), Some(SCOPE_SSH_LOCAL));
            assert!(hint.contains("project credential issuer"));
            assert!(!hint.contains("private-grant"));
            assert!(!hint.contains("Settings"));
        }
    }

    #[test]
    fn oauth_scope_recovery_matches_delegation_without_exposing_identity() {
        let mut auth = AuthContext::new(AuthKind::OAuth2Token);
        auth.username = Some("private-user-not-for-output".into());
        auth.api_key_id = Some("private-key-id-not-for-output".into());
        let hint = scope_recovery_hint(Some(&auth), Some(SCOPE_JOB_DETACH));
        assert!(hint.contains("Reconnect or reauthorize"));
        let operator = scope_recovery_hint(Some(&auth), Some(super::super::SCOPE_ADMIN));
        assert!(operator.contains("cannot be added through OAuth"));
        assert!(!hint.contains("private-"));
        assert!(!operator.contains("private-"));
        assert!(!auth.has_scope(SCOPE_JOB_DETACH));
    }

    #[test]
    fn unqualified_denials_do_not_promise_oauth_can_enter_operator_routes() {
        let auth = AuthContext::new(AuthKind::OAuth2Token);
        let body = super::super::scope_forbidden_body(
            Some(&auth),
            None,
            "first-party operator credential required",
        );
        assert_eq!(body["error"], "insufficient_scope");
        assert_eq!(body["execution_started"], false);
        assert!(body.get("missing_scope").is_none());
        assert!(body["recovery"]
            .as_str()
            .unwrap()
            .contains("first-party operator"));
        assert!(!body["recovery"]
            .as_str()
            .unwrap()
            .contains("Reconnect or reauthorize"));
    }

    #[test]
    fn scope_denial_body_preserves_original_error_and_adds_safe_recovery() {
        for kind in [AuthKind::ApiToken, AuthKind::OAuth2Token] {
            let auth = AuthContext::new(kind);
            let body = super::super::scope_forbidden_body(
                Some(&auth),
                Some(SCOPE_JOB_DETACH),
                "missing required scope: job:detach",
            );
            assert_eq!(body["error_kind"], "insufficient_scope");
            assert_eq!(body["missing_scope"], SCOPE_JOB_DETACH);
            assert_eq!(body["execution_started"], false);
            assert!(body["recovery"].is_string());
            if kind == AuthKind::OAuth2Token {
                assert_eq!(body["error"], "insufficient_scope");
                assert_eq!(
                    body["error_description"],
                    "missing required scope: job:detach"
                );
            } else {
                assert_eq!(body["status"], 403);
                assert_eq!(body["error"], "missing required scope: job:detach");
            }
            assert!(!auth.has_scope(SCOPE_JOB_DETACH));
        }
    }
}
