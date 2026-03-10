import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

const App = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [issueTypes, setIssueTypes] = useState([]);
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [issues, setIssues] = useState([]);
  const [selectedIssueKey, setSelectedIssueKey] = useState('');
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [notificationTypes, setNotificationTypes] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await invoke('getAllProjects');
      
      if (projectList && Array.isArray(projectList)) {
        setProjects(projectList);
      } else {
        setError('Failed to load projects');
      }
    } catch (err) {
      setError('Error loading projects: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadIssueTypesAndIssues = async (projectKey, issueType = '') => {
    if (!projectKey) return;
    setLoadingIssues(true);
    try {
      const [typesRes, issuesRes] = await Promise.all([
        invoke('getProjectIssueTypes', { projectKey }),
        invoke('getIssuesForProject', { projectKey, issueType: issueType || undefined })
      ]);
      if (Array.isArray(typesRes)) {
        setIssueTypes(typesRes);
      } else {
        setIssueTypes([]);
      }
      if (Array.isArray(issuesRes)) {
        setIssues(issuesRes);
      } else if (issuesRes && issuesRes.error) {
        setIssues([]);
      } else {
        setIssues([]);
      }
    } catch (err) {
      setIssueTypes([]);
      setIssues([]);
    } finally {
      setLoadingIssues(false);
    }
  };

  const handleProjectChange = async (e) => {
    const projectKey = e.target.value;
    setSelectedProject(projectKey);
    setSelectedUsers([]);
    setUsers([]);
    setSelectedIssueType('');
    setSelectedIssueKey('');
    setIssues([]);
    setIssueTypes([]);
    setResult(null);
    setError(null);

    if (!projectKey) return;

    try {
      setLoadingUsers(true);
      const [userList] = await Promise.all([
        invoke('getUsersForProject', { projectKey }),
        loadIssueTypesAndIssues(projectKey)
      ]);

      if (userList && userList.error) {
        setError(userList.error);
      } else if (Array.isArray(userList)) {
        setUsers(userList);
        if (userList.length === 0) {
          setError('No users found in this project');
        }
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      setError('Error loading users: ' + err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleIssueTypeChange = async (e) => {
    const issueType = e.target.value;
    setSelectedIssueType(issueType);
    setSelectedIssueKey('');
    if (!selectedProject) return;
    setLoadingIssues(true);
    try {
      const issuesRes = await invoke('getIssuesForProject', {
        projectKey: selectedProject,
        issueType: issueType || undefined
      });
      if (Array.isArray(issuesRes)) {
        setIssues(issuesRes);
      } else {
        setIssues([]);
      }
    } catch (err) {
      setIssues([]);
    } finally {
      setLoadingIssues(false);
    }
  };

  const handleUserToggle = (accountId) => {
    setSelectedUsers(prev => {
      if (prev.includes(accountId)) {
        return prev.filter(id => id !== accountId);
      } else {
        return [...prev, accountId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.accountId));
    }
  };

  const MAX_ATTACHMENTS = 4;
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  const handleAttachmentChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const current = attachments.length;
    const toAdd = files.slice(0, MAX_ATTACHMENTS - current).filter((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) return false;
      return true;
    });
    setAttachments((prev) => [...prev, ...toAdd.map((file) => ({ file, name: file.name, size: file.size }))]);
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        resolve({ filename: file.name, base64: base64 || '' });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleNotificationTypeToggle = (type) => {
    setNotificationTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type);
      } else {
        return [...prev, type];
      }
    });
  };

  const handleSendNotifications = async () => {
    if (!selectedProject) {
      setError('Please select a project');
      return;
    }

    if (selectedUsers.length === 0) {
      setError('Please select at least one user');
      return;
    }

    if (notificationTypes.length === 0) {
      setError('Please select at least one notification type');
      return;
    }

    if (!subject.trim() || !message.trim()) {
      setError('Please provide both subject and message');
      return;
    }

    const hasOversized = attachments.some((a) => a.size > MAX_FILE_SIZE_BYTES);
    if (hasOversized) {
      setError('Each attachment must be 5MB or less.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const userDetails = selectedUsers.map((id) => {
        const u = users.find((x) => x.accountId === id);
        return { accountId: id, displayName: (u && u.displayName) || 'User' };
      });

      const attachmentPayload =
        attachments.length > 0
          ? await Promise.all(attachments.map((a) => fileToBase64(a.file)))
          : undefined;

      const response = await invoke('sendNotifications', {
        projectKey: selectedProject,
        userAccountIds: selectedUsers,
        notificationTypes,
        subject: subject.trim(),
        message: message.trim(),
        userDetails,
        issueKey: selectedIssueKey || undefined,
        ...(attachmentPayload && attachmentPayload.length > 0 ? { attachments: attachmentPayload } : {})
      });

      if (response.error) {
        setError(response.error);
      } else {
        setResult(response);
        setSubject('');
        setMessage('');
        setSelectedUsers([]);
        setNotificationTypes([]);
        setAttachments([]);
      }
    } catch (err) {
      setError('Error sending notifications: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <div className="header-title-row">
          <img src={`${process.env.PUBLIC_URL || ''}/images/logo.svg`} alt="" className="header-icon" aria-hidden />
          <h1>Team Alerts</h1>
        </div>
        <p className="subtitle">Send notifications to your project team members</p>
      </div>

      {!(selectedProject && users.length > 0) && error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="form-section">
        <div className="form-group">
          <label htmlFor="project-select">
            <strong>Select Project</strong>
          </label>
          <select
            id="project-select"
            className="form-control"
            value={selectedProject}
            onChange={handleProjectChange}
            disabled={loading || loadingUsers}
          >
            <option value="">-- Choose a project --</option>
            {projects.map(project => (
              <option key={project.key} value={project.key}>
                {project.name} ({project.key})
              </option>
            ))}
          </select>
        </div>

        {selectedProject && (
          <>
            <div className="form-group">
              <label htmlFor="issue-type-select">
                <strong>Issue type (filter)</strong>
              </label>
              <select
                id="issue-type-select"
                className="form-control"
                value={selectedIssueType}
                onChange={handleIssueTypeChange}
                disabled={loadingIssues}
              >
                <option value="">Any</option>
                {issueTypes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="issue-select">
                <strong>Link notification to issue</strong>
              </label>
              <select
                id="issue-select"
                className="form-control"
                value={selectedIssueKey}
                onChange={(e) => setSelectedIssueKey(e.target.value)}
                disabled={loadingIssues}
              >
                <option value="">Use most recent issue</option>
                {issues.map((issue) => (
                  <option key={issue.key} value={issue.key}>
                    {issue.key} — {issue.summary.length > 50 ? issue.summary.slice(0, 50) + '…' : issue.summary}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {loadingUsers && (
          <div className="loading-message">
            Loading users...
          </div>
        )}

        {selectedProject && users.length > 0 && (
          <>
            <div className="form-group">
              <div className="section-header">
                <strong>Select Users</strong>
                <button 
                  className="btn-link"
                  onClick={handleSelectAll}
                  type="button"
                >
                  {selectedUsers.length === users.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="user-list">
                {users.map(user => (
                  <div key={user.accountId} className="user-item">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.accountId)}
                        onChange={() => handleUserToggle(user.accountId)}
                      />
                      <span className="user-info">
                        {user.avatarUrls && user.avatarUrls['24x24'] && (
                          <img 
                            src={user.avatarUrls['24x24']} 
                            alt={user.displayName}
                            className="user-avatar"
                          />
                        )}
                        <span className="user-name">{user.displayName}</span>
                        {user.emailAddress && (
                          <span className="user-email">({user.emailAddress})</span>
                        )}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="selection-summary">
                {selectedUsers.length} of {users.length} user(s) selected
              </div>
            </div>

            <div className="form-group">
              <strong>Notification Type</strong>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={notificationTypes.includes('email')}
                    onChange={() => handleNotificationTypeToggle('email')}
                  />
                  <span>Email Notification</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={notificationTypes.includes('inapp')}
                    onChange={() => handleNotificationTypeToggle('inapp')}
                  />
                  <span>In-App Notification</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="subject">
                <strong>Subject</strong>
              </label>
              <input
                id="subject"
                type="text"
                className="form-control"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter notification subject"
                maxLength={200}
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">
                <strong>Message</strong>
              </label>
              <textarea
                id="message"
                className="form-control textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message"
                rows={6}
              />
            </div>

            <div className="form-group">
              <label htmlFor="attachments">
                <strong>Attachments (optional)</strong>
              </label>
              <input
                id="attachments"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif"
                className="form-control"
                onChange={handleAttachmentChange}
                disabled={attachments.length >= MAX_ATTACHMENTS}
              />
              <span className="form-hint">Max {MAX_ATTACHMENTS} files, 5MB each. Added to the issue.</span>
              {attachments.length > 0 && (
                <ul className="attachment-list">
                  {attachments.map((a, i) => (
                    <li key={i} className="attachment-item">
                      <span className="attachment-name">{a.name}</span>
                      <span className="attachment-size">
                        ({(a.size / 1024).toFixed(1)} KB)
                      </span>
                      <button
                        type="button"
                        className="btn-link attachment-remove"
                        onClick={() => removeAttachment(i)}
                        aria-label={`Remove ${a.name}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={handleSendNotifications}
                disabled={loading || selectedUsers.length === 0 || notificationTypes.length === 0 || !subject.trim() || !message.trim()}
              >
                {loading ? 'Sending...' : 'Send Notification'}
              </button>
            </div>

            {(result || error) && (
              <>
                {result && (
                  <div className="alert alert-success">
                    <strong>Success!</strong> Sent {result.totalSent} notification(s) successfully.
                    {result.totalFailed > 0 && ` ${result.totalFailed} failed.`}
                    {result.attachmentsUploaded && result.attachmentsUploaded.length > 0 && (
                      <span> {result.attachmentsUploaded.length} attachment(s) added to the issue.</span>
                    )}
                  </div>
                )}
                {error && (
                  <div className="alert alert-error">
                    <strong>Error:</strong> {error}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
