export type Status='inbox'|'todo'|'doing'|'done'|'archived';export type Priority='low'|'medium'|'high'|'urgent';
export interface Task {id:string;title:string;description:string;status:Status;priority:Priority;due?:string;/** time of day for `due`, "HH:MM" (24h); optional */time?:string;start?:string;estimate:number;actual:number;companyId?:string;projectId?:string;tags:string[];subtasks:{id:string;title:string;done:boolean}[];recurring?:string;notes:string;completedAt?:string;createdAt:string;updatedAt:string}
export interface Company{id:string;name:string;color:string;createdAt:string}
export interface Project{id:string;name:string;description:string;companyId:string;status:'active'|'paused'|'done';priority:Priority;start?:string;deadline?:string;budget:number;income:number;progress:number;notes:string;milestones:string[];createdAt:string}
export interface Event{id:string;title:string;date:string;start:string;end:string;kind:'work'|'personal'|'reminder';taskId?:string;createdAt:string}
export interface Transaction{id:string;title:string;amount:number;type:'income'|'expense'|'debt';date:string;category:string;companyId?:string;projectId?:string;notes:string;recurring:boolean;paid:boolean;createdAt:string}
export interface Note{id:string;title:string;body:string;category:string;tags:string[];pinned:boolean;projectId?:string;taskId?:string;createdAt:string;updatedAt:string}
export interface Habit{id:string;title:string;target:number;unit:string;color:string;entries:Record<string,number>}
export interface HealthLog{id:string;date:string;sleep:number;energy:number;mood:number;water:number;meals:number;exercise:number;notes:string}
export type Theme='midnight'|'black'|'blue'|'crimson'|'light';
export type WishCategory='purchase'|'movie'|'series'|'anime'|'course'|'book'|'game'|'experience'|'other';
export type WishStatus='wanted'|'planned'|'doing'|'done'|'dropped';
/** All fields after `progress` are optional so older data and backups stay valid. */
export interface WishItem{id:string;title:string;category:WishCategory;status:WishStatus;priority:Priority;notes:string;url?:string;price?:number;progress:number;tags:string[];createdAt:string;completedAt?:string;
/** Poster: a downscaled data:image URL (uploaded) or an https URL. */cover?:string;
season?:number;/** units finished so far (episodes / pages / lessons / hours) */current?:number;total?:number;
/** money already put aside for a purchase */saved?:number;/** 1..5, only meaningful once done */rating?:number;
linkedTrackId?:string;boughtTransactionId?:string}
export interface LearningLog{id:string;date:string;minutes:number;topic:string;notes:string;keyPoints:string[];ideas:string[];resource?:string;kind?:string;createdAt:string}
export interface LearningTrack{id:string;title:string;description:string;color:string;status:'active'|'paused'|'mastered';goalHours:number;tags:string[];resources:{id:string;title:string;url?:string;done:boolean}[];logs:LearningLog[];createdAt:string}
export interface Settings{theme:Theme;currency:string;monthlyIncomeGoal:number;workStart:string;workEnd:string;personalHours:number;notifications:boolean;aiEndpoint:string;aiProvider:'mock'|'local';weekStartsSaturday:boolean;petName:string;petEnabled:boolean;/** pixel-pet arcade: best scores, meat spent on feeding, unused extra-life buffs, runs played */arcade?:{best:Record<string,number>;meatSpent:number;buffs:number;plays:number;/** coins won in arcade runs */coins?:number};/** pet shop: coins spent, owned item ids, equipped skin/accessories/room */shop?:{spent:number;owned:string[];skin:string;acc:{head?:string;face?:string;neck?:string};room:string};holidayFix?:Record<string,number>;/** alert ids the user has marked as read (pruned to the newest ~150) */dismissedAlerts?:string[];/** minutes before a timed task that its alarm rings (default 10) */taskLead?:number;/** beep with the in-app alarm (default on) */alarmSound?:boolean;ntfy?:NtfyConfig}
export interface TimeEntry{id:string;taskId:string;date:string;minutes:number;createdAt:string}
export interface ActiveTimer{kind:'task'|'learning';refId:string;label:string;startedAt:string}
/** Spaced-repetition state, keyed by LearningLog id. `due` is a local YYYY-MM-DD date. */
export interface ReviewState{due:string;interval:number;reps:number}
/** One journal page per day (keyed by `date`). Empty pages are never stored. */
export interface Intention{id:string;text:string;done:boolean;taskId?:string}
export interface DailyLog{id:string;date:string;intentions:Intention[];wins:string;improve:string;gratitude:string;note:string;createdAt:string;updatedAt:string}
/** Automation: when <trigger> happens, do <actions>. Evaluated locally while the app is open. */
export type AutoTrigger=
 |{kind:'overdue';days:number}
 |{kind:'done';tag?:string}
 |{kind:'daily';time:string}
 |{kind:'weekly';weekday:number;time:string}
 |{kind:'habit_missed';days:number}
 |{kind:'spend';category:string;amount:number};
export type AutoAction=
 |{kind:'priority';to:Priority}
 |{kind:'tag';tag:string}
 |{kind:'reschedule';to:'today'|'tomorrow'}
 |{kind:'create_task';title:string;due:'today'|'tomorrow'|'none';priority:Priority}
 |{kind:'notify';title:string;body?:string};
export interface Automation{id:string;name:string;enabled:boolean;trigger:AutoTrigger;actions:AutoAction[];createdAt:string}
/** The ledger: one row per (rule, subject) that already fired, so nothing ever fires twice for the same thing. */
export interface AutomationRun{id:string;ruleId:string;ruleName:string;key:string;at:string;summary:string}
/** Messages produced by "notify" actions; shown in the bell. */
export interface Notice{id:string;at:string;title:string;body?:string;page:'tasks'|'health'|'finance'|'dashboard';ruleId:string}
export interface DB{automations:Automation[];automationRuns:AutomationRun[];notices:Notice[];journal:DailyLog[];timeEntries:TimeEntry[];reviews:Record<string,ReviewState>;timer:ActiveTimer|null;tasks:Task[];companies:Company[];projects:Project[];events:Event[];transactions:Transaction[];notes:Note[];habits:Habit[];health:HealthLog[];wishes:WishItem[];learning:LearningTrack[];settings:Settings}

export interface NtfyConfig{enabled:boolean;server:string;topic:string;token:string;digest:boolean;digestTime:string;events:boolean;eventLead:number;evening:boolean;eveningTime:string;weeklyReview:boolean;showTitles:boolean}
