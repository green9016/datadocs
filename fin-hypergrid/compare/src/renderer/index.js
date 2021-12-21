/* eslint-env browser */
/* global requestAnimationFrame */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var Base = require('../Base');
var images = require('../../images');
var layerProps = require('./layer-props');

var visibleColumnPropertiesDescriptorFn = function visibleColumnPropertiesDescriptorFn(grid) {
    return {
        findWithNeg: {
            // Like the Array.prototype version except searches the negative indexes as well.
            value: function value(iteratee, context) {
                for (var i = grid.behavior.leftMostColIndex; i < 0; i++) {
                    if (!this[i]) {
                        continue;
                    }
                    if (iteratee.call(context, this[i], i, this)) {
                        return this[i];
                    }
                }
                return Array.prototype.find.call(this, iteratee, context);
            }
        },
        forEachWithNeg: {
            // Like the Array.prototype version except it iterates the negative indexes as well.
            value: function value(iteratee, context) {
                for (var i = grid.behavior.leftMostColIndex; i < 0; i++) {
                    if (!this[i]) {
                        continue;
                    }
                    iteratee.call(context, this[i], i, this);
                }
                return Array.prototype.forEach.call(this, iteratee, context);
            }

        },

        totalLength: {
            get: function get() {
                return Math.abs(grid.behavior.leftMostColIndex) + this.length;
            }
        }
    };
};

/**
 * @summary List of grid renderers available to new grid instances.
 * @desc Developer may augment this list with additional grid renderers before grid instantiation by calling @link {Renderer.registerGridRenderer}.
 * @memberOf Renderer~
 * @private
 * @type {function[]}
 */
var paintCellsFunctions = [];

/** @typedef {object} CanvasRenderingContext2D
 * @see [CanvasRenderingContext2D](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D)
 */

/** @typedef {object} visibleColumnArray
 * @property {number} index - A back reference to the element's array index in {@link Renderer#visibleColumns}.
 * @property {number} columnIndex - Dereferences {@link Behavior#columns}, the subset of _active_ columns, specifying which column to show in that position.
 * @property {number} left - Pixel coordinate of the left edge of this column, rounded to nearest integer.
 * @property {number} right - Pixel coordinate of the right edge of this column, rounded to nearest integer.
 * @property {number} width - Width of this column in pixels, rounded to nearest integer.
 */

/** @typedef {object} visibleRowArray
 * @property {number} index - A back reference to the element's array index in {@link Renderer#visibleRows}.
 * @property {number} rowIndex - Local vertical row coordinate within the subgrid to which the row belongs, adjusted for scrolling.
 * @property {dataModelAPI} subgrid - A reference to the subgrid to which the row belongs.
 * @property {number} top - Pixel coordinate of the top edge of this row, rounded to nearest integer.
 * @property {number} bottom - Pixel coordinate of the bottom edge of this row, rounded to nearest integer.
 * @property {number} height - Height of this row in pixels, rounded to nearest integer.
 */

/**
 * @constructor
 * @desc fin-hypergrid-renderer is the canvas enabled top level sub component that handles the renderering of the Grid.
 *
 * It relies on two other external subprojects
 *
 * 1. fin-canvas: a wrapper to provide a simpler interface to the HTML5 canvas component
 * 2. rectangular: a small npm module providing Point and Rectangle objects
 *
 * The fin-hypergrid-renderer is in a unique position to provide critical functionality to the fin-hypergrid in a hightly performant manner.
 * Because it MUST iterate over all the visible cells it can store various bits of information that can be encapsulated as a service for consumption by the fin-hypergrid component.
 *
 * Instances of this object have basically four main functions.
 *
 * 1. render fixed row headers
 * 2. render fixed col headers
 * 3. render main data cells
 * 4. render grid lines
 *
 * Same parameters as {@link Renderer#initialize|initialize}, which is called by this constructor.
 *
 */
var Renderer = Base.extend('Renderer', {

    //the shared single item "pooled" cell object for drawing each cell
    cell: {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    },

    scrollHeight: 0,

    viewHeight: 0,

    /**
     * @summary Contains vertical view free space
     * @desc If visible rows not holds all the grid space, this variable will contain missing pixels count
     */
    bottomFreeSpace: 0,

    /**
     * @summary Count of rows, that was rendered partly
     * @desc used, when rendered on last page, and first row must be partly hidden, to avoid empty space on end
     */
    renderedCuttedRowsCount: 0,

    /**
     * @summary Number of pixels that was skipped on render to cut first row
     * @desc used, when rendered on last page, and first row must be partly hidden, to avoid empty space on end
     */
    skippedTopSpace: 0,

    reset: function reset() {
        this.bounds = {
            width: 0,
            height: 0
        };

        /**
         * Represents the ordered set of visible columns. Array size is always the exact number of visible columns, the last of which may only be partially visible.
         *
         * This sequence of elements' `columnIndex` values assumes one of three patterns. Which pattern is base on the following two questions:
         * * Are there "fixed" columns on the left?
         * * Is the grid horizontally scrolled?
         *
         * The set of `columnIndex` values consists of:
         * 1. The first element will be -1 if the row handle column is being rendered.
         * 2. A zero-based list of consecutive of integers representing the fixed columns (if any).
         * 3. An n-based list of consecutive of integers representing the scrollable columns (where n = number of fixed columns + the number of columns scrolled off to the left).
         * @type {visibleColumnArray}
         */
        this.visibleColumns = Object.defineProperties([], visibleColumnPropertiesDescriptorFn(this.grid));

        /**
         * Represents the ordered set of visible rows. Array size is always the exact number of visible rows.
         *
         * The sequence of elements' `rowIndex` values is local to each subgrid.
         * * **For each non-scrollable subgrid:** The sequence is a zero-based list of consecutive integers.
         * * **For the scrollable subgrid:**
         *   1. A zero-based list of consecutive of integers representing the fixed rows (if any).
         *   2. An n-based list of consecutive of integers representing the scrollable rows (where n = number of fixed rows + the number of rows scrolled off the top).
         *
         * Note that non-scrollable subgrids can come both before _and_ after the scrollable subgrid.
         * @type {visibleRowArray}
         */
        this.visibleRows = [];

        this.insertionBounds = [];

        this.cellEventPool = [];
    },

    /**
     * @summary Constructor logic
     * @desc This method will be called upon instantiation of this class or of any class that extends from this class.
     * > All `initialize()` methods in the inheritance chain are called, in turn, each with the same parameters that were passed to the constructor, beginning with that of the most "senior" class through that of the class of the new instance.
     * @memberOf Renderer.prototype
     */
    initialize: function initialize(grid) {
        this.grid = grid;

        this.gridRenderers = {};
        paintCellsFunctions.forEach(function (paintCellsFunction) {
            this.registerGridRenderer(paintCellsFunction);
        }, this);

        // typically grid properties won't exist yet
        this.setGridRenderer(this.properties.gridRenderer || 'by-columns-and-rows');

        this.reset();
    },

    registerGridRenderer: function registerGridRenderer(paintCellsFunction) {
        this.gridRenderers[paintCellsFunction.key] = {
            paintCells: paintCellsFunction
        };
    },

    setGridRenderer: function setGridRenderer(key) {
        var gridRenderer = this.gridRenderers[key];

        if (!gridRenderer) {
            throw new this.HypergridError('Unregistered grid renderer "' + key + '"');
        }

        if (gridRenderer !== this.gridRenderer) {
            this.gridRenderer = gridRenderer;
            this.gridRenderer.reset = true;
        }
    },

    resetAllGridRenderers: function resetAllGridRenderers(blackList) {
        // Notify renderers that grid shape has changed
        Object.keys(this.gridRenderers).forEach(function (key) {
            this.gridRenderers[key].reset = !blackList || blackList.indexOf(key) < 0;
        }, this);
    },

    /**
     * Certain renderers that pre-bundle column rects based on columns' background colors need to re-bundle when columns' background colors change. This method sets the `rebundle` property to `true` for those renderers that have that property.
     */
    rebundleGridRenderers: function rebundleGridRenderers() {
        Object.keys(this.gridRenderers).forEach(function (key) {
            if (this.gridRenderers[key].paintCells.rebundle) {
                this.gridRenderers[key].rebundle = true;
            }
        }, this);
    },

    resetRowHeaderColumnWidth: function resetRowHeaderColumnWidth() {
        this.lastKnowRowCount = undefined;
    },

    computeCellsBounds: function computeCellsBounds() {
        this.needsComputeCellsBounds = true;
    },

    /**
     * CAUTION: Keep in place! Used by {@link Canvas}.
     * @memberOf Renderer.prototype
     * @returns {Object} The current grid properties object.
     */
    get properties() {
        return this.grid.properties;
    },

    /**
     * @memberOf Renderer.prototype
     * @summary Notify the fin-hypergrid every time we've repainted.
     * @desc This is the entry point from fin-canvas.
     * @param {CanvasRenderingContext2D} gc
     */
    paint: function paint(gc) {
        if (this.grid.canvas) {
            this.renderGrid(gc);
            this.grid.gridRenderedNotification();
        }
    },

    tickNotification: function tickNotification() {
        this.grid.tickNotification();
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} Answer how many rows we rendered
     */
    getVisibleRowsCount: function getVisibleRowsCount() {
        return this.visibleRows.length - 1;
    },

    getVisibleScrollHeight: function getVisibleScrollHeight() {
        return this.viewHeight - this.grid.getFixedRowsHeight();
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} Number of columns we just rendered.
     */
    getVisibleColumnsCount: function getVisibleColumnsCount() {
        return this.visibleColumns.length - 1;
    },

    /**
     * @memberOf Renderer.prototype
     * @param {CellEvent|number} x - CellEvent object or grid column coordinate.
     * @param {number} [y] - Grid row coordinate. Omit if `xOrCellEvent` is a CellEvent.
     * @returns {Rectangle} Bounding rect of cell with the given coordinates.
     */
    getBoundsOfCell: function getBoundsOfCell(x, y) {
        var vc = this.visibleColumns[x],
            vr = this.visibleRows[y];

        var event = this.cellEventPool.find(function (e) {
            return e.visibleColumn === vc && e.visibleRow === vr;
        });
        if (event) {
            return event.bounds;
        }

        return {
            x: vc.left,
            y: vr.top,
            width: vc.width + this.grid.behavior.getAdditionalWidth(x, y),
            height: vr.height + this.grid.behavior.getAdditionalHeight(x, y)
        };
    },

    /**
     * @memberOf Renderer.prototype
     * @desc answer the column index under the coordinate at pixelX
     * @param {number} pixelX - The horizontal coordinate.
     * @returns {number} The column index under the coordinate at pixelX.
     */
    getColumnFromPixelX: function getColumnFromPixelX(pixelX) {
        var width = 0,
            fixedColumnCount = this.grid.getFixedColumnCount(),
            scrollLeft = this.grid.getHScrollValue(),
            visibleColumns = this.visibleColumns;
        for (var c = 1; c < visibleColumns.length; c++) {
            width = visibleColumns[c].left;
            if (pixelX < width) {
                if (c > fixedColumnCount) {
                    c += scrollLeft;
                }
                return c - 1;
            }
        }
        if (c > fixedColumnCount) {
            c += scrollLeft;
        }
        return c - 1;
    },

    /**
     * @memberOf Renderer.prototype
     * @desc Answer specific data cell coordinates given mouse coordinates in pixels.
     * @param {Point} point
     * @returns {Point} Cell coordinates
     */
    getGridCellFromMousePoint: function getGridCellFromMousePoint(point) {
        if (!this.visibleColumns.length) {
            return null;
        }
        var x = point.x,
            y = point.y;
        var visibleRows = this.visibleRows,
            visibleColumns = this.visibleColumns;


        var firstColumn = visibleColumns[this.grid.behavior.leftMostColIndex];
        var inFirstColumn = x < firstColumn.right;

        var _visibleRows = _slicedToArray(visibleRows, 1),
            firstRow = _visibleRows[0];

        var behindFirstRow = y < firstRow.top;

        var isPseudoRow = false;
        var isPseudoCol = false;
        var result = { fake: false };

        var vc = inFirstColumn ? firstColumn : visibleColumns.findWithNeg(function (vc) {
            return x < vc.right;
        });

        var filtered = visibleRows.filter(function (vr) {
            return behindFirstRow ? vr.index !== vr.rowIndex : y <= vr.bottom && y >= vr.top;
        }).sort(function (vr1, vr2) {
            return vr2.rowIndex - vr1.rowIndex;
        });

        var vr = filtered[filtered.length - 1];

        // default to last row and col
        if (vr) {
            isPseudoRow = false;
        } else {
            vr = visibleRows[behindFirstRow ? 0 : visibleRows.length - 1];
            isPseudoRow = true;
        }

        if (vc) {
            isPseudoCol = false;
        } else {
            vc = visibleColumns[visibleColumns.length - 1];
            isPseudoCol = true;
        }

        var mousePoint = this.grid.newPoint(x - vc.left, y - vr.top),
            cellEvent = new this.grid.behavior.CellEvent(vc.columnIndex, vr.index);

        result.cellEvent = Object.defineProperty(cellEvent, 'mousePoint', { value: mousePoint });

        if (isPseudoCol || isPseudoRow) {
            result.fake = true;
            this.grid.beCursor(null);
        }

        return result;
    },

    /**
     * Matrix of unformatted values of visible cells.
     * @returns {Array<Array>}
     */
    getVisibleCellMatrix: function getVisibleCellMatrix() {
        var rows = Array(this.visibleRows.length);
        var adjust = this.grid.behavior.hasTreeColumn() ? 1 : 0;
        for (var y = 0; y < rows.length; ++y) {
            rows[y] = Array(this.visibleColumns.length);
        }
        this.cellEventPool.map(function (cell) {
            var x = cell.gridCell.x + adjust;
            if (x >= 0) {
                rows[cell.gridCell.y][x] = cell.value;
            }
        });
        return rows;
    },

    /**
     * @summary Get the visibility of the column matching the provided grid column index.
     * @desc Requested column may not be visible due to being scrolled out of view.
     * @memberOf Renderer.prototype
     * @summary Determines if a column is visible.
     * @param {number} columnIndex - the column index
     * @returns {boolean} The given column is visible.
     */
    isColumnVisible: function isColumnVisible(columnIndex) {
        return !!this.getVisibleColumn(columnIndex);
    },

    /**
     * @summary Get the "visible column" object matching the provided grid column index.
     * @desc Requested column may not be visible due to being scrolled out of view.
     * @memberOf Renderer.prototype
     * @summary Find a visible column object.
     * @param {number} columnIndex - The grid column index.
     * @returns {object|undefined} The given column if visible or `undefined` if not.
     */
    getVisibleColumn: function getVisibleColumn(columnIndex) {
        return this.visibleColumns.findWithNeg(function (vc) {
            return vc.columnIndex === columnIndex;
        });
    },

    /**
     * @desc Calculate the minimum left column index so the target column shows up in viewport (we need to be aware of viewport's width, number of fixed columns and each column's width)
     * @param {number} targetColIdx - Target column index
     * @returns {number} Minimum left column index so target column shows up
     */
    getMinimumLeftPositionToShowColumn: function getMinimumLeftPositionToShowColumn(targetColIdx) {
        var fixedColumnCount = this.grid.getFixedColumnCount();
        var fixedColumnsWidth = 0;
        var rowNumbersWidth = 0;
        var filtersWidth = 0;
        var viewportWidth = 0;
        var leftColIdx = 0;
        var targetRight = 0;
        var lastFixedColumn = null;
        var computedCols = [];
        var col = null;
        var i = 0;
        var left = 0;
        var right = 0;

        // 1) for each column, we'll compute left and right position in pixels (until target column)
        for (i = 0; i <= targetColIdx; i++) {
            left = right;
            right += Math.ceil(this.grid.getColumnWidth(i));

            computedCols.push({
                left: left,
                right: right
            });
        }

        targetRight = computedCols[computedCols.length - 1].right;

        // 2) calc usable viewport width
        lastFixedColumn = computedCols[fixedColumnCount - 1];

        if (this.properties.showRowNumbers) {
            rowNumbersWidth = this.grid.getColumnWidth(this.grid.behavior.rowColumnIndex);
        }

        if (this.grid.hasTreeColumn()) {
            filtersWidth = this.grid.getColumnWidth(this.grid.behavior.treeColumnIndex);
        }

        fixedColumnsWidth = lastFixedColumn ? lastFixedColumn.right : 0;
        viewportWidth = this.getBounds().width - fixedColumnsWidth - rowNumbersWidth - filtersWidth;

        // 3) from right to left, find the last column that can still render target column
        i = targetColIdx;

        do {
            leftColIdx = i;
            col = computedCols[i];
            i--;
        } while (col.left + viewportWidth > targetRight && i >= 0);

        return leftColIdx;
    },

    /**
     * @summary Get the visibility of the column matching the provided data column index.
     * @desc Requested column may not be visible due to being scrolled out of view or if the column is inactive.
     * @memberOf Renderer.prototype
     * @summary Determines if a column is visible.
     * @param {number} columnIndex - the column index
     * @returns {boolean} The given column is visible.
     */
    isDataColumnVisible: function isDataColumnVisible(columnIndex) {
        return !!this.getVisibleDataColumn(columnIndex);
    },

    /**
     * @summary Get the "visible column" object matching the provided data column index.
     * @desc Requested column may not be visible due to being scrolled out of view or if the column is inactive.
     * @memberOf Renderer.prototype
     * @summary Find a visible column object.
     * @param {number} columnIndex - The grid column index.
     * @returns {object|undefined} The given column if visible or `undefined` if not.
     */
    getVisibleDataColumn: function getVisibleDataColumn(columnIndex) {
        return this.visibleColumns.findWithNeg(function (vc) {
            return vc.column.index === columnIndex;
        });
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} The width x coordinate of the last rendered column
     */
    getFinalVisibleColumnBoundary: function getFinalVisibleColumnBoundary() {
        var chop = this.isLastColumnVisible() ? 2 : 1;
        var colWall = this.visibleColumns[this.visibleColumns.length - chop].right;
        return Math.min(colWall, this.getBounds().width);
    },

    /**
     * @summary Get the visibility of the row matching the provided grid row index.
     * @desc Requested row may not be visible due to being outside the bounds of the rendered grid.
     * @memberOf Renderer.prototype
     * @summary Determines visibility of a row.
     * @param {number} rowIndex - The grid row index.
     * @returns {boolean} The given row is visible.
     */
    isRowVisible: function isRowVisible(rowIndex) {
        return !!this.visibleRows[rowIndex];
    },

    /**
     * @summary Get the "visible row" object matching the provided grid row index.
     * @desc Requested row may not be visible due to being outside the bounds of the rendered grid.
     * @memberOf Renderer.prototype
     * @summary Find a visible row object.
     * @param {number} rowIndex - The grid row index.
     * @returns {object|undefined} The given row if visible or `undefined` if not.
     */
    getVisibleRow: function getVisibleRow(rowIndex) {
        return this.visibleRows[rowIndex];
    },

    /**
     * @summary Get the visibility of the row matching the provided data row index.
     * @desc Requested row may not be visible due to being scrolled out of view.
     * @memberOf Renderer.prototype
     * @summary Determines visibility of a row.
     * @param {number} rowIndex - The data row index.
     * @param {dataModelAPI} [subgrid=this.behavior.subgrids.data]
     * @returns {boolean} The given row is visible.
     */
    isDataRowVisible: function isDataRowVisible(rowIndex, subgrid) {
        return !!this.getVisibleDataRow(rowIndex, subgrid);
    },

    /**
     * @summary Get the "visible row" object matching the provided data row index.
     * @desc Requested row may not be visible due to being scrolled out of view.
     * @memberOf Renderer.prototype
     * @summary Find a visible row object.
     * @param {number} rowIndex - The data row index within the given subgrid.
     * @param {dataModelAPI} [subgrid=this.behavior.subgrids.data]
     * @returns {object|undefined} The given row if visible or `undefined` if not.
     */
    getVisibleDataRow: function getVisibleDataRow(rowIndex, subgrid) {
        subgrid = subgrid || this.grid.behavior.subgrids.lookup.data;
        return this.visibleRows.find(function (vr) {
            return vr.subgrid === subgrid && vr.rowIndex === rowIndex;
        });
    },

    /**
     * @memberOf Renderer.prototype
     * @summary Determines if a cell is selected.
     * @param {number} x - the x cell coordinate
     * @param {number} y - the y cell coordinate*
     * @returns {boolean} The given cell is fully visible.
     */
    isSelected: function isSelected(x, y) {
        return this.grid.isSelected(x, y);
    },

    /**
     * @memberOf Renderer.prototype
     * @desc This is the main forking of the renderering task.
     * @param {CanvasRenderingContext2D} gc
     */
    renderGrid: function renderGrid(gc) {
        this.grid.deferredBehaviorChange();

        gc.beginPath();

        this.buttonCells = {};

        var rowCount = this.grid.getRowCount();
        if (rowCount !== this.lastKnowRowCount) {
            var newWidth = resetRowHeaderColumnWidth.call(this, gc, rowCount);
            if (newWidth !== this.handleColumnWidth) {
                this.needsComputeCellsBounds = true;
                this.handleColumnWidth = newWidth;
            }
            this.lastKnowRowCount = rowCount;
        }

        if (this.needsComputeCellsBounds) {
            computeCellsBounds.call(this);
            this.needsComputeCellsBounds = false;
        }

        this.gridRenderer.paintCells.call(this, gc);
        //render header cells after all another cells to avoid overlapping
        this.gridRenderers['by-columns-and-rows-headers'].paintCells.call(this, gc);

        this.renderSelections(gc);
        this.renderFirstSelectedCell(gc);

        gc.closePath();
    },

    renderFirstSelectedCell: function renderFirstSelectedCell(gc) {
        var firstSelectedCell = this.grid.selectionModel.getFirstSelectedCellOfLastSelection();

        if (!firstSelectedCell) {
            return;
        }

        var x = firstSelectedCell.x,
            y = firstSelectedCell.y;


        if (!this.grid.isDataVisible(x, y) && this.visibleColumns.length > 0) {
            var firstVisibleColumnIndex = this.visibleColumns[0].columnIndex;
            var firstVisibleRowIndex = this.visibleRows[0].rowIndex + this.grid.getHeaderRowCount();
            var colspan = this.grid.behavior.getColspan(x, y);
            var rowspan = this.grid.behavior.getRowspan(x, y);
            if (colspan && x + colspan >= firstVisibleColumnIndex) {
                x = firstVisibleColumnIndex;
            }

            if (rowspan && y + rowspan + this.grid.getHeaderRowCount() >= firstVisibleRowIndex) {
                y = firstVisibleRowIndex;
            }
        }

        if (!this.grid.isDataVisible(x, y)) {
            return;
        }

        var fixedColumnsCount = this.grid.getFixedColumnCount();
        var newX = x >= fixedColumnsCount ? x - this.dataWindow.origin.x : x;

        newX = Math.max(0, newX);

        var pointWithHeaders = {
            x: newX,
            y: y + this.grid.getHeaderRowCount() - this.grid.getVScrollValue() + this.renderedCuttedRowsCount
        };

        var cellBounds = this.grid.getBoundsOfCell(pointWithHeaders);

        var headerRowsCount = this.grid.getHeaderRowCount();
        var headerHeight = headerRowsCount * this.properties.defaultHeaderRowHeight;
        if (!headerHeight) {
            for (var i = 0; i < headerRowsCount; i++) {
                headerHeight += this.grid.getRowHeight(i);
            }
        }

        var startX = cellBounds.left,
            startY = cellBounds.top,
            selectionWidth = cellBounds.width,
            selectionHeight = cellBounds.height;

        if (startY < headerHeight) {
            startY = headerHeight;
            selectionHeight -= this.skippedTopSpace;
        }

        gc.beginPath();
        gc.rect(startX, startY, selectionWidth, selectionHeight);
        gc.cache.lineWidth = 2;
        gc.cache.strokeStyle = this.grid.properties.selectionRegionOutlineColor;
        gc.stroke();
        gc.closePath();
    },

    renderSelections: function renderSelections(gc) {
        var _this = this;

        (this.grid.selectionModel.getSelections() || []).forEach(function (s, i, items) {
            return _this.renderSelectionRect(gc, s, i + 1 === items.length);
        });
    },

    renderSelectionRect: function renderSelectionRect(gc, selection) {
        var isLastSelection = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        if (selection.origin.x === -1) {
            return;
        }

        var vci = this.visibleColumnsByIndex,
            vri = this.visibleRowsByDataRowIndex,
            lastColumn = this.visibleColumns[this.visibleColumns.length - 1],
            // last column in scrollable section
        lastRow = vri[this.dataWindow.corner.y]; // last row in scrollable data section

        if (lastColumn && selection.origin.x > lastColumn.columnIndex || lastRow && selection.origin.y > lastRow.rowIndex) {
            return;
        }

        var vcOrigin = vci[selection.origin.x],
            vcCorner = vci[selection.corner.x],
            vrOrigin = vri[selection.origin.y],
            vrCorner = vri[selection.corner.y];

        var gridProps = this.properties;
        vcOrigin = vcOrigin || this.visibleColumns[gridProps.fixedColumnCount];
        vrOrigin = vrOrigin || this.visibleRows[gridProps.fixedRowCount + this.grid.getHeaderRowCount()];

        if (!lastColumn) {
            var colOffset = 1;
            while (!lastColumn && this.dataWindow.corner.x > 0) {
                lastColumn = vci[this.dataWindow.corner.x - colOffset];
                colOffset++;
            }
        }
        if (!lastRow) {
            var rowOffset = 1;
            while (!lastRow && this.dataWindow.corner.y > 0) {
                lastRow = vri[this.dataWindow.corner.y - rowOffset];
                rowOffset++;
            }
        }
        vcCorner = vcCorner || (lastColumn && selection.corner.x > lastColumn.columnIndex ? lastColumn : vci[this.grid.getFixedColumnCount()]);
        vrCorner = vrCorner || (lastRow && selection.corner.y > lastRow.rowIndex ? lastRow : vri[this.grid.getFixedColumnCount()]);

        if (!(vcOrigin && vcCorner && vrOrigin && vrCorner)) {
            return;
        }

        var headerRowsCount = this.grid.getHeaderRowCount();
        var headerHeight = headerRowsCount * this.properties.defaultHeaderRowHeight;
        if (!headerHeight) {
            for (var i = 0; i < headerRowsCount; i++) {
                headerHeight += this.grid.getRowHeight(i);
            }
        }

        var startX = vcOrigin.left,
            startY = vrOrigin.top,
            width = vcCorner.right - vcOrigin.left,
            height = vrCorner.bottom - vrOrigin.top;
        if (startY < headerHeight) {
            startY = headerHeight;
            height -= this.skippedTopSpace;
        }

        // Render the selection model around the bounds
        var config = {
            bounds: {
                x: startX,
                y: startY,
                width: width,
                height: height
            },
            selectionRegionOverlayColor: this.gridRenderer.paintCells.partial || isLastSelection && selection.width === 0 && selection.height === 0 ? 'transparent' : gridProps.selectionRegionOverlayColor,
            selectionRegionOutlineColor: gridProps.selectionRegionOutlineColor,
            selectionRegionBorderWidth: gridProps.selectionRegionBorderWidth ? gridProps.selectionRegionBorderWidth : 1
        };
        this.grid.cellRenderers.get('lastselection').paint(gc, config);
        if (this.gridRenderer.paintCells.key === 'by-cells') {
            this.gridRenderer.reset = true; // fixes GRID-490
        }
    },

    /**
     * @memberOf Renderer.prototype
     * @desc iterate the renderering overrides and manifest each
     * @param {CanvasRenderingContext2D} gc
     */
    renderOverrides: function renderOverrides(gc) {
        var cache = this.grid.renderOverridesCache;
        for (var key in cache) {
            if (cache.hasOwnProperty(key)) {
                var override = cache[key];
                if (override) {
                    this.renderOverride(gc, override);
                }
            }
        }
    },

    /**
     * @memberOf Renderer.prototype
     * @desc copy each overrides specified area to it's target and blank out the source area
     * @param {CanvasRenderingContext2D} gc
     * @param {OverrideObject} override - an object with details contain an area and a target context
     */
    renderOverride: function renderOverride(gc, override) {
        //lets blank out the drag row
        var hdpiRatio = override.hdpiratio;
        var startX = override.startX; //hdpiRatio * edges[override.columnIndex];
        var width = override.width + 1;
        var height = override.height;
        var targetCTX = override.ctx;
        var imgData = gc.getImageData(startX, 0, Math.round(width * hdpiRatio), Math.round(height * hdpiRatio));
        targetCTX.putImageData(imgData, 0, 0);
        gc.cache.fillStyle = this.properties.backgroundColor2;
        gc.fillRect(Math.round(startX / hdpiRatio), 0, width, height);
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} Current vertical scroll value.
     */
    getScrollTop: function getScrollTop() {
        return this.grid.getVScrollValue();
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} Current horizontal scroll value.
     */
    getScrollLeft: function getScrollLeft() {
        return this.grid.getHScrollValue();
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {boolean} The last col was rendered (is visible)
     */
    isLastColumnVisible: function isLastColumnVisible() {
        var lastColumnIndex = this.grid.getColumnCount() - 1;
        return !!this.visibleColumns.findWithNeg(function (vc) {
            return vc.columnIndex === lastColumnIndex;
        });
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} The rendered column width at index
     */
    getRenderedWidth: function getRenderedWidth(index) {
        var result,
            columns = this.visibleColumns;

        if (index >= columns.length) {
            result = columns[columns.length - 1].right;
        } else {
            result = columns[index].left;
        }

        return result;
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} The rendered row height at index
     */
    getRenderedHeight: function getRenderedHeight(index) {
        var result,
            rows = this.visibleRows;

        if (index >= rows.length) {
            var last = rows[rows.length - 1];
            result = last.bottom;
        } else {
            result = rows[index].top;
        }

        return result;
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {boolean} User is currently dragging a column for reordering.
     */
    isDraggingColumn: function isDraggingColumn() {
        return this.grid.isDraggingColumn();
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} The row to go to for a page up.
     */
    getPageUpRow: function getPageUpRow() {
        var grid = this.grid,
            scrollHeight = this.getVisibleScrollHeight(),
            top = this.dataWindow.origin.y - this.properties.fixedRowCount - 1,
            scanHeight = 0;
        while (scanHeight < scrollHeight && top >= 0) {
            scanHeight += grid.getRowHeight(top);
            top--;
        }
        return top + 1;
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} The row to goto for a page down.
     */
    getPageDownRow: function getPageDownRow() {
        return this.dataWindow.corner.y - this.properties.fixedRowCount + 1;
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} The row to goto for a page right.
     */
    getPageRightColumn: function getPageRightColumn() {
        return this.dataWindow.corner.x - this.properties.fixedColumnCount + 1;
    },

    /**
     * @memberOf Renderer.prototype
     * @returns {number} The row to go to for a page left.
     */
    getPageLeftColumn: function getPageLeftColumn() {
        var widthLeft = this.bounds.width;
        var currentColumnToScrollIndex = this.dataWindow.origin.x - 1;

        while (currentColumnToScrollIndex >= 0) {
            widthLeft -= this.grid.getColumnWidth(currentColumnToScrollIndex);

            if (widthLeft < 0) {
                break;
            }

            currentColumnToScrollIndex -= 1;
        }

        var additionalColumns = this.grid.properties.rowHeaderNumbers ? 1 : 0;
        return currentColumnToScrollIndex + additionalColumns;
    },

    renderErrorCell: function renderErrorCell(err, gc, vc, vr) {
        var message = err && (err.message || err) || 'Unknown error.',
            bounds = { x: vc.left, y: vr.top, width: vc.width, height: vr.height },
            config = { bounds: bounds };

        console.error(message);

        gc.cache.save(); // define clipping region
        gc.beginPath();
        gc.rect(bounds.x, bounds.y, bounds.width, bounds.height);
        gc.clip();

        this.grid.cellRenderers.get('errorcell').paint(gc, config, message);

        gc.cache.restore(); // discard clipping region
    },

    drawLine: function drawLine(gc, x1, y1, width, height) {
        gc.fillRect(x1, y1, width, height);
    },

    /**
     * Draws a rounded rectangle using the current state of the canvas.
     * If you omit the last three params, it will draw a rectangle
     * outline with a 5 pixel border radius
     * @param {CanvasRenderingContext2D} gc
     * @param {Number} x The top left x coordinate
     * @param {Number} y The top left y coordinate
     * @param {Number} width The width of the rectangle
     * @param {Number} height The height of the rectangle
     * @param {Number} [radius = 5] The corner radius; It can also be an object
     *                 to specify different radii for corners
     * @param {Number} [radius.tl = 0] Top left
     * @param {Number} [radius.tr = 0] Top right
     * @param {Number} [radius.br = 0] Bottom right
     * @param {Number} [radius.bl = 0] Bottom left
     * @param {Boolean} [fill = false] Whether to fill the rectangle.
     * @param {Boolean} [stroke = true] Whether to stroke the rectangle.
     */
    renderRoundRect: function renderRoundRect(gc, x, y, width, height, radius, fill, stroke) {
        if (typeof stroke === 'undefined') {
            stroke = true;
        }
        if (typeof radius === 'undefined') {
            radius = 5;
        }
        if (typeof radius === 'number') {
            radius = { tl: radius, tr: radius, br: radius, bl: radius };
        } else {
            var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }
        gc.beginPath();
        gc.moveTo(x + radius.tl, y);
        gc.lineTo(x + width - radius.tr, y);
        gc.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        gc.lineTo(x + width, y + height - radius.br);
        gc.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        gc.lineTo(x + radius.bl, y + height);
        gc.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        gc.lineTo(x, y + radius.tl);
        gc.quadraticCurveTo(x, y, x + radius.tl, y);
        gc.closePath();
        if (fill) {
            gc.fill();
        }
        if (stroke) {
            gc.stroke();
        }
    },

    /**
     * @memberOf Renderer.prototype
     * @desc We opted to not paint borders for each cell as that was extremely expensive. Instead we draw grid lines here.
     * @param {CanvasRenderingContext2D} gc
     */
    paintGridlines: function paintGridlines(gc) {
        var visibleColumns = this.visibleColumns,
            columnsLength = visibleColumns.length,
            visibleRows = this.visibleRows,
            rowsLength = visibleRows.length;

        if (columnsLength && rowsLength) {
            var gridProps = this.properties,
                viewWidth = visibleColumns[columnsLength - 1].right,
                viewHeight = visibleRows[rowsLength - 1].bottom;

            if (gridProps.gridLinesV) {
                gc.cache.fillStyle = gc.cache.strokeStyle = gridProps.gridLinesColor;

                for (var right, vc = visibleColumns[0], c = 0; c < columnsLength; c++) {
                    vc = visibleColumns[c];
                    if (!vc.gap) {
                        right = vc.right;

                        var shift = gridProps.defaultHeaderRowHeight - gridProps.gridLinesWidth;

                        for (var i = 0; i < rowsLength; ++i) {
                            var row = visibleRows[i];
                            if (row.subgrid.isData) {
                                if (this.grid.behavior.dataModel.isColspanedByLeftColumn(vc.columnIndex + 1, row.rowIndex)) {
                                    shift += row.height + gridProps.gridLinesWidth;
                                } else {
                                    break;
                                }
                            }
                        }
                        this.drawLine(gc, right, shift, gridProps.gridLinesWidth, viewHeight - shift);
                    }
                }
            }

            if (gridProps.gridLinesH) {
                gc.cache.fillStyle = gc.cache.strokeStyle = gridProps.gridLinesColor;
                for (var bottom, vr = visibleRows[0], r = 0; r < rowsLength; r++) {
                    vr = visibleRows[r];
                    bottom = vr.bottom;

                    for (var _i = 0; _i < columnsLength; ++_i) {
                        var column = visibleColumns[_i];
                        if (!vr.gap && !this.grid.behavior.dataModel.isRowspanedByRow(column.columnIndex, vr.rowIndex + 1)) {
                            this.drawLine(gc, column.left, bottom, column.width + (gridProps.gridLinesV ? gridProps.gridLinesWidth : 0), gridProps.gridLinesWidth);
                        }
                    }
                    // if (vr.rowIndex > gridProps.fictiveHeaderRowsCount) {
                    //     for (let i = 0; i < columnsLength; ++i) {
                    //         const column = visibleColumns[i];
                    //         if (!vr.gap && !this.grid.behavior.dataModel.isRowspanedByRow(column.columnIndex - 1, vr.rowIndex + 1)) {
                    //             this.drawLine(gc, column.left, bottom, column.width, gridProps.gridLinesWidth);
                    //         }
                    //     }
                    // } else if (!vr.gap) {
                    //     this.drawLine(gc, 0, bottom, viewWidth, gridProps.gridLinesWidth);
                    // }
                    // if (!vr.gap) {
                    //     this.drawLine(gc, 0, bottom, viewWidth, gridProps.gridLinesWidth);
                    // }
                }
            }

            var edgeWidth = void 0;
            var gap = visibleRows.gap;
            if (gap) {
                gc.cache.fillStyle = gc.cache.strokeStyle = gridProps.fixedLinesHColor || gridProps.gridLinesColor;
                edgeWidth = gridProps.fixedLinesHEdge;
                if (edgeWidth) {
                    this.drawLine(gc, 0, gap.top, viewWidth, edgeWidth);
                    this.drawLine(gc, 0, gap.bottom - edgeWidth, viewWidth, edgeWidth);
                } else if (gridProps.fixedRowCount > 0) {
                    this.drawLine(gc, 0, gap.top, viewWidth, gap.bottom - gap.top);
                }
            }

            gap = visibleColumns.gap;
            if (gap) {
                gc.cache.fillStyle = gc.cache.strokeStyle = gridProps.fixedLinesVColor || gridProps.gridLinesColor;
                edgeWidth = gridProps.fixedLinesVEdge;
                if (edgeWidth) {
                    this.drawLine(gc, gap.left, 0, edgeWidth, viewHeight);
                    this.drawLine(gc, gap.right - edgeWidth, 0, edgeWidth, viewHeight);
                } else {
                    this.drawLine(gc, gap.left, 0, gap.right - gap.left, viewHeight);
                }
            }
        }
    },

    /**
     * @memberOf Renderer.prototype
     * @desc function to render header grid lines separately
     * @param {CanvasRenderingContext2D} gc
     */
    paintHeaderGridlines: function paintHeaderGridlines(gc) {
        var visibleColumns = this.visibleColumns,
            columnsLength = visibleColumns.length,
            visibleRows = this.visibleRows,
            rowsLength = visibleRows.length;

        if (columnsLength && rowsLength) {
            var gridProps = this.properties,
                viewWidth = visibleColumns[columnsLength - 1].right,
                viewHeight = visibleRows[rowsLength - 1].bottom;
            var headerRowsCount = this.grid.getHeaderRowCount();

            if (gridProps.gridLinesV || gridProps.gridLinesHeaderColor) {
                var headerHeight = headerRowsCount * this.properties.defaultHeaderRowHeight;
                if (!headerHeight) {
                    for (var i = 0; i < headerRowsCount; i++) {
                        headerHeight += this.grid.getRowHeight(i);
                    }
                }

                gc.cache.fillStyle = gc.cache.strokeStyle = gridProps.gridLinesHeaderColor ? gridProps.gridLinesHeaderColor : gridProps.gridLinesColor;
                for (var headerRight, headerVc = visibleColumns[0], headerC = 0; headerC < columnsLength; headerC++) {
                    headerVc = visibleColumns[headerC];
                    headerRight = headerVc.right;
                    if (!headerVc.gap) {
                        this.drawLine(gc, headerRight, 0, gridProps.gridLinesWidth, headerHeight);
                    }
                }

                if (this.grid.properties.rowHeaderNumbers) {
                    var right = visibleColumns[this.grid.behavior.rowColumnIndex].right;
                    gc.cache.fillStyle = gc.cache.strokeStyle = gridProps.gridLinesHeaderColor || gridProps.gridLinesColor;
                    this.drawLine(gc, right, 0, gridProps.gridLinesWidth, viewHeight);
                }
            }

            if (gridProps.gridLinesH || gridProps.gridLinesHeaderColor) {
                gc.cache.fillStyle = gc.cache.strokeStyle = gridProps.gridLinesHeaderColor ? gridProps.gridLinesHeaderColor : gridProps.gridLinesColor;

                var additionalWidth = gridProps.gridLinesV ? gridProps.gridLinesWidth : 0;
                var firstRowWidth = this.grid.properties.rowHeaderNumbers ? visibleColumns[this.grid.behavior.rowColumnIndex].right + additionalWidth : 0;

                gc.cache.fillStyle = gc.cache.strokeStyle = gridProps.gridLinesHeaderColor;
                for (var headerBottom, headerVr = visibleRows[0], headerR = 0; headerR < rowsLength; headerR++) {
                    headerVr = visibleRows[headerR];
                    headerBottom = headerVr.bottom;
                    if (!headerVr.gap) {
                        if (headerR < headerRowsCount) {
                            this.drawLine(gc, 0, headerBottom, viewWidth, gridProps.gridLinesWidth);
                        } else {
                            this.drawLine(gc, 0, headerBottom, firstRowWidth, gridProps.gridLinesWidth);
                        }
                    }
                }
            }
        }
    },

    /**
     * @memberOf Renderer.prototype
     * @param {CanvasRenderingContext2D} gc
     * @param x
     * @param y
     */
    paintCell: function paintCell(gc, x, y) {
        gc.moveTo(0, 0);

        var c = this.visibleColumns[x].index,
            // todo refac
        r = this.visibleRows[y].index;

        if (c) {
            //something is being viewed at at the moment (otherwise returns undefined)
            this._paintCell(gc, c, r);
        }
    },

    /**
     * @summary Render a single cell.
     * @param {CanvasRenderingContext2D} gc
     * @param {CellEvent} cellEvent
     * @param {string} [prefillColor] If omitted, this is a partial renderer; all other renderers must provide this.
     * @returns {number} Preferred width of renndered cell.
     * @private
     * @memberOf Renderer
     */
    _paintCell: function _paintCell(gc, cellEvent, prefillColor) {
        if (cellEvent.isRenderSkipNeeded) {
            return;
        }

        var grid = this.grid,
            selectionModel = grid.selectionModel,
            behavior = grid.behavior,
            properties = cellEvent.properties,
            isHandleColumn = cellEvent.isHandleColumn,
            isTreeColumn = cellEvent.isTreeColumn,
            isColumnSelected = cellEvent.isColumnSelected,
            isDataRow = cellEvent.isDataRow,
            isRowSelected = cellEvent.isRowSelected,
            isCellSelected = cellEvent.isCellSelected,
            isHeaderRow = cellEvent.isHeaderRow,
            isFilterRow = cellEvent.isFilterRow,
            isRowHandleOrHierarchyColumn = isHandleColumn || isTreeColumn,
            isUserDataArea = !isRowHandleOrHierarchyColumn && isDataRow,
            config = this.assignProps(cellEvent),
            x = (config.gridCell = cellEvent.gridCell).x,
            r = (config.dataCell = cellEvent.dataCell).y,
            value,
            format,
            isSelected;

        if (isHandleColumn && isDataRow) {
            isSelected = isRowSelected || selectionModel.isCellSelectedInRow(r);
            config.halign = this.properties.columnHeaderHalign;
        } else if (isTreeColumn) {
            isSelected = isRowSelected || selectionModel.isCellSelectedInRow(r);
            config.halign = 'left';
        } else if (isDataRow) {
            isSelected = isCellSelected || isRowSelected || isColumnSelected;
            format = config.format;
        } else if (x === grid.behavior.rowColumnIndex && r === 0 && isHandleColumn && isHeaderRow && behavior.errorCount) {
            config.foregroundSelectionColor = config.color = properties.backgroundColor;
            // config.backgroundText = this.properties.errorTotalUnicodeChar;
            // config.backgroundTextFont = this.properties.errorIconFont;
            // config.backgroundTextColor = this.properties.errorIconColor;
            config.renderTotalErrorSignNeeded = true;
            config.renderTotalErrorCount = behavior.errorCount;
        } else {
            format = cellEvent.subgrid.format || config.format; // subgrid format can override column format
            if (isFilterRow) {
                isSelected = false;
            } else if (isColumnSelected) {
                isSelected = true;
            } else {
                isSelected = selectionModel.isCellSelectedInColumn(x); // header or summary or other non-meta
            }
        }

        // Set cell contents:
        // * For all cells: set `config.value` (writable property)
        // * For cells outside of row handle column: also set `config.dataRow` for use by valOrFunc

        if (!isHandleColumn) {
            //Including hierarchyColumn
            config.dataRow = cellEvent.dataRow;
            value = cellEvent.value;
            if (value && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object' && value.type === 'ERROR') {
                config.foregroundSelectionColor = config.color = config.errorCellDataColor;
            }
            if (value === null) {
                config.foregroundSelectionColor = config.color = config.nullCellColor;
                value = config.nullCellPlaceholder;
            }
        } else {
            if (isDataRow) {
                // row handle for a data row
                if (config.rowHeaderNumbers) {
                    value = r + config.rowHeaderStartDisplayedIndex; // row number is 1-based
                }
            } else if (isHeaderRow) {
                // row handle for header row: gets "master" checkbox
                config.allRowsSelected = selectionModel.areAllRowsSelected();
            }
        }

        config.isSelected = isSelected;
        config.isDataColumn = !isRowHandleOrHierarchyColumn;
        config.isHandleColumn = isHandleColumn;
        config.isTreeColumn = isTreeColumn;
        config.isDataRow = isDataRow;
        config.isHeaderRow = isHeaderRow;
        config.isFilterRow = isFilterRow;
        config.isUserDataArea = isUserDataArea;
        config.isColumnHovered = cellEvent.isColumnHovered;
        config.isRowHovered = cellEvent.isRowHovered;
        config.isCellHovered = cellEvent.isCellHovered;
        config.bounds = cellEvent.bounds;
        config.isCellSelected = isCellSelected;
        config.isRowSelected = isRowSelected;
        config.isColumnSelected = isColumnSelected;
        config.isInCurrentSelectionRectangle = selectionModel.isInCurrentSelectionRectangle(x, r);
        config.isFirstSelectedCell = !isHeaderRow && selectionModel.isFirstSelectedCell(x, r);
        config.prefillColor = prefillColor;
        config.buttonCells = this.buttonCells; // allow the renderer to identify itself if it's a button
        config.subrow = 0;
        config.halign = isHeaderRow ? config.rowHeaderHalign : behavior.getCellProperty('halign') || config.halign;
        config.ignoreValuePrefix = properties.ignoreValuePrefix;
        config.highlightedChars = cellEvent.highlightedChars;

        config.isAggregationTreeColumn = cellEvent.isAggregationTreeColumn;
        if (config.isAggregationTreeColumn) {
            config.aggregationChildCount = cellEvent.aggregationChildCount;
            if (config.aggregationChildCount && !config.headerRow) {
                config.valuePostfix = '(' + config.aggregationChildCount + ')';
            }
        }

        config.isAggregationColumn = cellEvent.isAggregationColumn;
        if (config.isAggregationColumn) {
            config.hasChildRows = cellEvent.hasChildRows;
            config.isAggregationRow = cellEvent.isAggregationRow;
            config.isRowExpanded = cellEvent.isRowExpanded;
            config.treeLevel = cellEvent.treeLevel;

            config.isGrandTotalRow = cellEvent.isGrandTotalRow;
            if (config.isGrandTotalRow) {
                config.backgroundTextFont = this.properties.grandAggregationCellFont;
                config.foregroundSelectionFont = this.properties.grandAggregationCellFont;
                config.font = this.properties.grandAggregationCellFont;
            }

            config.isExpandableRow = cellEvent.isExpandableRow;
            if (config.isExpandableRow && value) {
                config.valuePrefix = config.isRowExpanded ? this.properties.aggregationGroupExpandIconCollapsedChar : this.properties.aggregationGroupExpandIconExpandedChar;
                config.valuePrefixFont = this.properties.aggregationGroupExpandIconFont;
                config.valuePrefixColor = this.properties.aggregationGroupExpandIconColor;
                config.prefixIgnoreUnderliningNeeded = true;
            }
        }

        if (cellEvent.isExpandableColumn) {
            config.valuePrefix = cellEvent.isColumnExpanded ? this.properties.aggregationGroupExpandIconCollapsedChar : this.properties.aggregationGroupExpandIconExpandedChar;
            config.valuePrefixFont = this.properties.aggregationGroupExpandIconFont;
            config.valuePrefixColor = this.properties.aggregationGroupExpandIconColor;
            config.prefixIgnoreUnderliningNeeded = true;
        }

        if (!config.valuePrefix && config.headerRow) {
            if (cellEvent.column.hasError) {
                config.valuePrefix = this.properties.errorIconUnicodeChar;
                config.valuePrefixFont = this.properties.errorIconFont;
                config.valuePrefixColor = this.properties.errorIconColor;
            } else {
                config.valuePrefix = cellEvent.column.schema ? cellEvent.column.schema.headerPrefix : undefined;
                config.valuePrefixFont = this.properties.columnTitlePrefixFont;
                config.valuePrefixColor = this.properties.columnTitlePrefixColor;
            }
        }

        if (!config.colTypeSign) {
            config.colTypeSign = cellEvent.column.schema ? cellEvent.column.schema.colTypeSign : undefined;
        }

        if (grid.mouseDownState) {
            config.mouseDown = grid.mouseDownState.gridCell.equals(cellEvent.gridCell);
        }

        // subrow logic - coded for efficiency when no subrows (!value.subrows)
        var isArray = isUserDataArea && value && value.constructor === Array,
            // fastest array determination
        subrows = isArray && value.subrows && value.length;

        if (subrows) {
            var bounds = config.bounds = Object.assign({}, config.bounds);
            bounds.height /= subrows;
            config.subrows = subrows;
            config.value = config.exec(value[0]);
        } else {
            subrows = 1;
            config.value = !isArray && isUserDataArea ? config.exec(value) : value;
        }

        if (config.isDataRow && !config.link && config.value && config.detectLinksPermanently && cellEvent.isValueUrl) {
            config.link = config.value;
        }

        while (true) {
            // eslint-disable-line
            // This call's dataModel.getCell which developer can override to:
            // * mutate the (writable) properties of `config` (including config.value)
            // * mutate cell renderer choice (instance of which is returned)
            var cellRenderer = cellEvent.subgrid.getCell(config, config.renderer);

            behavior.cellPropertiesPrePaintNotification(config);

            config.formatValue = grid.getFormatter(format);

            // Following supports partial render
            config.snapshot = cellEvent.snapshot;
            config.minWidth = cellEvent.minWidth; // in case `paint` aborts before setting `minWidth`

            // Render the cell
            cellRenderer.paint(gc, config);

            // Following supports partial render:
            cellEvent.snapshot[config.subrow] = config.snapshot;
            if (cellEvent.minWidth === undefined || config.minWidth > cellEvent.minWidth) {
                cellEvent.minWidth = config.minWidth;
            }

            if (++config.subrow === subrows) {
                break;
            }

            bounds.y += bounds.height;
            config.value = config.exec(value[config.subrow]);
        }

        return config.minWidth;
    },

    /**
     * Overridable for alternative or faster logic.
     * @param CellEvent
     * @returns {object} Layered config object.
     */
    assignProps: layerProps,

    /**
     * @param {number|CellEvent} colIndexOrCellEvent - This is the "data" x coordinate.
     * @param {number} [rowIndex] - This is the "data" y coordinate. Omit if `colIndexOrCellEvent` is a `CellEvent`.
     * @param {dataModelAPI} [dataModel=this.grid.behavior.dataModel] Omit if `colIndexOrCellEvent` is a `CellEvent`.
     * @returns {CellEvent} The matching `CellEvent` object from the renderer's pool. Returns `undefined` if the requested cell is not currently visible (due to being scrolled out of view).
     */
    findCell: function findCell(colIndexOrCellEvent, rowIndex, dataModel) {
        var colIndex,
            cellEvent,
            pool = this.cellEventPool;

        if ((typeof colIndexOrCellEvent === 'undefined' ? 'undefined' : _typeof(colIndexOrCellEvent)) === 'object') {
            // colIndexOrCellEvent is a cell event object
            dataModel = rowIndex;
            rowIndex = colIndexOrCellEvent.visibleRow.rowIndex;
            colIndex = colIndexOrCellEvent.column.index;
        } else {
            colIndex = colIndexOrCellEvent;
        }

        dataModel = dataModel || this.grid.behavior.dataModel;

        for (var p = 0, len = this.visibleColumns.length * this.visibleRows.length; p < len; ++p) {
            cellEvent = pool[p];
            if (cellEvent.subgrid === dataModel && cellEvent.column.index === colIndex && cellEvent.visibleRow.rowIndex === rowIndex) {
                return cellEvent;
            }
        }
    },

    /**
     * Resets the cell properties cache in the matching `CellEvent` object from the renderer's pool. This will insure that a new cell properties object will be known to the renderer. (Normally, the cache is not reset until the pool is updated by the next call to {@link Renderer#computeCellBounds}).
     * @param {number|CellEvent} xOrCellEvent
     * @param {number} [y]
     * @param {dataModelAPI} [dataModel=this.grid.behavior.dataModel]
     * @returns {CellEvent} The matching `CellEvent` object.
     */
    resetCellPropertiesCache: function resetCellPropertiesCache(xOrCellEvent, y, dataModel) {
        var cellEvent = this.findCell.apply(this, arguments);
        if (cellEvent) {
            cellEvent._cellOwnProperties = undefined;
        }
        return cellEvent;
    },

    resetAllCellPropertiesCaches: function resetAllCellPropertiesCaches() {
        this.cellEventPool.forEach(function (cellEvent) {
            cellEvent._cellOwnProperties = undefined;
        });
    },

    isViewableButton: function isViewableButton(c, r) {
        // Cell with 'button' renderer clicked returns an array; other cells return `undefined`.
        // The array contains bounding rect per subrow with a button. When no subrows array length is 1.
        return this.buttonCells[c + ',' + r];
    },

    getBounds: function getBounds() {
        return this.bounds;
    },

    setBounds: function setBounds(bounds) {
        return this.bounds = bounds;
    },

    setInfo: function setInfo(message) {
        var width;
        if (this.visibleColumns.length) {
            width = this.visibleColumns[this.visibleColumns.length - 1].right;
        }
        this.grid.canvas.setInfo(message, width);
    }
});

/**
 * This function creates several data structures:
 * * {@link Renderer#visibleColumns}
 * * {@link Renderer#visibleRows}
 *
 * Original comment:
 * "this function computes the grid coordinates used for extremely fast iteration over
 * painting the grid cells. this function is very fast, for thousand rows X 100 columns
 * on a modest machine taking usually 0ms and no more that 3 ms."
 *
 * @this {Renderer}
 */
function computeCellsBounds() {
    //var startTime = Date.now();

    var scrollTop = this.getScrollTop(),
        scrollLeft = this.getScrollLeft(),
        fixedColumnCount = this.grid.getFixedColumnCount(),
        fixedRowCount = this.grid.getFixedRowCount(),
        bounds = this.getBounds(),
        grid = this.grid,
        behavior = grid.behavior,
        noTreeColumn = !behavior.hasTreeColumn(),
        editorCellEvent = grid.cellEditor && grid.cellEditor.event,
        vcEd,
        xEd,
        vrEd,
        yEd,
        sgEd,
        isSubgridEd,
        insertionBoundsCursor = 0,
        previousInsertionBoundsCursorValue = 0,
        gridProps = grid.properties,
        lineWidthV = gridProps.gridLinesWidth,
        lineWidthH = gridProps.gridLinesWidth,
        fixedWidthV = gridProps.fixedLinesVWidth || gridProps.gridLinesWidth,
        fixedWidthH = gridProps.fixedLinesHWidth || gridProps.gridLinesWidth,
        hasFixedColumnGap = fixedWidthV && fixedColumnCount,
        hasFixedRowGap = fixedWidthH && fixedRowCount,
        start = 0,
        numOfInternalCols = 0,
        x,
        X,
        // horizontal pixel loop index and limit
    y,
        Y,
        // vertical pixel loop index and limit
    columnIndex,
        columnCount,
        // column loop index and limit
    currentSubgridIndex,
        subgridsSize,
        // subgrid loop index and limit
    r,
        R,
        // row loop index and limit
    subrows,
        // rows in subgrid g
    base,
        // sum of rows for all subgrids so far
    subgrids = behavior.subgrids,
        subgrid,
        rowIndex,
        scrollableSubgrid,
        footerHeight,
        vx,
        vy,
        visibleRow,
        vc,
        width,
        height,
        firstVX,
        lastVX,
        firstVY,
        lastVY,
        topR,
        gap,
        left,
        widthSpaced,
        heightSpaced; // adjusted for cell spacing

    if (editorCellEvent) {
        xEd = editorCellEvent.gridCell.x;
        yEd = editorCellEvent.dataCell.y;
        sgEd = editorCellEvent.subgrid;
    }

    if (noTreeColumn) {
        this.visibleColumns[behavior.treeColumnIndex] = undefined;
    } else {
        start = Math.min(start, behavior.treeColumnIndex);
        numOfInternalCols += 1;
    }

    if (gridProps.showRowNumbers) {
        start = Math.min(start, behavior.rowColumnIndex);
        numOfInternalCols += 1;
    }

    this.scrollHeight = 0;

    this.visibleColumns.length = 0;
    this.visibleColumns.gap = undefined;

    this.visibleRows.length = 0;
    this.visibleRows.gap = undefined;

    this.visibleColumnsByIndex = []; // array because number of columns will always be reasonable
    this.visibleRowsByDataRowIndex = {}; // hash because keyed by (fixed and) scrolled row indexes

    this.insertionBounds = [];

    var totalSpace = grid.renderer.bounds.width;
    var totalWidth = behavior.getColumnsWidth();
    var scrolledWidth = behavior.getColumnsWidth(scrollLeft);
    var visibleSpace = totalWidth - scrolledWidth + behavior.getColumnWidth(behavior.rowColumnIndex);
    var freeSpace = totalSpace - visibleSpace;
    var lastShift = 0;

    while (freeSpace > 0 && scrollLeft > 0) {
        scrollLeft--;
        var widthForSub = this.grid.getColumnWidth(scrollLeft);
        lastShift = widthForSub - freeSpace;
        freeSpace -= widthForSub;
    }

    lastShift = Math.round(lastShift);

    for (x = 0, columnIndex = start, columnCount = grid.getColumnCount(), X = (bounds.width || grid.canvas.width) + lastShift; columnIndex < columnCount && x <= X; columnIndex++) {
        if (noTreeColumn && columnIndex === behavior.treeColumnIndex) {
            continue;
        }

        vx = columnIndex;
        if (columnIndex >= fixedColumnCount) {
            lastVX = vx += scrollLeft;
            if (firstVX === undefined) {
                firstVX = lastVX;
            }
        }
        if (vx >= columnCount) {
            break; // scrolled beyond last column
        }

        width = Math.ceil(behavior.getColumnWidth(vx));

        if (x) {
            if (gap = hasFixedColumnGap && columnIndex === fixedColumnCount) {
                x += fixedWidthV - lineWidthV;
                this.visibleColumns.gap = {
                    left: vc.right,
                    right: undefined
                };
            }
            left = x + lineWidthV;
            widthSpaced = width - lineWidthV;
        } else {
            left = x;
            widthSpaced = width;
        }

        var column = behavior.getActiveColumn(vx);

        if (!column) {
            continue;
        }

        // if (column.index === undefined) {
        //     column.index = c;
        // }

        // todo probably need to be fixed with fixedColumnCount > 0
        // resize first column
        if (columnIndex === fixedColumnCount && lastShift) {
            widthSpaced -= lastShift;
            width -= lastShift;
        }

        this.visibleColumns[columnIndex] = this.visibleColumnsByIndex[vx] = vc = {
            index: columnIndex,
            columnIndex: vx,
            column: column,
            gap: gap,
            left: left,
            width: widthSpaced,
            right: left + widthSpaced
        };

        if (gap) {
            this.visibleColumns.gap.right = vc.left;
        }

        if (xEd === vx) {
            vcEd = vc;
        }

        x += width;

        insertionBoundsCursor += Math.round(width / 2) + previousInsertionBoundsCursorValue;
        this.insertionBounds.push(insertionBoundsCursor);
        previousInsertionBoundsCursorValue = Math.round(width / 2);
    }

    // get height of total number of rows in all subgrids following the data subgrid
    footerHeight = gridProps.defaultRowHeight * behavior.getFooterRowCount();

    for (base = r = currentSubgridIndex = y = 0, subgridsSize = subgrids.length, Y = bounds.height - footerHeight; currentSubgridIndex < subgridsSize; currentSubgridIndex++, base += subrows) {
        subgrid = subgrids[currentSubgridIndex];
        subrows = subgrid.getRowCount();
        scrollableSubgrid = subgrid.isData;
        isSubgridEd = sgEd === subgrid;
        topR = r;

        // For each row of each subgrid...
        var minVisibleRow = 0;
        for (R = r + subrows; r < R && y < Y; r++) {
            vy = r;

            if (minVisibleRow > vy && vy !== 0) {
                minVisibleRow = vy;
            }

            if (scrollableSubgrid) {
                if (gap = hasFixedRowGap && r === fixedRowCount && r !== 1) {
                    y += fixedWidthH - lineWidthH;
                    this.visibleRows.gap = {
                        top: visibleRow.bottom,
                        bottom: undefined
                    };
                }
                if (r >= fixedRowCount) {
                    vy += scrollTop;
                    lastVY = vy - base;
                    if (firstVY === undefined) {
                        firstVY = lastVY;
                    }
                    if (vy >= R) {
                        break; // scrolled beyond last row
                    }
                }
            }

            rowIndex = vy - base;
            height = behavior.getRowHeight(rowIndex, subgrid);

            heightSpaced = height - lineWidthH;
            this.visibleRows[r] = visibleRow = {
                index: r,
                subgrid: subgrid,
                gap: gap,
                rowIndex: rowIndex,
                top: y,
                height: heightSpaced,
                bottom: y + heightSpaced
            };

            if (gap) {
                this.visibleRows.gap.bottom = visibleRow.top;
            }

            if (scrollableSubgrid) {
                this.visibleRowsByDataRowIndex[vy - base] = visibleRow;
            }

            if (isSubgridEd && yEd === rowIndex) {
                vrEd = visibleRow;
            }

            y += height;
        }

        if (scrollableSubgrid) {
            subrows = r - topR;
            Y += footerHeight;
        }

        if (y < Y) {
            this.bottomFreeSpace = Y - y;
            if (this.bottomFreeSpace <= gridProps.defaultRowHeight) {
                var headerRowsCount = behavior.getHeaderRowCount();
                var previousFirstRow = this.visibleRows[headerRowsCount] || this.visibleRows[headerRowsCount - 1];

                this.skippedTopSpace = gridProps.defaultRowHeight - this.bottomFreeSpace + lineWidthH;
                var top = previousFirstRow.top - this.skippedTopSpace;
                var halfSizedRow = {
                    index: headerRowsCount,
                    subgrid: previousFirstRow.subgrid,
                    gap: false,
                    rowIndex: previousFirstRow.rowIndex - 1,
                    top: top,
                    height: gridProps.defaultRowHeight + lineWidthH,
                    bottom: top + gridProps.defaultRowHeight + lineWidthH,
                    skippedTopSpace: this.skippedTopSpace
                };

                for (var i = headerRowsCount; i < this.visibleRows.length; i++) {
                    this.visibleRows[i].top += this.bottomFreeSpace + lineWidthH;
                    this.visibleRows[i].index += 1;
                    this.visibleRows[i].bottom += this.bottomFreeSpace + lineWidthH;
                }
                this.visibleRows.splice(headerRowsCount, 0, halfSizedRow);

                if (scrollableSubgrid) {
                    this.visibleRowsByDataRowIndex[halfSizedRow.rowIndex] = halfSizedRow;
                }

                // this.visibleRows.unshift(halfSizedRow);
                this.renderedCuttedRowsCount = 1;
            } else {
                this.renderedCuttedRowsCount = 0;
                this.skippedTopSpace = 0;
            }
        } else {
            this.renderedCuttedRowsCount = 0;
            this.skippedTopSpace = 0;
        }
    }

    if (editorCellEvent) {
        editorCellEvent.visibleColumn = vcEd;
        editorCellEvent.visibleRow = vrEd;
        editorCellEvent.gridCell.y = vrEd && vrEd.index;
        editorCellEvent._bounds = null;
    }

    this.viewHeight = Y;

    this.dataWindow = this.grid.newRectangle(firstVX, firstVY, lastVX - firstVX, lastVY - firstVY);

    // Resize CellEvent pool
    var pool = this.cellEventPool,
        previousLength = pool.length,
        P = (this.visibleColumns.length + numOfInternalCols) * this.visibleRows.length;

    if (P > previousLength) {
        pool.length = P; // grow pool to accommodate more cells
    }
    for (var p = previousLength; p < P; p++) {
        pool[p] = new behavior.CellEvent(); // instantiate new members
    }

    this.resetAllGridRenderers();
}

/**
 * @summary Resize the handle column.
 * @desc Handle column width is sum of:
 * * Width of text the maximum row number, if visible, based on handle column's current font
 * * Width of checkbox, if visible
 * * Some padding
 *
 * @this {Renderer}
 * @param gc
 * @param rowCount
 */
function resetRowHeaderColumnWidth(gc, rowCount) {
    var columnProperties = this.grid.behavior.getColumnProperties(this.grid.behavior.rowColumnIndex),
        gridProps = this.grid.properties,

    // width = 2 * columnProperties.cellPadding;
    width = columnProperties.cellPaddingLeft + columnProperties.cellPaddingRight;

    // Checking images.checked also supports a legacy feature in which checkbox could be hidden by undefining the image.
    if (gridProps.rowHeaderCheckboxes && images.checked) {
        width += images.checked.width;
    }

    if (gridProps.rowHeaderNumbers) {
        var cellProperties = columnProperties.rowHeader;
        gc.cache.font = cellProperties.foregroundSelectionFont.indexOf('bold ') >= 0 ? cellProperties.foregroundSelectionFont : cellProperties.font;

        width += gc.getTextWidth(rowCount);
        width = width < cellProperties.minWidth ? cellProperties.minWidth : width;
    }

    columnProperties.preferredWidth = columnProperties.width = width;
}

function registerGridRenderer(paintCellsFunction) {
    if (paintCellsFunctions.indexOf(paintCellsFunction) < 0) {
        paintCellsFunctions.push(paintCellsFunction);
    }
}

registerGridRenderer(require('./by-cells'));
registerGridRenderer(require('./by-columns'));
registerGridRenderer(require('./by-columns-discrete'));
registerGridRenderer(require('./by-columns-and-rows'));
registerGridRenderer(require('./by-columns-and-rows-headers'));
registerGridRenderer(require('./by-rows'));

Renderer.registerGridRenderer = registerGridRenderer;

module.exports = Renderer;
