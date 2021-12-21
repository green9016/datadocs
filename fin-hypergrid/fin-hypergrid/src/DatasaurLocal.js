/* eslint-env browser */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var DatasaurBase = require('datasaur-base');

/** @typedef {object} columnSchemaObject
 * @property {string} name - The required column name.
 * @property {string} [header] - An override for derived header
 * @property {function} [calculator] - A function for a computed column. Undefined for normal data columns.
 * @property {string} [type] - Used for sorting when and only when comparator not given.
 * @property {object} [comparator] - For sorting, both of following required:
 * @property {function} comparator.asc - ascending comparator
 * @property {function} comparator.desc - descending comparator
 */
const TREE_COLUMN_INDEX = require("./behaviors/Behavior").prototype.treeColumnIndex;
const TREE_HEADER_ROW_INDEX = require("./behaviors/Behavior").prototype.treeHeaderRowIndex;
/**
 * @param {object} [options]
 * @param {object[]} [options.data]
 * @param {object[]} [options.schema]
 * @constructor
 */
var DatasaurLocal = DatasaurBase.extend('DatasaurLocal',  {

    initialize: function(datasaur, options) {
        this.reset();
    },

    reset: function() {
        /**
         * @summary The array of column schema objects.
         * @name schema
         * @type {columnSchemaObject[]}
         * @memberOf DatasaurLocal#
         */
        this.schema = [];

        /**
         * @summary The array of uniform data objects.
         * @name data
         * @type {object[]}
         * @memberOf DatasaurLocal#
         */
        this.data = [];

        this.copyData = [];

        this.firstFetch = true;

        this.zoomRatio = 1;
    },

    resetCopyData: function() {
        this.copyData = [];
    },

    getCopyValue: function(x, y) {
        var foundedDataRowValue = this._getDataRowCopyObject(x, y).foundedValue;

        if (foundedDataRowValue !== undefined) {
            return foundedDataRowValue && foundedDataRowValue.value ? foundedDataRowValue.value : foundedDataRowValue;
        }
    },

    copyStyle: function(y) {
        var style = {
            isBold: false
        };

        if (this.isRowPivot() && y == this._nrows) {
            style['isBold'] = true;
        }
        return style;
    },

    _getDataRowCopyObject: function(x, y) {
        var row = this.copyData[y];

        if (!row || x > this.getColumnCount()) {
            return {};
        }

        return this._getDataRowObjectByRowAndColumnIndex(row, x);
    },

    /**
     * Establish new data and schema.
     * If no data provided, data will be set to 0 rows.
     * If no schema provided AND no previously set schema, new schema will be derived from data.
     * @param {object[]} [data=[]] - Array of uniform objects containing the grid data.
     * @param {columnSchemaObject[]} [schema=[]]
     * @memberOf DatasaurLocal#
     */
    setData: function(data, schema) {
        /**
         * @summary The array of uniform data objects.
         * @name data
         * @type {object[]}
         * @memberOf DatasaurLocal#
         */
        this.data = data || [];
        this.onChange();

        if (schema) {
            this.setSchema(schema);
        } else if (this.data.length && !this.schema.length) {
            this.setSchema([]);
        }

        this.dispatchEvent('fin-hypergrid-data-loaded');
    },

    /**
     * Add new data and schema.
     * If no data provided, data will be as is.
     * If no schema provided AND no previously set schema, new schema will be derived from data.
     * @param {object[]} [data=[]] - Array of uniform objects containing the grid data.
     * @param {columnSchemaObject[]} [schema=[]]
     * @memberOf DataSourceLocal#
     */
    addData: function(data, schema) {
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
     * @memberOf DatasaurLocal#
     */
    getSchema:  function(){
        return this.schema;
    },
    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#setSchema}
     * @memberOf DatasaurLocal#
     */
    setSchema: function(newSchema){
        if (!newSchema.length) {
            var dataRow = this.getFirstRow();
            if (dataRow) {
                newSchema = Object.keys(dataRow);
            }
        }

        this.schema = newSchema;
        this.dispatchEvent('fin-hypergrid-schema-loaded');
    },

    /**
     * @summary Find first extant AND defined element.
     * @desc Uses for...in to find extant rows plus a truthiness test to return only a defined row.
     * @returns {dataRow|undefined} Returns undefined if there are no such rows.
     */
    getFirstRow: function() {
        for (var i in this.data) {
            if (this.data[i]) {
                return this.data[i];
            }
        }
    },

    /**
     * @param y
     * @returns {dataRowObject}
     * @memberOf DatasaurLocal#
     */
    getRow: function(y) {
        return this.data[y];
    },

    /**
     * Update or blank row in place.
     *
     * _Note parameter order is the reverse of `addRow`._
     * @param {number} y
     * @param {object} [dataRow] - if omitted or otherwise falsy, row renders as blank
     * @memberOf DatasaurLocal#
     */
    setRow: function(y, dataRow) {
        this.data[y] = dataRow || undefined;
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getRowMetadata}
     * @memberOf DatasaurLocal#
     */
    getRowMetadata: function(y, prototype) {
        var dataRow = this.data[y];
        return dataRow && (dataRow.__META || (prototype !== undefined && (dataRow.__META = Object.create(prototype))));
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#setRowMetadata}
     * @memberOf DatasaurLocal#
     */
    setRowMetadata: function(y, metadata) {
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
     * @memberOf DatasaurLocal#
     */
    addRow: function(y, dataRow) {
        if (arguments.length === 1) {
            dataRow = arguments[0];
            y = undefined;
        }
        if (y === undefined || y >= this.getRowCount()) {
            this.data.push(dataRow);
        } else {
            this.data.splice(y, 0, dataRow);
        }
        this.dispatchEvent('fin-hypergrid-data-shape-changed');
    },

    /**
     * Insert or append a new rows.
     *
     * _Note parameter order is the reverse of `setRow`._
     * @param {array} dataRows
     * @param {number} [y=Infinity] - The index of the new row. If `y` >= row count, row is appended to end; otherwise row is inserted at `y` and row indexes of all remaining rows are incremented.
     * @memberOf DataSourceLocal#
     */
    addRows: function(dataRows, y) {
        var _data;

        if (y === undefined || y >= this.getRowCount()) {
            y = this.getRowCount();
        }
        (_data = this.data).splice.apply(_data, [y, 0].concat(_toConsumableArray(dataRows)));
        this.onChange();
        this.dispatchEvent('fin-hypergrid-data-shape-changed');
    },

    /**
     * Rows are removed entirely and no longer render.
     * Indexes of all remaining rows are decreased by `rowCount`.
     * @param {number} y
     * @param {number} [rowCount=1]
     * @returns {dataRowObject[]}
     * @memberOf DatasaurLocal#
     */
    delRow: function(y, rowCount) {
        var rows = this.data.splice(y, rowCount === undefined ? 1 : rowCount);
        if (rows.length) {
            this.dispatchEvent('fin-hypergrid-data-shape-changed');
        }
        return rows;
    },

    /**
     * @private
     * @param x
     * @param y
     * @private
     */
    _getDataRowObject: function(x, y) {
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

    indexOf: function(row) {
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

    _getRowByTreeLevel: function(row, treeLevel) {
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

    _getDataRowObjectByRowAndColumnIndex: function(row, x) {
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
    getCount: function(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        if (val !== undefined) {
            return val && val.count && val.count !== null ? val.count : undefined;
        }
    },

    getChildColumnsFromCell: function(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        return val && val.childColumnDefs && val.childColumnDefs !== null && val.childColumnDefs !== undefined ? val.childColumnDefs : [];
    },

    getHasChildColumnsFromCell: function(x, y) {
        var childColumnsArray = this.getChildColumnsFromCell(x, y);

        return childColumnsArray && childColumnsArray.length !== undefined ? childColumnsArray.length > 0 : false;
    },

    getIsColumnOpenByDefaultFromCell: function(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        if (val !== undefined) {
            return val && val.columnOpenByDefault && val.columnOpenByDefault !== null ? val.columnOpenByDefault : false;
        }
    },

    getIsColumnGroupShowFromCell: function(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        var shownValues = ['always-showing', 'open'];

        if (val !== undefined) {
            if (val.columnGroupShow === undefined) {
                return true;
            }

            return val && val.columnGroupShow ? shownValues.indexOf(val.columnGroupShow) > -1 : false;
        }
    },

    getColumnGroupIdFromCell: function(x, y) {
        var val = this._getDataRowObject(x, y).foundedValue;

        if (val !== undefined) {
            return val && val.groupId && val.groupId !== null ? val.groupId : undefined;
        }
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getValue}
     * @memberOf DatasaurLocal#
     */
    getValue: function(x, y) {
        /*var row = this.data[y];
        if (!row) {
            return null;
        }
        return row[this.schema[x].name];*/
        var foundedDataRowValue = this._getDataRowObject(x, y).foundedValue;
        if (foundedDataRowValue !== undefined) {
            return foundedDataRowValue && foundedDataRowValue.value != undefined ? foundedDataRowValue.value : foundedDataRowValue;
        }
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#setValue}
     * @memberOf DatasaurLocal#
     */
    setValue: function(x, y, value) {
        //this.data[y][this.schema[x].name] = value;
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
    getDefinedCellProperties: function(x, y) {
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
    getColspan: function(x, y) {
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
    getAdditionalWidth: function(x, y) {
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
    getRowspan: function(x, y) {
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
    getAdditionalHeight: function(x, y) {
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
    isColspanedByLeftColumn: function(x, y) {
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
    getRowspanMainRow: function(x, y) {
        var cellOnRow = this._getDataRowObject(x, y);

        return !!cellOnRow.foundedValue && cellOnRow.foundedValue.rowspanedByRow !== undefined ? cellOnRow.foundedValue.rowspanedByRow : null;
    },

    /**
     * @public
     * @param x
     * @param y
     * @return {*}
     */
    getColspanMainColumnName: function(x, y) {
        var cellOnRow = this._getDataRowObject(x, y);

        return !!cellOnRow.foundedValue && cellOnRow.foundedValue.colspanedByColumn ? cellOnRow.foundedValue.colspanedByColumn : null;
    },

    /**
     * @public
     * @param x
     * @param y
     * @return {*}
     */
    isRowspanedByRow: function(x, y) {
        var cellOnRow = this._getDataRowObject(x, y);

        return !!cellOnRow.foundedValue && cellOnRow.foundedValue.isRowspanedByRow;
    },

    isRenderSkipNeeded: function(x, y) {
        return this.isRowspanedByRow(x, y) || this.isColspanedByLeftColumn(x, y);
    },

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getRowCount}
     * @memberOf DatasaurLocal#
     */
    /*getRowCount: function() {
        return this.data.length;
    },*/

    /**
     * @see {@link https://fin-hypergrid.github.io/3.0.0/doc/dataModelAPI#getColumnCount}
     * @memberOf DatasaurLocal#
     */
    getColumnCount: function() {
        return this.schema.length;
    },

    getColumnName: function(x) {
        return (typeof x === 'undefined' ? 'undefined' : _typeof(x))[0] === 'n' && this.schema[x] ? this.schema[x].name : x;
    },

    getColumnTreeLevel: function(x) {
        return (typeof x === 'undefined' ? 'undefined' : _typeof(x))[0] === 'n' && this.schema[x] && this.schema[x].colDef ? this.schema[x].colDef.treeLevel : undefined;
    },

    getRowsWithValuesCount: function() {
        /*return this.data.filter(function (d) {
            return !d.$$blank_node;
        }).length - this.grid.getFictiveHeaderRowsCount();*/
        return this._nrows;
    },

    getColumnsWithValuesCount: function() {
        return this.grid.behavior.columns.filter(function (c) {
            return !!c.colDef;
        }).length;
    },

    /**
     * @summary tells if value is link or array contains link
     * @param value
     * @returns {boolean}
     */
    isValueUrl: function(value) {
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
    getHighlightRegex: function(match, searchType) {
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
    getHighlightedValue: function(str, match, searchType) {
        if (!match || !str || searchType === 'NONE' || searchType === undefined) {
            return '';
        }

        var reg = this.getHighlightRegex(match, searchType);

        if (!reg) {
            return str;
        }

        return (str + '').replace(reg, '<mark>$&</mark>');
    },
    onChange: function() {
        this.cache = [];
        this._data = this._data.filter(function (d) {
            return !d.$$blank_node;
        });
        var minimumRowCount = this.grid && this.grid.properties.minimumRowCount || 100;
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
    },

    isTreeCol: function(x) {
        return x === TREE_COLUMN_INDEX && this.isTree();
    },
    /*
    getValue: function(x, y) {
        var row = this.data[y];
        return row ? row[x] : null;
    },
    */
    getRowCount: function() {
        var minimumRowCount = this.grid && this.grid.properties.minimumRowCount || 100;
        if (this.isRowPivot()){
            return this._nrows + 1 > minimumRowCount ? this._nrows + 1: minimumRowCount;
        }
        // Add number header rows (current: +1)
        return this._nrows >= minimumRowCount ? this._nrows + 1: minimumRowCount;
    },


    getConfig: function() {
        return this._config;
    },

    setRowCount: function(count) {
        this._nrows = count || 0;
    },

    isTree: function() {
        return this._isTree;
    },

    setIsTree: function(isTree) {
        this._isTree = isTree;
    },

    keepSelection: function(){
        return this._keepSelection;
    },

    setKeepSelection: function(keepSelection){
        this._keepSelection = keepSelection;
    },

    isFetchCopyData: function() {
        return this._isFetchCopyData;
    },

    setFetchCopyData: function(isFetchCopyData) {
        this._isFetchCopyData = isFetchCopyData;
    },

    getMaxTreeSpace: function(){
        var depth = this.getTreeDepth();
        var iconWidth = 3;
        var iconPaddingRight = 5;
        var lineNodeSpace = 16;
        var xOffset = 0;
        for (var i = 1; i <= depth; i++) {
            xOffset += lineNodeSpace;
        }

        if (depth > 0){
            xOffset += iconWidth + iconPaddingRight;
        }
        return xOffset;
    },

    getTreeDepth: function(){
        return typeof this._depth === undefined ? 0: Math.max(this._depth, 0);
    },

    getRowPivotTotalIndex: function(){
        if (this._rowPivotTotalIndex && this._rowPivotTotalIndex > 0){
            return this._rowPivotTotalIndex;
        }
        return -1;
    },

    setRowPivotTotalIndex: function(totalY){
        this._rowPivotTotalIndex = (totalY && totalY > 0) ? totalY: -1;
    },

    resetRowPivotTotalIndex: function(){
        this._rowPivotTotalIndex = -1;
    },

    setNBRowPivots: function(nb){
        this._depth = nb -1;
        this._nbRowPivots = nb;
    },

    setZoomRatio: function(ratio){
        this.zoomRatio = ratio;
    },

    getZoomRatio: function(){
        return this.zoomRatio || 1;
    },

    getRowColLevelText: function(){
      var text = "Row Labels";
      //if (this.isRowPivot() == true && this.isColumnPivot() == true){
      if (this.contains_both_row_and_col_labels() === true){
          //text = "Row Labels"; //"Row/Col Labels";
          text = this.row_labels_text();
      }else if (this.isRowPivot() == true){
        //text = "Row Labels";
        text = this.row_labels_text();
      }else if(this.isColumnPivot() == true){
        //text = "Col Labels";
        text = this.col_labels_text();
      }
      return text;
    },

    contains_both_row_and_col_labels: function(){
      if (this.isRowPivot() === true && this.isColumnPivot() === true){
        if (this.contains_only_combined_name_in_col_pivots() === true){
          // No need to show Values in Col Labels if we have only one item
          return false;
        }else{
          return true;
        }
      }
      return false;
    },

    get_combined_name: function(){
      return "__values__";
    },

    contains_only_combined_name_in_row_pivots: function(){

      const row_pivots = this.getRowPivots();
      if (this.isRowPivot() === true && row_pivots && row_pivots.length === 1
        && row_pivots[0] === this.get_combined_name()){
          return true;
      }
      return false;
    },

    contains_only_combined_name_in_col_pivots: function(){
      const col_pivots = this.getColPivots();
      if (this.isColumnPivot() === true && col_pivots && col_pivots.length === 1
        && col_pivots[0] === this.get_combined_name()){
          return true;
      }
      return false;
    },

    row_labels_text: function (){
      let row_pivots = this.getRowPivots();

      if (row_pivots && row_pivots.length === 1 /*&& this._viewer && row_pivots[0] !== this._viewer.get_combined_name()*/){
        return this._viewer._get_dname_name(row_pivots[0]);
      }
      return "Row Labels";
    },

    col_labels_text: function (){

      let col_pivots = this.getColPivots();
      if (col_pivots && col_pivots.length === 1 /*&& this._viewer && col_pivots[0] !== this._viewer.get_combined_name()*/){
        return this._viewer._get_dname_name(col_pivots[0]);
      }

      return "Col Labels";
    },

    isRowPivot: function() {
        return this._nbRowPivots && this._nbRowPivots > 0;
    },

    isColumnPivot: function() {
        return this._isColumnPivot;
    },

    setIsColumnPivot: function(isColumnPivot) {
        this._isColumnPivot = isColumnPivot;
    },

    setColDepth: function(nb){
        this._col_depth = nb;

        //this.grid.setFixedRowCount(Math.min(this._col_depth, 1));
        if (this.isStackHeader() && !this.isStackHeaderWithFlatPivot()){
          //this.grid.properties.fixedRowCount = Math.max(this._col_depth, 1);

          if (this.contains_both_row_and_col_labels()){

            // Need an extra row to display Col Labels
            this.grid.properties.fixedRowCount = Math.max(this._col_depth, 1) + 1;
          }else{
            this.grid.properties.fixedRowCount = Math.max(this._col_depth, 1);
          }
        }else{
          //this.grid.properties.fixedRowCount = 1;

          if (this.contains_both_row_and_col_labels()){
            this.grid.properties.fixedRowCount = 2;
          }else{
            this.grid.properties.fixedRowCount = 1;
          }
        }
    },

    getColDepth: function(){
        return typeof this._col_depth === undefined ? 0: Math.max(this._col_depth, 0);
    },

    isStackHeader: function(){
        if (this._isColumnPivot && this.getColDepth() > 1 && this._viewer && !this._viewer.is_flat_pivot()){
            return true;
        }

        return false;
    },

    get_value_pivots(){
      return this._viewer.get_value_pivots(false);
    },

    is_value_pivot: function(){
      return this._viewer.is_value_pivot(false);
    },

    isStackHeaderWithFlatPivot: function(){
      return this._isColumnPivot && this.getColDepth() > 1 && this._viewer.is_flat_pivot();
    },

    setColPivots(col_pivots){
        this._col_pivots = (col_pivots || []).map((v)=>(typeof v === "object") ? v.n : v);
    },

    getColPivots(){
        return this._col_pivots || [];
    },

    contains_colpivot_value_in_first(){
        if (this._col_pivots == undefined || this._col_pivots.length == 0){
            return false;
        }

        if (this._col_pivots.length > 0){
            var index = this._col_pivots.indexOf(this.get_combined_name());
            if (index == 0){

                // Value is the first item
                return true;
            }
        }

        return false;
    },

    contains_colpivot_value_in_middle(){
        if (this._col_pivots == undefined || this._col_pivots.length == 0){
            return false;
        }

        if (this._col_pivots.length > 0){
            var index = this._col_pivots.indexOf(this.get_combined_name());
            if(index > 0 && index < this._col_pivots.length -1){
                // Values is a middle item
                return true;
            }
        }

        return false;
    },

    contains_colpivot_value_in_last(){
        if (this._col_pivots == undefined || this._col_pivots.length == 0){
            return false;
        }

        if (this._col_pivots.length > 0){
            var index = this._col_pivots.indexOf(this.get_combined_name());
            if(index != -1 && index == this._col_pivots.length -1){

                // Values is the last item
                return true;
            }
        }

        return false;
    },

    get_colpivot_value_position(){
        if (this._col_pivots == undefined || this._col_pivots.length == 0){
            return -1;
        }

        return this._col_pivots.indexOf(this.get_combined_name());
        //return this._col_pivots.map((v)=>(typeof v === "object") ? v.n : v).indexOf(this.get_combined_name());
    },

    get_combined_name(){
      let name = "__values__";
      if (this._viewer && typeof this._viewer.get_combined_name === "function"){
        name = this._viewer.get_combined_name();
      }

      return name;
    },

    setRowPivots(row_pivots){
        //this._row_pivots = row_pivots || [];
        this._row_pivots = (row_pivots || []).map((v)=>(typeof v === "object") ? v.n : v);
    },

    get_rowpivot_value_position(){
        if (this._row_pivots == undefined || this._row_pivots.length == 0){
            return -1;
        }

        return this._row_pivots.indexOf(this.get_combined_name());
    },

    getRowPivots(){
        return this._row_pivots || [];
    },

    isScrolledBeyondLastRow: function() {
        return this._scrolledBeyondLastRow;
    },

    setScrolledBeyondLastRow: function(scrolledBeyondLastRow){
        this._scrolledBeyondLastRow = scrolledBeyondLastRow;
    },

    isCached: function(rects) {
        return !rects || !rects.find(uncachedRow, this);
    },

    setDirty: function(nrows) {
        if (nrows !== this._nrows) {
            this.grid.renderer.computeCellsBounds();
        }
        this._dirty = true;
        this._nrows = nrows;
        //this._nrows = this.isRowPivot() ? nrows + 1 : nrows;
        this.grid.behaviorChanged();
    },

    set_nb_cols: function(ncols){
      this._ncols = ncols;
    },

    get_nb_cols: function(){

      if (!this._ncols){
        return 0;
      }

      return this._ncols;
    },

    set_schema_changes: function(changes_schema){
      this._is_schema_changed = changes_schema;
    },
    is_schema_changed: function(){
      return this._is_schema_changed || false;
    },

    is_qfsort_clicked: function(row, col, event){
      const colDef = this.grid.behavior.columns[col] ? this.grid.behavior.columns[col].colDef : undefined;

      // Hard code: clicking on first column/row/cell to open the quick sort & filter popup
      if (colDef && row <= this.grid.properties.fixedRowCount -1
        && this._viewer._show_grid_data === true){
        const mouse_point = event.mousePoint;
        const bounds = event._bounds;
        let width;

        if (bounds){
          width = bounds.width;
        }else if(event.column && event.column.properties){
          width = event.column.properties.width;
        }
        if (!mouse_point){
          return false;
        }

        if ((Math.abs(width - mouse_point.x) > 18 || Math.abs(width - mouse_point.x) < 3)
          /*&& mouse_point.y > 3 && mouse_point.y < 19*/){ // n pixels
          // Not click on the quick icon
          return false;
        }

        const is_row_pivot = this.isRowPivot();
        const is_column_pivot = this.isColumnPivot();
        const is_value_pivot = this.is_value_pivot();

        // None pivots
        if (!is_row_pivot && !is_column_pivot && !is_value_pivot){
          return true;
        }else if (is_row_pivot && row === this.grid.properties.fixedRowCount -1){
          const row_pivots = this.getRowPivots();
          const is_flat_pivot = this._viewer.is_flat_pivot();
          if ((col === 0) || (is_flat_pivot && col < row_pivots.length)){
            return true;
          }
        }
      }

      return false;
    },

    // Open the quick sort and filter
    _did_toggle_fsort: function(row, col, event){
      var colDef = this.grid.behavior.columns[col] ? this.grid.behavior.columns[col].colDef : undefined;

      if (colDef && row <= this.grid.properties.fixedRowCount -1
        && this._viewer._show_grid_data === true){
        const mouse_point = event.mousePoint;
        const bounds = event._bounds;
        const ratio = this.getZoomRatio();
        if ((Math.abs((bounds.width * ratio - mouse_point.x)/ratio) > 18 || Math.abs((bounds.width * ratio - mouse_point.x)/ratio) < 3)
          /*&& mouse_point.y > 3 && mouse_point.y < 19*/){ // n pixels
          // Not click on the quick icon
          return;
        }

        const is_row_pivot = this.isRowPivot();
        const is_column_pivot = this.isColumnPivot();
        const is_value_pivot = this.is_value_pivot();
        const col_pivots = this.getColPivots();
        const is_flat_pivot = this._viewer.is_flat_pivot();

        // None pivots
        if (!is_row_pivot && !is_column_pivot && !is_value_pivot){
          this._viewer._open_quick_sf(event, colDef.originalName);
        }else if(is_row_pivot || is_column_pivot){

          // Row Labels or Col Labels in first column
          if (colDef.originalName === "__ROW_PATH__" || (is_flat_pivot && col === 0)){

            if (is_row_pivot && row === this.grid.properties.fixedRowCount -1){
              const row_pivots = this.getRowPivots();
              if ((col === 0) || (is_flat_pivot && col < row_pivots.length)){
                this._viewer._open_quick_sf(event, colDef.originalName, "row_pivots");
              }
            }else if (!is_row_pivot && is_column_pivot){

              //const is_flat_pivot = this._viewer.is_flat_pivot();
              const value_position = this.get_colpivot_value_position();

              const value_pivots = this.get_value_pivots();

              if (!is_flat_pivot && value_position === -1){
                this._viewer._open_quick_sf(event, colDef.originalName, "column_pivots");
              }else if(is_flat_pivot && col_pivots && col_pivots.length === 1
                && value_pivots && value_pivots.length === 1){
                this._viewer._open_quick_sf(event, colDef.originalName, "column_pivots");
              }
            }else{
            }
          }else if (row === 0 && col === 1){ // Col Labels in the second column

            if (this.contains_both_row_and_col_labels() === true){
              this._viewer._open_quick_sf(event, col_pivots[0], "column_pivots");
            }
          }else{
          }

        }
      }
    },

    _did_toggle_row: async function(row, col, event) {
      var colDef = this.grid.behavior.columns[col] ? this.grid.behavior.columns[col].colDef : undefined;
      if (!colDef){
        return;
      }

      var is_stack_header = this.isStackHeader();

      if (colDef && colDef.isTree && row > this.grid.properties.fixedRowCount -1) {
          let isShift = false;
          if (event.primitiveEvent.detail.primitiveEvent) {
              isShift = !!event.primitiveEvent.detail.primitiveEvent.shiftKey; // typecast to boolean
          }

          row = row - this.grid.properties.fixedRowCount + 1;
          let is_expanded = await this._view.get_row_expanded(row);
          if (isShift) {
              if (is_expanded) {
                  if (this.data[row][col].rowPath.length === 1) {
                      this._view.collapse(row);
                  } else {
                      this._view.set_depth(this.data[row][col].rowPath.length - 2);
                  }
              } else {
                  this._view.set_depth(this.data[row][col].rowPath.length - 1);
              }
          } else {
              if (is_expanded) {
                  this._view.collapse(row);
              } else {
                  this._view.expand(row);
              }
          }
          let nrows = await this._view.num_rows();
          this.setDirty(nrows);
          this.grid.canvas.paintNow();
      }else if(is_stack_header && row >= 0 && row < this.grid.properties.fixedRowCount -1){
          if (colDef.stack_values  === undefined){
              // No collapse or expand here
              return;
          }

          if (colDef.stack_values.length == 0){
              return;
          }

          const contains_col_label_in_2nd_column = this.contains_both_row_and_col_labels();

          if (contains_col_label_in_2nd_column === true){

            // Nothing to expand or collapse the tree node in the row of Col Labels
            if (row === 0){
              return;
            }else{
              // Need to adjust row to identify the tree node. It must not include the first row
              row = Math.max(row -1, 0);
            }

          }

          var _this = this;
          var collapse_index = colDef.stack_values.findIndex((v)=>v.row_index == row);
          if (collapse_index != -1){

              var colDefs = this.grid.columnDefs;
              var cols = colDef.stack_values[collapse_index].cols;

              let is_col_expanded = colDef.stack_values[collapse_index].is_expanded;
              //var belong_to_tree_row_index = colDef.stack_values[collapse_index].belong_to_tree_row_index;
              var is_tree = false;
              var stack_values = colDef.stack_values;
              var belong_to_tree_row_index = undefined;
              var stack_value_item = undefined;
              var col_ref = colDef.stack_values[collapse_index].col_ref;

              if (!colDef.stack_values[collapse_index].is_tree){

                  // Check if it's a tree node when other node is collapsed/expanded
                  for (var j=0; j<stack_values.length; j++){
                      var m_values = stack_values[j].mapping_values;

                      if (m_values !== undefined && m_values.length > 0){
                          // Check if it matches the condition
                          var m_value_index = m_values.findIndex((v)=>{
                              var svindex = stack_values.findIndex((sv)=>{
                                  if (v.condition.column_name === undefined){
                                      return v.condition !== undefined && v.condition.row_index === sv.row_index && v.condition.is_tree === sv.is_tree;
                                  }else{
                                      // Need to find the specificied column name to check its tree
                                      var f_stack_values = undefined;
                                      var f_col_index = _this.grid.visibleColumnDefs.findIndex((f)=>f.originalName === v.condition.column_name);
                                      if (f_col_index != -1){
                                          f_stack_values = _this.grid.visibleColumnDefs[f_col_index].stack_values;
                                      }else{
                                          f_col_index = _this.grid.columnDefs.findIndex((f)=>f.originalName === v.condition.column_name);
                                          if (f_col_index != -1){
                                              f_stack_values = _this.grid.columnDefs[f_col_index].stack_values;
                                          }
                                      }

                                      if (f_stack_values === undefined){
                                          return false;
                                      }

                                      if (f_stack_values.length === 0){
                                          return false;
                                      }

                                      var f_row_item_index = f_stack_values.findIndex((f)=>f.row_index === sv.row_index);

                                      // Not found
                                      if (f_row_item_index == -1){
                                          return false;
                                      }

                                      var f_tree = f_stack_values[f_row_item_index].is_tree;
                                      return v.condition !== undefined && v.condition.row_index === sv.row_index && v.condition.is_tree === f_tree;
                                  }
                              });

                              if (svindex != -1){
                                  return true;
                              }
                              return false;
                          });

                          if (m_value_index != -1){

                              if (m_values[m_value_index].values != undefined
                                  && m_values[m_value_index].values.length > 0){
                                  var m_i = m_values[m_value_index].values.findIndex((v)=>v.row_index === row);
                                  if (m_i == -1){
                                      continue;
                                  }

                                  if (m_values[m_value_index].values[m_i].is_tree !== undefined && m_values[m_value_index].values[m_i].is_tree === true){
                                      belong_to_tree_row_index = m_values[m_value_index].values[m_i].belong_to_tree_row_index;
                                      if (belong_to_tree_row_index !== undefined && belong_to_tree_row_index >= 0){

                                          if (stack_values[belong_to_tree_row_index].is_tree === true){
                                              //stack_value_item = Object.assign({}, stack_values[belong_to_tree_row_index]);
                                              stack_value_item = {};
                                              stack_value_item.cols = m_values[m_value_index].values[m_i].cols;
                                              stack_value_item.is_tree = true;
                                              stack_value_item.is_expanded = true;
                                              stack_value_item.col_ref = m_values[m_value_index].values[m_i].col_ref;

                                              cols = stack_value_item.cols;
                                              col_ref = stack_value_item.col_ref;
                                              is_tree = true;
                                              is_col_expanded = true;
                                              break;
                                          }
                                      }
                                  }
                              }
                          }
                      }
                  }

                  // Not a tree node
                  if (!is_tree){
                      return;
                  }
              }

              if (!cols || cols.length == 0){
                  // No columns to collapse or expand
                  return;
              }

              //let is_col_expanded = this._viewer.is_stackcol_expanded(row, col);
              if (is_col_expanded){
                  if (colDefs && cols && cols.length > 0){
                      for (var j = 0; j< cols.length; j++){
                          var col_index = colDefs.findIndex((v)=>v.originalName == cols[j] && !v.isHidden);
                          if (col_index != -1){
                              //colDefs.splice(col_index, cols.length);
                              colDefs[col_index]["isHidden"] = true;
                          }
                      }

                      // Show expand icon at [name] total column
                      //var col_ref = colDef.stack_values[collapse_index].col_ref;
                      if (col_ref){
                          // Find [name] total column
                          var col_ref_index = colDefs.findIndex((v)=>v.originalName == col_ref);
                          if (col_ref_index != -1){
                              if (colDefs[col_ref_index].stack_values && colDefs[col_ref_index].stack_values[collapse_index]){
                                  colDefs[col_ref_index].stack_values[collapse_index].is_tree = true;
                                  colDefs[col_ref_index].stack_values[collapse_index].is_expanded = !is_col_expanded;

                                  colDefs[col_ref_index]["isHidden"] = false;

                                  // Need to enable the columns in the out of tree children because they are turned off in case subtotals
                                  var out_of_tree_children = colDef.stack_values[collapse_index].out_of_tree_children || [];
                                  for (var oi = 0; oi < out_of_tree_children.length; oi++){
                                    var o_index = colDefs.findIndex((v)=>v.originalName === out_of_tree_children[oi]);
                                    if (o_index != -1){
                                      colDefs[o_index]["isHidden"] = false;
                                    }
                                  }
                              }
                          }
                      }

                      this.grid.api.setColumnDefs(colDefs);
                  }
                  this._viewer.collapse_stackcol(row, col);
              }else{

                if (colDefs && cols && cols.length > 0){
                    for (var j = 0; j< cols.length; j++){
                        var col_index = colDefs.findIndex((v)=>v.originalName == cols[j] && v.isHidden === true);
                        if (col_index != -1){
                            colDefs[col_index]["isHidden"] = false;

                            // Keep previous sub tree state. If the sub tree is collapsed, it must be collapsed although its parent tree is expanded
                            if (colDefs[col_index]["is_out_of_tree_col"] === true){

                                var s_values = colDefs[col_index].stack_values || [];
                                for (var sv_j = 0; sv_j < s_values.length; sv_j++){
                                    if (s_values[sv_j].is_tree == true && s_values[sv_j].cols != undefined){
                                        for (var j2 = 0; j2 < s_values[sv_j].cols.length; j2++){
                                            var col_index2 = colDefs.findIndex((v)=>v.originalName == s_values[sv_j].cols[j2] && v.isHidden === false);
                                            if (col_index2 != -1){
                                                colDefs[col_index2]["isHidden"] = true;
                                            }
                                        }

                                    }
                                }
                            }
                        }
                    }

                    // Set non-tree [name] total
                    var col_ref_index = colDefs.findIndex((v)=>v.originalName == colDef.originalName);
                    if (col_ref_index != -1){
                        if (colDefs[col_ref_index].stack_values && colDefs[col_ref_index].stack_values[collapse_index]){
                            colDefs[col_ref_index].stack_values[collapse_index].is_tree = false;
                            colDefs[col_ref_index].stack_values[collapse_index].is_expanded = !is_col_expanded;

                            if (colDefs[col_ref_index].subtotals !== undefined && colDefs[col_ref_index].subtotals === false){
                              colDefs[col_ref_index]["isHidden"] = true;
                            }

                            // Find other out of tree columns to hide them in case subtotals
                            var parent_index = colDefs.findIndex((v)=>v.originalName === cols[0]);
                            if (parent_index != -1){
                              var out_of_tree_children = colDefs[parent_index].stack_values[collapse_index].out_of_tree_children || [];
                              for (var oi = 0; oi < out_of_tree_children.length; oi++){
                                var o_index = colDefs.findIndex((v)=>v.originalName === out_of_tree_children[oi]);
                                if (o_index != -1){
                                  if (colDefs[o_index].subtotals !== undefined && colDefs[o_index].subtotals === false){
                                    colDefs[o_index]["isHidden"] = true;
                                  }
                                }
                              }
                            }
                        }
                    }
                    this.grid.api.setColumnDefs(colDefs);
                }

                  this._viewer.expand_stackcol(row, col);
              }
          }

          let nrows = await this._view.num_rows();
          this.setDirty(nrows);
          this.grid.canvas.paintNow();
      }
    },

    // Called when clicking on a row group expand
    toggleRow: async function(row, col, event) {
        /*
        //var colDef = this.grid.api.getColumnDefAtIndex(col);
        var colDef = this.grid.behavior.columns[col] ? this.grid.behavior.columns[col].colDef : undefined;

        var is_stack_header = this.isStackHeader();

        //if (this.isTreeCol(col) && row > 0) {
        if (colDef && colDef.isTree && row > this.grid.properties.fixedRowCount -1) {
            let isShift = false;
            if (event.primitiveEvent.detail.primitiveEvent) {
                isShift = !!event.primitiveEvent.detail.primitiveEvent.shiftKey; // typecast to boolean
            }
            //row = row - this.grid.api.getNumHeaderRow() + 1;
            row = row - this.grid.properties.fixedRowCount + 1;
            let is_expanded = await this._view.get_row_expanded(row);
            if (isShift) {
                if (is_expanded) {
                    if (this.data[row][col].rowPath.length === 1) {
                        this._view.collapse(row);
                    } else {
                        this._view.set_depth(this.data[row][col].rowPath.length - 2);
                    }
                } else {
                    this._view.set_depth(this.data[row][col].rowPath.length - 1);
                }
            } else {
                if (is_expanded) {
                    this._view.collapse(row);
                } else {
                    this._view.expand(row);
                }
            }
            let nrows = await this._view.num_rows();
            this.setDirty(nrows);
            this.grid.canvas.paintNow();
        }else if(is_stack_header && row >= 0 && row < this.grid.properties.fixedRowCount -1){
            if (colDef.stack_values  === undefined){
                // No collapse or expand here
                return;
            }

            if (colDef.stack_values.length == 0){
                return;
            }
            var _this = this;
            var collapse_index = colDef.stack_values.findIndex((v)=>v.row_index == row);
            if (collapse_index != -1){

                var colDefs = this.grid.columnDefs;
                var cols = colDef.stack_values[collapse_index].cols;

                let is_col_expanded = colDef.stack_values[collapse_index].is_expanded;
                //var belong_to_tree_row_index = colDef.stack_values[collapse_index].belong_to_tree_row_index;
                var is_tree = false;
                var stack_values = colDef.stack_values;
                var belong_to_tree_row_index = undefined;
                var stack_value_item = undefined;
                var col_ref = colDef.stack_values[collapse_index].col_ref;

                if (!colDef.stack_values[collapse_index].is_tree){

                    // Check if it's a tree node when other node is collapsed/expanded
                    for (var j=0; j<stack_values.length; j++){
                        var m_values = stack_values[j].mapping_values;

                        if (m_values !== undefined && m_values.length > 0){
                            // Check if it matches the condition
                            var m_value_index = m_values.findIndex((v)=>{
                                var svindex = stack_values.findIndex((sv)=>{
                                    if (v.condition.column_name === undefined){
                                        return v.condition !== undefined && v.condition.row_index === sv.row_index && v.condition.is_tree === sv.is_tree;
                                    }else{
                                        // Need to find the specificied column name to check its tree
                                        var f_stack_values = undefined;
                                        var f_col_index = _this.grid.visibleColumnDefs.findIndex((f)=>f.originalName === v.condition.column_name);
                                        if (f_col_index != -1){
                                            f_stack_values = _this.grid.visibleColumnDefs[f_col_index].stack_values;
                                        }else{
                                            f_col_index = _this.grid.columnDefs.findIndex((f)=>f.originalName === v.condition.column_name);
                                            if (f_col_index != -1){
                                                f_stack_values = _this.grid.columnDefs[f_col_index].stack_values;
                                            }
                                        }

                                        if (f_stack_values === undefined){
                                            return false;
                                        }

                                        if (f_stack_values.length === 0){
                                            return false;
                                        }

                                        var f_row_item_index = f_stack_values.findIndex((f)=>f.row_index === sv.row_index);

                                        // Not found
                                        if (f_row_item_index == -1){
                                            return false;
                                        }

                                        var f_tree = f_stack_values[f_row_item_index].is_tree;
                                        return v.condition !== undefined && v.condition.row_index === sv.row_index && v.condition.is_tree === f_tree;
                                    }
                                });

                                if (svindex != -1){
                                    return true;
                                }
                                return false;
                            });

                            if (m_value_index != -1){

                                if (m_values[m_value_index].values != undefined
                                    && m_values[m_value_index].values.length > 0){
                                    var m_i = m_values[m_value_index].values.findIndex((v)=>v.row_index === row);
                                    if (m_i == -1){
                                        continue;
                                    }

                                    if (m_values[m_value_index].values[m_i].is_tree !== undefined && m_values[m_value_index].values[m_i].is_tree === true){
                                        belong_to_tree_row_index = m_values[m_value_index].values[m_i].belong_to_tree_row_index;
                                        if (belong_to_tree_row_index !== undefined && belong_to_tree_row_index >= 0){

                                            if (stack_values[belong_to_tree_row_index].is_tree === true){
                                                //stack_value_item = Object.assign({}, stack_values[belong_to_tree_row_index]);
                                                stack_value_item = {};
                                                stack_value_item.cols = m_values[m_value_index].values[m_i].cols;
                                                stack_value_item.is_tree = true;
                                                stack_value_item.is_expanded = true;
                                                stack_value_item.col_ref = m_values[m_value_index].values[m_i].col_ref;

                                                cols = stack_value_item.cols;
                                                col_ref = stack_value_item.col_ref;
                                                is_tree = true;
                                                is_col_expanded = true;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Not a tree node
                    if (!is_tree){
                        return;
                    }
                }

                if (!cols || cols.length == 0){
                    // No columns to collapse or expand
                    return;
                }

                //let is_col_expanded = this._viewer.is_stackcol_expanded(row, col);
                if (is_col_expanded){
                    if (colDefs && cols && cols.length > 0){
                        for (var j = 0; j< cols.length; j++){
                            var col_index = colDefs.findIndex((v)=>v.originalName == cols[j] && !v.isHidden);
                            if (col_index != -1){
                                //colDefs.splice(col_index, cols.length);
                                colDefs[col_index]["isHidden"] = true;
                            }
                        }

                        // Show expand icon at [name] total column
                        //var col_ref = colDef.stack_values[collapse_index].col_ref;
                        if (col_ref){
                            // Find [name] total column
                            var col_ref_index = colDefs.findIndex((v)=>v.originalName == col_ref);
                            if (col_ref_index != -1){
                                if (colDefs[col_ref_index].stack_values && colDefs[col_ref_index].stack_values[collapse_index]){
                                    colDefs[col_ref_index].stack_values[collapse_index].is_tree = true;
                                    colDefs[col_ref_index].stack_values[collapse_index].is_expanded = !is_col_expanded;

                                    colDefs[col_ref_index]["isHidden"] = false;

                                    // Need to enable the columns in the out of tree children because they are turned off in case subtotals
                                    var out_of_tree_children = colDef.stack_values[collapse_index].out_of_tree_children || [];
                                    for (var oi = 0; oi < out_of_tree_children.length; oi++){
                                      var o_index = colDefs.findIndex((v)=>v.originalName === out_of_tree_children[oi]);
                                      if (o_index != -1){
                                        colDefs[o_index]["isHidden"] = false;
                                      }
                                    }
                                }
                            }
                        }

                        this.grid.api.setColumnDefs(colDefs);
                    }
                    this._viewer.collapse_stackcol(row, col);
                }else{

                  if (colDefs && cols && cols.length > 0){
                      for (var j = 0; j< cols.length; j++){
                          var col_index = colDefs.findIndex((v)=>v.originalName == cols[j] && v.isHidden === true);
                          if (col_index != -1){
                              colDefs[col_index]["isHidden"] = false;

                              // Keep previous sub tree state. If the sub tree is collapsed, it must be collapsed although its parent tree is expanded
                              if (colDefs[col_index]["is_out_of_tree_col"] === true){

                                  var s_values = colDefs[col_index].stack_values || [];
                                  for (var sv_j = 0; sv_j < s_values.length; sv_j++){
                                      if (s_values[sv_j].is_tree == true && s_values[sv_j].cols != undefined){
                                          for (var j2 = 0; j2 < s_values[sv_j].cols.length; j2++){
                                              var col_index2 = colDefs.findIndex((v)=>v.originalName == s_values[sv_j].cols[j2] && v.isHidden === false);
                                              if (col_index2 != -1){
                                                  colDefs[col_index2]["isHidden"] = true;
                                              }
                                          }

                                      }
                                  }
                              }
                          }
                      }

                      // Set non-tree [name] total
                      var col_ref_index = colDefs.findIndex((v)=>v.originalName == colDef.originalName);
                      if (col_ref_index != -1){
                          if (colDefs[col_ref_index].stack_values && colDefs[col_ref_index].stack_values[collapse_index]){
                              colDefs[col_ref_index].stack_values[collapse_index].is_tree = false;
                              colDefs[col_ref_index].stack_values[collapse_index].is_expanded = !is_col_expanded;

                              if (colDefs[col_ref_index].subtotals !== undefined && colDefs[col_ref_index].subtotals === false){
                                colDefs[col_ref_index]["isHidden"] = true;
                              }

                              // Find other out of tree columns to hide them in case subtotals
                              var parent_index = colDefs.findIndex((v)=>v.originalName === cols[0]);
                              if (parent_index != -1){
                                var out_of_tree_children = colDefs[parent_index].stack_values[collapse_index].out_of_tree_children || [];
                                for (var oi = 0; oi < out_of_tree_children.length; oi++){
                                  var o_index = colDefs.findIndex((v)=>v.originalName === out_of_tree_children[oi]);
                                  if (o_index != -1){
                                    if (colDefs[o_index].subtotals !== undefined && colDefs[o_index].subtotals === false){
                                      colDefs[o_index]["isHidden"] = true;
                                    }
                                  }
                                }
                              }
                          }
                      }
                      this.grid.api.setColumnDefs(colDefs);
                  }

                    this._viewer.expand_stackcol(row, col);
                }
            }

            let nrows = await this._view.num_rows();
            this.setDirty(nrows);
            this.grid.canvas.paintNow();
        }

        // Hard code: clicking on first column/row/cell to open the quick sort & filter popup
        if (colDef && row <= this.grid.properties.fixedRowCount -1
          && this._viewer._show_grid_data === true){
          const mouse_point = event.mousePoint;
          const bounds = event._bounds;
          if ((Math.abs(bounds.width - mouse_point.x) > 18 || Math.abs(bounds.width - mouse_point.x) < 3)
            ){ // n pixels
            // Not click on the quick icon
            return;
          }

          const is_row_pivot = this.isRowPivot();
          const is_column_pivot = this.isColumnPivot();
          const is_value_pivot = this.is_value_pivot();

          // None pivots
          if (!is_row_pivot && !is_column_pivot && !is_value_pivot){
            this._viewer._open_quick_sf(event, colDef.originalName);
          }else if (is_row_pivot && row === this.grid.properties.fixedRowCount -1){
            const row_pivots = this.getRowPivots();
            const is_flat_pivot = this._viewer.is_flat_pivot();
            if ((col === 0) || (is_flat_pivot && col < row_pivots.length)){
              this._viewer._open_quick_sf(event, colDef.originalName, "row_pivots");
            }
          }else if (!is_row_pivot && is_column_pivot){
            const is_flat_pivot = this._viewer.is_flat_pivot();
            const value_position = this.get_colpivot_value_position();
            if (!is_flat_pivot && value_position === -1){
              this._viewer._open_quick_sf(event, colDef.originalName, "column_pivots");
            }
          }
        }
        */

        await this._did_toggle_row(row, col, event);
        this._did_toggle_fsort(row, col, event);
    },

    isDrillDown: function(){
        return true;
    },

    fetchData: async function(rectangles, resolve) {
        rectangles = getSubrects.call(this.grid.renderer);

        if (this._view === undefined) {
            resolve(true);
            return;
        }

        if (!this._dirty && !rectangles.find(uncachedRow, this)) {
            resolve(false);
            return;
        }

        if (this._outstanding_requested_rects && rectangles[0].within(this._outstanding_requested_rects[0])) {
            resolve(true);
            return;
        }

        this._dirty = false;
        this._outstanding_requested_rects = rectangles;

        // we are using _pending_data && _is_fetching
        // we store the last fetching request data as _pending_data
        if (this._is_fetching) {
            if (this._pending_data && this._pending_data.resolve) {
                this._pending_data.resolve(true);
            }
            this._pending_data = {rectangles, resolve};
            return;
        }

        this._is_fetching = true;
        const promises = rectangles.map(rect =>
            this.pspFetch({
                start_row: rect.origin.y,
                end_row: rect.corner.y,
                start_col: rect.origin.x,
                end_col: rect.corner.x + 1
            })
        );

        try {
            await Promise.all(promises);
            const rects = getSubrects.call(this.grid.renderer);
            this.firstFetch = false;
            resolve(!!rects.find(uncachedRow, this));

        } catch (e) {
            resolve(true);
        } finally {
            this._outstanding_requested_rects = undefined;

            // recall fetchData with last pending_data.
            if (this._pending_data) {
                const temp_pending_data = this._pending_data;
                requestAnimationFrame(() =>
                    this.fetchData(
                        temp_pending_data.rectangles,
                        temp_pending_data.resolve));
                this._pending_data = undefined;
            }

            this._is_fetching = false;
        }
    },

    getCell: function(config, rendererName) {
        var nextRow, depthDelta;
        /*
        if (config.isUserDataArea) {
            cellStyle.call(this, config, rendererName);
        } else if (config.dataCell.x === TREE_COLUMN_INDEX && config.value) {
        if (config.dataCell.x === TREE_COLUMN_INDEX && config.value) {
            nextRow = this.getRow(config.dataCell.y + 1);
            depthDelta = nextRow ? config.value.rowPath.length - nextRow[TREE_COLUMN_INDEX].rowPath.length : 1;
            config.last = depthDelta !== 0;
            config.expanded = depthDelta < 0;
            config._type = this.schema[-1].type[config.value.rowPath.length - 2];
        }
        */

        var columnInfoIdentifier;
        if (this.isRowPivot() || this.isStackHeader()) {
            if (config.colDef && config.colDef.isTree && config.value
              && config.dataCell.y != TREE_HEADER_ROW_INDEX
            /*&& config.dataCell.y > config.grid.properties.fixedRowCount -1*/) { // __ROW_PATH__ column's data, not in the header row(s)

                nextRow = this.getRow(config.dataCell.y + 1);
                //if (nextRow[config.colDef.field].rowPath !== undefined){
                  depthDelta = config.value.rowPath && nextRow && nextRow[config.colDef.field].rowPath
                    ? config.value.rowPath.length - nextRow[config.colDef.field].rowPath.length
                    : 1;
                  config.last = depthDelta !== 0;
                  config.expanded = depthDelta < 0;
                  //config._type = this.schema[config.dataCell.x].type[config.value.rowPath.length - 2];
                //}
            }else{

                // Stack header
                if (config.value && /*config.dataCell.y > 0 &&*/ config.dataCell.y < config.grid.properties.fixedRowCount -1 && config.value.is_tree){
                    if (config.value.always_collapse_icon === true){
                        config.expanded = false;
                    }else{
                        config.expanded = true;
                    }
                }
            }
        }

        return config.grid.cellRenderers.get(rendererName);
    },

    pspFetch: async function() {}
});

function isStringUrl(string) {
    if (!string) {
        return false;
    }
    var URL_REGEXP = /^(\s*(http|https|ftp|ftps|itmss)\:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,6}(\/[^\s,;]*)?)$/g; // copy from datadoc
    return URL_REGEXP.test(string);
}

function getSubrects(nrows) {
    if (!this.dataWindow) {
        return [];
    }
    var dw = this.dataWindow;
    var rect = this.grid.newRectangle(dw.left, dw.top, dw.width, nrows ? Math.min(nrows - dw.top, dw.height) : dw.height); // convert from InclusiveRect
    return [rect];
}

function uncachedRow(rect) {
    if (rect.origin.x > this.getColumnsWithValuesCount() - 1){
        return false;
    }
    let start_row = this.data[rect.origin.y];
    let end_row = this.data[Math.min(rect.corner.y, this.getRowCount() - 1)];
    let startColName = this.getColumnName(rect.origin.x);
    let endColName = this.getColumnName(Math.min(rect.corner.x - 1, this.getColumnsWithValuesCount() - 1));
    return !(start_row && start_row[startColName] !== undefined && end_row && end_row[endColName] !== undefined);
}

function cellStyle(gridCellConfig) {
    if (gridCellConfig.value === null || gridCellConfig.value === undefined) {
        gridCellConfig.value = "-";
    } else {
        const type = this.schema[gridCellConfig.dataCell.x].type;
        if (["number", "float", "integer"].indexOf(type) > -1) {
            if (gridCellConfig.value === 0) {
                gridCellConfig.value = type === "float" ? "0.00" : "0";
            } else if (isNaN(gridCellConfig.value)) {
                gridCellConfig.value = "-";
            } else {
                if (gridCellConfig.value > 0) {
                    gridCellConfig.color = gridCellConfig.columnColorNumberPositive || "rgb(160,207,255)";
                    gridCellConfig.backgroundColor = gridCellConfig.columnBackgroundColorNumberPositive ? gridCellConfig.columnBackgroundColorNumberPositive : gridCellConfig.backgroundColor;
                } else {
                    gridCellConfig.color = gridCellConfig.columnColorNumberNegative || "rgb(255,136,136)";
                    gridCellConfig.backgroundColor = gridCellConfig.columnBackgroundColorNumberNegative ? gridCellConfig.columnBackgroundColorNumberNegative : gridCellConfig.backgroundColor;
                }
            }
        } else if (type === "boolean") {
            gridCellConfig.value = String(gridCellConfig.value);
        }
    }
}
module.exports = DatasaurLocal;
