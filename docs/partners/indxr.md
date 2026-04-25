# Partner Integration: indxr

## 1. Why this partner

**Category: B (pattern-lift).** indxr is a Rust MCP server contributing two architectural patterns to v6:

1. **Streamable HTTP transport** (§22.1, M0; F-051): axum + tokio + SSE with 1h sliding TTL and 1000 concurrent sessions — the reference implementation for HTTP-based MCP transport with backpressure handling and session lifecycle management.
2. **5-step progressive truncation** (§16.2; F-052): doc comments → private decls → children → leaf files → final, with file-importance scoring (entry points +100, public-API count +3, path depth -5/level). Directly applicable to context-pack generation when managing codebase context.

**Gap closed**: v6 §16.2 requires a deterministic truncation strategy for large codebases; v6 §22.1 requires concrete guidance on SSE server patterns. indxr's axum implementation and ordered truncation are the best references surveyed.

**Alternatives considered**: implement both from first principles — rejected because indxr already solves both at production quality, and pattern adoption is faster than reimplementation.

Findings reference: `repo-extraction-findings.md` lines 501–513, §40 F-051, F-052.

## 2. Prerequisites

N/A — pattern-lift; no runtime dependency. The patterns transfer to Node.js + TypeScript:
- **Transport**: axum + tokio → Express/Fastify with native async/await; SSE via Node `res.write()` + `writableNeedDrain` for backpressure.
- **Truncation**: language-agnostic; implement in TS alongside context-pack generation.
- No Rust dependency required.

## 3. Source provenance

`indxr` repository (Rust). Pin commit SHA in v6 §40 F-051/F-052 rows. **No install required**: extract architectural patterns via code review; port to TS in `src/transport/streamableHttp.ts` and `src/context/truncation.ts`.

## 4. Configuration

### 4.1 Environment variables

N/A — pattern-lift. Configuration lives in orchestrator config.

### 4.2 Config file overlays

```yaml
transport:
  streamableHttp:
    sessionTtlMinutes: 60            # sliding window; reset on each message
    sseKeepAliveIntervalMs: 20000    # prevent 30s proxy timeout (indxr default)
    maxConcurrentSessions: 1000
    backpressureThresholdBytes: 65536

context:
  truncation:
    steps:
      - doc_comments
      - private_decls
      - children
      - leaf_files
      - final_cut
```

## 5. Adoption points in v6

- **F-051** → **§22.1** (Streamable HTTP transport architecture: axum + tokio + SSE + 1h sliding TTL + 1000 concurrent sessions); **M0** (initial scaffolding ships the streamable HTTP transport handler).
- **F-052** → **§16.2** (5-step progressive truncation order with file-importance scoring; applied to context-pack assembly when token budget exceeded).

## 6. Pattern excerpts

**SSE handler with sliding TTL** (`src/transport/streamableHttp.ts`):
```ts
async function sseHandler(req: Request, res: Response, sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).send({ error: "session not found" });

  session.lastActivity = Date.now();   // sliding TTL refresh
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const keepAlive = setInterval(() => {
    if (res.writableNeedDrain) return;  // backpressure-aware
    res.write(":keep-alive\n\n");
  }, config.sseKeepAliveIntervalMs);    // 20s default (indxr)

  session.on("message", (msg) => {
    if (!res.writableNeedDrain) {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    }
  });

  req.on("close", () => clearInterval(keepAlive));
}
```

**5-step truncation order** (`src/context/truncation.ts`):
```ts
function progressivelyTruncate(files: CodeFile[], budget: number): CodeFile[] {
  const steps: TruncStep[] = [
    { name: "doc_comments",  cost: 1 },
    { name: "private_decls", cost: 2 },
    { name: "children",      cost: 3 },
    { name: "leaf_files",    cost: 4 },
    { name: "final_cut",     cost: 5 },
  ];
  // For each step: rank by importance (entryPoints*100 + publicApiCount*3 - depth*5)
  // Drop lowest until cumulative tokens < budget
}
```

## 7. Gotchas

1. **SSE keep-alive frequency vs 30s proxy timeout**: indxr sends keep-alive every 20s. Many proxies (AWS ALB, nginx default, Envoy) timeout idle streams at 30s. Increasing keep-alive interval beyond 25s requires explicit proxy config (e.g., nginx `proxy_read_timeout 120s`). (findings.md L505; F-051)
2. **Session ID rotation on reconnect**: indxr generates a new session ID per new SSE connection. Clients must request a fresh ID on reconnect — old IDs expire after the 1h sliding TTL. (findings.md L503; F-051)
3. **Truncation order matters — do not reorder steps**: removing steps 1–3 early may seem efficient but skips high-signal low-cost data (doc comments). The five-step order is data-density-optimized; reordering breaks importance scoring. Follow indxr's order exactly. (findings.md L505; F-052)
4. **Max-concurrent backpressure**: indxr caps at 1000 concurrent SSE sessions. At 1001, new connections are queued. Monitor `currentSessions` counter; emit `INVESTIGATE` observability signal at 900+. (findings.md L503; F-051)
5. **`writableNeedDrain` must be checked on every write**: skipping the check causes Node to buffer unbounded data on slow consumers. Always gate `res.write()` on `!res.writableNeedDrain`. (findings.md L506; F-051)

## 8. Validation

```bash
# 1. Verify §22.1 cites SSE handler + sliding TTL
grep -nE "sseKeepAliveIntervalMs|sliding.*TTL|streamable" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 2. Verify §16.2 contains 5-step order
grep -nE "doc.*comment|private.*decl|children|leaf.*file" agent-context-orchestrator-mcp-plan-v6.md | head -5

# 3. Confirm orchestrator constants match
grep -n "20000\|sseKeepAliveIntervalMs" src/transport/streamableHttp.ts
grep -n "maxConcurrentSessions.*1000" src/transport/streamableHttp.ts
```

## 9. Operational concerns

- **Upstream archival risk: low.** Patterns (SSE handler with sliding TTL, 5-step truncation) are absorbed into `src/transport/streamableHttp.ts` and `src/context/truncation.ts`. If indxr is archived, no impact.
- **Pattern update path**: if indxr publishes refinements (e.g., adaptive keep-alive based on proxy detection), evaluate via §40 findings update and bump §22.1 / §16.2 if adopted.
- **Ownership**: orchestrator team owns the TS implementations; indxr maintainers own the Rust reference. No joint artifacts.
- **Promotion**: not applicable — orchestrator owns the implementation.
