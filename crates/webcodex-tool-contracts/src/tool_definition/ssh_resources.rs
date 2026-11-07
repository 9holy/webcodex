use super::ToolVisibility::ModelVisible;
use super::{def, model_spec, ToolDefinition, TOOL_CATEGORY_RUNTIME};
use crate::metadata::{
    ToolPathHint::None as NoPath, ToolRisk::RunControl, SSH_LOCAL, TOOL_PROVIDER_CONTROL,
};

pub(super) const DEFINITIONS: &[ToolDefinition] = &[model_spec(
    def(
        "manage_ssh_resource",
        super::ToolAuditPolicy::TYPED_CANONICAL,
        ModelVisible,
        TOOL_CATEGORY_RUNTIME,
        None,
        TOOL_PROVIDER_CONTROL,
        super::ToolSemanticContract {
            effect: super::ToolEffect::Mutate,
            risk: RunControl,
            approval: super::ToolApprovalPolicy::Standard,
            idempotency: super::ToolIdempotency::FencedReplay,
        },
        Some(SSH_LOCAL),
        false,
        NoPath,
        true,
        false,
        super::ToolSessionEvidencePolicy::NONE,
    ),
    "Discover and manage Runner-local named SSH resources for remote run_shell/run_job or stateful open_session_shell. Start with action=list on one exact Runner; register/remove require its opaque revision binding and ssh:local authority. register accepts an explicit destination already usable by that Runner's OpenSSH environment. For a new host requiring a password, private-key passphrase, or first-use host-key confirmation, the operator configures it in Desktop Extensions > SSH resources; never request or pass those secrets through Chat or this tool. After saving a resource that requires restart, restart that Runner, list again, and bind the active logical name with update_session_context. Use run_shell/run_job for commands on that resource, or discover open_session_shell/execute_session_shell when remote shell state must persist. run_process does not consume managed-resource credentials. Loaded configuration does not prove a current successful login. Targets and authentication details are never returned; an uncertain mutation must be observed before any explicit retry.",
)];
