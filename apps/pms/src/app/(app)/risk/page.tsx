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
import { DecisionForm, type DecisionDraft } from "../decision-form";
import { Refusal, type RefusalContent } from "./refusal";
import { RegainPanel } from "./regain-panel";
import { DeliveryPanel, type AddressFormState, type AddressResponse } from "../delivery-panel";
import {
  askForCode as askForCodeAct,
  proveAddress as proveAddressAct,
  readDelivery,
  saveAddress as saveAddressAct,
  saveAddressLabel,
  sendNoticesNow as sendNoticesNowAct,
} from "../delivery-acts";

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

type AttestationsResponse = { month: string; items: AttestationRow[] };

type OutstandingResponse = { notices: Notice[]; counts: Record<NoticeSeat, number>; computedAt: string };
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

/** Seats this practice invited that nobody has opened yet (Increments 1.71, 1.73). */
type SeatsResponse = {
  invitations: { userId: string; username: string; displayName: string; invitedAt: string; expiresAt: string }[];
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
  seats: SeatsResponse;
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
  // Inviting the outside accountant's seat (Increment 1.71). The link comes
  // back once and is held only in this render: the rows keep a hash, so a
  // practice that loses it invites again rather than asking for a repeat.
  const [seatUsername, setSeatUsername] = useState("");
  const [seatName, setSeatName] = useState("");
  const [seatLink, setSeatLink] = useState<{ username: string; link: string; expiresAt: string } | null>(null);
  const [seatRefusal, setSeatRefusal] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    const [risk, sod, decisions, exceptions, findings, reasonCodes, attestations, outstanding, delivery, seats] = await Promise.all([
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
      readDelivery(),
      // Seats invited and not yet opened (Increment 1.73), so a practice whose
      // accountant lost the link can send another rather than being stuck with
      // an account nobody can ever sign into.
      getJson<SeatsResponse>("/api/controls/seats"),
    ]);
    return { risk, sod, decisions, exceptions, findings, reasonCodes, attestations, outstanding, delivery, seats };
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
   * The four delivery acts, each in the words `delivery-acts` gives it
   * (shared since Increment 1.74). What stays here is what belongs to this
   * screen: which control is busy, where the sentence goes, and the draft the
   * saved value replaces.
   */
  async function saveAddress(address: string) {
    await run(
      saveAddressLabel(address),
      async () => {
        const note = await saveAddressAct(address);
        setAddressDraft(null);
        return note;
      },
      false
    );
  }

  async function sendNoticesNow() {
    await run("Send this to me now", () => sendNoticesNowAct(), false);
  }

  async function askForCode() {
    await run("Send me a code", () => askForCodeAct(), false);
  }

  async function proveAddressNow(code: string) {
    await run(
      "Prove this address",
      async () => {
        const note = await proveAddressAct(code);
        setCodeDraft("");
        return note;
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

  /**
   * Invites the outside accountant's seat (Increment 1.71).
   *
   * The practice names the seat and never its password: what comes back is a
   * link to hand over, and the person on the other end chooses the secret.
   */
  async function inviteAccountantSeat() {
    setBusy("Invite");
    setMessage(null);
    setSeatRefusal(null);
    try {
      const res = await fetch("/api/controls/seats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: seatUsername, displayName: seatName }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        username?: string;
        link?: string;
        expiresAt?: string;
      };
      if (!res.ok) {
        setSeatRefusal(body.error ?? "The invitation failed.");
        return;
      }
      setSeatLink({ username: body.username ?? seatUsername, link: body.link ?? "", expiresAt: body.expiresAt ?? "" });
      setSeatUsername("");
      setSeatName("");
      // Re-read, so the seat just invited appears among those waiting to be
      // opened (Increment 1.73). Without this the panel showed the link once
      // and then nothing, and a practice that mislaid it had no row to act on.
      await refresh(false);
    } catch (err: unknown) {
      setSeatRefusal(err instanceof Error ? err.message : "The invitation failed.");
    } finally {
      setBusy(null);
    }
  }

  /**
   * Sends another link to a seat whose first one went astray
   * (Increment 1.73). The seat itself is untouched: same person, same
   * username, same grant — only the secret is new, and the older link stops
   * working because the read requires the invitation in force.
   */
  async function reinvite(userId: string, name: string) {
    setBusy("Invite");
    setMessage(null);
    setSeatRefusal(null);
    try {
      const res = await fetch("/api/controls/seats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; username?: string; link?: string; expiresAt?: string };
      if (!res.ok) {
        setSeatRefusal(body.error ?? "The new link could not be sent.");
        return;
      }
      setSeatLink({ username: body.username ?? name, link: body.link ?? "", expiresAt: body.expiresAt ?? "" });
      await refresh(false, `Sent a new link for ${name}. The old one no longer works.`);
    } catch (err: unknown) {
      setSeatRefusal(err instanceof Error ? err.message : "The new link could not be sent.");
    } finally {
      setBusy(null);
    }
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
          seatForm={{
            username: seatUsername,
            setUsername: setSeatUsername,
            name: seatName,
            setName: setSeatName,
            link: seatLink,
            refusal: seatRefusal,
            submit: () => void inviteAccountantSeat(),
            open: state.data.seats.invitations,
            reinvite: (id, name) => void reinvite(id, name),
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
/**
 * Inviting the outside accountant's seat (Increment 1.71). The link comes back
 * once and lives only in this render: the rows keep a hash of it, so a practice
 * that loses it invites again rather than asking for a repeat.
 */
type SeatFormState = {
  username: string;
  setUsername: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  link: { username: string; link: string; expiresAt: string } | null;
  refusal: string | null;
  submit: () => void;
  /** Seats invited and not yet opened, one live link each (Increment 1.73). */
  open: SeatsResponse["invitations"];
  reinvite: (userId: string, name: string) => void;
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
  seatForm,
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
  seatForm: SeatFormState;
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
      {/* Inviting the seat the practice cannot otherwise create (Increment 1.71).
          `users` was written by the seed and by nothing else, so a practice
          that wanted an outside accountant could not have one — and the reading
          below would report an accountant who never said where to send their
          messages without offering any way to add one. Only this seat, and only
          the owner: it pairs with no duty in the SoD rulebook (1.49), so
          inviting it creates no conflict, while a general invite would be a
          grant path around `evaluateGrant`. */}
      {isAdmin ? (
        <section aria-labelledby="invite-seat" className="mb-10">
          <h2 id="invite-seat" className="mb-1 text-lg font-semibold">
            Invite the outside accountant
          </h2>
          <p className="mb-3 max-w-prose text-sm text-[var(--ink-2)]">
            The seat reaches the month-end package and no other screen, and it holds no patient record. You name it; the
            person you name sets their own password, which this practice never learns and cannot set for them. A firm&rsquo;s
            shared mailbox holds the seat the same way a person does.
          </p>
          <div className="grid gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:max-w-xl">
            <label htmlFor="seat-username" className="text-sm font-semibold text-[var(--ink)]">
              Username they will sign in with
            </label>
            <input
              id="seat-username"
              value={seatForm.username}
              onChange={(e) => seatForm.setUsername(e.target.value)}
              placeholder="firm-accounting"
              className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-2"
            />
            <label htmlFor="seat-name" className="text-sm font-semibold text-[var(--ink)]">
              What this practice&rsquo;s screens will call them
            </label>
            <input
              id="seat-name"
              value={seatForm.name}
              onChange={(e) => seatForm.setName(e.target.value)}
              placeholder="Prentice &amp; Co"
              className="rounded-[var(--radius)] border border-[var(--line)] px-3 py-2"
            />
            <button
              id="invite-seat-submit"
              type="button"
              disabled={busy !== null || seatForm.username.trim() === "" || seatForm.name.trim() === ""}
              onClick={seatForm.submit}
              className="justify-self-start rounded-[var(--radius)] bg-navy px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {busy === "Invite" ? "Inviting…" : "Invite this seat"}
            </button>
            {seatForm.refusal ? (
              <p aria-live="polite" className="max-w-prose text-sm text-[var(--ink-2)]">
                {seatForm.refusal}
              </p>
            ) : null}
            {seatForm.open.length > 0 ? (
              <div className="grid gap-2 rounded-md border border-[var(--line)] p-3">
                <p className="text-sm font-semibold text-[var(--ink)]">Invited, not yet opened</p>
                <p className="max-w-prose text-sm text-[var(--ink-2)]">
                  A link works for a week and only once. If one went astray, send another — the seat keeps its
                  username and its place, and the older link stops working.
                </p>
                <ul className="grid gap-2">
                  {seatForm.open.map((seat) => (
                    <li key={seat.userId} className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-[var(--ink-2)]">
                        {seat.displayName}{" "}
                        <span className="text-[var(--ink-3)]">
                          ({seat.username}) &middot; link works until {seat.expiresAt.slice(0, 10)}
                        </span>
                      </span>
                      <button
                        id={`reinvite-${seat.userId}`}
                        type="button"
                        disabled={busy !== null}
                        onClick={() => seatForm.reinvite(seat.userId, seat.displayName)}
                        className="rounded-[var(--radius)] border border-[var(--line-strong)] px-3 py-1 text-sm font-semibold text-[var(--link)] disabled:opacity-60"
                      >
                        Send a new link
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
                        {seatForm.link ? (
              <div aria-live="polite" className="grid gap-2 rounded-md border border-[var(--line)] p-3">
                <p className="max-w-prose text-sm text-[var(--ink-2)]">
                  Send this link to {seatForm.link.username}. It works until {seatForm.link.expiresAt.slice(0, 10)}, once only, and
                  this screen is the only place it appears — the practice keeps a hash of it and cannot show it again.
                </p>
                <code className="break-all rounded bg-[var(--surface-2,transparent)] p-2 text-xs">{seatForm.link.link}</code>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Increment 1.77. A person whose authenticator is gone cannot reach the
          screen Increment 1.76 built, because that screen needs a session they
          cannot get. Two administrators can. A manager reads this and an
          administrator acts on it, which is how a practice learns whom to ask
          — and, where it has one administrator, why nobody can. */}
      <RegainPanel isAdmin={isAdmin} />

      <DeliveryPanel delivery={delivery} form={addressForm} busy={busy} />

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
