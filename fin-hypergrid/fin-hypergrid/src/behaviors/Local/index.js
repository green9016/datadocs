'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Behavior = require('../Behavior');

/** @memberOf Local~
 * @default require('datasaur-local')
 * @type {function|function[]}
 * @summary Default data model.
 * @desc The default data model for newly instantiated `Hypergrid` objects without `DataModel` or `dataModel` options specified. Scheduled for eventual deprecation at which point one of the options will be required.
 */
//var DefaultDataModel = require('datasaur-local');
var DefaultDataModel = require('../../DatasaurLocal');

var decorators = require('./decorators');
var dispatchDataModelEvent = require('./dispatchDataModelEvent');

var GRAND_TOTAL = '$$grand_total';

/**
 * This class mimics the {@link DataModel}.
 * > This constructor (actually {@link Local#initialize}) will be called upon instantiation of this class or of any class that extends from this class. See {@link https://github.com/joneit/extend-me|extend-me} for more info.
 * @constructor
 * @extends Behavior
 */
var Local = Behavior.extend('Local', {

    initialize: function(grid, options) {
        this.setData(options);
    },

    /**
     * @summary Convenience getter/setter.
     * @desc Calls the data model's `getSchema`/`setSchema` methods.
     * @see {@link https://fin-hypergrid.github.io/doc/DataModel.html#getSchema|getSchema}
     * @see {@link https://fin-hypergrid.github.io/doc/DataModel.html#setSchema|setSchema}
     * @type {Array}
     * @memberOf Local#
     */
    get schema() {
        return this.dataModel.getSchema();
    },
    set schema(newSchema) {
        this.dataModel.setSchema(newSchema);
    },

    dataModelEventHandlers: require('./events').dataModelEventHandlers, // for adding additional event handlers

    createColumns: function() {
        var _this = this;

        Behavior.prototype.createColumns.call(this);

        console.log("=========createColumns============");
        // No need to use old properties for speed.
        // Create new columns is much faster.
        this.schema.forEach(function (columnSchema, index) {
            var _newColumn = _this.addColumn({
                index: index,
                header: columnSchema.header,
                calculator: columnSchema.calculator,
                colDef: columnSchema.colDef
            });

            // restore width from previous schema when data just refreshed.
            // this is needed because of almost total refresh of grid
            if (columnSchema.width) {
                Object.assign(_newColumn.properties, {
                    width: columnSchema.width,
                    columnAutosizing: false
                });
            }

            if (columnSchema.formatter) {
                _newColumn.properties.format = _newColumn.name;
                _newColumn.schema.format = _newColumn.name;
                var options = {
                    name: _newColumn.name,
                    format: columnSchema.formatter, // called for render view
                    parse: function parse(value) {
                        return value;
                    }, // called for render value in editor
                    locale: 'en'
                };
                _this.grid.localization.add(_newColumn.name, options);
            }

            ['halign', 'maxWidth', 'cellContextMenu'].forEach(function (key) {
                if (columnSchema[key]) {
                    _newColumn.properties[key] = columnSchema[key];
                }
            });
        }, this);
    },

    /**
     * @memberOf Local#
     * @description Calculate column prefered size based on cells content
     * @param {number|object} xOrColumn - column object or index
     * @param {boolean} force - if true, width will be changed even if column autosizing disabled
     */
    fitColumn: function fitColumn(xOrColumn, force) {
        var _this2 = this;

        if ((typeof xOrColumn === 'undefined' ? 'undefined' : _typeof(xOrColumn)) !== 'object') {
            xOrColumn = this.getColumn(xOrColumn);
        }

        var column = xOrColumn;
        //var isTree = column.index === this.treeColumnIndex;
        var isTree = column.colDef && column.colDef.isTree;
        var data = this.getData();
        var gc = this.grid.canvas.gc;

        var props = column.properties;

        var width = column.width || props.defaultColumnWidth;

        // get max width based of
        data.forEach(function (d, i) {
            var val = column.getValue(i);
            var depth = 0;
            var xOffset = 0;
            var lineNodeSpace = 16;
            var leaf = true;
            var iconWidth = 3;
            var iconPaddingRight = 5;
            if (isTree && val && val.rollup){
                //xOffset = lineNodeSpace;
                leaf = val.isLeaf;
                depth = val.rowPath.length - 1;
                for (var i = 1; i <= depth; i++) {
                    xOffset += lineNodeSpace;
                }
                if (!leaf){
                    xOffset += iconWidth + iconPaddingRight;
                }

                if (xOffset > 0){
                    xOffset += props.cellPaddingRight;
                }
                val = val.rollup;
            }

            if (Array.isArray(val)) {
                val = '[' + val.join(', ') + ']';
            }
            
            var schema = column.schema;

            if (val && ((typeof val === 'undefined' ? 'undefined' : _typeof(val)) !== 'object' || val instanceof Array)) {
                var widths = {};

                var dataProps = _this2.getRowProperties(i) || props;
                widths.cellPaddingRight = props.cellPaddingRight;

                if (dataProps.showCellContextMenuIcon) {
                    gc.cache.font = props.contextMenuIconFont;
                    widths.showCellContextMenuIcon = props.contextMenuButtonIconPreferedWidth + 2 * props.contextMenuButtonPadding + props.contextMenuLeftSpaceToCutText;
                }

                if (dataProps.showColumnType && schema.colTypeSign) {
                    widths.colTypeSign = (widths.showCellContextMenuIcon || 0) + widths.cellPaddingRight;
                }

                if (schema && schema.headerPrefix && dataProps.headerRow) {
                    gc.cache.font = props.columnTitlePrefixFont;
                    widths.headerPrefix = gc.getTextWidth(schema.headerPrefix) + props.columnTitlePrefixRightSpace;
                }

                if (column.hasError && dataProps.headerRow) {
                    gc.cache.font = props.errorIconFont;
                    widths.hasError = gc.getTextWidth(props.errorIconUnicodeChar) + props.columnTitlePrefixRightSpace;
                }

                if (column.name.startsWith('$$aggregation')) {
                    var treeLevel = _this2.getRowTreeLevel(d);
                    var treeOffset = treeLevel ? _this2.getRowTreeLevel(d) * props.aggregationGroupTreeLevelOffset : 0;
                    widths.treeOffset = treeOffset;

                    var aggregationCount = _this2.getAggregationChildCount(d);
                    if (aggregationCount > 0) {
                        gc.cache.font = props.cellValuePostfixFont;
                        widths.aggregationCount = props.cellPaddingLeft + treeOffset + gc.getTextWidth('(' + aggregationCount + ')') + props.cellValuePostfixLeftOffset;
                    }
                }

                if (_this2.isExpandableRow(d) || _this2.dataModel.getHasChildColumnsFromCell(column.index, i)) {
                    var valuePrefix = props['aggregationGroupExpandIcon' + (_this2.isRowExpanded(d) ? 'Collapsed' : 'Expanded') + 'Char'];
                    if (valuePrefix) {
                        gc.cache.font = props.aggregationGroupExpandIconFont;
                        widths.valuePrefix = gc.getTextWidth(valuePrefix) + props.columnTitlePrefixRightSpace;
                    }
                }

                var count = column.getCount(i);
                if (count !== undefined) {
                    gc.cache.font = props.cellValuePostfixFont;
                    widths.valuePostfix = gc.getTextWidth('(' + count + ')') + props.cellValuePostfixLeftOffset;
                }

                gc.cache.font = dataProps.font;
                if (dataProps.headerRow){
                    gc.invalidFontCache(gc.cache.font);
                }
                widths.val = gc.getTextWidth(_this2.grid.formatValue(column.name, val, dataProps.headerRow)) + props.cellPaddingLeft;

                // console.log('widths', val, widths);
                var textWidth = Object.values(widths).reduce(function (a, b) {
                    return a + b;
                }, 0);
                // console.log('textWidth', textWidth);

                var colspan = _this2.dataModel.getColspan(column.index, i);
                if (colspan > 0) {
                    textWidth = textWidth / (colspan + 1);
                    for (var _i = column.index; _i <= column.index + colspan; ++_i) {
                        _this2.getColumn(_i).width = textWidth;
                    }
                }

                textWidth += xOffset;

                if (textWidth > width) {
                    width = textWidth;
                }
            }
        });

        if (width > props.maxWidth) {
            width = props.maxWidth;
        }

        props.preferredWidth = Math.ceil(width);

        if (force || props.columnAutosizing) {
            if (props.preferredWidth > 0) {
                column.setWidth(props.preferredWidth);
            }
        }
    },

    /**
     * @memberOf Local#
     * @description Recalculate all columns prefered sizes
     * @return {array} - affected columns
     */
    fitColumns: function fitColumns() {
        var _this3 = this;

        var gc = this.grid.canvas.gc;
        var oldFont = gc.cache.font;
        this.allColumns.forEach(function (c) {
            return _this3.fitColumn(c);
        });
        gc.cache.font = oldFont;

        return this.allColumns;
    },

    /**
     * @memberOf Local#
     * @description Find columns by given group Id and recalculate prefered size for each
     * @param {string} groupId - column group id
     * @return {array} - affected columns
     */
    fitColumnsGroup: function fitColumnsGroup(groupId) {
        var _this4 = this;

        var columnsToFit = this.allColumns.filter(function (ac) {
            return ac.schema && ac.schema.topGroupsIds && ac.schema.topGroupsIds.includes(groupId);
        });

        if (columnsToFit.length > 0) {
            var gc = this.grid.canvas.gc;
            var oldFont = gc.cache.font;
            columnsToFit.forEach(function (c) {
                return _this4.fitColumn(c);
            });
            gc.cache.font = oldFont;
        }

        return columnsToFit;
    },

    /**
     * @memberOf Local#
     * @description Set the header labels.
     * @param {string[]|object} headers - The header labels. One of:
     * * _If an array:_ Must contain all headers in column order.
     * * _If a hash:_ May contain any headers, keyed by field name, in any order.
     */
    setHeaders: function setHeaders(headers) {
        if (headers instanceof Array) {
            // Reset all headers
            var allColumns = this.allColumns;
            headers.forEach(function (header, index) {
                allColumns[index].header = header; // setter updates header in both column and data source objects
            });
        } else if ((typeof headers === 'undefined' ? 'undefined' : _typeof(headers)) === 'object') {
            // Adjust just the headers in the hash
            this.allColumns.forEach(function (column) {
                if (headers[column.name]) {
                    column.header = headers[column.name];
                }
            });
        }
    },

    /**
     * @memberOf Local#
     * @summary Set grid data.
     * @desc Exits without doing anything if no data (`dataRows` undefined or omitted and `options.data` undefined).
     *
     * @param {function|object[]} [dataRows=options.data] - Array of uniform data row objects or function returning same.
     *
     * @param {object} [options] - _(Promoted to first argument position when `dataRows` omitted.)_
     *
     * @param {function|object[]} [options.data] - Passed to behavior constructor. May be:
     * * An array of congruent raw data objects
     * * A function returning same
     * * Omit for non-local datasources
     *
     * @param {function|menuItem[]} [options.schema] - Passed to behavior constructor. May be:
     * * A schema array
     * * A function returning same. Called at filter reset time with behavior as context.
     * * Omit to allow the data model to generate a basic schema from its data.
     *
     * @param {boolean} [options.apply=true] Apply data transformations to the new data.
     */
    setData: function setData(dataRows, options) {
        console.log('behavior index setdata------------');
        if (!(Array.isArray(dataRows) || typeof dataRows === 'function')) {
            options = dataRows;
            dataRows = options && options.data;
        }

        dataRows = this.unwrap(dataRows);

        if (dataRows === undefined) {
            return;
        }

        if (!Array.isArray(dataRows)) {
            throw 'Expected data to be an array (of data row objects).';
        }

        options = options || {};

        var grid = this.grid,
            schema = this.unwrap(options.schema),
            // *always* define a new schema on reset
        schemaChanged = schema || !this.subgrids.lookup.data.getColumnCount(),
            // schema will change if a new schema was provided OR data model has an empty schema now, which triggers schema generation on setData below
        reindex = options.apply === undefined || options.apply; // defaults to true

        // copy widths from old schema
        if (schemaChanged && this.schemaOld && schema) {
            var schemaOld = this.schemaOld;
            schema.forEach(function (columnSchema, index) {
                if (schemaOld[index] && index === schemaOld[index].index && columnSchema.name === schemaOld[index].name && schemaOld[index].width) {
                    columnSchema.width = schemaOld[index].width;
                }
            });
        }

        // Inform interested data models of data.
        this.subgrids.forEach(function (dataModel) {
            dataModel.setData(dataRows, schema);
        });

        if (grid.cellEditor) {
            grid.cellEditor.cancelEditing();
        }

        if (reindex) {
            this.reindex();
        }

        // No need to call createColumns(), as setSchema calls createColumns function.
        // if (schemaChanged) {
        //     this.createColumns();
        // }

        //this.checkForErrors();

        grid.allowEvents(this.getRowCount());
    },

    /**
     * @memberOf Local#
     * @summary Add grid data.
     * @desc Exits without doing anything if no data (`dataRows` undefined or omitted and `options.data` undefined).
     *
     * @param {function|object[]} [dataRows=options.data] - Array of uniform data row objects or function returning same.
     *
     * @param {object} [options] - _(Promoted to first argument position when `dataRows` omitted.)_
     *
     * @param {function|object[]} [options.data] - Passed to behavior constructor. May be:
     * * An array of congruent raw data objects
     * * A function returning same
     * * Omit for non-local datasources
     *
     * @param {function|menuItem[]} [options.schema] - Passed to behavior constructor. May be:
     * * A schema array
     * * A function returning same. Called at filter reset time with behavior as context.
     * * Omit to allow the data model to generate a basic schema from its data.
     *
     * @param {boolean} [options.apply=true] Apply data transformations to the new data.
     */
    addData: function addData(dataRows, options) {
        console.log("-------addData---------");
        if (!(Array.isArray(dataRows) || typeof dataRows === 'function')) {
            options = dataRows;
            dataRows = options && options.data;
        }

        dataRows = this.unwrap(dataRows);

        if (dataRows === undefined) {
            return;
        }

        if (!Array.isArray(dataRows)) {
            throw 'Expected data to be an array (of data row objects).';
        }

        options = options || {};

        var grid = this.grid,
            schema = this.unwrap(options.schema),
            // *always* define a new schema on reset
        schemaChanged = schema || !this.subgrids.lookup.data.getColumnCount(),
            // schema will change if a new schema was provided OR data model has an empty schema now, which triggers schema generation on setData below
        reindex = options.apply === undefined || options.apply; // defaults to true

        // Inform interested data models of data.
        this.subgrids.forEach(function (dataModel) {
            if (dataModel.addData) {
                dataModel.addData(dataRows, schema);
            }
        });

        if (grid.cellEditor) {
            grid.cellEditor.cancelEditing();
        }

        if (reindex) {
            this.reindex();
        }

        if (schemaChanged) {
            this.createColumns();
        }

        //this.checkForErrors();

        grid.allowEvents(this.getRowCount());
    },

    /**
     * @memberOf Local#
     * @description Get errors summary object
     * @return {object} - errors summary
     */
    getColumnsErrors: function getColumnsErrors() {
        return this.errors;
    },

    /**
     * @memberOf Local#
     * @description Check grid data errors, and fill "errors" object using found errors data
     */
    checkForErrors: function checkForErrors() {
        var _this5 = this;

        this.errors = {};

        this.getData().forEach(function (row) {
            Object.keys(row).forEach(function (columnName) {
                var value = row[columnName];
                if (value && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object' && value.type === 'ERROR') {
                    if (!_this5.errors[columnName]) {
                        _this5.errors[columnName] = [];
                    }
                    _this5.errors[columnName].push(value);
                }
            });
        });

        this.errorCount = Object.keys(this.errors).length;

        if (this.errorCount) {
            Object.keys(this.errors).forEach(function (columnName) {
                var column = _this5.grid.getColumnByName(columnName);
                if (column) {
                    column.hasError = true;
                    column.errorCount = _this5.errors[columnName].length;
                    column.firstError = _this5.errors[columnName][0];

                    var colDef = column.colDef;
                    if (colDef) {
                        colDef.errorCount = _this5.errors[columnName].length;
                    }
                }
            });
        }
    },

    /**
     * @summary Build the `$rowProxy$` lazy getter collection based on current `schema`.
     *
     * @desc The `$rowProxy$` lazy getter collection is returned by the `getRow` fallback.
     *
     * `$rowProxy$` collection is a dataRow-like object (a hash of column values keyed by column name)
     * for the particular row whose index is in the `$y$` property.
     *
     * The row index can be conveniently set with a call to `fallbacks.getRow()`,
     * which sets the row index and returns the accessor itself.
     *
     * `$y$` is a "hidden" property, non-enumerable it won't show up in `Object.keys(...)`.
     *
     * This fallback implementation is "lazy": The enumerable members are all getters that invoke `getValue` and setters that invoke `setValue`.
     *
     * This function should be called each time a new schema is set.
     */
    createDataRowProxy: function() {
        var dataModel = this.dataModel,
            dataRowProxy = {};

        Object.defineProperty(dataRowProxy, '$y$', {
            enumerable: false, // not a real data field
            writable: true // set later on calls to fallbacks.getRow(y) to y
        });

        this.schema.forEach(function(columnSchema, columnIndex) {
            Object.defineProperty(dataRowProxy, columnSchema.name, {
                enumerable: true, // is a real data field
                get: function() {
                    return dataModel.getValue(columnIndex, this.$y$);
                },
                set: function(value) {
                    return dataModel.setValue(columnIndex, this.$y$, value);
                }
            });
        });

        dataModel.$rowProxy$ = dataRowProxy;
    },

    /**
     * Create a new data model
     * @param {object} [options]
     * @param {DataModel} [options.dataModel] - A fully instantiated data model object.
     * @param {function|function[]} [options.DataModel=DefaultDataModel] - Data model constructor, or array of data model constructors for a multi-stage data model, to be used to instantiate the data model unless a fully instantiated `options.dataModel` was given.
     * @returns {boolean} `true` if the data model has changed.
     * @memberOf Local#
     */
    getNewDataModel: function(options) {
        var dataModel;

        options = options || {};

        if (options.dataModel) {
            dataModel = options.dataModel;
        } else {
            [].concat(DefaultDataModel).forEach(function(DataModel) {
                dataModel = new DataModel(dataModel);
            });
        }

        return dataModel;
    },

    /**
     * @summary Attach a data model object to the grid.
     * @desc Installs data model events, fallbacks, and hooks.
     *
     * Called from {@link Behavior#reset}.
     * @this {Behavior}
     * @param {object} [options]
     * @param {DataModel} [options.dataModel] - A fully instantiated data model object.
     * @param {function} [options.DataModel=require('datasaur-local')] - Data model will be instantiated from this constructor unless `options.dataModel` was given.
     * @param {DataModel} [options.metadata] - Passed to {@link DataModel#setMetadataStore setMetadataStore}.
     * @returns {boolean} `true` if the data model has changed.
     * @memberOf Local#
     */
    resetDataModel: function(options) {
        var newDataModel = this.getNewDataModel(options),
            changed = newDataModel && newDataModel !== this.dataModel;

        if (changed) {
            this.dataModel = this.decorateDataModel(newDataModel, options);
            decorators.addDeprecationWarnings.call(this);
            decorators.addFriendlierDrillDownMapKeys.call(this);
        }

        return changed;
    },

    /**
     * Decorate data model object, initialize its metadata store, and subscribe to its events.
     * @see {@link module:decorators.injectPolyfills injectPolyfills}
     * @see {@link module:decorators.injectCode injectCode}
     * @see {@link module:decorators.injectDefaulthooks injectDefaulthooks}
     * @param {DataModel} newDataModel
     * @param {DataModel} [options.metadata] - Passed to {@link DataModel#setMetadataStore setMetadataStore}.
     * @memberOf Local#
     */
    decorateDataModel: function(newDataModel, options) {
        decorators.injectPolyfills(newDataModel);
        decorators.injectCode(newDataModel);
        decorators.injectDefaulthooks(newDataModel);

        newDataModel.setMetadataStore(options && options.metadata);

        this.boundDispatchEvent = this.boundDispatchEvent || dispatchDataModelEvent.bind(this.grid);
        newDataModel.addListener(this.boundDispatchEvent);

        return newDataModel;
    },

    /**
     * @summary Map of drill down characters used by the data model.
     * @see {@link https://fin-hypergrid.github.io/doc/DataModel.html#charMap|charMap}
     * @type {{OPEN:string, CLOSE:string, INDENT:string}}
     * @memberOf Local#
     */
    get charMap() {
        return this.dataModel.drillDownCharMap;
    },

    /**
     * @summary Calls `apply()` on the data model.
     * @see {@link https://fin-hypergrid.github.io/doc/dataModelAPI.html#reindex|reindex}
     * @memberOf Local#
     */
    reindex: function reindex() {
        this.dataModel.apply();
    },

    /**
     * @summary Gets the number of rows in the data subgrid.
     * @see {@link https://fin-hypergrid.github.io/doc/dataModelAPI.html#getRowCount|getRowCount}
     * @memberOf Local#
     */
    getRowCount: function getRowCount() {
        return this.dataModel.getRowCount();
    },

    /**
     * Retrieve a data row from the data model.
     * @see {@link https://fin-hypergrid.github.io/doc/dataModelAPI.html#getRow|getRow}
     * @memberOf Local#
     * @return {dataRowObject} The data row object at y index.
     * @param {number} y - the row index of interest
     */
    getRow: function getRow(y) {
        return this.dataModel.getRow(y);
    },

    /**
     * Retrieve all data rows from the data model.
     * > Use with caution!
     * @see {@link https://fin-hypergrid.github.io/doc/dataModelAPI.html#getData|getData}
     * @return {dataRowObject[]}
     * @memberOf Local#
     */
    getData: function getData() {
        return this.dataModel.getData();
    },

    /**
     * @memberOf Local#
     */
    getIndexedData: function getIndexedData() {
        return this.deprecated('getIndexedData()', 'getData()', '3.0.0');
    },

    /**
     * @summary Calls `click` on the data model if column is a tree column.
     * @desc Sends clicked cell's coordinates to the data model.
     *
     * To tell if the click was consumed by the data model, add event listeners for {@link DataModel#fin-hypergrid-data-loaded} and/or {@link DataModel#fin-hypergrid-data-postreindex}.
     * @see {@link https://fin-hypergrid.github.io/doc/DataModel.html#toggleRow toggleRow}
     * @param {CellEvent} event
     * @returns {@link DataModel#toggleRow}'s return value which may or may not be implemented.
     * @memberOf Local#
     */
    cellClicked: function(event) {
        //return this.dataModel.toggleRow(event.dataCell.y, event.dataCell.x);
        return this.dataModel.isDrillDown(event.dataCell.x) && this.dataModel.click(event.dataCell.y);
    },

    /*
    hasTreeColumn: function() {
        return this.dataModel.isTree() && this.grid.properties.showTreeColumn;
    },*/
    hasTreeColumn: function hasTreeColumn(columnIndex) {
        return this.dataModel.isTree() && this.grid.properties.showTreeColumn && this.dataModel.isDrillDown(columnIndex);
    },

    /**
     * @memberOf Local#
     * @desc Get all selections made in current grid session
     */
    getSelections: function getSelections() {
        return this.grid.selectionModel.getSelections();
    },

    setCopyArea: function() {
        this.grid.selectionModel.setCopyArea();
    },

    /**
     * @summary extend row data with aggregation name from parent row
     * @param row - row structure which will be populated with new agg data
     * @param parentParentAggs - agg data from previous row data
     */
    populateAggregationNamesForRow: function populateAggregationNamesForRow(row, parentParentAggs) {
        if (row.__treeLevel !== undefined && row.$$aggregation !== undefined) {
            var parentAggs = Object.assign({}, row.parentAggs || parentParentAggs || {}); // copy parentAggs
            parentAggs[this.aggNameFromRow(row)] = row.$$aggregation;
            Object.assign(row, parentAggs, { parentAggs: parentAggs });
        }
    },


    aggNameFromRow: function aggNameFromRow(row) {
        return '$$aggregation' + row.__treeLevel;
    },

    copyValues: function copyValues(row) {
        var res = {};
        Object.keys(row).filter(function (k) {
            return !k.startsWith('$$') && !k.startsWith('__');
        }).forEach(function (k) {
            return res[k] = row[k];
        });
        return res;
    },

    /**
     * @desc append child rows right after parent
     * @type {boolean}
     * @memberOf CellEvent#
     */
    expandChildRows: function expandChildRows(row) {
        var _this6 = this;

        if (!this.isRowExpanded(row) && row.$$children) {
            this.populateAggregationNamesForRow(row);
            if (row.$$children.length > 0) {
                var rowIndex = this.dataModel.indexOf(row);

                var childrenToAdd = row.$$children;

                if (this.grid.properties.isPivot) {
                    if (row.$$children.length === 0 || !row.$$children[row.$$children.length - 1][GRAND_TOTAL]) {
                        var _Object$assign;

                        row.$$children.push(Object.assign(this.copyValues(row), (_Object$assign = {}, _defineProperty(_Object$assign, GRAND_TOTAL, true), _defineProperty(_Object$assign, this.aggNameFromRow(row), row[this.aggNameFromRow(row)] + ' Total'), _Object$assign)));
                    }
                    childrenToAdd = row.$$children.slice(1);
                }

                this.dataModel.addRows(childrenToAdd, rowIndex + 1);

                row.$$children.forEach(function (r) {
                    r.$$open = false;
                    _this6.populateAggregationNamesForRow(r, _this6.grid.properties.isPivot ? {} : row.parentAggs);
                });

                // remove column because of flat mode
                if (!this.grid.properties.isPivot) {
                    this.dataModel.data.splice(rowIndex, 1);
                }
                this.flatReady = false;
                this.dataModel.cache = [];
            }
        }
        row.$$open = true;
    },

    /**
     * @desc remove all child rows from data model
     * @type {boolean}
     * @memberOf CellEvent#
     */
    collapseChildRows: function collapseChildRows(row) {
        if (row.$$open && row.$$children && row.$$children.length > 0) {
            var rowIndex = this.dataModel.indexOf(row) + 1; // deleting starts from next row

            // collapse children before deleting parent
            this.collapseChildRows(row.$$children[0]);
            for (var i = rowIndex; i < rowIndex + row.$$children.length - 1; ++i) {
                this.collapseChildRows(this.dataModel.data[i]); // really needed access by index
            }
            this.dataModel.delRow(rowIndex, row.$$children.length - 1);
        }
        row.$$open = false;
    },

    /**
     * @desc set colDefs group state to open and synchronize schema
     * @type {boolean}
     * @memberOf CellEvent#
     */
    expandChildColumns: function expandChildColumns(groupId) {
        this._setColDefGroupShowStateRecursive(this.grid.columnDefs, groupId, 'open');

        this.synchronizeSchemaToColumnDefs();
        this.fitColumnsGroup(groupId);
    },

    /**
     * @desc set colDefs group state to closed and synchronize schema
     * @type {boolean}
     * @memberOf CellEvent#
     */
    collapseChildColumns: function collapseChildColumns(groupId) {
        this._setColDefGroupShowStateRecursive(this.grid.columnDefs, groupId, 'closed');

        this.synchronizeSchemaToColumnDefs();
        this.fitColumnsGroup(groupId);
    },

    /**
     * @desc utility function to recursively found colDefs group by id and set it's open state
     * @param {array} colDefs
     * @param {number} groupId
     * @param {string} newState
     * @type {boolean}
     * @memberOf CellEvent#
     */
    _setColDefGroupShowStateRecursive: function _setColDefGroupShowStateRecursive(colDefs, groupId, newState) {
        var _this7 = this;

        colDefs.forEach(function (cd) {
            if (cd.groupId === groupId) {
                cd.columnGroupShow = newState;
            }

            if (cd.children && cd.children.length > 0) {
                _this7._setColDefGroupShowStateRecursive(cd.children, groupId, newState);
            }
        });
    },

    /**
     * @summary set all rows expanded in one time
     */
    buildFlatMode: function buildFlatMode() {
        var _this8 = this;

        var expandRow = function expandRow(row) {
            _this8.expandChildRows(row);
            if (row.$$children) {
                row.$$children.forEach(function (c) {
                    return expandRow(c);
                });
            }
        };
        do {
            this.flatReady = true;
            this.dataModel.data.forEach(function (row) {
                return expandRow(row);
            });
        } while (!this.flatReady);

        this.dataModel.cache = [];
    },

    /**
     * @summary get additional width based on colspan
     * @param x
     * @param y
     * @returns {number}
     */
    getAdditionalWidth: function getAdditionalWidth(x, y) {
        return this.dataModel.getAdditionalWidth(x, y);
    },

    /**
     * @summary get additional height based on rowspan
     * @param x
     * @param y
     * @returns {number}
     */
    getAdditionalHeight: function getAdditionalHeight(x, y) {
        return this.dataModel.getAdditionalHeight(x, y);
    },

    /**
     * @public
     * @desc get colspan of an cell, if exist. Otherwise, returns 0;
     * @param x
     * @param y
     * @return {*}
     */
    getColspan: function getColspan(x, y) {
        return this.dataModel.getColspan(x, y);
    },

    /**
     * @public
     * @desc get rowspan of an cell, if exist. Otherwise, returns 0;
     * @param x
     * @param y
     * @return {*}
     */
    getRowspan: function getRowspan(x, y) {
        return this.dataModel.getRowspan(x, y);
    },

    errors: {}
});

/**
 * @this {Local}
 */
function createColumns() {
    console.log("-----local createColumn-------");
    this.schema.forEach(function(columnSchema) {
        this.addColumn(columnSchema);
    }, this);

    this.columnEnumSynchronize();
}

Local.prototype.mixIn(require('./columnEnum').mixin);
Local.prototype.mixIn.call(Local, require('./columnEnum').mixInShared);

module.exports = Local;
