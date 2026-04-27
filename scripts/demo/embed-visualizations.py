#!/usr/bin/env python3
"""Extract SVG + caption + insertion target from each visualization HTML
and embed into the corresponding SDLC markdown document.

The viz pages have a stable structure:
  <header class="viz-header">  ... metadata (lands-in path)
  <div class="stage">          ... contains <svg>...</svg>
  <div class="caption-block">  ... has caption + insertion instruction cards
  <div class="notes">          ... design notes (NOT embedded)

This script:
  1. Parses each docs/visualizations/v*.html
  2. Extracts the inline SVG and the caption text
  3. Maps to the actual project SDLC path (per docs/visualizations/README.md mapping)
  4. Inserts <figure><svg>...</svg><figcaption>...</figcaption></figure>
     at a sensible location in the target doc

Run from repo root:
  python scripts/demo/embed-visualizations.py [--dry-run]
"""
from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent.parent
VIZ_DIR = REPO / "docs" / "visualizations"

# Mapping: (viz_filename, target_doc, anchor_text_after_which_to_insert, viz_kind)
# viz_kind = 'svg' (extract first <svg>), 'svg2-storage' / 'svg2-security' (V15 two-SVG split),
#            'stage-html' (extract entire <div class="stage">...</div> body verbatim, V7+V9),
#            'new-file' (V13 — create the file fresh with the SVG as the figure).
EMBEDS = [
    ("v01-audit-chain-construction.html", "docs/sdlc/06-security/audit-chain-threat-model.md", "## Entry shape (recap)", "svg"),
    ("v02-lethal-trifecta.html",           "docs/sdlc/06-security/lethal-trifecta.md",            "## What is the lethal trifecta", "svg"),
    ("v03-test-pyramid.html",              "docs/sdlc/07-testing/strategy.md",                    "## Test categories", "svg"),
    ("v04-milestone-gantt.html",           "docs/sdlc/01-charter/product-strategy.md",            "## The validating moment", "svg"),
    ("v05-token-envelope.html",            "docs/sdlc/06-security/token-storage.md",              "## Cryptographic primitives", "svg"),
    ("v06-observability-pillars.html",     "docs/sdlc/08-operations/observability-stack.md",      "## The four streams", "svg"),
    ("v07-stride-matrix.html",             "docs/sdlc/06-security/threat-model.md",               "## Summary table", "stage-html"),
    ("v08-failure-ishikawa.html",          "docs/sdlc/14-incidents/failure-mode-taxonomy.md",     "## Categories", "svg"),
    ("v09-failure-fix-matrix.html",        "docs/sdlc/14-incidents/fix-type-taxonomy.md",         "## How fix-type interacts with failure-mode", "stage-html"),
    ("v10-key-rotation.html",              "docs/sdlc/06-security/audit-chain-threat-model.md",   "## Key rotation procedure", "svg"),
    ("v11-token-budget.html",              "docs/sdlc/04-design/module-context.md",               "## Token budgeting (v6 §16.1)", "svg"),
    ("v12-provider-class.html",            "docs/sdlc/04-design/module-providers-vcs.md",         "## Architecture", "svg"),
    ("v13-onboarding-tree.html",           "docs/sdlc/11-onboarding/README.md",                   None, "new-file"),
    ("v14-dr-tree.html",                   "docs/sdlc/10-dr-bcp/failover.md",                     "## Failover scenarios", "svg"),
    ("v15-c4-l3.html",                     "docs/sdlc/04-design/module-storage.md",               "## Architecture", "svg2-storage"),
    ("v15-c4-l3.html",                     "docs/sdlc/04-design/module-security.md",              "## Architecture", "svg2-security"),
    ("v16-role-map.html",                  "docs/sdlc/01-charter/README.md",                      "## Users", "svg"),
    ("v17-cost-stack.html",                "docs/sdlc/16-cost/cost-model.md",                     "## Total monthly cost at v1 scale", "svg"),
    ("v18-adr-graph.html",                 "docs/sdlc/12-governance/decision-log.md",             "## ADR index", "svg"),
]


def extract_svg(html: str) -> str | None:
    """Return the first <svg ...>...</svg> block, or None."""
    match = re.search(r"<svg\b[^>]*>.*?</svg>", html, re.DOTALL)
    return match.group(0) if match else None


def extract_svg_after_marker(html: str, marker: str) -> str | None:
    """For multi-SVG pages (V15), return the first <svg> after the given comment marker."""
    idx = html.find(marker)
    if idx == -1:
        return None
    match = re.search(r"<svg\b[^>]*>.*?</svg>", html[idx:], re.DOTALL)
    return match.group(0) if match else None


def extract_stage_inner(html: str) -> str | None:
    """Extract the body of the FIRST <div class="stage" ...>...</div> block.

    Used for V7 + V9 which use HTML tables with inline <style> for the matrix layout.
    Returns the inner HTML (style + table + any siblings) without the outer div wrapper.
    """
    # Find the opening tag with class="stage"
    open_match = re.search(r'<div class="stage"[^>]*>', html)
    if not open_match:
        return None
    start = open_match.end()
    # Walk forward, tracking <div> nesting depth, to find the matching </div>
    depth = 1
    pos = start
    while pos < len(html) and depth > 0:
        next_open = html.find("<div", pos)
        next_close = html.find("</div>", pos)
        if next_close == -1:
            return None
        if next_open != -1 and next_open < next_close:
            depth += 1
            pos = next_open + 4
        else:
            depth -= 1
            if depth == 0:
                return html[start:next_close]
            pos = next_close + 6
    return None


def extract_mermaid(html: str) -> str | None:
    """Return the mermaid source if present (some viz pages use mermaid not SVG)."""
    match = re.search(
        r'<div class="mermaid"[^>]*>\s*(.*?)\s*</div>', html, re.DOTALL
    )
    return match.group(1).strip() if match else None


def extract_caption(html: str) -> str:
    """Extract the caption-card paragraph text."""
    match = re.search(
        r'<div class="caption-card">\s*<h4>Caption\s*\(for the doc\)</h4>\s*<p>(.*?)</p>',
        html,
        re.DOTALL,
    )
    if not match:
        return ""

    raw = match.group(1)
    # Convert simple inline tags to markdown / plain text
    raw = re.sub(r"<code>(.*?)</code>", r"`\1`", raw, flags=re.DOTALL)
    raw = re.sub(r"<strong>(.*?)</strong>", r"**\1**", raw, flags=re.DOTALL)
    raw = re.sub(r"<em>(.*?)</em>", r"*\1*", raw, flags=re.DOTALL)
    raw = re.sub(r"<br\s*/?>", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw


def extract_viz_id_and_title(html: str) -> tuple[str, str]:
    """Return ('V1', 'Audit chain entry construction')."""
    vid_match = re.search(r'<span class="viz-id">([^<]+)</span>', html)
    title_match = re.search(r'<h1 class="viz-title">([^<]+)</h1>', html)
    return (vid_match.group(1) if vid_match else "V?", title_match.group(1) if title_match else "")


def build_figure_block(viz_filename: str, viz_id: str, title: str, svg: str, caption: str) -> str:
    """Wrap the SVG + caption in a figure block. The link points back to the viz page."""
    return (
        f"<figure>\n\n"
        f"{svg}\n\n"
        f"<figcaption><strong>{viz_id} — {title}.</strong> "
        f"{caption} "
        f'(See <a href="../../visualizations/{viz_filename}">full visualization page</a>.)'
        f"</figcaption>\n</figure>\n"
    )


def insert_after_anchor(content: str, anchor: str, block: str) -> tuple[str, bool]:
    """Insert `block` after the line that starts with `anchor`. Returns (new_content, success)."""
    lines = content.split("\n")
    for i, line in enumerate(lines):
        if line.lstrip().startswith(anchor):
            # Insert block after this line, preceded and followed by blank lines.
            insert_lines = ["", *block.split("\n")]
            new = lines[: i + 1] + insert_lines + lines[i + 1 :]
            return "\n".join(new), True
    return content, False


def already_embedded(content: str, viz_id: str, title: str) -> bool:
    """Heuristic: the figure already exists if the viz_id + title pattern is present."""
    pattern = re.escape(f"{viz_id} — {title}")
    return bool(re.search(pattern, content))


NEW_FILE_TEMPLATE = """---
title: Onboarding
owner: Chris
status: accepted
last_reviewed: 2026-04-26
version: 1.0.0
audience: [engineer, operator, integrator, executive]
sdlc_category: 11-onboarding
related: [docs/sdlc/README.md, docs/sdlc/01-charter/README.md]
---

# Onboarding

> **TL;DR:** Pick the path for your role. Each path lands you in the right corner of the SDLC tree without requiring full-tree exploration. The decision tree below is the canonical routing layer; the per-role guides under this directory contain the detail.

The four primary onboarding paths:

- **[Developer setup](developer-setup.md)** — joining as an engineer; clone, install, test, ship.
- **[Integrator guide](integrator-guide.md)** — building an MCP host that consumes atl-mcp.
- **[Operator guide](operator-guide.md)** — running atl-mcp in production.
- **[Partner onboarding](partner-onboarding.md)** — adopting atl-mcp for a project's seed.

A fifth audience (auditors / security reviewers) routes through `docs/sdlc/06-security/` rather than this directory; the decision tree calls that out explicitly.

{FIGURE_BLOCK}

## Linked artifacts

- **Top-level SDLC TOC:** [`docs/sdlc/README.md`](../README.md)
- **Charter (project mission, scope, non-goals):** [`docs/sdlc/01-charter/README.md`](../01-charter/README.md)
- **Glossary quick reference:** [`glossary-quick.md`](glossary-quick.md)

---

*Last reviewed: 2026-04-26 by Chris.*
"""


def get_visualization_body(html: str, kind: str, viz_filename: str) -> tuple[str | None, str]:
    """Return (body_content, error_message). body_content is None on extraction failure."""
    if kind == "svg":
        svg = extract_svg(html)
        if svg is None:
            mermaid = extract_mermaid(html)
            if mermaid:
                return f"```mermaid\n{mermaid}\n```", ""
            return None, "no <svg> or mermaid found"
        return svg, ""
    if kind == "stage-html":
        body = extract_stage_inner(html)
        if body is None:
            return None, "could not extract <div class='stage'> content"
        return body.strip(), ""
    if kind == "svg2-storage":
        svg = extract_svg_after_marker(html, "V15a")
        if svg is None:
            return None, "could not find V15a marker / SVG"
        return svg, ""
    if kind == "svg2-security":
        svg = extract_svg_after_marker(html, "V15b")
        if svg is None:
            return None, "could not find V15b marker / SVG"
        return svg, ""
    if kind == "new-file":
        svg = extract_svg(html)
        if svg is None:
            return None, "no <svg> for new-file embedding"
        return svg, ""
    return None, f"unknown kind: {kind}"


def process_one(viz_filename: str, target_path: str, anchor: str | None, kind: str, dry_run: bool) -> str:
    viz_path = VIZ_DIR / viz_filename
    if not viz_path.exists():
        return f"  SKIP {viz_filename} (file not found)"

    html = viz_path.read_text(encoding="utf-8")
    caption = extract_caption(html)
    viz_id, title = extract_viz_id_and_title(html)

    body, err = get_visualization_body(html, kind, viz_filename)
    if body is None:
        return f"  SKIP {viz_filename} ({err})"

    # Adjust viz_id for split V15
    if kind == "svg2-storage":
        viz_id = "V15a"
        title = "C4-L3 Storage"
    elif kind == "svg2-security":
        viz_id = "V15b"
        title = "C4-L3 Security"

    figure_block = build_figure_block(viz_filename, viz_id, title, body, caption)
    target = REPO / target_path

    # New-file case: V13
    if kind == "new-file":
        if target.exists():
            return f"  ALREADY EXISTS  {viz_id} -> {target_path}"
        # Replace placeholder in template
        new_content = NEW_FILE_TEMPLATE.replace("{FIGURE_BLOCK}", figure_block)
        if not dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(new_content, encoding="utf-8")
        return f"  CREATE  {viz_id} -> {target_path}  (new file)"

    if anchor is None:
        return f"  SKIP {viz_id} -> {target_path} (no anchor and not new-file)"

    if not target.exists():
        return f"  SKIP {viz_id} -> {target_path} (target file does not exist)"

    content = target.read_text(encoding="utf-8")

    if already_embedded(content, viz_id, title):
        return f"  ALREADY EMBEDDED  {viz_id} -> {target_path}"

    new_content, success = insert_after_anchor(content, anchor, figure_block)
    if not success:
        return f"  ANCHOR NOT FOUND  {viz_id} -> {target_path} (anchor: {anchor!r})"

    if not dry_run:
        target.write_text(new_content, encoding="utf-8")

    return f"  OK  {viz_id} -> {target_path}  (after: {anchor!r})"


def main() -> None:
    dry_run = "--dry-run" in sys.argv

    print(f"Embedding visualizations (dry_run={dry_run})...")
    for viz_filename, target_path, anchor, kind in EMBEDS:
        print(process_one(viz_filename, target_path, anchor, kind, dry_run))


if __name__ == "__main__":
    main()
