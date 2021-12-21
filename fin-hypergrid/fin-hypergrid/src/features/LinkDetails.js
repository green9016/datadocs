/* eslint-env browser */

'use strict';

var Feature = require('./Feature');

var detailsHolderElement;
var detailsShownOnDataCell = null;

var detailsHideTimeout = null;

// Track mouse that stops or not
var currentDetailsShownOnDataCell = null;
var currentStartX = null;
var currentStartY = null;
var currentBoundX = null;
var currentBoundY = null;
var countTimer = new Date().getTime();

var cursorX = null;
var cursorY = null;

/**
 * @constructor
 * @extends Feature
 */
var LinkDetails = Feature.extend('LinkDetails', {
    /**
     * @memberOf LinkDetails.prototype
     * @desc initial method of an feature
     * @param {Hypergrid} grid
     */
    initializeOn: function initializeOn(grid) {
        if (!detailsHolderElement) {
            detailsHolderElement = this.initializeLinkDetailsDiv();
        }

        if (this.next) {
            this.next.initializeOn(grid);
        }
    },
    /**
     * @memberOf LinkDetails.prototype
     * @desc utility method to initialize div, that contains link info
     */
    initializeLinkDetailsDiv: function initializeLinkDetailsDiv() {
        var holderElement = document.createElement('div');

        holderElement.style.display = 'none';
        holderElement.setAttribute('class', 'waffle-hyperlink-tooltip');

        document.body.appendChild(holderElement);

        return holderElement;
    },

    onApiDestroyCalled: function onApiDestroyCalled(grid, event) {
        this.hideLinkDetails(grid, detailsHolderElement);

        if (this.next) {
            this.next.onApiDestroyCalled(grid, event);
        }
    },

    handleCanvasOutsideMouseDown: function handleCanvasOutsideMouseDown(grid, event) {
        this.hideLinkDetails(grid, detailsHolderElement);

        if (this.next) {
            this.next.handleCanvasOutsideMouseDown(grid, event);
        }
    },

    /**
     * @memberOf LinkDetails.prototype
     * @param {Hypergrid} grid
     * @param {CellEvent} event
     */
    handleClick: function handleClick(grid, event) {
        if (detailsShownOnDataCell && (detailsShownOnDataCell.x !== event.gridCell.x || detailsShownOnDataCell.y !== event.gridCell.y)) {
            this.hideLinkDetails(grid, detailsHolderElement);
        }

        if (this.next) {
            this.next.handleClick(grid, event);
        }
    },

    /**
     * @memberOf Feature.prototype
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     * @private
     * @comment Not really private but was cluttering up all the feature doc pages.
     */
    handleWheelMoved: function handleWheelMoved(grid, event) {
        this.hideLinkDetails(grid, detailsHolderElement);

        if (this.next) {
            this.next.handleWheelMoved(grid, event);
        }
    },

    processMouseStop: function(grid, event){
        countTimer = new Date().getTime();
        this.hideLinkDetails(grid, detailsHolderElement);

        var linkToDisplay = event.properties.link ? event.properties.link : event.value;

        this.paintLinkDetails(detailsHolderElement, grid, linkToDisplay, event.bounds);

        detailsShownOnDataCell = event.gridCell;

        currentDetailsShownOnDataCell = detailsShownOnDataCell;
    },

    handleMouseMove: function handleMouseMove(grid, event) {
        cursorX = event.mousePoint.x;
        cursorY = event.mousePoint.y;
        var _this = this;
        if (!detailsShownOnDataCell || detailsShownOnDataCell.x !== event.gridCell.x || detailsShownOnDataCell.y !== event.gridCell.y) {
            if (event.properties.link || event.properties.detectLinksPermanently && event.isValueUrl) {
                if (!currentDetailsShownOnDataCell){
                    /*countTimer = new Date().getTime();
                    this.hideLinkDetails(grid, detailsHolderElement);

                    var linkToDisplay = event.properties.link ? event.properties.link : event.value;

                    this.paintLinkDetails(detailsHolderElement, grid, linkToDisplay, event.bounds);

                    detailsShownOnDataCell = event.gridCell;

                    currentDetailsShownOnDataCell = detailsShownOnDataCell;*/
                    this.processMouseStop(grid, event);
                }/*else if(currentDetailsShownOnDataCell && new Date().getTime() - countTimer >= grid.properties.linkDetailsHideTimeout){
                    this.processMouseStop(grid, event);
                }*/else{
                    // Ignore. Mouse Stops!
                    setTimeout(function () {
                        if (cursorX === event.mousePoint.x && cursorY === event.mousePoint.y){
                            if (!currentStartX || !currentStartY || !currentBoundX || !currentBoundY ||
                                cursorX < currentStartX || cursorX > currentStartX + currentBoundX ||
                                cursorY < currentStartY || cursorY > currentStartY + currentBoundY){
                                /*countTimer = new Date().getTime();
                                _this.hideLinkDetails(grid, detailsHolderElement);

                                var linkToDisplay = event.properties.link ? event.properties.link : event.value;

                                _this.paintLinkDetails(detailsHolderElement, grid, linkToDisplay, event.bounds, event);

                                detailsShownOnDataCell = event.gridCell;

                                currentDetailsShownOnDataCell = detailsShownOnDataCell;*/
                                _this.processMouseStop(grid, event);
                            }
                        }
                    }, 100);
                }
            } else if (detailsShownOnDataCell) {
                this.hideLinkDetailsTimeouted(grid, detailsHolderElement);

                // Mouse stops
                setTimeout(function () {
                    if (cursorX === event.mousePoint.x && cursorY === event.mousePoint.y){
                        _this.hideLinkDetails(grid, detailsHolderElement);
                    }
                }, 100);
            }
        }else{
            if (detailsShownOnDataCell &&
                (event.properties.link || event.properties.detectLinksPermanently && event.isValueUrl)) {
                if (detailsShownOnDataCell.x === event.gridCell.x && detailsShownOnDataCell.y === event.gridCell.y){
                    if (detailsHideTimeout) {
                        clearTimeout(detailsHideTimeout);
                    }
                    detailsHideTimeout = null;
                    //currentDetailsShownOnDataCell = null;
                }
            }
        }

        if (this.next) {
            this.next.handleMouseMove(grid, event);
        }
    },

    /**
     * @memberOf LinkDetails.prototype
     * @desc utility method to paint context menu based on click event, and position params
     * @param {HTMLElement} linkDetailsHolderElement - Html element that contains details
     * @param {Hypergrid} grid
     * @param {array|string} linkValue - link that need to be detailed
     * @param {object} cellBounds - defines bounds of cell cell
     */
    paintLinkDetails: function paintLinkDetails(linkDetailsHolderElement, grid, linkValue, cellBounds) {
        var _this = this;
        this.hideLinkDetails(grid, linkDetailsHolderElement);

        var links = linkValue;
        if (!Array.isArray(linkValue)) {
            links = [linkValue];
        }

        links.forEach(function (l) {
            if (!grid.behavior.dataModel.isValueUrl(l)) {
                return;
            }
            var outerDiv = document.createElement('div');
            var detailsLink = document.createElement('a');

            /*if (grid.properties.linkDetailsAnchorStyle) {
                Object.assign(detailsLink.style, grid.properties.linkDetailsAnchorStyle);
            }*/

            linkDetailsHolderElement.href = l;
            linkDetailsHolderElement.target = '_blank';

            detailsLink.href = l;
            var truncatedLink = _this.truncateString(l, grid.properties.linkDetailsMaxStringLength, '...');
            detailsLink.text = truncatedLink + '  ';
            detailsLink.target = '_blank';
            detailsLink.setAttribute('class', 'waffle-hyperlink-tooltip-link');

            //var detailsLinkIcon = document.createElement('i');
            //detailsLinkIcon.setAttribute('class', 'fa fa-external-link');

            //detailsLink.appendChild(detailsLinkIcon);

            var outerLinkIcon = document.createElement('a');
            outerLinkIcon.href = l;
            outerLinkIcon.target = '_blank';

            var linkIcon = document.createElement('span');
            linkIcon.setAttribute('class', 'waffle-hyperlink-icon');
            outerLinkIcon.appendChild(linkIcon);

            outerDiv.appendChild(detailsLink);
            outerDiv.appendChild(outerLinkIcon);
            linkDetailsHolderElement.appendChild(outerDiv);
            var _detailsX = detailsShownOnDataCell ? detailsShownOnDataCell.x: null;
            var _detailsY = detailsShownOnDataCell ? detailsShownOnDataCell.y: null;
            linkDetailsHolderElement.onmouseover = function (event) {
                //Object.assign(linkDetailsHolderElement.style, grid.properties.linkDetailsHoveredStyle);
                _this.cursorX = event.clientX;
                _this.cursorY = event.clientY;
                if (_this.detailsShownOnDataCell){
                    if (_this.detailsHideTimeout) {
                        clearTimeout(_this.detailsHideTimeout);
                    }
                    _this.detailsHideTimeout = null;
                }

            };
            /*linkDetailsHolderElement.onmousemove = function (event) {
                _this.cursorX = event.clientX;
                _this.cursorY = event.clientY;
                if (_this.detailsShownOnDataCell){
                    if (_this.detailsHideTimeout) {
                        clearTimeout(_this.detailsHideTimeout);
                    }
                    _this.detailsHideTimeout = null;
                }

            };
            linkDetailsHolderElement.onmouseenter = function (event) {
                _this.cursorX = event.clientX;
                _this.cursorY = event.clientY;
                if (_this.detailsShownOnDataCell){
                    if (_this.detailsHideTimeout) {
                        clearTimeout(_this.detailsHideTimeout);
                    }
                    _this.detailsHideTimeout = null;
                }

            };*/
            linkDetailsHolderElement.onmouseout = function () {
                //Object.assign(linkDetailsHolderElement.style, grid.properties.linkDetailsStyle);
            };
        });

        if (grid.properties.linkDetailsStyle) {
            //Object.assign(linkDetailsHolderElement.style, grid.properties.linkDetailsStyle);
        }

        this.showLinkDetails(grid, linkDetailsHolderElement, cellBounds);
    },

    /**
     * @memberOf LinkDetails.prototype
     * @desc utility method to start show context menu on defined point.
     * @desc Menu must be formed before it will be passed to this method
     * @param {Hypergrid} grid
     * @param {HTMLElement} linkDetailsHolderElement - Html element that contains details
     * @param {object} cellBounds - defines bounds of cell cell
     */
    showLinkDetails: function showLinkDetails(grid, linkDetailsHolderElement, cellBounds) {
        linkDetailsHolderElement.style.display = 'block';

        var holderComputedStyles = window.getComputedStyle(linkDetailsHolderElement);

        var startY = void 0,
            startX = void 0,
            bottomToTop = true;

        var holderHeight = holderComputedStyles.height.replace('px', '');
        if (cellBounds.y < holderHeight && Number(cellBounds.y) + Number(holderHeight) < window.innerHeight) {
            bottomToTop = false;
        }

        if (bottomToTop) {
            startY = cellBounds.y + grid.canvas.size.top - holderComputedStyles.height.replace('px', '');
            startX = cellBounds.x + grid.canvas.size.left + grid.properties.gridLinesWidth;
        } else {
            startY = cellBounds.y + cellBounds.height + grid.canvas.size.top;
            startX = cellBounds.x + grid.canvas.size.left + grid.properties.gridLinesWidth;
        }
        linkDetailsHolderElement.style.top = startY + 'px';
        linkDetailsHolderElement.style.left = startX + 10 + 'px';

        currentStartX = startX + 10;
        currentStartY = startY;
        currentBoundX = cellBounds.x;
        currentBoundY = cellBounds.y;
    },

    /**
     * @memberOf LinkDetails.prototype
     * @desc utility method to stop displaying context menu
     * @param {Hypergrid} grid
     * @param {object} detailsHolderElement - Html element that contains link info
     */
    hideLinkDetails: function hideLinkDetails(grid, detailsHolderElement) {
        detailsHolderElement.innerHTML = '';
        detailsHolderElement.style.display = 'none';
        detailsShownOnDataCell = null;
        currentStartX = null;
        currentStartY = null;
        currentBoundX = null;
        currentBoundY = null;
        if (detailsHideTimeout) {
            clearTimeout(detailsHideTimeout);
            detailsHideTimeout = null;
        }
    },

    /**
     * @memberOf LinkDetails.prototype
     * @desc utility method to stop displaying context menu
     * @param {Hypergrid} grid
     * @param {object} detailsHolderElement - Html element that contains link info
     */
    hideLinkDetailsTimeouted: function hideLinkDetailsTimeouted(grid, detailsHolderElement) {
        var _this2 = this;

        if (!detailsHideTimeout) {
            detailsHideTimeout = setTimeout(function () {
                _this2.hideLinkDetails(grid, detailsHolderElement);
            }, grid.properties.linkDetailsHideTimeout);
        }
    },

    /**
     * @memberOf LinkDetails.prototype
     * @desc utility method to remove HTML element from current DOM
     * @param {HTMLElement} element - HTML element that need to be removed from DOM
     */
    removeDOMElement: function removeDOMElement(element) {
        element.remove();
    },

    /**
     * @memberOf LinkDetails.prototype
     * @desc utility method to truncate string. If string greater, than value,
     * central part of string will be replaced with separator
     * @param fullStr
     * @param strLen
     * @param separator
     */
    truncateString: function truncateString(fullStr, strLen, separator) {
        if (fullStr.length <= strLen) {
            return fullStr;
        }

        separator = separator || '...';

        var sepLen = separator.length,
            charsToShow = strLen - sepLen,
            frontChars = Math.ceil(charsToShow / 2),
            backChars = Math.floor(charsToShow / 2);

        return fullStr.substr(0, frontChars) + separator + fullStr.substr(fullStr.length - backChars);
    }
});

module.exports = LinkDetails;
