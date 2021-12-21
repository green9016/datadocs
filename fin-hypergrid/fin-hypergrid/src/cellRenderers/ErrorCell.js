'use strict';

var CellRenderer = require('./CellRenderer');

/**
 * @constructor
 * @extends CellRenderer
 */
var ErrorCell = CellRenderer.extend('ErrorCell', {

    /**
     * @summary Writes error message into cell.
     *
     * @desc This function is guaranteed to be called as follows:
     *
     * ```javascript
     * gc.save();
     * gc.beginPath();
     * gc.rect(x, y, width, height);
     * gc.clip();
     * behavior.getCellProvider().renderCellError(gc, message, x, y, width, height);
     * gc.restore();
     * ```
     *
     * Before doing anything else, this function should clear the cell by setting `gc.fillStyle` and calling `gc.fill()`.
     *
     * @param {CanvasRenderingContext2D} gc
     * @param {object} config
     * @param {Rectangle} config.bounds - The clipping rect of the cell to be rendered.
     * @memberOf ErrorCell.prototype
     */
    paint: function(gc, config) {
        var x = config.bounds.x,
            y = config.bounds.y,
            width = config.bounds.width,
            height = config.bounds.height;

        // clear the cell
        // (this makes use of the rect path defined by the caller)
        //gc.cache.fillStyle = '#FFFFFF';
        //gc.fill();

        // render message text
        gc.cache.fillStyle = config.cellErrorIconColor;
        gc.cache.textAlign = 'start';
        gc.cache.textBaseline = 'middle';
        gc.cache.font = '13px "Helvetica Neue",Helvetica,Arial,sans-serif';
        gc.simpleText(config.error.description || "INVALID", x + 4, y + height / 2 + 0.5);

        var topPointX = x + width;
        gc.moveTo(topPointX - 7, y);
        gc.lineTo(topPointX, y);
        gc.lineTo(topPointX, y + 7);

        gc.fill();
    }
});

module.exports = ErrorCell;
