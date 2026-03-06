import { writeFileSync } from 'fs';

// ── Module metadata ────────────────────────────────────────────────────────────

const MODULE_META = {
  // Visual Quality
  'colour-contrast':    { name: 'Colour Contrast',              wcag: '1.4.3, 1.4.6' },
  'colour-blindness':   { name: 'Colour Blindness Simulation',  wcag: '1.4.3, 1.4.6' },
  'text-size':          { name: 'Rendered Text Size',           wcag: '1.4.4' },
  'visual-density':     { name: 'Visual Density & Crowding',    wcag: 'best practice' },
  'focus-indicator':    { name: 'Focus Indicator Visibility',   wcag: '2.4.7, 2.4.11' },
  'animation-flashing': { name: 'Animation & Flashing',         wcag: '2.3.1' },
  // Layout & Navigation
  'touch-target':       { name: 'Touch Target Sizing',          wcag: '2.5.5, 2.5.8' },
  'reading-order':      { name: 'Reading Order vs Visual Flow', wcag: '1.3.2' },
  'text-reflow':        { name: 'Text Reflow at 200% Zoom',     wcag: '1.4.10' },
  'keyboard-nav':       { name: 'Keyboard Navigation',          wcag: '2.1.1, 2.4.3' },
  'icon-buttons':       { name: 'Icon-Only Buttons',            wcag: '1.1.1, 4.1.2' },
  'custom-controls':    { name: 'Custom Controls',              wcag: '4.1.2' },
  // Content & Media
  'alt-text':           { name: 'Alt Text Accuracy',            wcag: '1.1.1' },
  'alt-text-patterns':  { name: 'Alt Text Patterns',            wcag: '1.1.1' },
  'link-text':          { name: 'Link Text Clarity',            wcag: '2.4.4' },
  'captions':           { name: 'Captions & Transcripts',       wcag: '1.2.2, 1.2.3' },
  'language':           { name: 'Language Attributes',          wcag: '3.1.1, 3.1.2' },
  // HTML Structure & ARIA
  'semantic-html':      { name: 'Semantic HTML Structure',      wcag: '1.3.1, 4.1.2' },
  'aria':               { name: 'ARIA Attributes',              wcag: '4.1.2' },
  'form-labels':        { name: 'Form Label Association',       wcag: '1.3.1, 3.3.2' },
  'live-regions':       { name: 'ARIA Live Regions',            wcag: '4.1.3' },
  // Cognitive Accessibility
  'reading-level':      { name: 'Reading Level',                wcag: '3.1.5' },
  'content-hierarchy':  { name: 'Content Hierarchy',            wcag: '1.3.1, 2.4.6' },
  'instruction-clarity':{ name: 'Instruction Clarity',          wcag: '3.3.2' },
  'jargon':             { name: 'Jargon Density',               wcag: 'best practice' },
};

const GROUPS = [
  {
    id: 'visual',
    name: 'Visual Quality',
    modules: ['colour-contrast', 'colour-blindness', 'text-size', 'visual-density', 'focus-indicator', 'animation-flashing'],
  },
  {
    id: 'layout',
    name: 'Layout & Navigation',
    modules: ['touch-target', 'reading-order', 'text-reflow', 'keyboard-nav', 'icon-buttons', 'custom-controls'],
  },
  {
    id: 'content',
    name: 'Content & Media',
    modules: ['alt-text', 'alt-text-patterns', 'link-text', 'captions', 'language'],
  },
  {
    id: 'html',
    name: 'HTML Structure & ARIA',
    modules: ['semantic-html', 'aria', 'form-labels', 'live-regions'],
  },
  {
    id: 'cognitive',
    name: 'Cognitive Accessibility',
    modules: ['reading-level', 'content-hierarchy', 'instruction-clarity', 'jargon'],
  },
];

const INCLUSIVITY_META = {
  'representation':          { name: 'Representation in Imagery' },
  'symbolic-bias':           { name: 'Symbolic Bias' },
  'colour-symbolism':        { name: 'Colour Symbolism' },
  'gendered-language':       { name: 'Gendered Language' },
  'cultural-idioms':         { name: 'Cultural Idioms' },
  'locale-assumptions':      { name: 'Locale Assumptions' },
  'exclusionary-phrasing':   { name: 'Exclusionary Phrasing' },
  'pronoun-inclusivity':     { name: 'Pronoun Inclusivity' },
  'stereotype-reinforcement':{ name: 'Stereotype Reinforcement' },
  'geographic-bias':         { name: 'Geographic Bias' },
  // Legacy
  'bias':                    { name: 'Bias & Representation' },
};

const INCLUSIVITY_MODULE_IDS = new Set(Object.keys(INCLUSIVITY_META));

const INCLUSIVITY_GROUPS = [
  {
    name: 'Visual',
    modules: ['representation', 'symbolic-bias', 'colour-symbolism'],
  },
  {
    name: 'Language & Content',
    modules: ['gendered-language', 'cultural-idioms', 'locale-assumptions', 'exclusionary-phrasing', 'pronoun-inclusivity'],
  },
  {
    name: 'Combined',
    modules: ['stereotype-reinforcement', 'geographic-bias', 'bias'],
  },
];

const ICON  = { fail: '✘', warn: '⚠', pass: '✔', info: 'ℹ' };
const LABEL = { fail: 'FAIL', warn: 'WARN', pass: 'PASS', info: 'INFO' };

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function moduleStatus(issues) {
  if (issues.some(i => i.status === 'fail')) return 'fail';
  if (issues.some(i => i.status === 'warn')) return 'warn';
  if (issues.some(i => i.status === 'info')) return 'info';
  return 'pass';
}

function badge(status) {
  return `<span class="badge ${status}">${ICON[status]} ${LABEL[status]}</span>`;
}

function issueCard(issue) {
  return `
      <div class="issue-card ${issue.status}">
        <div class="issue-head">
          ${badge(issue.status)}
          <span class="wcag-tag">WCAG ${esc(issue.wcagLevel)} · ${esc(issue.wcagCriteria)}</span>
        </div>
        <dl class="issue-fields">
          <dt>Element</dt><dd><code>${esc(issue.element)}</code></dd>
          <dt>Detail</dt><dd>${esc(issue.detail)}</dd>
          ${issue.suggestion ? `<dt>Fix</dt><dd>${esc(issue.suggestion)}</dd>` : ''}
        </dl>
      </div>`;
}

function moduleSection(moduleId, issues) {
  const meta   = MODULE_META[moduleId] ?? { name: moduleId, wcag: '' };
  const status = moduleStatus(issues);
  const open   = status === 'fail' ? ' open' : '';
  return `
    <details class="mod"${open}>
      <summary class="mod-summary ${status}">
        <span class="mod-arrow">▶</span>
        <span class="mod-icon">${ICON[status]}</span>
        <span class="mod-name">${esc(meta.name)}</span>
        <span class="mod-count">${issues.length} finding${issues.length !== 1 ? 's' : ''}</span>
        ${badge(status)}
      </summary>
      <div class="mod-body">
        ${issues.map(issueCard).join('')}
      </div>
    </details>`;
}

// ── CSS ────────────────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px; line-height: 1.65; color: #111827; background: #f0f2f5;
  }

  code {
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
    font-size: 12px; background: rgba(0,0,0,0.07); padding: 1px 5px;
    border-radius: 3px; word-break: break-all;
  }

  a { color: #2563eb; }

  /* ── Layout ── */
  .wrap { max-width: 980px; margin: 0 auto; padding: 28px 18px 56px; }

  /* ── Report header ── */
  .rpt-header {
    background: #111827; color: #f9fafb; border-radius: 10px;
    padding: 26px 28px; display: flex; justify-content: space-between;
    align-items: flex-start; gap: 24px; margin-bottom: 20px;
  }
  .hdr-left { flex: 1; min-width: 0; }
  .hdr-tool { font-size: 22px; font-weight: 800; margin-bottom: 7px; letter-spacing: -0.02em; }
  .hdr-url  { font-size: 13px; color: #9ca3af; word-break: break-all; margin-bottom: 5px; }
  .hdr-meta { font-size: 12px; color: #6b7280; display: flex; gap: 10px; flex-wrap: wrap; }
  .hdr-sep  { color: #374151; }
  .hdr-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }

  .overall {
    font-size: 16px; font-weight: 800; padding: 9px 22px; border-radius: 7px;
    letter-spacing: 0.05em; text-align: center;
  }
  .overall.fail { background: #dc2626; color: #fff; }
  .overall.warn { background: #d97706; color: #fff; }
  .overall.pass { background: #16a34a; color: #fff; }
  .overall.info { background: #2563eb; color: #fff; }

  .pills { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
  .pill {
    font-size: 11px; font-weight: 600; padding: 3px 9px;
    border-radius: 100px; border: 1px solid; white-space: nowrap;
  }
  .pill.fail { background: #fef2f2; color: #b91c1c; border-color: #fca5a5; }
  .pill.warn { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
  .pill.pass { background: #f0fdf4; color: #166534; border-color: #86efac; }
  .pill.info { background: #eff6ff; color: #1e40af; border-color: #93c5fd; }

  /* ── Cards ── */
  .card {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
    padding: 20px 24px; margin-bottom: 20px;
  }
  .card-title {
    font-size: 15px; font-weight: 700; color: #111827;
    margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
  }
  .card-title .note {
    font-size: 11px; font-weight: 500; color: #7c3aed;
    background: #f5f3ff; border: 1px solid #ddd6fe;
    padding: 2px 9px; border-radius: 100px;
  }

  /* ── Screenshot ── */
  .screenshot-card { padding: 0; overflow: hidden; }
  .screenshot-card details > summary {
    padding: 14px 20px; font-size: 14px; font-weight: 600; color: #374151;
    cursor: pointer; user-select: none; display: flex; align-items: center; gap: 8px;
    list-style: none;
  }
  .screenshot-card details > summary::-webkit-details-marker { display: none; }
  .scr-arrow { font-size: 10px; color: #9ca3af; transition: transform 0.15s; }
  .screenshot-card details[open] > summary .scr-arrow { transform: rotate(90deg); }
  .scr-wrap { border-top: 1px solid #e5e7eb; max-height: 580px; overflow-y: auto; }
  .scr-wrap img { width: 100%; display: block; }

  /* ── Scorecard table ── */
  .sc-table { width: 100%; border-collapse: collapse; }
  .sc-table th {
    text-align: left; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.07em; color: #9ca3af;
    padding: 7px 12px 9px; border-bottom: 2px solid #e5e7eb;
  }
  .sc-table td { padding: 11px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  .sc-table tr:last-child td { border-bottom: none; }
  .sc-name  { font-weight: 600; color: #111827; }
  .sc-count { color: #374151; font-size: 13px; }
  .sc-wcag  { font-family: ui-monospace, 'Cascadia Code', monospace; font-size: 12px; color: #6b7280; }

  /* ── Badges ── */
  .badge {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 11px; font-weight: 700; padding: 2px 8px;
    border-radius: 4px; letter-spacing: 0.03em; border: 1px solid; white-space: nowrap;
  }
  .badge.fail { background: #fef2f2; color: #b91c1c; border-color: #fca5a5; }
  .badge.warn { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
  .badge.pass { background: #f0fdf4; color: #166534; border-color: #86efac; }
  .badge.info { background: #eff6ff; color: #1e40af; border-color: #93c5fd; }

  /* ── Module details ── */
  .mod { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
  .mod-summary {
    display: flex; align-items: center; gap: 10px;
    padding: 13px 16px; cursor: pointer; user-select: none;
    font-weight: 600; list-style: none;
  }
  .mod-summary::-webkit-details-marker { display: none; }
  .mod-summary.fail { background: #fef2f2; }
  .mod-summary.warn { background: #fffbeb; }
  .mod-summary.pass { background: #f0fdf4; }
  .mod-summary.info { background: #eff6ff; }
  .mod-arrow { font-size: 10px; color: #9ca3af; transition: transform 0.15s; flex-shrink: 0; }
  details[open] > .mod-summary > .mod-arrow { transform: rotate(90deg); }
  .mod-icon  { font-size: 15px; }
  .mod-name  { flex: 1; font-size: 14px; }
  .mod-count { font-size: 12px; font-weight: 400; color: #9ca3af; }
  .mod-body  { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }

  /* ── Issue cards ── */
  .issue-card {
    border-radius: 6px; padding: 14px 16px; border-left: 4px solid;
    border-top: 1px solid; border-right: 1px solid; border-bottom: 1px solid;
  }
  .issue-card.fail { background: #fffafa; border-left-color: #ef4444; border-color: #fde8e8; border-left-color: #ef4444; }
  .issue-card.warn { background: #fffdf7; border-color: #fef3c7; border-left-color: #f59e0b; }
  .issue-card.pass { background: #f9fefb; border-color: #dcfce7; border-left-color: #22c55e; }
  .issue-card.info { background: #f8faff; border-color: #dbeafe; border-left-color: #3b82f6; }
  .issue-head {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 8px; margin-bottom: 10px;
  }
  .wcag-tag { font-size: 11px; color: #9ca3af; font-family: ui-monospace, monospace; }
  .issue-fields { display: grid; grid-template-columns: 62px 1fr; gap: 5px 10px; }
  .issue-fields dt {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: #9ca3af; padding-top: 3px;
  }
  .issue-fields dd { font-size: 13px; color: #374151; word-break: break-word; }

  /* ── Group headings ── */
  .group-header {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.09em; color: #6b7280;
    padding: 20px 0 8px; border-bottom: 1px solid #e5e7eb; margin-bottom: 10px;
  }
  .findings-group:first-child .group-header { padding-top: 4px; }
  .findings-group { margin-bottom: 4px; }
  .sc-group-row td {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.09em; color: #6b7280; background: #f9fafb;
    padding: 12px 12px 5px; border-bottom: 1px solid #e5e7eb;
  }

  /* ── Inclusivity section ── */
  .incl-card { border-color: #ddd6fe; background: #fdfcff; }
  .incl-intro {
    font-size: 13px; color: #6b7280; margin-top: -4px; margin-bottom: 20px; line-height: 1.6;
    padding: 12px 14px; background: #f5f3ff; border: 1px solid #ede9fe;
    border-radius: 6px;
  }
  .incl-intro strong { color: #5b21b6; }

  /* Purple badge variant for inclusivity items */
  .incl-section .badge.info {
    background: #f5f3ff; color: #6d28d9; border-color: #c4b5fd;
  }
  .incl-section .issue-card.info {
    background: #fdfcff; border-color: #ede9fe; border-left-color: #8b5cf6;
  }
  .incl-section .mod-summary.info { background: #f5f3ff; }
  .incl-section .mod-summary.pass { background: #f5f3ff; }
  .incl-section .mod-summary.warn { background: #fdf4ff; }
  .incl-section .mod-summary.fail { background: #fdf4ff; }
  .incl-section .group-header { color: #7c3aed; border-bottom-color: #ddd6fe; }

  .incl-label {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 700; padding: 2px 9px;
    border-radius: 100px; letter-spacing: 0.03em;
    background: #f5f3ff; color: #6d28d9; border: 1px solid #c4b5fd;
    margin-bottom: 16px;
  }
`;

// ── Main export ────────────────────────────────────────────────────────────────

export function generateReport(issues, screenshotBase64, url, timestamp, outputPath = './report.html') {
  // Group by moduleId
  const byModule = {};
  for (const issue of issues) {
    (byModule[issue.moduleId] ??= []).push(issue);
  }

  const inclusivityIssues = issues.filter(i => INCLUSIVITY_MODULE_IDS.has(i.moduleId));
  const scoredIssues      = issues.filter(i => !INCLUSIVITY_MODULE_IDS.has(i.moduleId));
  const overall           = moduleStatus(scoredIssues.length ? scoredIssues : issues);

  const counts = { fail: 0, warn: 0, pass: 0, info: 0 };
  for (const i of scoredIssues) counts[i.status] = (counts[i.status] ?? 0) + 1;

  const seen = new Set(scoredIssues.map(i => i.moduleId));
  const allGroupedModules = new Set(GROUPS.flatMap(g => g.modules));

  function scorecardRow(id) {
    const mIssues = byModule[id] ?? [];
    const mStatus = moduleStatus(mIssues);
    const meta    = MODULE_META[id] ?? { name: id, wcag: '' };
    const fails   = mIssues.filter(i => i.status === 'fail').length;
    const warns   = mIssues.filter(i => i.status === 'warn').length;
    const summary = fails > 0 || warns > 0
      ? [fails > 0 ? `${fails} fail` : '', warns > 0 ? `${warns} warn` : ''].filter(Boolean).join(', ')
      : '—';
    return `
        <tr>
          <td>${badge(mStatus)}</td>
          <td class="sc-name">${esc(meta.name)}</td>
          <td class="sc-count">${esc(summary)}</td>
          <td class="sc-wcag">${esc(meta.wcag)}</td>
        </tr>`;
  }

  const scorecardRows = [
    ...GROUPS.flatMap(group => {
      const ids = group.modules.filter(id => seen.has(id));
      if (ids.length === 0) return [];
      return [
        `<tr class="sc-group-row"><td colspan="4">${esc(group.name)}</td></tr>`,
        ...ids.map(scorecardRow),
      ];
    }),
    // Ungrouped modules (unknown moduleIds returned by future checks)
    ...[...seen].filter(id => !allGroupedModules.has(id)).map(scorecardRow),
  ].join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report — ${esc(url)}</title>
  <style>${CSS}</style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <header class="rpt-header">
    <div class="hdr-left">
      <div class="hdr-tool">Accessibility Checker</div>
      <div class="hdr-url">${esc(url)}</div>
      <div class="hdr-meta">
        <span>${esc(timestamp)}</span>
        <span class="hdr-sep">·</span>
        <span>WCAG 2.1 AA</span>
        <span class="hdr-sep">·</span>
        <span>${scoredIssues.length} checked issue${scoredIssues.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <div class="hdr-right">
      <div class="overall ${overall}">${ICON[overall]}&nbsp; OVERALL ${LABEL[overall]}</div>
      <div class="pills">
        <span class="pill fail">${counts.fail} fail</span>
        <span class="pill warn">${counts.warn} warn</span>
        <span class="pill pass">${counts.pass} pass</span>
        ${counts.info > 0 ? `<span class="pill info">${counts.info} info</span>` : ''}
      </div>
    </div>
  </header>

  <!-- Screenshot -->
  <div class="card screenshot-card">
    <details open>
      <summary><span class="scr-arrow">▶</span> Page Screenshot</summary>
      <div class="scr-wrap">
        <img src="data:image/png;base64,${screenshotBase64}"
             alt="Full-page screenshot of ${esc(url)}">
      </div>
    </details>
  </div>

  <!-- Scorecard -->
  <div class="card">
    <div class="card-title">Scorecard</div>
    <table class="sc-table">
      <thead>
        <tr>
          <th>Status</th><th>Module</th><th>Issues</th><th>WCAG Criteria</th>
        </tr>
      </thead>
      <tbody>${scorecardRows}
      </tbody>
    </table>
  </div>

  <!-- Findings -->
  <div class="card">
    <div class="card-title">Findings</div>
    ${[
      ...GROUPS.flatMap(group => {
        const ids = group.modules.filter(id => seen.has(id));
        if (ids.length === 0) return [];
        return [`<div class="findings-group">
      <div class="group-header">${esc(group.name)}</div>
      ${ids.map(id => moduleSection(id, byModule[id] ?? [])).join('')}
    </div>`];
      }),
      ...[...seen].filter(id => !allGroupedModules.has(id))
        .map(id => moduleSection(id, byModule[id] ?? [])),
    ].join('\n    ')}
  </div>

  <!-- Inclusivity & Diversity -->
  ${inclusivityIssues.length > 0 ? `
  <div class="card incl-card incl-section">
    <div class="card-title">
      Inclusivity &amp; Diversity
      <span class="note">informational · does not affect WCAG score</span>
    </div>
    <p class="incl-intro">These findings are <strong>best-practice recommendations</strong> that go beyond WCAG compliance. They cover representation, language inclusivity, cultural assumptions, and geographic bias. None of these items affect the overall pass/fail result — they are provided to help build a more welcoming experience for all users.</p>
    ${(() => {
      const inclByModule = {};
      for (const issue of inclusivityIssues) {
        (inclByModule[issue.moduleId] ??= []).push(issue);
      }
      const inclSeen = new Set(inclusivityIssues.map(i => i.moduleId));
      const allInclGrouped = new Set(INCLUSIVITY_GROUPS.flatMap(g => g.modules));

      function inclModuleSection(moduleId, mIssues) {
        const meta   = INCLUSIVITY_META[moduleId] ?? { name: moduleId };
        const status = moduleStatus(mIssues);
        return `
    <details class="mod"${status === 'fail' || status === 'warn' ? ' open' : ''}>
      <summary class="mod-summary ${status}">
        <span class="mod-arrow">▶</span>
        <span class="mod-icon">${ICON[status]}</span>
        <span class="mod-name">${esc(meta.name)}</span>
        <span class="mod-count">${mIssues.length} finding${mIssues.length !== 1 ? 's' : ''}</span>
        ${badge(status)}
      </summary>
      <div class="mod-body">
        ${mIssues.map(issueCard).join('')}
      </div>
    </details>`;
      }

      return [
        ...INCLUSIVITY_GROUPS.flatMap(group => {
          const ids = group.modules.filter(id => inclSeen.has(id));
          if (ids.length === 0) return [];
          return [`<div class="findings-group">
      <div class="group-header">${esc(group.name)}</div>
      ${ids.map(id => inclModuleSection(id, inclByModule[id] ?? [])).join('')}
    </div>`];
        }),
        ...[...inclSeen].filter(id => !allInclGrouped.has(id))
          .map(id => inclModuleSection(id, inclByModule[id] ?? [])),
      ].join('\n    ');
    })()}
  </div>` : ''}

</div>
</body>
</html>`;

  writeFileSync(outputPath, html, 'utf8');
  return outputPath;
}
