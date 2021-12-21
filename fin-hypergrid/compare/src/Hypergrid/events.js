/* eslint-env browser */

'use strict';

var _ = require('object-iterators');

/**
 * Hypergrid/index.js mixes this module into its prototype.
 * @mixin
 */
var mixin = {

    /**
     * @summary Add an event listener to me.
     * @desc Listeners added by this method should only be removed by {@link Hypergrid#removeEventListener|grid.removeEventListener} (or {@link Hypergrid#removeAllEventListeners|grid.removeAllEventListeners}).
     * @param {string} eventName - The type of event we are interested in.
     * @param {function} listener - The event handler.
     * @param {boolean} [internal=false] - Used by {@link Hypergrid#addInternalEventListener|grid.addInternalEventListener} (see).
     * @memberOf Hypergrid#
     */
    addEventListener: function addEventListener(eventName, listener, internal) {
        var self = this,
            listeners = this.listeners[eventName] = this.listeners[eventName] || [],
            alreadyAttached = listeners.find(function (info) {
            return info.listener === listener;
        });

        if (!alreadyAttached) {
            var info = {
                internal: internal,
                listener: listener,
                decorator: function decorator(e) {
                    if (self.allowEventHandlers) {
                        listener(e);
                    }
                }
            };
            listeners.push(info);
            this.canvas.addEventListener(eventName, info.decorator);
        }
    },

    /**
     * @summary Add an internal event listener to me.
     * @desc The new listener is flagged as "internal." Internal listeners are removed as usual by {@link Hypergrid#removeEventListener|grid.removeEventListener}. However, they are ignored by {@link Hypergrid#removeAllEventListeners|grid.removeAllEventListeners()} (as called by {@link Hypergrid#reset|reset}). (But see {@link Hypergrid#removeAllEventListeners|grid.removeAllEventListeners(true)}.)
     *
     * Listeners added by this method should only be removed by {@link Hypergrid#removeEventListener|grid.removeEventListener} (or {@link Hypergrid#removeAllEventListeners|grid.removeAllEventListeners(true)}).
     * @param {string} eventName - The type of event we are interested in.
     * @param {function} listener - The event handler.
     * @memberOf Hypergrid#
     */
    addInternalEventListener: function addInternalEventListener(eventName, listener) {
        this.addEventListener(eventName, listener, true);
    },

    /**
     * @summary Remove an event listeners.
     * @desc Removes the event listener with matching name and function that was added by {@link Hypergrid#addEventListener|grid.addEventListener}.
     *
     * NOTE: This method cannot remove event listeners added by other means.
     * @memberOf Hypergrid#
     */
    removeEventListener: function removeEventListener(eventName, listener) {
        var listenerList = this.listeners[eventName];

        if (listenerList) {
            listenerList.find(function (info, index) {
                if (info.listener === listener) {
                    if (listenerList.length === 1) {
                        delete this.listeners[eventName];
                    } else {
                        listenerList.splice(index, 1); // remove it from the list
                    }
                    this.canvas.removeEventListener(eventName, info.decorator);
                    return true;
                }
            }, this);
        }
    },

    /**
     * @summary Remove all event listeners.
     * @desc Removes all event listeners added with {@link Hypergrid#addEventListener|grid.addEventListener} except those added as "internal."
     * @param {boolean} [internal=false] - Include internal listeners.
     * @memberOf Hypergrid#
     */
    removeAllEventListeners: function removeAllEventListeners(internal) {
        _(this.listeners).each(function (listenerList, key) {
            listenerList.slice().forEach(function (info) {
                if (internal || !info.internal) {
                    this.removeEventListener(key, info.listener);
                }
            }, this);
        }, this);
    },

    allowEvents: function allowEvents(allow) {
        this.allowEventHandlers = !!allow;

        if (this.behavior.featureChain) {
            if (allow) {
                this.behavior.featureChain.attachChain();
            } else {
                this.behavior.featureChain.detachChain();
            }
        }

        this.behavior.changed();
    },

    /**
     * @memberOf Hypergrid#
     * @param {number} c - grid column index.
     * @param {string[]} keys
     */
    fireSyntheticColumnSortEvent: function fireSyntheticColumnSortEvent(c, keys) {
        return dispatchEvent.call(this, 'fin-column-sort', {
            column: c,
            keys: keys
        });
    },

    fireSyntheticEditorKeyUpEvent: function fireSyntheticEditorKeyUpEvent(inputControl, keyEvent) {
        return dispatchEvent.call(this, 'fin-editor-keyup', {
            input: inputControl,
            keyEvent: keyEvent,
            char: this.canvas.getCharMap()[keyEvent.keyCode][keyEvent.shiftKey ? 1 : 0]
        });
    },

    fireSyntheticApiDestroyCalled: function fireSyntheticApiDestroyCalled(total) {
        return dispatchEvent.call(this, 'fin-api-destroy-called', { total: total });
    },

    fireSyntheticEditorKeyDownEvent: function fireSyntheticEditorKeyDownEvent(inputControl, keyEvent) {
        return dispatchEvent.call(this, 'fin-editor-keydown', {
            input: inputControl,
            keyEvent: keyEvent,
            char: this.canvas.getCharMap()[keyEvent.keyCode][keyEvent.shiftKey ? 1 : 0]
        });
    },

    fireSyntheticEditorKeyPressEvent: function fireSyntheticEditorKeyPressEvent(inputControl, keyEvent) {
        return dispatchEvent.call(this, 'fin-editor-keypress', {
            input: inputControl,
            keyEvent: keyEvent,
            char: (this.canvas.getCharMap()[keyEvent.keyCode] || {})[keyEvent.shiftKey ? 1 : 0]
        });
    },

    fireSyntheticEditorDataChangeEvent: function fireSyntheticEditorDataChangeEvent(inputControl, oldValue, newValue) {
        return dispatchEvent.call(this, 'fin-editor-data-change', true, {
            input: inputControl,
            oldValue: oldValue,
            newValue: newValue
        });
    },

    fireSyntheticColumnsMovedEvent: function fireSyntheticColumnsMovedEvent(columns, toIndex) {
        return dispatchEvent.call(this, 'fin-columns-moved', true, {
            columns: columns,
            toIndex: toIndex
        });
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-row-selection-changed` event.
     */
    fireSyntheticRowSelectionChangedEvent: function fireSyntheticRowSelectionChangedEvent() {
        return dispatchEvent.call(this, 'fin-row-selection-changed', this.selectionDetailGetters);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-column-selection-changed` event.
     */
    fireSyntheticColumnSelectionChangedEvent: function fireSyntheticColumnSelectionChangedEvent() {
        return dispatchEvent.call(this, 'fin-column-selection-changed', this.selectionDetailGetters);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-grid-data-added` event.
     * @param {array} dataRows - added data rows
     */
    fireSyntheticGridDataAddedEvent: function fireSyntheticGridDataAddedEvent(dataRows) {
        return dispatchEvent.call(this, 'fin-grid-data-added', true, {
            dataRows: dataRows
        });
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-context-menu` event
     * @param {keyEvent} event - The canvas event.
     */
    fireSyntheticContextMenuEvent: function fireSyntheticContextMenuEvent(event) {
        Object.defineProperties(event, this.selectionDetailGetterDescriptors);
        return dispatchEvent.call(this, 'fin-context-menu', {}, event);
    },

    fireSyntheticMouseUpEvent: function fireSyntheticMouseUpEvent(event) {
        Object.defineProperties(event, this.selectionDetailGetterDescriptors);
        return dispatchEvent.call(this, 'fin-mouseup', {}, event);
    },

    fireSyntheticMouseDownEvent: function fireSyntheticMouseDownEvent(event) {
        Object.defineProperties(event, this.selectionDetailGetterDescriptors);
        return dispatchEvent.call(this, 'fin-mousedown', {}, event);
    },

    fireSyntheticMouseMoveEvent: function fireSyntheticMouseMoveEvent(event) {
        return dispatchEvent.call(this, 'fin-mousemove', {}, event);
    },

    fireSyntheticButtonPressedEvent: function fireSyntheticButtonPressedEvent(event) {
        var subrects = this.isViewableButton(event.dataCell.x, event.gridCell.y);
        if (subrects) {
            var subrow = subrects.findIndex(function (bounds) {
                var mouse = event.primitiveEvent.detail.mouse;
                return bounds.y <= mouse.y && mouse.y < bounds.y + bounds.height;
            });
            if (subrow >= 0) {
                event.subrow = subrow;
                return dispatchEvent.call(this, 'fin-button-pressed', {}, event);
            }
        }
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-column-drag-start` event.
     */
    fireSyntheticOnColumnsChangedEvent: function fireSyntheticOnColumnsChangedEvent() {
        return dispatchEvent.call(this, 'fin-column-changed-event', {});
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-column-drag-start` event.
     */
    fireSyntheticOnColumnResizedEvent: function fireSyntheticOnColumnResizedEvent(columnOrIndex, width) {
        var event = {
            columnOrIndex: columnOrIndex,
            width: width
        };
        return dispatchEvent.call(this, 'fin-column-resized-event', {}, event);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-fixed-column-count-changed` event.
     */
    fireSyntheticOnFixedColumnCountChangedEvent: function fireSyntheticOnFixedColumnCountChangedEvent(oldFixedCount, newFixedCount) {
        var event = {
            oldFixedCount: oldFixedCount,
            newFixedCount: newFixedCount
        };
        return dispatchEvent.call(this, 'fin-fixed-column-count-changed', {}, event);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-fixed-row-count-changed` event.
     */
    fireSyntheticOnFixedRowCountChangedEvent: function fireSyntheticOnFixedRowCountChangedEvent(oldFixedCount, newFixedCount) {
        var event = {
            oldFixedCount: oldFixedCount,
            newFixedCount: newFixedCount
        };
        return dispatchEvent.call(this, 'fin-fixed-row-count-changed', {}, event);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-keydown` event.
     * @param {keyEvent} event - The canvas event.
     */
    fireSyntheticKeydownEvent: function fireSyntheticKeydownEvent(keyEvent) {
        return dispatchEvent.call(this, 'fin-keydown', keyEvent.detail);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-keyup` event.
     * @param {keyEvent} event - The canvas event.
     */
    fireSyntheticKeyupEvent: function fireSyntheticKeyupEvent(keyEvent) {
        return dispatchEvent.call(this, 'fin-keyup', keyEvent.detail);
    },

    fireSyntheticFilterAppliedEvent: function fireSyntheticFilterAppliedEvent() {
        return dispatchEvent.call(this, 'fin-filter-applied', {});
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-cell-enter` event
     * @param {Point} cell - The pixel location of the cell in which the click event occurred.
     * @param {MouseEvent} event - The system mouse event.
     */
    fireSyntheticOnCellEnterEvent: function fireSyntheticOnCellEnterEvent(cellEvent) {
        return dispatchEvent.call(this, 'fin-cell-enter', cellEvent);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-cell-exit` event.
     * @param {Point} cell - The pixel location of the cell in which the click event occured.
     * @param {MouseEvent} event - The system mouse event.
     */
    fireSyntheticOnCellExitEvent: function fireSyntheticOnCellExitEvent(cellEvent) {
        return dispatchEvent.call(this, 'fin-cell-exit', cellEvent);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-cell-click` event.
     * @param {Point} cell - The pixel location of the cell in which the click event occured.
     * @param {MouseEvent} event - The system mouse event.
     */
    fireSyntheticClickEvent: function fireSyntheticClickEvent(cellEvent) {
        return dispatchEvent.call(this, 'fin-click', {}, cellEvent);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a `fin-double-click` event.
     * @param {MouseEvent} event - The system mouse event.
     */
    fireSyntheticDoubleClickEvent: function fireSyntheticDoubleClickEvent(cellEvent) {
        if (!this.abortEditing()) {
            return;
        }

        return dispatchEvent.call(this, 'fin-double-click', {}, cellEvent);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a rendered event.
     */
    fireSyntheticGridRenderedEvent: function fireSyntheticGridRenderedEvent() {
        return dispatchEvent.call(this, 'fin-grid-rendered', { source: this });
    },

    fireSyntheticTickEvent: function fireSyntheticTickEvent() {
        return dispatchEvent.call(this, 'fin-tick', { source: this });
    },

    fireSyntheticGridResizedEvent: function fireSyntheticGridResizedEvent(e) {
        return dispatchEvent.call(this, 'fin-grid-resized', e);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a scroll event.
     * @param {string} type - Should be either `fin-scroll-x` or `fin-scroll-y`.
     * @param {number} oldValue - The old scroll value.
     * @param {number} newValue - The new scroll value.
     */
    fireScrollEvent: function fireScrollEvent(eventName, oldValue, newValue) {
        return dispatchEvent.call(this, eventName, {
            oldValue: oldValue,
            value: newValue
        });
    },

    fireRequestCellEdit: function fireRequestCellEdit(cellEvent, value) {
        return dispatchEvent.call(this, 'fin-request-cell-edit', true, { value: value }, cellEvent);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and fire a fin-before-cell-edit event.
     * @param {Point} cell - The x,y coordinates.
     * @param {Object} value - The current value.
     * @returns {boolean} Proceed (don't cancel).
     */
    fireBeforeCellEdit: function fireBeforeCellEdit(cellEvent, oldValue, newValue, control) {
        return dispatchEvent.call(this, 'fin-before-cell-edit', true, {
            oldValue: oldValue,
            newValue: newValue,
            input: control
        }, cellEvent);
    },

    /**
     * @memberOf Hypergrid#
     * @returns {Renderer} sub-component
     * @param {Point} cell - The x,y coordinates.
     * @param {Object} oldValue - The old value.
     * @param {Object} newValue - The new value.
     */
    fireAfterCellEdit: function fireAfterCellEdit(cellEvent, oldValue, newValue, control) {
        return dispatchEvent.call(this, 'fin-after-cell-edit', {
            newValue: newValue,
            oldValue: oldValue,
            input: control
        }, cellEvent);
    },

    /**
     * @memberOf Hypergrid#
     * @returns {Renderer} sub-component
     * @param {Point} cell - The x,y coordinates.
     * @param {Object} oldValue - The old value.
     * @param {Object} newValue - The new value.
     */
    fireAfterHeaderCellEdit: function fireAfterHeaderCellEdit(cellEvent, oldValue, newValue, control) {
        return dispatchEvent.call(this, 'fin-after-header-cell-edit', {
            newValue: newValue,
            oldValue: oldValue,
            input: control
        }, cellEvent);
    },

    delegateCanvasEvents: function delegateCanvasEvents() {
        var grid = this;

        function handleMouseEvent(e, cb) {
            if (grid.getLogicalRowCount() === 0) {
                return;
            }

            var c = grid.getGridCellFromMousePoint(e.detail.mouse),
                primitiveEvent,
                decoratedEvent;

            // No events on the whitespace of the grid unless they're drag events
            if (c && (!c.fake || e.detail.dragstart)) {
                primitiveEvent = c.cellEvent;
            }

            if (primitiveEvent) {
                decoratedEvent = Object.defineProperty(primitiveEvent, 'primitiveEvent', {
                    value: e,
                    enumerable: false,
                    configurable: true,
                    writable: true
                });
                cb.call(grid, decoratedEvent);
            }
        }

        this.addInternalEventListener('fin-canvas-resized', function (e) {
            grid.resized();
            grid.fireSyntheticGridResizedEvent(e);
        });

        this.addInternalEventListener('fin-canvas-mousemove', function (e) {
            if (grid.properties.readOnly) {
                return;
            }
            handleMouseEvent(e, function (mouseEvent) {
                this.delegateMouseMove(mouseEvent);
                this.fireSyntheticMouseMoveEvent(mouseEvent);
            });
        });

        this.addInternalEventListener('fin-canvas-mousedown', function (e) {
            if (grid.properties.readOnly) {
                return;
            }
            if (!grid.abortEditing()) {
                event.stopPropagation();
                return;
            }

            handleMouseEvent(e, function (mouseEvent) {
                mouseEvent.keys = e.detail.keys;
                this.mouseDownState = mouseEvent;
                this.delegateMouseDown(mouseEvent);
                this.fireSyntheticMouseDownEvent(mouseEvent);
                this.repaint();
            });
        });

        this.addInternalEventListener('fin-canvas-outside-mousedown', function (e) {
            grid.delegateCanvasOutsideMousedown(event);
        });

        this.addInternalEventListener('fin-canvas-click', function (e) {
            if (grid.properties.readOnly) {
                return;
            }
            handleMouseEvent(e, function (mouseEvent) {
                mouseEvent.keys = e.detail.keys; // todo: this was in fin-tap but wasn't here
                this.fireSyntheticClickEvent(mouseEvent);
                this.delegateClick(mouseEvent);
            });
        });

        this.addInternalEventListener('fin-canvas-mouseup', function (e) {
            if (grid.properties.readOnly) {
                return;
            }
            grid.dragging = false;
            if (grid.isScrollingNow()) {
                grid.setScrollingNow(false);
            }
            if (grid.columnDragAutoScrolling) {
                grid.columnDragAutoScrolling = false;
            }
            handleMouseEvent(e, function (mouseEvent) {
                this.delegateMouseUp(mouseEvent);
                if (grid.mouseDownState) {
                    grid.fireSyntheticButtonPressedEvent(grid.mouseDownState);
                }
                this.mouseDownState = null;
                this.fireSyntheticMouseUpEvent(mouseEvent);
            });
        });

        this.addInternalEventListener('fin-canvas-dblclick', function (e) {
            if (grid.properties.readOnly) {
                return;
            }
            handleMouseEvent(e, function (mouseEvent) {
                this.fireSyntheticDoubleClickEvent(mouseEvent, e);
                this.delegateDoubleClick(mouseEvent);
            });
        });

        this.addInternalEventListener('fin-canvas-drag', function (e) {
            if (grid.properties.readOnly) {
                return;
            }
            grid.dragging = true;
            handleMouseEvent(e, grid.delegateMouseDrag);
        });

        this.addInternalEventListener('fin-canvas-keydown', function (e) {
            if (grid.properties.readOnly) {
                return;
            }
            grid.fireSyntheticKeydownEvent(e);
            grid.delegateKeyDown(e);
        });

        this.addInternalEventListener('fin-api-destroy-called', function (e) {
            grid.delegateApiDestroyCalled(e);
        });

        this.addInternalEventListener('fin-canvas-keyup', function (e) {
            if (grid.properties.readOnly) {
                return;
            }
            grid.fireSyntheticKeyupEvent(e);
            grid.delegateKeyUp(e);
        });

        this.addInternalEventListener('fin-canvas-wheelmoved', function (e) {
            handleMouseEvent(e, grid.delegateWheelMoved);
        });

        this.addInternalEventListener('fin-canvas-mouseout', function (e) {
            if (grid.properties.readOnly) {
                return;
            }
            handleMouseEvent(e, grid.delegateMouseExit);
        });

        this.addInternalEventListener('fin-canvas-context-menu', function (e) {
            handleMouseEvent(e, function (mouseEvent) {
                grid.delegateContextMenu(mouseEvent);
                grid.fireSyntheticContextMenuEvent(mouseEvent);
            });
        });

        this.addInternalEventListener('fin-grid-rendered', function (e) {
            grid.delegateGridRendered(event);
        });

        //Register a listener for the copy event so we can copy our selected region to the pastebuffer if conditions are right.
        document.body.addEventListener('copy', function (evt) {
            grid.checkClipboardCopy(evt);
        });

        document.body.addEventListener('paste', function (evt) {
            console.log(evt.clipboardData.getData('text/html'));
        });

        this.addInternalEventListener('fin-column-resized-event', function (e) {
            grid.delegateColumnResizedEvent(event);

            grid.synchronizeScrollbarsVisualization();
        });

        this.addInternalEventListener('fin-fixed-column-count-changed', function (e) {
            grid.synchronizeScrollbarsVisualization();
        });

        this.addInternalEventListener('fin-fixed-row-count-changed', function (e) {
            grid.synchronizeScrollbarsVisualization();
        });

        this.addInternalEventListener('fin-after-cell-edit', function (e) {
            console.log('-----------fin-after-cell-edit--1-----------');
            var headerRowY = grid.properties.useHeaders ? grid.getFictiveHeaderRowsCount() : 0;
            if (e.detail.primitiveEvent.y <= headerRowY) {
                grid.fireAfterHeaderCellEdit(e.detail.primitiveEvent, e.detail.oldValue, e.detail.newValue, e.detail.input);
            }
        });

        this.addInternalEventListener('fin-after-header-cell-edit', function (e) {
            if (e.detail.newValue !== e.detail.oldValue) {
                var column = grid.behavior.getActiveColumn(e.detail.primitiveEvent.x);
                grid.behavior.fitColumn(column); // recalculate preferredWidth for column
                if (grid.onUpdateColumnName) {
                    if (column) {
                        grid.onUpdateColumnName(column, e.detail.newValue);

                        // refresh names from colDefs
                        var rowProps = grid.behavior.getRowProperties(0);
                        if (rowProps && rowProps.headerRow) {
                            var row = grid.getRow(0);

                            grid.getColumns().forEach(function (c) {
                                if (c.colDef && row[c.name] !== c.colDef.headerName) {
                                    row[c.name] = c.colDef.headerName;
                                }
                            });
                        }
                    }
                }
            }
        });

        this.addInternalEventListener('fin-grid-data-added', function (e) {
            grid.delegateGridDataAdded(e);
        });
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate the wheel moved event to the behavior.
     * @param {Event} event - The pertinent event.
     */
    delegateWheelMoved: function delegateWheelMoved(event) {
        this.behavior.onWheelMoved(this, event);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate MouseExit to the behavior (model).
     * @param {Event} event - The pertinent event.
     */
    delegateMouseExit: function delegateMouseExit(event) {
        this.behavior.handleMouseExit(this, event);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate MouseExit to the behavior (model).
     * @param {Event} event - The pertinent event.
     */
    delegateContextMenu: function delegateContextMenu(event) {
        this.behavior.onContextMenu(this, event);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate GridRendered to the behavior (model).
     * @param {Event} event - The pertinent event.
     */
    delegateGridRendered: function delegateGridRendered(event) {
        this.behavior.onGridRendered(this, event);
    },

    delegateColumnResizedEvent: function delegateColumnResizedEvent(event) {
        this.behavior.onColumnResizedEvent(this, event);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate MouseMove to the behavior (model).
     * @param {mouseDetails} mouseDetails - An enriched mouse event from fin-canvas.
     */
    delegateMouseMove: function delegateMouseMove(mouseDetails) {
        this.behavior.onMouseMove(this, mouseDetails);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate mousedown to the behavior (model).
     * @param {mouseDetails} mouseDetails - An enriched mouse event from fin-canvas.
     */
    delegateMouseDown: function delegateMouseDown(mouseDetails) {
        this.behavior.handleMouseDown(this, mouseDetails);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate mousedown to the behavior (model).
     * @param {mouseDetails} mouseDetails - An enriched mouse event from fin-canvas.
     */
    delegateCanvasOutsideMousedown: function delegateCanvasOutsideMousedown(mouseDetails) {
        this.behavior.handleCanvasOutsideMouseDown(this, mouseDetails);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate mouseup to the behavior (model).
     * @param {mouseDetails} mouseDetails - An enriched mouse event from fin-canvas.
     */
    delegateMouseUp: function delegateMouseUp(mouseDetails) {
        this.behavior.onMouseUp(this, mouseDetails);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate click to the behavior (model).
     * @param {mouseDetails} mouseDetails - An enriched mouse event from fin-canvas.
     */
    delegateClick: function delegateClick(mouseDetails) {
        this.behavior.onClick(this, mouseDetails);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Delegate mouseDrag to the behavior (model).
     * @param {mouseDetails} mouseDetails - An enriched mouse event from fin-canvas.
     */
    delegateMouseDrag: function delegateMouseDrag(mouseDetails) {
        this.behavior.onMouseDrag(this, mouseDetails);
    },

    /**
     * @memberOf Hypergrid#
     * @desc We've been doubleclicked on. Delegate through the behavior (model).
     * @param {mouseDetails} mouseDetails - An enriched mouse event from fin-canvas.
     */
    delegateDoubleClick: function delegateDoubleClick(mouseDetails) {
        this.behavior.onDoubleClick(this, mouseDetails);
    },

    /**
     * @memberOf Hypergrid#
     * @summary Generate a function name and call it on self.
     * @desc This should also be delegated through Behavior keeping the default implementation here though.
     * @param {event} event - The pertinent event.
     */
    delegateKeyDown: function delegateKeyDown(event) {
        this.behavior.onKeyDown(this, event);
    },

    /**
     * @memberOf Hypergrid#
     * @summary Generate a function name and call it on self.
     * @desc This should also be delegated through Behavior keeping the default implementation here though.
     * @param {event} event - The pertinent event.
     */
    delegateApiDestroyCalled: function delegateApiDestroyCalled(event) {
        this.behavior.onApiDestroyCalled(this, event);
    },

    /**
     * @memberOf Hypergrid#
     * @summary Generate a function name and call it on self.
     * @desc This should also be delegated through Behavior keeping the default implementation here though.
     * @param {event} event - The pertinent event.
     */
    delegateKeyUp: function delegateKeyUp(event) {
        this.behavior.onKeyUp(this, event);
    },

    /**
     * @memberOf Hypergrid#
     * @summary Generate a function name and call it on self.
     * @desc This should also be delegated through Behavior keeping the default implementation here though.
     * @param {event} event - The pertinent event.
     */
    delegateGridDataAdded: function delegateGridDataAdded(event) {
        this.behavior.onDataAdded(this, event);
    }
};

var details = ['gridCell', 'dataCell', 'mousePoint', 'keys', 'row'];

/**
 * @this {Hypergrid}
 * @param {string} eventName
 * @param {boolean} [cancelable=false]
 * @param {object} event
 * @param {CellEvent|MouseEvent|KeyboardEvent|object} [primitiveEvent]
 * @returns {undefined|boolean}
 */
function dispatchEvent(eventName, cancelable, event, primitiveEvent) {
    var detail, result;

    if (!this.canvas) {
        return;
    }

    if (typeof cancelable !== 'boolean') {
        primitiveEvent = event; // propmote primitiveEvent to 3rd position
        event = cancelable; // promote event to 2nd position
        cancelable = false; // default when omitted
    }

    if (!event.detail) {
        event = { detail: event };
    }

    detail = event.detail;

    if (!detail.grid) {
        // CellEvent objects already have a (read-only) `grid` prop
        detail.grid = this;
    }

    detail.time = Date.now();

    if (primitiveEvent) {
        if (!detail.primitiveEvent) {
            detail.primitiveEvent = primitiveEvent;
        }
        details.forEach(function (key) {
            if (key in primitiveEvent && !(key in detail)) {
                detail[key] = primitiveEvent[key];
            }
        });
        if ('dataRow' in primitiveEvent) {
            // reference (without invoking) cellEvent's `dataRow` getter when available
            Object.defineProperty(detail, 'row', { get: function get() {
                    return primitiveEvent.dataRow;
                } });
        }
    }

    if (cancelable) {
        event.cancelable = true;
    }

    result = this.canvas.dispatchEvent(new CustomEvent(eventName, event));

    return !cancelable || result;
}

module.exports = {
    mixin: mixin,
    dispatchEvent: dispatchEvent
};
