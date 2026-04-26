import { createHash } from "node:crypto";
import type { ArtifactRef } from "../domain/artifactRef.js";
import type { TenantScope } from "../domain/tenantScope.js";
import { verifyHubSignature } from "../security/webhookSignatures.js";
import type { WebhookDeliveryRepository } from "../storage/repositories/index.js";

export interface GraphChangeEvent {
  readonly id: string;
  readonly source: string;
  readonly artifactRef: ArtifactRef;
  readonly observedAt: string;
  readonly changeType: "created" | "updated" | "deleted";
}

export interface WebhookIngestionInput {
  readonly source: string;
  readonly timestamp: string;
  readonly signatureHeader: string;
  readonly rawBody: string;
}

export function createWebhookIngestionWorkflow(deps: {
  readonly deliveries: WebhookDeliveryRepository;
  readonly secrets: Readonly<Record<string, string>>;
}) {
  return {
    async ingest(scope: TenantScope, input: WebhookIngestionInput): Promise<{ readonly accepted: boolean; readonly event?: GraphChangeEvent }> {
      const secret = deps.secrets[input.source];
      if (!secret) throw new Error(`webhook secret is not configured for source: ${input.source}`);
      if (!verifyHubSignature({ signatureHeader: input.signatureHeader, body: input.rawBody, secret })) {
        throw new Error("webhook signature verification failed");
      }
      const content = parseRawBody(input.rawBody);
      const id = dedupKey(input.source, input.timestamp, input.rawBody);
      const recorded = await deps.deliveries.recordOnce(scope, { id, source: input.source, observedAt: input.timestamp });
      if (!recorded) return { accepted: false };
      return {
        accepted: true,
        event: {
          id,
          source: input.source,
          artifactRef: normalizeArtifact(input.source, content),
          observedAt: input.timestamp,
          changeType: "updated",
        },
      };
    },
};
}

export function dedupKey(source: string, timestamp: string, rawBody: string): string {
  return createHash("sha256").update(`${source}:${timestamp}:${rawBody}`).digest("hex");
}

function normalizeArtifact(source: string, content: unknown): ArtifactRef {
  const value = content as Record<string, unknown>;
  if (source === "jira") return { kind: "jira_issue", id: String(value["issue"] ?? value["key"] ?? "unknown") };
  if (source === "confluence") return { kind: "confluence_page", id: String(value["pageId"] ?? value["id"] ?? "unknown") };
  return { kind: "vcs_repo", id: String(value["repo"] ?? "unknown") };
}

function parseRawBody(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error("webhook rawBody must be valid JSON");
  }
}
