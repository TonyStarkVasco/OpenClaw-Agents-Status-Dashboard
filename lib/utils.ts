import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAge(ms: number | null): string {
  if (ms === null || ms === undefined) return "Nunca";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function formatTokens(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

// Pricing per 1M tokens (USD) - Anthropic API rates Feb 2026
export const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-6": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5-20251001": { input: 0.25, output: 1.25, cacheRead: 0.03, cacheWrite: 0.31 },
  "claude-haiku-4-5": { input: 0.25, output: 1.25, cacheRead: 0.03, cacheWrite: 0.31 },
};

export function estimateCost(
  model: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
  cacheRead: number = 0,
  cacheWrite: number = 0
): number {
  const pricing = MODEL_PRICING[model] || { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 };
  return (
    (inputTokens * pricing.input +
      outputTokens * pricing.output +
      cacheRead * pricing.cacheRead +
      cacheWrite * pricing.cacheWrite) /
    1_000_000
  );
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(3)}¢`;
  return `$${usd.toFixed(4)}`;
}

export function getModelTier(model: string): "opus" | "sonnet" | "haiku" | "unknown" {
  if (model.includes("opus")) return "opus";
  if (model.includes("sonnet")) return "sonnet";
  if (model.includes("haiku")) return "haiku";
  return "unknown";
}
