'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var cellEventProperties = Object.defineProperties({}, { // all props non-enumerable
    /**
     * The raw value of the cell, unformatted.
     * @memberOf CellEvent#
     */
    value: {
        get: function get() {
            return this.subgrid.getValue(this.valueCell.x, this.valueCell.y);
        },
        set: function set(value) {
            this.subgrid.setValue(this.valueCell.x, this.valueCell.y, value);
        }
    },

    /**
     * Shows cell value is a http/https url value
     * @memberOf CellEvent#
     */
    isValueUrl: {
        get: function get() {
            return this.subgrid.isValueUrl(this.value);
        }
    },

    /**
     * An object representing the whole data row, including hidden columns.
     * @type {object}
     * @memberOf CellEvent#
     */
    dataRow: {
        get: function get() {
            return this.subgrid.getRow(this.dataCell.y, this.column.treeLevel);
        }
    },

    /**
     * The colspan value of the cell, unformatted.
     * @memberOf CellEvent#
     */
    colspan: {
        get: function get() {
            return this.subgrid.getColspan(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * The rowspan value of the cell, unformatted.
     * @memberOf CellEvent#
     */
    rowspan: {
        get: function get() {
            return this.subgrid.getRowspan(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * If true, cell will be ignored on render
     * @memberOf CellEvent#
     */
    isRenderSkipNeeded: {
        get: function get() {
            return this.subgrid.isRenderSkipNeeded(this.valueCell.x, this.valueCell.y);
        }
    },

    /**
     * Shows, is cell need to be hidden because of left column
     * @memberOf CellEvent#
     */
    isColspanedByLeftColumn: {
        get: function get() {
            return this.subgrid.isColspanedByLeftColumn(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * Returns index of row, that overlaps current cell
     * @memberOf CellEvent#
     */
    rowspanMainRow: {
        get: function get() {
            return this.subgrid.getRowspanMainRow(this.dataCell.x, this.dataCell.y);
        }
    },

    cellData: {
        get: function get() {
            return this.subgrid._getDataRowObject(this.valueCell.x, this.valueCell.y);
        }
    },

    /**
     * Returns name of column, that overlaps current cell
     * @memberOf CellEvent#
     */
    colspanMainColumnName: {
        get: function get() {
            return this.subgrid.getColspanMainColumnName(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * Returns child colDefs, if cell has it
     * @memberOf CellEvent#
     * @return {array}
     */
    childColumns: {
        get: function get() {
            return this.subgrid.getChildColumnsFromCell(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * Returns boolean value, that shows, is cell has child colDefs
     * @memberOf CellEvent#
     * @return {boolean}
     */
    isExpandableColumn: {
        get: function get() {
            return this.subgrid.getHasChildColumnsFromCell(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * Returns boolean value, that shows, is child columns needed to be shown by default
     * @memberOf CellEvent#
     * @return {boolean}
     */
    isColumnOpenByDefault: {
        get: function get() {
            return this.subgrid.getIsColumnOpenByDefaultFromCell(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * Returns boolean value, that shows, is cell has child colDefs
     * @memberOf CellEvent#
     * @return {boolean}
     */
    isColumnExpanded: {
        get: function get() {
            return this.subgrid.getIsColumnGroupShowFromCell(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * Returns boolean value, that shows, is cell was rowspaned by any row at left
     * @memberOf CellEvent#
     * @return {boolean}
     */
    isRowspanedByRow: {
        get: function get() {
            return this.subgrid.isRowspanedByRow(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * Returns colDefs group id, if exist (if cell represent fictive header)
     * @memberOf CellEvent#
     * @return {number}
     */
    columnGroupId: {
        get: function get() {
            return this.subgrid.getColumnGroupIdFromCell(this.dataCell.x, this.dataCell.y);
        }
    },

    /**
     * The formatted value of the cell.
     * @memberOf CellEvent#
     */
    formattedValue: {
        get: function get() {
            return this._formattedValue || (this._formattedValue = this.grid.formatValue(this.properties.format, this.value, this.rowProperties.headerRow));
        }
    },

    /**
     * @summary The formatted and highlighted value of the cell.
     *  @memberOf CellEvent#
     */
    highlightedChars: {
        get: function get() {
            var highlights = [];

            var highLightText = this.properties.highLightText;

            if (!highLightText) {
                return highlights;
            }

            var searchType = this.column ? this.column.searchType : 'NONE';
            if (searchType === 'NONE' || searchType === undefined) {
                return highlights;
            }

            var str = this.formattedValue;
            if (!str) {
                return highlights;
            }

            var reg = this.subgrid.getHighlightRegex(highLightText, searchType);
            if (!reg) {
                return highlights;
            }

            var m = void 0;
            while ((m = reg.exec(str + '')) != null) {
                highlights.push({ from: m.index, to: m.index + m[0].length });
            }

            return highlights;
        }
    },

    /**
     * The bounds of the cell.
     * @property {number} left
     * @property {number} top
     * @property {number} width
     * @property {number} height
     * @memberOf CellEvent#
     */
    bounds: {
        get: function get() {
            return this._bounds || (this._bounds = {
                x: this.visibleColumn.left,
                y: this.visibleRow.top,
                width: this.visibleColumn.width + (this.colspan ? this.behavior.getAdditionalWidth(this.dataCell.x, this.dataCell.y) : 0),
                height: this.visibleRow.height + (this.rowspan ? this.behavior.getAdditionalHeight(this.dataCell.x, this.dataCell.y) : 0)
            });
        }
    },

    columnProperties: { get: function get() {
            var cp = this._columnProperties;
            if (!cp) {
                cp = this.column.properties;
                if (this.isHandleColumn) {
                    cp = cp.rowHeader;
                } else if (this.isTreeColumn) {
                    cp = cp.treeHeader;
                } else if (this.isDataRow) {
                    // cp already set to basic props
                } else if (this.isFilterRow) {
                    cp = cp.filterProperties;
                } else {
                    // unselected header, summary, etc., all have save look as unselected header
                    cp = cp.columnHeader;
                }
                this._columnProperties = cp;
            }
            return cp;
        } },
    cellOwnProperties: { get: function get() {
            // do not use for get/set prop because may return null; instead use .getCellProperty('prop') or .properties.prop (preferred) to get, setCellProperty('prop', value) to set
            if (this._cellOwnProperties === undefined) {
                this._cellOwnProperties = this.column.getCellOwnProperties(this.dataCell.y, this.subgrid);
            }

            // null return means there is no cell properties object
            return this._cellOwnProperties;
        } },
    /**
     * @returns {string} Cell properties object if it exists, else the column properties object it would have as a prototype if did exist.
     * @method* @memberOf CellEvent#
     */
    properties: {
        get: function get() {
            if (this._properties) {
                return this._properties;
            }

            var props = shallowClone(this.cellOwnProperties || this.columnProperties);

            this._cellOwnDefinedProperties = this._cellOwnDefinedProperties || this.subgrid.getDefinedCellProperties(this.valueCell.x, this.valueCell.y);

            if (props && (typeof props === 'undefined' ? 'undefined' : _typeof(props)) === 'object' && this._cellOwnDefinedProperties && _typeof(this._cellOwnDefinedProperties) === 'object' && Object.keys(this._cellOwnDefinedProperties).length) {
                Object.assign(props, this._cellOwnDefinedProperties);
            }

            return this._properties = props;
        }
    },
    /**
     * @param {string} key - Property name.
     * @returns {string} Property value.
     * @method
     * @memberOf CellEvent#
     */
    getCellProperty: { value: function value(key) {
            // included for completeness but `.properties[key]` is preferred
            return this.properties[key];
        } },
    /**
     * @param {string} key - Property name.
     * @param {string} value - Property value.
     * @method
     * @memberOf CellEvent#
     */
    setCellProperty: { value: function value(key, _value) {
            // do not use `.cellOwnProperties[key] = value` because object may be null (this method creates new object as needed)
            this._cellOwnProperties = this.column.setCellProperty(this.dataCell.y, key, _value, this.subgrid);
        } },

    rowOwnProperties: {
        // undefined return means there is no row properties object
        get: function get() {
            return this.behavior.getRowProperties(this, undefined, this.subgrid);
        }
    },
    rowProperties: {
        get: function get() {
            // use carefully! creates new object as needed; only use when object definitely needed: for setting prop with `.rowProperties[key] = value` or `Object.assign(.rowProperties, {...})`; use getRowProperty(key) instead for getting a property that may not exist because it will not create a new object
            return this.behavior.getRowProperties(this, null, this.subgrid);
        },
        set: function set(properties) {
            // for resetting whole row properties object: `.rowProperties = {...}`
            this.behavior.setRowProperties(this, properties, this.subgrid); // calls `stateChanged()`
        }
    },
    getRowProperty: { value: function value(key) {
            // undefined return means there is no row properties object OR no such row property `[key]`
            var rowProps = this.rowOwnProperties;
            return rowProps && rowProps[key];
        } },
    setRowProperty: { value: function value(key, _value2) {
            // creates new object as needed
            this.rowProperties[key] = _value2; // todo: call `stateChanged()` after refac-as-flags
        } },

    // special method for use by renderer which reuses cellEvent object for performance reasons
    reset: {
        value: function value(visibleColumn, visibleRow) {
            // getter caches
            this._columnProperties = undefined;
            this._cellOwnProperties = undefined;
            this._cellOwnDefinedProperties = undefined;
            this._bounds = undefined;
            this._formattedValue = undefined;
            this._properties = undefined;

            // partial render support
            this.snapshot = [];
            this.minWidth = undefined;
            // this.disabled = undefined;

            this.visibleColumn = visibleColumn;
            this.visibleRow = visibleRow;

            this.subgrid = visibleRow.subgrid;

            this.column = visibleColumn.column; // enumerable so will be copied to cell renderer object

            this.gridCell.x = visibleColumn.columnIndex;
            this.gridCell.y = visibleRow.index;

            this.valueCell.x = this.dataCell.x = this.column && this.column.index;
            this.valueCell.y = this.dataCell.y = visibleRow.rowIndex;

            if (this.isRenderSkipNeeded) {
                if (this.valueCell.x > 1 && !this.grid.isColumnVisible(this.valueCell.x - 1)) {
                    this.valueCell.x = this.grid.selectionModel.checkCellLeft(this.valueCell.x, this.valueCell.y);
                }
                if (this.valueCell.y > 0 && !this.grid.isDataRowVisible(this.valueCell.y - 1)) {
                    this.valueCell.y = this.grid.selectionModel.checkCellTop(this.valueCell.x, this.valueCell.y);
                }
            }
        }
    },

    /**
     * Set up this `CellEvent` instance to point to the cell at the given grid coordinates.
     * @desc If the requested cell is not be visible (due to being scrolled out of view or outside the bounds of the rendered grid), the instance is not reset.
     * @param {number} gridC - Horizontal grid cell coordinate adjusted for horizontal scrolling after fixed columns.
     * @param {number} gridY - Raw vertical grid cell coordinate.
     * @returns {boolean} Visibility.
     * @method
     * @memberOf CellEvent#
     */
    resetGridCY: { value: function value(gridC, gridY) {
            var vr,
                vc,
                visible = (vc = this.renderer.getVisibleColumn(gridC)) && (vr = this.renderer.getVisibleRow(gridY));
            if (visible) {
                this.reset(vc, vr);
            }
            return visible;
        } },

    /**
     * Set up this `CellEvent` instance to point to the cell at the given grid coordinates.
     * @desc If the requested cell is not be visible (due to being scrolled out of view or outside the bounds of the rendered grid), the instance is not reset.
     * @param {number} gridX - Raw horizontal grid cell coordinate.
     * @param {number} gridY - Raw vertical grid cell coordinate.
     * @returns {boolean} Visibility.
     * @method
     * @memberOf CellEvent#
     */
    resetGridXY: { value: function value(gridX, gridY) {
            var vr,
                vc,
                visible = (vc = this.renderer.visibleColumns[gridX]) && (vr = this.renderer.getVisibleRow(gridY));
            if (visible) {
                this.reset(vc, vr);
            }
            return visible;
        } },

    /**
     * @summary Set up this `CellEvent` instance to point to the cell at the given data coordinates.
     * @desc If the requested cell is not be visible (due to being scrolled out of view), the instance is not reset.
     * @param {number} dataX - Horizontal data cell coordinate.
     * @param {number} dataY - Vertical data cell coordinate.
     * @param {dataModelAPI} [subgrid=this.behavior.subgrids.data]
     * @returns {boolean} Visibility.
     * @method
     * @memberOf CellEvent#
     */
    resetDataXY: { value: function value(dataX, dataY, subgrid) {
            var vr,
                vc,
                visible = (vc = this.renderer.getVisibleDataColumn(dataX)) && (vr = this.renderer.getVisibleDataRow(dataY, subgrid));
            if (visible) {
                this.reset(vc, vr);
            }
            return visible;
        } },

    /**
     * Set up this `CellEvent` instance to point to the cell at the given grid column and data row coordinates.
     * @desc If the requested cell is not be visible (due to being scrolled out of view or outside the bounds of the rendered grid), the instance is not reset.
     * @param {number} gridX - Horizontal grid cell coordinate (adjusted for horizontal scrolling after fixed columns).
     * @param {number} dataY - Vertical data cell coordinate.
     * @param {dataModelAPI} [subgrid=this.behavior.subgrids.data]
     * @param {boolean} [useAllCells] - Search in all rows and columns instead of only rendered ones.
     * @returns {boolean} Visibility.
     * @method
     * @memberOf CellEvent#
     */
    resetGridXDataY: { value: function value(gridX, dataY, subgrid, useAllCells) {
            var visible, vc, vr;

            if (useAllCells) {
                // When expanding selections larger than the viewport, the origin/corner
                // points may not be rendered and would normally fail to reset cell's position.
                // Mock column and row objects for this.reset() to use:
                vc = {
                    column: this.behavior.getColumn(gridX),
                    columnIndex: gridX
                };
                vr = {
                    subgrid: subgrid || this.behavior.subgrids.lookup.data,
                    rowIndex: dataY
                };
                visible = true;
            } else {
                visible = (vc = this.renderer.getVisibleColumn(gridX)) && (vr = this.renderer.getVisibleDataRow(dataY, subgrid));
            }

            if (visible) {
                this.reset(vc, vr);
            }

            return visible && this;
        } },

    /**
     * Copy self with or without own properties
     * @param {boolan} [assign=false] - Copy the own properties to the clone.
     * @returns {CellEvent}
     * @method
     * @memberOf CellEvent#
     */
    clone: { value: function value(assign) {
            var cellEvent = new this.constructor();

            cellEvent.resetGridXY(this.visibleColumn.index, this.visibleRow.index);

            if (assign) {
                // copy own props
                Object.assign(cellEvent, this);
            }

            return cellEvent;
        } },

    editPoint: {
        get: function get() {
            throw 'The `.editPoint` property is no longer available as of v1.2.10. Use the following coordinates instead:\n' + '`.gridCell.x` - The active column index. (Adjusted for column scrolling after fixed columns.)\n' + '`.gridCell.y` - The vertical grid coordinate. (Unaffected by row scrolling.)\n' + '`.dataCell.x` - The data model\'s column index. (Unaffected by column scrolling.)\n' + '`.dataCell.y` - The data model\'s row index. (Adjusted for data row scrolling after fixed rows.)\n';
        }
    },

    /** "Visible" means scrolled into view.
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isRowVisible: { get: function get() {
            return !!this.visibleRow;
        } },
    /** "Visible" means scrolled into view.
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isColumnVisible: { get: function get() {
            return !!this.visibleColumn;
        } },
    /** "Visible" means scrolled into view.
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isCellVisible: { get: function get() {
            return this.isRowVisible && this.isColumnVisible;
        } },

    /** A data row is any row in the data subgrid; all other rows (headers, footers, _etc._) are not data rows.
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isDataRow: { get: function get() {
            return this.subgrid.isData;
        } },
    /** A data column is any column that is not the row number column or the tree column.
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isDataColumn: { get: function get() {
            return this.gridCell.x >= 0;
        } },
    /** A data cell is a cell in both a data row and a data column.
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isDataCell: { get: function get() {
            return this.isDataRow && this.isDataColumn;
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isRowSelected: { get: function get() {
            return this.isDataRow && this.selectionModel.isRowSelected(this.dataCell.y);
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isColumnSelected: { get: function get() {
            return this.isDataColumn && this.selectionModel.isColumnSelected(this.gridCell.x);
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isCellSelected: { get: function get() {
            return this.selectionModel.isCellSelected(this.gridCell.x, this.dataCell.y);
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isRowHovered: { get: function get() {
            return this.grid.canvas.hasMouse && this.isDataRow && this.grid.hoverCell && this.grid.hoverCell.y === this.gridCell.y;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isColumnHovered: { get: function get() {
            return this.grid.canvas.hasMouse && this.isDataColumn && this.grid.hoverCell && this.grid.hoverCell.x === this.gridCell.x;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isCellHovered: { get: function get() {
            return this.isRowHovered && this.isColumnHovered;
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isRowFixed: { get: function get() {
            return this.isDataRow && this.dataCell.y < this.grid.properties.fixedRowCount;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isColumnFixed: { get: function get() {
            return this.isDataColumn && this.gridCell.x < this.grid.properties.fixedColumnCount;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isCellFixed: { get: function get() {
            return this.isRowFixed && this.isColumnFixed;
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isHandleColumn: { get: function get() {
            return this.gridCell.x === this.behavior.rowColumnIndex && this.grid.properties.showRowNumbers;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isHandleCell: { get: function get() {
            return this.isHandleColumn && this.isDataRow;
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isTreeColumn: { get: function get() {
            return this.gridCell.x === this.behavior.treeColumnIndex;
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isHeaderRow: { get: function get() {
            return this.subgrid.isHeader;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isHeaderHandle: { get: function get() {
            return this.isHeaderRow && this.isHandleColumn;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isHeaderCell: { get: function get() {
            return this.isHeaderRow && this.isDataColumn;
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isFilterRow: { get: function get() {
            return this.subgrid.isFilter;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isFilterHandle: { get: function get() {
            return this.isFilterRow && this.isHandleColumn;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isFilterCell: { get: function get() {
            return this.isFilterRow && this.isDataColumn;
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isSummaryRow: { get: function get() {
            return this.subgrid.isSummary;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isSummaryHandle: { get: function get() {
            return this.isSummaryRow && this.isHandleColumn;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isSummaryCell: { get: function get() {
            return this.isSummaryRow && this.isDataColumn;
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isTopTotalsRow: { get: function get() {
            return this.subgrid === this.behavior.subgrids.lookup.topTotals;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isTopTotalsHandle: { get: function get() {
            return this.isTopTotalsRow && this.isHandleColumn;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isTopTotalsCell: { get: function get() {
            return this.isTopTotalsRow && this.isDataColumn;
        } },

    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isBottomTotalsRow: { get: function get() {
            return this.subgrid === this.behavior.subgrids.lookup.bottomTotals;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isBottomTotalsHandle: { get: function get() {
            return this.isBottomTotalsRow && this.isHandleColumn;
        } },
    /** @type {boolean}
     * @memberOf CellEvent#
     */
    isBottomTotalsCell: { get: function get() {
            return this.isBottomTotalsRow && this.isDataColumn;
        } },

    /**
     * @desc shows, is cell located in aggregation column
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isAggregationTreeColumn: {
        get: function get() {
            return !!this.column && this.column.name === '$$aggregation';
        }
    },

    /**
     * @desc shows, is cell located in aggregation column
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isAggregationColumn: {
        get: function get() {
            return !!this.column && this.column.name.startsWith('$$aggregation');
        }
    },

    /**
     * @desc shows, is cell located in aggregation row
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isAggregationRow: { get: function get() {
            return this.grid.behavior.isAggregationRow(this.dataRow);
        } },

    /**
     * @desc returns array of child rows of an current aggregated row
     * @type {array}
     * @memberOf CellEvent#
     */
    childRows: { get: function get() {
            return this.grid.behavior.getChildRows(this.dataRow);
        } },

    /**
     * @desc shows, is cell located in row, that has child rows
     * @type {boolean}
     * @memberOf CellEvent#
     */
    hasChildRows: { get: function get() {
            return this.grid.behavior.hasChildRows(this.dataRow);
        } },

    /**
     * @desc returns count of aggregated child rows
     * @type {number}
     * @memberOf CellEvent#
     */
    aggregationChildCount: { get: function get() {
            return this.grid.behavior.getAggregationChildCount(this.dataRow);
        } },

    /**
     * @desc shows, is row can be expanded
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isExpandableRow: { get: function get() {
            return this.grid.behavior.isExpandableRow(this.dataRow);
        } },

    /**
     * @desc shows, is row already expanded
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isRowExpanded: { get: function get() {
            return this.grid.behavior.isRowExpanded(this.dataRow);
        } },

    /**
     * @desc shows, is row contains grand total value
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isGrandTotalRow: { get: function get() {
            return !!this.dataRow && !!this.dataRow.$$grand_total;
        } },

    /**
     * @desc tree level of an row
     * @type {number}
     * @memberOf CellEvent#
     */
    treeLevel: { get: function get() {
            return this.grid.behavior.getRowTreeLevel(this.dataRow);
        } },

    $$CLASS_NAME: { value: 'CellEvent' }
});

var Point = require('rectangular').Point;

/**
 * Variation of `rectangular.Point` but with writable `x` and `y`
 * @constructor
 */
function WritablePoint(x, y) {
    // skip x and y initialization here for performance
    // because typically reset after instantiation
}

WritablePoint.prototype = Point.prototype;

var writableDescriptor = { writable: true };
var eumerableDescriptor = { writable: true, enumerable: true };

/** @typedef {WritablePoint} dataCellCoords
 * @property {number} x - The data model's column index, unaffected by column scrolling; _i.e.,_
 * an index suitable for dereferencing the column object to which the cell belongs via {@link Behavior#getColumn}.
 * @property {number} y - The data model's row index, adjusted for data row scrolling after fixed rows.
 */

/** @typedef {WritablePoint} gridCellCoords
 * @property {number} x - The active column index, adjusted for column scrolling after fixed columns; _i.e.,_
 * an index suitable for dereferencing the column object to which the cell belongs via {@link Behavior#getActiveColumn}.
 * @property {number} y - The vertical grid coordinate, unaffected by subgrid, row scrolling, and fixed rows.
 */

/**
 * @name cellEventFactory
 *
 * @summary Create a custom `CellEvent` class.
 *
 * @desc Create a custom definition of `CellEvent` for each grid instance, setting the `grid`, `behavior`, and `dataModel` properties on the prototype. As this happens once per grid instantiation, it avoids having to perform this set up work on every `CellEvent` instantiation.
 *
 * @param {HyperGrid} grid
 *
 * @returns {function}
 */
function factory(grid) {

    /**
     * @summary Create a new CellEvent object.
     *
     * @classdesc `CellEvent` is a very low-level object that needs to be super-efficient. JavaScript objects are well known to be light weight in general, but at this level we need to be careful.
     *
     * These objects were originally only being created on mouse events. This was no big deal as mouse events are few and far between. However, as of v1.2.0, the renderer now also creates one for each visible cell on each and every grid paint.
     *
     * For this reason, to maintain performance, each grid gets a custom definition of `CellEvent`, created by this class factory, with the following optimizations:
     *
     * * Use of `extend-me` is avoided because its `initialize` chain is a bit too heavy here.
     * * Custom versions of `CellEvent` for each grid lightens the load on the constructor.
     *
     * @desc All own enumerable properties are mixed into cell editor:
     * * Includes `this.column` defined by constructor (as enumerable).
     * * Excludes all other properties defined by constructor and prototype, all of which are non-enumerable.
     * * Any additional (enumerable) members mixed in by application's `getCellEditorAt` override.
     *
     * Including the params calls {@link CellEvent#resetGridCY resetGridCY(gridX, gridY)}.
     * Alternatively, instantiate without params and/or later call one of these:
     * * {@link CellEvent#resetGridXY resetGridXY(...)}
     * * {@link CellEvent#resetDataXY resetDataXY(...)}
     * * {@link CellEvent#resetGridXDataY resetGridXDataY(...)}
     *
     * @param {number} [gridX] - grid cell coordinate (adjusted for horizontal scrolling after fixed columns).
     * @param {number} [gridY] - grid cell coordinate, adjusted (adjusted for vertical scrolling if data subgrid)
     * @constructor CellEvent
     */
    function CellEvent(gridX, gridY) {
        // remaining instance vars are non-enumerable so `CellEditor` constructor won't mix them in (for mustache use).
        Object.defineProperties(this, {
            /**
             * @name visibleColumn
             * @type {visibleColumnArray}
             * @memberOf CellEvent#
             */
            visibleColumn: writableDescriptor,

            /**
             * @name visibleRow
             * @type {visibleRowArray}
             * @memberOf CellEvent#
             */
            visibleRow: writableDescriptor,

            /**
             * @name subgrid
             * @type {dataModelAPI}
             * @memberOf CellEvent#
             */
            subgrid: writableDescriptor,

            /**
             * @name gridCell
             * @type {gridCellCoords}
             * @memberOf CellEvent#
             */
            gridCell: {
                value: new WritablePoint()
            },

            /**
             * @name dataCell
             * @type {dataCellCoords}
             * @memberOf CellEvent#
             */
            dataCell: {
                value: new WritablePoint()
            },

            /**
             * @name valueCell
             * @type {dataCellCoords}
             * @memberOf CellEvent#
             */
            valueCell: {
                value: new WritablePoint()
            },

            /**
             * A reference to the cell's {@link Column} object.
             *
             * This property is enumerable so that it will be copied to cell editor on {@link CellEditor} instantiation.
             * @name column
             * @type {Column}
             * @memberOf CellEvent#
             */
            column: eumerableDescriptor,

            // getter caches
            _columnProperties: writableDescriptor,
            _cellOwnProperties: writableDescriptor,
            _cellOwnDefinedProperties: writableDescriptor,
            _bounds: writableDescriptor,

            // Following supports cell renderers' "partial render" capability:
            snapshot: writableDescriptor,
            minWidth: writableDescriptor,
            disabled: writableDescriptor
        });

        if (arguments.length) {
            this.resetGridCY(gridX, gridY);
        }
    }

    CellEvent.prototype = Object.create(cellEventProperties, {
        constructor: { value: CellEvent },
        grid: { value: grid },
        renderer: { value: grid.renderer },
        selectionModel: { value: grid.selectionModel },
        behavior: { value: grid.behavior },
        dataModel: { value: grid.behavior.dataModel }
    });

    return CellEvent;
}

function shallowClone(obj) {
    var clone = Object.create(Object.getPrototypeOf(obj));
    Object.getOwnPropertyNames(obj).forEach(function (key) {
        return Object.defineProperty(clone, key, Object.getOwnPropertyDescriptor(obj, key));
    });
    return clone;
}

module.exports = factory;
