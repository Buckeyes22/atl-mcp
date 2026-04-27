# Screenshots — capture spec

> The 10 numbered screenshots live in this directory. **Capture is a manual handoff step** — I (Claude) cannot run a logged-in browser session against `lateapexllc.atlassian.net` without a session cookie or password (the API token authenticates the REST API, not the web UI). Capture takes ~15 minutes once logged in.

---

## What to capture

Numbered list. Filename convention: `NN-short-name.png`. Save in this directory.

| # | File | Live URL | What to capture | Annotation? |
|---|---|---|---|---|
| 01 | `01-jira-board.png` | [PCO board](https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1) | Full Kanban board with all columns visible. Filter to show all 8 epics' work | None |
| 02 | `02-jira-epic-list.png` | [PCO issues filtered to Epics](https://lateapexllc.atlassian.net/issues/?jql=project%3DPCO%20AND%20issuetype%3DEpic%20ORDER%20BY%20created%20ASC) | List view of all 8 epics with status indicators | None |
| 03 | `03-jira-flagship-story.png` | [PCO-9](https://lateapexllc.atlassian.net/browse/PCO-9) | Full flagship story with description, G/W/T acceptance criteria, parent epic link | Highlight the linked-ADR mention in the description |
| 04 | `04-confluence-page-tree.png` | [ACO space](https://lateapexllc.atlassian.net/wiki/spaces/ACO) | Sidebar showing the full IA expanded | None |
| 05 | `05-confluence-architecture.png` | [Architecture Overview](https://lateapexllc.atlassian.net/wiki/spaces/ACO) | Top of the architecture page with the system context section visible | None |
| 06 | `06-confluence-runbook.png` | [Operational Runbook](https://lateapexllc.atlassian.net/wiki/spaces/ACO) | Top of the runbook including health checks section and the start of common alerts | None |
| 07 | `07-confluence-audit-findings.png` | [Audit Findings + Remediation Summary](https://lateapexllc.atlassian.net/wiki/spaces/ACO) | Top of the audit findings page with the full findings table visible | None |
| 08 | `08-architecture-diagram.png` | (rendered from architecture.md) | The mermaid system context diagram rendered as a PNG | Numbered callouts (1) request, (2) policy, (3) audit |
| 09 | `09-mcp-tools-list.png` | (terminal) | Output of an MCP `tools/list` call against the running server, formatted as JSON | None |
| 10 | `10-preflight-profile-json.png` | (terminal or file) | Excerpt of a generated preflight profile JSON showing capability detection | Highlight the `capabilities` field |

---

## Capture conventions

- **Resolution.** 1920×1080 minimum, 2× retina (3840×2160) preferred for crisp Slack/email rendering.
- **Format.** PNG (lossless). No JPG.
- **Browser chrome.** Always include for context. A floating screenshot with no URL bar reads as suspicious.
- **Theme.** Light theme universally. Dark theme reads casual; light theme is the professional default.
- **Redaction.** Black bars or blur on:
  - The full email address `chris@lateapexllc.com` (your name is fine, the email isn't).
  - Any avatar images with personal identifiers.
  - The Atlassian site URL beyond the subdomain (`lateapexllc.atlassian.net` is fine; if there's a query string with anything sensitive, redact it).
- **Annotations.** Numbered red circles with white numerals where called for. Captions live in this README, not on the image.

---

## How to capture (Mac)

For each screenshot:

1. Navigate to the URL.
2. Wait for the page to fully load (Confluence renders progressively; let it finish).
3. Maximize the browser window.
4. `Cmd+Shift+5` → Capture Selected Window or Capture Selected Portion.
5. Save to this directory with the numbered filename.
6. If annotations needed: open in Preview, use the markup tools to add red circles + white numerals.

## How to capture (Windows)

1. Navigate to the URL.
2. Maximize the browser window.
3. `Win+Shift+S` → Rectangle clip (full window) or Window clip.
4. Paste into an image editor (Paint, ShareX, or similar).
5. Crop and save as PNG to this directory.
6. For annotations, ShareX has built-in numbered-circle markers; otherwise use Paint or any image editor.

---

## Optional: programmatic capture

If you want to script this, use playwright with a logged-in browser context. Pseudocode:

```bash
# One-time: log in interactively and save the session cookie
npx playwright codegen https://lateapexllc.atlassian.net --save-storage=auth.json

# Then for each capture:
npx playwright open --load-storage=auth.json https://lateapexllc.atlassian.net/jira/software/projects/PCO/boards/1
# (in the browser: Cmd+Shift+P → "Take screenshot of full page")
```

This approach is overkill for a one-time capture but reasonable if the screenshots need to be refreshed after every meaningful change to the project.

---

## What to do if a screenshot can't be captured

If for any reason a particular screenshot can't be produced (e.g., the page renders differently than expected, or a redaction can't be cleanly applied), document the gap:

- Replace the missing file with a `NN-short-name.txt` describing what was attempted and why it didn't work.
- Add the gap to [`audit-remediation-summary.md`](../audit-remediation-summary.md) as a low-severity finding.

A documented gap is better than a faked screenshot.

---

*This capture spec is a handoff. The seed Jira project (PCO) and Confluence space (ACO) are provisioned and live; the screenshots just need a logged-in browser session to capture.*
