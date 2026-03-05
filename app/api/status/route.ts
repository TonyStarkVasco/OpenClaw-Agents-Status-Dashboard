import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";
import type { DashboardData, AgentConfig, SessionInfo, GatewayStatus, ChannelHealth, SecurityFinding } from "@/lib/types";

const execAsync = promisify(exec);

const AGENT_ROLES: Record<string, string> = {
  madaga:   "CEO / Orchestrator",
  gary:     "Marketing",
  steven:   "Dev",
  samantha: "Ops",
  juliano:  "Ventas",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HOME = process.env.HOME || "/Users/tonystark";

function getModelShort(modelStr: string): string {
  if (!modelStr) return "?";
  if (modelStr.includes("opus"))   return "Opus";
  if (modelStr.includes("sonnet")) return "Sonnet";
  if (modelStr.includes("haiku"))  return "Haiku";
  return modelStr.split("/").pop()?.split("-")[0] || "?";
}

interface OpenClawConfig {
  agents: { id: string; name: string; model?: string; workspace?: string }[];
  defaultModel: string;
}

/** Read agent list + models directly from openclaw.json */
function readConfig(): OpenClawConfig {
  const result: OpenClawConfig = { agents: [], defaultModel: "anthropic/claude-sonnet-4-6" };
  try {
    const raw = readFileSync(`${HOME}/.openclaw/openclaw.json`, "utf8");
    const cfg = JSON.parse(raw);
    result.defaultModel =
      cfg?.agents?.defaults?.model?.primary ||
      cfg?.agents?.defaults?.model ||
      "anthropic/claude-sonnet-4-6";
    result.agents = (cfg?.agents?.list || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      model: a.model || result.defaultModel,
      workspace: a.workspace,
    }));
  } catch {}
  return result;
}

interface DiskSession {
  key: string;
  sessionId: string;
  updatedAt: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  contextTokens: number;
  sessionFile?: string;
  model?: string;
  displayName?: string;
  channel?: string;
  groupChannel?: string;
}

/** Read sessions for one agent directly from disk */
function readAgentSessions(agentId: string): DiskSession[] {
  const sessionsPath = `${HOME}/.openclaw/agents/${agentId}/sessions/sessions.json`;
  if (!existsSync(sessionsPath)) return [];
  try {
    const raw = readFileSync(sessionsPath, "utf8");
    const data = JSON.parse(raw);
    return Object.entries(data).map(([key, v]: [string, any]) => ({
      key,
      sessionId: v.sessionId || "",
      updatedAt: v.updatedAt || 0,
      totalTokens: v.totalTokens || 0,
      inputTokens: v.inputTokens || 0,
      outputTokens: v.outputTokens || 0,
      cacheRead: v.cacheRead || 0,
      cacheWrite: v.cacheWrite || 0,
      contextTokens: v.contextTokens || 200000,
      sessionFile: v.sessionFile || undefined,
      model: v.model || undefined,
      displayName: v.displayName || key,
      channel: v.channel || undefined,
      groupChannel: v.groupChannel || undefined,
    }));
  } catch {
    return [];
  }
}

/** Get directory size in MB (non-recursive into node_modules/.git for speed) */
function getDirSizeMB(dirPath: string): number | null {
  if (!dirPath || !existsSync(dirPath)) return null;
  try {
    let total = 0;
    const walk = (dir: string, depth: number) => {
      if (depth > 6) return;
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        const full = join(dir, entry.name);
        try {
          if (entry.isFile()) total += statSync(full).size;
          else if (entry.isDirectory()) walk(full, depth + 1);
        } catch {}
      }
    };
    walk(dirPath, 0);
    return Math.round((total / 1024 / 1024) * 10) / 10;
  } catch { return null; }
}

/** Count lines in a JSONL file */
function countJsonlLines(filePath: string): number {
  if (!filePath || !existsSync(filePath)) return 0;
  try {
    const content = readFileSync(filePath, "utf8");
    return content.split("\n").filter((l) => l.trim().length > 0).length;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    // Read agents + models from disk (instant)
    const config = readConfig();

    // Read all sessions from disk (instant)
    const allDiskSessions: (DiskSession & { agentId: string })[] = [];
    for (const agent of config.agents) {
      const agentSessions = readAgentSessions(agent.id);
      for (const s of agentSessions) {
        allDiskSessions.push({ ...s, agentId: agent.id });
      }
    }

    // Only call openclaw status for gateway/security/channels (not sessions)
    const [statusResult, healthResult] = await Promise.allSettled([
      execAsync("openclaw status --json", { timeout: 10000 }),
      execAsync("openclaw health --json", { timeout: 15000 }),
    ]);

    const statusRaw = statusResult.status === "fulfilled" ? statusResult.value.stdout : "{}";
    const healthRaw = healthResult.status === "fulfilled" ? healthResult.value.stdout : "{}";

    let status: any = {};
    let health: any = {};
    try { status = JSON.parse(statusRaw); } catch {}
    try { health = JSON.parse(healthRaw); } catch {}

    // ── Agents ──────────────────────────────────────────────────────────────
    const heartbeatMap: Record<string, { enabled: boolean; every: string }> = {};
    (status.heartbeat?.agents || []).forEach((a: any) => {
      heartbeatMap[a.agentId] = { enabled: a.enabled, every: a.every };
    });

    // Group disk sessions by agent
    const sessionsByAgent: Record<string, (DiskSession & { agentId: string })[]> = {};
    for (const s of allDiskSessions) {
      if (!sessionsByAgent[s.agentId]) sessionsByAgent[s.agentId] = [];
      sessionsByAgent[s.agentId].push(s);
    }

    // Use status.agents for lastActiveAgeMs/lastUpdatedAt (lightweight metadata)
    const statusAgentMap: Record<string, any> = {};
    (status.agents?.agents || []).forEach((a: any) => {
      statusAgentMap[a.id] = a;
    });

    const agents: AgentConfig[] = config.agents.map((a) => {
      const hb = heartbeatMap[a.id] || { enabled: false, every: "disabled" };
      const agentSessions = sessionsByAgent[a.id] || [];
      const statusAgent = statusAgentMap[a.id] || {};

      const isOnline = statusAgent.lastActiveAgeMs !== undefined &&
        statusAgent.lastActiveAgeMs !== null &&
        statusAgent.lastActiveAgeMs < 300_000;

      return {
        id: a.id,
        name: a.name,
        role: AGENT_ROLES[a.id] || "Agente",
        model: a.model,
        modelShort: getModelShort(a.model || config.defaultModel),
        workspaceDir: a.workspace || "",
        workspaceSizeMB: getDirSizeMB(a.workspace || ""),
        sessionsCount: agentSessions.length,
        lastUpdatedAt: statusAgent.lastUpdatedAt || 0,
        lastActiveAgeMs: statusAgent.lastActiveAgeMs ?? null,
        online: isOnline,
        heartbeatEnabled: hb.enabled,
        heartbeatEvery: hb.every,
      } as AgentConfig;
    });

    // ── Sessions (from disk) ─────────────────────────────────────────────────
    const sessions: SessionInfo[] = allDiskSessions.map((s) => {
      const totalTokens = s.totalTokens;
      const contextTokens = s.contextTokens || 200000;
      const percentUsed = Math.round((totalTokens / contextTokens) * 100);
      const messageCount = countJsonlLines(s.sessionFile || "");

      // Derive channel type from session key
      const channel = s.key.includes(":discord:") ? "discord"
        : s.key.includes(":cron:") ? "cron"
        : s.key.endsWith(":main") ? "main"
        : "other";

      return {
        key: s.key,
        agentId: s.agentId,
        kind: channel === "discord" ? "channel" : channel,
        sessionId: s.sessionId,
        updatedAt: s.updatedAt,
        age: s.updatedAt ? Date.now() - s.updatedAt : 0,
        model: s.model || config.defaultModel,
        contextTokens,
        inputTokens: s.inputTokens,
        outputTokens: s.outputTokens,
        cacheRead: s.cacheRead,
        cacheWrite: s.cacheWrite,
        totalTokens,
        remainingTokens: contextTokens - totalTokens,
        percentUsed,
        channel,
        displayName: s.displayName || s.key,
        messageCount,
        sessionFile: s.sessionFile,
      };
    });

    // ── Gateway ───────────────────────────────────────────────────────────────
    const gw = status.gateway || {};
    const gwService = status.gatewayService || {};
    const gateway: GatewayStatus = {
      mode: gw.mode || "local",
      url: gw.url || "ws://127.0.0.1:18789",
      reachable: gw.reachable ?? false,
      connectLatencyMs: gw.connectLatencyMs || 0,
      version: gw.self?.version || "unknown",
      platform: gw.self?.platform || "unknown",
      host: gw.self?.host || "unknown",
      ip: gw.self?.ip || "unknown",
      serviceRunning: gwService.runtimeShort?.includes("running") ?? false,
    };

    // ── Channels ──────────────────────────────────────────────────────────────
    const channels: ChannelHealth[] = [];
    if (health.channels) {
      for (const [name, ch] of Object.entries<any>(health.channels)) {
        channels.push({
          name,
          configured: ch.configured ?? false,
          running: ch.running ?? false,
          probeOk: ch.probe?.ok ?? false,
          botName: ch.probe?.bot?.username,
          lastError: ch.lastError || null,
        });
      }
    }

    // ── Security ──────────────────────────────────────────────────────────────
    const securityFindings: SecurityFinding[] = (status.securityAudit?.findings || []).map(
      (f: any) => ({
        checkId: f.checkId,
        severity: f.severity,
        title: f.title,
        detail: f.detail,
      })
    );

    const data: DashboardData = {
      agents,
      sessions,
      gateway,
      channels,
      securityFindings,
      os: status.os || {},
      update: {
        root: status.update?.root || "",
        latestVersion: status.update?.registry?.latestVersion || "unknown",
      },
      fetchedAt: Date.now(),
    };

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
