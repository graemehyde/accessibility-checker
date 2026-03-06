import { GoogleGenAI } from '@google/genai';
import { AzureOpenAI } from 'openai';

const SYSTEM_PROMPT = `You are an expert web accessibility auditor. You will be given a full-page screenshot and the HTML source of a webpage.

Perform exactly three accessibility checks:

1. Visual colour contrast (WCAG 1.4.3 / 1.4.6): Identify text or UI elements where the foreground and background colour combination fails to meet the minimum contrast ratio (4.5:1 for normal text, 3:1 for large text / UI components).

2. Cultural and gender bias (best practice / WCAG 2.2 intent): Identify language, imagery, iconography, or patterns in the page that reflect cultural stereotyping, gender bias, or exclusionary assumptions.

3. Alt text accuracy (WCAG 1.1.1): For every image visible in the screenshot, cross-reference its alt attribute from the HTML. Flag images where the alt text is absent, empty, generic (e.g. "image"), inaccurate, or misleading compared to what the image actually depicts.

Respond ONLY with a valid JSON array. No markdown fences, no preamble, no trailing explanation — raw JSON only.

Each element of the array must be an object with exactly these fields:
- "moduleId": one of "colour-contrast" | "bias" | "alt-text"
- "wcagLevel": one of "A" | "AA" | "AAA" | "info"
- "wcagCriteria": the WCAG criterion identifier and short name, e.g. "1.4.3 Contrast (Minimum)"
- "status": one of "fail" | "warn" | "pass" | "info"
- "element": a CSS selector or plain-language description of the affected element
- "detail": a clear, specific description of the issue observed
- "suggestion": an actionable recommendation to resolve the issue

If a check finds no issues, include a single "pass" entry for that moduleId.`;

export async function runLLMAudit(screenshotBase64, html, provider) {
  const useAzure = (provider ?? (process.env.AZURE_OPENAI_ENDPOINT ? 'azure' : 'gemini')) === 'azure';
  if (useAzure) return runAzureAudit(screenshotBase64, html);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY environment variable is not set. ' +
      'Export it before running: export GEMINI_API_KEY=your_key_here'
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: screenshotBase64,
            },
          },
          {
            text: `HTML source:\n\n${html}`,
          },
        ],
      },
    ],
  });

  const raw = response.text.trim();
  return JSON.parse(raw);
}


async function runAzureAudit(screenshotBase64, html) {
  const endpoint   = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey     = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';
  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure OpenAI requires AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT.');
  }
  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshotBase64}`, detail: 'high' } },
          { type: 'text', text: `HTML source:\n\n${html}` },
        ],
      },
    ],
  });
  return JSON.parse(response.choices[0].message.content.trim());
}