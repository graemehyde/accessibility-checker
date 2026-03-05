import { GoogleGenAI } from '@google/genai';

const RESPONSE_SCHEMA_NOTE = `Respond ONLY with a valid JSON array. No markdown fences, no preamble, no trailing explanation — raw JSON only.

Each element of the array must be an object with exactly these fields:
- "moduleId": a short kebab-case identifier for the check performed
- "wcagLevel": one of "A" | "AA" | "AAA" | "info"
- "wcagCriteria": the WCAG criterion identifier and short name, e.g. "1.4.3 Contrast (Minimum)"
- "status": one of "fail" | "warn" | "pass" | "info"
- "element": a CSS selector or plain-language description of the affected element
- "detail": a clear, specific description of the issue observed
- "suggestion": an actionable recommendation to resolve the issue

If a check finds no issues, include a single "pass" entry for that moduleId.`;

const IMAGE_MODULE_PROMPT = `You are an expert web accessibility auditor. You will be given a full-page screenshot of a webpage.

Perform these visual accessibility checks using only the screenshot:

1. Colour contrast ratios (WCAG 1.4.3 / 1.4.6): Identify text or UI elements where foreground/background contrast fails (4.5:1 for normal text, 3:1 for large text/UI). Also simulate deuteranopia, protanopia, and tritanopia — flag elements that would fail contrast under each simulation.

2. Rendered text pixel height (WCAG 1.4.4): Identify text that appears too small to read comfortably (below ~12px rendered height).

3. Touch target dimensions (WCAG 2.5.5 / 2.5.8): Identify interactive elements that appear smaller than 44×44px (AA) or 24×24px (minimum).

4. Visual density and crowding: Flag areas where content is so densely packed that it impairs readability or usability.

5. Focus indicator visibility (WCAG 2.4.7 / 2.4.11): Identify any focusable elements where the focus ring is absent or has insufficient contrast.

6. Animation flashing intensity (WCAG 2.3.1): Flag any areas of rapid flashing or strobing content that could trigger photosensitive responses.

7. Reading order vs visual flow (WCAG 1.3.2): Note any places where the visual layout implies a reading order that would likely differ from DOM order.

${RESPONSE_SCHEMA_NOTE}`;

const HTML_MODULE_PROMPT = `You are an expert web accessibility auditor. You will be given the HTML source of a webpage.

Perform these structural and semantic accessibility checks using only the HTML:

1. Alt text quality (WCAG 1.1.1): For every <img>, flag missing, empty, generic ("image", "photo"), or uninformative alt attributes.

2. Semantic HTML structure (WCAG 1.3.1): Identify misuse of heading levels, missing landmark regions (<main>, <nav>, <header>, etc.), or content marked up with generic <div>/<span> where semantic elements exist.

3. ARIA label correctness (WCAG 4.1.2): Flag aria-label, aria-labelledby, or aria-describedby values that are missing, duplicate, or incorrectly reference non-existent IDs.

4. Form label association (WCAG 1.3.1 / 3.3.2): Identify <input>, <select>, and <textarea> elements not properly associated with a <label> (via for/id or wrapping).

5. Link text clarity (WCAG 2.4.4): Flag links whose accessible name is non-descriptive ("click here", "read more", "here") or identical to another link with a different destination.

6. Language attributes (WCAG 3.1.1 / 3.1.2): Check for a missing or incorrect lang on <html>, and flag inline content in a different language lacking lang attributes.

7. Keyboard navigation and tab order (WCAG 2.1.1 / 2.4.3): Identify tabindex values > 0 that would disrupt natural tab order, or interactive elements that are not keyboard-reachable.

8. Video/audio captions and transcripts (WCAG 1.2.2 / 1.2.3): Flag <video> or <audio> elements lacking <track kind="captions"> or an associated transcript link.

${RESPONSE_SCHEMA_NOTE}`;

const COMBINED_MODULE_PROMPT = `You are an expert web accessibility auditor. You will be given a full-page screenshot and the HTML source of a webpage.

Perform these checks that require cross-referencing the visual rendering with the HTML markup:

1. Responsive text reflow at 200% zoom (WCAG 1.4.10): Based on the layout visible in the screenshot and the HTML structure, assess whether the content would likely reflow to a single column at 320px width without horizontal scrolling.

2. Icon-only buttons (WCAG 1.1.1 / 4.1.2): Identify buttons or links that appear as icons only in the screenshot — verify whether the HTML provides a screen-reader-accessible label (aria-label, aria-labelledby, visually-hidden text, or title).

3. Custom controls (WCAG 4.1.2): Find visually custom UI widgets (sliders, toggles, dropdowns, tabs) in the screenshot and verify the HTML uses appropriate ARIA roles, states, and properties.

4. Loading states and ARIA live regions (WCAG 4.1.3): Identify dynamic areas (spinners, progress indicators, status messages) visible in the screenshot and check whether the HTML includes aria-live, role="status", or role="alert" to announce changes to assistive technologies.

${RESPONSE_SCHEMA_NOTE}`;

const COGNITIVE_MODULE_PROMPT = `You are an expert web accessibility and plain-language auditor. You will be given the HTML source of a webpage.

Perform these cognitive accessibility checks using only the HTML:

1. Flesch-Kincaid reading level (WCAG 3.1.5 / AAA): Extract the main body text and estimate the Flesch-Kincaid grade level. Flag if it exceeds grade 9 without a simplified summary available.

2. Content hierarchy and structure (WCAG 1.3.1 / 2.4.6): Assess whether heading levels, list structure, and section groupings create a clear, logical outline that aids comprehension.

3. Instruction clarity for multi-step processes (WCAG 3.3.2): Identify forms, wizards, or procedural content where instructions are ambiguous, missing, or split across the page in a confusing way.

4. Jargon density: Flag paragraphs or labels that contain a high density of technical terms, acronyms (without expansion), or domain-specific language that may exclude users with cognitive disabilities.

${RESPONSE_SCHEMA_NOTE}`;

const MODEL = 'gemini-flash-lite-latest';

async function runModule(ai, name, systemPrompt, parts) {
  console.error(`  [llm] starting: ${name}`);
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
      contents: [{ role: 'user', parts }],
    });
    const results = JSON.parse(response.text.trim());
    console.error(`  [llm] complete: ${name} (${results.length} result${results.length !== 1 ? 's' : ''})`);
    return results;
  } catch (err) {
    console.error(`  [llm] WARNING: ${name} failed — ${err.message}`);
    return [];
  }
}

export async function runLLMAudit(screenshotBase64, html) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. ' +
      'Export it before running: export GEMINI_API_KEY=your_key_here'
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const screenshotPart = {
    inlineData: { mimeType: 'image/png', data: screenshotBase64 },
  };
  const htmlPart = { text: `HTML source:\n\n${html}` };

  console.error('Running LLM audit modules in parallel…');

  const [imageResults, htmlResults, combinedResults, cognitiveResults] = await Promise.all([
    runModule(ai, 'image',    IMAGE_MODULE_PROMPT,    [screenshotPart]),
    runModule(ai, 'html',     HTML_MODULE_PROMPT,     [htmlPart]),
    runModule(ai, 'combined', COMBINED_MODULE_PROMPT, [screenshotPart, htmlPart]),
    runModule(ai, 'cognitive',COGNITIVE_MODULE_PROMPT,[htmlPart]),
  ]);

  return [...imageResults, ...htmlResults, ...combinedResults, ...cognitiveResults];
}
