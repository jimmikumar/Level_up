import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import {
  Activity, BookOpen, BriefcaseBusiness, Building2, CalendarDays, Check,
  CheckCircle2, ChevronRight, Circle, Flame, Goal, LayoutDashboard,
  ListTodo, Moon, Plus, Settings, Sun, Target, Trophy, Wallet,
  Dumbbell, Heart, Sparkles, Trash2, X, Zap
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

const CATEGORIES = [
  { name: "Health and fitness", icon: Dumbbell, color: "#22c55e" },
  { name: "Learning", icon: BookOpen, color: "#8b5cf6" },
  { name: "Work and productivity", icon: BriefcaseBusiness, color: "#3b82f6" },
  { name: "Business development", icon: Building2, color: "#f59e0b" },
  { name: "Personal development", icon: Heart, color: "#ec4899" },
  { name: "My goals", icon: Goal, color: "#06b6d4" }
];

const initialHabits = [
  { id: 1, title: "Morning walk or workout", category: "Health and fitness", xp: 10, frequency: "Daily", done: false },
  { id: 2, title: "Read or learn something new", category: "Learning", xp: 10, frequency: "Daily", done: false },
  { id: 3, title: "Focused deep work session", category: "Work and productivity", xp: 10, frequency: "Daily", done: false },
  { id: 4, title: "Work on a startup idea", category: "Business development", xp: 10, frequency: "Daily", done: false },
  { id: 5, title: "Journal and reflect", category: "Personal development", xp: 10, frequency: "Daily", done: false }
];

const initialGoals = [
  { id: 1, title: "Build financial stability", category: "Finance", progress: 15, detail: "Track savings, investments and monthly targets" },
  { id: 2, title: "Make progress on startup", category: "Startup", progress: 10, detail: "Validate an idea and take one action each week" },
  { id: 3, title: "Grow YouTube presence", category: "YouTube", progress: 5, detail: "Plan, create and publish useful content" },
  { id: 4, title: "Build LinkedIn presence", category: "LinkedIn", progress: 20, detail: "Share ideas and build meaningful connections" }
];

const todayKey = () => new Date().toLocaleDateString("en-CA");

const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [syncStatus, setSyncStatus] = useState("Connecting...");
  const [syncError, setSyncError] = useState("");
  const importRef = useRef(null);

  const [theme, setTheme] = useState(() => read("levelup-theme", "dark"));
  const [tab, setTab] = useState("Overview");
  const [habits, setHabits] = useState(() => {
    const saved = read("levelup-habits", initialHabits);
    const lastDate = read("levelup-last-date", todayKey());
    return lastDate === todayKey() ? saved : saved.map(h => ({ ...h, done: false }));
  });
  const [goals, setGoals] = useState(() => read("levelup-goals", initialGoals));
  const [xp, setXp] = useState(() => read("levelup-xp", 0));
  const [history, setHistory] = useState(() => read("levelup-history", {}));
  const [showHabit, setShowHabit] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [habitName, setHabitName] = useState("");
  const [habitCategory, setHabitCategory] = useState(CATEGORIES[0].name);
  const [goalName, setGoalName] = useState("");
  const [goalCategory, setGoalCategory] = useState("Finance");
  const [note, setNote] = useState(() => read("levelup-note-" + todayKey(), ""));
  const [challengeDone, setChallengeDone] = useState(() => read("levelup-challenge-" + todayKey(), false));

  // Restore the signed in session and listen for login or logout events.
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Session check failed:", error.message);
      if (active) {
        setSession(data?.session ?? null);
        setAuthLoading(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setAuthLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load this user's saved progress from Supabase.
  // The first login also imports the existing browser data if no cloud record exists.
  useEffect(() => {
    let active = true;

    const loadProgress = async () => {
      if (!session?.user?.id) {
        setLoadedUserId(null);
        setSyncStatus("Not signed in");
        return;
      }

      const userId = session.user.id;
      setLoadedUserId(null);
      setSyncStatus("Loading your progress...");
      setSyncError("");

      const { data, error } = await supabase
        .from("user_progress")
        .select("progress")
        .eq("userid", userId)
        .maybeSingle();

      if (!active) return;

      if (error) {
        console.error("Could not load progress:", error);
        setSyncStatus("Sync problem");
        setSyncError(error.message);
        return;
      }

      if (data?.progress) {
        const saved = data.progress;
        const savedDate = saved.savedDate || todayKey();
        const habitsForToday = Array.isArray(saved.habits) ? saved.habits : initialHabits;
        setHabits(
          savedDate === todayKey()
            ? habitsForToday
            : habitsForToday.map(h => ({ ...h, done: false }))
        );
        setGoals(Array.isArray(saved.goals) ? saved.goals : initialGoals);
        setXp(Number(saved.xp) || 0);
        setHistory(saved.history && typeof saved.history === "object" ? saved.history : {});
        setTheme(saved.theme === "light" ? "light" : "dark");
        setNote(savedDate === todayKey() ? (saved.note || "") : "");
        setChallengeDone(savedDate === todayKey() ? Boolean(saved.challengeDone) : false);
      } else {
        // First cloud login: retain the data already stored in this browser.
        const localDate = read("levelup-last-date", todayKey());
        if (localDate !== todayKey()) {
          setHabits(current => current.map(h => ({ ...h, done: false })));
          setNote("");
          setChallengeDone(false);
        }
      }

      if (active) {
        setLoadedUserId(userId);
        setSyncStatus("Synced");
      }
    };

    loadProgress();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  // Keep the existing browser backup as a local fallback.
  useEffect(() => localStorage.setItem("levelup-theme", JSON.stringify(theme)), [theme]);
  useEffect(() => localStorage.setItem("levelup-habits", JSON.stringify(habits)), [habits]);
  useEffect(() => localStorage.setItem("levelup-last-date", JSON.stringify(todayKey())), []);
  useEffect(() => localStorage.setItem("levelup-goals", JSON.stringify(goals)), [goals]);
  useEffect(() => localStorage.setItem("levelup-xp", JSON.stringify(xp)), [xp]);
  useEffect(() => localStorage.setItem("levelup-history", JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem("levelup-note-" + todayKey(), JSON.stringify(note)), [note]);
  useEffect(() => localStorage.setItem("levelup-challenge-" + todayKey(), JSON.stringify(challengeDone)), [challengeDone]);

  // Save changes to the signed in user's Supabase row.
  // A short delay combines rapid changes into one database request.
  useEffect(() => {
    if (!session?.user?.id || loadedUserId !== session.user.id) return;

    setSyncStatus("Saving...");
    setSyncError("");

    const timer = window.setTimeout(async () => {
      const progress = {
        version: 1,
        savedDate: todayKey(),
        habits,
        goals,
        xp,
        history,
        theme,
        note,
        challengeDone
      };

      const { error } = await supabase
        .from("user_progress")
        .upsert(
          {
            userid: session.user.id,
            progress,
            updated_at: new Date().toISOString()
          },
          { onConflict: "userid" }
        );

      if (error) {
        console.error("Could not save progress:", error);
        setSyncStatus("Sync problem");
        setSyncError(error.message);
      } else {
        setSyncStatus("Synced");
        setSyncError("");
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [session?.user?.id, loadedUserId, habits, goals, xp, history, theme, note, challengeDone]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSyncError(error.message);
      setSyncStatus("Logout failed");
    }
  };

  const completed = habits.filter(h => h.done).length;
  const total = habits.length;
  const percent = total ? Math.round(completed / total * 100) : 0;
  const level = Math.floor(xp / 500) + 1;
  const levelXp = xp % 500;

  const streak = useMemo(() => {
    let count = 0;
    const date = new Date();
    for (let i = 0; i < 365; i++) {
      const key = date.toLocaleDateString("en-CA");
      const value = key === todayKey() ? completed > 0 : !!history[key];
      if (!value) break;
      count++;
      date.setDate(date.getDate() - 1);
    }
    return count;
  }, [history, completed]);

  const toggleHabit = (id) => {
    setHabits(current => current.map(h => {
      if (h.id !== id) return h;
      const next = !h.done;
      setXp(v => Math.max(0, v + (next ? h.xp : -h.xp)));
      setHistory(v => ({
        ...v,
        [todayKey()]: current.some(x => x.id === id ? next : x.done)
      }));
      return { ...h, done: next };
    }));
  };

  const addHabit = (e) => {
    e.preventDefault();
    if (!habitName.trim()) return;
    setHabits(v => [...v, {
      id: Date.now(),
      title: habitName.trim(),
      category: habitCategory,
      xp: 10,
      frequency: "Daily",
      done: false
    }]);
    setHabitName("");
    setShowHabit(false);
  };

  const addGoal = (e) => {
    e.preventDefault();
    if (!goalName.trim()) return;
    setGoals(v => [...v, {
      id: Date.now(),
      title: goalName.trim(),
      category: goalCategory,
      progress: 0,
      detail: "Your next milestone starts here"
    }]);
    setGoalName("");
    setShowGoal(false);
  };

  const updateGoal = (id, progress) => {
    setGoals(v => v.map(g => g.id === id
      ? { ...g, progress: Math.max(0, Math.min(100, Number(progress))) }
      : g
    ));
  };

  const exportBackup = () => {
    const backup = {
      app: "LevelUp",
      version: 1,
      exportedAt: new Date().toISOString(),
      habits, goals, xp, history, theme, note, challengeDone
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `levelup-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const backup = JSON.parse(await file.text());
      if (backup.app !== "LevelUp" || !Array.isArray(backup.habits) || !Array.isArray(backup.goals)) {
        throw new Error("This file is not a valid LevelUp backup.");
      }
      if (!window.confirm("Import this backup? Your current habits, goals and progress will be replaced.")) return;

      setHabits(backup.habits);
      setGoals(backup.goals);
      setXp(Number(backup.xp) || 0);
      setHistory(backup.history || {});
      if (backup.theme === "light" || backup.theme === "dark") setTheme(backup.theme);
      setNote(backup.note || "");
      setChallengeDone(Boolean(backup.challengeDone));
      alert("Backup restored. Your changes will sync to your account.");
    } catch (error) {
      alert(error.message || "Could not read this backup file.");
    } finally {
      event.target.value = "";
    }
  };

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = d.toLocaleDateString("en-CA");
      const value = key === todayKey() ? percent : (history[key] ? 100 : 0);
      return {
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        progress: value
      };
    });
  }, [history, percent]);

  const nav = [
    ["Overview", LayoutDashboard],
    ["Habits", ListTodo],
    ["My goals", Target],
    ["Achievements", Trophy],
    ["Insights", Activity],
    ["Settings", Settings]
  ];

  const pageTitle = tab === "Overview" ? "Your progress, one day at a time." : tab;
  const categoryMeta = (name) => CATEGORIES.find(c => c.name === name) || CATEGORIES[5];
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  if (authLoading) {
    return <div className="auth-loading">Loading LevelUp...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className={`app ${theme}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Zap size={20} fill="currentColor" /></div>
          <span>level<span className="brand-accent">up</span></span>
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav>
          {nav.map(([name, Icon]) => (
            <button
              key={name}
              className={`nav-item ${tab === name ? "active" : ""}`}
              onClick={() => setTab(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Habits" && <small>{completed}/{total}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="level-mini">
            <div className="level-mini-top"><span>YOUR LEVEL</span><b>LVL {level}</b></div>
            <div className="xp-track"><i style={{ width: `${levelXp / 5}%` }} /></div>
            <small>{levelXp} / 500 XP</small>
          </div>
          <button className="nav-item" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark"><Zap size={17} fill="currentColor" /></div>
            level<span className="brand-accent">up</span>
          </div>
          <div className="date-chip"><CalendarDays size={15} />{dateLabel}</div>
          <button className="theme-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">PERSONAL GROWTH TRACKER</div>
              <h1>{tab === "Overview" ? "Good to see you. 👋" : pageTitle}</h1>
              <p>{tab === "Overview" ? "Small actions today. Meaningful progress over time." : "Keep showing up. Your progress is adding up."}</p>
            </div>
            {tab === "Habits" && <button className="primary-btn" onClick={() => setShowHabit(true)}><Plus size={17} /> Add habit</button>}
            {tab === "My goals" && <button className="primary-btn" onClick={() => setShowGoal(true)}><Plus size={17} /> Add goal</button>}
          </div>

          {tab === "Overview" && <>
            <section className="hero-grid">
              <div className="hero-card">
                <div className="hero-glow" />
                <div className="hero-content">
                  <div className="eyebrow light">YOUR DAILY SCORE</div>
                  <div className="score-row">
                    <strong>{percent}<span>%</span></strong>
                    <div className="score-copy">
                      <b>{completed === total && total ? "All done. Great work!" : "Keep your momentum."}</b>
                      <small>{completed} of {total} habits completed today</small>
                    </div>
                  </div>
                  <div className="progress-line"><i style={{ width: `${percent}%` }} /></div>
                  <div className="hero-foot">
                    <span><CheckCircle2 size={14} /> {completed} completed</span>
                    <span>{total - completed} remaining</span>
                  </div>
                </div>
                <div className="hero-badge"><Sparkles size={16} /> DAILY PROGRESS</div>
              </div>

              <div className="stat-card xp-card">
                <div className="stat-icon purple"><Zap size={19} /></div>
                <span className="stat-label">TOTAL EXPERIENCE</span>
                <strong>{xp.toLocaleString()} <small>XP</small></strong>
                <div className="stat-bottom">Level {level} · {500 - levelXp} XP to next level</div>
                <div className="mini-track"><i style={{ width: `${levelXp / 5}%` }} /></div>
              </div>

              <div className="stat-card">
                <div className="stat-icon orange"><Flame size={19} /></div>
                <span className="stat-label">CURRENT STREAK</span>
                <strong>{streak} <small>days</small></strong>
                <div className="stat-bottom">Consistency is your superpower</div>
                <div className="streak-dots">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <span key={i} className={i < Math.min(streak, 7) ? "filled" : ""}>{d}</span>
                  ))}
                </div>
              </div>
            </section>

            <section className="section-grid">
              <div className="panel habits-panel">
                <div className="panel-head">
                  <div><h2>Today's habits</h2><p>Your daily actions earn you XP</p></div>
                  <button className="text-btn" onClick={() => setTab("Habits")}>View all <ChevronRight size={15} /></button>
                </div>
                <div className="habit-list">
                  {habits.slice(0, 5).map(h => {
                    const meta = categoryMeta(h.category);
                    const Icon = meta.icon;
                    return (
                      <div className={`habit-row ${h.done ? "is-done" : ""}`} key={h.id}>
                        <button className={`check-btn ${h.done ? "checked" : ""}`} onClick={() => toggleHabit(h.id)}>
                          {h.done ? <Check size={16} /> : <Circle size={17} />}
                        </button>
                        <div className="habit-icon" style={{ color: meta.color, background: meta.color + "18" }}><Icon size={17} /></div>
                        <div className="habit-info"><b>{h.title}</b><small>{h.category}</small></div>
                        <span className="xp-pill">+{h.xp} XP</span>
                      </div>
                    );
                  })}
                  {habits.length === 0 && <div className="empty">Add your first habit to get started.</div>}
                </div>
                <button className="add-inline" onClick={() => setShowHabit(true)}><Plus size={16} /> Add a habit</button>
              </div>

              <div className="right-stack">
                <div className="panel challenge-panel">
                  <div className="challenge-top">
                    <div className="challenge-icon"><Trophy size={20} /></div>
                    <span className="tag">DAILY CHALLENGE</span>
                  </div>
                  <h2>Make one move for your future</h2>
                  <p>Take one meaningful action toward a personal or business goal today.</p>
                  <button
                    className={`challenge-btn ${challengeDone ? "done" : ""}`}
                    onClick={() => {
                      if (!challengeDone) {
                        setChallengeDone(true);
                        setXp(v => v + 30);
                      }
                    }}
                  >
                    {challengeDone
                      ? <><Check size={16} /> Challenge completed</>
                      : <>Complete challenge <span>+30 XP</span></>}
                  </button>
                </div>

                <div className="panel note-panel">
                  <div className="panel-head">
                    <div><h2>Daily reflection</h2><p>What went well today?</p></div>
                    <span className="note-icon"><BookOpen size={17} /></span>
                  </div>
                  <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Write a quick note about your day..." />
                </div>
              </div>
            </section>

            <section className="panel goals-preview">
              <div className="panel-head">
                <div><h2>Long-term goals</h2><p>Progress beyond today's checklist</p></div>
                <button className="text-btn" onClick={() => setTab("My goals")}>All goals <ChevronRight size={15} /></button>
              </div>
              <div className="goal-grid">
                {goals.slice(0, 4).map(g => (
                  <div className="goal-mini" key={g.id}>
                    <div className="goal-mini-top"><span>{g.category}</span><b>{g.progress}%</b></div>
                    <strong>{g.title}</strong>
                    <div className="goal-track"><i style={{ width: `${g.progress}%` }} /></div>
                  </div>
                ))}
              </div>
            </section>
          </>}

          {tab === "Habits" && (
            <section className="panel full-panel">
              <div className="panel-head">
                <div><h2>Your habits</h2><p>Check off each habit as you complete it. Each one earns 10 XP.</p></div>
                <span className="count-pill">{completed} / {total} done</span>
              </div>
              <div className="habit-list large">
                {habits.map(h => {
                  const meta = categoryMeta(h.category);
                  const Icon = meta.icon;
                  return (
                    <div className={`habit-row ${h.done ? "is-done" : ""}`} key={h.id}>
                      <button className={`check-btn ${h.done ? "checked" : ""}`} onClick={() => toggleHabit(h.id)}>
                        {h.done ? <Check size={16} /> : <Circle size={17} />}
                      </button>
                      <div className="habit-icon" style={{ color: meta.color, background: meta.color + "18" }}><Icon size={17} /></div>
                      <div className="habit-info"><b>{h.title}</b><small>{h.category} · {h.frequency}</small></div>
                      <span className="xp-pill">+{h.xp} XP</span>
                      <button
                        className="icon-btn danger"
                        title="Delete habit"
                        onClick={() => {
                          if (h.done) setXp(v => Math.max(0, v - h.xp));
                          setHabits(v => v.filter(x => x.id !== h.id));
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {habits.length === 0 && <div className="empty">No habits yet. Add one to start earning XP.</div>}
            </section>
          )}

          {tab === "My goals" && (
            <section className="goal-page">
              <div className="goal-intro">
                <div className="goal-intro-icon"><Target size={22} /></div>
                <div><h2>Your bigger picture</h2><p>Track the outcomes you want to create, not just the tasks you complete.</p></div>
              </div>
              <div className="goal-cards">
                {goals.map(g => (
                  <div className="panel goal-card" key={g.id}>
                    <div className="goal-card-top">
                      <span className="goal-category">{g.category}</span>
                      <button className="icon-btn danger" onClick={() => setGoals(v => v.filter(x => x.id !== g.id))}><Trash2 size={16} /></button>
                    </div>
                    <h3>{g.title}</h3>
                    <p>{g.detail}</p>
                    <div className="goal-progress-label"><span>Progress</span><b>{g.progress}%</b></div>
                    <div className="goal-track big"><i style={{ width: `${g.progress}%` }} /></div>
                    <div className="goal-controls">
                      <button onClick={() => updateGoal(g.id, g.progress - 5)} disabled={g.progress <= 0}>−</button>
                      <input type="range" min="0" max="100" step="5" value={g.progress} onChange={e => updateGoal(g.id, e.target.value)} />
                      <button onClick={() => updateGoal(g.id, g.progress + 5)} disabled={g.progress >= 100}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              {goals.length === 0 && <div className="panel empty">Add a goal you want to make progress on.</div>}
            </section>
          )}

          {tab === "Settings" && (
            <section className="settings-grid">
              <div className="panel">
                <div className="panel-head">
                  <div><h2>Account and sync</h2><p>Your progress is linked to this account.</p></div>
                  <Wallet size={20} color="#a78bfa" />
                </div>
                <div className="setting-row">
                  <div>
                    <b>{session.user.email}</b>
                    <small>
                      {syncStatus === "Synced" ? "Your latest progress is saved to Supabase." : syncStatus}
                    </small>
                    {syncError && <small className="auth-message">{syncError}</small>}
                  </div>
                  <span className="tag">{syncStatus}</span>
                </div>
                <div className="setting-row">
                  <div><b>Log out</b><small>Sign out of your LevelUp account on this device.</small></div>
                  <button className="secondary-btn" onClick={handleLogout}>Log out</button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <div><h2>Data and backups</h2><p>Keep a downloadable copy of your progress.</p></div>
                  <Wallet size={20} color="#a78bfa" />
                </div>
                <div className="setting-row">
                  <div><b>Export your data</b><small>Download habits, goals, XP and history as a JSON backup.</small></div>
                  <button className="primary-btn" onClick={exportBackup}>Export backup</button>
                </div>
                <div className="setting-row">
                  <div><b>Restore a backup</b><small>Import a previous LevelUp JSON backup. This replaces current data.</small></div>
                  <button className="secondary-btn" onClick={() => importRef.current?.click()}>Import backup</button>
                  <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
                </div>
              </div>

              <div className="panel">
                <div className="panel-head"><div><h2>Appearance</h2><p>Choose how LevelUp looks.</p></div><Sparkles size={20} color="#a78bfa" /></div>
                <div className="setting-row">
                  <div><b>Theme</b><small>Switch between dark and light mode.</small></div>
                  <button className="secondary-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Switch to light" : "Switch to dark"}</button>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head"><div><h2>Privacy and hosting</h2><p>How your data is stored.</p></div></div>
                <p className="settings-copy">Your account progress is stored in Supabase and associated with your user account. A local browser copy is also kept as a fallback. Only your signed in account can access its progress.</p>
                <div className="privacy-tags"><span>Account based sync</span><span>Supabase database</span><span>JSON backup</span></div>
              </div>
            </section>
          )}

          {tab === "Achievements" && (
            <section className="achievement-grid">
              {[
                { icon: Flame, name: "Getting started", desc: "Complete your first habit", unlocked: xp >= 10 },
                { icon: Zap, name: "XP collector", desc: "Earn 100 XP", unlocked: xp >= 100 },
                { icon: CalendarDays, name: "Showing up", desc: "Build a 7 day streak", unlocked: streak >= 7 },
                { icon: Trophy, name: "Level up", desc: "Reach level 2", unlocked: level >= 2 },
                { icon: Target, name: "Goal setter", desc: "Create your first goal", unlocked: goals.length > 0 },
                { icon: Sparkles, name: "Daily champion", desc: "Complete all habits in a day", unlocked: total > 0 && completed === total }
              ].map(a => {
                const Icon = a.icon;
                return (
                  <div className={`panel achievement ${a.unlocked ? "unlocked" : ""}`} key={a.name}>
                    <div className="achievement-icon"><Icon size={23} /></div>
                    <div><b>{a.name}</b><p>{a.desc}</p></div>
                    <span className="achievement-status">{a.unlocked ? "UNLOCKED" : "LOCKED"}</span>
                  </div>
                );
              })}
            </section>
          )}

          {tab === "Insights" && <>
            <section className="insight-stats">
              <div className="stat-card"><span className="stat-label">HABITS TODAY</span><strong>{completed}/{total}</strong><div className="stat-bottom">Completed habits</div></div>
              <div className="stat-card"><span className="stat-label">TOTAL XP</span><strong>{xp.toLocaleString()}</strong><div className="stat-bottom">Experience earned</div></div>
              <div className="stat-card"><span className="stat-label">GOALS IN PROGRESS</span><strong>{goals.filter(g => g.progress > 0 && g.progress < 100).length}</strong><div className="stat-bottom">Active goals</div></div>
            </section>
            <section className="panel chart-panel">
              <div className="panel-head"><div><h2>Weekly consistency</h2><p>Daily habit completion over the last seven days</p></div><span className="tag">LAST 7 DAYS</span></div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={v => v + "%"} />
                    <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)" }} />
                    <Area type="monotone" dataKey="progress" stroke="#8b5cf6" strokeWidth={3} fill="url(#progressFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>}

          <footer>Built for progress, not perfection. <span>LevelUp v2.0</span></footer>
        </div>
      </main>

      {showHabit && (
        <div className="modal-backdrop" onClick={() => setShowHabit(false)}>
          <form className="modal" onSubmit={addHabit} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div><h2>Add a habit</h2><p>Small actions become big changes.</p></div>
              <button type="button" className="icon-btn" onClick={() => setShowHabit(false)}><X size={19} /></button>
            </div>
            <label>Habit name<input autoFocus value={habitName} onChange={e => setHabitName(e.target.value)} placeholder="e.g. Read for 20 minutes" required /></label>
            <label>Category<select value={habitCategory} onChange={e => setHabitCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowHabit(false)}>Cancel</button>
              <button className="primary-btn" type="submit"><Plus size={16} /> Create habit</button>
            </div>
          </form>
        </div>
      )}

      {showGoal && (
        <div className="modal-backdrop" onClick={() => setShowGoal(false)}>
          <form className="modal" onSubmit={addGoal} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div><h2>Add a goal</h2><p>Give your next milestone a name.</p></div>
              <button type="button" className="icon-btn" onClick={() => setShowGoal(false)}><X size={19} /></button>
            </div>
            <label>Goal name<input autoFocus value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="e.g. Publish my first video" required /></label>
            <label>Area<select value={goalCategory} onChange={e => setGoalCategory(e.target.value)}>{["Finance", "Startup", "YouTube", "LinkedIn", "Career", "Personal", "Other"].map(c => <option key={c}>{c}</option>)}</select></label>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowGoal(false)}>Cancel</button>
              <button className="primary-btn" type="submit"><Plus size={16} /> Create goal</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
