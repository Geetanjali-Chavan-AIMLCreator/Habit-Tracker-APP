import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const app = express();
const PORT = 3000;
const db = new Database("quest_log.db");

app.use(express.json());

// Initialize Database
function init_db() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      weight INTEGER DEFAULT 1,
      deadline TEXT DEFAULT '23:59'
    );

    CREATE TABLE IF NOT EXISTS daily_log (
      date TEXT NOT NULL,
      task_id INTEGER NOT NULL,
      status INTEGER DEFAULT 0,
      completion_time TEXT,
      PRIMARY KEY (date, task_id),
      FOREIGN KEY (task_id) REFERENCES tasks_master(id)
    );

    CREATE TABLE IF NOT EXISTS rewards_punishments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('Reward', 'Punishment')),
      content TEXT NOT NULL
    );
  `);

  // Seed some initial data if empty
  const tasksCount = db.prepare("SELECT COUNT(*) as count FROM tasks_master").get() as { count: number };
  if (tasksCount.count === 0) {
    const insertTask = db.prepare("INSERT INTO tasks_master (name, weight) VALUES (?, ?)");
    insertTask.run("Morning Meditation", 2);
    insertTask.run("Read 10 Pages", 1);
    insertTask.run("Workout", 3);
    insertTask.run("Code for 1 Hour", 3);
  }

  const rpCount = db.prepare("SELECT COUNT(*) as count FROM rewards_punishments").get() as { count: number };
  if (rpCount.count === 0) {
    const insertRP = db.prepare("INSERT INTO rewards_punishments (type, content) VALUES (?, ?)");
    insertRP.run("Reward", "Buy a new game");
    insertRP.run("Reward", "Eat at favorite restaurant");
    insertRP.run("Punishment", "No social media for 2 hours");
    insertRP.run("Punishment", "Do 20 extra pushups");
  }
}

init_db();

// API Routes
app.get("/api/tasks", (req, res) => {
  const tasks = db.prepare("SELECT * FROM tasks_master").all();
  res.json(tasks);
});

app.post("/api/tasks", (req, res) => {
  const { name, weight } = req.body;
  const info = db.prepare("INSERT INTO tasks_master (name, weight) VALUES (?, ?)").run(name, weight);
  res.json({ id: info.lastInsertRowid, name, weight });
});

app.delete("/api/tasks/:id", (req, res) => {
  db.prepare("DELETE FROM tasks_master WHERE id = ?").run(req.params.id);
  db.prepare("DELETE FROM daily_log WHERE task_id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get("/api/daily/:date", (req, res) => {
  const { date } = req.params;
  // Join tasks_master with daily_log to get all tasks and their status for the day
  const tasks = db.prepare(`
    SELECT tm.id, tm.name, tm.weight, COALESCE(dl.status, 0) as status
    FROM tasks_master tm
    LEFT JOIN daily_log dl ON tm.id = dl.task_id AND dl.date = ?
  `).all(date);
  res.json(tasks);
});

app.post("/api/daily/status", (req, res) => {
  const { date, task_id, status } = req.body;
  const completion_time = status ? new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
  db.prepare(`
    INSERT INTO daily_log (date, task_id, status, completion_time)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date, task_id) DO UPDATE SET status = excluded.status, completion_time = excluded.completion_time
  `).run(date, task_id, status ? 1 : 0, completion_time);
  res.json({ success: true });
});

// Advanced Analytics & Logs
app.get("/api/logs", (req, res) => {
  const { startDate, endDate, taskId } = req.query;
  let query = `
    SELECT dl.date, dl.task_id, tm.name, dl.status, dl.completion_time, tm.deadline
    FROM daily_log dl
    JOIN tasks_master tm ON dl.task_id = tm.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (startDate) { query += " AND dl.date >= ?"; params.push(startDate); }
  if (endDate) { query += " AND dl.date <= ?"; params.push(endDate); }
  if (taskId && taskId !== 'all') { query += " AND dl.task_id = ?"; params.push(taskId); }
  
  query += " ORDER BY dl.date DESC";
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

app.post("/api/logs/update", (req, res) => {
  const { date, task_id, status, completion_time } = req.body;
  db.prepare(`
    UPDATE daily_log 
    SET status = ?, completion_time = ?
    WHERE date = ? AND task_id = ?
  `).run(status, completion_time, date, task_id);
  res.json({ success: true });
});

app.get("/api/analytics/filtered", (req, res) => {
  const { startDate, endDate, taskId } = req.query;
  
  // 1. Trend Data
  let trendQuery = `
    SELECT date, ROUND(SUM(tm.weight * dl.status) * 100.0 / SUM(tm.weight)) as score
    FROM daily_log dl
    JOIN tasks_master tm ON dl.task_id = tm.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (startDate) { trendQuery += " AND dl.date >= ?"; params.push(startDate); }
  if (endDate) { trendQuery += " AND dl.date <= ?"; params.push(endDate); }
  if (taskId && taskId !== 'all') { trendQuery += " AND dl.task_id = ?"; params.push(taskId); }
  trendQuery += " GROUP BY date ORDER BY date ASC";
  const trend = db.prepare(trendQuery).all(...params);

  // 2. Status Distribution
  let distQuery = `
    SELECT 
      CASE 
        WHEN dl.status = 0 THEN 'Not Done'
        WHEN dl.completion_time <= tm.deadline THEN 'On-Time'
        ELSE 'Delayed'
      END as label,
      COUNT(*) as value
    FROM daily_log dl
    JOIN tasks_master tm ON dl.task_id = tm.id
    WHERE 1=1
  `;
  if (startDate) { distQuery += " AND dl.date >= ?"; }
  if (endDate) { distQuery += " AND dl.date <= ?"; }
  if (taskId && taskId !== 'all') { distQuery += " AND dl.task_id = ?"; }
  distQuery += " GROUP BY label";
  const distribution = db.prepare(distQuery).all(...params);

  res.json({ trend, distribution });
});

app.get("/api/score/:date", (req, res) => {
  const { date } = req.params;
  const result = db.prepare(`
    SELECT 
      SUM(tm.weight * COALESCE(dl.status, 0)) as completed_weight,
      SUM(tm.weight) as total_weight
    FROM tasks_master tm
    LEFT JOIN daily_log dl ON tm.id = dl.task_id AND dl.date = ?
  `).get(date) as { completed_weight: number | null, total_weight: number | null };

  const score = result.total_weight ? (result.completed_weight || 0) / result.total_weight * 100 : 0;
  res.json({ score: Math.round(score) });
});

// Analytics Endpoints
app.get("/api/analytics/monthly-boss", (req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const result = db.prepare(`
    SELECT 
      AVG(daily_score) as avg_score
    FROM (
      SELECT 
        date,
        (SUM(tm.weight * COALESCE(dl.status, 0)) * 100.0 / SUM(tm.weight)) as daily_score
      FROM tasks_master tm
      JOIN daily_log dl ON tm.id = dl.task_id
      WHERE dl.date BETWEEN ? AND ?
      GROUP BY date
    )
  `).get(monthStart, monthEnd) as { avg_score: number | null };

  res.json({ boss_hp: Math.round(result.avg_score || 0) });
});

app.get("/api/analytics/trend", (req, res) => {
  const results = db.prepare(`
    SELECT 
      date,
      ROUND(SUM(tm.weight * COALESCE(dl.status, 0)) * 100.0 / SUM(tm.weight)) as score
    FROM tasks_master tm
    JOIN daily_log dl ON tm.id = dl.task_id
    GROUP BY date
    ORDER BY date DESC
    LIMIT 30
  `).all() as { date: string, score: number }[];

  res.json(results.reverse());
});

app.get("/api/analytics/task-stats", (req, res) => {
  const results = db.prepare(`
    SELECT 
      tm.name,
      ROUND(AVG(COALESCE(dl.status, 0)) * 100) as consistency
    FROM tasks_master tm
    LEFT JOIN daily_log dl ON tm.id = dl.task_id
    GROUP BY tm.id
    ORDER BY consistency DESC
  `).all();
  res.json(results);
});

app.get("/api/rewards-punishments", (req, res) => {
  const items = db.prepare("SELECT * FROM rewards_punishments").all();
  res.json(items);
});

app.post("/api/rewards-punishments", (req, res) => {
  const { type, content } = req.body;
  const info = db.prepare("INSERT INTO rewards_punishments (type, content) VALUES (?, ?)").run(type, content);
  res.json({ id: info.lastInsertRowid, type, content });
});

app.delete("/api/rewards-punishments/:id", (req, res) => {
  db.prepare("DELETE FROM rewards_punishments WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
