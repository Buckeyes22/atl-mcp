// Actor attribution helpers — propagate originating-principal identity into
// downstream artifacts (Jira labels, content metadata blocks, commit trailers,
// PR description blocks, audit log) per FM-5 (v6 §34).
//
// Format conventions per docs/partners/agentdiff.md:
//   - Jira label:        orchestrator-actor-<fingerprint>
//   - Metadata block:    <!-- orchestrator-attribution: {...} -->
//   - Commit trailer:    Orchestrator-Actor-Fingerprint: <fingerprint>
//                        Orchestrator-Audit-Id: <auditEntryId>
//
// M2 ships the helpers; M5 + M6a/b/c apply them when generating artifact plans.

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

export interface ActorAttribution {
  readonly fingerprint: string;       // 16-hex of sha256(principalId)
  readonly principalId: string;       // never written verbatim to public artifacts
  readonly authMode: "api_token" | "oauth3lo" | "service_account";
}

export function buildActorAttribution(args: {
  principalId: string;
  authMode: ActorAttribution["authMode"];
}): ActorAttribution {
  const fingerprint = bytesToHex(sha256(utf8ToBytes(args.principalId))).slice(0, 16);
  return { fingerprint, principalId: args.principalId, authMode: args.authMode };
}

/** A Jira label safe for storage (no spaces, ≤255 chars per Jira API). */
export function jiraActorLabel(attribution: ActorAttribution): string {
  return `orchestrator-actor-${attribution.fingerprint}`;
}

/** HTML-comment-wrapped metadata block for Confluence pages and PR descriptions. */
export function metadataBlock(args: {
  attribution: ActorAttribution;
  auditEntryId?: string;
  extra?: Readonly<Record<string, unknown>>;
}): string {
  const payload: Record<string, unknown> = {
    actorFingerprint: args.attribution.fingerprint,
    authMode: args.attribution.authMode,
    ...(args.auditEntryId ? { auditEntryId: args.auditEntryId } : {}),
    ...(args.extra ?? {}),
  };
  return `<!-- orchestrator-attribution: ${JSON.stringify(payload)} -->`;
}

/** Git commit trailer lines (newline-separated). */
export function commitTrailers(args: {
  attribution: ActorAttribution;
  auditEntryId?: string;
}): string {
  const lines = [`Orchestrator-Actor-Fingerprint: ${args.attribution.fingerprint}`];
  if (args.auditEntryId) lines.push(`Orchestrator-Audit-Id: ${args.auditEntryId}`);
  return lines.join("\n");
}
