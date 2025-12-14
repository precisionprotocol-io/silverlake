/**
 * Main Application Logic
 */

class TaskTerminalApp {
    constructor() {
        this.taskManager = new TaskManager();
        this.commandParser = new CommandParser(this.taskManager);
        this.currentFilters = null;
        this.currentSort = null;
        this.isInitialized = false;

        // Navigation state
        this.selectedTaskIndex = 0;
        this.visibleTasks = [];
        this.navigationMode = true; // true = navigation mode, false = command mode

        // Folding state - tracks which parent tasks are collapsed
        this.collapsedTasks = new Set();

        // Notification state
        this.notificationPermission = 'default';
        this.notifiedTaskIds = new Set(); // Track which tasks we've already notified about
        this.notificationCheckInterval = null;

        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Initialize IndexedDB
            await this.taskManager.init();

            // Initialize UI
            this.initializeUI();
            this.attachEventListeners();

            // Initial render
            await this.render();

            // Initialize notifications
            await this.initNotifications();

            this.isInitialized = true;
            this.showMessage('Silverlake initialized successfully', 'success');
        } catch (error) {
            console.error('Initialization error:', error);
            alert('Failed to initialize Silverlake: ' + error.message);
        }
    }

    /**
     * Initialize UI elements
     */
    initializeUI() {
        this.commandInput = document.getElementById('commandInput');
        this.commandInputArea = document.getElementById('commandInputArea');
        this.commandPlaceholder = document.getElementById('commandPlaceholder');
        this.terminalDisplay = document.getElementById('terminalDisplay');
        this.taskTable = document.getElementById('taskTable');
        this.modal = document.getElementById('modal');
        this.modalHeader = document.getElementById('modalHeader');
        this.modalBody = document.getElementById('modalBody');
        this.modalSubmit = document.getElementById('modalSubmit');
        this.modalCancel = document.getElementById('modalCancel');

        // Mobile elements
        this.fabAddTask = document.getElementById('fabAddTask');
        this.mobileModifyBtn = document.getElementById('mobileModifyBtn');
        this.mobileCompleteBtn = document.getElementById('mobileCompleteBtn');
        this.mobileDeleteBtn = document.getElementById('mobileDeleteBtn');
        this.mobileCommandBtn = document.getElementById('mobileCommandBtn');

        // Command modal elements
        this.commandModal = document.getElementById('commandModal');
        this.commandModalInput = document.getElementById('commandModalInput');
        this.commandModalClose = document.getElementById('commandModalClose');
        this.commandSuggestions = document.getElementById('commandSuggestions');

        // Auto-completion state
        this.selectedSuggestionIndex = -1;
        this.currentSuggestions = [];

        // Available commands for auto-completion
        this.availableCommands = [
            { cmd: 'add', aliases: ['a'], desc: 'Add a new task' },
            { cmd: 'modify', aliases: ['m'], desc: 'Modify task by ID (e.g., :m 1)' },
            { cmd: 'delete', aliases: ['d'], desc: 'Delete task by ID (e.g., :d 1)' },
            { cmd: 'filter', aliases: ['f'], desc: 'Filter tasks (e.g., :filter status:in-progress)' },
            { cmd: 'filter_status', aliases: [], desc: 'Filter by status' },
            { cmd: 'filter_priority', aliases: [], desc: 'Filter by priority' },
            { cmd: 'filter_project', aliases: [], desc: 'Filter by project' },
            { cmd: 'sort', aliases: ['s'], desc: 'Sort tasks by priority' },
            { cmd: 'clear', aliases: ['c'], desc: 'Clear filters, show all tasks' },
            { cmd: 'search', aliases: ['query', '?'], desc: 'Search tasks' },
            { cmd: 'help', aliases: ['h'], desc: 'Show help' },
            { cmd: 'export', aliases: [], desc: 'Export tasks as JSON' },
            { cmd: 'csv', aliases: [], desc: 'Export tasks as CSV' },
            { cmd: 'import', aliases: [], desc: 'Import tasks from JSON' },
            { cmd: 'trash', aliases: [], desc: 'View deleted tasks' },
            { cmd: 'restore', aliases: [], desc: 'Restore deleted task (e.g., :restore 1)' },
            { cmd: 'purge', aliases: [], desc: 'Permanently delete from trash' },
            { cmd: 'privacy', aliases: [], desc: 'Show privacy information' },
        ];
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Command input
        this.commandInput.addEventListener('keydown', (e) => this.handleCommandKeydown(e));

        // Command input placeholder management
        this.commandInput.addEventListener('input', () => {
            // Show placeholder only when value is exactly ':'
            if (this.commandInput.value === ':') {
                this.commandPlaceholder.classList.remove('hidden');
            } else {
                this.commandPlaceholder.classList.add('hidden');
            }
        });

        // Modal buttons
        this.modalSubmit.addEventListener('click', () => this.handleModalSubmit());
        this.modalCancel.addEventListener('click', () => this.closeModal());

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Modal keyboard shortcuts
            if (this.modal.classList.contains('active')) {
                if (e.key === 'Escape') {
                    this.closeModal();
                } else if (e.key === 'Enter') {
                    // Check if we're in a textarea (allow Enter for new lines)
                    const isTextarea = e.target.tagName === 'TEXTAREA';

                    if (isTextarea && !e.ctrlKey) {
                        // In textarea, Enter creates new line unless Ctrl is held
                        return;
                    }

                    // Check if a button is focused (for delete confirmation, etc.)
                    const isButton = e.target.tagName === 'BUTTON';
                    if (isButton) {
                        e.preventDefault();
                        e.target.click();
                        return;
                    }

                    // For all other inputs, or Ctrl+Enter in textarea, submit the form
                    if (!isTextarea || e.ctrlKey) {
                        e.preventDefault();
                        this.handleModalSubmit();
                    }
                }
                return;
            }

            // Navigation mode keyboard shortcuts
            if (this.navigationMode) {
                this.handleNavigationKeydown(e);
            }
        });

        // No automatic focus - let navigation mode handle it

        // Mobile FAB and action bar
        if (this.fabAddTask) {
            this.fabAddTask.addEventListener('click', () => this.showAddTaskModal());
        }
        if (this.mobileModifyBtn) {
            this.mobileModifyBtn.addEventListener('click', () => this.modifySelectedTask());
        }
        if (this.mobileCompleteBtn) {
            this.mobileCompleteBtn.addEventListener('click', () => this.completeSelectedTask());
        }
        if (this.mobileDeleteBtn) {
            this.mobileDeleteBtn.addEventListener('click', () => this.deleteSelectedTask());
        }
        if (this.mobileCommandBtn) {
            this.mobileCommandBtn.addEventListener('click', () => this.enterCommandMode());
        }

        // Command modal event listeners
        if (this.commandModalClose) {
            this.commandModalClose.addEventListener('click', () => this.closeCommandModal());
        }
        if (this.commandModalInput) {
            this.commandModalInput.addEventListener('input', () => this.updateCommandSuggestions());
            this.commandModalInput.addEventListener('keydown', (e) => this.handleCommandModalKeydown(e));
        }
        if (this.commandModal) {
            this.commandModal.addEventListener('click', (e) => {
                if (e.target === this.commandModal) {
                    this.closeCommandModal();
                }
            });
        }
    }

    /**
     * Handle navigation mode keyboard shortcuts
     */
    handleNavigationKeydown(e) {
        // Switch to command mode when : is pressed
        if (e.key === ':' || e.key === ';') {
            e.preventDefault();
            this.enterCommandMode();
            return;
        }

        // Arrow key navigation
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateUp();
            return;
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateDown();
            return;
        }

        // Single-key shortcuts (only if not in an input field)
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            if (e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                this.showAddTaskModal();
            } else if (e.key === 'm' || e.key === 'M') {
                e.preventDefault();
                this.modifySelectedTask();
            } else if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                this.deleteSelectedTask();
            } else if (e.key === 'c' || e.key === 'C') {
                e.preventDefault();
                this.completeSelectedTask();
            } else if (e.key === '!') {
                e.preventDefault();
                this.setCriticalPriority();
            } else if (e.key === 'u' || e.key === 'U') {
                e.preventDefault();
                this.undoAction();
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                this.redoAction();
            } else if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                this.toggleSelectedTaskFold();
            }
        }
    }

    /**
     * Handle command input keydown
     */
    handleCommandKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.executeCommand();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = this.commandParser.getPreviousCommand();
            if (prev) {
                this.commandInput.value = prev;
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = this.commandParser.getNextCommand();
            if (next !== null) {
                this.commandInput.value = next;
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.exitCommandMode();
        }
    }

    /**
     * Execute command from input
     */
    async executeCommand() {
        if (!this.isInitialized) {
            this.showMessage('Please wait, initializing...', 'info');
            return;
        }

        const command = this.commandInput.value;
        const result = await this.commandParser.execute(command);

        if (result.success) {
            // Handle action
            if (result.action === 'prompt_add') {
                this.showAddTaskModal();
            } else if (result.action === 'prompt_modify') {
                this.showModifyTaskModal(result.data.task);
            } else if (result.action === 'prompt_delete') {
                this.showDeleteConfirmation(result.data.task);
            } else if (result.action === 'prompt_bulk_delete') {
                this.showBulkDeleteConfirmation(result.data.tasks, result.data.notFound);
            } else if (result.action === 'filter') {
                this.currentFilters = result.data.filters;
                this.currentSort = null;
                await this.render();
                this.showMessage('Filter applied', 'success');
            } else if (result.action === 'sort') {
                this.currentSort = result.data.sortBy;
                await this.render();
                this.showMessage('Tasks sorted by priority', 'success');
            } else if (result.action === 'clear') {
                this.currentFilters = null;
                this.currentSort = null;
                await this.render();
                this.showMessage('Filters cleared, showing all tasks', 'info');
            } else if (result.action === 'show_help') {
                this.showHelp();
            } else if (result.action === 'show_privacy') {
                this.showPrivacy();
            } else if (result.action === 'show_search') {
                await this.showSearch();
            } else if (result.action === 'export_data') {
                await this.exportData();
            } else if (result.action === 'export_csv') {
                await this.exportCSV();
            } else if (result.action === 'import_data') {
                this.importData();
            } else if (result.action === 'show_trash') {
                await this.showTrash();
            } else if (result.action === 'restore_task') {
                await this.restoreTask(result.data.taskId);
            } else if (result.action === 'purge_task') {
                await this.purgeTask(result.data.taskId);
            } else if (result.action === 'purge_all') {
                await this.purgeAll();
            } else if (result.message) {
                this.showMessage(result.message, 'info');
            }
        } else {
            this.showMessage(result.message, 'error');
        }

        // Clear input and return to navigation mode for non-modal commands
        const modalActions = ['prompt_add', 'prompt_modify', 'prompt_delete', 'prompt_bulk_delete', 'show_help', 'show_privacy', 'show_search'];
        if (!modalActions.includes(result.action)) {
            this.exitCommandMode();
        } else {
            this.commandInput.value = '';
            this.commandParser.resetHistoryIndex();
        }
    }

    /**
     * Show add task modal
     */
    async showAddTaskModal() {
        this.modalHeader.textContent = 'Add New Task';

        // Get all tasks to check if parent field should be shown
        const allTasks = await this.taskManager.getAllTasks();
        // Filter to only show tasks that can be parents (depth < 2)
        const potentialParents = [];
        for (const task of allTasks) {
            const depth = await this.taskManager.getTaskDepth(task);
            if (depth < 2) {
                potentialParents.push(task);
            }
        }
        const hasAvailableParents = potentialParents.length > 0;

        // Build parent task toggle and field HTML (only if there are potential parents)
        const parentToggleHtml = hasAvailableParents ? `
            <div class="form-field" id="parentToggleContainer">
                <button type="button" id="parentTaskToggle" class="parent-toggle-btn" style="
                    background: transparent;
                    border: 1px dashed var(--border-color);
                    color: var(--text-secondary);
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 13px;
                    width: 100%;
                    text-align: left;
                    transition: all 0.2s;
                ">+ Add as subtask (optional)</button>
                <input type="hidden" id="taskParent" value="">
            </div>
            <div class="form-field" id="parentSearchContainer" style="display: none;">
                <label class="form-label">Parent Task</label>
                <div class="parent-search-container" style="position: relative;">
                    <input type="text" id="parentSearchInput" class="form-input" placeholder="Search for parent task..." autocomplete="off">
                    <div id="parentSearchResults" class="parent-search-results" style="
                        display: none;
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        max-height: 200px;
                        overflow-y: auto;
                        background-color: var(--bg-secondary);
                        border: 1px solid var(--border-color);
                        border-top: none;
                        border-radius: 0 0 4px 4px;
                        z-index: 1000;
                    "></div>
                </div>
                <span class="form-hint">Type to search, click or Enter to select. <a href="#" id="cancelParentSelection" style="color: var(--status-blocked);">Cancel</a></span>
            </div>
        ` : '<input type="hidden" id="taskParent" value="">';

        const formHtml = `
            <div class="form-field">
                <label class="form-label">Name *</label>
                <input type="text" id="taskName" class="form-input" placeholder="Task name" required>
            </div>
            ${parentToggleHtml}
            <div class="form-field">
                <label class="form-label">Due Date</label>
                <button type="button" id="addTaskDueDateButton" class="form-date-button">
                    <span id="addTaskDueDateDisplay">Click to select date</span>
                </button>
                <input type="hidden" id="taskDueDate" value="">
                <span class="form-hint">Click to open calendar picker</span>
            </div>
            <div class="form-field">
                <label class="form-label">Status</label>
                <select id="taskStatus" class="form-select">
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Completed">Completed</option>
                </select>
            </div>
            <div class="form-field">
                <label class="form-label">Project</label>
                <input type="text" id="taskProject" class="form-input" placeholder="Project name">
            </div>
            <div class="form-field">
                <label class="form-label">Priority</label>
                <select id="taskPriority" class="form-select">
                    <option value="Low">Low</option>
                    <option value="Medium" selected>Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                </select>
            </div>
            <div class="form-field">
                <label class="form-label">Notes</label>
                <textarea id="taskNotes" class="form-textarea" placeholder="Optional notes"></textarea>
            </div>
        `;

        this.modalBody.innerHTML = formHtml;
        this.showModal();

        // Attach calendar widget to date button
        const dueDateButton = document.getElementById('addTaskDueDateButton');
        if (dueDateButton) {
            dueDateButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showModalCalendar('taskDueDate', 'addTaskDueDateDisplay');
            });
        }

        // Set up parent task toggle and search if available
        if (hasAvailableParents) {
            const toggleBtn = document.getElementById('parentTaskToggle');
            const toggleContainer = document.getElementById('parentToggleContainer');
            const searchContainer = document.getElementById('parentSearchContainer');
            const cancelLink = document.getElementById('cancelParentSelection');
            const hiddenInput = document.getElementById('taskParent');

            toggleBtn.addEventListener('click', () => {
                toggleContainer.style.display = 'none';
                searchContainer.style.display = 'block';
                this.setupParentTaskSearch(potentialParents);
                document.getElementById('parentSearchInput').focus();
            });

            // Hover effect for toggle button
            toggleBtn.addEventListener('mouseenter', () => {
                toggleBtn.style.borderColor = 'var(--status-in-progress)';
                toggleBtn.style.color = 'var(--text-primary)';
            });
            toggleBtn.addEventListener('mouseleave', () => {
                toggleBtn.style.borderColor = 'var(--border-color)';
                toggleBtn.style.color = 'var(--text-secondary)';
            });

            cancelLink.addEventListener('click', (e) => {
                e.preventDefault();
                searchContainer.style.display = 'none';
                toggleContainer.style.display = 'block';
                hiddenInput.value = '';
                document.getElementById('parentSearchInput').value = '';
            });
        }

        // Focus on name input
        document.getElementById('taskName').focus();
    }

    /**
     * Show modify task modal
     */
    async showModifyTaskModal(task) {
        this.modalHeader.textContent = `Modify Task #${task.id}`;

        const dueDateDisplay = task.dueDate
            ? new Date(task.dueDate).toLocaleString('en-AU', {
                timeZone: 'Australia/Sydney',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'Click to select date';

        // Get all tasks to check if parent field should be shown
        const allTasks = await this.taskManager.getAllTasks();
        // Filter to only show tasks that can be parents (depth < 2) and exclude current task and its descendants
        const taskDescendants = await this.taskManager.getAllDescendants(task);
        const descendantIds = new Set(taskDescendants.map(t => t.id));
        descendantIds.add(task.id); // Can't be parent of itself

        const potentialParents = [];
        for (const t of allTasks) {
            if (descendantIds.has(t.id)) continue; // Skip self and descendants
            const depth = await this.taskManager.getTaskDepth(t);
            if (depth < 2) {
                potentialParents.push(t);
            }
        }
        const hasAvailableParents = potentialParents.length > 0;

        // Get current parent task name if exists
        let currentParentDisplay = '';
        if (task.parentTaskId !== null) {
            const currentParent = await this.taskManager.getTaskById(task.parentTaskId);
            if (currentParent) {
                currentParentDisplay = `#${currentParent.id} - ${currentParent.name}`;
            }
        }

        // Build parent task toggle and field HTML
        let parentFieldHtml;
        if (hasAvailableParents) {
            if (task.parentTaskId !== null) {
                // Task already has a parent - show the search field with current value
                parentFieldHtml = `
                    <input type="hidden" id="taskParent" value="${task.parentTaskId}">
                    <div class="form-field" id="parentToggleContainer" style="display: none;">
                        <button type="button" id="parentTaskToggle" class="parent-toggle-btn" style="
                            background: transparent;
                            border: 1px dashed var(--border-color);
                            color: var(--text-secondary);
                            padding: 8px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 13px;
                            width: 100%;
                            text-align: left;
                            transition: all 0.2s;
                        ">+ Set parent task (optional)</button>
                    </div>
                    <div class="form-field" id="parentSearchContainer">
                        <label class="form-label">Parent Task</label>
                        <div class="parent-search-container" style="position: relative;">
                            <input type="text" id="parentSearchInput" class="form-input" value="${this.escapeHtml(currentParentDisplay)}" placeholder="Search for parent task..." autocomplete="off">
                            <div id="parentSearchResults" class="parent-search-results" style="
                                display: none;
                                position: absolute;
                                top: 100%;
                                left: 0;
                                right: 0;
                                max-height: 200px;
                                overflow-y: auto;
                                background-color: var(--bg-secondary);
                                border: 1px solid var(--border-color);
                                border-top: none;
                                border-radius: 0 0 4px 4px;
                                z-index: 1000;
                            "></div>
                        </div>
                        <span class="form-hint">Type to search, click or Enter to select. <a href="#" id="clearParentSelection" style="color: var(--status-blocked);">Remove parent</a></span>
                    </div>
                `;
            } else {
                // Task has no parent - show toggle button
                parentFieldHtml = `
                    <div class="form-field" id="parentToggleContainer">
                        <button type="button" id="parentTaskToggle" class="parent-toggle-btn" style="
                            background: transparent;
                            border: 1px dashed var(--border-color);
                            color: var(--text-secondary);
                            padding: 8px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 13px;
                            width: 100%;
                            text-align: left;
                            transition: all 0.2s;
                        ">+ Set parent task (optional)</button>
                        <input type="hidden" id="taskParent" value="">
                    </div>
                    <div class="form-field" id="parentSearchContainer" style="display: none;">
                        <label class="form-label">Parent Task</label>
                        <div class="parent-search-container" style="position: relative;">
                            <input type="text" id="parentSearchInput" class="form-input" placeholder="Search for parent task..." autocomplete="off">
                            <div id="parentSearchResults" class="parent-search-results" style="
                                display: none;
                                position: absolute;
                                top: 100%;
                                left: 0;
                                right: 0;
                                max-height: 200px;
                                overflow-y: auto;
                                background-color: var(--bg-secondary);
                                border: 1px solid var(--border-color);
                                border-top: none;
                                border-radius: 0 0 4px 4px;
                                z-index: 1000;
                            "></div>
                        </div>
                        <span class="form-hint">Type to search, click or Enter to select. <a href="#" id="cancelParentSelection" style="color: var(--status-blocked);">Cancel</a></span>
                    </div>
                `;
            }
        } else {
            parentFieldHtml = '<input type="hidden" id="taskParent" value="">';
        }

        const formHtml = `
            <div class="form-field">
                <label class="form-label">Name *</label>
                <input type="text" id="taskName" class="form-input" value="${this.escapeHtml(task.name)}" required>
            </div>
            ${parentFieldHtml}
            <div class="form-field">
                <label class="form-label">Due Date</label>
                <button type="button" id="modifyTaskDueDateButton" class="form-date-button">
                    <span id="modifyTaskDueDateDisplay">${dueDateDisplay}</span>
                </button>
                <input type="hidden" id="taskDueDate" value="${task.dueDate || ''}">
                <span class="form-hint">Click to open calendar picker</span>
            </div>
            <div class="form-field">
                <label class="form-label">Status</label>
                <select id="taskStatus" class="form-select">
                    <option value="Not Started" ${task.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
                    <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Blocked" ${task.status === 'Blocked' ? 'selected' : ''}>Blocked</option>
                    <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
            </div>
            <div class="form-field">
                <label class="form-label">Project</label>
                <input type="text" id="taskProject" class="form-input" value="${this.escapeHtml(task.project || '')}">
            </div>
            <div class="form-field">
                <label class="form-label">Priority</label>
                <select id="taskPriority" class="form-select">
                    <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
                    <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
                    <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
                    <option value="Critical" ${task.priority === 'Critical' ? 'selected' : ''}>Critical</option>
                </select>
            </div>
            <div class="form-field">
                <label class="form-label">Add Note</label>
                <textarea id="taskNotes" class="form-textarea" placeholder="Add a new note (existing notes preserved)"></textarea>
            </div>
        `;

        this.modalBody.innerHTML = formHtml;
        this.modalBody.dataset.taskId = task.id;
        this.modalBody.dataset.action = 'modify';
        this.showModal();

        // Attach calendar widget to date button
        const dueDateButton = document.getElementById('modifyTaskDueDateButton');
        if (dueDateButton) {
            dueDateButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showModalCalendar('taskDueDate', 'modifyTaskDueDateDisplay');
            });
        }

        // Set up parent task toggle and search if available
        if (hasAvailableParents) {
            const toggleBtn = document.getElementById('parentTaskToggle');
            const toggleContainer = document.getElementById('parentToggleContainer');
            const searchContainer = document.getElementById('parentSearchContainer');
            const hiddenInput = document.getElementById('taskParent');

            if (task.parentTaskId !== null) {
                // Task has parent - set up search and clear link
                this.setupParentTaskSearch(potentialParents);
                const clearLink = document.getElementById('clearParentSelection');
                if (clearLink) {
                    clearLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        hiddenInput.value = '';
                        document.getElementById('parentSearchInput').value = '';
                        searchContainer.style.display = 'none';
                        toggleContainer.style.display = 'block';
                    });
                }
            } else {
                // Task has no parent - set up toggle
                const cancelLink = document.getElementById('cancelParentSelection');

                toggleBtn.addEventListener('click', () => {
                    toggleContainer.style.display = 'none';
                    searchContainer.style.display = 'block';
                    this.setupParentTaskSearch(potentialParents);
                    document.getElementById('parentSearchInput').focus();
                });

                // Hover effect for toggle button
                toggleBtn.addEventListener('mouseenter', () => {
                    toggleBtn.style.borderColor = 'var(--status-in-progress)';
                    toggleBtn.style.color = 'var(--text-primary)';
                });
                toggleBtn.addEventListener('mouseleave', () => {
                    toggleBtn.style.borderColor = 'var(--border-color)';
                    toggleBtn.style.color = 'var(--text-secondary)';
                });

                if (cancelLink) {
                    cancelLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        searchContainer.style.display = 'none';
                        toggleContainer.style.display = 'block';
                        hiddenInput.value = '';
                        document.getElementById('parentSearchInput').value = '';
                    });
                }
            }
        }

        document.getElementById('taskName').focus();
    }

    /**
     * Show delete confirmation
     */
    showDeleteConfirmation(task) {
        this.modalHeader.textContent = `Delete Task #${task.id}`;

        const hasChildren = task.childTaskIds && task.childTaskIds.length > 0;

        let confirmHtml = `
            <div class="confirm-dialog">
                <p class="confirm-dialog-text">
                    Are you sure you want to delete task "${this.escapeHtml(task.name)}"?
                </p>
        `;

        if (hasChildren) {
            confirmHtml += `
                <p class="confirm-dialog-warning">
                    This task has ${task.childTaskIds.length} subtask(s).
                </p>
                <div class="confirm-dialog-options">
                    <button class="confirm-option-btn" data-action="delete-with-children">
                        Delete task and all subtasks
                    </button>
                    <button class="confirm-option-btn" data-action="delete-convert-children">
                        Delete task, convert subtasks to standalone
                    </button>
                </div>
            `;
        } else {
            confirmHtml += `
                <button class="confirm-option-btn" data-action="delete-simple">
                    Yes, delete this task
                </button>
            `;
        }

        confirmHtml += `</div>`;

        this.modalBody.innerHTML = confirmHtml;
        this.modalBody.dataset.taskId = task.id;
        this.modalBody.dataset.action = 'delete';
        this.showModal();

        // Hide default submit button
        this.modalSubmit.style.display = 'none';

        // Add click handlers to option buttons
        const optionButtons = this.modalBody.querySelectorAll('.confirm-option-btn');
        optionButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                const taskId = parseInt(this.modalBody.dataset.taskId);

                try {
                    if (action === 'delete-with-children') {
                        await this.taskManager.deleteTask(taskId, true);
                    } else {
                        await this.taskManager.deleteTask(taskId, false);
                    }

                    this.showMessage(`Task #${taskId} deleted successfully`, 'success');
                    await this.render();
                    this.closeModal();
                } catch (error) {
                    this.showMessage(error.message, 'error');
                }
            });
        });

        // Focus first button for keyboard support (Enter to confirm)
        if (optionButtons.length > 0) {
            setTimeout(() => optionButtons[0].focus(), 100);
        }
    }

    /**
     * Show bulk delete confirmation for multiple tasks
     */
    showBulkDeleteConfirmation(tasks, notFound) {
        this.modalHeader.textContent = `Delete ${tasks.length} Tasks`;

        let confirmHtml = `
            <div class="confirm-dialog">
                <p class="confirm-dialog-text">
                    Are you sure you want to delete ${tasks.length} task(s)?
                </p>
        `;

        // Show task list
        if (tasks.length <= 10) {
            confirmHtml += '<div class="bulk-delete-list">';
            tasks.forEach(task => {
                confirmHtml += `<div class="bulk-delete-item">#${task.id}: ${this.escapeHtml(task.name)}</div>`;
            });
            confirmHtml += '</div>';
        } else {
            confirmHtml += `<p class="confirm-dialog-warning">Tasks ${tasks[0].id} through ${tasks[tasks.length - 1].id}</p>`;
        }

        // Show not found warning if any
        if (notFound.length > 0) {
            confirmHtml += `
                <p class="confirm-dialog-warning">
                    Note: ${notFound.length} task(s) not found: ${notFound.join(', ')}
                </p>
            `;
        }

        confirmHtml += `
                <button class="confirm-option-btn" data-action="bulk-delete">
                    Yes, delete ${tasks.length} task(s)
                </button>
            </div>
        `;

        this.modalBody.innerHTML = confirmHtml;
        this.modalBody.dataset.action = 'bulk_delete';
        this.showModal();

        // Hide default submit button
        this.modalSubmit.style.display = 'none';

        // Add click handler
        const deleteBtn = this.modalBody.querySelector('.confirm-option-btn');
        deleteBtn.addEventListener('click', async () => {
            try {
                let deleted = 0;
                for (const task of tasks) {
                    await this.taskManager.deleteTask(task.id, false);
                    deleted++;
                }

                this.showMessage(`Successfully deleted ${deleted} task(s)`, 'success');
                await this.render();
                this.closeModal();
            } catch (error) {
                this.showMessage('Bulk delete failed: ' + error.message, 'error');
            }
        });

        // Focus button for keyboard support
        setTimeout(() => deleteBtn.focus(), 100);
    }

    /**
     * Show help modal
     */
    showHelp() {
        this.modalHeader.textContent = 'Command Reference';
        this.modalBody.dataset.action = 'help';

        const helpHtml = `
            <div class="help-section">
                <div class="help-title">Task Management</div>
                <div class="help-command">
                    <span class="help-command-name">:A</span> or <span class="help-command-name">:add</span> - Add a new task
                </div>
                <div class="help-command">
                    <span class="help-command-name">:M [task_id]</span> or <span class="help-command-name">:modify [task_id]</span> - Modify existing task
                </div>
                <div class="help-command">
                    <span class="help-command-name">:D [task_id]</span> or <span class="help-command-name">:delete [task_id]</span> - Delete single task
                </div>
                <div class="help-command">
                    <span class="help-command-name">:D[1,2,5]</span> - Delete multiple specific tasks
                </div>
                <div class="help-command">
                    <span class="help-command-name">:D[1~10]</span> or <span class="help-command-name">:D[1-10]</span> - Delete range of tasks
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Search</div>
                <div class="help-command">
                    <span class="help-command-name">:query</span>, <span class="help-command-name">:search</span>, or <span class="help-command-name">:?</span> - Open search modal (search by name, ID, or project)
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Filtering</div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_ID=1</span> - Show single task
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_ID=[1,2,5]</span> - Show multiple specific tasks
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_ID=[1~10]</span> - Show range of tasks (inclusive)
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_ID!=[1,2,5]</span> - Exclude specific tasks
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_Project="ProjectName"</span> - Filter by project (case-insensitive)
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_Project!="Archive"</span> - Exclude project
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_Priority="High"</span> - Filter by priority
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_Priority!="Low"</span> - Exclude priority
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_Status="In Progress"</span> - Filter by status
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_Status!="Completed"</span> - Exclude status
                </div>
                <div class="help-command" style="margin-top: 10px; color: var(--text-muted); font-style: italic;">
                    Note: Filtering includes all ancestors and descendants automatically
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Task Hierarchy</div>
                <div class="help-command">Supports 3 levels: Grandparent → Parent → Child</div>
                <div class="help-command">Click ▼/▶ icon or press <span class="help-command-name">F</span> to fold/unfold children</div>
                <div class="help-command">Filtering on any task shows its full family tree</div>
            </div>

            <div class="help-section">
                <div class="help-title">Sorting</div>
                <div class="help-command">
                    <span class="help-command-name">:Sort_by_priority</span> - Sort by priority (Critical → Low)
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Trash Management</div>
                <div class="help-command">
                    <span class="help-command-name">:trash</span> - View deleted tasks (recycle bin)
                </div>
                <div class="help-command">
                    <span class="help-command-name">:restore [task_id]</span> - Restore task from trash
                </div>
                <div class="help-command">
                    <span class="help-command-name">:purge [task_id]</span> - Permanently delete task (cannot be undone)
                </div>
                <div class="help-command">
                    <span class="help-command-name">:purge all</span> - Empty trash (cannot be undone)
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Other Commands</div>
                <div class="help-command">
                    <span class="help-command-name">:clear</span> or <span class="help-command-name">:c</span> - Clear all filters, show all tasks
                </div>
                <div class="help-command">
                    <span class="help-command-name">:export</span> - Export all tasks to JSON backup file
                </div>
                <div class="help-command">
                    <span class="help-command-name">:csv</span> - Export all tasks to CSV file
                </div>
                <div class="help-command">
                    <span class="help-command-name">:import</span> - Import tasks from JSON backup file
                </div>
                <div class="help-command">
                    <span class="help-command-name">:help</span> or <span class="help-command-name">:h</span> - Show this help
                </div>
                <div class="help-command">
                    <span class="help-command-name">:privacy</span> - Show privacy and security information
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Keyboard Shortcuts (Navigation Mode)</div>
                <div class="help-command"><span class="help-command-name">↑/↓</span> - Navigate tasks</div>
                <div class="help-command"><span class="help-command-name">A</span> - Add new task</div>
                <div class="help-command"><span class="help-command-name">M</span> - Modify selected task</div>
                <div class="help-command"><span class="help-command-name">D</span> - Delete selected task</div>
                <div class="help-command"><span class="help-command-name">C</span> - Complete selected task</div>
                <div class="help-command"><span class="help-command-name">F</span> - Fold/Unfold selected task children</div>
                <div class="help-command"><span class="help-command-name">!</span> - Set Critical priority</div>
                <div class="help-command"><span class="help-command-name">U</span> - Undo last action</div>
                <div class="help-command"><span class="help-command-name">R</span> - Redo last undone action</div>
                <div class="help-command"><span class="help-command-name">:</span> - Enter command mode</div>
                <div class="help-command"><span class="help-command-name">Esc</span> - Exit command mode</div>
                <div class="help-command"><span class="help-command-name">Ctrl+Enter</span> - Submit modal form</div>
            </div>

            <div class="help-section">
                <div class="help-title">Status Abbreviations</div>
                <div class="help-command">N = Not Started, I = In Progress, B = Blocked, C = Completed</div>
            </div>

            <div class="help-section">
                <div class="help-title">Priority Abbreviations</div>
                <div class="help-command">L = Low, M = Medium, H = High, C = Critical</div>
            </div>

            <div class="help-section">
                <div class="help-title">Database Information</div>
                <div class="help-command">Storage: IndexedDB (100MB+ capacity)</div>
                <div class="help-command">Data is stored locally in your browser</div>
            </div>
        `;

        this.modalBody.innerHTML = helpHtml;
        this.showModal();

        // Hide submit button for help
        this.modalSubmit.style.display = 'none';
    }

    /**
     * Show privacy & security information
     */
    showPrivacy() {
        this.modalHeader.textContent = 'Privacy & Security';
        this.modalBody.dataset.action = 'privacy';

        const privacyHtml = `
            <div class="help-section">
                <div class="help-title">100% Local, Zero Cloud Processing</div>
                <div class="help-command">
                    Silverlake runs entirely in your browser. Your task data never leaves your device.
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Data Storage</div>
                <div class="help-command">
                    <strong>Technology:</strong> IndexedDB (browser-native database)
                </div>
                <div class="help-command">
                    <strong>Location:</strong> Stored locally on your computer
                </div>
                <div class="help-command">
                    <strong>Capacity:</strong> 100MB+ (enough for hundreds of thousands of tasks)
                </div>
                <div class="help-command">
                    <strong>Persistence:</strong> Data persists across browser sessions
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">No Server Communication</div>
                <div class="help-command">
                    • No backend servers
                </div>
                <div class="help-command">
                    • No cloud sync
                </div>
                <div class="help-command">
                    • No analytics or tracking
                </div>
                <div class="help-command">
                    • No data collection
                </div>
                <div class="help-command">
                    • No network requests (after initial page load)
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Data Control</div>
                <div class="help-command">
                    <strong>Export:</strong> Use <span class="help-command-name">:export</span> to backup data as JSON
                </div>
                <div class="help-command">
                    <strong>Import:</strong> Use <span class="help-command-name">:import</span> to restore from backup
                </div>
                <div class="help-command">
                    <strong>CSV Export:</strong> Use <span class="help-command-name">:csv</span> for spreadsheet export
                </div>
                <div class="help-command">
                    <strong>Clear Data:</strong> Use browser settings to clear IndexedDB storage
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Browser Isolation</div>
                <div class="help-command">
                    • Each browser has separate storage (Chrome vs Firefox = different databases)
                </div>
                <div class="help-command">
                    • Incognito/Private mode uses temporary storage (deleted when window closes)
                </div>
                <div class="help-command">
                    • Data is sandboxed per domain (only accessible on this site)
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Security Architecture</div>
                <div class="help-command">
                    <strong>Client-Side Only:</strong> All processing happens in your browser
                </div>
                <div class="help-command">
                    <strong>No Authentication:</strong> No login = no password risks
                </div>
                <div class="help-command">
                    <strong>No Third-Party APIs:</strong> Zero external dependencies
                </div>
                <div class="help-command">
                    <strong>Open Source:</strong> Code is publicly available on GitHub
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">What This Means</div>
                <div class="help-command">
                    ✓ Your tasks are completely private
                </div>
                <div class="help-command">
                    ✓ No one can access your data (not even us)
                </div>
                <div class="help-command">
                    ✓ Works offline after initial load
                </div>
                <div class="help-command">
                    ✓ No subscription or account required
                </div>
                <div class="help-command">
                    ✓ Zero hosting costs (static files only)
                </div>
                <div class="help-command">
                    ✓ Enterprise-friendly (no data leaves corporate network)
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Repository</div>
                <div class="help-command">
                    GitHub: <a href="https://github.com/precisionprotocol-io/silverlake" target="_blank" style="color: var(--status-in-progress);">github.com/precisionprotocol-io/silverlake</a>
                </div>
            </div>
        `;

        this.modalBody.innerHTML = privacyHtml;
        this.showModal();

        // Hide submit button for privacy info
        this.modalSubmit.style.display = 'none';
    }

    /**
     * Show search modal
     */
    async showSearch() {
        this.modalHeader.textContent = 'Search Tasks';
        this.modalBody.dataset.action = 'search';

        const searchHtml = `
            <div class="form-field">
                <label class="form-label" for="searchInput">Search by name or ID</label>
                <input
                    type="text"
                    id="searchInput"
                    class="form-input"
                    placeholder="Type to search..."
                    autocomplete="off"
                />
                <span class="form-hint">Search supports partial name matching (case-insensitive) or exact ID</span>
            </div>
            <div id="searchResults" style="margin-top: 20px; max-height: 400px; overflow-y: auto;">
                <div style="color: var(--text-muted); text-align: center; padding: 20px;">
                    Start typing to search...
                </div>
            </div>
        `;

        this.modalBody.innerHTML = searchHtml;
        this.showModal();

        // Hide submit button for search
        this.modalSubmit.style.display = 'none';

        // Store reference to taskManager for use in event handler
        const taskManager = this.taskManager;
        const escapeHtml = this.escapeHtml.bind(this);
        const closeModal = this.closeModal.bind(this);
        const render = this.render.bind(this);
        const showMessage = this.showMessage.bind(this);
        const self = this;

        // Wait for DOM to be ready (important for Edge browser)
        setTimeout(() => {
            // Set up real-time search
            const searchInput = document.getElementById('searchInput');
            const searchResults = document.getElementById('searchResults');

            if (!searchInput || !searchResults) {
                console.error('Search elements not found');
                return;
            }

            searchInput.addEventListener('input', async (e) => {
                const query = e.target.value.trim();

                if (query === '') {
                    searchResults.innerHTML = `
                        <div style="color: var(--text-muted); text-align: center; padding: 20px;">
                            Start typing to search...
                        </div>
                    `;
                    return;
                }

                // Get fresh task list on each search
                const allTasks = await taskManager.getAllTasks();

                // Search by ID (exact match) or name (partial match, case-insensitive)
                const queryLower = query.toLowerCase();
                const queryId = parseInt(query);

                const matches = allTasks.filter(task => {
                    // Check ID match
                    if (!isNaN(queryId) && task.id === queryId) {
                        return true;
                    }

                    // Check name match (case-insensitive, partial)
                    if (task.name.toLowerCase().includes(queryLower)) {
                        return true;
                    }

                    // Check project match
                    if (task.project && task.project.toLowerCase().includes(queryLower)) {
                        return true;
                    }

                    return false;
                });

                if (matches.length === 0) {
                    searchResults.innerHTML = `
                        <div style="color: var(--text-muted); text-align: center; padding: 20px;">
                            No tasks found matching "${escapeHtml(query)}"
                        </div>
                    `;
                    return;
                }

                // Display results
                let resultsHtml = `
                    <div style="margin-bottom: 10px; color: var(--text-secondary); font-size: 12px;">
                        Found ${matches.length} task${matches.length === 1 ? '' : 's'}
                    </div>
                `;

                matches.forEach(task => {
                    const statusClass = task.status.toLowerCase().replace(/\s+/g, '-');
                    const priorityClass = task.priority ? task.priority.toLowerCase() : 'none';
                    const priorityText = task.priority || '-';
                    const subtaskIndicator = task.parentTaskId ? '<span style="color: var(--text-muted); margin-right: 5px;">└─</span>' : '';

                    resultsHtml += `
                        <div class="search-result-item" data-task-id="${task.id}" style="
                            padding: 12px;
                            margin-bottom: 8px;
                            background-color: var(--bg-secondary);
                            border: 1px solid var(--border-color);
                            border-radius: 4px;
                            cursor: pointer;
                            transition: all 0.2s;
                        " onmouseover="this.style.borderColor='var(--status-in-progress)'; this.style.backgroundColor='var(--bg-primary)';"
                           onmouseout="this.style.borderColor='var(--border-color)'; this.style.backgroundColor='var(--bg-secondary)';">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                                <span style="color: var(--text-muted); font-size: 12px;">#${task.id}</span>
                                <span class="status-badge status-${statusClass}">${task.status}</span>
                                <span class="priority-badge priority-${priorityClass}">${priorityText}</span>
                            </div>
                            <div style="font-size: 14px; margin-bottom: 5px;">
                                ${subtaskIndicator}${escapeHtml(task.name)}
                            </div>
                            ${task.project ? `<div style="font-size: 12px; color: var(--text-secondary);">Project: ${escapeHtml(task.project)}</div>` : ''}
                            ${task.dueDate ? `<div style="font-size: 12px; color: var(--text-secondary);">Due: ${taskManager.formatDate(task.dueDate)}</div>` : ''}
                        </div>
                    `;
                });

                searchResults.innerHTML = resultsHtml;

                // Add click handlers to results (query within searchResults only)
                searchResults.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        const taskId = parseInt(item.dataset.taskId);
                        closeModal();

                        // Apply filter to show the selected task and its family tree
                        self.currentFilters = {
                            id: { value: taskId, negate: false }
                        };
                        await render();
                        showMessage(`Showing task #${taskId}`, 'success');
                    });
                });
            });

            // Focus the search input
            searchInput.focus();
        }, 50); // Small delay to ensure DOM is ready
    }

    /**
     * Set up parent task search functionality
     */
    setupParentTaskSearch(potentialParents) {
        const searchInput = document.getElementById('parentSearchInput');
        const hiddenInput = document.getElementById('taskParent');
        const resultsContainer = document.getElementById('parentSearchResults');

        if (!searchInput || !hiddenInput || !resultsContainer) return;

        let selectedIndex = -1;
        let currentMatches = [];

        const updateResults = (query) => {
            if (query === '') {
                resultsContainer.style.display = 'none';
                currentMatches = [];
                selectedIndex = -1;
                return;
            }

            const queryLower = query.toLowerCase();
            const queryId = parseInt(query);

            currentMatches = potentialParents.filter(task => {
                if (!isNaN(queryId) && task.id === queryId) return true;
                if (task.name.toLowerCase().includes(queryLower)) return true;
                if (task.project && task.project.toLowerCase().includes(queryLower)) return true;
                return false;
            });

            if (currentMatches.length === 0) {
                resultsContainer.innerHTML = `
                    <div style="padding: 10px; color: var(--text-muted); text-align: center;">
                        No matching tasks found
                    </div>
                `;
                resultsContainer.style.display = 'block';
                selectedIndex = -1;
                return;
            }

            selectedIndex = 0; // Auto-select first result
            renderResults();
        };

        const renderResults = () => {
            let html = '';
            currentMatches.forEach((task, index) => {
                const subtaskIndicator = task.parentTaskId ? '└─ ' : '';

                html += `
                    <div class="parent-result-item" data-task-id="${task.id}" data-index="${index}" style="
                        padding: 8px 12px;
                        cursor: pointer;
                        background-color: var(--bg-secondary);
                        border-left: 2px solid transparent;
                        transition: all 0.1s;
                    ">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="color: var(--text-muted); font-size: 11px;">#${task.id}</span>
                            <span style="font-size: 13px;">${subtaskIndicator}${this.escapeHtml(task.name)}</span>
                        </div>
                        ${task.project ? `<div style="font-size: 11px; color: var(--text-secondary); margin-left: 30px;">Project: ${this.escapeHtml(task.project)}</div>` : ''}
                    </div>
                `;
            });
            resultsContainer.innerHTML = html;
            resultsContainer.style.display = 'block';

            // Update visual selection
            updateSelectionHighlight();

            // Add click and hover handlers
            resultsContainer.querySelectorAll('.parent-result-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectParent(parseInt(item.dataset.taskId));
                });
                item.addEventListener('mouseenter', () => {
                    selectedIndex = parseInt(item.dataset.index);
                    updateSelectionHighlight();
                });
            });
        };

        const updateSelectionHighlight = () => {
            resultsContainer.querySelectorAll('.parent-result-item').forEach((item, index) => {
                if (index === selectedIndex) {
                    item.style.backgroundColor = 'var(--bg-primary)';
                    item.style.borderLeftColor = 'var(--status-in-progress)';
                } else {
                    item.style.backgroundColor = 'var(--bg-secondary)';
                    item.style.borderLeftColor = 'transparent';
                }
            });
        };

        const selectParent = (taskId) => {
            const task = potentialParents.find(t => t.id === taskId);
            if (task) {
                hiddenInput.value = taskId;
                searchInput.value = `#${task.id} - ${task.name}`;
                resultsContainer.style.display = 'none';
                currentMatches = [];
                selectedIndex = -1;
                // Move focus to name input
                document.getElementById('taskName').focus();
            }
        };

        const clearParent = () => {
            hiddenInput.value = '';
            searchInput.value = '';
            resultsContainer.style.display = 'none';
            currentMatches = [];
            selectedIndex = -1;
        };

        // Input event for searching
        searchInput.addEventListener('input', (e) => {
            // If user clears the input, also clear the hidden value
            if (e.target.value === '') {
                hiddenInput.value = '';
            }
            updateResults(e.target.value.trim());
        });

        // Keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            if (currentMatches.length === 0) {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent form submit when no matches
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, currentMatches.length - 1);
                renderResults();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                renderResults();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < currentMatches.length) {
                    selectParent(currentMatches[selectedIndex].id);
                }
            } else if (e.key === 'Escape') {
                resultsContainer.style.display = 'none';
                selectedIndex = -1;
            }
        });

        // Close results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                resultsContainer.style.display = 'none';
            }
        }, { once: false });

        // Show results when focusing on input if there's text
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim() && !hiddenInput.value) {
                updateResults(searchInput.value.trim());
            }
        });
    }

    /**
     * Handle modal submit
     */
    handleModalSubmit() {
        const action = this.modalBody.dataset.action;

        if (action === 'modify') {
            this.submitModifyTask();
        } else if (action === 'delete' || action === 'bulk_delete' || action === 'view_notes' || action === 'help' || action === 'privacy') {
            // Delete, bulk_delete, view_notes, help, and privacy use custom buttons or no form
            return;
        } else if (action === 'add' || !action) {
            // Explicitly handle add action or default to add for backwards compatibility
            this.submitAddTask();
        }
    }

    /**
     * Submit add task form
     */
    async submitAddTask() {
        try {
            const name = document.getElementById('taskName').value.trim();
            const dueDateStr = document.getElementById('taskDueDate').value.trim();
            const status = document.getElementById('taskStatus').value;
            const project = document.getElementById('taskProject').value.trim();
            const priority = document.getElementById('taskPriority').value;
            const notesStr = document.getElementById('taskNotes').value.trim();
            const parentElement = document.getElementById('taskParent');
            const parentStr = parentElement ? parentElement.value.trim() : '';

            if (!name) {
                throw new Error('Task name is required');
            }

            const taskData = {
                name,
                status,
                project: project || null,
                priority,
                parentTaskId: parentStr ? parseInt(parentStr) : null
            };

            // Use due date from hidden input (already in ISO format from calendar)
            if (dueDateStr) {
                taskData.dueDate = dueDateStr;
            }

            // Parse notes
            if (notesStr) {
                taskData.notes = [{
                    timestamp: new Date().toISOString(),
                    content: notesStr
                }];
            }

            const task = await this.taskManager.createTask(taskData);
            this.showMessage(`Task #${task.id} "${task.name}" created successfully`, 'success');
            await this.render();
            this.closeModal();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    /**
     * Submit modify task form
     */
    async submitModifyTask() {
        try {
            const taskId = parseInt(this.modalBody.dataset.taskId);
            const name = document.getElementById('taskName').value.trim();
            const dueDateStr = document.getElementById('taskDueDate').value.trim();
            const status = document.getElementById('taskStatus').value;
            const project = document.getElementById('taskProject').value.trim();
            const priority = document.getElementById('taskPriority').value;
            const notesStr = document.getElementById('taskNotes').value.trim();
            const parentStr = document.getElementById('taskParent').value.trim();

            if (!name) {
                throw new Error('Task name is required');
            }

            const updates = {
                name,
                status,
                project: project || null,
                priority,
                parentTaskId: parentStr ? parseInt(parentStr) : null
            };

            // Use due date from hidden input (already in ISO format from calendar)
            updates.dueDate = dueDateStr || null;

            await this.taskManager.updateTask(taskId, updates);

            // Add note if provided
            if (notesStr) {
                await this.taskManager.addNote(taskId, notesStr);
            }

            this.showMessage(`Task #${taskId} updated successfully`, 'success');
            await this.render();
            this.closeModal();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    /**
     * Show modal
     */
    showModal() {
        this.modal.classList.add('active');
        this.modalSubmit.style.display = 'inline-block';
    }

    /**
     * Close modal
     */
    closeModal() {
        this.modal.classList.remove('active');
        this.modalBody.innerHTML = '';
        this.modalBody.dataset.action = '';
        this.modalBody.dataset.taskId = '';

        // Return to navigation mode
        this.navigationMode = true;
        this.commandInput.blur();
    }

    /**
     * Show message
     */
    showMessage(text, type = 'info') {
        const existingMessage = this.terminalDisplay.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = text;

        this.terminalDisplay.insertBefore(messageDiv, this.taskTable);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    /**
     * Render tasks
     */
    async render() {
        try {
            let tasks = await this.taskManager.getAllTasks();

            // Apply filters
            if (this.currentFilters) {
                tasks = await this.taskManager.filterTasks(this.currentFilters);
            }

            // Apply sort (default: sort by priority and due date)
            tasks = this.taskManager.sortByPriority(tasks);

            // Organize hierarchically
            tasks = this.taskManager.getTasksHierarchical(tasks);

            if (tasks.length === 0) {
                this.visibleTasks = [];
                this.selectedTaskIndex = 0;
                this.taskTable.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-title">No tasks found</div>
                        <div class="empty-state-text">Press 'a' to add a new task, or ':' for commands</div>
                    </div>
                `;
                return;
            }

            // Array to track actually visible (rendered) tasks
            const actuallyVisibleTasks = [];

            // Build table
            let tableHtml = `
                <table class="task-table">
                    <thead>
                        <tr>
                            <th class="col-id">ID</th>
                            <th class="col-name">Name</th>
                            <th class="col-due">Due Date</th>
                            <th class="col-status">Status</th>
                            <th class="col-project">Project</th>
                            <th class="col-priority">Priority</th>
                            <th class="col-parent">Parent</th>
                            <th class="col-notes">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Build a map for quick depth calculation
            const taskMap = new Map(tasks.map(t => [t.id, t]));
            const getDepth = (t) => {
                let depth = 0;
                let current = t;
                while (current.parentTaskId !== null && current.parentTaskId !== undefined) {
                    depth++;
                    current = taskMap.get(current.parentTaskId);
                    if (!current) break;
                }
                return depth;
            };

            // Check if task is hidden due to collapsed ancestor
            const isHiddenByCollapse = (t) => {
                let current = t;
                while (current.parentTaskId !== null && current.parentTaskId !== undefined) {
                    if (this.collapsedTasks.has(current.parentTaskId)) {
                        return true;
                    }
                    current = taskMap.get(current.parentTaskId);
                    if (!current) break;
                }
                return false;
            };

            tasks.forEach(task => {
                // Skip if hidden due to collapsed parent
                if (isHiddenByCollapse(task)) {
                    return;
                }

                // Track this task as actually visible
                actuallyVisibleTasks.push(task);

                const isOverdue = this.taskManager.isTaskOverdue(task);
                const depth = getDepth(task);
                const isCompleted = task.status === 'Completed';
                const hasChildren = task.childTaskIds && task.childTaskIds.length > 0;
                const isCollapsed = this.collapsedTasks.has(task.id);

                let rowClass = '';
                if (isCompleted) {
                    rowClass = 'completed';
                } else if (isOverdue) {
                    rowClass = 'overdue';
                }

                // Determine name class based on depth
                let nameClass = 'task-name';
                if (depth === 1) {
                    nameClass = 'task-name subtask';
                } else if (depth >= 2) {
                    nameClass = 'task-name grandchild';
                }

                // Fold toggle for tasks with children
                let foldToggle = '';
                if (hasChildren) {
                    const toggleIcon = isCollapsed ? '▶' : '▼';
                    foldToggle = `<span class="fold-toggle" data-task-id="${task.id}" title="Click to ${isCollapsed ? 'expand' : 'collapse'}">${toggleIcon}</span>`;
                }

                const statusClass = `status-badge status-${task.status.toLowerCase().replace(' ', '-')}`;
                const priorityClass = task.priority ? `priority-badge priority-${task.priority.toLowerCase()}` : 'priority-badge priority-none';
                const priorityText = task.priority || '-';
                const dueDateClass = isOverdue ? 'due-date overdue' : 'due-date';

                const notesCount = task.notes && task.notes.length > 0 ? task.notes.length : 0;
                const notesText = notesCount > 0 ? `${notesCount} note(s)` : '-';

                tableHtml += `
                    <tr class="${rowClass}" data-task-id="${task.id}">
                        <td class="col-id">${task.id}</td>
                        <td class="col-name"><div class="${nameClass}">${foldToggle}${this.escapeHtml(task.name)}</div></td>
                        <td class="col-due due-date-cell ${dueDateClass}" data-task-id="${task.id}" title="Click to change due date">
                            ${this.taskManager.formatDate(task.dueDate)}
                        </td>
                        <td class="col-status status-cell" data-task-id="${task.id}">
                            <span class="${statusClass}">${task.status}</span>
                        </td>
                        <td class="col-project">${this.escapeHtml(task.project || '-')}</td>
                        <td class="col-priority priority-cell" data-task-id="${task.id}">
                            <span class="${priorityClass}">${priorityText}</span>
                        </td>
                        <td class="col-parent">${task.parentTaskId !== null ? task.parentTaskId : '-'}</td>
                        <td class="col-notes notes-cell" data-task-id="${task.id}" title="Click to view notes">${notesText}</td>
                    </tr>
                `;
            });

            tableHtml += `
                    </tbody>
                </table>
            `;

            // Update visibleTasks to only include actually rendered tasks
            this.visibleTasks = actuallyVisibleTasks;

            // Keep selection within bounds
            if (this.selectedTaskIndex >= this.visibleTasks.length) {
                this.selectedTaskIndex = Math.max(0, this.visibleTasks.length - 1);
            }

            this.taskTable.innerHTML = tableHtml;

            // Add click handlers for row modification
            this.attachTableEventHandlers();

            // Update visual selection for keyboard navigation
            this.updateSelectedTaskUI();
        } catch (error) {
            console.error('Render error:', error);
            this.showMessage('Error rendering tasks: ' + error.message, 'error');
        }
    }

    /**
     * Attach event handlers to table rows and status cells
     */
    attachTableEventHandlers() {
        // Use event delegation for fold toggles (attach once, not on every render)
        if (!this._foldToggleHandlerAttached) {
            this.taskTable.addEventListener('click', async (e) => {
                const foldToggle = e.target.closest('.fold-toggle');
                if (foldToggle) {
                    e.preventDefault();
                    e.stopPropagation();
                    const taskId = parseInt(foldToggle.dataset.taskId);
                    await this.toggleTaskFold(taskId);
                    return;
                }
            });
            this._foldToggleHandlerAttached = true;
        }

        // Click on row to select and optionally modify task
        const rows = this.taskTable.querySelectorAll('tbody tr');
        rows.forEach((row, index) => {
            row.addEventListener('click', async (e) => {
                // Always select the row first
                this.selectedTaskIndex = index;
                this.updateSelectedTaskUI();

                // Don't open modify dialog if clicking on status, priority, notes, due date cell, or fold toggle
                if (e.target.closest('.status-cell') ||
                    e.target.closest('.priority-cell') ||
                    e.target.closest('.notes-cell') ||
                    e.target.closest('.due-date-cell') ||
                    e.target.closest('.fold-toggle')) {
                    return;
                }

                // On mobile (touch device or narrow screen), just select - use action bar for actions
                const isMobile = window.matchMedia('(max-width: 768px)').matches || 'ontouchstart' in window;
                if (isMobile) {
                    return; // Just select, don't open modify modal
                }

                const taskId = parseInt(row.dataset.taskId);
                const task = await this.taskManager.getTaskById(taskId);
                if (task) {
                    this.showModifyTaskModal(task);
                }
            });

            // Add hover effect
            row.style.cursor = 'pointer';
        });

        // Click on status to show dropdown
        const statusCells = this.taskTable.querySelectorAll('.status-cell');
        statusCells.forEach(cell => {
            cell.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taskId = parseInt(cell.dataset.taskId);
                await this.showStatusDropdown(cell, taskId);
            });

            cell.style.cursor = 'pointer';
        });

        // Click on priority to show dropdown
        const priorityCells = this.taskTable.querySelectorAll('.priority-cell');
        priorityCells.forEach(cell => {
            cell.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taskId = parseInt(cell.dataset.taskId);
                await this.showPriorityDropdown(cell, taskId);
            });

            cell.style.cursor = 'pointer';
        });

        // Click on notes to view all notes
        const notesCells = this.taskTable.querySelectorAll('.notes-cell');
        notesCells.forEach(cell => {
            cell.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taskId = parseInt(cell.dataset.taskId);
                await this.showNotesViewer(taskId);
            });

            cell.style.cursor = 'pointer';
        });

        // Click on due date to change it
        const dueDateCells = this.taskTable.querySelectorAll('.due-date-cell');
        dueDateCells.forEach(cell => {
            cell.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taskId = parseInt(cell.dataset.taskId);
                await this.showDatePicker(cell, taskId);
            });

            cell.style.cursor = 'pointer';
        });
    }

    /**
     * Show status dropdown for quick status change
     */
    async showStatusDropdown(cell, taskId) {
        // Remove any existing dropdown
        const existingDropdown = document.querySelector('.status-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        const task = await this.taskManager.getTaskById(taskId);
        if (!task) return;

        const statuses = ['Not Started', 'In Progress', 'Blocked', 'Completed'];

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'status-dropdown';

        statuses.forEach(status => {
            const option = document.createElement('div');
            option.className = 'status-dropdown-option';
            if (status === task.status) {
                option.classList.add('active');
            }

            const badge = document.createElement('span');
            badge.className = `status-badge status-${status.toLowerCase().replace(' ', '-')}`;
            badge.textContent = status;

            option.appendChild(badge);
            option.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.updateTaskStatus(taskId, status);
                dropdown.remove();
            });

            dropdown.appendChild(option);
        });

        // Position dropdown
        const rect = cell.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${rect.bottom + 5}px`;
        dropdown.style.left = `${rect.left}px`;

        document.body.appendChild(dropdown);

        // Close dropdown when clicking outside or pressing ESC
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
                document.removeEventListener('keydown', handleEscape);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
                document.removeEventListener('keydown', handleEscape);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeDropdown);
            document.addEventListener('keydown', handleEscape);
        }, 0);
    }

    /**
     * Update task status quickly
     */
    async updateTaskStatus(taskId, newStatus) {
        try {
            await this.taskManager.updateTask(taskId, { status: newStatus });
            this.showMessage(`Task #${taskId} status updated to ${newStatus}`, 'success');
            await this.render();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    /**
     * Show priority dropdown for quick priority change
     */
    async showPriorityDropdown(cell, taskId) {
        // Remove any existing dropdown
        const existingDropdown = document.querySelector('.priority-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        const task = await this.taskManager.getTaskById(taskId);
        if (!task) return;

        const priorities = ['Low', 'Medium', 'High', 'Critical'];

        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'priority-dropdown';

        priorities.forEach(priority => {
            const option = document.createElement('div');
            option.className = 'priority-dropdown-option';
            if (priority === task.priority) {
                option.classList.add('active');
            }

            const badge = document.createElement('span');
            badge.className = `priority-badge priority-${priority.toLowerCase()}`;
            badge.textContent = priority;

            option.appendChild(badge);
            option.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.updateTaskPriority(taskId, priority);
                dropdown.remove();
            });

            dropdown.appendChild(option);
        });

        // Position dropdown
        const rect = cell.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${rect.bottom + 5}px`;
        dropdown.style.left = `${rect.left}px`;

        document.body.appendChild(dropdown);

        // Close dropdown when clicking outside or pressing ESC
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
                document.removeEventListener('keydown', handleEscape);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
                document.removeEventListener('keydown', handleEscape);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeDropdown);
            document.addEventListener('keydown', handleEscape);
        }, 0);
    }

    /**
     * Update task priority quickly
     */
    async updateTaskPriority(taskId, newPriority) {
        try {
            await this.taskManager.updateTask(taskId, { priority: newPriority });
            this.showMessage(`Task #${taskId} priority updated to ${newPriority}`, 'success');
            await this.render();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    /**
     * Show calendar widget for modal forms
     */
    showModalCalendar(hiddenInputId, displaySpanId) {
        // Remove any existing calendar
        const existingCalendar = document.querySelector('.modal-calendar-popup');
        if (existingCalendar) {
            existingCalendar.remove();
        }

        const hiddenInput = document.getElementById(hiddenInputId);
        const displaySpan = document.getElementById(displaySpanId);

        // Validate elements exist
        if (!hiddenInput || !displaySpan) {
            console.error('Calendar widget error: Elements not found', {
                hiddenInputId,
                displaySpanId,
                hiddenInput: !!hiddenInput,
                displaySpan: !!displaySpan
            });
            return;
        }

        // Create calendar popup
        const popup = document.createElement('div');
        popup.className = 'modal-calendar-popup';

        // Initialize with current value or today (pre-select today if no value)
        const currentValue = hiddenInput.value;
        const today = new Date();
        today.setHours(9, 0, 0, 0); // Default to 9 AM
        let selectedDate = currentValue ? new Date(currentValue) : today;
        let viewMonth = selectedDate.getMonth();
        let viewYear = selectedDate.getFullYear();

        const renderCalendar = () => {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                               'July', 'August', 'September', 'October', 'November', 'December'];

            const firstDay = new Date(viewYear, viewMonth, 1);
            const lastDay = new Date(viewYear, viewMonth + 1, 0);
            const startingDayOfWeek = firstDay.getDay();
            const monthLength = lastDay.getDate();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let calendarHtml = `
                <div class="calendar-header">
                    <button class="calendar-nav-btn" id="modalPrevMonth">‹</button>
                    <div class="calendar-title">${monthNames[viewMonth]} ${viewYear}</div>
                    <button class="calendar-nav-btn" id="modalNextMonth">›</button>
                </div>
                <div class="calendar-weekdays">
                    <div class="calendar-weekday">Sun</div>
                    <div class="calendar-weekday">Mon</div>
                    <div class="calendar-weekday">Tue</div>
                    <div class="calendar-weekday">Wed</div>
                    <div class="calendar-weekday">Thu</div>
                    <div class="calendar-weekday">Fri</div>
                    <div class="calendar-weekday">Sat</div>
                </div>
                <div class="calendar-days">
            `;

            // Empty cells before first day
            for (let i = 0; i < startingDayOfWeek; i++) {
                calendarHtml += '<div class="calendar-day empty"></div>';
            }

            // Days of the month
            for (let day = 1; day <= monthLength; day++) {
                const date = new Date(viewYear, viewMonth, day);
                date.setHours(0, 0, 0, 0);

                let classes = 'calendar-day';

                if (date.getTime() === today.getTime()) {
                    classes += ' today';
                }

                if (selectedDate) {
                    const selDate = new Date(selectedDate);
                    selDate.setHours(0, 0, 0, 0);
                    if (date.getTime() === selDate.getTime()) {
                        classes += ' selected';
                    }
                }

                calendarHtml += `<div class="${classes}" data-date="${viewYear}-${viewMonth + 1}-${day}">${day}</div>`;
            }

            calendarHtml += '</div>';

            const timeValue = selectedDate
                ? `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`
                : '09:00';

            calendarHtml += `
                <div class="calendar-time-section">
                    <label class="calendar-time-label">Time:</label>
                    <input type="time" id="modalTimeInput" class="calendar-time-input" value="${timeValue}">
                </div>
                <div class="calendar-quick-options">
                    <button class="calendar-quick-btn" data-action="today">Today</button>
                    <button class="calendar-quick-btn" data-action="tomorrow">Tomorrow</button>
                    <button class="calendar-quick-btn" data-action="week">+1 Week</button>
                    <button class="calendar-quick-btn" data-action="clear">Clear</button>
                </div>
                <div class="calendar-footer">
                    <button class="calendar-cancel-btn">Cancel</button>
                    <button class="calendar-save-btn">Set Date</button>
                </div>
            `;

            popup.innerHTML = calendarHtml;

            // Attach event listeners
            popup.querySelector('#modalPrevMonth').addEventListener('click', () => {
                viewMonth--;
                if (viewMonth < 0) {
                    viewMonth = 11;
                    viewYear--;
                }
                renderCalendar();
            });

            popup.querySelector('#modalNextMonth').addEventListener('click', () => {
                viewMonth++;
                if (viewMonth > 11) {
                    viewMonth = 0;
                    viewYear++;
                }
                renderCalendar();
            });

            // Day click handlers
            popup.querySelectorAll('.calendar-day:not(.empty)').forEach(dayEl => {
                dayEl.addEventListener('click', () => {
                    const [year, month, day] = dayEl.dataset.date.split('-').map(Number);
                    const time = popup.querySelector('#modalTimeInput').value.split(':');
                    selectedDate = new Date(year, month - 1, day, parseInt(time[0]), parseInt(time[1]));
                    renderCalendar();
                });
            });

            // Quick action buttons
            popup.querySelectorAll('.calendar-quick-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    const time = popup.querySelector('#modalTimeInput').value.split(':');

                    if (action === 'clear') {
                        selectedDate = null;
                        hiddenInput.value = '';
                        displaySpan.textContent = 'Click to select date';
                        popup.remove();
                        return;
                    } else if (action === 'today') {
                        selectedDate = new Date();
                        selectedDate.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
                    } else if (action === 'tomorrow') {
                        selectedDate = new Date();
                        selectedDate.setDate(selectedDate.getDate() + 1);
                        selectedDate.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
                    } else if (action === 'week') {
                        selectedDate = new Date();
                        selectedDate.setDate(selectedDate.getDate() + 7);
                        selectedDate.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
                    }

                    if (selectedDate) {
                        viewMonth = selectedDate.getMonth();
                        viewYear = selectedDate.getFullYear();
                    }
                    renderCalendar();
                });
            });

            // Save button
            popup.querySelector('.calendar-save-btn').addEventListener('click', () => {
                if (selectedDate) {
                    const time = popup.querySelector('#modalTimeInput').value.split(':');
                    selectedDate.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
                    hiddenInput.value = selectedDate.toISOString();
                    displaySpan.textContent = selectedDate.toLocaleString('en-AU', {
                        timeZone: 'Australia/Sydney',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
                popup.remove();
            });

            // Cancel button
            popup.querySelector('.calendar-cancel-btn').addEventListener('click', () => {
                popup.remove();
            });
        };

        // Initial render
        renderCalendar();

        // Position popup fixed to viewport (centered)
        popup.style.position = 'fixed';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        popup.style.zIndex = '1100';

        // Stop propagation of clicks inside the popup
        popup.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Make popup focusable and add keyboard navigation
        popup.setAttribute('tabindex', '-1');
        popup.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                popup.querySelector('.calendar-save-btn').click();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                e.stopPropagation();
                // Move to previous day
                if (selectedDate) {
                    selectedDate.setDate(selectedDate.getDate() - 1);
                } else {
                    selectedDate = new Date();
                }
                viewMonth = selectedDate.getMonth();
                viewYear = selectedDate.getFullYear();
                renderCalendar();
                popup.focus();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                e.stopPropagation();
                // Move to next day
                if (selectedDate) {
                    selectedDate.setDate(selectedDate.getDate() + 1);
                } else {
                    selectedDate = new Date();
                }
                viewMonth = selectedDate.getMonth();
                viewYear = selectedDate.getFullYear();
                renderCalendar();
                popup.focus();
            }
        });

        document.body.appendChild(popup);

        // Focus the popup so it can receive keyboard events
        popup.focus();

        // Close on outside click
        const closePopup = (e) => {
            if (!popup.contains(e.target) &&
                !e.target.closest('#addTaskDueDateButton') &&
                !e.target.closest('#modifyTaskDueDateButton')) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closePopup);
        }, 100);
    }

    /**
     * Show date picker for due date
     */
    async showDatePicker(cell, taskId) {
        // Remove any existing date picker
        const existingPicker = document.querySelector('.date-picker-popup');
        if (existingPicker) {
            existingPicker.remove();
        }

        const task = await this.taskManager.getTaskById(taskId);
        if (!task) return;

        // Create date picker popup
        const popup = document.createElement('div');
        popup.className = 'date-picker-popup';

        // Initialize with current date or today
        const currentDate = task.dueDate ? new Date(task.dueDate) : new Date();
        let selectedDate = task.dueDate ? new Date(task.dueDate) : null;
        let viewMonth = currentDate.getMonth();
        let viewYear = currentDate.getFullYear();

        const renderCalendar = () => {
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                               'July', 'August', 'September', 'October', 'November', 'December'];

            const firstDay = new Date(viewYear, viewMonth, 1);
            const lastDay = new Date(viewYear, viewMonth + 1, 0);
            const startingDayOfWeek = firstDay.getDay();
            const monthLength = lastDay.getDate();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let calendarHtml = `
                <div class="calendar-header">
                    <button class="calendar-nav-btn" id="prevMonth">‹</button>
                    <div class="calendar-title">${monthNames[viewMonth]} ${viewYear}</div>
                    <button class="calendar-nav-btn" id="nextMonth">›</button>
                </div>
                <div class="calendar-weekdays">
                    <div class="calendar-weekday">Sun</div>
                    <div class="calendar-weekday">Mon</div>
                    <div class="calendar-weekday">Tue</div>
                    <div class="calendar-weekday">Wed</div>
                    <div class="calendar-weekday">Thu</div>
                    <div class="calendar-weekday">Fri</div>
                    <div class="calendar-weekday">Sat</div>
                </div>
                <div class="calendar-days">
            `;

            // Empty cells before first day
            for (let i = 0; i < startingDayOfWeek; i++) {
                calendarHtml += '<div class="calendar-day empty"></div>';
            }

            // Days of the month
            for (let day = 1; day <= monthLength; day++) {
                const date = new Date(viewYear, viewMonth, day);
                date.setHours(0, 0, 0, 0);

                let classes = 'calendar-day';

                // Check if it's today
                if (date.getTime() === today.getTime()) {
                    classes += ' today';
                }

                // Check if it's the selected date
                if (selectedDate) {
                    const selDate = new Date(selectedDate);
                    selDate.setHours(0, 0, 0, 0);
                    if (date.getTime() === selDate.getTime()) {
                        classes += ' selected';
                    }
                }

                calendarHtml += `<div class="${classes}" data-date="${viewYear}-${viewMonth + 1}-${day}">${day}</div>`;
            }

            calendarHtml += '</div>';

            // Time picker and quick options
            const timeValue = selectedDate
                ? `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`
                : '09:00';

            calendarHtml += `
                <div class="calendar-time-section">
                    <label class="calendar-time-label">Time:</label>
                    <input type="time" id="timeInput" class="calendar-time-input" value="${timeValue}">
                </div>
                <div class="calendar-quick-options">
                    <button class="calendar-quick-btn" data-action="today">Today</button>
                    <button class="calendar-quick-btn" data-action="tomorrow">Tomorrow</button>
                    <button class="calendar-quick-btn" data-action="week">+1 Week</button>
                    <button class="calendar-quick-btn" data-action="clear">Clear</button>
                </div>
                <div class="calendar-footer">
                    <button class="calendar-cancel-btn">Cancel</button>
                    <button class="calendar-save-btn">Save</button>
                </div>
            `;

            popup.innerHTML = calendarHtml;

            // Attach event listeners
            popup.querySelector('#prevMonth').addEventListener('click', () => {
                viewMonth--;
                if (viewMonth < 0) {
                    viewMonth = 11;
                    viewYear--;
                }
                renderCalendar();
            });

            popup.querySelector('#nextMonth').addEventListener('click', () => {
                viewMonth++;
                if (viewMonth > 11) {
                    viewMonth = 0;
                    viewYear++;
                }
                renderCalendar();
            });

            // Day click handlers
            popup.querySelectorAll('.calendar-day:not(.empty)').forEach(dayEl => {
                dayEl.addEventListener('click', () => {
                    const [year, month, day] = dayEl.dataset.date.split('-').map(Number);
                    const time = popup.querySelector('#timeInput').value.split(':');
                    selectedDate = new Date(year, month - 1, day, parseInt(time[0]), parseInt(time[1]));
                    renderCalendar();
                });
            });

            // Quick action buttons
            popup.querySelectorAll('.calendar-quick-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    const time = popup.querySelector('#timeInput').value.split(':');

                    if (action === 'clear') {
                        selectedDate = null;
                    } else if (action === 'today') {
                        selectedDate = new Date();
                        selectedDate.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
                    } else if (action === 'tomorrow') {
                        selectedDate = new Date();
                        selectedDate.setDate(selectedDate.getDate() + 1);
                        selectedDate.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
                    } else if (action === 'week') {
                        selectedDate = new Date();
                        selectedDate.setDate(selectedDate.getDate() + 7);
                        selectedDate.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
                    }

                    if (selectedDate) {
                        viewMonth = selectedDate.getMonth();
                        viewYear = selectedDate.getFullYear();
                    }
                    renderCalendar();
                });
            });

            // Save button
            popup.querySelector('.calendar-save-btn').addEventListener('click', async () => {
                if (selectedDate) {
                    const time = popup.querySelector('#timeInput').value.split(':');
                    selectedDate.setHours(parseInt(time[0]), parseInt(time[1]), 0, 0);
                }
                await this.updateTaskDueDate(taskId, selectedDate ? selectedDate.toISOString() : null);
                popup.remove();
            });

            // Cancel button
            popup.querySelector('.calendar-cancel-btn').addEventListener('click', () => {
                popup.remove();
            });
        };

        // Initial render
        renderCalendar();

        // Position popup with viewport boundary checking
        const rect = cell.getBoundingClientRect();
        popup.style.position = 'fixed';

        // Add popup to DOM first to measure its height
        document.body.appendChild(popup);

        const popupHeight = popup.offsetHeight;
        const popupWidth = popup.offsetWidth;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Check if there's enough space below
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (spaceBelow >= popupHeight + 10) {
            // Position below the cell
            popup.style.top = `${rect.bottom + 5}px`;
        } else if (spaceAbove >= popupHeight + 10) {
            // Position above the cell
            popup.style.top = `${rect.top - popupHeight - 5}px`;
        } else {
            // Center vertically in viewport
            popup.style.top = `${Math.max(10, (viewportHeight - popupHeight) / 2)}px`;
        }

        // Check horizontal positioning
        if (rect.left + popupWidth > viewportWidth - 10) {
            // Align to right edge of cell or viewport
            popup.style.left = `${Math.max(10, viewportWidth - popupWidth - 10)}px`;
        } else {
            popup.style.left = `${rect.left}px`;
        }

        // Stop propagation of clicks inside the popup
        popup.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Make popup focusable and add keyboard navigation
        popup.setAttribute('tabindex', '-1');
        popup.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                popup.querySelector('.calendar-save-btn').click();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                e.stopPropagation();
                // Move to previous day
                if (selectedDate) {
                    selectedDate.setDate(selectedDate.getDate() - 1);
                } else {
                    selectedDate = new Date();
                }
                viewMonth = selectedDate.getMonth();
                viewYear = selectedDate.getFullYear();
                renderCalendar();
                popup.focus();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                e.stopPropagation();
                // Move to next day
                if (selectedDate) {
                    selectedDate.setDate(selectedDate.getDate() + 1);
                } else {
                    selectedDate = new Date();
                }
                viewMonth = selectedDate.getMonth();
                viewYear = selectedDate.getFullYear();
                renderCalendar();
                popup.focus();
            }
        });

        // Focus the popup so it can receive keyboard events
        popup.focus();

        // Close on outside click or ESC key
        const closePopup = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closePopup);
                document.removeEventListener('keydown', handleEscape);
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                popup.remove();
                document.removeEventListener('click', closePopup);
                document.removeEventListener('keydown', handleEscape);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closePopup);
            document.addEventListener('keydown', handleEscape);
        }, 0);
    }

    /**
     * Update task due date
     */
    async updateTaskDueDate(taskId, newDueDate) {
        try {
            await this.taskManager.updateTask(taskId, { dueDate: newDueDate });
            const message = newDueDate
                ? `Task #${taskId} due date updated`
                : `Task #${taskId} due date cleared`;
            this.showMessage(message, 'success');
            await this.render();
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    /**
     * Navigation Mode Functions
     */

    enterCommandMode() {
        this.navigationMode = false;

        // Show command modal instead of bottom bar
        if (this.commandModal) {
            this.commandModal.classList.add('active');
            this.commandModalInput.value = '';
            this.selectedSuggestionIndex = -1;
            this.updateCommandSuggestions();

            // Focus input after animation
            setTimeout(() => {
                this.commandModalInput.focus();
            }, 50);
        } else {
            // Fallback to old behavior if modal not available
            this.commandInputArea.classList.remove('hidden');
            this.commandInput.value = ':';
            this.commandPlaceholder.classList.remove('hidden');
            this.commandInput.focus();
            setTimeout(() => {
                this.commandInput.setSelectionRange(1, 1);
            }, 0);
        }
    }

    exitCommandMode() {
        this.navigationMode = true;

        // Close command modal
        if (this.commandModal) {
            this.closeCommandModal();
        } else {
            // Fallback to old behavior
            this.commandInputArea.classList.add('hidden');
            this.commandPlaceholder.classList.add('hidden');
            this.commandInput.value = '';
            this.commandInput.blur();
        }
        this.commandParser.resetHistoryIndex();
    }

    /**
     * Close command modal
     */
    closeCommandModal() {
        if (this.commandModal) {
            this.commandModal.classList.remove('active');
            this.commandModalInput.value = '';
            this.commandModalInput.blur();
            this.commandSuggestions.innerHTML = '';
            this.selectedSuggestionIndex = -1;
            this.currentSuggestions = [];
        }
        this.navigationMode = true;
    }

    /**
     * Handle command modal keydown events
     */
    handleCommandModalKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            this.closeCommandModal();
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            this.autocompleteCommand();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateSuggestions(1);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateSuggestions(-1);
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            this.executeCommandFromModal();
            return;
        }
    }

    /**
     * Update command suggestions based on input
     */
    updateCommandSuggestions() {
        const input = this.commandModalInput.value.toLowerCase().trim();

        if (input === '') {
            // Show all commands when empty
            this.currentSuggestions = this.availableCommands.slice(0, 8);
        } else {
            // Filter commands that match input
            this.currentSuggestions = this.availableCommands.filter(cmd => {
                const matchesCmd = cmd.cmd.toLowerCase().startsWith(input);
                const matchesAlias = cmd.aliases.some(a => a.toLowerCase().startsWith(input));
                return matchesCmd || matchesAlias;
            }).slice(0, 6);
        }

        this.renderSuggestions();
    }

    /**
     * Render suggestion list
     */
    renderSuggestions() {
        if (!this.commandSuggestions) return;

        if (this.currentSuggestions.length === 0) {
            this.commandSuggestions.innerHTML = '<div class="command-suggestion"><span class="suggestion-desc">No matching commands</span></div>';
            return;
        }

        this.commandSuggestions.innerHTML = this.currentSuggestions.map((cmd, index) => {
            const selectedClass = index === this.selectedSuggestionIndex ? 'selected' : '';
            const aliasText = cmd.aliases.length > 0 ? ` (${cmd.aliases.join(', ')})` : '';
            return `
                <div class="command-suggestion ${selectedClass}" data-index="${index}" data-cmd="${cmd.cmd}">
                    <span class="suggestion-command">:${cmd.cmd}${aliasText}</span>
                    <span class="suggestion-desc">${cmd.desc}</span>
                </div>
            `;
        }).join('');

        // Add click handlers for suggestions
        this.commandSuggestions.querySelectorAll('.command-suggestion').forEach(el => {
            el.addEventListener('click', () => {
                const cmd = el.dataset.cmd;
                this.commandModalInput.value = cmd;
                this.commandModalInput.focus();
                this.updateCommandSuggestions();
            });
        });
    }

    /**
     * Navigate through suggestions with arrow keys
     */
    navigateSuggestions(direction) {
        if (this.currentSuggestions.length === 0) return;

        this.selectedSuggestionIndex += direction;

        if (this.selectedSuggestionIndex < 0) {
            this.selectedSuggestionIndex = this.currentSuggestions.length - 1;
        } else if (this.selectedSuggestionIndex >= this.currentSuggestions.length) {
            this.selectedSuggestionIndex = 0;
        }

        // Update input with selected suggestion
        const selected = this.currentSuggestions[this.selectedSuggestionIndex];
        if (selected) {
            this.commandModalInput.value = selected.cmd;
        }

        this.renderSuggestions();
    }

    /**
     * Autocomplete command (Tab key)
     */
    autocompleteCommand() {
        if (this.currentSuggestions.length === 0) return;

        // If nothing selected, select first; otherwise cycle
        if (this.selectedSuggestionIndex < 0) {
            this.selectedSuggestionIndex = 0;
        } else {
            this.selectedSuggestionIndex = (this.selectedSuggestionIndex + 1) % this.currentSuggestions.length;
        }

        const selected = this.currentSuggestions[this.selectedSuggestionIndex];
        if (selected) {
            this.commandModalInput.value = selected.cmd;
        }

        this.renderSuggestions();
    }

    /**
     * Execute command from modal
     */
    async executeCommandFromModal() {
        const command = ':' + this.commandModalInput.value.trim();

        // Close modal first
        this.closeCommandModal();

        // Execute via existing command system
        const result = await this.commandParser.execute(command);

        if (result.success) {
            // Handle action (same logic as executeCommand)
            if (result.action === 'prompt_add') {
                this.showAddTaskModal();
            } else if (result.action === 'prompt_modify') {
                this.showModifyTaskModal(result.data.task);
            } else if (result.action === 'prompt_delete') {
                this.showDeleteConfirmation(result.data.task);
            } else if (result.action === 'prompt_bulk_delete') {
                this.showBulkDeleteConfirmation(result.data.tasks, result.data.notFound);
            } else if (result.action === 'filter') {
                this.currentFilters = result.data.filters;
                this.currentSort = null;
                await this.render();
                this.showMessage('Filter applied', 'success');
            } else if (result.action === 'sort') {
                this.currentSort = result.data.sortBy;
                await this.render();
                this.showMessage('Tasks sorted by priority', 'success');
            } else if (result.action === 'clear') {
                this.currentFilters = null;
                this.currentSort = null;
                await this.render();
                this.showMessage('Filters cleared, showing all tasks', 'info');
            } else if (result.action === 'show_help') {
                this.showHelp();
            } else if (result.action === 'show_privacy') {
                this.showPrivacy();
            } else if (result.action === 'show_search') {
                await this.showSearch();
            } else if (result.action === 'export_data') {
                await this.exportData();
            } else if (result.action === 'export_csv') {
                await this.exportCSV();
            } else if (result.action === 'import_data') {
                this.importData();
            } else if (result.action === 'show_trash') {
                await this.showTrash();
            } else if (result.action === 'restore_task') {
                await this.restoreTask(result.data.taskId);
            } else if (result.action === 'purge_task') {
                await this.purgeTask(result.data.taskId);
            } else if (result.action === 'purge_all') {
                await this.purgeAll();
            } else if (result.message) {
                this.showMessage(result.message, 'info');
            }
        } else {
            this.showMessage(result.message, 'error');
        }
    }

    navigateUp() {
        if (this.visibleTasks.length === 0) return;

        this.selectedTaskIndex = Math.max(0, this.selectedTaskIndex - 1);
        this.updateSelectedTaskUI();
    }

    navigateDown() {
        if (this.visibleTasks.length === 0) return;

        this.selectedTaskIndex = Math.min(this.visibleTasks.length - 1, this.selectedTaskIndex + 1);
        this.updateSelectedTaskUI();
    }

    updateSelectedTaskUI() {
        // Remove previous selection
        const rows = this.taskTable.querySelectorAll('tbody tr');
        rows.forEach(row => row.classList.remove('selected'));

        // Add selection to current task
        if (rows[this.selectedTaskIndex]) {
            rows[this.selectedTaskIndex].classList.add('selected');
            // Scroll into view if needed
            rows[this.selectedTaskIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    /**
     * Toggle fold/unfold state for a task with children
     */
    async toggleTaskFold(taskId) {
        if (this.collapsedTasks.has(taskId)) {
            this.collapsedTasks.delete(taskId);
        } else {
            this.collapsedTasks.add(taskId);
        }
        await this.render();
    }

    /**
     * Toggle fold/unfold for the currently selected task (keyboard shortcut)
     */
    async toggleSelectedTaskFold() {
        if (this.visibleTasks.length === 0) return;

        const task = this.visibleTasks[this.selectedTaskIndex];
        if (task && task.childTaskIds && task.childTaskIds.length > 0) {
            await this.toggleTaskFold(task.id);
        }
    }

    async modifySelectedTask() {
        if (this.visibleTasks.length === 0) return;

        const task = this.visibleTasks[this.selectedTaskIndex];
        if (task) {
            this.showModifyTaskModal(task);
        }
    }

    async deleteSelectedTask() {
        if (this.visibleTasks.length === 0) return;

        const task = this.visibleTasks[this.selectedTaskIndex];
        if (task) {
            this.showDeleteConfirmation(task);
        }
    }

    async completeSelectedTask() {
        if (this.visibleTasks.length === 0) return;

        const task = this.visibleTasks[this.selectedTaskIndex];
        if (task) {
            try {
                await this.taskManager.updateTask(task.id, { status: 'Completed' });
                this.showMessage(`Task #${task.id} marked as completed`, 'success');
                await this.render();
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        }
    }

    async setCriticalPriority() {
        if (this.visibleTasks.length === 0) return;

        const task = this.visibleTasks[this.selectedTaskIndex];
        if (task) {
            try {
                await this.taskManager.updateTask(task.id, { priority: 'Critical' });
                this.showMessage(`Task #${task.id} priority set to Critical`, 'success');
                await this.render();
            } catch (error) {
                this.showMessage(error.message, 'error');
            }
        }
    }

    /**
     * Undo the last action
     */
    async undoAction() {
        try {
            const action = await this.taskManager.undo();
            const actionDesc = this.getActionDescription(action);
            this.showMessage(`Undo: ${actionDesc}`, 'success');
            await this.render();
        } catch (error) {
            this.showMessage(error.message, 'info');
        }
    }

    /**
     * Redo the last undone action
     */
    async redoAction() {
        try {
            const action = await this.taskManager.redo();
            const actionDesc = this.getActionDescription(action);
            this.showMessage(`Redo: ${actionDesc}`, 'success');
            await this.render();
        } catch (error) {
            this.showMessage(error.message, 'info');
        }
    }

    /**
     * Get human-readable description of an action
     */
    getActionDescription(action) {
        switch (action.type) {
            case 'delete':
                return `Deleted task #${action.taskId}`;
            case 'modify':
                return `Modified task #${action.taskId}`;
            case 'create':
                return `Created task #${action.taskId}`;
            case 'restore':
                return `Restored task #${action.taskId}`;
            default:
                return `Action on task #${action.taskId}`;
        }
    }

    /**
     * Show trash (deleted tasks)
     */
    async showTrash() {
        try {
            const deletedTasks = await this.taskManager.getDeletedTasks();

            if (deletedTasks.length === 0) {
                this.showMessage('Trash is empty', 'info');
                return;
            }

            // Render trash view
            this.visibleTasks = deletedTasks;
            this.selectedTaskIndex = 0;

            let html = '<div class="terminal-output">';
            html += '<div class="terminal-output-header">TRASH - Deleted Tasks</div>';
            html += '<div class="terminal-output-text">';
            html += `Found ${deletedTasks.length} deleted task(s)\n\n`;
            html += 'Commands:\n';
            html += '  :restore [id] - Restore a task from trash\n';
            html += '  :purge [id]   - Permanently delete a task\n';
            html += '  :purge all    - Empty trash (permanent)\n';
            html += '  :clear        - Return to main view\n\n';

            // Build trash table
            html += '<table class="task-table">';
            html += '<thead><tr>';
            html += '<th class="col-id">ID</th>';
            html += '<th class="col-name">Name</th>';
            html += '<th class="col-deleted">Deleted</th>';
            html += '<th class="col-priority">Priority</th>';
            html += '<th class="col-project">Project</th>';
            html += '</tr></thead><tbody>';

            deletedTasks.forEach((task, index) => {
                const rowClass = index === this.selectedTaskIndex ? 'selected' : '';
                const deletedDate = this.taskManager.formatDate(task.deletedAt);

                html += `<tr class="${rowClass}">`;
                html += `<td class="col-id">${task.id}</td>`;
                html += `<td class="col-name">${this.escapeHtml(task.name)}</td>`;
                html += `<td class="col-deleted">${deletedDate}</td>`;
                html += `<td class="col-priority priority-${task.priority.toLowerCase()}">${task.priority}</td>`;
                html += `<td class="col-project">${task.project || '-'}</td>`;
                html += '</tr>';
            });

            html += '</tbody></table>';
            html += '</div></div>';

            this.taskTable.innerHTML = html;
        } catch (error) {
            this.showMessage('Failed to load trash: ' + error.message, 'error');
        }
    }

    /**
     * Restore a task from trash
     */
    async restoreTask(taskId) {
        try {
            await this.taskManager.restoreTask(taskId);
            this.showMessage(`Task #${taskId} restored from trash`, 'success');
            await this.render();
        } catch (error) {
            this.showMessage('Restore failed: ' + error.message, 'error');
        }
    }

    /**
     * Permanently delete a task from trash
     */
    async purgeTask(taskId) {
        this.modalHeader.textContent = 'Permanently Delete Task';

        let confirmHtml = `
            <div class="confirm-dialog">
                <p class="confirm-dialog-text warning">
                    ⚠️ WARNING: This action cannot be undone!
                </p>
                <p class="confirm-dialog-text">
                    Are you sure you want to permanently delete task #${taskId}?
                </p>
                <div class="modal-buttons">
                    <button class="confirm-option-btn danger">Permanently Delete</button>
                    <button class="confirm-option-btn secondary">Cancel</button>
                </div>
            </div>
        `;

        this.modalBody.innerHTML = confirmHtml;
        this.modal.classList.add('active');

        const deleteBtn = this.modalBody.querySelector('.danger');
        const cancelBtn = this.modalBody.querySelector('.secondary');

        deleteBtn.addEventListener('click', async () => {
            try {
                await this.taskManager.purgeTask(taskId);
                this.showMessage(`Task #${taskId} permanently deleted`, 'success');
                await this.render();
                this.closeModal();
            } catch (error) {
                this.showMessage('Purge failed: ' + error.message, 'error');
            }
        });

        cancelBtn.addEventListener('click', () => this.closeModal());

        setTimeout(() => deleteBtn.focus(), 100);
    }

    /**
     * Empty trash (purge all deleted tasks)
     */
    async purgeAll() {
        const deletedTasks = await this.taskManager.getDeletedTasks();

        if (deletedTasks.length === 0) {
            this.showMessage('Trash is already empty', 'info');
            return;
        }

        this.modalHeader.textContent = 'Empty Trash';

        let confirmHtml = `
            <div class="confirm-dialog">
                <p class="confirm-dialog-text warning">
                    ⚠️ WARNING: This action cannot be undone!
                </p>
                <p class="confirm-dialog-text">
                    Are you sure you want to permanently delete all ${deletedTasks.length} task(s) in trash?
                </p>
                <div class="modal-buttons">
                    <button class="confirm-option-btn danger">Empty Trash</button>
                    <button class="confirm-option-btn secondary">Cancel</button>
                </div>
            </div>
        `;

        this.modalBody.innerHTML = confirmHtml;
        this.modal.classList.add('active');

        const deleteBtn = this.modalBody.querySelector('.danger');
        const cancelBtn = this.modalBody.querySelector('.secondary');

        deleteBtn.addEventListener('click', async () => {
            try {
                let purged = 0;
                for (const task of deletedTasks) {
                    await this.taskManager.purgeTask(task.id);
                    purged++;
                }
                this.showMessage(`Permanently deleted ${purged} task(s)`, 'success');
                await this.render();
                this.closeModal();
            } catch (error) {
                this.showMessage('Purge failed: ' + error.message, 'error');
            }
        });

        cancelBtn.addEventListener('click', () => this.closeModal());

        setTimeout(() => deleteBtn.focus(), 100);
    }

    /**
     * Export all tasks to JSON file
     */
    async exportData() {
        try {
            const data = await this.taskManager.exportData();

            // Create filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `silverlake-backup-${timestamp}.json`;

            // Create download link
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.showMessage(`Exported ${data.tasks.length} tasks to ${filename}`, 'success');
        } catch (error) {
            this.showMessage('Export failed: ' + error.message, 'error');
        }
    }

    /**
     * Export all tasks to CSV file
     */
    async exportCSV() {
        try {
            const tasks = await this.taskManager.getAllTasks();

            // CSV headers
            const headers = ['ID', 'Name', 'Status', 'Priority', 'Project', 'Due Date', 'Parent Task ID', 'Notes'];

            // Build CSV content
            let csvContent = headers.join(',') + '\n';

            tasks.forEach(task => {
                const row = [
                    task.id,
                    `"${this.escapeCSV(task.name)}"`,
                    `"${task.status}"`,
                    task.priority ? `"${task.priority}"` : '""',
                    task.project ? `"${this.escapeCSV(task.project)}"` : '',
                    task.dueDate ? `"${this.taskManager.formatDate(task.dueDate)}"` : '',
                    task.parentTaskId !== null ? task.parentTaskId : '',
                    task.notes.length > 0 ? `"${this.escapeCSV(task.notes.map(n => n.content).join(' | '))}"` : ''
                ];
                csvContent += row.join(',') + '\n';
            });

            // Create filename with timestamp
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `silverlake-tasks-${timestamp}.csv`;

            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;

            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            this.showMessage(`Exported ${tasks.length} tasks to ${filename}`, 'success');
        } catch (error) {
            this.showMessage('CSV export failed: ' + error.message, 'error');
        }
    }

    /**
     * Escape CSV values (handle quotes and commas)
     */
    escapeCSV(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/"/g, '""');
    }

    /**
     * Import tasks from JSON file
     */
    importData() {
        // Create file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // Validate data structure
                if (!data.tasks || !Array.isArray(data.tasks)) {
                    throw new Error('Invalid backup file format');
                }

                // Confirm before importing (will clear existing data)
                const confirmMessage = `This will replace all existing tasks with ${data.tasks.length} tasks from the backup. Continue?`;

                if (confirm(confirmMessage)) {
                    await this.taskManager.importData(data);
                    await this.render();
                    this.showMessage(`Imported ${data.tasks.length} tasks successfully`, 'success');
                }
            } catch (error) {
                this.showMessage('Import failed: ' + error.message, 'error');
            }
        };

        // Trigger file picker
        input.click();
    }

    /**
     * Show notes viewer modal
     */
    async showNotesViewer(taskId) {
        const task = await this.taskManager.getTaskById(taskId);
        if (!task) {
            this.showMessage('Task not found', 'error');
            return;
        }

        this.modalHeader.textContent = `Notes for Task #${task.id}: ${task.name}`;

        let notesHtml = '';

        if (!task.notes || task.notes.length === 0) {
            notesHtml = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <div class="empty-state-title">No notes yet</div>
                    <div class="empty-state-text">Use :M ${task.id} to add notes to this task</div>
                </div>
            `;
        } else {
            notesHtml = '<div class="notes-list">';

            // Sort notes by timestamp (newest first)
            const sortedNotes = [...task.notes].sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );

            sortedNotes.forEach((note, index) => {
                const date = new Date(note.timestamp);
                const formattedDate = date.toLocaleString('en-AU', {
                    timeZone: 'Australia/Sydney',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                notesHtml += `
                    <div class="note-item">
                        <div class="note-header">
                            <span class="note-timestamp">${formattedDate}</span>
                            <span class="note-number">#${sortedNotes.length - index}</span>
                        </div>
                        <div class="note-content">${this.formatNoteContent(note.content)}</div>
                    </div>
                `;
            });

            notesHtml += '</div>';
        }

        this.modalBody.innerHTML = notesHtml;
        this.modalBody.dataset.action = 'view_notes';
        this.showModal();

        // Hide submit button for notes viewer
        this.modalSubmit.style.display = 'none';
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format note content with clickable URLs
     * First escapes HTML for security, then converts URLs to hyperlinks
     */
    formatNoteContent(text) {
        if (!text) return '';

        // First escape HTML to prevent XSS
        let escaped = this.escapeHtml(text);

        // URL regex pattern - matches http(s), ftp, and www URLs
        const urlPattern = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|www\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

        // Replace URLs with clickable links
        escaped = escaped.replace(urlPattern, (url) => {
            // Add protocol if missing (for www. URLs)
            let href = url;
            if (url.toLowerCase().startsWith('www.')) {
                href = 'http://' + url;
            }

            // Create link with security attributes
            return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="note-link">${url}</a>`;
        });

        return escaped;
    }

    /**
     * Initialize browser notifications
     */
    async initNotifications() {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.log('Browser does not support notifications');
            return;
        }

        // Request permission if not already granted
        if (Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                this.notificationPermission = permission;
                if (permission === 'granted') {
                    this.showMessage('Notifications enabled for due task reminders', 'success');
                }
            } catch (error) {
                console.error('Error requesting notification permission:', error);
            }
        } else {
            this.notificationPermission = Notification.permission;
        }

        // Start checking for due tasks every minute
        this.startNotificationCheck();

        // Also check when page becomes visible again
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkDueTasks();
            }
        });
    }

    /**
     * Start periodic check for due tasks
     */
    startNotificationCheck() {
        // Check immediately
        this.checkDueTasks();

        // Then check every minute
        this.notificationCheckInterval = setInterval(() => {
            this.checkDueTasks();
        }, 60000); // 60 seconds
    }

    /**
     * Check for tasks that are due and send notifications
     */
    async checkDueTasks() {
        if (this.notificationPermission !== 'granted') {
            return;
        }

        try {
            const tasks = await this.taskManager.getAllTasks();
            const now = new Date();

            for (const task of tasks) {
                // Skip completed tasks or tasks without due dates
                if (task.status === 'Completed' || !task.dueDate) {
                    continue;
                }

                // Skip tasks we've already notified about
                if (this.notifiedTaskIds.has(task.id)) {
                    continue;
                }

                const dueDate = new Date(task.dueDate);
                const timeDiff = dueDate.getTime() - now.getTime();
                const minutesUntilDue = timeDiff / (1000 * 60);

                // Notify if task is:
                // - Due within the next 15 minutes
                // - Or already overdue (within the last hour, to catch tasks that became due while app was closed)
                if (minutesUntilDue <= 15 && minutesUntilDue > -60) {
                    this.sendTaskNotification(task, minutesUntilDue);
                    this.notifiedTaskIds.add(task.id);
                }
            }

            // Clean up old notification IDs (tasks that were completed or deleted)
            const taskIds = new Set(tasks.map(t => t.id));
            for (const notifiedId of this.notifiedTaskIds) {
                if (!taskIds.has(notifiedId)) {
                    this.notifiedTaskIds.delete(notifiedId);
                }
            }
        } catch (error) {
            console.error('Error checking due tasks:', error);
        }
    }

    /**
     * Send a browser notification for a due task
     */
    sendTaskNotification(task, minutesUntilDue) {
        let title, body;

        if (minutesUntilDue < 0) {
            // Task is overdue
            const minutesOverdue = Math.abs(Math.round(minutesUntilDue));
            title = 'Task Overdue';
            body = `"${task.name}" was due ${minutesOverdue} minute${minutesOverdue !== 1 ? 's' : ''} ago`;
        } else if (minutesUntilDue <= 5) {
            // Due very soon
            title = 'Task Due Now';
            body = `"${task.name}" is due now!`;
        } else {
            // Due soon
            const minutes = Math.round(minutesUntilDue);
            title = 'Task Due Soon';
            body = `"${task.name}" is due in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }

        // Add priority info if high/critical
        if (task.priority === 'Critical' || task.priority === 'High') {
            body += ` [${task.priority} Priority]`;
        }

        try {
            const notification = new Notification(title, {
                body: body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231a1d23"/><text x="50" y="60" font-family="monospace" font-size="50" fill="%230dcaf0" text-anchor="middle">S</text></svg>',
                tag: `task-${task.id}`, // Prevent duplicate notifications
                requireInteraction: task.priority === 'Critical', // Keep critical task notifications visible
                silent: false
            });

            // Focus app when notification is clicked
            notification.onclick = () => {
                window.focus();
                notification.close();

                // Try to select the task in the list
                const taskIndex = this.visibleTasks.findIndex(t => t.id === task.id);
                if (taskIndex !== -1) {
                    this.selectedTaskIndex = taskIndex;
                    this.updateSelectedTaskUI();
                }
            };
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    /**
     * Reset notification for a specific task (call when task due date is modified)
     */
    resetTaskNotification(taskId) {
        this.notifiedTaskIds.delete(taskId);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TaskTerminalApp();
});
