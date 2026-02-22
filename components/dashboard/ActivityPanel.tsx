"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentConfig, SessionInfo } from "@/lib/types";
import { formatAge } from "@/lib/utils";
import { MessageSquare, Clock, GitBranch } from "lucide-react";

const AGENT_COLORS_HEX: Record<string, string> = {
  madaga: "#7c3aed",
  gary: "#059669",
  steven: "#d97706",
  samantha: "#db2777",
  juliano: "#2563eb",
};

const CHANNEL_ICONS: Record<string, string> = {
  discord: "🎮",
  direct: "⚡",
  other: "📡",
};

interface Props {
  agents: AgentConfig[];
  sessions: SessionInfo[];
}

interface TimelineEvent {
  agentId: string;
  agentName: string;
  sessionKey: string;
  channel: string;
  timestamp: number;
  ageMs: number;
  kind: string;
  color: string;
}

export function ActivityPanel({ agents, sessions }: Props) {
  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  // Build timeline from sessions, sorted by most recent
  const timeline: TimelineEvent[] = sessions
    .filter((s) => s.updatedAt)
    .map((s) => ({
      agentId: s.agentId,
      agentName: agentMap[s.agentId]?.name || s.agentId,
      sessionKey: s.key,
      channel: s.channel,
      timestamp: s.updatedAt,
      ageMs: s.age,
      kind: s.kind,
      color: AGENT_COLORS_HEX[s.agentId] || "#6b7280",
    }))
    .sort((a, b) => b.timestamp - a.timestamp);

  // Group by agent
  const byAgent = agents.map((agent) => ({
    agent,
    sessions: sessions.filter((s) => s.agentId === agent.id).sort((a, b) => b.updatedAt - a.updatedAt),
  }));

  return (
    <div className="space-y-4">
      {/* Agent activity summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {byAgent.map(({ agent, sessions: agentSessions }) => (
          <Card key={agent.id} className="overflow-hidden">
            <div
              className="h-1"
              style={{ background: AGENT_COLORS_HEX[agent.id] || "#6b7280" }}
            />
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm text-white">{agent.name}</span>
                <Badge variant={agent.online ? "success" : "outline"} className="text-[10px]">
                  {agent.online ? "activo" : "idle"}
                </Badge>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Sesiones</span>
                  <span className="text-zinc-200">{agentSessions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Última</span>
                  <span className="text-zinc-200">{formatAge(agent.lastActiveAgeMs)}</span>
                </div>
                {agentSessions[0] && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Canal</span>
                    <span className="text-zinc-200 flex items-center gap-1">
                      {CHANNEL_ICONS[agentSessions[0].channel] || "📡"}
                      <span>{agentSessions[0].channel}</span>
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Heartbeat</span>
                  <span className="text-zinc-200">
                    {agent.heartbeatEnabled ? `✅ ${agent.heartbeatEvery}` : "❌ off"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timeline de actividad
            </CardTitle>
            <CardDescription>Sesiones ordenadas por actividad reciente (datos reales)</CardDescription>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <div className="text-zinc-600 text-sm py-8 text-center">Sin sesiones recientes</div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3 top-0 bottom-0 w-px bg-white/5" />
                <div className="space-y-4">
                  {timeline.map((event, i) => (
                    <div key={i} className="flex gap-4 items-start pl-1">
                      {/* Dot */}
                      <div className="relative z-10 mt-1">
                        <div
                          className="w-5 h-5 rounded-full border-2 border-zinc-900 flex items-center justify-center"
                          style={{ background: event.color }}
                        >
                          <span className="text-[8px] text-white font-bold">
                            {event.agentName[0]}
                          </span>
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-white">
                            {event.agentName}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {CHANNEL_ICONS[event.channel]} {event.channel}
                          </span>
                          <span className="text-[10px] text-zinc-600 ml-auto">
                            {formatAge(event.ageMs)}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">
                          {event.sessionKey.replace("agent:", "").replace(event.agentId + ":", "")}
                        </p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="outline" className="text-[9px] py-0 h-4">
                            {event.kind}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session details table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Detalle de sesiones activas
            </CardTitle>
            <CardDescription>
              Uso de contexto por sesión
              {sessions.length === 0 && " — Sin sesiones con datos de token"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessions.length === 0 ? (
                <div className="text-zinc-600 text-sm py-8 text-center">
                  Sin sesiones disponibles
                </div>
              ) : (
                sessions
                  .filter((s) => s.totalTokens > 0)
                  .slice(0, 8)
                  .map((session) => {
                    const agent = agentMap[session.agentId];
                    return (
                      <div
                        key={session.sessionId}
                        className="bg-zinc-800/30 rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ background: AGENT_COLORS_HEX[session.agentId] || "#6b7280" }}
                            />
                            <span className="text-xs font-medium text-zinc-200">
                              {agent?.name || session.agentId}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {CHANNEL_ICONS[session.channel]} {session.channel}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500">{formatAge(session.age)}</span>
                        </div>
                        {session.percentUsed > 0 && (
                          <div>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-zinc-500 font-mono">
                                {session.sessionId.slice(0, 8)}…
                              </span>
                              <span className="text-zinc-300">{session.percentUsed}% ctx</span>
                            </div>
                            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  session.percentUsed > 80
                                    ? "bg-red-500"
                                    : session.percentUsed > 60
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                                style={{ width: `${session.percentUsed}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}

              {/* NOTE: Tasks/pending section is a placeholder */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-xs text-zinc-500">
                    Tareas pendientes — Placeholder (no hay API de tareas en OpenClaw)
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    { agent: "Madaga", task: "Review dashboard PR", status: "en curso", color: "#7c3aed" },
                    { agent: "Gary", task: "Campañas Q1 2026", status: "pendiente", color: "#059669" },
                    { agent: "Steven", task: "Dashboard MVP build", status: "en curso", color: "#d97706" },
                    { agent: "Samantha", task: "Monitoring setup", status: "pendiente", color: "#db2777" },
                    { agent: "Juliano", task: "Demo prospects", status: "pendiente", color: "#2563eb" },
                  ].map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
                      <span className="text-zinc-400 w-16">{t.agent}</span>
                      <span className="text-zinc-300 flex-1 truncate">{t.task}</span>
                      <Badge variant={t.status === "en curso" ? "info" : "outline"} className="text-[9px]">
                        {t.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
