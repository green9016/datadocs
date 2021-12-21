'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Point = require('rectangular').Point;

var Base = require('../Base');
var Column = require('./Column');
var cellEventFactory = require('../lib/cellEventFactory');
var featureRegistry = require('../features');
var propClassEnum = require('../defaults.js').propClassEnum;

var noExportProperties = ['columnHeader', 'columnHeaderColumnSelection', 'filterProperties', 'rowHeader', 'rowHeaderRowSelection', 'rowNumbersProperties', 'treeColumnProperties', 'treeColumnPropertiesColumnSelection'];

Array.prototype.move = function (oldIndex, len, newIndex) {
    // eslint-disable-line
    while (oldIndex < 0) {
        oldIndex += this.length;
    }
    while (newIndex < 0) {
        newIndex += this.length;
    }
    if (newIndex >= this.length) {
        var k = newIndex - this.length;
        while (k-- + 1) {
            this.push(undefined);
        }
    }
    if (oldIndex < newIndex) {
        newIndex -= len - 1;
    }
    this.splice.apply(this, [newIndex, 0].concat(this.splice(oldIndex, len)));
    return this;
};

/**
 * @mixes cellProperties.behaviorMixin
 * @mixes rowProperties.mixin
 * @mixes subgrids.mixin
 * @constructor
 * @desc A controller for the data model.
 * > This constructor (actually `initialize`) will be called upon instantiation of this class or of any class that extends from this class. See {@link https://github.com/joneit/extend-me|extend-me} for more info.
 * @param {Hypergrid} grid
 * @param {object} [options] - _(Passed to {@link Behavior#reset reset})._
 * @param {dataModelAPI} [options.dataModel] - _Per {@link Behavior#reset reset}._
 * @param {object} [options.metadata] - _Per {@link Behavior#reset reset}._
 * @param {function} [options.DataModel=require('datasaur-local')] - _Per {@link Behavior#reset reset}._
 * @param {function|object[]} [options.data] - _Per {@link Behavior#setData setData}._
 * @param {function|menuItem[]} [options.schema] - _Per {@link Behavior#setData setData}._
 * @param {subgridSpec[]} [options.subgrids=this.grid.properties.subgrids] - _Per {@link Behavior#setData setData}._
 * @param {boolean} [options.apply=true] - _Per {@link Behavior#setData setData}._
 * @abstract
 */
var Behavior = Base.extend('Behavior', {

    initialize: function initialize(grid, options) {
        /**
         * @type {Hypergrid}
         * @memberOf Behavior#
         */
        this.grid = grid;

        this.initializeFeatureChain();

        this.grid.behavior = this;
        this.reset(options);
    },

    /**
     * @desc Create the feature chain - this is the [chain of responsibility](http://c2.com/cgi/wiki?ChainOfResponsibilityPattern) pattern.
     * @param {Hypergrid} [grid] Unnecesary legacy parameter. May be omitted.
     * @memberOf Behavior#
     */
    initializeFeatureChain: function initializeFeatureChain(grid) {
        var constructors;

        /**
         * @summary Controller chain of command.
         * @desc Each feature is linked to the next feature.
         * @type {Feature}
         * @memberOf Behavior#
         */
        this.featureChain = undefined;

        /**
         * @summary Hash of instantiated features by class names.
         * @desc Built here but otherwise not in use.
         * @type {object}
         * @memberOf Behavior#
         */
        this.featureMap = {};

        this.featureRegistry = this.featureRegistry || featureRegistry;

        if (this.grid.properties.features) {
            var getFeatureConstructor = this.featureRegistry.get.bind(this.featureRegistry);
            constructors = this.grid.properties.features.map(getFeatureConstructor);
        } else if (this.features) {
            constructors = this.features;
            warnBehaviorFeaturesDeprecation.call(this);
        }

        constructors.forEach(function (FeatureConstructor, i) {
            var feature = new FeatureConstructor();

            this.featureMap[feature.$$CLASS_NAME] = feature;

            if (i) {
                this.featureChain.setNext(feature);
            } else {
                this.featureChain = feature;
            }
        }, this);

        if (this.featureChain) {
            this.featureChain.initializeOn(this.grid);
        }
    },

    features: [], // override in implementing class; or provide feature names in grid.properties.features; else no features

    /**
     * Reset the behavior.
     * @param {object} [options] - _Same as constructor's `options`._<br>
     * _Passed to {@link Behavior#resetDataModel resetDataModel} and {@link Behavior#setData setData} (both of which see)._
     * @memberOf Behavior#
     */
    reset: function reset(options) {
        this.schemaOld = this.schema;

        var dataModelChanged = this.resetDataModel(options);

        if (dataModelChanged) {
            // recreate `CellEvent` class so it can update its cached `grid`, `behavior`, and `dataModel` properties
            this.CellEvent = cellEventFactory(this.grid);
        }

        this.scrollPositionX = this.scrollPositionY = 0;

        this.createColumns();

        /**
         * Ordered list of subgrids to render.
         * @type {subgridSpec[]}
         * @memberOf Hypergrid#
         */
        this.subgrids = options && options.subgrids || !dataModelChanged && this.subgrids || this.grid.properties.subgrids;

        this.setData(options);
    },

    /**
     * @abstract
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
     *
     * @memberOf Behavior#
     */
    setData: function setData(dataRows, options) {},

    /**
     * @abstract
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
     *
     * @memberOf Behavior#
     */
    addData: function addData(dataRows, options) {},

    get renderedColumnCount() {
        return this.grid.renderer.visibleColumns.length;
    },

    get renderedRowCount() {
        return this.grid.renderer.visibleRows.length;
    },

    get leftMostColIndex() {
        return this.grid.properties.showRowNumbers ? this.rowColumnIndex : this.hasTreeColumn() ? this.treeColumnIndex : 0;
    },

    clearColumns: function clearColumns() {
        var schema = this.schema,
            treeColumnIndex = this.treeColumnIndex,
            rowColumnIndex = this.rowColumnIndex;

        schema[treeColumnIndex] = schema[treeColumnIndex] || {
            index: treeColumnIndex,
            name: 'Tree',
            header: 'Tree'
        };

        schema[rowColumnIndex] = schema[rowColumnIndex] || {
            index: rowColumnIndex,
            name: '',
            header: ''
        };

        var treeColumnOld = this.allColumns && this.allColumns[treeColumnIndex] || this.columns && this.columns[treeColumnIndex];
        var rowColumnOld = this.allColumns && this.allColumns[rowColumnIndex] || this.columns && this.columns[rowColumnIndex];

        /**
         * @type {Column[]}
         * @memberOf Behavior#
         */
        this.columns = [];

        /**
         * @type {Column[]}
         * @memberOf Behavior#
         */
        this.allColumns = [];

        this.allColumns[treeColumnIndex] = this.columns[treeColumnIndex] = this.newColumn(treeColumnOld && treeColumnOld.properties ? treeColumnOld.properties : {
            index: treeColumnIndex,
            header: schema[treeColumnIndex].header,
            name: schema[treeColumnIndex].name,
            fixed: true
        });
        this.allColumns[rowColumnIndex] = this.columns[rowColumnIndex] = this.newColumn(rowColumnOld && rowColumnOld.properties ? rowColumnOld.properties : {
            index: rowColumnIndex,
            header: schema[rowColumnIndex].header,
            name: schema[rowColumnIndex].name,
            columnAutosizing: false,
            minWidth: this.grid.properties.columnHeaderInitWidth,
            fixed: true
        });

        this.columns[treeColumnIndex].properties.propClassLayers = this.columns[rowColumnIndex].properties.propClassLayers = [propClassEnum.COLUMNS];

        // Signal the renderer to size the now-reset handle column before next render
        this.grid.renderer.resetRowHeaderColumnWidth();
    },

    getActiveColumn: function getActiveColumn(x) {
        return this.columns[x] || this.columns[parseInt(x, 10)];
    },

    /**
     * The "grid index" given a "data index" (or column object)
     * @param {Column|number} columnOrIndex
     * @returns {undefined|number} The grid index of the column or undefined if column not in grid.
     * @memberOf Hypergrid#
     */
    getActiveColumnIndex: function getActiveColumnIndex(columnOrIndex) {
        var index = columnOrIndex instanceof Column ? columnOrIndex.index : columnOrIndex;
        for (var i = 0; i < this.columns.length; ++i) {
            if (this.columns[i].index === index) {
                return i;
            }
        }
    },

    getColumn: function getColumn(x) {
        return this.allColumns[x];
    },

    /**
     * @default get nearest column to X
     * @param x - index of base column
     * @param rightShift - boolean direction for near column getting. `true` - is direction to the right
     * @returns {Column|undefined}
     */
    getColumnShifted: function getColumnShifted(x, rightShift) {
        if (rightShift) {
            ++x;
        } else {
            --x;
        }

        if (x === this.treeColumnIndex && !this.grid.properties.showTreeColumn) {
            return this.getColumnShifted(x, rightShift);
        }

        if (x === this.rowColumnIndex && !this.grid.properties.rowHeaderNumbers) {
            return this.getColumnShifted(x, rightShift);
        }

        return this.getColumn(x);
    },

    newColumn: function newColumn(options) {
        return new Column(this, options);
    },

    addColumn: function addColumn(options) {
        var column = this.newColumn(options);
        this.columns.push(column);
        this.allColumns.push(column);
        return column;
    },

    createColumns: function createColumns() {
        this.clearColumns();
        //concrete implementation here
    },

    getColumnWidth: function getColumnWidth(x) {
        var column = this.getActiveColumn(x);
        if (!column) {
            return this.grid.properties.defaultColumnWidth;
        }
        return column.getWidth() + (this.grid.properties.gridLinesV ? this.grid.properties.gridLinesWidth : 0);
    },

    /**
     * @param {Column|number} columnOrIndex - The column or active column index.
     * @param width
     * @memberOf Hypergrid#
     */
    setColumnWidth: function setColumnWidth(columnOrIndex, width) {
        var column = columnOrIndex >= -2 ? this.getActiveColumn(columnOrIndex) : columnOrIndex;
        column.setWidth(width);
        this.stateChanged();
        this.grid.fireSyntheticOnColumnResizedEvent(columnOrIndex, width);
    },

    /**
     * @memberOf Behavior#
     * @desc utility function to empty an object of its members
     * @param {object} obj - the object to empty
     * @param {boolean} [exportProps]
     * * `undefined` (omitted) - delete *all* properties
     * * **falsy** - delete *only* the export properties
     * * **truthy** - delete all properties *except* the export properties
     */
    clearObjectProperties: function clearObjectProperties(obj, exportProps) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key) && (exportProps === undefined || !exportProps && noExportProperties.indexOf(key) >= 0 || exportProps && noExportProperties.indexOf(key) < 0)) {
                delete obj[key];
            }
        }
    },

    //this is effectively a clone, with certain things removed....
    getState: function getState() {
        var copy = JSON.parse(JSON.stringify(this.grid.properties));
        this.clearObjectProperties(copy.columnProperties, false);
        return copy;
    },
    /**
     * @memberOf Behavior#
     * @desc clear all table state
     */
    clearState: function clearState() {
        this.grid.clearState();
        this.createColumns();
    },

    /**
     * @memberOf Behavior#
     * @desc Restore this table to a previous state.
     * See the [memento pattern](http://c2.com/cgi/wiki?MementoPattern).
     * @param {Object} memento - assignable grid properties
     */
    setState: function setState(memento) {
        this.clearState();
        this.addState(memento);
    },

    /**
     * @memberOf Behavior#
     * @desc Add new state to params object.
     * @param {Object} properties - assignable grid properties
     */
    addState: function addState(properties) {
        Object.assign(this.grid.properties, properties);
        this.setAllColumnProperties(properties.columnProperties);
        this.reindex();
    },

    /**
     * @summary Sets properties of multiple columns.
     * @desc Sets column properties to elements of given array.
     * The array may be sparse; never defined or deleted elements are ignored.
     * In addition, falsy elements are ignored.
     * @param {object[]} columnProperties
     */
    setAllColumnProperties: function setAllColumnProperties(columnProperties) {
        if (columnProperties) {
            columnProperties.forEach(function (properties, i) {
                if (properties) {
                    this.getColumn(i).properties = properties;
                }
            }, this);
        }
    },

    setColumnOrder: function setColumnOrder(columnIndexes) {
        if (Array.isArray(columnIndexes)) {
            this.columns.length = columnIndexes.length;
            columnIndexes.forEach(function (index, i) {
                this.columns[i] = this.allColumns[index];
            }, this);
        }
    },

    setColumnOrderByName: function setColumnOrderByName(columnNames) {
        if (Array.isArray(columnNames)) {
            this.columns.length = columnNames.length;
            columnNames.forEach(function (columnName, i) {
                this.columns[i] = this.allColumns.find(function (column) {
                    return column.name === columnName;
                });
            }, this);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc Rebuild the column order indexes
     * @param {Array} columnIndexes - list of column indexes
     * @param {Boolean} [silent=false] - whether to trigger column changed event
     */
    setColumnIndexes: function setColumnIndexes(columnIndexes, silent) {
        this.grid.properties.columnIndexes = columnIndexes;
        if (!silent) {
            this.grid.fireSyntheticOnColumnsChangedEvent();
        }
    },

    /**
     * @summary Show inactive column(s) or move active column(s).
     *
     * @desc Adds one or several columns to the "active" column list.
     *
     * @param {boolean} [isActiveColumnIndexes=false] - Which list `columnIndexes` refers to:
     * * `true` - The active column list. This can only move columns around within the active column list; it cannot add inactive columns (because it can only refer to columns in the active column list).
     * * `false` - The full column list (as per column schema array). This inserts columns from the "inactive" column list, moving columns that are already active.
     *
     * @param {number|number[]} columnIndexes - Column index(es) into list as determined by `isActiveColumnIndexes`. One of:
     * * **Scalar column index** - Adds single column at insertion point.
     * * **Array of column indexes** - Adds multiple consecutive columns at insertion point.
     *
     * _This required parameter is promoted left one arg position when `isActiveColumnIndexes` omitted._
     *
     * @param {number} [referenceIndex=this.columns.length] - Insertion point, _i.e.,_ the element to insert before. A negative values skips the reinsert. Default is to insert new columns at end of active column list.
     *
     * _Promoted left one arg position when `isActiveColumnIndexes` omitted._
     *
     * @param {boolean} [allowDuplicateColumns=false] - Unless true, already visible columns are removed first.
     *
     * _Promoted left one arg position when `isActiveColumnIndexes` omitted + one position when `referenceIndex` omitted._
     *
     * @memberOf Behavior#
     */
    showColumns: function showColumns(isActiveColumnIndexes, columnIndexes, referenceIndex, allowDuplicateColumns) {
        // Promote args when isActiveColumnIndexes omitted
        if (typeof isActiveColumnIndexes === 'number' || Array.isArray(isActiveColumnIndexes)) {
            allowDuplicateColumns = referenceIndex;
            referenceIndex = columnIndexes;
            columnIndexes = isActiveColumnIndexes;
            isActiveColumnIndexes = false;
        }

        var activeColumns = this.columns,
            sourceColumnList = isActiveColumnIndexes ? activeColumns : this.allColumns;

        // Nest scalar index
        if (typeof columnIndexes === 'number') {
            columnIndexes = [columnIndexes];
        }

        var newColumns = columnIndexes
        // Look up columns using provided indexes
        .map(function (index) {
            return sourceColumnList[index];
        })
        // Remove any undefined columns
        .filter(function (column) {
            return column;
        });

        // Default insertion point is end (i.e., before (last+1)th element)
        if (typeof referenceIndex !== 'number') {
            allowDuplicateColumns = referenceIndex; // assume reference index was omitted when not a number
            referenceIndex = activeColumns.length;
        }

        // Remove already visible columns and adjust insertion point
        if (!allowDuplicateColumns) {
            newColumns.forEach(function (column) {
                var i = activeColumns.indexOf(column);
                if (i >= 0) {
                    activeColumns.splice(i, 1);
                    if (referenceIndex > i) {
                        --referenceIndex;
                    }
                }
            });
        }

        // Insert the new columns at the insertion point
        if (referenceIndex >= 0) {
            activeColumns.splice.apply(activeColumns, [referenceIndex, 0].concat(newColumns));
        }

        this.grid.properties.columnIndexes = activeColumns.map(function (column) {
            return column.index;
        });
    },

    /**
     * @summary Hide active column(s).
     * @desc Removes one or several columns from the "active" column list.
     * @param {boolean} [isActiveColumnIndexes=false] - Which list `columnIndexes` refers to:
     * * `true` - The active column list.
     * * `false` - The full column list (as per column schema array).
     * @param {number|number[]} columnIndexes - Column index(es) into list as determined by `isActiveColumnIndexes`. One of:
     * * **Scalar column index** - Adds single column at insertion point.
     * * **Array of column indexes** - Adds multiple consecutive columns at insertion point.
     *
     * _This required parameter is promoted left one arg position when `isActiveColumnIndexes` omitted._
     * @memberOf Behavior#
     */
    hideColumns: function hideColumns(isActiveColumnIndexes, columnIndexes) {
        var args = Array.prototype.slice.call(arguments); // Convert to array so we can add an argument (element)
        args.push(-1); // Remove only; do not reinsert.
        this.showColumns.apply(this, args);
    },

    /**
     * @memberOf Behavior#
     * @desc fetch the value for a property key
     * @returns {*} The value of the given property.
     * @param {string} key - a property name
     */
    resolveProperty: function resolveProperty(key) {
        // todo: remove when we remove the deprecated grid.resolveProperty
        return this.grid.resolveProperty(key);
    },

    lookupFeature: function lookupFeature(key) {
        return this.featureMap[key];
    },

    /**
     * @param {CellEvent|number} xOrCellEvent - Grid column coordinate.
     * @param {number} [y] - Grid row coordinate. Omit if `xOrCellEvent` is a CellEvent.
     * @param {dataModelAPI} [dataModel] - For use only when `xOrCellEvent` is _not_ a `CellEvent`: Provide a subgrid. If given, x and y are interpreted as data cell coordinates (unadjusted for scrolling). Does not default to the data subgrid, although you can provide it explicitly (`this.subgrids.lookup.data`).
     * @memberOf Behavior#
     */
    getValue: function getValue(xOrCellEvent, y, dataModel) {
        if ((typeof xOrCellEvent === 'undefined' ? 'undefined' : _typeof(xOrCellEvent)) !== 'object') {
            var x = xOrCellEvent;
            xOrCellEvent = new this.CellEvent();
            if (dataModel) {
                xOrCellEvent.resetDataXY(x, y, dataModel);
            } else {
                xOrCellEvent.resetGridCY(x, y);
            }
        }
        return xOrCellEvent.value;
    },

    /**
     * @memberOf Behavior#
     * @desc update the data at point x, y with value
     * @return The data.
     * @param {CellEvent|number} xOrCellEvent - Grid column coordinate.
     * @param {number} [y] - Grid row coordinate. Omit if `xOrCellEvent` is a CellEvent.
     * @param {Object} value - The value to use. _When `y` omitted, promoted to 2nd arg._
     * @param {dataModelAPI} [dataModel] - For use only when `xOrCellEvent` is _not_ a `CellEvent`: Provide a subgrid. If given, x and y are interpreted as data cell coordinates (unadjusted for scrolling). Does not default to the data subgrid, although you can provide it explicitly (`this.subgrids.lookup.data`).
     * @return {boolean} Consumed.
     */
    setValue: function setValue(xOrCellEvent, y, value, dataModel) {
        if ((typeof xOrCellEvent === 'undefined' ? 'undefined' : _typeof(xOrCellEvent)) === 'object') {
            value = y;
        } else {
            var x = xOrCellEvent;
            xOrCellEvent = new this.CellEvent();
            if (dataModel) {
                xOrCellEvent.resetDataXY(x, y, dataModel);
            } else {
                xOrCellEvent.resetGridCY(x, y);
            }
        }
        xOrCellEvent.value = value;
    },

    /**
     * @memberOf Behavior#
     * @return {number} The width of the fixed column area in the hypergrid.
     */
    getFixedColumnsWidth: function getFixedColumnsWidth() {
        var count = this.getFixedColumnCount(),
            total = 0,
            i = this.leftMostColIndex;

        for (; i < count; i++) {
            total += this.getColumnWidth(i);
        }
        return total;
    },

    /**
     * @memberOf Behavior#
     * @return {number} The width of the data column area in the hypergrid.
     */
    getColumnsWidth: function getColumnsWidth(toX) {
        var count = toX === undefined ? this.getActiveColumnCount() : toX,
            total = 0,
            i = this.leftMostColIndex;

        for (; i < count; i++) {
            total += this.getColumnWidth(i);
        }
        return total;
    },

    /**
     * @memberOf Behavior#
     * @desc This exists to support "floating" columns.
     * @return {number} The total width of the fixed columns area.
     */
    getFixedColumnsMaxWidth: function getFixedColumnsMaxWidth() {
        return this.getFixedColumnsWidth();
    },

    /**
     * @memberOf Behavior#
     * @desc delegate setting the cursor up the feature chain of responsibility
     * @param {Hypergrid} grid
     */
    setCursor: function setCursor(grid) {
        grid.updateCursor();
        this.featureChain.setCursor(grid);
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling mouse move to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onMouseMove: function onMouseMove(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleMouseMove(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling tap to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onClick: function onClick(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleClick(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling tap to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onContextMenu: function onContextMenu(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleContextMenu(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling wheel moved to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onWheelMoved: function onWheelMoved(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleWheelMoved(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling tap to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onGridRendered: function onGridRendered(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleGridRendered(grid, event);
            this.setCursor(grid);
        }
    },

    onColumnResizedEvent: function onColumnResizedEvent(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleColumnResizedEvent(grid, event);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling mouse up to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onMouseUp: function onMouseUp(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleMouseUp(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling mouse drag to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onMouseDrag: function onMouseDrag(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleMouseDrag(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling key down to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onKeyDown: function onKeyDown(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleKeyDown(grid, event);
            this.setCursor(grid);
        }
        if (grid.onCtrlShiftAndZ && event.detail.char === 'Z' && event.detail.ctrl && event.detail.shift) {
            grid.onCtrlShiftAndZ();
        } else if (grid.onCtrlAndZ && event.detail.char === 'z' && event.detail.ctrl) {
            grid.onCtrlAndZ();
        }
    },

    onApiDestroyCalled: function onApiDestroyCalled(grid, event) {
        if (this.featureChain) {
            this.featureChain.onApiDestroyCalled(grid, event);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling key up to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onKeyUp: function onKeyUp(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleKeyUp(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling of grid data added event
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onDataAdded: function onDataAdded(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleDataAdded(grid, event);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling double click to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    onDoubleClick: function onDoubleClick(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleDoubleClick(grid, event);
            this.setCursor(grid);
        }
    },
    /**
     * @memberOf Behavior#
     * @desc delegate handling mouse down to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseDown: function handleMouseDown(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleMouseDown(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling mouse down outside current canvas to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleCanvasOutsideMouseDown: function handleCanvasOutsideMouseDown(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleCanvasOutsideMouseDown(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc delegate handling mouse exit to the feature chain of responsibility
     * @param {Hypergrid} grid
     * @param {Object} event - the event details
     */
    handleMouseExit: function handleMouseExit(grid, event) {
        if (this.featureChain) {
            this.featureChain.handleMouseExit(grid, event);
            this.setCursor(grid);
        }
    },

    /**
     * @memberOf Behavior#
     * @desc I've been notified that the behavior has changed.
     */
    changed: function changed() {
        this.grid.behaviorChanged();
    },

    /**
     * @memberOf Behavior#
     * @desc The dimensions of the grid data have changed. You've been notified.
     */
    shapeChanged: function shapeChanged() {
        this.grid.behaviorShapeChanged();
    },

    /**
     * @memberOf Behavior#
     * @desc The dimensions of the grid data have changed. You've been notified.
     */
    stateChanged: function stateChanged() {
        this.grid.behaviorStateChanged();
    },

    /**
     * @memberOf Behavior#
     * @return {boolean} Can re-order columns.
     */
    isColumnReorderable: function isColumnReorderable() {
        return this.deprecated('isColumnReorderable()', 'grid.properties.columnsReorderable', '2.1.3');
    },

    /**
     * @param {index} x - Data x coordinate.
     * @return {Object} The properties for a specific column.
     * @memberOf Behavior#
     */
    getColumnProperties: function getColumnProperties(x) {
        var column = this.getColumn(x);
        return column && column.properties;
    },

    /**
     * @param {index} x - Data x coordinate.
     * @return {Object} The properties for a specific column.
     * @memberOf Behavior#
     */
    setColumnProperties: function setColumnProperties(x, properties) {
        var column = this.getColumn(x);
        if (!column) {
            throw 'Expected column.';
        }
        var result = Object.assign(column.properties, properties);
        this.changed();
        return result;
    },

    /**
     * Clears all cell properties of given column or of all columns.
     * @param {number} [x] - Omit for all columns.
     * @memberOf Behavior#
     */
    clearAllCellProperties: function clearAllCellProperties(x) {
        if (x !== undefined) {
            var column = this.getColumn(x);
            if (column) {
                column.clearAllCellProperties();
            }
        } else if (this.subgrids) {
            this.subgrids.forEach(function (dataModel) {
                for (var i = dataModel.getRowCount(); i--;) {
                    dataModel.setRowMetadata(i);
                }
            });
        }
    },

    /**
     * @memberOf Behavior#
     * @return {string[]} All the currently hidden column header labels.
     */
    getHiddenColumnDescriptors: function getHiddenColumnDescriptors() {
        var tableState = this.grid.properties;
        var indexes = tableState.columnIndexes;
        var labels = [];
        var columnCount = this.getActiveColumnCount();
        for (var i = 0; i < columnCount; i++) {
            if (indexes.indexOf(i) === -1) {
                var column = this.getActiveColumn(i);
                labels.push({
                    id: i,
                    header: column.header,
                    field: column.name
                });
            }
        }
        return labels;
    },

    /**
     * @memberOf Behavior#
     * @return {number} The number of fixed columns.
     */
    getFixedColumnCount: function getFixedColumnCount() {
        return this.grid.properties.fixedColumnCount;
    },

    /**
     * @memberOf Behavior#
     * @desc set the number of fixed columns
     * @param {number} n - the integer count of how many columns to be fixed
     */
    setFixedColumnCount: function setFixedColumnCount(n) {
        this.grid.properties.fixedColumnCount = n;
    },

    /**
     * @summary The number of "fixed rows."
     * @desc The number of (non-scrollable) rows preceding the (scrollable) data subgrid.
     * @memberOf Behavior#
     * @return {number} The sum of:
     * 1. All rows of all subgrids preceding the data subgrid.
     * 2. The first `fixedRowCount` rows of the data subgrid.
     */
    getFixedRowCount: function getFixedRowCount() {
        return this.getHeaderRowCount() + this.grid.properties.fixedRowCount;
    },

    /**
     * @memberOf Behavior#
     * @desc Set the number of fixed rows, which includes (top to bottom order):
     * 1. The header rows
     *    1. The header labels row (optional)
     *    2. The filter row (optional)
     *    3. The top total rows (0 or more)
     * 2. The non-scrolling rows (externally called "the fixed rows")
     *
     * @returns {number} Sum of the above or 0 if none of the above are in use.
     *
     * @param {number} The number of rows.
     */
    setFixedRowCount: function setFixedRowCount(n) {
        this.grid.properties.fixedRowCount = n;
    },

    /**
     * @memberOf Behavior#
     * @desc a dnd column has just been dropped, we've been notified
     */
    endDragColumnNotification: function endDragColumnNotification() {},

    /**
     * @memberOf Behavior#
     * @return {null} the cursor at a specific x,y coordinate
     * @param {number} x - the x coordinate
     * @param {number} y - the y coordinate
     */
    getCursorAt: function getCursorAt(x, y) {
        return null;
    },

    /**
     * Number of _visible_ columns.
     * @memberOf Behavior#
     * @return {number} The total number of columns.
     */
    getActiveColumnCount: function getActiveColumnCount() {
        return this.columns.length;
    },

    /**
     * @summary Column alignment of given grid column.
     * @desc One of:
     * * `'left'`
     * * `'center'`
     * * `'right'`
     *
     * Cascades to grid.
     * @memberOf Behavior#
     * @desc Quietly set the horizontal scroll position.
     * @param {number} x - The new position in pixels.
     */
    setScrollPositionX: function setScrollPositionX(x) {
        /**
         * @memberOf Behavior#
         * @type {number}
         */
        this.scrollPositionX = x;
    },

    getScrollPositionX: function getScrollPositionX() {
        return this.scrollPositionX;
    },

    /**
     * @memberOf Behavior#
     * @desc Quietly set the vertical scroll position.
     * @param {number} y - The new position in pixels.
     */
    setScrollPositionY: function setScrollPositionY(y) {
        /**
         * @memberOf Behavior#
         * @type {number}
         */
        this.scrollPositionY = y;
    },

    getScrollPositionY: function getScrollPositionY() {
        return this.scrollPositionY;
    },

    /**
     * @memberOf Behavior#
     * @return {cellEditor} The cell editor for the cell at the given coordinates.
     * @param {CellEvent} editPoint - The grid cell coordinates.
     */
    getCellEditorAt: function getCellEditorAt(event) {
        return event.isDataColumn && event.column.getCellEditorAt(event);
    },

    /**
     * @memberOf Behavior#
     * @return {boolean} `true` if we should highlight on hover
     * @param {boolean} isColumnHovered - the column is hovered or not
     * @param {boolean} isRowHovered - the row is hovered or not
     */
    highlightCellOnHover: function highlightCellOnHover(isColumnHovered, isRowHovered) {
        return isColumnHovered && isRowHovered;
    },

    /**
     * @memberOf Behavior#
     * @desc this function is a hook and is called just before the painting of a cell occurs
     * @param {Point} cell
     */
    cellPropertiesPrePaintNotification: function cellPropertiesPrePaintNotification(cell) {},

    /**
     * @memberOf Behavior#
     * @desc this function is a hook and is called just before the painting of a fixed row cell occurs
     * @param {Point} cell
     */
    cellFixedRowPrePaintNotification: function cellFixedRowPrePaintNotification(cell) {},

    /**
     * @memberOf Behavior#
     * @desc this function is a hook and is called just before the painting of a fixed column cell occurs
     * @param {Point} cell
     */
    cellFixedColumnPrePaintNotification: function cellFixedColumnPrePaintNotification(cell) {},

    /**
     * @memberOf Behavior#
     * @desc this function is a hook and is called just before the painting of a top left cell occurs
     * @param {Point} cell
     */
    cellTopLeftPrePaintNotification: function cellTopLeftPrePaintNotification(cell) {},

    /**
     * @memberOf Behavior#
     * @desc swap src and tar columns
     * @param {number} src - column index
     * @param {number} tar - column index
     */
    swapColumns: function swapColumns(source, target) {
        var columns = this.columns;
        var tmp = columns[source];
        columns[source] = columns[target];
        columns[target] = tmp;
        this.changed();
    },

    synchronizeSchemaToColumnDefs: function synchronizeSchemaToColumnDefs() {
        this.grid.api.setColumnDefs(this.grid.columnDefs);
    },

    recalculateColumnSizes: function recalculateColumnSizes() {
        this.grid.api.sizeColumnsToFit();
    },

    /**
     * @desc utility method to perform columns reordering
     * @param {number} from - visible columns start index
     * @param {number} len - length of columns set to reorder
     * @param {number} target - new start index of an columns
     * @param {boolean?} broadcastEvent - optional param. If set to 'false', synthetic event will not be fired.
     * Useful, when reordering not initiated by user, and don't need to affect side effects
     * @param {boolean?} givenHiddenColumns - if true, method performed like all the columns is shown and indexes
     * of visible columns and all columns are equal
     */
    moveColumns: function moveColumns(from, len, target) {
        var _this = this;

        var broadcastEvent = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
        var givenHiddenColumns = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;

        this.log('moveColumns called with params', from, len, target, broadcastEvent, givenHiddenColumns);
        var columns = this.columns;

        var visibleColDefs = this.grid.visibleColumnDefs;
        var colDefs = this.grid.columnDefs;

        var colDefsToMove = givenHiddenColumns ? colDefs.slice(0).splice(from, len) : visibleColDefs.slice(0).splice(from, len);

        var headers = [];
        if (this.grid.properties.onlyDataReorder) {
            headers = columns.map(function (c) {
                return c.header;
            });
        }

        if (!givenHiddenColumns) {
            var visibleColumnWithTargetIndex = visibleColDefs[target];
            target = colDefs.indexOf(visibleColumnWithTargetIndex);
        }

        var movedColumns = [];
        var colDefsPrepared = colDefsToMove;
        if (colDefs.indexOf(colDefsToMove[0]) >= target) {
            colDefsPrepared = colDefsToMove.reverse();
        }
        colDefsPrepared.forEach(function (colDef) {
            var columnWithSameColDef = columns.find(function (c) {
                return c.colDef === colDef;
            });
            if (columnWithSameColDef) {
                movedColumns.unshift(columnWithSameColDef);
            }

            var currentColDefIndex = colDefs.indexOf(colDef);
            colDefs.splice(target, 0, colDefs.splice(currentColDefIndex, 1)[0]);

            _this.log('ColDef with index ' + currentColDefIndex + ' moved to ' + target);
        });

        this.synchronizeSchemaToColumnDefs();

        if (broadcastEvent) {
            this.grid.fireSyntheticColumnsMovedEvent(movedColumns, target);
        }

        this.grid.visibleColumnDefs = colDefs.filter(function (cd) {
            return !cd.isHidden;
        });

        if (this.grid.properties.onlyDataReorder) {
            columns.forEach(function (c, i) {
                return c.header = headers[i];
            });
        }

        this.changed();
    },

    convertViewPointToDataPoint: function convertViewPointToDataPoint(unscrolled) {
        return new Point(this.getActiveColumn(unscrolled.x).index, unscrolled.y);
    },

    /**
     * @desc shows, is row with this index represents aggregation
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isAggregationRowByIndex: function isAggregationRowByIndex(rowIndex) {
        var row = this.grid.getRow(rowIndex);

        return this.isAggregationRow(row);
    },

    /**
     * @desc shows, is row represents aggregation
     * @type {boolean}
     * @memberOf CellEvent#
     */
    isAggregationRow: function isAggregationRow(row) {
        return !!row && typeof row.$$aggregation !== 'undefined';
    },

    /**
     * @desc returns array of child rows of an row by index
     * @type {array}
     * @memberOf CellEvent#
     */
    getChildRowsByIndex: function getChildRowsByIndex(rowIndex) {
        var row = this.grid.getRow(rowIndex);

        return this.getChildRows(row);
    },
    /**
     * @desc returns array of child rows of an row if exists
     * @type {array}
     * @memberOf CellEvent#
     */
    getChildRows: function getChildRows(row) {
        return !!row && row.$$children ? row.$$children : [];
    },

    /**
     * @desc shows, is row with index contains aggregated subrows
     * @type {boolean}
     * @memberOf CellEvent#
     */
    hasChildRowsByIndex: function hasChildRowsByIndex(rowIndex) {
        return this.getChildRowsByIndex(rowIndex).length > 0;
    },

    /**
     * @desc shows, is row contains aggregated subrows
     * @type {boolean}
     * @memberOf CellEvent#
     */
    hasChildRows: function hasChildRows(row) {
        return this.getChildRows(row).length > 0;
    },

    /**
     * @desc returns count of aggregated child rows by parent row index
     * @type {number}
     * @memberOf CellEvent#
     */
    getAggregationChildCountByIndex: function getAggregationChildCountByIndex(rowIndex) {
        var row = this.grid.getRow(rowIndex);

        return this.getAggregationChildCount(row);
    },

    /**
     * @desc returns count of aggregated child rows
     * @type {number}
     * @memberOf CellEvent#
     */
    getAggregationChildCount: function getAggregationChildCount(row) {
        return !!row && !!row.$$cluster_size ? row.$$cluster_size : 0;
    },

    isExpandableRowByIndex: function isExpandableRowByIndex(rowIndex) {
        var row = this.grid.getRow(rowIndex);
        return this.isExpandableRow(row);
    },

    isExpandableRow: function isExpandableRow(row) {
        return !!row && row.$$expandable ? row.$$expandable : false;
    },

    isRowExpandedByIndex: function isRowExpandedByIndex(rowIndex) {
        var row = this.grid.getRow(rowIndex);

        return this.isRowExpanded(row);
    },

    isRowExpanded: function isRowExpanded(row) {
        return !!row && row.$$open ? row.$$open : false;
    },

    getRowTreeLevelByIndex: function getRowTreeLevelByIndex(rowIndex) {
        var row = this.grid.getRow(rowIndex);

        return this.getRowTreeLevel(row);
    },

    getRowTreeLevel: function getRowTreeLevel(row) {
        return !!row && row.__treeLevel !== undefined ? row.__treeLevel : false;
    },

    hasTreeColumn: function hasTreeColumn(columnIndex) {
        return true;
    },

    getSelectionMatrixFunction: function getSelectionMatrixFunction(selectedRows) {
        return function () {
            return null;
        };
    },

    getRowHeaderColumn: function getRowHeaderColumn() {
        return this.allColumns[this.rowColumnIndex];
    },

    getHeaderColumnByName: function getHeaderColumnByName(nameToFind) {
        return this.columns.find(function (c) {
            return c.name === nameToFind;
        });
    },

    autosizeAllColumns: function autosizeAllColumns() {
        this.checkColumnAutosizing(true);
        this.changed();
    },

    checkColumnAutosizing: function checkColumnAutosizing(force) {
        force = force === true;
        var autoSized = this.autoSizeRowNumberColumn() || this.hasTreeColumn() && this.getRowHeaderColumn().checkColumnAutosizing(force);
        this.allColumns.forEach(function (column) {
            autoSized = column.checkColumnAutosizing(force) || autoSized;
        });
        return autoSized;
    },

    autoSizeRowNumberColumn: function autoSizeRowNumberColumn() {
        if (this.grid.properties.showRowNumbers && this.grid.properties.rowNumberAutosizing) {
            return this.getRowHeaderColumn().checkColumnAutosizing(true);
        }
    },

    getColumns: function getColumns() {
        return this.allColumns;
    },

    getActiveColumns: function getActiveColumns() {
        return this.columns;
    },

    getHiddenColumns: function getHiddenColumns() {
        var visible = this.columns;
        var all = this.allColumns;
        var hidden = [];
        for (var i = 0; i < all.length; i++) {
            if (visible.indexOf(all[i]) === -1) {
                hidden.push(all[i]);
            }
        }
        hidden.sort(function (a, b) {
            return a.header < b.header;
        });
        return hidden;
    },

    getSelectedRows: function getSelectedRows() {
        return this.grid.selectionModel.getSelectedRows();
    },

    getSelectedColumns: function getSelectedColumns() {
        return this.grid.selectionModel.getSelectedColumns();
    },

    getSelections: function getSelections() {
        return this.grid.selectionModel.getSelections();
    },

    log: function log() {
        var _grid;

        (_grid = this.grid).log.apply(_grid, arguments);
    }
});

// define constants as immutable (i.e., !writable)
Object.defineProperties(Behavior.prototype, {
    treeColumnIndex: { value: -1 },
    rowColumnIndex: { value: -2 }
});

function warnBehaviorFeaturesDeprecation() {
    var featureNames = [],
        unregisteredFeatures = [],
        n = 0;

    this.features.forEach(function (FeatureConstructor) {
        var className = FeatureConstructor.prototype.$$CLASS_NAME || FeatureConstructor.name,
            featureName = className || 'feature' + n++;

        // build list of feature names
        featureNames.push(featureName);

        // build list of unregistered features
        if (!this.featureRegistry.get(featureName, true)) {
            var constructorName = FeatureConstructor.name || FeatureConstructor.prototype.$$CLASS_NAME || 'FeatureConstructor' + n,
                params = [];
            if (!className) {
                params.push('\'' + featureName + '\'');
            }
            params.push(constructorName);
            unregisteredFeatures.push(params.join(', '));
        }
    }, this);

    if (featureNames.length) {
        var sampleCode = 'Hypergrid.defaults.features = [\n' + join('\t\'', featureNames, '\',\n') + '];';

        if (unregisteredFeatures.length) {
            sampleCode += '\n\nThe following custom features are unregistered and will need to be registered prior to behavior instantiation:\n\n' + join('Features.add(', unregisteredFeatures, ');\n');
        }

        if (n) {
            sampleCode += '\n\n(You should provide meaningful names for your custom features rather than the generated names above.)';
        }

        console.warn('`grid.behavior.features` (array of feature constructors) has been deprecated as of version 2.1.0 in favor of `grid.properties.features` (array of feature names). Remove `features` array from your behavior and add `features` property to your grid state object (or Hypergrid.defaults), e.g.:\n\n' + sampleCode);
    }
}

function join(prefix, array, suffix) {
    return prefix + array.join(suffix + prefix) + suffix;
}

// synonyms

/**
 * Synonym of {@link Behavior#reindex}.
 * @name applyAnalytics
 * @deprecated
 * @memberOf Behavior#
 */
Behavior.prototype.applyAnalytics = Behavior.prototype.reindex;

// mix-ins
Behavior.prototype.mixIn(require('./rowProperties').mixin);
Behavior.prototype.mixIn(require('./cellProperties').behaviorMixin);
Behavior.prototype.mixIn(require('./subgrids').mixin);

module.exports = Behavior;
