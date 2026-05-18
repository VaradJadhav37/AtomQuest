const listeners = new Set();

function publishEvent(event) {
  const payload = `data: ${JSON.stringify({ ...event, ts: new Date().toISOString() })}\n\n`;
  for (const listener of listeners) {
    try {
      if (!listener.filter || listener.filter(event)) {
        listener.res.write(payload);
      }
    } catch {
      listeners.delete(listener);
    }
  }
}

function attachSse(req, res, filter = null) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const listener = { res, filter };
  listeners.add(listener);

  const heartbeat = setInterval(() => {
    try {
      res.write(`event: ping\ndata: {}\n\n`);
    } catch {
      clearInterval(heartbeat);
      listeners.delete(listener);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    listeners.delete(listener);
  });
}

module.exports = { publishEvent, attachSse };
