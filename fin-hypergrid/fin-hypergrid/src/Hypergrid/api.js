/* eslint-env browser */

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var equal = require('deep-equal');
var SelectionRectangle = require('../lib/SelectionRectangle');

// helper methods

function range(start, stop) {
    var result = [];
    for (var idx = start.charCodeAt(0), end = stop.charCodeAt(0); idx <= end; ++idx) {
        result.push(String.fromCharCode(idx));
    }
    return result;
}

var az = range('A', 'Z');

function idOf(i) {
    //return (i >= 26 ? idOf(az, (i / 26 >> 0) - 1) : '') + az[i % 26 >> 0];

    // i is a zero based index so 0 maps to 'A'.
    const CHAR_CODE_A = 65;
    var finalString = "";

    while(true) {
        finalString = String.fromCharCode(CHAR_CODE_A + (i % 26)) + finalString;
        if(i < 26) {
            break;
        }
        i = Math.trunc(i/26) - 1;
    }

    return finalString;

}

function getFormatter(colDef) {
    var formatterMapper = function formatterMapper(f) {
        var formatter = f;
        if (formatter && typeof formatter !== 'string') {
            var update = formatter.prototype.update ? formatter.prototype.update : formatter;
            formatter = function formatter(value) {
                return update({ colDef: colDef, value: value, column: colDef });
            };
        }
        return formatter;
    };

    var dataFormatter = formatterMapper(colDef && colDef.cellRenderer);
    var headerFormatter = formatterMapper(colDef && colDef.headerCellRenderer);

    var checker = function checker(func) {
        for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            args[_key - 1] = arguments[_key];
        }

        return func && typeof func === 'function' ? func.apply(undefined, args) : args[0];
    };

    return function (value, isHeader) {
        if ((typeof isHeader === 'undefined' ? 'undefined' : _typeof(isHeader)) === 'object') {
            isHeader = isHeader.rowProperties ? isHeader.rowProperties.headerRow : isHeader.headerRow;
        }
        if (typeof isHeader !== 'boolean') {
            isHeader = false;
        }
        return checker(isHeader ? headerFormatter : dataFormatter, value);
    };
}

function convertColDefs(colDefs) {
    var schema = [];

    var headersFont = this.properties.columnHeaderFontBold;
    var maximumColumnWidth = this.properties.maximumColumnWidth;

    var getContextMenuItems = this.getContextMenuItems;

    var showAdditionalInfo = this.properties.showAdditionalInfo;

    var self = this;

    var data = [];

    var az = range('A', 'Z');

    var schemaColumnsCount = 0;
    var maxTreeLevel = 0;

    function countMaxTreeLevel(prevLevel, colDefsToDetect) {
        var isTopGroupCollapsed = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

        var currentLevel = prevLevel + 1;
        var hasVisibleColumns = false;

        colDefsToDetect.forEach(function (cd) {
            var isAlwaysDisplayedColDef = cd.collapsedHeaderName || cd.isTotal;

            var isColDefVisible = !isTopGroupCollapsed || isAlwaysDisplayedColDef;
            if (isColDefVisible) {
                hasVisibleColumns = true;
                var groupCollapsed = cd.columnGroupShow !== undefined && cd.columnGroupShow !== 'open' && cd.columnGroupShow !== 'always-showing';

                if (cd.children && cd.children.length > 0) {
                    countMaxTreeLevel(currentLevel, cd.children, groupCollapsed);
                }
            }
        });

        if (currentLevel > maxTreeLevel && hasVisibleColumns) {
            maxTreeLevel = currentLevel;
        }
    }

    function getEmptyHeaderRow() {
        return {
            __META: {
                __ROW: {
                    headerRow: true, // used for preventing duplicates
                    font: headersFont, // set bold font for title row
                    foregroundSelectionFont: headersFont, // set bold font for title row
                    editable: true, // allow edit content
                    cellContextMenu: self.getMainMenuItems ? self.getMainMenuItems : self.properties.headerContextMenu, // set context menu items with callbacks
                    halign: 'left',
                    showCellContextMenuIcon: showAdditionalInfo,
                    showColumnType: showAdditionalInfo
                }
            }
        };
    }

    countMaxTreeLevel(0, colDefs);

    function colDefMapper(singleColDef, isTree) {
        var headerLevel = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
        var topGroupCollapsed = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        var topGroupsIds = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

        var letter = idOf(schemaColumnsCount);

        var schemaMapper = function schemaMapper(header, name) {
            return {
                header: header,
                name: name,
                topGroupsIds: topGroupsIds,
                width: singleColDef.user_width || singleColDef.default_width,
                halign: singleColDef.halign,
                colTypeSign: singleColDef.colTypeSign,
                formatter: getFormatter(singleColDef) || undefined,
                format: name,
                headerPrefix: singleColDef.headerPrefix,
                cellContextMenu: getContextMenuItems,
                colDef: singleColDef
            };
        };

        if (isTree){
            var _originalField = JSON.stringify({"columnName": '__ROW_PATH__', "index": -1});
            headerLevel = 0;
            var _rowspan = maxTreeLevel - headerLevel - 1;
            schema[-1] = {
                header: letter,
                name: _originalField,
                type: []
            };
            if (!data[headerLevel]){
                data[headerLevel] = getEmptyHeaderRow();
            }
            //data[headerLevel][_originalField] = {
            //    rowspan: _rowspan,
            //    value: "Row/Col Labels",
            //    count: undefined
            //};

            data[headerLevel][_originalField] = {
                rowspan: _rowspan,
                value: this.behavior.dataModel.getRowColLevelText(),
                count: undefined
            };
            schemaColumnsCount++;
            return [letter];
        }

        if (singleColDef) {
            if (topGroupCollapsed && !singleColDef.collapsedHeaderName && !singleColDef.isTotal) {
                return [];
            }

            if (!!singleColDef.children && singleColDef.children.length > 0) {
                var insertedColumnNames = [];
                var groupCollapsed = singleColDef.columnGroupShow && singleColDef.columnGroupShow !== 'open' && singleColDef.columnGroupShow !== 'always-showing';
                singleColDef.children.forEach(function (ch) {
                    var newTopGroupsArray = [].concat(_toConsumableArray(topGroupsIds), [singleColDef.groupId]);
                    insertedColumnNames = [].concat(_toConsumableArray(insertedColumnNames), _toConsumableArray(colDefMapper(ch, headerLevel + 1, groupCollapsed, newTopGroupsArray)));
                });

                if (insertedColumnNames.length === 0) {
                    var originalField = singleColDef.columnName + '_$$cluster_size';
                    var _name = originalField || letter;

                    topGroupsIds = [].concat(_toConsumableArray(topGroupsIds), [singleColDef.groupId]);
                    schema.push(schemaMapper(letter || '', _name));
                    schemaColumnsCount++;

                    if (originalField) {
                        if (!data[headerLevel]) {
                            data[headerLevel] = getEmptyHeaderRow();
                        }
                        var rowspan = maxTreeLevel - headerLevel - 1;
                        var columnName = topGroupCollapsed && singleColDef.collapsedHeaderName && singleColDef.collapsedHeaderName.length ? singleColDef.collapsedHeaderName : singleColDef.headerName || '';
                        data[headerLevel][originalField] = {
                            rowspan: 0,
                            value: columnName,
                            count: singleColDef.count,
                            childColumnDefs: singleColDef.children,
                            groupId: singleColDef.groupId,
                            columnOpenByDefault: singleColDef.openByDefault,
                            columnGroupShow: singleColDef.columnGroupShow
                        };

                        if (rowspan > 0) {
                            rowspan--;
                            data[headerLevel + 1][originalField] = {
                                rowspan: rowspan,
                                value: 'Count',
                                count: singleColDef.count
                            };
                        }

                        if (rowspan > 0) {
                            for (var i = headerLevel + 2; i < maxTreeLevel; i++) {
                                if (!data[i]) {
                                    data[i] = getEmptyHeaderRow();
                                }
                                data[i][originalField] = {
                                    rowspan: rowspan - i,
                                    isRowspanedByRow: true,
                                    rowspanedByRow: headerLevel,
                                    count: singleColDef.count
                                };
                            }
                        }
                    }

                    return [_name];
                } else {
                    if (!data[headerLevel]) {
                        data[headerLevel] = getEmptyHeaderRow();
                    }

                    var colspan = insertedColumnNames.length - 1;

                    var _columnName = topGroupCollapsed && singleColDef.collapsedHeaderName && singleColDef.collapsedHeaderName.length ? singleColDef.collapsedHeaderName : singleColDef.headerName || '';

                    data[headerLevel][insertedColumnNames[0]] = {
                        colspan: colspan,
                        value: _columnName,
                        properties: {
                            ignoreValuePrefix: false
                        },
                        count: singleColDef.count,
                        childColumnDefs: singleColDef.children,
                        groupId: singleColDef.groupId,
                        columnOpenByDefault: singleColDef.openByDefault,
                        columnGroupShow: singleColDef.columnGroupShow
                    };

                    for (var _i = 1; _i < insertedColumnNames.length; _i++) {
                        data[headerLevel][insertedColumnNames[_i]] = {
                            colspan: colspan - _i,
                            isColspanedByColumn: true,
                            colspanedByColumn: insertedColumnNames[0],
                            count: singleColDef.count,
                            childColumnDefs: singleColDef.children,
                            groupId: singleColDef.groupId,
                            columnOpenByDefault: singleColDef.openByDefault,
                            columnGroupShow: singleColDef.columnGroupShow
                        };
                    }

                    return insertedColumnNames;
                }
            } else {
                var _originalField = singleColDef.field;
                var _name2 = _originalField || letter;

                schema.push(schemaMapper(letter || '', _name2));
                schemaColumnsCount++;

                if (_originalField) {
                    if (!data[headerLevel]) {
                        data[headerLevel] = getEmptyHeaderRow();
                    }
                    var _rowspan = maxTreeLevel - headerLevel - 1;
                    var _columnName2 = topGroupCollapsed && singleColDef.collapsedHeaderName && singleColDef.collapsedHeaderName.length ? singleColDef.collapsedHeaderName : singleColDef.headerName || '';
                    data[headerLevel][_originalField] = {
                        rowspan: _rowspan,
                        value: _columnName2,
                        count: singleColDef.count
                    };
                    for (var _i2 = headerLevel + 1, it = 1; _i2 < maxTreeLevel; _i2++, it++) {
                        if (!data[_i2]) {
                            data[_i2] = getEmptyHeaderRow();
                        }
                        data[_i2][_originalField] = {
                            rowspan: _rowspan - _i2,
                            isRowspanedByRow: true,
                            rowspanedByRow: headerLevel,
                            count: singleColDef.count
                        };
                    }
                }
                return [_name2];
            }
        } else {
            schema.push({
                header: letter || '',
                name: letter,
                maxWidth: maximumColumnWidth,
                format: name,
                cellContextMenu: getContextMenuItems
            });
            schemaColumnsCount++;
            return [letter];
        }
    }

    if (this.behavior.dataModel.isTree()){
        colDefMapper([], true);
    }

    colDefs.forEach(function (singleColDef) {
        return colDefMapper(singleColDef);
    });

    if (schemaColumnsCount < az.length) {
        for (var i = schemaColumnsCount; i < az.length; ++i) {
            colDefMapper();
        }
    }

    return { schema: schema, data: data, fictiveHeaderRowsCount: maxTreeLevel };
}

// function getOpenLinkFunc(link) {
//     return function() {
//         window.open(link, '_blank');
//     };
// }

// api methods

var rowModel = {
    virtualPageCache: {
        updateHeightForAllRows: function updateHeightForAllRows() {}
    },
    setExpanded: function setExpanded(id, expanded) {}
};

var rangeController = {
    allRowsSelected: false,
    selectedCols: [],
    refreshBorders: function refreshBorders() {},
    selectAll: function selectAll() {}
};

var gridPanel = {
    resetVerticalScrollPosition: function resetVerticalScrollPosition() {
        this.log('resetVerticalScrollPosition');
        this.vScrollValue = 0;
    },
    setVerticalScrollPosition: function setVerticalScrollPosition(value) {
        this.log('setVerticalScrollPosition');
        this.vScrollValue = value;
    },
    getVerticalScrollPosition: function getVerticalScrollPosition() {
        this.log('getVerticalScrollPosition');
        return this.vScrollValue;
    },
    resetHorizontalScrollPosition: function resetHorizontalScrollPosition() {
        this.log('resetHorizontalScrollPosition');
        this.hScrollValue = 0;
    },
    setHorizontalScrollPosition: function setHorizontalScrollPosition(value) {
        this.log('setHorizontalScrollPosition');
        this.hScrollValue = value;
    },
    getHorizontalScrollPosition: function getHorizontalScrollPosition() {
        this.log('getHorizontalScrollPosition');
        return this.hScrollValue;
    }
};

var columnController = {
    getAllGridColumns: function getAllGridColumns() {
        this.log('getAllGridColumns');
        return this.getActiveColumns();
    },
    updateDisplayedColumns: function updateDisplayedColumns() {
        this.log('updateDisplayedColumns');
    }
};

var floatingRowModel = {
    floatingTopRows: [],
    flattenStage: {
        execute: function execute(rootNode) {
            this.log(rootNode);
        }
    },
    setExpanded: function setExpanded(id, expanded) {
        this.log(id, expanded);
    }
};

var virtualPageRowModel = {
    virtualPageCache: {
        updateAllRowTopFromIndexes: function updateAllRowTopFromIndexes() {
            this.log('updateAllRowTopFromIndexes');
        }
    },
    getRow: function getRow(rowIndex, dontCreatePage) {
        this.log('getRow', rowIndex, dontCreatePage);
    }
};

function getVisibleColDefs(colDefs) {
    var res = colDefs.filter(function (cd) {
        return !cd.isHidden;
    });

    res.filter(function (cd) {
        return cd.children;
    }).forEach(function (cd) {
        cd.children = getVisibleColDefs(cd.children);
    });

    return res;
}

function setColumnDefs(colDefs) {

    // Always fetch data
    this.behavior.dataModel._dirty = true;

    var _this = this;
    //console.log('setColumnDefs', colDefs);

    let fs_selections = [];

    if (this.behavior.dataModel._viewer !== undefined && this.behavior.dataModel._viewer
      && this.behavior.dataModel._viewer._show_grid_data){
      const is_row_pivot = this.behavior.dataModel.isRowPivot();
      const is_column_pivot = this.behavior.dataModel.isColumnPivot();
      const is_flat_pivot = this.behavior.dataModel._viewer.is_flat_pivot();
      const value_position = this.behavior.dataModel.get_colpivot_value_position();
      const is_stack_header = this.behavior.dataModel.isStackHeader();

      let container;
      if (is_row_pivot && !is_flat_pivot){
        container = "row_pivots";
      }else if(!is_row_pivot && is_column_pivot && !is_flat_pivot && value_position === -1){
        container = "column_pivots";
      }

      // Hide [name] Total or similar columns
      if (colDefs && is_stack_header){
        colDefs.forEach((v)=>{
          if (v.is_out_of_tree_col === true && v.stack_values){
            let is_tree_index = v.stack_values.findIndex((sv)=>sv.is_tree === false && sv.hide_when_not_tree === true);
            if (is_tree_index !== -1 && !v.isHidden){
              v.isHidden = true;
            }
          }
        });
      }

      fs_selections = this.behavior.dataModel._viewer.get_fsort_selections(container);

      // Rows pivot and Nested mode
      //if (is_row_pivot && !is_flat_pivot){
      if (container){
        let is_sort = false;
        let sort_order;
        let is_filter = false;

        for (let fs_c of fs_selections){
          if (fs_c.name){
            if (fs_c.is_sort === true){
              is_sort = true;
              sort_order = fs_c.sort_order;
            }
            if (fs_c.is_filter === true){
              is_filter = true;
            }

          }
        }

        if (is_sort === true || is_filter === true){
          const f_index = colDefs.findIndex((v)=>{
            return v.originalName === "__ROW_PATH__";
          });

          if (f_index !== -1){
            if (is_sort === true){
              colDefs[f_index].is_sort = is_sort;
              colDefs[f_index].sort_order = sort_order;
            }

            if (is_filter === true){
              colDefs[f_index].is_filter = is_filter;
            }
          }
        }

        // The following things are to handle Col Labels in the 2nd column
        let fs_col_label_selections = [];
        const contains_both_row_and_col_labels = this.behavior.dataModel.contains_both_row_and_col_labels();

        if (contains_both_row_and_col_labels){
          fs_col_label_selections = this.behavior.dataModel._viewer.get_fsort_selections("column_pivots");

          let is_sort_in_col_label = false;
          let sort_order_in_col_label;
          let is_filter_in_col_label = false;

          for (let fs_c of fs_col_label_selections){
            if (fs_c.name){
              if (fs_c.is_sort === true){
                is_sort_in_col_label = true;
                sort_order_in_col_label = fs_c.sort_order;
              }
              if (fs_c.is_filter === true){
                is_filter_in_col_label = true;
              }

            }
          }

          if (is_sort_in_col_label === true || is_filter_in_col_label === true){
            const f_index = colDefs.findIndex((v)=>{
              return v.originalName === "__ROW_PATH__";
            });

            if (f_index !== -1){
              if (is_sort_in_col_label === true){
                colDefs[f_index].is_sort_in_col_label = is_sort_in_col_label;
                colDefs[f_index].sort_order_in_col_label = sort_order_in_col_label;
              }

              if (is_filter_in_col_label === true){
                colDefs[f_index].is_filter_in_col_label = is_filter_in_col_label;
              }
            }
          }

        }

      }else{ // Default
        for (let fs_c of fs_selections){
          if (fs_c.name){
            const f_index = colDefs.findIndex((v)=>{
              return v.originalName === fs_c.name;
            });

            if (f_index !== -1){
              if (fs_c.is_sort){
                colDefs[f_index].is_sort = fs_c.is_sort;
                colDefs[f_index].sort_order = fs_c.sort_order;

                if (fs_c.nb_sort !== undefined){
                  colDefs[f_index].nb_sort = fs_c.nb_sort;
                }
              }
              if (fs_c.is_filter){
                colDefs[f_index].is_filter = fs_c.is_filter;
              }

            }
          }
        }
      }
    }

    this.columnDefs = colDefs;
    this.visibleColumnDefs = getVisibleColDefs(this.columnDefs);

    var schema = convertColDefs.call(this, this.visibleColumnDefs);
    //console.log('schema', schema);
    //var firstRowsData = schema.data;
    /*
    var fixedRowsData = undefined;
    var is_stack_header = this.behavior.dataModel.isStackHeader();
    var is_stackheader_with_flat_pivot = this.behavior.dataModel.isStackHeaderWithFlatPivot();

    if (is_stack_header){
        fixedRowsData = getFixedRowsData.call(this);
    }else{
        fixedRowsData = schema.data;
    }
    */
    const fixedRowsData = getFixedRowsData.call(this);

    var data = this.behavior.getData();


    if (this.getMainMenuItems) {
        this.behavior.grid.properties.headerContextMenu = this.getMainMenuItems;
    }

    // create first row from headers
    if (this.behavior.grid.properties.useHeaders) {
        if (!data || data.length === 0) {
            data = [].concat(_toConsumableArray(fixedRowsData));
        } else {
            if (schema.fictiveHeaderRowsCount < this.behavior.grid.properties.fictiveHeaderRowsCount) {
                var diff = this.behavior.grid.properties.fictiveHeaderRowsCount - schema.fictiveHeaderRowsCount;
                data.splice(schema.fictiveHeaderRowsCount - 1, diff);
            }
            this.behavior.grid.properties.fictiveHeaderRowsCount = schema.fictiveHeaderRowsCount;
            fixedRowsData.forEach(function (d, i) {
                if (!equal(data[0], d)) {
                    if (_this.behavior.getRowProperties(i) && _this.behavior.getRowProperties(i).headerRow) {
                        data[i] = d;
                    } else {
                        data.splice(i, 0, d);
                    }
                }
            });
        }
        this.api.needColumnsToFit = true;
    }

    this.log('schema.schema', schema.schema);

    this.behavior.setData({
        data: data,
        schema: schema.schema
    });
    this.allowEvents(true);
    // this.behavior.dataModel.setSchema(schema.schema); // Not useful, because behavior.setData calls setSchema()
    this.behavior.dataModel.set_schema_changes(true);
    if (this.behavior.dataModel.keepSelection()){
        this.behavior.dataModel.setKeepSelection(false);
        if (this.selectionModel.hasSelections()){
            var lastSelection = this.selectionModel.getLastSelection();
            if (lastSelection){
                this.setMouseDown(this.newPoint(lastSelection.firstSelectedCell.x, lastSelection.firstSelectedCell.y));
            }
        }
    }else{
        this.clearSelections();
    }
    this.clearCopyArea();
}

function getColumnDefAtIndex(inx){
    return this.columnDefs[inx];
}

function setRowData(rowData) {
    this.log('setRowData', rowData);

    // todo remove this in future
    if (rowData.length === 1000 && this.behavior.grid.properties.useHeaders) {
        rowData.pop();
    }

    this.data = rowData;

    this.setData({ data: rowData });
    this.behavior.buildFlatMode();

    if (this.columnDefs) {
        this.api.setColumnDefs(this.columnDefs);
    }
}

function sizeColumnsToFit() {
    this.log('sizeColumnsToFit');

    if (this.api.needColumnsToFit) {
        this.behavior.fitColumns();
        this.canvas.resize(false);
        this.addEventListener('fin-grid-rendered', function () {
            if (this.api.needColumnsToFit) {
                this.canvas.resizeNotification();
                this.api.needColumnsToFit = false;
            }
        }.bind(this));
    }
}

function destroy(total) {
    this.log('destroy', total);

    this.setHighlightText('');

    this.cancelEditing();

    this.sbPrevVScrollValue = null;
    this.sbPrevHScrollValue = null;
    this.hoverCell = null;
    this.scrollingNow = false;

    this.behavior.reset();
    this.selectionModel.reset();
    this.renderer.reset();

    this.api.rangeController.selectedCols = [];

    if (total || !this.isAlive()) {
        this.destroyScrollbars();
    } else {
        this.canvas.resize();
        this.behaviorChanged();
        this.refreshProperties();
        if (this.div) {
            this.initialize(this.div);
            this.canvas.start();
        }
    }

    this.behavior.grid.fireSyntheticApiDestroyCalled(total);
}

function getRangeSelections() {
    this.log('getRangeSelections');
    return this.getSelections();
}

function copySelectedRangeToClipboard(includeHeaders) {
    this.log('copySelectedRangeToClipboard', includeHeaders);
    this.copyIncludeHeaders = includeHeaders;
    document.execCommand('copy');
    delete this.copyIncludeHeaders;
}

// function addNewColumn() {
//     this.log('addNewColumn');
//     document.execCommand('add_new_column');
// }

function getSelectedColumns() {
    this.log('getSelectedColumns');
    return this.api.rangeController.selectedCols;
}

function getModel() {
    this.log('getModel');
    return {
        rowsToDisplay: [],
        getRow: function getRow() {
            this.log('getRow');
        }
    };
}

function applyProperties(newProps) {
    Object.assign(this.properties, newProps);
    this.repaint();
}

function showColumnMenu(show, appliedFilterColumn){
    this.properties.showAdditionalInfo = show;
    this.properties.appliedFilterColumn=appliedFilterColumn;
}

function refreshView() {
    this.log('refreshView');
    this.repaint();
}

function removeItems(rowNodes) {
    this.log('removeItems', rowNodes);
}

function insertItemsAtIndex(index, items) {
    this.log('insertItemsAtIndex', index, items);
}

function clearRangeSelection() {
    this.log('clearRangeSelection');
    this.clearSelections();
    this.repaint();
}

function clearFocusedCell() {
    this.log('clearFocusedCell');
    this.clearMostRecentSelection();
    this.repaint();
}

function getFloatingTopRowData() {
    this.log('getFloatingTopRowData');
}

function getFloatingTopRowCount() {
    this.log('getFloatingTopRowCount');
}

function showNoRowsOverlay() {
    this.log('showNoRowsOverlay');
}

function hideOverlay() {
    this.log('hideOverlay');
}

function refreshCells(rowNodes, colIds, animate) {
    this.log('refreshCells', rowNodes, colIds, animate);
}

function setDatasource(datasource) {
    var _this2 = this;

    this.log('setDatasource', datasource);
    this.api.datasource = datasource;

    this.setHighlightText(datasource.search || '');

    var startRow = this.data.length || 0;

    if (startRow < datasource.totalSize || startRow === 0) {
        var params = {
            startRow: startRow, // replace with correct getter
            endRow: startRow + this.paginationPageSize, // replace with correct getter
            successCallback: function successCallback(rows, lastRowIndex) {
                _this2.log('successCallback', rows, lastRowIndex);

                // todo remove this in future
                if (startRow === 0 && rows.length === 1000) {
                    rows.pop();
                }

                [].push.apply(_this2.data, rows);
                _this2.addData({ data: rows });
                _this2.behavior.buildFlatMode();
            },
            failCallback: function failCallback() {
                this.log('failCallback');
                this.addData({ data: [] });
            },
            sortModel: datasource.sortModel,
            filterModel: {},
            context: undefined
        };

        datasource.getRows(params);
    }
}

function onGroupExpandedOrCollapsed(refreshFromIndex) {
    this.log('onGroupExpandedOrCollapsed', refreshFromIndex);
}

function getSortModel() {
    this.log('getSortModel');
    return [];
}

function doLayout() {
    // this.log('doLayout');
}

function refreshInMemoryRowModel() {
    this.log('refreshInMemoryRowModel');
}

function attachLinkToDataCell(x, y, link) {
    this.behavior.setCellProperty(x, y, 'link', link);
}

function registerCellEditedEventListener(callback) {
    console.log('===========fin-after-cell-edit');
    this.addInternalEventListener('fin-after-cell-edit', callback);
}

function addHeaderRow(data, start_col=undefined, end_col=undefined) {
    this.visibleColumnDefs = getVisibleColDefs(this.columnDefs);
    var schema = convertColDefs.call(this, this.visibleColumnDefs);
    var firstRowsData = [];
    if (start_col !== undefined && end_col !== undefined){
        // Need to improve this case
        //firstRowsData = schema.data.filter((v, i)=>{return (i >= start_col && i < end_col); });
        firstRowsData = schema.data;
    }else{
        firstRowsData = schema.data;
    }

    // create first row from headers
    if (this.behavior.grid.properties.useHeaders) {
        if (!data || data.length === 0) {
            data = [].concat(_toConsumableArray(firstRowsData));
        } else {
            if (schema.fictiveHeaderRowsCount < this.behavior.grid.properties.fictiveHeaderRowsCount) {
                var diff = this.behavior.grid.properties.fictiveHeaderRowsCount - schema.fictiveHeaderRowsCount;
                data.splice(schema.fictiveHeaderRowsCount - 1, diff);
            }
            this.behavior.grid.properties.fictiveHeaderRowsCount = schema.fictiveHeaderRowsCount;
            firstRowsData.forEach(function (d, i) {
                data.splice(i, 0, d);
            });
        }
    }
}

function addFixedRowsData(data, start_col=undefined, end_col=undefined) {
    this.visibleColumnDefs = getVisibleColDefs(this.columnDefs);
    var schema = convertColDefs.call(this, this.visibleColumnDefs);
    var is_stack_header = this.behavior.dataModel.isStackHeader();
    var is_stackheader_with_flat_pivot = this.behavior.dataModel.isStackHeaderWithFlatPivot();

    /*
    var fixedRowsData = [];
    if (is_stack_header){
        fixedRowsData = getFixedRowsData.call(this);
    }else{
        fixedRowsData = schema.data;
    }
    */
    const fixedRowsData = getFixedRowsData.call(this);

    if (!data || data.length === 0) {
        data = [].concat(_toConsumableArray(fixedRowsData));
    } else {
        if (schema.fictiveHeaderRowsCount < this.behavior.grid.properties.fictiveHeaderRowsCount) {
            var diff = this.behavior.grid.properties.fictiveHeaderRowsCount - schema.fictiveHeaderRowsCount;
            data.splice(schema.fictiveHeaderRowsCount - 1, diff);
        }
        this.behavior.grid.properties.fictiveHeaderRowsCount = schema.fictiveHeaderRowsCount;
        fixedRowsData.forEach(function (d, i) {
            data.splice(i, 0, d);
        });
    }
}

function getNumHeaderRow() {
    this.visibleColumnDefs = getVisibleColDefs(this.columnDefs);
    var schema = convertColDefs.call(this, this.visibleColumnDefs);
    var firstRowsData = schema.data;

    // create first row from headers
    if (this.behavior.grid.properties.useHeaders) {
        return firstRowsData.length;
        //return this.behavior.grid.properties.fixedRowCount;
    } else {
        return 0;
    }
}

/*
 * Fetches Visible Column Defs.
 * The function returns only visible(not hidden) columns.
 */
function getVisibleColumnDefs() {
    return getVisibleColDefs(this.columnDefs);;
}

function getFirstRowsData() {
    this.visibleColumnDefs = getVisibleColDefs(this.columnDefs);
    var schema = convertColDefs.call(this, this.visibleColumnDefs);
    var firstRowsData = schema.data;

    // create first row from headers
    if (this.behavior.grid.properties.useHeaders) {
        return firstRowsData;
    } else {
        return [];
    }
}

function get_col_label_row_data(rows_data, col_filter_info){
  if (!rows_data || !Array.isArray(this.columnDefs)){
    return;
  }

  // Get the second column
  let first_col_name;
  let second_col_name;

  for (let ci = 0; ci < this.columnDefs.length; ci++){

    if (this.columnDefs[ci].isHidden === true){
      continue;
    }

    // First column
    if (first_col_name === undefined){
      first_col_name = this.columnDefs[ci].originalName;
      continue;
    }

    // Second column
    if (second_col_name === undefined){
      second_col_name = this.columnDefs[ci].originalName;
      break;
    }
  }

  // Get quick sort and filer info
  let is_sort = false;
  let is_filter = false;
  let sort_order;
  const rowpath_col_index = this.columnDefs.findIndex((v)=>v.originalName === "__ROW_PATH__");
  if (rowpath_col_index !== -1){
    is_sort = this.columnDefs[rowpath_col_index].is_sort_in_col_label;
    is_filter = this.columnDefs[rowpath_col_index].is_filter_in_col_label;
    sort_order = this.columnDefs[rowpath_col_index].sort_order_in_col_label;
  }

  let col_lable_row_data = {};
  if (this.behavior.dataModel.contains_both_row_and_col_labels()){
    const str_col_labels = this.behavior.dataModel.col_labels_text();
    for (let col_label_row_key in rows_data){
      if (rows_data.hasOwnProperty(col_label_row_key)) {

        col_lable_row_data[col_label_row_key] = {rowspan: 0, value: "", count: undefined};

        if (col_label_row_key.indexOf("{") === -1){
          // Ignore META key
          continue;
        }

        let key_obj = JSON.parse(col_label_row_key);

        // Second column that needs to show Col Labels
        if (key_obj.columnName !== "__ROW_PATH__" && key_obj.columnName === second_col_name /*key_obj.index === 0*/){
          col_lable_row_data[col_label_row_key]["value"] = {
              rollup: str_col_labels,
              rowPath: [str_col_labels],
              isLeaf: true,
              outside_of_tree: false,
              max_depth: 1,
              contains_out_of_tree: false,
              always_expand: false,
              is_tree: true,
              always_collapse_icon: false,
              contains_quick_icon: true,
              is_sort: is_sort,
              is_filter: is_filter,
              sort_order: sort_order,
              is_col_label_cell: true
          };
        }
      }
    }
  }

  if (!col_lable_row_data || Object.keys(col_lable_row_data).length === 0){
    return;
  }

  return col_lable_row_data;

}

function getFixedRowsData() {
    this.visibleColumnDefs = getVisibleColDefs(this.columnDefs);
    var schema = convertColDefs.call(this, this.visibleColumnDefs);
    //var fixedRowsData = schema.data;

    // create the stacked header rows from header
    if (this.behavior.grid.properties.useHeaders) {
        var is_stack_header = this.behavior.dataModel.isStackHeader();
        var is_stackheader_with_flat_pivot = this.behavior.dataModel.isStackHeaderWithFlatPivot();

        var col_depth = this.behavior.dataModel.getColDepth();
        var contains_values_in_first = this.behavior.dataModel.contains_colpivot_value_in_first();
        var contains_values_in_middle = this.behavior.dataModel.contains_colpivot_value_in_middle();
        var contains_values_in_last = this.behavior.dataModel.contains_colpivot_value_in_last();

        const is_row_pivot = this.behavior.dataModel.isRowPivot();
        const is_column_pivot = this.behavior.dataModel.isColumnPivot();
        let cocn_in_row_pivots = false;
        if (is_row_pivot === true){
          cocn_in_row_pivots = this.behavior.dataModel.contains_only_combined_name_in_row_pivots();
        }
        if (!is_stack_header){

            // Empty grid
            if (this.behavior.dataModel._viewer === undefined || !this.behavior.dataModel._viewer
              || !this.behavior.dataModel._viewer._show_grid_data){
              return schema.data;
            }

            const is_value_pivot = this.behavior.dataModel.is_value_pivot();
            const is_flat_pivot = this.behavior.dataModel._viewer.is_flat_pivot();
            const row_pivots = this.behavior.dataModel.getRowPivots();

            const rowsData = schema.data[0];
            let rowData = {};
            for (var key in rowsData) {
                if (rowsData.hasOwnProperty(key)) {
                  rowData[key] = Object.assign({}, rowsData[key]);

                  if (key === "__META"){
                    continue;
                  }
                  const value = rowData[key]["value"];

                  // Rows Aggregations with flat mode
                  let contains_quick_icon = false;
                  if (is_row_pivot && is_flat_pivot){
                    const key_to_obj = JSON.parse(key);
                    if (key_to_obj && key_to_obj.index < row_pivots.length && row_pivots.includes(key_to_obj.columnName)){
                      contains_quick_icon = true;
                    }
                  }

                  if ((!is_row_pivot && !is_column_pivot && !is_value_pivot) // Default
                    || (is_row_pivot && key.indexOf("__ROW_PATH__") !== -1) // Row Labels
                    //|| (!is_row_pivot && is_column_pivot && !is_flat_pivot && key.indexOf("__ROW_PATH__") !== -1) // Col Labels
                    || (is_column_pivot && key.indexOf("__ROW_PATH__") !== -1) // Col Labels
                    || contains_quick_icon // Rows Aggregations with flat mode
                  ){
                    const col_index = this.visibleColumnDefs.findIndex((v)=>v.field === key);

                    rowData[key]["value"] = {
                        rollup: value,
                        rowPath: [value],
                        isLeaf: true,
                        outside_of_tree: false,
                        max_depth: 1,
                        contains_out_of_tree: false,
                        always_expand: false,
                        is_tree: true,
                        always_collapse_icon: false,
                        contains_quick_icon: (is_row_pivot && key.indexOf("__ROW_PATH__") !== -1 && cocn_in_row_pivots === true) ? false: true, //Row Labels,
                        is_sort: col_index !== -1 ? this.visibleColumnDefs[col_index].is_sort: false,
                        is_filter: col_index !== -1 ? this.visibleColumnDefs[col_index].is_filter: false,
                        sort_order: col_index !== -1 ? this.visibleColumnDefs[col_index].sort_order: undefined,
                        nb_sort: col_index !== -1 ? this.visibleColumnDefs[col_index].nb_sort: undefined
                    };
                  }
                }
            }

            //return [rowData]; // schema.data;

            let col_lable_row_data;
            if (this.behavior.dataModel.contains_both_row_and_col_labels()){
              col_lable_row_data = get_col_label_row_data.call(this, schema.data[0]);
            }

            if (col_lable_row_data && Object.keys(col_lable_row_data).length > 0){

              // Contains the Col Labels in the second column
              return [col_lable_row_data, rowData];
            }else{
              // Default
              return [rowData];
            }
        }else if(is_stackheader_with_flat_pivot){
            return schema.data;
        }else{
            var fixedRowsData = [];
            const rowsData = schema.data[0];
            var _this = this;
            const is_flat_pivot = this.behavior.dataModel._viewer ? this.behavior.dataModel._viewer.is_flat_pivot(): false;
            const value_position = this.behavior.dataModel.get_colpivot_value_position();

            for (var i=0; i<col_depth; i++){
                var rowData = {};
                var parent_path = undefined;
                var current_path = undefined;
                for (var key in rowsData) {
                    if (rowsData.hasOwnProperty(key)) {
                        var stack_columns = rowsData[key]["value"] !== undefined ? rowsData[key]["value"].split("|") : [];

                        rowData[key] = Object.assign({}, rowsData[key]);

                        var is_tree = false;
                        var stack_values = [];
                        var col_index = this.visibleColumnDefs.findIndex((v)=>v.field === key);
                        if (col_index != -1){
                            stack_values = this.visibleColumnDefs[col_index].stack_values;
                        }/*else{
                            col_index = this.columnDefs.findIndex((v)=>v.field === key);
                            if (col_index != -1){
                                stack_values = this.columnDefs[col_index].stack_values;
                            }
                        }
                        */
                        var always_collapse_icon = false;
                        var value = undefined;
                        var alias;
                        if (stack_values && stack_values.length > 0){
                            var stack_value_index = stack_values.findIndex((v)=>v.row_index === i);
                            if (stack_value_index != -1){
                                is_tree = stack_values[stack_value_index].is_tree || is_tree;
                                //value = is_tree ? stack_values[stack_value_index].tree_value || stack_values[stack_value_index].value : stack_values[stack_value_index].value;
                                value = stack_values[stack_value_index].value;
                                alias = stack_values[stack_value_index].alias;
                                always_collapse_icon = stack_values[stack_value_index].always_collapse_icon || always_collapse_icon;

                                for (var j=0; j<stack_values.length; j++){
                                    //var m_values = stack_values[stack_value_index].mapping_values;
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
                                                    var f_col_index = _this.visibleColumnDefs.findIndex((f)=>f.originalName === v.condition.column_name);
                                                    if (f_col_index != -1){
                                                        f_stack_values = _this.visibleColumnDefs[f_col_index].stack_values;
                                                    }else{
                                                        f_col_index = _this.columnDefs.findIndex((f)=>f.originalName === v.condition.column_name);
                                                        if (f_col_index != -1){
                                                            f_stack_values = _this.columnDefs[f_col_index].stack_values;
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
                                                var m_i = m_values[m_value_index].values.findIndex((v)=>v.row_index === i);
                                                if (m_i != -1){
                                                    value = m_values[m_value_index].values[m_i].value != undefined
                                                          ? m_values[m_value_index].values[m_i].value
                                                          : value;
                                                    alias = m_values[m_value_index].values[m_i].alias;
                                                    if (m_values[m_value_index].values[m_i].is_tree !== undefined && m_values[m_value_index].values[m_i].is_tree === true){
                                                        is_tree = true;
                                                    }
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }


                            }
                        }

                        value = value || "";

                        if (is_tree){
                            rowData[key]["value"] = {
                                rollup: alias || value,
                                rowPath: [value],
                                isLeaf: false,
                                outside_of_tree: false,
                                max_depth: 1,
                                contains_out_of_tree: false,
                                always_expand: false,
                                is_tree: true,
                                always_collapse_icon: always_collapse_icon
                            };

                        }else{
                            if (i == col_depth -1 && key && key.indexOf("__ROW_PATH__") != -1 && (is_row_pivot || (!is_row_pivot && is_column_pivot && !is_flat_pivot && value_position == -1))){
                              rowData[key]["value"] = {
                                  rollup: alias || value,
                                  rowPath: [value],
                                  isLeaf: true,
                                  outside_of_tree: false,
                                  max_depth: 1,
                                  contains_out_of_tree: false,
                                  always_expand: false,
                                  is_tree: true,
                                  always_collapse_icon: false,
                                  contains_quick_icon: (is_row_pivot && key.indexOf("__ROW_PATH__") !== -1 && cocn_in_row_pivots === true) ? false: true, // Row Labels
                                  is_sort: col_index !== -1 ? this.visibleColumnDefs[col_index].is_sort: false,
                                  is_filter: col_index !== -1 ? this.visibleColumnDefs[col_index].is_filter: false,
                                  sort_order: col_index !== -1 ? this.visibleColumnDefs[col_index].sort_order: undefined
                              };
                            }else{
                              rowData[key]["value"] = alias || value;
                            }

                        }

                    }
                }

                fixedRowsData.push(rowData);
            }

            if (this.behavior.dataModel.contains_both_row_and_col_labels()){
              /*
              const str_col_labels = this.behavior.dataModel.col_labels_text();
              let col_lable_row_data = {};
              for (let col_label_row_key in fixedRowsData[0]){
                if (fixedRowsData[0].hasOwnProperty(col_label_row_key)) {

                  col_lable_row_data[col_label_row_key] = {rowspan: 0, value: "", count: undefined};

                  if (col_label_row_key.indexOf("{") === -1){
                    // Ignore META key
                    continue;
                  }

                  let key_obj = JSON.parse(col_label_row_key);

                  // Second column that needs to show Col Labels
                  if (key_obj.columnName !== "__ROW_PATH__" && key_obj.index === 0){
                    col_lable_row_data[col_label_row_key]["value"] = {
                        rollup: str_col_labels,
                        rowPath: [str_col_labels],
                        isLeaf: true,
                        outside_of_tree: false,
                        max_depth: 1,
                        contains_out_of_tree: false,
                        always_expand: false,
                        is_tree: true,
                        always_collapse_icon: false,
                        contains_quick_icon: true,
                        is_sort: false,//col_index !== -1 ? this.visibleColumnDefs[col_index].is_sort: false,
                        is_filter: false,//col_index !== -1 ? this.visibleColumnDefs[col_index].is_filter: false,
                        sort_order: undefined, //col_index !== -1 ? this.visibleColumnDefs[col_index].sort_order: undefined
                        is_col_label_cell: true
                    };
                  }
                }
              }

              fixedRowsData.unshift(col_lable_row_data);
              */
              let col_lable_row_data;
              if (this.behavior.dataModel.contains_both_row_and_col_labels()){
                col_lable_row_data = get_col_label_row_data.call(this, schema.data[0]);
              }

              if (col_lable_row_data && Object.keys(col_lable_row_data).length > 0){
                fixedRowsData.unshift(col_lable_row_data);
              }
            }

            return fixedRowsData;
        }

    } else {
        return [];
    }
}

function setColumnErrors() {
    this.behavior.getActiveColumns().forEach(column => {
        if (column.colDef && column.colDef.hasError) {
            var colDef = column.colDef;
            column.hasError = colDef.hasError;
            column.errorCount = colDef.errorCount;
            column.firstError = colDef.firstError;
        }
    });
}

function getCustomCellRenderer() {
    return function(params) {
        let content = params.value;

        if(_.isObject(content) && content.type === 'ERROR'){
            content = 'Ø';
        }

        return content;
    };
}

function buildColumnDef(columnName, index, type, dname, original_index, default_width, stack_columns, stack_aliases, user_width, computed_expression){
    var align = 'right';
    switch (type) {
        case 'list_boolean':
        case 'list_string':
        case 'list_integer':
        case 'list_date':
        case 'list_datetime':
        case 'list_float':
        case 'list_duration':
        case 'string':
            align = 'left';
            break;
        case 'boolean':
            align = 'center';
            break;
    }
    var isTree = columnName === "__ROW_PATH__";
    //var headerName = isTree ? 'Row/Col Labels' : columnName;
    //var headerName = isTree ? 'Row/Col Labels' : ( dname || columnName );
    var headerName = isTree ? this.behavior.dataModel.getRowColLevelText() : ( dname || columnName );

    // Some items will be removed in the future
    return {
        colId: index + '',
        field: JSON.stringify({"type": type, "columnName": columnName, "index": index}),
        headerName: headerName,
        originalName: columnName,
        isHidden: false,
        suppressSorting: true,
        errorCount: 0,
        firstError: null,
        colType: type,
        colTypeSign: "",
        isList: false,
        suppressSizeToFit: true,
        minWidth: 10,
        maxWidth: 2000,
        suppressMenu: true,
        cellRenderer: getCustomCellRenderer(),
        halign: align,
        menuTabs: ["filterMenuTab", "generalMenuTab", "columnsMenuTab"],
        isTree: isTree,
        original_index: original_index,
        default_width: default_width,
        stack_columns: stack_columns || [],
        stack_values: [],
        stack_aliases: stack_aliases || [],
        user_width: user_width,
        computed_expression: computed_expression
    }

}

function buildColumnDefs(c_info) {
    var colDefs = [];
    var rowPathInx = 0;

    if (!c_info || c_info.length < 1){
        c_info = [];
    }

    // Active columns only
    var c_items = c_info.filter(function(item){
        return item.active === true;
    }).sort(function(a, b){return a.index - b.index});

    c_items.forEach((item, i)=>{
        colDefs.push(buildColumnDef.call(this, item.name, i - rowPathInx, item.type, item.dname, item.original_index, item.user_width || item.default_width, undefined, undefined, item.user_width, item.computed_expression));
        if (item.name === "__ROW_PATH__"){
            rowPathInx = 1;
        }
    });

    return colDefs;
}

function _merge_stack_values(base_coldefs, compare_coldefs){

  /*
  Example 1
  [{
    row_index: 0,
    value: "x",
    cols: ["x|count of Row|good", "x|count of Row|great", "x|count of Row|thanks", "x|sum of HeaderB|good", "x|sum of HeaderB|great", "x|sum of HeaderB|thanks"],
    is_tree: true,
    is_expanded: true,
    col_ref: "x|count of Row",
    out_of_tree_children: ["x|count of Row", "x|sum of HeaderB"],
    is_col_total: false,
  }]

  Example 2
  [{
    row_index: 0,
    value: "x count of Row",
    cols: ["x|count of Row|good", "x|count of Row|great", "x|count of Row|thanks", "x|sum of HeaderB|good", "x|sum of HeaderB|great", "x|sum of HeaderB|thanks"],
    is_tree: false,
    mapping_values: [
      {
        values: [
          {row_index: 0, value: "x"},
          {row_index: 2, value: "count of Row"},
        ],
        condition: {row_index: 0, is_tree: true, is_col_total: true}
      }
    ],
    always_collapse_icon: true
  }]
  */
  base_coldefs.forEach((vc, vi)=>{

    // Update the changes but keeping the current stackheaders that are collasped or expanded
    if (compare_coldefs[vi] && vc.originalName === compare_coldefs[vi].originalName
      && vc.stack_values && vc.stack_values.length > 0
      && compare_coldefs[vi].stack_values && compare_coldefs[vi].stack_values.length === vc.stack_values.length){
      for (let j = 0; j < vc.stack_values.length; j++){

        if (vc.stack_values[j].row_index !== compare_coldefs[vi].stack_values[j].row_index){
          // Something is not right
          continue;
        }

        // Value of the stack_values
        vc.stack_values[j].value = compare_coldefs[vi].stack_values[j].value;
        vc.stack_values[j].alias = compare_coldefs[vi].stack_values[j].alias;

        // Cols of the stack_values
        vc.stack_values[j].cols = compare_coldefs[vi].stack_values[j].cols;

        // Col_ref of the stack_values
        if (vc.stack_values[j].col_ref && compare_coldefs[vi].stack_values[j].col_ref){
          vc.stack_values[j].col_ref = compare_coldefs[vi].stack_values[j].col_ref;
        }

        // Out of children
        if (vc.stack_values[j].out_of_tree_children && compare_coldefs[vi].stack_values[j].out_of_tree_children){
          vc.stack_values[j].out_of_tree_children = compare_coldefs[vi].stack_values[j].out_of_tree_children;
        }

        // Mapping values
        if (vc.stack_values[j].mapping_values && vc.stack_values[j].mapping_values.length > 0
          && compare_coldefs[vi].stack_values[j].mapping_values && compare_coldefs[vi].stack_values[j].mapping_values.length === vc.stack_values[j].mapping_values.length > 0){
          for (let mi = 0; mi < vc.stack_values[j].mapping_values.length; mi++){
            // The values of mapping_values
            if (vc.stack_values[j].mapping_values[mi].values && vc.stack_values[j].mapping_values[mi].values.length > 0
              && compare_coldefs[vi].stack_values[j].mapping_values[mi].values && compare_coldefs[vi].stack_values[j].mapping_values[mi].values.length === vc.stack_values[j].mapping_values[mi].values.length){
              for (let mvi = 0; mvi < vc.stack_values[j].mapping_values[mi].values.length; mvi++){

                if (vc.stack_values[j].mapping_values[mi].values[mvi].row_index !== compare_coldefs[vi].stack_values[j].mapping_values[mi].values[mvi].row_index){
                  // Someting is not right
                  continue;
                }

                // Value of the values of mapping_values
                vc.stack_values[j].mapping_values[mi].values[mvi].value = compare_coldefs[vi].stack_values[j].mapping_values[mi].values[mvi].value;
                vc.stack_values[j].mapping_values[mi].values[mvi].alias = compare_coldefs[vi].stack_values[j].mapping_values[mi].values[mvi].alias;
              }
            }
          }
        }
      }
    }

  });

  return base_coldefs;
}

function _createColDefs(colDefs, longest_text_cols, updates_name_only = false) {
    var is_stack_header = this.behavior.dataModel.isStackHeader();
    var is_stackheader_with_flat_pivot = this.behavior.dataModel.isStackHeaderWithFlatPivot();

    // Build group/deps columns
    if (is_stackheader_with_flat_pivot){
        var row_pivots = this.behavior.dataModel.getRowPivots();
        var pre_stack_columns = undefined;
        for (var ic=0; ic < colDefs.length; ic++) {
            if (ic < row_pivots.length){
                // Pass
            }else{
              var stack_columns = colDefs[ic].originalName.split("-");

              if (pre_stack_columns === undefined){

                  // Fist item. Pass
                  pre_stack_columns = stack_columns;
              }else if(stack_columns.length == 1 && colDefs[ic].originalName.toUpperCase() !== "TOTAL"){ // Level 1

                  // Level 1 (except total): name + Total
                  colDefs[ic].headerName = colDefs[ic].headerName + " Total";
                  pre_stack_columns = stack_columns;
              }else if(stack_columns.length > 1 && pre_stack_columns.length > stack_columns.length){ // Two levels or more
                  // Node: name + Total
                  colDefs[ic].headerName = colDefs[ic].headerName + " Total";
                  pre_stack_columns = stack_columns;
              }else{
                // Pass
                pre_stack_columns = stack_columns;
              }

            }
        }
    }else if (is_stack_header){
        var col_depth = this.behavior.dataModel.getColDepth();
        var contains_values_in_first = this.behavior.dataModel.contains_colpivot_value_in_first();
        var contains_values_in_middle = this.behavior.dataModel.contains_colpivot_value_in_middle();
        var contains_values_in_last = this.behavior.dataModel.contains_colpivot_value_in_last();
        var value_position = this.behavior.dataModel.get_colpivot_value_position();
        var value_position_in_rowpivots = this.behavior.dataModel.get_rowpivot_value_position();
        const is_flat_pivot = this.behavior.dataModel._viewer.is_flat_pivot();
        var row_pivots = this.behavior.dataModel.getRowPivots();
        var row_leaf_i = (value_position === col_depth -1 && col_depth - 2 >= 0) ? col_depth - 2 : col_depth -1;

        var col_pivots = this.behavior.dataModel.getColPivots();
        var r_pivots = this.behavior.dataModel._viewer.get_row_pivots(false);
        var c_pivots = this.behavior.dataModel._viewer.get_column_pivots(false);

        // Ignore last fixed row
        for (var i=0; i<col_depth; i++){

            var parent_path = undefined;
            var current_path = undefined;
            var group_columns = [];
            var group_parent_index = undefined;
            var parent_index = undefined;

            for (var ic=0; ic < colDefs.length; ic++) {
                var stack_columns = colDefs[ic].stack_columns || [];
                var stack_aliases = colDefs[ic].stack_aliases || [];

                //rowData[key] = Object.assign({}, rowsData[key]);

                if(colDefs[ic].field.indexOf("__ROW_PATH__") != -1){
                    //if (i != col_depth -1){
                    //    rowData[key]["value"] = "";
                    //}

                    // Leaf
                    if (i === col_depth -1){
                        //colDefs[ic].stack_values.push({row_index: i, value: "Row/Col Labels"});
                        colDefs[ic].stack_values.push({row_index: i, value: this.behavior.dataModel.getRowColLevelText()});
                    }else{
                        colDefs[ic].stack_values.push({row_index: i, value: ""});
                    }

                    parent_path = undefined;
                    current_path = undefined;
                    parent_index = undefined;
                }else{
                    current_path = stack_columns.filter((v, index)=>{
                        return index <= i;
                    }).join("|");
                    var is_tree = false;
                    var value = stack_columns[i] || "";
                    var alias = stack_aliases[i] || "";

                    // Total Column: Total + [Column Name]
                    if ((value_position == -1 && stack_columns.length == 1 && stack_columns[0] === "Total")
                        ||
                        (stack_columns.length == 2 && (
                            (value_position === 0 && stack_columns[1] === "Total")
                            ||
                            (value_position !== 0 && stack_columns[0] === "Total")))
                        ){
                        if (i === 0){
                            for (var ik = 0; ik < col_depth; ik++){
                                if (ik == i){
                                    // Add stack value item if not existed
                                    if (value_position == -1 && stack_columns.length == 1){
                                        value = stack_columns[0];
                                        alias = stack_aliases[0];
                                    }else if (value_position === 0){
                                        value = stack_columns[i + 1] + " " + stack_columns[i];
                                        alias = stack_aliases[i + 1] + " " + stack_aliases[i];
                                    }else{
                                        value = stack_columns[i] + " " + stack_columns[i + 1];
                                        alias = stack_aliases[i] + " " + stack_aliases[i + 1]
                                    }

                                    if (!(value_position == -1 && stack_columns.length == 1)
                                      && !updates_name_only){
                                        var col_name = colDefs[ic].originalName;
                                        var l_text = longest_text_cols != undefined && longest_text_cols[col_name] ? longest_text_cols[col_name]: "";
                                        var w = getDefaultColumnWidth.call(this, alias || value, l_text);
                                        colDefs[ic].default_width = w;
                                    }

                                }else{
                                    value = "";
                                    alias = "";
                                }

                                // Using to hide column in case it's alone
                                const is_grand_total = value ? true: false;

                                colDefs[ic].stack_values.push({row_index: ik, value: value, alias: alias, cols: [],
                                    is_tree: false, is_grand_total: is_grand_total});
                            }
                        }
                    }else if (i == col_depth -1){ // Leaf

                        // contains column in groupby list when the FLAT MODE is enabled
                        if(is_flat_pivot == true && stack_columns.length == 1
                            && stack_columns[0] === colDefs[ic].originalName
                            && row_pivots.includes(stack_columns[0])){
                            value = stack_columns[0];
                            alias = stack_aliases[0];
                            var iv = (colDefs[ic].stack_values || []).findIndex((v)=>v.row_index === i);
                            if (iv == -1){
                                colDefs[ic].stack_values.push({row_index: i, value: value, alias: alias, cols: [],
                                    is_tree: false});
                            }else{

                              // Update
                              colDefs[ic].stack_values[iv].value = value;
                              colDefs[ic].stack_values[iv].alias = alias;
                            }

                            group_columns = [];
                        }else{
                            group_columns.push(colDefs[ic].originalName);
                            var iv = (colDefs[ic].stack_values || []).findIndex((v)=>v.row_index === i);
                            if (iv == -1){
                                colDefs[ic].stack_values.push({row_index: i, value: value, alias: alias, cols: [],
                                    is_tree: is_tree});
                            }
                        }

                    }else if(stack_columns.length != col_depth
                        &&
                        (
                          (i < value_position && i == stack_columns.length -2) // stack_columns[i] + stack_columns[i +1]
                          ||
                          (i > value_position && i == stack_columns.length -1) // stack_columns[i] + Total
                        )){ // Total Column: [Column Name] + Total
                        var u_stack_value_index = -1;

                        if (group_columns.length > 0 && i !== row_leaf_i &&  i != value_position){
                            u_stack_value_index = colDefs[group_parent_index].stack_values.findIndex((v)=>v.row_index === i);
                            if (u_stack_value_index != -1){

                                // Not allow to overwrite column reference
                                if (!colDefs[group_parent_index].stack_values[u_stack_value_index].col_ref){
                                  colDefs[group_parent_index].stack_values[u_stack_value_index].cols = group_columns;
                                  colDefs[group_parent_index].stack_values[u_stack_value_index].is_expanded = true;
                                  colDefs[group_parent_index].stack_values[u_stack_value_index].is_tree = true;
                                  colDefs[group_parent_index].stack_values[u_stack_value_index].col_ref = colDefs[ic].originalName;
                                }
                            }
                        }

                        var first_child_in_out_of_tree = undefined;
                        var col_values = [];

                        // stack_columns[i] + Total
                        if (i > value_position){
                            for (var vi = 0; vi < stack_columns.length; vi++){
                                if (vi === i){
                                    col_values.push({row_index: vi, value: stack_columns[i], alias: stack_aliases[i]});
                                }else{
                                    if (u_stack_value_index != -1){
                                        var usvi = colDefs[group_parent_index].stack_values.findIndex((v)=>v.row_index === vi);
                                        if (usvi != -1){
                                            if (colDefs[group_parent_index].stack_values[usvi].is_tree === true){
                                                col_values.push({row_index: vi, value: colDefs[group_parent_index].stack_values[usvi].value,
                                                    alias: colDefs[group_parent_index].stack_values[usvi].alias,
                                                    cols: colDefs[group_parent_index].stack_values[usvi].cols,
                                                    is_tree: colDefs[group_parent_index].stack_values[usvi].is_tree,
                                                    col_ref: colDefs[group_parent_index].stack_values[usvi].col_ref,
                                                    belong_to_tree_row_index: i});
                                            }else{
                                                col_values.push({row_index: vi, value: colDefs[group_parent_index].stack_values[usvi].value, alias: colDefs[group_parent_index].stack_values[usvi].alias});
                                            }
                                        }
                                    }
                                }
                            }
                        }else if(i < value_position){ // stack_columns[i] + stack_columns[i +1]
                            for (var vi = 0; vi < col_depth; vi++){

                                // Last
                                if (vi == col_depth -1){
                                    col_values.push({row_index: vi, value: stack_columns[stack_columns.length -1], alias: stack_aliases[stack_aliases.length -1]});
                                }else if (vi === i && vi < stack_columns.length){
                                    if (parent_path == current_path && parent_index !== undefined && parent_index != -1){

                                        // Out of tree children
                                        var sv = colDefs[parent_index].stack_values || [];
                                        var sv_i = sv.findIndex((v)=>v.row_index === i && v.is_tree !== undefined && v.is_tree);
                                        if (sv_i != -1){
                                            if (colDefs[parent_index].stack_values[sv_i].out_of_tree_children == undefined){
                                                colDefs[parent_index].stack_values[sv_i].out_of_tree_children = [];
                                            }

                                            if (colDefs[parent_index].stack_values[sv_i].out_of_tree_children.length == 0){
                                                col_values.push({row_index: vi, value: stack_columns[i], alias: stack_aliases[i]});

                                            }else{
                                                first_child_in_out_of_tree = colDefs[parent_index].stack_values[sv_i].out_of_tree_children[0];

                                                // Not a first child in out of tree children
                                                col_values.push({row_index: vi, value: "", alias: ""});
                                            }

                                            // Add out of tree child
                                            colDefs[parent_index].stack_values[sv_i].out_of_tree_children.push(colDefs[ic].originalName);
                                        }else{
                                            col_values.push({row_index: vi, value: stack_columns[i], alias: stack_aliases[i]});
                                        }
                                    }else{
                                        col_values.push({row_index: vi, value: stack_columns[i], alias: stack_aliases[i]});
                                    }
                                }else{
                                    if (u_stack_value_index != -1){
                                        var usvi = colDefs[group_parent_index].stack_values.findIndex((v)=>v.row_index === vi);
                                        if (usvi != -1){

                                            // Find to get out of tree children and check if it's the first
                                            var ootc_usvi = colDefs[group_parent_index].stack_values.findIndex((v)=>v.row_index === i);
                                            var ootc = [];
                                            if (ootc_usvi != -1){
                                                ootc = colDefs[group_parent_index].stack_values[ootc_usvi].out_of_tree_children || []
                                            }

                                            if (colDefs[group_parent_index].stack_values[usvi].is_tree === true
                                              &&
                                                  (ootc.length == 0 || ootc.indexOf(colDefs[ic].originalName) === 0) // First child in list out of tree
                                              ){
                                                col_values.push({row_index: vi, value: colDefs[group_parent_index].stack_values[usvi].value,
                                                    alias: colDefs[group_parent_index].stack_values[usvi].alias,
                                                    cols: colDefs[group_parent_index].stack_values[usvi].cols,
                                                    is_tree: colDefs[group_parent_index].stack_values[usvi].is_tree,
                                                    col_ref: colDefs[group_parent_index].stack_values[usvi].col_ref,
                                                    belong_to_tree_row_index: i});
                                            }else{
                                                if (ootc.length == 0 || ootc.indexOf(colDefs[ic].originalName) === 0){
                                                    col_values.push({row_index: vi, value: colDefs[group_parent_index].stack_values[usvi].value, alias: colDefs[group_parent_index].stack_values[usvi].alias});
                                                }else{

                                                    // Empty value from second child to end
                                                    col_values.push({row_index: vi, value: "", alias: ""});
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        var mapping_values = [];
                        if (col_values.length > 0){
                            if (first_child_in_out_of_tree !== undefined){
                                mapping_values.push({values: col_values, condition: {row_index: i, is_tree: true, is_col_total: true, column_name: first_child_in_out_of_tree}});
                            }else{
                                mapping_values.push({values: col_values, condition: {row_index: i, is_tree: true, is_col_total: true}});
                            }

                        }

                        if (i < stack_columns.length && i !== row_leaf_i &&  i != value_position){

                            // Reset stack values
                            colDefs[ic].stack_values = [];

                            for (var ik = 0; ik < col_depth; ik++){
                                if (ik == i){
                                    // Add stack value item if not existed
                                    if (colDefs[ic].stack_values.findIndex((v)=>v.row_index === ik) == -1){

                                        // FLAT MODE
                                        if (is_flat_pivot == true && stack_columns.length == 1
                                            && stack_columns[0] === colDefs[ic].originalName && row_pivots.includes(stack_columns[0])){

                                            //if (i == col_depth -1){
                                            //    value = stack_columns[stack_columns.length -1];
                                            //}else{
                                            //    value = "";
                                            //}
                                            value = "";
                                            alias = "";
                                        }else if (i < value_position){
                                            value = stack_columns[i] + " " + stack_columns[i +1];
                                            alias = (stack_aliases[i] ? stack_aliases[i] : stack_columns[i]) + " " + (stack_aliases[i +1] ? stack_aliases[i +1] : stack_columns[i +1]);
                                            if (i < c_pivots.length){
                                              var subtotals = c_pivots[i].subtotals;
                                              colDefs[ic].subtotals = subtotals;
                                              if (subtotals !== null && subtotals !== undefined && subtotals === false){
                                                colDefs[ic]["isHidden"] = true;
                                              }
                                            }
                                        }else if (i > value_position){
                                            value = stack_columns[i] + " Total";
                                            alias = (stack_aliases[i] ? stack_aliases[i]: stack_columns[i]) + " Total";
                                            if (i < c_pivots.length){
                                              var subtotals = c_pivots[i].subtotals;
                                              colDefs[ic].subtotals = subtotals;
                                              if (subtotals !== null && subtotals !== undefined && subtotals === false){
                                                colDefs[ic]["isHidden"] = true;
                                              }
                                            }
                                        }else{
                                            value = "";
                                            alias = "";
                                        }
                                        //colDefs[ic].stack_values.push({row_index: ik, value: value, alias: alias, cols: group_columns,
                                        //    is_tree: is_tree,
                                        //    mapping_values: mapping_values,
                                        //    always_collapse_icon: true});

                                        let stack_value_obj = {row_index: ik, value: value, alias: alias, cols: group_columns,
                                            is_tree: is_tree,
                                            mapping_values: mapping_values,
                                            always_collapse_icon: true};

                                        // Need to move the hide_when_not_tree flag into the correct place where it shows the out of tree node
                                        if (colDefs[ic].hide_when_not_tree === true){
                                          stack_value_obj.hide_when_not_tree = colDefs[ic].hide_when_not_tree;
                                        }
                                        colDefs[ic].stack_values.push(stack_value_obj);

                                        colDefs[ic].is_out_of_tree_col = true;

                                        if (value != ""){
                                            var col_name = colDefs[ic].originalName;
                                            var l_text = longest_text_cols != undefined && longest_text_cols[col_name] ? longest_text_cols[col_name]: "";
                                            var w = getDefaultColumnWidth.call(this, alias || value, l_text);
                                            colDefs[ic].default_width = w;
                                        }
                                    }
                                }else{
                                    // Add stack value item if not existed
                                    if (colDefs[ic].stack_values.findIndex((v)=>v.row_index === ik) == -1){
                                        colDefs[ic].stack_values.push({row_index: ik, value: "", alias: "", cols: [],
                                            is_tree: is_tree});
                                    }
                                }

                            }
                        }else{
                            // Add stack value item if not existed
                            if (colDefs[ic].stack_values.findIndex((v)=>v.row_index === i) == -1){
                                colDefs[ic].stack_values.push({row_index: i, value: stack_columns[i], alias: stack_aliases[i], cols: [],
                                    is_tree: is_tree});
                            }
                        }
                    }else if (parent_path != current_path){

                        var iv = (colDefs[ic].stack_values || []).findIndex((v)=>v.row_index === i);
                        if (iv == -1){
                            if (i !== row_leaf_i &&  i != value_position){
                                if (group_parent_index !== undefined && group_columns.length > 1){
                                    var u_stack_value_index = colDefs[group_parent_index].stack_values.findIndex((v)=>v.row_index === i);
                                    if (u_stack_value_index != -1){
                                        colDefs[group_parent_index].stack_values[u_stack_value_index].cols = group_columns;
                                        colDefs[group_parent_index].stack_values[u_stack_value_index].is_expanded = true;
                                        colDefs[group_parent_index].stack_values[u_stack_value_index].is_tree = true;
                                        colDefs[group_parent_index].stack_values[u_stack_value_index].is_col_total = false;
                                    }
                                }
                            }

                            colDefs[ic].stack_values.push({row_index: i, value: stack_columns[i], alias: stack_aliases[i], cols: [],
                                is_tree: is_tree});
                        }

                        group_columns = [];
                        group_columns.push(colDefs[ic].originalName);
                        group_parent_index = ic;

                    }else{
                        group_columns.push(colDefs[ic].originalName);
                        colDefs[ic].stack_values.push({row_index: i, value: "", alias: "", cols: [],
                            is_tree: is_tree});
                    }

                    if (!parent_path || parent_path != current_path){
                        parent_path = current_path;
                        parent_index = ic;
                    }
                }
            }
        }
    }

    return colDefs;
}

function createColumnDefs(columns, schema, tschema, dnames = {}, longest_text_cols) {
    var colDefs = [];
    var rowPathInx = 0;
    var is_stack_header = this.behavior.dataModel.isStackHeader();
    var is_stackheader_with_flat_pivot = this.behavior.dataModel.isStackHeaderWithFlatPivot();

    var value_position = this.behavior.dataModel.get_colpivot_value_position();
    var value_pivots = this.behavior.dataModel._viewer.get_attr_value_pivots() || [];

    let prev_cinfo_settings = (this.behavior.dataModel._viewer.get_cinfo() || []).filter((v)=>v.active === false || v.hide_when_not_tree === true);

    var column_width_cache = this.behavior.dataModel._viewer._get_column_width_cache_pivot() || [];
    var pre_stack_columns = undefined;
    columns.forEach((columnName, index)=>{
        var group_columns = [];
        var stack_columns = undefined;
        var stack_aliases;
        if (is_stack_header){
            stack_columns = columnName.split("|");
            if (value_position >= 0 && stack_columns.length > 0){
              stack_aliases = [ ...stack_columns ];
              /*
              const vpi = value_pivots.findIndex((vp)=>vp.base_name === stack_aliases[value_position]);
              if (vpi !== -1){
                stack_aliases[value_position] = value_pivots[vpi].dname;
              }
              */
              for(let sai = 0; sai < stack_aliases.length; sai++){
                const vpi = value_pivots.findIndex((vp)=>vp.base_name === stack_aliases[sai] && vp.base_name !== vp.dname);
                if (vpi !== -1){
                  stack_aliases[sai] = value_pivots[vpi].dname;
                }
              }

            }
        }

        var l_text = longest_text_cols != undefined && longest_text_cols[columnName] ? longest_text_cols[columnName]: "";
        var w; //getDefaultColumnWidth.call(this, columnName, l_text);
        let user_width;
        if (column_width_cache[columnName] && column_width_cache[columnName].user_width){
          user_width = column_width_cache[columnName].user_width;
        }

        if ((column_width_cache[columnName] && column_width_cache[columnName].default_width && columnName !== "__ROW_PATH__")
          || (column_width_cache[columnName] && column_width_cache[columnName].user_width) // Keep using the user width
        ){
            w = column_width_cache[columnName].user_width || column_width_cache[columnName].default_width;
        }else{
            if (is_stack_header){
                var predict_name = getCFRVLongestText(pre_stack_columns, stack_columns || []);
                w = getDefaultColumnWidth.call(this, columnName === "__ROW_PATH__" ? columnName: predict_name, l_text);

            }else{
                w = getDefaultColumnWidth.call(this, columnName, l_text);
            }

            this.behavior.dataModel._viewer._update_column_width_cache_pivot(columnName, w, user_width);
        }
        let colType = (columnName === "__ROW_PATH__") ? schema[columnName] : (schema[columnName] || tschema[columnName] || "string");

        //colDefs.push(buildColumnDef.call(this, columnName, index - rowPathInx, colType, dnames[columnName], index - rowPathInx, w, stack_columns, stack_aliases));
        let bc_def = buildColumnDef.call(this, columnName, index - rowPathInx, colType, dnames[columnName], index - rowPathInx, w, stack_columns, stack_aliases, user_width, undefined);

        const change_index = prev_cinfo_settings.findIndex((v)=>v.name === columnName);
        if (change_index !== -1){

          if (prev_cinfo_settings[change_index].active === false){
            bc_def.isHidden = true;
          }

          if (prev_cinfo_settings[change_index].hide_when_not_tree === true){
            bc_def.hide_when_not_tree = prev_cinfo_settings[change_index].hide_when_not_tree;
          }
        }
        colDefs.push(bc_def);
        if (columnName === "__ROW_PATH__"){
            rowPathInx = 1;
        }

        if (is_stack_header){
          pre_stack_columns = stack_columns;
        }
    });

    if (is_stackheader_with_flat_pivot || is_stack_header){
      return _createColDefs.call(this, colDefs, longest_text_cols);
    }

    return colDefs;

}

// Build column index mapping based on range with start_col and end_col
function buildColumnsMapping(range, isRowPivot, contains_rowpath_in_firstcolumn, force_primary){
    var c_mapping = [];
    var grid_columns = this.behavior.columns;
    var m_original_index = 0;

    if (force_primary == true){
        var c_info = this.behavior.dataModel._viewer.get_cinfo() || [];
        var pk = this.behavior.dataModel._viewer.pk;
        if (pk && pk != ""){
            var fi = c_info.findIndex((v)=>v.name === pk);
            if (fi != -1){
                range.start_col = 0;
                range.index_map[range.start_col] = c_info[fi].original_index;
                c_mapping.push({name: pk, index: range.start_col});

                range.end_col = 1;

                if (grid_columns[0] && grid_columns[0].colDef){
                    range.index_map[range.end_col] = grid_columns[0].colDef.original_index;
                    c_mapping.push({name: grid_columns[0].colDef.originalName, index: range.end_col});
                }else{
                    return undefined;
                }

                return {range: range, mapping: c_mapping};
            }else{
                return undefined;
            }
        }
    }

    for (var r_i = range.start_col; r_i <= range.end_col; r_i++){
        if (grid_columns[r_i] && grid_columns[r_i].colDef){
            var c_name = grid_columns[r_i].colDef.originalName;

            range.index_map[r_i] = contains_rowpath_in_firstcolumn && r_i > 0 ? grid_columns[r_i].colDef.original_index + 1: grid_columns[r_i].colDef.original_index;

            if (range.index_map[r_i] > m_original_index){
                m_original_index = range.index_map[r_i];
            }

            c_mapping.push({name: c_name, index: (!isRowPivot && contains_rowpath_in_firstcolumn && r_i > 0) ? r_i - 1 : r_i});

        }else{
            if (grid_columns[r_i]){
                m_original_index += 1;
                range.index_map[r_i] = m_original_index;
            }
        }
    }

    return {range: range, mapping: c_mapping};
}

function getDefaultColumnWidth(c_name, longest_text){
    var extra_width = 0;

    if (c_name === "__ROW_PATH__"){
        var max_depth = this.behavior.dataModel.getTreeDepth();
        //extra_width = this.properties.cellPaddingLeft + 16 * max_depth;
        extra_width = this.properties.cellPaddingLeft + 16 * max_depth;
    }

    /*if (c_name == " "){
        return this.properties.defaultColumnWidth;
    }*/

    // Header row
    this.canvas.gc.cache.font = this.properties.columnHeaderFontBold;
    var w1 = this.canvas.gc.getTextWidth(c_name)
        + this.properties.columnTitlePrefixRightSpace
        + this.properties.cellPaddingLeft + this.properties.cellPaddingRight + extra_width + 16;

    // Cell value
    this.canvas.gc.cache.font = c_name === "__ROW_PATH__" ? this.properties.columnHeaderFontBold : this.properties.font;
    var w2 = this.canvas.gc.getTextWidth(longest_text)
        + this.properties.columnTitlePrefixRightSpace
        + this.properties.cellPaddingLeft + this.properties.cellPaddingRight + extra_width;
    return Math.min(Math.max(Math.floor(Math.max(w1, w2)) + 1, this.properties.defaultColumnWidth), this.properties.maxInitialWidth);
}

function update_cell_editor_selections(_this) {
    const cellEditor = _this.cellEditor;
    if (!cellEditor || !cellEditor.isFormulaMode) {
        return;
    }

    const selections = _this.selectionModel.getSelections();
    cellEditor.updateValueBySelections(selections);
}

function update_lasso_selections() {
  var _this = this;
  setTimeout(function () {
    update_cell_editor_selections(_this);

    let selections = _this.selectionModel.getSelections();

    let arr_r = [];
    let arr_c = [];

    const fixed_row_count = _this.behavior.grid.properties.fixedRowCount || 0;
    let nrows = _this.behavior.dataModel.getRowsWithValuesCount();
    const ncols = _this.behavior.dataModel.getColumnsWithValuesCount();

    const is_row_pivot = _this.behavior.dataModel.isRowPivot();
    if (is_row_pivot) {
      // Need to decrease 1 in case row pivot as the row total in grid is moved to bottom
      nrows = Math.max(nrows - 1, 0);
    }

    // Build the rects based on selections
    let arr_rects = [];
    if (selections && selections.length > 0) {

      for (var i = 0; i < selections.length; i++) {
        let first_selection = selections[i].firstSelectedCell;
        let last_selection = selections[i].lastSelectedCell;
        if (!first_selection || !last_selection) {
          continue;
        }

        if (!selections[i].origin || !selections[i].corner) {
          continue;
        }

        // The origin cell is in outside of cols
        if (selections[i].origin.x >= ncols) {
          continue;
        }

        // The origin cell is in outside of rows
        if (selections[i].origin.y >= nrows + fixed_row_count) {
          continue;
        }

        let origin = { x: selections[i].origin.x, y: selections[i].origin.y };
        let corner = { x: selections[i].corner.x, y: selections[i].corner.y };

        // Correct the corner cell if it's outside of cols
        if (corner && corner.x >= ncols) {
          corner.x = Math.max(ncols - 1, 0);
        }

        // Correct the corner cell if it's outside of rows
        if (corner && corner.y >= nrows + fixed_row_count) {
          corner.y = Math.max(nrows + fixed_row_count - 1, 0);
        }

        if (origin && corner) {
          arr_rects.push({ origin: origin, corner: corner });
        }
      }
    }

    let count = 0; // Number of the selected cells
    let nb_r = 0; // Number of the selected rows
    let nb_c = 0; // Number of the selected cols

    // Need to merge rects
    let merged_rects = [];
    if (arr_rects.length > 0) {
        merged_rects = merges_selections.call(this, arr_rects);
    }

    if (merged_rects && merged_rects.length > 0) {

        // Count calculation
        count = count_selected_cells.call(_this, merged_rects);

        // Number of columns calculation
        nb_c = count_selected_cols.call(_this, arr_rects);

        // Number of rows calculation
        nb_r = count_selected_rows.call(_this, arr_rects);
    }

    console.log("-------api.update_lasso_selections-------", merged_rects);
    // Build options
    let options = build_lasso_options.call(_this, merged_rects);

    _this.behavior.dataModel._viewer.update_status_lasso_selections(count, nb_r, nb_c, options);
  });
}

/*
  rect1 = {origin: {x: 0, y: 1}, corner: {x: 1, y:2}}
  rect2 = {origin: {x: 7, y: 1}, corner: {x: 10, y:2}}
*/
function generates_rect_intersection(rect1, rect2){

  // Result will be a list of new rect create from intersection process
  let result = [];

  const rect_sort_by_area = (rect1, rect2) => {
      const calulate_rect_area = (rect_object) => {
          return (rect_object.corner.x - rect_object.origin.x) * (rect_object.corner.y - rect_object.origin.y);
      };
      let rect1_area = calulate_rect_area(rect1);
      let rect2_area = calulate_rect_area(rect2);

      // return array of rect with big rect first
      if (rect1_area > rect2_area) {
          return [rect1, rect2];
      } else {
          return [rect2, rect1];
      }
  };

  const calculate_intersection = (rect_object_1, rect_object_2) => {
      const cal_max = (a, b) => {
          if (a > b) { return a; } else { return b; }
      }
      const cal_min = (a, b) => {
          if (a < b) { return a; } else { return b; }
      }
      let x1 = cal_max(rect_object_1.origin.x, rect_object_2.origin.x);
      let y1 = cal_max(rect_object_1.origin.y, rect_object_2.origin.y);
      let x2 = cal_min(rect_object_1.corner.x, rect_object_2.corner.x);
      let y2 = cal_min(rect_object_1.corner.y, rect_object_2.corner.y);

      if ((x1 <= x2) && (y1 <= y2)) {
          return { origin: { x: x1, y: y1 }, corner: { x: x2, y: y2 } };
      } else {
          return null;
      }
  }
  let inter_rect = calculate_intersection(rect1, rect2);
  if (inter_rect === null) {
    // There is no intersection, just return null to notify it
    return null;
  }

  let rect_sort_result = rect_sort_by_area(rect1, rect2);
  let big_rect = rect_sort_result[0];
  let small_rect = rect_sort_result[1];

  // our heuristic is keeping the big rect and manipulating the small rect
  // fragment small rect into new small rect
  result.push(big_rect);
  // using inter_rect and small_rect to handle it
  if (inter_rect.origin.y > small_rect.origin.y) {
    result.push({
        origin: { x: small_rect.origin.x, y: small_rect.origin.y },
        corner: { x: small_rect.corner.x, y: inter_rect.origin.y - 1 }
    })
  }
  if (inter_rect.corner.y < small_rect.corner.y) {
    result.push({
        origin: { x: small_rect.origin.x, y: inter_rect.corner.y + 1},
        corner: { x: small_rect.corner.x, y: small_rect.corner.y }
    })
  }
  if (inter_rect.origin.x > small_rect.origin.x) {
    result.push({
        origin: { x: small_rect.origin.x, y: inter_rect.origin.y },
        corner: { x: inter_rect.origin.x - 1, y: inter_rect.corner.y }
    })
  }
  if (inter_rect.corner.x < small_rect.corner.x) {
    result.push({
        origin: { x: inter_rect.corner.x + 1, y: inter_rect.origin.y },
        corner: { x: small_rect.corner.x, y: inter_rect.corner.y }
    })
  }

  return result;
}

/*
  rects = [
    {origin: {x: 0, y: 1}, corner: {x: 1, y:2}},
    {origin: {x: 7, y: 1}, corner: {x: 10, y:2}}
  ]
*/
function merges_selections(rects) {
    let merged_rects = [];

    // if there is no rect, just return empty array
    if (rects.length === 0){
      return merged_rects;
    }

    // Clone the rects object
    let _rects = [...rects];

    let count = 0;
    while (true) {
        // loop until _rects is empty
        // and all fragment rects is stored inside merged_rects
        var curr_rect = _rects.shift();

        if (_rects.length > 0) {
            let is_rect_free = true; // check if a rect do or do not intersect with another rect
            let arr_len = _rects.length;
            for (let i = 0; i < arr_len; i++) {
                let next = _rects[i];
                let inter_result = generates_rect_intersection.call(this, curr_rect, next);
                if (inter_result) {
                    _rects.splice(i, 1);
                    _rects.push(...inter_result);
                    is_rect_free = false;
                    break;
                };
            };
            if (is_rect_free) {
                merged_rects.push(curr_rect);
            }
            // handle intersection
        } else {
            // add the end, just push the last element into arr_resul_rects
            merged_rects.push(curr_rect);
            break;
        };
    }
    return merged_rects;
}

function count_selected_cells(rects){
    let nb_of_cells = 0;
    if (!rects || !Array.isArray(rects) || rects.length === 0){
        return nb_of_cells;
    }
    const count_cells_in_rect = (rect) => {
        return (rect.corner.x - rect.origin.x + 1) * (rect.corner.y - rect.origin.y + 1);
    }
    for (let i = 0; i < rects.length; i++) {
        nb_of_cells = nb_of_cells + count_cells_in_rect(rects[i]);
    }
    return nb_of_cells;
}

/*
  @params rects: array of rects

  return: number of columns, one pair is separated with another by axis x
*/
function count_selected_cols(rects){

    if (rects.length === 0) return 0;
    if (rects.length === 1) return (rects[0].corner.x - rects[0].origin.x + 1);

    let result = [];

    // Clone the rects object
    let _rects = [...rects];

    _rects.sort((a, b) => (a.origin.x > b.origin.x ? 1 : -1)); // sort by origin.x, order: asc

    let current = [_rects[0].origin.x, _rects[0].corner.x];
    for (let i = 1; i < _rects.length; i++) {
        const rect = _rects[i];
        if ((rect.origin.x >= current[0]) && (rect.origin.x <= current[1])) {
            // in case current result is overlap on the other
            if (current[1] < rect.corner.x) current[1] = rect.corner.x;
        } else {
            // if not overlap, push current
            result.push(current);
            current = [rect.origin.x, rect.corner.x];
        }
    }
    result.push(current);

    const count = (arr_in) => {
        let sum = 0;
        for (let i = 0; i < arr_in.length; i++) {
            const element = arr_in[i];
            sum = sum + element[1] - element[0] + 1;
        }
        return sum;
    }

    return count(result);
}

/*
 @params rects: array of rects

 return: number of rows, one pair is separated with another by axis y
*/
function count_selected_rows(rects){

    if (rects.length === 0) return 0;
    if (rects.length === 1) return (rects[0].corner.y - rects[0].origin.y + 1);

    let result = [];

    // Clone the rects object
    let _rects = [...rects];

    _rects.sort((a, b) => (a.origin.y > b.origin.y ? 1 : -1)); // sort by origin.y, order: asc

    let current = [_rects[0].origin.y, _rects[0].corner.y];

    for (let i = 0; i < _rects.length; i++) {
        const rect = _rects[i];
        if ((rect.origin.y >= current[0]) && (rect.origin.y <= current[1])) {
            // in case current result is overlap on the other
            if (current[1] < rect.corner.y) current[1] = rect.corner.y;
        } else {
            // if not overlap, push current
            result.push(current);
            current = [rect.origin.y, rect.corner.y];
        }

    }
    result.push(current);

    const count = (arr_in) => {
        let sum = 0;
        for (let i = 0; i < arr_in.length; i++) {
            const element = arr_in[i];
            sum = sum + element[1] - element[0] + 1;
        }
        return sum;
    }

    return count(result);
}

// Build options to call and get Avg and Sum
function build_lasso_options(rects){

  // Validate param
  if (!rects || !Array.isArray(rects) || rects.length === 0){
    return;
  }

  const fixed_row_count = this.behavior.grid.properties.fixedRowCount || 0;
  const ncols = this.columnDefs.filter(col => col.isHidden !== true).length;

  const is_flat_pivot = this.behavior.dataModel._viewer.is_flat_pivot();
  const is_row_pivot = this.behavior.dataModel.isRowPivot();
  let contains_rowpath_in_firstcolumn = this.columnDefs.length > 0 ? this.columnDefs[0].originalName === "__ROW_PATH__" : false;

  let options = [];
  for (let rect of rects){
    if (!rect || typeof rect !== "object" || Object.keys(rect).length === 0){
      continue;
    }

    let range = {};

    range.start_row = rect.origin.y - fixed_row_count >= 0 ? rect.origin.y - fixed_row_count : 0;
    range.end_row = rect.corner.y - fixed_row_count >= 0 ? rect.corner.y - fixed_row_count: 0;

    range.start_col = rect.origin.x;
    range.end_col = rect.corner.x;

    range.index_map = {};

    const c_range = buildColumnsMapping.call(this, range, is_flat_pivot === true ? (contains_rowpath_in_firstcolumn === true ? true: false): is_row_pivot, contains_rowpath_in_firstcolumn);

    if (!c_range.range){
      continue;
    }

    options.push(c_range.range);
  }

  return options;
}

function normalizeRect(rect) {
    var o = rect.origin,
        c = rect.corner,

        ox = Math.min(o.x, c.x),
        oy = Math.min(o.y, c.y),

        cx = Math.max(o.x, c.x),
        cy = Math.max(o.y, c.y);

    return new SelectionRectangle(ox, oy, cx - ox, cy - oy);
}

// Find Fixed Rows Values
function findCFRV(arr_pre, arr_cur){
    if (!arr_pre || arr_pre.length == 0){
        return arr_cur;
    }

    var arr_res = [];
    for (var i = 0; i < arr_cur.length; i++){
        if (arr_pre[i] !== arr_cur[i]){
            arr_res.push(arr_cur[i]);
        }
    }

    return arr_res;
}

function getCFRVLongestText(arr_pre, arr_cur){
    var arr_value = findCFRV(arr_pre, arr_cur);
    if (!arr_value || arr_value.length == 0){
        return "";
    }

    var str_value = "";
    var cur_len = 0;
    for (var i =0; i < arr_value.length; i++){
        if (arr_value[i].length > cur_len){
            str_value = arr_value[i];
            cur_len = arr_value[i].length;
        }
    }

    return str_value;
}

function exportFixedRowsData() {
    var is_stack_header = this.behavior.dataModel.isStackHeader();
    var is_stackheader_with_flat_pivot = this.behavior.dataModel.isStackHeaderWithFlatPivot();

    var col_depth = this.behavior.dataModel.getColDepth();
    if (!is_stack_header){
        return [];
    }
    var vColumnDefs = getVisibleColDefs(this.columnDefs);
    var schema = convertColDefs.call(this, vColumnDefs);

    var fixedRowsData = [];
    const rowsData = schema.data[0];
    var _this = this;

    for (var i=0; i<col_depth; i++){
        var rowData = {};
        var parent_path = undefined;
        var current_path = undefined;
        for (var key in rowsData) {
            if (rowsData.hasOwnProperty(key)) {
                var stack_columns = rowsData[key]["value"] !== undefined ? rowsData[key]["value"].split("|") : [];

                rowData[key] = Object.assign({}, rowsData[key]);

                var stack_values = [];
                var col_index = vColumnDefs.findIndex((v)=>v.field === key);
                if (col_index != -1){
                    stack_values = vColumnDefs[col_index].stack_values;
                }

                var value = undefined;
                if (stack_values && stack_values.length > 0){
                    var stack_value_index = stack_values.findIndex((v)=>v.row_index === i);
                    if (stack_value_index != -1){
                        value = stack_values[stack_value_index].value;

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
                                            var f_col_index = vColumnDefs.findIndex((f)=>f.originalName === v.condition.column_name);
                                            if (f_col_index != -1){
                                                f_stack_values = vColumnDefs[f_col_index].stack_values;
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
                                        var m_i = m_values[m_value_index].values.findIndex((v)=>v.row_index === i);
                                        if (m_i != -1){
                                            value = m_values[m_value_index].values[m_i].value != undefined
                                                  ? m_values[m_value_index].values[m_i].value
                                                  : value;
                                            break;
                                        }
                                    }
                                }
                            }
                        }


                    }
                }

                value = value || "";

                rowData[key]["value"] = value;
            }
        }

        fixedRowsData.push(rowData);
    }

    return fixedRowsData;

}

function did_hide_grid_columns(){
  var _this = this;
  var colDef = this.columnDefs;

  const is_stack_header = this.behavior.dataModel.isStackHeader();
  const is_stackheader_with_flat_pivot = this.behavior.dataModel.isStackHeaderWithFlatPivot();

  let selected_columns = this.getSelectedColumns() || [];

  var columns = this.behavior.columns;
  this.behavior.dataModel._dirty = true;

  if (is_stack_header){
    const value_position = this.behavior.dataModel.get_colpivot_value_position();
    const col_depth = this.behavior.dataModel.getColDepth();
    const col_pivots = this.behavior.dataModel.getColPivots();

    let c_info = this.behavior.dataModel._viewer.get_cinfo();

    // Eg: [{name: "Header", hide_value: "x"}]
    let cols_data = [];

    let hide_now = false;
    for (var i = 0; i < selected_columns.length; i++){
      if (!columns[selected_columns[i]].colDef){
        continue;
      }

      const stack_columns = columns[selected_columns[i]].colDef.stack_columns || [];
      const stack_values = columns[selected_columns[i]].colDef.stack_values || [];

      const first_tree_index = stack_values.findIndex((v)=>v.is_tree === true);
      const first_not_empty_item_index = stack_values.findIndex((v, vi)=>{
        return !v.is_tree && vi !== value_position
          && v.value !== undefined && v.value !== null && v.value !== ""
      });

      if ((first_tree_index === -1 && first_not_empty_item_index !== -1)
        && (
          columns[selected_columns[i]].colDef.is_out_of_tree_col === true
          || stack_values.findIndex((sv)=>sv.is_grand_total === true) !== -1 // Can hide the grand total column
        )){

        stack_values[first_not_empty_item_index].hide_when_not_tree = true;

        columns[selected_columns[i]].colDef.isHidden = true;
        var ic = colDef.findIndex((v)=>v.originalName === columns[selected_columns[i]].colDef.originalName);
        if (ic !== -1){
          colDef[ic].isHidden = true;
          hide_now = true;

          const c_info_index = c_info.findIndex((cii)=>cii.name === columns[selected_columns[i]].colDef.originalName);
          if (c_info_index !== -1){

            // Need to save this item into c_info in order to restore its settings once a new query/view is created
            c_info[c_info_index].hide_when_not_tree = true;
            c_info[c_info_index].active = false;

          }
        }

        continue;
      }
      /*
      if (first_tree_index !== -1 && first_tree_index < col_pivots.length
        && first_tree_index < stack_columns.length){
        cols_data.push({name: col_pivots[first_tree_index], hide_value: stack_columns[first_tree_index], col_pivot_index: first_tree_index});
      }else if (stack_columns.length  === col_depth){
        if (first_not_empty_item_index < col_pivots.length && first_not_empty_item_index < stack_columns.length){
          cols_data.push({name: col_pivots[first_not_empty_item_index], hide_value: stack_columns[first_not_empty_item_index], col_pivot_index: first_not_empty_item_index});
        }
      }else{

      }
      */
      if (first_tree_index !== -1 && first_tree_index < col_pivots.length
        && first_tree_index < stack_columns.length){

        let f_fields = [];
        for (let di = 0; di <= first_tree_index; di++){
          f_fields.push({name: col_pivots[di], hide_value: stack_columns[di], col_pivot_index: di});
        }

        if (f_fields.length > 0){
          cols_data.push(f_fields);
        }

      }else if (stack_columns.length  === col_depth){
        if (first_not_empty_item_index < col_pivots.length && first_not_empty_item_index < stack_columns.length){
          let f_fields = [];
          for (let di = 0; di <= first_not_empty_item_index; di++){
            f_fields.push({name: col_pivots[di], hide_value: stack_columns[di], col_pivot_index: di});
          }

          if (f_fields.length > 0){
            cols_data.push(f_fields);
          }
        }
      }else{

      }

    }

    // Updates columns in grid
    if (hide_now === true){
      this.behavior.dataModel._dirty = true;
      this.api.setColumnDefs(colDef);
    }

    if (cols_data && cols_data.length > 0){
      this.behavior.dataModel._viewer.did_hide_stack_columns(cols_data, is_stack_header);
    }

  }else{
    let c_names = selected_columns.map(function(i){
        return columns[i].colDef ? columns[i].colDef.field : undefined;
    }).filter(function(v){
        return v;
    });

    c_names.forEach(function(c_name){
        /*
        _this.getColDefs(c_name).forEach(function (singleColDef) {
          colDef.splice(colDef.indexOf(singleColDef), 1);
        });
        */
        const c_name_index = colDef.findIndex((v)=>v.field === c_name);
        if (c_name_index !== -1){
          colDef[c_name_index].isHidden = true;
        }
    });

    this.api.setColumnDefs(colDef);

    // Need to set inactive perspective's tags
    var co_names = selected_columns.map(function(i){
        return columns[i].colDef ? columns[i].colDef.originalName : undefined;
    }).filter(function(v){
        return v;
    });

    this.behavior.dataModel._viewer.did_inactive_columns(co_names);
  }
}

function save_user_width(original_name, width){

  if (!original_name || !width){
    return;
  }

  if (original_name && width){
    const i = this.columnDefs.findIndex((v)=>v.originalName === original_name);
    if (i !== -1){

      // Save to colDefs
      this.columnDefs[i].user_width = width;

      if (this.behavior.dataModel._viewer.is_row_pivot(true) || this.behavior.dataModel._viewer.is_value_pivot(true)
        || this.behavior.dataModel._viewer.is_column_pivot(true)
        ) {
          this.behavior.dataModel._viewer._update_column_width_cache_pivot(original_name, width, width, true);
      }else{
        // Save the user_width to c_info
        var c_info = this.behavior.dataModel._viewer.get_cinfo();
        if (c_info && Array.isArray(c_info) && c_info.length > 0){
          const ci = c_info.findIndex((v)=>v.name === original_name);
          if (ci !== -1){
            c_info[ci].user_width = width;
          }
        }

        this.behavior.dataModel._viewer._update_column_width_cache_default(original_name, width, width, true);
      }

    }
  }
}

function save_user_width_to_multiple_cols(arr_col_width){

  if (!arr_col_width || arr_col_width.length === 0){
    return;
  }

  let saves_to_pivot = false;

  if (this.behavior.dataModel._viewer.is_row_pivot(true) || this.behavior.dataModel._viewer.is_value_pivot(true)
    || this.behavior.dataModel._viewer.is_column_pivot(true)
    ) {
      saves_to_pivot = true;
  }

  for (let cwi = 0; cwi < arr_col_width.length; cwi++){
    let original_name = arr_col_width[cwi].original_name;
    let width = arr_col_width[cwi].user_width;

    if (!original_name || !width){
      continue;
    }

    const i = this.columnDefs.findIndex((v)=>v.originalName === original_name);
    if (i !== -1){

      // Save to colDefs
      this.columnDefs[i].user_width = width;
      if (saves_to_pivot === true){
        // Pass
      }else{
        // Save the user_width to c_info
        var c_info = this.behavior.dataModel._viewer.get_cinfo();
        if (c_info && Array.isArray(c_info) && c_info.length > 0){
          const ci = c_info.findIndex((v)=>v.name === original_name);
          if (ci !== -1){
            c_info[ci].user_width = width;
          }
        }
      }

    }

  }

  if (saves_to_pivot === true){
    this.behavior.dataModel._viewer._update_multiple_column_width_cache_pivot(arr_col_width, true);
  }else{
    this.behavior.dataModel._viewer._update_multiple_column_width_cache_default(arr_col_width, true);
  }
}

function update_zoom_ratio(ratio) {
    this.behavior.dataModel.setZoomRatio(ratio)
    this.canvas.resize(true);
}

module.exports = {
    // fields
    rowModel: rowModel,
    rangeController: rangeController,
    gridPanel: gridPanel,
    columnController: columnController,
    floatingRowModel: floatingRowModel,
    virtualPageRowModel: virtualPageRowModel,

    // functions
    setColumnDefs: setColumnDefs,
    getColumnDefAtIndex: getColumnDefAtIndex,
    setRowData: setRowData,
    sizeColumnsToFit: sizeColumnsToFit,
    destroy: destroy,
    getRangeSelections: getRangeSelections,
    copySelectedRangeToClipboard: copySelectedRangeToClipboard,
    getSelectedColumns: getSelectedColumns,
    getModel: getModel,
    refreshView: refreshView,
    removeItems: removeItems,
    insertItemsAtIndex: insertItemsAtIndex,
    clearRangeSelection: clearRangeSelection,
    clearFocusedCell: clearFocusedCell,
    getFloatingTopRowData: getFloatingTopRowData,
    getFloatingTopRowCount: getFloatingTopRowCount,
    showNoRowsOverlay: showNoRowsOverlay,
    hideOverlay: hideOverlay,
    refreshCells: refreshCells,
    setDatasource: setDatasource,
    onGroupExpandedOrCollapsed: onGroupExpandedOrCollapsed,
    getSortModel: getSortModel,
    doLayout: doLayout,
    refreshInMemoryRowModel: refreshInMemoryRowModel,
    attachLinkToDataCell: attachLinkToDataCell,
    registerCellEditedEventListener: registerCellEditedEventListener,
    applyProperties: applyProperties,
    showColumnMenu: showColumnMenu,
    addHeaderRow: addHeaderRow,
    getNumHeaderRow: getNumHeaderRow,
    getVisibleColumnDefs: getVisibleColumnDefs,
    getFirstRowsData: getFirstRowsData,
    setColumnErrors: setColumnErrors,
    buildColumnDefs: buildColumnDefs,
    buildColumnDef: buildColumnDef,
    getCustomCellRenderer: getCustomCellRenderer,
    createColumnDefs: createColumnDefs,
    _createColDefs: _createColDefs,
    _merge_stack_values: _merge_stack_values,
    buildColumnsMapping: buildColumnsMapping,
    getDefaultColumnWidth: getDefaultColumnWidth,
    getFixedRowsData: getFixedRowsData,
    findCFRV: findCFRV,
    getCFRVLongestText: getCFRVLongestText,
    exportFixedRowsData: exportFixedRowsData,
    addFixedRowsData: addFixedRowsData,
    update_lasso_selections: update_lasso_selections,
    did_hide_grid_columns: did_hide_grid_columns,
    get_col_label_row_data: get_col_label_row_data,
    generates_rect_intersection: generates_rect_intersection,
    merges_selections: merges_selections,
    count_selected_cells: count_selected_cells,
    count_selected_cols: count_selected_cols,
    count_selected_rows: count_selected_rows,
    build_lasso_options: build_lasso_options,
    save_user_width: save_user_width,
    save_user_width_to_multiple_cols: save_user_width_to_multiple_cols,
    update_zoom_ratio: update_zoom_ratio
};
