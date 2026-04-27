// app-tweaks.jsx — control-plane Tweaks panel (ADR 0006).
// Per-operator UI controls only. Scenario simulators (P0 breach, Bitbucket
// degraded, alert storm) and the flow-diagram layout toggle were stripped
// when the UI was wired to live admin tools — every fake state is now
// expressed by the real backend or by `dataLimited` markers from Phase 4
// tools.

const CP_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "env": "production",
  "roleLens": "developer",
  "polling": true,
  "pollIntervalSec": 30,
  "operatorBadge": "operator@loopback"
}/*EDITMODE-END*/;

const CPTweaksCtx = React.createContext({ t: CP_TWEAK_DEFAULTS, setTweak: () => {} });
const CP_TWEAK_STORAGE_KEY = 'atl-mcp.cpTweaks';

function CPTweaksProvider({ children }) {
  const [t, setBaseTweak] = useTweaks(CP_TWEAK_DEFAULTS);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(CP_TWEAK_STORAGE_KEY) || '{}');
      const allowedRoles = (window.ControlSurfaceModel?.roleProfiles() ?? []).map((role) => role.id);
      const next = { ...stored };
      if (next.roleLens && !allowedRoles.includes(next.roleLens)) delete next.roleLens;
      setBaseTweak(next);
    } catch {
      setBaseTweak({});
    }
  }, [setBaseTweak]);

  const setTweak = React.useCallback((keyOrEdits, value) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: value };
    setBaseTweak(edits);
    try {
      const current = JSON.parse(window.localStorage.getItem(CP_TWEAK_STORAGE_KEY) || '{}');
      window.localStorage.setItem(CP_TWEAK_STORAGE_KEY, JSON.stringify({ ...current, ...edits }));
    } catch {
      // Host edit-mode persistence still runs through useTweaks; localStorage is only the browser fallback.
    }
  }, [setBaseTweak]);

  useEffect(() => { window.__cpTweaks = t; }, [t]);

  return (
    <CPTweaksCtx.Provider value={{ t, setTweak }}>
      {children}
      <TweaksPanel>
        <TweakSection label="Environment" />
        <TweakRadio
          label="Tier display"
          value={t.env}
          options={['dev', 'staging', 'production']}
          onChange={v => setTweak('env', v)}
        />
        <TweakSelect
          label="Role lens"
          value={t.roleLens || 'developer'}
          options={(window.ControlSurfaceModel?.roleProfiles() ?? [
            { value: 'developer', label: 'Developer' },
          ]).map((role) => ({ value: role.id ?? role.value, label: role.label }))}
          onChange={v => setTweak('roleLens', v)}
        />
        <TweakText
          label="Operator badge"
          value={t.operatorBadge}
          onChange={v => setTweak('operatorBadge', v)}
        />

        <TweakSection label="Live polling" />
        <TweakToggle
          label="Auto-refresh"
          value={t.polling}
          onChange={v => setTweak('polling', v)}
        />
        <TweakSlider
          label="Interval"
          value={t.pollIntervalSec}
          min={5} max={120} step={5} unit="s"
          onChange={v => setTweak('pollIntervalSec', v)}
        />
      </TweaksPanel>
    </CPTweaksCtx.Provider>
  );
}

function useCPTweaks() {
  return React.useContext(CPTweaksCtx);
}

Object.assign(window, { CPTweaksProvider, useCPTweaks, CP_TWEAK_DEFAULTS });
