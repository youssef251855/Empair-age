import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize Gemini:", e);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, botName, playerName, context } = body;
    
    if (!ai) {
      return NextResponse.json({ 
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

    return NextResponse.json({ reply: response.text });
  } catch (error: any) {
    console.error('Error generating bot reply:', error.message);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}
