"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentStatusPanel } from "./AgentStatusPanel";
import { CostPanel } from "./CostPanel";
import { ActivityPanel } from "./ActivityPanel";
import { SystemPanel } from "./SystemPanel";
import type { DashboardData } from "@/lib/types";
import { RefreshCw, Wifi, WifiOff, Bot } from "lucide-react";

const REFRESH_INTERVAL_MS = 30_000; // 30 seconds

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-white/5 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Horizzon Labs</h1>
              <p className="text-[10px] text-zinc-500 leading-none">OpenClaw Control Panel</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status indicator */}
            {data && (
              <div className="flex items-center gap-1.5">
                {data.gateway.reachable ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                )}
                <span className="text-[11px] text-zinc-400 hidden sm:block">
                  {data.gateway.reachable ? "Gateway conectado" : "Gateway offline"}
                </span>
              </div>
            )}

            {/* Last refresh */}
            {lastRefresh && (
              <span className="text-[11px] text-zinc-600 hidden sm:block">
                Actualizado {formatTime(lastRefresh)}
              </span>
            )}

            {/* Refresh button */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors disabled:opacity-50 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg px-3 py-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:block">Actualizar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <RefreshCw className="w-8 h-8 text-zinc-500 animate-spin" />
            <p className="text-zinc-500 text-sm">Cargando datos del gateway…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-4 max-w-md text-center">
              <p className="font-medium mb-1">Error al conectar</p>
              <p className="text-xs text-red-300">{error}</p>
              <p className="text-xs text-zinc-500 mt-2">Asegúrate de que openclaw gateway está corriendo</p>
            </div>
            <button
              onClick={() => fetchData(true)}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar
            </button>
          </div>
        ) : data ? (
          <Tabs defaultValue="agents">
            <TabsList className="mb-6">
              <TabsTrigger value="agents">
                <span className="flex items-center gap-1.5">
                  🤖 <span>Agentes</span>
                  {data.agents.length > 0 && (
                    <span className="ml-1 bg-violet-600/30 text-violet-300 rounded-full px-1.5 text-[10px]">
                      {data.agents.filter(a => a.online).length}/{data.agents.length}
                    </span>
                  )}
                </span>
              </TabsTrigger>
              <TabsTrigger value="costs">
                <span className="flex items-center gap-1.5">💰 <span>Costes</span></span>
              </TabsTrigger>
              <TabsTrigger value="activity">
                <span className="flex items-center gap-1.5">📊 <span>Actividad</span></span>
              </TabsTrigger>
              <TabsTrigger value="system">
                <span className="flex items-center gap-1.5">
                  ⚙️ <span>Sistema</span>
                  {data.securityFindings.filter(f => f.severity === 'warn' || f.severity === 'critical').length > 0 && (
                    <span className="ml-1 bg-amber-600/30 text-amber-300 rounded-full px-1.5 text-[10px]">
                      {data.securityFindings.filter(f => f.severity === 'warn' || f.severity === 'critical').length}
                    </span>
                  )}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agents">
              <AgentStatusPanel agents={data.agents} sessions={data.sessions} />
            </TabsContent>

            <TabsContent value="costs">
              <CostPanel agents={data.agents} sessions={data.sessions} />
            </TabsContent>

            <TabsContent value="activity">
              <ActivityPanel agents={data.agents} sessions={data.sessions} />
            </TabsContent>

            <TabsContent value="system">
              <SystemPanel data={data} />
            </TabsContent>
          </Tabs>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-8">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between text-[11px] text-zinc-600">
          <span>Horizzon Labs Control Panel · OpenClaw {data?.gateway.version || ""}</span>
          <span>Auto-refresh cada 30s · {lastRefresh ? `Últ. actualización: ${formatTime(lastRefresh)}` : ""}</span>
        </div>
      </footer>
    </div>
  );
}
