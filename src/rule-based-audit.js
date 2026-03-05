/**
 * Rule-based accessibility audit using Playwright's page.evaluate().
 * All checks run inside the browser context — no Node.js APIs used inside evaluate().
 * Returns an array of issues in the shared schema:
 *   { moduleId, wcagLevel, wcagCriteria, status, element, detail, suggestion }
 */
export async function runRuleBasedAudit(page) {
  return page.evaluate(() => {
    const results = [];

    // ── Helpers ────────────────────────────────────────────────────────────

    function issue(moduleId, wcagLevel, wcagCriteria, status, element, detail, suggestion) {
      return { moduleId, wcagLevel, wcagCriteria, status, element, detail, suggestion };
    }

    /** Generate a short, human-readable CSS selector for an element. */
    function sel(el) {
      try {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const tag = el.tagName.toLowerCase();
        const cls = Array.from(el.classList)
          .slice(0, 2)
          .map(c => `.${CSS.escape(c)}`)
          .join('');
        const typeAttr = el.hasAttribute('type') ? `[type="${el.getAttribute('type')}"]` : '';
        const nameAttr = el.hasAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '';
        return `${tag}${cls}${typeAttr}${nameAttr}` || tag;
      } catch {
        return el.tagName.toLowerCase();
      }
    }

    function isVisible(el) {
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    }

    // ── 1. Semantic HTML ───────────────────────────────────────────────────

    // 1a. H1 count
    const h1s = document.querySelectorAll('h1');
    if (h1s.length === 0) {
      results.push(issue(
        'semantic-html', 'A', '1.3.1 Info and Relationships', 'fail',
        'document',
        'No <h1> element found on the page.',
        'Add a single <h1> that describes the main topic of the page.',
      ));
    } else if (h1s.length > 1) {
      results.push(issue(
        'semantic-html', 'A', '1.3.1 Info and Relationships', 'warn',
        `h1 (×${h1s.length})`,
        `${h1s.length} <h1> elements found. Most pages should have exactly one.`,
        'Reduce to a single <h1> per page to clearly identify the primary heading.',
      ));
    } else {
      results.push(issue(
        'semantic-html', 'A', '1.3.1 Info and Relationships', 'pass',
        'h1',
        'Single <h1> element present.',
        '',
      ));
    }

    // 1b. Skipped heading levels
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
    const skips = [];
    for (let i = 1; i < headings.length; i++) {
      const prev = parseInt(headings[i - 1].tagName[1], 10);
      const curr = parseInt(headings[i].tagName[1], 10);
      if (curr > prev + 1) {
        skips.push(`<h${prev}> → <h${curr}>`);
      }
    }
    if (skips.length > 0) {
      results.push(issue(
        'semantic-html', 'A', '1.3.1 Info and Relationships', 'fail',
        'heading hierarchy',
        `Heading levels are skipped: ${skips.join('; ')}.`,
        'Maintain a sequential heading hierarchy without gaps (e.g. h1 → h2 → h3).',
      ));
    } else if (headings.length > 0) {
      results.push(issue(
        'semantic-html', 'A', '1.3.1 Info and Relationships', 'pass',
        'heading hierarchy',
        'No skipped heading levels detected.',
        '',
      ));
    }

    // 1c. Landmark elements
    const landmarks = ['main', 'nav', 'header', 'footer'];
    const missing = landmarks.filter(tag => !document.querySelector(tag));
    if (missing.length > 0) {
      results.push(issue(
        'semantic-html', 'AA', '1.3.6 Identify Purpose', 'warn',
        missing.map(t => `<${t}>`).join(', '),
        `Missing landmark element(s): ${missing.map(t => `<${t}>`).join(', ')}.`,
        'Add the missing landmark elements to help screen reader users navigate page regions.',
      ));
    } else {
      results.push(issue(
        'semantic-html', 'AA', '1.3.6 Identify Purpose', 'pass',
        'landmarks',
        'All core landmark elements (<main>, <nav>, <header>, <footer>) are present.',
        '',
      ));
    }

    // 1d. Interactive <div>/<span> without roles
    const eventAttrs = ['onclick', 'onkeydown', 'onkeypress', 'onkeyup', 'onmousedown'];
    const badInteractive = Array.from(document.querySelectorAll('div, span')).filter(el => {
      const hasEvent = eventAttrs.some(a => el.hasAttribute(a));
      const hasPosTabindex = el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1';
      return (hasEvent || hasPosTabindex) && !el.hasAttribute('role');
    });

    if (badInteractive.length > 0) {
      const shown = badInteractive.slice(0, 5);
      for (const el of shown) {
        results.push(issue(
          'semantic-html', 'A', '4.1.2 Name, Role, Value', 'fail',
          sel(el),
          `<${el.tagName.toLowerCase()}> is interactive (has event handler or tabindex) but has no ARIA role.`,
          'Add an appropriate role (e.g. role="button") and ensure keyboard accessibility.',
        ));
      }
      if (badInteractive.length > 5) {
        results.push(issue(
          'semantic-html', 'A', '4.1.2 Name, Role, Value', 'fail',
          'div, span',
          `${badInteractive.length - 5} more interactive <div>/<span> elements without roles (not shown individually).`,
          'Audit all interactive <div>/<span> elements and add appropriate ARIA roles.',
        ));
      }
    } else {
      results.push(issue(
        'semantic-html', 'A', '4.1.2 Name, Role, Value', 'pass',
        'div, span',
        'No interactive <div>/<span> elements found without ARIA roles.',
        '',
      ));
    }

    // ── 2. ARIA attributes ─────────────────────────────────────────────────

    const VALID_ROLES = new Set([
      'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell',
      'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition',
      'dialog', 'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell',
      'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
      'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
      'navigation', 'none', 'note', 'option', 'presentation', 'progressbar', 'radio',
      'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search',
      'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table',
      'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree',
      'treegrid', 'treeitem',
    ]);

    const REQUIRED_ATTRS = {
      checkbox:  ['aria-checked'],
      combobox:  ['aria-expanded'],
      option:    ['aria-selected'],
      radio:     ['aria-checked'],
      scrollbar: ['aria-controls', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
      slider:    ['aria-valuenow', 'aria-valuemin', 'aria-valuemax'],
      switch:    ['aria-checked'],
      tab:       ['aria-selected'],
      treeitem:  ['aria-selected'],
    };

    const roledEls = Array.from(document.querySelectorAll('[role]'));

    // 2a. Invalid roles
    const invalidRoles = roledEls.filter(el => !VALID_ROLES.has(el.getAttribute('role')));
    if (invalidRoles.length > 0) {
      for (const el of invalidRoles.slice(0, 5)) {
        results.push(issue(
          'aria', 'A', '4.1.2 Name, Role, Value', 'fail',
          sel(el),
          `Invalid ARIA role "${el.getAttribute('role')}" on <${el.tagName.toLowerCase()}>.`,
          'Use a valid WAI-ARIA 1.2 role. See https://www.w3.org/TR/wai-aria-1.2/#role_definitions',
        ));
      }
      if (invalidRoles.length > 5) {
        results.push(issue(
          'aria', 'A', '4.1.2 Name, Role, Value', 'fail',
          '[role]',
          `${invalidRoles.length - 5} more elements with invalid ARIA roles (not shown individually).`,
          'Audit all role attributes against the WAI-ARIA 1.2 specification.',
        ));
      }
    } else {
      results.push(issue(
        'aria', 'A', '4.1.2 Name, Role, Value', 'pass',
        '[role]',
        'All ARIA roles are valid WAI-ARIA values.',
        '',
      ));
    }

    // 2b. Missing required attributes for a role
    const missingAttrIssues = [];
    for (const el of roledEls) {
      const role = el.getAttribute('role');
      const required = REQUIRED_ATTRS[role];
      if (!required) continue;
      const absent = required.filter(attr => !el.hasAttribute(attr));
      if (absent.length > 0) {
        missingAttrIssues.push({ el, role, absent });
      }
    }
    if (missingAttrIssues.length > 0) {
      for (const { el, role, absent } of missingAttrIssues.slice(0, 5)) {
        results.push(issue(
          'aria', 'A', '4.1.2 Name, Role, Value', 'fail',
          sel(el),
          `role="${role}" is missing required attribute(s): ${absent.join(', ')}.`,
          'Add the missing attribute(s) so assistive technologies can convey the correct state.',
        ));
      }
      if (missingAttrIssues.length > 5) {
        results.push(issue(
          'aria', 'A', '4.1.2 Name, Role, Value', 'fail',
          '[role]',
          `${missingAttrIssues.length - 5} more roles with missing required attributes (not shown individually).`,
          'Review all ARIA roles and ensure required state/property attributes are present.',
        ));
      }
    } else if (roledEls.length > 0) {
      results.push(issue(
        'aria', 'A', '4.1.2 Name, Role, Value', 'pass',
        '[role]',
        'All ARIA roles have their required attributes present.',
        '',
      ));
    }

    // 2c. Broken aria-labelledby / aria-describedby references
    const refEls = Array.from(document.querySelectorAll('[aria-labelledby], [aria-describedby]'));
    const brokenRefs = [];
    for (const el of refEls) {
      for (const attr of ['aria-labelledby', 'aria-describedby']) {
        const val = el.getAttribute(attr);
        if (!val) continue;
        const deadIds = val.trim().split(/\s+/).filter(id => !document.getElementById(id));
        if (deadIds.length > 0) brokenRefs.push({ el, attr, deadIds });
      }
    }
    if (brokenRefs.length > 0) {
      for (const { el, attr, deadIds } of brokenRefs.slice(0, 5)) {
        results.push(issue(
          'aria', 'A', '4.1.2 Name, Role, Value', 'fail',
          sel(el),
          `${attr}="${el.getAttribute(attr)}" references ID(s) that do not exist in the DOM: ${deadIds.map(id => `#${id}`).join(', ')}.`,
          'Ensure every ID referenced by aria-labelledby or aria-describedby exists in the DOM.',
        ));
      }
      if (brokenRefs.length > 5) {
        results.push(issue(
          'aria', 'A', '4.1.2 Name, Role, Value', 'fail',
          '[aria-labelledby], [aria-describedby]',
          `${brokenRefs.length - 5} more broken ARIA ID references (not shown individually).`,
          'Audit all aria-labelledby and aria-describedby values for dead ID references.',
        ));
      }
    } else if (refEls.length > 0) {
      results.push(issue(
        'aria', 'A', '4.1.2 Name, Role, Value', 'pass',
        '[aria-labelledby], [aria-describedby]',
        'All aria-labelledby and aria-describedby ID references resolve correctly.',
        '',
      ));
    }

    // 2d. aria-hidden on focusable elements
    const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const ariaHiddenFocusable = Array.from(document.querySelectorAll('[aria-hidden="true"]'))
      .filter(el => el.matches(FOCUSABLE) || el.querySelector(FOCUSABLE));
    if (ariaHiddenFocusable.length > 0) {
      for (const el of ariaHiddenFocusable.slice(0, 5)) {
        results.push(issue(
          'aria', 'A', '4.1.2 Name, Role, Value', 'fail',
          sel(el),
          'aria-hidden="true" is applied to a focusable element or a container with focusable descendants.',
          'Remove aria-hidden from elements that are keyboard-reachable. Use tabindex="-1" to remove from tab order, or restructure the DOM.',
        ));
      }
      if (ariaHiddenFocusable.length > 5) {
        results.push(issue(
          'aria', 'A', '4.1.2 Name, Role, Value', 'fail',
          '[aria-hidden]',
          `${ariaHiddenFocusable.length - 5} more aria-hidden violations on focusable elements (not shown individually).`,
          'Audit all aria-hidden="true" usages to ensure no focusable element is hidden from AT.',
        ));
      }
    } else {
      results.push(issue(
        'aria', 'A', '4.1.2 Name, Role, Value', 'pass',
        '[aria-hidden]',
        'No aria-hidden="true" found on focusable elements or their containers.',
        '',
      ));
    }

    // ── 3. Touch target sizing ─────────────────────────────────────────────

    const INTERACTIVE_SEL = [
      'a[href]', 'button', 'input', 'select', 'textarea',
      '[role="button"]', '[role="link"]', '[role="checkbox"]',
      '[role="radio"]', '[role="switch"]', '[role="tab"]', '[role="menuitem"]',
    ].join(', ');

    let touchFails = 0;
    let touchWarns = 0;

    for (const el of document.querySelectorAll(INTERACTIVE_SEL)) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w === 0 || h === 0) continue;

      if (w < 24 || h < 24) {
        touchFails++;
        if (touchFails <= 3) {
          results.push(issue(
            'touch-target', 'AA', '2.5.8 Target Size (Minimum)', 'fail',
            sel(el),
            `Touch target is ${w}×${h}px — below the 24×24px minimum (WCAG 2.5.8).`,
            'Increase the element size or add padding to reach at least 24×24px (44×44px recommended).',
          ));
        }
      } else if (w < 44 || h < 44) {
        touchWarns++;
        if (touchWarns <= 3) {
          results.push(issue(
            'touch-target', 'AA', '2.5.5 Target Size (Enhanced)', 'warn',
            sel(el),
            `Touch target is ${w}×${h}px — below the recommended 44×44px (WCAG 2.5.5).`,
            'Increase the element size or padding to 44×44px for optimal touch usability.',
          ));
        }
      }
    }

    if (touchFails > 3) {
      results.push(issue(
        'touch-target', 'AA', '2.5.8 Target Size (Minimum)', 'fail',
        'interactive elements',
        `${touchFails - 3} additional interactive element(s) also fail the 24×24px minimum (not shown individually).`,
        'Review all interactive elements for adequate touch target sizing.',
      ));
    }
    if (touchWarns > 3) {
      results.push(issue(
        'touch-target', 'AA', '2.5.5 Target Size (Enhanced)', 'warn',
        'interactive elements',
        `${touchWarns - 3} additional interactive element(s) fall below the recommended 44×44px (not shown individually).`,
        'Review all interactive elements and increase touch target sizes where possible.',
      ));
    }
    if (touchFails === 0 && touchWarns === 0) {
      results.push(issue(
        'touch-target', 'AA', '2.5.5 Target Size (Enhanced)', 'pass',
        'all interactive elements',
        'All visible interactive elements meet the 44×44px recommended target size.',
        '',
      ));
    } else if (touchFails === 0) {
      results.push(issue(
        'touch-target', 'AA', '2.5.8 Target Size (Minimum)', 'pass',
        'all interactive elements',
        'All visible interactive elements meet the 24×24px minimum target size.',
        '',
      ));
    }

    // ── 4. Alt text patterns ───────────────────────────────────────────────

    const GENERIC_ALT = /^(image|photo|photograph|picture|graphic|icon|thumbnail|banner|logo|img|figure|illustration|screenshot)s?$/i;
    const FILENAME_ALT = /\.(jpe?g|png|gif|webp|svg|bmp|avif|tiff?)(\?[^"]*)?$/i;

    let altIssueCount = 0;

    for (const img of document.querySelectorAll('img')) {
      if (!img.hasAttribute('alt')) {
        altIssueCount++;
        if (altIssueCount <= 5) {
          results.push(issue(
            'alt-text-patterns', 'A', '1.1.1 Non-text Content', 'fail',
            sel(img),
            'Image is missing the alt attribute entirely.',
            'Add alt="". Use an empty string for decorative images, or a meaningful description for informative ones.',
          ));
        }
      } else {
        const alt = img.getAttribute('alt').trim();
        if (alt !== '' && FILENAME_ALT.test(alt)) {
          altIssueCount++;
          if (altIssueCount <= 5) {
            results.push(issue(
              'alt-text-patterns', 'A', '1.1.1 Non-text Content', 'fail',
              sel(img),
              `Alt text appears to be a raw filename: "${alt}".`,
              'Replace the filename with a meaningful description of what the image depicts.',
            ));
          }
        } else if (alt !== '' && GENERIC_ALT.test(alt)) {
          altIssueCount++;
          if (altIssueCount <= 5) {
            results.push(issue(
              'alt-text-patterns', 'A', '1.1.1 Non-text Content', 'warn',
              sel(img),
              `Alt text is a generic label: "${alt}".`,
              'Replace with a specific description of the image content, or use alt="" if purely decorative.',
            ));
          }
        }
      }
    }

    if (altIssueCount > 5) {
      results.push(issue(
        'alt-text-patterns', 'A', '1.1.1 Non-text Content', 'fail',
        'img',
        `${altIssueCount - 5} additional image(s) also have alt text issues (not shown individually).`,
        'Audit all images on the page for appropriate alt attributes.',
      ));
    }

    const totalImgs = document.querySelectorAll('img').length;
    if (altIssueCount === 0) {
      if (totalImgs > 0) {
        results.push(issue(
          'alt-text-patterns', 'A', '1.1.1 Non-text Content', 'pass',
          'img',
          `All ${totalImgs} image(s) have non-generic, non-filename alt text (or are marked decorative).`,
          '',
        ));
      } else {
        results.push(issue(
          'alt-text-patterns', 'A', '1.1.1 Non-text Content', 'info',
          'img',
          'No <img> elements found on the page.',
          '',
        ));
      }
    }

    return results;
  });
}
