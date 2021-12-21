/* eslint-env browser */
/* global requestAnimationFrame */

'use strict';

var Feature = require('./Feature');

var rowFixationDragger;
var rowFixationDraggerCTX;
var rowFixationPlaceholder;
var rowFixationPlaceholderCTX;

var GRAB = ['grab', '-moz-grab', '-webkit-grab'],
    GRABBING = ['grabbing', '-moz-grabbing', '-webkit-grabbing'];

/**
 * @constructor
 * @extends Feature
 */
var RowFixation = Feature.extend('RowFixation', {
    /**
     * @type {boolean}
     * @memberOf RowFixation.prototype
     */
    dragging: false,

    /**
     * an offset to position the dragger from the cursor
     * @type {number}
     * @memberOf RowFixation.prototype
     */
    dragOffset: 0,

    /**
     * current position (index) of an placeholder
     * @type {number}
     * @memberOf RowFixation.prototype
     */
    currentPlaceholderRowIndex: -1,

    /**
     * @memberOf RowFixation.prototype
     * @desc fired every time when grid rendered
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleGridRendered: function handleGridRendered(grid, event) {
        this.initializeAnimationSupport(grid);

        if (this.next) {
            this.next.handleGridRendered(grid);
        }
    },
    /**
     * @memberOf RowFixation.prototype
     * @desc initialize animation support on the grid
     * @param {Hypergrid} grid
     */
    initializeAnimationSupport: function initializeAnimationSupport(grid) {
        this.createOrUpdateDragger(grid);
        if (!rowFixationPlaceholder) {
            rowFixationPlaceholder = document.createElement('canvas');
            rowFixationPlaceholder.setAttribute('width', '0px');
            rowFixationPlaceholder.setAttribute('height', '0px');
            rowFixationPlaceholder.style.position = 'absolute';

            document.body.appendChild(rowFixationPlaceholder);
            rowFixationPlaceholderCTX = rowFixationPlaceholder.getContext('2d', { alpha: false });
        }
    },

    /**
     * @memberOf RowFixation.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDrag: function handleMouseDrag(grid, event) {
        if (this.next) {
            this.next.handleMouseDrag(grid, event);
        }
    },

    /**
     * @memberOf RowFixation.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDown: function handleMouseDown(grid, event) {
        if (this.next) {
            this.next.handleMouseDown(grid, event);
        }
    },

    /**
     * @memberOf RowFixation.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseUp: function handleMouseUp(grid, event) {
        if (this.next) {
            this.next.handleMouseUp(grid, event);
        }
    },

    /**
     * @memberOf RowFixation.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseMove: function handleMouseMove(grid, event) {
        if (this.next) {
            this.next.handleMouseMove(grid, event);
        }
    },

    /**
     * @memberOf RowFixation.prototype
     * @desc utility function to move dragger based on current cursor position
     * @param {Hypergrid} grid
     * @param {number} x
     * @param {number} y
     * @param {boolean?} movePlaceholderNeeded
     */
    moveDragger: function moveDragger(grid, x, y, movePlaceholderNeeded) {
        movePlaceholderNeeded = typeof movePlaceholderNeeded !== 'undefined' ? movePlaceholderNeeded : true;
        grid.log(y + grid.canvas.size.top);
        rowFixationDragger.style.top = y + grid.canvas.size.top + 'px';

        if (movePlaceholderNeeded) {
            var nearestRowIndex = this.getNearestRowIndex(grid, x, y);
            if (typeof nearestRowIndex !== 'undefined' && nearestRowIndex !== this.currentPlaceholderRowIndex) {
                this.movePlaceholderTo(grid, nearestRowIndex);
                this.currentPlaceholderRowIndex = nearestRowIndex;
            }
        }
    },

    /**
     * @memberOf RowFixation.prototype
     * @desc utility function to move placeholder to the start coordinates of column
     * @param {Hypergrid} grid
     * @param {number} column
     */
    movePlaceholderTo: function movePlaceholderTo(grid, column) {
        var newStartY = this.getStartByRowIndex(grid, column);

        rowFixationPlaceholder.style.top = newStartY + 'px';
    },

    /**
     * @memberOf RowFixation.prototype
     * @desc create the placeholder based on current count of fixed columns
     * @param {Hypergrid} grid
     */
    createPlaceholder: function createPlaceholder(grid) {
        var fixationLineWidth = grid.properties.fixedLinesVWidth;
        var startY = this.getStartByFixedRowsCount(grid);
        var rowHeaderWidth = grid.renderer.visibleColumns[0].left;
        var gridWidth = grid.div.clientWidth;

        var hdpiRatio = grid.getHiDPI(rowFixationPlaceholderCTX);
        var location = grid.div.getBoundingClientRect();

        rowFixationPlaceholder.setAttribute('width', gridWidth * hdpiRatio + 'px');
        rowFixationPlaceholder.setAttribute('height', fixationLineWidth * hdpiRatio + 'px');
        rowFixationPlaceholder.style.position = 'fixed';
        rowFixationPlaceholder.style.top = startY + 'px';
        rowFixationPlaceholder.style.left = location.left + 'px';
        rowFixationPlaceholder.style.display = 'inline';

        rowFixationPlaceholderCTX.clearRect(0, 0, gridWidth, fixationLineWidth);
        rowFixationPlaceholderCTX.fillStyle = grid.properties.rowFixationPlaceholderHeaderColor;
        rowFixationPlaceholderCTX.fillRect(0, 0, rowHeaderWidth, fixationLineWidth);
        rowFixationPlaceholderCTX.fillStyle = grid.properties.rowFixationPlaceholderBodyColor;
        rowFixationPlaceholderCTX.fillRect(rowHeaderWidth, 0, gridWidth, fixationLineWidth);

        this.movePlaceholderTo(grid, grid.getFixedRowCount());
    },

    /**
     * @memberOf RowFixation.prototype
     * @desc utility function for setting cross browser css properties
     * @param {HTMLElement} element - descripton
     * @param {string} property - the property
     * @param {string} value - the value to assign
     */
    setCrossBrowserProperty: function setCrossBrowserProperty(element, property, value) {
        var uProperty = property[0].toUpperCase() + property.substr(1);
        this.setProp(element, 'webkit' + uProperty, value);
        this.setProp(element, 'Moz' + uProperty, value);
        this.setProp(element, 'ms' + uProperty, value);
        this.setProp(element, 'O' + uProperty, value);
        this.setProp(element, property, value);
    },

    /**
     * @memberOf RowFixation.prototype
     * @desc create the dragged column based on current count of fixed columns
     * @param {Hypergrid} grid
     */
    createOrUpdateDragger: function createOrUpdateDragger(grid) {
        if (this.dragging) {
            return;
        }

        if (!rowFixationDragger) {
            rowFixationDragger = document.createElement('canvas');
            rowFixationDraggerCTX = rowFixationDragger.getContext('2d', { alpha: false });
            document.body.appendChild(rowFixationDragger);
        }

        var fixationLineWidth = this.fixationLineWidth = grid.properties.fixedLinesVWidth;
        var startY = this.getStartByFixedRowsCount(grid);

        var rowHeaderWidth = grid.renderer.visibleColumns[0].left;
        var gridWidth = grid.div.clientWidth;

        var hdpiRatio = grid.getHiDPI(rowFixationDraggerCTX);
        var location = grid.div.getBoundingClientRect();

        rowFixationDragger.setAttribute('width', gridWidth * hdpiRatio + 'px');
        rowFixationDragger.setAttribute('height', fixationLineWidth * hdpiRatio + 'px');
        rowFixationDragger.style.position = 'fixed';
        rowFixationDragger.style.top = startY + 'px';
        rowFixationDragger.style.left = location.left + 'px';
        rowFixationDragger.style.display = 'inline';

        rowFixationDraggerCTX.clearRect(0, 0, gridWidth, fixationLineWidth);
        rowFixationDraggerCTX.fillStyle = grid.properties.rowFixationDraggerHeaderInactiveColor;
        rowFixationDraggerCTX.fillRect(0, 0, rowHeaderWidth, fixationLineWidth);

        var self = this;
        rowFixationDragger.onmouseenter = function (event) {
            if (!self.dragging) {
                event.stopImmediatePropagation();
                event.preventDefault();
                self.cursor = GRAB;

                rowFixationDraggerCTX.clearRect(0, 0, gridWidth, fixationLineWidth);
                rowFixationDraggerCTX.fillStyle = grid.properties.rowFixationDraggerHeaderHoveredColor;
                rowFixationDraggerCTX.fillRect(0, 0, rowHeaderWidth, fixationLineWidth);
            }
        };

        rowFixationDragger.onmouseleave = function () {
            if (!self.dragging) {
                event.stopImmediatePropagation();
                event.preventDefault();

                self.cursor = null;

                rowFixationDraggerCTX.clearRect(0, 0, gridWidth, fixationLineWidth);
                rowFixationDraggerCTX.fillStyle = grid.properties.rowFixationDraggerHeaderInactiveColor;
                rowFixationDraggerCTX.fillRect(0, 0, rowHeaderWidth, fixationLineWidth);
            }
        };

        rowFixationDragger.onmousedown = function (event) {
            event.stopImmediatePropagation();
            event.preventDefault();
            this.cursor = GRABBING;

            self.dragging = true;

            grid.scrollToMakeVisible(grid.getFixedColumnCount(), grid.getFixedRowCount() - 1);

            self.createPlaceholder(grid);
            self.dragOffset = rowFixationDragger.getBoundingClientRect().top;

            rowFixationDraggerCTX.clearRect(0, 0, gridWidth, fixationLineWidth);
            rowFixationDraggerCTX.fillStyle = grid.properties.rowFixationDraggerHeaderDraggingColor;
            rowFixationDraggerCTX.fillRect(0, 0, rowHeaderWidth, fixationLineWidth);
            rowFixationDraggerCTX.fillStyle = grid.properties.rowFixationDraggerBodyDraggingColor;
            rowFixationDraggerCTX.fillRect(rowHeaderWidth, 0, gridWidth, fixationLineWidth);

            document.onmousemove = function (e) {
                var newY = e.clientY - grid.properties.fixedLinesVWidth / 2 - grid.canvas.size.top;

                self.moveDragger(grid, e.clientX, newY);
            };
            document.onmouseup = function (e) {
                document.onmousemove = null;
                document.onmouseup = null;

                if (self.dragging) {
                    self.cursor = null;
                    self.performFixation(grid);
                    grid.paintNow();
                    self.moveDragger(grid, 0, self.getStartByFixedRowsCount(grid) - grid.canvas.size.top, false);
                }
                self.dragging = false;
                self.cursor = null;

                rowFixationDraggerCTX.clearRect(0, 0, gridWidth, fixationLineWidth);
                rowFixationDraggerCTX.fillStyle = grid.properties.rowFixationDraggerHeaderInactiveColor;
                rowFixationDraggerCTX.fillRect(0, 0, rowHeaderWidth, fixationLineWidth);
            };
        };
    },

    /**
     * @memberOf RowFixation.prototype
     * @desc utility method to get start position based on current fixed rows count
     * @param {Hypergrid} grid
     */
    getStartByFixedRowsCount: function getStartByFixedRowsCount(grid) {
        return this.getStartByRowIndex(grid, grid.properties.fixedRowCount + 1);
    },

    /**
     * @memberOf RowFixation.prototype
     * @desc utility method to get start position based on rowIndex
     * @param {Hypergrid} grid
     * @param {number} rowIndex
     */
    getStartByRowIndex: function getStartByRowIndex(grid, rowIndex) {
        var headerRowCount = grid.getHeaderRowCount();
        if (rowIndex < headerRowCount) {
            rowIndex = headerRowCount;
        }

        var res;
        if (rowIndex > 1) {
            // 1 because of headers
            var row = grid.renderer.visibleRows[rowIndex - 1];
            if (!row) {
                row = grid.renderer.visibleRows[0];
            }
            res = row ? row.bottom : 0;
        } else {
            res = grid.renderer.visibleRows[0].bottom - this.fixationLineWidth + 2;
        }

        return res + grid.canvas.size.top;
    },
    /**
     * @memberOf RowFixation.prototype
     * @desc utility method to set grid options when dragging ends
     * @param {Hypergrid} grid
     */
    performFixation: function performFixation(grid) {
        var currentFixedRowCount = grid.properties.fixedRowCount;
        rowFixationPlaceholder.style.display = 'none';

        if (this.currentPlaceholderRowIndex < 0) {
            return;
        }

        var newFixedRowValue = this.currentPlaceholderRowIndex - grid.getHeaderRowCount();

        grid.addProperties({
            fixedRowCount: newFixedRowValue
        });

        grid.fireSyntheticOnFixedRowCountChangedEvent(currentFixedRowCount, newFixedRowValue);
    },

    /**
     * @memberOf RowFixation.prototype
     * @desc utility function to get nearest possible index from an cursor position
     * @param {Hypergrid} grid
     * @param {number} x - horizontal cursor position
     * @param {number} y - horizontal cursor position
     */
    getNearestRowIndex: function getNearestRowIndex(grid, x, y) {
        var cellUnderCursor = grid.renderer.getGridCellFromMousePoint({ x: x, y: y });
        var rowUnderCursorIndex = cellUnderCursor.cellEvent.visibleRow.rowIndex;
        var visibleRows = grid.renderer.visibleRows;

        var max = grid.getVisibleRowsCount();
        var columnStartY = visibleRows[Math.min(max, rowUnderCursorIndex)].top;
        var columnEndY = visibleRows[Math.min(max, rowUnderCursorIndex)].bottom;

        var res = rowUnderCursorIndex;

        if (!(Math.abs(columnStartY - y) < Math.abs(columnEndY - y))) {
            res += 1;
        }

        if (res >= visibleRows[visibleRows.length - 2].columnIndex) {
            res = visibleRows[visibleRows.length - 3].columnIndex;
        }

        var headerRowCount = grid.getHeaderRowCount();

        if (res <= headerRowCount) {
            res = headerRowCount;
        }
        return res;
    },

    setProp: function setProp(element, property, value) {
        if (property in element.style) {
            element.style[property] = value;
        }
    }
});

module.exports = RowFixation;
