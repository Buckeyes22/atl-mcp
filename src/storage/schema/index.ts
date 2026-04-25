// Barrel re-export for the Drizzle schema. Pass this object to drizzle() so
// the typed query API is available across all tables: db.query.projects, etc.

export * from "./aclEntries.js";
export * from "./agentMemoryEntries.js";
export * from "./auditEntries.js";
export * from "./contextPacks.js";
export * from "./contentQualityReports.js";
export * from "./encryptedTokens.js";
export * from "./mcpSessionProfiles.js";
export * from "./policyDecisions.js";
export * from "./projectProfiles.js";
export * from "./projects.js";
export * from "./provisionJobs.js";
export * from "./readinessReports.js";
export * from "./traceLinks.js";
export * from "./workAssignments.js";
export * from "./webhookDeliveries.js";

import { aclEntries } from "./aclEntries.js";
import { agentMemoryEntries } from "./agentMemoryEntries.js";
import { auditEntries } from "./auditEntries.js";
import { contextPacks } from "./contextPacks.js";
import { contentQualityReports } from "./contentQualityReports.js";
import { encryptedTokens } from "./encryptedTokens.js";
import { mcpSessionProfiles } from "./mcpSessionProfiles.js";
import { policyDecisions } from "./policyDecisions.js";
import { projectProfiles } from "./projectProfiles.js";
import { projects } from "./projects.js";
import { provisionJobs } from "./provisionJobs.js";
import { readinessReports } from "./readinessReports.js";
import { traceLinks } from "./traceLinks.js";
import { workAssignments } from "./workAssignments.js";
import { webhookDeliveries } from "./webhookDeliveries.js";

export const allTables = {
  aclEntries,
  agentMemoryEntries,
  auditEntries,
  contextPacks,
  contentQualityReports,
  encryptedTokens,
  mcpSessionProfiles,
  policyDecisions,
  projectProfiles,
  projects,
  provisionJobs,
  readinessReports,
  traceLinks,
  workAssignments,
  webhookDeliveries,
} as const;
