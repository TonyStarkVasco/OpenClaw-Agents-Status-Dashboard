"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentConfig, SessionInfo } from "@/lib/types";
import { formatAge, formatTokens, estimateCost, formatCost } from "@/lib/utils";
import { Bot, Clock, Layers, Zap, MessageSquare } from "lucide-react";

const AGENT_COLORS: Record<string, string> = {
  madaga:   "from-violet-600 to-indigo-600",
  gary:     "from-emerald-600 to-teal-600",
  steven:   "from-orange-600 to-amber-600",
  samantha: "from-pink-600 to-rose-600",
  juliano:  "from-blue-600 to-cyan-600",
};

const TIER_COLORS: Record<string, string> = {
  opus:    "text-violet-400",
  sonnet:  "text-blue-400",
  haiku:   "text-emerald-400",
  unknown: "text-zinc-400",
};

interface Props {
  agents: AgentConfig[];
  sessions: SessionInfo[];
}

export function AgentStatusPanel({ agents, sessions }: Props) {
  const getAgentSessions = (agentId: string) =>
    sessions
      .filter((s) => s.agentId === agentId)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const onlineCount = agents.filter((a) => a.online).length;

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Agentes"  value={agents.length.toString()}                     icon={<Bot      className="w-4 h-4" />} />
        <StatCard label="Online"   value={onlineCount.toString()}                        icon={<Zap      className="w-4 h-4 text-emerald-400" />} color="emerald" />
        <StatCard label="Offline"  value={(agents.length - onlineCount).toString()}      icon={<Zap      className="w-4 h-4 text-zinc-500" />}    color="zinc" />
        <StatCard label="Sesiones" value={sessions.length.toString()}                    icon={<Layers   className="w-4 h-4 text-blue-400" />}     color="blue" />
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {agents.map((agent) => {
          const agentSessions = getAgentSessions(agent.id);
          // Most recently updated discord session
          const mainSession = agentSessions[0];
          const cost = mainSession
            ? estimateCost(
                mainSession.model,
                mainSession.inputTokens,
                mainSession.outputTokens,
                mainSession.cacheRead,
                mainSession.cacheWrite,
              )
            : 0;
          const gradient = AGENT_COLORS[agent.id] || "from-zinc-600 to-zinc-700";

          // Determine context bar state
          const pct          = mainSession?.percentUsed   ?? 0;
          const totalTok     = mainSession?.totalTokens   ?? 0;
          const msgCount     = mainSession?.messageCount  ?? 0;
          const isFresh      = mainSession?.isFresh       ?? !mainSession;
          const lastActivity = mainSession?.updatedAt     ?? 0;

          const barColor =
            pct > 80 ? "bg-red-500"
            : pct > 60 ? "bg-amber-500"
            : pct > 0  ? "bg-emerald-500"
            : "bg-zinc-700";

          return (
            <Card key={agent.id} className="overflow-hidden">
              {/* Gradient header */}
              <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <p className="text-xs text-zinc-400 mt-0.5">{agent.role}</p>
                  </div>
                  <Badge variant={agent.online ? "success" : "outline"}>
                    {agent.online ? "Online" : "Offline"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-2.5 text-sm">
                {/* Model */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Modelo</span>
                  <span className={`font-mono text-xs ${TIER_COLORS[agent.modelShort.toLowerCase()] || "text-zinc-300"}`}>
                    {agent.modelShort}
                  </span>
                </div>

                {/* Last active */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Actividad
                  </span>
                  <span className="text-zinc-300 text-xs">
                    {formatAge(agent.lastActiveAgeMs)}
                  </span>
                </div>

                {/* Sessions count */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Sesiones</span>
                  <span className="text-zinc-300">{agent.sessionsCount}</span>
                </div>

                {/* Workspace size */}
                {agent.workspaceSizeMB !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Workspace</span>
                    <span className="text-zinc-300 text-xs">
                      {agent.workspaceSizeMB >= 1024
                        ? `${(agent.workspaceSizeMB / 1024).toFixed(1)} GB`
                        : `${agent.workspaceSizeMB} MB`}
                    </span>
                  </div>
                )}

                {/* Heartbeat */}
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Heartbeat</span>
                  {agent.heartbeatEnabled ? (
                    <Badge variant="info">{agent.heartbeatEvery}</Badge>
                  ) : (
                    <span className="text-zinc-600 text-xs">off</span>
                  )}
                </div>

                {/* ── Context bar (always visible) ── */}
                <div className="border-t border-white/5 pt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500">Contexto</span>
                    {pct === 0 ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 bg-zinc-800 border-zinc-700">
                        Sesión limpia
                      </Badge>
                    ) : (
                      <span className="text-zinc-300">
                        {pct}% ({formatTokens(totalTok)})
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.max(pct, isFresh ? 0 : 0)}%` }}
                    />
                  </div>

                  {/* Message count & last update */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-600">
                    {msgCount > 0 ? (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-2.5 h-2.5" />
                        {msgCount} mensajes
                      </span>
                    ) : (
                      <span />
                    )}
                    {lastActivity > 0 && (
                      <span>Últ. actividad {formatAge(Date.now() - lastActivity)}</span>
                    )}
                  </div>
                </div>

                {/* Cost row — only when there's actual cost */}
                {cost > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Coste sesión</span>
                    <span className="text-emerald-400 font-mono">{formatCost(cost)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">{label}</span>
          {icon}
        </div>
        <p className="text-2xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}
