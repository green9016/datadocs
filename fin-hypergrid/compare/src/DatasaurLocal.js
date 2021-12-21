/* eslint-env browser */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var DataSourceBase = require('../DatasaurBase');

/** @typedef {object} columnSchemaObject
 * @property {string} name - The required column name.
 * @property {string} [header] - An override for derived header
 * @property {function} [calculator] - A function for a computed column. Undefined for normal data columns.
 * @property {string} [type] - Used for sorting when and only when comparator not given.
 * @property {object} [comparator] - For sorting, both of following required:
 * @property {function} comparator.asc - ascending comparator
 * @property {function} comparator.desc - descending comparator
 */

/**
 * @param {object} [options]
 * @param {object[]} [options.data]
 * @param {object[]} [options.schema]
 * @constructor
 */
var DataSourceLocal = DataSourceBase.extend('DataSourceLocal', {

    initialize: function initialize(nextDataSource, options) {
        /**
         * @summary The array of column schema objects.
         * @name schema
         * @type {columnSchemaObject[]}
         * @memberOf DataSourceLocal#
         */
        this.schema = [];

        /**
         * @summary The array of uniform data objects.
         * @name data
         * @type {object[]}
         * @memberOf DataSourceLocal#
         */
        this.data = [];
        this.cache = [];
    },

    /**
     * Establish new data and schema.
     * If no data provided, data will be set to 0 rows.
     * If no schema provided AND no previously set schema, new schema will be derived from data.
     * @param {object[]} [data=[]] - Array of uniform objects containing the grid data.
     * @param {columnSchemaObject[]} [schema=[]]
     * @memberOf DataSourceLocal#
     */
    setData: function setData(data, schema) {
        /**
         * @summary The array of uniform data objects.
         * @name data
         * @type {object[]}
         * @memberOf DataSourceLocal#
         */
        this.data = data || [];
        this.onChange();

        if (schema) {
            this.setSchema(schema);
        } else if (this.data.length && !this.schema.length) {
            this.setSchema([]);
        }
    },

    /**
     * Add new data and schema.
     * If no data provided, data will be as is.
     * If no schema provided AND no previously set schema, new schema will be derived from data.
     * @param {object[]} [data=[]] - Array of uniform objects containing the grid data.
     * @param {columnSchemaObject[]} [schema=[]]
     * @memberOf DataSourceLocal#
     */
    addData: function addData(data, schema) {
        this.data.push.apply(this.data, data || []);
        this.onChange();

        if (schema) {
            this.setSchema(schema);
        } else if (this.data.length && !this.schema.length) {
            this.setSchema([]);
        }
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getSchema}
     * @memberOf DataSourceLocal#
     */
    getSchema: function getSchema() {
        return this.schema;
    },
    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#setSchema}
     * @memberOf DataSourceLocal#
     */
    setSchema: function setSchema(newSchema) {
        if (!newSchema.length) {
            var dataRow = this.data.find(function (dataRow) {
                return dataRow;
            });
            if (dataRow) {
                newSchema = Object.keys(dataRow);
            }
        }

        this.schema = newSchema;
        this.dispatchEvent('data-schema-changed');
    },

    /**
     * @param y
     * @param treeLevel
     * @returns {dataRowObject}
     * @memberOf DataSourceLocal#
     */
    getRow: function getRow(y, treeLevel) {
        return this._getRowByTreeLevel(this.data[y], treeLevel);
    },

    /**
     * Update or blank row in place.
     *
     * _Note parameter order is the reverse of `addRow`._
     * @param {number} y
     * @param {object} [dataRow] - if omitted or otherwise falsy, row renders as blank
     * @memberOf DataSourceLocal#
     */
    setRow: function setRow(y, dataRow) {
        this.data[y] = dataRow || undefined;
        this.onChange();
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getRowMetadata}
     * @memberOf DataSourceLocal#
     */
    getRowMetadata: function getRowMetadata(y, prototype) {
        var dataRow = this.data[y];
        return dataRow && (dataRow.__META || prototype !== undefined && (dataRow.__META = Object.create(prototype)));
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#setRowMetadata}
     * @memberOf DataSourceLocal#
     */
    setRowMetadata: function setRowMetadata(y, metadata) {
        var dataRow = this.data[y];
        if (dataRow) {
            if (metadata) {
                dataRow.__META = metadata;
            } else {
                delete dataRow.__META;
            }
        }
        return !!dataRow;
    },

    /**
     * Insert or append a new row.
     *
     * _Note parameter order is the reverse of `setRow`._
     * @param {object} dataRow
     * @param {number} [y=Infinity] - The index of the new row. If `y` >= row count, row is appended to end; otherwise row is inserted at `y` and row indexes of all remaining rows are incremented.
     * @memberOf DataSourceLocal#
     */
    addRow: function addRow(dataRow, y) {
        if (y === undefined || y >= this.getRowCount()) {
            this.data.push(dataRow);
        } else {
            this.data.splice(y, 0, dataRow);
        }
        this.onChange();
        this.dispatchEvent('data-shape-changed');
    },

    /**
     * Insert or append a new rows.
     *
     * _Note parameter order is the reverse of `setRow`._
     * @param {array} dataRows
     * @param {number} [y=Infinity] - The index of the new row. If `y` >= row count, row is appended to end; otherwise row is inserted at `y` and row indexes of all remaining rows are incremented.
     * @memberOf DataSourceLocal#
     */
    addRows: function addRows(dataRows, y) {
        var _data;

        if (y === undefined || y >= this.getRowCount()) {
            y = this.getRowCount();
        }
        (_data = this.data).splice.apply(_data, [y, 0].concat(_toConsumableArray(dataRows)));
        this.onChange();
        this.dispatchEvent('data-shape-changed');
    },

    /**
     * Rows are removed entirely and no longer render.
     * Indexes of all remaining rows are decreased by `rowCount`.
     * @param {number} y
     * @param {number} [rowCount=1]
     * @returns {dataRowObject[]}
     * @memberOf DataSourceLocal#
     */
    delRow: function delRow(y, rowCount) {
        var rows = this.data.splice(y, rowCount === undefined ? 1 : rowCount);
        this.onChange();
        if (rows.length) {
            this.dispatchEvent('data-shape-changed');
        }
        return rows;
    },

    /**
     * @private
     * @param x
     * @param y
     * @private
     */
    _getDataRowObject: function _getDataRowObject(x, y) {
        if (this.cache && x in this.cache && y in this.cache[x]) {
            return this.cache[x][y];
        }

        if (!(x in this.cache)) {
            this.cache[x] = [];
        }

        var row = this.data[y];

        if (!row || x > this.getColumnCount()) {
            return {};
        }

        return this.cache[x][y] = this._getDataRowObjectByRowAndColumnIndex(row, x);
    },

    indexOf: function indexOf(row) {
        var data = this.data;

        var index = data.indexOf(row);

        while (index < 0 && data.some(function (d) {
            return d;
        })) {
            data = data.map(function (d) {
                return d.$$children && d.$$children[0];
            });
            index = data.indexOf(row);
        }

        return index;
    },

    _getRowByTreeLevel: function _getRowByTreeLevel(row, treeLevel) {
        if (row && row.$$children && row.__treeLevel !== treeLevel) {
            while (row.__treeLevel !== treeLevel) {
                if (row.$$children.length === 0) {
                    // if it last level use this level
                    break;
                } else if (row.$$open) {
                    // if it open row, we need to go deeper
                    row = row.$$children[0];
                } else {
                    // if it closed row use parent row
                    break;
                }
            }
        }
        return row;
    },

    _getDataRowObjectByRowAndColumnIndex: function _getDataRowObjectByRowAndColumnIndex(row, x) {
        var columnName = this.getColumnName(x);
        var treeLevel = this.getColumnTreeLevel(x);

        row = this._getRowByTreeLevel(row, treeLevel);

        if (columnName in row) {
            return { foundedValue: row[columnName] };
        }

        // get value if key consists of joined keys
        var foundedValue = void 0,
            skipNeeded = false;
        foundedValue = row[Object.keys(row).find(function (key) {
            var combinedColumns = key.split('/');
            skipNeeded = skipNeeded || combinedColumns.includes(columnName) && combinedColumns[0] !== columnName;
            return combinedColumns[0] === columnName;
        })];

        return { foundedValue: foundedValue, skipNeeded: skipNeeded };
    },

    /**
     * @summary get count value for some cell of data grid
     * @memberOf DataSourceLocal#
     */
    getCount: function getCount(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        if (val !== undefined) {
            return val && val.count && val.count !== null ? val.count : undefined;
        }
    },

    getChildColumnsFromCell: function getChildColumnsFromCell(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        return val && val.childColumnDefs && val.childColumnDefs !== null && val.childColumnDefs !== undefined ? val.childColumnDefs : [];
    },

    getHasChildColumnsFromCell: function getHasChildColumnsFromCell(x, y) {
        var childColumnsArray = this.getChildColumnsFromCell(x, y);

        return childColumnsArray && childColumnsArray.length !== undefined ? childColumnsArray.length > 0 : false;
    },

    getIsColumnOpenByDefaultFromCell: function getIsColumnOpenByDefaultFromCell(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        if (val !== undefined) {
            return val && val.columnOpenByDefault && val.columnOpenByDefault !== null ? val.columnOpenByDefault : false;
        }
    },

    getIsColumnGroupShowFromCell: function getIsColumnGroupShowFromCell(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        var shownValues = ['always-showing', 'open'];

        if (val !== undefined) {
            if (val.columnGroupShow === undefined) {
                return true;
            }

            return val && val.columnGroupShow ? shownValues.indexOf(val.columnGroupShow) > -1 : false;
        }
    },

    getColumnGroupIdFromCell: function getColumnGroupIdFromCell(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        if (val !== undefined) {
            return val && val.groupId && val.groupId !== null ? val.groupId : undefined;
        }
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getValue}
     * @memberOf DataSourceLocal#
     */
    getValue: function getValue(x, y) {
        var foundedDataRowValue = this._getDataRowObject(x, y).foundedValue;

        if (foundedDataRowValue !== undefined) {
            return foundedDataRowValue && foundedDataRowValue.value ? foundedDataRowValue.value : foundedDataRowValue;
        }
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#setValue}
     * @memberOf DataSourceLocal#
     */
    setValue: function setValue(x, y, value) {
        var foundedDataRowValue = this._getDataRowObject(x, y).foundedValue;

        if (foundedDataRowValue) {
            if ((typeof foundedDataRowValue === 'undefined' ? 'undefined' : _typeof(foundedDataRowValue)) === 'object' && !!foundedDataRowValue.value) {
                foundedDataRowValue.value = value;
            } else {
                foundedDataRowValue = value;
            }
        }
        this.data[y][this.getColumnName(x)] = foundedDataRowValue;
        this.onChange();
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getValue}
     * @memberOf DataSourceLocal#
     */
    getDefinedCellProperties: function getDefinedCellProperties(x, y) {
        var foundedDataRowValue = this._getDataRowObject(x, y).foundedValue;

        if (foundedDataRowValue !== null && (typeof foundedDataRowValue === 'undefined' ? 'undefined' : _typeof(foundedDataRowValue)) === 'object' && !!foundedDataRowValue.properties) {
            return foundedDataRowValue.properties;
        } else {
            return {};
        }
    },

    /**
     * @public
     * @desc get colspan of an cell, if exist. Otherwise, returns 0;
     * @param x
     * @param y
     * @return {*}
     */
    getColspan: function getColspan(x, y) {
        var dataRowObject = this._getDataRowObject(x, y);
        var foundedDataRowValue = dataRowObject.foundedValue;

        if (foundedDataRowValue && (typeof foundedDataRowValue === 'undefined' ? 'undefined' : _typeof(foundedDataRowValue)) === 'object') {
            if (foundedDataRowValue.colspan) {
                return foundedDataRowValue.colspan;
            }
        } else if (dataRowObject.skipNeeded) {
            var i = x;
            while (dataRowObject.skipNeeded) {
                dataRowObject = this._getDataRowObject(--i, y);
            }
            return dataRowObject.foundedValue ? dataRowObject.foundedValue.colspan - (x - i) : 0;
        }

        return 0;
    },

    /**
     * @summary get additional width based on colspan
     * @param x
     * @param y
     * @returns {number}
     */
    getAdditionalWidth: function getAdditionalWidth(x, y) {
        var additional = 0;
        var colspan = this.getColspan(x, y);
        for (var i = x + 1; i <= x + colspan; i++) {
            additional += this.grid.getColumnWidth(i);
        }
        return additional;
    },

    /**
     * @public
     * @desc get rowspan of an cell, if exist. Otherwise, returns 0;
     * @param x
     * @param y
     * @return {*}
     */
    getRowspan: function getRowspan(x, y) {
        var foundedDataRowValue = this._getDataRowObject(x, y).foundedValue;

        if (foundedDataRowValue && (typeof foundedDataRowValue === 'undefined' ? 'undefined' : _typeof(foundedDataRowValue)) === 'object' && !!foundedDataRowValue.rowspan) {
            return foundedDataRowValue.rowspan;
        } else {
            return 0;
        }
    },

    /**
     * @summary get additional height based on colspan
     * @param x
     * @param y
     * @returns {number}
     */
    getAdditionalHeight: function getAdditionalHeight(x, y) {
        var additional = 0;
        var rowspan = this.getRowspan(x, y);
        for (var i = y + 1; i <= y + rowspan; i++) {
            additional += this.grid.getRowHeight(i);
        }
        return additional;
    },

    /**
     * @public
     * @param x
     * @param y
     * @return {*}
     */
    isColspanedByLeftColumn: function isColspanedByLeftColumn(x, y) {
        var rowValue = this._getDataRowObject(x, y);

        return !!rowValue.foundedValue && rowValue.foundedValue.isColspanedByColumn;
        // return this._getDataRowObject(x, y).skipNeeded;
    },

    /**
     * @public
     * @param x
     * @param y
     * @return {*}
     */
    getRowspanMainRow: function getRowspanMainRow(x, y) {
        var cellOnRow = this._getDataRowObject(x, y);

        return !!cellOnRow.foundedValue && cellOnRow.foundedValue.rowspanedByRow !== undefined ? cellOnRow.foundedValue.rowspanedByRow : null;
    },

    /**
     * @public
     * @param x
     * @param y
     * @return {*}
     */
    getColspanMainColumnName: function getColspanMainColumnName(x, y) {
        var cellOnRow = this._getDataRowObject(x, y);

        return !!cellOnRow.foundedValue && cellOnRow.foundedValue.colspanedByColumn ? cellOnRow.foundedValue.colspanedByColumn : null;
    },

    /**
     * @public
     * @param x
     * @param y
     * @return {*}
     */
    isRowspanedByRow: function isRowspanedByRow(x, y) {
        var cellOnRow = this._getDataRowObject(x, y);

        return !!cellOnRow.foundedValue && cellOnRow.foundedValue.isRowspanedByRow;
    },

    isRenderSkipNeeded: function isRenderSkipNeeded(x, y) {
        return this.isRowspanedByRow(x, y) || this.isColspanedByLeftColumn(x, y);
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getRowCount}
     * @memberOf DataSourceLocal#
     */
    getRowCount: function getRowCount() {
        return this.data.length;
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getColumnCount}
     * @memberOf DataSourceLocal#
     */
    getColumnCount: function getColumnCount() {
        return this.schema.length;
    },

    getColumnName: function getColumnName(x) {
        return (typeof x === 'undefined' ? 'undefined' : _typeof(x))[0] === 'n' && this.schema[x] ? this.schema[x].name : x;
    },

    getColumnTreeLevel: function getColumnTreeLevel(x) {
        return (typeof x === 'undefined' ? 'undefined' : _typeof(x))[0] === 'n' && this.schema[x] && this.schema[x].colDef ? this.schema[x].colDef.treeLevel : undefined;
    },

    getRowsWithValuesCount: function getRowsWithValuesCount() {
        return this.data.filter(function (d) {
            return !d.$$blank_node;
        }).length - this.grid.getFictiveHeaderRowsCount();
    },

    getColumnsWithValuesCount: function getColumnsWithValuesCount() {
        return this.grid.behavior.columns.filter(function (c) {
            return !!c.colDef;
        }).length;
    },

    /**
     * @summary tells if value is link or array contains link
     * @param value
     * @returns {boolean}
     */
    isValueUrl: function isValueUrl(value) {
        var result = false;
        if (Array.isArray(value)) {
            value.forEach(function (v) {
                if (isStringUrl(v)) {
                    result = true;
                }
            });
        } else {
            result = isStringUrl(value);
        }

        return result;
    },


    // next two methods copied from datadocs
    getHighlightRegex: function getHighlightRegex(match, searchType) {
        var words = match.split(/[ ,]+(\(.*?\))?/).filter(function (e) {
            return !!e;
        }).join('|');
        var flags = 'gi';
        var antiTagRegExp = '(?![^<>]*(([\/\"\']|]]|\b)>))';
        if (searchType === 'EXACT_MATCH') {
            return new RegExp('\\b' + words + '\\b' + antiTagRegExp, flags);
        } else if (searchType === 'EDGE') {
            return new RegExp('\\b' + words + antiTagRegExp, flags);
        } else if (searchType === 'FULL') {
            return new RegExp(words + antiTagRegExp, flags);
        }
    },
    getHighlightedValue: function getHighlightedValue(str, match, searchType) {
        if (!match || !str || searchType === 'NONE' || searchType === undefined) {
            return '';
        }

        var reg = this.getHighlightRegex(match, searchType);

        if (!reg) {
            return str;
        }

        return (str + '').replace(reg, '<mark>$&</mark>');
    },
    onChange: function onChange() {
        this.cache = [];
        this._data = this._data.filter(function (d) {
            return !d.$$blank_node;
        });
        var minimumRowCount = this.grid && this.grid.properties.minimumRowCount || 50;
        while (this._data.length < minimumRowCount) {
            this._data.push(_defineProperty({}, '$$blank_node', true));
        }
    },


    get data() {
        return this._data;
    },
    set data(data) {
        this._data = data;
        this.cache = [];
    }
});

function isStringUrl(string) {
    if (!string) {
        return false;
    }
    var URL_REGEXP = /^(\s*(http|https|ftp|ftps|itmss)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,6}(\/[^\s,;]*)?)$/g; // copy from datadoc
    return URL_REGEXP.test(string);
}

module.exports = DataSourceLocal;
