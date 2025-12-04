
import { Injectable } from '@angular/core';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private apiKey = process.env['API_KEY'] || '';

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  // Uses Gemini 2.5 Flash to understand the user's image and intent
  async analyzeAndRefinePrompt(
    originalImageBase64: string | null, 
    userInstruction: string,
    history: { role: string, text: string }[]
  ): Promise<string> {
    const model = 'gemini-2.5-flash';
    
    let parts: any[] = [];
    
    // System instruction to guide the prompt generation for Imagen
    let systemContext = `You are Nano Banana, an expert male photography and style editor AI.
    Your goal is to help the user edit a photo by creating a PERFECT prompt for an image generator (Imagen 4).
    
    If the user provides an image, first analyze it in extreme detail (subject, pose, lighting, clothing, background).
    Then, apply the user's specific request (e.g., "add muscle", "wear a suit", "retro filter") to modify that description.
    
    Output ONLY the detailed prompt for the image generator. Do not output conversational filler.
    The prompt should be photorealistic, high quality, 8k, highly detailed.`;

    if (originalImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png', // Assuming PNG/JPEG, API handles common types
          data: originalImageBase64
        }
      });
      systemContext += " Base your prompt on the provided image, keeping facial features consistent where possible (though distinct identity preservation is not guaranteed).";
    }

    // Add conversation history context
    const historyText = history.map(h => `${h.role}: ${h.text}`).join('\n');
    const finalPrompt = `${systemContext}\n\nConversation History:\n${historyText}\n\nUser Request: ${userInstruction}\n\nTask: Write the final image generation prompt now.`;
    
    parts.push({ text: finalPrompt });

    try {
      const response = await this.ai.models.generateContent({
        model: model,
        contents: { parts: parts } // Correct structure for multimodal
      });
      return response.text || "A high quality portrait of a man.";
    } catch (e) {
      console.error("Analysis failed", e);
      throw e;
    }
  }

  // Uses Imagen 4.0 to generate the actual image
  async generateImage(prompt: string): Promise<string> {
    try {
      const response = await this.ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '3:4', // Portrait orientation preferred for male portraits
        },
      });

      const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64ImageBytes) {
        return `data:image/jpeg;base64,${base64ImageBytes}`;
      }
      throw new Error("No image data returned");
    } catch (e) {
      console.error("Generation failed", e);
      throw e;
    }
  }

  // Chat helper for the assistant
  async chatWithAssistant(history: { role: string, text: string }[], newMessage: string): Promise<string> {
    const chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are Nano Banana Pro Assistant. You help men edit their photos to look their best.
        Be helpful, professional, but cool. Use emojis occasionally.
        You understand terms like "hypertrophy", "taper fade", "golden hour", "bokeh".
        Keep responses concise (under 50 words) unless explaining a complex style.
        If the user asks to edit the image, confirm you are on it.`
      },
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      }))
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text;
  }
}
