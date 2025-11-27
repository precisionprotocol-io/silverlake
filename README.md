# Silverlake - Command-Line Style Task Manager

A web-based task management system with a terminal/command-line aesthetic, inspired by Taskwarrior. Built for local, single-user task management with a vim-style command interface.

## Features

- **Terminal Aesthetic**: Dark theme with monospace fonts and command-line interface
- **Vim-Style Commands**: Intuitive colon commands for all operations
- **Hierarchical Tasks**: Support for 3-level hierarchy (grandparent → parent → child)
- **Foldable Tasks**: Click to collapse/expand task hierarchies
- **Advanced Filtering**: Filter by ID, project, priority, or status with family tree inclusion
- **Priority Sorting**: Sort tasks by priority (Critical → Low)
- **Due Date Tracking**: Overdue tasks highlighted with glowing animation
- **Auto-Complete Behavior**: Completed tasks have priority removed, pushing them to bottom
- **Undo/Redo**: Full undo/redo support for task operations
- **Command History**: Navigate previous commands with arrow keys
- **IndexedDB Storage**: 100MB+ capacity for unlimited tasks
- **Keyboard-Driven**: Minimal mouse interaction required
- **Zero Setup**: Just open in browser - no installation needed
- **Privacy-First**: 100% local storage, zero server communication

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: IndexedDB (browser-native)
- **Font**: JetBrains Mono (loaded from Google Fonts)
- **Storage**: Local browser storage (100MB+ capacity)
- **Dependencies**: None - pure vanilla implementation

## Getting Started

1. Simply open `index.html` in a modern web browser
2. The app will initialize automatically
3. Type `:h` or `:help` to see all available commands

No server, no installation, no dependencies!

## Command Reference

### Task Management

| Command | Description |
|---------|-------------|
| `:A` or `:add` | Add a new task |
| `:M [task_id]` | Modify existing task |
| `:D [task_id]` | Delete task (moves to trash) |
| `:D[1,2,5]` | Delete multiple tasks |
| `:D[1~10]` | Delete range of tasks |
| `:query`, `:search`, `:?` | Open search modal to find tasks |

### Filtering

**Note**: Filtering automatically includes all ancestors AND descendants for complete context.

| Command | Example | Description |
|---------|---------|-------------|
| `:Filter_ID=1` | `:Filter_ID=5` | Show single task with family |
| `:Filter_ID=[1,2,5]` | `:Filter_ID=[1,3,7]` | Show multiple tasks with families |
| `:Filter_ID=[1~10]` | `:Filter_ID=[5~15]` | Show range of tasks |
| `:Filter_ID!=[1,2,5]` | `:Filter_ID!=[1,3,7]` | Exclude specific tasks |
| `:Filter_Project="Name"` | `:Filter_Project="Alpha"` | Filter by project name |
| `:Filter_Project!="Name"` | `:Filter_Project!="Alpha"` | Exclude project |
| `:Filter_Priority="High"` | `:Filter_Priority="Critical"` | Filter by priority |
| `:Filter_Priority!="Low"` | `:Filter_Priority!="Medium"` | Exclude priority level |
| `:Filter_Status="In Progress"` | `:Filter_Status="Completed"` | Filter by status |
| `:Filter_Status!="Completed"` | `:Filter_Status!="Blocked"` | Exclude status |

### Trash & Recovery

| Command | Description |
|---------|-------------|
| `:trash` | View deleted tasks (recycle bin) |
| `:restore [id]` | Restore task from trash |
| `:purge [id]` | Permanently delete task |
| `:purge all` | Empty trash (permanent) |

### Data Management

| Command | Description |
|---------|-------------|
| `:export` | Export all tasks to JSON file |
| `:csv` | Export all tasks to CSV file |
| `:import` | Import tasks from JSON backup |

### Sorting & Utility

| Command | Description |
|---------|-------------|
| `:Sort_by_priority` | Sort tasks by priority (Critical → Low) |
| `:clear` or `:c` | Clear all filters, show all tasks |
| `:help` or `:h` | Show command reference |
| `:privacy` | Show privacy and security information |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate tasks / command history |
| `J` / `K` | Navigate down / up in task list |
| `Enter` | Modify selected task |
| `C` | Mark selected task as Completed |
| `!` | Mark selected task as Critical |
| `U` | Undo last action |
| `R` | Redo last undone action |
| `Esc` | Clear command / close dropdown |
| `Ctrl+Enter` | Submit modal form |
| `:` | Enter command mode |

### Mouse Interactions

| Click Target | Action |
|--------------|--------|
| Task row | Open modify modal |
| Status badge | Quick status change dropdown |
| Priority badge | Quick priority change dropdown |
| Due date | Date picker popup |
| Notes cell | View/add notes modal |
| ▼/▶ icon | Fold/unfold child tasks |

## Task Properties

### Status Options
- **Not Started** (Gray) - Default status
- **In Progress** (Cyan) - Task is being worked on
- **Blocked** (Red) - Task is blocked by dependencies
- **Completed** (Green) - Task is finished (priority auto-removed)

### Priority Levels
- **Low** (Gray) - Nice to have
- **Medium** (Yellow) - Default priority
- **High** (Orange) - Important
- **Critical** (Red, Pulsing) - Urgent and important

### Due Date Formats
- `YYYY-MM-DD` - Specific date (e.g., `2024-12-31`)
- `YYYY-MM-DD HH:MM` - Date with time (e.g., `2024-12-31 14:30`)
- `today` - Today's date
- `tomorrow` - Tomorrow's date
- `+3d` - 3 days from now (any number of days)

**Timezone**: All dates use Australia/Sydney timezone

## Task Hierarchy

Tasks support a **3-level hierarchy**:
- **Grandparent tasks**: Top-level tasks that can have children
- **Parent tasks**: Children of grandparents, can have their own children
- **Child tasks**: Lowest level, cannot have subtasks

### Hierarchy Features
- **Foldable**: Click ▼/▶ to collapse/expand task families
- **Smart Filtering**: Filtering any task shows its complete family tree
- **Auto-complete**: When all children complete, parent can auto-complete

When deleting a parent task, you can choose to:
1. Delete all subtasks as well
2. Convert subtasks to standalone tasks

## Subtask Display

Tasks are visually indented with tree characters:
```
1   Main Task (Grandparent)     ...  ▼
2   ├─ Subtask 1 (Parent)       ...  ▼
3   └── Sub-subtask 1 (Child)   ...
4   ├─ Subtask 2 (Parent)       ...
```

Click ▼ to collapse children, ▶ to expand.

## Data Model

```javascript
{
  id: number,                    // Auto-generated, sequential
  name: string,                  // Task name (required)
  dueDate: datetime,             // Optional due date
  status: "Not Started" | "In Progress" | "Blocked" | "Completed",
  project: string,               // Optional project name
  priority: "Low" | "Medium" | "High" | "Critical" | null,
  notes: [                       // Array of timestamped notes
    {
      timestamp: datetime,
      content: string
    }
  ],
  parentTaskId: number | null,   // ID of parent task (null if standalone)
  childTaskIds: [number],        // Array of child task IDs
  deleted: boolean,              // Soft delete flag
  deletedAt: datetime            // Deletion timestamp
}
```

## Visual Features

### Overdue Tasks
Tasks with due dates in the past (and not completed) display:
- "OVERDUE!" text in red
- Glowing/pulsing row animation
- Critical priority styling

### Completed Tasks
- Strikethrough text styling
- Reduced opacity
- Priority automatically removed (sorted to bottom)

### Status & Priority Badges
- Color-coded badges for easy visual scanning
- Priority badges with borders
- Critical priority has pulsing animation
- Click to quick-change via dropdown

## Storage & Data

- **Database**: IndexedDB browser database
- **Capacity**: 100MB to unlimited (browser-dependent)
- **Persistence**: Data persists across browser sessions
- **Privacy**: All data stored locally, never sent to a server
- **Export**: JSON backup with full data structure
- **CSV Export**: Spreadsheet-compatible format with notes

## Browser Compatibility

Works on all modern browsers that support:
- IndexedDB
- ES6+ JavaScript
- CSS3 animations
- CSS Variables
- Flexbox

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 15+ (including corporate Edge)

## File Structure

```
silverlake/
├── index.html           # Main HTML file
├── styles.css           # Terminal styling
├── taskManager.js       # Data model and IndexedDB layer
├── commandParser.js     # Command parsing logic
├── app.js               # Main application logic
├── README.md            # This file
└── SECURITY.md          # Security assessment
```

## Development

All code is vanilla JavaScript - no build process required.

### To modify:
1. Edit the relevant JavaScript file
2. Refresh the browser
3. IndexedDB persists between reloads

### To reset data:
Open browser console and run:
```javascript
indexedDB.deleteDatabase('TaskManagerDB');
location.reload();
```

## Examples

### Example 1: Create a 3-level project hierarchy
```
:A
Name: Q4 Planning
Project: Strategy
Priority: High

:A
Name: Marketing Campaign
Project: Strategy
Parent Task ID: 1

:A
Name: Design Social Media Assets
Project: Strategy
Parent Task ID: 2
```

Result:
```
1   Q4 Planning              High    ▼
2   ├─ Marketing Campaign    High    ▼
3   └── Design Social...     Medium
```

### Example 2: Filter and manage tasks
```
:Filter_Project="Strategy"      # Shows task 1, 2, and 3 (full family)
:Filter_ID=3                    # Shows task 3 AND parents 1, 2
:Sort_by_priority               # Sort by priority
:clear                          # Show all tasks again
```

### Example 3: Quick status/priority changes
```
# Click on status badge to see dropdown
# Click on priority badge to see dropdown
# Press ESC to close without selecting
# Or click outside the dropdown
```

### Example 4: Using keyboard navigation
```
J/K or ↑/↓    # Navigate through tasks
Enter         # Modify selected task
C             # Mark selected as Completed
!             # Mark selected as Critical
U             # Undo last action
R             # Redo
```

### Example 5: Collapse/expand tasks
```
# Click ▼ next to "Q4 Planning" to collapse
# All children and grandchildren are hidden
# Click ▶ to expand again
```

## Tips & Best Practices

1. **Use Projects**: Group related tasks with project names for easy filtering
2. **Set Priorities**: Use priority levels to focus on important work
3. **Add Notes**: Use the notes field to track progress and decisions
4. **Command History**: Press ↑ to repeat recent commands
5. **Keyboard First**: Learn keyboard shortcuts for faster workflow
6. **Hierarchical Planning**: Break large tasks into 3-level hierarchies
7. **Fold Large Trees**: Collapse completed task families to reduce clutter
8. **Regular Backups**: Use `:export` to create JSON backups

## Troubleshooting

### App won't initialize
- Check browser console for errors
- Ensure IndexedDB is enabled in browser settings
- Try clearing browser cache and reloading

### Data disappeared
- Check browser privacy settings
- Ensure you're not in private/incognito mode
- IndexedDB may be disabled in browser settings

### Commands not working
- Ensure command starts with `:` (colon)
- Check spelling - commands are case-insensitive
- Type `:h` to see correct command syntax

### Dropdown won't close
- Press `Esc` key
- Click outside the dropdown
- Click the Cancel button

## Security & Data Isolation

See [SECURITY.md](SECURITY.md) for a comprehensive security assessment.

### GitHub Pages Hosting - Data Isolation Guarantee

**Important for IT teams:** When hosted on GitHub Pages, **GitHub cannot access, read, or collect any user task data**. Here's why:

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Pages Server                          │
│  (Static file hosting only - serves HTML, CSS, JS files)        │
│  • No server-side code execution                                 │
│  • No database connections                                       │
│  • No request logging of application data                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Initial page load only
                              │ (static files: ~50KB)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      User's Browser                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Silverlake App                            ││
│  │  • All JavaScript runs locally in browser                   ││
│  │  • Zero network requests after initial load                 ││
│  │  • No fetch(), XMLHttpRequest, or WebSocket calls           ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   IndexedDB (Local)                          ││
│  │  • Browser-native database                                  ││
│  │  • Sandboxed per origin (same-origin policy)                ││
│  │  • Data stored on user's device ONLY                        ││
│  │  • Cannot be accessed by GitHub or any external server      ││
│  │  • Persists across browser sessions                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### Technical Verification

1. **No Outbound Data Transmission**
   - Code audit confirms: zero `fetch()`, `XMLHttpRequest`, or `WebSocket` usage
   - No analytics scripts (Google Analytics, etc.)
   - No tracking pixels or beacons
   - No third-party JavaScript libraries

2. **Browser Storage Isolation**
   - IndexedDB enforces same-origin policy
   - Data isolated to `username.github.io` domain
   - Cannot be accessed by GitHub's servers or other domains
   - Other browser tabs/sites cannot access this data

3. **External Resources**
   - Only external resource: Google Fonts (JetBrains Mono typeface)
   - Font loading does not transmit any application or user data

4. **What GitHub Can See**
   - HTTP access logs: IP address, timestamp, browser user-agent
   - These logs contain NO task content, names, notes, or user data
   - Standard web server logging (same as any website visit)

#### For Corporate/Enterprise Use

This architecture is suitable for:
- **Air-gapped environments** (works offline after initial load)
- **High-security networks** (no data exfiltration possible)
- **GDPR/Privacy compliance** (no personal data collection)
- **Auditable deployments** (open-source, verifiable code)

**Key Security Features:**
- 100% client-side, no server communication
- XSS prevention with HTML escaping
- Input validation on all user data
- No external JavaScript dependencies
- No cookies or tracking
- Data never leaves the user's device

## License

This project is provided as-is for personal use.

## Version

Silverlake v1.1

---

**Built with vanilla JavaScript and IndexedDB - no dependencies, no tracking, just tasks.**
