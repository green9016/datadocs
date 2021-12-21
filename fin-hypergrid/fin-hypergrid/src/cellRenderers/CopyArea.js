'use strict';

var CellRenderer = require('./CellRenderer');

/**
 * @constructor
 * @desc A rendering of the last Selection Model
 * @extends CellRenderer
 */
var CopyArea = CellRenderer.extend('CopyArea', {
    paint: function(gc, config) {
        var visOutline = gc.alpha(config.copyRegionOutlineColor) > 0;

        if (visOutline) {
            var x = config.bounds.x - 1,
                y = config.bounds.y - 1,
                width = config.bounds.width + 2,
                height = config.bounds.height + 2;

            gc.beginPath();
            gc.setLineDash([5, 3]);
            gc.rect(x, y, width, height);
            gc.cache.lineWidth = config.copyRegionBorderWidth;
            gc.cache.strokeStyle = config.copyRegionOutlineColor;
            gc.stroke();

            gc.closePath();
            gc.setLineDash([]);
        }
    }
});

module.exports = CopyArea;
