'use strict';

var Feature = require('./Feature');

/**
 * @constructor
 * @extends Feature
 */
var ColumnResizing = Feature.extend('ColumnResizing', {

    /**
     * the pixel location of the where the drag was initiated
     * @type {number}
     * @default
     * @memberOf ColumnResizing.prototype
     */
    dragStart: -1,

    /**
     * the starting width/height of the row/column we are dragging
     * @type {number}
     * @default -1
     * @memberOf ColumnResizing.prototype
     */
    dragStartWidth: -1,

    /**
     * @memberOf ColumnResizing.prototype
     * @desc get the mouse x,y coordinate
     * @returns {number}
     * @param {MouseEvent} event - the mouse event to query
     */
    getMouseValue: function getMouseValue(event) {
        return event.primitiveEvent.detail.mouse.x;
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @desc returns the index of which divider I'm over
     * @returns {boolean}
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    overAreaDivider: function overAreaDivider(grid, event) {
        var leftMostColumnIndex = grid.behavior.leftMostColIndex;

        // near left border of column
        if (event.gridCell.x !== leftMostColumnIndex && event.mousePoint.x <= 3) {
            var leftColumn = grid.behavior.getColumnShifted(event.gridCell.x, false);
            if (leftColumn && !leftColumn.properties.fixed) {
                return true;
            }
        }

        // near right border of column
        if (event.mousePoint.x >= event.bounds.width - 3) {
            var column = grid.behavior.getColumn(event.gridCell.x);
            if (column && !column.properties.fixed) {
                return true;
            }
        }

        return false;
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @desc return the cursor name
     * @returns {string}
     */
    getCursorName: function getCursorName() {
        return 'col-resize';
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDrag: function handleMouseDrag(grid, event) {
        if (this.dragColumn) {
            var delta = this.getMouseValue(event) - this.dragStart;
            grid.behavior.setColumnWidth(this.dragColumn, this.dragStartWidth + delta);
        } else if (this.next) {
            this.next.handleMouseDrag(grid, event);
        }
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDown: function handleMouseDown(grid, event) {
        if (event.isHeaderRow && this.overAreaDivider(grid, event)) {
            if (event.mousePoint.x <= 3) {
                var columnIndex = event.gridCell.x - 1;
                this.dragColumn = grid.behavior.getActiveColumn(columnIndex);
                //this.dragStartWidth = grid.renderer.visibleColumns[columnIndex].width;
                var visibleColIndex = grid.behavior.rowColumnIndex;
                var dragColumn = this.dragColumn;
                grid.renderer.visibleColumns.forEachWithNeg(function (vCol, vIndex) {
                    var col = vCol.column;
                    if (col.index === dragColumn.index) {
                        visibleColIndex = vIndex;
                    }
                });
                this.dragStartWidth = grid.renderer.visibleColumns[visibleColIndex].width;
            } else {
                this.dragColumn = event.column;
                this.dragStartWidth = event.bounds.width;
            }

            this.dragStart = this.getMouseValue(event);
            //this.detachChain();
        } else if (this.next) {
            this.next.handleMouseDown(grid, event);
        }
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseUp: function handleMouseUp(grid, event) {
        if (this.dragColumn) {
            this.callCallbackIfNeeded(grid, this.dragColumn);

            this.cursor = null;
            this.dragColumn = false;

            event.primitiveEvent.stopPropagation();
            //delay here to give other events a chance to be dropped
            grid.behaviorShapeChanged();
        } else if (this.next) {
            this.next.handleMouseUp(grid, event);
        }
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseMove: function handleMouseMove(grid, event) {
        if (!this.dragColumn) {
            this.cursor = null;

            if (this.next) {
                this.next.handleMouseMove(grid, event);
            }

            this.cursor = event.isHeaderRow && this.overAreaDivider(grid, event) ? this.getCursorName() : null;
        }
    },

    /**
     * @param {Hypergrid} grid
     * @param {CellEvent} cellEvent
     * @memberOf ColumnResizing.prototype
     */
    handleDoubleClick: function handleDoubleClick(grid, event) {
        if (event.isHeaderRow && this.overAreaDivider(grid, event)) {
            var column = event.mousePoint.x <= 3 ? grid.behavior.getActiveColumn(event.gridCell.x - 1) : event.column;
            grid.autosizeColumn(column);
            column.addProperties({
                columnAutosizing: true,
                columnAutosized: false // todo: columnAutosizing should be a setter that automatically resets columnAutosized on state change to true
            });
            if (column.colDef) {
                delete column.colDef.width;
            }
            this.callCallbackIfNeeded(grid, column);
        } else if (this.next) {
            this.next.handleDoubleClick(grid, event);
        }
    },

    callCallbackIfNeeded: function callCallbackIfNeeded(grid, column) {
        if (grid.onColumnResized && this.dragStartWidth !== Math.round(column.getWidth())) {
            grid.onColumnResized(column);
        }
    }

});

module.exports = ColumnResizing;
