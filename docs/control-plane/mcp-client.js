// Minimal MCP-over-HTTP client for the operator control plane.
// Talks JSON-RPC 2.0 to the admin /mcp transport (ADR 0006), co-hosted on
// the same loopback origin as the UI assets.
//
// Design:
// - Lazy initialize: the first callTool() opens an MCP session.
// - Single shared session reused across all calls (UI is single-tab-single-operator).
// - On 404 / session-not-found, re-initialize once and retry.
// - Streamable transport responses can be SSE-framed JSON; we extract the
//   single `data:` line that carries the JSON-RPC result.
//
// Exposes: window.MCP_CLIENT.callTool(name, args) → Promise<{result?, error?}>
//          window.MCP_CLIENT.lastError              ← last error, for UI debug
//          window.MCP_CLIENT.callId                 ← monotonically increasing call counter

(function () {
  const DEFAULT_LOOPBACK_ENDPOINT = "http://127.0.0.1:3001/mcp";
  const ENDPOINT_STORAGE_KEY = "atl-mcp-admin-mcp-endpoint";
  const PROTOCOL_VERSION = "2024-11-05";

  let endpoint = null;
  let sessionId = null;
  let initializingPromise = null;
  let callCounter = 0;
  let lastError = null;

  function nextId() {
    callCounter += 1;
    return callCounter;
  }

  function parseTransportResponse(text) {
    // Streamable transport answers either with raw JSON or SSE-framed JSON
    // (the `data:` line). Try SSE first.
    const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
    const json = dataLine ? dataLine.slice(5).trim() : text.trim();
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
  }

  function safeLocalStorageGet(key) {
    try { return window.localStorage ? window.localStorage.getItem(key) : null; } catch { return null; }
  }

  function safeLocalStorageSet(key, value) {
    try { if (window.localStorage) window.localStorage.setItem(key, value); } catch {}
  }

  function normalizeEndpoint(value) {
    if (!value || typeof value !== "string") return null;
    try {
      return new URL(value, window.location.href).href;
    } catch {
      return null;
    }
  }

  function configuredEndpoint() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("mcp") || params.get("mcpEndpoint") || params.get("adminMcp");
    const fromGlobal = typeof window.CP_MCP_ENDPOINT === "string" ? window.CP_MCP_ENDPOINT : null;
    return normalizeEndpoint(fromQuery || fromGlobal || safeLocalStorageGet(ENDPOINT_STORAGE_KEY));
  }

  function sameOriginEndpoint() {
    if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return null;
    return normalizeEndpoint(`${window.location.origin}/mcp`);
  }

  function isLoopbackHost(hostname) {
    const h = String(hostname || "").toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]";
  }

  function candidateEndpoints() {
    const configured = configuredEndpoint();
    const sameOrigin = sameOriginEndpoint();
    const isLoopback = isLoopbackHost(window.location.hostname);
    const isDefaultMgmtPort = window.location.port === "3001";
    const candidates = isLoopback && !isDefaultMgmtPort
      ? [configured, DEFAULT_LOOPBACK_ENDPOINT, sameOrigin]
      : [configured, sameOrigin, (window.location.protocol === "file:" || isLoopback) ? DEFAULT_LOOPBACK_ENDPOINT : null];
    return [...new Set(candidates.filter(Boolean))];
  }

  function endpointForRequest() {
    if (!endpoint) endpoint = candidateEndpoints()[0] || DEFAULT_LOOPBACK_ENDPOINT;
    return endpoint;
  }

  function endpointHint(tried) {
    const triedText = tried && tried.length ? ` Tried: ${tried.join(", ")}.` : "";
    return `admin MCP endpoint unavailable.${triedText} Open the control plane from http://127.0.0.1:3001/ui/ or set ?mcp=http://127.0.0.1:3001/mcp.`;
  }

  async function rpc(body, withSession) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
    };
    if (withSession && sessionId) headers["mcp-session-id"] = sessionId;
    const activeEndpoint = endpointForRequest();
    let res;
    try {
      res = await fetch(activeEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      const e = new Error(`admin MCP endpoint ${activeEndpoint} could not be reached (${message})`);
      e.cause = err;
      throw e;
    }
    // initialize response carries the new session id in a header.
    const newSid = res.headers.get("mcp-session-id");
    if (newSid && !sessionId) sessionId = newSid;
    if (res.status === 404) {
      // session lost on the server side — caller will re-init and retry.
      sessionId = null;
      throw new Error("session_not_found");
    }
    const text = await res.text();
    if (!res.ok) {
      const clipped = text ? `: ${text.slice(0, 160)}` : "";
      throw new Error(`admin MCP endpoint ${activeEndpoint} returned HTTP ${res.status}${clipped}`);
    }
    const json = parseTransportResponse(text);
    return json;
  }

  async function initialize() {
    if (initializingPromise) return initializingPromise;
    initializingPromise = (async () => {
      const candidates = candidateEndpoints();
      let last = null;
      for (const candidate of candidates) {
        endpoint = candidate;
        sessionId = null;
        try {
          const initBody = {
            jsonrpc: "2.0",
            id: nextId(),
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "atl-mcp-operator-ui", version: "1.0.0" },
            },
          };
          await rpc(initBody, false);
          // notifications/initialized — fire-and-forget; the spec mandates this
          // before any other request after initialize.
          await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, true).catch(() => {});
          return;
        } catch (err) {
          last = err;
        }
      }
      const suffix = last && last.message ? ` Last error: ${last.message}` : "";
      throw new Error(endpointHint(candidates) + suffix);
    })();
    try {
      await initializingPromise;
    } finally {
      initializingPromise = null;
    }
  }

  async function callTool(name, args) {
    if (!sessionId) await initialize();
    const body = {
      jsonrpc: "2.0",
      id: nextId(),
      method: "tools/call",
      params: { name, arguments: args ?? {} },
    };
    let response;
    try {
      response = await rpc(body, true);
    } catch (err) {
      if (err && err.message === "session_not_found") {
        await initialize();
        response = await rpc(body, true);
      } else {
        lastError = err;
        throw err;
      }
    }
    if (!response) {
      const e = new Error(`empty response from ${name}`);
      lastError = e;
      throw e;
    }
    if (response.error) {
      const e = new Error(response.error.message || `tool ${name} failed`);
      e.code = response.error.code;
      e.data = response.error.data;
      lastError = e;
      throw e;
    }
    // Tool result: { content, structuredContent }
    return response.result;
  }

  function getSessionId() { return sessionId; }
  function getEndpoint() { return endpointForRequest(); }
  function setEndpoint(nextEndpoint) {
    const normalized = normalizeEndpoint(nextEndpoint);
    if (!normalized) throw new Error(`invalid admin MCP endpoint: ${nextEndpoint}`);
    endpoint = normalized;
    sessionId = null;
    safeLocalStorageSet(ENDPOINT_STORAGE_KEY, normalized);
  }
  function reset() { sessionId = null; initializingPromise = null; }

  window.MCP_CLIENT = {
    callTool,
    initialize,
    getSessionId,
    getEndpoint,
    setEndpoint,
    reset,
    get lastError() { return lastError; },
    get callId() { return callCounter; },
  };
})();
