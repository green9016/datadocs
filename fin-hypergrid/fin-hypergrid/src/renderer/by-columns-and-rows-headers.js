'use strict';

/** @summary Render the grid headers. Useful when need to avoid overlapping
 * @desc Paints all the header cells of a grid, one column at a time.
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
 * @param {boolean} onlyHeaders
 * @memberOf Renderer.prototype
 */

function paintCellsByColumnsAndRowsHeaders(gc) {
    var prefillColor,
        rowPrefillColors,
        cellEvent,
        visibleColumns = this.visibleColumns,
        visibleRows = this.visibleRows,
        C = visibleColumns.length,

    // cLast = C - 1,
    rowIndex,
        R = visibleRows.length,
        pool = this.cellEventPool;

    if (!C || !R) {
        return;
    }

    // For each column...
    var poolIndex = 0;
    visibleColumns.forEachWithNeg(function (visibleColumn, columnIndex) {

        cellEvent = pool[poolIndex];
        visibleColumn = cellEvent.visibleColumn;

        if (!rowPrefillColors) {
            prefillColor = cellEvent.column.properties.backgroundColor;
        }

        // For each row of each subgrid (of each column)...
        for (rowIndex = 0; rowIndex < R; rowIndex++, poolIndex++) {
            if (rowPrefillColors) {
                prefillColor = rowPrefillColors[rowIndex];
            }

            try {
                var poolItem = pool[poolIndex];
                if (poolItem.isHeaderRow) {
                    this._paintCell(gc, poolItem, prefillColor);
                }
            } catch (e) {
                this.renderErrorCell(e, gc, visibleColumn, pool[poolIndex].visibleRow);
            }
        }
    }.bind(this));

    this.paintHeaderGridlines(gc);
}

paintCellsByColumnsAndRowsHeaders.key = 'by-columns-and-rows-headers';
paintCellsByColumnsAndRowsHeaders.rebundle = true;

module.exports = paintCellsByColumnsAndRowsHeaders;
