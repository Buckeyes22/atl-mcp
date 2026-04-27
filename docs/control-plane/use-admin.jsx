// useAdmin — React hook that wraps window.MCP_CLIENT.callTool with polling.
//
// Usage:
//   const { data, loading, error, dataLimited, refetch } = useAdmin('admin.health.get');
//
// The hook honors the global Tweaks state (env, polling, pollIntervalSec).
// When polling is paused, the hook fetches once on mount and on refetch().
// When polling is on, it polls at `pollIntervalSec` (default 30s).

const { useState, useEffect, useCallback, useRef } = React;

function useAdmin(toolName, args, opts) {
  const argsKey = JSON.stringify(args ?? {});
  const optsIntervalSec = opts && typeof opts.intervalSec === "number" ? opts.intervalSec : null;
  // Defaults are TRUE — the hook fetches eagerly on mount and stays enabled
  // unless the caller explicitly opts out. The earlier `opts && ...` form
  // resolved to `undefined` (falsy) when opts was omitted, suppressing the
  // initial fetch — that bug is what broke the projects/dashboard wiring.
  const optsImmediate = !opts || opts.immediate !== false;
  const optsEnabled = !opts || opts.enabled !== false;

  // tweaks: opt-in via window.useCPTweaks if available; defaults otherwise.
  const tweaksHook = window.useCPTweaks;
  const tweaks = tweaksHook ? tweaksHook() : { t: { polling: true, pollIntervalSec: 30 }, setTweak: () => {} };
  const polling = tweaks.t.polling;
  const intervalSec = optsIntervalSec != null ? optsIntervalSec : tweaks.t.pollIntervalSec || 30;

  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(optsImmediate && optsEnabled);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const cancelledRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    if (!optsEnabled) return;
    setLoading(true);
    try {
      const result = await window.MCP_CLIENT.callTool(toolName, args);
      if (cancelledRef.current) return;
      // structuredContent carries the typed payload; content is the
      // mirrored JSON.stringify text. Prefer structuredContent when present.
      const payload = result && (result.structuredContent ?? result.content);
      setData(payload);
      setError(null);
      setLastFetchedAt(Date.now());
    } catch (err) {
      if (cancelledRef.current) return;
      setError(err);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolName, argsKey, optsEnabled]);

  useEffect(() => {
    cancelledRef.current = false;
    if (optsImmediate && optsEnabled) void fetchOnce();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolName, argsKey, optsImmediate, optsEnabled]);

  useEffect(() => {
    if (!polling || !optsEnabled) return undefined;
    const ms = Math.max(1, intervalSec) * 1000;
    const id = setInterval(() => { void fetchOnce(); }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, intervalSec, optsEnabled, toolName, argsKey]);

  // Pull dataLimited off the payload if present.
  const dataLimited = data && typeof data === "object" && data && "dataLimited" in data
    ? data.dataLimited
    : null;

  return { data, error, loading, dataLimited, refetch: fetchOnce, lastFetchedAt };
}

window.useAdmin = useAdmin;
