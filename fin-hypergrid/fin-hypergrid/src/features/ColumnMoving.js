/* eslint-env browser */
/* global requestAnimationFrame */

'use strict';

// This feature is responsible for column drag and drop reordering.
// This object is a mess and desperately needs a complete rewrite.....

var Feature = require('./Feature');

var GRAB = ['grab', '-moz-grab', '-webkit-grab'],
    GRABBING = ['grabbing', '-moz-grabbing', '-webkit-grabbing'],
    setName = function(name) { this.cursor = name; };

var columnAnimationTime = 150;
var dragger= void 0;
var draggerCTX= void 0;
var placeholder = void 0;
var placeholderCTX = void 0;
var floatColumn= void 0;
var floatColumnCTX= void 0;

/**
 * @constructor
 * @extends Feature
 */
var ColumnMoving = Feature.extend('ColumnMoving', {

    /**
     * queue up the animations that need to play so they are done synchronously
     * @type {Array}
     * @memberOf CellMoving.prototype
     */
    floaterAnimationQueue: [],

    /**
     * am I currently auto scrolling right
     * @type {boolean}
     * @memberOf CellMoving.prototype
     */
    columnDragAutoScrollingRight: false,

    /**
     * am I currently auto scrolling left
     * @type {boolean}
     * @memberOf CellMoving.prototype
     */
    columnDragAutoScrollingLeft: false,

    /**
     * is the drag mechanism currently enabled ("armed")
     * @type {boolean}
     * @memberOf CellMoving.prototype
     */
    dragArmed: false,

    /**
     * am I dragging right now
     * @type {boolean}
     * @memberOf CellMoving.prototype
     */
    dragging: false,

    /**
     * the column index of the currently dragged column
     * @type {number}
     * @memberOf CellMoving.prototype
     */
    dragCol: -1,

    /**
     * an offset to position the dragged item from the cursor
     * @type {number}
     * @memberOf CellMoving.prototype
     */
    dragOffset: 0,

    minScrollDelay: 30,
    maxScrollDelay: 100,
    scrollAttempt: 0,

    /**
     * @memberOf CellMoving.prototype
     * @desc give me an opportunity to initialize stuff on the grid
     * @param {Hypergrid} grid
     */
    initializeOn: function(grid) {
        this.isFloatingNow = false;
        this.initializeAnimationSupport(grid);
        if (this.next) {
            this.next.initializeOn(grid);
        }
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc initialize animation support on the grid
     * @param {Hypergrid} grid
     */
    initializeAnimationSupport: function(grid) {
        if (!dragger) {
            dragger = document.createElement('canvas');
            dragger.setAttribute('width', '0px');
            dragger.setAttribute('height', '0px');
            dragger.style.position = 'fixed';

            document.body.appendChild(dragger);
            draggerCTX = dragger.getContext('2d', { alpha: true });
        }
        /*if (!floatColumn) {
            floatColumn = document.createElement('canvas');
            floatColumn.setAttribute('width', '0px');
            floatColumn.setAttribute('height', '0px');
            floatColumn.style.position = 'fixed';

            document.body.appendChild(floatColumn);
            floatColumnCTX = floatColumn.getContext('2d', { alpha: false });
        }*/
        if (!placeholder) {
            placeholder = document.createElement('canvas');
            placeholder.setAttribute('width', '0px');
            placeholder.setAttribute('height', '0px');
            placeholder.style.position = 'fixed';

            document.body.appendChild(placeholder);
            placeholderCTX = placeholder.getContext('2d', { alpha: true });
        }

    },

    /**
     * @memberOf CellMoving.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDrag: function(grid, event) {

        /*var gridCell = event.gridCell;
        var x;
        //var y;

        var distance = Math.abs(event.primitiveEvent.detail.dragstart.x - event.primitiveEvent.detail.mouse.x);

        if (distance < 10 || event.isColumnFixed) {
            if (this.next) {
                this.next.handleMouseDrag(grid, event);
            }
            return;
        }

        if (event.isHeaderCell && this.dragArmed && !this.dragging) {
            this.dragging = true;
            this.dragCol = gridCell.x;
            this.dragOffset = event.mousePoint.x;
            this.detachChain();
            x = event.primitiveEvent.detail.mouse.x - this.dragOffset;
            //y = event.primitiveEvent.detail.mouse.y;
            this.createDragColumn(grid, x, this.dragCol);
        } else if (this.next) {
            this.next.handleMouseDrag(grid, event);
        }

        if (this.dragging) {
            x = event.primitiveEvent.detail.mouse.x - this.dragOffset;
            //y = event.primitiveEvent.detail.mouse.y;
            this.dragColumn(grid, x);
        }*/
        if (event.isColumnFixed) {
            if (this.next) {
                this.next.handleMouseDrag(grid, event);
            }
            return;
        }

        if (this.next) {
            this.next.handleMouseDrag(grid, event);
        }

        if (this.dragging) {
            this.dragColumn(grid, event);
        }
    },

    /**
     * @memberOf CellMoving.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDown: function(grid, event) {
        /*if (
            grid.properties.columnsReorderable &&
            !event.primitiveEvent.detail.isRightClick &&
            !event.isColumnFixed &&
            event.isHeaderCell
        ) {
            this.dragArmed = true;
            this.cursor = GRABBING;
            grid.clearSelections();
        } else if (this.next) {
            this.next.handleMouseDown(grid, event);
        }*/
        const value_position = grid.behavior.dataModel.get_colpivot_value_position();
        const col_pivots = grid.behavior.dataModel.getColPivots();
        const is_column_pivot = grid.behavior.dataModel.isColumnPivot();
        const ratio = grid.behavior.dataModel.getZoomRatio();

        if (grid.properties.columnsReorderable && event.isHeaderCell && !event.isColumnFixed
          && !event.primitiveEvent.detail.isRightClick && event.isColumnMovable
          && (!is_column_pivot || (is_column_pivot && value_position !== -1 && col_pivots.length === 1))
        ) {

            var arrSelectedColumns = grid.getLastSelectedColumns() || []; //grid.getSelectedColumns();
            if (arrSelectedColumns.length < 1){
                arrSelectedColumns = grid.getSelectedColumns() || [];
            }
            const is_flat_pivot = grid.behavior.dataModel._viewer && typeof grid.behavior.dataModel._viewer.is_flat_pivot === "function"
              ? grid.behavior.dataModel._viewer.is_flat_pivot()
              : false;

            // Must not contain tree column when Aggregation (Row Pivot) is enabled
            if (is_flat_pivot === true
              || !(grid.behavior.dataModel.isRowPivot() && /*grid.getSelectedColumns()*/arrSelectedColumns[0] == 0)){

                // start dragging
                var gridCell = event.gridCell;

                this.cursor = GRABBING;
                this.dragging = true;
                this.dragCol = gridCell.x;
                var firstSelectedColumn = /*grid.getSelectedColumns()*/arrSelectedColumns[0] || grid.renderer.visibleColumns.findIndex(function (c) {
                    return c.column === event.column;
                });

                var hScrollOffset = grid.getHScrollValue();
                var firstSelectedColumnX = grid.renderer.visibleColumns[Math.max(0, firstSelectedColumn - hScrollOffset)].left * ratio;

                this.dragOffset = event.primitiveEvent.detail.mouse.x - firstSelectedColumnX;
                if (arrSelectedColumns.includes(gridCell.x)){
                    this.dragCol = firstSelectedColumn;
                }
                this.detachChain();
                this.createDragColumn(grid, this.dragCol);
                this.createPlaceholder(grid, this.dragCol);
                this.dragColumn(grid, event);
            }
        }
        if (this.next) {
            this.next.handleMouseDown(grid, event);
        }
    },

    /**
     * @memberOf CellMoving.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseUp: function(grid, event) {
        //var col = event.gridCell.x;
        if (this.dragging) {
            this.cursor = null;
            //delay here to give other events a chance to be dropped
            var self = this;
            this.endDragColumn(grid);
            setTimeout(function() {
                self.attachChain();
            }, 200);
        }
        this.dragCol = -1;
        this.dragging = false;
        this.dragArmed = false;
        //this.cursor = GRAB;
        var selectedColumns = grid.getLastSelectedColumns() || [];
        if (selectedColumns.length < 1){
            selectedColumns = grid.getSelectedColumns() || [];
        }
        const is_flat_pivot = grid.behavior.dataModel._viewer && typeof grid.behavior.dataModel._viewer.is_flat_pivot === "function"
          ? grid.behavior.dataModel._viewer.is_flat_pivot()
          : false;

        if (is_flat_pivot === true
          || !(grid.behavior.dataModel.isRowPivot() && /*grid.getSelectedColumns()*/selectedColumns[0] == 0)){
            this.cursor = GRAB;
        }else{
            this.cursor = null;
        }
        grid.repaint();

        if (this.next) {
            this.next.handleMouseUp(grid, event);
        }

    },

    /**
     * @memberOf CellMoving.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseMove: function(grid, event) {
      const value_position = grid.behavior.dataModel.get_colpivot_value_position();
      const col_pivots = grid.behavior.dataModel.getColPivots();
      const is_column_pivot = grid.behavior.dataModel.isColumnPivot();

        if (
            event.isColumnSelected &&
            grid.properties.columnsReorderable &&
            !event.isColumnFixed &&
            !this.dragging &&
            event.isHeaderCell /*&&
            event.mousePoint.y < grid.properties.columnGrabMargin*/
            && event.isColumnMovable
            && (!is_column_pivot || (is_column_pivot && value_position !== -1 && col_pivots.length === 1))
        ) {
            const is_flat_pivot = grid.behavior.dataModel._viewer && typeof grid.behavior.dataModel._viewer.is_flat_pivot === "function"
              ? grid.behavior.dataModel._viewer.is_flat_pivot()
              : false;

            // Must not contain tree column when Aggregation (Row Pivot) is enabled
            if (is_flat_pivot === true
              || !(grid.behavior.dataModel.isRowPivot() && /*grid.getSelectedColumns()*/grid.getLastSelectedColumns()[0] == 0)){
                this.cursor = GRAB;
            }else{
                this.cursor = null;
            }
        } else {
            this.cursor = null;
        }

        if (this.next) {
            this.next.handleMouseMove(grid, event);
        }

        if (event.isHeaderCell && this.dragging) {
            this.cursor = GRABBING;
        }
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc this is the main event handler that manages the dragging of the column
     * @param {Hypergrid} grid
     * @param {boolean} draggedToTheRight - are we moving to the right
     */
    floatColumnTo: function(grid, draggedToTheRight) {
        this.floatingNow = true;

        var visibleColumns = grid.renderer.visibleColumns;
        var scrollLeft = grid.getHScrollValue();
        var floaterIndex = grid.renderOverridesCache.floater.columnIndex;
        var draggerIndex = grid.renderOverridesCache.dragger.columnIndex;
        var hdpiratio = grid.renderOverridesCache.dragger.hdpiratio;

        var draggerStartX;
        var floaterStartX;
        var fixedColumnCount = grid.getFixedColumnCount();
        var draggerWidth = grid.getColumnWidth(draggerIndex);
        var floaterWidth = grid.getColumnWidth(floaterIndex);

        var max = grid.getVisibleColumnsCount();

        var doffset = 0;
        var foffset = 0;

        if (draggerIndex >= fixedColumnCount) {
            doffset = scrollLeft;
        }
        if (floaterIndex >= fixedColumnCount) {
            foffset = scrollLeft;
        }

        if (draggedToTheRight) {
            draggerStartX = visibleColumns[Math.min(max, draggerIndex - doffset)].left;
            floaterStartX = visibleColumns[Math.min(max, floaterIndex - foffset)].left;

            grid.renderOverridesCache.dragger.startX = (draggerStartX + floaterWidth) * hdpiratio;
            grid.renderOverridesCache.floater.startX = draggerStartX * hdpiratio;

        } else {
            floaterStartX = visibleColumns[Math.min(max, floaterIndex - foffset)].left;
            draggerStartX = floaterStartX + draggerWidth;

            grid.renderOverridesCache.dragger.startX = floaterStartX * hdpiratio;
            grid.renderOverridesCache.floater.startX = draggerStartX * hdpiratio;
        }
        grid.swapColumns(draggerIndex, floaterIndex);
        grid.renderOverridesCache.dragger.columnIndex = floaterIndex;
        grid.renderOverridesCache.floater.columnIndex = draggerIndex;


        this.floaterAnimationQueue.unshift(this.doColumnMoveAnimation(grid, floaterStartX, draggerStartX));

        this.doFloaterAnimation(grid);

    },

    /**
     * @memberOf ColumnMoving.prototype
     * @desc this is the main event handler that manages the dragging of the column and moving of placeholder
     * @param {Hypergrid} grid
     */
    movePlaceholderTo: function(grid, overCol) {
        var placeholderLineWidth = grid.properties.columnMoveInsertLineWidth;
        var visibleColumns = grid.renderer.visibleColumns;
        var ratio = grid.behavior.dataModel.getZoomRatio();

        var d = placeholder;
        d.style.display = 'inline';

        var scrollLeft = grid.getHScrollValue();
        var fixedColumnCount = grid.getFixedColumnCount();
        if (overCol < fixedColumnCount) {
            scrollLeft = 0;
        }

        var x = void 0;
        if (overCol >= scrollLeft + visibleColumns.length) {
            var lastColumn = visibleColumns[visibleColumns.length - 1];
            x = (lastColumn.left + lastColumn.width) * ratio;
        } else {
            var supportingColumn = visibleColumns[overCol - scrollLeft];
            if (!supportingColumn) {
                return;
            }
            x = (supportingColumn.left + placeholderLineWidth / 2) * ratio;
        }

        this.setCrossBrowserProperty(d, 'transform', 'translate(' + x + 'px, ' + 0 + 'px)');
        grid.repaint();
    },

    /**
     * @memberOf ColumnMoving.prototype
     * @desc create the placeholder at columnIndex where column(s) should be moved to
     * @param {Hypergrid} grid
     * @param {number} columnIndex - the index of the column after which
     */
    createPlaceholder: function(grid, columnIndex) {
        var fixedColumnCount = grid.getFixedColumnCount();
        var scrollLeft = grid.getHScrollValue();

        if (columnIndex < fixedColumnCount) {
            scrollLeft = 0;
        }
        var ratio = grid.behavior.dataModel.getZoomRatio();

        var width = grid.properties.columnMoveInsertLineWidth;
        var colHeight = grid.div.clientHeight;
        var d = placeholder;
        var style = d.style;
        var location = grid.div.getBoundingClientRect();

        var heightToSkip = 0;
        var rowsToSkip = grid.getHeaderRowCount();
        for (var i = 0; i < rowsToSkip; i++) {
            heightToSkip += grid.getRowHeight(i);
        }
        if (grid.properties.gridLinesH && grid.properties.gridLinesWidth) {
            heightToSkip += grid.properties.gridLinesWidth;
        }
        colHeight -= heightToSkip;

        style.top = (location.top + heightToSkip * ratio) + 'px';
        style.left = location.left - 2 * ratio + 'px';

        var hdpiRatio = grid.getHiDPI(placeholderCTX);

        d.setAttribute('width', Math.round(width * hdpiRatio * ratio) + 'px');
        d.setAttribute('height', Math.round(colHeight * hdpiRatio * ratio) + 'px');
        // style.boxShadow = '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)';
        style.width = width * ratio + 'px'; //Math.round(columnWidth / hdpiRatio) + 'px';
        style.height = colHeight * ratio + 'px'; //Math.round(colHeight / hdpiRatio) + 'px';
        style.backgroundColor = grid.properties.columnMoveInsertLineColor;

        var startX = grid.renderer.visibleColumns[columnIndex - scrollLeft].left * hdpiRatio * ratio;

        placeholderCTX.scale(hdpiRatio, hdpiRatio * ratio);
        grid.renderOverridesCache.floater = {
            columnIndex: columnIndex,
            startX: startX
        };

        style.zIndex = '4';
        GRABBING.forEach(setName, style);
        grid.repaint();
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc manifest the column drag and drop animation
     * @param {Hypergrid} grid
     * @param {number} floaterStartX - the x start coordinate of the column underneath that floats behind the dragged column
     * @param {number} draggerStartX - the x start coordinate of the dragged column
     */
    doColumnMoveAnimation: function(grid, floaterStartX, draggerStartX) {
        var self = this;
        return function() {
            var d = floatColumn;
            d.style.display = 'inline';
            self.setCrossBrowserProperty(d, 'transform', 'translate(' + floaterStartX + 'px, ' + 0 + 'px)');

            //d.style.webkit-webkit-Transform = 'translate(' + floaterStartX + 'px, ' + 0 + 'px)';
            //d.style.webkit-webkit-Transform = 'translate(' + floaterStartX + 'px, ' + 0 + 'px)';

            requestAnimationFrame(function() {
                self.setCrossBrowserProperty(d, 'transition', (self.isWebkit ? '-webkit-' : '') + 'transform ' + columnAnimationTime + 'ms ease');
                self.setCrossBrowserProperty(d, 'transform', 'translate(' + draggerStartX + 'px, ' + -2 + 'px)');
            });
            grid.repaint();
            //need to change this to key frames

            setTimeout(function() {
                self.setCrossBrowserProperty(d, 'transition', '');
                grid.renderOverridesCache.floater = null;
                grid.repaint();
                self.doFloaterAnimation(grid);
                requestAnimationFrame(function() {
                    d.style.display = 'none';
                    self.isFloatingNow = false;
                });
            }, columnAnimationTime + 50);
        };
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc manifest the floater animation
     * @param {Hypergrid} grid
     */
    doFloaterAnimation: function(grid) {
        if (this.floaterAnimationQueue.length === 0) {
            this.floatingNow = false;
            grid.repaint();
            return;
        }
        var animation = this.floaterAnimationQueue.pop();
        animation();
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc create the float column at columnIndex underneath the dragged column
     * @param {Hypergrid} grid
     * @param {number} columnIndex - the index of the column that will be floating
     */
    createFloatColumn: function(grid, columnIndex) {

        var fixedColumnCount = grid.getFixedColumnCount();
        var scrollLeft = grid.getHScrollValue();

        if (columnIndex < fixedColumnCount) {
            scrollLeft = 0;
        }

        var columnWidth = grid.getColumnWidth(columnIndex);
        var colHeight = grid.div.clientHeight;
        var d = floatColumn;
        var style = d.style;
        var location = grid.div.getBoundingClientRect();

        style.top = (location.top - 2) + 'px';
        style.left = location.left + 'px';

        var hdpiRatio = grid.getHiDPI(floatColumnCTX);

        d.setAttribute('width', Math.round(columnWidth * hdpiRatio) + 'px');
        d.setAttribute('height', Math.round(colHeight * hdpiRatio) + 'px');
        style.boxShadow = '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)';
        style.width = columnWidth + 'px'; //Math.round(columnWidth / hdpiRatio) + 'px';
        style.height = colHeight + 'px'; //Math.round(colHeight / hdpiRatio) + 'px';
        style.borderTop = '1px solid ' + grid.properties.lineColor;
        style.backgroundColor = grid.properties.backgroundColor;

        var startX = grid.renderer.visibleColumns[columnIndex - scrollLeft].left * hdpiRatio;

        floatColumnCTX.scale(hdpiRatio, hdpiRatio);

        grid.renderOverridesCache.floater = {
            columnIndex: columnIndex,
            ctx: floatColumnCTX,
            startX: startX,
            width: columnWidth,
            height: colHeight,
            hdpiratio: hdpiRatio
        };

        style.zIndex = '4';
        this.setCrossBrowserProperty(d, 'transform', 'translate(' + startX + 'px, ' + -2 + 'px)');
        GRABBING.forEach(setName, style);
        grid.repaint();
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc utility function for setting cross browser css properties
     * @param {HTMLElement} element - descripton
     * @param {string} property - the property
     * @param {string} value - the value to assign
     */
    setCrossBrowserProperty: function(element, property, value) {
        var uProperty = property[0].toUpperCase() + property.substr(1);
        this.setProp(element, 'webkit' + uProperty, value);
        this.setProp(element, 'Moz' + uProperty, value);
        this.setProp(element, 'ms' + uProperty, value);
        this.setProp(element, 'O' + uProperty, value);
        this.setProp(element, property, value);
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc utility function for setting properties on HTMLElements
     * @param {HTMLElement} element - descripton
     * @param {string} property - the property
     * @param {string} value - the value to assign
     */
    setProp: function(element, property, value) {
        if (property in element.style) {
            element.style[property] = value;
        }
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc create the dragged column at columnIndex above the floated column
     * @param {Hypergrid} grid
     * @param {number} x - the start position
     * @param {number} columnIndex - the index of the column that will be floating
     */
    createDragColumn: function(grid, columnIndex) {
        var selectedColumns = grid.getLastSelectedColumns() || [];//grid.getSelectedColumns();
        if (selectedColumns.length < 1){
            selectedColumns = grid.getSelectedColumns() || [];
        }
        var consequent = this._isConsequent(selectedColumns);
        var columns = consequent ? selectedColumns : [columnIndex];
        var fixedColumnCount = grid.getFixedColumnCount();
        var scrollLeft = grid.getHScrollValue();
        var ratio = grid.behavior.dataModel.getZoomRatio();

        if (columnIndex < fixedColumnCount) {
            scrollLeft = 0;
        }

        var columnWidth = 0;
        columns.forEach(function (col) {
            columnWidth += grid.getColumnWidth(col);
        });

        var hdpiRatio = grid.getHiDPI(draggerCTX);
        //var columnWidth = grid.getColumnWidth(columnIndex);
        var colHeight = grid.div.clientHeight;
        var d = dragger;
        var location = grid.div.getBoundingClientRect();
        var style = d.style;
        //style.top = location.top + 'px';
        // offset from top + header height
        var offsetY = grid.getFixedRowsHeight();
        style.top = location.top + offsetY * ratio + 'px';
        style.left = location.left + 'px';
        /*style.opacity = 0.85;
        style.boxShadow = '0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)';
        //style.zIndex = 100;
        style.borderTop = '1px solid ' + grid.properties.lineColor;
        style.backgroundColor = grid.properties.backgroundColor;*/
        style.opacity = 0.15;
        style.border = '1px solid #4285F4';
        style.backgroundColor = 'rgb(0, 0, 0)';

        d.setAttribute('width', Math.round(columnWidth * hdpiRatio * ratio) + 'px');
        d.setAttribute('height', Math.round(colHeight * hdpiRatio * ratio) + 'px');

        style.width = columnWidth * ratio + 'px'; //Math.round(columnWidth / hdpiRatio) + 'px';
        //style.height = colHeight + 'px'; //Math.round(colHeight / hdpiRatio) + 'px';
        style.height = colHeight - offsetY * ratio + 'px'; //Math.round(colHeight / hdpiRatio) + 'px';

        var startX = grid.renderer.visibleColumns[columnIndex - scrollLeft].left * hdpiRatio * ratio;

        draggerCTX.scale(hdpiRatio, hdpiRatio);
        grid.renderOverridesCache.dragger = {
            columnIndex: columnIndex,
            startIndex: columnIndex,
            ctx: draggerCTX,
            startX: startX,
            width: columnWidth,
            height: colHeight,
            hdpiratio: hdpiRatio
        };

        //this.setCrossBrowserProperty(d, 'transform', 'translate(' + x + 'px, -5px)');
        style.zIndex = '5';
        GRABBING.forEach(setName, style);
        grid.repaint();
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc this function is the main dragging logic
     * @param {Hypergrid} grid
     * @param {number} x - the start position
     */
    /*dragColumn: function(grid, x) {

        //TODO: this function is overly complex, refactor this in to something more reasonable
        var self = this;

        var autoScrollingNow = this.columnDragAutoScrollingRight || this.columnDragAutoScrollingLeft;

        var hdpiRatio = grid.getHiDPI(draggerCTX);

        var dragColumnIndex = grid.renderOverridesCache.dragger.columnIndex;

        var minX = 0;
        var maxX = grid.renderer.getFinalVisibleColumnBoundary();
        x = Math.min(x, maxX + 15);
        x = Math.max(minX - 15, x);

        //am I at my lower bound
        var atMin = x < minX && dragColumnIndex !== 0;

        //am I at my upper bound
        var atMax = x > maxX;

        var d = dragger;

        this.setCrossBrowserProperty(d, 'transition', (self.isWebkit ? '-webkit-' : '') + 'transform ' + 0 + 'ms ease, box-shadow ' + columnAnimationTime + 'ms ease');

        this.setCrossBrowserProperty(d, 'transform', 'translate(' + x + 'px, ' + -10 + 'px)');
        requestAnimationFrame(function() {
            d.style.display = 'inline';
        });

        var overCol = grid.renderer.getColumnFromPixelX(x + (d.width / 2 / hdpiRatio));

        if (atMin) {
            overCol = 0;
        }

        if (atMax) {
            overCol = grid.getColumnCount() - 1;
        }

        var doAFloat = dragColumnIndex > overCol;
        doAFloat = doAFloat || (overCol - dragColumnIndex >= 1);

        if (doAFloat && !autoScrollingNow) {
            var draggedToTheRight = dragColumnIndex < overCol;
            // if (draggedToTheRight) {
            //     overCol -= 1;
            // }
            if (this.isFloatingNow) {
                return;
            }

            this.isFloatingNow = true;
            this.createFloatColumn(grid, overCol);
            this.floatColumnTo(grid, draggedToTheRight);
        } else {

            if (x < minX - 10) {
                this.checkAutoScrollToLeft(grid, x);
            }
            if (x > minX - 10) {
                this.columnDragAutoScrollingLeft = false;
            }
            //lets check for autoscroll to right if were up against it
            if (atMax || x > maxX + 10) {
                this.checkAutoScrollToRight(grid, x);
                return;
            }
            if (x < maxX + 10) {
                this.columnDragAutoScrollingRight = false;
            }
        }
    },*/
    dragColumn: function(grid, event) {
        var x = event.primitiveEvent.detail.mouse.x;
        var distance = x - this.dragOffset;
        var autoScrollingNow = this.columnDragAutoScrollingRight || this.columnDragAutoScrollingLeft;
        var dragColumnIndex = grid.renderOverridesCache.dragger.startIndex;
        var minX = 0;
        var maxX = grid.renderer.getFinalVisibleColumnBoundary();

        var d = dragger;

        this.setCrossBrowserProperty(d, 'transform', 'translate(' + distance + 'px, ' + 0 + 'px)');
        requestAnimationFrame(function () {
            d.style.display = 'inline';
        });
        var threshold = 20;
        if (x < minX + threshold) {
            this.checkAutoScrollToLeft(grid, x);
        }
        if (x > minX + threshold) {
            this.columnDragAutoScrollingLeft = false;
            this.resetScrollDelay();
        }
        if (x > maxX - threshold) {
            this.checkAutoScrollToRight(grid, x);
        }
        if (x < maxX - threshold) {
            this.columnDragAutoScrollingRight = false;
            this.resetScrollDelay();
        }
        var maxCol = grid.behavior.dataModel.getColumnsWithValuesCount();
        var overCol = grid.renderer.getColumnFromPixelX(x);
        var selectedColumns = grid.getLastSelectedColumns() || [];//grid.getSelectedColumns();
        if (selectedColumns.length < 1){
            selectedColumns = grid.getSelectedColumns() || [];
        }
        const is_flat_pivot = grid.behavior.dataModel._viewer && typeof grid.behavior.dataModel._viewer.is_flat_pivot === "function"
          ? grid.behavior.dataModel._viewer.is_flat_pivot()
          : false;
        var visibleColumns = grid.renderer.visibleColumns;
        var placeholderCol = -1;
        if (!autoScrollingNow) {
            if (!selectedColumns.slice(1).includes(overCol)) {
                grid.renderOverridesCache.dragger.columnIndex = Math.min(!grid.behavior.dataModel.isRowPivot() || is_flat_pivot === true ? overCol : Math.max(overCol, 1), maxCol - 1);
                var draggedToTheRight = dragColumnIndex < overCol;
                if (draggedToTheRight) {
                    overCol += 1;
                }
                overCol = Math.min(overCol, maxCol);
                placeholderCol = overCol;
            } else {

                var firstSelectedColumnIndex = selectedColumns[0];
                var firstVisibleColumnIndex = visibleColumns[0].columnIndex;
                var lastSelectedColumnIndex = selectedColumns[selectedColumns.length - 1];
                var lastVisibleColumnIndex = visibleColumns[visibleColumns.length - 1].columnIndex;
                if (firstVisibleColumnIndex < firstSelectedColumnIndex) {
                    placeholderCol = firstSelectedColumnIndex;
                } else if (lastVisibleColumnIndex > lastSelectedColumnIndex) {
                    placeholderCol = lastSelectedColumnIndex;
                }
                if (selectedColumns && selectedColumns.length > 0 && selectedColumns.includes(placeholderCol)){
                    placeholderCol = firstSelectedColumnIndex;
                    grid.renderOverridesCache.dragger.columnIndex = placeholderCol;
                }
            }
            if (grid.behavior.dataModel.isRowPivot() && !is_flat_pivot){
                placeholderCol = Math.max(placeholderCol, 1);
            }
            if (placeholderCol > -1) {
                this.movePlaceholderTo(grid, placeholderCol);
            }
        }
    },

    /**
     * @memberOf ColumnMoving.prototype
     * @desc resets scroll delay to initial value
     */
    resetScrollDelay: function() {
        this.scrollAttempt = 0;
    },

    /**
     * @memberOf ColumnMoving.prototype
     * @desc returns delay between auto-scrolling by one step. Delay is decremented with each further step.
     */
    getScrollDelay: function() {
        return Math.max(this.minScrollDelay, this.maxScrollDelay - this.scrollAttempt++ * 5);
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc autoscroll to the right if necessary
     * @param {Hypergrid} grid
     * @param {number} x - the start position
     */
    checkAutoScrollToRight: function(grid, x) {
        if (this.columnDragAutoScrollingRight) {
            return;
        }
        this.columnDragAutoScrollingRight = true;
        this._checkAutoScrollToRight(grid, x);
    },

    _checkAutoScrollToRight: function(grid, x) {
        if (!this.columnDragAutoScrollingRight) {
            return;
        }
        var scrollLeft = grid.getHScrollValue();
        if (!grid.dragging || scrollLeft > (grid.sbHScroller.range.max - 2)) {
            return;
        }
        //var draggedIndex = grid.renderOverridesCache.dragger.columnIndex;
        grid.scrollBy(1, 0);
        /*var newIndex = draggedIndex + 1;

        grid.swapColumns(newIndex, draggedIndex);
        grid.renderOverridesCache.dragger.columnIndex = newIndex;*/
        var visibleColumns = grid.renderer.visibleColumns;
        var placeholderCol = visibleColumns[visibleColumns.length - 1].columnIndex + 1;
        var maxCol = grid.behavior.dataModel.getColumnsWithValuesCount();
        placeholderCol = Math.min(placeholderCol, maxCol);
        this.movePlaceholderTo(grid, placeholderCol);

        grid.renderOverridesCache.dragger.columnIndex += 1;
        grid.renderOverridesCache.dragger.columnIndex = Math.min(grid.renderOverridesCache.dragger.columnIndex, maxCol-1);

        //setTimeout(this._checkAutoScrollToRight.bind(this, grid, x), 250);
        setTimeout(this._checkAutoScrollToRight.bind(this, grid, x), this.getScrollDelay());
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc autoscroll to the left if necessary
     * @param {Hypergrid} grid
     * @param {number} x - the start position
     */
    checkAutoScrollToLeft: function(grid, x) {
        if (this.columnDragAutoScrollingLeft) {
            return;
        }
        this.columnDragAutoScrollingLeft = true;
        this._checkAutoScrollToLeft(grid, x);
    },

    _checkAutoScrollToLeft: function(grid, x) {
        if (!this.columnDragAutoScrollingLeft) {
            return;
        }

        var scrollLeft = grid.getHScrollValue();
        if (!grid.dragging || scrollLeft < 1) {
            return;
        }
        //var draggedIndex = grid.renderOverridesCache.dragger.columnIndex;
        //grid.swapColumns(draggedIndex + scrollLeft, draggedIndex + scrollLeft - 1);
        grid.scrollBy(-1, 0);

        var visibleColumns = grid.renderer.visibleColumns;
        var placeholderCol = visibleColumns[0].columnIndex - 1;
        this.movePlaceholderTo(grid, placeholderCol);

        grid.renderOverridesCache.dragger.columnIndex -= 1;
        //setTimeout(this._checkAutoScrollToLeft.bind(this, grid, x), 250);
        setTimeout(this._checkAutoScrollToLeft.bind(this, grid, x), this.getScrollDelay());
    },

    /**
     * @memberOf CellMoving.prototype
     * @desc a column drag has completed, update data and cleanup
     * @param {Hypergrid} grid
     */
    /*endDragColumn: function(grid) {

        var fixedColumnCount = grid.getFixedColumnCount();
        var scrollLeft = grid.getHScrollValue();

        var columnIndex = grid.renderOverridesCache.dragger.columnIndex;

        if (columnIndex < fixedColumnCount) {
            scrollLeft = 0;
        }

        var self = this;
        var startX = grid.renderer.visibleColumns[columnIndex - scrollLeft].left;
        var d = dragger;
        var changed = grid.renderOverridesCache.dragger.startIndex !== grid.renderOverridesCache.dragger.columnIndex;
        self.setCrossBrowserProperty(d, 'transition', (self.isWebkit ? '-webkit-' : '') + 'transform ' + columnAnimationTime + 'ms ease, box-shadow ' + columnAnimationTime + 'ms ease');
        self.setCrossBrowserProperty(d, 'transform', 'translate(' + startX + 'px, ' + -1 + 'px)');
        d.style.boxShadow = '0px 0px 0px #888888';

        setTimeout(function() {
            grid.renderOverridesCache.dragger = null;
            grid.repaint();
            requestAnimationFrame(function() {
                d.style.display = 'none';
                grid.endDragColumnNotification(); //internal notification
                if (changed){
                    grid.fireSyntheticOnColumnsChangedEvent(); //public notification
                }
            });
        }, columnAnimationTime + 50);

    },*/
    endDragColumn: function(grid) {
        var d = dragger;
        var selectedColumns = grid.getLastSelectedColumns() || [];//grid.getSelectedColumns();
        if (selectedColumns.length < 1){
            selectedColumns = grid.getSelectedColumns();
        }
        var maxCol = grid.behavior.dataModel.getColumnsWithValuesCount();
        var changed = grid.renderOverridesCache.dragger.startIndex !== grid.renderOverridesCache.dragger.columnIndex;
        var consequent = this._isConsequent(selectedColumns);

        var placeholderIndex = grid.renderOverridesCache.dragger.columnIndex;
        var draggerIndex = grid.renderOverridesCache.dragger.startIndex;
        var from = consequent ? selectedColumns[0] : [draggerIndex];
        var len = consequent ? selectedColumns.length : 1;
        var f = placeholder;
        var move = true;
        var moved_columns = [];

        // Nothing to do because user doesn't move.
        if (selectedColumns && selectedColumns.length > 0 &&
            (selectedColumns.includes(grid.renderOverridesCache.dragger.columnIndex) ||
              Math.min.apply(null, selectedColumns) >= maxCol)){
            // Add code here if needed
            //console.log("Nothing to move");
            move = false;
        }else{
            if (grid.renderOverridesCache.dragger.columnIndex < maxCol){
                var cols = grid.behavior.columns;
                for (var i_c = from; i_c < from + len; i_c++){
                    if (cols[i_c].colDef){
                        moved_columns.push(cols[i_c].colDef.originalName);
                    }
                }
                var visibleIndexes = grid.renderer.visibleColumns.map((v) => v.columnIndex);
                if (!visibleIndexes.includes(from) || !visibleIndexes.includes(from + len - 1)){
                    grid.behavior.dataModel._dirty = true;
                }

                grid.moveColumns(from, len, placeholderIndex);
            }else{
                requestAnimationFrame(function () {
                    f.style.display = 'none';
                });

                grid.renderOverridesCache.dragger = null;
                grid.repaint();

                grid.clearSelections();

                requestAnimationFrame(function () {
                    d.style.display = 'none';
                    grid.endDragColumnNotification(); //internal notification
                    if (changed) {
                        grid.fireSyntheticOnColumnsChangedEvent(); //public notification
                    }
                });

                return;
            }
        }

        requestAnimationFrame(function () {
            f.style.display = 'none';
        });

        grid.renderOverridesCache.dragger = null;
        grid.repaint();
        if (move){
            grid.clearSelections();
            var startNewSelectionFrom = void 0;
            if (from < placeholderIndex) {
                startNewSelectionFrom = placeholderIndex - (len - 1);
            } else {
                startNewSelectionFrom = placeholderIndex;
            }
            grid.selectColumn(startNewSelectionFrom, startNewSelectionFrom + (len - 1));

            var mouseX = grid.getFirstColumnSelection();
            if (mouseX && mouseX > -1){
                grid.setMouseDown(grid.newPoint(mouseX, 0));
            }
        }
        requestAnimationFrame(function () {
            d.style.display = 'none';
            grid.endDragColumnNotification(); //internal notification
            if (changed) {
                grid.fireSyntheticOnColumnsChangedEvent(); //public notification
            }
        });
        if (move){
            var columns = [];
            grid.columnDefs.forEach((colDef, index) => {
                if (!colDef.headerName || colDef.headerName === grid.behavior.dataModel.getRowColLevelText() /*"Row/Col Labels"*/
                    || grid.behavior.dataModel.isColumnPivot()){
                    // Do nothing if needed
                }else{
                    columns.push(grid.behavior.dataModel.isRowPivot()
                        ? colDef.headerName.substr(0, colDef.headerName.search("____"))
                        : colDef.headerName);
                }
            });

            grid.behavior.dataModel.setKeepSelection(true);
            //grid.behavior.dataModel._viewer._update_column_view(columns, true);
            //grid.behavior.dataModel._viewer._reorder_column_view(columns, true);
            if (moved_columns.length > 0){
                grid.behavior.dataModel._viewer.move_columns_updates(moved_columns, from, len, placeholderIndex);
            }
        }
    },

    _isConsequent: function _isConsequent(arr) {
        if (arr.length > 1) {
            arr.sort();
            for (var i = 0; i < arr.length - 1; i++) {
                if (arr[i + 1] - arr[i] !== 1) {
                    return false;
                }
            }
        }
        return true;
    }

});

module.exports = ColumnMoving;
