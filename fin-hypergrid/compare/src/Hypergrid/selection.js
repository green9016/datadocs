/* eslint-env browser */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Rectangle = require('rectangular').Rectangle;

/**
 * Hypergrid/index.js mixes this module into its prototype.
 * @mixin
 */
exports.mixin = {
    selectionInitialize: function selectionInitialize() {
        var grid = this;

        /** for use by fin-selection-changed, fin-row-selection-changed, fin-column-selection-changed
         * @memberOf Hypergrid#
         * @private
         */
        this.selectionDetailGetters = {
            get rows() {
                return grid.getSelectedRows();
            },
            get columns() {
                return grid.getSelectedColumns();
            },
            get selections() {
                return grid.selectionModel.getSelections();
            }
        };

        /**
         * for use by fin-context-menu, fin-mouseup, fin-mousedown
         * @memberOf Hypergrid#
         * @private
         */
        this.selectionDetailGetterDescriptors = Object.getOwnPropertyDescriptors(this.selectionDetailGetters);
    },

    /**
     * @memberOf Hypergrid#
     * @returns {boolean} We have any selections.
     */
    hasSelections: function hasSelections() {
        if (!this.getSelectionModel) {
            return; // were not fully initialized yet
        }
        return this.selectionModel.hasSelections();
    },

    /**
     * @memberOf Hypergrid#
     * @returns {string} Tab separated value string from the selection and our data.
     */
    getSelectionAsTSV: function getSelectionAsTSV() {
        var sm = this.selectionModel;
        if (sm.hasSelections()) {
            return this.getMatrixSelectionAsTSV(this.getSelectionMatrix());
        } else if (sm.hasRowSelections()) {
            return this.getMatrixSelectionAsTSV(this.getRowSelectionMatrix());
        } else if (sm.hasColumnSelections()) {
            return this.getMatrixSelectionAsTSV(this.getColumnSelectionMatrix());
        }
    },

    getMatrixSelectionHtmlStyles: function getMatrixSelectionHtmlStyles(props) {
        return '<style type="text/css">\ntable {\nborder-collapse: collapse;\nfont: 13px "Helvetica Neue",Helvetica,Arial,sans-serif;\n}\ntd {\nborder: ' + props.gridLinesWidth + 'px solid ' + props.gridLinesColor + ';\nmax-width: ' + props.maximumColumnWidth + 'px;\npadding: ' + props.cellPadding + 'px ' + props.cellPaddingLeft + 'px;\n}\na {\ncolor: ' + props.linkColor + ';\ntext-decoration: underline;\n}\n.header {\nfont: ' + props.columnHeaderFontBold + ';\n}\n.prefix {\nfont: ' + props.columnTitlePrefixFont + ';\ncolor: ' + props.columnTitlePrefixColor + ';\npadding-right: ' + props.columnTitlePrefixRightSpace + 'px;\n}\n.postfix {\ncolor: ' + props.cellValuePostfixColor + ';\nfont: ' + props.cellValuePostfixFont + ';\npadding-left: ' + props.cellValuePostfixLeftOffset + 'px;\n}\nmark {\nbackground-color: ' + props.highlightColor + '\n}\n</style>';
    },

    getMatrixSelectionAsTSV: function getMatrixSelectionAsTSV(selections) {
        var text = '';
        var html = '';

        // only use the data from the last selection
        if (selections.length) {

            var props = this.properties;

            html = this.getMatrixSelectionHtmlStyles(props) + '<table>';

            var width = selections.length,
                height = selections[0].length,
                lastCol = width - 1,

            //Whitespace will only be added on non-singular rows, selections
            whiteSpaceDelimiterForRow = height > 1 ? '\n' : '';

            for (var h = 0; h < height; h++) {
                for (var w = 0; w < width; w++) {
                    var val = selections[w][h];

                    var _text = (typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'object' ? val.text : val;
                    text += (_text || '') + (w < lastCol ? '\t' : whiteSpaceDelimiterForRow);

                    if (w === 0) {
                        html += '<tr>';
                    }
                    var _html = (typeof val === 'undefined' ? 'undefined' : _typeof(val)) === 'object' ? val.html : val;
                    if (_html !== undefined) {
                        html += '<td ' + (val.colspan ? 'colspan="' + (val.colspan + 1) + '"' : '') + ' ' + (val.rowspan ? 'rowspan="' + (val.rowspan + 1) + '"' : '') + '>' + (_html || '') + '</td>';
                        if (w === lastCol) {
                            html += '</tr>';
                        }
                    }
                }
            }

            html += '</table>';
        }

        return { text: text, html: html };
    },

    /**
     * @memberOf Hypergrid#
     * @desc Clear all the selections.
     */
    clearSelections: function clearSelections() {
        this.selectionModel.clear(this.properties.keepRowSelections);
        this.clearMouseDown();
    },

    /**
     * @memberOf Hypergrid#
     * @desc Clear the most recent selection.
     */
    clearMostRecentSelection: function clearMostRecentSelection() {
        this.selectionModel.clearMostRecentSelection(this.properties.keepRowSelections);
    },

    /**
     * @memberOf Hypergrid#
     * @desc Clear the most recent column selection.
     */
    clearMostRecentColumnSelection: function clearMostRecentColumnSelection() {
        this.selectionModel.clearMostRecentColumnSelection();
    },

    /**
     * @memberOf Hypergrid#
     * @desc Clear the most recent row selection.
     */
    clearMostRecentRowSelection: function clearMostRecentRowSelection() {
        this.selectionModel.clearMostRecentRowSelection();
    },

    clearRowSelection: function clearRowSelection() {
        this.selectionModel.clearRowSelection();
    },

    /**
     * @memberOf Hypergrid#
     * @summary Select given region.
     * @param {number} ox - origin x
     * @param {number} oy - origin y
     * @param {number} ex - extent x
     * @param {number} ex - extent y
     */
    select: function select(ox, oy, ex, ey) {
        if (ox < 0 || oy < 0) {
            //we don't select negative area
            //also this means there is no origin mouse down for a selection rect
            return;
        }
        this.selectionModel.select(ox, oy, ex, ey);
    },

    /**
     * @memberOf Hypergrid#
     * @returns {boolean} Given point is selected.
     * @param {number} x - The horizontal coordinate.
     * @param {number} y - The vertical coordinate.
     */
    isSelected: function isSelected(x, y) {
        return this.selectionModel.isSelected(x, y);
    },

    /**
     * @memberOf Hypergrid#
     * @returns {boolean} The given column is selected anywhere in the entire table.
     * @param {number} y - The row index.
     */
    isCellSelectedInRow: function isCellSelectedInRow(y) {
        return this.selectionModel.isCellSelectedInRow(y);
    },

    /**
     * @memberOf Hypergrid#
     * @returns {boolean} The given row is selected anywhere in the entire table.
     * @param {number} x - The column index.
     */
    isCellSelectedInColumn: function isCellSelectedInColumn(x) {
        return this.selectionModel.isCellSelectedInColumn(x);
    },

    /**
     * @param {boolean|number[]|string[]} [hiddenColumns=false] - _Per {@link Hypergrid~getColumns}._
     * @returns {{}}
     * @memberOf Hypergrid#
     */
    getRowSelection: function getRowSelection(hiddenColumns) {
        var dataModel = this.behavior.dataModel,
            selectedRowIndexes = this.selectionModel.getSelectedRows(),
            columns = getColumns.call(this, hiddenColumns),
            result = {};

        for (var c = 0, C = columns.length; c < C; c++) {
            var column = columns[c],
                rows = result[column.name] = new Array(selectedRowIndexes.length);
            selectedRowIndexes.forEach(getValue);
        }

        function getValue(selectedRowIndex, j) {
            var dataRow = dataModel.getRow(selectedRowIndex);
            rows[j] = valOrFunc(dataRow, column);
        }

        return result;
    },

    /**
     * @param {boolean|number[]|string[]} [hiddenColumns=false] - _Per {@link Hypergrid~getColumns}._
     * @returns {Array}
     * @memberOf Hypergrid#
     */
    getRowSelectionMatrix: function getRowSelectionMatrix(hiddenColumns) {
        var dataModel = this.behavior.dataModel,
            selectedRowIndexes = this.selectionModel.getSelectedRows(),
            columns = getColumns.call(this, hiddenColumns),
            result = new Array(columns.length);

        for (var c = 0, C = columns.length; c < C; c++) {
            var column = columns[c];
            result[c] = new Array(selectedRowIndexes.length);
            selectedRowIndexes.forEach(getValue);
        }

        function getValue(selectedRowIndex, r) {
            var dataRow = dataModel.getRow(selectedRowIndex);
            result[c][r] = valOrFunc(dataRow, column);
        }

        return result;
    },

    getColumnSelectionMatrix: function getColumnSelectionMatrix() {
        var behavior = this.behavior,
            dataModel = behavior.dataModel,
            headerRowCount = this.getHeaderRowCount(),
            selectedColumnIndexes = this.getSelectedColumns(),
            numRows = this.getRowCount(),
            result = new Array(selectedColumnIndexes.length);

        selectedColumnIndexes.forEach(function (selectedColumnIndex, c) {
            var column = behavior.getActiveColumn(selectedColumnIndex),
                values = result[c] = new Array(numRows);

            for (var r = headerRowCount; r < numRows; r++) {
                var dataRow = dataModel.getRow(r);
                values[r] = valOrFunc(dataRow, column);
            }
        });

        return result;
    },

    getColumnSelection: function getColumnSelection() {
        var behavior = this.behavior,
            dataModel = behavior.dataModel,
            headerRowCount = this.getHeaderRowCount(),
            selectedColumnIndexes = this.getSelectedColumns(),
            result = {},
            rowCount = this.getRowCount();

        selectedColumnIndexes.forEach(function (selectedColumnIndex) {
            var column = behavior.getActiveColumn(selectedColumnIndex),
                values = result[column.name] = new Array(rowCount);

            for (var r = headerRowCount; r < rowCount; r++) {
                var dataRow = dataModel.getRow(r);
                values[r] = valOrFunc(dataRow, column);
            }
        });

        return result;
    },

    getSelection: function getSelection() {
        var behavior = this.behavior,
            dataModel = behavior.dataModel,
            selections = this.getSelections(),
            rects = new Array(selections.length);

        selections.forEach(getRect);

        function getRect(selectionRect, i) {
            var rect = normalizeRect(selectionRect),
                colCount = rect.extent.x + 1,
                rowCount = rect.extent.y + 1,
                columns = {};

            for (var c = 0, x = rect.origin.x; c < colCount; c++, x++) {
                var column = behavior.getActiveColumn(x),
                    values = columns[column.name] = new Array(rowCount);

                for (var r = 0, y = rect.origin.y; r < rowCount; r++, y++) {
                    var dataRow = dataModel.getRow(y);
                    values[r] = valOrFunc(dataRow, column);
                }
            }

            rects[i] = columns;
        }

        return rects;
    },

    getSelectionMatrix: function getSelectionMatrix() {
        var _this = this;

        var behavior = this.behavior,
            dataModel = this.behavior.dataModel;

        var selections = this.getSelections();

        var selectionRect = normalizeRect(selections[selections.length - 1]);

        var colCount = selectionRect.extent.x + 1;
        var rowCount = selectionRect.extent.y + 1;
        var rows = [];

        var _loop = function _loop(c, x) {
            var colProps = behavior.getColumnProperties(x);
            var columnName = dataModel.getColumnName(x);
            var searchType = behavior.getColumn(x).searchType;
            var isAggregationTreeColumn = columnName === '$$aggregation';
            var values = rows[c] = new Array(rowCount);
            var alreadyCopied = [];

            var getHeaderValue = function getHeaderValue(x, y) {
                alreadyCopied.push(y);
                if (dataModel.isRenderSkipNeeded(x, y)) {
                    return { text: '' }; // no 'html' key because this cell will be merged with another onw
                } else {
                    var text = '';
                    var html = '';

                    // add prefix
                    if (colProps.colDef && colProps.colDef.headerPrefix && !dataModel.getDefinedCellProperties(x, y).ignoreValuePrefix) {
                        text += colProps.colDef.headerPrefix + ' ';
                        html += '<span class="prefix">' + colProps.colDef.headerPrefix + '</span> ';
                    }

                    // add value
                    var val = (dataModel.getValue(x, y) || '').trim();
                    text += val;
                    html += '<span class="header">' + val + '</span>';

                    // add postfix
                    var postfix = dataModel.getCount(x, y);
                    if (postfix) {
                        text += ' (' + postfix + ')';
                        html += ' <span class="postfix">(' + postfix + ')</span>';
                    }

                    return {
                        text: text.trim(),
                        html: '<div>' + html + '</div>',
                        colspan: dataModel.getColspan(x, y),
                        rowspan: dataModel.getRowspan(x, y)
                    };
                }
            };

            for (var r = 0, y = selectionRect.origin.y; r < rowCount; r++, y++) {
                if (behavior.getRowProperties(y).headerRow) {
                    values[r] = getHeaderValue(x, y);
                } else {
                    var val = dataModel.getValue(x, y);

                    if (val || val === false || val === 0 || val === null) {
                        var color = _this.properties[isAggregationTreeColumn ? 'linkColor' : 'color'];

                        var text = '';
                        var html = '';

                        // add value
                        var isValueUrl = dataModel.isValueUrl(val);
                        val = _this.formatValue(columnName, val, false);
                        if (_this.properties.highLightText && searchType) {
                            val = dataModel.getHighlightedValue(val, _this.properties.highLightText, searchType);
                        }
                        text += val;
                        html += '<span style="color: ' + color + '; ' + (isAggregationTreeColumn ? 'text-decoration: underline;' : '') + '">' + (isValueUrl ? '<a href="' + val + '">' + val + '</a>' : val) + '</span>';

                        // add postfix
                        var postfix = isAggregationTreeColumn ? behavior.getAggregationChildCountByIndex(y) : dataModel.getCount(x, y);
                        if (postfix) {
                            text += ' (' + postfix + ')';
                            html += '<span class="postfix">(' + postfix + ')</span>';
                        }

                        values[r] = {
                            text: text.trim(),
                            html: '<div style="text-align: ' + (colProps.halign || 'left') + '">' + html + '</div>'
                        };
                    } else {
                        values[r] = '';
                    }
                }
            }

            if (_this.copyIncludeHeaders) {
                var _y = 0;
                var headerValues = [];

                while (behavior.getRowProperties(_y).headerRow) {
                    if (!alreadyCopied.includes(_y)) {
                        headerValues.push(getHeaderValue(x, _y));
                    }
                    ++_y;
                }

                if (headerValues.length > 0) {
                    [].unshift.apply(values, headerValues);
                }
            }
        };

        for (var c = 0, x = selectionRect.origin.x; c < colCount; c++, x++) {
            _loop(c, x);
        }

        return rows;
    },

    selectCell: function selectCell(x, y, silent) {
        this.selectionModel.clear(this.properties.keepRowSelections);
        this.selectionModel.select(x, y, 0, 0, silent);
    },

    toggleSelectColumn: function toggleSelectColumn(x, keys) {
        keys = keys || [];
        var model = this.selectionModel;
        var alreadySelected = model.isColumnSelected(x);
        var hasCTRL = keys.indexOf('CTRL') > -1;
        var hasSHIFT = keys.indexOf('SHIFT') > -1;

        if (!hasCTRL && !hasSHIFT) {
            model.clear();
            if (!alreadySelected) {
                model.selectColumn(x);
            }
        } else {
            if (hasCTRL) {
                if (alreadySelected) {
                    model.deselectColumn(x);
                } else {
                    model.selectColumn(x);
                }
            }

            if (hasSHIFT) {
                model.clear();
                model.selectColumn(this.lastEdgeSelection[0], x);
            }
        }
        if (!alreadySelected && !hasSHIFT) {
            this.lastEdgeSelection[0] = x;
        }
        this.repaint();
        this.fireSyntheticColumnSelectionChangedEvent();
    },

    toggleSelectRow: function toggleSelectRow(y, keys) {
        //we can select the totals rows if they exist, but not rows above that
        keys = keys || [];

        var model = this.selectionModel;
        var hasSHIFT = keys.indexOf('SHIFT') > -1;
        var hasCTRL = keys.indexOf('CTRL') > -1;

        if (!hasCTRL && !hasSHIFT) {
            model.clear();

            model.selectRow(y);
        } else {
            if (hasCTRL) {
                model.selectRow(y);
            }

            if (hasSHIFT) {
                model.clear();
                model.selectRow(this.lastEdgeSelection[1], y);
            }
        }

        if (!hasSHIFT) {
            this.lastEdgeSelection[1] = y;
        }

        this.repaint();
        this.fireSyntheticRowSelectionChangedEvent();
    },

    singleSelect: function singleSelect() {
        var result = this.properties.singleRowSelectionMode;

        if (result) {
            this.selectionModel.clearRowSelection();
        }

        return result;
    },

    selectViewportCell: function selectViewportCell(x, y) {
        var vc, vr;
        if (this.getRowCount() && (vc = this.renderer.visibleColumns[x]) && (vr = this.renderer.visibleRows[y + this.getHeaderRowCount()])) {
            x = vc.columnIndex;
            y = vr.rowIndex;
            this.clearSelections();
            this.select(x, y, 0, 0);
            this.setMouseDown(this.newPoint(x, y));
            this.setDragExtent(this.newPoint(0, 0));
            this.repaint();
        }
    },

    selectToViewportCell: function selectToViewportCell(x, y) {
        var selections, vc, vr;
        if ((selections = this.getSelections()) && selections.length && (vc = this.renderer.visibleColumns[x]) && (vr = this.renderer.visibleRows[y + this.getHeaderRowCount()])) {
            var origin = selections[0].origin;
            x = vc.columnIndex;
            y = vr.rowIndex;
            this.setDragExtent(this.newPoint(x - origin.x, y - origin.y));
            this.select(origin.x, origin.y, x - origin.x, y - origin.y);
            this.repaint();
        }
    },

    selectToFinalCellOfCurrentRow: function selectToFinalCellOfCurrentRow() {
        this.selectFinalCellOfCurrentRow(true);
    },

    selectFinalCellOfCurrentRow: function selectFinalCellOfCurrentRow(to) {
        if (!this.getRowCount()) {
            return;
        }
        var selections = this.getSelections();
        if (selections && selections.length) {
            var selection = selections[0],
                origin = selection.origin,
                extent = selection.extent,
                columnCount = this.getColumnCount();

            this.scrollBy(columnCount, 0);

            this.clearSelections();
            if (to) {
                this.select(origin.x, origin.y, columnCount - origin.x - 1, extent.y);
            } else {
                this.select(columnCount - 1, origin.y, 0, 0);
            }

            this.repaint();
        }
    },

    selectToFirstCellOfCurrentRow: function selectToFirstCellOfCurrentRow() {
        this.selectFirstCellOfCurrentRow(true);
    },

    selectFirstCellOfCurrentRow: function selectFirstCellOfCurrentRow(to) {
        if (!this.getRowCount()) {
            return;
        }
        var selections = this.getSelections();
        if (selections && selections.length) {
            var selection = selections[0],
                origin = selection.origin,
                extent = selection.extent;

            this.clearSelections();
            if (to) {
                this.select(origin.x, origin.y, -origin.x, extent.y);
            } else {
                this.select(0, origin.y, 0, 0);
            }

            this.setHScrollValue(0);
            this.repaint();
        }
    },

    selectFinalCell: function selectFinalCell() {
        if (!this.getRowCount()) {
            return;
        }
        this.selectCellAndScrollToMakeVisible(this.getColumnCount() - 1, this.getRowCount() - 1);
        this.repaint();
    },

    selectToFinalCell: function selectToFinalCell() {
        if (!this.getRowCount()) {
            return;
        }
        var selections = this.getSelections();
        if (selections && selections.length) {
            var selection = selections[0],
                origin = selection.origin,
                columnCount = this.getColumnCount(),
                rowCount = this.getRowCount();

            this.clearSelections();
            this.select(origin.x, origin.y, columnCount - origin.x - 1, rowCount - origin.y - 1);
            // this.scrollBy(columnCount, rowCount);
            this.repaint();
        }
    },

    /**
     * @memberOf Hypergrid#
     * @returns {object} An object that represents the currently selection row.
     */
    getSelectedRow: function getSelectedRow() {
        var sels = this.selectionModel.getSelections();
        if (sels.length) {
            var behavior = this.behavior,
                colCount = this.getColumnCount(),
                topRow = sels[0].origin.y,
                row = {
                //hierarchy: behavior.getFixedColumnValue(0, topRow)
            };

            for (var c = 0; c < colCount; c++) {
                row[behavior.getActiveColumn(c).header] = behavior.getValue(c, topRow);
            }

            return row;
        }
    },

    /**
     * @memberOf Hypergrid#
     * @desc Synthesize and dispatch a `fin-selection-changed` event.
     */
    selectionChanged: function selectionChanged() {
        // Project the cell selection into the rows
        this.selectRowsFromCells();

        // Project the cell selection into the columns
        this.selectColumnsFromCells();

        // change api data for selected columns
        this.selectColDefsForApi();

        var selectionEvent = new CustomEvent('fin-selection-changed', {
            detail: this.selectionDetailGetters
        });
        this.canvas.dispatchEvent(selectionEvent);
    },

    selectColDefsForApi: function selectColDefsForApi() {
        if (this.visibleColumnDefs) {
            var selectedColumns = this.getSelectedColumns() || [];
            var selections = this.getSelections();

            selections.forEach(function (s) {
                for (var i = s.left; i <= s.right; ++i) {
                    if (!selections.includes(i)) {
                        selectedColumns.push(i);
                    }
                }
            });

            if (selectedColumns.length) {
                this.api.rangeController.selectedCols = this.behavior.getActiveColumns().filter(function (c) {
                    return c.colDef && selectedColumns.includes(c.index);
                });
            } else {
                this.api.rangeController.selectedCols = [];
            }
        } else {
            this.api.rangeController.selectedCols = [];
        }
    },

    isColumnOrRowSelected: function isColumnOrRowSelected() {
        return this.selectionModel.isColumnOrRowSelected();
    },
    selectColumn: function selectColumn(x1, x2) {
        this.selectionModel.selectColumn(x1, x2);
    },
    selectRow: function selectRow(y1, y2) {
        if (this.singleSelect()) {
            y1 = y2;
        } else if (y2 === undefined) {
            // multiple row selection
            y2 = y1;
        }

        this.selectionModel.selectRow(y1, y2);
    },

    selectRowsFromCells: function selectRowsFromCells() {
        if (!this.properties.keepRowSelections && this.properties.autoSelectRows) {
            var last;

            if (!this.properties.singleRowSelectionMode) {
                this.selectionModel.selectRowsFromCells(0, true);
            } else if (last = this.selectionModel.getLastSelection()) {
                this.selectRow(null, last.corner.y);
            } else {
                this.clearRowSelection();
            }
            this.fireSyntheticRowSelectionChangedEvent();
        }
    },
    selectColumnsFromCells: function selectColumnsFromCells() {
        if (this.properties.autoSelectColumns) {
            this.selectionModel.selectColumnsFromCells();
        }
    },
    getSelectedRows: function getSelectedRows() {
        return this.behavior.getSelectedRows();
    },
    getSelectedColumns: function getSelectedColumns() {
        return this.behavior.getSelectedColumns();
    },
    getSelections: function getSelections() {
        return this.behavior.getSelections();
    },
    getLastSelectionType: function getLastSelectionType() {
        return this.selectionModel.getLastSelectionType();
    },
    isInCurrentSelectionRectangle: function isInCurrentSelectionRectangle(x, y) {
        return this.selectionModel.isInCurrentSelectionRectangle(x, y);
    },
    selectAllRows: function selectAllRows() {
        this.selectionModel.selectAllRows();
    },
    areAllRowsSelected: function areAllRowsSelected() {
        return this.selectionModel.areAllRowsSelected();
    },
    toggleSelectAllRows: function toggleSelectAllRows() {
        if (this.areAllRowsSelected()) {
            this.selectionModel.clear();
        } else {
            this.selectAllRows();
        }
        this.repaint();
    },

    /**
     * @summary Move cell selection by offset.
     * @desc Replace the most recent selection with a single cell selection that is moved (offsetX,offsetY) from the previous selection extent.
     * @param {number} offsetX - x offset
     * @param {number} offsetY - y offset
     * @memberOf Hypergrid#
     */
    moveSingleSelect: function moveSingleSelect(offsetX, offsetY) {
        // 11.05.2018 client wants to be able continue cell selection from same point after ctrl+a
        var mouseCorner = this.getMouseDown(); //.plus(this.getDragExtent());
        this.moveToSingleSelect(mouseCorner.x + offsetX, mouseCorner.y + offsetY);
    },

    /**
     * @summary Move cell selection by offset.
     * @desc Replace the most recent selection with a single cell selection that is moved (offsetX,offsetY) from the previous selection extent.
     * @param {number} newX - x coordinate to start at
     * @param {number} newY - y coordinate to start at
     * @memberOf Hypergrid#
     */
    moveToSingleSelect: function moveToSingleSelect(newX, newY) {
        var maxColumns = this.getColumnCount() - 1,
            maxRows = this.getRowCount() - 1,
            maxViewableColumns = this.getVisibleColumnsCount() - 1,
            maxViewableRows = this.getVisibleRowsCount() - 1;

        if (!this.properties.scrollingEnabled) {
            maxColumns = Math.min(maxColumns, maxViewableColumns);
            maxRows = Math.min(maxRows, maxViewableRows);
        }

        newX = Math.min(maxColumns, Math.max(0, newX));
        newY = Math.min(maxRows, Math.max(0, newY));

        this.clearSelections();
        this.select(newX, newY, 0, 0);
        this.setMouseDown(this.newPoint(newX, newY));
        this.setDragExtent(this.newPoint(0, 0));

        this.selectCellAndScrollToMakeVisible(newX, newY);

        this.repaint();
    },

    /** @summary Extend cell selection by offset.
     * @desc Augment the most recent selection extent by (offsetX,offsetY) and scroll if necessary.
     * @param {number} offsetX - x coordinate to start at
     * @param {number} offsetY - y coordinate to start at
     * @memberOf Hypergrid#
     */
    extendSelect: function extendSelect(offsetX, offsetY) {
        var maxColumns = this.getColumnCount() - 1,
            maxRows = this.getRowCount() - 1,
            maxViewableColumns = this.renderer.visibleColumns.length - 1,
            maxViewableRows = this.renderer.visibleRows.length - 1,
            origin = this.getMouseDown(),
            extent = this.getDragExtent(),
            newX = extent.x + offsetX,
            newY = extent.y + offsetY;

        if (!this.properties.scrollingEnabled) {
            maxColumns = Math.min(maxColumns, maxViewableColumns);
            maxRows = Math.min(maxRows, maxViewableRows);
        }

        newX = Math.min(maxColumns - origin.x, Math.max(-origin.x, newX));
        newY = Math.min(maxRows - origin.y, Math.max(-origin.y, newY));

        this.clearMostRecentSelection();

        this.select(origin.x, origin.y, newX, newY);
        this.setDragExtent(this.newPoint(newX, newY));

        var colScrolled = this.insureModelColIsVisible(newX + origin.x, offsetX),
            rowScrolled = this.insureModelRowIsVisible(newY + origin.y, offsetY);

        this.repaint();

        var needScroll = colScrolled || rowScrolled;

        if (needScroll) {
            this.scrollToMakeVisible(newX + origin.x, newY + origin.y);
        }

        return needScroll;
    },

    /**
     * @returns {undefined|CellEvent}
     * @param {boolean} [useAllCells] - Search in all rows and columns instead of only rendered ones.
     * @memberOf Hypergrid#
     */
    getGridCellFromLastSelection: function getGridCellFromLastSelection(useAllCells) {
        var sel = this.selectionModel.getLastSelection();
        return sel && new this.behavior.CellEvent().resetGridXDataY(sel.origin.x, sel.origin.y, null, useAllCells);
    }
};

/**
 * @param {boolean|number[]|string[]} [hiddenColumns=false] - One of:
 * `false` - Active column list
 * `true` - All column list
 * `Array` - Active column list with listed columns prefixed as needed (when not already in the list). Each item in the array may be either:
 * * `number` - index into all column list
 * * `string` - name of a column from the all column list
 * @returns {Column[]}
 * @memberOf Hypergrid~
 */
function getColumns(hiddenColumns) {
    var columns,
        allColumns = this.behavior.getColumns(),
        activeColumns = this.behavior.getActiveColumns();

    if (Array.isArray(hiddenColumns)) {
        columns = [];
        hiddenColumns.forEach(function (index) {
            var key = typeof index === 'number' ? 'index' : 'name',
                column = allColumns.find(function (column) {
                return column[key] === index;
            });
            if (activeColumns.indexOf(column) < 0) {
                columns.push(column);
            }
        });
        columns = columns.concat(activeColumns);
    } else {
        columns = hiddenColumns ? allColumns : activeColumns;
    }

    return columns;
}

function normalizeRect(rect) {
    var o = rect.origin,
        c = rect.corner,
        ox = Math.min(o.x, c.x),
        oy = Math.min(o.y, c.y),
        cx = Math.max(o.x, c.x),
        cy = Math.max(o.y, c.y);

    return new Rectangle(ox, oy, cx - ox, cy - oy);
}

/**
 * @this {dataRowObject}
 * @param column
 * @returns {string}
 */
function valOrFunc(dataRow, column) {
    var result, calculator;
    if (dataRow) {
        result = dataRow[column.name];
        calculator = (typeof result === 'undefined' ? 'undefined' : _typeof(result))[0] === 'f' && result || column.calculator;
        if (calculator) {
            result = calculator(dataRow, column.name);
        }
    }
    if (result.value) {
        return result.value;
    }
    return result || result === 0 || result === false ? result : '';
}
