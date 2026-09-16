# ADR 12: AI assist timing and provider

**Status:** Accepted, amended (owner, 2026-09-14)

## Context

See `docs/10-decisions-for-owner.md`, row 12, and the design and security documents this decision affects. SuperByte stays **one-way**: staff never prompt, chat, or rate; the LLM only proposes.

## Options

(a) Phase 5 behind a BAA-covered provider with a field-level gate; (b) Phase 3 alongside the clinical record

## Recommendation

(a) for the **provider call**; amended so the deterministic twin and the cage are not deferred. Provider chosen at Phase 4 on one rubric (signed BAA, retention terms, no training on inputs, US residency, model-level eligibility) among Amazon Bedrock (under the AWS BAA, no new subprocessor), Azure OpenAI, Anthropic, or xAI (its API offers a BAA on approval with zero-data-retention); precog's hard-coded Grok call and Grok-federated identity are removed with the shell either way; included in the price, never metered.

**Amendment (Increment 0.1).** `packages/clinical-kb` (Byte `advise()`, versioned cited knowledge base, `KB_VERSION`) and the SuperByte cage (`config`, `escape`, `ladder`, `one-way`, `router`, silent `BYTESTAR_KILL`) ship in Phase 0 with `BYTESTAR_ENABLED` default off and no provider key required to boot. Byte appears on the Encounter in Phase 3. The LLM provider call, N-read consensus against a live model, and any PHI egress remain Phase 5. Ambient / PTT scribe remains Phase 5 behind the existing `DictationEngine` seam. Twin CI tests (`verifyMeaning` on every capability) start in Phase 0. Never claim "AI-powered." Never show a confidence percentage. Never train on filed notes.

## Why

The deterministic engine is the moat and "AI-powered" claims are a live attack line; deferring the *model* cedes the ambient-AI lane short-term but avoids a third-party PHI egress before the SOC 2 report and the SRA exist. Deferring the *knowledge base and cage* would leave a 23-entry advisor that cannot be called industry-leading. See `docs/17-competitive-enhancement-review.md`.
