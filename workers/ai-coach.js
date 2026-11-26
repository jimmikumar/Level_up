const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const systemPrompt = `You are LevelUp, a practical personal productivity assistant.
Help the user manage habits, goals and tasks. Use the supplied app context as the source of truth.
Return ONLY valid JSON with this shape:
{"reply":"A concise helpful response","action":null}
Allowed action objects:
{"type":"add_habit","title":"...","category":"..."}
{"type":"add_task","title":"..."}
{"type":"add_goal","title":"...","category":"..."}
{"type":"complete_habit","id":123}
{"type":"update_goal","id":123,"progress":40}
Only return an action when the user clearly requested a change and the matching item or new title is unambiguous. For existing items, use their exact numeric id from context. Never invent an id. For general questions, action must be null. Do not claim a change was made unless you return a valid action.`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "Use POST." }, 405);
    if (!env.AI_API_KEY) return json({ error: "AI_API_KEY is not configured." }, 503);

    let input;
    try { input = await request.json(); }
    catch { return json({ error: "Request body must be valid JSON." }, 400); }

    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (!message || message.length > 4000) return json({ error: "Message is required and must be under 4000 characters." }, 400);

    const baseUrl = (env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
    const model = env.AI_MODEL || "llama-3.3-70b-versatile";
    const response = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.AI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ message, context: input.context || {} }) }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return json({ error: "AI provider request failed.", detail: detail.slice(0, 500) }, 502);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(content);
      const action = parsed.action && ["add_habit", "add_task", "add_goal", "complete_habit", "update_goal"].includes(parsed.action.type)
        ? parsed.action : null;
      return json({ reply: String(parsed.reply || "I could not prepare a response."), action });
    } catch {
      return json({ reply: content || "The AI provider returned an empty response.", action: null });
    }
  }
};
