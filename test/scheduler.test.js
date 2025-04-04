import { describe, beforeEach, test } from "node:test";
import assert from "assert";
import initDB from "../src/db/index.js";
import { processExpiredAssignments } from "../src/helper/scheduler.js";
import { assignmentManager } from "../src/helper/assignmentManager.js";

describe("Scheduler (scheduler.js)", () => {
  let app;
  const repo = { owner: { login: "owner" }, name: "repo", full_name: "owner/repo" };
  const issue = { number: 2 };
  const user = "testuser";

  beforeEach(async () => {
    const db = await initDB();
    await db.exec("DELETE FROM assignments; DELETE FROM user_queues; DELETE FROM blocked_users;");
    const expiredDeadline = Date.now() - 10000;
    await assignmentManager.addAssignment(repo, issue, user, expiredDeadline);

    const fakeOctokit = {
      issues: {
        removeAssignees: async () => ({}),
        createComment: async () => ({})
      }
    };

    app = {
      auth: async () => fakeOctokit,
      log: { error: () => {}, info: () => {} }
    };
  });

  test("processes expired assignments and blocks the user", async () => {
    await processExpiredAssignments(app);
    const assignment = await assignmentManager.getAssignment(repo, issue);
    assert.strictEqual(assignment, undefined, "Expired assignment was not removed");

    const db = await initDB();
    const blockedUser = await db.get(
      "SELECT * FROM blocked_users WHERE username = ? AND repo = ? AND issue_number = ?",
      [user, repo.full_name, issue.number]
    );
    assert.ok(blockedUser, "User was not blocked after expired assignment");
  });
});
