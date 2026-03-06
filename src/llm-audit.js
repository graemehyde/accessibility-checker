import { GoogleGenAI } from '@google/genai';
import { AzureOpenAI } from 'openai';

const RESPONSE_SCHEMA_NOTE = `Respond ONLY with a valid JSON array. No markdown fences, no preamble, no trailing explanation — raw JSON only.

Each element of the array must be an object with exactly these fields:
- "moduleId": the exact string specified in brackets after each check number above (e.g. "colour-contrast")
- "wcagLevel": one of "A" | "AA" | "AAA" | "info"
- "wcagCriteria": the WCAG criterion identifier and short name, e.g. "1.4.3 Contrast (Minimum)"
- "status": one of "fail" | "warn" | "pass" | "info"
- "element": a CSS selector or plain-language description of the affected element
- "detail": a clear, specific description of the issue observed
- "suggestion": an actionable recommendation to resolve the issue

If a check finds no issues, include a single "pass" entry for that moduleId.`;

const IMAGE_MODULE_PROMPT = `You are an expert web accessibility auditor. You will be given a full-page screenshot of a webpage.

Perform these visual accessibility checks using only the screenshot:

1. [colour-contrast] Colour contrast ratios (WCAG 1.4.3 / 1.4.6): Identify text or UI elements where foreground/background contrast fails (4.5:1 for normal text, 3:1 for large text/UI).

2. [colour-blindness] Colour blindness simulation (WCAG 1.4.3 / 1.4.6): Simulate deuteranopia, protanopia, and tritanopia — flag elements that would fail contrast or become indistinguishable under each simulation.

3. [text-size] Rendered text pixel height (WCAG 1.4.4): Identify text that appears too small to read comfortably (below ~12px rendered height).

4. [touch-target] Touch target dimensions (WCAG 2.5.5 / 2.5.8): Identify interactive elements that appear smaller than 44×44px (AA) or 24×24px (minimum).

5. [visual-density] Visual density and crowding: Flag areas where content is so densely packed that it impairs readability or usability.

6. [focus-indicator] Focus indicator visibility (WCAG 2.4.7 / 2.4.11): Identify any focusable elements where the focus ring is absent or has insufficient contrast.

7. [animation-flashing] Animation flashing intensity (WCAG 2.3.1): Flag any areas of rapid flashing or strobing content that could trigger photosensitive responses.

8. [reading-order] Reading order vs visual flow (WCAG 1.3.2): Note any places where the visual layout implies a reading order that would likely differ from DOM order.

${RESPONSE_SCHEMA_NOTE}`;

const HTML_MODULE_PROMPT = `You are an expert web accessibility auditor. You will be given the HTML source of a webpage.

Perform these structural and semantic accessibility checks using only the HTML:

1. [alt-text] Alt text quality (WCAG 1.1.1): For every <img>, flag missing, empty, generic ("image", "photo"), or uninformative alt attributes.

2. [semantic-html] Semantic HTML structure (WCAG 1.3.1): Identify misuse of heading levels, missing landmark regions (<main>, <nav>, <header>, etc.), or content marked up with generic <div>/<span> where semantic elements exist.

3. [aria] ARIA label correctness (WCAG 4.1.2): Flag aria-label, aria-labelledby, or aria-describedby values that are missing, duplicate, or incorrectly reference non-existent IDs.

4. [form-labels] Form label association (WCAG 1.3.1 / 3.3.2): Identify <input>, <select>, and <textarea> elements not properly associated with a <label> (via for/id or wrapping).

5. [link-text] Link text clarity (WCAG 2.4.4): Flag links whose accessible name is non-descriptive ("click here", "read more", "here") or identical to another link with a different destination.

6. [language] Language attributes (WCAG 3.1.1 / 3.1.2): Check for a missing or incorrect lang on <html>, and flag inline content in a different language lacking lang attributes.

7. [keyboard-nav] Keyboard navigation and tab order (WCAG 2.1.1 / 2.4.3): Identify tabindex values > 0 that would disrupt natural tab order, or interactive elements that are not keyboard-reachable.

8. [captions] Video/audio captions and transcripts (WCAG 1.2.2 / 1.2.3): Flag <video> or <audio> elements lacking <track kind="captions"> or an associated transcript link.

${RESPONSE_SCHEMA_NOTE}`;

const COMBINED_MODULE_PROMPT = `You are an expert web accessibility auditor. You will be given a full-page screenshot and the HTML source of a webpage.

Perform these checks that require cross-referencing the visual rendering with the HTML markup:

1. [text-reflow] Responsive text reflow at 200% zoom (WCAG 1.4.10): Based on the layout visible in the screenshot and the HTML structure, assess whether the content would likely reflow to a single column at 320px width without horizontal scrolling.

2. [icon-buttons] Icon-only buttons (WCAG 1.1.1 / 4.1.2): Identify buttons or links that appear as icons only in the screenshot — verify whether the HTML provides a screen-reader-accessible label (aria-label, aria-labelledby, visually-hidden text, or title).

3. [custom-controls] Custom controls (WCAG 4.1.2): Find visually custom UI widgets (sliders, toggles, dropdowns, tabs) in the screenshot and verify the HTML uses appropriate ARIA roles, states, and properties.

4. [live-regions] Loading states and ARIA live regions (WCAG 4.1.3): Identify dynamic areas (spinners, progress indicators, status messages) visible in the screenshot and check whether the HTML includes aria-live, role="status", or role="alert" to announce changes to assistive technologies.

${RESPONSE_SCHEMA_NOTE}`;

const COGNITIVE_MODULE_PROMPT = `You are an expert web accessibility and plain-language auditor. You will be given the HTML source of a webpage.

Perform these cognitive accessibility checks using only the HTML:

1. [reading-level] Flesch-Kincaid reading level (WCAG 3.1.5 / AAA): Extract the main body text and estimate the Flesch-Kincaid grade level. Flag if it exceeds grade 9 without a simplified summary available.

2. [content-hierarchy] Content hierarchy and structure (WCAG 1.3.1 / 2.4.6): Assess whether heading levels, list structure, and section groupings create a clear, logical outline that aids comprehension.

3. [instruction-clarity] Instruction clarity for multi-step processes (WCAG 3.3.2): Identify forms, wizards, or procedural content where instructions are ambiguous, missing, or split across the page in a confusing way.

4. [jargon] Jargon density: Flag paragraphs or labels that contain a high density of technical terms, acronyms (without expansion), or domain-specific language that may exclude users with cognitive disabilities.

${RESPONSE_SCHEMA_NOTE}`;

const INCLUSIVITY_RESPONSE_SCHEMA_NOTE = `Respond ONLY with a valid JSON array. No markdown fences, no preamble, no trailing explanation — raw JSON only.

Each element of the array must be an object with exactly these fields:
- "moduleId": the exact string specified in brackets after each check number above (e.g. "gendered-language")
- "wcagLevel": always "info" — these findings are beyond WCAG
- "wcagCriteria": a short label describing the best-practice principle, e.g. "Inclusive Design · Gender Neutrality"
- "status": always "info"
- "element": a CSS selector, plain-language description, or image region of the affected content
- "detail": a clear, specific description of the issue observed and why it may exclude or marginalise users
- "suggestion": an actionable recommendation to improve inclusivity

Only report genuine issues. If a check finds nothing to flag, omit it entirely — do not include a "pass" entry.`;

const INCLUSIVITY_MODULE_PROMPT = `You are an expert inclusivity, diversity, and equity consultant reviewing a webpage. Your role is to identify content, imagery, and patterns that may exclude, stereotype, or marginalise users based on gender, age, ethnicity, culture, ability, or geographic background.

You will be given a full-page screenshot and the HTML source of the webpage.

Perform these checks:

From the screenshot:

1. [representation] Representation in imagery: Are people depicted in photos, illustrations, or avatars diverse in gender expression, age, ethnicity, and visible ability? Flag homogeneous representation or conspicuous absence of any group.

2. [symbolic-bias] Symbolic bias: Identify icons, flags, emblems, or imagery that implicitly assume a single culture, religion, or nationality as the default (e.g. a US flag as a default "English" selector, a church icon for "community").

3. [colour-symbolism] Colour symbolism: Flag use of colour that carries culturally specific meaning that may not transfer globally (e.g. white = purity in some cultures / mourning in others; red = danger vs. luck vs. romance depending on context).

From the HTML:

4. [gendered-language] Gendered language: Identify words and phrases with unnecessary gender assumptions — job titles ("stewardess", "fireman", "manpower"), collective address ("hey guys"), or binary-only form fields (Male/Female with no other option).

5. [cultural-idioms] Cultural idioms: Flag idioms, metaphors, or colloquialisms that are specific to one culture or language community and may be confusing or offensive to international users (e.g. "hit it out of the park", "spanner in the works").

6. [locale-assumptions] Locale assumptions: Identify hardcoded locale conventions — date formats without ISO clarity (e.g. "03/04/25"), currency symbols without ISO codes (e.g. "$" instead of "USD"), imperial-only measurements, or phone/address fields assuming a single country.

7. [exclusionary-phrasing] Exclusionary phrasing: Flag language that assumes ability, age, or technical literacy — dismissive minimisers ("just click", "simply scroll", "obviously", "easy"), ability assumptions ("you can see that…", "as you heard"), or age assumptions ("even your grandparents can use this").

8. [pronoun-inclusivity] Pronoun inclusivity: In forms, profile settings, or sign-up flows, check whether gender-neutral pronoun options or a free-text field are available alongside or instead of binary gender selectors.

From both screenshot and HTML:

9. [stereotype-reinforcement] Stereotype reinforcement: Does the visual content (images, icons) contradict or reinforce stereotypes implied by the surrounding text? (e.g. an article about leadership showing only men, a "nurturing" section illustrated exclusively with women).

10. [geographic-bias] Geographic bias: Are maps, example data, default content, phone number formats, or illustrative scenarios Western- or US-centric in a way that excludes or alienates users from other regions?

${INCLUSIVITY_RESPONSE_SCHEMA_NOTE}`;

const MODEL = 'gemini-flash-lite-latest';
// Each adapter exposes a single method:
//   generate(systemPrompt, parts) => Promise<string>  (raw JSON text)
// Parts use Gemini's internal shape; adapters handle translation.

class GeminiAdapter {
  constructor(apiKey) {
    this._ai = new GoogleGenAI({ apiKey });
  }
  async generate(systemPrompt, parts) {
    const response = await this._ai.models.generateContent({
      model: MODEL,
      config: { systemInstruction: systemPrompt, responseMimeType: 'application/json' },
      contents: [{ role: 'user', parts }],
    });
    return response.text.trim();
  }
}

class AzureAdapter {
  constructor(endpoint, apiKey, deployment, apiVersion) {
    this._client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
    this._deployment = deployment;
  }
  async generate(systemPrompt, parts) {
    const content = parts.map(p =>
      p.inlineData
        ? { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`, detail: 'high' } }
        : { type: 'text', text: p.text }
    );
    const response = await this._client.chat.completions.create({
      model: this._deployment,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
    });
    return response.choices[0].message.content.trim();
  }
}

function createAdapter(provider) {
  const resolved = provider ?? (process.env.AZURE_OPENAI_ENDPOINT ? 'azure' : 'gemini');
  if (resolved === 'azure') {
    const endpoint   = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey     = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
    if (!endpoint || !apiKey || !deployment) {
      throw new Error('Azure OpenAI requires AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT.');
    }
    return new AzureAdapter(endpoint, apiKey, deployment, apiVersion);
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Export it before running: export GEMINI_API_KEY=your_key_here');
  }
  return new GeminiAdapter(apiKey);
}

// ── Module runner ─────────────────────────────────────────────────────────────

async function runModule(adapter, name, systemPrompt, parts) {
  console.error(`  [llm] starting: ${name}`);
  try {
    const raw = await adapter.generate(systemPrompt, parts);
    const results = JSON.parse(raw);
    console.error(`  [llm] complete: ${name} (${results.length} result${results.length !== 1 ? 's' : ''})`);
    return results;
  } catch (err) {
    console.error(`  [llm] WARNING: ${name} failed — ${err.message}`);
    return [];
  }
}

export async function runLLMAudit(screenshotBase64, html, provider) {
  const adapter = createAdapter(provider);

  const screenshotPart = {
    inlineData: { mimeType: 'image/png', data: screenshotBase64 },
  };
  const htmlPart = { text: `HTML source:\n\n${html}` };

  console.error('Running LLM audit modules in parallel…');

  const [imageResults, htmlResults, combinedResults, cognitiveResults, inclusivityResults] = await Promise.all([
    runModule(adapter, 'image',       IMAGE_MODULE_PROMPT,       [screenshotPart]),
    runModule(adapter, 'html',        HTML_MODULE_PROMPT,        [htmlPart]),
    runModule(adapter, 'combined',    COMBINED_MODULE_PROMPT,    [screenshotPart, htmlPart]),
    runModule(adapter, 'cognitive',   COGNITIVE_MODULE_PROMPT,   [htmlPart]),
    runModule(adapter, 'inclusivity', INCLUSIVITY_MODULE_PROMPT, [screenshotPart, htmlPart]),
  ]);

  return [...imageResults, ...htmlResults, ...combinedResults, ...cognitiveResults, ...inclusivityResults];
}
