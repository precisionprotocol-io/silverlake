# Silverlake - Command-Line Style Task Manager

A web-based task management system with a terminal/command-line aesthetic, inspired by Taskwarrior. Built for local, single-user task management with a vim-style command interface.

## Features

- **Terminal Aesthetic**: Dark theme with monospace fonts and command-line interface
- **Vim-Style Commands**: Intuitive colon commands for all operations
- **Hierarchical Tasks**: Support for parent/child tasks (max 2-level hierarchy)
- **Advanced Filtering**: Filter by ID, project, priority, or status
- **Priority Sorting**: Sort tasks by priority (Critical → Low)
- **Due Date Tracking**: Overdue tasks highlighted with glowing animation
- **Command History**: Navigate previous commands with arrow keys
- **IndexedDB Storage**: 100MB+ capacity for unlimited tasks
- **Keyboard-Driven**: Minimal mouse interaction required
- **Zero Setup**: Just open in browser - no installation needed

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: IndexedDB (browser-native)
- **Font**: JetBrains Mono (loaded from Google Fonts)
- **Storage**: Local browser storage (100MB+ capacity)

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
| `:D [task_id]` | Delete task |

### Filtering

| Command | Example | Description |
|---------|---------|-------------|
| `:Filter_ID=1` | `:Filter_ID=5` | Show single task |
| `:Filter_ID=[1,2,5]` | `:Filter_ID=[1,3,7]` | Show multiple specific tasks |
| `:Filter_ID=[1~10]` | `:Filter_ID=[5~15]` | Show range of tasks |
| `:Filter_Project="Name"` | `:Filter_Project="Alpha"` | Filter by project name |
| `:Filter_Priority="High"` | `:Filter_Priority="Critical"` | Filter by priority |
| `:Filter_Status="In Progress"` | `:Filter_Status="Completed"` | Filter by status |

### Sorting & Utility

| Command | Description |
|---------|-------------|
| `:Sort_by_priority` | Sort tasks by priority (Critical → Low) |
| `:clear` or `:c` | Clear all filters, show all tasks |
| `:help` or `:h` | Show command reference |
| `:quit` or `:q` | Info about closing the app |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate command history |
| `Esc` | Clear command input |
| `Ctrl+Enter` | Submit modal form |
| `Enter` | Execute command / Submit form |

## Task Properties

### Status Options
- **Not Started** (Gray) - Default status
- **In Progress** (Cyan) - Task is being worked on
- **Blocked** (Red) - Task is blocked by dependencies
- **Completed** (Green) - Task is finished

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

Tasks support a 2-level hierarchy:
- **Parent tasks**: Standalone tasks that can have subtasks
- **Child tasks**: Subtasks of a parent task
- **Constraint**: A subtask cannot have its own subtasks (max 2 levels)

When deleting a parent task, you can choose to:
1. Delete all subtasks as well
2. Convert subtasks to standalone tasks

## Data Model

```javascript
{
  id: number,                    // Auto-generated, sequential
  name: string,                  // Task name (required)
  dueDate: datetime,             // Optional due date
  status: "Not Started" | "In Progress" | "Blocked" | "Completed",
  project: string,               // Optional project name
  priority: "Low" | "Medium" | "High" | "Critical",
  notes: [                       // Array of timestamped notes
    {
      timestamp: datetime,
      content: string
    }
  ],
  parentTaskId: number,          // ID of parent task (null if standalone)
  childTaskIds: [number]         // Array of child task IDs
}
```

## Visual Features

### Overdue Tasks
Tasks with due dates in the past (and not completed) display:
- "OVERDUE!" text in red
- Glowing/pulsing row animation
- Critical priority styling

### Subtask Display
Subtasks are visually indented with tree characters:
```
1  Main Task           ...
2  └─ Subtask 1        ...
3  └─ Subtask 2        ...
```

### Status & Priority Badges
- Color-coded badges for easy visual scanning
- Priority badges with borders
- Critical priority has pulsing animation

## Storage & Data

- **Database**: IndexedDB browser database
- **Capacity**: 100MB to unlimited (browser-dependent)
- **Persistence**: Data persists across browser sessions
- **Privacy**: All data stored locally, never sent to a server
- **Export/Import**: Built-in methods for data backup (see taskManager.js)

## Browser Compatibility

Works on all modern browsers that support:
- IndexedDB
- ES6 JavaScript
- CSS3 animations
- Flexbox

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## File Structure

```
silverlake/
├── index.html           # Main HTML file
├── styles.css           # Terminal styling
├── taskManager.js       # Data model and IndexedDB layer
├── commandParser.js     # Command parsing logic
├── app.js              # Main application logic
└── README.md           # This file
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

### Example 1: Create a project with subtasks
```
:A
Name: Build Website
Project: WebDev
Priority: High
Due Date: +7d
Status: In Progress

:A
Name: Design Mockups
Project: WebDev
Priority: High
Parent Task ID: 1

:A
Name: Write HTML/CSS
Project: WebDev
Priority: Medium
Parent Task ID: 1
```

### Example 2: Filter and manage tasks
```
:Filter_Project="WebDev"        # Show only WebDev tasks
:Sort_by_priority               # Sort by priority
:M 2                            # Modify task #2
:clear                          # Show all tasks again
```

### Example 3: Using date shortcuts
```
:A
Name: Daily Standup
Due Date: today
Priority: Medium

:A
Name: Code Review
Due Date: tomorrow

:A
Name: Sprint Planning
Due Date: +3d
```

## Tips & Best Practices

1. **Use Projects**: Group related tasks with project names for easy filtering
2. **Set Priorities**: Use priority levels to focus on important work
3. **Add Notes**: Use the notes field to track progress and decisions
4. **Command History**: Press ↑ to repeat recent commands
5. **Keyboard First**: Learn keyboard shortcuts for faster workflow
6. **Hierarchical Planning**: Break large tasks into subtasks

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

## License

This project is provided as-is for personal use.

## Version

Silverlake v1.0

---

**Built with ❤️ using Vanilla JavaScript and IndexedDB**
