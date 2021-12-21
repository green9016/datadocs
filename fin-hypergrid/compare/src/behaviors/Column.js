/* eslint-env browser */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var overrider = require('overrider');

var toFunction = require('../lib/toFunction');
var HypergridError = require('../lib/error');
var images = require('../../images');

/** @summary Create a new `Column` object.
 * @see {@link module:Cell} is mixed into Column.prototype.
 * @mixes cellProperties.columnMixin
 * @mixes columnProperties.mixin
 * @constructor
 * @param behavior
 * @param {number|string|object} indexOrOptions - One of:
 * * If a positive number, valid index into `fields` array.
 * * If a string, a name in the `fields` array.
 * * If an object, must contain either an `index` or a `name` property.
 *
 * Positive values of `index` are "real" fields; see also {@link Column#setProperties|setProperties} which is called to set the remaining properties specified in `options`.
 *
 * Negative values of `index` are special cases:
 * `index` | Meaning
 * :-----: | --------
 *    -1   | Row header column
 *    -2   | Tree (drill-down) column
 */
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

    getValue: function getValue(y) {
        return this.dataModel.getValue(this.index, y);
    },

    setValue: function setValue(y, value) {
        return this.dataModel.setValue(this.index, y, value);
    },

    getWidth: function getWidth() {
        return this.properties.width || this.properties.defaultColumnWidth;
    },

    setWidth: function setWidth(width) {
        width = Math.max(this.properties.minimumColumnWidth, width);

        if (this.properties.maxWidth && width > this.properties.maxWidth) {
            width = this.properties.maxWidth;
        }

        if (width !== this.properties.width) {
            this.properties.width = width;
            this.schema.width = width;
            this.properties.columnAutosizing = false;
        }
    },

    checkColumnAutosizing: function checkColumnAutosizing(force) {
        var properties = this.properties,
            width,
            preferredWidth,
            autoSized;

        if (properties.columnAutosizing) {
            width = properties.width;
            preferredWidth = properties.preferredWidth || width;
            force = force || !properties.columnAutosized;
            if (width !== preferredWidth || force && preferredWidth !== undefined) {
                properties.width = force ? preferredWidth : Math.max(width, preferredWidth);
                properties.columnAutosized = !isNaN(properties.width);
                autoSized = properties.width !== width;
            }
        }

        return autoSized;
    },

    getCellType: function getCellType(y) {
        var value = this.getValue(y);
        return this.typeOf(value);
    },

    getType: function getType() {
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

    computeColumnType: function computeColumnType() {
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

    typeOf: function typeOf(something) {
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
    set properties(ownProperties) {
        this._properties = this.createColumnProperties();
        this.addProperties(ownProperties);
    },

    /** This method is provided because some grid renderer optimizations require that the grid renderer be informed when column colors change. Due to performance concerns, they cannot take the time to figure it out for themselves. Along the same lines, making the property a getter/setter (in columnProperties.js), though doable, might present performance concerns as this property is possibly the most accessed of all column properties.
     * @param color
     */
    setBackgroundColor: function setBackgroundColor(color) {
        if (this.properties.backgroundColor !== color) {
            this.properties.backgroundColor = color;
            this.behavior.grid.renderer.rebundleGridRenderers();
        }
    },

    addProperties: function addProperties(properties) {
        var key,
            descriptor,
            obj = this.properties;

        for (key in properties) {
            if (properties.hasOwnProperty(key)) {
                descriptor = Object.getOwnPropertyDescriptor(obj, key);
                if (!descriptor || descriptor.writable || descriptor.set) {
                    obj[key] = properties[key];
                }
            }
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
    getCellEditorAt: function getCellEditorAt(cellEvent) {
        var columnIndex = this.index,
            rowIndex = cellEvent.gridCell.y,
            editorName = cellEvent.properties.editor,
            options = Object.create(cellEvent, {
            format: {
                // `options.format` is a copy of the cell's `format` property which is:
                // 1. Subject to adjustment by the `getCellEditorAt` override.
                // 2. Then used by the cell editor to reference the registered localizer (defaults to 'string' localizer)
                writable: true,
                enumerable: true, // so cell editor will copy it to self
                value: cellEvent.properties.format
            }
        }),
            cellEditor = this.dataModel.getCellEditorAt(columnIndex, rowIndex, editorName, options);

        if (cellEditor && !cellEditor.grid) {
            // cell editor returned but not fully instantiated (aborted by falsy return from fireRequestCellEdit)
            cellEditor = undefined;
        }

        return cellEditor;
    },

    getFormatter: function getFormatter() {
        var localizerName = this.properties.format;
        return this.behavior.grid.localization.get(localizerName).format;
    }
};

var REGEX_ARROW_FUNC = /^(\(.*\)|\w+)\s*=>/;

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

    if (typeof calculator === 'function') {
        calculator = calculator.toString();
    } else if (typeof calculator !== 'string') {
        throw new HypergridError('Expected function OR string containing function OR function name the "' + this.name + '" column calculator.');
    }

    var matches,
        key,
        calculators = this.behavior.grid.properties.calculators || (this.behavior.grid.properties.calculators = {});

    if (/^\w+$/.test(calculator)) {
        key = calculator; // just a function name
        if (!calculators[key]) {
            throw new HypergridError('Unknown function name "' + key + '" for "' + this.name + '" column calculator.');
        }
    } else {
        matches = calculator.match(/^function\s*(\w+)\(/);

        if (matches) {
            key = matches[1]; // function name extracted from stringified function
        } else {
            key = calculator; // anonymous stringified function
        }

        if (!calculators[key]) {
            // neither a string nor a function (previoulsy functionified string)?
            if (REGEX_ARROW_FUNC.test(calculator)) {
                throw new HypergridError('Arrow function not permitted as column calculator (for column "' + this.name + '").');
            }
            calculators[key] = calculator;
        }
    }

    calculators[key] = toFunction(calculators[key]); // functionifies existing `calculators` entries as well as new entries

    return calculators[key];
}

Column.prototype.mixIn(require('./cellProperties').columnMixin);
Column.prototype.mixIn(require('./columnProperties').mixin);

module.exports = Column;
