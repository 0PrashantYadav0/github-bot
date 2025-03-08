import { assignmentManager } from './assignmentManager.js';

export async function processExpiredAssignments(app) {
  const now = Date.now();
  const assignments = await assignmentManager.getAllAssignments();
  for (const assignment of assignments) {
    if (assignment.deadline < now) {
      try {
        // Use app.auth() without a context (assumes a default installation auth).
        const octokit = await app.auth();
        const repoParts = assignment.repo.split('/');
        const repo = { full_name: assignment.repo, name: repoParts[1], owner: { login: repoParts[0] } };
        const issue = { number: assignment.issue_number };
        await octokit.issues.removeAssignees({
          owner: repo.owner.login,
          repo: repo.name,
          issue_number: issue.number,
          assignees: [assignment.assignee]
        });
        const body = `Assignment for @${assignment.assignee} has expired and been removed. You are blocked from new assignments for 5 hours.`;
        await octokit.issues.createComment({
          owner: repo.owner.login,
          repo: repo.name,
          issue_number: issue.number,
          body
        });
        await assignmentManager.blockUser(assignment.assignee, 5);
        await assignmentManager.removeAssignment(repo, issue);
      } catch (error) {
        app.log.error(`Error processing expired assignment id ${assignment.id}:`, error);
      }
    }
  }
}

export async function processQueuedAssignments(app) {
  const queuedUsers = await assignmentManager.getAllQueuedUsers();
  for (const user of queuedUsers) {
    try {
      const octokit = await app.auth();
      await assignmentManager.processQueueForUser(user, octokit);
    } catch (error) {
      app.log.error(`Error processing queue for ${user}:`, error);
    }
  }
}

export default function start(app) {
  // Scheduler runs every minute.
  setInterval(async () => {
    await processExpiredAssignments(app);
    await processQueuedAssignments(app);
  }, 60 * 1000);
}
