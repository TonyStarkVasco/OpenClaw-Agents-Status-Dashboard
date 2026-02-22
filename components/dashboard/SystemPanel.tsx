"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DashboardData } from "@/lib/types";
import { Server, Shield, Wifi, Activity, Clock, AlertTriangle, CheckCircle2, Info } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "danger",
  warn: "warning",
  info: "info",
};

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <AlertTriangle className="w-4 h-4 text-red-400" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};

interface Props {
  data: DashboardData;
}

export function SystemPanel({ data }: Props) {
  const { gateway, channels, securityFindings, os, update } = data;

  const critical = securityFindings.filter((f) => f.severity === "critical").length;
  const warns = securityFindings.filter((f) => f.severity === "warn").length;
  const infos = securityFindings.filter((f) => f.severity === "info").length;

  return (
    <div className="space-y-4">
      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Gateway"
          value={gateway.reachable ? "Reachable" : "Unreachable"}
          icon={<Server className="w-4 h-4" />}
          status={gateway.reachable ? "success" : "danger"}
          note={`${gateway.connectLatencyMs}ms latency`}
        />
        <MetricCard
          label="Servicio"
          value={gateway.serviceRunning ? "Running" : "Stopped"}
          icon={<Activity className="w-4 h-4" />}
          status={gateway.serviceRunning ? "success" : "danger"}
          note="LaunchAgent"
        />
        <MetricCard
          label="Versión"
          value={gateway.version}
          icon={<Info className="w-4 h-4" />}
          status="info"
          note={`Latest: ${update.latestVersion}`}
        />
        <MetricCard
          label="Seguridad"
          value={critical > 0 ? `${critical} crítico` : warns > 0 ? `${warns} avisos` : "✓ OK"}
          icon={<Shield className="w-4 h-4" />}
          status={critical > 0 ? "danger" : warns > 0 ? "warning" : "success"}
          note={`${infos} info`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gateway info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Server className="w-4 h-4" />
              Gateway
            </CardTitle>
            <CardDescription>Estado del proceso y conectividad</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="URL" value={gateway.url} mono />
            <InfoRow label="Modo" value={gateway.mode} />
            <InfoRow label="Host" value={gateway.host} mono />
            <InfoRow label="IP" value={gateway.ip} mono />
            <InfoRow label="Versión" value={gateway.version} mono />
            <InfoRow label="Plataforma" value={gateway.platform} />
            <InfoRow label="OS" value={os.label || "unknown"} />
            <InfoRow label="Arch" value={os.arch || "unknown"} />
            <InfoRow
              label="Latencia"
              value={`${gateway.connectLatencyMs}ms`}
              mono
            />
            <InfoRow
              label="Estado"
              value={
                gateway.reachable ? (
                  <Badge variant="success">✓ Reachable</Badge>
                ) : (
                  <Badge variant="danger">✗ Unreachable</Badge>
                )
              }
            />
          </CardContent>
        </Card>

        {/* Channels */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              Canales
            </CardTitle>
            <CardDescription>Estado de conectividad por canal</CardDescription>
          </CardHeader>
          <CardContent>
            {channels.length === 0 ? (
              <div className="text-zinc-600 text-sm py-4 text-center">
                Sin datos de canales (requiere <code className="text-xs">openclaw health --json</code>)
              </div>
            ) : (
              <div className="space-y-4">
                {channels.map((ch) => (
                  <div key={ch.name} className="bg-zinc-800/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {ch.name === "discord" ? "🎮" : ch.name === "whatsapp" ? "💬" : "📡"}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-white capitalize">{ch.name}</p>
                          {ch.botName && (
                            <p className="text-xs text-zinc-400">Bot: @{ch.botName}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={ch.probeOk ? "success" : "danger"}>
                          {ch.probeOk ? "✓ OK" : "✗ Error"}
                        </Badge>
                        {ch.running ? (
                          <Badge variant="info">Running</Badge>
                        ) : (
                          <Badge variant="outline">Not running</Badge>
                        )}
                      </div>
                    </div>
                    {ch.lastError && (
                      <div className="text-xs text-red-400 bg-red-500/10 rounded p-2">
                        {ch.lastError}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Configurado</span>
                        <span className={ch.configured ? "text-emerald-400" : "text-zinc-600"}>
                          {ch.configured ? "Sí" : "No"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Probe</span>
                        <span className={ch.probeOk ? "text-emerald-400" : "text-red-400"}>
                          {ch.probeOk ? "✓" : "✗"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Security audit */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Auditoría de seguridad
              </CardTitle>
              <CardDescription>
                Resultados de <code className="text-xs">openclaw status --json</code> → securityAudit
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {critical > 0 && <Badge variant="danger">{critical} críticos</Badge>}
              {warns > 0 && <Badge variant="warning">{warns} avisos</Badge>}
              {infos > 0 && <Badge variant="info">{infos} info</Badge>}
              {securityFindings.length === 0 && <Badge variant="success">✓ Sin problemas</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {securityFindings.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 py-4">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm">Sin hallazgos de seguridad</span>
            </div>
          ) : (
            <div className="space-y-3">
              {securityFindings.map((finding) => (
                <div
                  key={finding.checkId}
                  className={`rounded-lg p-4 border ${
                    finding.severity === "critical"
                      ? "bg-red-500/5 border-red-500/20"
                      : finding.severity === "warn"
                      ? "bg-amber-500/5 border-amber-500/20"
                      : "bg-blue-500/5 border-blue-500/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{SEVERITY_ICONS[finding.severity]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={SEVERITY_COLORS[finding.severity] as any} className="text-[10px]">
                          {finding.severity}
                        </Badge>
                        <span className="text-xs font-medium text-white">{finding.title}</span>
                      </div>
                      <p className="text-xs text-zinc-400 whitespace-pre-wrap">{finding.detail}</p>
                      <p className="text-[10px] text-zinc-600 mt-1 font-mono">{finding.checkId}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Actualización
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <InfoRow label="Versión instalada" value={gateway.version} mono />
          <InfoRow label="Última disponible" value={update.latestVersion} mono />
          <InfoRow
            label="Estado"
            value={
              gateway.version === update.latestVersion ? (
                <Badge variant="success">✓ Al día</Badge>
              ) : (
                <Badge variant="warning">Actualización disponible</Badge>
              )
            }
          />
          <InfoRow label="Path" value={update.root} mono />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 border-b border-white/5 last:border-0">
      <span className="text-xs text-zinc-500 shrink-0">{label}</span>
      {typeof value === "string" ? (
        <span className={`text-xs text-zinc-200 text-right ${mono ? "font-mono" : ""} break-all`}>
          {value}
        </span>
      ) : (
        value
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  status,
  note,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  status: "success" | "danger" | "warning" | "info";
  note?: string;
}) {
  const statusColors = {
    success: "text-emerald-400",
    danger: "text-red-400",
    warning: "text-amber-400",
    info: "text-blue-400",
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">{label}</span>
          <span className={statusColors[status]}>{icon}</span>
        </div>
        <p className={`text-base font-bold font-mono ${statusColors[status]}`}>{value}</p>
        {note && <p className="text-xs text-zinc-600 mt-1">{note}</p>}
      </CardContent>
    </Card>
  );
}
