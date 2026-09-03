# ADR 12: AI assist timing and provider

**Status:** Proposed (awaiting owner confirmation)

## Context

See `docs/10-decisions-for-owner.md`, row 12, and the design and security documents this decision affects.

## Options

(a) Phase 5 behind a BAA-covered provider with a field-level gate; (b) Phase 3 alongside the clinical record

## Recommendation

(a); provider chosen at Phase 4 on one rubric (signed BAA, retention terms, no training on inputs, US residency, model-level eligibility) among Amazon Bedrock (under the AWS BAA, no new subprocessor), Azure OpenAI, Anthropic, or xAI (its API offers a BAA on approval with zero-data-retention); precog's hard-coded Grok call and Grok-federated identity are removed with the shell either way; included in the price, never metered

## Why

The deterministic engine is the moat and "AI-powered" claims are a live attack line; deferring cedes the ambient-AI lane short-term but avoids a third-party PHI egress before the SOC 2 report and the SRA exist
