'use strict';

var Feature = require('./Feature');

/**
 * @constructor
 */
var RowSelection = Feature.extend('RowSelection', {

    /**
     * The pixel location of the mouse pointer during a drag operation.
     * @type {Point}
     * @default null
     * @memberOf RowSelection.prototype
     */
    currentDrag: null,

    /**
     * The cell coordinates of the where the mouse pointer is during a drag operation.
     * @type {Object}
     * @default null
     * @memberOf RowSelection.prototype
     */
    lastDragCell: null,

    /**
     * a millisecond value representing the previous time an autoscroll started
     * @type {number}
     * @default 0
     * @memberOf RowSelection.prototype
     */
    sbLastAuto: 0,

    /**
     * a millisecond value representing the time the current autoscroll started
     * @type {number}
     * @default 0
     * @memberOf RowSelection.prototype
     */
    sbAutoStart: 0,

    dragArmed: false,

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseUp: function(grid, event) {
        if (this.dragArmed) {
            this.dragArmed = false;
            moveCellSelection(grid);
            grid.fireSyntheticRowSelectionChangedEvent();
        } else if (this.dragging) {
            this.dragging = false;
            moveCellSelection(grid);
            grid.fireSyntheticRowSelectionChangedEvent();
        } else if (this.next) {
            this.next.handleMouseUp(grid, event);
        }
    },

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDown: function(grid, event) {
        var leftClick = !event.primitiveEvent.detail.isRightClick,
            rowNumberClick = leftClick &&
                grid.properties.showRowNumbers &&
                event.isHandleColumn &&
                event.mousePointInClickRect;

        if (rowNumberClick && !grid.fireSyntheticRowHeaderClickedEvent(event)) {
            return;
        }

        var rowSelectable = grid.properties.rowSelection && (leftClick && grid.properties.autoSelectRows || rowNumberClick);

        if (rowSelectable && event.isHeaderHandle) {
            //global row selection
            grid.toggleSelectAllRows();
            grid.api.update_lasso_selections();
        } else if (rowSelectable && event.isDataRow)  {
            // if we are in the fixed area, do not apply the scroll values
            this.dragArmed = true;
            this.extendSelection(grid, event.dataCell.y, event.primitiveEvent.detail.keys);
        } else if (this.next) {
            this.next.handleMouseDown(grid, event);
        }
    },

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDrag: function(grid, event) {
        if (
            this.dragArmed &&
            grid.properties.rowSelection &&
            !event.primitiveEvent.detail.isRightClick
        ) {
            //if we are in the fixed area do not apply the scroll values
            this.lastDragRow = event.dataCell.y;
            this.dragging = true;
            this.currentDrag = event.primitiveEvent.detail.mouse;
            this.checkDragScroll(grid, this.currentDrag);
            this.handleMouseDragCellSelection(grid, this.lastDragRow, event.primitiveEvent.detail.keys);
        } else if (this.next) {
            this.next.handleMouseDrag(grid, event);
        }
    },

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleKeyDown: function(grid, event) {
        var handler;

        if ((event.detail.primitiveEvent.ctrlKey && event.detail.primitiveEvent.keyCode === 57)
            || (event.detail.primitiveEvent.metaKey && event.detail.primitiveEvent.keyCode === 57)) {

            // Prevent default browser's command-9
            event.detail.primitiveEvent.preventDefault();
        }

        if (
            grid.getLastSelectionType() === 'row' &&
            (handler = this['handle' + event.detail.char])
        ) {
            handler.call(this, grid, event.detail);
        } else if (this.next) {
            this.next.handleKeyDown(grid, event);
        }
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc Handle a mousedrag selection
     * @param {Hypergrid} grid
     * @param {Object} mouse - the event details
     * @param {Array} keys - array of the keys that are currently pressed down
     */
    handleMouseDragCellSelection: function(grid, y, keys) {
        var mouseY = grid.getMouseDown().y;

        grid.clearMostRecentRowSelection();

        grid.selectRow(mouseY, y);
        grid.setDragExtent(grid.newPoint(0, y - mouseY));

        /*var selectedRows = grid.getSelectedRowsGroup(y, true);
        var firstR = selectedRows.first;
        var lastR = selectedRows.last;
        grid._clearRowSelection();
        for (var fi in firstR){
            if (firstR[fi].length > 0){
                grid.selectRow(firstR[fi][0], firstR[fi][firstR[fi].length - 1]);
            }
        }
        if (lastR.length > 0){
            grid.selectRow(lastR[0], lastR[lastR.length - 1]);
        }*/

        grid.repaint();
        grid.api.update_lasso_selections();
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc this checks while were dragging if we go outside the visible bounds, if so, kick off the external autoscroll check function (above)
     * @param {Hypergrid} grid
     * @param {Object} mouse - the event details
     */
    checkDragScroll: function(grid, mouse) {
        if (
            grid.properties.scrollingEnabled &&
            grid.getDataBounds().contains(mouse)
        ) {
            if (grid.isScrollingNow()) {
                grid.setScrollingNow(false);
            }
        } else {
            if (!grid.isScrollingNow()) {
                grid.setScrollingNow(true);
                this.scrollDrag(grid);
            }
        }
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc this function makes sure that while we are dragging outside of the grid visible bounds, we srcroll accordingly
     * @param {Hypergrid} grid
     */
    scrollDrag: function(grid) {
        if (!grid.isScrollingNow()) {
            return;
        }

        var b = grid.getDataBounds(),
            yOffset;

        if (this.currentDrag.y < b.origin.y) {
            yOffset = -1;
        } else if (this.currentDrag.y > b.origin.y + b.extent.y) {
            yOffset = 1;
        }

        if (yOffset) {
            if (this.lastDragRow >= grid.getFixedRowCount()) {
                this.lastDragRow += yOffset;
            }
            grid.scrollBy(0, yOffset);
        }

        this.handleMouseDragCellSelection(grid, this.lastDragRow, []); // update the selection
        grid.repaint();
        setTimeout(this.scrollDrag.bind(this, grid), 25);
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc extend a selection or create one if there isnt yet
     * @param {Hypergrid} grid
     * @param {Object} gridCell - the event details
     * @param {Array} keys - array of the keys that are currently pressed down
     */
    extendSelection: function(grid, y, keys) {
        if (!grid.abortEditing()) { return; }

        var mouseY = grid.getMouseDown().y,
            hasSHIFT = keys.indexOf('SHIFT') !== -1;
        var hasCTRL = keys.indexOf('CTRL') >= 0 || keys.indexOf('COMMANDLEFT') >= 0 || keys.indexOf('COMMANDRIGHT') >= 0;

        if (hasSHIFT && mouseY == -1){
            grid.setMouseDown(grid.newPoint(0, y));
            mouseY = grid.getMouseDown().y;
        }

        if (y < 0) { // outside of the grid?
            return; // do nothing
        }

        if (hasSHIFT) {
            grid.clearMostRecentRowSelection();
            grid.selectRow(y, mouseY, hasSHIFT);
            grid.setDragExtent(grid.newPoint(0, y - mouseY));
        }else if(hasCTRL){
            /*var selectedCs = grid.getSelectedRows() || [];
            selectedCs.push(y);
            selectedCs = selectedCs.sort((a, b) => a - b);
            var y1 = undefined;
            var arr = [];
            var firstR = [];
            var lastR = [];
            for (var ic in selectedCs){
                if (y1 == undefined){
                    y1 = selectedCs[ic];
                    arr.push(y1);
                }

                if (selectedCs[ic] == y1){
                    // ignore
                }else if (selectedCs[ic] - y1 == 1){
                    y1 = selectedCs[ic];
                    arr.push(y1);
                }else{
                    if(arr.includes(y)){
                        lastR = arr;
                    }else{
                        firstR.push(arr);
                    }

                    arr = [];
                    y1 = selectedCs[ic];
                    arr.push(y1);
                }
            }

            if (arr.length > 0){
                if(arr.includes(y)){
                    lastR = arr;
                }else{
                    firstR.push(arr);
                }
            }*/

            var selectedRows = grid.getSelectedRowsGroup(y);
            var firstR = selectedRows.first;
            var lastR = selectedRows.last;

            //grid.selectRow(y);
            grid._clearRowSelection();
            for (var fi in firstR){
                if (firstR[fi].length > 0){
                    grid.selectRow(firstR[fi][0], firstR[fi][firstR[fi].length - 1]);
                }
            }
            if (lastR.length > 0){
                grid.selectRow(lastR[0], lastR[lastR.length - 1]);
            }
            grid.setMouseDown(grid.newPoint(0, y));

            //grid.setDragExtent(grid.newPoint(0, y - mouseY));
        }else {
            grid.toggleSelectRow(y, keys);
            grid.setMouseDown(grid.newPoint(0, y));
            grid.setDragExtent(grid.newPoint(0, 0));
        }

        grid.repaint();
        grid.api.update_lasso_selections();
    },


    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     */
    handleDOWNSHIFT: function(grid) {
        this.moveShiftSelect(grid, 1);
    },

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleUPSHIFT: function(grid) {
        this.moveShiftSelect(grid, -1);
    },

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleLEFTSHIFT: function(grid) {},

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleRIGHTSHIFT: function(grid) {},

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleDOWN: function(grid) {
        this.moveSingleSelect(grid, 1);
    },

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleUP: function(grid) {
        this.moveSingleSelect(grid, -1);
    },

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleLEFT: function(grid) {},

    /**
     * @memberOf RowSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleRIGHT: function(grid) {
        console.log('---row---handle right------');
        var mouseCorner = grid.getMouseDown().plus(grid.getDragExtent()),
            maxColumns = grid.getColumnCount() - 1,
            newX = grid.getHScrollValue(),
            newY = mouseCorner.y;

        newX = Math.min(maxColumns, newX);

        grid.clearSelections();
        grid.select(newX, newY, 0, 0);
        grid.setMouseDown(grid.newPoint(newX, newY));
        grid.setDragExtent(grid.newPoint(0, 0));

        grid.repaint();
    },

    handle9: async function(grid, detail) {
        if (!detail || !detail.primitiveEvent){
            return;
        }

        if ((detail.primitiveEvent.ctrlKey && detail.primitiveEvent.keyCode === 57)
            || (detail.primitiveEvent.metaKey && detail.primitiveEvent.keyCode === 57)) {

            var is_row_pivot = grid.behavior.dataModel.isRowPivot();
            var is_column_pivot = grid.behavior.dataModel.isColumnPivot();
            var is_value_pivot = grid.behavior.dataModel.is_value_pivot();

            var selected_rows = grid.getSelectedRows() || [];
            var selected_values = [];

            var c_i = -1;
            var is_agg_row = is_row_pivot || is_column_pivot || is_value_pivot;

            if (is_agg_row){
              // The column index of the __ROW_PATH__
              c_i = 0;
            }else{
              if (!grid.behavior.dataModel._viewer.pk){
                  return;
              }
              var colDef = grid.columnDefs;
              c_i = colDef.findIndex(function(item){
                  return item.originalName == grid.behavior.dataModel._viewer.pk;
              });
            }

            var v;
            for (var i = 0; i < selected_rows.length; i++){
                // Ignore header
                if (selected_rows[i] > 0){
                    v = grid.behavior.getValue(c_i, selected_rows[i]);
                    if (v && v !== ""){
                      if (is_agg_row){
                        if (v.rowPath && v.rowPath.length > 0){
                          selected_values.push(v.rowPath);
                        }
                      }else{
                        selected_values.push(v);
                      }
                    }else{
                        var force_primary = c_i == -1 ? true: false;
                        var val = await grid.behavior.dataModel.pspFetchDataCellValue({
                            start_col: c_i,
                            end_col: c_i + 1,
                            start_row: selected_rows[i],
                            end_row: selected_rows[i] + 1
                          }, force_primary);

                          if (val){
                            if (is_agg_row){
                              if (val.rowPath && val.rowPath.length > 0){
                                  selected_values.push(val.rowPath);
                              }
                            }else if (
                                (typeof val === "string" && val !== "" && val.length < 200)
                                || typeof val === "number"
                                || typeof val === "boolean"){
                                selected_values.push(val);
                            }
                          }
                    }
                }
            }

            grid.behavior.dataModel._viewer.did_hide_rows(selected_values, is_agg_row);
        }
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc If we are holding down the same navigation key, accelerate the increment we scroll
     * #### returns: integer
     */
    getAutoScrollAcceleration: function() {
        var count = 1;
        var elapsed = this.getAutoScrollDuration() / 2000;
        count = Math.max(1, Math.floor(elapsed * elapsed * elapsed * elapsed));
        return count;
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc set the start time to right now when we initiate an auto scroll
     */
    setAutoScrollStartTime: function() {
        this.sbAutoStart = Date.now();
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc update the autoscroll start time if we haven't autoscrolled within the last 500ms otherwise update the current autoscroll time
     */
    pingAutoScroll: function() {
        var now = Date.now();
        if (now - this.sbLastAuto > 500) {
            this.setAutoScrollStartTime();
        }
        this.sbLastAuto = Date.now();
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc answer how long we have been auto scrolling
     * #### returns: integer
     */
    getAutoScrollDuration: function() {
        if (Date.now() - this.sbLastAuto > 500) {
            return 0;
        }
        return Date.now() - this.sbAutoStart;
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc Augment the most recent selection extent by (offsetX,offsetY) and scroll if necessary.
     * @param {Hypergrid} grid
     * @param {number} offsetX - x coordinate to start at
     * @param {number} offsetY - y coordinate to start at
     */
    moveShiftSelect: function(grid, offsetY) {
       this.moveSingleSelect(grid, offsetY, true);
    },

    /**
     * @memberOf RowSelection.prototype
     * @desc Replace the most recent row selection with a single cell row selection `offsetY` rows from the previous selection.
     * @param {Hypergrid} grid
     * @param {number} offsetY - y coordinate to start at
     */
    moveSingleSelect: function(grid, offsetY, shift) {
        var selections = grid.selectionModel.rowSelectionModel.selection,
            lastSelection = selections[selections.length - 1],
            top = lastSelection[0],
            bottom = lastSelection[1];

        if (shift) {
            var firstOffsetY = lastSelection.offsetY = lastSelection.offsetY || offsetY;
            if (lastSelection.offsetY < 0) {
                top += offsetY;
            } else {
                bottom += offsetY;
            }
        } else {
            top += offsetY;
            bottom += offsetY;
        }

        if (top < 0 || bottom >= grid.getRowCount()) {
            return;
        }

        selections.length -= 1;
        if (selections.length) {
            lastSelection = selections[selections.length - 1];
            delete lastSelection.offsetY;
        }
        grid.selectRow(top, bottom);
        if (shift && top !== bottom) {
            lastSelection = selections[selections.length - 1];
            lastSelection.offsetY = firstOffsetY;
        }

        grid.setMouseDown(grid.newPoint(0, top));
        grid.setDragExtent(grid.newPoint(0, bottom - top));

        grid.scrollToMakeVisible(grid.properties.fixedColumnCount, offsetY < 0 ? top : bottom + 1); // +1 for partial row

        moveCellSelection(grid);
        grid.fireSyntheticRowSelectionChangedEvent();
        grid.repaint();
    },

    isSingleRowSelection: function() {
        return true;
    }

});

function moveCellSelection(grid) {
    var rows;

    if (
        grid.properties.collapseCellSelections &&
        grid.properties.singleRowSelectionMode && // let's only attempt this when in this mode
        !grid.properties.multipleSelections && // and only when in single selection mode
        (rows = grid.getSelectedRows()).length && // user just selected a row (must be single row due to mode we're in)
        grid.selectionModel.getSelections().length  // there was a cell region selected (must be the only one)
    ) {
        var rect = grid.selectionModel.getLastSelection(), // the only cell selection
            x = rect.left,
            y = rows[0], // we know there's only 1 row selected
            width = rect.right - x,
            height = 0, // collapse the new region to occupy a single row
            fireSelectionChangedEvent = false;

        grid.selectionModel.select(x, y, width, height, fireSelectionChangedEvent);
        grid.repaint();
    }
}

module.exports = RowSelection;
