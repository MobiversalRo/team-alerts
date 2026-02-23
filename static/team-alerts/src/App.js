import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';
import './App.css';

const App = () => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [notificationTypes, setNotificationTypes] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Send analytics ping on app open
    invoke('onAppOpen').catch(err => console.error('Analytics failed:', err));

    // Load projects
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

  const handleProjectChange = async (e) => {
    const projectKey = e.target.value;
    setSelectedProject(projectKey);
    setSelectedUsers([]);
    setUsers([]);
    setResult(null);
    setError(null);

    if (!projectKey) return;

    try {
      setLoadingUsers(true);
      const userList = await invoke('getUsersForProject', { projectKey });
      
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

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await invoke('sendNotifications', {
        projectKey: selectedProject,
        userAccountIds: selectedUsers,
        notificationTypes,
        subject: subject.trim(),
        message: message.trim()
      });

      if (response.error) {
        setError(response.error);
      } else {
        setResult(response);
        // Clear form after successful send
        setSubject('');
        setMessage('');
        setSelectedUsers([]);
        setNotificationTypes([]);
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
        <h1>Team Alerts</h1>
        <p className="subtitle">Send notifications to your project team members</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="alert alert-success">
          <strong>Success!</strong> Sent {result.totalSent} notification(s) successfully.
          {result.totalFailed > 0 && ` ${result.totalFailed} failed.`}
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

            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={handleSendNotifications}
                disabled={loading || selectedUsers.length === 0 || notificationTypes.length === 0 || !subject.trim() || !message.trim()}
              >
                {loading ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
