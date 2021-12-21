'use strict';

var Feature = require('./Feature');

/**
 * @constructor
 * @extends Feature
 */
var CopySelection = Feature.extend('CopySelection', {

    /**
     * @memberOf ColumnSelection.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleKeyDown: function(grid, event) {
        var detail = event.detail;

        // Add more condition to make sure that at least a cell is selected
        var handler = grid.selectionModel.copyArea != null && this['handle' + detail.char];

        if (handler) {
            handler.call(this, grid, detail);
        } else if (this.next) {
            this.next.handleKeyDown(grid, event);
        }
    },

    /**
     * @memberOf ColumnSelection.prototype
     * @param {Hypergrid} grid
     */
    handleESC: function(grid) {
        grid.selectionModel.clearCopyArea();
        grid.repaint();
    },
});

module.exports = CopySelection;
