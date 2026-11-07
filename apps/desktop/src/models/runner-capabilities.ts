import type { SettingsTarget } from "./topology";

export interface CodingAgentProvider { provider_id: string; name: string }
export interface CodingAgentInventory {
  client_id: string;
  connected: boolean;
  coding_agent_providers?: CodingAgentProvider[];
}
export interface CodingAgentProfile extends CodingAgentProvider {
  executable: string;
  args: string[];
  enabled: boolean;
  env_from_env: Record<string, string>;
  allowed_config_options: string[];
}
export interface AcpGlobalSettings { max_concurrent_runs: number; permission_timeout_secs: number }
export interface CodingAgentsSnapshot {
  revision: number;
  profiles: CodingAgentProfile[];
  global_settings: AcpGlobalSettings | null;
  restart_required: boolean;
  config_error: boolean;
  max_enabled: number;
}
export const EMPTY_CODING_AGENTS: CodingAgentsSnapshot = {
  revision: 0, profiles: [], global_settings: null, restart_required: false, config_error: false, max_enabled: 8,
};
export interface CodingAgentRequest {
  target: SettingsTarget;
  expected_revision: number;
  previous_id: string | null;
  profile: CodingAgentProfile;
  global_settings: AcpGlobalSettings | null;
}
export interface CodexPrepareRequest {
  target: SettingsTarget;
  expected_revision: number;
  python_bin?: string;
  codex_bin?: string;
  codex_args: string[];
  allow_network: boolean;
  expected_version?: string;
}
export interface PreparedCodexAgent {
  target: SettingsTarget;
  expected_revision: number;
  codex_version: string;
  profile: CodingAgentProfile;
}
export interface SshResource {
  name: string;
  source: "static" | "managed";
  active: boolean;
  pending_restart: boolean;
}
export type SshResourceError = "insufficient_scope" | "authorization_unavailable" | "runner_replaced"
  | "ssh_resource_registry_stale" | "ssh_resource_outcome_unknown" | "ssh_resource_registry_unavailable"
  | "ssh_resource_invalid" | "ssh_resource_static_read_only" | "ssh_resource_static_conflict"
  | "ssh_resource_name_conflict" | "ssh_resource_not_found" | "ssh_connection_setup_unsupported"
  | "ssh_connection_failed" | "ssh_authentication_failed" | "ssh_host_key_changed"
  | "ssh_host_key_stale" | "ssh_host_key_unavailable" | "ssh_program_unavailable"
  | "ssh_connection_timeout" | "ssh_identity_file_invalid" | "ssh_credentials_unavailable"
  | "ssh_client_permission_denied" | "ssh_connection_cancelled";
export interface RunnerCapabilityAuthorizationSnapshot {
  target: SettingsTarget;
  can_authorize: boolean;
  coding_agents: boolean;
  ssh_resources: boolean;
  permission_approval_granted: boolean;
  permission_approval_grant_available: boolean;
  detached_execution_granted: boolean;
  detached_execution_grant_available: boolean;
}
export interface SshResourcesSnapshot {
  runner: string;
  available: boolean;
  setup_supported?: boolean;
  observation_id: string | null;
  resources: SshResource[];
  error_kind: SshResourceError | null;
}
export interface SshMutationResult {
  success: boolean;
  error_kind: SshResourceError | null;
  restart_required: boolean;
  inventory: SshResourcesSnapshot;
}
export interface SshRegisterRequest {
  expected: SettingsTarget;
  observation_id: string;
  name: string;
  connection: SshConnection;
  default_cwd: string | null;
}
export interface SshEndpoint {
  host: string;
  port: number;
  user: string;
}
/** Write-only input. Never add authentication to an inventory or DesktopState. */
export type SshAuthentication = { type: "existing_environment" }
  | { type: "password"; password: string }
  | { type: "identity_file"; path: string; passphrase?: string };
export interface SshHostKeySelection { challenge_id: string; fingerprint: string }
export type SshConnection = { kind: "alias"; target: string }
  | { kind: "direct"; endpoint: SshEndpoint; authentication: SshAuthentication; host_key: SshHostKeySelection };
export interface SshInspectRequest {
  expected: SettingsTarget;
  observation_id: string;
  endpoint: SshEndpoint;
}
export interface SshHostKeyInspection {
  challenge_id: string;
  expires_at: number;
  host_keys: { algorithm: string; fingerprint: string }[];
}
export interface SshInspectionResult {
  success: boolean;
  error_kind: SshResourceError | null;
  inspection: SshHostKeyInspection | null;
}
export interface SshProbeRequest extends SshInspectRequest {
  authentication: SshAuthentication;
  host_key: SshHostKeySelection;
}
export interface SshProbeResult {
  success: boolean;
  error_kind: SshResourceError | null;
  verified: boolean;
}

/** Active is observed, never inferred from the Desktop manifest. */
export function codingAgentIsActive(profile: CodingAgentProvider, inventory: CodingAgentInventory | null): boolean {
  return Boolean(inventory?.connected && inventory.coding_agent_providers?.some(
    current => current.provider_id === profile.provider_id && current.name === profile.name,
  ));
}
