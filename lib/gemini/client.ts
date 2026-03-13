import { GoogleGenAI } from "@google/genai";
import { getApiKeys } from "@/lib/apiKeys";

let client: { ai: GoogleGenAI; key: string } | null = null;

export async function getGeminiClient(): Promise<GoogleGenAI> {
  const keys = await getApiKeys();
  const apiKey = keys.geminiApiKey;

  if (!apiKey) {
    throw new Error("Gemini API key not configured. Go to Settings to add your API key.");
  }

  // Reinitialize if key changed
  if (client && client.key !== apiKey) {
    client = null;
  }

  if (!client) {
    client = { ai: new GoogleGenAI({ apiKey }), key: apiKey };
  }
  return client.ai;
}

export async function generateText(prompt: string): Promise<string> {
  const ai = await getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  return response.text ?? "";
}
