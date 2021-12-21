'use strict';

var RangeSelectionModel = require('sparse-boolean-array');

var InclusiveRectangle = require('./InclusiveRectangle');


/**
 *
 * @constructor
 * @desc We represent selections as a list of rectangles because large areas can be represented and tested against quickly with a minimal amount of memory usage. Also we need to maintain the selection rectangles flattened counter parts so we can test for single dimension contains. This is how we know to highlight the fixed regions on the edges of the grid.
 */

function SelectionModel(grid) {
    this.grid = grid;
    this.reset();
}

SelectionModel.prototype = {

    constructor: SelectionModel.prototype.constructor,

    /**
     * @type {boolean}
     * @memberOf SelectionModel.prototype
     */
    allRowsSelected: false,

    reset: function() {
        /**
         * @name selections
         * @type {Rectangle[]}
         * @summary The selection rectangles.
         * @desc Created as an empty array upon instantiation by the {@link SelectionModel|constructor}.
         * @memberOf SelectionModel.prototype
         */
        this.selections = [];

        this.copyArea = null;

        /**
         * @name flattenedX
         * @type {Rectangle[]}
         * @summary The selection rectangles flattened in the horizontal direction (no width).
         * @desc Created as an empty array upon instantiation by the {@link SelectionModel|constructor}.
         * @memberOf SelectionModel.prototype
         */
        this.flattenedX = [];

        /**
         * @name flattenedY
         * @type {Rectangle[]}
         * @summary The selection rectangles flattened in the vertical direction (no height).
         * @desc Created as an empty array upon instantiation by the {@link SelectionModel|constructor}.
         * @memberOf SelectionModel.prototype
         */
        this.flattenedY = [];

        /**
         * @name rowSelectionModel
         * @type {RangeSelectionModel}
         * @summary The selection rectangles.
         * @desc Created as a new RangeSelectionModel upon instantiation by the {@link SelectionModel|constructor}.
         * @memberOf SelectionModel.prototype
         */
        this.rowSelectionModel = new RangeSelectionModel();

        /**
         * @name columnSelectionModel
         * @type {RangeSelectionModel}
         * @summary The selection rectangles.
         * @desc Created as a new RangeSelectionModel upon instantiation by the {@link SelectionModel|constructor}.
         * @memberOf SelectionModel.prototype
         */
        this.columnSelectionModel = new RangeSelectionModel();

        //this.lastSelectionType = [];
        this.setLastSelectionType('');
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {*}
     */
    getLastSelection: function() {
        var sels = this.selections;
        var sel = sels[sels.length - 1];
        return sel;
    },

    /**
     * The most recent selection type. This is the TOS of `this.lastSelectionType`, the stack of unique selection types.
     *
     * Note that in the case where the only remaining previous selection of `type` was deselected, and `setLastSelectionType` was called with `reset` truthy, `type` is removed from the stack. If it was previously TOS, the TOS will now be what was the 2nd most recently pushed type (or nothing if no other selections).
     *
     * Returns empty string (`''`) if there are no selections.
     * @memberOf SelectionModel.prototype
     * @returns {*}
     */
    //getLastSelectionType: function(n) {
    //    return this.lastSelectionType[n || 0] || '';
    //},
    getLastSelectionType: function() {
        return this.lastSelectionType;
    },

    /**
     * Set the most recent selection's `type`. That is, push onto TOS of `this.lastSelectionType`, the stack of unique selection types. If already in the stack, move it to the top.
     *
     * If `reset` is truthy, remove the given `type` from the stack, regardless of where found therein (or not), thus "revealing" the 2nd most recently pushed type.
     *
     * @param {string} type - One of: `'cell'`, `'row'`, or `'column'`
     * @param {boolean} [reset=false] - Remove the given `type` from the stack. Specify truthy when the only remaining previous selection of `type` has been deselected.
     * @memberOf SelectionModel.prototype
     */
    /*setLastSelectionType: function(type, reset) {
        var i = this.lastSelectionType.indexOf(type);
        if (i === 0 && !reset) {
            return;
        }
        if (i >= 0) {
            this.lastSelectionType.splice(i, 1);
        }
        if (!reset) {
            this.lastSelectionType.unshift(type);
        }
    },*/
    setLastSelectionType: function(type) {
        this.lastSelectionType = type;
    },

    checkCellTop: function(x, y1) {
        var dm = this.grid.behavior.dataModel;
        if (dm.isRenderSkipNeeded(x, y1) && dm.getRowspan(x, y1 - 1) > 0) {
            // check if expand available
            var yOffset = y1;
            while (dm.isRenderSkipNeeded(x, yOffset) && yOffset > 0) {
                --yOffset;
            }
            y1 = yOffset;
        }
        return y1;
    },

    checkCellBottom: function(x, y2) {
        var span = this.grid.behavior.dataModel.getRowspan(x, y2);
        if (span > 0) {
            y2 += span; // just add rowspan if it available
        }
        return y2;
    },

    checkCellLeft: function(x1, y) {
        var dm = this.grid.behavior.dataModel;
        if (dm.isRenderSkipNeeded(x1, y) && dm.getColspan(x1 - 1, y) > 0) {
            // check if expand available
            var xOffset = x1;
            while (dm.isRenderSkipNeeded(xOffset, y) && xOffset > 0) {
                --xOffset;
            }
            x1 = xOffset;
        }
        return x1;
    },

    checkCellRight: function(x2, y) {
        var span = this.grid.behavior.dataModel.getColspan(x2, y);
        if (span > 0) {
            x2 += span; // just add colspan if it available
        }
        return x2;
    },

    checkSelectionCorners: function(ox, oy, ex, ey) {
        var x1 = ox,
            x2 = ox + ex,
            swapX = x1 > x2;
        var y1 = oy,
            y2 = oy + ey,
            swapY = y1 > y2;

        if (swapX) {
            x2 = [x1, x1 = x2][0];
        }
        if (swapY) {
            y2 = [y1, y1 = y2][0];
        }
        /*
        // check top cells
        for (var x = x1; x <= x2; ++x) {
            y1 = this.checkCellTop(x, y1);
        }

        // check bottom cells
        for (var _x = x1; _x <= x2; ++_x) {
            y2 = this.checkCellBottom(_x, y2);
        }

        // check left cells
        for (var y = y1; y <= y2; ++y) {
            x1 = this.checkCellLeft(x1, y);
        }

        // check right cells
        for (var _y = y1; _y <= y2; ++_y) {
            x2 = this.checkCellRight(x2, _y);
        }

        if (swapX) {
            x2 = [x1, x1 = x2][0];
        }
        if (swapY) {
            y2 = [y1, y1 = y2][0];
        }

        if (ox !== x1 || oy !== y1 || ex !== x2 - x1 || ey !== y2 - y1) {
            return this.checkSelectionCorners(x1, y1, x2 - x1, y2 - y1); // check one more time because of new included cells
        }
        */
        return { ox: x1, oy: y1, ex: x2 - x1, ey: y2 - y1 };
    },

    /**
     * @memberOf SelectionModel.prototype
     * @description Select the region described by the given coordinates.
     *
     * @param {number} ox - origin x coordinate
     * @param {number} oy - origin y coordinate
     * @param {number} ex - extent x coordinate
     * @param {number} ey - extent y coordinate
     * @param {boolean} silent - whether to fire selection changed event
     */
    /*select: function(ox, oy, ex, ey, silent) {
        var newSelection = new InclusiveRectangle(ox, oy, ex + 1, ey + 1);

        //Cache the first selected cell before it gets normalized to top-left origin
        newSelection.firstSelectedCell = this.grid.newPoint(ox, oy);

        newSelection.lastSelectedCell = (
            newSelection.firstSelectedCell.x === newSelection.origin.x &&
            newSelection.firstSelectedCell.y === newSelection.origin.y
        )
            ? newSelection.corner
            : newSelection.origin;

        if (this.grid.properties.multipleSelections) {
            this.selections.push(newSelection);
            this.flattenedX.push(newSelection.flattenXAt(0));
            this.flattenedY.push(newSelection.flattenYAt(0));
        } else {
            this.selections[0] = newSelection;
            this.flattenedX[0] = newSelection.flattenXAt(0);
            this.flattenedY[0] = newSelection.flattenYAt(0);
        }
        this.setLastSelectionType('cell');

        this.grid.selectionChanged(silent);
    },*/
    select: function(_ox, _oy, _ex, _ey, silent, hasSHIFT) {
        if (isNaN(_ex)) {
            _ex = 0;
        }
        if (isNaN(_ey)) {
            _ey = 0;
        }

        var _checkSelectionCorner = this.checkSelectionCorners(_ox, _oy, _ex, _ey),
            ox = _checkSelectionCorner.ox,
            oy = _checkSelectionCorner.oy,
            ex = _checkSelectionCorner.ex,
            ey = _checkSelectionCorner.ey;

        var newSelection = this.grid.newRectangle(ox, oy, ex, ey);

        //Cache the first selected cell before it gets normalized to top-left origin
        //newSelection.firstSelectedCell = this.grid.newPoint(this.checkCellLeft(_ox, _oy), this.checkCellTop(_ox, _oy));
        if (hasSHIFT && (this.grid.getMouseDown().x !== -1 || this.grid.getMouseDown().y !== -1)){
            newSelection.firstSelectedCell = this.grid.newPoint(this.grid.getMouseDown().x, this.grid.getMouseDown().y);
        }else{
            newSelection.firstSelectedCell = this.grid.newPoint(this.checkCellLeft(_ox, _oy), this.checkCellTop(_ox, _oy));
        }
        newSelection.lastSelectedCell = newSelection.firstSelectedCell.x === newSelection.origin.x && newSelection.firstSelectedCell.y === newSelection.origin.y ? newSelection.corner : newSelection.origin;

        if (this.grid.properties.multipleSelections) {
            this.selections.push(newSelection);
            this.flattenedX.push(newSelection.flattenXAt(0));
            this.flattenedY.push(newSelection.flattenYAt(0));
        } else {
            this.selections[0] = newSelection;
            this.flattenedX[0] = newSelection.flattenXAt(0);
            this.flattenedY[0] = newSelection.flattenYAt(0);
        }
        this.setLastSelectionType('cell');

        if (!silent) {
            this.grid.selectionChanged();
        }
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param {number} ox - origin x coordinate
     * @param {number} oy - origin y coordinate
     * @param {number} ex - extent x coordinate
     * @param {number} ey - extent y coordinate
     */
    toggleSelect: function(ox, oy, ex, ey) {

        var index = this.selections.findIndex(function(selection) {
            return (
                selection.origin.x === ox && selection.origin.y === oy &&
                selection.extent.x === ex && selection.extent.y === ey
            );
        });

        if (index >= 0) {
            this.selections.splice(index, 1);
            this.flattenedX.splice(index, 1);
            this.flattenedY.splice(index, 1);
            this.setLastSelectionType('cell', !this.selections.length);
            this.grid.selectionChanged();
        } else {
            this.select(ox, oy, ex, ey);
        }
    },

    /**
     * @memberOf SelectionModel.prototype
     * @desc Remove the last selection that was created.
     */
    clearMostRecentSelection: function(keepRowSelections) {
        if (!keepRowSelections) {
            this.setAllRowsSelected(false);
        }
        if (this.selections.length) { --this.selections.length; }
        if (this.flattenedX.length) { --this.flattenedX.length; }
        if (this.flattenedY.length) { --this.flattenedY.length; }
        this.setLastSelectionType('cell', !this.selections.length);
        //this.getGrid().selectionChanged();
    },

    selectionModelClearMostRecent: function selectionModelClearMostRecent(selectionModel) {
        selectionModel.clearMostRecentSelection();
        this.clearMostRecentSelection();
    },

    /**
     * @memberOf SelectionModel.prototype
     */
    clearMostRecentColumnSelection: function() {
        //this.columnSelectionModel.clearMostRecentSelection();
        //this.setLastSelectionType('column', !this.columnSelectionModel.selection.length);
        this.selectionModelClearMostRecent(this.columnSelectionModel);
        this.setLastSelectionType('column');
    },

    clearColumnSelection: function() {
        this.clear();
        this.setLastSelectionType('column');
    },

    /**
     * @memberOf SelectionModel.prototype
     */
    clearMostRecentRowSelection: function() {
        //this.rowSelectionModel.clearMostRecentSelection();
        //this.setLastSelectionType('row', !this.rowSelectionModel.selection.length);
        this.selectionModelClearMostRecent(this.rowSelectionModel);
        this.setLastSelectionType('row');
    },

    /**
     * @memberOf SelectionModel.prototype
     */
    clearRowSelection: function() {
        //this.rowSelectionModel.clear();
        //this.setLastSelectionType('row', !this.rowSelectionModel.selection.length);
        this.rowSelectionModel.clear();
        this.setLastSelectionType('row');
    },

    _clearRowSelection: function() {
        this.clear();
        this.setLastSelectionType('row');
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {*}
     */
    getSelections: function() {
        return this.selections;
    },

    setCopyArea: function() {
        if (this.hasSelections()) {
            var lastSelection = this.getLastSelection();
            /*var _checkSelectionCorner = this.checkSelectionCorners(lastSelection.firstSelectedCell.x, lastSelection.firstSelectedCell.y,
                lastSelection.lastSelectedCell.x - lastSelection.firstSelectedCell.x, lastSelection.lastSelectedCell.y - lastSelection.firstSelectedCell.y),
                ox = _checkSelectionCorner.ox,
                oy = _checkSelectionCorner.oy,
                ex = _checkSelectionCorner.ex,
                ey = _checkSelectionCorner.ey;*/
            var ox = lastSelection.origin.x,
                oy = lastSelection.origin.y,
                ex = lastSelection.corner.x - lastSelection.origin.x,
                ey = lastSelection.corner.y - lastSelection.origin.y;

            var newCopyArea = this.grid.newRectangle(ox, oy, ex, ey);
            newCopyArea.firstSelectedCell = this.grid.newPoint(this.checkCellLeft(lastSelection.firstSelectedCell.x, lastSelection.firstSelectedCell.y), this.checkCellTop(lastSelection.firstSelectedCell.x, lastSelection.firstSelectedCell.y));
            newCopyArea.lastSelectedCell = newCopyArea.firstSelectedCell.x === newCopyArea.origin.x && newCopyArea.firstSelectedCell.y === newCopyArea.origin.y ? newCopyArea.corner : newCopyArea.origin;

            this.copyArea = newCopyArea;
        }
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {boolean} There are active selection(s).
     */
    hasSelections: function() {
        return this.selections.length !== 0;
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {boolean}
     */
    hasRowSelections: function() {
        return !this.rowSelectionModel.isEmpty();
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {boolean}
     */
    hasColumnSelections: function() {
        return !this.columnSelectionModel.isEmpty();
    },

    /**
     * @memberOf SelectionModel.prototype
     * @return {boolean} Selection covers a specific column.
     * @param {number} y
     */
    isCellSelectedInRow: function(y) {
        return this._isCellSelected(this.flattenedX, 0, y);
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns Selection covers a specific row.
     * @param {number} x
     */
    isCellSelectedInColumn: function(x) {
        return this._isCellSelected(this.flattenedY, x, 0);
    },

    /**
     * @memberOf SelectionModel.prototype
     * @summary Selection query function.
     * @returns {boolean} The given cell is selected (part of an active selection).
     * @param {Rectangle[]} selections - Selection rectangles to search through.
     * @param {number} x
     * @param {number} y
     */
    isSelected: function(x, y) {
        return (
            this.isColumnSelected(x) ||
            this.isRowSelected(y) ||
            this._isCellSelected(this.selections, x, y)
        );
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param x
     * @param y
     * @returns {*}
     */
    isCellSelected: function(x, y) {
        return this._isCellSelected(this.selections, x, y);
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param selections
     * @param x
     * @param y
     * @returns {boolean}
     * @private
     */
    _isCellSelected: function(selections, x, y) {
        var self = this;
        return !!selections.find(function(selection) {
            return self.rectangleContains(selection, x, y);
        });
    },

    /**
     * @memberOf SelectionModel.prototype
     * @desc empty out all our state
     *
     */
    clear: function(keepRowSelections) {
        this.selections.length = 0;
        this.flattenedX.length = 0;
        this.flattenedY.length = 0;
        this.columnSelectionModel.clear();
        if (!keepRowSelections) {
            //this.lastSelectionType.length = 0;
            this.setAllRowsSelected(false);
            this.rowSelectionModel.clear();
        } else if (this.lastSelectionType.indexOf('row') >= 0) {
            this.lastSelectionType = ['row'];
        } else {
            this.lastSelectionType.length = 0;
        }
        //this.getGrid().selectionChanged();
    },

    clearCopyArea: function() {
        this.copyArea = null;
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param {number} ox - origin x coordinate
     * @param {number} oy - origin y coordinate
     * @param {number} ex - extent x coordinate
     * @param {number} ey - extent y coordinate
     * @returns {boolean}
     */
    isRectangleSelected: function(ox, oy, ex, ey) {
        return !!this.selections.find(function(selection) {
            return (
                selection.origin.x === ox && selection.origin.y === oy &&
                selection.extent.x === ex && selection.extent.y === ey
            );
        });
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param x
     * @returns {*}
     */
    isColumnSelected: function(x) {
        return this.columnSelectionModel.isSelected(x);
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param y
     * @returns {boolean|*}
     */
    isRowSelected: function(y) {
        return this.allRowsSelected || this.rowSelectionModel.isSelected(y);
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param x1
     * @param x2
     */
    selectColumn: function(x1, x2, hasSHIFT) {
        //this.columnSelectionModel.select(x1, x2);
        //this.setLastSelectionType('column', !this.columnSelectionModel.selection.length);
        if (x2 === undefined) {
            x2 = x1;
        }

        // Not allow to select first column (-2)
        x2 = Math.max(-1,x2);

        // rewrite if merged cells will be not first cell in row
        if (x1 <= x2) {
            x1 = this.checkCellLeft(x1, 0);
            x2 = this.checkCellRight(x2, 0);
        } else {
            x1 = this.checkCellRight(x1, 0);
            x2 = this.checkCellLeft(x2, 0);
        }

        this.columnSelectionModel.select(x1, x2);
        this.select(x1, 0, x2 - x1, this.grid.getRowCount() - 1, false, hasSHIFT);
        this.grid.selectColDefsForApi();
        this.setLastSelectionType('column');
    },

    /**
     * @memberOf SelectionModel.prototype
     */
    selectAllRows: function() {
        this.clear();
        this.setAllRowsSelected(true);
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {boolean}
     */

    setAllRowsSelected: function(isIt) {
        this.allRowsSelected = isIt;
        if (isIt) {
            var x = this.grid.behavior.dataModel.isTree() ? -1 : 0;
            this.select(x, 0, this.grid.getColumnCount() - 1, this.grid.getRowCount() - 1);
        }
    },

    areAllRowsSelected: function() {
        return this.allRowsSelected;
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param y1
     * @param y2
     */
    selectRow: function(y1, y2, hasSHIFT) {
        //this.rowSelectionModel.select(y1, y2);
        //this.setLastSelectionType('row', !this.rowSelectionModel.selection.length);
        if (y2 === undefined) {
            y2 = y1;
        }

        // rewrite if merged cells will be not first cell in row
        if (y1 <= y2) {
            y1 = this.checkCellTop(0, y1);
            y2 = this.checkCellBottom(0, y2);
        } else {
            y1 = this.checkCellBottom(0, y1);
            y2 = this.checkCellTop(0, y2);
        }

        this.rowSelectionModel.select(y1, y2);
        var x = this.grid.behavior.dataModel.isTree() ? -1 : 0;
        this.select(x, y1, this.grid.getColumnCount() - 1, y2 - y1, false, hasSHIFT);
        this.grid.selectColDefsForApi();
        this.setLastSelectionType('row');
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param x1
     * @param x2
     */
    deselectColumn: function(x1, x2) {
        //this.columnSelectionModel.deselect(x1, x2);
        //this.setLastSelectionType('column', !this.columnSelectionModel.selection.length);
        this.columnSelectionModel.deselect(x1, x2);
        this.setLastSelectionType('column');
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param y1
     * @param y2
     */
    deselectRow: function(y1, y2) {
        if (this.areAllRowsSelected()) {
            // To deselect a row, we must first remove the all rows flag...
            this.setAllRowsSelected(false);
            // ...and create a single range representing all rows
            this.rowSelectionModel.select(0, this.grid.getRowCount() - 1);
        }
        this.rowSelectionModel.deselect(y1, y2);
        //this.setLastSelectionType('row', !this.rowSelectionModel.selection.length);
        this.setLastSelectionType('row');
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {*}
     */
    getSelectedRows: function() {
        if (this.areAllRowsSelected()) {
            var rowCount = this.grid.getRowCount();
            var result = new Array(rowCount);
            for (var i = 0; i < rowCount; i++) {
                result[i] = i;
            }
            return result;
        }
        return this.rowSelectionModel.getSelections();
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {*|Array.Array.number}
     */
    getSelectedColumns: function() {
        return this.columnSelectionModel.getSelections();
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {boolean}
     */
     isColumnOrRowSelected: function() {
        return !this.columnSelectionModel.isEmpty() || !this.rowSelectionModel.isEmpty();
    },

    /**
     * @memberOf SelectionModel.prototype
     * @returns {Array}
     */
    getFlattenedYs: function() {
        var result = [];
        var set = {};
        this.selections.forEach(function(selection) {
            var top = selection.origin.y;
            var size = selection.height;
            for (var r = 0; r < size; r++) {
                var ti = r + top;
                if (!set[ti]) {
                    result.push(ti);
                    set[ti] = true;
                }
            }
        });
        result.sort(function(x, y) {
            return x - y;
        });
        return result;
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param offset
     */
    selectRowsFromCells: function(offset, keepRowSelections) {
        offset = offset || 0;

        var sm = this.rowSelectionModel;

        if (!keepRowSelections) {
            this.setAllRowsSelected(false);
            sm.clear();
        }

        this.selections.forEach(function(selection) {
            var top = selection.origin.y,
                extent = selection.extent.y;
            top += offset;
            sm.select(top, top + extent);
        });
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param offset
     */
    selectColumnsFromCells: function(offset) {
        offset = offset || 0;

        var sm = this.columnSelectionModel;
        sm.clear();

        this.selections.forEach(function(selection) {
            var left = selection.origin.x,
                extent = selection.extent.x;
            left += offset;
            sm.select(left, left + extent);
        });
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param x
     * @param y
     * @returns {*}
     */
    isInCurrentSelectionRectangle: function(x, y) {
        //var last = this.getLastSelection();
        var last = this.selections[this.selections.length - 1];
        return last && this.rectangleContains(last, x, y);
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param x
     * @param y
     * @returns {*}
     */
    isFirstSelectedCell: function(x, y) {
        var firstSelectedCell = this.getFirstSelectedCellOfLastSelection();
        return firstSelectedCell && firstSelectedCell.x === x && firstSelectedCell.y === y;
    },

    /**
     * @memberOf SelectionModel.prototype
     * @desc Returns first selected cell of last selection
     * @returns {*}
     */
    getFirstSelectedCellOfLastSelection: function() {
        var last = this.selections[this.selections.length - 1];
        if (last) {
            return last.firstSelectedCell;
        }
    },

    /**
     * @memberOf SelectionModel.prototype
     * @param rect
     * @param x
     * @param y
     * @returns {boolean}
     */
    rectangleContains: function(rect, x, y) { //TODO: explore why this works and contains on rectanglular does not
        var minX = rect.origin.x;
        var minY = rect.origin.y;
        var maxX = minX + rect.extent.x;
        var maxY = minY + rect.extent.y;

        if (rect.extent.x < 0) {
            minX = maxX;
            maxX = rect.origin.x;
        }

        if (rect.extent.y < 0) {
            minY = maxY;
            maxY = rect.origin.y;
        }

        var result =
            x >= minX &&
            y >= minY &&
            x <= maxX &&
            y <= maxY;

        return result;
    }
};

module.exports = SelectionModel;
