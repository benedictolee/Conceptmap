export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt: userQuestion } = req.body;

  if (!userQuestion) {
    return res.status(400).json({ error: "질문을 입력해 주세요." });
  }

  // Vercel 환경 변수에서 API 키를 가져옵니다.
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // API 키가 설정되지 않은 경우, Vercel 대시보드 설정을 확인하라는 오류를 반환합니다.
    return res.status(500).json({
      error:
        "서버 오류: Claude API 키가 Vercel 대시보드에 설정되지 않았습니다. 설정을 확인해 주세요.",
    });
  }

  // Claude API를 호출하기 위한 시스템 프롬프트입니다.
  // Cytoscape.js 형식의 JSON만 생성하도록 요청합니다.
  const systemPrompt = `You are an expert in science and math. Generate a detailed, interconnected concept map of the user's topic. Format your response *only* as a single JSON object containing a 'mapData' array, suitable for Cytoscape.js (e.g., \`{"mapData": [{ "group": "nodes", "data": { "id": "A", "label": "Label A" }}, { "group": "edges", "data": { "id": "E1", "source": "A", "target": "B", "label": "relationship" }}]}\`). Use the user's provided terminology. Focus on connecting new concepts to previously understood ones. Don't include markdown formatting like \`\`\`json\`\`\`.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-opus-20240229", // Claude 3 Opus 모델 사용
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userQuestion }],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Claude API 오류: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const claudeResponseText = data.content[0].text.trim();

    // AI의 답변이 올바른 JSON 형식인지 확인하고 파싱합니다.
    try {
      const mapDataJson = JSON.parse(claudeResponseText);
      if (
        mapDataJson &&
        mapDataJson.mapData &&
        Array.isArray(mapDataJson.mapData)
      ) {
        return res.status(200).json(mapDataJson);
      } else {
        return res.status(500).json({
          error: "생성된 개념맵 데이터 형식이 올바르지 않습니다.",
        });
      }
    } catch (jsonError) {
      return res.status(500).json({
        error:
          "생성된 데이터를 이해할 수 없습니다. 다시 시도해 주세요.",
      });
    }
  } catch (error) {
    console.error("Claude API 연결 오류:", error);
    return res.status(500).json({
      error: "AI 서비스에 연결하지 못했습니다. 다시 시도해 주세요.",
    });
  }
}
