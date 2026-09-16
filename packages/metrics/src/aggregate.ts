import { redactEventPayload } from "./redact";

export interface DomainEventRow {
  tenantId: string;
  kind: string;
  payload: unknown;
  occurredAt: string;
}

export interface DailyMetricRow {
  tenantId: string;
  day: string;
  kind: string;
  count: number;
  sample: Record<string, unknown>;
}

export function aggregateDailyMetrics(events: DomainEventRow[]): DailyMetricRow[] {
  const buckets = new Map<string, DailyMetricRow>();
  for (const event of events) {
    const day = event.occurredAt.slice(0, 10);
    const key = `${event.tenantId}\0${day}\0${event.kind}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    buckets.set(key, {
      tenantId: event.tenantId,
      day,
      kind: event.kind,
      count: 1,
      sample: redactEventPayload(event.kind, event.payload),
    });
  }
  return [...buckets.values()].sort((a, b) =>
    a.day.localeCompare(b.day) || a.kind.localeCompare(b.kind) || a.tenantId.localeCompare(b.tenantId)
  );
}
