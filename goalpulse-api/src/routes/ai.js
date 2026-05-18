const express = require('express');
const { requireAuth } = require('./auth');
const { cacheKey, getCachedValue, setCachedValue, recordAiMetric } = require('../services/goalkeeper');

const router = express.Router();

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

function parseJsonBlock(content, fallback) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    return fallback;
  }
}

async function groqJson({ route, cacheParts, prompt, userContext, fallback, cost, model = MODEL, ttlMs = 1000 * 60 * 30 }) {
  const key = cacheKey(cacheParts);
  const cached = getCachedValue(key);
  if (cached) {
    recordAiMetric({ route, model, cached: true, cost: 0 });
    return { data: cached, cached: true };
  }

  try {
    const response = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 600,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userContext },
        ],
      }),
    });

    if (!response.ok) {
      recordAiMetric({ route, model, cached: false, cost: 0 });
      setCachedValue(key, fallback, ttlMs);
      return { data: fallback, cached: false };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = parseJsonBlock(content, fallback);
    recordAiMetric({ route, model, cached: false, cost });
    setCachedValue(key, parsed, ttlMs);
    return { data: parsed, cached: false };
  } catch {
    recordAiMetric({ route, model, cached: false, cost: 0 });
    setCachedValue(key, fallback, ttlMs);
    return { data: fallback, cached: false };
  }
}

async function groqStreamText({ prompt, userContext, onToken, model = MODEL }) {
  const response = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
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

// POST /api/ai/coach â€” returns SMART goal scorecard
router.post('/coach', requireAuth, async (req, res) => {
  const { title, description, uom_type, target_value } = req.body;
  const userContext = `Goal Title: "${title}"\nDescription: "${description}"\nTarget: ${target_value} ${uom_type}`;
  const systemPrompt = `You are an expert OKR/goal-setting coach for enterprise performance management.
When given a goal idea, score it on the five SMART dimensions (Specific, Measurable, Achievable, Relevant, Time-bound).
Respond with ONLY a JSON object with this exact structure:
{
  "specific": { "score": 0-10, "suggestion": "actionable tip" },
  "measurable": { "score": 0-10, "suggestion": "actionable tip" },
  "achievable": { "score": 0-10, "suggestion": "actionable tip" },
  "relevant": { "score": 0-10, "suggestion": "actionable tip" },
  "time_bound": { "score": 0-10, "suggestion": "actionable tip" }
}
Do not include any markdown or text outside the JSON. Be strict with scores. Vague goals get low scores.`;

  const fallback = getSmartFallback(title);
  const result = await groqJson({
    route: 'coach',
    cacheParts: ['coach', title, description, uom_type, target_value],
    prompt: systemPrompt,
    userContext,
    fallback,
    cost: 0.0015,
    model: 'mixtral-8x7b-32768',
  });
  res.json(result.data);
});

// POST /api/ai/analyze â€” analyze goal sheet health
router.post('/analyze', requireAuth, async (req, res) => {
  const { goals, totalWeightage, status } = req.body;
  const goalsText = (goals || []).map((g, i) =>
    `${i + 1}. "${g.title}" [${g.thrust_area}, ${g.weightage}%, target: ${g.target_value} ${g.uom_type}]`
  ).join('\n');

  const systemPrompt = `You are a performance management expert. Analyze the following goal sheet and provide a brief JSON response:
{
  "healthScore": 0-100,
  "insights": ["max 3 specific insights about the quality/balance of these goals"],
  "suggestions": ["max 2 actionable improvements"],
  "balance": "balanced|revenue-heavy|compliance-heavy|etc"
}`;

  const fallback = { healthScore: 75, insights: ['Goals are well distributed across thrust areas.'], suggestions: ['Consider adding measurable KPIs to each goal.'], balance: 'balanced' };
  const result = await groqJson({
    route: 'analyze',
    cacheParts: ['analyze', status, totalWeightage, goalsText],
    prompt: systemPrompt,
    userContext: `Goal sheet status: ${status}\nGoals:\n${goalsText}\nTotal weightage: ${totalWeightage}%`,
    fallback,
    cost: 0.0015,
    model: 'mixtral-8x7b-32768',
  });
  res.json(result.data);
});

// POST /api/ai/generate-checkin-comment â€” generates manager feedback
router.post('/generate-checkin-comment', requireAuth, async (req, res) => {
  const { goal_title, target, actual, uom, employee_comment } = req.body;
  const systemPrompt = `You are a management coach helping a manager write a performance check-in comment for their employee.
The comment should be 2-3 sentences. Professional, encouraging, and constructive.
Address the employee directly ("Great job on...").
Return the comment as plain text only.`;

  const fallback = { comment: "Good progress this quarter. Let's discuss any blockers in our next 1:1." };
  const cacheKeyParts = ['checkin-comment', goal_title, target, actual, uom, employee_comment];
  const cached = getCachedValue(cacheKey(cacheKeyParts));
  const wantsStream = String(req.query.stream || '') === '1' || String(req.headers.accept || '').includes('text/event-stream');

  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      if (cached?.comment) {
        let streamed = '';
        for (const token of String(cached.comment).split(/(\s+)/).filter(Boolean)) {
          streamed += token;
          res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
        }
        recordAiMetric({ route: 'generate-checkin-comment', model: MODEL, cached: true, cost: 0 });
        res.write(`data: ${JSON.stringify({ type: 'done', comment: streamed, cached: true })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      const collected = await groqStreamText({
        prompt: systemPrompt,
        userContext: `Goal: "${goal_title}"\nTarget: ${target} ${uom}\nActual Achievement: ${actual} ${uom}\nEmployee's self-reflection: "${employee_comment || 'None provided'}"`,
        onToken: (token) => {
          res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
        },
      });

      setCachedValue(cacheKey(cacheKeyParts), { comment: collected }, 1000 * 60 * 30);
      recordAiMetric({ route: 'generate-checkin-comment', model: MODEL, cached: false, cost: 0.0025 });
      res.write(`data: ${JSON.stringify({ type: 'done', comment: collected })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (err) {
      const message = fallback.comment;
      for (const token of message.split(/(\s+)/).filter(Boolean)) {
        res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
      }
      recordAiMetric({ route: 'generate-checkin-comment', model: MODEL, cached: false, cost: 0 });
      res.write(`data: ${JSON.stringify({ type: 'done', comment: message, fallback: true, error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }
  }

  if (cached) {
    recordAiMetric({ route: 'generate-checkin-comment', model: MODEL, cached: true, cost: 0 });
    return res.json(cached);
  }

  const result = await groqJson({
    route: 'generate-checkin-comment',
    cacheParts: cacheKeyParts,
    prompt: systemPrompt,
    userContext: `Goal: "${goal_title}"\nTarget: ${target} ${uom}\nActual Achievement: ${actual} ${uom}\nEmployee's self-reflection: "${employee_comment || 'None provided'}"`,
    fallback,
    cost: 0.0025,
  });
  res.json(result.data);
});

// POST /api/ai/search-prompt â€” normalize a natural language search prompt for the app
router.post('/search-prompt', requireAuth, async (req, res) => {
  const { query } = req.body;
  const fallback = {
    keywords: String(query || '').split(/\s+/).filter(Boolean).slice(0, 8),
    intent: 'search',
  };
  recordAiMetric({ route: 'search-prompt', model: MODEL, cached: false, cost: 0 });
  res.json(fallback);
});

// POST /api/ai/rewrite-goal
router.post('/rewrite-goal', requireAuth, async (req, res) => {
  const { title, description, thrust_area, uom_type, target_value } = req.body;
  const systemPrompt = `You are an executive goal-writing assistant for enterprise OKRs.
Rewrite the user's rough goal into a crisp, measurable, business-friendly goal.
Return ONLY valid JSON in this exact structure:
{
  "title": "rewritten title",
  "description": "short supporting description",
  "rationale": "one sentence explaining the improvement"
}
Keep the title concise, measurable, and concrete.`;

  const userContext = `Original goal: ${title || ''}
Description: ${description || ''}
Thrust area: ${thrust_area || 'General'}
Measurement type: ${uom_type || 'Numeric'}
Target: ${target_value || ''}`;

  const fallback = {
    title: title || 'Improve business performance',
    description: description || 'Define a concrete, measurable objective with a clear deadline.',
    rationale: 'The fallback keeps the goal measurable and business-focused.',
  };

  const wantsStream = String(req.query.stream || '') === '1' || String(req.headers.accept || '').includes('text/event-stream');
  const cacheParts = ['rewrite-goal', title, description, thrust_area, uom_type, target_value];

  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const collected = await groqStreamText({
        prompt: systemPrompt,
        userContext,
        onToken: (token) => {
          res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
        },
      });

      const parsed = parseJsonBlock(collected, fallback);
      setCachedValue(cacheKey(cacheParts), parsed, 1000 * 60 * 60 * 6);
      recordAiMetric({ route: 'rewrite-goal', model: MODEL, cached: false, cost: 0.002 });
      res.write(`data: ${JSON.stringify({ type: 'done', goal: parsed })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    } catch (err) {
      const message = JSON.stringify(fallback);
      for (const token of message.split(/(\s+)/).filter(Boolean)) {
        res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
      }
      recordAiMetric({ route: 'rewrite-goal', model: MODEL, cached: false, cost: 0 });
      res.write(`data: ${JSON.stringify({ type: 'done', goal: fallback, fallback: true, error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }
  }

  const result = await groqJson({
    route: 'rewrite-goal',
    cacheParts,
    prompt: systemPrompt,
    userContext,
    fallback,
    cost: 0.002,
    ttlMs: 1000 * 60 * 60 * 6,
  });
  res.json(result.data);
});

function getSmartFallback(title) {
  const hasNumbers = /\d/.test(title);
  const lengthScore = Math.min(title.length > 20 ? 8 : 4, 10);
  return {
    specific: { score: lengthScore, suggestion: 'Add more descriptive action verbs.' },
    measurable: { score: hasNumbers ? 9 : 3, suggestion: 'Include a numeric target or clear KPI.' },
    achievable: { score: 7, suggestion: 'Ensure this is realistic for the quarter.' },
    relevant: { score: 8, suggestion: "Align this with your department's thrust area." },
    time_bound: { score: 5, suggestion: 'Add a specific deadline (e.g., by end of Q3).' },
  };
}

module.exports = router;
