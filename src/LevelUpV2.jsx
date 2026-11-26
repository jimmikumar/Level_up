import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import { Activity, ArrowUpRight, AudioLines, Bot, Check, CheckCircle2, Circle, Command, Flame, Goal, Mic, MicOff, Plus, Send, Sparkles, Target, Trash2, Trophy, Volume2, VolumeX, WandSparkles, X, Zap } from "lucide-react";

const STORE = "levelup-v2-data";
const today = () => new Date().toLocaleDateString("en-CA");
const starter = {
  habits: [
    { id: 1, title: "Morning movement", category: "Health", done: false },
    { id: 2, title: "Focused learning", category: "Learning", done: false },
    { id: 3, title: "Deep work session", category: "Work", done: false }
  ],
  goals: [
    { id: 11, title: "Build a sustainable business", progress: 10, category: "Business" },
    { id: 12, title: "Publish useful content consistently", progress: 15, category: "Content" }
  ],
  tasks: [],
  reflections: {},
  xp: 0,
  day: today()
};

function loadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE));
    if (!raw) return starter;
    return { ...starter, ...raw, habits: Array.isArray(raw.habits) ? raw.habits : starter.habits, goals: Array.isArray(raw.goals) ? raw.goals : starter.goals, tasks: Array.isArray(raw.tasks) ? raw.tasks : [] };
  } catch { return starter; }
}

const makeId = () => Date.now() + Math.floor(Math.random() * 1000);

export default function LevelUpV2() {
  const [data, setData] = useState(loadData);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [syncStatus, setSyncStatus] = useState("Checking account...");
  const [tab, setTab] = useState("Today");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", content: "Hi! I can update your habits, goals and tasks. Try saying, “Add a habit to read for 20 minutes” or “Mark morning movement complete.”" }]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reflection, setReflection] = useState(data.reflections[today()] || "");
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const aiEndpoint = import.meta.env.VITE_AI_ASSISTANT_URL || "";

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data: result }) => {
      if (active) { setSession(result?.session || null); setAuthLoading(false); }
    }).catch(() => { if (active) setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCloud() {
      if (!session?.user?.id) { setLoadedUserId(null); setSyncStatus("Not signed in"); return; }
      const userId = session.user.id;
      setLoadedUserId(null);
      setSyncStatus("Loading cloud progress...");
      const { data: row, error } = await supabase.from("user_progress_v2").select("progress").eq("userid", userId).maybeSingle();
      if (!active) return;
      if (error) {
        setSyncStatus("Local backup active");
        setNotice("Cloud sync is not ready yet. Run SUPABASE_V2_SETUP.sql. Your browser copy remains available.");
        setLoadedUserId(userId);
        return;
      }
      if (row?.progress && typeof row.progress === "object") {
        setData({ ...loadData(), ...row.progress });
        setReflection(row.progress.reflections?.[today()] || "");
      }
      setLoadedUserId(userId);
      setSyncStatus("Cloud ready");
    }
    loadCloud();
    return () => { active = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || loadedUserId !== session.user.id) return;
    const timer = window.setTimeout(async () => {
      setSyncStatus("Saving...");
      const { error } = await supabase.from("user_progress_v2").upsert({
        userid: session.user.id,
        progress: data,
        updated_at: new Date().toISOString()
      }, { onConflict: "userid" });
      setSyncStatus(error ? "Local backup active" : "Synced");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [data, session?.user?.id, loadedUserId]);

  useEffect(() => {
    const next = data.day === today() ? data : { ...data, day: today(), habits: data.habits.map(h => ({ ...h, done: false })) };
    if (next !== data) setData(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  }, [data]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const completed = data.habits.filter(h => h.done).length;
  const percent = data.habits.length ? Math.round(completed / data.habits.length * 100) : 0;
  const level = Math.floor(data.xp / 500) + 1;
  const dateLabel = useMemo(() => new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }), []);

  const update = (fn) => setData(current => fn(current));
  const reply = (content) => setMessages(current => [...current, { role: "assistant", content }]);

  function localCommand(raw) {
    const text = raw.trim();
    const lower = text.toLowerCase();
    let match;
    if ((match = lower.match(/^(?:add|create) (?:a )?habit(?: to)? (.+)$/i)) || (match = lower.match(/^i want to (.+) as a habit$/i))) {
      const title = (match[1] || "").replace(/[.!?]+$/, "").trim();
      if (!title) return "Tell me the name of the habit you want to add.";
      update(d => ({ ...d, habits: [...d.habits, { id: makeId(), title: title.charAt(0).toUpperCase() + title.slice(1), category: "Personal", done: false }] }));
      return "Added the habit: " + title + ".";
    }
    if ((match = lower.match(/^(?:add|create) (?:a )?task(?: to)? (.+)$/i)) || (match = lower.match(/^remind me to (.+)$/i))) {
      const title = (match[1] || "").replace(/[.!?]+$/, "").trim();
      update(d => ({ ...d, tasks: [...d.tasks, { id: makeId(), title, done: false }] }));
      return "Added this task to your list: " + title + ".";
    }
    if ((match = lower.match(/^(?:add|create) (?:a )?goal(?: to)? (.+)$/i))) {
      const title = match[1].replace(/[.!?]+$/, "").trim();
      update(d => ({ ...d, goals: [...d.goals, { id: makeId(), title, progress: 0, category: "Personal" }] }));
      return "Created your goal: " + title + ".";
    }
    if (/(complete|finish|done|mark).*(habit|movement|learning|work)/i.test(lower)) {
      const candidate = data.habits.find(h => lower.includes(h.title.toLowerCase()) || h.title.toLowerCase().split(" ").some(w => w.length > 4 && lower.includes(w)));
      if (candidate) {
        update(d => ({ ...d, habits: d.habits.map(h => h.id === candidate.id ? { ...h, done: true } : h), xp: d.xp + (candidate.done ? 0 : 10) }));
        return candidate.done ? candidate.title + " is already complete." : "Marked " + candidate.title + " complete. You earned 10 XP.";
      }
      return "I couldn't identify which habit you meant. Include its name, for example, “Mark focused learning complete.”";
    }
    if ((match = lower.match(/(?:set|update|change).*(?:goal )?(.+?) (?:to|at) (\d{1,3})\s*%?/i))) {
      const goal = data.goals.find(g => g.title.toLowerCase().includes(match[1].trim()) || match[1].trim().includes(g.title.toLowerCase()));
      if (goal) {
        const progress = Math.max(0, Math.min(100, Number(match[2])));
        update(d => ({ ...d, goals: d.goals.map(g => g.id === goal.id ? { ...g, progress } : g) }));
        return "Updated " + goal.title + " to " + progress + "%.";
      }
    }
    if (/show (my )?(habits|tasks|goals)|what('?s| is) on my list/i.test(lower)) {
      return "You have " + data.habits.length + " habits, " + data.tasks.length + " tasks and " + data.goals.length + " goals. " + data.habits.filter(h => !h.done).length + " habits remain for today.";
    }
    if (/help|what can you do/i.test(lower)) return "I can add habits, tasks and goals, mark habits complete, update goal progress, and summarise your lists. For example: “Add a habit to practise Python”, “Remind me to call the bank”, or “Set business goal to 25%”.";
    return null;
  }

  async function sendMessage(value = message) {
    const prompt = value.trim();
    if (!prompt || busy) return;
    setMessage("");
    setMessages(current => [...current, { role: "user", content: prompt }]);
    setBusy(true);
    try {
      if (aiEndpoint) {
        const response = await fetch(aiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: prompt, context: { habits: data.habits, goals: data.goals, tasks: data.tasks, xp: data.xp, today: today() } })
        });
        if (!response.ok) throw new Error("AI service returned " + response.status);
        const result = await response.json();
        if (result.action) applyRemoteAction(result.action);
        reply(result.reply || result.message || "Done.");
      } else {
        const result = localCommand(prompt);
        reply(result || "I can handle common habit, task and goal commands locally. Add an AI endpoint in your deployment settings to enable open ended conversations.");
      }
    } catch (error) {
      reply("I couldn't reach the AI service. " + error.message + " Your local data is safe. Check your AI endpoint configuration.");
    } finally { setBusy(false); }
  }

  function applyRemoteAction(action) {
    if (!action || typeof action !== "object") return;
    update(d => {
      if (action.type === "add_habit" && action.title) return { ...d, habits: [...d.habits, { id: makeId(), title: action.title, category: action.category || "Personal", done: false }] };
      if (action.type === "add_task" && action.title) return { ...d, tasks: [...d.tasks, { id: makeId(), title: action.title, done: false }] };
      if (action.type === "add_goal" && action.title) return { ...d, goals: [...d.goals, { id: makeId(), title: action.title, category: action.category || "Personal", progress: 0 }] };
      if (action.type === "complete_habit") return { ...d, habits: d.habits.map(h => h.id === action.id ? { ...h, done: true } : h), xp: d.xp + 10 };
      if (action.type === "update_goal") return { ...d, goals: d.goals.map(g => g.id === action.id ? { ...g, progress: Math.max(0, Math.min(100, Number(action.progress) || 0)) } : g) };
      return d;
    });
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setNotice("Voice input is not supported in this browser. Try Chrome or Edge."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => { const spoken = event.results[0][0].transcript; setListening(false); sendMessage(spoken); };
    recognition.onerror = () => { setListening(false); setNotice("Microphone input was not completed. Check browser microphone permission."); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopVoice() { recognitionRef.current?.stop(); setListening(false); }
  function speakLast() {
    const last = [...messages].reverse().find(m => m.role === "assistant");
    if (!last || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(last.content);
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }
  function toggleHabit(id) {
    update(d => ({ ...d, habits: d.habits.map(h => h.id === id ? { ...h, done: !h.done } : h), xp: d.xp + (data.habits.find(h => h.id === id)?.done ? -10 : 10) }));
  }
  function addHabit() {
    const title = window.prompt("What habit would you like to add?");
    if (title?.trim()) update(d => ({ ...d, habits: [...d.habits, { id: makeId(), title: title.trim(), category: "Personal", done: false }] }));
  }
  function addGoal() {
    const title = window.prompt("What goal would you like to add?");
    if (title?.trim()) update(d => ({ ...d, goals: [...d.goals, { id: makeId(), title: title.trim(), category: "Personal", progress: 0 }] }));
  }
  function addTask() {
    const title = window.prompt("What task should be added?");
    if (title?.trim()) update(d => ({ ...d, tasks: [...d.tasks, { id: makeId(), title: title.trim(), done: false }] }));
  }

  if (authLoading) return <div className="auth-loading">Loading LevelUp...</div>;
  if (!session) return <Auth />;

  return (
    <div className="lv2-shell">
      <aside className="lv2-sidebar">
        <div className="lv2-brand"><span><Zap size={20} fill="currentColor" /></span>Level<span>Up</span><small>V2</small></div>
        <div className="lv2-nav-label">WORKSPACE</div>
        {[["Today", Target], ["Habits", CheckCircle2], ["Goals", Goal], ["Tasks", Command], ["AI Assistant", Bot]].map(([name, Icon]) => (
          <button key={name} className={"lv2-nav " + (tab === name ? "active" : "")} onClick={() => setTab(name)}><Icon size={17} />{name}{name === "Habits" && <small>{completed}/{data.habits.length}</small>}</button>
        ))}
        <div className="lv2-side-foot"><div className="lv2-level"><span>YOUR LEVEL</span><b>LV {level}</b><div><i style={{ width: ((data.xp % 500) / 5) + "%" }} /></div><small>{data.xp % 500} / 500 XP</small></div><p>Private by default. Your V2 data is stored separately in this browser.</p></div>
      </aside>
      <main className="lv2-main">
        <header className="lv2-header"><div><span className="lv2-kicker">YOUR PERSONAL OPERATING SYSTEM</span><h1>{tab === "Today" ? "Make today count." : tab}</h1><p>{dateLabel} · Small steps, tracked consistently. · {syncStatus}</p></div><button className="lv2-ai-shortcut" onClick={() => setTab("AI Assistant")}><Sparkles size={16} /> Ask LevelUp AI</button></header>
        {notice && <div className="lv2-notice" onClick={() => setNotice("")}>{notice}<X size={14}/></div>}
        {tab === "Today" && <div className="lv2-content">
          <section className="lv2-hero"><div><span className="lv2-kicker">DAILY PROGRESS</span><div className="lv2-score">{percent}<small>%</small></div><h2>{completed === data.habits.length && data.habits.length ? "Everything checked off." : "Build momentum, one action at a time."}</h2><p>{completed} of {data.habits.length} habits completed today</p><div className="lv2-progress"><i style={{ width: percent + "%" }}/></div></div><div className="lv2-hero-orb"><Activity size={34}/></div></section>
          <div className="lv2-stats"><article><span><Zap size={17}/></span><small>TOTAL XP</small><strong>{data.xp.toLocaleString()}</strong><p>Level {level}</p></article><article><span><CheckCircle2 size={17}/></span><small>HABITS DONE</small><strong>{completed}/{data.habits.length}</strong><p>Today's consistency</p></article><article><span><Flame size={17}/></span><small>ACTIVE GOALS</small><strong>{data.goals.filter(g => g.progress < 100).length}</strong><p>Keep moving forward</p></article></div>
          <div className="lv2-columns"><section className="lv2-panel"><div className="lv2-panel-head"><div><h2>Today's habits</h2><p>Complete habits to earn experience</p></div><button onClick={addHabit}><Plus size={15}/> Add</button></div>{data.habits.map(h => <div className="lv2-item" key={h.id}><button className={"lv2-check " + (h.done ? "done" : "")} onClick={() => toggleHabit(h.id)}>{h.done ? <Check size={15}/> : <Circle size={16}/>}</button><div><b className={h.done ? "finished" : ""}>{h.title}</b><small>{h.category}</small></div><span>+10 XP</span></div>)}{!data.habits.length && <p className="lv2-empty">Add a habit to start building your routine.</p>}</section>
          <section className="lv2-panel"><div className="lv2-panel-head"><div><h2>Priority goals</h2><p>Progress on what matters</p></div><button onClick={addGoal}><Plus size={15}/> Add</button></div>{data.goals.slice(0,4).map(g => <div className="lv2-goal" key={g.id}><div><b>{g.title}</b><strong>{g.progress}%</strong></div><div className="lv2-progress"><i style={{ width: g.progress + "%" }}/></div></div>)}{!data.goals.length && <p className="lv2-empty">Add a goal to keep your bigger picture visible.</p>}</section></div>
          <section className="lv2-panel lv2-reflection"><div><h2>Daily reflection</h2><p>Capture one thought before the day ends.</p></div><textarea value={reflection} onChange={e => { setReflection(e.target.value); update(d => ({ ...d, reflections: { ...d.reflections, [today()]: e.target.value } })); }} placeholder="What went well today? What would you improve tomorrow?"/></section>
        </div>}
        {tab === "Habits" && <section className="lv2-content lv2-panel"><div className="lv2-panel-head"><div><h2>Your habits</h2><p>{completed} completed today</p></div><button onClick={addHabit}><Plus size={15}/> Add habit</button></div>{data.habits.map(h => <div className="lv2-item" key={h.id}><button className={"lv2-check " + (h.done ? "done" : "")} onClick={() => toggleHabit(h.id)}>{h.done ? <Check size={15}/> : <Circle size={16}/>}</button><div><b className={h.done ? "finished" : ""}>{h.title}</b><small>{h.category}</small></div><button className="lv2-delete" onClick={() => update(d => ({ ...d, habits: d.habits.filter(x => x.id !== h.id) }))}><Trash2 size={15}/></button></div>)}</section>}
        {tab === "Goals" && <section className="lv2-content lv2-panel"><div className="lv2-panel-head"><div><h2>Long term goals</h2><p>Update progress as you make progress in real life</p></div><button onClick={addGoal}><Plus size={15}/> Add goal</button></div>{data.goals.map(g => <div className="lv2-goal lv2-goal-large" key={g.id}><div><b>{g.title}</b><strong>{g.progress}%</strong></div><div className="lv2-progress"><i style={{ width: g.progress + "%" }}/></div><input type="range" min="0" max="100" step="5" value={g.progress} onChange={e => update(d => ({ ...d, goals: d.goals.map(x => x.id === g.id ? { ...x, progress: Number(e.target.value) } : x) }))}/></div>)}</section>}
        {tab === "Tasks" && <section className="lv2-content lv2-panel"><div className="lv2-panel-head"><div><h2>Your task list</h2><p>Keep the next action clear</p></div><button onClick={addTask}><Plus size={15}/> Add task</button></div>{data.tasks.map(t => <div className="lv2-item" key={t.id}><button className={"lv2-check " + (t.done ? "done" : "")} onClick={() => update(d => ({ ...d, tasks: d.tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) }))}>{t.done ? <Check size={15}/> : <Circle size={16}/>}</button><div><b className={t.done ? "finished" : ""}>{t.title}</b><small>{t.done ? "Completed" : "To do"}</small></div><button className="lv2-delete" onClick={() => update(d => ({ ...d, tasks: d.tasks.filter(x => x.id !== t.id) }))}><Trash2 size={15}/></button></div>)}{!data.tasks.length && <p className="lv2-empty">No tasks yet. Add one or ask the assistant to create it.</p>}</section>}
        {tab === "AI Assistant" && <section className="lv2-content lv2-chat-layout"><div className="lv2-chat-intro"><div className="lv2-bot-mark"><Bot size={24}/></div><div><span className="lv2-kicker">LEVELUP AI</span><h2>Your assistant, ready when you are.</h2><p>Use your voice or type a request. The assistant can manage your habits, tasks and goals.</p></div></div><div className="lv2-chat"><div className="lv2-messages">{messages.map((m,i) => <div className={"lv2-message " + m.role} key={i}><span>{m.role === "assistant" ? <Bot size={15}/> : "You"}</span><p>{m.content}</p></div>)}{busy && <div className="lv2-message assistant"><span><Bot size={15}/></span><p>Thinking…</p></div>}<div ref={chatEndRef}/></div><form className="lv2-composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}><button type="button" className={listening ? "recording" : ""} title="Voice input" onClick={listening ? stopVoice : startVoice}>{listening ? <MicOff size={18}/> : <Mic size={18}/>}</button><input value={message} onChange={e => setMessage(e.target.value)} placeholder={listening ? "Listening..." : "Tell LevelUp what you want to do..."} /><button type="submit" disabled={!message.trim() || busy}><Send size={17}/></button></form><div className="lv2-chat-tools"><span>{aiEndpoint ? "AI endpoint connected" : "Local command mode"} · Your V2 data stays separate from V1</span><button onClick={speakLast}><Volume2 size={14}/> Read reply</button></div><div className="lv2-suggestions">{["Add a habit to read for 20 minutes","Remind me to plan tomorrow","Show my habits and goals"].map(s => <button key={s} onClick={() => sendMessage(s)}>{s}</button>)}</div></div></section>}
        <footer className="lv2-footer">LevelUp V2 <span>Built for steady progress.</span></footer>
      </main>
    </div>
  );
}
