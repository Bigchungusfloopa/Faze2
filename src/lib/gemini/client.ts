import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  client = new GoogleGenAI({ apiKey });
  return client;
}

export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
