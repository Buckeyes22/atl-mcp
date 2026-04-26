export const MODEL_CONTEXT_WINDOWS: Readonly<Record<string, number>> = {
  "claude-sonnet-4-6": 200_000,
  "claude-opus-4-1": 200_000,
  "gpt-5.2": 400_000,
  "gpt-5.4": 400_000,
  "gpt-5.5": 400_000,
  "gemini-2.5-pro": 1_000_000,
  "llama-4": 128_000,
  "mistral-large": 128_000,
  "qwen3-coder": 256_000,
  "deepseek-v3": 128_000,
  "o3": 200_000,
  "o4-mini": 200_000,
  "gpt-4.1": 1_000_000,
  "gpt-4.1-mini": 1_000_000,
  "claude-haiku-3-5": 200_000,
  "claude-sonnet-3-7": 200_000,
  "gemini-2.0-flash": 1_000_000,
  "command-r-plus": 128_000,
  "mixtral-8x22b": 64_000,
  "codestral": 256_000,
  "phi-4": 128_000,
  "local-small": 32_000,
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
