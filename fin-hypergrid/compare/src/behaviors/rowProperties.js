'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.mixin = {
    /**
     * @summary The total height of the "fixed rows."
     * @desc The total height of all (non-scrollable) rows preceding the (scrollable) data subgrid.
     * @memberOf Behavior#
     * @return {number} The height in pixels of the fixed rows area of the hypergrid, the total height of:
     * 1. All rows of all subgrids preceding the data subgrid.
     * 2. The first `fixedRowCount` rows of the data subgrid.
     */
    getFixedRowsHeight: function getFixedRowsHeight() {
        var subgrid,
            isData,
            r,
            R,
            subgrids = this.subgrids,
            height = 0;

        for (var i = 0; i < subgrids.length && !isData; ++i) {
            subgrid = subgrids[i];
            isData = subgrid.isData;
            R = isData ? this.grid.properties.fixedRowCount : subgrid.getRowCount();
            for (r = 0; r < R; ++r) {
                height += this.getRowHeight(r, subgrid);
            }
        }

        return height;
    },

    /**
     * @summary The total height of the "data rows."
     * @desc The total height of all rows preceding the (scrollable) data subgrid.
     * @memberOf Behavior#
     * @return {number} The height in pixels of the data rows area of the hypergrid, the total height of:
     * 1. All rows of all subgrids preceding the data subgrid.
     * 2. The visible data rows of the data subgrid.
     */
    getRowsHeight: function getRowsHeight(toY) {
        var _this = this;

        var height = 0;

        this.subgrids.forEach(function (subgrid) {
            var maxRowCount = subgrid.getRowCount();
            var R = toY === undefined || toY > maxRowCount ? maxRowCount : toY;
            for (var r = 0; r < R; ++r) {
                height += _this.getRowHeight(r, subgrid);
            }
        });

        return height;
    },

    /**
     * @memberOf Behavior#
     * @param {number|CellEvent} yOrCellEvent - Data row index local to `dataModel`; or a `CellEvent` object.
     * @param {boolean} [prototype] - Prototype for a new properties object when one does not already exist. If you don't define this and one does not already exist, this call will return `undefined`.
     * Typical defined value is `null`, which creates a plain object with no prototype, or `Object.prototype` for a more "natural" object.
     * _(Required when 3rd param provided.)_
     * @param {dataModelAPI} [dataModel=this.dataModel] - This is the subgrid. You only need to provide the subgrid when it is not the data subgrid _and_ you did not give a `CellEvent` object in the first param (which already knows what subgrid it's in).
     * @returns {object|undefined} The row properties object which will be one of:
     * * object - existing row properties object or new row properties object created from `prototype`; else
     * * `false` - row found but no existing row properties object and `prototype` was not defined; else
     * * `undefined` - no such row
     */
    getRowProperties: function getRowProperties(yOrCellEvent, prototype, dataModel) {
        if ((typeof yOrCellEvent === 'undefined' ? 'undefined' : _typeof(yOrCellEvent)) === 'object') {
            dataModel = yOrCellEvent.subgrid;
            yOrCellEvent = yOrCellEvent.dataCell.y;
        }

        var metadata = (dataModel || this.dataModel).getRowMetadata(yOrCellEvent, prototype && null);
        return metadata && (metadata.__ROW || prototype !== undefined && (metadata.__ROW = Object.create(prototype)));
    },

    /**
     * Reset the row properties in its entirety to the given row properties object.
     * @memberOf Behavior#
     * @param {number|CellEvent} yOrCellEvent - Data row index local to `dataModel`; or a `CellEvent` object.
     * @param {object} properties - The new row properties object.
     * @param {dataModelAPI} [dataModel=this.dataModel] - This is the subgrid. You only need to provide the subgrid when it is not the data subgrid _and_ you did not give a `CellEvent` object in the first param (which already knows what subgrid it's in).
     */
    setRowProperties: function setRowProperties(yOrCellEvent, properties, dataModel) {
        if ((typeof yOrCellEvent === 'undefined' ? 'undefined' : _typeof(yOrCellEvent)) === 'object') {
            dataModel = yOrCellEvent.subgrid;
            yOrCellEvent = yOrCellEvent.dataCell.y;
        }

        (dataModel || this.dataModel).getRowMetadata(yOrCellEvent, null).__ROW = properties;

        this.stateChanged();
    },

    /**
     * Sets a single row property on a specific individual row.
     * @memberOf Behavior#
     * @param {number|CellEvent} yOrCellEvent - Data row index local to `dataModel`; or a `CellEvent` object.
     * @param {string} key - The property name.
     * @param value - The new property value.
     * @param {dataModelAPI} [dataModel=this.dataModel] - This is the subgrid. You only need to provide the subgrid when it is not the data subgrid _and_ you did not give a `CellEvent` object in the first param (which already knows what subgrid it's in).
     */
    setRowProperty: function setRowProperty(yOrCellEvent, key, value, dataModel) {
        this.getRowProperties(yOrCellEvent, null, dataModel)[key] = value;
        this.stateChanged();
    },

    /**
     * Add all the properties in the given row properties object to the row properties.
     * @memberOf Behavior#
     * @param {number|CellEvent} yOrCellEvent - Data row index local to `dataModel`; or a `CellEvent` object.
     * @param {object} properties - An object containing new property values(s) to assign to the row properties.
     * @param {dataModelAPI} [dataModel=this.dataModel] - This is the subgrid. You only need to provide the subgrid when it is not the data subgrid _and_ you did not give a `CellEvent` object in the first param (which already knows what subgrid it's in).
     */
    addRowProperties: function addRowProperties(yOrCellEvent, properties, dataModel) {
        Object.assign(this.getRowProperties(yOrCellEvent, null, dataModel), properties);
        this.stateChanged();
    },

    /**
     * @memberOf Behavior#
     * @param {number} yOrCellEvent - Data row index local to `dataModel`.
     * @param {dataModelAPI} [dataModel=this.dataModel]
     * @returns {number} The row height in pixels.
     */
    getRowHeight: function getRowHeight(yOrCellEvent, dataModel) {
        var rowProps = this.getRowProperties(yOrCellEvent, undefined, dataModel);
        return rowProps && rowProps.height || this.grid.properties[dataModel && dataModel.isHeader ? 'defaultHeaderRowHeight' : 'defaultRowHeight'];
    },

    /**
     * @memberOf Behavior#
     * @returns {number} count of rows, that used as fictive headers.
     */
    getFictiveHeaderRowsCount: function getFictiveHeaderRowsCount() {
        return this.grid.properties.fictiveHeaderRowsCount;
    },

    /**
     * @memberOf Behavior#
     * @desc set the pixel height of a specific row
     * @param {number} yOrCellEvent - Data row index local to dataModel.
     * @param {number} height - pixel height
     * @param {dataModelAPI} [dataModel=this.dataModel]
     */
    setRowHeight: function setRowHeight(yOrCellEvent, height, dataModel) {
        var rowProps = this.getRowProperties(yOrCellEvent, null, dataModel),
            oldHeight = rowProps.height;

        rowProps.height = Math.max(5, Math.ceil(height));

        if (rowProps.height !== oldHeight) {
            this.stateChanged();
        }
    }
};
