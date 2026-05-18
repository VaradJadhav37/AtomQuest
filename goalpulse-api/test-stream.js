require('dotenv').config();
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

async function groqStreamText({ prompt, userContext, onToken }) {
  const response = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      max_tokens: 600,
      stream: true,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userContext },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Groq stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const rawLine = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf('\n');

      if (!rawLine.startsWith('data:')) continue;
      const payload = rawLine.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;

      const parsed = JSON.parse(payload);
      const token = parsed.choices?.[0]?.delta?.content || '';
      if (token) {
        full += token;
        onToken(token);
      }
    }
  }

  return full;
}

async function run() {
  const systemPrompt = `You are an executive goal-writing assistant for enterprise OKRs.
Rewrite the user's rough goal into a crisp, measurable, business-friendly goal.
Return ONLY valid JSON in this exact structure:
{
  "title": "rewritten title",
  "description": "short supporting description",
  "rationale": "one sentence explaining the improvement"
}
Keep the title concise, measurable, and concrete.`;

  const userContext = `Original goal: iNCREASE\nDescription: INC\nThrust area: General\nMeasurement type: Numeric\nTarget: 2000`;

  try {
    const collected = await groqStreamText({
      prompt: systemPrompt,
      userContext,
      onToken: (token) => process.stdout.write(token)
    });
    console.log('\n\n--- DONE ---');
    console.log(collected);
  } catch (err) {
    console.error('FAILED:', err);
  }
}
run();
