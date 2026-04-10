import Groq from "groq-sdk";

export const MODELS = {
  text: "openai/gpt-oss-120b",
  vision: "meta-llama/llama-4-scout-17b-16e-instruct",
};

function getKeys(): string[] {
  return [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
  ].filter((k): k is string => Boolean(k));
}

// Each claim slot (0,1,2) gets a fixed dedicated key
export function getClientForSlot(slot: 0 | 1 | 2): Groq {
  const keys = getKeys();
  if (!keys.length) throw new Error("No Groq API keys set.");
  return new Groq({ apiKey: keys[slot % keys.length] });
}

// For single-claim calls
export function getGroqClient(): Groq {
  const keys = getKeys();
  if (!keys.length) throw new Error("No Groq API keys set.");
  return new Groq({ apiKey: keys[0] });
}

// Check which key slots are configured (for UI display)
export function getKeyStatuses(): Array<{ slot: number; active: boolean }> {
  const keys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
  ];
  return keys.map((k, i) => ({ slot: i + 1, active: Boolean(k) }));
}
