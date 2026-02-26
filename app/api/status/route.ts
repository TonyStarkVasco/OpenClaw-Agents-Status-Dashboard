import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync } from "fs";
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

function getModelShort(modelStr: string): string {
  if (!modelStr) return "?";
  if (modelStr.includes("opus"))   return "Opus";
  if (modelStr.includes("sonnet")) return "Sonnet";
  if (modelStr.includes("haiku"))  return "Haiku";
  return modelStr.split("/").pop()?.split("-")[0] || "?";
}

/** Read configured models per agent from openclaw.json */
function readAgentModels(): Record<string, string> {
  const models: Record<string, string> = {};
  try {
    const raw = readFileSync(`${process.env.HOME}/.openclaw/openclaw.json`, "utf8");
    const cfg = JSON.parse(raw);
    const defaultModel =
      cfg?.agents?.defaults?.model?.primary ||
      cfg?.agents?.defaults?.model ||
      "claude-sonnet-4-6";
    const list: any[] = cfg?.agents?.list || [];
    list.forEach((a: any) => {
      models[a.id] = a.model || defaultModel;
    });
  } catch {}
  return models;
}

export async function GET() {
  try {
    const [statusResult, healthResult] = await Promise.allSettled([
      execAsync("openclaw status --json", { timeout: 10000 }),
      execAsync("openclaw health --json", { timeout: 15000 }),
    ]);

    const statusRaw = statusResult.status === "fulfilled" ? statusResult.value.stdout : "{}";
    const healthRaw  = healthResult.status  === "fulfilled" ? healthResult.value.stdout  : "{}";

    let status: any = {};
    let health:  any = {};
    try { status = JSON.parse(statusRaw); } catch {}
    try { health  = JSON.parse(healthRaw);  } catch {}

    const configuredModels = readAgentModels();

    // ── Agents ──────────────────────────────────────────────────────────────
    const heartbeatMap: Record<string, { enabled: boolean; every: string }> = {};
    (status.heartbeat?.agents || []).forEach((a: any) => {
      heartbeatMap[a.agentId] = { enabled: a.enabled, every: a.every };
    });

    // Group sessions by agent for quick lookup
    const sessionsByAgent: Record<string, any[]> = {};
    (status.sessions?.recent || []).forEach((s: any) => {
      if (!sessionsByAgent[s.agentId]) sessionsByAgent[s.agentId] = [];
      sessionsByAgent[s.agentId].push(s);
    });

    const agents: AgentConfig[] = (status.agents?.agents || []).map((a: any) => {
      const hb = heartbeatMap[a.id] || { enabled: false, every: "disabled" };
      const agentSessions = sessionsByAgent[a.id] || [];

      // Pick the most recently active session
      const mainSession = agentSessions.sort(
        (x: any, y: any) => (y.updatedAt || 0) - (x.updatedAt || 0)
      )[0];

      // Model: prefer configured model, fall back to session model
      const actualModel = configuredModels[a.id] || mainSession?.model || "claude-sonnet-4-6";
      const isOnline = a.lastActiveAgeMs !== null && a.lastActiveAgeMs < 300_000;

      return {
        id: a.id,
        name: a.name,
        role: AGENT_ROLES[a.id] || "Agente",
        model: actualModel,
        modelShort: getModelShort(actualModel),
        workspaceDir: a.workspaceDir,
        sessionsCount: a.sessionsCount,
        lastUpdatedAt: a.lastUpdatedAt,
        lastActiveAgeMs: a.lastActiveAgeMs,
        online: isOnline,
        heartbeatEnabled: hb.enabled,
        heartbeatEvery: hb.every,
      } as AgentConfig;
    });

    // ── Sessions ─────────────────────────────────────────────────────────────
    const sessions: SessionInfo[] = (status.sessions?.recent || []).map((s: any) => ({
      key: s.key,
      agentId: s.agentId,
      kind: s.kind,
      sessionId: s.sessionId,
      updatedAt: s.updatedAt,
      age: s.age || 0,
      model: s.model || "claude-sonnet-4-6",
      contextTokens: s.contextTokens || 200000,
      inputTokens: s.inputTokens || 0,
      outputTokens: s.outputTokens || 0,
      cacheRead: s.cacheRead || 0,
      cacheWrite: s.cacheWrite || 0,
      totalTokens: s.totalTokens || 0,
      remainingTokens: s.remainingTokens || 200000,
      percentUsed: s.percentUsed || 0,
      channel: s.key.includes("discord") ? "discord" : s.kind === "direct" ? "direct" : "other",
      displayName: s.key,
    }));

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
