
'use strict';

function getAllGridColumns() {
    this.log('getAllGridColumns');
    return this.getActiveColumns();
}

function setColumnVisible(key, visible) {
    this.log('setColumnVisible', key, visible);

    setColumnsVisible.call(this, [key], visible);
}

function setColumnsVisible(keys, visible) {
    var _this = this;

    this.log('setColumnsVisible', keys, visible);
    var colDef = this.columnDefs;
    var columnsStateChanged = false;
    keys.forEach(function (key) {
        _this.getColDefs(key).forEach(function (cd) {
            cd.isHidden = !visible;
            columnsStateChanged = true;
        });
    });

    if (columnsStateChanged) {
        this.api.setColumnDefs(colDef);
        this.api.needColumnsToFit = true;
    }
}

function changePinnedRange(countToPin) {
    this.log('changePinnedRange', countToPin);
}

function getAllColumns() {
    this.log('getAllColumns');
    return this.getActiveColumns().filter(function (c) {
        return c.colDef;
    });
}

function resetColumnState() {
    this.log('resetColumnState');
}

function getColumn(key) {
    this.log('getColumn', key);
}

function moveColumn(fromIndex, toIndex) {
    this.moveColumns(fromIndex, 1, toIndex, false, true);
    this.log('moveColumn', fromIndex, toIndex);
}

function getAllDisplayedVirtualColumns() {
    this.log('getAllDisplayedVirtualColumns');
    return this.getActiveColumns();
}

function autoSizeColumns(columns, force) {
    var _this2 = this;

    this.log('autoSizeColumns', columns, force);
    columns.forEach(function (c) {
        return _this2.behavior.fitColumn(c, force);
    });
}

function autoSizeColumnsWithMaxInitialWidth (columns, force) {
    this.columnApi.autoSizeColumns(columns, force);
    //this.behavior.fitColumn(this.behavior.getTreeColumn(), force);
    var _this = this;
    columns.forEach(function (c) {
        var props = c.properties;
        if (props.colDef && _this.properties.maxInitialWidth && c.getWidth() > _this.properties.maxInitialWidth) {
            var width = _this.properties.maxInitialWidth;
            if (width > props.maxWidth) {
                width = props.maxWidth;
            }
            props.preferredWidth = Math.ceil(width);

            if (force || props.columnAutosizing) {
                if (props.preferredWidth > 0) {
                    c.setWidth(props.preferredWidth);
                }
            }
        }
    });
};

module.exports = {
    // functions
    getAllGridColumns: getAllGridColumns,
    setColumnVisible: setColumnVisible,
    setColumnsVisible: setColumnsVisible,
    changePinnedRange: changePinnedRange,
    getAllColumns: getAllColumns,
    resetColumnState: resetColumnState,
    getColumn: getColumn,
    moveColumn: moveColumn,
    getAllDisplayedVirtualColumns: getAllDisplayedVirtualColumns,
    autoSizeColumns: autoSizeColumns,
    autoSizeColumnsWithMaxInitialWidth: autoSizeColumnsWithMaxInitialWidth
};
