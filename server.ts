import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Init Gemini
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize Gemini:", e);
}

// API routes FIRST
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/bot/chat', async (req, res) => {
  try {
    const { message, botName, playerName, context } = req.body;
    
    if (!ai) {
      // Fallback heuristic bot
      return res.json({ 
        reply: `[رد تلقائي من ${botName}]: أيها الزعيم ${playerName}، لقد استلمنا رسالتك "${message}". نحن في طور دراسة العرض وسنرد لاحقاً.` 
      });
    }

    const systemPrompt = `أنت الذكاء الاصطناعي الذي يتحكم بدولة "${botName}" في لعبة استراتيجية حربية. 
اللاعب "${playerName}" أرسل لك رسالة تفاوض دبلوماسية.
عليك الرد بأسلوب حاكم واقعي، حازم، وذكي. 
بيانات اللعبة المتوفرة: ${JSON.stringify(context || {})}
ردك يجب أن يكون قصيراً، ذو طابع عسكري وسياسي، باللغة العربية الفصحى. لا تقدم تنازلات بسهولة.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Error generating bot reply:', error.message);
    res.status(500).json({ error: 'Failed to generate reply' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
