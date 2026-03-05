# accessibility-checker

A Node.js CLI tool that audits any public URL for accessibility issues and produces a self-contained HTML report. It combines a deterministic rule-based DOM audit with a Google Gemini LLM visual audit run in parallel.

## How it works

1. Launches a headless Chromium browser via Playwright and navigates to the target URL.
2. Captures a full-page screenshot (PNG) and the rendered HTML source.
3. Runs two audits **in parallel**:
   - **Rule-based audit** — deterministic DOM checks via `page.evaluate()`.
   - **LLM audit** — sends the screenshot and HTML to Gemini (`gemini-flash-lite-latest`) for visual analysis.
4. Merges the results and writes:
   - A formatted summary to **stdout**, grouped by FAIL / WARN / PASS / INFO.
   - A self-contained HTML report to disk (default `./report.html`).

## Prerequisites

- Node.js ≥ 18
- A Google Gemini API key — get one at <https://aistudio.google.com/app/apikey>

## Setup

```bash
npm install
npx playwright install chromium
```

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_key_here
```

The tool will load `.env` automatically. Alternatively, export the variable in your shell before running.

## Usage

```bash
node src/index.js <url> [--output <path>]
```

| Argument | Description |
|---|---|
| `<url>` | The fully-qualified URL to audit (must include `https://`) |
| `--output <path>` | Path for the HTML report file (default: `./report.html`) |
| `-o <path>` | Shorthand for `--output` |

**Examples:**

```bash
# Audit a URL and write the report to the default location
node src/index.js https://example.com

# Specify a custom report path
node src/index.js https://www.example.com --output ./reports/example.html

# Redirect the terminal summary to a file, keep progress in the terminal
node src/index.js https://example.com > summary.txt
```

Progress and status messages are written to **stderr**, so stdout can be piped or redirected independently.

## Output

### Terminal summary

A grouped text report is printed to stdout:

```
════════════════════════════════════════════════════════════════════════
 ACCESSIBILITY AUDIT
 https://example.com
════════════════════════════════════════════════════════════════════════

 19 issues  ·  FAIL: 7  ·  WARN: 5  ·  PASS: 7  ·  INFO: 0

─────────────────────────── FAIL (7) ───────────────────────────────

  [semantic-html]  1.3.1 Info and Relationships  (WCAG A)
  Element  : heading hierarchy
  Detail   : Heading levels are skipped: <h2> → <h4>.
  Fix      : Maintain a sequential heading hierarchy without gaps.
  ...
```

### HTML report

A single self-contained `.html` file with no external dependencies — opens correctly in a browser with no internet connection. It includes:

- **Header** — tool name, scanned URL, timestamp, WCAG target level, and an overall PASS/FAIL/WARN badge.
- **Page screenshot** — embedded as a base64 `<img>` tag in a collapsible panel.
- **Scorecard** — one row per audit module showing status, issue count, and WCAG criteria reference.
- **Findings** — one collapsible `<details>` block per module. FAIL modules are expanded by default; PASS modules are collapsed.
- **Inclusivity** — cultural and gender bias findings rendered separately at the bottom, labelled as informational and excluded from the overall score.

## Audit modules

### Rule-based (DOM)

| Module | ID | WCAG |
|---|---|---|
| Semantic HTML | `semantic-html` | 1.3.1, 4.1.2 |
| ARIA Attributes | `aria` | 4.1.2 |
| Touch Target Sizing | `touch-target` | 2.5.5, 2.5.8 |
| Alt Text Patterns | `alt-text-patterns` | 1.1.1 |

**Semantic HTML** checks for: a single `<h1>`, no skipped heading levels, presence of `<main>` / `<nav>` / `<header>` / `<footer>` landmarks, and interactive `<div>`/`<span>` elements that lack an ARIA role.

**ARIA** checks for: invalid role values (validated against the full WAI-ARIA 1.2 set), missing required attributes for a given role, broken `aria-labelledby` / `aria-describedby` ID references, and `aria-hidden="true"` applied to focusable elements or their containers.

**Touch targets** measures the rendered `getBoundingClientRect` of every interactive element. Hard fail below 24×24 px (WCAG 2.5.8); warning below 44×44 px (WCAG 2.5.5). Hidden/collapsed elements are skipped.

**Alt text patterns** flags images missing the `alt` attribute entirely, alt text that looks like a filename (e.g. `photo.jpg`), and generic labels such as `image`, `photo`, `logo`, or `icon`.

### LLM-based (Gemini visual)

| Module | ID | WCAG |
|---|---|---|
| Colour Contrast | `colour-contrast` | 1.4.3, 1.4.6 |
| Alt Text Accuracy | `alt-text` | 1.1.1 |
| Cultural & Gender Bias | `bias` | Best Practice |

**Colour contrast** uses the screenshot to identify foreground/background combinations that appear to fail the 4.5:1 ratio for normal text or 3:1 for large text and UI components.

**Alt text accuracy** cross-references each image visible in the screenshot against its `alt` attribute in the HTML, flagging inaccurate, misleading, or missing descriptions that DOM-only checks cannot catch.

**Cultural & gender bias** is treated as informational only and does not affect the overall PASS/FAIL score. It identifies language, imagery, and iconography that may reflect stereotyping or exclusionary assumptions.

## Issue schema

Every finding from both audit types shares the same schema:

```json
{
  "moduleId":    "semantic-html",
  "wcagLevel":   "A",
  "wcagCriteria": "1.3.1 Info and Relationships",
  "status":      "fail",
  "element":     "heading hierarchy",
  "detail":      "Heading levels are skipped: <h2> → <h4>.",
  "suggestion":  "Maintain a sequential heading hierarchy without gaps."
}
```

| Field | Values |
|---|---|
| `status` | `fail` · `warn` · `pass` · `info` |
| `wcagLevel` | `A` · `AA` · `AAA` · `info` |

## Project structure

```
accessibility-checker/
├── src/
│   ├── index.js            # CLI entry point — arg parsing, browser control, orchestration
│   ├── llm-audit.js        # runLLMAudit()       — Gemini multimodal audit
│   ├── rule-based-audit.js # runRuleBasedAudit() — DOM checks via page.evaluate()
│   └── report.js           # generateReport()    — self-contained HTML report writer
├── .env                    # GEMINI_API_KEY (git-ignored)
├── .gitignore
└── package.json
```

## Limitations

- **LLM findings are probabilistic.** Colour contrast ratios reported by the LLM are estimates based on the screenshot; they should be verified with a dedicated contrast analyser for precise measurements.
- **Dynamic content.** The audit runs against the page as loaded. Content rendered after user interaction (modals, menus, expandable sections) is not evaluated.
- **Rule-based checks use `waitUntil: 'load'`.** Sites with content injected after the load event (lazy-loaded images, deferred scripts) may produce incomplete results.
- **Touch targets are measured at desktop viewport width** (Playwright default: 1280px). Results may differ on mobile viewports.
