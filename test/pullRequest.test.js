import { pullRequestClosed } from "../src/func/pullRequest.js";
import { assignmentManager } from "../src/helper/assignmentManager.js";
import { describe, it, beforeEach } from "node:test";
import assert from "assert";

global.app = {
  log: {
    error: () => {}
  }
};

describe("pullRequestClosed", () => {
  let fakeContext;
  let removeAssigneesCalled;
  let createCommentCalled;
  let getAssignmentCalled;
  let removeAssignmentCalled;
  let clearBlockCalled;
  let processQueueCalled;

  beforeEach(() => {
    removeAssigneesCalled = null;
    createCommentCalled = null;
    getAssignmentCalled = false;
    removeAssignmentCalled = false;
    clearBlockCalled = false;
    processQueueCalled = false;

    assignmentManager.getAssignment = async (repo, issue) => {
      getAssignmentCalled = true;
      return { id: 1, assignee: "testuser" };
    };
    assignmentManager.removeAssignment = async (repo, issue) => {
      removeAssignmentCalled = true;
    };
    // Updated stubs: now require repo and issue.
    assignmentManager.isUserBlocked = async (repo, issue, user) => true;
    assignmentManager.clearBlock = async (repo, issue, user) => {
      clearBlockCalled = true;
    };
    assignmentManager.processQueueForUser = async (user, octokit) => {
      processQueueCalled = true;
    };

    fakeContext = {
      payload: {
        pull_request: {
          merged: true,
          body: "This PR fixes the bug and closes #123",
          number: 456,
          user: { login: "testuser" }
        },
        repository: {
          owner: { login: "owner" },
          name: "repo"
        }
      },
      octokit: {
        issues: {
          removeAssignees: async ({ owner, repo, issue_number, assignees }) => {
            removeAssigneesCalled = { owner, repo, issue_number, assignees };
          },
          createComment: async ({ owner, repo, issue_number, body }) => {
            createCommentCalled = { owner, repo, issue_number, body };
          }
        }
      }
    };
  });

  it("should do nothing if PR is not merged", async () => {
    fakeContext.payload.pull_request.merged = false;
    await pullRequestClosed(fakeContext);
    assert.strictEqual(removeAssigneesCalled, null, "removeAssignees should not be called");
    assert.strictEqual(getAssignmentCalled, false, "getAssignment should not be called");
    assert.strictEqual(removeAssignmentCalled, false, "removeAssignment should not be called");
    assert.strictEqual(clearBlockCalled, false, "clearBlock should not be called");
    assert.strictEqual(createCommentCalled, null, "createComment should not be called");
    assert.strictEqual(processQueueCalled, false, "processQueueForUser should not be called");
  });

  it("should process a merged PR and handle assignment removal", async () => {
    await pullRequestClosed(fakeContext);
    assert.deepStrictEqual(
      removeAssigneesCalled,
      {
        owner: "owner",
        repo: "repo",
        issue_number: 123,
        assignees: ["testuser"]
      },
      "removeAssignees was not called with expected arguments"
    );
    assert.strictEqual(getAssignmentCalled, true, "getAssignment was not called");
    assert.strictEqual(removeAssignmentCalled, true, "removeAssignment was not called");
    assert.strictEqual(clearBlockCalled, true, "clearBlock was not called");
    assert.deepStrictEqual(
      createCommentCalled,
      {
        owner: "owner",
        repo: "repo",
        issue_number: 123,
        body: "Assignment for @testuser on issue #123 has been completed with the PR merge."
      },
      "createComment was not called with expected arguments"
    );
    assert.strictEqual(processQueueCalled, true, "processQueueForUser was not called");
  });
});
