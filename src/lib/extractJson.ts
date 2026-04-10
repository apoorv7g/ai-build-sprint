export function extractJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {}
  const f = text.match(/```json\s*([\s\S]*?)```/);
  if (f) return JSON.parse(f[1].trim());
  const b = text.match(/\{[\s\S]*\}/);
  if (b) return JSON.parse(b[0].trim());
  throw new Error("No JSON found: " + text.slice(0, 100));
}
