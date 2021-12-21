/* eslint-env browser */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var overrider = require('overrider');

var toFunction = require('../lib/toFunction');
var assignOrDelete = require('../lib/assignOrDelete');
var HypergridError = require('../lib/error');
var images = require('../../images');


var warned = {};

var PROGRESS = ['progress', '-moz-progress', '-webkit-progress'];

/** @summary Create a new `Column` object.
 * @mixes cellProperties.columnMixin
 * @mixes columnProperties.mixin
 * @constructor
 * @param {Behavior} behavior
 * @param {object} columnSchema
 * @param {number} columnSchema.index
 * @param {string} columnSchema.name
 * @param {string} [columnSchema.header] - Displayed in column headers. If not defined, name is used.
 * @param {function} [columnSchema.calculator] - Define to make a computed column.
 * @param {string} [columnSchema.type] - For possible data model use. (Not used in core.)
 *
 * Positive values of `index` are "real" fields.
 *
 * Negative values of `index` are special cases:
 * `index` | Meaning
 * :-----: | --------
 *    -2   | Row header column
 *    -1   | Tree (drill-down) column
 */
/*function Column(behavior, columnSchema) {
    switch (typeof columnSchema) {
        case 'number':
            if (!warned.number) {
                console.warn('Column(behavior: object, index: number) overload has been deprecated as of v2.1.6 in favor of Column(behavior: object, columnSchema: object) overload with defined columnSchema.index. (Will be removed in a future release.)');
                warned.number = true;
            }
            columnSchema = {
                index: columnSchema
            };
            break;
        case 'string':
            if (!warned.string) {
                console.warn('Column(behavior:object, name: string) overload (where name is sought in schema) has been deprecated as of v2.1.6 in favor of Column(behavior: object, columnSchema: object) overload with defined columnSchema.index. (Will be removed in a future release.)');
                warned.string = true;
            }
            var name, index;
            name = columnSchema;
            index = behavior.dataModel.schema.findIndex(function(columnSchema) {
                return columnSchema.name === name;
            });
            if (index < 0) {
                throw new this.HypergridError('Column named "' + name + '" not found in schema.');
            }
            columnSchema = {
                name: name,
                index: index
            };
            break;
        case 'object':
            if (columnSchema.index === undefined) {
                if (!warned.object) {
                    console.warn('Column(behavior:object, columnSchema: object) overload (where columnSchema.index is undefined but columnSchema.name is sought in schema) has been deprecated as of v2.1.6 in favor of defined columnSchema.index. (Will be removed in a future release.)');
                    warned.object = true;
                }
                name = columnSchema.name;
                index = behavior.dataModel.schema.findIndex(function(columnSchema) {
                    return columnSchema.name === name;
                });
                if (index < 0) {
                    throw new this.HypergridError('Column named "' + name + '" not found in schema.');
                }
                columnSchema.index = index;
            }
            break;
    }

    if (columnSchema.index === undefined) {
        throw new HypergridError('Column index required.');
    }

    this.behavior = behavior;
    this.dataModel = behavior.dataModel;

    // set `index` and `name` as read-only properties
    Object.defineProperties(this, {
        index: {
            value: columnSchema.index
        },
        name: {
            enumerable: true,
            value: columnSchema.name || columnSchema.index.toString()
        }
    });

    this.properties = this.schema = columnSchema; // see {@link Column#properties properties} setter

    switch (columnSchema.index) {
        case this.behavior.treeColumnIndex:
            // Width of icon + 3-pixel spacer (checked and unchecked should be same width)
            var icon = images[Object.create(this.properties.treeHeader, { isDataRow: { value: true } }).leftIcon];
            this.properties.minimumColumnWidth = icon ? icon.width + 3 : 0;
            break;

        case this.behavior.rowColumnIndex:
            break;

        default:
            if (columnSchema.index < 0) {
                throw new this.HypergridError('New column index ' + columnSchema.index + ' out of range.');
            }
    }
}*/
function Column(behavior, index) {
    var options, icon;

    this.behavior = behavior;
    this.dataModel = behavior.dataModel;

    if ((typeof index === 'undefined' ? 'undefined' : _typeof(index)) === 'object') {
        options = index;
        index = options.index !== undefined ? options.index : options.name;
    } else {
        options = {};
    }

    this.schema = this.behavior.schema[index];

    if (!this.schema) {
        throw 'Column not found in data.';
    }

    this.properties = options;

    switch (index) {
        case this.behavior.treeColumnIndex:
            // Width of icon + 3-pixel spacer (checked and unchecked should be same width)
            icon = images[Object.create(this.properties.treeHeader, { isDataRow: { value: true } }).leftIcon];
            this.properties.minimumColumnWidth = icon ? icon.width + 3 : 0;
            break;

        case this.behavior.rowColumnIndex:
            break;

        default:
            if (index < 0) {
                throw '`index` out of range';
            }
    }
}

Column.prototype = {
    constructor: Column.prototype.constructor,
    $$CLASS_NAME: 'Column',

    HypergridError: HypergridError,

    mixIn: overrider.mixIn,

    /**
     * @summary Index of this column in the `fields` array.
     * @returns {number}
     */
    get index() {
        // read-only (no setter)
        return this.schema.index;
    },

    /**
     * @summary Name of this column from the `fields` array.
     * @returns {string|undefined} Returns `undefined` if the column is not in the schema (such as for handle column).
     */
    get name() {
        // read-only (no setter)
        return this.schema.name;
    },

    /**
     * @summary alias to name
     * @returns {string|undefined} Returns `undefined` if the column is not in the schema (such as for handle column).
     */
    get colId() {
        // read-only (no setter)
        return this.colDef && this.colDef.colId || this.schema.name;
    },

    get colDef() {
        // read-only (no setter)
        return this.properties.colDef;
    },

    get treeLevel() {
        // read-only (no setter)
        return this.colDef ? this.colDef.treeLevel : undefined;
    },

    /**
     * @summary Get or set the text of the column's header.
     * @desc The _header_ is the label at the top of the column.
     *
     * Setting the header updates both:
     * * the `schema` (aka, header) array in the underlying data source; and
     * * the filter.
     * @type {string}
     */
    /*set header(header) {
        this.schema.header = header;
        this.behavior.grid.repaint();
    },*/
    set header(headerText) {
        if (headerText === undefined) {
            delete this.schema.header;
        } else {
            this.schema.header = headerText;
        }
        this.behavior.grid.repaint();
    },
    get header() {
        return this.schema.header;
    },

    /**
     * @summary Get or set the computed column's calculator function.
     * @desc Setting the value here updates the calculator in the data model schema.
     *
     * The results of the new calculations will appear in the column cells on the next repaint.
     * @type {string}
     */
    set calculator(calculator) {
        /*
        calculator = resolveCalculator.call(this, calculator);
        if (calculator !== this.schema.calculator) {
            this.schema.calculator = calculator;
            this.behavior.grid.reindex();
        }*/
        if (calculator) {
            calculator = resolveCalculator.call(this, calculator);
            if (calculator !== this.schema.calculator) {
                if (calculator === undefined) {
                    delete this.schema.calculator;
                } else {
                    this.schema.calculator = calculator;
                }
                this.behavior.reindex();
            }
        } else if (this.schema.calculator) {
            delete this.schema.calculator;
            this.behavior.reindex();
        }
    },
    get calculator() {
        return this.schema.calculator;
    },

    get searchType() {
        return this.colDef && this.colDef.searchType;
    },

    /**
     * @summary Get or set the type of the column's header.
     * @desc Setting the type updates the filter which typically uses this information for proper collation.
     *
     * @todo: Instead of using `this._type`, put on data source like the other essential properties. In this case, sorter could use the info to choose a comparator more intelligently and efficiently.
     * @type {string}
     */
    set type(type) {
        //this.schema.type = type;
        //this.behavior.reindex();
        if (type === undefined) {
            delete this.schema.type;
        } else {
            this.schema.type = type;
        }
        this.behavior.reindex();
    },
    get type() {
        return this.schema.type;
    },

    getCount: function getCount(y) {
        return this.dataModel.getCount(this.index, y);
    },

    getValue: function(y, dataModel) {
        return this.dataModel.getValue(this.index, y, dataModel);
    },

    setValue: function(y, value, dataModel) {
        return this.dataModel.setValue(this.index, y, value, dataModel);
    },

    getWidth: function() {
        return this.properties.width || this.behavior.grid.properties.defaultColumnWidth;
    },

    setWidth: function(width) {
        width = Math.min(Math.max(this.properties.minimumColumnWidth, width), this.properties.maximumColumnWidth || Infinity);

        if (this.properties.maxWidth && width > this.properties.maxWidth) {
            width = this.properties.maxWidth;
        }

        if (width !== this.properties.width) {
            this.properties.width = width;
            this.schema.width = width;
            this.properties.columnAutosizing = false;
        }
    },

    checkColumnAutosizing: function(force) {
        var properties = this.properties,
            width, preferredWidth, autoSized;

        if (properties.columnAutosizing) {
            width = properties.width;
            preferredWidth = properties.preferredWidth || width;
            force = force || !properties.columnAutosized;
            if (width !== preferredWidth || force && preferredWidth !== undefined) {
                properties.width = force ? preferredWidth : Math.max(width, preferredWidth);
                if (properties.columnAutosizingMax && properties.width > properties.columnAutosizingMax) {
                    properties.width = properties.columnAutosizingMax;
                }
                properties.columnAutosized = !isNaN(properties.width);
                autoSized = properties.width !== width;
            }
        }

        return autoSized;
    },

    getCellType: function(y) {
        var value = this.getValue(y);
        return this.typeOf(value);
    },

    getType: function() {
        var props = this.properties;
        var type = props.type;
        if (!type) {
            type = this.computeColumnType();
            if (type !== 'unknown') {
                props.type = type;
            }
        }
        return type;
    },

    computeColumnType: function() {
        var headerRowCount = this.behavior.getHeaderRowCount();
        var height = this.behavior.getRowCount();
        var value = this.getValue(headerRowCount);
        var eachType = this.typeOf(value);
        if (!eachType) {
            return 'unknown';
        }
        var type = this.typeOf(value);
        //var isNumber = ((typeof value) === 'number');
        for (var y = headerRowCount; y < height; y++) {
            value = this.getValue(y);
            eachType = this.typeOf(value);
            // if (type !== eachType) {
            //     if (isNumber && (typeof value === 'number')) {
            //         type = 'float';
            //     } else {
            //         return 'mixed';
            //     }
            // }
        }
        return type;
    },

    typeOf: function(something) {
        if (something == null) {
            return null;
        }
        var typeOf = typeof something === 'undefined' ? 'undefined' : _typeof(something);
        switch (typeOf) {
            case 'object':
                return something.constructor.name.toLowerCase();
            case 'number':
                return parseInt(something) === something ? 'int' : 'float';
            default:
                return typeOf;
        }
    },

    get properties() {
        return this._properties;
    },
    set properties(properties) {
        this.addProperties(properties, true);
    },

    /**
     * Copy a properties collection to this column's properties object.
     *
     * When a value is `undefined` or `null`, the property is deleted except when a setter or non-configurable in which case it's set to `undefined`.
     * @param {object|undefined} properties - Properties to copy to column's properties object. If `undefined`, this call is a no-op.
     * @param {boolean} [settingState] - Clear column's properties object before copying properties.
     */
    addProperties: function(properties, settingState) {
        if (!properties) {
            return;
        }
        if (settingState || !this._properties) {
            this._properties = this.createColumnProperties();
        }
        assignOrDelete(this._properties, properties);
    },

    /** This method is provided because some grid renderer optimizations require that the grid renderer be informed when column colors change. Due to performance concerns, they cannot take the time to figure it out for themselves. Along the same lines, making the property a getter/setter (in columnProperties.js), though doable, might present performance concerns as this property is possibly the most accessed of all column properties.
     * @param color
     */
    setBackgroundColor: function(color) {
        if (this.properties.backgroundColor !== color) {
            this.properties.backgroundColor = color;
            this.behavior.grid.renderer.rebundleGridRenderers();
        }
    },

    /**
     * @summary Get a new cell editor.
     * @desc The cell editor to use must be registered with the key in the cell's `editor` property.
     *
     * The cell's `format` property is mixed into the provided cellEvent for possible overriding by developer's override of {@link DataModel.prototype.getCellEditorAt} before being used by {@link CellEditor} to parse and format the cell value.
     *
     * @param {CellEvent} cellEvent
     *
     * @returns {undefined|CellEditor} Falsy value means either no declared cell editor _or_ instantiation aborted by falsy return from `fireRequestCellEdit`.
     */
    getCellEditorAt: async function(cellEvent) {
        console.log('column getcelleditor at ----------');
        var columnIndex = this.index,

        rowIndex = cellEvent.gridCell.y;

        var full_value = undefined;

        if (cellEvent.dataCell.y >= cellEvent.properties.fixedRowCount && cellEvent.check_to_load_full_value){
            this.behavior.grid.beProgressCursor(PROGRESS, true);
            full_value = await this.behavior.dataModel.pspFetchDataCellValue({
                start_col: columnIndex,
                end_col: columnIndex + 1,
                start_row: cellEvent.dataCell.y,
                end_row: cellEvent.dataCell.y + 1
              });

            cellEvent.full_value = full_value;
        }
        var editorName = cellEvent.editor;
        var options = Object.create(cellEvent, {
                format: {
                    // `options.format` is a copy of the cell's `format` property which is:
                    // 1. Subject to adjustment by the `getCellEditorAt` override.
                    // 2. Then used by the cell editor to reference the registered localizer (defaults to 'string' localizer)
                    writable: true,
                    enumerable: true, // so cell editor will copy it to self
                    value: cellEvent.properties.format
                }
            }),

            cellEditor = cellEvent.subgrid.getCellEditorAt(columnIndex, rowIndex, editorName, options);

        //if (cellEditor){
        //    cellEditor.set_full_value(full_value);
        //}

        if (cellEditor && !cellEditor.grid) {
            // cell editor returned but not fully instantiated (aborted by falsy return from fireRequestCellEdit)
            cellEditor = undefined;
        }

        return cellEditor;
    },

    getFormatter: function() {
        var localizerName = this.properties.format;
        return this.behavior.grid.localization.get(localizerName).format;
    }
};

var REGEX_ARROW_FUNC = /^(\(.*\)|\w+)\s*=>/,
    REGEX_NAMED_FUNC = /^function\s+(\w+)\(/,
    REGEX_ANON_FUNC = /^function\s*\(/;

/**
 * Calculators are functions. Column calculators are saved in `grid.properties.calculators` using the function name as key. Anonymous functions use the stringified function itself as the key. This may seem pointless, but this achieves the objective here which is to share function instances.
 * @throws {HypergridError} Unexpected input.
 * @throws {HypergridError} Arrow function not permitted.
 * @throws {HypergridError} Unknown function.
 * @this {Column}
 * @param {function|string} calculator - One of:
 * * calculator function
 * * stringified calculator function with or without function name
 * * function name of a known function (already in `calculators`)
 * * falsy value
 * @returns {function} Shared calculator instance or `undefined` if input was falsy.
 */
function resolveCalculator(calculator) {
    if (!calculator) {
        return undefined;
    }

    var forColumnName = ' (for column "' + this.name + '").';

    if (typeof calculator === 'function') {
        calculator = calculator.toString();
    } else if (typeof calculator !== 'string') {
        throw new HypergridError('Expected calculator function OR string containing calculator function OR calculator name' + forColumnName);
    }

    var matches, key,
        calculators = this.behavior.grid.properties.calculators || (this.behavior.grid.properties.calculators = {});

    if (/^\w+$/.test(calculator)) {
        key = calculator; // just a function name
        if (!calculators[key]) {
            throw new HypergridError('Unknown calculator name "' + key + forColumnName);
        }
    } else if ((matches = calculator.match(REGEX_NAMED_FUNC))) {
        key = matches[1]; // function name extracted from stringified function
    } else if (calculator.test(REGEX_ANON_FUNC)) {
        key = calculator; // anonymous stringified function
    } else if (REGEX_ARROW_FUNC.test(calculator)) {
        throw new HypergridError('Arrow function not permitted as column calculator ' + forColumnName);
    }

    if (!calculators[key]) { // neither a string nor a function (previously functionified string)?
        calculators[key] = calculator;
    }

    // functionify existing entries as well as new `calculators` entries
    calculators[key] = toFunction(calculators[key]);

    return calculators[key];
}

Column.prototype.mixIn(require('./cellProperties').mixin);
Column.prototype.mixIn(require('./columnProperties').mixin);

module.exports = Column;
