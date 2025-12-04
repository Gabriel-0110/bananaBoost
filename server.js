import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const API_KEY = process.env.API_KEY || '';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Middleware
app.use(express.json({ limit: '50mb' })); // Support large base64 images

// API Endpoints
app.post('/api/analyze-prompt', async (req, res) => {
  try {
    const { originalImageBase64, userInstruction, history } = req.body;

    const model = 'gemini-2.5-flash';
    let parts = [];

    let systemContext = `You are Nano Banana, an expert male photography and style editor AI.
    Your goal is to help the user edit a photo by creating a PERFECT prompt for an image generator (Imagen 4).
    
    If the user provides an image, first analyze it in extreme detail (subject, pose, lighting, clothing, background).
    Then, apply the user's specific request (e.g., "add muscle", "wear a suit", "retro filter") to modify that description.
    
    Output ONLY the detailed prompt for the image generator. Do not output conversational filler.
    The prompt should be photorealistic, high quality, 8k, highly detailed.`;

    if (originalImageBase64) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: originalImageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
        }
      });
      systemContext += " Base your prompt on the provided image, keeping facial features consistent where possible.";
    }

    const historyText = history.map(h => `${h.role}: ${h.text}`).join('\n');
    const finalPrompt = `${systemContext}\n\nConversation History:\n${historyText}\n\nUser Request: ${userInstruction}\n\nTask: Write the final image generation prompt now.`;

    parts.push({ text: finalPrompt });

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: parts }
    });

    res.json({ prompt: response.text || "A high quality portrait of a man." });
  } catch (error) {
    console.error('Analyze prompt error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt } = req.body;

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '3:4',
      },
    });

    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64ImageBytes) {
      res.json({ image: `data:image/jpeg;base64,${base64ImageBytes}` });
    } else {
      throw new Error("No image data returned");
    }
  } catch (error) {
    console.error('Generate image error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { history, newMessage } = req.body;

    const chat = ai.chats.create({
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
    res.json({ response: result.text });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from the Angular app dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Send all requests to index.html (must be last)
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
