'use strict';

var bundleColumns = require('./bundle-columns');
var bundleRows = require('./bundle-rows');

/** @summary Render the grid with consolidated row OR column rects.
 * @desc Paints all the cells of a grid, one column at a time.
 *
 * First, a background rect is drawn using the grid background color.
 *
 * Then, if there are any rows with their own background color _that differs from the grid background color,_ these are consolidated and the consolidated groups of row backgrounds are all drawn before iterating through cells. These row backgrounds get priority over column backgrounds.
 *
 * If there are no such row background rects to draw, the column rects are consolidated and drawn instead (again, before the cells). Note that these column rects are _not_ suitable for clipping overflow text from previous columns. If you have overflow text, either turn on clipping (big performance hit) or turn on one of the `truncateTextWithEllipsis` options.
 *
 * `try...catch` surrounds each cell paint in case a cell renderer throws an error.
 * The error message is error-logged to console AND displayed in cell.
 *
 * Each cell to be rendered is described by a {@link CellEvent} object. For performance reasons, to avoid constantly instantiating these objects, we maintain a pool of these. When the grid shape changes, we reset their coordinates by setting {@link CellEvent#reset|reset} on each.
 *
 * See also the discussion of clipping in {@link Renderer#paintCellsByColumns|paintCellsByColumns}.
 * @this {Renderer}
 * @param {CanvasRenderingContext2D} gc
 * @memberOf Renderer.prototype
 */
function paintCellsByColumnsAndRows(gc) {
    var grid = this.grid,
        gridProps = grid.properties,
        prefillColor,
        rowPrefillColors,
        gridPrefillColor = gridProps.backgroundColor,
        cellEvent,
        rowBundle,
        rowBundles,
        columnBundle,
        columnBundles,
        visibleColumns = this.visibleColumns,
        visibleRows = this.visibleRows,
        c,
        C = visibleColumns.length,
        cLast = C - 1,
        rowIndex,
        R = visibleRows.length,
        pool = this.cellEventPool,
        columnClip,

    // clipToGrid,
    viewWidth = C ? visibleColumns[C - 1].right : 0,
        viewHeight = R ? visibleRows[R - 1].bottom : 0;

    gc.clearRect(0, 0, this.bounds.width, this.bounds.height);
    gc.fillStyle = gridProps.canvasBackgroundColor;
    gc.fillRect(0, 0, this.bounds.width, this.bounds.height);

    if (!C || !R) {
        return;
    }

    if (gc.alpha(gridPrefillColor) > 0) {
        gc.cache.fillStyle = gridPrefillColor;
        gc.fillRect(0, 0, viewWidth, viewHeight);
    }

    if (this.gridRenderer.reset) {
        this.resetAllGridRenderers();
        this.gridRenderer.reset = false;
        bundleRows.call(this, false);
        bundleColumns.call(this, true);
    } else if (this.gridRenderer.rebundle) {
        this.gridRenderer.rebundle = false;
        bundleColumns.call(this);
    }

    rowBundles = this.rowBundles;
    if (rowBundles.length) {
        rowPrefillColors = this.rowPrefillColors;
        for (rowIndex = rowBundles.length; rowIndex--;) {
            rowBundle = rowBundles[rowIndex];
            gc.clearFill(0, rowBundle.top, viewWidth, rowBundle.bottom - rowBundle.top, rowBundle.backgroundColor);
        }
    } else {
        for (columnBundles = this.columnBundles, c = columnBundles.length; c--;) {
            columnBundle = columnBundles[c];
            gc.clearFill(columnBundle.left, 0, columnBundle.right - columnBundle.left, viewHeight, columnBundle.backgroundColor);
        }
    }

    // gc.clipSave(clipToGrid, 0, 0, viewWidth, viewHeight);

    // For each column...
    var poolIndex = 0;
    visibleColumns.forEachWithNeg(function (visibleColumn, columnIndex) {

        cellEvent = pool[poolIndex];
        visibleColumn = cellEvent.visibleColumn;

        if (!rowPrefillColors) {
            prefillColor = cellEvent.column.properties.backgroundColor;
        }

        // Optionally clip to visible portion of column to prevent text from overflowing to right.
        columnClip = visibleColumn.column.properties.columnClip;
        gc.clipSave(columnClip || columnClip === null && columnIndex === cLast, 0, 0, visibleColumn.right, viewHeight);

        // For each row of each subgrid (of each column)...
        for (rowIndex = 0; rowIndex < R; rowIndex++, poolIndex++) {
            if (rowPrefillColors) {
                prefillColor = rowPrefillColors[rowIndex];
            }

            try {
                this._paintCell(gc, pool[poolIndex], prefillColor);
            } catch (e) {
                this.renderErrorCell(e, gc, visibleColumn, pool[poolIndex].visibleRow);
            }
        }

        gc.clipRestore(columnClip);
    }.bind(this));

    // gc.clipRestore(clipToGrid);

    this.paintGridlines(gc);
}

paintCellsByColumnsAndRows.key = 'by-columns-and-rows';
paintCellsByColumnsAndRows.rebundle = true; // see rebundleGridRenderers

module.exports = paintCellsByColumnsAndRows;
