import { assert } from "chai";
import request from "supertest";
import express from "express";
import type { Request, Response } from "express";

// Build a fresh app instance per test suite so state doesn't leak between runs
function buildApp() {
  const app = express();
  app.use(express.json());

  type ThreatLevel = "none" | "elevated" | "critical";
  interface HistoryEntry { level: ThreatLevel; timestamp: string; }

  let currentLevel: ThreatLevel = "none";
  const history: HistoryEntry[] = [{ level: "none", timestamp: new Date().toISOString() }];

  app.get("/status", (_req: Request, res: Response) => {
    res.json({ level: currentLevel, timestamp: new Date().toISOString() });
  });

  app.get("/history", (_req: Request, res: Response) => {
    res.json(history);
  });

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
    res.json({ previous, current: currentLevel, timestamp: entry.timestamp });
  });

  return app;
}

describe("threat-api", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
  });

  describe("GET /status", () => {
    it("returns level=none on startup", async () => {
      const res = await request(app).get("/status");
      assert.equal(res.status, 200);
      assert.equal(res.body.level, "none");
      assert.isString(res.body.timestamp);
    });
  });

  describe("POST /admin/set-level", () => {
    it("transitions none → elevated", async () => {
      const res = await request(app)
        .post("/admin/set-level")
        .send({ level: "elevated" });
      assert.equal(res.status, 200);
      assert.equal(res.body.previous, "none");
      assert.equal(res.body.current, "elevated");
    });

    it("transitions elevated → critical", async () => {
      await request(app).post("/admin/set-level").send({ level: "elevated" });
      const res = await request(app).post("/admin/set-level").send({ level: "critical" });
      assert.equal(res.body.previous, "elevated");
      assert.equal(res.body.current, "critical");
    });

    it("reflects new level in subsequent /status calls", async () => {
      await request(app).post("/admin/set-level").send({ level: "critical" });
      const res = await request(app).get("/status");
      assert.equal(res.body.level, "critical");
    });

    it("rejects unknown level with 400", async () => {
      const res = await request(app)
        .post("/admin/set-level")
        .send({ level: "quantum" });
      assert.equal(res.status, 400);
      assert.include(res.body.error, "level must be one of");
    });

    it("rejects missing level with 400", async () => {
      const res = await request(app).post("/admin/set-level").send({});
      assert.equal(res.status, 400);
    });
  });

  describe("GET /history", () => {
    it("starts with one entry at level none", async () => {
      const res = await request(app).get("/history");
      assert.equal(res.status, 200);
      assert.isArray(res.body);
      assert.equal(res.body[0].level, "none");
    });

    it("records each level change", async () => {
      await request(app).post("/admin/set-level").send({ level: "elevated" });
      await request(app).post("/admin/set-level").send({ level: "critical" });
      const res = await request(app).get("/history");
      assert.equal(res.body.length, 3); // initial + 2 changes
      assert.equal(res.body[1].level, "elevated");
      assert.equal(res.body[2].level, "critical");
    });
  });
});
