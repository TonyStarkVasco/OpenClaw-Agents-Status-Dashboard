"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentConfig, SessionInfo } from "@/lib/types";
import { estimateCost, formatCost, formatTokens, MODEL_PRICING } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AlertTriangle, TrendingUp, DollarSign, Cpu } from "lucide-react";

// Pricing threshold alert (USD)
const COST_ALERT_THRESHOLD = 5.0;

const AGENT_COLORS_HEX: Record<string, string> = {
  madaga: "#7c3aed",
  gary: "#059669",
  steven: "#d97706",
  samantha: "#db2777",
  juliano: "#2563eb",
};

/**
 * NOTE: El dashboard muestra costes de la sesión ACTUAL (datos reales del gateway).
 * El historial diario/semanal/mensual es un placeholder — OpenClaw no expone
 * un endpoint de histórico de uso. Se necesitaría implementar logging propio.
 */

interface Props {
  agents: AgentConfig[];
  sessions: SessionInfo[];
}

interface AgentCost {
  id: string;
  name: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: number;
  color: string;
}

function buildAgentCosts(agents: AgentConfig[], sessions: SessionInfo[]): AgentCost[] {
  return agents.map((agent) => {
    const agentSessions = sessions.filter((s) => s.agentId === agent.id);
    const totals = agentSessions.reduce(
      (acc, s) => ({
        input: acc.input + (s.inputTokens || 0),
        output: acc.output + (s.outputTokens || 0),
        cacheRead: acc.cacheRead + (s.cacheRead || 0),
        cacheWrite: acc.cacheWrite + (s.cacheWrite || 0),
        total: acc.total + (s.totalTokens || 0),
      }),
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    );

    const cost = estimateCost(agent.model, totals.input, totals.output, totals.cacheRead, totals.cacheWrite);

    return {
      id: agent.id,
      name: agent.name,
      model: agent.model,
      inputTokens: totals.input,
      outputTokens: totals.output,
      cacheRead: totals.cacheRead,
      cacheWrite: totals.cacheWrite,
      totalTokens: totals.total,
      cost,
      color: AGENT_COLORS_HEX[agent.id] || "#6b7280",
    };
  });
}

// Placeholder historical data (no historical API available)
function generatePlaceholderHistory(agentCosts: AgentCost[]) {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Hoy"];
  return days.map((day, i) => {
    const entry: Record<string, any> = { day };
    agentCosts.forEach((ac) => {
      // Simulate some variance — actual daily history not available from API
      const base = ac.cost * (0.5 + Math.random() * 0.8);
      entry[ac.name] = i === 6 ? ac.cost : parseFloat(base.toFixed(6));
    });
    return entry;
  });
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-lg p-3 text-xs shadow-xl">
        <p className="text-zinc-400 mb-2">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-zinc-300">{p.name}:</span>
            <span className="text-white font-mono">{formatCost(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function CostPanel({ agents, sessions }: Props) {
  const agentCosts = buildAgentCosts(agents, sessions);
  const totalCost = agentCosts.reduce((sum, ac) => sum + ac.cost, 0);
  const totalTokens = agentCosts.reduce((sum, ac) => sum + ac.totalTokens, 0);
  const overThreshold = totalCost > COST_ALERT_THRESHOLD;

  const history = generatePlaceholderHistory(agentCosts);
  const pieData = agentCosts.filter((ac) => ac.totalTokens > 0);

  return (
    <div className="space-y-4">
      {/* Alert banner */}
      {overThreshold && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm">
            Coste total supera el umbral de <strong>{formatCost(COST_ALERT_THRESHOLD)}</strong>.
            Coste actual: <strong>{formatCost(totalCost)}</strong>
          </span>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Coste sesión"
          value={formatCost(totalCost)}
          icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
          note="Sesión actual"
        />
        <SummaryCard
          label="Tokens totales"
          value={formatTokens(totalTokens)}
          icon={<Cpu className="w-4 h-4 text-blue-400" />}
          note="Todas las sesiones"
        />
        <SummaryCard
          label="Agente + activo"
          value={
            agentCosts.sort((a, b) => b.cost - a.cost)[0]?.name || "—"
          }
          icon={<TrendingUp className="w-4 h-4 text-violet-400" />}
          note="Por coste"
        />
        <SummaryCard
          label="Umbral alerta"
          value={formatCost(COST_ALERT_THRESHOLD)}
          icon={<AlertTriangle className={`w-4 h-4 ${overThreshold ? "text-amber-400" : "text-zinc-500"}`} />}
          note={overThreshold ? "⚠️ Superado" : "OK"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Token breakdown per agent */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Consumo por agente</CardTitle>
            <CardDescription>
              Tokens y coste estimado — sesión activa (datos reales)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agentCosts.map((ac) => (
                <div key={ac.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: ac.color }}
                      />
                      <span className="text-sm text-zinc-200">{ac.name}</span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {ac.model.replace("claude-", "").replace(/-\d+.*/, "")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-zinc-400">{formatTokens(ac.totalTokens)} tok</span>
                      <span className="font-mono text-emerald-400">{formatCost(ac.cost)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: totalTokens > 0 ? `${(ac.totalTokens / totalTokens) * 100}%` : "0%",
                        background: ac.color,
                      }}
                    />
                  </div>
                  {/* Token breakdown */}
                  {ac.totalTokens > 0 && (
                    <div className="flex gap-3 mt-1 text-xs text-zinc-600">
                      <span>in: {formatTokens(ac.inputTokens)}</span>
                      <span>out: {formatTokens(ac.outputTokens)}</span>
                      <span>cache↑: {formatTokens(ac.cacheWrite)}</span>
                      <span>cache↓: {formatTokens(ac.cacheRead)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribución tokens</CardTitle>
            <CardDescription>Por agente (sesión actual)</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="totalTokens"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: any) => formatTokens(v)}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span className="text-xs text-zinc-400">{v}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-zinc-600 text-sm">
                Sin datos de sesión activa
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historical bar chart — PLACEHOLDER */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm">Tendencia de coste — últimos 7 días</CardTitle>
              <CardDescription>
                ⚠️ Datos simulados — OpenClaw no expone API de historial.
                Implementar logging propio para datos reales.
              </CardDescription>
            </div>
            <Badge variant="warning">Placeholder</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={history} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v.toFixed(3)}`}
              />
              <Tooltip content={<CustomTooltip />} />
              {agents.map((agent) => (
                <Bar
                  key={agent.id}
                  dataKey={agent.name}
                  stackId="a"
                  fill={AGENT_COLORS_HEX[agent.id] || "#6b7280"}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pricing reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Referencia de precios (Anthropic API)</CardTitle>
          <CardDescription>USD por 1M tokens — Feb 2026</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-zinc-500 pb-2 font-medium">Modelo</th>
                  <th className="text-right text-zinc-500 pb-2 font-medium">Input</th>
                  <th className="text-right text-zinc-500 pb-2 font-medium">Output</th>
                  <th className="text-right text-zinc-500 pb-2 font-medium">Cache Read</th>
                  <th className="text-right text-zinc-500 pb-2 font-medium">Cache Write</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(MODEL_PRICING).map(([model, p]) => (
                  <tr key={model} className="border-b border-white/5 last:border-0">
                    <td className="py-2 text-zinc-300 font-mono">{model.replace("claude-", "")}</td>
                    <td className="py-2 text-right text-zinc-400">${p.input}</td>
                    <td className="py-2 text-right text-zinc-400">${p.output}</td>
                    <td className="py-2 text-right text-zinc-400">${p.cacheRead}</td>
                    <td className="py-2 text-right text-zinc-400">${p.cacheWrite}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">{label}</span>
          {icon}
        </div>
        <p className="text-xl font-bold text-white font-mono">{value}</p>
        {note && <p className="text-xs text-zinc-500 mt-1">{note}</p>}
      </CardContent>
    </Card>
  );
}
