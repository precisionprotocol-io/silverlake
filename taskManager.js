/**
 * TaskManager - Data Model and IndexedDB Storage Layer
 */

class TaskManager {
    constructor() {
        this.db = null;
        this.dbName = 'TaskManagerDB';
        this.dbVersion = 1;
        this.storeName = 'tasks';

        // Action history for undo/redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 20;
    }

    /**
     * Initialize IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'id' });

                    // Create indexes for faster queries
                    objectStore.createIndex('status', 'status', { unique: false });
                    objectStore.createIndex('priority', 'priority', { unique: false });
                    objectStore.createIndex('project', 'project', { unique: false });
                    objectStore.createIndex('parentTaskId', 'parentTaskId', { unique: false });
                }

                // Store for metadata (like nextId)
                if (!db.objectStoreNames.contains('metadata')) {
                    db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Get next ID
     */
    async getNextId() {
        const tx = this.db.transaction(['metadata'], 'readwrite');
        const store = tx.objectStore('metadata');

        return new Promise((resolve, reject) => {
            const request = store.get('nextId');

            request.onsuccess = () => {
                const result = request.result;
                const nextId = result ? result.value : 1;
                const newNextId = nextId + 1;

                // Update nextId
                store.put({ key: 'nextId', value: newNextId });
                resolve(nextId);
            };

            request.onerror = () => reject(new Error('Failed to get next ID'));
        });
    }

    /**
     * Create a new task
     */
    async createTask(taskData) {
        // Validation
        if (!taskData.name || taskData.name.trim() === '') {
            throw new Error('Task name is required');
        }

        // Validate parent task if specified
        if (taskData.parentTaskId !== null && taskData.parentTaskId !== undefined) {
            const parent = await this.getTaskById(taskData.parentTaskId);
            if (!parent) {
                throw new Error(`Parent task with ID ${taskData.parentTaskId} not found`);
            }
            // Check depth (max 3-level hierarchy: grandparent -> parent -> child)
            const parentDepth = await this.getTaskDepth(parent);
            if (parentDepth >= 2) {
                throw new Error('Cannot create subtask: Maximum 3-level hierarchy reached (grandparent → parent → child)');
            }
        }

        const taskId = await this.getNextId();

        // Create task object
        const task = {
            id: taskId,
            name: taskData.name.trim(),
            dueDate: taskData.dueDate || null,
            status: taskData.status || 'Not Started',
            project: taskData.project || null,
            priority: taskData.priority || 'Medium',
            notes: taskData.notes || [],
            parentTaskId: taskData.parentTaskId !== undefined ? taskData.parentTaskId : null,
            childTaskIds: [],
            deleted: false,
            deletedAt: null
        };

        // Save task
        await this.saveTask(task);

        // Update parent's childTaskIds if applicable
        if (task.parentTaskId !== null) {
            const parent = await this.getTaskById(task.parentTaskId);
            if (parent && !parent.childTaskIds.includes(task.id)) {
                parent.childTaskIds.push(task.id);
                await this.saveTask(parent);
            }
        }

        // Record action for undo
        this.recordAction({
            type: 'create',
            taskId: task.id,
            timestamp: new Date().toISOString()
        });

        return task;
    }

    /**
     * Save a task to IndexedDB
     */
    async saveTask(task) {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.put(task);

            request.onsuccess = () => resolve(task);
            request.onerror = () => reject(new Error('Failed to save task'));
        });
    }

    /**
     * Update an existing task
     */
    async updateTask(taskId, updates) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            throw new Error(`Task with ID ${taskId} not found`);
        }

        // Save previous state for undo
        const previousState = {
            name: task.name,
            dueDate: task.dueDate,
            status: task.status,
            project: task.project,
            priority: task.priority,
            notes: [...task.notes],
            parentTaskId: task.parentTaskId
        };

        // Validate parent task change if specified
        if (updates.parentTaskId !== undefined && updates.parentTaskId !== task.parentTaskId) {
            // Remove from old parent
            if (task.parentTaskId !== null) {
                const oldParent = await this.getTaskById(task.parentTaskId);
                if (oldParent) {
                    oldParent.childTaskIds = oldParent.childTaskIds.filter(id => id !== taskId);
                    await this.saveTask(oldParent);
                }
            }

            // Validate new parent
            if (updates.parentTaskId !== null) {
                const newParent = await this.getTaskById(updates.parentTaskId);
                if (!newParent) {
                    throw new Error(`Parent task with ID ${updates.parentTaskId} not found`);
                }
                // Check depth (max 3-level hierarchy)
                const newParentDepth = await this.getTaskDepth(newParent);
                const taskMaxChildDepth = await this.getMaxChildDepth(task);
                // Combined depth would be: newParentDepth + 1 (for this task) + taskMaxChildDepth
                if (newParentDepth + 1 + taskMaxChildDepth > 2) {
                    throw new Error('Cannot set parent: Maximum 3-level hierarchy would be exceeded');
                }
                // Check if new parent is a child of this task (circular reference)
                if (await this.isDescendant(updates.parentTaskId, task.id)) {
                    throw new Error('Cannot set parent: Would create circular reference');
                }
                // Add to new parent
                if (!newParent.childTaskIds.includes(taskId)) {
                    newParent.childTaskIds.push(taskId);
                    await this.saveTask(newParent);
                }
            }
        }

        // Apply updates
        Object.keys(updates).forEach(key => {
            if (key !== 'id' && key !== 'childTaskIds') {
                task[key] = updates[key];
            }
        });

        // Auto-remove priority when task is completed (pushes to bottom of list)
        if (task.status === 'Completed' && task.priority !== null) {
            task.priority = null;
        }

        // Auto-complete all descendants when task is completed
        if (task.status === 'Completed') {
            await this.completeAllDescendants(task);
        }

        await this.saveTask(task);

        // Record action for undo
        const newState = {
            name: task.name,
            dueDate: task.dueDate,
            status: task.status,
            project: task.project,
            priority: task.priority,
            notes: [...task.notes],
            parentTaskId: task.parentTaskId
        };

        this.recordAction({
            type: 'modify',
            taskId: task.id,
            previousState: previousState,
            newState: newState,
            timestamp: new Date().toISOString()
        });

        // Auto-complete parent if all children are completed
        await this.checkAndCompleteParent(task);

        return task;
    }

    /**
     * Check if all sibling tasks are completed, and if so, complete the parent
     */
    async checkAndCompleteParent(task) {
        // Only check if task was just completed and has a parent
        if (task.status !== 'Completed' || !task.parentTaskId) {
            return;
        }

        const parent = await this.getTaskById(task.parentTaskId);
        if (!parent || parent.status === 'Completed') {
            return;
        }

        // Get all children of the parent
        const allChildrenCompleted = await this.areAllChildrenCompleted(parent);

        if (allChildrenCompleted) {
            parent.status = 'Completed';
            await this.saveTask(parent);
        }
    }

    /**
     * Check if all children of a task are completed
     */
    async areAllChildrenCompleted(task) {
        if (!task.childTaskIds || task.childTaskIds.length === 0) {
            return false;
        }

        for (const childId of task.childTaskIds) {
            const child = await this.getTaskById(childId);
            if (!child || child.status !== 'Completed') {
                return false;
            }
        }

        return true;
    }

    /**
     * Complete all descendants (children and grandchildren) of a task
     */
    async completeAllDescendants(task) {
        if (!task.childTaskIds || task.childTaskIds.length === 0) {
            return;
        }

        for (const childId of task.childTaskIds) {
            const child = await this.getTaskById(childId);
            if (child && child.status !== 'Completed') {
                child.status = 'Completed';
                child.priority = null; // Auto-remove priority for completed tasks
                await this.saveTask(child);
                // Recursively complete grandchildren
                await this.completeAllDescendants(child);
            }
        }
    }

    /**
     * Get the depth of a task in the hierarchy (0 = root, 1 = child, 2 = grandchild)
     */
    async getTaskDepth(task) {
        let depth = 0;
        let current = task;

        while (current.parentTaskId !== null && current.parentTaskId !== undefined) {
            depth++;
            current = await this.getTaskById(current.parentTaskId);
            if (!current) break;
        }

        return depth;
    }

    /**
     * Get the maximum depth of children below a task
     */
    async getMaxChildDepth(task) {
        if (!task.childTaskIds || task.childTaskIds.length === 0) {
            return 0;
        }

        let maxDepth = 0;
        for (const childId of task.childTaskIds) {
            const child = await this.getTaskById(childId);
            if (child) {
                const childDepth = 1 + await this.getMaxChildDepth(child);
                maxDepth = Math.max(maxDepth, childDepth);
            }
        }

        return maxDepth;
    }

    /**
     * Check if a task is a descendant of another task
     */
    async isDescendant(taskId, ancestorId) {
        const task = await this.getTaskById(taskId);
        if (!task) return false;

        // Check direct children
        const ancestor = await this.getTaskById(ancestorId);
        if (!ancestor || !ancestor.childTaskIds) return false;

        if (ancestor.childTaskIds.includes(taskId)) {
            return true;
        }

        // Check grandchildren
        for (const childId of ancestor.childTaskIds) {
            if (await this.isDescendant(taskId, childId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the root ancestor of a task
     */
    async getRootAncestor(task) {
        let current = task;
        while (current.parentTaskId !== null && current.parentTaskId !== undefined) {
            const parent = await this.getTaskById(current.parentTaskId);
            if (!parent) break;
            current = parent;
        }
        return current;
    }

    /**
     * Get all descendants of a task (children and grandchildren)
     */
    async getAllDescendants(task) {
        const descendants = [];

        if (!task.childTaskIds || task.childTaskIds.length === 0) {
            return descendants;
        }

        for (const childId of task.childTaskIds) {
            const child = await this.getTaskById(childId);
            if (child && !child.deleted) {
                descendants.push(child);
                // Recursively get grandchildren
                const childDescendants = await this.getAllDescendants(child);
                descendants.push(...childDescendants);
            }
        }

        return descendants;
    }

    /**
     * Delete a task (soft delete - marks as deleted)
     * @param {number} taskId - ID of task to delete
     * @param {boolean} deleteChildren - Whether to delete children too
     * @param {boolean} isRootDelete - Internal flag: true if this is the top-level delete call (for undo tracking)
     */
    async deleteTask(taskId, deleteChildren = false, isRootDelete = true) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            throw new Error(`Task with ID ${taskId} not found`);
        }

        // Collect all task IDs being deleted (for undo)
        const deletedTaskIds = [taskId];

        // Handle children
        if (task.childTaskIds.length > 0) {
            if (deleteChildren) {
                // Delete all children recursively (soft delete) - pass true to delete grandchildren too
                // Pass isRootDelete=false so children don't record separate undo actions
                for (const childId of task.childTaskIds) {
                    const childDeletedIds = await this.deleteTask(childId, true, false);
                    deletedTaskIds.push(...childDeletedIds);
                }
            } else {
                // Convert children to standalone tasks
                for (const childId of task.childTaskIds) {
                    const child = await this.getTaskById(childId);
                    if (child) {
                        child.parentTaskId = null;
                        await this.saveTask(child);
                    }
                }
            }
        }

        // Remove from parent's childTaskIds if applicable
        if (task.parentTaskId !== null) {
            const parent = await this.getTaskById(task.parentTaskId);
            if (parent) {
                parent.childTaskIds = parent.childTaskIds.filter(id => id !== taskId);
                await this.saveTask(parent);
            }
        }

        // Soft delete the task
        task.deleted = true;
        task.deletedAt = new Date().toISOString();
        await this.saveTask(task);

        // Only record undo action for the root delete (not recursive child deletes)
        if (isRootDelete) {
            this.recordAction({
                type: 'delete',
                taskId: task.id,
                deletedTaskIds: deletedTaskIds, // All tasks deleted in this operation
                timestamp: new Date().toISOString()
            });
        }

        return deletedTaskIds;
    }

    /**
     * Delete task by ID from database (hard delete - permanent)
     */
    async deleteTaskById(taskId) {
        const tx = this.db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.delete(taskId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('Failed to delete task'));
        });
    }

    /**
     * Restore a deleted task
     */
    async restoreTask(taskId) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            throw new Error(`Task with ID ${taskId} not found`);
        }

        if (!task.deleted) {
            throw new Error(`Task with ID ${taskId} is not deleted`);
        }

        // Restore the task
        task.deleted = false;
        task.deletedAt = null;
        await this.saveTask(task);

        // If it had a parent, restore the relationship
        if (task.parentTaskId !== null) {
            const parent = await this.getTaskById(task.parentTaskId);
            if (parent && !parent.deleted && !parent.childTaskIds.includes(taskId)) {
                parent.childTaskIds.push(taskId);
                await this.saveTask(parent);
            }
        }

        // Record action for undo
        this.recordAction({
            type: 'restore',
            taskId: task.id,
            timestamp: new Date().toISOString()
        });

        return task;
    }

    /**
     * Restore a deleted task without recording to history (for undo operations)
     */
    async restoreTaskWithoutHistory(taskId) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            return null; // Task may have been purged, skip silently
        }

        if (!task.deleted) {
            return task; // Already restored, skip
        }

        // Restore the task
        task.deleted = false;
        task.deletedAt = null;
        await this.saveTask(task);

        // If it had a parent, restore the relationship
        if (task.parentTaskId !== null) {
            const parent = await this.getTaskById(task.parentTaskId);
            if (parent && !parent.deleted && !parent.childTaskIds.includes(taskId)) {
                parent.childTaskIds.push(taskId);
                await this.saveTask(parent);
            }
        }

        return task;
    }

    /**
     * Permanently delete a task (purge from trash)
     */
    async purgeTask(taskId) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            // Task already purged (possibly by recursive parent purge), skip silently
            return;
        }

        if (!task.deleted) {
            throw new Error(`Task with ID ${taskId} is not in trash. Use :D to delete it first.`);
        }

        // Recursively purge all deleted children (including grandchildren)
        if (task.childTaskIds.length > 0) {
            for (const childId of task.childTaskIds) {
                const child = await this.getTaskById(childId);
                if (child && child.deleted) {
                    await this.purgeTask(childId);
                }
            }
        }

        // Permanently delete the task
        await this.deleteTaskById(taskId);
    }

    /**
     * Get task by ID
     */
    async getTaskById(taskId) {
        const tx = this.db.transaction([this.storeName], 'readonly');
        const store = tx.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.get(taskId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('Failed to get task'));
        });
    }

    /**
     * Get all tasks (excludes deleted by default)
     */
    async getAllTasks(includeDeleted = false) {
        const tx = this.db.transaction([this.storeName], 'readonly');
        const store = tx.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.getAll();

            request.onsuccess = () => {
                let tasks = request.result;
                if (!includeDeleted) {
                    tasks = tasks.filter(task => !task.deleted);
                }
                resolve(tasks);
            };
            request.onerror = () => reject(new Error('Failed to get tasks'));
        });
    }

    /**
     * Get deleted tasks only (trash)
     */
    async getDeletedTasks() {
        const tx = this.db.transaction([this.storeName], 'readonly');
        const store = tx.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const request = store.getAll();

            request.onsuccess = () => {
                const tasks = request.result.filter(task => task.deleted);
                resolve(tasks);
            };
            request.onerror = () => reject(new Error('Failed to get deleted tasks'));
        });
    }

    /**
     * Filter tasks
     */
    async filterTasks(filters) {
        const allTasks = await this.getAllTasks();

        // First, find all tasks that match the filter criteria
        const matchedTasks = allTasks.filter(task => {
            // Filter by ID
            if (filters.id !== undefined) {
                const filterValue = filters.id.value !== undefined ? filters.id.value : filters.id;
                const negate = filters.id.negate || false;
                let matches = false;

                if (Array.isArray(filterValue)) {
                    matches = filterValue.includes(task.id);
                } else {
                    matches = task.id === filterValue;
                }

                if (negate ? matches : !matches) return false;
            }

            // Filter by project
            if (filters.project !== undefined) {
                const filterValue = filters.project.value !== undefined ? filters.project.value : filters.project;
                const negate = filters.project.negate || false;

                const matches = task.project &&
                    task.project.toLowerCase() === filterValue.toLowerCase();

                if (negate ? matches : !matches) return false;
            }

            // Filter by priority
            if (filters.priority !== undefined) {
                const filterValue = filters.priority.value !== undefined ? filters.priority.value : filters.priority;
                const negate = filters.priority.negate || false;

                const matches = task.priority && task.priority.toLowerCase() === filterValue.toLowerCase();

                if (negate ? matches : !matches) return false;
            }

            // Filter by status
            if (filters.status !== undefined) {
                const filterValue = filters.status.value !== undefined ? filters.status.value : filters.status;
                const negate = filters.status.negate || false;

                const matches = task.status.toLowerCase() === filterValue.toLowerCase();

                if (negate ? matches : !matches) return false;
            }

            return true;
        });

        // Now include all ancestors and descendants for matched tasks
        const resultIds = new Set(matchedTasks.map(t => t.id));
        const additionalTasks = new Set();

        for (const task of matchedTasks) {
            // Include all ancestors (parent, grandparent)
            let current = task;
            while (current.parentTaskId !== null && current.parentTaskId !== undefined) {
                if (!resultIds.has(current.parentTaskId)) {
                    additionalTasks.add(current.parentTaskId);
                }
                current = allTasks.find(t => t.id === current.parentTaskId);
                if (!current) break;
            }

            // Include all descendants (children, grandchildren)
            const addDescendants = (t) => {
                if (t.childTaskIds && t.childTaskIds.length > 0) {
                    for (const childId of t.childTaskIds) {
                        if (!resultIds.has(childId)) {
                            additionalTasks.add(childId);
                        }
                        const child = allTasks.find(c => c.id === childId);
                        if (child) {
                            addDescendants(child);
                        }
                    }
                }
            };
            addDescendants(task);
        }

        // Add additional tasks to the result
        const finalTasks = [...matchedTasks];
        for (const taskId of additionalTasks) {
            const task = allTasks.find(t => t.id === taskId);
            if (task) {
                finalTasks.push(task);
            }
        }

        // Sort to ensure proper hierarchy (ancestors before descendants)
        return finalTasks.sort((a, b) => {
            const depthA = this.getTaskDepthSync(a, allTasks);
            const depthB = this.getTaskDepthSync(b, allTasks);
            if (depthA !== depthB) return depthA - depthB;
            return a.id - b.id;
        });
    }

    /**
     * Synchronous version of getTaskDepth for sorting
     */
    getTaskDepthSync(task, allTasks) {
        let depth = 0;
        let current = task;

        while (current.parentTaskId !== null && current.parentTaskId !== undefined) {
            depth++;
            current = allTasks.find(t => t.id === current.parentTaskId);
            if (!current) break;
        }

        return depth;
    }

    /**
     * Sort tasks by priority
     */
    sortByPriority(tasks) {
        const priorityOrder = {
            'Critical': 0,
            'High': 1,
            'Medium': 2,
            'Low': 3
        };

        return [...tasks].sort((a, b) => {
            // Completed tasks (null priority) always go to the bottom
            const aPriorityNull = a.priority === null;
            const bPriorityNull = b.priority === null;

            if (aPriorityNull && !bPriorityNull) return 1;
            if (!aPriorityNull && bPriorityNull) return -1;
            if (aPriorityNull && bPriorityNull) {
                // Both completed - sort by ID (most recent first)
                return b.id - a.id;
            }

            // First sort by priority
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            // If same priority, sort by due date (earliest first)
            // Tasks without due date go to the end
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;

            const dateA = new Date(a.dueDate);
            const dateB = new Date(b.dueDate);
            return dateA - dateB;
        });
    }

    /**
     * Check if task is overdue
     */
    isTaskOverdue(task) {
        if (!task.dueDate) return false;
        const now = new Date();
        const dueDate = new Date(task.dueDate);
        return dueDate < now && task.status !== 'Completed';
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        if (!dateString) return '-';

        try {
            const date = new Date(dateString);
            const now = new Date();

            // Check if overdue
            if (date < now) {
                return 'OVERDUE!';
            }

            // Format date
            const options = {
                timeZone: 'Australia/Sydney',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            };

            return date.toLocaleString('en-AU', options);
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Parse date input (supports YYYY-MM-DD, YYYY-MM-DD HH:MM, relative dates)
     */
    parseDate(input) {
        if (!input || input.trim() === '') return null;

        const trimmed = input.trim().toLowerCase();

        // Handle relative dates
        if (trimmed === 'today') {
            return new Date();
        }
        if (trimmed === 'tomorrow') {
            const date = new Date();
            date.setDate(date.getDate() + 1);
            return date;
        }

        // Handle +Nd format (e.g., +3d for 3 days from now)
        const relativeDaysMatch = trimmed.match(/^\+(\d+)d$/);
        if (relativeDaysMatch) {
            const days = parseInt(relativeDaysMatch[1]);
            const date = new Date();
            date.setDate(date.getDate() + days);
            return date;
        }

        // Try to parse as ISO date
        const date = new Date(input);
        if (!isNaN(date.getTime())) {
            return date;
        }

        throw new Error('Invalid date format. Use YYYY-MM-DD, YYYY-MM-DD HH:MM, or relative dates (today, tomorrow, +3d)');
    }

    /**
     * Add note to task
     */
    async addNote(taskId, noteContent) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            throw new Error(`Task with ID ${taskId} not found`);
        }

        const note = {
            timestamp: new Date().toISOString(),
            content: noteContent
        };

        task.notes.push(note);
        await this.saveTask(task);
        return note;
    }

    /**
     * Get tasks organized by hierarchy (grandparents -> parents -> children)
     */
    getTasksHierarchical(tasks) {
        const result = [];
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const addedIds = new Set();

        // Recursive function to add task and its descendants
        const addTaskWithDescendants = (task) => {
            if (addedIds.has(task.id)) return;
            addedIds.add(task.id);
            result.push(task);

            // Add children immediately after
            if (task.childTaskIds && task.childTaskIds.length > 0) {
                task.childTaskIds.forEach(childId => {
                    const child = taskMap.get(childId);
                    if (child && !addedIds.has(childId)) {
                        addTaskWithDescendants(child);
                    }
                });
            }
        };

        // First pass: add all root tasks (tasks with no parent)
        tasks.forEach(task => {
            if (task.parentTaskId === null || task.parentTaskId === undefined) {
                addTaskWithDescendants(task);
            }
        });

        // Second pass: add any orphaned tasks (parent not in current list)
        tasks.forEach(task => {
            if (!addedIds.has(task.id)) {
                addTaskWithDescendants(task);
            }
        });

        return result;
    }

    /**
     * Export all data (for backup)
     */
    async exportData() {
        const tasks = await this.getAllTasks();
        const tx = this.db.transaction(['metadata'], 'readonly');
        const store = tx.objectStore('metadata');

        return new Promise((resolve, reject) => {
            const request = store.get('nextId');

            request.onsuccess = () => {
                const nextId = request.result ? request.result.value : 1;
                resolve({
                    tasks,
                    nextId,
                    exportDate: new Date().toISOString()
                });
            };

            request.onerror = () => reject(new Error('Failed to export data'));
        });
    }

    /**
     * Import data (for restore)
     */
    async importData(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([this.storeName, 'metadata'], 'readwrite');
            const taskStore = tx.objectStore(this.storeName);
            const metaStore = tx.objectStore('metadata');

            // Clear existing data
            taskStore.clear();

            // Import all tasks
            for (const task of data.tasks) {
                taskStore.put(task);
            }

            // Import nextId
            metaStore.put({ key: 'nextId', value: data.nextId });

            // Transaction completed
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(new Error('Failed to import data: ' + tx.error));
        });
    }

    /**
     * Record an action for undo/redo
     */
    recordAction(action) {
        this.undoStack.push(action);

        // Limit stack size
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }

        // Clear redo stack when new action is performed
        this.redoStack = [];
    }

    /**
     * Undo the last action
     */
    async undo() {
        if (this.undoStack.length === 0) {
            throw new Error('Nothing to undo');
        }

        const action = this.undoStack.pop();

        try {
            switch (action.type) {
                case 'delete':
                    // Restore all deleted tasks (in reverse order: grandchildren first, then parents, then grandparent)
                    // This ensures parent relationships are properly restored
                    const tasksToRestore = action.deletedTaskIds || [action.taskId];
                    // Reverse so we restore deepest descendants first
                    for (let i = tasksToRestore.length - 1; i >= 0; i--) {
                        await this.restoreTaskWithoutHistory(tasksToRestore[i]);
                    }
                    break;

                case 'modify':
                    // Restore previous state
                    await this.updateTaskWithoutHistory(action.taskId, action.previousState);
                    break;

                case 'create':
                    // Delete the created task
                    const task = await this.getTaskById(action.taskId);
                    if (task) {
                        // Remove from parent's childTaskIds if it has a parent
                        if (task.parentTaskId !== null) {
                            const parent = await this.getTaskById(task.parentTaskId);
                            if (parent) {
                                parent.childTaskIds = parent.childTaskIds.filter(id => id !== action.taskId);
                                await this.saveTask(parent);
                            }
                        }
                        task.deleted = true;
                        task.deletedAt = new Date().toISOString();
                        await this.saveTask(task);
                    }
                    break;

                case 'restore':
                    // Re-delete the task
                    const restoredTask = await this.getTaskById(action.taskId);
                    if (restoredTask) {
                        // Remove from parent's childTaskIds if it has a parent
                        if (restoredTask.parentTaskId !== null) {
                            const parent = await this.getTaskById(restoredTask.parentTaskId);
                            if (parent) {
                                parent.childTaskIds = parent.childTaskIds.filter(id => id !== action.taskId);
                                await this.saveTask(parent);
                            }
                        }
                        restoredTask.deleted = true;
                        restoredTask.deletedAt = new Date().toISOString();
                        await this.saveTask(restoredTask);
                    }
                    break;

                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }

            // Move to redo stack
            this.redoStack.push(action);

            return action;
        } catch (error) {
            // Put action back if undo failed
            this.undoStack.push(action);
            throw error;
        }
    }

    /**
     * Redo the last undone action
     */
    async redo() {
        if (this.redoStack.length === 0) {
            throw new Error('Nothing to redo');
        }

        const action = this.redoStack.pop();

        try {
            switch (action.type) {
                case 'delete':
                    // Re-delete all tasks that were deleted in original action
                    const tasksToDelete = action.deletedTaskIds || [action.taskId];
                    for (const delTaskId of tasksToDelete) {
                        await this.deleteTaskWithoutHistory(delTaskId);
                    }
                    break;

                case 'modify':
                    // Re-apply the new state
                    await this.updateTaskWithoutHistory(action.taskId, action.newState);
                    break;

                case 'create':
                    // Restore the created task
                    await this.restoreTask(action.taskId);
                    break;

                case 'restore':
                    // Re-restore the task
                    await this.restoreTask(action.taskId);
                    break;

                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }

            // Move back to undo stack
            this.undoStack.push(action);

            return action;
        } catch (error) {
            // Put action back if redo failed
            this.redoStack.push(action);
            throw error;
        }
    }

    /**
     * Update task without recording to history (for undo/redo operations)
     */
    async updateTaskWithoutHistory(taskId, updates) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            throw new Error(`Task with ID ${taskId} not found`);
        }

        // Handle parent relationship changes (important for undo/redo with grandchildren)
        if (updates.parentTaskId !== undefined && updates.parentTaskId !== task.parentTaskId) {
            // Remove from old parent's childTaskIds
            if (task.parentTaskId !== null) {
                const oldParent = await this.getTaskById(task.parentTaskId);
                if (oldParent) {
                    oldParent.childTaskIds = oldParent.childTaskIds.filter(id => id !== taskId);
                    await this.saveTask(oldParent);
                }
            }

            // Add to new parent's childTaskIds
            if (updates.parentTaskId !== null) {
                const newParent = await this.getTaskById(updates.parentTaskId);
                if (newParent && !newParent.childTaskIds.includes(taskId)) {
                    newParent.childTaskIds.push(taskId);
                    await this.saveTask(newParent);
                }
            }
        }

        // Apply updates
        Object.keys(updates).forEach(key => {
            if (key !== 'id' && key !== 'childTaskIds') {
                task[key] = updates[key];
            }
        });

        await this.saveTask(task);
        return task;
    }

    /**
     * Delete a task without recording to history (for redo operations)
     */
    async deleteTaskWithoutHistory(taskId) {
        const task = await this.getTaskById(taskId);
        if (!task) {
            return null; // Task may not exist, skip silently
        }

        if (task.deleted) {
            return task; // Already deleted, skip
        }

        // Remove from parent's childTaskIds if applicable
        if (task.parentTaskId !== null) {
            const parent = await this.getTaskById(task.parentTaskId);
            if (parent) {
                parent.childTaskIds = parent.childTaskIds.filter(id => id !== taskId);
                await this.saveTask(parent);
            }
        }

        // Soft delete the task
        task.deleted = true;
        task.deletedAt = new Date().toISOString();
        await this.saveTask(task);

        return task;
    }
}
