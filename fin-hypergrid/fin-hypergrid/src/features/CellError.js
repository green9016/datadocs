/* eslint-env browser */

'use strict';

var Feature = require('./Feature');

var errorDiv, fadeInInterval, fadeOutInterval;

/**
 * @constructor
 * @extends Feature
 */
var CellError = Feature.extend('CellError', {
    isMenuShown: false,

    cellErrorState: {},

    /**
     * @memberOf CellError.prototype
     * @desc give me an opportunity to initialize stuff on the grid
     * @param {Hypergrid} grid
     */
    initializeOn: function initializeOn(grid) {
        if (!errorDiv) {
            errorDiv = this.initializeCellErrorDiv();
        }

        if (this.next) {
            this.next.initializeOn(grid);
        }
    },

    /**
     * @memberOf CellError.prototype
     * @desc initialize context menu div
     */
    initializeCellErrorDiv: function initializeCellErrorDiv() {
        errorDiv = document.createElement('div');

        errorDiv.style.display = 'none';

        document.body.appendChild(errorDiv);

        return errorDiv;
    },

    processCellEvent: function(grid, event){
        var tooltipRightX = event.bounds.x + event.bounds.width + grid.canvas.size.left -4;

        var tooltipTopY = event.bounds.y + grid.canvas.size.top;

        var err_msg = undefined;

        if (event.value && typeof event.value === "object"){
            if (event.value.type && event.value.type === "ERROR"){
                err_msg = event.value.description;
            }
        }

        if (err_msg){

            if (this.cellErrorState
                && this.cellErrorState.x !== undefined && this.cellErrorState.x === event.dataCell.x
                && this.cellErrorState.y !== undefined && this.cellErrorState.y === event.dataCell.y
                && this.cellErrorState.active === true && this.cellErrorState.err_msg === err_msg){

                // Keep current the error layover
            }else{

              var rightToLeft = tooltipRightX + 200 >= window.innerWidth;

              // Update the error layover
              this.paintCellError(grid, event, tooltipRightX, tooltipTopY, err_msg, 'right', rightToLeft);
              this.cellErrorState = {x: event.dataCell.x, y: event.dataCell.y, active: true, err_msg: err_msg};
            }
        }else{
            this.hideCellError(errorDiv);
        }
    },

    /**
     * @memberOf CellError.prototype
     * @param {Hypergrid} grid
     * @param {CellEvent} event
     */
    handleMouseDown: function(grid, event) {
        this.processCellEvent(grid, event);

        if (this.next) {
            this.next.handleMouseDown(grid, event);
        }
    },

    handleMouseMove: function handleMouseMove(grid, event) {
        var stateChanged = false;
        /*var tooltipRightX = event.bounds.x + event.bounds.width + grid.canvas.size.left -4;
        //var vColumns = grid.renderer.visibleColumns;
        //if (vColumns[event.dataCell.x] && vColumns[event.dataCell.x].right){
        //    tooltipRightX = vColumns[event.dataCell.x].right;
        //}

        var tooltipTopY = event.bounds.y + grid.canvas.size.top;

        var err_msg = undefined;

        if (event.value && typeof event.value === "object"){
            if (event.value.type && event.value.type === "ERROR"){
                err_msg = event.value.description;
            }
        }

        if (err_msg){

            if (this.cellErrorState
                && this.cellErrorState.x !== undefined && this.cellErrorState.x === event.dataCell.x
                && this.cellErrorState.y !== undefined && this.cellErrorState.y === event.dataCell.y
                && this.cellErrorState.active === true && this.cellErrorState.err_msg === err_msg){

                // Keep current the error layover
            }else{

              var rightToLeft = tooltipRightX + 200 >= window.innerWidth;

              // Update the error layover
              this.paintCellError(grid, event, tooltipRightX, tooltipTopY, err_msg, 'right', rightToLeft);
              this.cellErrorState = {x: event.dataCell.x, y: event.dataCell.y, active: true, err_msg: err_msg};
            }
        }else{
            this.hideCellError(errorDiv);
        }*/

        this.processCellEvent(grid, event);

        if (stateChanged) {
            grid.repaint();
        }

        if (this.next) {
            this.next.handleMouseMove(grid, event);
        }
    },

    /**
     * @memberOf CellError.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleDoubleClick: function(grid, event) {
        this.hideCellError(errorDiv);

        if (this.next) {
            this.next.handleDoubleClick(grid, event);
        }
    },

    handleCanvasOutsideMouseDown: function(grid, event) {
        this.hideCellError(errorDiv);

        if (this.next) {
            this.next.handleCanvasOutsideMouseDown(grid, event);
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
        this.hideCellError(errorDiv);

        if (this.next) {
            this.next.handleDataAdded(grid, event);
        }
    },

    overCellError: function (grid, event) {
        var eventCellRightX = event.bounds.width;
        var cellErrorIconRightX = eventCellRightX - 5; // margin

        var typeSignWidth = 0;
        if (event.column.schema && event.column.schema.colTypeSign) {
            var gc = grid.canvas.gc,
                prevFontState = gc.cache.font,
                prevFillStyleState = gc.cache.fillStyle,
                config = event.properties;

            gc.cache.font = config.columnTypeSignFont;
            gc.cache.fillStyle = config.columnTypeSignColor;
            typeSignWidth = gc.measureText(event.column.schema.colTypeSign).width;
            typeSignWidth += 5;

            gc.cache.font = prevFontState;
            gc.cache.fillStyle = prevFillStyleState;
        }
        var cellErrorIconLeftX = cellErrorIconRightX - typeSignWidth;

        var cellErrorIconTopY = event.bounds.height / 2;
        var cellErrorIconBottomY = cellErrorIconTopY;

        return event.mousePoint.x <= cellErrorIconRightX && event.mousePoint.x >= cellErrorIconLeftX && event.mousePoint.y <= cellErrorIconBottomY && event.mousePoint.y >= cellErrorIconTopY;
    },

    /**
     * @memberOf CellError.prototype
     * @desc utility method to paint context menu based on click event, and position params
     * @param {Hypergrid} grid
     * @param {number} x - defines horizontal point of menu start
     * @param {number} y - defines vertical point of menu start
     * @param {string} text - tooltip content
     * @param {string} placement - placement of an tooltip
     */
    paintCellError: function paintCellError(grid, event, x, y, text, placement, rightToLeft) {
        this.hideCellError(errorDiv);

        if (!errorDiv) {
            this.initializeCellErrorDiv();
        }

        // tooltipHolderDiv.setAttribute('class', 'tooltip bottom fade in main-page-tooltip');

        switch (placement) {
            case 'bottom':
                errorDiv.setAttribute('class', 'annotation-bubble bottom' /*grid.properties.cellErrorBottomClass*/);
                break;
            case 'right':
                errorDiv.setAttribute('class', 'annotation-bubble right' /*grid.properties.cellErrorRightClass*/);
                break;
        }

        // Reset
        errorDiv.innerHTML = "";

        //var tooltipArrowDiv = document.createElement('div');
        //tooltipArrowDiv.setAttribute('class', grid.properties.cellErrorArrowClass);
        //errorDiv.appendChild(tooltipArrowDiv);

        var tooltipInnerDiv = document.createElement('div');
        tooltipInnerDiv.setAttribute('class', 'annotation-attribution annotation-attribution-rebranded annotation-attribution-error' /*grid.properties.cellErrorInnerClass*/);
        tooltipInnerDiv.innerHTML = "<strong>Error</strong><span>" + text + "</span>";
        errorDiv.appendChild(tooltipInnerDiv);

        this.showCellError(grid);

        if (rightToLeft === true){
            x = grid.canvas.size.left + event.bounds.x + 20 - 200;
        }

        var iH = 105; // The height of error layover
        var iHView = window.innerHeight - 60;
        if (iHView - y < iH){
            y = y + event.bounds.height - iH;
        }

        var leftX = void 0,
            topY = void 0;
        var tooltipWidth = errorDiv.offsetWidth,
            tooltipHeight = errorDiv.offsetHeight;

        switch (placement) {
            case 'bottom':
                leftX = x - tooltipWidth / 2;
                topY = y;
                break;
            case 'right':
                leftX = x;
                topY = y; // y - tooltipHeight / 2;
                break;
        }

        this.moveCellError(leftX, topY);
    },

    /**
     * @memberOf CellError.prototype
     * @desc utility method to start show context menu on defined point.
     * @param {Hypergrid} grid
     */
    showCellError: function showCellError(grid) {

        errorDiv.style.display = 'block';

        /*
        var op = 0.1; // initial opacity
        errorDiv.style.opacity = op;
        errorDiv.style.display = 'block';
        this.isMenuShown = true;
        this.clearIntervals();
        fadeInInterval = setInterval(function () {
            if (op >= grid.properties.cellErrorOpacity) {
                clearInterval(fadeInInterval);
            }
            if (!errorDiv) {
                return;
            }
            errorDiv.style.opacity = op;
            errorDiv.style.filter = 'alpha(opacity=' + op * 100 + ')';
            op += op * 0.2;
        }, 5);
        */
    },

    /**
     * @memberOf CellError.prototype
     * @desc utility method to move tooltip to position
     * @desc Menu must be formed before it will be passed to this method
     * @param {number} x - defines horizontal point of tooltip start
     * @param {number} y - defines vertical point of tooltip start
     */
    moveCellError: function moveCellError(x, y) {
        errorDiv.style.top = y + 'px';
        errorDiv.style.left = x + 'px';
    },

    /**
     * @memberOf CellError.prototype
     * @desc utility method to stop displaying context menu
     * @param {Hypergrid} grid
     */
    hideCellError: function (errorDiv) {
        errorDiv.style.display = 'none';
        this.cellErrorState = {};
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

module.exports = CellError;
