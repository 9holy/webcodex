//! Rejection-only guidance for concrete stale Host artifact-transfer callers.
//!
//! These hints are not aliases, schema translations, or admission decisions.
//! Only named retired callers receive guidance; ordinary unknown-tool errors stay stable.

pub fn retired_artifact_tool_hint(name: &str) -> Option<&'static str> {
    match name {
        "import_conversation_files_to_project" => Some(
            "refresh tools/list (reconnect the MCP client after a Server upgrade if its tool catalog is stale). The current replacement is import_host_files; use its current advertised schema and normal authorization. Do not replay the retired arguments unchanged.",
        ),
        "export_project_artifact" => Some(
            "refresh tools/list (reconnect the MCP client after a Server upgrade if its tool catalog is stale). The current replacement is inspect_project_artifact with action='export'; use its current advertised schema and normal authorization. Do not replay the retired arguments unchanged.",
        ),
        _ => None,
    }
}
