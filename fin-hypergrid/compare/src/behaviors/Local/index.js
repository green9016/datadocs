'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var Behavior = require('./Behavior');

/** @name DataSource
 * @memberOf Behavior#
 * @default require('datasaur-local')
 * @summary Default data source.
 * @desc If defined, will be used as a default data source for newly instantiated `Hypergrid` objects without `DataSource` or `dataSource` options specified. Scheduled for removal in next version (v4).
 */
var DefaultDataModel = require('../DatasaurLocal');

var decorators = require('./dataModel/decorators');

var GRAND_TOTAL = '$$grand_total';

/**
 * This class mimics the {@link dataModelAPI}.
 * > This constructor (actually {@link Local#initialize}) will be called upon instantiation of this class or of any class that extends from this class. See {@link https://github.com/joneit/extend-me|extend-me} for more info.
 * @constructor
 * @extends Behavior
 */
var Local = Behavior.extend('Local', {

    initialize: function initialize(grid, options) {
        this.setData(options);
    },

    /**
     * @memberOf Local#
     * @description Create columns based on old value of grid.columns
     */
    createColumns: function createColumns() {
        var _this = this;

        var oldColumns = this.columns;
        var oldAllColumns = this.allColumns;

        Behavior.prototype.createColumns.call(this);

        this.schema.forEach(function (columnSchema, index) {
            var findFunction = function findFunction(c) {
                return c.properties.index === index && c.properties.name === columnSchema.name && c.properties.calculator === columnSchema.calculator && c.colDef === columnSchema.colDef;
            };
            var oldColumn = oldAllColumns.find(findFunction) || oldColumns.find(findFunction);
            var oldColumnColdDef = oldAllColumns.find(function (c) {
                return c.colDef && c.colDef === columnSchema.colDef;
            }) || oldColumns.find(function (c) {
                return c.colDef === columnSchema.colDef;
            });

            if (oldColumn) {
                var newColumn = _this.addColumn(oldColumn.properties);
                var props = newColumn.properties;

                // disable resizing for old resized columns
                // when data was added to existed array of data
                if (props.width === props.preferredWidth && props.columnAutosizing && props.columnAutosized) {
                    props.columnAutosizing = false;
                }
            } else {
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
                } else if (oldColumnColdDef) {
                    var _props = oldColumnColdDef.properties;

                    // disable resizing for old resized columns
                    // when data was added to existed array of data
                    Object.assign(_newColumn.properties, {
                        width: _props.width,
                        preferredWidth: _props.preferredWidth,
                        columnAutosizing: _props.columnAutosizing,
                        columnAutosized: _props.columnAutosized
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
            }
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
        var data = this.getData();
        var gc = this.grid.canvas.gc;

        var props = column.properties;

        var width = column.width || props.defaultColumnWidth;

        // get max width based of
        data.forEach(function (d, i) {
            var val = column.getValue(i);
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

        this.checkForErrors();

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

        this.checkForErrors();

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
     * Create a new data model
     * @param {object} [options]
     * @param {dataModelAPI} [options.dataModel] - A fully instantiated data model object.
     * @param {function} [options.DataModel=require('datasaur-local')] - Data model will be instantiated from this constructor unless `options.dataModel` was given.
     * @returns {boolean} `true` if the data model has changed.
     * @memberOf Local#
     */
    getNewDataModel: function getNewDataModel(options) {
        var newDataModel;

        options = options || {};

        if (options.dataModel) {
            newDataModel = options.dataModel;
        } else if (options.DataModel) {
            newDataModel = new options.DataModel();
        } else {
            newDataModel = new DefaultDataModel();
        }

        return newDataModel;
    },

    /**
     * @summary Attach a data model object to the grid.
     * @desc Installs data model events, fallbacks, and hooks.
     *
     * Called from {@link Behavior#reset}.
     * @this {Behavior}
     * @param {object} [options]
     * @param {dataModelAPI} [options.dataModel] - A fully instantiated data model object.
     * @param {function} [options.DataModel=require('datasaur-local')] - Data model will be instantiated from this constructor unless `options.dataModel` was given.
     * @param {dataModelAPI} [options.metadata] - Passed to {@link dataModelAPI#setMetadataStore setMetadataStore}.
     * @returns {boolean} `true` if the data model has changed.
     * @memberOf Local#
     */
    resetDataModel: function resetDataModel(options) {
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
     * @param {dataModelAPI} newDataModel
     * @param {dataModelAPI} [options.metadata] - Passed to {@link dataModelAPI#setMetadataStore setMetadataStore}.
     */
    decorateDataModel: function decorateDataModel(newDataModel, options) {
		console.log("decorateDataModel newDataModel", newDataModel, options);
        decorators.addPolyfills(newDataModel);
        decorators.addFallbacks(newDataModel, this.grid);
        decorators.addDefaultHooks(newDataModel);

        newDataModel.setMetadataStore(options && options.metadata);

        return newDataModel;
    },

    /**
     * @summary Convenience getter/setter.
     * @desc Calls the data model's `getSchema`/`setSchema` methods.
     * @see {@link https://fin-hypergrid.github.io/doc/dataModelAPI.html#getSchema|getSchema}
     * @see {@link https://fin-hypergrid.github.io/doc/dataModelAPI.html#setSchema|setSchema}
     * @type {Array}
     * @memberOf Local#
     */
    get schema() {
        return this.dataModel && this.dataModel.getSchema();
    },
    set schema(newSchema) {
        this.dataModel.setSchema(newSchema);
    },

    /**
     * @summary Map of drill down characters used by the data model.
     * @see {@link https://fin-hypergrid.github.io/doc/dataModelAPI.html#charMap|charMap}
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
     * @see {@link https://fin-hypergrid.github.io/doc/dataModelAPI.html#isDrillDown|isDrillDown}
     * @see {@link https://fin-hypergrid.github.io/doc/dataModelAPI.html#click|click}
     * @param {CellEvent} event
     * @returns {boolean} If click was in a drill down column and click on this row was "consumed" by the data model (_i.e., caused it's state to change).
     * @memberOf Local#
     */
    cellClicked: function cellClicked(event) {
        return this.dataModel.isDrillDown(event.dataCell.x) && this.dataModel.click(event.dataCell.y);
    },

    /**
     * @memberOf Local#
     * @description Get boolean data about tree columns show needed
     */
    hasTreeColumn: function hasTreeColumn(columnIndex) {
        return this.grid.properties.showTreeColumn && this.dataModel.isDrillDown(columnIndex);
    },

    /**
     * @memberOf Local#
     * @desc Get all selections made in current grid session
     */
    getSelections: function getSelections() {
        return this.grid.selectionModel.getSelections();
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

Object.defineProperties(Local.prototype, require('./columnEnum').descriptors);

module.exports = Local;
