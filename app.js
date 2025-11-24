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
        const modalActions = ['prompt_add', 'prompt_modify', 'prompt_delete', 'prompt_bulk_delete', 'show_help'];
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
    showAddTaskModal() {
        this.modalHeader.textContent = 'Add New Task';

        const formHtml = `
            <div class="form-field">
                <label class="form-label">Name *</label>
                <input type="text" id="taskName" class="form-input" placeholder="Task name" required>
            </div>
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
            <div class="form-field">
                <label class="form-label">Parent Task ID</label>
                <input type="number" id="taskParent" class="form-input" placeholder="Leave empty for standalone task">
                <span class="form-hint">Max 2-level hierarchy: parent can't be a subtask</span>
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

        // Focus on first input
        document.getElementById('taskName').focus();
    }

    /**
     * Show modify task modal
     */
    showModifyTaskModal(task) {
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

        const formHtml = `
            <div class="form-field">
                <label class="form-label">Name *</label>
                <input type="text" id="taskName" class="form-input" value="${this.escapeHtml(task.name)}" required>
            </div>
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
            <div class="form-field">
                <label class="form-label">Parent Task ID</label>
                <input type="number" id="taskParent" class="form-input" value="${task.parentTaskId !== null ? task.parentTaskId : ''}" placeholder="Leave empty for standalone task">
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
                    <span class="help-command-name">:Filter_Project="ProjectName"</span> - Filter by project (case-insensitive)
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_Priority="High"</span> - Filter by priority
                </div>
                <div class="help-command">
                    <span class="help-command-name">:Filter_Status="In Progress"</span> - Filter by status
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Sorting</div>
                <div class="help-command">
                    <span class="help-command-name">:Sort_by_priority</span> - Sort by priority (Critical → Low)
                </div>
            </div>

            <div class="help-section">
                <div class="help-title">Trash & Undo/Redo</div>
                <div class="help-command">
                    <span class="help-command-name">U</span> - Undo last action (keyboard shortcut)
                </div>
                <div class="help-command">
                    <span class="help-command-name">R</span> - Redo last undone action (keyboard shortcut)
                </div>
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
            </div>

            <div class="help-section">
                <div class="help-title">Keyboard Shortcuts</div>
                <div class="help-command">↑/↓ - Navigate command history</div>
                <div class="help-command">Esc - Clear command input</div>
                <div class="help-command">Ctrl+Enter - Submit modal form</div>
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
     * Handle modal submit
     */
    handleModalSubmit() {
        const action = this.modalBody.dataset.action;

        if (action === 'modify') {
            this.submitModifyTask();
        } else if (action === 'delete' || action === 'bulk_delete' || action === 'view_notes' || action === 'help') {
            // Delete, bulk_delete, view_notes, and help use custom buttons or no form
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
            const parentStr = document.getElementById('taskParent').value.trim();

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

            // Store visible tasks for navigation
            this.visibleTasks = tasks;

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

            // Keep selection within bounds
            if (this.selectedTaskIndex >= tasks.length) {
                this.selectedTaskIndex = Math.max(0, tasks.length - 1);
            }

            // Build table
            let tableHtml = `
                <table class="task-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th>Project</th>
                            <th>Priority</th>
                            <th>Parent</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            tasks.forEach(task => {
                const isOverdue = this.taskManager.isTaskOverdue(task);
                const isSubtask = task.parentTaskId !== null && task.parentTaskId !== undefined;
                const isCompleted = task.status === 'Completed';

                let rowClass = '';
                if (isCompleted) {
                    rowClass = 'completed';
                } else if (isOverdue) {
                    rowClass = 'overdue';
                }

                const nameClass = isSubtask ? 'task-name subtask' : 'task-name';
                const statusClass = `status-badge status-${task.status.toLowerCase().replace(' ', '-')}`;
                const priorityClass = `priority-badge priority-${task.priority.toLowerCase()}`;
                const dueDateClass = isOverdue ? 'due-date overdue' : 'due-date';

                const notesCount = task.notes && task.notes.length > 0 ? task.notes.length : 0;
                const notesText = notesCount > 0 ? `${notesCount} note(s)` : '-';

                tableHtml += `
                    <tr class="${rowClass}" data-task-id="${task.id}">
                        <td>${task.id}</td>
                        <td><div class="${nameClass}">${this.escapeHtml(task.name)}</div></td>
                        <td class="due-date-cell ${dueDateClass}" data-task-id="${task.id}" title="Click to change due date">
                            ${this.taskManager.formatDate(task.dueDate)}
                        </td>
                        <td class="status-cell" data-task-id="${task.id}">
                            <span class="${statusClass}">${task.status}</span>
                        </td>
                        <td>${this.escapeHtml(task.project || '-')}</td>
                        <td class="priority-cell" data-task-id="${task.id}">
                            <span class="${priorityClass}">${task.priority}</span>
                        </td>
                        <td>${task.parentTaskId !== null ? task.parentTaskId : '-'}</td>
                        <td class="notes-cell" data-task-id="${task.id}" title="Click to view notes">${notesText}</td>
                    </tr>
                `;
            });

            tableHtml += `
                    </tbody>
                </table>
            `;

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
        // Click on row to modify task
        const rows = this.taskTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.addEventListener('click', async (e) => {
                // Don't trigger if clicking on status, priority, notes, or due date cell
                if (e.target.closest('.status-cell') ||
                    e.target.closest('.priority-cell') ||
                    e.target.closest('.notes-cell') ||
                    e.target.closest('.due-date-cell')) {
                    return;
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

        // Close dropdown when clicking outside
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeDropdown);
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

        // Close dropdown when clicking outside
        const closeDropdown = (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.remove();
                document.removeEventListener('click', closeDropdown);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeDropdown);
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

        // Initialize with current value or today
        const currentValue = hiddenInput.value;
        let selectedDate = currentValue ? new Date(currentValue) : null;
        let viewMonth = selectedDate ? selectedDate.getMonth() : new Date().getMonth();
        let viewYear = selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();

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

        document.body.appendChild(popup);

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

        // Position popup
        const rect = cell.getBoundingClientRect();
        popup.style.position = 'fixed';
        popup.style.top = `${rect.bottom + 5}px`;
        popup.style.left = `${rect.left}px`;

        // Stop propagation of clicks inside the popup
        popup.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.body.appendChild(popup);

        // Close on outside click
        const closePopup = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closePopup);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closePopup);
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

        // Show command input area (vim-like)
        this.commandInputArea.classList.remove('hidden');

        this.commandInput.value = ':';

        // Show placeholder since value is ':'
        this.commandPlaceholder.classList.remove('hidden');

        this.commandInput.focus();

        // Move cursor to end
        setTimeout(() => {
            this.commandInput.setSelectionRange(1, 1);
        }, 0);
    }

    exitCommandMode() {
        this.navigationMode = true;

        // Hide command input area (vim-like)
        this.commandInputArea.classList.add('hidden');

        // Hide placeholder
        this.commandPlaceholder.classList.add('hidden');

        this.commandInput.value = '';
        this.commandInput.blur();
        this.commandParser.resetHistoryIndex();
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
                    `"${task.priority}"`,
                    task.project ? `"${this.escapeCSV(task.project)}"` : '',
                    task.dueDate ? `"${this.taskManager.formatDate(task.dueDate)}"` : '',
                    task.parentTaskId !== null ? task.parentTaskId : '',
                    task.notes.length > 0 ? `"${this.escapeCSV(task.notes.join(' | '))}"` : ''
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
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TaskTerminalApp();
});
