/**
 * LevelUp Telegram notification Worker
 *
 * Required Worker secrets:
 * TELEGRAM_BOT_TOKEN
 * SUPABASE_URL
 * SUPABASE_SERVICE_ROLE_KEY
 *
 * Configure the Telegram webhook to:
 * https://YOUR_WORKER_HOST/telegram/webhook
 *
 * Configure a daily Cron Trigger, for example 0 3 * * *
 * (08:30 India time).
 */
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" }
});

async function supabaseRequest(env, path, options = {}) {
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error("Supabase request failed: " + response.status);
  return response.status === 204 ? null : response.json();
}

async function sendTelegram(env, chatId, text) {
  const response = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  if (!response.ok) throw new Error("Telegram send failed: " + response.status);
}

async function handleWebhook(request, env) {
  const update = await request.json();
  const message = update.message;
  if (!message?.text || !message.chat?.id) return json({ ok: true });
  const match = message.text.trim().match(/^\/start\s+([A-Z0-9]{6,12})$/i);
  if (!match) {
    await sendTelegram(env, message.chat.id, "Welcome to LevelUp. Open LevelUp Settings, generate a linking code, then send /start followed by that code.");
    return json({ ok: true });
  }
  const code = match[1].toUpperCase();
  const rows = await supabaseRequest(env, "user_progress_v3?select=userid,progress&limit=1000");
  const owner = rows.find(row => String(row.progress?.settings?.telegramLinkCode || "").toUpperCase() === code);
  if (!owner) {
    await sendTelegram(env, message.chat.id, "That linking code was not found. Generate a new code in LevelUp Settings and try again.");
    return json({ ok: true });
  }
  await supabaseRequest(env, "telegram_connections?on_conflict=userid", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ userid: owner.userid, chat_id: String(message.chat.id), linked_at: new Date().toISOString() })
  });
  await sendTelegram(env, message.chat.id, "LevelUp is now connected. You will receive your daily work summary here.");
  return json({ ok: true });
}

async function sendDailySummaries(env) {
  const [connections, users] = await Promise.all([
    supabaseRequest(env, "telegram_connections?select=userid,chat_id"),
    supabaseRequest(env, "user_progress_v3?select=userid,progress&limit=1000")
  ]);
  const byUser = new Map(users.map(row => [row.userid, row.progress || {}]));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  for (const connection of connections) {
    const progress = byUser.get(connection.userid);
    if (!progress) continue;
    const tasks = Array.isArray(progress.tasks) ? progress.tasks : [];
    const open = tasks.filter(task => task.status !== "done");
    const overdue = open.filter(task => task.dueDate && task.dueDate < today);
    const dueToday = open.filter(task => task.dueDate === today);
    const hindi = progress.settings?.language === "hi";
    const lines = hindi
      ? ["आपका LevelUp दैनिक सारांश", "आज की तारीख: " + today, "खुले कार्य: " + open.length, "आज देय: " + dueToday.length, "समय सीमा पार: " + overdue.length]
      : ["Your LevelUp daily summary", "Date: " + today, "Open tasks: " + open.length, "Due today: " + dueToday.length, "Overdue: " + overdue.length];
    if (overdue.length) lines.push("", hindi ? "समय सीमा पार कार्य:" : "Overdue tasks:", ...overdue.slice(0, 5).map(task => "• " + task.title));
    if (dueToday.length) lines.push("", hindi ? "आज के कार्य:" : "Today's tasks:", ...dueToday.slice(0, 5).map(task => "• " + task.title));
    await sendTelegram(env, connection.chat_id, lines.join("\n"));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      try { return await handleWebhook(request, env); }
      catch (error) { return json({ error: error.message }, 500); }
    }
    if (url.pathname === "/health") return json({ ok: true, service: "LevelUp Telegram" });
    return json({ error: "Not found" }, 404);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendDailySummaries(env));
  }
};
