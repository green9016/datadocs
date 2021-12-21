'use strict';

/**
 * @module fallbacks
 *
 * @desc {@link Behavior#resetDataModel resetDataModel()} inserts each of these catcher methods into the new data model when not otherwise implemented, which allows Hypergrid to indiscriminately call these otherwise missing methods on the data model without fear of the call failing.
 */

module.exports = {
    /** @implements dataModelAPI#apply */
    apply: function apply() {},

    /** @implements dataModelAPI#isDrillDown */
    isDrillDown: function isDrillDown() {
        return false;
    },

    /** @implements dataModelAPI#click */
    click: function click() {
        return false;
    },

    /** @implements dataModelAPI#getColumnCount */
    getColumnCount: function getColumnCount() {
        return this.getSchema().length;
    },

    /** @implements dataModelAPI#getRow */
    getRow: function getRow(y) {
        this.dataRowProxy.$y$ = y;
        return this.dataRowProxy;
    },

    /** @implements dataModelAPI#getData */
    getData: function getData(metadataFieldName) {
        var y,
            Y = this.getRowCount(),
            row,
            rows = new Array(Y),
            metadata;

        for (y = 0; y < Y; y++) {
            row = this.data[y]; // do not use getRow because of tree levels
            if (row) {
                rows[y] = Object.assign({}, row);
                if (metadataFieldName) {
                    metadata = this.getRowMetadata(y);
                    if (metadata) {
                        rows[y][metadataFieldName] = metadata;
                    }
                }
            }
        }

        return rows;
    },

    setData: function setData(data) {
        // fail silently because Local.js::setData currently calls this for every subgrid
    },

    setValue: function setValue(x, y, value) {
        console.warn('dataModel.setValue(' + x + ', ' + y + ', "' + value + '") called but no implementation. Data not saved.');
    },

    /** @implements dataModelAPI#getRowIndex */
    getRowIndex: function getRowIndex(y) {
        return y;
    },

    /** @implements dataModelAPI#getRowMetadata */
    getRowMetadata: function getRowMetadata(y, prototype) {
        return this.metadata[y] || prototype !== undefined && (this.metadata[y] = Object.create(prototype));
    },

    /** @implements dataModelAPI#getMetadataStore */
    getMetadataStore: function getMetadataStore() {
        return this.metadata;
    },

    /** @implements dataModelAPI#setRowMetadata */
    setRowMetadata: function setRowMetadata(y, metadata) {
        if (metadata) {
            this.metadata[y] = metadata;
        } else {
            delete this.metadata[y];
        }
        return metadata;
    },

    /** @implements dataModelAPI#setMetadataStore */
    setMetadataStore: function setMetadataStore(newMetadataStore) {
        this.metadata = newMetadataStore || [];
    }
};
