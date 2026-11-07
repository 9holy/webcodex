//! Explicit operator grant for Desktop connections created before ACP/SSH UX.
//! This is account authorization, not an alternate SSH gateway. It requires
//! administrator/bootstrap authority and never accepts arbitrary scope names.
use super::*;
use crate::runtime_http::require_runtime;
#[cfg(test)]
use serde_json::Value;
use webcodex_core::authority::{SCOPE_CODING_AGENT_APPROVE, SCOPE_JOB_DETACH};
use webcodex_store::Database;

const CAPABILITY_STATUS_HEADER: &str = "x-webcodex-runner-capability-status";
const CAPABILITY_STATUS_DETACHED: &str = "detached-execution-v1";

/// Observe only this credential's bounded capability scopes. This is independent of
/// SSH/provider inventory and never changes a grant or contacts a Runner.
#[handler]
pub(crate) async fn runner_capability_authorization(
    req: &mut Request,
    depot: &mut Depot,
    res: &mut Response,
) {
    let Some(auth) = depot.obtain::<AuthContext>().ok() else {
        grant_error(res, StatusCode::UNAUTHORIZED);
        return;
    };
    if !auth.has_scope(crate::auth::SCOPE_RUNTIME_READ)
        || !matches!(
            auth.kind,
            crate::auth::AuthKind::Bootstrap
                | crate::auth::AuthKind::ApiToken
                | crate::auth::AuthKind::OAuth2Token
        )
    {
        grant_error(res, StatusCode::FORBIDDEN);
        return;
    }
    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct EmptyRequest {}
    let valid = req
        .payload_with_max_size(1024)
        .await
        .ok()
        .is_some_and(|bytes| serde_json::from_slice::<EmptyRequest>(bytes).is_ok());
    if !valid {
        grant_error(res, StatusCode::BAD_REQUEST);
        return;
    }
    let mut status = json!({
        "coding_agents": auth.has_scope(SCOPE_CODING_AGENT_RUN),
        "ssh_resources": auth.has_scope(SCOPE_SSH_LOCAL),
        "permission_approval": auth.has_scope(SCOPE_CODING_AGENT_APPROVE),
    });
    // Released Desktop clients reject unknown response fields. Negotiate this
    // read-only addition explicitly, without widening any credential or
    // changing the closed empty request accepted by older Servers.
    if req
        .headers()
        .get(CAPABILITY_STATUS_HEADER)
        .and_then(|value| value.to_str().ok())
        == Some(CAPABILITY_STATUS_DETACHED)
    {
        status["detached_execution"] = json!(auth.has_scope(SCOPE_JOB_DETACH));
    }
    res.render(Json(status));
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct GrantRequest {
    client_id: String,
    /// A native-only lookup; neither plaintext credential nor hash is returned.
    user_token_hash: String,
    /// Explicit independent opt-in. True selects only callback approval;
    /// omission preserves the existing SSH/Run grant and never adds approval.
    #[serde(default)]
    permission_approval: bool,
    /// Independent opt-in for Supervisor-owned background processes. It does
    /// not grant job:run, project access, or provider callback approval.
    #[serde(default)]
    detached_execution: bool,
}

#[derive(Clone, Copy)]
enum GrantSelection {
    RunnerExecution,
    PermissionApproval,
    DetachedExecution,
}

impl GrantRequest {
    fn selection(&self) -> Result<GrantSelection, StatusCode> {
        match (self.permission_approval, self.detached_execution) {
            (false, false) => Ok(GrantSelection::RunnerExecution),
            (true, false) => Ok(GrantSelection::PermissionApproval),
            (false, true) => Ok(GrantSelection::DetachedExecution),
            (true, true) => Err(StatusCode::BAD_REQUEST),
        }
    }
}

impl GrantSelection {
    fn scopes(self) -> &'static [&'static str] {
        match self {
            Self::RunnerExecution => &[SCOPE_SSH_LOCAL, SCOPE_CODING_AGENT_RUN],
            Self::PermissionApproval => &[SCOPE_CODING_AGENT_APPROVE],
            Self::DetachedExecution => &[SCOPE_JOB_DETACH],
        }
    }
}

#[handler]
pub(crate) async fn grant_runner_capabilities(
    req: &mut Request,
    depot: &mut Depot,
    res: &mut Response,
) {
    let Some(auth) = depot.obtain::<AuthContext>().ok().cloned() else {
        grant_error(res, StatusCode::UNAUTHORIZED);
        return;
    };
    if !auth.is_admin_caller()
        || !matches!(
            auth.kind,
            crate::auth::AuthKind::Bootstrap
                | crate::auth::AuthKind::ApiToken
                | crate::auth::AuthKind::OAuth2Token
        )
    {
        grant_error(res, StatusCode::FORBIDDEN);
        return;
    }
    let bytes = match req.payload_with_max_size(4096).await {
        Ok(bytes) => bytes,
        Err(_) => {
            grant_error(res, StatusCode::BAD_REQUEST);
            return;
        }
    };
    let body = match serde_json::from_slice::<GrantRequest>(bytes) {
        Ok(body)
            if validate_allowed_client_id(&body.client_id).is_ok_and(|id| id == body.client_id)
                && body.user_token_hash.len() == 64
                && body
                    .user_token_hash
                    .bytes()
                    .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) =>
        {
            body
        }
        _ => {
            grant_error(res, StatusCode::BAD_REQUEST);
            return;
        }
    };
    let selection = match body.selection() {
        Ok(selection) => selection,
        Err(status) => {
            grant_error(res, status);
            return;
        }
    };
    let Some(db) = crate::get_db(depot) else {
        grant_error(res, StatusCode::INTERNAL_SERVER_ERROR);
        return;
    };
    let Some(runtime) = require_runtime(depot, res) else {
        return;
    };
    let owner = runtime
        .query_runner_inventory(
            Some(&auth),
            &crate::tool_runtime::ListRunnersOptions {
                client_id: Some(body.client_id.clone()),
                summary_only: true,
                ..Default::default()
            },
        )
        .await
        .ok()
        .and_then(|page| page.runners.into_iter().next())
        .filter(|row| row.client.connected)
        .and_then(|row| row.client.owner);
    let Some(owner) = owner else {
        grant_error(res, StatusCode::CONFLICT);
        return;
    };
    match grant_for_owner(
        &db,
        &body.user_token_hash,
        &owner,
        chrono::Utc::now().timestamp(),
        selection,
    ) {
        Ok(changed) => res.render(Json(json!({
            "success":true, "changed":changed,
            "applied_scopes": selection.scopes(),
        }))),
        Err(status) => grant_error(res, status),
    }
}

fn grant_for_owner(
    db: &Database,
    token_hash: &str,
    runner_owner: &str,
    now: i64,
    selection: GrantSelection,
) -> Result<bool, StatusCode> {
    let key = db
        .get_api_key_by_hash(token_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter(|key| {
            key.kind == TOKEN_KIND_USER
                && key.allowed_client_id.is_none()
                && key.revoked_at.is_none()
                && key.expires_at.is_none_or(|expires| expires > now)
        })
        .ok_or(StatusCode::FORBIDDEN)?;
    let user = db
        .get_user_by_id(&key.user_id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .filter(|user| !user.is_disabled() && user.username == runner_owner)
        .ok_or(StatusCode::FORBIDDEN)?;
    let mut scopes: Vec<String> = key
        .scopes
        .split_ascii_whitespace()
        .map(str::to_owned)
        .collect();
    let before = scopes.len();
    for &scope in selection.scopes() {
        if !scopes.iter().any(|existing| existing == scope) {
            scopes.push(scope.to_owned());
        }
    }
    if scopes.len() == before {
        return Ok(false);
    }
    if db
        .compare_and_swap_user_key_scopes(
            &key.id,
            &user.id,
            &key.scopes,
            &scopes_to_string(&scopes),
            now,
        )
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    {
        Ok(true)
    } else {
        Err(StatusCode::CONFLICT)
    }
}

fn grant_error(res: &mut Response, status: StatusCode) {
    res.status_code(status);
    // Never echo a credential, hash, path, owner or raw parser/database error.
    res.render(json_error(status, "Runner capability grant was not applied; verify local operator authority and refresh this connection"));
}

#[cfg(test)]
mod tests;
