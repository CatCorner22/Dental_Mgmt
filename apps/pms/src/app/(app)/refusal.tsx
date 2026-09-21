/**
 * The Refusal component (docs/04): a refusal says what was refused, why, and
 * what to do next, in that order, with no accusation and no dead end.
 */
export type RefusalContent = {
  verb: string;
  why: string;
  nextSteps: string[];
  conflicts?: { id: string; title: string; personName: string; severity: string }[];
};

export function Refusal({ refusal, children }: { refusal: RefusalContent; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--stop-rail)] bg-[var(--stop-soft)] p-4 text-[var(--stop-ink)]" role="alert">
      <p className="font-semibold">{refusal.verb}</p>
      <p className="mt-1 text-sm">{refusal.why}</p>
      {refusal.conflicts && refusal.conflicts.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-sm">
          {refusal.conflicts.map((c) => (
            <li key={c.id}>
              {c.title} · {c.personName} · {c.severity}
            </li>
          ))}
        </ul>
      )}
      {refusal.nextSteps.length > 0 && (
        <ol className="mt-2 list-decimal pl-5 text-sm">
          {refusal.nextSteps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
