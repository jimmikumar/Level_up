import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import {
  Activity, AlertCircle, ArrowRight, BarChart3, Bot, CalendarDays, Check,
  CheckCircle2, ChevronDown, Circle, Clock3, Flame, Flag, Goal, Heart,
  ListTodo, Mic, MicOff, Plus, RefreshCw, Send, Settings, Sparkles,
  Target, Timer, Trash2, Trophy, Volume2, X, Zap
} from "lucide-react";
import "./v3-1.css";

const STORE = "levelup-v3-data";
const AI_URL = import.meta.env.VITE_AI_ASSISTANT_URL || "";
const today = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};
const uid = () => Date.now() + Math.floor(Math.random() * 10000);
const starter = {
  tasks: [],
  goals: [],
  habits: [],
  habitLog: {},
  focusSessions: [],
  dailyPlans: {},
  reviews: {},
  xp: 0,
  settings: { focusMinutes: 50, breakMinutes: 10, availableHours: 8 }
};
function readLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved) return { ...starter, ...saved, tasks: (saved.tasks || []).map(t => ({ ...t, priority: ({ High: "P1", Medium: "P2", Low: "P3" })[t.priority] || t.priority || "P2" })), settings: { ...starter.settings, ...(saved.settings || {}) } };
    const old = JSON.parse(localStorage.getItem("levelup-v2-data"));
    if (old) return {
      ...starter,
      tasks: (old.tasks || []).map(t => ({ ...t, priority: ({ High: "P1", Medium: "P2", Low: "P3" })[t.priority] || t.priority || "P2", dueDate: t.dueDate || "", status: t.done ? "done" : "todo", estimate: t.estimate || 30 })),
      goals: (old.goals || []).map(g => ({ ...g, milestones: g.milestones || [] })),
      habits: (old.habits || []).map(h => ({ ...h, active: true })),
      habitLog: {
        ...(old.habitLog || {}),
        ...(old.day === today() && (old.habits || []).some(h => h.done)
          ? { [today()]: [...new Set([...(old.habitLog?.[today()] || []), ...(old.habits || []).filter(h => h.done).map(h => h.id)])] }
          : {})
      },
      xp: old.xp || 0
    };
    return starter;
  } catch { return starter; }
}
const priorityRank = { P1: 0, P2: 1, P3: 2, P4: 3, High: 0, Medium: 1, Low: 2 };
const fmtDate = value => value ? new Date(value + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No deadline";
const safeText = value => String(value || "").trim();

function renderInlineAI(text, prefix) {
  const parts = String(text || "").split(/(\\*\\*[^*]+\\*\\*|\\*[^*]+\\*|\x60[^\x60]+\x60)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={prefix + index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={prefix + index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={prefix + index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function FormattedAIText({ text }) {
  const lines = String(text || "").replace(/\\r/g, "").split("\\n");
  const blocks = [];
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: "p", lines: paragraph });
      paragraph = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flushParagraph(); continue; }
    const heading = line.match(/^(#{1,3})\\s+(.+)$/);
    const bullet = line.match(/^[-*+]\\s+(.+)$/);
    const numbered = line.match(/^\\d+[.)]\\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "h" + heading[1].length, text: heading[2] });
    } else if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? "ul" : "ol";
      const items = [bullet ? bullet[1] : numbered[1]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        const match = next.match(type === "ul" ? /^[-*+]\\s+(.+)$/ : /^\\d+[.)]\\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        i++;
      }
      blocks.push({ type, items });
    } else {
      paragraph.push(line);
    }
  }
  flushParagraph();
  return <div className="v3-formatted-ai">{blocks.map((block, index) => {
    const key = "ai-" + index;
    if (block.type === "h1") return <h3 key={key}>{renderInlineAI(block.text, key)}</h3>;
    if (block.type === "h2") return <h4 key={key}>{renderInlineAI(block.text, key)}</h4>;
    if (block.type === "h3") return <h5 key={key}>{renderInlineAI(block.text, key)}</h5>;
    if (block.type === "ul" || block.type === "ol") {
      const Tag = block.type;
      return <Tag key={key}>{block.items.map((item, itemIndex) => <li key={key + "-" + itemIndex}>{renderInlineAI(item, key + "-" + itemIndex)}</li>)}</Tag>;
    }
    return <p key={key}>{renderInlineAI(block.lines.join(" "), key)}</p>;
  })}</div>;
}


export default function LevelUpV3() {
  const [data, setData] = useState(readLocal);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadedUser, setLoadedUser] = useState(null);
  const [sync, setSync] = useState("Checking account");
  const [tab, setTab] = useState("Today");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState("P2");
  const [taskDue, setTaskDue] = useState("");
  const [taskGoal, setTaskGoal] = useState("");
  const [taskEstimate, setTaskEstimate] = useState("30");
  const [taskScheduledDate, setTaskScheduledDate] = useState(today());
  const [taskScheduledTime, setTaskScheduledTime] = useState("");
  const [availableHours, setAvailableHours] = useState(() => String(readLocal().settings?.availableHours || 8));
  const [calendarDate, setCalendarDate] = useState(today());
  const [milestoneBusy, setMilestoneBusy] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [habitTitle, setHabitTitle] = useState("");
  const [milestoneInputs, setMilestoneInputs] = useState({});
  const [plan, setPlan] = useState("");
  const [planBusy, setPlanBusy] = useState(false);
  const [review, setReview] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState([{ role: "assistant", text: "I can help you plan your day, prioritise tasks, break goals into milestones and review your progress. What would you like to work on?" }]);
  const [chatBusy, setChatBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [focusTask, setFocusTask] = useState("");
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [focusMode, setFocusMode] = useState("focus");
  const [mood, setMood] = useState("");
  const [reflection, setReflection] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const recognitionRef = useRef(null);
  const chatEnd = useRef(null);

  const update = fn => setData(current => fn(current));
  const todayLog = data.habitLog?.[today()] || [];
  const openTasks = data.tasks.filter(t => t.status !== "done");
  const doneTasks = data.tasks.filter(t => t.status === "done");
  const todayTasks = openTasks.filter(t => !t.dueDate || t.dueDate <= today()).sort((a,b) => priorityRank[a.priority || "P2"] - priorityRank[b.priority || "P2"]);
  const highTasks = openTasks.filter(t => t.priority === "P1" || t.priority === "High");
  const completedHabits = data.habits.filter(h => todayLog.includes(h.id)).length;
  const habitRate = data.habits.length ? Math.round(completedHabits / data.habits.length * 100) : 0;
  const goalProgress = data.goals.length ? Math.round(data.goals.reduce((n,g) => n + Number(g.progress || 0), 0) / data.goals.length) : 0;
  const focusToday = data.focusSessions.filter(s => s.date === today()).reduce((n,s) => n + s.minutes, 0);
  const level = Math.floor((data.xp || 0) / 500) + 1;
  const activeGoals = data.goals.filter(g => Number(g.progress || 0) < 100);
  const dateLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data: result }) => {
      if (live) { setSession(result?.session || null); setAuthLoading(false); }
    }).catch(() => { if (live) setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next); setAuthLoading(false);
    });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let live = true;
    async function load() {
      if (!session?.user?.id) { setLoadedUser(null); setSync("Not signed in"); return; }
      const id = session.user.id;
      setLoadedUser(null);
      setSync("Loading V3 data");
      const { data: row, error } = await supabase.from("user_progress_v3").select("progress").eq("userid", id).maybeSingle();
      if (!live) return;
      if (error) {
        setSync("Local backup active");
        setNotice("V3 cloud sync is not ready yet. Run SUPABASE_V3_SETUP.sql in Supabase. Your browser backup remains available.");
        setLoadedUser(id);
        return;
      }
      if (row?.progress && typeof row.progress === "object") setData({ ...readLocal(), ...row.progress, tasks: (row.progress.tasks || readLocal().tasks || []).map(t => ({ ...t, priority: ({ High: "P1", Medium: "P2", Low: "P3" })[t.priority] || t.priority || "P2" })) });
      setLoadedUser(id);
      setSync("Cloud ready");
    }
    load();
    return () => { live = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(data)); } catch {}
  }, [data]);

  useEffect(() => {
    if (!session?.user?.id || loadedUser !== session.user.id) return;
    const timer = window.setTimeout(async () => {
      setSync("Saving");
      const { error } = await supabase.from("user_progress_v3").upsert({
        userid: session.user.id, progress: data, updated_at: new Date().toISOString()
      }, { onConflict: "userid" });
      setSync(error ? "Local backup active" : "Synced");
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [data, session?.user?.id, loadedUser]);

  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => setFocusSeconds(s => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const callAI = async (message, purpose) => {
    if (!AI_URL) throw new Error("AI endpoint is not configured.");
    const response = await fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        context: {
          purpose,
          today: today(),
          tasks: data.tasks,
          goals: data.goals,
          habits: data.habits,
          habitLog: data.habitLog,
          focusSessions: data.focusSessions.slice(-30),
          xp: data.xp,
          availableTasks: openTasks,
          settings: data.settings,
          yesterday: (() => { const d = new Date(); d.setDate(d.getDate() - 1); const key = [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); return { date: key, completedTasks: data.tasks.filter(t => t.completedAt === key).map(t => t.title), habitsCompleted: (data.habitLog?.[key] || []).length, focusMinutes: data.focusSessions.filter(s => s.date === key).reduce((n,s) => n + s.minutes, 0) }; })()
        }
      })
    });
    if (!response.ok) {
      const body = await response.text();
      let detail = body;
      try { const parsed = JSON.parse(body); detail = parsed.detail || parsed.error || parsed.message || body; if (typeof detail !== "string") detail = JSON.stringify(detail); } catch {}
      throw new Error("AI service returned " + response.status + ": " + detail.slice(0, 400));
    }
    return response.json();
  };

  function addTask(event) {
    event?.preventDefault();
    const title = safeText(taskTitle);
    if (!title) return;
    update(d => ({ ...d, tasks: [...d.tasks, { id: uid(), title, priority: taskPriority, dueDate: taskDue, scheduledDate: taskScheduledDate || "", scheduledTime: taskScheduledTime || "", goalId: taskGoal || null, estimate: Math.max(5, Number(taskEstimate) || 30), status: "todo", createdAt: new Date().toISOString() }] }));
    setTaskTitle(""); setTaskDue(""); setTaskGoal(""); setTaskPriority("P2"); setTaskEstimate("30"); setTaskScheduledDate(today()); setTaskScheduledTime("");
  }
  function addGoal(event) {
    event?.preventDefault();
    const title = safeText(goalTitle);
    if (!title) return;
    update(d => ({ ...d, goals: [...d.goals, { id: uid(), title, deadline: goalDeadline, category: "Personal", progress: 0, milestones: [], createdAt: today() }] }));
    setGoalTitle(""); setGoalDeadline("");
  }
  function addHabit(event) {
    event?.preventDefault();
    const title = safeText(habitTitle);
    if (!title) return;
    update(d => ({ ...d, habits: [...d.habits, { id: uid(), title, active: true }] }));
    setHabitTitle("");
  }
  function toggleTask(id) {
    update(d => ({ ...d, tasks: d.tasks.map(t => t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done", completedAt: t.status === "done" ? null : today() } : t), xp: d.xp + (data.tasks.find(t => t.id === id)?.status === "done" ? -5 : 10) }));
  }
  function deleteTask(id) {
    if (!window.confirm("Delete this task?")) return;
    update(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== id) }));
  }
  function toggleHabit(id) {
    const done = todayLog.includes(id);
    update(d => {
      const current = d.habitLog?.[today()] || [];
      return { ...d, habitLog: { ...(d.habitLog || {}), [today()]: done ? current.filter(x => x !== id) : [...current, id] }, xp: d.xp + (done ? -5 : 10) };
    });
  }
  function toggleMilestone(goalId, milestoneId) {
    update(d => ({ ...d, goals: d.goals.map(g => {
      if (g.id !== goalId) return g;
      const milestones = (g.milestones || []).map(m => m.id === milestoneId ? { ...m, done: !m.done } : m);
      const progress = milestones.length ? Math.round(milestones.filter(m => m.done).length / milestones.length * 100) : g.progress;
      return { ...g, milestones, progress };
    }) }));
  }
  function addMilestone(goalId) {
    const title = safeText(milestoneInputs[goalId]);
    if (!title) return;
    update(d => ({ ...d, goals: d.goals.map(g => g.id === goalId ? { ...g, milestones: [...(g.milestones || []), { id: uid(), title, done: false }] } : g) }));
    setMilestoneInputs(s => ({ ...s, [goalId]: "" }));
  }

  function rescheduleOverdue() {
    const overdue = openTasks.filter(t => t.dueDate && t.dueDate < today());
    if (!overdue.length) { setNotice("There are no overdue tasks to reschedule."); return; }
    if (!window.confirm("Move " + overdue.length + " overdue tasks to tomorrow? Their previous due dates will be kept.")) return;
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDate = [tomorrow.getFullYear(), String(tomorrow.getMonth()+1).padStart(2,"0"), String(tomorrow.getDate()).padStart(2,"0")].join("-");
    update(d => ({ ...d, tasks: d.tasks.map(t => t.status !== "done" && t.dueDate && t.dueDate < today() ? { ...t, previousDueDate: t.dueDate, dueDate: nextDate, scheduledDate: nextDate } : t) }));
    setNotice(overdue.length + " overdue tasks moved to tomorrow.");
  }
  async function generateMilestones(goal) {
    if (milestoneBusy) return;
    setMilestoneBusy(String(goal.id));
    try {
      const result = await callAI("Create 4 to 6 clear, measurable milestones for this goal. Return only a JSON array of short milestone title strings, with no markdown. Goal: " + goal.title + ". Deadline: " + (goal.deadline || "Not set") + ". Existing milestones: " + (goal.milestones || []).map(m => m.title).join(", "), "goal_milestones");
      const raw = String(result.reply || "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("The AI did not return a valid milestone list.");
      update(d => ({ ...d, goals: d.goals.map(g => g.id === goal.id ? { ...g, milestones: [...(g.milestones || []), ...parsed.filter(x => typeof x === "string" && x.trim()).map(title => ({ id: uid(), title: title.trim(), done: false }))] } : g) }));
      setNotice("AI milestones added to " + goal.title + ".");
    } catch (error) { setNotice("Could not generate milestones. " + error.message); }
    finally { setMilestoneBusy(""); }
  }
  function deleteGoal(id) {
    if (!window.confirm("Delete this goal? Its tasks will remain in your task list.")) return;
    update(d => ({ ...d, goals: d.goals.filter(g => g.id !== id), tasks: d.tasks.map(t => t.goalId === id ? { ...t, goalId: null } : t) }));
  }

  async function makeDailyPlan() {
    if (planBusy) return;
    setPlanBusy(true);
    try {
      const result = await callAI(
        `Act as my personal execution coach. Create a realistic plan for ${availableHours} available working hours today. Use my actual open tasks, P1 to P4 priorities, deadlines, estimates, scheduled times, habits and goals. Review yesterday performance included in context, identify unfinished work and avoid repeating an overloaded plan. Give me no more than three main outcomes, then a time blocked schedule that fits within ${availableHours} hours. Respect existing scheduled times and deadlines. Include breaks and one small first action I can start immediately. Do not invent meetings or claim calendar access. Return a concise, well formatted plan with headings.`,
        "daily_plan"
      );
      const text = result.reply || "I could not prepare a plan.";
      setPlan(text);
      update(d => ({ ...d, settings: { ...(d.settings || {}), availableHours: Math.max(1, Math.min(16, Number(availableHours) || 8)) }, dailyPlans: { ...(d.dailyPlans || {}), [today()]: text } }));
    } catch (error) {
      setPlan("AI planning is unavailable right now. Start with your highest priority task: " + (todayTasks[0]?.title || "choose one meaningful task") + ". " + error.message);
    } finally { setPlanBusy(false); }
  }
  async function makeReview(kind) {
    if (reviewBusy) return;
    setReviewBusy(true);
    try {
      const prompt = kind === "weekly"
        ? "Prepare my weekly productivity review from the supplied records. Summarise wins, unfinished work, habit consistency, focus time, goal progress, patterns and three realistic improvements for next week. Be honest and supportive. Do not invent data."
        : "Prepare my end of day review from the supplied records. Summarise completed tasks, unfinished priorities, habits completed, focus time and one lesson. Give me three practical priorities for tomorrow. Be supportive, specific and do not invent data.";
      const result = await callAI(prompt, kind + "_review");
      const text = result.reply || "Review could not be generated.";
      setReview(text);
      update(d => ({ ...d, reviews: { ...(d.reviews || {}), [kind + ":" + today()]: text } }));
    } catch (error) {
      setReview("The AI review is unavailable. You completed " + doneTasks.length + " tasks, " + completedHabits + " habits and " + focusToday + " focus minutes today. " + error.message);
    } finally { setReviewBusy(false); }
  }

  function applyAction(action) {
    if (!action || typeof action !== "object") return;
    if (action.type === "add_task" && action.title) {
      update(d => ({ ...d, tasks: [...d.tasks, { id: uid(), title: action.title, priority: action.priority && ["P1","P2","P3","P4"].includes(action.priority) ? action.priority : "P2", dueDate: action.dueDate || "", scheduledDate: action.scheduledDate || "", scheduledTime: action.scheduledTime || "", goalId: null, estimate: Number(action.estimate) || 30, status: "todo" }] }));
    } else if (action.type === "add_habit" && action.title) {
      update(d => ({ ...d, habits: [...d.habits, { id: uid(), title: action.title, active: true }] }));
    } else if (action.type === "add_goal" && action.title) {
      update(d => ({ ...d, goals: [...d.goals, { id: uid(), title: action.title, progress: 0, milestones: [], category: action.category || "Personal" }] }));
    } else if (action.type === "complete_habit") {
      toggleHabit(action.id);
    } else if (action.type === "update_goal") {
      update(d => ({ ...d, goals: d.goals.map(g => g.id === action.id ? { ...g, progress: Math.max(0, Math.min(100, Number(action.progress) || 0)) } : g) }));
    }
  }
  async function sendChat(value = chatInput) {
    const prompt = safeText(value);
    if (!prompt || chatBusy) return;
    setChatInput("");
    setChat(items => [...items, { role: "user", text: prompt }]);
    setChatBusy(true);
    try {
      if (!AI_URL) throw new Error("AI endpoint is not configured. You can still manage tasks, habits and goals manually.");
      const result = await callAI(prompt, "assistant_chat");
      if (result.action) applyAction(result.action);
      setChat(items => [...items, { role: "assistant", text: result.reply || "Done." }]);
    } catch (error) {
      setChat(items => [...items, { role: "assistant", text: error.message + " Your saved data remains safe." }]);
    } finally { setChatBusy(false); }
  }
  function startVoice() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) { setNotice("Voice input is not supported in this browser. Try Chrome or Edge."); return; }
    const recognition = new Speech();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = e => { setVoiceOn(false); sendChat(e.results[0][0].transcript); };
    recognition.onerror = () => { setVoiceOn(false); setNotice("Microphone permission is required for voice input."); };
    recognition.onend = () => setVoiceOn(false);
    recognitionRef.current = recognition;
    setVoiceOn(true);
    recognition.start();
  }
  function finishFocus() {
    if (focusSeconds < 60) {
      setFocusRunning(false); setFocusSeconds(0); setFocusMode("focus");
      setNotice("Session was shorter than one minute, so it was not added to your focus history.");
      return;
    }
    const minutes = Math.max(1, Math.round(focusSeconds / 60));
    update(d => ({ ...d, focusSessions: [...d.focusSessions, { id: uid(), date: today(), minutes, task: focusTask || "Unassigned focus", createdAt: new Date().toISOString() }], xp: d.xp + Math.floor(minutes / 5) }));
    setFocusRunning(false); setFocusSeconds(0); setFocusMode("focus");
    setNotice(minutes + " focused minutes saved. Great work.");
  }
  function cancelFocus() { setFocusRunning(false); setFocusSeconds(0); }
  const clock = n => String(n).padStart(2, "0");
  const elapsed = clock(Math.floor(focusSeconds / 60)) + ":" + clock(focusSeconds % 60);
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    return { key, label: d.toLocaleDateString("en-IN", { weekday: "short" }), count: (data.habitLog?.[key] || []).length };
  }), [data.habitLog]);
  const last7Focus = data.focusSessions.filter(s => s.date >= (() => { const d = new Date(); d.setDate(d.getDate()-6); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); })()).reduce((n,s) => n+s.minutes,0);

  if (authLoading) return <div className="v3-loading">Loading LevelUp V3…</div>;
  if (!session) return <Auth />;

  const nav = [
    ["Today", Target], ["Goals", Goal], ["Tasks", ListTodo], ["Calendar", CalendarDays], ["Habits", CheckCircle2],
    ["Focus", Timer], ["Insights", BarChart3], ["AI Coach", Bot]
  ];
  return <div className="v3-app">
    <aside className="v3-sidebar">
      <div className="v3-brand"><span><Zap size={20} fill="currentColor"/></span><b>LevelUp</b><small>V3.1</small></div>
      <div className="v3-side-label">YOUR WORKSPACE</div>
      <nav>{nav.map(([name, Icon]) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}><Icon size={17}/>{name}{name === "Tasks" && <i>{openTasks.length}</i>}</button>)}</nav>
      <div className="v3-side-bottom"><div className="v3-level-card"><span>YOUR LEVEL</span><b>LEVEL {level}</b><div className="v3-level-track"><i style={{ width: ((data.xp % 500) / 5) + "%" }}/></div><small>{data.xp % 500} / 500 XP</small></div><p><span className="v3-sync-dot"/>{sync}</p><button onClick={async () => { await supabase.auth.signOut(); }}><Settings size={15}/> Account and sign out</button></div>
    </aside>
    <main className="v3-main">
      <header className="v3-topbar"><div><span className="v3-eyebrow">{dateLabel}</span><h1>{tab === "Today" ? "Make meaningful progress." : tab}</h1></div><button className="v3-ai-button" onClick={() => setTab("AI Coach")}><Sparkles size={16}/> Ask your AI coach</button></header>
      {notice && <button className="v3-notice" onClick={() => setNotice("")}><AlertCircle size={16}/>{notice}<X size={15}/></button>}

      {tab === "Today" && <div className="v3-page">
        <section className="v3-welcome"><div><span className="v3-kicker">YOUR DAILY EXECUTION SPACE</span><h2>One clear step at a time.</h2><p>Focus on what matters, then let consistency compound.</p><label className="v31-hours">Available hours today <input type="number" min="1" max="16" value={availableHours} onChange={e => setAvailableHours(e.target.value)}/></label><button onClick={makeDailyPlan} disabled={planBusy}><Sparkles size={16}/>{planBusy ? "Building your plan…" : "Build my AI plan"}<ArrowRight size={15}/></button></div><div className="v3-welcome-mark"><Target size={42}/></div></section>
        <section className="v3-metrics">
          <article><span><CheckCircle2/></span><small>TASKS COMPLETED</small><b>{doneTasks.length}<em> / {data.tasks.length}</em></b><p>{openTasks.length} still open</p></article>
          <article><span><Flame/></span><small>HABIT CONSISTENCY</small><b>{habitRate}%</b><p>{completedHabits} of {data.habits.length} today</p></article>
          <article><span><Clock3/></span><small>FOCUS TIME TODAY</small><b>{focusToday}<em> min</em></b><p>{data.focusSessions.filter(s => s.date === today()).length} sessions</p></article>
          <article><span><Target/></span><small>GOAL PROGRESS</small><b>{goalProgress}%</b><p>{activeGoals.length} active goals</p></article>
        </section>
        {plan && <section className="v3-panel v3-plan"><div className="v3-panel-heading"><div><span className="v3-kicker">YOUR AI GENERATED PLAN</span><h3>Today's game plan</h3></div><button className="v3-icon-button" onClick={() => setPlan("")}><X size={16}/></button></div><div className="v3-ai-text"><FormattedAIText text={plan} /></div></section>}
        <div className="v3-two-col">
          <section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">DO THE IMPORTANT THINGS FIRST</span><h3>Today's priorities</h3></div><button className="v3-text-button" onClick={() => setTab("Tasks")}>All tasks <ArrowRight size={14}/></button></div>
            {todayTasks.slice(0,5).map(t => <div className="v3-task-row" key={t.id}><button className="v3-check" onClick={() => toggleTask(t.id)}><Circle size={18}/></button><div className="v3-task-main"><b>{t.title}</b><small>{t.priority || "P2"} priority · {fmtDate(t.dueDate)}</small></div><span className={"v3-priority " + (t.priority || "Medium").toLowerCase()}>{t.priority || "P2"}</span></div>)}
            {!todayTasks.length && <div className="v3-empty">Nothing urgent is waiting. Add a task or enjoy the breathing room.</div>}
            <button className="v3-add-inline" onClick={() => setTab("Tasks")}><Plus size={15}/> Add a task</button>
          </section>
          <section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">SMALL ACTIONS, REPEATED</span><h3>Daily habits</h3></div><button className="v3-text-button" onClick={() => setTab("Habits")}>Manage <ArrowRight size={14}/></button></div>
            {data.habits.slice(0,6).map(h => <div className="v3-habit-row" key={h.id}><button className={"v3-check " + (todayLog.includes(h.id) ? "checked" : "")} onClick={() => toggleHabit(h.id)}>{todayLog.includes(h.id) ? <Check size={15}/> : <Circle size={18}/>}</button><b className={todayLog.includes(h.id) ? "is-done" : ""}>{h.title}</b><small>+10 XP</small></div>)}
            {!data.habits.length && <div className="v3-empty">Add a small daily habit to build consistency.</div>}
          </section>
        </div>
        <div className="v3-two-col">
          <section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">LONG TERM DIRECTION</span><h3>Goals in motion</h3></div><button className="v3-text-button" onClick={() => setTab("Goals")}>View goals <ArrowRight size={14}/></button></div>
            {activeGoals.slice(0,4).map(g => <div className="v3-goal-line" key={g.id}><div><b>{g.title}</b><strong>{g.progress || 0}%</strong></div><div className="v3-progress"><i style={{ width: (g.progress || 0) + "%" }}/></div></div>)}
            {!activeGoals.length && <div className="v3-empty">Create a goal and break it into milestones.</div>}
          </section>
          <section className="v3-panel v3-review-card"><div className="v3-panel-heading"><div><span className="v3-kicker">CLOSE THE LOOP</span><h3>Daily review</h3></div><Sparkles size={19}/></div><p>Take two minutes to understand what worked and choose a better starting point for tomorrow.</p><button onClick={() => makeReview("daily")} disabled={reviewBusy}><RefreshCw size={15}/>{reviewBusy ? "Preparing review…" : "Generate my daily review"}</button>{review && <div className="v3-ai-text v3-review-text"><FormattedAIText text={review} /></div>}</section>
        </div>
      </div>}

      {tab === "Tasks" && <div className="v3-page"><section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">CAPTURE, PRIORITISE, EXECUTE</span><h3>Your tasks</h3></div><span className="v3-count">{openTasks.length} open</span></div>
        <form className="v3-form v3-task-form" onSubmit={addTask}><input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="What needs to get done?" required/><select value={taskPriority} onChange={e => setTaskPriority(e.target.value)}><option value="P1">P1, Urgent and important</option><option value="P2">P2, Important</option><option value="P3">P3, Urgent but less important</option><option value="P4">P4, Optional</option></select><input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)}/><input type="number" min="5" step="5" value={taskEstimate} onChange={e => setTaskEstimate(e.target.value)} placeholder="Minutes" aria-label="Estimated minutes"/><input type="date" value={taskScheduledDate} onChange={e => setTaskScheduledDate(e.target.value)} aria-label="Scheduled date"/><input type="time" value={taskScheduledTime} onChange={e => setTaskScheduledTime(e.target.value)} aria-label="Scheduled time"/><select value={taskGoal} onChange={e => setTaskGoal(e.target.value)}><option value="">No linked goal</option>{data.goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select><button type="submit"><Plus size={16}/> Add task</button></form>
        <div className="v31-priority-grid">{[["P1","Urgent and important"],["P2","Important, plan it"],["P3","Urgent, delegate or simplify"],["P4","Optional, do later"]].map(([priority,label]) => <div key={priority}><b>{priority}</b><span>{label}</span><strong>{openTasks.filter(t => (t.priority || "P2") === priority).length}</strong></div>)}</div>
        <div className="v3-task-list">{[...openTasks].sort((a,b) => priorityRank[a.priority || "Medium"] - priorityRank[b.priority || "Medium"] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999")).map(t => <div className="v3-task-row" key={t.id}><button className="v3-check" onClick={() => toggleTask(t.id)}><Circle size={18}/></button><div className="v3-task-main"><b>{t.title}</b><small>{t.goalId ? data.goals.find(g => g.id === t.goalId)?.title || "Linked goal" : "Independent task"} · {fmtDate(t.dueDate)} · {t.estimate || 30} min</small></div><span className={"v3-priority " + (t.priority || "P2").toLowerCase()}>{t.priority || "P2"}</span><button className="v3-icon-button danger" onClick={() => deleteTask(t.id)} aria-label="Delete task"><Trash2 size={15}/></button></div>)}
        {!openTasks.length && <div className="v3-empty">Your task list is clear. Add a task when something needs your attention.</div>}</div>
        <details className="v3-completed"><summary>Completed tasks ({doneTasks.length}) <ChevronDown size={15}/></summary>{doneTasks.map(t => <div className="v3-task-row" key={t.id}><button className="v3-check checked" onClick={() => toggleTask(t.id)}><Check size={15}/></button><div className="v3-task-main"><b className="is-done">{t.title}</b><small>Completed {t.completedAt || ""}</small></div><button className="v3-icon-button danger" onClick={() => deleteTask(t.id)}><Trash2 size={15}/></button></div>)}</details>
      </section></div>}

      {tab === "Goals" && <div className="v3-page"><section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">TURN AMBITION INTO NEXT ACTIONS</span><h3>Your goals</h3></div><span className="v3-count">{activeGoals.length} active</span></div><form className="v3-form v3-goal-form" onSubmit={addGoal}><input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="What do you want to achieve?" required/><input type="date" value={goalDeadline} onChange={e => setGoalDeadline(e.target.value)}/><button type="submit"><Plus size={16}/> Create goal</button></form>
        <div className="v3-goal-grid">{data.goals.map(g => <article className="v3-goal-card" key={g.id}><div className="v3-goal-card-head"><span><Flag size={16}/>{g.deadline ? "Target " + fmtDate(g.deadline) : "Long term goal"}</span><button className="v3-icon-button danger" onClick={() => deleteGoal(g.id)} aria-label="Delete goal"><Trash2 size={15}/></button></div><h4>{g.title}</h4><div className="v3-goal-progress-label"><span>Progress</span><b>{g.progress || 0}%</b></div><div className="v3-progress"><i style={{ width: (g.progress || 0) + "%" }}/></div><div className="v3-milestones"><div className="v31-milestone-heading"><b>Milestones</b><button type="button" onClick={() => generateMilestones(g)} disabled={milestoneBusy === String(g.id)}>{milestoneBusy === String(g.id) ? "Generating..." : "Generate with AI"}</button></div>{(g.milestones || []).map(m => <label key={m.id} className="v3-milestone"><input type="checkbox" checked={!!m.done} onChange={() => toggleMilestone(g.id,m.id)}/><span className={m.done ? "is-done" : ""}>{m.title}</span><button type="button" onClick={() => update(d => ({ ...d, goals: d.goals.map(x => x.id === g.id ? { ...x, milestones: x.milestones.filter(y => y.id !== m.id), progress: x.milestones.length > 1 ? Math.round(x.milestones.filter(y => y.id !== m.id && y.done).length / (x.milestones.length - 1) * 100) : 0 } : x) }))}><X size={13}/></button></label>)}<form className="v3-milestone-form" onSubmit={e => { e.preventDefault(); addMilestone(g.id); }}><input value={milestoneInputs[g.id] || ""} onChange={e => setMilestoneInputs(s => ({ ...s, [g.id]: e.target.value }))} placeholder="Add a milestone"/><button type="submit"><Plus size={14}/></button></form></div><div className="v3-linked-count">{data.tasks.filter(t => t.goalId === g.id).length} linked tasks</div></article>)}</div>
        {!data.goals.length && <div className="v3-empty">Create your first goal, then add milestones that show what progress looks like.</div>}</section></div>}


      {tab === "Calendar" && <div className="v3-page"><section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">PLAN YOUR TIME</span><h3>Calendar and time blocks</h3></div><button className="v3-text-button" onClick={rescheduleOverdue}>Reschedule overdue</button></div><div className="v31-calendar-toolbar"><label>Choose date <input type="date" value={calendarDate} onChange={e => setCalendarDate(e.target.value)}/></label><span>{data.tasks.filter(t => t.status !== "done" && (t.scheduledDate || t.dueDate) === calendarDate).length} tasks planned</span></div>{data.tasks.filter(t => t.status !== "done" && (t.scheduledDate || t.dueDate) === calendarDate).sort((a,b) => (a.scheduledTime || "99:99").localeCompare(b.scheduledTime || "99:99")).map(t => <div className="v3-task-row" key={t.id}><button className="v3-check" onClick={() => toggleTask(t.id)}><Circle size={18}/></button><div className="v3-task-main"><b>{t.title}</b><small>{t.scheduledTime || "Time not set"} · {t.estimate || 30} minutes · Due {fmtDate(t.dueDate)}</small></div><span className={"v3-priority " + (t.priority || "P2").toLowerCase()}>{t.priority || "P2"}</span></div>)}{!data.tasks.some(t => t.status !== "done" && (t.scheduledDate || t.dueDate) === calendarDate) && <div className="v3-empty">No tasks are scheduled for this date. Add a task and choose its date and time.</div>}</section></div>}
      {tab === "Habits" && <div className="v3-page"><section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">CONSISTENCY OVER PERFECTION</span><h3>Your habits</h3></div><span className="v3-count">{completedHabits}/{data.habits.length} today</span></div><form className="v3-form v3-habit-form" onSubmit={addHabit}><input value={habitTitle} onChange={e => setHabitTitle(e.target.value)} placeholder="Add a daily habit..." required/><button type="submit"><Plus size={16}/> Add habit</button></form>{data.habits.map(h => <div className="v3-task-row" key={h.id}><button className={"v3-check " + (todayLog.includes(h.id) ? "checked" : "")} onClick={() => toggleHabit(h.id)}>{todayLog.includes(h.id) ? <Check size={15}/> : <Circle size={18}/>}</button><div className="v3-task-main"><b className={todayLog.includes(h.id) ? "is-done" : ""}>{h.title}</b><small>{(data.habitLog || {})[today()]?.includes(h.id) ? "Completed today" : "Ready when you are"}</small></div><button className="v3-icon-button danger" onClick={() => { if (window.confirm("Remove this habit? Past habit history will remain saved.")) update(d => ({ ...d, habits: d.habits.filter(x => x.id !== h.id) })); }}><Trash2 size={15}/></button></div>)}
        {!data.habits.length && <div className="v3-empty">Start with one habit that supports a goal you care about.</div>}</section></div>}

      {tab === "Focus" && <div className="v3-page v3-focus-page"><section className="v3-focus-card"><span className="v3-kicker">PROTECT YOUR ATTENTION</span><h2>{focusRunning ? "Stay with this task." : "Make space for deep work."}</h2><div className="v3-timer">{elapsed}</div><p>{focusRunning ? "Your focus session is running. Keep this time for one thing." : "Choose a task, put distractions aside and begin."}</p><select value={focusTask} onChange={e => setFocusTask(e.target.value)} disabled={focusRunning}><option value="">Choose a task (optional)</option>{openTasks.map(t => <option key={t.id} value={t.title}>{t.title}</option>)}</select><div className="v3-focus-actions">{!focusRunning ? <button onClick={() => setFocusRunning(true)}><Timer size={17}/> Start focus</button> : <><button onClick={finishFocus}><Check size={17}/> Finish and save</button><button className="secondary" onClick={cancelFocus}>Discard</button></>}</div><small>Focus time is tracked only while the timer is running.</small></section><div className="v3-focus-stats"><article><Clock3/><span>Today</span><b>{focusToday} min</b></article><article><Activity/><span>Last 7 days</span><b>{last7Focus} min</b></article><article><Trophy/><span>XP earned</span><b>{data.xp}</b></article></div><section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">YOUR RECENT SESSIONS</span><h3>Focus history</h3></div></div>{[...data.focusSessions].reverse().slice(0,10).map(s => <div className="v3-task-row" key={s.id}><span className="v3-session-icon"><Timer size={16}/></span><div className="v3-task-main"><b>{s.task}</b><small>{fmtDate(s.date)}</small></div><strong>{s.minutes} min</strong></div>)}{!data.focusSessions.length && <div className="v3-empty">Your completed focus sessions will appear here.</div>}</section></div>}

      {tab === "Insights" && <div className="v3-page"><section className="v3-metrics v3-insight-metrics"><article><span><CheckCircle2/></span><small>TASK COMPLETION</small><b>{data.tasks.length ? Math.round(doneTasks.length/data.tasks.length*100) : 0}%</b><p>{doneTasks.length} of {data.tasks.length} tasks</p></article><article><span><Flame/></span><small>HABIT RATE TODAY</small><b>{habitRate}%</b><p>{completedHabits} habits complete</p></article><article><span><Clock3/></span><small>FOCUS LAST 7 DAYS</small><b>{last7Focus}<em> min</em></b><p>Tracked focus time</p></article><article><span><Target/></span><small>GOAL PROGRESS</small><b>{goalProgress}%</b><p>{data.goals.length} goals tracked</p></article></section><section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">RECENT CONSISTENCY</span><h3>Habit activity, last 7 days</h3></div></div><div className="v3-week-bars">{last7.map(d => <div key={d.key}><div className="v3-bar"><i style={{ height: (data.habits.length ? d.count / data.habits.length * 100 : 0) + "%" }}/></div><b>{d.count}</b><small>{d.label}</small></div>)}</div></section><div className="v3-two-col"><section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">ACCOUNTABILITY</span><h3>Weekly review</h3></div></div><p className="v3-muted">Look at what moved forward, what slipped and what deserves attention next week.</p><button className="v3-primary" onClick={() => makeReview("weekly")} disabled={reviewBusy}><Sparkles size={15}/>{reviewBusy ? "Preparing…" : "Generate weekly review"}</button>{review && <div className="v3-ai-text v3-review-text">{review}</div>}</section><section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">WHAT NEEDS ATTENTION</span><h3>Execution signals</h3></div></div><p>{highTasks.length} high priority tasks are still open.</p><p>{activeGoals.filter(g => g.deadline && g.deadline < today()).length} active goals have passed their target date.</p><p>{data.tasks.filter(t => t.status !== "done" && t.dueDate && t.dueDate < today()).length} tasks are overdue.</p></section></div></div>}

      {tab === "AI Coach" && <div className="v3-page v3-coach-page"><section className="v3-coach-intro"><div className="v3-coach-icon"><Bot size={26}/></div><div><span className="v3-kicker">YOUR PERSONAL EXECUTION COACH</span><h2>Think clearly. Choose the next step.</h2><p>Your coach can use your current tasks, goals, habits and focus history as context.</p></div></section><section className="v3-chat-panel"><div className="v3-chat-messages">{chat.map((m,i) => <div className={"v3-chat-message " + m.role} key={i}><span>{m.role === "assistant" ? <Bot size={15}/> : "You"}</span><div className="v3-chat-message-content"><FormattedAIText text={m.text} /></div></div>)}{chatBusy && <div className="v3-chat-message assistant"><span><Bot size={15}/></span><p>Thinking…</p></div>}<div ref={chatEnd}/></div><form className="v3-chat-composer" onSubmit={e => { e.preventDefault(); sendChat(); }}><button type="button" onClick={startVoice} title="Voice input"><Mic size={17}/></button><input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={voiceOn ? "Listening…" : "Ask about your goals, tasks or today's plan…"}/><button type="submit" disabled={!chatInput.trim() || chatBusy}><Send size={17}/></button></form><div className="v3-chat-suggestions">{["What should I focus on today?","Break my biggest goal into milestones","Review my unfinished tasks","Help me plan a realistic week"].map(s => <button key={s} onClick={() => sendChat(s)}>{s}</button>)}</div></section></div>}
      <footer className="v3-footer">LevelUp V3.1 <span>Plan with purpose. Execute with focus.</span></footer>
    </main>
  </div>;
}
