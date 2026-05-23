import { assert } from "chai";

// Sentinel poll logic extracted for unit testing — no Solana connection needed

type ThreatLevel = "none" | "elevated" | "critical";

interface PollState {
  lastKnownLevel: ThreatLevel;
  lockdownFired: boolean;
}

interface PollResult {
  levelChanged: boolean;
  lockdownTriggered: boolean;
  lockdownCleared: boolean;
  state: PollState;
}

// Mirrors the decision logic in sentinel/src/index.ts poll()
function evaluatePoll(currentState: PollState, incomingLevel: ThreatLevel): PollResult {
  const result: PollResult = {
    levelChanged: false,
    lockdownTriggered: false,
    lockdownCleared: false,
    state: { ...currentState },
  };

  if (incomingLevel !== currentState.lastKnownLevel) {
    result.levelChanged = true;
    result.state.lastKnownLevel = incomingLevel;
  }

  if (incomingLevel === "critical" && !currentState.lockdownFired) {
    result.lockdownTriggered = true;
    result.state.lockdownFired = true;
  }

  if (incomingLevel !== "critical" && currentState.lockdownFired) {
    result.lockdownCleared = true;
    result.state.lockdownFired = false;
  }

  return result;
}

describe("sentinel — poll logic", () => {
  let state: PollState;

  beforeEach(() => {
    state = { lastKnownLevel: "none", lockdownFired: false };
  });

  describe("level change detection", () => {
    it("detects transition none → elevated", () => {
      const result = evaluatePoll(state, "elevated");
      assert.isTrue(result.levelChanged);
      assert.equal(result.state.lastKnownLevel, "elevated");
    });

    it("detects transition none → critical", () => {
      const result = evaluatePoll(state, "critical");
      assert.isTrue(result.levelChanged);
    });

    it("does not flag change when level is unchanged", () => {
      const result = evaluatePoll(state, "none");
      assert.isFalse(result.levelChanged);
    });
  });

  describe("lockdown triggering", () => {
    it("triggers lockdown on first critical poll", () => {
      const result = evaluatePoll(state, "critical");
      assert.isTrue(result.lockdownTriggered);
      assert.isTrue(result.state.lockdownFired);
    });

    it("does not re-trigger lockdown on subsequent critical polls", () => {
      state = evaluatePoll(state, "critical").state;
      const result = evaluatePoll(state, "critical");
      assert.isFalse(result.lockdownTriggered);
    });

    it("does not trigger lockdown for elevated", () => {
      const result = evaluatePoll(state, "elevated");
      assert.isFalse(result.lockdownTriggered);
    });

    it("does not trigger lockdown for none", () => {
      const result = evaluatePoll(state, "none");
      assert.isFalse(result.lockdownTriggered);
    });
  });

  describe("lockdown reset", () => {
    it("clears lockdownFired when level drops from critical", () => {
      state = evaluatePoll(state, "critical").state;
      const result = evaluatePoll(state, "none");
      assert.isTrue(result.lockdownCleared);
      assert.isFalse(result.state.lockdownFired);
    });

    it("re-triggers lockdown after a reset if critical returns", () => {
      // critical → none → critical should fire again
      state = evaluatePoll(state, "critical").state; // fires
      state = evaluatePoll(state, "none").state;     // resets
      const result = evaluatePoll(state, "critical");
      assert.isTrue(result.lockdownTriggered);
    });

    it("does not clear when level stays at non-critical without prior lockdown", () => {
      const result = evaluatePoll(state, "elevated");
      assert.isFalse(result.lockdownCleared);
    });
  });

  describe("full scenario: none → elevated → critical → none → critical", () => {
    it("only fires lockdown twice across two critical windows", () => {
      let fires = 0;

      const levels: ThreatLevel[] = ["elevated", "critical", "critical", "none", "critical"];
      for (const level of levels) {
        const result = evaluatePoll(state, level);
        if (result.lockdownTriggered) fires++;
        state = result.state;
      }

      assert.equal(fires, 2);
    });
  });
});
