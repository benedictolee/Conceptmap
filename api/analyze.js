export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const { prompt, image } = body || {};
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  try {
    // 이미지가 있으면 vision 모드 — content를 배열로 구성
    let messageContent;
    if (image) {
      // image = "data:image/jpeg;base64,xxxx..." 형식
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid image format' });
      const [, mediaType, base64Data] = matches;
      messageContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Data }
        },
        { type: 'text', text: prompt }
      ];
    } else {
      messageContent = prompt;
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: messageContent }],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: err.error?.message || `Upstream ${upstream.status}` });
    }

    const data = await upstream.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    return res.status(200).json({ text });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
