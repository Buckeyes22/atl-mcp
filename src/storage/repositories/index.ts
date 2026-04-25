// Repository factory — composes all M1+M2 repos into a single bundle so
// callers can inject one object instead of N individual factories.

import type { Database } from "../db.js";
import { createAclRepository, type AclRepository } from "./aclRepository.js";
import { createAgentMemoryRepository, type AgentMemoryRepository } from "./agentMemoryRepository.js";
import { createAuditRepository, type AuditRepository } from "./auditRepository.js";
import { createContextPackRepository, type ContextPackRepository } from "./contextPackRepository.js";
import { createContentQualityReportRepository, type ContentQualityReportRepository } from "./contentQualityReportRepository.js";
import {
  createEncryptedTokenRepository,
  type EncryptedTokenRepository,
} from "./encryptedTokenRepository.js";
import {
  createMcpSessionProfileRepository,
  type McpSessionProfileRepository,
} from "./mcpSessionProfileRepository.js";
import {
  createPolicyDecisionRepository,
  type PolicyDecisionRepository,
} from "./policyDecisionRepository.js";
import { createProjectProfileRepository, type ProjectProfileRepository } from "./projectProfileRepository.js";
import { createProjectRepository, type ProjectRepository } from "./projectRepository.js";
import { createProvisionJobRepository, type ProvisionJobRepository } from "./provisionJobRepository.js";
import { createReadinessRepository, type ReadinessRepository } from "./readinessRepository.js";
import { createTraceLinkRepository, type TraceLinkRepository } from "./traceLinkRepository.js";
import { createWorkAssignmentRepository, type WorkAssignmentRepository } from "./workAssignmentRepository.js";
import { createWebhookDeliveryRepository, type WebhookDeliveryRepository } from "./webhookDeliveryRepository.js";

export interface Repositories {
  readonly project: ProjectRepository;
  readonly agentMemory: AgentMemoryRepository;
  readonly projectProfile: ProjectProfileRepository;
  readonly traceLink: TraceLinkRepository;
  readonly policyDecision: PolicyDecisionRepository;
  readonly mcpSessionProfile: McpSessionProfileRepository;
  readonly acl: AclRepository;
  readonly audit: AuditRepository;
  readonly contextPack: ContextPackRepository;
  readonly contentQualityReport: ContentQualityReportRepository;
  readonly readiness: ReadinessRepository;
  readonly provisionJob: ProvisionJobRepository;
  readonly webhookDelivery: WebhookDeliveryRepository;
  readonly workAssignment: WorkAssignmentRepository;
  /** INTERNAL — wrap with src/security/tokenStore.ts before exposing. */
  readonly encryptedToken: EncryptedTokenRepository;
}

export function createRepositories(db: Database): Repositories {
  return {
    project: createProjectRepository(db),
    agentMemory: createAgentMemoryRepository(db),
    projectProfile: createProjectProfileRepository(db),
    traceLink: createTraceLinkRepository(db),
    policyDecision: createPolicyDecisionRepository(db),
    mcpSessionProfile: createMcpSessionProfileRepository(db),
    acl: createAclRepository(db),
    audit: createAuditRepository(db),
    contextPack: createContextPackRepository(db),
    contentQualityReport: createContentQualityReportRepository(db),
    readiness: createReadinessRepository(db),
    provisionJob: createProvisionJobRepository(db),
    webhookDelivery: createWebhookDeliveryRepository(db),
    workAssignment: createWorkAssignmentRepository(db),
    encryptedToken: createEncryptedTokenRepository(db),
  };
}

export type {
  AclRepository,
  AgentMemoryRepository,
  AuditRepository,
  ContextPackRepository,
  ContentQualityReportRepository,
  EncryptedTokenRepository,
  McpSessionProfileRepository,
  PolicyDecisionRepository,
  ProjectProfileRepository,
  ProjectRepository,
  ProvisionJobRepository,
  ReadinessRepository,
  TraceLinkRepository,
  WebhookDeliveryRepository,
  WorkAssignmentRepository,
};
