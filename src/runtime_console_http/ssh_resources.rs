//! Closed operator HTTP input. Credentials never pass through the model tool
//! adapter or its full-payload trace lifecycle.

use super::*;
use crate::ssh_resource_gateway::operator::{self, OperatorRequest};
use webcodex_core::ssh_resource::SSH_RESOURCE_REQUEST_MAX_BYTES;

async fn call<T: DeserializeOwned>(
    req: &mut Request,
    depot: &mut Depot,
    wrap: fn(T) -> OperatorRequest,
) -> ConsoleResult {
    let (runtime, auth) = prepared(req, depot).await?;
    // Repeat the route metadata gate at the handler boundary so neither an
    // alternate mount nor a future adapter can admit delegated model tokens.
    if !operator::authorized(&auth) {
        return Err(RuntimeConsoleError::Request {
            status: 403,
            message: "A first-party credential with SSH access is required",
        });
    }
    let input = req
        .payload_with_max_size(SSH_RESOURCE_REQUEST_MAX_BYTES)
        .await
        .ok()
        .and_then(|bytes| serde_json::from_slice::<T>(bytes).ok());
    // Serde errors can quote an offending string. Only a static diagnostic is
    // ever returned or retained, including malformed/oversized secret input.
    let result = match input {
        Some(input) => operator::invoke(&runtime, wrap(input), &auth).await,
        None => operator::invalid_input(),
    };
    serde_json::to_value(result)
        .map(Json)
        .map_err(|_| RuntimeConsoleError::Internal)
}

#[handler]
pub(super) async fn list(req: &mut Request, depot: &mut Depot) -> ConsoleResult {
    call::<operator::ListInput>(req, depot, OperatorRequest::List).await
}

#[handler]
pub(super) async fn inspect(req: &mut Request, depot: &mut Depot) -> ConsoleResult {
    call::<operator::InspectInput>(req, depot, OperatorRequest::Inspect).await
}

#[handler]
pub(super) async fn probe(req: &mut Request, depot: &mut Depot) -> ConsoleResult {
    call::<operator::ProbeInput>(req, depot, OperatorRequest::Probe).await
}

#[handler]
pub(super) async fn register(req: &mut Request, depot: &mut Depot) -> ConsoleResult {
    call::<operator::RegisterInput>(req, depot, OperatorRequest::Register).await
}

#[handler]
pub(super) async fn remove(req: &mut Request, depot: &mut Depot) -> ConsoleResult {
    call::<operator::RemoveInput>(req, depot, OperatorRequest::Remove).await
}
