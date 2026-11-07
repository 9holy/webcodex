use super::*;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct InventoryInput {}

#[handler]
pub(super) async fn list(req: &mut Request, depot: &mut Depot) -> ConsoleResult {
    let (runtime, auth) = prepared(req, depot).await?;
    if crate::tool_runtime::kernel::check_runtime_tool_scope(Some(&auth), "observe_coding_agent")
        .is_err()
    {
        return Err(RuntimeConsoleError::Request {
            status: 403,
            message: "Coding Agent access required",
        });
    }
    let _: InventoryInput = parse_console_json(req).await?;
    let inventory = runtime
        .coding_agent_operator_inventory(&auth)
        .await
        .map_err(|_| RuntimeConsoleError::Request {
            status: 403,
            message: "A stable Coding Agent identity is required",
        })?;
    serde_json::to_value(inventory)
        .map(Json)
        .map_err(|_| RuntimeConsoleError::Internal)
}
