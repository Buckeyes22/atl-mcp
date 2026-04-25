import {
  buildActorAttribution,
  jiraActorLabel,
  metadataBlock,
} from "../providers/atlassian/auth/actorAttribution.js";
import type { PlanActorAttribution } from "./artifactPlan.js";

export function buildPlanActorAttribution(input: {
  readonly principalId: string;
  readonly authMode?: "api_token" | "oauth3lo" | "service_account";
  readonly blueprintVersion: number;
  readonly toolName: string;
}): PlanActorAttribution {
  const attribution = buildActorAttribution({
    principalId: input.principalId,
    authMode: input.authMode ?? "api_token",
  });
  return {
    principalId: attribution.principalId,
    fingerprint: attribution.fingerprint,
    authMode: attribution.authMode,
    jiraLabel: jiraActorLabel(attribution),
    metadataBlock: metadataBlock({
      attribution,
      extra: { blueprintVersion: input.blueprintVersion, toolName: input.toolName },
    }),
  };
}
