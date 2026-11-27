import React, { useMemo } from "react";
import { Activity, Brain, CalendarClock, CheckCircle2, Clock3, History, Target, TrendingUp, Undo2, Zap } from "lucide-react";
import { ensureV32History, getGoalForecasts, getWeeklyIntelligence } from "./v32-intelligence";

export default function V32IntelligencePanel({ data, onBalance, onUndo }) {
 const history=ensureV32History(data);
 const weekly=useMemo(()=>getWeeklyIntelligence(history),[history]);
 const forecasts=useMemo(()=>getGoalForecasts(history),[history]);
 const events=[...history.activityEvents].reverse().slice(0,12);
 const completed=history.activityEvents.filter(e=>e.type==="task_completed").length;
 const missed=history.activityEvents.filter(e=>e.type==="missed_schedule").length;
 const rescheduled=history.activityEvents.filter(e=>["task_rescheduled","automatic_reschedule","workload_balanced"].includes(e.type)).length;
 const focus=history.taskTimeLogs.reduce((n,x)=>n+Number(x.minutes||0),0);
 const maxDone=Math.max(1,...weekly.map(x=>x.completed)),maxFocus=Math.max(1,...weekly.map(x=>x.focusMinutes));
 const label=type=>({task_created:"Task created",task_completed:"Task completed",task_reopened:"Task reopened",task_rescheduled:"Task rescheduled",task_deleted:"Task deleted",habit_completed:"Habit completed",focus_session_completed:"Focus session saved",missed_schedule:"Missed schedule",automatic_reschedule:"Conflict resolved",workload_balanced:"Workload balanced",goal_progress_changed:"Goal updated",schedule_undo:"Schedule changes undone",distraction:"Distraction recorded"}[type]||type.replaceAll("_"," "));
 return <div className="v3-page v32-intelligence">
  <section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">YOUR PERSONAL LEARNING SYSTEM</span><h3>Performance intelligence</h3></div><Brain size={20}/></div>
   <p className="v3-muted">LevelUp records activity inside the app and uses this history to improve planning. It does not monitor other applications.</p>
   <div className="v32-intel-metrics">
    <article><CheckCircle2/><small>Tasks completed</small><b>{completed}</b></article><article><CalendarClock/><small>Missed schedules</small><b>{missed}</b></article><article><TrendingUp/><small>Schedule changes</small><b>{rescheduled}</b></article><article><Clock3/><small>Focus minutes</small><b>{focus}</b></article><article><Activity/><small>Distractions logged</small><b>{history.distractionEvents.length}</b></article><article><History/><small>History records</small><b>{history.activityEvents.length}</b></article>
   </div>
  </section>
  <section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">AUTOMATIC SCHEDULING</span><h3>Balance your workload</h3></div><Zap size={19}/></div>
   <p className="v3-muted">Schedule unscheduled and overdue tasks across upcoming working days, considering priority, estimates and existing time blocks.</p>
   <div className="v32-intel-actions"><button className="v3-primary" onClick={onBalance}>Automatically balance my workload</button><button className="v3-secondary" onClick={onUndo} disabled={!history.scheduleUndoStack.length}><Undo2 size={14}/> Undo last schedule change</button></div>
   <small className="v32-intel-note">New overlapping time blocks are resolved automatically. Locked tasks are left unchanged.</small>
  </section>
  <section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">LAST SEVEN DAYS</span><h3>Weekly performance trends</h3></div><TrendingUp size={19}/></div>
   <div className="v32-weekly-trends">{weekly.map(day=><div key={day.date}><b>{day.label}</b><div className="v32-trend-track"><i style={{height:(day.completed/maxDone*100)+"%"}}/></div><small>{day.completed} done</small><div className="v32-focus-track"><i style={{width:(day.focusMinutes/maxFocus*100)+"%"}}/></div><small>{day.focusMinutes} focus min</small><small>{day.missed} missed, {day.distractions} distractions</small></div>)}</div>
  </section>
  <section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">GOAL FORECASTS</span><h3>Predicted completion</h3></div><Target size={19}/></div>
   {forecasts.length?forecasts.map(goal=><div className="v32-forecast" key={goal.id}><div><b>{goal.title}</b><span>{goal.progress||0}% complete</span></div><div className="v3-progress"><i style={{width:(goal.progress||0)+"%"}}/></div><small>{goal.health}. Estimated completion: {goal.forecast==="Not enough history"?"More progress history needed":goal.forecast==="Completed"?"Already completed":goal.forecast}.</small></div>):<div className="v3-empty">Add a goal to see its forecast.</div>}
  </section>
  <section className="v3-panel"><div className="v3-panel-heading"><div><span className="v3-kicker">RECENT ACTIVITY</span><h3>Learning history</h3></div><History size={19}/></div>
   {events.length?<div className="v32-history-list">{events.map(item=><div key={item.id}><span>{label(item.type)}</span><b>{item.title||item.task||"Activity"}</b><small>{new Date(item.at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</small></div>)}</div>:<div className="v3-empty">Activity history will appear here as you use LevelUp.</div>}
  </section>
 </div>;
}
