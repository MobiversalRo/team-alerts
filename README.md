# Team Alerts - Jira Forge App

**Description (for Marketplace / clients):**  
Team Alerts lets project admins send custom notifications to their team directly from Jira. Choose a project, select one or more users (or everyone), write a subject and message, then send by email, in-app, or both. No external servers—everything runs in Jira via Atlassian Forge.

---

A modern, interactive Jira Forge application that allows project administrators to send notifications to selected users or all users within a project.

## Features

### 🎯 Core Functionality
- **Project Selection**: Dropdown to choose any accessible Jira project
- **User Selection**: Display all users with checkboxes for individual or bulk selection
- **Notification Options**: 
  - In-app notifications
  - Email notifications
  - Send both simultaneously
- **Custom Messages**: Subject and message fields for personalized notifications
- **Real-time Feedback**: Success/error status for each notification sent

### 🎨 User Interface
- Clean, modern design aligned with Jira's visual language
- Responsive layout that works on all screen sizes
- User avatars and email addresses for easy identification
- Select All / Deselect All quick actions
- Loading states and error handling
- Accessibility-focused form controls

### 🔧 Technical Features
- Pagination support for large user lists
- Filters only active human users (excludes bots/apps)
- Robust error handling with user-friendly messages
- Usage metrics available via Atlassian
- Optimized API calls with proper scope management

## App Structure

### Backend (Resolver)
**File**: `src/index.js`
- `getAllProjects`: Fetches all accessible Jira projects
- `getUsersForProject`: Retrieves all active users for a specific project with pagination
- `sendNotifications`: Sends email and/or in-app notifications to selected users

### Frontend
**Location**: `static/team-alerts/src/`
- `App.js`: Main application component with state management
- `App.css`: Jira-styled CSS with responsive design
- `index.js`: React entry point

### Configuration
- **manifest.yml**: Defines app modules, permissions, and resources
- **package.json**: Root and frontend dependencies

## Permissions & Scopes

The app requires the following Jira scopes:
- `read:jira-user` - To fetch user information
- `read:jira-work` - To read project and issue data
- `write:jira-work` - To create notifications
- `send:notification:jira` - To send email notifications
- `storage:app` - For app data storage (future use)

## How It Works

1. **Project Selection**: User selects a project from the dropdown
2. **Load Users**: App fetches all active users assigned to that project
3. **Select Recipients**: User checks individual users or uses "Select All"
4. **Configure Notification**: User selects notification type (email/in-app) and enters subject + message
5. **Send**: App sends notifications via Jira's notification API
6. **Confirmation**: Success/failure status displayed for each recipient

## Technical Implementation

### User Fetching
Uses `/rest/api/3/user/assignable/search` endpoint with:
- Project-based filtering
- Pagination (50 users per request)
- accountType filtering (only 'atlassian' users)
- Active user filtering

### Notification Sending
Uses `/rest/api/3/issue/{issueKey}/notify` endpoint:
- Requires at least one issue in the project
- Sends to specific users via accountId
- Supports both text and HTML body
- Returns status for each recipient

### Error Handling
- Validates all inputs before API calls
- Provides specific error messages for common issues
- Gracefully handles API failures
- Logs errors for debugging

## Installation & Deployment

### Prerequisites
- Forge CLI installed
- Atlassian account with admin access to a Jira instance

### Deployment Steps

**Option 1: Deploy with Forge CLI (development)** — recommended for development

1. **Authenticate** (one-time):
   ```bash
   npx @forge/cli login
   ```
   Open the link in your browser and authorize the CLI.

2. **Register the app** (one-time; requires an interactive terminal):
   ```bash
   cd /path/to/team-alerts
   npx @forge/cli register team-alerts
   ```
   At the prompt, select your **Developer Space**. The manifest will be updated with the App ID (UUID).

3. **Build and deploy to development**:
   ```bash
   npm run deploy:dev
   ```
   Or manually:
   ```bash
   npm run build
   npx @forge/cli deploy --environment development
   ```

4. **Install on your Jira site**: After deploy, run (if you want to install on a development Jira site):
   ```bash
   npx @forge/cli install
   ```
   and follow the steps (choose the Jira site).

**Option 2: Automatic Deployment** (IDE panel)
1. In the right panel, enter your Jira credentials (email, domain, API key)
2. Click "Test Connection" to verify credentials
3. Click "Deploy the app" to deploy to your Jira instance

**Option 3: Manual (forge-installer)**

**For Windows:** Run `forge-installer.exe` in the app directory and enter credentials when prompted.

**For macOS/Linux:**
```bash
cd /path/to/team-alerts
./forge-installer
```
Enter credentials when prompted.

### Accessing the App
After deployment:
1. Go to your Jira instance
2. Click "Apps" in the top navigation
3. Select "Team Alerts" from the menu
4. Start sending notifications to your team!

## Known Limitations

1. **Issue Requirement**: At least one issue must exist in the project to send notifications (Jira API requirement)
2. **In-App Notifications**: Currently delivered via Jira's email system based on user notification preferences
3. **User Search**: Limited to users assignable to the project (must have appropriate project permissions)
4. **Pagination**: Maximum 1000 users per project (Jira API limit)

## Compliance & Best Practices

This app is built following Atlassian's submission guidelines:
- ✅ Uses only approved Forge dependencies
- ✅ Implements proper error handling
- ✅ Follows Jira design patterns
- ✅ Includes accessibility features
- ✅ Uses minimal required permissions
- ✅ No external dependencies beyond approved list
- ✅ Usage metrics via Atlassian
- ✅ Responsive design for all devices

## Support

For issues or questions:
- Check the error messages in the app for specific guidance
- Verify all users have appropriate project permissions
- Ensure at least one issue exists in the selected project
- Check Jira logs for detailed error information

## Version History

**v1.0.0** - Initial Release
- Project selection and user management
- Email and in-app notification support
- Modern, responsive UI
- Full error handling

---

**Built with ❤️ for Jira teams**
