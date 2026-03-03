import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  Trophy, 
  Skull, 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Zap,
  Settings,
  BarChart3,
  LayoutDashboard,
  Sword,
  Filter,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';

interface Task {
  id: number;
  name: string;
  weight: number;
  status: number;
  deadline: string;
}

interface LogEntry {
  date: string;
  task_id: number;
  name: string;
  status: number;
  completion_time: string | null;
  deadline: string;
}

interface RPItem {
  id: number;
  type: 'Reward' | 'Punishment';
  content: string;
}

interface TrendData {
  date: string;
  score: number;
}

interface TaskStat {
  name: string;
  consistency: number;
}

export default function App() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [score, setScore] = useState(0);
  const [rpItems, setRpItems] = useState<RPItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<'daily' | 'analytics'>('daily');
  
  // Advanced Analytics State
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string[]>(['On-Time', 'Delayed', 'Not Done']);
  
  const [bossHP, setBossHP] = useState(0);
  const [filteredTrend, setFilteredTrend] = useState<TrendData[]>([]);
  const [distribution, setDistribution] = useState<{label: string, value: number}[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStat[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [editingLog, setEditingLog] = useState<{date: string, task_id: number} | null>(null);

  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskWeight, setNewTaskWeight] = useState(1);
  const [newTaskDeadline, setNewTaskDeadline] = useState('23:59');
  const [newRPContent, setNewRPContent] = useState('');
  const [newRPType, setNewRPType] = useState<'Reward' | 'Punishment'>('Reward');
  const [verdict, setVerdict] = useState<{ type: 'victory' | 'defeat' | 'neutral', message: string, item?: string } | null>(null);

  useEffect(() => {
    fetchDailyData();
    fetchRPItems();
    if (view === 'analytics') {
      fetchAdvancedAnalytics();
      fetchLogs();
    }
  }, [date, view, startDate, endDate, selectedTaskId]);

  const fetchAdvancedAnalytics = async () => {
    try {
      const bossRes = await fetch('/api/analytics/monthly-boss');
      const bossData = await bossRes.json();
      setBossHP(bossData.boss_hp);

      const filteredRes = await fetch(`/api/analytics/filtered?startDate=${startDate}&endDate=${endDate}&taskId=${selectedTaskId}`);
      const filteredData = await filteredRes.json();
      setFilteredTrend(filteredData.trend);
      setDistribution(filteredData.distribution);

      const statsRes = await fetch('/api/analytics/task-stats');
      const statsData = await statsRes.json();
      setTaskStats(statsData);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/logs?startDate=${startDate}&endDate=${endDate}&taskId=${selectedTaskId}`);
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  };

  const updateLog = async (log: LogEntry, newStatus: number, newTime: string | null) => {
    try {
      await fetch('/api/logs/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date: log.date, 
          task_id: log.task_id, 
          status: newStatus, 
          completion_time: newTime 
        })
      });
      setEditingLog(null);
      fetchLogs();
      fetchAdvancedAnalytics();
    } catch (error) {
      console.error("Failed to update log:", error);
    }
  };

  const getConsistencyStatus = (score: number) => {
    if (score >= 90) return { label: 'Legendary Status', color: 'text-quest-accent' };
    if (score >= 70) return { label: 'Elite Warrior', color: 'text-blue-400' };
    if (score >= 50) return { label: 'Steady Progress', color: 'text-orange-400' };
    return { label: 'Training Required', color: 'text-quest-danger' };
  };

  const avgScore = filteredTrend.length > 0 
    ? Math.round(filteredTrend.reduce((acc, curr) => acc + curr.score, 0) / filteredTrend.length) 
    : 0;
  
  const consistency = getConsistencyStatus(avgScore);

  const handleFinishDay = () => {
    let type: 'victory' | 'defeat' | 'neutral' = 'neutral';
    let message = "The day is done, but the journey continues. Aim higher tomorrow.";
    let item = undefined;

    if (score >= 80) {
      type = 'victory';
      message = "QUEST COMPLETE! You have proven your discipline.";
      const rewards = rpItems.filter(i => i.type === 'Reward');
      if (rewards.length > 0) {
        item = rewards[Math.floor(Math.random() * rewards.length)].content;
      }
    } else if (score < 50) {
      type = 'defeat';
      message = "QUEST FAILED. Your resolve wavered today.";
      const punishments = rpItems.filter(i => i.type === 'Punishment');
      if (punishments.length > 0) {
        item = punishments[Math.floor(Math.random() * punishments.length)].content;
      }
    }

    setVerdict({ type, message, item });
  };

  const fetchDailyData = async () => {
    try {
      const tasksRes = await fetch(`/api/daily/${date}`);
      const tasksData = await tasksRes.json();
      setTasks(tasksData);

      const scoreRes = await fetch(`/api/score/${date}`);
      const scoreData = await scoreRes.json();
      setScore(scoreData.score);
    } catch (error) {
      console.error("Failed to fetch daily data:", error);
    }
  };

  const fetchRPItems = async () => {
    try {
      const res = await fetch('/api/rewards-punishments');
      const data = await res.json();
      setRpItems(data);
    } catch (error) {
      console.error("Failed to fetch RP items:", error);
    }
  };

  const toggleTask = async (taskId: number, currentStatus: number) => {
    try {
      const newStatus = currentStatus === 1 ? 0 : 1;
      await fetch('/api/daily/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, task_id: taskId, status: newStatus })
      });
      fetchDailyData();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName) return;
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTaskName, weight: newTaskWeight })
      });
      setNewTaskName('');
      setNewTaskWeight(1);
      fetchDailyData();
    } catch (error) {
      console.error("Failed to add task:", error);
    }
  };

  const deleteTask = async (id: number) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchDailyData();
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const addRPItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRPContent) return;
    try {
      await fetch('/api/rewards-punishments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newRPType, content: newRPContent })
      });
      setNewRPContent('');
      fetchRPItems();
    } catch (error) {
      console.error("Failed to add RP item:", error);
    }
  };

  const deleteRPItem = async (id: number) => {
    try {
      await fetch(`/api/rewards-punishments/${id}`, { method: 'DELETE' });
      fetchRPItems();
    } catch (error) {
      console.error("Failed to delete RP item:", error);
    }
  };

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
        <div className="flex items-center gap-3">
          <div className="bg-quest-accent p-3 rounded-xl quest-glow">
            <Zap className="text-quest-bg w-8 h-8" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tighter uppercase italic">QuestLog</h1>
            <p className="text-slate-400 text-sm font-mono uppercase tracking-widest">Daily Habit Protocol</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-quest-card p-2 rounded-2xl quest-border">
          <button 
            onClick={() => setView('daily')}
            className={`p-2 px-4 rounded-xl transition-all flex items-center gap-2 text-sm font-bold uppercase italic ${view === 'daily' ? 'bg-quest-accent text-quest-bg' : 'text-slate-400 hover:text-white'}`}
          >
            <LayoutDashboard className="w-4 h-4" /> Daily
          </button>
          <button 
            onClick={() => setView('analytics')}
            className={`p-2 px-4 rounded-xl transition-all flex items-center gap-2 text-sm font-bold uppercase italic ${view === 'analytics' ? 'bg-quest-accent text-quest-bg' : 'text-slate-400 hover:text-white'}`}
          >
            <BarChart3 className="w-4 h-4" /> Stats
          </button>
        </div>

        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`p-3 rounded-xl transition-all ${showSettings ? 'bg-quest-accent text-quest-bg' : 'bg-quest-card quest-border text-slate-400 hover:text-white'}`}
        >
          <Settings className="w-6 h-6" />
        </button>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {view === 'daily' ? (
          <>
            {/* Progress Section */}
            <section className="lg:col-span-12 mb-4">
              <div className="bg-quest-card p-8 rounded-3xl quest-border relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="text-center md:text-left">
                    <h2 className="text-sm font-mono uppercase tracking-[0.3em] text-slate-500 mb-2">Daily Completion</h2>
                    <div className="text-7xl font-bold italic tracking-tighter flex items-baseline gap-2">
                      {score}<span className="text-2xl text-quest-accent">%</span>
                    </div>
                    
                    {/* Date Selector moved here for Daily view */}
                    <div className="flex items-center gap-4 bg-slate-900/50 p-1 rounded-xl mt-4 w-fit">
                      <button onClick={() => changeDate(-1)} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-mono text-xs font-bold px-2">{date}</span>
                      <button onClick={() => changeDate(1)} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 w-full max-w-md">
                    <div className="h-4 bg-slate-800 rounded-full overflow-hidden quest-border">
                      <motion.div 
                        className="h-full bg-quest-accent quest-glow"
                        initial={{ width: 0 }}
                        animate={{ width: `${score}%` }}
                        transition={{ type: 'spring', bounce: 0, duration: 1 }}
                      />
                    </div>
                    <div className="flex justify-between mt-3 text-xs font-mono text-slate-500 uppercase tracking-widest">
                      <span>Novice</span>
                      <span>Master</span>
                    </div>
                    
                    <button 
                      onClick={handleFinishDay}
                      className="w-full mt-6 bg-white text-quest-bg font-bold py-3 rounded-xl hover:bg-quest-accent hover:text-quest-bg transition-all uppercase tracking-widest text-sm italic"
                    >
                      End My Day
                    </button>
                  </div>
                </div>
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-quest-accent/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              </div>
            </section>

            {/* Verdict Modal */}
            <AnimatePresence>
              {verdict && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="lg:col-span-12 z-30"
                >
                  <div className={`p-8 rounded-3xl border-2 flex flex-col md:flex-row items-center justify-between gap-6 ${
                    verdict.type === 'victory' ? 'bg-quest-accent/20 border-quest-accent' : 
                    verdict.type === 'defeat' ? 'bg-quest-danger/20 border-quest-danger' : 
                    'bg-slate-800 border-slate-600'
                  }`}>
                    <div className="flex items-center gap-6">
                      <div className={`p-4 rounded-2xl ${
                        verdict.type === 'victory' ? 'bg-quest-accent text-quest-bg' : 
                        verdict.type === 'defeat' ? 'bg-quest-danger text-white' : 
                        'bg-slate-700 text-slate-300'
                      }`}>
                        {verdict.type === 'victory' ? <Trophy className="w-10 h-10" /> : 
                         verdict.type === 'defeat' ? <Skull className="w-10 h-10" /> : 
                         <Zap className="w-10 h-10" />}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold uppercase italic">{verdict.message}</h3>
                        {verdict.item && (
                          <p className="mt-2 text-lg">
                            <span className="font-mono text-xs uppercase tracking-widest opacity-60 block mb-1">
                              {verdict.type === 'victory' ? 'Your Reward' : 'Your Penance'}
                            </span>
                            <span className="font-bold text-white underline decoration-2 underline-offset-4">
                              {verdict.item}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => setVerdict(null)}
                      className="px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-mono text-xs uppercase tracking-widest transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tasks List */}
            <section className="lg:col-span-7">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold uppercase italic tracking-tight">Active Quests</h3>
                <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-full text-slate-400">
                  {tasks.filter(t => t.status === 1).length} / {tasks.length}
                </span>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {tasks.map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => toggleTask(task.id, task.status)}
                      className={`group cursor-pointer p-5 rounded-2xl quest-border transition-all flex items-center justify-between ${
                        task.status === 1 
                          ? 'bg-quest-accent/10 border-quest-accent/30' 
                          : 'bg-quest-card hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`transition-transform duration-300 ${task.status === 1 ? 'scale-110 text-quest-accent' : 'text-slate-600'}`}>
                          {task.status === 1 ? <CheckCircle2 className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
                        </div>
                        <div>
                          <p className={`font-semibold text-lg transition-all ${task.status === 1 ? 'line-through text-slate-500' : ''}`}>
                            {task.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">Weight</span>
                            <div className="flex gap-1">
                              {[...Array(task.weight)].map((_, i) => (
                                <div key={i} className={`w-1.5 h-1.5 rounded-full ${task.status === 1 ? 'bg-quest-accent/50' : 'bg-slate-600'}`} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {showSettings && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                          className="p-2 text-slate-600 hover:text-quest-danger transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {tasks.length === 0 && (
                  <div className="text-center py-12 bg-quest-card/50 rounded-3xl border border-dashed border-slate-700">
                    <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">No quests assigned</p>
                  </div>
                )}
              </div>
            </section>

            {/* Rewards & Punishments */}
            <section className="lg:col-span-5 space-y-8">
              {/* Rewards */}
              <div>
                <div className="flex items-center gap-2 mb-4 text-quest-accent">
                  <Trophy className="w-5 h-5" />
                  <h3 className="text-sm font-mono uppercase tracking-[0.2em]">Rewards Pool</h3>
                </div>
                <div className="space-y-2">
                  {rpItems.filter(i => i.type === 'Reward').map(item => (
                    <div key={item.id} className="bg-quest-card p-4 rounded-xl quest-border flex justify-between items-center group">
                      <span className="text-sm">{item.content}</span>
                      {showSettings && (
                        <button onClick={() => deleteRPItem(item.id)} className="text-slate-600 hover:text-quest-danger opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Punishments */}
              <div>
                <div className="flex items-center gap-2 mb-4 text-quest-danger">
                  <Skull className="w-5 h-5" />
                  <h3 className="text-sm font-mono uppercase tracking-[0.2em]">Punishment Pool</h3>
                </div>
                <div className="space-y-2">
                  {rpItems.filter(i => i.type === 'Punishment').map(item => (
                    <div key={item.id} className="bg-quest-card p-4 rounded-xl quest-border flex justify-between items-center group">
                      <span className="text-sm">{item.content}</span>
                      {showSettings && (
                        <button onClick={() => deleteRPItem(item.id)} className="text-slate-600 hover:text-quest-danger opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Analytics Dashboard */}
            <section className="lg:col-span-12 space-y-8">
              {/* Filter Bar */}
              <div className="bg-quest-card p-6 rounded-3xl quest-border flex flex-wrap items-end gap-6">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-2 flex items-center gap-2">
                    <Filter className="w-3 h-3" /> Date Range
                  </label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-slate-900 quest-border rounded-lg p-2 text-xs w-full focus:outline-none focus:border-quest-accent"
                    />
                    <span className="text-slate-600">to</span>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-slate-900 quest-border rounded-lg p-2 text-xs w-full focus:outline-none focus:border-quest-accent"
                    />
                  </div>
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-2">Task Filter</label>
                  <select 
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full bg-slate-900 quest-border rounded-lg p-2 text-xs focus:outline-none focus:border-quest-accent"
                  >
                    <option value="all">All Tasks</option>
                    {taskStats.map(t => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-6 bg-slate-900/50 p-4 rounded-2xl quest-border">
                  <div className="text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Consistency XP</span>
                    <p className={`text-xl font-bold italic ${consistency.color}`}>{avgScore}%</p>
                  </div>
                  <div className="h-8 w-[1px] bg-slate-800" />
                  <div className="text-center">
                    <span className="text-[10px] font-mono uppercase text-slate-500 block mb-1">Rank</span>
                    <p className="text-sm font-bold uppercase tracking-tight text-white">{consistency.label}</p>
                  </div>
                </div>
              </div>

              {/* Monthly Boss Bar */}
              <div className="bg-quest-card p-8 rounded-3xl quest-border relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-sm font-mono uppercase tracking-[0.3em] text-slate-500 mb-1">Monthly Boss</h3>
                      <p className="text-2xl font-bold italic uppercase tracking-tight flex items-center gap-2">
                        <Sword className="w-6 h-6 text-quest-danger" /> General Discipline
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono uppercase text-slate-500">Boss HP</span>
                      <p className="text-3xl font-bold text-quest-danger italic">{100 - bossHP}%</p>
                    </div>
                  </div>
                  
                  <div className="h-6 bg-slate-900 rounded-full overflow-hidden border-2 border-slate-800 p-1">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-quest-danger to-orange-500 rounded-full"
                      initial={{ width: '100%' }}
                      animate={{ width: `${100 - bossHP}%` }}
                      transition={{ type: 'spring', bounce: 0, duration: 1.5 }}
                    />
                  </div>
                </div>
                <div className="absolute top-0 left-0 w-full h-full bg-quest-danger/5 pointer-events-none" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Trend Chart */}
                <div className="lg:col-span-2 bg-quest-card p-6 rounded-3xl quest-border">
                  <h3 className="text-sm font-mono uppercase tracking-[0.2em] text-slate-500 mb-6">Progress Over Time</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={filteredTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#475569" 
                          fontSize={10} 
                          tickFormatter={(str) => str.split('-').slice(1).join('/')}
                        />
                        <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#10b981" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: '#10b981' }}
                          activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Status Distribution */}
                <div className="bg-quest-card p-6 rounded-3xl quest-border">
                  <h3 className="text-sm font-mono uppercase tracking-[0.2em] text-slate-500 mb-6">Status Distribution</h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          nameKey="label"
                        >
                          {distribution.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.label === 'On-Time' ? '#10b981' : entry.label === 'Delayed' ? '#f59e0b' : '#ef4444'} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Editable Log Table */}
              <div className="bg-quest-card rounded-3xl quest-border overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                  <h3 className="text-sm font-mono uppercase tracking-[0.2em] text-slate-500">Raw Quest Logs</h3>
                  <span className="text-[10px] font-mono text-slate-600 uppercase">Interactive Data Editor</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 text-[10px] font-mono uppercase tracking-widest text-slate-500">
                        <th className="p-4 border-b border-white/5">Date</th>
                        <th className="p-4 border-b border-white/5">Quest</th>
                        <th className="p-4 border-b border-white/5">Deadline</th>
                        <th className="p-4 border-b border-white/5">Completion</th>
                        <th className="p-4 border-b border-white/5">Status</th>
                        <th className="p-4 border-b border-white/5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {logs.map((log) => {
                        const isEditing = editingLog?.date === log.date && editingLog?.task_id === log.task_id;
                        const status = log.status === 0 ? 'Not Done' : (log.completion_time! <= log.deadline ? 'On-Time' : 'Delayed');
                        
                        return (
                          <tr key={`${log.date}-${log.task_id}`} className="hover:bg-white/5 transition-colors border-b border-white/5">
                            <td className="p-4 font-mono text-xs">{log.date}</td>
                            <td className="p-4 font-bold">{log.name}</td>
                            <td className="p-4 font-mono text-xs text-slate-500">{log.deadline}</td>
                            <td className="p-4">
                              {isEditing ? (
                                <input 
                                  type="time" 
                                  defaultValue={log.completion_time || ''}
                                  className="bg-slate-900 border border-quest-accent rounded p-1 text-xs focus:outline-none"
                                  onBlur={(e) => updateLog(log, 1, e.target.value)}
                                />
                              ) : (
                                <span className="font-mono text-xs">{log.completion_time || '--:--'}</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                                status === 'On-Time' ? 'bg-quest-accent/20 text-quest-accent' : 
                                status === 'Delayed' ? 'bg-orange-500/20 text-orange-500' : 
                                'bg-quest-danger/20 text-quest-danger'
                              }`}>
                                {status}
                              </span>
                            </td>
                            <td className="p-4">
                              {isEditing ? (
                                <button onClick={() => setEditingLog(null)} className="text-slate-500 hover:text-white">
                                  <X className="w-4 h-4" />
                                </button>
                              ) : (
                                <button onClick={() => setEditingLog({date: log.date, task_id: log.task_id})} className="text-slate-500 hover:text-quest-accent">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Settings Modal / Drawer */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-quest-card border-l border-white/10 p-8 z-50 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-2xl font-bold italic uppercase tracking-tight">Master Config</h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>

              <div className="space-y-12">
                {/* Add Habit */}
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-4">Add Recurring Habit</h4>
                  <form onSubmit={addTask} className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="Habit Name" 
                      value={newTaskName}
                      onChange={(e) => setNewTaskName(e.target.value)}
                      className="w-full bg-slate-900 quest-border rounded-xl p-4 focus:outline-none focus:border-quest-accent transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Weight (1-5)</label>
                        <div className="flex items-center gap-3">
                          <input 
                            type="range" 
                            min="1" 
                            max="5" 
                            value={newTaskWeight}
                            onChange={(e) => setNewTaskWeight(parseInt(e.target.value))}
                            className="flex-1 accent-quest-accent"
                          />
                          <span className="bg-slate-900 w-8 h-8 flex items-center justify-center rounded-lg font-mono font-bold text-quest-accent text-xs">
                            {newTaskWeight}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono uppercase text-slate-500 block mb-2">Deadline</label>
                        <input 
                          type="time" 
                          value={newTaskDeadline}
                          onChange={(e) => setNewTaskDeadline(e.target.value)}
                          className="w-full bg-slate-900 quest-border rounded-xl p-2 text-sm focus:outline-none focus:border-quest-accent transition-colors"
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-quest-accent text-quest-bg font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
                      <Plus className="w-5 h-5" /> Initialize Habit
                    </button>
                  </form>
                </div>

                {/* Add Reward/Punishment */}
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-4">Add Reward / Punishment</h4>
                  <form onSubmit={addRPItem} className="space-y-4">
                    <div className="flex bg-slate-900 rounded-xl p-1 quest-border">
                      <button 
                        type="button"
                        onClick={() => setNewRPType('Reward')}
                        className={`flex-1 py-2 rounded-lg text-xs font-mono uppercase transition-all ${newRPType === 'Reward' ? 'bg-quest-accent text-quest-bg' : 'text-slate-500'}`}
                      >
                        Reward
                      </button>
                      <button 
                        type="button"
                        onClick={() => setNewRPType('Punishment')}
                        className={`flex-1 py-2 rounded-lg text-xs font-mono uppercase transition-all ${newRPType === 'Punishment' ? 'bg-quest-danger text-white' : 'text-slate-500'}`}
                      >
                        Punishment
                      </button>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Content (e.g. Eat Pizza)" 
                      value={newRPContent}
                      onChange={(e) => setNewRPContent(e.target.value)}
                      className="w-full bg-slate-900 quest-border rounded-xl p-4 focus:outline-none focus:border-quest-accent transition-colors"
                    />
                    <button type="submit" className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors">
                      <Plus className="w-5 h-5" /> Add to Pool
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-white/5">
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest text-center">
                  QuestLog v1.0.0 // System Operational
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
