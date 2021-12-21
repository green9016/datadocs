'use strict';

var Scrollbar = require('./modules').Scrollbar;

/**
 * @summary Scrollbar support.
 * @desc Additions to `Hypergrid.prototype` for scrollbar support.
 *
 * All members are documented on the {@link Hypergrid} page.
 * @mixin scrolling.mixin
 */
exports.mixin = {

    /**
     * A float value between 0.0 - 1.0 of the vertical scroll position.
     * @type {number}
     * @memberOf Hypergrid#
     */
    vScrollValue: 0,

    /**
     * A float value between 0.0 - 1.0 of the horizontal scroll position.
     * @type {number}
     * @memberOf Hypergrid#
     */
    hScrollValue: 0,

    /**
     * The verticl scroll bar model/controller.
     * @type {FinBar}
     * @memberOf Hypergrid#
     */
    sbVScroller: null,

    /**
     * The horizontal scroll bar model/controller.
     * @type {FinBar}
     * @memberOf Hypergrid#
     */
    sbHScroller: null,

    /**
     * The previous value of sbVScrollVal.
     * @type {number}
     * @memberOf Hypergrid#
     */
    sbPrevVScrollValue: null,

    /**
     * The previous value of sbHScrollValue.
     * @type {number}
     * @memberOf Hypergrid#
     */
    sbPrevHScrollValue: null,

    scrollingNow: false,

    /**
     * @memberOf Hypergrid#
     * @summary Set for `scrollingNow` field.
     * @param {boolean} isItNow - The type of event we are interested in.
     */
    setScrollingNow: function(isItNow) {
        this.scrollingNow = isItNow;
    },

    /**
     * @memberOf Hypergrid#
     * @returns {boolean} The `scrollingNow` field.
     */
    isScrollingNow: function() {
        return this.scrollingNow;
    },

    /**
     * @memberOf Hypergrid#
     * @summary Scroll horizontal and vertically by the provided offsets.
     * @param {number} offsetX - Scroll in the x direction this much.
     * @param {number} offsetY - Scroll in the y direction this much.
     */
    scrollBy: function(offsetX, offsetY) {
        this.scrollHBy(offsetX);
        this.scrollVBy(offsetY);
    },

    /**
     * @memberOf Hypergrid#
     * @summary Scroll vertically by the provided offset.
     * @param {number} offsetY - Scroll in the y direction this much.
     */
    scrollVBy: function(offsetY) {
        var max = this.sbVScroller.range.max;
        //var oldValue = this.getVScrollValue();
        //var newValue = Math.min(max, Math.max(0, oldValue + offsetY));
        var oldValue = this.vScrollValue;
        var oldOffset = this.getVScrollValue();
        var rowHeight = this.behavior.getRowHeight(Math.max(0, oldOffset + offsetY));
        var newValue = Math.min(max, oldValue + offsetY * rowHeight);
        if (newValue !== oldValue) {
            this.setVScrollValue(newValue);
        }
    },

    /**
     * @memberOf Hypergrid#
     * @summary Scroll horizontally by the provided offset.
     * @param {number} offsetX - Scroll in the x direction this much.
     */
    scrollHBy: function(offsetX) {
        var max = this.sbHScroller.range.max;
        //var oldValue = this.getHScrollValue();
        //var newValue = Math.min(max, Math.max(0, oldValue + offsetX));
        var oldValue = this.hScrollValue;
        var oldOffset = this.getHScrollValue();
        var newValue = Math.min(max, oldValue + offsetX * this.behavior.getColumnWidth(Math.max(0, oldOffset + offsetX)));
        if (newValue !== oldValue) {
            this.setHScrollValue(newValue);
        }
    },

    scrollToMakeVisible: function(c, r) {
        /*var delta,
            dw = this.renderer.dataWindow,
            fixedColumnCount = this.properties.fixedColumnCount,
            fixedRowCount = this.properties.fixedRowCount;

        // scroll only if target not in fixed columns
        if (c >= fixedColumnCount) {
            // target is to left of scrollable columns; negative delta scrolls left
            if ((delta = c - dw.origin.x) < 0) {
                this.sbHScroller.index += delta;

                // target is to right of scrollable columns; positive delta scrolls right
                // Note: The +1 forces right-most column to scroll left (just in case it was only partially in view)
            } else if ((c - dw.corner.x) > 0) {
                this.sbHScroller.index = this.renderer.getMinimumLeftPositionToShowColumn(c);
            }
        }

        if (
            r >= fixedRowCount && // scroll only if target not in fixed rows
            (
                // target is above scrollable rows; negative delta scrolls up
                (delta = r - dw.origin.y - 1) < 0 ||

                // target is below scrollable rows; positive delta scrolls down
                (delta = r - dw.corner.y) > 0
            )
        ) {
            this.sbVScroller.index += delta;
        }
        */
        var _renderer$dataWindow = this.renderer.dataWindow,
            origin = _renderer$dataWindow.origin,
            corner = _renderer$dataWindow.corner;
        var _properties = this.properties,
            fixedColumnCount = _properties.fixedColumnCount,
            fixedRowCount = _properties.fixedRowCount;


        var delta = void 0;
        var pxDelta = 0;

        // scroll only if target not in fixed columns
        if (c >= fixedColumnCount) {
            delta = c - origin.x;
            // target is to left of scrollable columns; negative delta scrolls left
            if (delta < 0) {
                pxDelta = 0;
                for (var i = 0; i <= Math.abs(delta) + 1; i++) {
                    pxDelta += this.getColumnWidth(origin.x - i);
                }

                this.sbHScroller.index -= pxDelta;
            }

            delta = c - corner.x;
            if (delta >= 0) {
                pxDelta = 0;
                // scroll more than just one cut column
                for (var _i = 0; _i <= Math.abs(delta) + 2; _i++) {
                    pxDelta += this.getColumnWidth(corner.x - _i);
                }

                this.sbHScroller.index += pxDelta;
            }
        }

        if (this.sbHScroller.index <= this.getColumnWidth(0)) {
            this.sbHScroller.index = 0;
        }

        // scroll only if target not in fixed rows
        if (r >= fixedRowCount) {
            delta = r - origin.y;
            // target is above scrollable rows; negative delta scrolls up
            if (delta < 0) {
                var deltaPercent = (Math.abs(delta) + 2) / this.getRowCount();
                pxDelta = this.sbVScroller.max * deltaPercent;

                if (pxDelta < this.properties.defaultRowHeight * 3) {
                    this.sbVScroller.index -= pxDelta;
                } else {
                    delta = r - corner.y;

                    var _deltaPercent = (Math.abs(delta) + 2) / this.getRowCount();
                    pxDelta = this.sbVScroller.max * _deltaPercent;
                    this.sbVScroller.index -= pxDelta;
                }
            }

            delta = r - corner.y;
            if (delta >= 0) {
                var _deltaPercent2 = (delta + 2) / this.getRowCount();
                pxDelta = this.sbVScroller.max * _deltaPercent2;

                if (pxDelta < this.properties.defaultRowHeight * 3) {
                    this.sbVScroller.index += pxDelta;
                } else {
                    delta = origin.y - r;

                    var _deltaPercent3 = (Math.abs(delta) + 2) / this.getRowCount();
                    pxDelta = this.sbVScroller.max * _deltaPercent3;
                    this.sbVScroller.index += pxDelta;
                }
            }
        }

        if (this.sbVScroller.index <= this.getRowHeight(0)) {
            this.sbVScroller.index = 0;
        }
    },

    selectCellAndScrollToMakeVisible: function(c, r) {
        this.scrollToMakeVisible(c, r);
        this.selectCell(c, r, true);
    },

    /**
     * @summary binary search of cell with needed scroll parameters
     * @param scrollValue - scroll value in pixels
     * @param from - first cell index for searching
     * @param to - last cell index for searching
     * @param checkFunction - function for checking height of horizontal or certical scroll
     */
    findCellByScrollValue: function(scrollValue, from, to, checkFunction) {
        var search = Math.round((from + to) / 2);

        if (search === from || search === to) {
            return from;
        }

        var currentHeight = checkFunction.call(this.behavior, search);

        if (currentHeight > scrollValue) {
            return this.findCellByScrollValue(scrollValue, from, search, checkFunction);
        } else {
            return this.findCellByScrollValue(scrollValue, search, to, checkFunction);
        }
    },

    /**
     * @memberOf Hypergrid#
     * @desc Set the vertical scroll value.
     * @param {number} newValue - The new scroll value.
     */
    setVScrollValue: function(y) {
        /*var self = this;
        y = Math.min(this.sbVScroller.range.max, Math.max(0, Math.round(y)));
        if (y !== this.vScrollValue) {
            this.behavior.setScrollPositionY(y);
            this.behavior.changed();
            var oldY = this.vScrollValue;
            this.vScrollValue = y;
            this.scrollValueChangedNotification();
            setTimeout(function() {
                // self.sbVRangeAdapter.subjectChanged();
                self.fireScrollEvent('fin-scroll-y', oldY, y);
            });
        }*/
        var _this = this;

        y = Math.min(this.sbVScroller.range.max, Math.max(0, Math.round(y)));
        if (y !== this.vScrollValue) {
            this.behavior.setScrollPositionY(y);
            this.behavior.changed();
            var oldY = this.vScrollValue;

            this.vScrollValue = y;
            this.scrollValueChangedNotification();
            setTimeout(function () {
                // self.sbVRangeAdapter.subjectChanged();
                _this.fireScrollEvent('fin-scroll-y', oldY, y);
            });
        }
        // update scrollbar
        if (this.sbVScroller.index !== y) {
            this.sbVScroller.index = y;
        }
    },

    /**
     * @memberOf Hypergrid#
     * @return {number} The vertical scroll value.
     */
    getVScrollValue: function() {
        //return this.vScrollValue;
        return this.findCellByScrollValue(this.vScrollValue, 0, this.getRowCount(), this.behavior.getRowsHeight);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Set the horizontal scroll value.
     * @param {number} newValue - The new scroll value.
     */
    setHScrollValue: function(x) {
        /*var self = this;
        x = Math.min(this.sbHScroller.range.max, Math.max(0, Math.round(x)));
        if (x !== this.hScrollValue) {
            this.behavior.setScrollPositionX(x);
            this.behavior.changed();
            var oldX = this.hScrollValue;
            this.hScrollValue = x;
            this.scrollValueChangedNotification();
            setTimeout(function() {
                //self.sbHRangeAdapter.subjectChanged();
                self.fireScrollEvent('fin-scroll-x', oldX, x);
                //self.synchronizeScrollingBoundries(); // todo: Commented off to prevent the grid from bouncing back, but there may be repercussions...
            });
        }*/
        var self = this;
        x = Math.min(this.sbHScroller.range.max, Math.max(0, Math.round(x)));
        if (x !== this.hScrollValue) {
            this.behavior.setScrollPositionX(x);
            this.behavior.changed();
            var oldX = this.hScrollValue;
            this.hScrollValue = x;
            this.scrollValueChangedNotification();

            if (this.sbHScroller) {
                this.sbHScroller.index = x;
            }

            setTimeout(function () {
                //self.sbHRangeAdapter.subjectChanged();
                self.fireScrollEvent('fin-scroll-x', oldX, x);
                //self.synchronizeScrollingBoundaries(); // todo: Commented off to prevent the grid from bouncing back, but there may be repercussions...
            });
        }
        // update scrollbar
        if (this.sbHScroller.index !== x) {
            this.sbHScroller.index = x;
        }
    },

    /**
     * @memberOf Hypergrid#
     * @returns The vertical scroll value.
     */
    getHScrollValue: function() {
        //return this.hScrollValue;
        return this.findCellByScrollValue(this.hScrollValue, 0, this.getColumnCount(), this.behavior.getColumnsWidth);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Initialize the scroll bars.
     */
    initScrollbars: function() {
        if (this.sbHScroller && this.sbVScroller){
            return;
        }

        var self = this;

        var horzBar = new Scrollbar({
            orientation: 'horizontal',
            //deltaXFactor: this.constructor.defaults.wheelHFactor,
            onBarVisibilityChanged: function onBarVisibilityChanged(isVisible) {
                self.properties.canvasHeightOffset = isVisible ? Number(window.getComputedStyle(this.mountDiv).height.replace('px', '')) : 0;
                self.canvas.resize(false);
            },
            onchange: self.setHScrollValue.bind(self),
            cssStylesheetReferenceElement: this.div,
            paging: {
                up: self.pageLeft.bind(self),
                down: self.pageRight.bind(self)
            }
        });

        var vertBar = new Scrollbar({
            orientation: 'vertical',
            //deltaYFactor: this.constructor.defaults.wheelVFactor,
            onBarVisibilityChanged: function onBarVisibilityChanged(isVisible) {
                self.properties.canvasWidthOffset = isVisible ? Number(window.getComputedStyle(this.mountDiv).width.replace('px', '')) : 0;
                self.canvas.resize(false);
            },
            onchange: self.setVScrollValue.bind(self),
            //cssStylesheetReferenceElement: this.div,
            paging: {
                up: self.pageUp.bind(self),
                down: self.pageDown.bind(self)
            }
        });

        this.sbHScroller = horzBar;
        this.sbVScroller = vertBar;

        var hPrefix = this.properties.hScrollbarClassPrefix;
        var vPrefix = this.properties.vScrollbarClassPrefix;

        if (hPrefix && hPrefix !== '') {
            this.sbHScroller.classPrefix = hPrefix;
        }

        if (vPrefix && vPrefix !== '') {
            this.sbVScroller.classPrefix = vPrefix;
        }

        //this.div.appendChild(horzBar.bar);
        //this.div.appendChild(vertBar.bar);

        //this.resizeScrollbars();
        this.div.appendChild(horzBar.mountDiv);
        this.div.appendChild(vertBar.mountDiv);

        this.synchronizeScrollbarsVisualization();
    },

    destroyScrollbars: function destroyScrollbars() {
        if (this.sbHScroller) {
            this.sbHScroller.remove();
            delete this.sbHScroller;
        }
        if (this.sbVScroller) {
            this.sbVScroller.remove();
            delete this.sbVScroller;
        }
    },

    synchronizeScrollbarsVisualization: function synchronizeScrollbarsVisualization() {
        if (this.sbHScroller) {
            this.sbHScroller.shortenEndByValue('leading', this.getHScrollbarLeftMargin()).shortenEndByValue('trailing', this.getHScrollbarRightMargin() - 1).resize(null, null, this.getFullContentWidth());

            this.sbHScroller.style = this.properties.scrollbarHStyle;
            this.sbHScroller.thumbStyle = this.properties.scrollbarHThumbStyle;
            this.sbHScroller.mountStyle = this.properties.scrollbarHMountStyle;
        }
        if (this.sbVScroller) {
            this.sbVScroller.shortenEndByValue('leading', this.getVScrollbarTopMargin()).shortenEndByValue('trailing', this.getVScrollbarBottomMargin() - 1).resize(null, null, this.getFullContentHeight());

            this.sbVScroller.style = this.properties.scrollbarVStyle;
            this.sbVScroller.thumbStyle = this.properties.scrollbarVThumbStyle;
            this.sbVScroller.mountStyle = this.properties.scrollbarVMountStyle;
        }
    },

    getHScrollbarLeftMargin: function getHScrollbarLeftMargin() {
        var res = 0;
        var visibleColumns = this.renderer.visibleColumns;
        res -= this.properties.gridLinesV ? this.properties.gridLinesWidth : 0;
        res += this.properties.gridBorderLeft ? this.properties.gridLinesWidth : 0;

        var neededColumn = visibleColumns[this.behavior.rowColumnIndex];
        res += this.properties.rowHeaderNumbers && neededColumn ? neededColumn.right : 0;

        for (var i = 0; i < this.properties.fixedColumnCount; i++) {
            if (i !== this.behavior.rowColumnIndex) {
                res += this.getColumnWidth(i);
            }
        }

        res += this.properties.fixedColumnCount ? this.properties.fixedLinesVWidth : 0;

        return res;
    },

    getHScrollbarRightMargin: function getHScrollbarRightMargin() {
        var res = -1;

        if (this.properties.scrollbarVStyle && this.properties.scrollbarVStyle.width) {
            res += this.properties.scrollbarVStyle.width;
        }

        return res;
    },

    getVScrollbarTopMargin: function getVScrollbarTopMargin() {

        var res = void 0;
        var rowIndex = this.properties.fixedRowCount;

        var row = this.renderer.visibleRows[rowIndex];
        if (!row) {
            row = this.renderer.visibleRows[0];
        }
        res = row ? row.bottom : 0;

        res -= this.properties.gridLinesH ? this.properties.gridLinesWidth : 0;

        res += this.properties.fixedRowCount ? this.properties.fixedLinesHWidth : 0;

        res += this.properties.gridBorderTop ? this.properties.fixedLinesHWidth : 0;

        // to fully implement google sheets style
        res += 1;

        return res;
    },

    getVScrollbarBottomMargin: function getVScrollbarBottomMargin() {
        var res = -1;

        if (this.properties.scrollbarHStyle && this.properties.scrollbarHStyle.height) {
            res += this.properties.scrollbarHStyle.height;
        }

        return res;
    },

    getFullContentWidth: function getFullContentWidth() {
        var res = 0;

        for (var i = 0; i <= this.getColumnCount(); i++) {
            res += this.getColumnWidth(i);
        }

        return res;
    },
    getFullContentHeight: function getFullContentHeight() {
        var res = 0;

        /*for (var i = 0; i <= this.getRowCount(); i++) {
            res += this.getRowHeight(i);
        }*/

        res = (this.getRowCount() + 1) * this.properties.defaultRowHeight;
        return res;
    },

    resizeScrollbars: function() {
        this.sbHScroller.shortenBy(this.sbVScroller).resize();
        //this.sbVScroller.shortenBy(this.sbHScroller);
        this.sbVScroller.resize();
    },

    /**
     * @memberOf Hypergrid#
     * @desc Scroll values have changed, we've been notified.
     */
    setVScrollbarValues: function(max) {
        this.sbVScroller.range = {
            min: 0,
            max: max
        };
    },

    setHScrollbarValues: function(max) {
        this.sbHScroller.range = {
            min: 0,
            max: max
        };
    },

    scrollValueChangedNotification: function() {
        if (
            this.hScrollValue !== this.sbPrevHScrollValue ||
            this.vScrollValue !== this.sbPrevVScrollValue
        ) {
            this.sbPrevHScrollValue = this.hScrollValue;
            this.sbPrevVScrollValue = this.vScrollValue;

            if (this.cellEditor) {
                this.cellEditor.scrollValueChangedNotification();
            }

            if (this.properties.onScrollEndLimitTrigger > 0 && this.sbVScroller.range.max - this.vScrollValue < this.properties.onScrollEndLimitTrigger) {
                // datadoc infinite scroll
                if (this.api.datasource && !this.scrollTriggered) {
                    this.api.setDatasource(this.api.datasource);
                }
                this.scrollTriggered = true;
            } else {
                this.scrollTriggered = false;
            }

            this.computeCellsBounds();
        }
    },

    /**
     * @memberOf Hypergrid#
     * @desc The data dimensions have changed, or our pixel boundaries have changed.
     * Adjust the scrollbar properties as necessary.
     */
    synchronizeScrollingBoundaries: function() {
        /*var bounds = this.getBounds();
        if (!bounds) {
            return;
        }

        var numFixedColumns = this.getFixedColumnCount(),
            numColumns = this.getColumnCount(),
            numRows = this.getRowCount(),
            scrollableWidth = bounds.width - this.behavior.getFixedColumnsMaxWidth(),
            gridProps = this.properties,
            borderBox = gridProps.boxSizing === 'border-box',
            lineGap = borderBox ? 0 : gridProps.gridLinesVWidth;

        for (
            var columnsWidth = 0, lastPageColumnCount = 0;
            lastPageColumnCount < numColumns && columnsWidth < scrollableWidth;
            lastPageColumnCount++
        ) {
            columnsWidth += this.getColumnWidth(numColumns - lastPageColumnCount - 1) + lineGap;
        }
        if (columnsWidth > scrollableWidth) {
            lastPageColumnCount--;
        }

        var scrollableHeight = this.renderer.getVisibleScrollHeight();
        lineGap = borderBox ? 0 : gridProps.gridLinesHWidth;

        for (
            var rowsHeight = 0, lastPageRowCount = 0;
            lastPageRowCount < numRows && rowsHeight < scrollableHeight;
            lastPageRowCount++
        ) {
            rowsHeight += this.getRowHeight(numRows - lastPageRowCount - 1) + lineGap;
        }
        if (rowsHeight > scrollableHeight) {
            lastPageRowCount--;
        }

        // inform scroll bars
        if (this.sbHScroller) {
            var hMax = Math.max(0, numColumns - numFixedColumns - lastPageColumnCount);
            this.setHScrollbarValues(hMax);
            this.setHScrollValue(Math.min(this.getHScrollValue(), hMax));
        }
        if (this.sbVScroller) {
            var vMax = Math.max(0, numRows - gridProps.fixedRowCount - lastPageRowCount);
            this.setVScrollbarValues(vMax);
            this.setVScrollValue(Math.min(this.getVScrollValue(), vMax));
        }

        this.computeCellsBounds();

        // schedule to happen *after* the repaint
        setTimeout(this.resizeScrollbars.bind(this));
        */
        var numColumns = this.getColumnCount();
        var numRows = this.getRowCount();

        var bounds = this.getBounds();
        if (!bounds) {
            return;
        }

        var scrollableWidth = bounds.width - this.behavior.getFixedColumnsMaxWidth();
        for (var columnsWidth = 0, lastPageColumnCount = 0; lastPageColumnCount < numColumns && columnsWidth < scrollableWidth; lastPageColumnCount++) {
            columnsWidth += this.getColumnWidth(numColumns - lastPageColumnCount - 1);
        }
        if (columnsWidth > scrollableWidth) {
            lastPageColumnCount--;
        }

        var scrollableHeight = this.renderer.getVisibleScrollHeight();
        for (var rowsHeight = 0, lastPageRowCount = 0; lastPageRowCount < numRows && rowsHeight < scrollableHeight; lastPageRowCount++) {
            rowsHeight += this.getRowHeight(numRows - lastPageRowCount - 1);
        }
        if (rowsHeight > scrollableHeight) {
            lastPageRowCount--;
        }

        // inform scroll bars
        if (this.sbHScroller) {
            var hMax = Math.max(0, this.behavior.getColumnsWidth(this.behavior.getActiveColumnCount() - lastPageColumnCount + 1) - this.behavior.getFixedColumnsWidth());
            hMax += this.behavior.getColumnWidth(this.behavior.getActiveColumnCount());
            this.setHScrollbarValues(hMax);
            this.setHScrollValue(Math.min(this.hScrollValue, hMax));
        }
        if (this.sbVScroller) {
            var vMax = Math.max(0, this.behavior.getRowsHeight(this.behavior.getRowCount() - lastPageRowCount + 2) - this.behavior.getFixedRowsHeight()); // todo determine why 2
            this.setVScrollbarValues(vMax);
            this.setVScrollValue(Math.min(this.vScrollValue, vMax));
        }

        this.computeCellsBounds();

        // schedule to happen *after* the repaint
        setTimeout(this.synchronizeScrollbarsVisualization.bind(this));
    },

    /**
     * @memberOf Hypergrid#
     * @desc Scroll up one full page.
     * @returns {number}
     */
    pageUp: function() {
        /*var rowNum = this.renderer.getPageUpRow();
        this.setVScrollValue(rowNum);
        return rowNum;*/
        var rowNum = this.renderer.getPageUpRow();
        var rowNumPixels = this.behavior.getRowsHeight(rowNum);
        this.setVScrollValue(rowNumPixels);
        return rowNumPixels;
    },

    /**
     * @memberOf Hypergrid#
     * @desc Scroll down one full page.
     * @returns {number}
     */
    pageDown: function() {
        /*var rowNum = this.renderer.getPageDownRow();
        this.setVScrollValue(rowNum);
        return rowNum;*/
        var rowNum = this.renderer.getPageDownRow();
        var rowNumPixels = this.behavior.getRowsHeight(rowNum);
        this.setVScrollValue(rowNumPixels);
        return rowNumPixels;
    },

    /**
     * @memberOf Hypergrid#
     * @desc Not yet implemented.
     */
    pageLeft: function() {
        //throw 'page left not yet implemented';
        var bounds = this.getBounds();
        var currentScroll = this.behavior.getScrollPositionX();
        var scrollableWidth = bounds.width - this.behavior.getFixedColumnsMaxWidth();
        var leftPixel = currentScroll - scrollableWidth;
        this.setHScrollValue(leftPixel);
        return leftPixel;
    },

    /**
     * @memberOf Hypergrid#
     * @desc Not yet implemented.
     */
    pageRight: function() {
        //throw 'page right not yet implemented';
        var bounds = this.getBounds();
        var currentScroll = this.behavior.getScrollPositionX();
        var scrollableWidth = bounds.width - this.behavior.getFixedColumnsMaxWidth();
        var rightPixel = currentScroll + scrollableWidth;
        this.setHScrollValue(rightPixel);
        return rightPixel;
    }
};
