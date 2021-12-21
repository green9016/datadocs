/* eslint-env browser */

'use strict';

var Feature = require('./Feature');

var tooltipDiv, fadeInInterval, fadeOutInterval;

/**
 * @constructor
 * @extends Feature
 */
var WarningTooltip = Feature.extend('WarningTooltip', {
    isMenuShown: false,

    /**
     * @memberOf WarningTooltip.prototype
     * @desc initialize context menu div
     */
    initializeWarningTooltipDiv: function initializeWarningTooltipDiv() {
        tooltipDiv = document.createElement('div');

        tooltipDiv.style.display = 'none';

        document.body.appendChild(tooltipDiv);

        return tooltipDiv;
    },

    handleMouseMove: function handleMouseMove(grid, event) {
        var stateChanged = false;
        var isCursorOverCollumnWarningIcon = this.overColumnWarningIcon(grid, event);
        var isCursorOverTotalWarningIcon = this.overTotalWarningIcon(grid, event);

        if (isCursorOverCollumnWarningIcon) {
            if (!this.isMenuShown) {
                var tooltipRightX = event.bounds.x + event.properties.cellPaddingLeft + grid.canvas.size.left + 8;
                var tooltipTopY = event.bounds.y + event.bounds.height + grid.canvas.size.top;
                this.paintWarningTooltip(grid, tooltipRightX, tooltipTopY, event.column.firstError.description, 'bottom');
            }
        } else if (isCursorOverTotalWarningIcon) {
            if (!this.isMenuShown) {
                var _tooltipRightX = event.bounds.x + event.bounds.width / 2 + event.properties.totalErrorsCountIconWidth / 2 + grid.canvas.size.left;
                var _tooltipTopY = event.bounds.y + event.bounds.height / 2 + grid.canvas.size.top;
                this.paintWarningTooltip(grid, _tooltipRightX, _tooltipTopY, grid.getFieldsErrorsMessage(), 'right');
            }
        } else {
            if (this.isMenuShown) {
                this.hideWarningTooltip(grid);
            }
        }

        if (stateChanged) {
            grid.repaint();
        }

        if (this.next) {
            this.next.handleMouseMove(grid, event);
        }
    },

    /**
     * @memberOf Feature.prototype
     * @desc handle grid data added event
     * @param {Hypergrid} grid
     * @param {object} event
     * @private
     * @comment Not really private but was cluttering up all the feature doc pages.
     */
    handleDataAdded: function handleDataAdded(grid, event) {
        this.hideWarningTooltip(grid);

        if (this.next) {
            this.next.handleDataAdded(grid, event);
        }
    },

    overColumnWarningIcon: function overColumnWarningIcon(grid, event) {
        var columnHasError = event.column.hasError;
        var isHeaderRow = event.properties.headerRow || event.rowProperties.headerRow;

        if (!columnHasError || !isHeaderRow) {
            return false;
        }

        var warningIconLeftX = event.properties.cellPaddingLeft;
        var warningIconRightX = warningIconLeftX + 14 + event.properties.columnTitlePrefixRightSpace;

        var warningIconTopY = 5;
        var warningIconBottomY = event.bounds.height - 5;

        return event.mousePoint.x <= warningIconRightX && event.mousePoint.x >= warningIconLeftX && event.mousePoint.y <= warningIconBottomY && event.mousePoint.y >= warningIconTopY;
    },

    overTotalWarningIcon: function overTotalWarningIcon(grid, event) {
        var x = event.gridCell.x;
        var r = event.dataCell.y;

        var renderTotalErrorSignNeeded = x === grid.behavior.rowColumnIndex && r === 0 && event.isHeaderRow && grid.behavior.errorCount;

        if (!renderTotalErrorSignNeeded) {
            return false;
        }

        var totalErrorsCountIconStartY = event.bounds.height / 2 - event.properties.totalErrorsCountIconHeight / 2;
        var totalErrorsCountIconEndY = totalErrorsCountIconStartY + event.properties.totalErrorsCountIconHeight;
        var totalErrorsCountIconStartX = event.bounds.width / 2 - event.properties.totalErrorsCountIconWidth / 2;
        var totalErrorsCountIconEndX = totalErrorsCountIconStartX + event.properties.totalErrorsCountIconWidth;

        return event.mousePoint.x <= totalErrorsCountIconEndX && event.mousePoint.x >= totalErrorsCountIconStartX && event.mousePoint.y <= totalErrorsCountIconEndY && event.mousePoint.y >= totalErrorsCountIconStartY;
    },

    /**
     * @memberOf WarningTooltip.prototype
     * @desc utility method to paint context menu based on click event, and position params
     * @param {Hypergrid} grid
     * @param {number} x - defines horizontal point of menu start
     * @param {number} y - defines vertical point of menu start
     * @param {string} text - tooltip content
     * @param {string} placement - placement of an tooltip
     */
    paintWarningTooltip: function paintWarningTooltip(grid, x, y, text, placement) {
        this.hideWarningTooltip(grid);

        if (!tooltipDiv) {
            this.initializeWarningTooltipDiv();
        }

        // tooltipHolderDiv.setAttribute('class', 'tooltip bottom fade in main-page-tooltip');

        switch (placement) {
            case 'bottom':
                tooltipDiv.setAttribute('class', grid.properties.warningTooltipBottomClass);
                break;
            case 'right':
                tooltipDiv.setAttribute('class', grid.properties.warningTooltipRightClass);
                break;
        }

        var tooltipArrowDiv = document.createElement('div');
        tooltipArrowDiv.setAttribute('class', grid.properties.warningTooltipArrowClass);
        tooltipDiv.appendChild(tooltipArrowDiv);

        var tooltipInnerDiv = document.createElement('div');
        tooltipInnerDiv.setAttribute('class', grid.properties.warningTooltipInnerClass);
        tooltipInnerDiv.innerHTML = text;
        tooltipDiv.appendChild(tooltipInnerDiv);

        this.showWarningTooltip(grid);

        var leftX = void 0,
            topY = void 0;
        var tooltipWidth = tooltipDiv.offsetWidth,
            tooltipHeight = tooltipDiv.offsetHeight;

        switch (placement) {
            case 'bottom':
                leftX = x - tooltipWidth / 2;
                topY = y;
                break;
            case 'right':
                leftX = x;
                topY = y - tooltipHeight / 2;
                break;
        }

        this.moveWarningTooltip(leftX, topY);
    },

    /**
     * @memberOf WarningTooltip.prototype
     * @desc utility method to start show context menu on defined point.
     * @param {Hypergrid} grid
     */
    showWarningTooltip: function showWarningTooltip(grid) {
        var op = 0.1; // initial opacity
        tooltipDiv.style.opacity = op;
        tooltipDiv.style.display = 'block';
        this.isMenuShown = true;
        this.clearIntervals();
        fadeInInterval = setInterval(function () {
            if (op >= grid.properties.warningTooltipOpacity) {
                clearInterval(fadeInInterval);
            }
            if (!tooltipDiv) {
                return;
            }
            tooltipDiv.style.opacity = op;
            tooltipDiv.style.filter = 'alpha(opacity=' + op * 100 + ')';
            op += op * 0.2;
        }, 5);
    },

    /**
     * @memberOf WarningTooltip.prototype
     * @desc utility method to move tooltip to position
     * @desc Menu must be formed before it will be passed to this method
     * @param {number} x - defines horizontal point of tooltip start
     * @param {number} y - defines vertical point of tooltip start
     */
    moveWarningTooltip: function moveWarningTooltip(x, y) {
        tooltipDiv.style.top = y + 'px';
        tooltipDiv.style.left = x + 'px';
    },

    /**
     * @memberOf WarningTooltip.prototype
     * @desc utility method to stop displaying context menu
     * @param {Hypergrid} grid
     */
    hideWarningTooltip: function hideWarningTooltip(grid) {
        this.isMenuShown = false;

        if (!tooltipDiv) {
            return;
        }

        var op = grid.properties.warningTooltipOpacity; // initial opacity
        this.clearIntervals();
        fadeOutInterval = setInterval(function () {
            if (op <= 0.1) {
                clearInterval(fadeOutInterval);

                if (!tooltipDiv) {
                    return;
                }
                tooltipDiv.style.display = 'none';

                tooltipDiv.innerHTML = '';
                tooltipDiv.remove();
                tooltipDiv = null;
            }

            if (!tooltipDiv) {
                return;
            }

            tooltipDiv.style.opacity = op;
            tooltipDiv.style.filter = 'alpha(opacity=' + op * 100 + ')';
            op -= op * 0.2;
        }, 5);
    },

    clearIntervals: function clearIntervals() {
        if (fadeOutInterval) {
            clearInterval(fadeOutInterval);
        }
        if (fadeInInterval) {
            clearInterval(fadeInInterval);
        }
    }
});

module.exports = WarningTooltip;
