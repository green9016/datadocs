/* eslint-env browser */
/* global requestAnimationFrame */

'use strict';

var Feature = require('./Feature');

var dragger;
var draggerCTX;
var placeholder;
var placeholderCTX;

var GRAB = ['grab', '-moz-grab', '-webkit-grab'],
    GRABBING = ['grabbing', '-moz-grabbing', '-webkit-grabbing'];

/**
 * @constructor
 * @extends Feature
 */
var ColumnFixation = Feature.extend('ColumnFixation', {
    /**
     * @type {boolean}
     * @memberOf ColumnFixation.prototype
     */
    dragging: false,

    /**
     * an offset to position the dragger from the cursor
     * @type {number}
     * @memberOf ColumnFixation.prototype
     */
    dragOffset: 0,

    /**
     * current position (index) of an placeholder
     * @type {number}
     * @memberOf ColumnFixation.prototype
     */
    currentPlaceholderColumnPos: -1,

    /**
     * @memberOf ColumnFixation.prototype
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
     * @memberOf ColumnFixation.prototype
     * @desc initialize animation support on the grid
     * @param {Hypergrid} grid
     */
    initializeAnimationSupport: function initializeAnimationSupport(grid) {
        this.createOrUpdateDragger(grid);
        if (!placeholder) {
            placeholder = document.createElement('canvas');
            placeholder.setAttribute('width', '0px');
            placeholder.setAttribute('height', '0px');
            placeholder.style.position = 'fixed';

            document.body.appendChild(placeholder);
            placeholderCTX = placeholder.getContext('2d', { alpha: false });
        }
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDrag: function handleMouseDrag(grid, event) {
        if (this.next) {
            this.next.handleMouseDrag(grid, event);
        }
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDown: function handleMouseDown(grid, event) {
        if (this.next) {
            this.next.handleMouseDown(grid, event);
        }
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseUp: function handleMouseUp(grid, event) {
        if (this.next) {
            this.next.handleMouseUp(grid, event);
        }
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseMove: function handleMouseMove(grid, event) {
        if (this.next) {
            this.next.handleMouseMove(grid, event);
        }
    },

    handleColumnResizedEvent: function handleColumnResizedEvent(grid, event) {
        grid.paintNow();
        this.moveDragger(grid, this.getStartByFixedColumnsCount(grid), false);

        if (this.next) {
            this.next.handleColumnResizedEvent(grid, event);
        }
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @desc utility function to move dragger based on current cursor position
     * @param {Hypergrid} grid
     * @param {number} x
     * @param {boolean?} movePlaceholderNeeded
     */
    moveDragger: function moveDragger(grid, x, movePlaceholderNeeded) {
        movePlaceholderNeeded = typeof movePlaceholderNeeded !== 'undefined' ? movePlaceholderNeeded : true;
        dragger.style.left = x + grid.canvas.size.left + 'px';

        if (movePlaceholderNeeded) {
            var nearestColumnIndex = this.getNearestColumnIndex(grid, x);
            if (nearestColumnIndex !== undefined && nearestColumnIndex !== this.currentPlaceholderColumnPos) {
                this.movePlaceholderTo(grid, nearestColumnIndex);
                this.currentPlaceholderColumnPos = nearestColumnIndex;
            }
        }
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @desc utility function to move placeholder to the start coordinates of column
     * @param {Hypergrid} grid
     * @param {number} column
     */
    movePlaceholderTo: function movePlaceholderTo(grid, column) {
        placeholder.style.display = 'inline';

        var newStartX = this.getStartByColumnIndex(grid, column);

        placeholder.style.left = newStartX + 'px';
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @desc create the placeholder based on current count of fixed columns
     * @param {Hypergrid} grid
     */
    createPlaceholder: function createPlaceholder(grid) {
        var width = grid.properties.fixedLinesHWidth;
        var gridHeight = grid.div.clientHeight;
        var hdpiRatio = grid.getHiDPI(placeholderCTX);
        var headerHeight = grid.getRowHeight(0);

        var location = grid.div.getBoundingClientRect();

        placeholder.style.top = location.top + 'px';
        placeholder.setAttribute('width', Math.round(width * hdpiRatio) + 'px');
        placeholder.setAttribute('height', Math.round(gridHeight * hdpiRatio) + 'px');
        placeholder.style.display = 'inline';

        placeholderCTX.clearRect(0, 0, width, gridHeight);
        placeholderCTX.fillStyle = grid.properties.columnFixationPlaceholderHeaderColor;
        placeholderCTX.fillRect(0, 0, width, headerHeight);
        placeholderCTX.fillStyle = grid.properties.columnFixationPlaceholderBodyColor;
        placeholderCTX.fillRect(0, headerHeight, width, gridHeight);

        placeholderCTX.scale(hdpiRatio, hdpiRatio);

        placeholder.style.zIndex = '4';

        this.movePlaceholderTo(grid, grid.getFixedColumnCount());
    },

    /**
     * @memberOf ColumnFixation.prototype
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
     * @memberOf ColumnFixation.prototype
     * @desc create the dragged column based on current count of fixed columns
     * @param {Hypergrid} grid
     */
    createOrUpdateDragger: function createOrUpdateDragger(grid) {
        if (this.dragging) {
            return;
        }

        this.fixedLinesHWidth = grid.properties.fixedLinesHWidth;

        if (!dragger) {
            dragger = document.createElement('canvas');
            draggerCTX = dragger.getContext('2d', { alpha: false });
            document.body.appendChild(dragger);
        }

        var width = this.fixedLinesHWidth;
        var startX = this.getStartByFixedColumnsCount(grid);

        var headerHeight = grid.getRowHeight(0);
        var gridHeight = grid.div.clientHeight;

        var hdpiRatio = grid.getHiDPI(draggerCTX);
        var location = grid.div.getBoundingClientRect();

        dragger.setAttribute('width', width * hdpiRatio + 'px');
        dragger.setAttribute('height', gridHeight * hdpiRatio + 'px');
        dragger.style.position = 'fixed';
        dragger.style.top = location.top + 'px';
        dragger.style.left = startX + 'px';
        dragger.style.display = 'inline';

        draggerCTX.clearRect(0, 0, width, gridHeight);
        draggerCTX.fillStyle = grid.properties.columnFixationDraggerHeaderInactiveColor;
        draggerCTX.fillRect(0, 0, width, headerHeight);

        var self = this;
        dragger.onmouseenter = function (event) {
            if (!self.dragging) {
                event.stopImmediatePropagation();
                event.preventDefault();
                self.cursor = GRAB;

                draggerCTX.clearRect(0, 0, width, gridHeight);
                draggerCTX.fillStyle = grid.properties.columnFixationDraggerHeaderHoveredColor;
                draggerCTX.fillRect(0, 0, width, headerHeight);
            }
        };

        dragger.onmouseleave = function () {
            if (!self.dragging) {
                event.stopImmediatePropagation();
                event.preventDefault();

                self.cursor = null;

                draggerCTX.clearRect(0, 0, width, gridHeight);
                draggerCTX.fillStyle = grid.properties.columnFixationDraggerHeaderInactiveColor;
                draggerCTX.fillRect(0, 0, width, headerHeight);
            }
        };

        dragger.onmousedown = function (event) {
            event.stopImmediatePropagation();
            event.preventDefault();
            this.cursor = GRABBING;

            self.dragging = true;

            grid.scrollToMakeVisible(grid.getFixedColumnCount(), grid.getFixedRowCount() - 1);

            self.createPlaceholder(grid);
            self.dragOffset = dragger.getBoundingClientRect().left;

            draggerCTX.clearRect(0, 0, width, gridHeight);
            draggerCTX.fillStyle = grid.properties.columnFixationDraggerHeaderDraggingColor;
            draggerCTX.fillRect(0, 0, width, headerHeight);
            draggerCTX.fillStyle = grid.properties.columnFixationDraggerBodyDraggingColor;
            draggerCTX.fillRect(0, headerHeight, width, gridHeight);

            document.onmousemove = function (e) {
                var pos1 = e.clientX - grid.properties.fixedLinesHWidth / 2 - grid.canvas.size.left;

                self.moveDragger(grid, pos1);
            };
            document.onmouseup = function (e) {
                document.onmousemove = null;
                document.onmouseup = null;

                if (self.dragging) {
                    self.cursor = null;
                    self.performFixation(grid);
                    grid.paintNow();
                    self.moveDragger(grid, self.getStartByFixedColumnsCount(grid) - grid.canvas.size.left, false);
                }
                self.dragging = false;
                self.cursor = null;

                draggerCTX.clearRect(0, 0, width, gridHeight);
                draggerCTX.fillStyle = grid.properties.columnFixationDraggerHeaderInactiveColor;
                draggerCTX.fillRect(0, 0, width, headerHeight);
            };
        };
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @desc utility method to get start position of the dragger based on current fixed columns count
     * @param {Hypergrid} grid
     */
    getStartByFixedColumnsCount: function getStartByFixedColumnsCount(grid) {
        return this.getStartByColumnIndex(grid, grid.properties.fixedColumnCount);
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @desc utility method to get start position of the dragger based on columnIndex
     * @param {Hypergrid} grid
     * @param {number} columnIndex
     */
    getStartByColumnIndex: function getStartByColumnIndex(grid, columnIndex) {
        if (columnIndex < 0) {
            columnIndex = 0;
        }

        var column, res;
        if (columnIndex > 0) {
            // otherwise detect column and use it's right side
            column = grid.renderer.visibleColumns[columnIndex - 1];
            if (!column) {
                column = grid.renderer.visibleColumns[0];
            }
            res = column ? column.right : 0;
        } else {
            // if no selection use left side of first column
            res = grid.renderer.visibleColumns[0].left - this.fixedLinesHWidth;
        }

        return res + grid.canvas.size.left;
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @desc utility method to set grid options when dragging ends
     * @param {Hypergrid} grid
     */
    performFixation: function performFixation(grid) {
        var currentFixedColumnCount = grid.properties.fixedColumnCount;
        grid.addProperties({
            fixedColumnCount: this.currentPlaceholderColumnPos
        });

        placeholder.style.display = 'none';

        grid.fireSyntheticOnFixedColumnCountChangedEvent(currentFixedColumnCount, this.currentPlaceholderColumnPos);
    },

    /**
     * @memberOf ColumnFixation.prototype
     * @desc utility function to get nearest possible index from an cursor position
     * @param {Hypergrid} grid
     * @param {number} x - horizontal cursor position
     */
    getNearestColumnIndex: function getNearestColumnIndex(grid, x) {
        var columnUnderCursorIndex = grid.renderer.getColumnFromPixelX(x);
        var visibleColumns = grid.renderer.visibleColumns;

        var max = grid.getVisibleColumnsCount();
        var columnStartX = visibleColumns[Math.min(max, columnUnderCursorIndex)].left;
        var columnEndX = visibleColumns[Math.min(max, columnUnderCursorIndex)].right;

        var res = columnUnderCursorIndex;

        if (!(Math.abs(columnStartX - x) < Math.abs(columnEndX - x))) {
            res += 1;
        }

        if (res >= visibleColumns[visibleColumns.length - 1].columnIndex) {
            res = visibleColumns[visibleColumns.length - 2].columnIndex;
        }

        return res;
    },

    setProp: function setProp(element, property, value) {
        if (property in element.style) {
            element.style[property] = value;
        }
    }
});

module.exports = ColumnFixation;
