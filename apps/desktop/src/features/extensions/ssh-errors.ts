import type { RunnerCapabilitiesKey } from "../../i18n/runner-capabilities";
import type { SshConnectionMessage } from "../../i18n/ssh-connections";
import type { SshResourceError } from "../../models/runner-capabilities";

export function sshErrorText(error: SshResourceError,
  resource: (key: RunnerCapabilitiesKey) => string,
  connection: (key: SshConnectionMessage) => string): string {
  switch (error) {
    case "ssh_resource_outcome_unknown": return resource("uncertain");
    case "runner_replaced": case "ssh_resource_registry_stale": case "ssh_resource_not_found": return resource("refreshNeeded");
    case "ssh_resource_name_conflict": case "ssh_resource_static_conflict": return resource("nameConflict");
    case "ssh_resource_static_read_only": return resource("readOnly");
    case "insufficient_scope": return resource("permissionNeeded");
    case "ssh_resource_invalid": return connection("invalidFields");
    case "ssh_connection_setup_unsupported": return connection("operatorUnavailable");
    case "ssh_authentication_failed": return connection("authenticationFailed");
    case "ssh_host_key_changed": return connection("hostKeyChanged");
    case "ssh_host_key_stale": return connection("trustExpired");
    case "ssh_program_unavailable": return connection("clientUnavailable");
    case "ssh_identity_file_invalid": return connection("identityInvalid");
    case "ssh_credentials_unavailable": return connection("credentialsUnavailable");
    case "ssh_client_permission_denied": return connection("clientPermissionDenied");
    case "ssh_connection_cancelled": return connection("connectionCancelled");
    case "ssh_host_key_unavailable": return connection("hostKeyUnavailable");
    case "ssh_connection_failed": case "ssh_connection_timeout": return connection("connectionFailed");
    default: return resource("sshUnavailable");
  }
}
