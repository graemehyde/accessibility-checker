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
- **Gemini** — a Google Gemini API key from <https://aistudio.google.com/app/apikey>
- **Azure OpenAI** (optional) — an Azure OpenAI resource with a vision-capable deployment (e.g. `gpt-4o`)

## Setup

### Local (Node)

```bash
npm install
npx playwright install chromium
```

Create a `.env` file in the project root:

```bash
# Gemini (default)
GEMINI_API_KEY=your_gemini_key

# Azure OpenAI (optional — set all three to auto-switch to Azure)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-12-01-preview
```

If `AZURE_OPENAI_ENDPOINT` is set, Azure OpenAI is used automatically. Set only `GEMINI_API_KEY` to use Gemini. Use `--provider` to override at runtime.

### Docker

```bash
docker compose build
```

No extra setup needed — Chromium is bundled in the image.

## Usage

```bash
node src/index.js <url> [--output <path>] [--provider gemini|azure]
# or
npm run start <url>
```

| Argument | Description |
|---|---|
| `<url>` | The fully-qualified URL to audit (must include `https://`) |
| `--output <path>` | Path for the HTML report file (default: `./report.html`) |
| `-o <path>` | Shorthand for `--output` |
| `--llm-provider <name>` | LLM backend: `gemini` (default) or `azure`. Auto-detected from env vars if omitted. |
| `-p <name>` | Shorthand for `--llm-provider` |

**Examples:**

```bash
# Audit a URL using Gemini (default)
node src/index.js https://example.com

# Specify a custom report path
node src/index.js https://www.example.com --output ./reports/example.html

# Force Azure OpenAI as the LLM backend
node src/index.js https://example.com --llm-provider azure

# Redirect the terminal summary to a file, keep progress in the terminal
node src/index.js https://example.com > summary.txt
```

Progress and status messages are written to **stderr**, so stdout can be piped or redirected independently.

## Docker

The repo ships a [Dockerfile](Dockerfile) based on the official Playwright image, so Chromium and all Linux system dependencies are pre-installed.

```bash
# Build
docker compose build

# Run — reads credentials from .env automatically
docker compose run --rm accessibility-checker https://example.com

# Custom report filename
docker compose run --rm accessibility-checker \
  https://example.com --output /reports/example.html
```

Reports are written to `./reports/` on your machine via a bind-mount. The `.env` file is loaded automatically by `docker-compose.yml` via `env_file: .env` — no need to pass `-e` flags manually.

To run without Compose:

```bash
docker build -t accessibility-checker .
docker run --rm \
  -e GEMINI_API_KEY=your_key \
  -v "$PWD/reports:/reports" \
  accessibility-checker https://example.com
```

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
│   ├── llm-audit.js        # runLLMAudit()       — Gemini & Azure OpenAI multimodal audit
│   ├── rule-based-audit.js # runRuleBasedAudit() — DOM checks via page.evaluate()
│   └── report.js           # generateReport()    — self-contained HTML report writer
├── .env                    # API keys (git-ignored)
├── .dockerignore
├── Dockerfile              # Playwright + Node image for Linux testing
├── docker-compose.yml      # Compose wrapper — loads .env, mounts ./reports
├── .gitignore
└── package.json
```

## Limitations

- **LLM findings are probabilistic.** Colour contrast ratios reported by the LLM are estimates based on the screenshot; they should be verified with a dedicated contrast analyser for precise measurements.
- **Dynamic content.** The audit runs against the page as loaded. Content rendered after user interaction (modals, menus, expandable sections) is not evaluated.
- **Page load strategy is `waitUntil: 'networkidle'`.** This catches most deferred content but very late-loading widgets (e.g. chat bubbles, consent banners) may still not be present.
- **Touch targets are measured at desktop viewport width** (Playwright default: 1280px). Results may differ on mobile viewports.
