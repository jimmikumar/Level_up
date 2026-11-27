const makeId = () => String(Date.now()) + "-" + Math.random().toString(36).slice(2, 9);
const dayKey = (date = new Date()) => { const d = new Date(date); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); };
const rank = { P1:0, P2:1, P3:2, P4:3, High:0, Medium:1, Low:2 };
const makeEvent = (type, details = {}) => ({ id:makeId(), type, at:new Date().toISOString(), ...details });

export function ensureV32History(value = {}) {
 return { ...value, activityEvents:Array.isArray(value.activityEvents)?value.activityEvents:[], taskTimeLogs:Array.isArray(value.taskTimeLogs)?value.taskTimeLogs:[], scheduleUndoStack:Array.isArray(value.scheduleUndoStack)?value.scheduleUndoStack:[], aiPlanHistory:Array.isArray(value.aiPlanHistory)?value.aiPlanHistory:[], goalProgressHistory:Array.isArray(value.goalProgressHistory)?value.goalProgressHistory:[], distractionEvents:Array.isArray(value.distractionEvents)?value.distractionEvents:[], missedScheduleKeys:Array.isArray(value.missedScheduleKeys)?value.missedScheduleKeys:[], settings:{...(value.settings||{}),availableHours:Number(value.settings?.availableHours)||8} };
}

function findFreeTime(tasks,date,requestedTime,duration,settings) {
 const end=540+Math.max(1,Math.min(16,Number(settings?.availableHours)||8))*60;
 const blocks=tasks.filter(t=>t.status!=="done"&&t.scheduledDate===date&&t.scheduledTime).map(t=>{const [h,m]=t.scheduledTime.split(":").map(Number);return [h*60+m,h*60+m+(Number(t.estimate)||30)];}).sort((a,b)=>a[0]-b[0]);
 const [h,m]=(requestedTime||"09:00").split(":").map(Number);let start=Math.max(540,(Number(h)||9)*60+(Number(m)||0));
 while(start+duration<=end){const overlap=blocks.find(([a,b])=>start<b&&start+duration>a);if(!overlap)return String(Math.floor(start/60)).padStart(2,"0")+":"+String(start%60).padStart(2,"0");start=Math.ceil(overlap[1]/15)*15;}return null;
}

function resolveNewConflicts(previous,next) {
 const before=new Map((previous.tasks||[]).map(t=>[String(t.id),t]));
 const changed=(next.tasks||[]).some(t=>{const old=before.get(String(t.id));return t.status!=="done"&&t.scheduledDate&&t.scheduledTime&&(!old||old.scheduledDate!==t.scheduledDate||old.scheduledTime!==t.scheduledTime);});
 if(!changed)return next;
 let tasks=[...(next.tasks||[])],moved=[];
 const dates=[...new Set(tasks.filter(t=>t.status!=="done"&&t.scheduledDate&&t.scheduledTime).map(t=>t.scheduledDate))];
 for(const date of dates){
  const day=tasks.filter(t=>t.status!=="done"&&t.scheduledDate===date&&t.scheduledTime).sort((a,b)=>(rank[a.priority||"P2"]-rank[b.priority||"P2"])||a.scheduledTime.localeCompare(b.scheduledTime));
  const accepted=[];
  for(const task of day){
   const [h,m]=task.scheduledTime.split(":").map(Number),start=h*60+m,duration=Number(task.estimate)||30;
   const conflict=accepted.some(other=>{const [oh,om]=other.scheduledTime.split(":").map(Number),os=oh*60+om;return start<os+(Number(other.estimate)||30)&&start+duration>os;});
   if(!conflict||task.scheduleLocked){accepted.push(task);continue;}
   let dateNext=date,timeNext=findFreeTime(accepted,date,task.scheduledTime,duration,next.settings);
   if(!timeNext){const tomorrow=new Date(date+"T12:00:00");tomorrow.setDate(tomorrow.getDate()+1);dateNext=dayKey(tomorrow);timeNext=findFreeTime(tasks,dateNext,"09:00",duration,next.settings);}
   if(timeNext){const revised={...task,previousScheduledDate:task.previousScheduledDate||task.scheduledDate,previousScheduledTime:task.previousScheduledTime||task.scheduledTime,scheduledDate:dateNext,scheduledTime:timeNext};tasks=tasks.map(t=>String(t.id)===String(task.id)?revised:t);moved.push({taskId:task.id,title:task.title,fromDate:task.scheduledDate,fromTime:task.scheduledTime,toDate:dateNext,toTime:timeNext});accepted.push(revised);}else accepted.push(task);
  }
 }
 if(!moved.length)return next;
 return {...next,tasks,scheduleUndoStack:[...next.scheduleUndoStack,{id:makeId(),at:new Date().toISOString(),changes:moved.map(m=>({taskId:m.taskId,scheduledDate:m.fromDate,scheduledTime:m.fromTime}))}],activityEvents:[...next.activityEvents,...moved.map(m=>makeEvent("automatic_reschedule",m))]};
}

export function trackV32Changes(previousValue,nextValue) {
 const previous=ensureV32History(previousValue);let next=ensureV32History(nextValue),events=[];
 const oldTasks=new Map((previous.tasks||[]).map(t=>[String(t.id),t])),newTasks=new Map((next.tasks||[]).map(t=>[String(t.id),t]));
 for(const task of next.tasks||[]){
  const old=oldTasks.get(String(task.id));
  if(!old)events.push(makeEvent("task_created",{taskId:task.id,title:task.title,priority:task.priority||"P2"}));
  else{
   if(old.status!=="done"&&task.status==="done")events.push(makeEvent("task_completed",{taskId:task.id,title:task.title,plannedMinutes:Number(task.estimate)||30,dueDate:task.dueDate||""}));
   if(old.status==="done"&&task.status!=="done")events.push(makeEvent("task_reopened",{taskId:task.id,title:task.title}));
   if((old.scheduledDate||"")!==(task.scheduledDate||"")||(old.scheduledTime||"")!==(task.scheduledTime||""))events.push(makeEvent("task_rescheduled",{taskId:task.id,title:task.title,fromDate:old.scheduledDate||"",fromTime:old.scheduledTime||"",toDate:task.scheduledDate||"",toTime:task.scheduledTime||""}));
   if((old.dueDate||"")!==(task.dueDate||""))events.push(makeEvent("task_deadline_changed",{taskId:task.id,title:task.title,from:old.dueDate||"",to:task.dueDate||""}));
  }
 }
 for(const task of previous.tasks||[])if(!newTasks.has(String(task.id)))events.push(makeEvent("task_deleted",{taskId:task.id,title:task.title}));
 const oldHabits=new Set(previous.habitLog?.[dayKey()]||[]),newHabits=new Set(next.habitLog?.[dayKey()]||[]);
 for(const id of newHabits)if(!oldHabits.has(id))events.push(makeEvent("habit_completed",{habitId:id,title:next.habits?.find(h=>String(h.id)===String(id))?.title||"Habit"}));
 for(const id of oldHabits)if(!newHabits.has(id))events.push(makeEvent("habit_reopened",{habitId:id}));
 const oldGoals=new Map((previous.goals||[]).map(g=>[String(g.id),g]));
 for(const goal of next.goals||[]){const old=oldGoals.get(String(goal.id));if(old&&Number(old.progress||0)!==Number(goal.progress||0)){events.push(makeEvent("goal_progress_changed",{goalId:goal.id,title:goal.title,from:Number(old.progress||0),to:Number(goal.progress||0)}));next.goalProgressHistory=[...next.goalProgressHistory,{id:makeId(),goalId:goal.id,progress:Number(goal.progress||0),at:new Date().toISOString()}];}else if(!old)next.goalProgressHistory=[...next.goalProgressHistory,{id:makeId(),goalId:goal.id,progress:Number(goal.progress||0),at:new Date().toISOString()}];}
 const newSessions=(next.focusSessions||[]).filter(s=>!(previous.focusSessions||[]).some(old=>String(old.id)===String(s.id)));
 for(const session of newSessions){const task=(next.tasks||[]).find(t=>t.title===session.task);next.taskTimeLogs=[...next.taskTimeLogs,{id:makeId(),taskId:task?.id||null,task:session.task,minutes:Number(session.minutes)||0,date:session.date||dayKey(),at:session.createdAt||new Date().toISOString()}];events.push(makeEvent("focus_session_completed",{taskId:task?.id||null,task:session.task,minutes:Number(session.minutes)||0}));}
 for(const [date,plan] of Object.entries(next.dailyPlans||{}))if(plan&&plan!==(previous.dailyPlans||{})[date])next.aiPlanHistory=[...next.aiPlanHistory,{id:makeId(),date,plan,createdAt:new Date().toISOString()}];
 next.activityEvents=[...next.activityEvents,...events];return resolveNewConflicts(previous,next);
}

export function detectMissedSchedules(value,now=new Date()){
 const data=ensureV32History(value),known=new Set(data.missedScheduleKeys),missed=[];
 for(const task of data.tasks||[]){if(task.status==="done"||!task.scheduledDate||!task.scheduledTime)continue;const key=String(task.id)+":"+task.scheduledDate+":"+task.scheduledTime,scheduled=new Date(task.scheduledDate+"T"+task.scheduledTime+":00");if(scheduled<now&&!known.has(key)){known.add(key);missed.push(makeEvent("missed_schedule",{taskId:task.id,title:task.title,scheduledDate:task.scheduledDate,scheduledTime:task.scheduledTime}));}}
 return missed.length?{...data,missedScheduleKeys:[...known],activityEvents:[...data.activityEvents,...missed]}:data;
}

export function autoBalanceWorkload(value){
 const data=ensureV32History(value),tasks=[...ensureV32History(value).tasks],candidates=tasks.filter(t=>t.status!=="done"&&(!t.scheduledDate||t.scheduledDate<dayKey()));
 if(!candidates.length)return {data,moved:0};
 const snapshot=candidates.map(t=>({taskId:t.id,scheduledDate:t.scheduledDate||"",scheduledTime:t.scheduledTime||""}));
 const fixed=tasks.filter(t=>t.status!=="done"&&t.scheduledDate&&t.scheduledTime&&!candidates.some(c=>String(c.id)===String(t.id)));
 const hours=Math.max(1,Math.min(16,Number(data.settings.availableHours)||8)),startDay=540,endDay=540+hours*60;
 candidates.sort((a,b)=>(rank[a.priority||"P2"]-rank[b.priority||"P2"])||(a.dueDate||"9999").localeCompare(b.dueDate||"9999"));
 let date=new Date();date.setDate(date.getDate()+1);let cursor=startDay;const assignments=new Map();
 for(const task of candidates){const duration=Math.max(15,Number(task.estimate)||30);let placed=false;for(let tries=0;tries<60&&!placed;tries++){const key=dayKey(date);if(cursor+duration>endDay){date.setDate(date.getDate()+1);cursor=startDay;continue;}const overlap=fixed.some(t=>{if(t.scheduledDate!==key||!t.scheduledTime)return false;const [h,m]=t.scheduledTime.split(":").map(Number),s=h*60+m;return cursor<s+(Number(t.estimate)||30)&&cursor+duration>s;});if(!overlap){assignments.set(String(task.id),{scheduledDate:key,scheduledTime:String(Math.floor(cursor/60)).padStart(2,"0")+":"+String(cursor%60).padStart(2,"0"),previousScheduledDate:task.scheduledDate||"",previousScheduledTime:task.scheduledTime||""});cursor+=duration+15;placed=true;}else cursor+=15;}}
 if(!assignments.size)return {data,moved:0};
 return {moved:assignments.size,data:{...data,tasks:tasks.map(t=>assignments.has(String(t.id))?{...t,...assignments.get(String(t.id))}:t),scheduleUndoStack:[...data.scheduleUndoStack,{id:makeId(),at:new Date().toISOString(),changes:[...assignments.keys()].map(id=>snapshot.find(s=>String(s.taskId)===id))}],activityEvents:[...data.activityEvents,...[...assignments.entries()].map(([taskId,info])=>makeEvent("workload_balanced",{taskId,...info}))]}};
}

export function undoSchedule(value){
 const data=ensureV32History(value),last=data.scheduleUndoStack[data.scheduleUndoStack.length-1];if(!last)return data;
 const restore=new Map(last.changes.map(item=>[String(item.taskId),item]));
 return {...data,tasks:data.tasks.map(task=>{const old=restore.get(String(task.id));return old?{...task,scheduledDate:old.scheduledDate||"",scheduledTime:old.scheduledTime||""}:task;}),scheduleUndoStack:data.scheduleUndoStack.slice(0,-1),activityEvents:[...data.activityEvents,makeEvent("schedule_undo",{changes:last.changes.length})]};
}

export function getGoalForecasts(value,now=new Date()){
 const data=ensureV32History(value);
 return data.goals.map(goal=>{
  const progress=Math.max(0,Math.min(100,Number(goal.progress)||0));if(progress>=100)return {...goal,forecast:"Completed",health:"Complete"};
  const history=data.goalProgressHistory.filter(x=>String(x.goalId)===String(goal.id)).sort((a,b)=>new Date(a.at)-new Date(b.at)),recent=history.filter(x=>new Date(x.at)>=new Date(now.getTime()-30*86400000));
  let rate=0;if(recent.length>=2){const first=recent[0],last=recent[recent.length-1],days=Math.max(1,(new Date(last.at)-new Date(first.at))/86400000);rate=Math.max(0,(Number(last.progress)-Number(first.progress))/days);}
  const days=rate>0?Math.ceil((100-progress)/rate):null,forecast=days===null?null:new Date(now.getTime()+days*86400000),deadline=goal.deadline?new Date(goal.deadline+"T23:59:59"):null;
  return {...goal,forecast:forecast?dayKey(forecast):"Not enough history",health:!rate?(deadline&&deadline<now?"At risk":"Needs more data"):(deadline&&forecast>deadline?"At risk":"Progressing")};
 });
}

export function buildLearningContext(value){
 const data=ensureV32History(value),cutoff=new Date(Date.now()-30*86400000),events=data.activityEvents.filter(x=>new Date(x.at)>=cutoff),focus=data.taskTimeLogs.filter(x=>new Date(x.at)>=cutoff),average=focus.length?Math.round(focus.reduce((n,x)=>n+Number(x.minutes||0),0)/focus.length):null;
 return {period:"last 30 days",completedTasks:events.filter(x=>x.type==="task_completed").length,missedSchedules:events.filter(x=>x.type==="missed_schedule").length,reschedules:events.filter(x=>x.type==="task_rescheduled").length,focusSessions:focus.length,averageFocusSessionMinutes:average,currentOpenTasks:data.tasks.filter(t=>t.status!=="done").length,durationGuidance:average?"Recent focus sessions average about "+average+" minutes. Use this as a reference, not a guarantee.":"There is not enough duration history yet. Use task estimates cautiously.",note:"Only use recorded evidence. Missing records do not mean failure."};
}

export function getWeeklyIntelligence(value,now=new Date()){
 const data=ensureV32History(value);
 return Array.from({length:7},(_,i)=>{const date=new Date(now);date.setDate(date.getDate()-(6-i));const key=dayKey(date),events=data.activityEvents.filter(x=>dayKey(x.at)===key);return {date:key,label:date.toLocaleDateString("en-IN",{weekday:"short"}),completed:events.filter(x=>x.type==="task_completed").length,missed:events.filter(x=>x.type==="missed_schedule").length,focusMinutes:data.taskTimeLogs.filter(x=>x.date===key).reduce((n,x)=>n+Number(x.minutes||0),0),distractions:data.distractionEvents.filter(x=>dayKey(x.at)===key).length};});
}
