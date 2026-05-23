import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

type ThreatLevel = "none" | "elevated" | "critical";

interface HistoryEntry {
  level: ThreatLevel;
  timestamp: string;
}

let currentLevel: ThreatLevel = "none";
const history: HistoryEntry[] = [{ level: "none", timestamp: new Date().toISOString() }];

// GET /status — sentinel polls this
app.get("/status", (_req: Request, res: Response) => {
  res.json({ level: currentLevel, timestamp: new Date().toISOString() });
});

// GET /history — full level change log
app.get("/history", (_req: Request, res: Response) => {
  res.json(history);
});

// POST /admin/set-level — demo toggle (do this visibly in front of judges)
// Body: { "level": "none" | "elevated" | "critical" }
app.post("/admin/set-level", (req: Request, res: Response) => {
  const { level } = req.body as { level: ThreatLevel };
  const valid: ThreatLevel[] = ["none", "elevated", "critical"];
  if (!valid.includes(level)) {
    res.status(400).json({ error: `level must be one of: ${valid.join(", ")}` });
    return;
  }
  const previous = currentLevel;
  currentLevel = level;
  const entry: HistoryEntry = { level, timestamp: new Date().toISOString() };
  history.push(entry);
  console.log(`[threat-api] Level changed: ${previous} → ${currentLevel}`);
  res.json({ previous, current: currentLevel, timestamp: entry.timestamp });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`[threat-api] Listening on http://localhost:${PORT}`);
  console.log(`[threat-api] GET  /status            — current threat level`);
  console.log(`[threat-api] GET  /history           — level change log`);
  console.log(`[threat-api] POST /admin/set-level   — toggle level for demo`);
});
