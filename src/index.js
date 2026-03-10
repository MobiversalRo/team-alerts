import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

/**
 * Get all Jira projects accessible by the user
 */
const getAllProjects = async () => {
  try {
    const response = await api.asUser().requestJira(route`/rest/api/3/project`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }

    const projects = await response.json();
    return projects.map(p => ({
      id: p.id,
      key: p.key,
      name: p.name,
      avatarUrls: p.avatarUrls
    }));
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
};

resolver.define('getAllProjects', async () => {
  return await getAllProjects();
});

/**
 * Get all users for a specific project with pagination
 */
const getUsersForProject = async ({ payload }) => {
  const { projectKey } = payload;

  if (!projectKey || typeof projectKey !== 'string') {
    return { 
      error: 'Invalid projectKey. Expected format: { projectKey: "PROJ" }' 
    };
  }

  try {
    let allUsers = [];
    let startAt = 0;
    const maxResults = 50;
    let hasMore = true;

    // Fetch all users with pagination
    while (hasMore) {
      const response = await api.asUser().requestJira(
        route`/rest/api/3/user/assignable/search?project=${projectKey}&startAt=${startAt}&maxResults=${maxResults}`,
        {
          headers: { Accept: 'application/json' }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }

      const users = await response.json();
      
      // Filter only human users (accountType: atlassian)
      const humanUsers = users.filter(u => u.accountType === 'atlassian' && u.active);
      allUsers = allUsers.concat(humanUsers);

      if (users.length < maxResults) {
        hasMore = false;
      } else {
        startAt += maxResults;
      }
    }

    // Return formatted user list
    return allUsers.map(user => ({
      accountId: user.accountId,
      displayName: user.displayName || 'Unknown User',
      emailAddress: user.emailAddress || '',
      avatarUrls: user.avatarUrls || {}
    }));
  } catch (error) {
    console.error('Error fetching users for project:', error);
    return { error: error.message };
  }
};

resolver.define('getUsersForProject', getUsersForProject);

/**
 * Get issue types available in a project (for dropdown filter)
 */
const getProjectIssueTypes = async ({ payload }) => {
  const { projectKey } = payload;
  if (!projectKey || typeof projectKey !== 'string') {
    return { error: 'Invalid projectKey.' };
  }
  try {
    const response = await api.asUser().requestJira(
      route`/rest/api/3/project/${projectKey}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch project: ${response.status}`);
    }
    const project = await response.json();
    const types = (project.issueTypes || []).map(t => ({ id: t.id, name: t.name }));
    return types;
  } catch (error) {
    console.error('Error fetching project issue types:', error);
    return { error: error.message };
  }
};

resolver.define('getProjectIssueTypes', getProjectIssueTypes);

/**
 * Get issues for a project (optionally filtered by issue type) for "Link to issue" dropdown
 */
const getIssuesForProject = async ({ payload }) => {
  const { projectKey, issueType } = payload;
  if (!projectKey || typeof projectKey !== 'string') {
    return { error: 'Invalid projectKey.' };
  }
  try {
    let jql = `project = ${projectKey} ORDER BY updated DESC`;
    if (issueType && issueType.trim()) {
      jql = `project = ${projectKey} AND issuetype = "${issueType.trim()}" ORDER BY updated DESC`;
    }
    const response = await api.asUser().requestJira(
      route`/rest/api/3/search/jql`,
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jql,
          maxResults: 50,
          fields: ['key', 'summary', 'issuetype']
        })
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to search issues: ${response.status}`);
    }
    const data = await response.json();
    const issues = (data.issues || []).map(i => ({
      key: i.key,
      summary: (i.fields && i.fields.summary) || '',
      issueTypeName: (i.fields && i.fields.issuetype && i.fields.issuetype.name) || ''
    }));
    return issues;
  } catch (error) {
    console.error('Error fetching issues for project:', error);
    return { error: error.message };
  }
};

resolver.define('getIssuesForProject', getIssuesForProject);

/**
 * Build ADF body for a comment that mentions users (triggers in-app bell notifications)
 */
const buildCommentBodyWithMentions = (subject, message, userDetails) => {
  const title = subject || 'Team Alert';
  const text = message || 'You have been notified.';
  const content = [
    { type: 'text', text: 'Team Alert: ' },
    { type: 'text', text: title },
    { type: 'hardBreak' },
    { type: 'text', text: text },
    { type: 'hardBreak' },
    { type: 'text', text: 'Notifying: ' }
  ];
  (userDetails || []).forEach((u, i) => {
    content.push({
      type: 'mention',
      attrs: {
        id: u.accountId,
        text: `@${u.displayName || 'User'}`,
        userType: 'DEFAULT'
      }
    });
    if (i < userDetails.length - 1) {
      content.push({ type: 'text', text: ' ' });
    }
  });
  return {
    type: 'doc',
    version: 1,
    content: [{ type: 'paragraph', content }]
  };
};

const ATTACHMENT_MAX_COUNT = 4;
const ATTACHMENT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file

/**
 * Build multipart/form-data body for Jira attachment API (one or more files named "file")
 */
function buildMultipartBody(files) {
  const boundary = '----ForgeTeamAlerts' + Date.now();
  const parts = [];
  const prefix = (filename) =>
    Buffer.from(
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
      'utf8'
    );
  for (const { filename, buffer } of files) {
    parts.push(prefix(filename), buffer);
  }
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

/**
 * Upload attachments to an issue via Jira REST API. Returns { success, uploadedNames, error }.
 */
async function uploadAttachmentsToIssue(issueKey, attachments) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return { success: true, uploadedNames: [] };
  }
  const files = [];
  for (const a of attachments) {
    if (!a.filename || !a.base64) continue;
    let buffer;
    try {
      buffer = Buffer.from(a.base64, 'base64');
    } catch (e) {
      console.error('Attachment base64 decode failed:', e);
      return { success: false, uploadedNames: [], error: 'Invalid attachment data' };
    }
    if (buffer.length > ATTACHMENT_MAX_SIZE_BYTES) {
      return { success: false, uploadedNames: [], error: `File ${a.filename} exceeds 5MB limit` };
    }
    files.push({ filename: a.filename, buffer });
  }
  if (files.length === 0) return { success: true, uploadedNames: [] };

  const { body, contentType } = buildMultipartBody(files);
  try {
    const response = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}/attachments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'X-Atlassian-Token': 'no-check'
        },
        body
      }
    );
    if (!response.ok) {
      const text = await response.text();
      return { success: false, uploadedNames: [], error: `Upload failed: ${response.status} ${text}` };
    }
    return { success: true, uploadedNames: files.map((f) => f.filename) };
  } catch (err) {
    console.error('Attachment upload error:', err);
    return { success: false, uploadedNames: [], error: err.message };
  }
}

/**
 * Send notifications to selected users
 */
const sendNotifications = async ({ payload }) => {
  const { projectKey, userAccountIds, notificationTypes, subject, message, userDetails, issueKey: payloadIssueKey, attachments } = payload;

  if (!projectKey || !userAccountIds || !Array.isArray(userAccountIds) || userAccountIds.length === 0) {
    return { 
      error: 'Invalid payload. Expected: { projectKey, userAccountIds: [], notificationTypes: [], subject, message }' 
    };
  }

  const sendEmail = notificationTypes.includes('email');
  const sendInApp = notificationTypes.includes('inapp');

  const results = [];

  try {
    let issueKey = payloadIssueKey && typeof payloadIssueKey === 'string' ? payloadIssueKey.trim() : null;

    if (!issueKey) {
      const issueResponse = await api.asUser().requestJira(
        route`/rest/api/3/search/jql`,
        {
          method: 'POST',
          headers: { 
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jql: `project = ${projectKey} ORDER BY updated DESC`,
            maxResults: 1,
            fields: ['key', 'summary']
          })
        }
      );

      if (!issueResponse.ok) {
        throw new Error(`Failed to fetch project issues: ${issueResponse.status}`);
      }

      const issueData = await issueResponse.json();
      const issues = issueData.issues || [];

      if (issues.length === 0) {
        return { 
          error: 'No issues found in project. At least one issue is required to send notifications.' 
        };
      }

      issueKey = issues[0].key;
    }

    const attachmentResult = { uploadedNames: [], error: null };
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      if (attachments.length > ATTACHMENT_MAX_COUNT) {
        return { error: `Maximum ${ATTACHMENT_MAX_COUNT} attachments allowed.`, results: [] };
      }
      const upload = await uploadAttachmentsToIssue(issueKey, attachments);
      attachmentResult.uploadedNames = upload.uploadedNames || [];
      attachmentResult.error = upload.error || null;
      if (!upload.success && upload.error) {
        return { error: `Attachment upload failed: ${upload.error}. Notification was not sent.`, results: [] };
      }
    }

    // Email: Jira's /notify API only sends email (adds to mail queue). It does NOT create in-app bell notifications.
    if (sendEmail) {
      for (const accountId of userAccountIds) {
        try {
          const notificationPayload = {
            subject: subject || 'Team Alert',
            textBody: message || 'You have received a team notification.',
            htmlBody: `<p>${(message || 'You have received a team notification.').replace(/\n/g, '<br>')}</p>`,
            to: {
              users: [{ accountId }],
              reporter: false,
              assignee: false,
              watchers: false,
              voters: false
            }
          };

          const notifyResponse = await api.asUser().requestJira(
            route`/rest/api/3/issue/${issueKey}/notify`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(notificationPayload)
            }
          );

          const success = notifyResponse.status === 204;
          results.push({ accountId, type: 'email', success, status: notifyResponse.status });
        } catch (error) {
          results.push({ accountId, type: 'email', success: false, error: error.message });
        }
      }
    }

    // In-app (bell): Jira's notify API does not populate the bell. We add a comment that @mentions each user
    // so they receive an in-app notification (and optionally email per their Jira notification settings).
    if (sendInApp) {
      const details = Array.isArray(userDetails) && userDetails.length === userAccountIds.length
        ? userDetails
        : userAccountIds.map(accountId => ({ accountId, displayName: 'User' }));
      const attachmentNote = attachmentResult.uploadedNames.length > 0
        ? `\n\nAttachments: ${attachmentResult.uploadedNames.join(', ')}`
        : '';
      const commentBody = buildCommentBodyWithMentions(subject, message + attachmentNote, details);
      try {
        const commentResponse = await api.asUser().requestJira(
          route`/rest/api/3/issue/${issueKey}/comment`,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ body: commentBody })
          }
        );
        const commentSuccess = commentResponse.ok;
        userAccountIds.forEach(accountId => {
          results.push({
            accountId,
            type: 'inapp',
            success: commentSuccess,
            status: commentResponse.status,
            note: commentSuccess ? 'In-app notification via @mention on issue' : (commentResponse.status || 'error')
          });
        });
      } catch (error) {
        userAccountIds.forEach(accountId => {
          results.push({ accountId, type: 'inapp', success: false, error: error.message });
        });
      }
    }

    return {
      success: true,
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
      attachmentsUploaded: attachmentResult.uploadedNames
    };
  } catch (error) {
    console.error('Error sending notifications:', error);
    return { 
      error: error.message,
      results 
    };
  }
};

resolver.define('sendNotifications', sendNotifications);

export const handler = resolver.getDefinitions();
