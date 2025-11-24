/**
 * CommandParser - Handles command parsing and execution
 */

class CommandParser {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
    }

    /**
     * Parse and execute a command
     */
    async execute(commandString) {
        if (!commandString || commandString.trim() === '') {
            return { success: false, message: 'No command entered' };
        }

        // Add to history
        this.addToHistory(commandString);

        const trimmed = commandString.trim();

        // Remove leading colon if present
        const command = trimmed.startsWith(':') ? trimmed.substring(1) : trimmed;

        // Parse command and arguments
        const parts = this.parseCommand(command);
        const cmd = parts.command.toLowerCase();
        const args = parts.args;

        try {
            // Route to appropriate handler
            if (cmd === 'a' || cmd === 'add') {
                return this.handleAdd();
            } else if (cmd === 'm' || cmd === 'modify') {
                return await this.handleModify(args);
            } else if (cmd === 'd' || cmd === 'delete') {
                return await this.handleDelete(args);
            } else if (cmd.startsWith('filter') || cmd === 'f') {
                return this.handleFilter(command);
            } else if (cmd.startsWith('sort') || cmd === 's') {
                return this.handleSort(args);
            } else if (cmd === 'clear' || cmd === 'c') {
                return { success: true, action: 'clear' };
            } else if (cmd === 'help' || cmd === 'h') {
                return this.handleHelp();
            } else if (cmd === 'privacy') {
                return { success: true, action: 'show_privacy' };
            } else if (cmd === 'export') {
                return { success: true, action: 'export_data' };
            } else if (cmd === 'csv') {
                return { success: true, action: 'export_csv' };
            } else if (cmd === 'import') {
                return { success: true, action: 'import_data' };
            } else if (cmd === 'trash') {
                return { success: true, action: 'show_trash' };
            } else if (cmd === 'restore') {
                return await this.handleRestore(args);
            } else if (cmd === 'purge') {
                return await this.handlePurge(args);
            } else if (cmd === 'query' || cmd === 'search' || cmd === '?') {
                return { success: true, action: 'show_search' };
            } else if (cmd === 'q' || cmd === 'quit') {
                return { success: true, message: 'Silverlake is a web app - just close the tab to quit!' };
            } else {
                return { success: false, message: `Unknown command: ${cmd}. Type :h for help.` };
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Parse command string into command and arguments
     * Supports both ":m 1" and ":m1" formats
     */
    parseCommand(commandString) {
        // Match pattern like :m1 or :M1 or :d5
        const compactMatch = commandString.match(/^([a-zA-Z]+)(\d+.*)$/);

        if (compactMatch) {
            // Compact format: :m1 -> command: 'm', args: ['1']
            return {
                command: compactMatch[1],
                args: compactMatch[2].split(/\s+/).filter(a => a.length > 0)
            };
        }

        // Standard format: :m 1 -> command: 'm', args: ['1']
        const parts = commandString.split(/\s+/);
        return {
            command: parts[0] || '',
            args: parts.slice(1)
        };
    }

    /**
     * Handle :A (Add) command
     */
    handleAdd() {
        return {
            success: true,
            action: 'prompt_add'
        };
    }

    /**
     * Handle :M (Modify) command
     */
    async handleModify(args) {
        if (args.length === 0) {
            return { success: false, message: 'Usage: :M [task_id]' };
        }

        const taskId = parseInt(args[0]);
        if (isNaN(taskId)) {
            return { success: false, message: 'Invalid task ID' };
        }

        const task = await this.taskManager.getTaskById(taskId);
        if (!task) {
            return { success: false, message: `Task with ID ${taskId} not found` };
        }

        return {
            success: true,
            action: 'prompt_modify',
            data: { task }
        };
    }

    /**
     * Handle :D (Delete) command
     * Supports: :d1, :d[1,2,5], :d[1~10], :d[1-10]
     */
    async handleDelete(args) {
        if (args.length === 0) {
            return { success: false, message: 'Usage: :D [task_id] or :D[1,2,5] or :D[1~10]' };
        }

        const firstArg = args[0];
        let taskIds = [];

        // Check if it's array or range format
        if (firstArg.startsWith('[') && firstArg.endsWith(']')) {
            const inner = firstArg.slice(1, -1);

            // Range format: [1~10] or [1-10]
            if (inner.includes('~') || inner.includes('-')) {
                const separator = inner.includes('~') ? '~' : '-';
                const [start, end] = inner.split(separator).map(n => parseInt(n.trim()));

                if (isNaN(start) || isNaN(end)) {
                    return { success: false, message: 'Invalid range format. Use: :D[1~10] or :D[1-10]' };
                }

                for (let i = start; i <= end; i++) {
                    taskIds.push(i);
                }
            } else {
                // Array format: [1,2,5]
                taskIds = inner.split(',').map(n => parseInt(n.trim()));

                if (taskIds.some(id => isNaN(id))) {
                    return { success: false, message: 'Invalid task IDs in array. Use: :D[1,2,5]' };
                }
            }
        } else {
            // Single task ID
            const taskId = parseInt(firstArg);
            if (isNaN(taskId)) {
                return { success: false, message: 'Invalid task ID' };
            }
            taskIds = [taskId];
        }

        // Fetch all tasks
        const tasks = [];
        const notFound = [];

        for (const id of taskIds) {
            const task = await this.taskManager.getTaskById(id);
            if (task) {
                tasks.push(task);
            } else {
                notFound.push(id);
            }
        }

        if (tasks.length === 0) {
            return { success: false, message: `No valid tasks found for IDs: ${taskIds.join(', ')}` };
        }

        // Single task - use existing delete confirmation
        if (tasks.length === 1) {
            return {
                success: true,
                action: 'prompt_delete',
                data: { task: tasks[0] }
            };
        }

        // Multiple tasks - use bulk delete confirmation
        return {
            success: true,
            action: 'prompt_bulk_delete',
            data: { tasks, notFound }
        };
    }

    /**
     * Handle :restore command
     */
    async handleRestore(args) {
        if (args.length === 0) {
            return { success: false, message: 'Usage: :restore [task_id]' };
        }

        const taskId = parseInt(args[0]);
        if (isNaN(taskId)) {
            return { success: false, message: 'Invalid task ID' };
        }

        const task = await this.taskManager.getTaskById(taskId);
        if (!task) {
            return { success: false, message: `Task with ID ${taskId} not found` };
        }

        if (!task.deleted) {
            return { success: false, message: `Task #${taskId} is not in trash` };
        }

        return {
            success: true,
            action: 'restore_task',
            data: { taskId }
        };
    }

    /**
     * Handle :purge command
     */
    async handlePurge(args) {
        if (args.length === 0) {
            return { success: false, message: 'Usage: :purge [task_id] or :purge_all' };
        }

        const firstArg = args[0];

        // Check for purge_all
        if (firstArg.toLowerCase() === 'all') {
            return {
                success: true,
                action: 'purge_all'
            };
        }

        const taskId = parseInt(firstArg);
        if (isNaN(taskId)) {
            return { success: false, message: 'Invalid task ID' };
        }

        const task = await this.taskManager.getTaskById(taskId);
        if (!task) {
            return { success: false, message: `Task with ID ${taskId} not found` };
        }

        if (!task.deleted) {
            return { success: false, message: `Task #${taskId} is not in trash. Use :D to delete it first.` };
        }

        return {
            success: true,
            action: 'purge_task',
            data: { taskId }
        };
    }

    /**
     * Handle Filter commands
     */
    handleFilter(commandString) {
        const filters = {};

        // Parse filter parameters
        // Format: Filter_ID=1 or Filter_Project="name" or Filter_Status="value"
        // Supports negation: Filter_Status!="Completed"

        // ID filter - supports single, array, or range
        const idMatch = commandString.match(/Filter_ID(!=|=)(\[.*?\]|\d+)/i);
        if (idMatch) {
            const operator = idMatch[1];
            const idValue = idMatch[2];
            const negate = operator === '!=';

            if (idValue.startsWith('[')) {
                // Array or range
                const inner = idValue.slice(1, -1);
                if (inner.includes('~')) {
                    // Range format: [1~10]
                    const [start, end] = inner.split('~').map(n => parseInt(n.trim()));
                    const ids = [];
                    for (let i = start; i <= end; i++) {
                        ids.push(i);
                    }
                    filters.id = { value: ids, negate };
                } else {
                    // Array format: [1,2,5]
                    filters.id = { value: inner.split(',').map(n => parseInt(n.trim())), negate };
                }
            } else {
                // Single ID
                filters.id = { value: parseInt(idValue), negate };
            }
        }

        // Project filter - handles quoted and unquoted values
        const projectMatch = commandString.match(/Filter_Project(!=|=)(["'])([^"']+)\2|Filter_Project(!=|=)([^\s]+)/i);
        if (projectMatch) {
            const operator = projectMatch[1] || projectMatch[4];
            const value = projectMatch[3] || projectMatch[5];
            filters.project = { value, negate: operator === '!=' };
        }

        // Priority filter - handles quoted and unquoted values
        const priorityMatch = commandString.match(/Filter_Priority(!=|=)(["'])([^"']+)\2|Filter_Priority(!=|=)([^\s]+)/i);
        if (priorityMatch) {
            const operator = priorityMatch[1] || priorityMatch[4];
            const value = priorityMatch[3] || priorityMatch[5];
            filters.priority = { value, negate: operator === '!=' };
        }

        // Status filter - handles quoted and unquoted values
        const statusMatch = commandString.match(/Filter_Status(!=|=)(["'])([^"']+)\2|Filter_Status(!=|=)([^\s]+)/i);
        if (statusMatch) {
            const operator = statusMatch[1] || statusMatch[4];
            const value = statusMatch[3] || statusMatch[5];
            filters.status = { value: this.expandStatus(value), negate: operator === '!=' };
        }

        if (Object.keys(filters).length === 0) {
            return { success: false, message: 'No valid filter parameters found. Example: :Filter_ID=1 or :Filter_Project="Alpha" or :Filter_Status!="Completed"' };
        }

        return {
            success: true,
            action: 'filter',
            data: { filters }
        };
    }

    /**
     * Handle Sort command
     */
    handleSort(args) {
        const sortType = args.join('_').toLowerCase();

        if (sortType.includes('priority')) {
            return {
                success: true,
                action: 'sort',
                data: { sortBy: 'priority' }
            };
        }

        return { success: false, message: 'Usage: :Sort_by_priority' };
    }

    /**
     * Handle Help command
     */
    handleHelp() {
        return {
            success: true,
            action: 'show_help'
        };
    }

    /**
     * Expand status abbreviations
     */
    expandStatus(abbrev) {
        const statusMap = {
            'n': 'Not Started',
            'i': 'In Progress',
            'b': 'Blocked',
            'c': 'Completed'
        };

        const lower = abbrev.toLowerCase();
        return statusMap[lower] || abbrev;
    }

    /**
     * Expand priority abbreviations
     */
    expandPriority(abbrev) {
        const priorityMap = {
            'l': 'Low',
            'm': 'Medium',
            'h': 'High',
            'c': 'Critical'
        };

        const lower = abbrev.toLowerCase();
        return priorityMap[lower] || abbrev;
    }

    /**
     * Add command to history
     */
    addToHistory(command) {
        // Don't add duplicates of the last command
        if (this.commandHistory.length > 0 &&
            this.commandHistory[this.commandHistory.length - 1] === command) {
            return;
        }

        this.commandHistory.push(command);

        // Limit history size
        if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory.shift();
        }

        this.historyIndex = this.commandHistory.length;
    }

    /**
     * Get previous command from history
     */
    getPreviousCommand() {
        if (this.commandHistory.length === 0) return null;

        if (this.historyIndex > 0) {
            this.historyIndex--;
        }

        return this.commandHistory[this.historyIndex];
    }

    /**
     * Get next command from history
     */
    getNextCommand() {
        if (this.commandHistory.length === 0) return null;

        if (this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
            return this.commandHistory[this.historyIndex];
        } else {
            this.historyIndex = this.commandHistory.length;
            return '';
        }
    }

    /**
     * Reset history index
     */
    resetHistoryIndex() {
        this.historyIndex = this.commandHistory.length;
    }

    /**
     * Get command suggestions for autocomplete
     */
    getSuggestions(partial) {
        const commands = [
            ':A', ':add',
            ':M', ':modify',
            ':D', ':delete',
            ':Filter_ID=',
            ':Filter_Project=',
            ':Filter_Priority=',
            ':Filter_Status=',
            ':Sort_by_priority',
            ':clear', ':c',
            ':help', ':h',
            ':quit', ':q'
        ];

        const lower = partial.toLowerCase();
        return commands.filter(cmd => cmd.toLowerCase().startsWith(lower));
    }
}
