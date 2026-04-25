// ConfluenceProvider interface. M2 ships capability discovery; M6b ships the
// page provisioning logic.
//
// Body representation: storage (XHTML) by default. atlas_doc_format is a
// feature flag — see ADR 0003. The interface accepts both; the implementation
// rejects atlas_doc_format unless the feature flag is on (and the space
// supports it per capability discovery).

import type { Provider } from "../Provider.js";
import type { ConfluenceSpaceProfile } from "../../domain/projectProfile.js";

export type ConfluenceBodyRepresentation = "storage" | "atlas_doc_format";

export interface ConfluenceProvider extends Provider {
  readonly kind: "atlassian.confluence";
  discoverSpaceCapabilities(spaceKeyOrId: string): Promise<ConfluenceSpaceProfile>;
  getPage(pageId: string): Promise<ConfluencePage>;
  createPage(input: CreatePageInput): Promise<ConfluencePage>;
  updatePage(pageId: string, patch: UpdatePagePatch): Promise<ConfluencePage>;
  /** Read a content property (e.g., orchestrator metadata block). */
  getContentProperty(pageId: string, key: string): Promise<ContentProperty | undefined>;
  /** Write a content property. M6b uses this for orchestrator metadata. */
  setContentProperty(pageId: string, key: string, value: unknown): Promise<ContentProperty>;
}

export interface ConfluencePage {
  readonly id: string;
  readonly spaceId: string;
  readonly title: string;
  readonly version: number;
  readonly body: ConfluenceBody | undefined;
}

export interface ConfluenceBody {
  readonly representation: ConfluenceBodyRepresentation;
  readonly value: string;
}

export interface CreatePageInput {
  readonly spaceId: string;
  readonly title: string;
  readonly body: ConfluenceBody;
  readonly parentId?: string;
  readonly idempotencyKey?: string;
}

export interface UpdatePagePatch {
  readonly title?: string;
  readonly body?: ConfluenceBody;
  /** Confluence v2 requires the prior version on update; supply `existingVersion + 1`. */
  readonly version: number;
}

export interface ContentProperty {
  readonly key: string;
  readonly value: unknown;
  readonly version: number;
}
