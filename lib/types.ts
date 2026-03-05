export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  model: string;
  modelShort: string;
  workspaceDir: string;
  workspaceSizeMB: number | null;
  sessionsCount: number;
  lastUpdatedAt: number | null;
  lastActiveAgeMs: number | null;
  online: boolean;
  heartbeatEnabled: boolean;
  heartbeatEvery: string;
}

export interface SessionInfo {
  key: string;
  agentId: string;
  kind: string;
  sessionId: string;
  updatedAt: number;
  age: number;
  model: string;
  contextTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  remainingTokens: number;
  percentUsed: number;
  channel: string;
  displayName: string;
  messageCount?: number;
  sessionFile?: string;
  isFresh?: boolean;
}

export interface GatewayStatus {
  mode: string;
  url: string;
  reachable: boolean;
  connectLatencyMs: number;
  version: string;
  platform: string;
  host: string;
  ip: string;
  serviceRunning: boolean;
  servicePid?: number;
}

export interface ChannelHealth {
  name: string;
  configured: boolean;
  running: boolean;
  probeOk: boolean;
  botName?: string;
  lastError: string | null;
}

export interface SecurityFinding {
  checkId: string;
  severity: "critical" | "warn" | "info";
  title: string;
  detail: string;
}

export interface DashboardData {
  agents: AgentConfig[];
  sessions: SessionInfo[];
  gateway: GatewayStatus;
  channels: ChannelHealth[];
  securityFindings: SecurityFinding[];
  os: { platform: string; arch: string; label: string };
  update: { root: string; latestVersion: string };
  fetchedAt: number;
}
