import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import { Activity, ArrowUpRight, AudioLines, BarChart3, Bot, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Command, Flame, Goal, Heart, Mic, MicOff, Plus, Send, Sparkles, Target, Trash2, Trophy, Volume2, VolumeX, WandSparkles, X, Zap } from "lucide-react";

const STORE = "levelup-v2-data";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const offsetDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateKey(d);
};
const monthLabel = d => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
    return { ...starter, ...raw, habits: Array.isArray(raw.habits) ? raw.habits : starter.habits, goals: Array.isArray(raw.goals) ? raw.goals : starter.goals, tasks: Array.isArray(raw.tasks) ? raw.tasks : [], habitLog: raw.habitLog && typeof raw.habitLog === "object" ? raw.habitLog : {}, calendarItems: Array.isArray(raw.calendarItems) ? raw.calendarItems : [], moods: raw.moods && typeof raw.moods === "object" ? raw.moods : {} };
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
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today());
  const [planTitle, setPlanTitle] = useState("");
  const [planType, setPlanType] = useState("Task");
  const [moodNote, setMoodNote] = useState(data.moods?.[today()]?.note || "");
  const [motivation, setMotivation] = useState("");
  const [motivationBusy, setMotivationBusy] = useState(false);
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
    let next = data;
    if (data.day !== today()) {
      const completedYesterday = data.habits.filter(h => h.done).map(h => h.id);
      next = {
        ...data,
        day: today(),
        habits: data.habits.map(h => ({ ...h, done: false })),
        habitLog: { ...(data.habitLog || {}), [data.day]: completedYesterday }
      };
      setData(next);
    } else if (!Object.prototype.hasOwnProperty.call(data.habitLog || {}, today())) {
      const completedToday = data.habits.filter(h => h.done).map(h => h.id);
      if (completedToday.length) {
        next = { ...data, habitLog: { ...(data.habitLog || {}), [today()]: completedToday } };
        setData(next);
      }
    }
    localStorage.setItem(STORE, JSON.stringify(next));
  }, [data]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const completed = data.habits.filter(h => h.done).length;
  const percent = data.habits.length ? Math.round(completed / data.habits.length * 100) : 0;
  const level = Math.floor(data.xp / 500) + 1;
  const selectedPlans = (data.calendarItems || []).filter(item => item.date === selectedDate).sort((a, b) => (a.priority === "High" ? -1 : 1) - (b.priority === "High" ? -1 : 1));
  const calendarCells = useMemo(() => {
    const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return { key: dateKey(day), day: day.getDate(), inMonth: day.getMonth() === calendarMonth.getMonth() };
    });
  }, [calendarMonth]);
  const last14Days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const key = offsetDate(i - 13);
    const done = (data.habitLog?.[key] || []).length;
    const rate = data.habits.length ? Math.round(done / data.habits.length * 100) : 0;
    return { key, label: new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", day: "numeric" }), rate };
  }), [data.habitLog, data.habits.length]);
  const monthPrefix = today().slice(0, 7);
  const monthEntries = Object.entries(data.habitLog || {}).filter(([key]) => key.startsWith(monthPrefix));
  const monthRate = monthEntries.length ? Math.round(monthEntries.reduce((sum, [, ids]) => sum + (data.habits.length ? ids.length / data.habits.length * 100 : 0), 0) / monthEntries.length) : 0;
  const weeklyRate = last14Days.slice(-7).reduce((sum, day) => sum + day.rate, 0) / 7;
  const completedTasks = data.tasks.filter(task => task.done).length;
  const goalAverage = data.goals.length ? Math.round(data.goals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / data.goals.length) : 0;
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
      if (action.type === "complete_habit") {
        const habit = d.habits.find(h => h.id === action.id);
        if (!habit || habit.done) return d;
        return { ...d, habits: d.habits.map(h => h.id === action.id ? { ...h, done: true } : h), xp: d.xp + 10 };
      }
      if (action.type === "update_goal") {
        if (!d.goals.some(g => g.id === action.id)) return d;
        return { ...d, goals: d.goals.map(g => g.id === action.id ? { ...g, progress: Math.max(0, Math.min(100, Number(action.progress) || 0)) } : g) };
      }
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
        {[["Today", Target], ["Habits", CheckCircle2], ["Goals", Goal], ["Tasks", Command], ["Calendar", CalendarDays], ["Analytics", BarChart3], ["AI Assistant", Bot]].map(([name, Icon]) => (
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
          <section className="lv2-panel lv2-mood-panel">
            <div className="lv2-panel-head"><div><h2>How are you feeling today?</h2><p>Your encouragement should match your day, not add pressure.</p></div><Heart size={19}/></div>
            <div className="lv2-moods">{["Great","Good","Okay","Low","Stressed"].map(mood => <button key={mood} className={(data.moods?.[today()]?.mood === mood ? "chosen " : "") + "mood-choice"} onClick={() => setMood(mood)}>{mood}</button>)}</div>
            <textarea className="lv2-mood-note" value={moodNote} onChange={e => { setMoodNote(e.target.value); update(d => ({ ...d, moods: { ...(d.moods || {}), [today()]: { ...(d.moods?.[today()] || {}), note: e.target.value } } })); }} placeholder="Anything affecting your mood? Optional."/>
            <div className="lv2-motivation-row"><button className="lv2-ai-shortcut" onClick={generateMotivation} disabled={motivationBusy}><Sparkles size={15}/>{motivationBusy ? "Preparing..." : "Give me a little motivation"}</button><span>{aiEndpoint ? "Personalised AI encouragement" : "Mood and time based encouragement"}</span></div>
            {motivation && <p className="lv2-motivation">{motivation}</p>}
          </section>
        </div>}
        {tab === "Habits" && <section className="lv2-content lv2-panel"><div className="lv2-panel-head"><div><h2>Your habits</h2><p>{completed} completed today</p></div><button onClick={addHabit}><Plus size={15}/> Add habit</button></div>{data.habits.map(h => <div className="lv2-item" key={h.id}><button className={"lv2-check " + (h.done ? "done" : "")} onClick={() => toggleHabit(h.id)}>{h.done ? <Check size={15}/> : <Circle size={16}/>}</button><div><b className={h.done ? "finished" : ""}>{h.title}</b><small>{h.category}</small></div><button className="lv2-delete" onClick={() => update(d => ({ ...d, habits: d.habits.filter(x => x.id !== h.id) }))}><Trash2 size={15}/></button></div>)}</section>}
        {tab === "Goals" && <section className="lv2-content lv2-panel"><div className="lv2-panel-head"><div><h2>Long term goals</h2><p>Update progress as you make progress in real life</p></div><button onClick={addGoal}><Plus size={15}/> Add goal</button></div>{data.goals.map(g => <div className="lv2-goal lv2-goal-large" key={g.id}><div><b>{g.title}</b><strong>{g.progress}%</strong></div><div className="lv2-progress"><i style={{ width: g.progress + "%" }}/></div><input type="range" min="0" max="100" step="5" value={g.progress} onChange={e => update(d => ({ ...d, goals: d.goals.map(x => x.id === g.id ? { ...x, progress: Number(e.target.value) } : x) }))}/></div>)}</section>}
        {tab === "Tasks" && <section className="lv2-content lv2-panel"><div className="lv2-panel-head"><div><h2>Your task list</h2><p>Keep the next action clear</p></div><button onClick={addTask}><Plus size={15}/> Add task</button></div>{data.tasks.map(t => <div className="lv2-item" key={t.id}><button className={"lv2-check " + (t.done ? "done" : "")} onClick={() => update(d => ({ ...d, tasks: d.tasks.map(x => x.id === t.id ? { ...x, done: !x.done } : x) }))}>{t.done ? <Check size={15}/> : <Circle size={16}/>}</button><div><b className={t.done ? "finished" : ""}>{t.title}</b><small>{t.done ? "Completed" : "To do"}</small></div><button className="lv2-delete" onClick={() => update(d => ({ ...d, tasks: d.tasks.filter(x => x.id !== t.id) }))}><Trash2 size={15}/></button></div>)}{!data.tasks.length && <p className="lv2-empty">No tasks yet. Add one or ask the assistant to create it.</p>}</section>}
        {tab === "Calendar" && <div className="lv2-content lv2-calendar-layout">
          <section className="lv2-panel">
            <div className="lv2-panel-head"><div><h2>Plan your month</h2><p>Choose a date to add tasks, events or milestones.</p></div><div className="lv2-month-nav"><button onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}><ChevronLeft size={17}/></button><b>{monthLabel(calendarMonth)}</b><button onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}><ChevronRight size={17}/></button></div></div>
            <div className="lv2-calendar-grid">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => <span className="lv2-calendar-weekday" key={day}>{day}</span>)}{calendarCells.map(cell => {
              const count = (data.calendarItems || []).filter(item => item.date === cell.key).length;
              return <button key={cell.key} className={"lv2-calendar-day " + (!cell.inMonth ? "outside " : "") + (selectedDate === cell.key ? "selected " : "") + (today() === cell.key ? "today " : "")} onClick={() => setSelectedDate(cell.key)}><span>{cell.day}</span>{count > 0 && <i>{count}</i>}</button>;
            })}</div>
            <div className="lv2-selected-date"><div><span className="lv2-kicker">SELECTED DATE</span><h3>{new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</h3></div><button className="lv2-today-btn" onClick={() => {setSelectedDate(today());setCalendarMonth(new Date());}}>Today</button></div>
            <form className="lv2-plan-form" onSubmit={addCalendarPlan}><input value={planTitle} onChange={e => setPlanTitle(e.target.value)} placeholder="What do you want to plan?" required/><select value={planType} onChange={e => setPlanType(e.target.value)}><option>Task</option><option>Meeting</option><option>Milestone</option><option>Personal</option></select><button type="submit"><Plus size={15}/> Add</button></form>
            <div className="lv2-day-plans">{selectedPlans.map(item => <div className="lv2-item" key={item.id}><button className={"lv2-check " + (item.done ? "done" : "")} onClick={() => toggleCalendarPlan(item.id)}>{item.done ? <Check size={14}/> : <Circle size={15}/>}</button><div><b className={item.done ? "finished" : ""}>{item.title}</b><small>{item.type}</small></div><button className="lv2-delete" onClick={() => update(d => ({...d,calendarItems:d.calendarItems.filter(x=>x.id!==item.id)}))}><Trash2 size={15}/></button></div>)}{!selectedPlans.length && <p className="lv2-empty">Nothing planned for this date yet. Add a task, event or milestone above.</p>}</div>
          </section>
          <div className="lv2-focus-grid">
            <section className="lv2-panel"><h2>Weekly focus</h2><p className="lv2-muted-copy">What are the three most important outcomes this week?</p><textarea value={data.weeklyFocus || ""} onChange={e => update(d => ({...d,weeklyFocus:e.target.value}))} placeholder="This week, I want to..."/></section>
            <section className="lv2-panel"><h2>Monthly focus</h2><p className="lv2-muted-copy">Set a direction for the month. Keep it realistic.</p><textarea value={data.monthlyFocus || ""} onChange={e => update(d => ({...d,monthlyFocus:e.target.value}))} placeholder="By the end of this month, I want to..."/></section>
          </div>
        </div>}
        {tab === "Analytics" && <div className="lv2-content">
          <section className="lv2-analytics-intro"><div><span className="lv2-kicker">YOUR PROGRESS, IN CONTEXT</span><h2>Comprehensive analytics</h2><p>See what is working, where you are consistent and what needs attention.</p></div><Activity size={28}/></section>
          <div className="lv2-stats lv2-analytics-stats"><article><span><BarChart3 size={17}/></span><small>7 DAY COMPLETION</small><strong>{Math.round(weeklyRate)}%</strong><p>Average daily habit completion</p></article><article><span><CalendarDays size={17}/></span><small>MONTH COMPLETION</small><strong>{monthRate}%</strong><p>Average on days with tracked activity</p></article><article><span><Zap size={17}/></span><small>TOTAL EXPERIENCE</small><strong>{data.xp.toLocaleString()}</strong><p>Level {level}</p></article><article><span><CheckCircle2 size={17}/></span><small>TASKS COMPLETED</small><strong>{completedTasks}/{data.tasks.length}</strong><p>All tracked tasks</p></article><article><span><Target size={17}/></span><small>AVERAGE GOAL PROGRESS</small><strong>{goalAverage}%</strong><p>Across {data.goals.length} goals</p></article><article><span><Flame size={17}/></span><small>HABITS TODAY</small><strong>{completed}/{data.habits.length}</strong><p>Completed today</p></article></div>
          <section className="lv2-panel lv2-chart-panel"><div className="lv2-panel-head"><div><h2>Daily consistency</h2><p>Habit completion over the last 14 days. History starts recording from V2 tracking.</p></div><span className="lv2-chart-legend">Completion</span></div><div className="lv2-bar-chart">{last14Days.map(day => <div className="lv2-bar-column" key={day.key}><div className="lv2-bar-track"><i style={{height:day.rate + "%"}} title={day.rate + "%"} /></div><b>{day.rate}%</b><small>{day.label}</small></div>)}</div></section>
          <div className="lv2-columns"><section className="lv2-panel"><h2>Goal progress</h2>{data.goals.map(goal => <div className="lv2-goal" key={goal.id}><div><b>{goal.title}</b><strong>{goal.progress}%</strong></div><div className="lv2-progress"><i style={{width:goal.progress + "%"}}/></div></div>)}{!data.goals.length && <p className="lv2-empty">Add a goal to see progress analytics.</p>}</section><section className="lv2-panel"><h2>Planning overview</h2><p className="lv2-muted-copy">{(data.calendarItems || []).filter(item => item.date >= today() && !item.done).length} upcoming plans remain. {data.habits.length - completed} habits are still open today.</p><p className="lv2-muted-copy">You have {data.goals.filter(goal => goal.progress < 100).length} active goals and {data.tasks.filter(task => !task.done).length} open tasks.</p><button className="lv2-ai-shortcut" onClick={() => setTab("Calendar")}><CalendarDays size={15}/> Review your calendar</button></section></div>
        </div>}
        {tab === "AI Assistant" && <section className="lv2-content lv2-chat-layout"><div className="lv2-chat-intro"><div className="lv2-bot-mark"><Bot size={24}/></div><div><span className="lv2-kicker">LEVELUP AI</span><h2>Your assistant, ready when you are.</h2><p>Use your voice or type a request. The assistant can manage your habits, tasks and goals.</p></div></div><div className="lv2-chat"><div className="lv2-messages">{messages.map((m,i) => <div className={"lv2-message " + m.role} key={i}><span>{m.role === "assistant" ? <Bot size={15}/> : "You"}</span><p>{m.content}</p></div>)}{busy && <div className="lv2-message assistant"><span><Bot size={15}/></span><p>Thinking…</p></div>}<div ref={chatEndRef}/></div><form className="lv2-composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}><button type="button" className={listening ? "recording" : ""} title="Voice input" onClick={listening ? stopVoice : startVoice}>{listening ? <MicOff size={18}/> : <Mic size={18}/>}</button><input value={message} onChange={e => setMessage(e.target.value)} placeholder={listening ? "Listening..." : "Tell LevelUp what you want to do..."} /><button type="submit" disabled={!message.trim() || busy}><Send size={17}/></button></form><div className="lv2-chat-tools"><span>{aiEndpoint ? "AI endpoint connected" : "Local command mode"} · Your V2 data stays separate from V1</span><button onClick={speakLast}><Volume2 size={14}/> Read reply</button></div><div className="lv2-suggestions">{["Add a habit to read for 20 minutes","Remind me to plan tomorrow","Show my habits and goals"].map(s => <button key={s} onClick={() => sendMessage(s)}>{s}</button>)}</div></div></section>}
        <footer className="lv2-footer">LevelUp V2 <span>Built for steady progress.</span></footer>
      </main>
    </div>
  );
}
