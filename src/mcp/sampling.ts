import type {
  CreateMessageRequest,
  CreateMessageRequestParams,
  CreateMessageResult,
  SamplingMessageContentBlock,
} from "@modelcontextprotocol/sdk/types.js";
import type { SessionRegistry } from "./sessionCapabilities.js";

export interface SamplingTraceInput {
  readonly projectId: string;
  readonly blueprintVersion?: number;
  readonly promptVersion: string;
  readonly toolName?: string;
}

export interface SamplingRequest {
  readonly prompt: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly trace: SamplingTraceInput;
}

export type SamplingResult =
  | { readonly used: true; readonly provider: string; readonly model?: string; readonly text: string }
  | { readonly used: false; readonly reason: string };

export interface SamplingAdapter {
  sample(request: SamplingRequest): Promise<SamplingResult>;
}

export function createDisabledSamplingAdapter(reason = "sampling adapter unavailable"): SamplingAdapter {
  return {
    async sample() {
      return { used: false, reason };
    },
  };
}

export function createHostDelegatedSamplingAdapter(args: {
  readonly sessionRegistry: SessionRegistry;
  readonly resolveCurrentSessionId: () => string | undefined;
  readonly createMessage: (params: CreateMessageRequest["params"]) => Promise<CreateMessageResult>;
}): SamplingAdapter {
  return {
    async sample(request) {
      const sessionId = args.resolveCurrentSessionId();
      if (!sessionId) return { used: false, reason: "no active MCP session" };
      const profile = args.sessionRegistry.get(sessionId);
      const disabled = profile?.featuresDisabled.find((f) => f.feature === "sampling");
      if (!profile?.featuresEnabled.includes("sampling")) {
        return { used: false, reason: disabled?.reason ?? "client did not advertise sampling capability" };
      }

      const params: CreateMessageRequestParams = {
        messages: [{ role: "user", content: { type: "text", text: request.prompt } }],
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        includeContext: "thisServer",
      };
      const response = await args.createMessage(params);
      return {
        used: true,
        provider: "mcp_host",
        ...(response.model !== undefined ? { model: response.model } : {}),
        text: contentToText(response.content),
      };
    },
  };
}

function contentToText(content: SamplingMessageContentBlock | SamplingMessageContentBlock[]): string {
  const blocks = Array.isArray(content) ? content : [content];
  return blocks
    .map((block) => {
      if (block.type === "text") return block.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
