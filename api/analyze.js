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

  // ★ 1. Vercel에서 GEMINI_API_KEY를 가져오도록 변경
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

  try {
    // ★ 2. Gemini 규격에 맞게 데이터 배열(parts) 구성
    let parts = [];
    
    // 이미지가 있으면 base64 데이터 추출해서 추가
    if (image) {
      const matches = image.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid image format' });
      const [, mimeType, base64Data] = matches;
      
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      });
    }
    
    // 텍스트 프롬프트 추가
    parts.push({ text: prompt });

    // ★ 3. Gemini 1.5 Flash 엔드포인트로 전송
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
        // 프론트엔드 에러 방지를 위해 JSON 형태로만 대답하라고 강제
        generationConfig: { responseMimeType: "application/json" }
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: err.error?.message || `Upstream ${upstream.status}` });
    }

    const data = await upstream.json();
    
    // ★ 4. Gemini의 응답 구조에서 텍스트만 쏙 빼오기
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return res.status(200).json({ text });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
