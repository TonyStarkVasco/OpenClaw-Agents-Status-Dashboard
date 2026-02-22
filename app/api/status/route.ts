import { exec } from "child_process";
import { promisify } from "util";
import { NextResponse } from "next/server";
import type { DashboardData, AgentConfig, SessionInfo, GatewayStatus, ChannelHealth, SecurityFinding } from "@/lib/types";

const execAsync = promisify(exec);

const AGENT_META: Record<string, { role: string; modelShort: string }> = {
  madaga: { role: "CEO / Orchestrator", modelShort: "Opus" },
  gary: { role: "Marketing", modelShort: "Sonnet" },
  steven: { role: "Dev", modelShort: "Opus" },
  samantha: { role: "Ops", modelShort: "Haiku" },
  juliano: { role: "Ventas", modelShort: "Sonnet" },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [statusResult, healthResult] = await Promise.allSettled([
      execAsync("openclaw status --json", { timeout: 10000 }),
      execAsync("openclaw health --json", { timeout: 15000 }),
    ]);

    const statusRaw =
      statusResult.status === "fulfilled" ? statusResult.value.stdout : "{}";
    const healthRaw =
      healthResult.status === "fulfilled" ? healthResult.value.stdout : "{}";

    let status: any = {};
    let health: any = {};

    try { status = JSON.parse(statusRaw); } catch {}
    try { health = JSON.parse(healthRaw); } catch {}

    // ── Agents ──────────────────────────────────────────────────────────────
    const heartbeatMap: Record<string, { enabled: boolean; every: string }> = {};
    (status.heartbeat?.agents || []).forEach((a: any) => {
      heartbeatMap[a.agentId] = { enabled: a.enabled, every: a.every };
    });

    const agents: AgentConfig[] = (status.agents?.agents || []).map((a: any) => {
      const hb = heartbeatMap[a.id] || { enabled: false, every: "disabled" };
      const sessionData = (status.sessions?.recent || []).find(
        (s: any) => s.agentId === a.id
      );
      const isOnline = a.lastActiveAgeMs !== null && a.lastActiveAgeMs < 300_000; // < 5 min
      const meta = AGENT_META[a.id] || { role: "Agente", modelShort: "?" };
      return {
        id: a.id,
        name: a.name,
        role: meta.role,
        model: sessionData?.model || "claude-sonnet-4-6",
        modelShort: meta.modelShort,
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
      servicePid: undefined,
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
    const securityFindings: SecurityFinding[] = (
      status.securityAudit?.findings || []
    ).map((f: any) => ({
      checkId: f.checkId,
      severity: f.severity,
      title: f.title,
      detail: f.detail,
    }));

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
