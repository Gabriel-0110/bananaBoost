
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private apiBase = ''; // Empty string means same origin (our Express server)

  constructor() { }

  // Uses Gemini 2.5 Flash to understand the user's image and intent
  async analyzeAndRefinePrompt(
    originalImageBase64: string | null,
    userInstruction: string,
    history: { role: string, text: string }[]
  ): Promise<string> {
    try {
      const response = await fetch(`${this.apiBase}/api/analyze-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalImageBase64,
          userInstruction,
          history
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.prompt || "A high quality portrait of a man.";
    } catch (e) {
      console.error("Analysis failed", e);
      throw e;
    }
  }

  // Uses Imagen 4.0 to generate the actual image
  async generateImage(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiBase}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.image) {
        return data.image;
      }
      throw new Error("No image data returned");
    } catch (e) {
      console.error("Generation failed", e);
      throw e;
    }
  }

  // Chat helper for the assistant
  async chatWithAssistant(history: { role: string, text: string }[], newMessage: string): Promise<string> {
    try {
      const response = await fetch(`${this.apiBase}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          history,
          newMessage
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (e) {
      console.error("Chat failed", e);
      throw e;
    }
  }
}
