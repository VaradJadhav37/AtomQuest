
require('dotenv').config();
const prompt = `You are an executive goal-writing assistant for enterprise OKRs.
Rewrite the user's rough goal into a crisp, measurable, business-friendly goal.
Return ONLY valid JSON in this exact structure:
{
  "title": "rewritten title",
  "description": "short supporting description",
  "rationale": "one sentence explaining the improvement"
}
Keep the title concise, measurable, and concrete.`;

const userContext = `Original goal: iNCREASE\nDescription: INC\nThrust area: General\nMeasurement type: Numeric\nTarget: 2000`;

fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: userContext }
    ]
  })
}).then(r => r.json()).then(data => {
  console.log(data.choices[0].message.content);
}).catch(console.error);
