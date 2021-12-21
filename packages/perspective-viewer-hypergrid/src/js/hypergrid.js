/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const Hypergrid = require("../../../../fin-hypergrid/fin-hypergrid");

var eventLoggerPlugin = require('fin-hypergrid-event-logger');
// Shared plugin: Install on the prototype:
Hypergrid.prototype.installPlugins(eventLoggerPlugin);
// The plugin is now available to all existing and new grid instances

const Base = require("../../../../fin-hypergrid/fin-hypergrid/src/Base");
const groupedHeaderPlugin = require("fin-hypergrid-grouped-header-plugin");

const perspectivePlugin = require("./perspective-plugin");
const PerspectiveDataModel = require("./PerspectiveDataModel");
const treeLineRendererPaint = require("./hypergrid-tree-cell-renderer").treeLineRendererPaint;
const {psp2hypergrid, page2hypergrid} = require("./psp-to-hypergrid");
const {cloneDeep} = require("lodash");

const csvWriter = require("../../../../fin-hypergrid/csv-writer/dis");
//var XLSX = require('../../../../fin-hypergrid/js-xlsx/xlsx.full.min');
import zipcelx from '../../../../fin-hypergrid/zipcelx/legacy';

import {bindTemplate} from "@jpmorganchase/perspective-viewer/cjs/js/utils.js";

const TEMPLATE = require("../html/hypergrid.html");

import style from "../less/hypergrid.less";

const COLUMN_HEADER_FONT = "12px Helvetica, sans-serif";
const GROUP_LABEL_FONT = "12px Open Sans, sans-serif"; // overrides COLUMN_HEADER_FONT for group labels

const base_grid_properties = {
    autoSelectRows: false,
    cellPadding: 5,
    cellSelection: true,
    columnSelection: true,
    rowSelection: true,
    checkboxOnlyRowSelections: false,
    columnClip: true,
    columnHeaderFont: COLUMN_HEADER_FONT,
    columnHeaderForegroundSelectionFont: '12px "Arial", Helvetica, sans-serif',
    columnsReorderable: true,
    defaultRowHeight: 24,
    editable: false,
    editOnKeydown: true,
    editor: "textfield",
    editorActivationKeys: ["alt", "esc"],
    enableContinuousRepaint: false,
    fixedColumnCount: 0,
    fixedRowCount: 0,
    fixedLinesHWidth: 1,
    fixedLinesVWidth: 1,
    font: '12px "Arial", Helvetica, sans-serif',
    foregroundSelectionFont: '12px "Arial", Helvetica, sans-serif',
    gridLinesH: false,
    gridLinesV: true, // except: due to groupedHeaderPlugin's `clipRuleLines: true` option, only header row displays these lines
    gridLinesUserDataArea: false, // restricts vertical rule line rendering to header row only
    halign: "left",
    headerTextWrapping: false,
    hoverColumnHighlight: {enabled: false},
    hoverRowHighlight: {
        enabled: true,
        backgroundColor: "#555"
    },
    hoverCellHighlight: {
        enabled: true,
        backgroundColor: "#333"
    },
    noDataMessage: "",
    minimumColumnWidth: 50,
    multipleSelections: false,
    renderFalsy: false,
    rowHeaderFont: "12px Arial, Helvetica, sans-serif",
    rowHeaderForegroundSelectionFont: '12px "Arial", Helvetica, sans-serif',
    rowResize: true,
    scrollbarHoverOff: "visible",
    rowHeaderCheckboxes: false,
    rowHeaderNumbers: false,
    showFilterRow: true,
    showHeaderRow: true,
    showTreeColumn: false,
    singleRowSelectionMode: false,
    sortColumns: [],
    sortOnDoubleClick: true,
    treeRenderer: "TreeCell",
    treeHeaderFont: "12px Arial, Helvetica, sans-serif",
    treeHeaderForegroundSelectionFont: '12px "Arial", Helvetica, sans-serif',
    useBitBlit: false,
    vScrollbarClassPrefix: "",
    voffset: 0
};

const light_theme_overrides = {
    backgroundColor: "#ffffff",
    color: "#666",
    lineColor: "#AAA",
    // font: '12px Arial, Helvetica, sans-serif',
    font: '12px "Open Sans", Helvetica, sans-serif',
    foregroundSelectionFont: "12px amplitude-regular, Helvetica, sans-serif",
    foregroundSelectionColor: "#666",
    backgroundSelectionColor: "rgba(162, 183, 206, 0.3)",
    selectionRegionOutlineColor: "rgb(45, 64, 85)",
    columnHeaderColor: "#666",
    columnHeaderHalign: "left", // except: group header labels always 'center'; numbers always 'right' per `setPSP`
    columnHeaderBackgroundColor: "#fff",
    columnHeaderForegroundSelectionColor: "#333",
    columnHeaderBackgroundSelectionColor: "#40536d",
    rowHeaderForegroundSelectionFont: "12px Arial, Helvetica, sans-serif",
    treeHeaderColor: "#666",
    treeHeaderBackgroundColor: "#fff",
    treeHeaderForegroundSelectionColor: "#333",
    treeHeaderBackgroundSelectionColor: "#40536d",
    hoverCellHighlight: {
        enabled: true,
        backgroundColor: "#eeeeee"
    },
    hoverRowHighlight: {
        enabled: true,
        backgroundColor: "#f6f6f6"
    }
};

var datadocs_theme_overrides = {
  logEnable: true,
  // Perspective settings
  columnColorNumberPositive: '#060606',
  columnColorNumberNegative: '#060606',

  //themeName: 'default',
  //noDataMessage: '',
  //wheelHFactor: 0.01,
  //wheelVFactor: 0.05,
  /*
  subgrids: [
      'HeaderSubgrid',
      'data'
  ],
  */
  font: '13px "Helvetica Neue",Helvetica,Arial,sans-serif',
  color: '#060606',
  backgroundColor: /*'#f8f9fa',*/'#FFFFFF',
  foregroundSelectionFont: '13px "Helvetica Neue",Helvetica,Arial,sans-serif',
  foregroundSelectionColor: '#060606',
  backgroundSelectionColor: '#ECF3FF',
  columnHeaderFont: '11px arial,sans-serif',
  columnHeaderColor: '#060606',
  columnHeaderForegroundSelectionFont: '11px arial,sans-serif',
  columnHeaderBackgroundColor: 'rgb(243,243,243)',
  columnHeaderForegroundSelectionColor: '#060606',
  // Copied from backgroundHeaderSelectionColor: '#DDDDDD'
  columnHeaderBackgroundSelectionColor: '#DDDDDD', //'rgba(255, 220, 97, 0.45)'
  columnHeaderHalign: 'center',
  columnHeaderRenderer: 'SimpleCell',
  columnHeaderFormat: 'header', // Not existed in angular
  rowHeaderFont: '11px arial,sans-serif',
  rowHeaderColor: '#060606',
  ////rowHeaderBackgroundColor: 'rgb(243,243,243)',
  cellHeaderRowBackgroundColor: '#f8fcff',
  cellTotalRowBackgroundColor: '#f8fcff',
  cellTotalRowFont: 'bold 13px "Helvetica Neue",Helvetica,Arial,sans-serif',
  rowHeaderForegroundSelectionColor: '#060606',
  rowHeaderForegroundSelectionFont: '11px arial,sans-serif',
  // Copied from backgroundHeaderSelectionColor: '#DDDDDD'
  rowHeaderBackgroundSelectionColor: '#DDDDDD', //'rgba(255, 220, 97, 0.45)'
  backgroundColor2: 'rgb(201, 201, 201)',
  treeHeaderFont: '13px "Helvetica Neue",Helvetica,Arial,sans-serif',//'12px Tahoma, Geneva, sans-serif',
  treeHeaderFontNotLeaf: 'bold 13px "Helvetica Neue",Helvetica,Arial,sans-serif', // Not exist in angular, custom value
  treeHeaderColor: '#060606',
  treeHeaderBackgroundColor: '#FFFFFF',//'rgb(223, 227, 232)',
  treeHeaderForegroundSelectionColor: '#060606',
  treeHeaderForegroundSelectionFont: '13px "Helvetica Neue",Helvetica,Arial,sans-serif',//'bold 12px Tahoma, Geneva, sans-serif',
  treeHeaderBackgroundSelectionColor: '#FFFFFF',//'rgba(255, 220, 97, 0.45)',
  filterFont: '12px Tahoma, Geneva, sans-serif',
  filterColor: 'rgb(25, 25, 25)',
  filterBackgroundColor: 'white',
  filterForegroundSelectionColor: 'rgb(25, 25, 25)',
  filterBackgroundSelectionColor: 'rgb(255, 220, 97)',
  filterHalign: 'center',
  filterRenderer: 'SimpleCell',
  filterEditor: 'TextField',
  filterable: true,
  showFilterRow: false,
  voffset: 0,
  scrollbarHoverOver: 'visible',
  scrollbarHoverOff: 'hidden',
  scrollingEnabled: true,
  vScrollbarClassPrefix: '',
  hScrollbarClassPrefix: '',
  halign: 'left',
  cellPadding: 4,
  iconPadding: 3,
  leftIcon: undefined,
  centerIcon: undefined,
  rightIcon: undefined,
  renderFalsy: true,
  headerify: 'titleize',
  gridLinesH: true,
  gridLinesHWidth: 1, // Not existed in angular
  // Copied from gridLinesColor: '#dadada'
  gridLinesHColor: '#dadada', // Not existed in angular
  gridLinesV: true,
  gridLinesVWidth: 1, // Not existed in angular
  // Copied from gridLinesColor: '#dadada'
  gridLinesVColor: '#dadada', // Not existed in angular
  gridLinesColumnHeader: true, // Not existed in angular
  gridLinesRowHeader: true, // Not existed in angular
  gridLinesUserDataArea: true, // Not existed in angular
  gridBorder: true,
  gridBorderLeft: true,
  gridBorderRight: true,
  gridBorderTop: true,
  gridBorderBottom: true,
  fixedLinesHWidth: 1, // Copied from gridLinesWidth: 1
  fixedLinesHEdge: undefined,
  fixedLinesHColor: '#dadada', // Copied from gridLinesHeaderColor: '#c1c1c1'
  gridLinesMostBorderColor: '#b4e2fc',
  fixedLinesVWidth: 1, // Copied from gridLinesWidth: 1
  fixedLinesVEdge: undefined,
  fixedLinesVColor: '#c1c1c1', // Copied from gridLinesHeaderColor: '#c1c1c1'
  //boxSizing: version > 2 ? 'content-box' : 'border-box', // Not existed in angular
  defaultRowHeight: 21,
  defaultColumnWidth: 101,
  minimumColumnWidth: 30,
  maximumColumnWidth: 2000,
  resizeColumnInPlace: false, // Not existed in angular
  repaintIntervalRate: 60,
  repaintImmediately: false,
  useBitBlit: false,
  useHiDPI: true,
  navKeyMap: {
    RETURN: 'DOWN',
    RETURNSHIFT: 'UP',
    TAB: 'RIGHT',
    TABSHIFT: 'LEFT'
  },
  feedbackCount: 3,
  feedbackEffect: 'shaker',
  readOnly: false,
  fixedColumnCount: 0,
  fixedRowCount: 1,
  rowHeaderNumbers: true,
  rowHeaderCheckboxes: false,
  showTreeColumn: true,
  treeRenderer: 'TreeCell',//'SimpleCell',
  showHeaderRow: true,
  cellSelection: true,
  columnSelection: true,
  rowSelection: true,
  singleRowSelectionMode: false,
  selectionRegionOverlayColor: 'rgba(160,195,255,.2)', // 'transparent', // 'rgba(0, 0, 48, 0.2)',
  selectionRegionOutlineColor: '#4285F4',
  columnAutosizing: true,
  rowNumberAutosizing: true,
  treeColumnAutosizing: true, // Not existed in angular
  columnAutosizingMax: 400,
  treeColumnAutosizingMax: 400,
  headerTextWrapping: false,
  rowResize: false,
  editable: false,
  editOnDoubleClick: true,
  editOnKeydown: true,
  editOnNextCell: false,
  unsortable: false,
  sortOnDoubleClick: true,
  maxSortColumns: 3,
  sortOnHiddenColumns: true,
  // checkboxOnlyRowSelections: false, // Not existed in angular
  autoSelectRows: false,
  autoSelectColumns: false,
  collapseCellSelections: false,
  format: undefined,
  editor: 'textfield',
  renderer: 'SimpleCell',
  gridRenderer: 'by-columns-and-rows',
  hoverCellHighlight: {
    enabled: false,
    backgroundColor: 'rgba(160, 160, 40, 0.45)'
  },
  hoverRowHighlight: {
    enabled: false,
    backgroundColor: 'rgba(100, 100, 25, 0.30)'

  },
  hoverColumnHighlight: {
    enabled: false,
    backgroundColor: 'rgba(60, 60, 15, 0.15)'
  },
  link: false,
  linkTarget: '_blank',
  linkOnHover: false,
  linkColor: '#011CF5',//'#337ab7',
  linkVisitedColor: '#011CF5',//'#337ab7',
  linkColorOnHover: false,
  strikeThrough: false,
  multipleSelections: true,
  enableContinuousRepaint: false,
  columnsReorderable: true,
  columnGrabMargin: 5,
  columnClip: false,
  rowStripes: undefined,
  features: [
    'filters', 'contextmenu',
    // 'columnfixation',
     //'rowfixation',
    'cellselection', 'keypaging', 'columnresizing',
    // 'rowresizing',
    'rowselection', 'columnselection', 'columnmoving',
    'columnsorting', 'cellclick', 'cellediting', 'onhover', 'linkdetails', 'copyselection', 'cellerror'],
  restoreRowSelections: true, // Not existed in angular
  restoreColumnSelections: true, // Not existed in angular
  truncateTextWithEllipsis: true,



  // The following variables in angular
  useHeaders: true,
  detectLinksPermanently: true,
  fictiveHeaderRowsCount: 0,
  subgrids: ['HeaderSubgrid', 'data'],
  canvasBackgroundColor: '#F3F3F3',
  backgroundHeaderSelectionColor: '#DDDDDD',
  errorCellDataColor: '#a94d4dc2',
  disableHoverHighlighting: true,
  columnHeaderFontBold: 'bold 13px "Helvetica Neue",Helvetica,Arial,sans-serif',
  columnHeaderInitWidth: 50,
  onScrollEndLimitTrigger: 1,
  cellPaddingRight: 5,
  cellPaddingLeft: 6,
  showAdditionalInfo: false,
  appliedFilterColumn: [],
  gridLinesWidth: 1,
  gridLinesColor: '#dadada',
  gridLinesHeaderColor: '#c1c1c1',
  defaultHeaderRowHeight: 23,
  minimumRowCount: 100,
  rowHeaderHalign: 'center',
  rowHeaderStartDisplayedIndex: 1,

  selectFictiveHeaderCellsAsRegular: true,
  ignoreDataCellsOnVerticalCtrlSelection: false,
  selectionRegionBorderWidth: 1,
  copyRegionBorderWidth: 2,
  copyRegionOutlineColor: '#4285F4',
  keepRowSelections: false,
  onlyDataReorder: true,
  combineColors: false,
  cellContextMenu: [/*{
    name: '<b>Filter</b> to value',
    action: function action(clickEvent, gridEvent) {
      console.log('<b>Filter</b> to value with event', gridEvent);
    }
  }, {
    name: '<b>Exclude</b> this value',
    action: function action(clickEvent, gridEvent) {
      console.log('<b>Exclude</b> this value with event', gridEvent);
    }
}, */{
    name: 'Copy',
    action: function action(clickEvent, gridEvent) {
      gridEvent.grid.api.copySelectedRangeToClipboard(false);
    },
    key: 'COPY',
    enable_shortcut: true
  },
  /*{
    name: 'Copy With Headers',
    action: function action(clickEvent, gridEvent) {
      gridEvent.grid.api.copySelectedRangeToClipboard(true);
    }
}*/],
  headerContextMenu: [/*{
    name: 'Rename',
    action: function action(clickEvent, cellEvent) {
      console.log('rename selected', clickEvent, cellEvent);
      cellEvent.grid.onEditorActivate(cellEvent);
    }
  }, */{
    name: 'Hide',
    action: function action(clickEvent, cellEvent) {
      var grid = cellEvent.grid;

      grid.api.did_hide_grid_columns();
    },
    key: 'HIDE',
    enable_shortcut: true
  },
  // {
  //   name: 'Add New Column',
  //   action: function action(clickEvent, gridEvent) {
  //     gridEvent.grid.api.addNewColumn(false);
  //   },
  //   key: 'ADD_NEW_COLUMN',
  //   enable_shortcut: false
  // },
  {
    name: 'Copy',
    action: function action(clickEvent, gridEvent) {
      gridEvent.grid.api.copySelectedRangeToClipboard(false);
    },
    key: 'COPY',
    enable_shortcut: true
  }],
  rowHeaderContextMenu: [{
    name: 'Hide',
    action: async function action(clickEvent, cellEvent) {
      var grid = cellEvent.grid;

      var is_row_pivot = grid.behavior.dataModel.isRowPivot();
      var is_column_pivot = grid.behavior.dataModel.isColumnPivot();
      var is_value_pivot = grid.behavior.dataModel.is_value_pivot();

      var selected_rows = grid.getSelectedRows() || [];
      var selected_values = [];

      var c_i = -1;
      var is_agg_row = is_row_pivot || is_column_pivot || is_value_pivot;

      if (is_agg_row){
        // The column index of the __ROW_PATH__
        c_i = 0;
      }else{
        if (!grid.behavior.dataModel._viewer.pk){
            return;
        }

        var colDef = grid.columnDefs;
        c_i = colDef.findIndex(function(item){
            return item.originalName == grid.behavior.dataModel._viewer.pk;
        });
      }

      //var columnIndex = c_i;

      var v;
      for (var i = 0; i < selected_rows.length; i++){
          // Ignore header
          if (selected_rows[i] > 0){
              v = grid.behavior.getValue(c_i, selected_rows[i]);
              if (v && v !== ""){
                  if (is_agg_row){
                    if (v.rowPath && v.rowPath.length > 0){
                      selected_values.push(v.rowPath);
                    }
                  }else{
                    selected_values.push(v);
                  }

              }else{
                  var force_primary = c_i == -1 ? true: false;
                  var val = await grid.behavior.dataModel.pspFetchDataCellValue({
                      start_col: c_i,
                      end_col: c_i + 1,
                      start_row: selected_rows[i],
                      end_row: selected_rows[i] + 1
                    }, force_primary);

                  if (val){
                    if (is_agg_row){
                      if (val.rowPath && val.rowPath.length > 0){
                          selected_values.push(val.rowPath);
                      }
                    }else if (
                        (typeof val === "string" && val !== "" && val.length < 200)
                        || typeof val === "number"
                        || typeof val === "boolean"){
                        selected_values.push(val);
                    }
                  }
              }
          }
      }
      grid.behavior.dataModel._viewer.did_hide_rows(selected_values, is_agg_row);
    },
    key: "HIDE",
    enable_shortcut: true,
    is_row: true
  },
  {
    name: 'Copy',
    action: function action(clickEvent, gridEvent) {
      gridEvent.grid.api.copySelectedRangeToClipboard(false);
    },
    key: 'COPY',
    enable_shortcut: true
  }],
  showCellContextMenu: true,
  applyContextMenuStyling: true,
  contextMenuHolderStyle: {
    position: 'fixed',
    border: 'none',
    fontSize: '14px',
    zIndex: 2,
    margin: '0 0 0 0',
    fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif',
    width: 'auto',
    height: 'auto',
    'white-space': 'nowrap'
  },
  contextMenuListStyle: {
    padding: '5px 0',
    minWidth: '220px',
    overflow: 'hidden',
    border: '1px solid #ccc',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    marginTop: '-1px',
    borderCollapse: 'collapse',
    position: 'relative'
  },
  contextMenuListOptionStyle: {
    height: '27px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  contextMenuListOptionHoverStyle: {
    backgroundColor: '#eee'
  },
  contextMenuListOptionIconStyle: {
    width: '18px',
    height: '18px',
    overflow: 'hidden',
    position: 'absolute',
    margin: '0 8px 0 12px',
    //padding: '2px 4px',
    //verticalAlign: 'middle'
  },
  contextMenuListOptionTextStyle: {
    padding: '2px 4px',
    verticalAlign: 'middle',
    flexGrow: '1',
    margin: '0 0 0 38px'
  },
  contextMenuListOptionShortcutStyle: {
    padding: '2px 2px 2px 20px',
    verticalAlign: 'middle',
    Width: '0'
  },
  contextMenuListOptionPopupPointerStyle: {
    padding: '2px 4px',
    verticalAlign: 'middle',
    width: '30px'
  },
  contextMenuSeparatorStyle: {
    display: 'block',
    borderTop: '1px solid #E5E5E5',
    margin: '5px 0'
  },
  contextMenuChildMenuArrowIconTag: '<i class="fa fa-caret-right"></i>',
  columnFixationDraggerHeaderInactiveColor: '#BCBCBC',
  columnFixationDraggerHeaderHoveredColor: '#A5C6FE',
  columnFixationDraggerHeaderDraggingColor: '#A5C6FE',
  columnFixationDraggerBodyDraggingColor: '#DBE5F7',
  columnFixationPlaceholderHeaderColor: '#659DFC',
  columnFixationPlaceholderBodyColor: '#AFBBD1',
  rowFixationDraggerHeaderInactiveColor: '#BCBCBC',
  rowFixationDraggerHeaderHoveredColor: '#A5C6FE',
  rowFixationDraggerHeaderDraggingColor: '#A5C6FE',
  rowFixationDraggerBodyDraggingColor: '#DBE5F7',
  rowFixationPlaceholderHeaderColor: '#659DFC',
  rowFixationPlaceholderBodyColor: '#AFBBD1',
  scrollbarVStyle: {
    width: 13,
    background: '#F8F8F8',
    boxShadow: '0 0 0 #000, 0 0 0 #000, 0 0 0 #000',
    marginTop: 0,
    marginBottom: 0,
    marginRight: -1,
    borderRadius: 0,
    borderStyle: 'solid',
    borderColor: '#d9d9d9',
    borderWidth: '1px',
    boxSizing: 'border-box'
  },
  scrollbarHStyle: {
    height: 13,
    border: '1px solid #d9d9d9',
    background: '#F8F8F8',
    boxShadow: '0 0 0 #000, 0 0 0 #000, 0 0 0 #000',
    marginLeft: 0,
    marginRight: 0,
    marginBottom: -1,
    borderRadius: 0,
    boxSizing: 'border-box'
  },
  scrollbarVThumbStyle: {
    margin: 1,
    width: 9,
    right: 0,
    backgroundColor: '#C7C7C7',
    boxShadow: '0px 0px 0px inset',
    position: 'absolute',
    borderRadius: 0
  },
  scrollbarHThumbStyle: {
    margin: 1,
    height: 9,
    bottom: 0,
    backgroundColor: '#C7C7C7',
    boxShadow: '0px 0px 0px inset',
    borderRadius: 0
  },
  scrollbarHMountStyle: {
    position: 'absolute',
    background: '#F8F8F8',
    border: '1px solid #D9D9D9',
    boxSizing: 'border-box'
  },
  scrollbarVMountStyle: {
    position: 'absolute',
    background: '#F8F8F8',
    border: '1px solid #D9D9D9',
    //borderTopWidth: '0',
    boxSizing: 'border-box'
  },
  linkDetailsStyle: {
    cursor: 'pointer',
    display: 'flex',
    flexFlow: 'column',
    position: 'absolute',
    background: '#fcfcfc',
    boxShadow: '0 0 2px 0 rgba(0,0,0,.15), 0 1px 2px 0 rgba(0,0,0,.4)',
    borderRadius: '1px',
    padding: '5px 7px',
    zIndex: 1030,
    fontSize: '13px',
    textDecoration: 'none'
  },
  linkDetailsHoveredStyle: {
    boxShadow: '0 0 2px 0 rgba(0,0,0,.15), 0 2px 2px 0 rgba(0,0,0,.4)'
  },
  linkDetailsMaxStringLength: 30,
  linkDetailsHideTimeout: 1000,
  linkDetailsAnchorStyle: {
    color: '#15c', //'#337ab7',
    textDecoration: 'none',
    lineHeight: '19px',
    fontFamily: 'Arial,sans-serif'
  },
  canvasWidthOffset: 14,
  canvasHeightOffset: 13,
  showCellContextMenuIcon: false,
  contextMenuIconFont: 'normal normal lighter 14px fontAwesome',
  contextMenuIconIsHovered: false,
  contextMenuIconColor: '#616161',
  contextMenuIconHoveredColor: '#616161',
  contextMenuButtonStrokeStyle: '#C6C6C6',
  contextMenuButtonFillStyle: '#F8F8F8',
  contextMenuButtonHoveredFillStyle: '#f0f0f0',
  contextMenuIconUnicodeChar: decodeURI('\uF0D7'),
  errorIconUnicodeChar: decodeURI('\uF071'),
  totalErrorsCountIconHeight: 16,
  totalErrorsCountIconWidth: 18,
  errorIconFont: '13px fontAwesome',
  errorIconColor: '#FF3D3D',
  contextMenuButtonIconPreferedWidth: 8,
  contextMenuButtonRightMargin: 5,
  contextMenuButtonHeight: 12,
  contextMenuButtonPadding: 3,
  contextMenuLeftSpaceToCutText: 5,
  columnTypeSignFont: '900 10px "Helvetica Neue",Helvetica,Arial,sans-serif',
  columnTypeSignColor: '#343434',
  columnTitlePrefixFont: '800 12px "Helvetica Neue",Helvetica,Arial,sans-serif',
  columnTitlePrefixColor: '#818181',
  columnTitlePrefixRightSpace: 5,
  columnWarningFont: '1000 9px "Helvetica Neue",Helvetica,Arial,sans-serif',
  columnWarningFontColor: 'white',
  columnWarningIconColor: '#FF3D3D',
  warningTooltipBottomClass: 'tooltip bottom ng-animate in-add fade in main-page-tooltip',
  warningTooltipRightClass: 'tooltip right ng-animate in-add fade in main-page-tooltip',
  warningTooltipArrowClass: 'tooltip-arrow',
  warningTooltipInnerClass: 'tooltip-inner',
  warningTooltipOpacity: 0.8,
  columnMoveInsertLineColor: '#777777',
  columnMoveInsertLineWidth: 2,
  cellValuePostfixColor: '#8F8F8F',
  cellValuePostfixFont: '13px "Helvetica Neue",Helvetica,Arial,sans-serif',
  cellValuePostfixLeftOffset: 5,
  aggregationGroupExpandIconFont: 'normal normal lighter 14px fontAwesome',
  aggregationGroupExpandIconColor: '#9F9F9F',
  aggregationGroupExpandIconExpandedChar: decodeURI('\uF196'),
  aggregationGroupExpandIconCollapsedChar: decodeURI('\uF147'),
  aggregationGroupTreeLevelOffset: 17,
  aggregationGroupExpandIconClickableWidth: 15,
  grandAggregationCellFont: 'bold 13px "Helvetica Neue",Helvetica,Arial,sans-serif',
  ignoreValuePrefix: false,
  ignoreValuePostfix: false,
  nullCellPlaceholder: 'Ø',
  nullCellColor: '#d4d4d4',
  highLightText: '',
  highlightColor: '#F7FFBA',
  isPivot: false,

  maxInitialWidth: 600,
  MAX_CHARS: 450,

  cellErrorBottomClass: 'annotation-bubble bottom', //'tooltip bottom ng-animate in-add fade in main-page-tooltip',
  cellErrorRightClass: 'annotation-bubble right', //'tooltip right ng-animate in-add fade in main-page-tooltip',
  cellErrorArrowClass: 'tooltip-arrow',
  cellErrorInnerClass: 'annotation-attribution annotation-attribution-rebranded annotation-attribution-error', //'tooltip-inner',
  cellErrorOpacity: 0.8,


  //showCellErrorIcon: true,
  //cellErrorIconFont: 'normal normal lighter 14px fontAwesome',
  //cellErrorIconIsHovered: false,
  cellErrorIconColor: '#FF3D3D',
  //cellErrorIconHoveredColor: '#616161',
  //cellErrorButtonStrokeStyle: '#C6C6C6',
  //cellErrorButtonFillStyle: '#F8F8F8',
  //cellErrorButtonHoveredFillStyle: '#f0f0f0',
  //cellErrorIconUnicodeChar: decodeURI('\uF0D7'),

  //cellErrorButtonIconPreferedWidth: 8,
  //cellErrorButtonRightMargin: 5,
  //cellErrorButtonHeight: 12,
  //cellErrorButtonPadding: 3,
  //cellErrorLeftSpaceToCutText: 5,
};

function generateGridProperties(overrides) {
    return Object.assign({}, cloneDeep(base_grid_properties), cloneDeep(overrides));
}

function null_formatter(formatter, null_value = "") {
    let old = formatter.format.bind(formatter);
    formatter.format = val => {
        if (typeof val === "string") {
            return val;
        }
        if (null_value === val) {
            return "-";
        }
        let x = old(val);
        if (x === "") {
            return "-";
        }
        return x;
    };

    return formatter;
}

bindTemplate(TEMPLATE, style)(
    class HypergridElement extends HTMLElement {
        set_data(data, schema, tschema, row_pivots, columns) {
            const hg_data = psp2hypergrid(data, schema, tschema, row_pivots, columns);
            if (this.grid) {
                this.grid.behavior.setPSP(hg_data);
            } else {
                this._hg_data = hg_data;
            }
        }

        get_style(name) {
            if (window.ShadyCSS) {
                return window.ShadyCSS.getComputedStyleValue(this, name);
            } else {
                return getComputedStyle(this).getPropertyValue(name);
            }
        }

        connectedCallback() {
            if (!this.grid) {
                const host = this.shadowRoot.querySelector("#mainGrid");

                host.setAttribute("hidden", true);
                this.grid = new Hypergrid(host, {DataModel: PerspectiveDataModel, plugins: eventLoggerPlugin});
                if (this.viewConfig) {
                    this.grid.behavior.dataModel._config = this.viewConfig;
                }
                //this.grid.logStart();
                //console.log("this.grid", this.grid);
                this.grid.api.setColumnDefs([]);


                this.grid.canvas.stopResizeLoop();
                host.removeAttribute("hidden");

                // window.g = this.grid; window.p = g.properties; // for debugging convenience in console

                this.grid.installPlugins([
                    perspectivePlugin,
                    [
                        groupedHeaderPlugin,
                        {
                            paintBackground: null, // no group header label decoration
                            columnHeaderLines: false, // only draw vertical rule lines between group labels
                            groupConfig: [
                                {
                                    halign: "center", // center group labels
                                    font: GROUP_LABEL_FONT
                                }
                            ]
                        }
                    ]
                ]);

                // Broken in fin-hypergrid-grouped-header 0.1.2
                let _old_paint = this.grid.cellRenderers.items.GroupedHeader.paint;
                this.grid.cellRenderers.items.GroupedHeader.paint = function(gc, config) {
                    this.visibleColumns = config.grid.renderer.visibleColumns;
                    return _old_paint.call(this, gc, config);
                };

                const grid_properties = generateGridProperties(datadocs_theme_overrides);
                /*
                grid_properties["showRowNumbers"] = grid_properties["showCheckboxes"] || grid_properties["showRowNumbers"];
                grid_properties["treeHeaderBackgroundColor"] = grid_properties["backgroundColor"] = this.get_style("--hypergrid-tree-header--background");
                grid_properties["treeHeaderColor"] = grid_properties["color"] = this.get_style("--hypergrid-tree-header--color");
                grid_properties["columnHeaderBackgroundColor"] = this.get_style("--hypergrid-header--background");
                grid_properties["columnHeaderSeparatorColor"] = this.get_style("--hypergrid-separator--color");
                grid_properties["columnHeaderColor"] = this.get_style("--hypergrid-header--color");

                grid_properties["columnColorNumberPositive"] = this.get_style("--hypergrid-positive--color");
                grid_properties["columnColorNumberNegative"] = this.get_style("--hypergrid-negative--color");
                grid_properties["columnBackgroundColorNumberPositive"] = this.get_style("--hypergrid-positive--background");
                grid_properties["columnBackgroundColorNumberNegative"] = this.get_style("--hypergrid-negative--background");

                const font = `${this.get_style("--hypergrid--font-size")} ${this.get_style("--hypergrid--font-family")}`;
                const headerfont = `${this.get_style("--hypergrid-header--font-size")} ${this.get_style("--hypergrid-header--font-family")}`;

                grid_properties["columnHeaderFont"] = headerfont;
                grid_properties["font"] = font;
                grid_properties["rowHeaderFont"] = font;
                grid_properties["treeHeaderFont"] = font;

                grid_properties["hoverRowHighlight"]["backgroundColor"] = this.get_style("--hypergrid-row-hover--background");
                grid_properties["hoverRowHighlight"]["color"] = this.get_style("--hypergrid-row-hover--color");
                grid_properties["hoverCellHighlight"]["backgroundColor"] = this.get_style("--hypergrid-cell-hover--background");
                grid_properties["hoverCellHighlight"]["color"] = this.get_style("--hypergrid-cell-hover--color");
                */
                this.grid.addProperties(grid_properties);

                this.grid.localization.header = {
                    format: value => this.grid.behavior.formatColumnHeader(value)
                };

                // Add tree cell renderer
                this.grid.cellRenderers.add("TreeCell", Base.extend({paint: treeLineRendererPaint}));

                const float_formatter = null_formatter(
                    new this.grid.localization.NumberFormatter("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })
                );
                this.grid.localization.add("FinanceFloat", float_formatter);

                const integer_formatter = null_formatter(new this.grid.localization.NumberFormatter("en-us", {}));
                this.grid.localization.add("FinanceInteger", integer_formatter);

                const datetime_formatter = null_formatter(
                    new this.grid.localization.DateFormatter("en-us", {
                        week: "numeric",
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                        second: "numeric"
                    }),
                    -1
                );

                const duration_formatter = null_formatter(
                    new this.grid.localization.DateFormatter("en-us", {
                        hour: "numeric",
                        minute: "numeric",
                        second: "numeric"
                    }),
                    -1
                );

                const date_formatter = null_formatter(
                    new this.grid.localization.DateFormatter("en-us", {
                        week: "numeric",
                        year: "numeric",
                        month: "numeric",
                        day: "numeric"
                    }),
                    -1
                );
                this.grid.localization.add("FinanceDatetime", datetime_formatter);
                this.grid.localization.add("FinanceDuration", duration_formatter);
                this.grid.localization.add("FinanceDate", date_formatter);

                this.grid.localization.add("FinanceTree", {
                    format: function(val, type) {
                        const f = {
                            date: date_formatter,
                            datetime: datetime_formatter,
                            duration: duration_formatter,
                            integer: integer_formatter,
                            float: float_formatter
                        }[type];
                        if (f) {
                            return f.format(val);
                        }
                        return val;
                    },
                    parse: x => x
                });

                if (this._hg_data) {
                    this.grid.behavior.setPSP(this._hg_data);
                    delete this._hgdata;
                }
            }
        }
    }
);

const PRIVATE = Symbol("Hypergrid private");

/*function createColumnDef(columnName, index, type, dname){
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
    var headerName = isTree ? 'Row/Col Labels' : ( dname || columnName );
    return {
        colId: index + '',
        field: JSON.stringify({"type": type, "columnName": columnName, "index": index}),
        headerName: headerName,
        originalName: columnName,
        //hide: c.settings.removed,
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
        isTree: isTree
    }

}

function createColumnDefs(columns, schema, dnames = {}) {
    var colDefs = [];
    var rowPathInx = 0;
    columns.forEach((columnName, index)=>{
        colDefs.push(createColumnDef(columnName, index - rowPathInx, schema[columnName], dnames[columnName]));
        if (columnName === "__ROW_PATH__"){
            rowPathInx = 1;
        }
    });

    return colDefs;
}

function getCustomCellRenderer() {
    return function(params) {
        let content = params.value;

        if(_.isObject(content) && content.type === 'ERROR'){
            content = 'Ø';
        }

        return content;
    };
}*/

var EMPTY_FIELDS_COL_ID = "$$empty_fields";
var BLANK_FIELDS_COL_ID = "$$blank_fields";
function isBlankOrEmptyField(column) {
    return column.colId === BLANK_FIELDS_COL_ID
        || column.colId === EMPTY_FIELDS_COL_ID;
}

async function grid_update(div, view, task) {
    const nrows = await view.num_rows();

    if (task.cancelled) {
        return;
    }

    const dataModel = this.hypergrid.behavior.dataModel;
    dataModel.setDirty(nrows);
    dataModel._view = view;
    this.hypergrid.canvas.paintNow();
}

function check_grid_height(_show_grid_data, host){
    if (!host){
        return false;
    }

    if (_show_grid_data){
        //host.classList.remove("not-contain-bottom-panel");
        var contains_no_source_loaded = host.classList.contains("no-source-loaded");
        if (contains_no_source_loaded == true){
            host.classList.remove("no-source-loaded");
            return true;
        }else{
          return false;
        }

    }else{
        //host.classList.add("not-contain-bottom-panel");
        host.classList.add("no-source-loaded");
        return true;
    }
}
/**
 * Create a new <perspective-hypergrid> web component, and attach it to the DOM.
 *
 * @param {HTMLElement} div Attachment point.
 */
async function getOrCreateHypergrid(div, config) {
    let perspectiveHypergridElement;
    if (!this.hypergrid) {
        perspectiveHypergridElement = this[PRIVATE].grid = document.createElement("perspective-hypergrid");
        Object.defineProperty(this, "hypergrid", {
            configurable: true,
            get: () => (this[PRIVATE].grid ? this[PRIVATE].grid.grid : undefined)
        });
    } else {
        perspectiveHypergridElement = this[PRIVATE].grid;
    }

    if (!perspectiveHypergridElement.isConnected) {
        perspectiveHypergridElement.viewConfig = config;
        div.innerHTML = "";
        div.appendChild(perspectiveHypergridElement);
        check_grid_height(this._show_grid_data, perspectiveHypergridElement.shadowRoot.querySelector("#mainGrid"));

        await new Promise(resolve => setTimeout(resolve));
        perspectiveHypergridElement.grid.canvas.resize(false, true);
    } else {
        var resizes_grid = check_grid_height(this._show_grid_data, perspectiveHypergridElement.shadowRoot.querySelector("#mainGrid"));
        this.hypergrid.behavior.dataModel._config = config;
        if (resizes_grid == true){
            perspectiveHypergridElement.grid.canvas.resize(false, true);
        }
    }
    return perspectiveHypergridElement;
}

async function grid_create(div, view, task) {
  const grid_create_timestamp =  performance.now();
  try {
    await view.enable_cache(); if (task.cancelled) {return;}
    await grid_create_impl.apply(this,[div, view, task]);
  } finally {
    await view.disable_cache();
  }
}

async function grid_create_impl(div, view, task) {

    this[PRIVATE] = this[PRIVATE] || {};
    const hypergrid = this.hypergrid;
    if (hypergrid) {
        hypergrid.behavior.dataModel._view = undefined;
    }

    const config = await view.get_config();
    //console.log("grid_create config", config);
    if (task.cancelled) {
        return;
    }

    //const colPivots = config.column_pivots;
    const view_column_pivots = this.get_column_pivots() || [];
    const colPivots = (view_column_pivots && view_column_pivots.length > config.column_pivots.length)
        ? view_column_pivots: config.column_pivots;

    //const rowPivots = config.row_pivots;
    const view_row_pivots = this.get_row_pivots() || [];
    const rowPivots = (view_row_pivots && view_row_pivots.length > config.row_pivots.length)
        ? view_row_pivots: config.row_pivots;

    const window = {
        start_row: 0,
        end_row: Math.max(colPivots.length + 1, rowPivots.length + 1)
    };

    //const [nrows, json, schema, tschema, longest_text_cols] = await Promise.all([view.num_rows(), view.to_columns(window), view.schema(), this._table.schema(), view.longest_text_cols()]);
    const [nrows, columns, schema, tschema, longest_text_cols] = await Promise.all([view.num_rows(), view.all_column_names(), view.schema(), this._table.schema(), view.longest_text_cols()]);
    console.log("grid_create schema", schema);
    console.log("grid_create tschema", tschema);
    console.log("grid_create longest_text_cols", longest_text_cols);
    console.log("grid_create columns", columns);
    if (task.cancelled) {
        return;
    }

    let perspectiveHypergridElement = await getOrCreateHypergrid.call(this, div, config);

    if (task.cancelled) {
        return;
    }

    const dataModel = this.hypergrid.behavior.dataModel;
    //const columns = Object.keys(json);
    const dnames = await view.dname_mapping();
    //var numHeaderRow = 0;
    //var fixedRowsData = [];

    //dataModel.setIsTree(rowPivots.length > 0);
    dataModel.setNBRowPivots(rowPivots.length);
    dataModel.setIsColumnPivot(colPivots.length > 0);
    dataModel.setColPivots(colPivots);
    dataModel.setRowPivots(rowPivots);
    dataModel.setColDepth(colPivots.length);
    dataModel.setDirty(nrows);
    dataModel.resetRowPivotTotalIndex();
    dataModel.setZoomRatio(this.get_current_zoom_ratio());
    const nb_cols = (columns || []).length;
    // Reset the horizontal scroll if number of columns are changed
    dataModel.reset_horizontal_scroll = nb_cols !== dataModel.get_nb_cols() ? true: false;
    dataModel.set_nb_cols(nb_cols);
    dataModel._view = view;
    dataModel.firstFetch = true;
    //dataModel._config = config;
    dataModel._viewer = this;
    var isError = false; // Hard code
    if (!this._show_grid_data){
        isError = false;
    }
    const contains_rowpath_in_firstcolumn = columns[0] == "__ROW_PATH__";
    const isRowPivot = rowPivots.length > 0;
    const is_flat_pivot = this.is_flat_pivot();

    dataModel.pspFetch = async range => {
        var t1 = new Date().getTime();

        var fixedRowCount = perspectiveHypergridElement.grid.properties.fixedRowCount || 0;
        var is_schema_changed = perspectiveHypergridElement.grid.behavior.dataModel.is_schema_changed();
        if (is_schema_changed || !this.fixedRowsData) {
            this.fixedRowsData = perspectiveHypergridElement.grid.api.getFixedRowsData() || [];
            perspectiveHypergridElement.grid.behavior.dataModel.set_schema_changes(false);
        }

        range.end_row += this.hasAttribute("settings") ? 8 : 2;
        //range.start_row = range.start_row - numHeaderRow >= 0 ? range.start_row - numHeaderRow : 0;
        range.start_row = range.start_row - fixedRowCount >= 0 ? range.start_row - fixedRowCount : 0;
        range.end_col += rowPivots && rowPivots.length > 0 ? 1 : 0;

        range.index_map = {};


        // Contains rowpath in visible columns
        var contains_rowpath = (contains_rowpath_in_firstcolumn && range.start_col == 0);

        //var c_range = perspectiveHypergridElement.grid.api.buildColumnsMapping(range, is_flat_pivot === true ? false: isRowPivot, contains_rowpath_in_firstcolumn);
        var c_range = perspectiveHypergridElement.grid.api.buildColumnsMapping(range, is_flat_pivot === true ? (contains_rowpath_in_firstcolumn === true ? true: false): isRowPivot, contains_rowpath_in_firstcolumn);
        range = c_range.range;
        var c_mapping = c_range.mapping;

        let next_page = await dataModel._view.to_columns(range);
        dataModel.data = [];

        let values_obj;
        if (dataModel.get_rowpivot_value_position() !== -1 || (!dataModel.isRowPivot() && dataModel.isColumnPivot())){

          values_obj = {
            needs_alias: true,
            value_position_in_rowpivots: dataModel.get_rowpivot_value_position(),
            value_pivots: dataModel._viewer ? (dataModel._viewer.get_attr_value_pivots() || []): []
          };
        }

        //const rows = page2hypergrid(next_page, rowPivots, columns, contains_rowpath);
        const rows = page2hypergrid(next_page, rowPivots, columns, c_mapping, contains_rowpath, is_flat_pivot, values_obj, contains_rowpath_in_firstcolumn);
        const data = dataModel.data;
        //const base = range.start_row;
        //const base = range.start_row + numHeaderRow;
        const base = range.start_row + fixedRowCount;
        this.fixedRowsData.forEach((row, index) => {
            data[index] = row;
        });

        const rowPathCol = columns.indexOf("__ROW_PATH__");

        rows.forEach((row, index) => {
            var newRow = {};
            var rowPathInx = 0;

            perspectiveHypergridElement.grid.renderer.visibleColumns.forEach((col, inx) => {
                if (inx < 0) {
                    return;
                }
                if(rowPathCol !== -1 && rowPathInx === 0 && col.columnIndex === rowPathCol) {
                    newRow[JSON.stringify({ "columnName": "__ROW_PATH__", "index": rowPathCol })] = row[-1];
                    rowPathInx = 1;
                    return;
                }

                const cell = row[col.columnIndex - rowPathInx];
// console.log('--fetched value--',col.column.name, index, cell);

                // if (typeof cell === "object") {
                //     var error = {
                //         description: cell.description,
                //         rowNumber: index,
                //         type: "ERROR" // cell.type
                //     };
                //     newRow[col.column.name] = error;
                // } else {
                    newRow[col.column.name] = cell;
                // }
            });
            data[base + index] = newRow;
        });
        //perspectiveHypergridElement.grid.api.addHeaderRow(data);

        if (dataModel.firstFetch === true) {
            if (this._show_grid_data && !this._first_load_grid_data){
                //perspectiveHypergridElement.grid.setMouseDown(perspectiveHypergridElement.grid.newPoint(0, 0));
                //perspectiveHypergridElement.grid.canvas.takeFocus();
                //perspectiveHypergridElement.grid.selectionModel.select(0, 0, 0, 0);
                perspectiveHypergridElement.grid.canvas.setMouseDownFirstCell();
                this._first_load_grid_data = true;
            }

            // Need to get number of errors from cpp
            if (isError){
                perspectiveHypergridElement.grid.behavior.errorCount = 5;
            }

            perspectiveHypergridElement.grid.sbVScroller.index = 0;

            if (dataModel.reset_horizontal_scroll === true){
              perspectiveHypergridElement.grid.sbHScroller.index = 0;
              dataModel.reset_horizontal_scroll = false;
            }

            //const columnApi = perspectiveHypergridElement.grid.columnApi;
            //const columnsIds = columnApi.getAllColumns().filter(col => !isBlankOrEmptyField(col) && col.colId);
            //columnApi.autoSizeColumnsWithMaxInitialWidth(columnsIds, true);
            //perspectiveHypergridElement.grid.api.sizeColumnsToFit();
        }
        console.log("pspFetch===========", new Date().getTime() - t1);
    };

    dataModel.pspFetchDataCellValue = async (range, force_primary) => {
        var t1 = new Date().getTime();
        var fixedRowCount = perspectiveHypergridElement.grid.properties.fixedRowCount || 0;

        //range.start_col = range.start_col;
        //range.end_col = range.end_col;

        range.start_row = Math.max(range.start_row - fixedRowCount, 0);
        range.end_row = Math.max(range.end_row - fixedRowCount, 0);

        range.index_map = {};
        range.full_value = true;

        // Contains rowpath in visible columns
        var contains_rowpath = (contains_rowpath_in_firstcolumn && range.start_col == 0);

        var c_range = perspectiveHypergridElement.grid.api.buildColumnsMapping(range, is_flat_pivot === true ? false: isRowPivot, contains_rowpath_in_firstcolumn, force_primary);

        if (force_primary == true && !c_range){
            return undefined;
        }
        range = c_range.range;
        var c_mapping = c_range.mapping;

        let next_page = await dataModel._view.to_columns(range);
        const rows = page2hypergrid(next_page, rowPivots, columns, c_mapping, contains_rowpath, is_flat_pivot);
        var data = undefined;
        const base = range.start_row + fixedRowCount;

        const rowPathCol = columns.indexOf("__ROW_PATH__");

        if (rows && rows.length > 0){
            var row_data = rows[0];

            if (rowPathCol !== -1 && row_data["-1"]){
              data = row_data["-1"];
            }else{
              var row_data_keys = Object.keys(row_data);
              if (row_data_keys && row_data_keys.length > 0){
                  data = row_data[row_data_keys[0]];
              }
            }
        }

        console.log("pspFetchCellValue===========", new Date().getTime() - t1);
        return data;
    };

    dataModel.copyFetch = async range => {
        var fixedRowCount = perspectiveHypergridElement.grid.properties.fixedRowCount || 0;
        var fixedRowsData = perspectiveHypergridElement.grid.api.getFixedRowsData() || [];
        range.start_row = range.start_row - fixedRowCount >= 0 ? range.start_row - fixedRowCount : 0;
        range.end_row = range.end_row - fixedRowCount >= 0 ? range.end_row - fixedRowCount : 0;

        // Only copy header
        if (range.start_row == 0 && range.end_row < fixedRowCount /*range.end_row == 0*/){
            dataModel.copyData = [];
            const copyData = dataModel.copyData;
            //perspectiveHypergridElement.grid.api.addHeaderRow(copyData, range.start_col, range.end_col);
            perspectiveHypergridElement.grid.api.addFixedRowsData(copyData, range.start_col, range.end_col);
            return;
        }

        // Columns Mapping
        range.index_map = {};
        range.full_value = true;

        // Contains rowpath in visible columns
        var contains_rowpath = (contains_rowpath_in_firstcolumn && range.start_col == 0);

        var c_range = perspectiveHypergridElement.grid.api.buildColumnsMapping(range, isRowPivot, contains_rowpath_in_firstcolumn);
        range = c_range.range;
        var c_mapping = c_range.mapping;

        let next_page = await dataModel._view.to_columns(range);
        dataModel.copyData = [];
        //const rows = page2hypergrid(next_page, rowPivots, columns);
        const rows = page2hypergrid(next_page, rowPivots, columns, c_mapping, contains_rowpath, is_flat_pivot);
        const copyData = dataModel.copyData;
        const base = range.start_row;
        var c_indexes = [];
        if (rows && rows.length > 0){
            c_indexes = Object.keys(rows[0]) || [];
        }

        var grid_columns = perspectiveHypergridElement.grid.behavior.columns;
        rows.forEach((row, index) => {
            var newRow = {};
            /*var rowPathInx = 0;
            columns.forEach((colName, inx) => {
                if (colName === "__ROW_PATH__"){
                    rowPathInx = 1;
                    var columnInfoIdentifier = JSON.stringify({"columnName": colName, "index": inx});
                    newRow[columnInfoIdentifier] = row[-1];
                    return;
                }
                var colIndex = inx - rowPathInx;
                var columnInfoIdentifier = JSON.stringify({"type": schema[colName], "columnName": colName, "index": colIndex});
                newRow[columnInfoIdentifier] = row[colIndex];
            });*/
            c_indexes.forEach((inx) =>{
                var _c = grid_columns[contains_rowpath ? parseInt(inx) + 1: parseInt(inx)];
                if (_c.colDef && _c.colDef.field){
                    newRow[_c.colDef.field] = row[inx];
                }
            });
            copyData[base + index] = newRow;
        });
        //perspectiveHypergridElement.grid.api.addHeaderRow(copyData, range.start_col, range.end_col);
        perspectiveHypergridElement.grid.api.addFixedRowsData(copyData, range.start_col, range.end_col);
    };

    dataModel.pspExport = async (format="CSV", range) => {
        var fixedRowCount = perspectiveHypergridElement.grid.properties.fixedRowCount || 0;
        if (!range){
            range = {start_row: 0, end_row: nrows - (fixedRowCount >= 1 ? 1: 0)};
        }
        range.start_row = 0;
        range.end_row = nrows - (fixedRowCount >= 1 ? 1: 0);

        range.start_col = 0;
        range.end_col = perspectiveHypergridElement.grid.behavior.dataModel.getColumnsWithValuesCount();

        // Columns Mapping
        range.index_map = {};
        range.full_value = true;

        // Contains rowpath in visible columns
        var contains_rowpath = (contains_rowpath_in_firstcolumn && range.start_col == 0);

        var c_range = perspectiveHypergridElement.grid.api.buildColumnsMapping(range, isRowPivot, contains_rowpath_in_firstcolumn);
        range = c_range.range;
        var c_mapping = c_range.mapping;

        let next_page = await dataModel._view.to_columns(range);
        var exportData = [];
        //const rows = page2hypergrid(next_page, rowPivots, columns);
        const rows = page2hypergrid(next_page, rowPivots, columns, c_mapping, contains_rowpath, is_flat_pivot);
        const base = range.start_row;
        //const hasRowPath = (columns && columns.length > 0 && columns[0] === "__ROW_PATH__") ? true : false;

        var c_indexes = [];
        if (rows && rows.length > 0){
            c_indexes = Object.keys(rows[0]) || [];
        }

        var grid_columns = perspectiveHypergridElement.grid.behavior.columns;
        /*if (hasRowPath){
            rows.forEach((row, index) => {
                var newRow = {};
                columns.forEach((colName, inx) => {
                    if (inx == 0 && row[inx - 1].rollup){
                        newRow[inx] = row[inx - 1].rollup;
                    }else{
                        newRow[inx] = row[inx - 1];
                    }
                });
                exportData[base + index] = newRow;
            });
        }else{
            exportData = rows;
        }*/

        rows.forEach((row, index) => {
            var newRow = {};
            c_indexes.forEach((inx) =>{
                var _c = grid_columns[contains_rowpath ? parseInt(inx) + 1: parseInt(inx)];
                if (_c.colDef && _c.colDef.field){
                    newRow[contains_rowpath ? parseInt(inx) + 1: parseInt(inx)]
                      = (contains_rowpath &&  parseInt(inx) === -1 && _c.colDef.originalName === "__ROW_PATH__")
                      ? (row[inx].rollup !== undefined ? row[inx].rollup: null)
                      : row[inx];
                }
            });
            exportData[base + index] = newRow;
        });

        var is_stack_header = dataModel.isStackHeader();
        var is_stackheader_with_flat_pivot = dataModel.isStackHeaderWithFlatPivot();

        var hC = (perspectiveHypergridElement.grid.columnDefs || []).filter((v)=>!v.isHidden).map(function(c){return c.headerName});

        var hc_fixed_rows = [];
        if (is_stack_header){
            var raw_hc_fixed_rows = perspectiveHypergridElement.grid.api.exportFixedRowsData();
            if (raw_hc_fixed_rows.length > 0){
                for (var hj=0; hj<raw_hc_fixed_rows.length; hj++){
                    var hc_data = [];
                    for (var key in raw_hc_fixed_rows[hj]) {
                        if (raw_hc_fixed_rows[hj].hasOwnProperty(key)) {
                            if (key != "__META"){
                                hc_data.push(raw_hc_fixed_rows[hj][key].value);
                            }
                        }
                    }
                    hc_fixed_rows.push(hc_data);
                }
            }

            if (hc_fixed_rows.length > 0){
                if (format === "JSON"){

                }else{
                    hC = hc_fixed_rows[0];
                }
            }

            for (var hj = hc_fixed_rows.length -1; hj > 0; hj--){
                exportData.unshift(Object.assign({}, hc_fixed_rows[hj]));
            }

        }else{
            hc_fixed_rows.push(hC);
        }

        var hCT = (perspectiveHypergridElement.grid.columnDefs || []).filter((v)=>!v.isHidden).map(function(c, _index){ var _field = JSON.parse(c.field); return {name: is_stack_header === true ? hC[_index]: c.headerName, type: _field.type, index: _field.index}});

        var arrTypes = ["list_string", "list_boolean", "list_integer", "list_date", "list_duration", "list_datetime"];

        if (!format || format == "CSV"){
            let csvContent = "";//"data:text/csv;charset=utf-8,";

            const createCsvStringifier = csvWriter.createObjectCsvStringifier;
            const csvStringifier = createCsvStringifier({
                header: hc_fixed_rows[0].map((row) =>{return {id: row, title: row}})
            });

            var records = [];
            if (is_stack_header){
                csvContent = csvContent + csvStringifier.getHeaderString();
                for (var i = 0; i < exportData.length; i++) {
                    var line = '';
                    for (var index in exportData[i]) {
                        if (line != '') line += ','

                        var s = exportData[i][index];
                        if (typeof s === "string"){
                            s = s.replace(/"/g, '""');
                            if (s.search(/("|,|\n)/g) >= 0){
                                s = '"' + s + '"';
                            }
                        }

                        line += s;
                    }

                    csvContent += line + '\r\n';
                }
                return csvContent;
            }else{
                for (var i = 0; i < exportData.length; i++) {
                    var _erow = {};
                    for (var index in exportData[i]) {
                        if (hCT[index] && arrTypes.includes(hCT[index].type)){
                            if (exportData[i][index] && _erow[hC[index]] != ""){
                              _erow[hC[index]] = "[" + exportData[i][index] + "]";
                            }else{
                              _erow[hC[index]] = "";
                            }
                        }else{
                            var needs_dquote_escape = false;
                            if (typeof exportData[i][index] == "string"){
                                var firstChar = exportData[i][index].trim().charAt(0);
                                if (firstChar == "{" || firstChar == "[" // Json
                                    || firstChar == "<" // Xml
                                ){
                                    needs_dquote_escape = true;
                                }
                            }

                            if (needs_dquote_escape == true){
                                _erow[hC[index]] = exportData[i][index];//.replace(/\"/g, '\\"');
                            }else{
                                _erow[hC[index]] = exportData[i][index];
                            }

                        }
                    }

                    records.push(_erow);
                }

                //return csvContent + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
                return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
            }

            /*
            csvContent += hC.join(",") + '\r\n';

            for (var i = 0; i < exportData.length; i++) {
                var line = '';
                for (var index in exportData[i]) {
                    if (line != '') line += ','

                    line += exportData[i][index];
                }

                csvContent += line + '\r\n';
            }
            return csvContent;
            */
        }else if(format == "EXCEL"){

            // Using ZIPCELX
            var ws_name = "Sheet1";
            var filename = dataModel._viewer._file_name;

            var records = [];
            records.push(hCT.map((c) =>{return {value: c.name, type: "string"};}));
            for (var i = 0; i < exportData.length; i++) {
                var _erow = [];
                for (var index in exportData[i]) {
                    if (hCT[index] && arrTypes.includes(hCT[index].type)){
                        if (exportData[i][index] && _erow[hC[index]] != ""){
                            _erow.push({value: "[" + (exportData[i][index] ? exportData[i][index] : "") + "]", type: "string"});
                        }else{
                          _erow.push({value: "", type: "string"});
                        }
                    }else{
                        _erow.push({value: exportData[i][index], type: (hCT[index].type === "integer" || hCT[index].type === "float") ? 'number': "string"});
                    }
                }

                records.push(_erow);
            }

            const xlsx_config = {
                filename: filename,
                sheet: {
                    data: records
                }
            };

            zipcelx(xlsx_config);

            /*
            // Using JS-XLSX
            var filename = "excel.xlsx";
            var ws_name = "Sheet1";

            var records = [];
            records.push(hCT.map((c) =>{return c.name;}));
            for (var i = 0; i < exportData.length; i++) {
                var _erow = [];
                for (var index in exportData[i]) {
                    if (hCT[index] && arrTypes.includes(hCT[index].type)){
                        if (exportData[i][index] && _erow[hC[index]] != ""){
                          _erow.push("[" + (exportData[i][index] ? exportData[i][index] : "") + "]");
                        }else{
                          _erow.push("");
                        }
                    }else{
                        _erow.push(exportData[i][index]);
                    }
                }

                records.push(_erow);
            }

            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.aoa_to_sheet(records);
            XLSX.utils.book_append_sheet(wb, ws, ws_name);
            XLSX.writeFile(wb, filename);
            */

            /*
            const TEMPLATE_XLS = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
                <head><!--[if gte mso 9]><xml>
                <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{title}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml>
                <![endif]--></head>
                <body>{table}</body></html>`;
            const MIME_XLS = 'application/vnd.ms-excel;base64,';

            // extract keys from the first object, will be the title for each column
            const colsHead = `<tr>${hC.map(_v => `<td>${_v}</td>`).join('')}</tr>`;

            const colsData = exportData.map(obj => [`<tr>
                        ${Object.keys(obj).map(col => `<td>${obj[col] ? obj[col] : ''}</td>`).join('')}
                    </tr>`]) // 'null' values not showed
              .join('');

            let table = `<table>${colsHead}${colsData}</table>`.trim(); // remove spaces...

            const parameters = {
              title: "excel",
              table: table,
            };
            const computeOutput = TEMPLATE_XLS.replace(/{(\w+)}/g, (x, y) => parameters[y]);

            const computedXLS = new Blob([computeOutput], {
              type: MIME_XLS,
            });

            return computedXLS;
            */

        }else if (format == "JSON"){
            let jsonContent = "data:text/json;charset=utf-8,";
            const colsData = exportData.map(obj => {

                    Object.keys(obj).map(col => {
                        //return obj[col] ? hC[col] + ':' + obj[col] : '';
                        //obj[hC[col]] = obj[col] ? hC[col] + ':' + obj[col] : '';
                        obj[hC[col]] = (obj[col] !== undefined) ? obj[col] : null;
                        delete obj[col];
                    });

                    return obj;

                }); // 'null' values not showed
            //return jsonContent + encodeURIComponent(JSON.stringify(colsData, null, 4));
            return JSON.stringify(colsData, null, 4);
        }

        /*for (var i = 0; i < rows.length; i++) {
            var line = '';
            for (var index in rows[i]) {
                if (line != '') line += ','

                line += rows[i][index];
            }

            csvContent += line + '\r\n';
        }*/

        //rows.forEach((rowArray) => {
        //    let row = rowArray.join(",");
        //    csvContent += row + "\r\n";
        //});
        //var encodedUri = encodeURI(csvContent);
        //window.open(encodedUri);
        //var encodedUri = encodeURI(csvContent);
        //var link = document.createElement("a");
        //link.setAttribute("href", encodedUri);
        //link.setAttribute("download", "file.csv");
        //document.body.appendChild(link); // Required for FF
        //link.click();

    };

    // Init c_info
    /*if (dataModel._viewer.is_column_pivot(true)) {
        // Don't need to set c_info in case column pivot/split by
    }else*/ if (dataModel._viewer.is_row_pivot(true) || dataModel._viewer.is_value_pivot(true)
      || dataModel._viewer.is_column_pivot(true)
      ) {
        var c_info_pivot = [];
        var column_width_cache = dataModel._viewer._get_column_width_cache_pivot() || [];

        const is_using_prev_cinfo = dataModel._viewer.keep_using_prev_cols_settings;
        var prev_cinfo_settings = [];

        if (is_using_prev_cinfo === true){

          // Only get things that have been changed in order to improve performance
          prev_cinfo_settings = (perspectiveHypergridElement.grid.behavior.dataModel._viewer.get_cinfo() || []).filter((v)=>v.active === false || v.hide_when_not_tree === true);

          columns.forEach((c, i) =>{
              let w;
              let user_width;

              var active = true;
              var u_index = i;
              var dname = c;
              let is_search_selected;
              let default_search_type;
              let search_type;
              let sort_order;
              let sort_num;
              let default_data_format;
              let data_format;
              let default_aggregate;
              let aggregate;
              let hide_when_not_tree;
              //if (is_hidding_rows === true){
                  var fi = prev_cinfo_settings.findIndex((item)=>item.name === c);
                  if (fi != -1){
                      if (prev_cinfo_settings[fi].index != undefined){
                          u_index = prev_cinfo_settings[fi].index;
                          active = prev_cinfo_settings[fi].active;
                          dname = prev_cinfo_settings[fi].dname || c;
                          is_search_selected = prev_cinfo_settings[fi].is_search_selected;
                          default_search_type = prev_cinfo_settings[fi].default_search_type;
                          search_type = prev_cinfo_settings[fi].search_type;
                          sort_order = prev_cinfo_settings[fi].sort_order;
                          sort_num = prev_cinfo_settings[fi].sort_num;
                          default_data_format = prev_cinfo_settings[fi].default_data_format;
                          data_format = prev_cinfo_settings[fi].data_format;
                          default_aggregate = prev_cinfo_settings[fi].default_aggregate;
                          aggregate = prev_cinfo_settings[fi].aggregate;
                          hide_when_not_tree = prev_cinfo_settings[fi].hide_when_not_tree;
                          user_width = prev_cinfo_settings[fi].user_width;
                      }
                  }
              //}
              //c_info_pivot.push(dataModel._viewer._build_cinfo_item(c, u_index, i, dname, active, w, null, longest_text_cols[c],
              //    schema[c], is_search_selected, default_search_type, search_type, sort_order, sort_num,
              //    default_data_format, data_format, default_aggregate, aggregate));

              if (!user_width && column_width_cache[c] && column_width_cache[c].user_width){
                user_width = column_width_cache[c].user_width;
              }

              if (user_width){
                // Pass
              }else if (column_width_cache[c] && (column_width_cache[c].default_width || column_width_cache[c].user_width)){
                  w = column_width_cache[c].user_width || column_width_cache[c].default_width;
              }else{
                  w = perspectiveHypergridElement.grid.api.getDefaultColumnWidth(c, longest_text_cols[c]);
                  dataModel._viewer._update_column_width_cache_default(c, w);
              }

              let bc_item = dataModel._viewer._build_cinfo_item(c, u_index, i, dname, active, user_width || w, user_width, longest_text_cols[c],
                  schema[c], is_search_selected, default_search_type, search_type, sort_order, sort_num,
                  default_data_format, data_format, default_aggregate, aggregate);
              if (hide_when_not_tree === true){
                bc_item.hide_when_not_tree = hide_when_not_tree;
              }
              c_info_pivot.push(bc_item);
          });


        }else{
          columns.filter(function(value){return value != "__ROW_PATH__";}).forEach((c, i) =>{
              //var w = perspectiveHypergridElement.grid.api.getDefaultColumnWidth(c, longest_text_cols[c]);
              var w;
              let user_width;

              if (column_width_cache[c] && column_width_cache[c].user_width){
                user_width = column_width_cache[c].user_width;
              }
              if (column_width_cache[c] && (column_width_cache[c].default_width || column_width_cache[c].user_width)){
                  w = column_width_cache[c].user_width || column_width_cache[c].default_width;
              }else{
                  w = perspectiveHypergridElement.grid.api.getDefaultColumnWidth(c, longest_text_cols[c]);
                  dataModel._viewer._update_column_width_cache_pivot(c, w);
              }
              c_info_pivot.push(dataModel._viewer._build_cinfo_item(c, i, i, c, true, w, user_width, longest_text_cols[c], schema[c]));
          });
        }

        dataModel._viewer.set_cinfo(c_info_pivot, true);

        dataModel._viewer.keep_using_prev_cols_settings = false;

    }/*else if(dataModel._viewer.is_cinfo_search()){
        var c_info_search = [];
        var column_width_cache = dataModel._viewer.get_column_width_cache() || [];

        columns.forEach((c, i) =>{
            var w = undefined;
            if (column_width_cache[c]){
                w = column_width_cache[c];
            }else{
                w = perspectiveHypergridElement.grid.api.getDefaultColumnWidth(c, longest_text_cols[c]);
                dataModel._viewer.update_column_width_cache(c, w);
            }
            c_info_search.push(dataModel._viewer._build_cinfo_item(c, i, i, c, true, w, null, longest_text_cols[c], schema[c]));
        });
        dataModel._viewer.set_cinfo(c_info_search, true);
    }*/else{
        var _c_info = [];
        var column_width_cache = dataModel._viewer._get_column_width_cache_default() || [];

        var is_hidding_rows = dataModel._viewer.is_hidding_rows;
        var pre_c_info = [];
        //if (is_hidding_rows === true){
            pre_c_info = perspectiveHypergridElement.grid.behavior.dataModel._viewer.get_cinfo();
        //}

        columns.forEach((c, i) =>{
            let w;
            let user_width;

            var active = true;
            var u_index = i;
            var dname = c;
            let is_search_selected;
            let default_search_type;
            let search_type;
            let sort_order;
            let sort_num;
            let default_data_format;
            let data_format;
            let default_aggregate;
            let aggregate;
            let computed_expression;

            var fi = pre_c_info.findIndex((item)=>item.name === c);
            if (fi != -1){
                if (pre_c_info[fi].index != undefined){
                    u_index = pre_c_info[fi].index;
                    active = pre_c_info[fi].active;
                    dname = pre_c_info[fi].dname || c;
                    is_search_selected = pre_c_info[fi].is_search_selected;
                    default_search_type = pre_c_info[fi].default_search_type;
                    search_type = pre_c_info[fi].search_type;
                    sort_order = pre_c_info[fi].sort_order;
                    sort_num = pre_c_info[fi].sort_num;
                    default_data_format = pre_c_info[fi].default_data_format;
                    data_format = pre_c_info[fi].data_format;
                    default_aggregate = pre_c_info[fi].default_aggregate;
                    aggregate = pre_c_info[fi].aggregate;
                    user_width = pre_c_info[fi].user_width;
                    computed_expression = pre_c_info[fi].computed_expression;
                }
            }

            const computed_columns = JSON.parse(dataModel._viewer.getAttribute("computed-columns"));
            if (computed_columns) {
              for (const computed of computed_columns) {
                if (computed.column == c) {
                  computed_expression = computed.expression;
                }
              }
            }

            if (!user_width && column_width_cache[c] && column_width_cache[c].user_width){
              user_width = column_width_cache[c].user_width;
            }

            if (user_width){
              // Pass
            }else if (column_width_cache[c] && (column_width_cache[c].default_width || column_width_cache[c].user_width)){
                w = column_width_cache[c].user_width || column_width_cache[c].default_width;
            }else{
                w = perspectiveHypergridElement.grid.api.getDefaultColumnWidth(c, longest_text_cols[c]);
                dataModel._viewer._update_column_width_cache_default(c, w);
            }

            _c_info.push(dataModel._viewer._build_cinfo_item(c, u_index, i, dname, active, user_width || w, user_width, longest_text_cols[c],
                schema[c], is_search_selected, default_search_type, search_type, sort_order, sort_num,
                default_data_format, data_format, default_aggregate, aggregate, computed_expression));
        });

        dataModel._viewer.set_cinfo(_c_info, true);
        dataModel._viewer.is_hidding_rows = false;

    }

    var colDefs = [];
    if (dataModel._viewer.is_cinfo_pivot(true)) {
        colDefs = perspectiveHypergridElement.grid.api.createColumnDefs(dataModel.isTree() ? columns.filter(function(value){return value != "__ROW_PATH__";}): columns, schema, tschema, dnames, longest_text_cols);
    }else{
        colDefs = this.hypergrid.api.buildColumnDefs(perspectiveHypergridElement.grid.behavior.dataModel._viewer.get_cinfo());
    }

    if (isError){
        // Hard code - waiting for returning error (column) info from CPP
        colDefs[0].hasError = true;
        colDefs[0].errorCount = 100;
        colDefs[0].firstError = {
          description: '',
          rowNumber: 0,
          type: "ERROR"
        };
    }
    perspectiveHypergridElement.grid.api.setColumnDefs(colDefs);
    perspectiveHypergridElement.grid.api.setColumnErrors();
    /*
    if (column) {
        column.hasError = true;
        column.errorCount = _this5.errors[columnName].length;
        column.firstError = _this5.errors[columnName][0];

        var colDef = column.colDef;
        if (colDef) {
            colDef.errorCount = _this5.errors[columnName].length;
        }
    }
    */
    //fixedRowCount = perspectiveHypergridElement.grid.properties.fixedRowCount || 0;
    //fixedRowsData = perspectiveHypergridElement.grid.api.getFixedRowsData();

    /*var range = {
        start_col: 0,
        end_col: 20,
        start_row: 0,
        end_row: nrows
    };
    let next_page = await dataModel._view.to_columns(range);
    const rows = page2hypergrid(next_page, rowPivots, columns);
    var data = [];
    rows.forEach((row, _) => {
        var newRow = {};
        columns.forEach((colName, index) => {
            var columnInfoIdentifier = JSON.stringify({"type": schema[colName], "columnName": colName, "index": index});
            newRow[columnInfoIdentifier] = row[index];
        });
        data.push(newRow);
    });
    perspectiveHypergridElement.grid.api.setRowData(data);*/


    this.hypergrid.renderer.computeCellsBounds(true);
    var self = this;
    this.hypergrid.canvas.hasFocus = function() {
        return self === document.activeElement;
    };

    // In grid_create, no need to resize canvas because it will be resized automatically.
    // And calling paintNow() twrice is meaningless.
    // await this.hypergrid.canvas.resize(true);
    this.hypergrid.canvas.paintNow();
  }

global.registerPlugin("hypergrid", {
    name: "Grid",
    create: grid_create,
    selectMode: "toggle",
    update: grid_update,
    deselectMode: "pivots",
    resize: async function() {
        if (this.hypergrid) {
            this.hypergrid.canvas.checksize();
            //this.hypergrid.canvas.checkLastRowToResize();
            this.hypergrid.canvas.paintNow();
            //let nrows = await this._view.num_rows();
            //this.hypergrid.behavior.dataModel.setDirty(nrows);
            this.hypergrid.canvas.paintNow();
            //this.hypergrid.behavior.dataModel._viewer.update_status_bar_width(Math.floor(this.hypergrid.div.clientWidth));
            if (this.hypergrid.behavior.dataModel._viewer){
              this.hypergrid.behavior.dataModel._viewer.update_status_bar_width();
            }

        }
    },
    _resize: async function() {
        if (this.hypergrid) {
            this.hypergrid.canvas.checksize();
            this.hypergrid.canvas.paintNow();
            this.hypergrid.canvas.paintNow();
        }
    },
    delete: function() {
        if (this.hypergrid) {
            this.hypergrid.terminate();
            this.hypergrid.div = undefined;
            this.hypergrid.canvas.div = undefined;
            this.hypergrid.canvas.canvas = undefined;
            this.hypergrid.sbVScroller = undefined;
            this.hypergrid.sbHScroller = undefined;
            delete this[PRIVATE]["grid"];
        }
    },
    update_column_displayname(c_info) {
        var newColDefs = [];

        this.hypergrid.columnDefs.forEach((c, i) => {
            if (c_info[c.originalName]) {
                c.headerName = c_info[c.originalName];
            }
            newColDefs[i] = c;
        });
        this.hypergrid.behavior.dataModel.setKeepSelection(true);
        this.hypergrid.api.setColumnDefs(newColDefs);
    },

    // In case stack headers
    update_value_pivot_displayname(base_name, alias) {
        if (base_name === undefined){
          return;
        }

        const is_stack_header = this.hypergrid.behavior.dataModel.isStackHeader();
        const value_position = this.hypergrid.behavior.dataModel.get_colpivot_value_position();

        let newColDefs = [];
        let compareColDefs = [];

        if (is_stack_header && value_position >= 0){

          this.hypergrid.columnDefs.forEach((c, i) => {

            // Update stack columns
            if (c.stack_columns && c.stack_columns.length > 0 && base_name === c.stack_columns[value_position]){

              // Init the stack aliases if not existed
              if (!c.stack_aliases || (c.stack_aliases && c.stack_aliases.length !== c.stack_columns.length)){
                c.stack_aliases = [ ...c.stack_columns ];
              }

              c.stack_aliases[value_position] = alias;
            }

            newColDefs[i] = c;
            compareColDefs[i] = JSON.parse(JSON.stringify(c));

          });

            compareColDefs = compareColDefs.map((v)=>{v.stack_values = []; return v;});
            compareColDefs = this.hypergrid.api._createColDefs(compareColDefs, undefined, true);

            // Need to merge and update stack values
            newColDefs = this.hypergrid.api._merge_stack_values(newColDefs, compareColDefs);

            this.hypergrid.behavior.dataModel._dirty = true;
            this.hypergrid.behavior.dataModel.setKeepSelection(true);
            this.hypergrid.api.setColumnDefs(newColDefs);
        }else{
          //newColDefs = this.hypergrid.columnDefs;
          //this.hypergrid.behavior.dataModel.set_schema_changes(true);

          this.hypergrid.behavior.dataModel._dirty = true;
          this.hypergrid.canvas.paintNow();
        }
    },

    update_column_new_name(danme_map) {

        const is_stack_header = this.hypergrid.behavior.dataModel.isStackHeader();
        //const is_stackheader_with_flat_pivot = this.hypergrid.behavior.dataModel.isStackHeaderWithFlatPivot();

        let newColDefs = [];
        let compareColDefs = [];

        this.hypergrid.columnDefs.forEach((c, i) => {
            const curr_original_name = c.originalName;
            if (danme_map[curr_original_name]) {
                const new_original_name = danme_map[curr_original_name].new_original_name;

                // Update the original column name
                c.originalName = new_original_name;
                c.pre_original_name = curr_original_name;

                // Update the column alias
                c.headerName = danme_map[curr_original_name].dname;

                // Update the column key/field
                let field = JSON.parse(c.field || "{}");
                if (field.columnName === curr_original_name){
                  field.columnName = new_original_name;
                  c.field = JSON.stringify(field);
                }

                if (is_stack_header){
                  // Update stack columns
                  if (c.stack_columns && c.stack_columns.length > 0){
                    c.stack_columns = new_original_name.split("|");
                  }
                }
            }
            newColDefs[i] = c;

            if (is_stack_header){
              compareColDefs[i] = JSON.parse(JSON.stringify(c));
            }
        });

        if (is_stack_header){
          compareColDefs = compareColDefs.map((v)=>{v.stack_values = []; return v;});
          compareColDefs = this.hypergrid.api._createColDefs(compareColDefs, undefined, true);

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

          newColDefs = this.hypergrid.api._merge_stack_values(newColDefs, compareColDefs);
        }

        this.hypergrid.behavior.dataModel.setKeepSelection(true);
        this.hypergrid.api.setColumnDefs(newColDefs);
    },

    notify_column_updates(c_info){
        // Need to change hypergrid's cache to use columns indexes instead of using range with start col and end col.
        // Once it's done, we will remove a line code bellow regarding dirty
        this.hypergrid.behavior.dataModel._dirty = true;

        var colDefs = this.hypergrid.api.buildColumnDefs(c_info);
        this.hypergrid.api.setColumnDefs(colDefs);

        // Will remove this line once the default width issue is done

        //this.hypergrid.api.sizeColumnsToFit();
    },

    notify_column_widths(column_widths){
      if (!column_widths || typeof column_widths !== "object"){
        return;
      }

      if (!this.hypergrid.columnDefs){
        return;
      }

      this.hypergrid.columnDefs.forEach((v)=>{
        if (column_widths[v.originalName]){
          if (column_widths[v.originalName].default_width || column_widths[v.originalName].user_width){
            v.default_width = column_widths[v.originalName].default_width;
            v.user_width = column_widths[v.originalName].user_width;
          }
        }
      });
      this.hypergrid.api.setColumnDefs(this.hypergrid.columnDefs);

    },

    get_nb_cols(){
      if (this.hypergrid){
        return this.hypergrid.behavior.dataModel.get_nb_cols();
      }
      return 0;
    },

    // Get the selected columns
    selected_columns(){

      if (this.hypergrid){
        var selected_columns = this.hypergrid.getSelectedColumns() || [];

        var columns = this.hypergrid.behavior.columns;

        var co_names = selected_columns.map(function(i){
            return columns[i].colDef ? columns[i].colDef.originalName : undefined;
        }).filter(function(v){
            return v;
        });

        return co_names;
      }
    },

    update_zoom_ratio(scale){
      this.hypergrid.api.update_zoom_ratio(scale);
    },

    /*
    Get the selected columns to apply sort feature
    * DEFAULT
    * [{n: HeaderA}]
    *
    * ROWS pivots
    * [{n: HeaderA, tree_level: 1, in_pivot: row_pivots}]
    *
    * COLUMNS pivots
    * [{n: HeaderA, in_pivot: column_pivots}]
    */
    async selected_columns_to_apply_sort(){

      if (this.hypergrid){
        var selected_columns = this.hypergrid.getSelectedColumns() || [];

        var columns = this.hypergrid.behavior.columns;

        var co_names = selected_columns.map(function(i){
            return columns[i].colDef ? columns[i].colDef.originalName : undefined;
        }).filter(function(v){
            return v;
        });

        var results = co_names.map((v)=>{return {n: v}; });

        var is_row_pivot = this.hypergrid.behavior.dataModel.isRowPivot();
        var is_column_pivot = this.hypergrid.behavior.dataModel.isColumnPivot();
        var is_value_pivot = this.hypergrid.behavior.dataModel.is_value_pivot();
        var is_stack_header = this.hypergrid.behavior.dataModel.isStackHeader();

        // ROWS, COLUMNS, VALUES pivots
        if (is_row_pivot || is_column_pivot || is_value_pivot){
          var row_pivots = this.hypergrid.behavior.dataModel.getRowPivots();
          var fixedRowCount = this.hypergrid.properties.fixedRowCount || 0;
          var col_pivots = this.hypergrid.behavior.dataModel.getColPivots();
          var value_pivots = this.hypergrid.behavior.dataModel.get_value_pivots();
          var value_position = this.hypergrid.behavior.dataModel.get_colpivot_value_position();
          var raw_value_pivots = this.hypergrid.behavior.dataModel._viewer.get_value_obj_pivots();

          var selections = this.hypergrid.selectionModel.getSelections();
          if (!results){
            results = [];
          }
          if (!selections){
            selections = [];
          }

          // Error
          if ((results.length > 1) || (selections.length > 1)){
            alert("This can't be done on a multiple range selection. Select a single range and try again.");
            return [];
          }else if(results.length == 1){

            // Only one row aggregation, no column pivots (accept the value item)
            if (is_row_pivot && row_pivots.length === 1 && (!is_column_pivot || (col_pivots.length === 1 && value_position != -1))){
              // Pass
            }else{
              //alert("We can't make this change for the selected cells because it will affect a Pivot. Use the field list to change the report. If you are trying to insert or delete cells, move the Pivot and try again");
              alert("Sorry, we could not determine which field to sort by. Please use the Row or Col Labels dropdown to choose the necessary sort.");
              return [];
            }
          }

          if (results.length > 0){
            // Only one row aggregation, no column pivots (accept the value item)
            if (is_row_pivot && row_pivots.length === 1 && (!is_column_pivot || (col_pivots.length === 1 && value_position != -1))){
              for (var i=0; i < results.length; i++){

                if (results[i].n === "__ROW_PATH__"){

                  if (row_pivots && row_pivots.length > 0){
                    results[i].n = row_pivots[0];
                  }
                  results[i].level = 0;
                  results[i].in_pivot = "row_pivots";
                  results[i].valid = true;
                }else if(is_value_pivot && raw_value_pivots.length > 0){ // Auto detect VALUES

                  var m_i = raw_value_pivots.findIndex((v)=>v.dname === results[i].n);

                  if (m_i != -1){
                    results[i].sort_by = raw_value_pivots[m_i].base_name;
                    results[i].level = 0;
                    results[i].in_pivot = "value_pivots";
                    results[i].valid = true;
                  }
                }
              }
            }
          }else{
            var cell_selection = this.hypergrid.selectionModel.getFirstSelectedCellOfLastSelection();
            var cell_column_selection = [];
            if (cell_selection){
              cell_column_selection.push({x: cell_selection.x, y: cell_selection.y});
            }

            var results = cell_column_selection.map(function(p){
                return columns[p.x].colDef
                  ? {n: columns[p.x].colDef.originalName, x: p.x, y: p.y,
                    index: columns[p.x].colDef.original_index,
                    original_index: is_row_pivot ? columns[p.x].colDef.original_index + 1: columns[p.x].colDef.original_index,
                    stack_columns: columns[p.x].colDef.stack_columns}
                  : undefined;
            }).filter(function(v){
                return v;
            });

            for (var i=0; i < results.length; i++){
              results[i].valid = true;

              // ROWS - ROW_PATH
              if (results[i].n === "__ROW_PATH__"){
                var cell_value = undefined;

                var level = 0;
                if (results[i].x !== undefined && results[i].y !== undefined){
                  cell_value = this.hypergrid.behavior.dataModel.getValue(results[i].x, results[i].y);
                  if (cell_value && cell_value.rowPath !== undefined){
                    level = Math.max(cell_value.rowPath.length - 1, 0);
                  }

                }

                results[i].level = level;

                if (row_pivots && row_pivots.length > 0 && level < row_pivots.length){
                  results[i].n = row_pivots[level];
                }

                results[i].in_pivot = "row_pivots";
              }else if(results[i].y < fixedRowCount){ // Headers or Stack Headers

                // Sort inside the stack header
                if (is_stack_header && fixedRowCount > 1){

                  var level = results[i].y ? results[i].y: 0;

                  results[i].level = level;

                  if (col_pivots && col_pivots.length > 0 && level < col_pivots.length){
                    //results[i].n = col_pivots[level];
                  }

                  results[i].in_pivot = "column_pivots";
                }else if(is_column_pivot){ // COLUMNS

                  results[i].level = 0;
                  results[i].in_pivot = "column_pivots";
                }else if(is_value_pivot){ // VALUES
                  results[i].level = 0;
                  results[i].in_pivot = "column_pivots";
                }
              }else if (is_value_pivot && results[i].y >= fixedRowCount){ // VALUES

                var contains_values_in_first = this.hypergrid.behavior.dataModel.contains_colpivot_value_in_first();
                var contains_values_in_middle = this.hypergrid.behavior.dataModel.contains_colpivot_value_in_middle();
                var contains_values_in_last = this.hypergrid.behavior.dataModel.contains_colpivot_value_in_last();
                //var value_position = this.hypergrid.behavior.dataModel.get_colpivot_value_position();
                var value_position_in_rowpivots = this.hypergrid.behavior.dataModel.get_rowpivot_value_position();
                //var raw_value_pivots = this.hypergrid.behavior.dataModel._viewer.get_value_obj_pivots();

                var contains_value_in_last_item_of_rowpivots = value_position_in_rowpivots !== -1 ? value_position_in_rowpivots === row_pivots.length -1 : false;

                var cell_value_in_row_path = this.hypergrid.behavior.dataModel.getValue(0, results[i].y);

                if (is_row_pivot && cell_value_in_row_path === undefined){
                  cell_value_in_row_path = await this.hypergrid.behavior.dataModel.pspFetchDataCellValue({
                      start_col: 0,
                      end_col: 1,
                      start_row: results[i].y,
                      end_row: results[i].y + 1
                    });
                }

                if (is_row_pivot && cell_value_in_row_path && cell_value_in_row_path.rollup === "Total"
                  && results[i].y - (Math.max(0, fixedRowCount - 1)) + 1 === this.hypergrid.behavior.dataModel.getRowsWithValuesCount()){

                  // No sort
                  results[i].valid = false;
                  results[i].err = "Cannot determine which Pivot field to sort by.";
                  continue;
                }
                var stack_columns = results[i].stack_columns || [];

                /*if (is_stack_header && fixedRowCount > 1){

                }else */
                if(/*!is_row_pivot &&*/ value_position != -1 && is_column_pivot){ // COLUMNS pivot and the Values in COLUMNS pivot

                  // Only the values in COLUMNS
                  if (col_pivots.length === 1 && value_position != -1){
                    results[i].level = 0;

                    // If the ROWS pivot is enabled, we will find the level in ROWS
                    if (is_row_pivot && cell_value_in_row_path && cell_value_in_row_path.rowPath){
                      results[i].level = cell_value_in_row_path.rowPath.length -1;
                    }
                    results[i].in_pivot = "value_pivots";
                  }else if(col_pivots.length > 1 && contains_values_in_last){ // Values is the last item of column pivots

                    var m_i = -1;
                    if (stack_columns.length > 0){
                      m_i = raw_value_pivots.findIndex((v)=>v.dname === stack_columns[stack_columns.length -1]);
                    }

                    if (stack_columns.length > 0 && stack_columns.length === fixedRowCount && m_i != -1){
                      results[i].sort_by = raw_value_pivots[m_i].base_name;
                      results[i].level = value_position -1;

                      // If the ROWS pivot is enabled, we will find the level in ROWS
                      if (is_row_pivot && cell_value_in_row_path && cell_value_in_row_path.rowPath){
                        results[i].level = cell_value_in_row_path.rowPath.length -1;
                        results[i].subtotal = stack_columns.filter((v)=>v !== raw_value_pivots[m_i].dname).join("|");
                      }
                      results[i].in_pivot = "value_pivots";
                    }else if (stack_columns.length > 0 && stack_columns.length < fixedRowCount && m_i != -1){
                      results[i].sort_by = raw_value_pivots[m_i].base_name;
                      results[i].level = 0;
                      // If the ROWS pivot is enabled, we will find the level in ROWS
                      if (is_row_pivot && cell_value_in_row_path && cell_value_in_row_path.rowPath){
                        results[i].level = cell_value_in_row_path.rowPath.length -1;
                        results[i].subtotal = stack_columns.filter((v)=>v !== raw_value_pivots[m_i].dname).join("|");
                      }
                      results[i].in_pivot = "value_pivots";
                    }else{
                      // No sort
                      results[i].valid = false;
                      continue;
                    }

                  }else if(col_pivots.length > 1 && contains_values_in_middle){ // Values is the middle item of column pivots
                    var m_i = -1;
                    if (stack_columns.length > 0){
                      m_i = raw_value_pivots.findIndex((v)=>v.dname === stack_columns[value_position < stack_columns.length ? value_position: stack_columns.length -1]);
                    }

                    if (stack_columns.length > 0 && stack_columns.length === fixedRowCount && m_i != -1){
                      results[i].sort_by = raw_value_pivots[m_i].base_name;
                      results[i].level = stack_columns.length -1;//value_position;
                      // If the ROWS pivot is enabled, we will find the level in ROWS
                      if (is_row_pivot && cell_value_in_row_path && cell_value_in_row_path.rowPath){
                        results[i].level = cell_value_in_row_path.rowPath.length -1;
                        results[i].subtotal = stack_columns.filter((v)=>v !== raw_value_pivots[m_i].dname).join("|");
                      }
                      results[i].in_pivot = "value_pivots";
                    }else if (stack_columns.length > 0 && stack_columns.length < fixedRowCount && m_i != -1){
                      results[i].sort_by = raw_value_pivots[m_i].base_name;
                      results[i].level = stack_columns.length -2 >= 0 ? stack_columns.length -2: 0;//value_position -1;

                      // If the ROWS pivot is enabled, we will find the level in ROWS
                      if (is_row_pivot && cell_value_in_row_path && cell_value_in_row_path.rowPath){
                        results[i].level = cell_value_in_row_path.rowPath.length -1;
                        results[i].subtotal = stack_columns.filter((v)=>v !== raw_value_pivots[m_i].dname).join("|");
                      }
                      results[i].in_pivot = "value_pivots";
                    }else{
                      // No sort
                      results[i].valid = false;
                      continue;
                    }
                  }else if(col_pivots.length > 1 && contains_values_in_first){ // Values is the first item of column pivots
                    var m_i = -1;
                    if (stack_columns.length > 0){
                      m_i = raw_value_pivots.findIndex((v)=>v.dname === stack_columns[0]);
                    }

                    if (stack_columns.length > 0 && stack_columns.length === fixedRowCount && m_i != -1){
                      results[i].sort_by = raw_value_pivots[m_i].base_name;
                      results[i].level = stack_columns.length -1;//fixedRowCount -1;
                      // If the ROWS pivot is enabled, we will find the level in ROWS
                      if (is_row_pivot && cell_value_in_row_path && cell_value_in_row_path.rowPath){
                        results[i].level = cell_value_in_row_path.rowPath.length -1;
                        results[i].subtotal = stack_columns.filter((v)=>v !== raw_value_pivots[m_i].dname).join("|");
                      }
                      results[i].in_pivot = "value_pivots";
                    }else if (stack_columns.length > 0 && stack_columns.length < fixedRowCount && m_i != -1){
                      results[i].sort_by = raw_value_pivots[m_i].base_name;
                      results[i].level = stack_columns.length -1;//value_position + 1;
                      // If the ROWS pivot is enabled, we will find the level in ROWS
                      if (is_row_pivot && cell_value_in_row_path && cell_value_in_row_path.rowPath){
                        results[i].level = cell_value_in_row_path.rowPath.length -1;
                        results[i].subtotal = stack_columns.filter((v)=>v !== raw_value_pivots[m_i].dname).join("|");
                      }
                      results[i].in_pivot = "value_pivots";
                    }else{
                      // No sort
                      results[i].valid = false;
                      continue;
                    }

                  }else{
                    // No sort
                    results[i].valid = false;
                    continue;
                  }

                }else if(is_row_pivot && value_position_in_rowpivots != -1 /*&& !is_column_pivot*/){ // ROWS pivots and the Values in row pivots

                  //var cell_value_in_row_path = this.hypergrid.behavior.dataModel.getValue(0, results[i].y);

                  // Only the values in ROWS
                  if (row_pivots.length === 1){
                    if (results[i].y && results[i].y >= 0 && results[i].y - 1 < value_pivots.length){
                      //results[i].n = raw_value_pivots[results[i].y - 1] ? raw_value_pivots[results[i].y - 1].base_name: results[i].n;
                      if (cell_value_in_row_path && cell_value_in_row_path.rowPath && cell_value_in_row_path.rowPath.length > 0){
                        results[i].sort_by = cell_value_in_row_path.rowPath[cell_value_in_row_path.rowPath.length -1];
                      }

                      results[i].level = 0;

                      results[i].in_pivot = "value_pivots";
                    }
                  }else if (row_pivots.length > 1 && contains_value_in_last_item_of_rowpivots){ // Values is in the last item of row pivots

                    if (cell_value_in_row_path){

                      // At VALUE row
                      if (cell_value_in_row_path.rowPath && cell_value_in_row_path.rowPath.length -1 == value_position_in_rowpivots){
                        results[i].sort_by = cell_value_in_row_path.rowPath[cell_value_in_row_path.rowPath.length -1];

                        // Level
                        //var v_index = raw_value_pivots.findIndex((v)=>v.base_name === results[i].sort_by);
                        //if (v_index !== -1){
                        //  results[i].level = value_position_in_rowpivots;
                        //}
                        results[i].level = row_pivots.length - 2;
                        results[i].in_pivot = "value_pivots";

                      }else if(cell_value_in_row_path.rowPath
                          && cell_value_in_row_path.rowPath.length == value_position_in_rowpivots){ // Try to get next row to find a first child

                        cell_value_in_row_path = this.hypergrid.behavior.dataModel.getValue(0, results[i].y + 1);
                        if (cell_value_in_row_path.rowPath && cell_value_in_row_path.rowPath.length -1 == value_position_in_rowpivots){
                          results[i].sort_by = cell_value_in_row_path.rowPath[cell_value_in_row_path.rowPath.length -1];

                          // Level
                          //var v_index = raw_value_pivots.findIndex((v)=>v.base_name === results[i].sort_by);
                          //if (v_index !== -1){
                          //  results[i].level = value_position_in_rowpivots;
                          //}
                          results[i].level = row_pivots.length - 2;
                          results[i].in_pivot = "value_pivots";
                        }

                      }else if(cell_value_in_row_path.rowPath
                          && cell_value_in_row_path.rowPath.length == value_position_in_rowpivots - 1){ // The same level of parent

                          var m_i = raw_value_pivots.findIndex((v)=>{
                            var row_path_value = cell_value_in_row_path.rowPath[cell_value_in_row_path.rowPath.length -1];
                            if (v.base_name && row_path_value && row_path_value.indexOf(v.base_name) != -1){
                              return true;
                            }
                          });
                          if (m_i != -1){
                            results[i].sort_by = raw_value_pivots[m_i].base_name;
                            results[i].level = cell_value_in_row_path.rowPath.length -1;
                            results[i].in_pivot = "value_pivots";
                          }
                      }
                    }

                  }else if (row_pivots.length > 1 && value_position_in_rowpivots > 0){ // Values is the middle item of row pivots

                    if(cell_value_in_row_path.rowPath
                        && cell_value_in_row_path.rowPath.length -1 == value_position_in_rowpivots + 1){ // The values' Children


                        if (cell_value_in_row_path.rowPath.length -2 >= 0){
                          var m_i = raw_value_pivots.findIndex((v)=>v.base_name === cell_value_in_row_path.rowPath[cell_value_in_row_path.rowPath.length -2]);
                          if (m_i != -1){
                            results[i].sort_by = raw_value_pivots[m_i].base_name;
                            results[i].level = value_position_in_rowpivots + 1;
                            results[i].in_pivot = "value_pivots";
                          }
                        }
                    }else if(cell_value_in_row_path.rowPath
                        && cell_value_in_row_path.rowPath.length == value_position_in_rowpivots){ // The values' parent

                        var r_value = cell_value_in_row_path.rowPath[cell_value_in_row_path.rowPath.length -1];
                        var e_i = raw_value_pivots.findIndex((v)=>{
                          if (v.base_name && r_value && r_value.indexOf(v.base_name) != -1){
                            return true;
                          }
                        });

                        if (e_i != -1){
                          if (raw_value_pivots[e_i].base_name !== r_value){ // "x sum of Row"
                            results[i].sort_by = raw_value_pivots[e_i].base_name;
                            results[i].level = value_position_in_rowpivots -1;
                            results[i].in_pivot = "value_pivots";
                          }else{
                            // No sort.
                            // Eg: "sum of Row" in the same parent level
                            results[i].valid = false;
                            continue;
                          }
                        }else{ // Next cell info
                          var next_cell = this.hypergrid.behavior.dataModel.getValue(0, results[i].y + 1);
                          if (next_cell.rowPath && next_cell.rowPath.length == value_position_in_rowpivots + 1){
                            var m_i = raw_value_pivots.findIndex((v)=>v.base_name === next_cell.rowPath[next_cell.rowPath.length -1]);
                            if (m_i != -1){
                              results[i].sort_by = raw_value_pivots[m_i].base_name;
                              results[i].level = value_position_in_rowpivots -1;
                              results[i].in_pivot = "value_pivots";
                            }
                          }
                        }

                    }
                  }else if (row_pivots.length > 1 && value_position_in_rowpivots === 0){ // Values is the first item of row pivots

                    var m_i = raw_value_pivots.findIndex((v)=>cell_value_in_row_path.rowPath && v.base_name === cell_value_in_row_path.rowPath[0]);

                    if(cell_value_in_row_path.rowPath
                        && cell_value_in_row_path.rowPath.length -1 == value_position_in_rowpivots){ // At Values row
                        // No sort
                        results[i].valid = false;
                        continue;
                    }else if(cell_value_in_row_path.rowPath
                        && cell_value_in_row_path.rowPath.length -1 == value_position_in_rowpivots + 1){ // Child level

                        //var m_i = raw_value_pivots.findIndex((v)=>v.base_name === cell_value_in_row_path.rowPath[0]);
                        if (m_i != -1){
                          results[i].sort_by = raw_value_pivots[m_i].base_name;
                          results[i].level = value_position_in_rowpivots + 1;
                          results[i].in_pivot = "value_pivots";
                        }

                    }else if(cell_value_in_row_path.rowPath
                        && cell_value_in_row_path.rowPath.length -1 == value_position_in_rowpivots + 2){ // Child of child level

                        //var m_i = raw_value_pivots.findIndex((v)=>v.base_name === cell_value_in_row_path.rowPath[0]);
                        if (m_i != -1){
                          results[i].sort_by = raw_value_pivots[m_i].base_name;
                          results[i].level = value_position_in_rowpivots + 2;
                          results[i].in_pivot = "value_pivots";
                        }
                    }else{
                      // Something is not right so we will not sort.
                      // No sort
                      results[i].valid = false;
                      continue;
                    }
                  }

                  //if (is_stack_header){
                  //  results[i].subtotal = results[i].n;
                  //}

                  // If ROWS contains the Values item, we will always return subtotal
                  results[i].subtotal = results[i].n;

                }else if (raw_value_pivots.length == 1){ // VALUES has only an item.

                  results[i].sort_by = raw_value_pivots[raw_value_pivots.length -1].base_name;

                  // If the ROWS pivot is enabled, we will find the level in ROWS
                  if (is_row_pivot && cell_value_in_row_path && cell_value_in_row_path.rowPath){
                    results[i].level = cell_value_in_row_path.rowPath.length -1;
                  }else{
                    results[i].level = Math.max(0, stack_columns ? stack_columns.length -1: 0);
                  }

                  if (results[i].n !== raw_value_pivots[raw_value_pivots.length -1].dname){
                    results[i].subtotal = stack_columns.filter((v)=>v !== raw_value_pivots[raw_value_pivots.length -1].dname).length >0
                      ? stack_columns.filter((v)=>v !== raw_value_pivots[raw_value_pivots.length -1].dname).join("|")
                      : results[i].n;
                  }

                  results[i].in_pivot = "value_pivots";

                }else{
                  // No sort
                  results[i].valid = false;
                  continue;
                }
              }else{
                // No sort
                results[i].valid = false;
                continue;
              }
            }

          }

          // Check error
          var err_index = results.findIndex((v)=>!v.valid && v.err);
          if (err_index != -1){
            alert(results[err_index].err);
            results = [];
          }else{
            results = results.filter((v)=>v.valid);
          }

        }else{
          if (results && results.length > 0){
            // Pass
          }else{ // Try to get columns by cell selection
            var cell_selection = this.hypergrid.selectionModel.getFirstSelectedCellOfLastSelection();
            var cell_column_selection = [];
            if (cell_selection){
              cell_column_selection.push(cell_selection.x);
            }

            var cell_co_names = cell_column_selection.map(function(i){
                return columns[i].colDef ? columns[i].colDef.originalName : undefined;
            }).filter(function(v){
                return v;
            });

            results = cell_co_names.map((v)=>{return {n: v}; });
          }
        }

        this.hypergrid.behavior.dataModel.setKeepSelection(true);
        return results;
      }
    }
});
