import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

// Generic legacy detector fixture:
// These are intentionally included to verify heuristic detection.

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function runLegacyCalls() {
  await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: "Hello" }] }],
  });

  await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: "Ping" }],
  });

  createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Legacy pattern" }],
  });
}

runLegacyCalls().catch(console.error);
