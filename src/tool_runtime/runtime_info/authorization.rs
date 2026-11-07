//! Bounded current-caller diagnostics, never a replacement for authorization.

use crate::auth::{AuthContext, AuthKind};
use serde::Serialize;
use serde_json::{json, Value};
use webcodex_core::authority::KNOWN_SCOPES;

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
enum CredentialKind {
    None,
    Bootstrap,
    ApiToken,
    AgentToken,
    AccountCredential,
    Oauth2Token,
    SharedKey,
    ProjectCredential,
    OpenAnonymous,
}

#[derive(Serialize)]
struct CallerAuthorization {
    credential_kind: CredentialKind,
    granted_scopes: Vec<&'static str>,
}

/// Project only the current request's credential class and materialized known
/// scopes. Iterating the canonical vocabulary bounds and deduplicates the output
/// without serializing unknown scope text or any principal/token identifiers.
/// `admin` remains a single super-scope, not an expanded grant. In particular,
/// auth-disabled metadata or a missing context never implies bootstrap authority.
pub(super) fn caller_authorization(auth: Option<&AuthContext>) -> Value {
    let credential_kind = match auth.map(|auth| auth.kind) {
        None => CredentialKind::None,
        Some(AuthKind::Bootstrap) => CredentialKind::Bootstrap,
        Some(AuthKind::ApiToken) => CredentialKind::ApiToken,
        Some(AuthKind::AgentToken) => CredentialKind::AgentToken,
        Some(AuthKind::AccountCredential) => CredentialKind::AccountCredential,
        Some(AuthKind::OAuth2Token) => CredentialKind::Oauth2Token,
        Some(AuthKind::SharedKey) => CredentialKind::SharedKey,
        Some(AuthKind::ProjectCredential) => CredentialKind::ProjectCredential,
        Some(AuthKind::OpenAnonymous) => CredentialKind::OpenAnonymous,
    };
    let granted_scopes = auth.map_or_else(Vec::new, |auth| {
        KNOWN_SCOPES
            .iter()
            .copied()
            .filter(|scope| auth.scopes.iter().any(|granted| granted.as_str() == *scope))
            .collect()
    });
    json!(CallerAuthorization {
        credential_kind,
        granted_scopes,
    })
}
