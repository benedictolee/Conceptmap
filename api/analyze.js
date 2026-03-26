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

  // ★ 사용자님이 Vercel에 입력하신 이름과 대소문자까지 완벽하게 똑같이 맞췄습니다!
  const apiKey = process.env.Gemini_API_Key;
  
  if (!apiKey) return res.status(500).json({ error: '🚨 Vercel에서 키를 못 찾았습니다. (여전히 에러가 난다면 Vercel 재배포를 확인해주세요)' });

  try {
    let parts = [];
    
    if (image) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid image format' });
      const [, mimeType, base64Data] = matches;
      parts.push({ inlineData: { mimeType: mimeType, data: base64Data } });
    }
    
    parts.push({ text: prompt });

    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        generationConfig: { responseMimeType: "application/json" }
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: err.error?.message || `Upstream ${upstream.status}` });
    }

    const data = await upstream.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return res.status(200).json({ text });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
