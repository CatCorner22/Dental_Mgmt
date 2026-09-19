"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DECISION_KIND_LABEL,
  ENTITLEMENTS,
  exceptionTightens,
  type ControlDecision,
  type ControlSnapshot,
  type DetectedConflict,
  type RoleAssignment,
  type ThresholdException,
} from "@pms/controls-engine";
import { meetsRole, isRole } from "@/lib/auth/roles";
import {
  ENFORCEMENT_HELP,
  ENFORCEMENT_LABEL,
  SEVERITY_LABEL,
  conflictDecisionState,
  decisionStateLabel,
  dutiesByPerson,
  grantRefusal,
  attestationSentence,
  lastCompleteMonth,
  provenanceSentence,
  reasonTighteningSentence,
  reasonTighteningsForChannel,
} from "@/lib/controls/riskView";
import type { ReasonCodeRow } from "@/lib/ledger/reasons";
import type { AttestationRow } from "@/lib/controls/attestations";
import { DecisionForm, type DecisionDraft } from "./decision-form";
import { Refusal, type RefusalContent } from "./refusal";

type RiskResponse = {
  source: "stored" | "live";
  id: string | null;
  takenAt: string;
  trigger: string;
  snapshot: ControlSnapshot;
};

type SodResponse = {
  asOf: string;
  policyConfigured: boolean;
  summary: ControlSnapshot["sod"]["summary"];
  recommendations: string[];
  assignments: RoleAssignment[];
  conflicts: DetectedConflict[];
  unknownEntitlements: { personId: string; entitlement: string }[];
};

type DecisionsResponse = { asOf: string; items: ControlDecision[]; overdue: string[] };

type ExceptionsResponse = {
  policyConfigured: boolean;
  policyVersion: number | null;
  enabled: boolean;
  exceptions: ThresholdException[];
  summary: { total: number; raises: number; forceDual: number; waives: number; expiringSoon: number };
};

type ReasonCodesResponse = { items: ReasonCodeRow[] };

import type { Notice, NoticeSeat } from "@/lib/notices/outstanding";
import type { Message } from "@/lib/notices/message";
import { sendSentence, type SendRecord } from "@/lib/notices/sendOutcome";

type AttestationsResponse = { month: string; items: AttestationRow[] };

type OutstandingResponse = { notices: Notice[]; counts: Record<NoticeSeat, number>; computedAt: string };
/** Where this viewer's notices would go, and what would go there. Nothing is sent (Increment 1.58). */
type AddressResponse = {
  seat: NoticeSeat;
  address: { id: string; address: string | null; setAt: string } | null;
  /** Whether this exact address row was proved to reach this person (Increment 1.61); null where it was not. */
  proof: { addressId: string; provedAt: string } | null;
  /** Where that proof stands: a proof lasts a year (Increment 1.65). */
  standing: "none" | "good" | "expiring" | "lapsed";
  lapsesAt: string | null;
  /** The last attempt and how it went (Increment 1.59); null where nobody has tried. */
  lastSend: SendRecord | null;
  /** When the scheduled sender last ran, whatever it found (Increment 1.62); null where it never has. */
  lastRound: { ranAt: string; considered: number; sent: number; unchanged: number; unreachable: number; failed: number } | null;
  message: Message | null;
};

type Me = { ok: boolean; role?: string; displayName?: string };

type FindingItem = {
  id: string;
  kind: string;
  kindLabel: string;
  subjectKind: string;
  subjectId: string;
  severity: "low" | "medium" | "high";
  status: "open" | "closed";
  detail: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  closedAt: string | null;
  closedReason: string | null;
  reopenedCount: number;
  /** The active decision that governs this finding, if the owner has recorded one. */
  decision: {
    id: string;
    kind: string;
    kindLabel: string;
    note: string;
    reviewBy: string | null;
    overdue: boolean;
    decidedAt: string;
    decidedByName: string;
  } | null;
};

type FindingsResponse = {
  asOf: string;
  items: FindingItem[];
  summary: { open: number; closed: number; high: number; medium: number; low: number; decided: number; undecided: number };
};

type Loaded = {
  risk: RiskResponse;
  sod: SodResponse;
  decisions: DecisionsResponse;
  exceptions: ExceptionsResponse;
  findings: FindingsResponse;
  reasonCodes: ReasonCodesResponse;
  attestations: AttestationsResponse;
  outstanding: OutstandingResponse;
  delivery: AddressResponse;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: Loaded };

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Could not load ${url}.`);
  return body;
}

const ENTITLEMENT_LABEL = new Map(ENTITLEMENTS.map((e) => [e.id as string, e.label]));

function entitlementLabel(id: string): string {
  return ENTITLEMENT_LABEL.get(id) ?? id;
}

function shortId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export default function PracticeRiskPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showFamily, setShowFamily] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  // The tightening exception being switched off; the decision form is open for it.
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  // Where my own notices would go (Increment 1.58). Nothing is sent.
  const [addressDraft, setAddressDraft] = useState<string | null>(null);
  const [codeDraft, setCodeDraft] = useState("");

  // Grant form
  const [grantPerson, setGrantPerson] = useState("");
  const [grantEntitlement, setGrantEntitlement] = useState<string>(ENTITLEMENTS[0]?.id ?? "");
  const [grantReason, setGrantReason] = useState("");
  const [grantRefused, setGrantRefused] = useState<(RefusalContent & { canLicense: boolean }) | null>(null);

  const load = useCallback(async (fresh = false) => {
    const [risk, sod, decisions, exceptions, findings, reasonCodes, attestations, outstanding, delivery] = await Promise.all([
      getJson<RiskResponse>(`/api/controls/risk${fresh ? "?fresh=1" : ""}`),
      getJson<SodResponse>("/api/controls/sod"),
      getJson<DecisionsResponse>("/api/controls/decisions"),
      getJson<ExceptionsResponse>("/api/controls/exceptions"),
      getJson<FindingsResponse>("/api/controls/findings"),
      getJson<ReasonCodesResponse>("/api/reason-codes"),
      // The month that has ended: "reviewed this month" means a month somebody
      // could have reviewed, and the one still filling is not one.
      getJson<AttestationsResponse>(
        `/api/controls/attestations?month=${lastCompleteMonth(new Date().toISOString().slice(0, 10))}`
      ),
      // What each seat owes right now (Increment 1.57): its own route, because
      // the snapshot above may be the frozen one and this is always the
      // practice's position now.
      getJson<OutstandingResponse>("/api/controls/outstanding"),
      // Where this viewer's own notices would go, and the message that would go
      // there (Increment 1.58). Nothing is sent.
      getJson<AddressResponse>("/api/notices/address"),
    ]);
    return { risk, sod, decisions, exceptions, findings, reasonCodes, attestations, outstanding, delivery };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then(async (res) => (await res.json()) as Me)
      .then((body) => {
        if (!cancelled) setMe(body);
      })
      .catch(() => {
        if (!cancelled) setMe({ ok: false });
      });
    load()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: "error", message: err instanceof Error ? err.message : "Could not load Practice Risk." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const role = me?.role && isRole(me.role) ? me.role : undefined;
  const isAdmin = meetsRole(role, "admin");

  async function refresh(fresh = false, note?: string) {
    const data = await load(fresh);
    setState({ status: "ready", data });
    if (note) setMessage(note);
  }

  /**
   * After a grant, revoke, or decision the headline is recomputed from live
   * rows, so the tiles and the table agree; only a freeze shows the stored
   * snapshot, and the provenance sentence says which one is on screen.
   */
  async function run(label: string, fn: () => Promise<string | void>, fresh = true) {
    setBusy(label);
    setMessage(null);
    try {
      const note = await fn();
      await refresh(fresh, note ?? undefined);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  /**
   * Records where this person's notices would go, or that they would go
   * nowhere (Increment 1.58). It sends nothing and never names a user: the
   * route takes the caller's own id, and the database refuses a row naming
   * anybody else.
   */
  async function saveAddress(address: string) {
    await run(
      address === "" ? "Stop sending to me" : "Save address",
      async () => {
        const res = await fetch("/api/notices/address", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const body = (await res.json().catch(() => ({}))) as { why?: string; error?: string };
        if (!res.ok) throw new Error(body.why ?? body.error ?? "Could not record that.");
        setAddressDraft(null);
        return address === "" ? "You will receive no messages." : `Messages would go to ${address}.`;
      },
      false
    );
  }

  /**
   * Sends this person their own notices now (Increment 1.59). Every outcome is
   * reported in words, the failure loudest of all: a delivery that failed
   * silently would leave the reader believing they had been told.
   */
  async function sendNoticesNow() {
    await run(
      "Send this to me now",
      async () => {
        const res = await fetch("/api/notices/send", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        const body = (await res.json().catch(() => ({}))) as
          | { outcome: "nothing_owed" }
          | { outcome: "sent" | "failed" | "unreachable"; record: SendRecord; attempts: number };
        if (!res.ok) throw new Error("Could not attempt a send.");
        if (body.outcome === "nothing_owed") return "Nothing is owed, so nothing was sent.";
        // The attempt count belongs to the act the person just asked for, and
        // only to it: the table keeps the attempts, and a reader looking later
        // counts rows rather than trusting a number stored beside them.
        const tries = body.attempts > 1 ? ` The practice tried ${body.attempts} times.` : "";
        return `${sendSentence(body.record)}${tries}`;
      },
      false
    );
  }

  /**
   * Asks for a code to be sent to the address on file (Increment 1.61).
   *
   * The outcome of the send is reported in the same words a send of notices
   * gets, because it is the same act through the same transport: a person left
   * waiting for a code that never left would conclude the product is broken,
   * or worse, that their address works.
   */
  async function askForCode() {
    await run(
      "Send me a code",
      async () => {
        const res = await fetch("/api/notices/prove", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        const body = (await res.json().catch(() => ({}))) as {
          why?: string;
          error?: string;
          delivered?: { record: SendRecord; attempts: number };
        };
        if (!res.ok) throw new Error(body.why ?? body.error ?? "Could not send a code.");
        const record = body.delivered?.record;
        return record ? sendSentence(record) : "A code was sent.";
      },
      false
    );
  }

  /** Brings a code back, which is the proof (Increment 1.61). */
  async function proveAddressNow(code: string) {
    await run(
      "Prove this address",
      async () => {
        const res = await fetch("/api/notices/prove", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const body = (await res.json().catch(() => ({}))) as { why?: string; error?: string };
        if (!res.ok) throw new Error(body.why ?? body.error ?? "Could not check that code.");
        setCodeDraft("");
        return "This address is proved. Your notices will go to it.";
      },
      false
    );
  }

  async function freezeSnapshot() {
    await run("Freeze snapshot", async () => {
      // Every guarded write needs a JSON content type, even with nothing to say.
      const res = await fetch("/api/controls/risk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "The snapshot was not frozen.");
      return "Snapshot frozen. The findings table was refreshed to match.";
    }, false);
  }

  async function recordDecision(conflict: DetectedConflict, draft: DecisionDraft) {
    await run("Record decision", async () => {
      const res = await fetch("/api/controls/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectKind: "sod_finding",
          subjectId: conflict.id,
          kind: draft.kind,
          note: draft.note,
          reviewBy: draft.reviewBy || undefined,
          residualAtDecision: conflict.score,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      setDecidingId(null);
      return `${DECISION_KIND_LABEL[draft.kind]} recorded for ${conflict.title}.`;
    });
  }

  async function recordFindingDecision(finding: FindingItem, draft: DecisionDraft) {
    await run("Record decision", async () => {
      const res = await fetch("/api/controls/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subjectKind: "detector_finding",
          subjectId: finding.id,
          kind: draft.kind,
          note: draft.note,
          reviewBy: draft.reviewBy || undefined,
          supersedesDecisionId: finding.decision?.id,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      setDecidingId(null);
      return `${DECISION_KIND_LABEL[draft.kind]} recorded for the finding "${finding.kindLabel}". The row stays open until the detector sees the condition clear.`;
    });
  }

  async function grant(decision?: DecisionDraft) {
    if (!grantPerson || !grantEntitlement) return;
    setBusy("Grant");
    setMessage(null);
    setGrantRefused(null);
    try {
      const res = await fetch("/api/controls/grants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUserId: grantPerson,
          entitlement: grantEntitlement,
          reason: grantReason || undefined,
          decision: decision ? { kind: decision.kind, note: decision.note, reviewBy: decision.reviewBy || undefined } : undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as Parameters<typeof grantRefusal>[0];
      if (!res.ok) {
        setGrantRefused(grantRefusal(body, res.status));
        return;
      }
      setGrantReason("");
      await refresh(false, `Granted ${entitlementLabel(grantEntitlement)}.`);
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "The grant failed.");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Switching a tightening exception off is a decision, not a settings
   * change (Increment 1.31): the server refuses without one, and the form
   * asks for the review date up front so the refusal never has to.
   */
  async function switchOff(exception: ThresholdException, draft: DecisionDraft) {
    await run("Switch off", async () => {
      const res = await fetch("/api/controls/exceptions/retire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exceptionId: exception.id,
          decision: { kind: draft.kind, note: draft.note, reviewBy: draft.reviewBy || undefined },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      setSwitchingId(null);
      return `Switched off: ${exception.label}. Review due ${draft.reviewBy}; the home board says so until it is back on.`;
    });
  }

  async function switchOn(exception: ThresholdException) {
    await run("Switch on", async () => {
      const res = await fetch("/api/controls/exceptions/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exceptionId: exception.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      return `Switched on: ${exception.label}. The decision that switched it off is retired.`;
    });
  }

  /** Retiring a raise or a waiver tightens a control; a reason is enough. */
  async function retire(exception: ThresholdException) {
    await run("Retire", async () => {
      const res = await fetch("/api/controls/exceptions/retire", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ exceptionId: exception.id, reason: "Retired from Practice Risk." }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: string[] };
      if (!res.ok) throw new Error([body.error, ...(body.errors ?? [])].filter(Boolean).join(" "));
      return `Retired: ${exception.label}. The control it loosened stands again.`;
    });
  }

  async function revoke(person: RoleAssignment, entitlement: string) {
    await run("Revoke", async () => {
      const res = await fetch("/api/controls/grants/revoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetUserId: person.personId, entitlement }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "The grant was not revoked.");
      return `Revoked ${entitlementLabel(entitlement)} from ${person.personName}. The finding, if any, is closed, not deleted.`;
    });
  }

  return (
    <main>
      <p className="mb-2 text-sm font-semibold tracking-wide text-teal">Practice Risk</p>
      <h1 className="mb-2">Controls and residual risk</h1>
      <p className="mb-6 max-w-prose text-[var(--ink-2)]">
        What the practice enforces, what it only records, which duty combinations are open, and the
        decisions that govern them. Scores describe control design, never a person.
      </p>

      {state.status === "loading" && <p className="text-sm text-[var(--ink-2)]">Loading…</p>}
      {state.status === "error" && (
        <Refusal
          refusal={{
            verb: "Practice Risk did not load",
            why: state.message,
            nextSteps: ["Practice Risk needs the manager rank or above. Sign in with a manager or administrator account."],
          }}
        />
      )}
      {message && (
        <p className="mb-4 text-sm text-[var(--ink-2)]" aria-live="polite">
          {message}
        </p>
      )}

      {state.status === "ready" && (
        <RiskBody
          data={state.data}
          isAdmin={isAdmin}
          busy={busy}
          showFamily={showFamily}
          setShowFamily={setShowFamily}
          decidingId={decidingId}
          setDecidingId={setDecidingId}
          onRecompute={() => void run("Recompute", async () => "Recomputed from live rows; nothing was frozen.")}
          onFreeze={() => void freezeSnapshot()}
          onDecide={(c, d) => void recordDecision(c, d)}
          onDecideFinding={(f, d) => void recordFindingDecision(f, d)}
          addressForm={{
            draft: addressDraft,
            setDraft: setAddressDraft,
            save: (address) => void saveAddress(address),
            sendNow: () => void sendNoticesNow(),
            codeDraft,
            setCodeDraft,
            askForCode: () => void askForCode(),
            prove: (code: string) => void proveAddressNow(code),
          }}
          grantForm={{
            person: grantPerson,
            setPerson: setGrantPerson,
            entitlement: grantEntitlement,
            setEntitlement: setGrantEntitlement,
            reason: grantReason,
            setReason: setGrantReason,
            refused: grantRefused,
            clearRefusal: () => setGrantRefused(null),
            submit: (d?: DecisionDraft) => void grant(d),
          }}
          onRevoke={(p, e) => void revoke(p, e)}
          exceptionControls={{
            switchingId,
            setSwitchingId,
            onSwitchOff: (x, d) => void switchOff(x, d),
            onSwitchOn: (x) => void switchOn(x),
            onRetire: (x) => void retire(x),
          }}
        />
      )}
    </main>
  );
}

type ExceptionControls = {
  switchingId: string | null;
  setSwitchingId: (v: string | null) => void;
  onSwitchOff: (exception: ThresholdException, draft: DecisionDraft) => void;
  onSwitchOn: (exception: ThresholdException) => void;
  onRetire: (exception: ThresholdException) => void;
};

type GrantFormState = {
  person: string;
  setPerson: (v: string) => void;
  entitlement: string;
  setEntitlement: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  refused: (RefusalContent & { canLicense: boolean }) | null;
  clearRefusal: () => void;
  submit: (decision?: DecisionDraft) => void;
};

/** The one address this viewer may set: their own (Increment 1.58). */
type AddressFormState = {
  draft: string | null;
  setDraft: (v: string | null) => void;
  save: (address: string) => void;
  /** Sends this viewer their own notices now and records what happened (Increment 1.59). */
  sendNow: () => void;
  /** Asks for a code, and brings one back (Increment 1.61). */
  codeDraft: string;
  setCodeDraft: (v: string) => void;
  askForCode: () => void;
  prove: (code: string) => void;
};

function RiskBody({
  data,
  isAdmin,
  busy,
  showFamily,
  setShowFamily,
  decidingId,
  setDecidingId,
  onRecompute,
  onFreeze,
  onDecide,
  onDecideFinding,
  grantForm,
  addressForm,
  onRevoke,
  exceptionControls,
}: {
  data: Loaded;
  isAdmin: boolean;
  busy: string | null;
  showFamily: boolean;
  setShowFamily: (v: boolean) => void;
  decidingId: string | null;
  setDecidingId: (v: string | null) => void;
  onRecompute: () => void;
  onFreeze: () => void;
  onDecide: (conflict: DetectedConflict, draft: DecisionDraft) => void;
  onDecideFinding: (finding: FindingItem, draft: DecisionDraft) => void;
  grantForm: GrantFormState;
  addressForm: AddressFormState;
  onRevoke: (person: RoleAssignment, entitlement: string) => void;
  exceptionControls: ExceptionControls;
}) {
  const { risk, sod, decisions, exceptions, findings, reasonCodes, attestations, outstanding, delivery } = data;
  const s = risk.snapshot;
  const conflicts = [...sod.conflicts]
    .filter((c) => showFamily || c.severity !== "family")
    .sort((a, b) => b.score - a.score);
  const familyCount = sod.conflicts.filter((c) => c.severity === "family").length;
  const people = dutiesByPerson(sod.assignments);
  const register = [...decisions.items].sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
  const overdue = new Set(decisions.overdue);

  return (
    <>
      <p className="mb-4 text-sm text-[var(--ink-2)]">
        {provenanceSentence({
          source: risk.source,
          takenAt: risk.takenAt,
          trigger: risk.trigger,
          scoringVersion: s.scoringVersion,
          rulebookVersion: s.rulebookVersion,
        })}
      </p>
      <div className="mb-8 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-md border border-[var(--line-strong)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={busy !== null}
          onClick={onRecompute}
        >
          Recompute from live rows
        </button>
        {isAdmin && (
          <button
            type="button"
            className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={busy !== null}
            onClick={onFreeze}
          >
            {busy === "Freeze snapshot" ? "Freezing…" : "Freeze snapshot"}
          </button>
        )}
      </div>

      <section aria-labelledby="headline" className="mb-10">
        <h2 id="headline" className="mb-3 text-lg font-semibold">
          Headline
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Segregation health" value={`${s.headline.segregationHealth} / 100`} />
          <Tile label="Open conflicts" value={String(s.headline.openConflicts)} />
          <Tile label="Without a decision" value={String(s.headline.conflictsWithoutDecision)} />
          <Tile label="Overdue reviews" value={String(s.headline.overdueReviews)} />
        </div>
        <p className="mt-3 text-sm text-[var(--ink-2)]">
          Unmitigated critical conflicts: {s.headline.unmitigatedCritical}. COSO overall {s.headline.cosoOverall}.
          Pressure band: {s.headline.pressureBand}. Average residual {s.headline.averageResidual}. Team of{" "}
          {s.staff.teamSize}; dual control on payments{" "}
          {s.staff.dualControlPayments ? "counted" : "not counted"}.
        </p>
        <p className="mt-2 max-w-prose text-sm text-[var(--ink-2)]">
          Independent bank reconciliation:{" "}
          {s.measurements?.reconciliation ? (
            <>
              <span className="font-semibold text-[var(--ink)]">
                {s.measurements.reconciliation.grade === "independent"
                  ? "independent"
                  : s.measurements.reconciliation.grade === "same_hands"
                    ? "same hands"
                    : "stale import"}
              </span>{" "}
              (measured over the last {s.measurements.reconciliation.windowDays} days). {s.measurements.reconciliation.why}
            </>
          ) : (
            <>not measured in this snapshot; treated as absent.</>
          )}
        </p>
        <p className="mt-2 max-w-prose text-sm text-[var(--ink-2)]">
          Bank matching:{" "}
          {s.measurements?.matching ? (
            <>
              <span className="font-semibold text-[var(--ink)]">
                {s.measurements.matching.matchRate48hPct === null
                  ? "no rate yet"
                  : `${s.measurements.matching.matchRate48hPct}% within 48 hours`}
                {s.measurements.matching.medianLagDays === null
                  ? ""
                  : `, median lag ${s.measurements.matching.medianLagDays} ${s.measurements.matching.medianLagDays === 1 ? "day" : "days"}`}
              </span>{" "}
              (measured over the last {s.measurements.matching.windowDays} days; recorded, not scored). {s.measurements.matching.why}
            </>
          ) : (
            <>not measured in this snapshot.</>
          )}
        </p>
      </section>

      <section aria-labelledby="coverage" className="mb-10">
        <h2 id="coverage" className="mb-1 text-lg font-semibold">
          What is enforced
        </h2>
        <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
          Only an enforced or recorded channel may lower a score. A channel whose data the product does
          not hold is shown as attested, never as enforced, so this table cannot show a false green. A
          reason code may hold a channel to less than its own figure; where one does, it is named under
          the figure it tightens, with the decision that licensed any loosening.
        </p>
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Channel</th>
                <th className="px-4 py-3 font-semibold">Class</th>
                <th className="px-4 py-3 font-semibold tabular-nums">Dual above</th>
                <th className="px-4 py-3 font-semibold">Counts toward scores</th>
                <th className="px-4 py-3 font-semibold">Exceptions</th>
              </tr>
            </thead>
            <tbody>
              {s.coverage.map((row) => (
                <tr key={row.channel} className="border-b border-[var(--line)] last:border-0 align-top">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{row.label}</p>
                    <p className="text-xs text-[var(--ink-3)]">{ENFORCEMENT_HELP[row.status]}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={row.status} />
                    {/* What stands behind the word on a channel the product
                        cannot hold (Increment 1.51). Without it the row reads
                        as though "attested" meant somebody had said something. */}
                    {row.status === "external" && (
                      <p className="mt-1 text-xs font-normal text-[var(--ink-3)]">
                        {attestationSentence(
                          attestations.items.find((a) => a.channel === row.channel)?.attestation ?? null,
                          attestations.month
                        )}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {row.policyEnabled ? `$${row.thresholdUsd.toLocaleString()}` : "—"}
                    {row.policyEnabled && (
                      <ReasonTightenings
                        channel={row.channel}
                        thresholdUsd={row.thresholdUsd}
                        rows={reasonCodes.items}
                        decisions={decisions.items}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">{row.countsTowardScores ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 tabular-nums">{row.activeExceptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="conflicts" className="mb-10">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="conflicts" className="text-lg font-semibold">
            Duty combinations
          </h2>
          <label className="flex items-center gap-2 text-sm text-[var(--ink-2)]">
            <input type="checkbox" checked={showFamily} onChange={(e) => setShowFamily(e.target.checked)} />
            Show same-family combinations ({familyCount})
          </label>
        </div>
        <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
          A row is a pair of duties one person holds, with the rule that names the risk. A mitigated row
          is covered by an enforced dual-release channel. An open row has no governing decision.
        </p>
        {!sod.policyConfigured && (
          <p className="mb-3 text-sm text-[var(--ink-2)]">
            No control policy is configured for this practice, so no channel mitigates anything yet.
          </p>
        )}
        {conflicts.length === 0 ? (
          <p className="text-sm text-[var(--ink-2)]">No duty combinations to show.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Duties</th>
                  <th className="px-4 py-3 font-semibold">Held by</th>
                  <th className="px-4 py-3 font-semibold">Severity</th>
                  <th className="px-4 py-3 font-semibold">Mitigated</th>
                  <th className="px-4 py-3 font-semibold">Decision</th>
                  <th className="px-4 py-3 font-semibold tabular-nums">Score</th>
                  {isAdmin && <th className="px-4 py-3 font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody>
                {conflicts.map((c) => {
                  const ds = conflictDecisionState(c, decisions.items, sod.asOf);
                  const deciding = decidingId === c.id;
                  return (
                    <ConflictRow
                      key={c.id}
                      conflict={c}
                      decisionLabel={decisionStateLabel(ds)}
                      overdue={ds.state === "overdue"}
                      open={ds.state === "open"}
                      isAdmin={isAdmin}
                      deciding={deciding}
                      busy={busy !== null}
                      onStart={() => setDecidingId(c.id)}
                      onCancel={() => setDecidingId(null)}
                      onDecide={(d) => onDecide(c, d)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {sod.recommendations.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm text-[var(--ink-2)]">
            {sod.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="duties" className="mb-10">
        <h2 id="duties" className="mb-1 text-lg font-semibold">
          Who holds which duties
        </h2>
        <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
          Live grants only; nothing is inferred from a title. A grant that would create an unmitigated
          critical combination is refused unless a control decision is recorded in the same step.
        </p>
        <div className="space-y-3">
          {people.map((p) => (
            <article key={p.personId} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{p.personName}</p>
                <p className="text-sm text-[var(--ink-2)]">{p.role}</p>
              </div>
              {p.entitlements.length === 0 ? (
                <p className="text-sm text-[var(--ink-3)]">No duties granted.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {p.entitlements.map((e) => (
                    <li
                      key={e}
                      className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-sm"
                    >
                      <span>{entitlementLabel(e)}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-[var(--link)] underline-offset-2 hover:underline disabled:opacity-50"
                          disabled={busy !== null}
                          onClick={() => onRevoke(p, e)}
                          aria-label={`Revoke ${entitlementLabel(e)} from ${p.personName}`}
                        >
                          Revoke
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
        {sod.unknownEntitlements.length > 0 && (
          <p className="mt-3 text-sm text-[var(--ink-2)]">
            {sod.unknownEntitlements.length} grant row(s) name a duty outside the rulebook and are listed,
            not scored.
          </p>
        )}

        {isAdmin && (
          <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="mb-3 font-semibold">Grant a duty</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-semibold text-[var(--ink-2)]">Person</span>
                <select
                  className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                  value={grantForm.person}
                  onChange={(e) => {
                    grantForm.setPerson(e.target.value);
                    grantForm.clearRefusal();
                  }}
                >
                  <option value="">Choose…</option>
                  {people.map((p) => (
                    <option key={p.personId} value={p.personId}>
                      {p.personName} · {p.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-semibold text-[var(--ink-2)]">Duty</span>
                <select
                  className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                  value={grantForm.entitlement}
                  onChange={(e) => {
                    grantForm.setEntitlement(e.target.value);
                    grantForm.clearRefusal();
                  }}
                >
                  {ENTITLEMENTS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-[14rem] flex-1 flex-col text-sm">
                <span className="mb-1 font-semibold text-[var(--ink-2)]">Reason (optional)</span>
                <input
                  className="rounded-md border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                  value={grantForm.reason}
                  onChange={(e) => grantForm.setReason(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={busy !== null || !grantForm.person}
                onClick={() => grantForm.submit()}
              >
                {busy === "Grant" ? "Granting…" : "Grant"}
              </button>
            </div>
            {grantForm.refused && (
              <div className="mt-4">
                <Refusal refusal={grantForm.refused}>
                  {grantForm.refused.canLicense && (
                    <div>
                      <p className="mb-2 text-sm font-semibold">Record the decision and grant in the same step</p>
                      <DecisionForm
                        kinds={["accept_residual", "compensate"]}
                        submitLabel="Record decision and grant"
                        busy={busy === "Grant"}
                        onSubmit={(d) => grantForm.submit(d)}
                        onCancel={grantForm.clearRefusal}
                      />
                    </div>
                  )}
                </Refusal>
              </div>
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="register" className="mb-10">
        <h2 id="register" className="mb-1 text-lg font-semibold">
          Decision register
        </h2>
        <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
          Append-only and owner-attributed. A decision on a finding governs that finding; a decision on a
          control governs every combination of that control. Coverage {s.decisions.coveragePct}%.
        </p>
        {register.length === 0 ? (
          <p className="text-sm text-[var(--ink-2)]">No decisions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Decided</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Subject</th>
                  <th className="px-4 py-3 font-semibold">Why</th>
                  <th className="px-4 py-3 font-semibold">Review by</th>
                </tr>
              </thead>
              <tbody>
                {register.map((d) => (
                  <tr key={d.id} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p className="tabular-nums">{new Date(d.decidedAt).toLocaleDateString()}</p>
                      <p className="text-xs text-[var(--ink-3)]">{d.decidedByName}</p>
                    </td>
                    <td className="px-4 py-3">{DECISION_KIND_LABEL[d.kind]}</td>
                    <td className="px-4 py-3">
                      <p>{d.subjectKind.replace(/_/g, " ")}</p>
                      <p className="text-xs text-[var(--ink-3)]" title={d.subjectId}>
                        {shortId(d.subjectId)}
                      </p>
                    </td>
                    <td className="max-w-prose px-4 py-3">{d.note}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {d.reviewBy ?? "—"}
                      {overdue.has(d.id) && (
                        <span className="ml-2 rounded-md bg-[var(--review-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--review-ink)]">
                          Overdue
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="detectors" className="mb-10">
        <h2 id="detectors" className="mb-1 text-lg font-semibold">
          Detector findings
        </h2>
        <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
          Recorded, never enforced. The detectors run on every frozen snapshot, nightly and on demand, and
          keep one row per condition: open while it holds, closed with the reason when it clears, reopened
          if it returns. {findings.summary.open} open ({findings.summary.high} high, {findings.summary.medium}{" "}
          medium, {findings.summary.low} low), {findings.summary.closed} closed. Of the open, {findings.summary.decided}{" "}
          {findings.summary.decided === 1 ? "carries" : "carry"} a decision and {findings.summary.undecided}{" "}
          {findings.summary.undecided === 1 ? "waits" : "wait"} for one. A finding describes a line or a process, never a
          person; a decision on it says what the owner made of it and is reviewed like any other.
        </p>
        {findings.items.length === 0 ? (
          <p className="text-sm text-[var(--ink-2)]">No detector findings yet. Freeze a snapshot to run the detectors now.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Finding</th>
                  <th className="px-4 py-3 font-semibold">Severity</th>
                  <th className="px-4 py-3 font-semibold">What the rows say</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Decision</th>
                  {isAdmin && <th className="px-4 py-3 font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody>
                {findings.items.map((f) => (
                  <FindingRow
                    key={f.id}
                    finding={f}
                    isAdmin={isAdmin}
                    deciding={decidingId === f.id}
                    busy={busy !== null}
                    onStart={() => setDecidingId(f.id)}
                    onCancel={() => setDecidingId(null)}
                    onDecide={(d) => onDecideFinding(f, d)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="exceptions" className="mb-10">
        <h2 id="exceptions" className="mb-1 text-lg font-semibold">
          Standing exceptions
        </h2>
        <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
          {exceptions.policyConfigured
            ? `Policy version ${exceptions.policyVersion}. ${exceptions.summary.total} active: ${exceptions.summary.raises} raise, ${exceptions.summary.forceDual} force dual, ${exceptions.summary.waives} waive; ${exceptions.summary.expiringSoon} expiring within 30 days. A waiver never outlives 90 days.`
            : "No control policy is configured for this practice."}
        </p>
        {exceptions.exceptions.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-[var(--cream)] text-[var(--ink-2)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Exception</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Channels</th>
                  <th className="px-4 py-3 font-semibold">Window</th>
                  <th className="px-4 py-3 font-semibold">Enabled</th>
                  {isAdmin && <th className="px-4 py-3 font-semibold">Switch</th>}
                </tr>
              </thead>
              <tbody>
                {exceptions.exceptions.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--line)] last:border-0 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{e.label}</p>
                      <p className="text-xs text-[var(--ink-3)]">{e.reason}</p>
                      {e.residualNote && <p className="text-xs text-[var(--ink-3)]">Residual: {e.residualNote}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {e.action.replace(/_/g, " ")}
                      {e.thresholdUsd !== undefined ? ` to $${e.thresholdUsd.toLocaleString()}` : ""}
                    </td>
                    <td className="px-4 py-3">{e.channels.length ? e.channels.join(", ") : "all"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {e.effectiveFrom ?? "open"} → {e.effectiveTo ?? "open"}
                    </td>
                    <td className="px-4 py-3">{e.enabled ? "Yes" : "No"}</td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        {exceptionTightens(e) ? (
                          e.enabled ? (
                            <button
                              type="button"
                              className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold disabled:opacity-50"
                              disabled={busy !== null}
                              aria-label={`Switch off ${e.label}`}
                              onClick={() => exceptionControls.setSwitchingId(e.id)}
                            >
                              Switch off
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="rounded-md border border-[var(--line-strong)] bg-[var(--cream)] px-3 py-1 text-xs font-semibold disabled:opacity-50"
                              disabled={busy !== null}
                              aria-label={`Switch on ${e.label}`}
                              onClick={() => exceptionControls.onSwitchOn(e)}
                            >
                              {busy === "Switch on" ? "Switching…" : "Switch on"}
                            </button>
                          )
                        ) : e.enabled ? (
                          <button
                            type="button"
                            className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold disabled:opacity-50"
                            disabled={busy !== null}
                            aria-label={`Retire ${e.label}`}
                            onClick={() => exceptionControls.onRetire(e)}
                          >
                            {busy === "Retire" ? "Retiring…" : "Retire"}
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--ink-3)]">Ended</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isAdmin &&
          exceptionControls.switchingId &&
          (() => {
            const target = exceptions.exceptions.find((e) => e.id === exceptionControls.switchingId);
            if (!target) return null;
            return (
              <div className="mt-3 rounded-lg border border-[var(--line-strong)] bg-[var(--surface)] p-4">
                <p className="mb-2 max-w-prose text-sm text-[var(--ink-2)]">
                  Switching off &ldquo;{target.label}&rdquo; loosens a control: {target.reason} Record the decision that licenses
                  it: accept the residual or name what compensates, say why, and set the day the practice looks at this again.
                  The home board says &ldquo;off since, review due&rdquo; until it is back on.
                </p>
                <DecisionForm
                  kinds={["accept_residual", "compensate"]}
                  submitLabel="Switch off with this decision"
                  busy={busy === "Switch off"}
                  reviewByRequired
                  onSubmit={(draft) => exceptionControls.onSwitchOff(target, draft)}
                  onCancel={() => exceptionControls.setSwitchingId(null)}
                />
              </div>
            );
          })()}
      </section>

      {/* What each seat owes right now (Increment 1.57), folded from the same
          readings the other screens use and stored nowhere: a notices table
          would be a status column that can disagree with the rows under it.
          Each entry carries the sentence its own surface already writes. */}
      <section aria-labelledby="outstanding" className="mb-10">
        <h2 id="outstanding" className="mb-3 text-lg font-semibold">
          What people owe
        </h2>
        {outstanding.notices.length === 0 ? (
          <p className="max-w-prose text-[var(--ink-2)]">
            Nobody owes anything the product can see: every channel the practice cannot enforce carries an attestation for
            the month that has ended, no question is waiting on an answer, no answer is waiting to be read, and no decision
            is past its review date.
          </p>
        ) : (
          <>
            <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
              {outstanding.counts.owner} on the practice, {outstanding.counts.accountant} on the accountant. Read from rows
              on every load and recorded nowhere, so nothing here can outlive the thing it reports. Oldest first.
            </p>
            <ul className="space-y-3">
              {outstanding.notices.map((n) => (
                <li key={n.key} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                    {n.seat === "owner" ? "The practice" : "The accountant"}
                    {n.since ? ` \u00b7 since ${n.since}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{n.subject}</p>
                  <p className="mt-1 max-w-prose text-sm text-[var(--ink-2)]">{n.sentence}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Where this viewer's own notices would go, and what would go there
          (Increment 1.58). Nothing is sent. The message is shown beside the
          address because a person deciding whether to receive these is
          entitled to read, first, what receiving them would mean — and because
          it is the only way the rule about what a message may carry is visible
          to the person it protects. */}
      <section aria-labelledby="delivery" className="mb-10">
        <h2 id="delivery" className="mb-1 text-lg font-semibold">
          What would be sent to you
        </h2>
        <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
          Nothing is sent yet. This is the message that would go to you, and the address it would go to. A message carries
          only sentences the product wrote: never a question or an answer somebody typed, because those leave the product
          and nothing constrains what they say.
        </p>

        <form
          className="mb-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addressForm.save(addressForm.draft ?? delivery.address?.address ?? "");
          }}
        >
          <label className="flex flex-col text-sm">
            <span className="mb-1 font-medium">Your address</span>
            <input
              type="email"
              className="w-72 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1"
              placeholder="name@example.com"
              value={addressForm.draft ?? delivery.address?.address ?? ""}
              onChange={(e) => addressForm.setDraft(e.target.value)}
            />
          </label>
          <button type="submit" className="rounded-md border border-[var(--line)] px-3 py-1 text-sm" disabled={busy !== null}>
            Save address
          </button>
          {/* Increment 1.59: the act, and its outcome in words. */}
          <button
            type="button"
            className="rounded-md border border-[var(--line)] px-3 py-1 text-sm"
            disabled={busy !== null}
            onClick={() => addressForm.sendNow()}
          >
            Send this to me now
          </button>
          {delivery.address?.address ? (
            <button
              type="button"
              className="rounded-md border border-[var(--line)] px-3 py-1 text-sm"
              disabled={busy !== null}
              onClick={() => addressForm.save("")}
            >
              Stop sending to me
            </button>
          ) : null}
        </form>

        <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
          {delivery.address === null
            ? "You have never said where to send these, so nothing would go anywhere."
            : delivery.address.address === null
              ? `You asked on ${delivery.address.setAt.slice(0, 10)} not to receive these, so nothing would go anywhere.`
              : `Recorded on ${delivery.address.setAt.slice(0, 10)}. Only you can change this: the database refuses an address set by anybody else.`}
        </p>

        {/* Whether anybody has proved this address reaches this person
            (Increment 1.61). A mistyped address does not fail: it is accepted
            by whoever does own that mailbox, so nothing but a code coming back
            tells the practice the difference. */}
        {delivery.address?.address ? (
          delivery.proof && delivery.standing !== "lapsed" ? (
            <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
              Proved on {delivery.proof.provedAt.slice(0, 10)}: somebody opened this address and brought back the code sent
              to it. Changing the address means proving the new one, because a proof names the address rather than you.{" "}
              {/* A proof stands for a year (Increment 1.65), and the screen says
                  when rather than waiting for the day the notices stop. */}
              {delivery.standing === "expiring"
                ? `It needs proving again by ${delivery.lapsesAt?.slice(0, 10)}, and a code is on its way: bring it back and nothing stops.`
                : `It stands until ${delivery.lapsesAt?.slice(0, 10)}, when it needs proving again.`}
            </p>
          ) : (
            <form
              className="mb-3 max-w-prose rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                addressForm.prove(addressForm.codeDraft);
              }}
            >
              <p className="mb-2 text-sm">
                <strong>
                  {delivery.standing === "lapsed"
                    ? `The proof that this address reaches you lapsed on ${delivery.lapsesAt?.slice(0, 10)}`
                    : "Nobody has proved this address reaches you"}
                </strong>
                , so nothing is sent to it. A mistyped address
                does not bounce — it is accepted by whoever does own that mailbox — so the practice asks you to fetch a
                code from it instead. This practice will send at most five codes an hour, because an address you type is
                somebody else&apos;s inbox until it is proved.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-[var(--line)] px-3 py-1 text-sm"
                  disabled={busy !== null}
                  onClick={() => addressForm.askForCode()}
                >
                  Send me a code
                </button>
                <label className="flex flex-col text-sm">
                  <span className="mb-1 font-medium">Code from that message</span>
                  <input
                    type="text"
                    className="w-48 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 font-mono uppercase"
                    placeholder="ABCD234XYZ"
                    value={addressForm.codeDraft}
                    onChange={(e) => addressForm.setCodeDraft(e.target.value)}
                  />
                </label>
                <button type="submit" className="rounded-md border border-[var(--line)] px-3 py-1 text-sm" disabled={busy !== null}>
                  Prove this address
                </button>
              </div>
            </form>
          )
        ) : null}

        {/* How the last attempt went, whatever way it went (Increment 1.59). A
            delivery that failed silently would leave its reader believing they
            had been told, which is worse than never having sent. */}
        <p className="mb-1 max-w-prose text-sm text-[var(--ink-2)]">
          {delivery.lastSend === null
            ? "Nothing has been sent to you yet."
            : sendSentence(delivery.lastSend)}
        </p>

        {/* When the sender itself last ran (Increment 1.62). Every round leaves
            a row, including the quiet ones, so a scheduler that stopped is
            visible here rather than looking like a practice that owes nothing
            — which is the difference this whole arc exists to keep. */}
        <p className="mb-1 max-w-prose text-sm text-[var(--ink-2)]">
          {delivery.lastRound === null
            ? "Nothing sends these on a schedule yet, so they go out only when somebody asks."
            : `The sender last ran on ${delivery.lastRound.ranAt.slice(0, 10)} and looked at ${delivery.lastRound.considered} ${delivery.lastRound.considered === 1 ? "person" : "people"}.`}
        </p>

        {/* The standing rule, beside the outcome it governs (Increment 1.60).
            It is on the screen because a reader deciding whether to press the
            button again deserves to know what pressing it already did. */}
        <p className="mb-3 max-w-prose text-sm text-[var(--ink-3)]">
          A refusal that can pass is tried up to three times in one send; a refusal that cannot is tried once. Every
          attempt is kept, so the count is the attempts themselves rather than a number beside them. A scheduled round
          sends only what would read differently from the last message that reached you, or the same message once a week
          if it still stands.
        </p>

        {delivery.message === null ? (
          <p className="max-w-prose text-[var(--ink-2)]">
            No message would go out, because {delivery.seat === "owner" ? "the practice" : "you"} owe nothing. A message that
            arrived whether or not anything happened would not be a signal.
          </p>
        ) : (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Subject</p>
            <p className="mt-1 text-sm font-semibold">{delivery.message.subject}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">Body</p>
            <pre className="mt-1 max-w-prose overflow-x-auto whitespace-pre-wrap font-sans text-sm text-[var(--ink-2)]">
              {delivery.message.body}
            </pre>
          </div>
        )}
      </section>

      <section aria-labelledby="assumptions" className="mb-6">
        <h2 id="assumptions" className="mb-1 text-lg font-semibold">
          What these numbers assume
        </h2>
        <ul className="list-disc pl-5 text-sm text-[var(--ink-2)]">
          {s.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * The reason codes holding one channel to less than its own figure
 * (Increment 1.48). A reader of this table who could not see them would read a
 * figure that no longer governs every posting on the channel.
 */
function ReasonTightenings({
  channel,
  thresholdUsd,
  rows,
  decisions,
}: {
  channel: string;
  thresholdUsd: number;
  rows: ReasonCodeRow[];
  decisions: ControlDecision[];
}) {
  const tightenings = reasonTighteningsForChannel({ channel, channelThresholdUsd: thresholdUsd, rows, decisions });
  if (tightenings.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs font-normal tabular-nums text-[var(--ink-3)]">
      {tightenings.map((t) => (
        <li key={t.code}>{reasonTighteningSentence(t)}</li>
      ))}
    </ul>
  );
}

function StatusChip({ status }: { status: ControlSnapshot["coverage"][number]["status"] }) {
  const tone =
    status === "enforced" || status === "recorded"
      ? "bg-[var(--clear-soft)] text-[var(--clear-ink)]"
      : status === "partial"
        ? "bg-[var(--review-soft)] text-[var(--review-ink)]"
        : "bg-[var(--info-soft)] text-[var(--info-ink)]";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>{ENFORCEMENT_LABEL[status]}</span>;
}

function ConflictRow({
  conflict: c,
  decisionLabel,
  overdue,
  open,
  isAdmin,
  deciding,
  busy,
  onStart,
  onCancel,
  onDecide,
}: {
  conflict: DetectedConflict;
  decisionLabel: string;
  overdue: boolean;
  open: boolean;
  isAdmin: boolean;
  deciding: boolean;
  busy: boolean;
  onStart: () => void;
  onCancel: () => void;
  onDecide: (draft: DecisionDraft) => void;
}) {
  const severityTone =
    c.severity === "critical" && !c.dualReleaseMitigated
      ? "bg-[var(--stop-soft)] text-[var(--stop-ink)]"
      : c.severity === "critical" || c.severity === "high"
        ? "bg-[var(--required-soft)] text-[var(--required-ink)]"
        : "bg-[var(--info-soft)] text-[var(--info-ink)]";
  return (
    <>
      <tr className="border-b border-[var(--line)] last:border-0 align-top">
        <td className="px-4 py-3">
          <p className="font-semibold">{c.title}</p>
          <p className="text-xs text-[var(--ink-3)]">{c.why}</p>
        </td>
        <td className="px-4 py-3">
          <p>{c.personName}</p>
          <p className="text-xs text-[var(--ink-3)]">{c.role}</p>
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${severityTone}`}>{SEVERITY_LABEL[c.severity]}</span>
        </td>
        <td className="px-4 py-3">{c.dualReleaseMitigated ? "Yes, by dual release" : "No"}</td>
        <td className="px-4 py-3">
          <span className={overdue ? "font-semibold text-[var(--review-ink)]" : open ? "font-semibold" : ""}>{decisionLabel}</span>
        </td>
        <td className="px-4 py-3 tabular-nums">{c.score}</td>
        {isAdmin && (
          <td className="px-4 py-3">
            {!deciding && (
              <button
                type="button"
                className="text-sm font-semibold text-[var(--link)] underline-offset-2 hover:underline disabled:opacity-50"
                disabled={busy}
                onClick={onStart}
              >
                {open ? "Record decision" : "Supersede"}
              </button>
            )}
          </td>
        )}
      </tr>
      {deciding && (
        <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] last:border-0">
          <td className="px-4 py-3" colSpan={isAdmin ? 7 : 6}>
            <p className="mb-2 text-sm text-[var(--ink-2)]">
              Compensating defaults from the rulebook: {c.compensatingControls.join("; ") || "none listed"}.
            </p>
            <DecisionForm submitLabel="Record decision" busy={busy} onSubmit={onDecide} onCancel={onCancel} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * One detector finding. The detectors own the Status column; the Decision
 * column shows the active decision that governs the row, and an
 * administrator may record one on an open row, or supersede the one it has.
 */
function FindingRow({
  finding: f,
  isAdmin,
  deciding,
  busy,
  onStart,
  onCancel,
  onDecide,
}: {
  finding: FindingItem;
  isAdmin: boolean;
  deciding: boolean;
  busy: boolean;
  onStart: () => void;
  onCancel: () => void;
  onDecide: (draft: DecisionDraft) => void;
}) {
  const d = f.decision;
  return (
    <>
      <tr className="border-b border-[var(--line)] last:border-0 align-top">
        <td className="px-4 py-3">
          <p>{f.kindLabel}</p>
          <p className="text-xs text-[var(--ink-3)]" title={f.subjectId}>
            {f.subjectKind.replace(/_/g, " ")} {shortId(f.subjectId)} · first seen {new Date(f.firstSeenAt).toLocaleDateString()}
            {f.reopenedCount > 0 ? ` · reopened ${f.reopenedCount}×` : ""}
          </p>
        </td>
        <td className="px-4 py-3 capitalize">{f.severity}</td>
        <td className="max-w-prose px-4 py-3">{typeof f.detail.sentence === "string" ? f.detail.sentence : "—"}</td>
        <td className="px-4 py-3">
          {f.status === "open" ? (
            <span className="rounded-md bg-[var(--review-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--review-ink)]">Open</span>
          ) : (
            <span className="text-[var(--ink-2)]">
              Closed{f.closedAt ? ` ${new Date(f.closedAt).toLocaleDateString()}` : ""}
              {f.closedReason ? ` · ${f.closedReason}` : ""}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          {d ? (
            <>
              <p className={d.overdue ? "font-semibold text-[var(--review-ink)]" : "font-semibold"}>
                {d.kindLabel}
                {d.reviewBy ? ` · review ${d.reviewBy}` : ""}
                {d.overdue ? " · overdue" : ""}
              </p>
              <p className="max-w-prose text-xs text-[var(--ink-3)]">{d.note}</p>
            </>
          ) : f.status === "open" ? (
            <span className="font-semibold">No decision yet</span>
          ) : (
            <span className="text-[var(--ink-3)]">—</span>
          )}
        </td>
        {isAdmin && (
          <td className="px-4 py-3">
            {f.status === "open" && !deciding && (
              <button
                type="button"
                className="text-sm font-semibold text-[var(--link)] underline-offset-2 hover:underline disabled:opacity-50"
                disabled={busy}
                onClick={onStart}
                aria-label={`${d ? "Supersede the decision on" : "Decide on"} ${f.kindLabel}: ${
                  typeof f.detail.sentence === "string" ? f.detail.sentence : f.subjectId
                }`}
              >
                {d ? "Supersede" : "Decide"}
              </button>
            )}
          </td>
        )}
      </tr>
      {deciding && (
        <tr className="border-b border-[var(--line)] bg-[var(--surface-2)] last:border-0">
          <td className="px-4 py-3" colSpan={isAdmin ? 6 : 5}>
            <p className="mb-2 text-sm text-[var(--ink-2)]">
              The row stays with the detector: it closes when the condition clears, not when a decision is recorded.
              Whoever the row is about cannot accept its residual or name a compensating control for it.
            </p>
            <DecisionForm submitLabel="Record decision" busy={busy} onSubmit={onDecide} onCancel={onCancel} />
          </td>
        </tr>
      )}
    </>
  );
}
