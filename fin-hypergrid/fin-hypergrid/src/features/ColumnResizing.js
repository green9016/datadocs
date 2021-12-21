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

    drag_multiple_col_width: [],

    /**
     * @memberOf ColumnResizing.prototype
     * @desc get the mouse x,y coordinate
     * @returns {number}
     * @param {MouseEvent} event - the mouse event to query
     */
    getMouseValue: function(event) {
        return event.primitiveEvent.detail.mouse.x;
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @desc returns the index of which divider I'm over
     * @returns {number}
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    overAreaDivider: function(grid, event) {
        var leftMostColumnIndex = grid.behavior.leftMostColIndex;
        var ratio = grid.behavior.dataModel.getZoomRatio();
        return event.gridCell.x !== leftMostColumnIndex && event.mousePoint.x <= 3 ||
            event.mousePoint.x >= (event.bounds.width - 3) * ratio;
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @desc return the cursor name
     * @returns {string}
     */
    getCursorName: function() {
        return 'col-resize';
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDrag: function(grid, event) {
        if (this.dragColumn) {
            var ratio = grid.behavior.dataModel.getZoomRatio(),
                delta = (this.getMouseValue(event) - this.dragStart)/ratio,
                dragWidth = this.dragStartWidth + delta,
                nextWidth = this.nextStartWidth - delta;

            let drag_original_name;
            let drag_schema_header;

            if (this.dragColumn.colDef){
              drag_original_name = this.dragColumn.colDef.originalName;
            }else if(this.dragColumn.schema && this.dragColumn.schema.header){
              drag_schema_header = this.dragColumn.schema.header;
            }

            let resize_multiple_fields = false;
            let nb_of_selected_cols;

            if (this.drag_multiple_col_width && this.drag_multiple_col_width.length > 0){

              for (let i = 0; i < this.drag_multiple_col_width.length; i++){
                if ((drag_original_name && this.drag_multiple_col_width[i].original_name === drag_original_name)
                  || (drag_schema_header && this.drag_multiple_col_width[i].schema_header === drag_schema_header)){
                    resize_multiple_fields = true;

                    // Only need to count the selected columns from left side
                    nb_of_selected_cols = i + 1;
                    break;
                }

              }

            }

            let arr_col_width = [];

            if (resize_multiple_fields === true){
              /*
              arr_col_width = this.drag_multiple_col_width.map((v)=>{
                v.user_width = v.drag_start_width + delta/nb_of_selected_cols;
                return v;
              });
              */
              // Make sure the column's width is not less than min-width
              arr_col_width = this.drag_multiple_col_width.map((v)=>{
                if (v.original_name && v.original_name === "__ROW_PATH__"){
                  const min_width = this.dragColumn.dataModel.getMaxTreeSpace() + 30;
                  if (v.drag_start_width + delta/nb_of_selected_cols < min_width){
                    v.user_width = min_width;
                  }else{
                    v.user_width = Math.max(v.drag_start_width + delta/nb_of_selected_cols, grid.properties.minimumColumnWidth);
                  }
                }else{
                  v.user_width = Math.max(v.drag_start_width + delta/nb_of_selected_cols, grid.properties.minimumColumnWidth);
                }

                return v;
              });

            }

            if (this.dragColumn.colDef && this.dragColumn.colDef.isTree){
                // Add tree columns's minWidth to settings later
                dragWidth = Math.max(dragWidth, this.dragColumn.dataModel.getMaxTreeSpace() + 30);
            }
            if (!this.nextColumn) { // nextColumn et al instance vars defined when resizeColumnInPlace (by handleMouseDown)
              if (resize_multiple_fields === true){
                grid.behavior.set_multiple_col_width(arr_col_width);
              }else{
                grid.behavior.setColumnWidth(this.dragColumn, dragWidth);
              }
            } else {
                var np = this.nextColumn.properties, dp = this.dragColumn.properties;
                if (
                    0 < delta && delta <= (this.nextStartWidth - np.minimumColumnWidth) &&
                    (!dp.maximumColumnWidth || dragWidth <= dp.maximumColumnWidth)
                    ||
                    0 > delta && delta >= -(this.dragStartWidth - dp.minimumColumnWidth) &&
                    (!np.maximumColumnWidth || nextWidth < np.maximumColumnWidth)
                ) {
                    grid.behavior.setColumnWidth(this.dragColumn, dragWidth);
                    grid.behavior.setColumnWidth(this.nextColumn, nextWidth);
                }
            }
        } else if (this.next) {
            this.next.handleMouseDrag(grid, event);
        }
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDown: function(grid, event) {
        if (event.isHeaderRow && this.overAreaDivider(grid, event)) {
            var gridColumnIndex = event.gridCell.x;

            var columns = grid.behavior.columns;
            let selected_columns = grid.getSelectedColumns() || [];
            let arr_drag_width = [];

            const is_all_cols = grid.selectionModel.areAllRowsSelected();

            if (is_all_cols === true){
              for (let i = 0; i < columns.length; i++){

                const d_start_width = columns[i].getWidth() + (grid.properties.gridLinesV ? grid.properties.gridLinesWidth : 0);

                arr_drag_width.push({original_name: columns[i].colDef
                    ? columns[i].colDef.originalName: undefined,
                    index: i,
                    drag_start_width: Math.ceil(d_start_width),
                    schema_header: columns[i].schema ? columns[i].schema.header: undefined});
              }
            }else{
              for (let i = 0; i < selected_columns.length; i++){
                if (!columns[selected_columns[i]]){
                  continue;
                }

                const d_start_width = columns[selected_columns[i]].getWidth() + (grid.properties.gridLinesV ? grid.properties.gridLinesWidth : 0);

                arr_drag_width.push({original_name: columns[selected_columns[i]].colDef
                    ? columns[selected_columns[i]].colDef.originalName: undefined,
                    index: selected_columns[i],
                    drag_start_width: Math.ceil(d_start_width),
                    schema_header: columns[selected_columns[i]].schema ? columns[selected_columns[i]].schema.header: undefined});
              }
            }

            if (event.mousePoint.x <= 3) {
                gridColumnIndex -= 1;
                var vc = grid.renderer.visibleColumns[gridColumnIndex] ||
                    grid.renderer.visibleColumns[gridColumnIndex - 1]; // get row number column if tree column undefined
                for (var idx in grid.renderer.visibleColumns) {
                    if (grid.renderer.visibleColumns[idx] && gridColumnIndex == grid.renderer.visibleColumns[idx].columnIndex) {
                        vc = grid.renderer.visibleColumns[idx];
                        break;
                    }
                }
                if (vc) {
                    this.dragColumn = vc.column;
                    this.dragStartWidth = vc.width;
                    this.drag_multiple_col_width = arr_drag_width;

                } else {
                    return; // can't drag left-most column boundary
                }
            } else {
                this.dragColumn = event.column;
                this.dragStartWidth = event.bounds.width;
                this.drag_multiple_col_width = arr_drag_width;
            }

            this.dragStart = this.getMouseValue(event);

            if (this.dragColumn.properties.resizeColumnInPlace) {
                gridColumnIndex += 1;
                vc = grid.renderer.visibleColumns[gridColumnIndex] ||
                    grid.renderer.visibleColumns[gridColumnIndex + 1]; // get first data column if tree column undefined;
                if (vc) {
                    this.nextColumn = vc.column;
                    this.nextStartWidth = this.nextColumn.getWidth();
                } else {
                    this.nextColumn = undefined;
                }
            } else {
                this.nextColumn = undefined; // in case resizeColumnInPlace was previously on but is now off
            }
        } else if (this.next) {
            this.next.handleMouseDown(grid, event);
        }
    },

    /**
     * @memberOf ColumnResizing.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseUp: function(grid, event) {
        if (this.dragColumn) {
            this.cursor = null;
            this.dragColumn = false;

            this.drag_multiple_col_width = [];

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
    handleMouseMove: function(grid, event) {
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
    handleDoubleClick: function(grid, event) {
        if (event.isHeaderRow && this.overAreaDivider(grid, event)) {
            var column = event.mousePoint.x <= 3
                ? grid.behavior.getActiveColumn(event.gridCell.x - 1)
                : event.column;
            column.addProperties({
                columnAutosizing: true,
                columnAutosized: false // todo: columnAutosizing should be a setter that automatically resets columnAutosized on state change to true
            });
            setTimeout(function() { // do after next render, which measures text now that auto-sizing is on
                grid.autosizeColumn(column);
            });
        } else if (this.next) {
            this.next.handleDoubleClick(grid, event);
        }
    }

});

module.exports = ColumnResizing;
