/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

export class RedoUndoManager {
    constructor(on_redo_undo) {
        // Store list of actions for undo action
        this._undo_stack = [];
        // Store list of actions for redo action
        this._redo_stack = [];
        // Call back function
        this._on_redo_undo = on_redo_undo;
    }

    /**
     * Add action to undo stack
     * Reset redo stack
     * @param {*} action 
     */
    add(action) {
        if (action) {
            this._undo_stack.push(action);
            this._redo_stack = [];
        }
    }

    /**
     * Undo action
     * Back to previous state of viewer
     * Get and remove action from undo stack and add to redo stack
     */
    undo() {
        var action = this._undo_stack.pop();
        if (action) {
            action.undo();
            this._redo_stack.push(action);
        }
        if (this._on_redo_undo) {
            this._on_redo_undo();
        }
    }

    /**
     * Redo action
     * Forward to next state of viewer
     * Get and remove action from redo stack and add to undo stack
     */
    redo() {
        var action = this._redo_stack.pop();
        if (action) {
            action.execute();
            this._undo_stack.push(action);
        }
        if (this._on_redo_undo) {
            this._on_redo_undo();
        }
    }

    /**
     * Clear all stacks
     */
    reset() {
        this._undo_stack = [];
        this._redo_stack = [];
    }

    /**
     * Get last action for change width
     */
    get_last_action() {
        if (this._redo_stack.length > 0) {
            return undefined;
        }
        if (this._undo_stack.length == 0) {
            return undefined;
        }
        return this._undo_stack[this._undo_stack.length - 1];
    }

    /**
     * Get undo stack
     */
    get undo_stack() {
        return this._undo_stack;
    }

    /**
     * Get redo stack
     */
    get redo_stack() {
        return this._redo_stack;
    }

    /**
     * Check can undo to previous action
     */
    get can_undo() {
        return (this._undo_stack || []).length > 0;
    }

    /**
     * Check can redo to next action
     */
    get can_redo() {
        return (this._redo_stack || []).length > 0;
    }
}