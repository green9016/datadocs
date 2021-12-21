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
     * @param message
     * @param {Rectangle} config.bounds - The clipping rect of the cell to be rendered.
     * @memberOf ErrorCell.prototype
     */
    paint: function paint(gc, config, message) {
        var x = config.bounds.x,
            y = config.bounds.y,

        // width = config.bounds.width,
        height = config.bounds.height;

        // clear the cell
        // (this makes use of the rect path defined by the caller)
        gc.cache.fillStyle = '#FFFFFF';
        gc.fill();

        // render message text
        gc.cache.fillStyle = '#a94d4dc2';
        gc.cache.textAlign = 'start';
        gc.cache.textBaseline = 'middle';
        gc.cache.font = '13px "Helvetica Neue",Helvetica,Arial,sans-serif';
        gc.simpleText(message, x + 4, y + height / 2 + 0.5);
    }
});

module.exports = ErrorCell;
