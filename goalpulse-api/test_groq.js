require('dotenv').config();
const key = process.env.GROQ_API_KEY;

fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama-3.1-8b-instant',
    max_tokens: 300,
    temperature: 0.6,
    messages: [
      { role: 'system', content: 'You are an OKR goal coach. Reply with JSON only.' },
      { role: 'user', content: 'Give me 3 SMART goals for Revenue Growth and 2 tips. Respond as JSON with keys suggestions and tips.' }
    ]
  })
}).then(r => r.json()).then(d => {
  const content = d.choices?.[0]?.message?.content;
  console.log('Groq OK:', content?.substring(0, 300));
}).catch(e => console.log('Error:', e.message));
