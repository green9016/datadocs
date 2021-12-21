'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var HypergridError = require('./lib/error');

var propClassEnum = {
  COLUMNS: 1,
  STRIPES: 2,
  ROWS: 3,
  CELLS: 4
};

var propClassLayersMap = {
  DEFAULT: [propClassEnum.COLUMNS, propClassEnum.STRIPES, propClassEnum.ROWS, propClassEnum.CELLS],
  NO_ROWS: [propClassEnum.CELLS]
};

/**
 * This module lists the properties that can be set on a {@link Hypergrid} along with their default values.
 * Edit this file to override the defaults.
 * @module defaults
 */

var defaults = {

  /**
   * @summary The global theme name.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  themeName: 'default',

  /**
   * The default message to display in front of the canvas when there are no grid rows.
   * Format is HTML.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  noDataMessage: '',

  /**
   * @desc If true, first row will be used to render headers
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  useHeaders: true,

  /**
   * @desc If true, cells, that contains only url will be displayed as a link
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  detectLinksPermanently: true,

  /**
   * @desc Contains count of rows, that currently used as a headers
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  fictiveHeaderRowsCount: 0,

  /**
   * @summary List of subgrids by
   * @desc Restrict usage here to strings (naming data models) or arrays consisting of such a string + constructor arguments. That is, avoid {@link subgridSpec}'s function and object overloads and {@link subgridConstructorRef} function overload.
   * @default "[ 'HeaderSubgrid', 'data' ]"
   * @type {subgridSpec[]}
   * @memberOf module:defaults
   */
  subgrids: ['HeaderSubgrid', 'data'],

  /**
   * The font for data cells.
   * @default
   * @type {cssFont}
   * @memberOf module:defaults
   */
  font: '13px "Helvetica Neue",Helvetica,Arial,sans-serif',

  /**
   * Font color for data cells.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  color: '#060606',

  /**
   * Background color for data cells.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  backgroundColor: '#FFFFFF',

  /**
   * Background color for empty space
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  canvasBackgroundColor: '#F3F3F3',

  /**
   * Font style for selected cell(s).
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  foregroundSelectionFont: '13px "Helvetica Neue",Helvetica,Arial,sans-serif',

  /**
   * Font color for selected cell(s).
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  foregroundSelectionColor: '#060606',
  /**
   * Background color for selected cell(s).
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  backgroundSelectionColor: '#ECF3FF',

  /**
   * Background color for header selected cell(s).
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  backgroundHeaderSelectionColor: '#DDDDDD',

  /**
   * @summary Text color for error cell
   * @description Color for symbol of error, when value described as object with type:"ERROR" field
   * @type {string}
   * @memberOf module:defaults
   */
  errorCellDataColor: '#a94d4dc2',

  disableHoverHighlighting: true,

  /********** SECTION: COLUMN HEADER COLORS **********/

  // IMPORTANT CAVEAT: The code is inconsistent regarding the terminology. Is the "column header" section _the row_ of cells at the top (that act as headers for each column) or is it _the column_ of cells (that act as headers for each row)? Oh my.

  /**
   * @default
   * @type {cssFont}
   * @memberOf module:defaults
   */
  columnHeaderFont: '11px arial,sans-serif',

  /**
   * @summary text style for data row with headers/titles
   * @default
   * @type {cssFont}
   * @memberOf module:defaults
   */
  columnHeaderFontBold: 'bold 13px "Helvetica Neue",Helvetica,Arial,sans-serif',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnHeaderColor: '#060606',

  /**
   * @summary Font style for selected columns' headers.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnHeaderForegroundSelectionFont: '11px arial,sans-serif',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnHeaderBackgroundColor: 'rgb(243,243,243)',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnHeaderForegroundSelectionColor: '#060606',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnHeaderBackgroundSelectionColor: 'rgba(255, 220, 97, 0.45)',

  /**
   * @summary align of first number column
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnHeaderHalign: 'center',

  /**
   * @summary initial width of number column
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  columnHeaderInitWidth: 50,

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnHeaderRenderer: 'SimpleCell',

  /********** SECTION: ROW HEADER COLORS **********/

  /**
   * @default
   * @type {cssFont}
   * @memberOf module:defaults
   */
  rowHeaderFont: '11px arial,sans-serif',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowHeaderColor: '#060606',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowHeaderBackgroundColor: 'rgb(243,243,243)',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowHeaderForegroundSelectionColor: '#060606',

  /**
   * Font style for selected rows' headers.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  rowHeaderForegroundSelectionFont: '11px arial,sans-serif',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowHeaderBackgroundSelectionColor: 'rgba(255, 220, 97, 0.45)',
  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  backgroundColor2: 'rgb(201, 201, 201)',

  /********** SECTION: TREE HEADER COLORS **********/

  /**
   * @default
   * @type {cssFont}
   * @memberOf module:defaults
   */
  treeHeaderFont: '12px Tahoma, Geneva, sans-serif',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  treeHeaderColor: 'rgb(25, 25, 25)',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  treeHeaderBackgroundColor: 'rgb(223, 227, 232)',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  treeHeaderForegroundSelectionColor: 'rgb(80, 80, 80)',

  /**
   * Font style for selected rows' headers.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  treeHeaderForegroundSelectionFont: 'bold 12px Tahoma, Geneva, sans-serif',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  treeHeaderBackgroundSelectionColor: 'rgba(255, 220, 97, 0.45)',
  /********** SECTION: FILTER ROW COLORS **********/

  /**
   * @default
   * @type {cssFont}
   * @memberOf module:defaults
   */
  filterFont: '12px Tahoma, Geneva, sans-serif',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  filterColor: 'rgb(25, 25, 25)',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  filterBackgroundColor: 'white',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  filterForegroundSelectionColor: 'rgb(25, 25, 25)',

  /**
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  filterBackgroundSelectionColor: 'rgb(255, 220, 97)',

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  filterHalign: 'center',

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  filterRenderer: 'SimpleCell',

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  filterEditor: 'TextField',

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  filterable: true,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  showFilterRow: false,

  /**
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  voffset: 0,

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  scrollbarHoverOver: 'visible',

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  scrollbarHoverOff: 'hidden',

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  scrollingEnabled: true,

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  vScrollbarClassPrefix: '',

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  hScrollbarClassPrefix: '',

  /**
   * @summary limit for initiating scroll end event
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  onScrollEndLimitTrigger: 1,

  /**
   * Horizontal alignment of each cell as interpreted by it's cell renderer.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  halign: 'left',

  /**
   * Padding to left and right of cell value.
   *
   * NOTE: Right padding may not be visible if column is not sized wide enough.
   *
   * See also {@link module:defaults.iconPadding|iconPadding}.
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  cellPadding: 4,

  cellPaddingRight: 5,

  cellPaddingLeft: 6,

  /**
   * Padding to left and right of cell icons.
   *
   * Overrides {@link module:defaults.cellPadding|cellPadding}:
   * * Left icon + `iconPadding` overrides left {@link module:defaults.cellPddingg|cellPddingg}.
   * * Right icon + `iconPadding` overrides right {@link module:defaults.cellPddingg|cellPddingg}.
   * @see {@link module:defaults.leftIcon|leftIcon}
   * @see {@link module:defaults.centerIcon|centerIcon}
   * @see {@link module:defaults.rightIcon|rightIcon}
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  iconPadding: 3,

  /**
   * @summary Name of image to appear at right of cell.
   * Must be a key from {@link module:images|images}.
   * @desc Used by {@link SimpleCell} cell renderer.
   * @see {@link module:defaults.centerIcon|centerIcon}
   * @see {@link module:defaults.rightIcon|rightIcon}
   * @see {@link module:defaults.iconPadding|iconPadding}
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  leftIcon: undefined,

  /**
   * @summary Name of image to appear at right of cell.
   * Must be a key from {@link module:images|images}.
   * @desc Used by {@link SimpleCell} cell renderer.
   * @see {@link module:defaults.leftIcon|leftIcon}
   * @see {@link module:defaults.rightIcon|rightIcon}
   * @see {@link module:defaults.iconPadding|iconPadding}
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  centerIcon: undefined,

  /**
   * @summary Name of image to appear at right of cell.
   * Must be a key from {@link module:images|images}.
   * @desc Used by {@link SimpleCell} cell renderer.
   * @see {@link module:defaults.leftIcon|leftIcon}
   * @see {@link module:defaults.centerIcon|centerIcon}
   * @see {@link module:defaults.iconPadding|iconPadding}
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  rightIcon: undefined,

  /**
   * @summary showCellContextMenuIcon and showColumnType trigger
   */
  showAdditionalInfo: false,

  /**
   * @summary appliedFilterColumn contains the column name and icon name on which filter or sorting applied
   */
  appliedFilterColumn: [],

  /**
   * Set to `true` to render `0` and `false`. Otherwise these value appear as blank cells.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  renderFalsy: true,

  /**
   * The name of a registered headerify function.
   *
   * If the named headerify function is defined, it is applied to the schema:
   * 1. Whenever the schema changes
   * 2. For each column that does not already have an explicitly defined header
   *
   * When this property does not name a defined headerify function, undefined column headers default to their column names.     *
   *
   * @see lib/headerifiers.js
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  headerify: 'titleize',

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  gridLinesH: true,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  gridLinesV: true,

  /** @type {number}
   * @default
   * @memberOf module:defaults
   * @see {@link module:dynamicPropertyDescriptors.lineWidth}
   */
  gridLinesWidth: 1,

  /** @type {string}
   * @default
   * @memberOf module:defaults
   */
  gridLinesColor: '#dadada',

  /** @type {string}
   * @desc Color of borders, that painted on left side of header part of each column
   * @default
   * @memberOf module:defaults
   */
  gridLinesHeaderColor: '#c1c1c1',

  /**
   * Set canvas's CSS border to this string as well as `gridBorderLeft`, `gridBorderRight`, `gridBorderTop`, and `gridBorderBottom`.
   * If set to `true`, uses current `lineWidth` and `lineColor`.
   * If set to `false`, uses null.
   *
   * Caveat: The use of `grid.canvas.canvas.style.boxSizing = 'border-box'` is _not_ recommended due to
   * the fact that the canvas is squashed slightly to accommodate the border resulting in blurred text.
   *
   * @default
   * @type {boolean|string}
   * @memberOf module:defaults
   */
  gridBorder: true,

  /**
   * Set canvas's left CSS border to this string.
   * If set to `true`, uses current `lineWidth` and `lineColor`.
   * If set to `false`, uses null.
   * @default
   * @type {boolean|string}
   * @memberOf module:defaults
   */
  gridBorderLeft: true,

  /**
   * Set canvas's right CSS border to this string.
   * If set to `true`, uses current `lineWidth` and `lineColor`.
   * If set to `false`, uses null.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  gridBorderRight: true,

  /**
   * Set canvas's top CSS border to this string.
   * If set to `true`, uses current `lineWidth` and `lineColor`.
   * If set to `false`, uses null.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  gridBorderTop: false,

  /**
   * Set canvas's bottom CSS border to this string.
   * If set to `true`, uses current `lineWidth` and `lineColor`.
   * If set to `false`, uses null.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  gridBorderBottom: true,

  /**
   * Define this property to style rule lines between fixed & scolling rows differently from `lineWidth`.
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  fixedLinesHWidth: 6,

  /**
   * Define this property to render just the edges of the lines between fixed & scolling rows, creating a double-line effect. The value is the thickness of the edges. Typical definition would be `1` in tandem with setting `fixedLinesWidth` to `3`.
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  fixedLinesHEdge: undefined, // undefined means no edge effect

  /**
   * Define this property to style rule lines between fixed & scolling rows differently from `lineColor`.
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  fixedLinesHColor: 'rgb(218,223,232)', // ~21% darker than `lineColor` default

  /**
   * Define this property to style rule lines between fixed & scolling columns differently from `lineWidth`.
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  fixedLinesVWidth: 6,

  /**
   * Define this property to render just the edges of the lines between fixed & scolling columns, creating a double-line effect. The value is the thickness of the edges. Typical definition would be `1` in tandem with setting `fixedLinesWidth` to `3`.
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  fixedLinesVEdge: undefined, // undefined means no edge effect

  /**
   * Define this property to style rule lines between fixed & scolling columns differently from `lineColor`.
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  fixedLinesVColor: 'rgb(218,223,232)', // ~21% darker than `lineColor` default

  /**
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  defaultRowHeight: 21,

  /**
   * @summary height parameter for header row
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  defaultHeaderRowHeight: 23,

  /**
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  defaultColumnWidth: 101,

  /**
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  minimumColumnWidth: 30,

  /**
   * @summary global max width of column
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  maximumColumnWidth: 650,

  /**
   * @summary minimal count of rows should be shown
   * @type {number}
   */
  minimumRowCount: 50,

  //for immediate painting, set these values to 0, true respectively

  /**
   * @default FPS fow drawing table
   * @type {number}
   * @memberOf module:defaults
   */
  repaintIntervalRate: 60,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  repaintImmediately: false,

  //enable or disable double buffering

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  useBitBlit: false,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  useHiDPI: true,

  /**
   * @summary Mappings for cell navigation keys.
   * @desc Cell navigation is handled in the {@link CellSelection} "feature". This property gives you control over which keypresses the built-in mechanism will respond to.
   *
   * (If this built-in cell selection logic is insufficient for your needs, you can also listen for the various "fin-key" events and carry out more complex operations in your listeners.)
   *
   * The keypress names used here are defined in Canvas.js. Note that all keypresses actually have two names, a normal name and a shifted name. The latter name is used when either **shift** is depressed.
   *
   * The built-in nav keypresses are as follows:
   * * **`UP`** _(up-arrow key)_ - Replace all selections with a single cell, one row up from the last selection.
   * * **`DOWN`** _(down-arrow key)_ - Replace all selections with a single cell, one row down from the last selection.
   * * **`LEFT`** _(left-arrow key)_ - Replace all selections with a single cell, one column to the left of the last selection.
   * * **`RIGHT`** _(right-arrow key)_ - Replace all selections with a single cell, one column to the right of the last selection.
   * * **`UPSHIFT`** _(shift + up-arrow)_ - Extend the last selection up one row.
   * * **`DOWNSHIFT`** _(shift + down-arrow)_ - Extend the last selection down one row.
   * * **`LEFTSHIFT`** _(shift + left-arrow)_ - Extend the last selection left one column.
   * * **`RIGHTSHIFT`** _(shift + right-arrow)_ - Extend the last selection right one column.
   *
   * To alter these or add other mappings see the examples below.
   *
   * A note regarding the other meta keys (**trl**, **option**, and **command**): Although these meta keys can be detected, they do not modify the key names as **shift** does. This is because they are more for system use and generally (with the possibly exception fo **ctrl**) should not be depended upon, as system functions will take priority and your app will never see these key presses.
   *
   * A special accommodation has been made to the {@link module:defaults.editOnKeydown|editOnKeydown} property:
   * * If `editOnKeydown` truthy AND mapped character is an actual (non-white-space) character (as opposed to say **tab** or **return**), then navigation requires **ctrl** key to distinguish between nav and data.
   * * If `editOnKeydown` falsy, the **ctrl** key is ignored.
   *
   * So in the last example, if `editOnKeydown` is ON, then `a` (without **ctrl**) would start editing the cell and **ctrl** + `a` would move the selection one column to the left.
   *
   * @example
   * // To void the above build-ins:
   * navKeyMap: {
   *     UP: undefined,
   *     UPSHIFT: undefined,
   *     DOWN: undefined,
   *     ...
   * }
   *
   * @example
   * // To map alternative nav keypresses to RETURN and TAB (default mapping):
   * navKeyMap: {
   *     RETURN: 'DOWN',
   *     RETURNSHIFT: 'UP',
   *     TAB: 'RIGHT',
   *     TABSHIFT: 'LEFT'
   * }
   *
   * @example
   * // To map alternative nav keypresses to a/w/d/s and extend select to A/W/D/S:
   * navKeyMap: {
   *     a: 'LEFT', A: 'LEFTSHIFT',
   *     w: 'UP', W: 'UPSHIFT',
   *     s: 'DOWN', S: 'DOWNSHIFT',
   *     d: 'RIGHT', D: 'RIGHTSHIFT'
   * }
   *
   * @default
   * @type {object|undefined}
   * @memberOf module:defaults
   */
  navKeyMap: {
    RETURN: 'DOWN',
    RETURNSHIFT: 'UP',
    TAB: 'RIGHT',
    TABSHIFT: 'LEFT'
  },

  /** @summary Validation failure feedback.
   * @desc Validation occurs on {@link CellEditor#stopEditing}, normally called on commit (`TAB`, `ENTER`, or any other keys listed in `navKeyMap`).
   *
   * On successful validation, the value is saved back to the data source and the editor is closed.
   *
   * On validation failure, feedback is shown to the user in the form of an "error effect" possibly followed by an "end effect" containing a detailed explanation.
   *
   * The error effect to use is named in `feedbackEffect
   *
   * The value of this property is the number of times to show the "error effect" on validation failure before showing the detailed explanation.
   *
   * `feedback` may be set to one of:
   * * **`undefined`** - Do not show the error effect or the alert. Just discard the value and close the editor (as if `ESC` had been typed).
   * * **`0`** - Just shows the error feedback effect (see the {@link CellEditor#errorEffect|errorEffect} property).
   * * **`1`** - Shows the error feedback effect followed by the detailed explanation.
   * * `2` or more:
   *   1. Shows the error feedback effect
   *   2. On every `feedback` tries, shows the detailed explanation.
   * @default
   * @type {number|undefined}
   * @memberOf module:defaults
   */
  feedbackCount: 3,

  /**
   * @default
   * @type {{name:string,options:object}|string}
   * @memberOf module:defaults
   */
  feedbackEffect: 'shaker',

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  readOnly: false,

  /**
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  fixedColumnCount: 0,

  /**
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  fixedRowCount: 0,

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  rowHeaderHalign: 'center',

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   * @see {@link module:dynamicPropertyDescriptors.showRowNumbers}
   */
  rowHeaderNumbers: true,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   * @see {@link module:dynamicPropertyDescriptors.showRowNumbers}
   */
  rowHeaderCheckboxes: false,

  /**
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  rowHeaderStartDisplayedIndex: 1,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  showTreeColumn: true,

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  treeRenderer: 'SimpleCell',

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  showHeaderRow: true,

  /** Clicking in a cell "selects" it; it is added to the select region and repainted with "cell selection" colors.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  cellSelection: true,

  /** Clicking in a column header (top row) "selects" the column; the entire column is added to the select region and repainted with "column selection" colors.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  columnSelection: true,

  /** Clicking in a row header (leftmost column) "selects" the row; the entire row is added to the select region and repainted with "row selection" colors.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  rowSelection: true,

  /**
   * @desc If true, fictive header rows will use regular selection rules
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  selectFictiveHeaderCellsAsRegular: true,

  /**
   * @desc If true, Ctrl+[UP/Down] will only goes to very first/last row
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  ignoreDataCellsOnVerticalCtrlSelection: true,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  singleRowSelectionMode: false,

  /**
   * @summary Fill color for last selection overlay.
   * @desc The color should be translucent (or transparent). Note that "Partial" grid renderers (such as the {@link paintCellsAsNeeded} renderer) do not draw overlay because it just gets darker and darker for non-updated cells.
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  selectionRegionOverlayColor: 'rgba(160,195,255,.2)', // 'transparent', // 'rgba(0, 0, 48, 0.2)',

  /**
   * @summary Stroke color for last selection overlay.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  selectionRegionOutlineColor: '#4285F4',

  /**
   * @summary Width of selected region border
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  selectionRegionBorderWidth: 1,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  columnAutosizing: true,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  rowNumberAutosizing: true,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  headerTextWrapping: false,

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  rowResize: false,

  /* CELL EDITING */

  /**
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  editable: false,

  /**
   * Edit cell on double-click rather than single-click.
   *
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  editOnDoubleClick: true,

  /**
   * Grid-level property.
   * When user presses a "printable" keyboard character _or_ BACKSPACE _or_ DELETE:
   * 1. Activate cell editor on current cell (i.e., origin of most recent selection).
   * 2. If cell editor is a text editor:
   *    1. Replace current value with the character the user typed; or
   *    2. Clear it on BACKSPACE, DELETE, or other invalid character (_e.g._ when user types a letter but the cell editor only accepts digits).
   *
   * > In invoked, user has the option to back out by pressing the ESCAPE key.
   *
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  editOnKeydown: true,

  /**
   * @summary Open cell editor when cell selected via keyboard navigation.
   * @desc Keyboard navigation always includes:
   * 1. The four arrow keys -- but only when there is no active text cell editor open
   * 2. Additional keys mapped to the four directs in {@link module:defaults.navKeyMap}
   *
   * Generally set at the grid level. If set at the column (or cell) level, note that the property pertains to the cell navigated _to,_ not the cell navigated _away from._
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  editOnNextCell: false,

  /* COLUMN SORTING */

  /**
   * Ignore sort handling in feature/ColumnSorting.js.
   * Useful for excluding some columns but not other from participating in sorting.
   *
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  unsortable: false,

  /**
   * Sort column on double-click rather than single-click.
   *
   * Used by:
   * * feature/ColumnSorting.js to decide which event to respond to (if any, see `unsortabe`).
   * * feature/ColumnSelection.js to decide whether or not to wait for double-click.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  sortOnDoubleClick: true,

  /**
   * **This is a standard property definition for sort plug-in use.
   * It is not referenced in core.**
   *
   * The maximum number of columns that may participate in a multi-column sort (via ctrl-click headers).
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  maxSortColumns: 3,

  /**
   * **This is a standard property definition for sort plug-in use.
   * It is not referenced in core.**
   *
   * Column(s) participating and subsequently hidden still affect sort.
   *
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  sortOnHiddenColumns: true,

  /**
   * @summary Retain row selections.
   * @desc When falsy, row selections are cleared when selecting cells; when truthy, row selections are kept as is when selecting cells.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  keepRowSelections: false,

  /**
   * @summary Select cell's entire row.
   * @desc When truthy, selecting a cell will also select the entire row it is in, subject to note #1 below.
   *
   * Notes:
   * 1. Ineffectual unless `checkboxOnlyRowSelections` is set to `false`.
   * 2. To allow auto-selection of _multiple rows,_ set `singleRowSelectionMode` to `false`.
   *
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  autoSelectRows: false,

  /**
   * @summary Select cell's entire column.
   * @desc When truthy, selecting a cell will also select the entire column it is in.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  autoSelectColumns: false,

  /** @summary Name of a formatter for cell text.
   * @desc The default (`undefined`) falls back to `column.type`.
   * The value `null` does no formatting.
   * @default undefined
   * @type {undefined|null|string}
   * @memberOf module:defaults
   * @tutorial localization
   */
  format: undefined,

  /** @summary Name of a cell editor from the {@link module:cellEditors|cellEditors API}..
   * @desc Not editable if named editor is does not exist.
   * @default undefined
   * @type {undefined|null|string}
   * @memberOf module:defaults
   * @tutorial cell-editors
   */
  editor: 'textfield',

  /**
   * Name of cell renderer from the {@link module:cellRenderers|cellRenderers API}.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  renderer: 'SimpleCell',

  /**
   * Name of grid renderer.
   * Renderer must have been registered.
   * @see {@link Renderer#registerGridRenderer}.
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  gridRenderer: 'by-columns-and-rows',

  /********** HOVER COLORS **********/

  /** @typedef hoverColors
   * @property {boolean} [enable=false] - `false` means not hilite on hover
   * @property {cssColor} backgroundColor - cell, row, or column background color. Alpha channel will be respected and if given will be painted over the cells predetermined color.
   * @property {cssColor} [header.backgroundColor=backgroundColor] - for columns and rows, this is the background color of the column or row "handle" (header rows or columns, respectively). (Not used for cells.)
   */

  /** On mouse hover, whether to repaint the cell background and how.
   * @type {hoverColors}
   * @default '{ enabled: true, background: rgba(160, 160, 40, 0.30) }'
   * @memberOf module:defaults
   */
  hoverCellHighlight: {
    enabled: true,
    backgroundColor: 'rgba(160, 160, 40, 0.45)'
  },

  /** On mouse hover, whether to repaint the row background and how.
   * @type {hoverColors}
   * @default '{ enabled: true, background: rgba(100, 100, 25, 0.15) }'
   * @memberOf module:defaults
   */
  hoverRowHighlight: {
    enabled: false,
    backgroundColor: 'rgba(100, 100, 25, 0.30)'

  },

  /** On mouse hover, whether to repaint the column background and how.
   * @type {hoverColors}
   * @default '{ enabled: true, background: rgba(60, 60, 15, 0.15) }'
   * @memberOf module:defaults
   */
  hoverColumnHighlight: {
    enabled: false,
    backgroundColor: 'rgba(60, 60, 15, 0.15)'
  },

  /** @summary Display cell value as a link (with underline).
   * @desc One of:
   * * `boolean` - No action occurs on click; you would need to attach a 'fin-click' listener to the hypergrid object.
   *   * `true` - Displays the cell as a link.
   *   * _falsy_ - Displays the cell normally.
   * * `string` -  The URL is decorated (see {}) and then opened in a separate window/tab. See also {@link module:defaults.linkTarget|linkTarget}.
   *   * `'*'` - Use the cell value as the URL, ready for decorating (see {CellClick#openLink|openLink)).
   *   * _field name_ - Fetches the string from the named field in the same row, assumed to be a URL ready for decorating. (May contain only alphanumerics and underscore; no spaces or other punctuation.)
   *   * _otherwise_ Assumed to contains a URL ready for decorating.
   * * `function` - A function to execute to get the URL ready for decorating. The function is passed a single parameter, `cellEvent`, from which you can get the field `name`, `dataRow`, _etc._
   * * `Array` - An array to "apply" to {@link https://developer.mozilla.org/docs/Web/API/Window/open window.open} in its entirety. The first element is interpreted as above for `string` or `function`.
   *
   * In the case of `string` or `Array`, the link is further unpacked by {@link module:CellClick.openLink|openLink} and then sent to `grid.windowOpen`.
   *
   * @example
   * // following affect upper-left data cell:
   * grid.behavior.setCellProperty(0, 0, 'https://nytimes.com'); // absolute address using specific protocol
   * grid.behavior.setCellProperty(0, 0, '//nytimes.com'); // absolute address using current protocol
   * grid.behavior.setCellProperty(0, 0, '/page2.com'); // relative to current site
   * grid.behavior.setCellProperty(0, 0, 'mypage.com'); // relative to current page
   * grid.behavior.setCellProperty(0, 0, 'mypage.com?id=%value'); // cell's value will replace %value
   * grid.behavior.setCellProperty(0, 0, ['//www.newyorker.com', 'ny', undefined, true]) // target='ny', replace=true
   * @type {boolean|string|Array}
   * @type {boolean}
   * @default
   * @memberOf module:defaults
   */
  link: false,

  /** @summary The window (or tab) in which to open the link.
   * @desc The default ('_blank'`) will open a new window for every click.
   *
   * To have the first click open a new window and all subsequent clicks reuse that same window, set this to an arbitrary string.
   *
   * Otherwise, specific columns or cells can be set to open their links in their own window by setting the appropriate column's or cell's `linkTarget` property.
   * @default
   * @memberOf module:defaults
   */
  linkTarget: '_blank',

  /** @summary Underline link on hover only.
   * @type {boolean}
   * @default
   * @memberOf module:defaults
   */
  linkOnHover: false,

  /** @summary Color for link.
   * @desc Falsy means defer to foreground color.
   * @type {string}
   * @default
   * @memberOf module:defaults
   */
  linkColor: '#337ab7',

  /** @summary Color for visited link.
   * @desc Falsy means defer to foreground color.
   * @type {string}
   * @default
   * @memberOf module:defaults
   */
  linkVisitedColor: '#337ab7',

  /** @summary Color link on hover only.
   * @type {boolean}
   * @default
   * @memberOf module:defaults
   */
  linkColorOnHover: false,

  /** Display cell font with strike-through line drawn over it.
   * @type {boolean}
   * @default
   * @memberOf module:defaults
   */
  strikeThrough: false,

  /** Allow multiple cell region selections.
   * @type {boolean}
   * @default
   * @memberOf module:defaults
   */
  multipleSelections: true,

  /** @summary Re-render grid at maximum speed.
   * @desc In this mode:
   * * The "dirty" flag, set by calling `grid.repaint()`, is ignored.
   * * `grid.getCanvas().currentFPS` is a measure of the number times the grid is being re-rendered each second.
   * * The Hypergrid renderer gobbles up CPU time even when the grid appears idle (the very scenario `repaint()` is designed to avoid). For this reason, we emphatically advise against shipping applications using this mode.
   * @type {boolean}
   * @default
   * @memberOf module:defaults
   */
  enableContinuousRepaint: false,

  /** @summary Allow user to move columns .
   * @desc Columns can be reordered through either of two interfaces:
   * * Column Dragging feature
   * * behavior.columns API
   * @type {boolean}
   * @default
   * @memberOf module:defaults
   */
  columnsReorderable: true,

  /**
   * @summary keep headers as is, only data columns moving
   */
  onlyDataReorder: true,

  /** @summary Column grab within this number of pixels from top of cell.
   * @type {number}
   * @default
   * @memberOf module:defaults
   */
  columnGrabMargin: 5,

  /** @summary Set up a clipping region around each column before painting cells.
   * @desc One of:
   * * `true` - Clip column.
   * * `false` - Do not clip column.
   * * `null` - Clip iff last active column.
   *
   * Clipping prevents text that overflows to the right of the cell from being rendered.
   * If you can guarantee that none of your text will overflow, turn column clipping off
   * for better performance. If not, you may still be able to get away without clipping.
   * If the background color of the next column is opaque, you don't really need to clip,
   * although text can leak out to the right of the last column. Clipping the last column
   * only can help this but not solve it since the leaked text from (say) the column before
   * the last column could stretch across the entire last column and leak out anyway.
   * The solution to this is to clip the rendered string so at most only a partial character
   * will overflow.
   * @type {boolean|undefined}
   * @default
   * @memberOf module:defaults
   */
  columnClip: false,

  /**
   * @summary Repeating pattern of property overrides for grid rows.
   * @desc Notes:
   * * "Grid row" refers to data rows.
   * * Row index modulo is applied when dereferencing this array. In other words, this array represents a _repeating pattern_ of properties to be applied to the data rows.
   * * For no row properties, specify a falsy value in place of the array.
   * * Do not specify an empty array (will throw an error).
   * * Each element of the array may be either:
   *   * An object containing property overrides to be applied to every cell of the row; or
   *   * A falsy value signifying that there are no row properties for this specific row.
   * * Caveat: Row properties use `Object.assign()` to copy properties and therefore are not as performant as column properties which use prototype chain.
   * * `Object.assign()` is a polyfill in older versions of Chrome (<45) and in all Internet Explorer (through 11).
   * @type {undefined|object[]}
   * @default
   * @memberOf module:defaults
   */
  rowStripes: undefined,

  // for Renderer.prototype.assignProps
  propClassLayers: propClassLayersMap.DEFAULT,

  /**
   * Used to access registered features -- unless behavior has a non-empty `features` property (array of feature contructors).
   */
  features: ['filters', 'contextmenu',
  // 'columnfixation',
  // 'rowfixation',
  'cellselection', 'keypaging', 'columnresizing',
  // 'rowresizing',
  'rowselection', 'columnselection', 'columnmoving', 'columnsorting', 'cellclick', 'cellediting', 'onhover', 'linkdetails', 'warningtooltip'],

  /** @summary How to truncate text.
   * @desc A "quaternary" value, one of:
   * * `undefined` - Text is not truncated.
   * * `true` (default) - Truncate sufficient characters to fit ellipsis if possible. Most acceptable option that avoids need for clipping.
   * * `false` - Truncate *before* last partially visible character. Visibly annoying; semantically jarring.
   * * `null` - Truncate *after* partially visible character. Less visibly annoying; still semantically confusing. Best solution when combined with either column clipping or painting over with next column's background.
   * @type {boolean|null|undefined}
   * @default
   * @memberOf module:defaults
   */
  truncateTextWithEllipsis: true,

  /**
   * @desc If true, colors will be combined on render.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  combineColors: false,

  /**
   * @desc List of context menu items, just title and callback
   * Params, that can be passed to each item declaration:
   * title | name (HTML string) - title of an menu item
   * action (function) - callback function, that will be called on click
   * isShown (boolean | function) - if passed, each item check this param, before it will be rendered
   * @default
   * @memberOf module:defaults
   */
  cellContextMenu: [{
    name: '<b>Filter</b> to value',
    action: function action(clickEvent, gridEvent) {
      console.log('<b>Filter</b> to value with event', gridEvent);
    }
  }, {
    name: '<b>Exclude</b> this value',
    action: function action(clickEvent, gridEvent) {
      console.log('<b>Exclude</b> this value with event', gridEvent);
    }
  }, {
    name: 'Copy',
    action: function action(clickEvent, gridEvent) {
      gridEvent.grid.api.copySelectedRangeToClipboard(false);
    }
  }, {
    name: 'Copy With Headers',
    action: function action(clickEvent, gridEvent) {
      gridEvent.grid.api.copySelectedRangeToClipboard(true);
    }
  }],

  /**
   * @desc List of header row context menu items, just title and callback
   * Params, that can be passed to each item declaration:
   * title | name (HTML string) - title of an menu item
   * action (function) - callback function, that will be called on click
   * isShown (boolean | function) - if passed, each item check this param, before it will be rendered
   * @default
   * @memberOf module:defaults
   */
  headerContextMenu: [{
    name: 'Rename',
    action: function action(clickEvent, cellEvent) {
      console.log('rename selected', clickEvent, cellEvent);
      cellEvent.grid.onEditorActivate(cellEvent);
    }
  }, {
    name: 'Remove',
    action: function action(clickEvent, cellEvent) {
      console.log('remove selected', clickEvent, cellEvent);
      var grid = cellEvent.grid;
      var colDef = grid.columnDefs;
      var column = cellEvent.column;

      // remove if it isn't removed in 'onRemoveColumn' callback
      grid.getColDefs(column.name).forEach(function (singleColDef) {
        colDef.splice(colDef.indexOf(singleColDef), 1);
      });

      grid.api.setColumnDefs(colDef);
    }
  }],

  /**
   * @desc if true, data cell context menu can be triggered.
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  showCellContextMenu: true,

  /**
   * @desc if true, context menu will be styled used next params (contextMenuHolderStyle, contextMenuListStyle,
   * contextMenuListOptionStyle, contextMenuListOptionHoverStyle, contextMenuListOptionIconStyle,
   * contextMenuListOptionTextStyle, contextMenuListOptionShortcutStyle, contextMenuListOptionPopupPointerStyle)
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  applyContextMenuStyling: true,

  /**
   * @desc style object for div, that renders when contextMenu called. This div contains contextMenuList as a child
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
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

  /**
   * @desc style object for div, that represents list of an context menu items
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
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

  /**
   * @desc style object for div, that represents single list item of context menu
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  contextMenuListOptionStyle: {
    height: '27px',
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fff'
  },

  /**
   * @desc style object for menu list item div, when in hovered state
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  contextMenuListOptionHoverStyle: {
    backgroundColor: '#eee'
  },

  /**
   * @desc style object for part of menu list item, that contains an icon
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  contextMenuListOptionIconStyle: {
    width: '30px',
    padding: '2px 4px',
    verticalAlign: 'middle'
  },

  /**
   * @desc style object for part of menu list item, that contains main text
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  contextMenuListOptionTextStyle: {
    padding: '2px 4px',
    verticalAlign: 'middle',
    flexGrow: '1'
  },

  /**
   * @desc style object for part of menu list item, that contains an shortcut
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  contextMenuListOptionShortcutStyle: {
    padding: '2px 2px 2px 20px',
    verticalAlign: 'middle',
    Width: '0'
  },

  /**
   * @desc style object for part of menu list item, that contains an popup pointer
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  contextMenuListOptionPopupPointerStyle: {
    padding: '2px 4px',
    verticalAlign: 'middle',
    width: '30px'
  },

  /**
   * @desc style object horizontal line (separator) that used to separate one items group from another
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  contextMenuSeparatorStyle: {
    display: 'block',
    borderTop: '1px solid #E5E5E5',
    margin: '5px 0'
  },

  /**
   * @desc html string, that will be displayed, if menu item has child menu.
   * Property contain whole html tag (not just class) because come iconpacks may use "span"(or any another)
   * tag instead of "i"
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  contextMenuChildMenuArrowIconTag: '<i class="fa fa-caret-right"></i>',

  /**
   * @desc header part color of an column fixation dragger, when dragger state is inactive
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnFixationDraggerHeaderInactiveColor: '#BCBCBC',

  /**
   * @desc header part color of an column fixation dragger, when dragger state is hovered
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnFixationDraggerHeaderHoveredColor: '#A5C6FE',

  /**
   * @desc header part color of an column fixation dragger, when dragger state is dragging
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnFixationDraggerHeaderDraggingColor: '#A5C6FE',

  /**
   * @desc body part color of an column fixation dragger, when dragger state is dragging
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnFixationDraggerBodyDraggingColor: '#DBE5F7',

  /**
   * @desc header part color of an column fixation placeholder
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnFixationPlaceholderHeaderColor: '#659DFC',

  /**
   * @desc body part color of an column fixation placeholder
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  columnFixationPlaceholderBodyColor: '#AFBBD1',

  /**
   * @desc header part color of an row fixation dragger, when dragger state is inactive
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowFixationDraggerHeaderInactiveColor: '#BCBCBC',

  /**
   * @desc header part color of an row fixation dragger, when dragger state is hovered
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowFixationDraggerHeaderHoveredColor: '#A5C6FE',

  /**
   * @desc header part color of an row fixation dragger, when dragger state is dragging
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowFixationDraggerHeaderDraggingColor: '#A5C6FE',

  /**
   * @desc body part color of an row fixation dragger, when dragger state is dragging
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowFixationDraggerBodyDraggingColor: '#DBE5F7',

  /**
   * @desc header part color of an row fixation placeholder
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowFixationPlaceholderHeaderColor: '#659DFC',

  /**
   * @desc body part color of an row fixation placeholder
   * @default
   * @type {cssColor}
   * @memberOf module:defaults
   */
  rowFixationPlaceholderBodyColor: '#AFBBD1',

  /**
   * @desc style object of an vertical scrollbar bar
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
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
    borderWidth: '1px'
  },

  /**
   * @desc style object of an horizontal scrollbar bar
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  scrollbarHStyle: {
    height: 13,
    border: '1px solid #d9d9d9',
    background: '#F8F8F8',
    boxShadow: '0 0 0 #000, 0 0 0 #000, 0 0 0 #000',
    marginLeft: 0,
    marginRight: 0,
    marginBottom: -1,
    borderRadius: 0
  },

  /**
   * @desc style object of an vertical scrollbar thumb
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  scrollbarVThumbStyle: {
    margin: 1,
    width: 9,
    right: 0,
    backgroundColor: '#C7C7C7',
    boxShadow: '0px 0px 0px inset',
    position: 'absolute',
    borderRadius: 0
  },

  /**
   * @desc style object of an horizontal scrollbar thumb
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  scrollbarHThumbStyle: {
    margin: 1,
    height: 9,
    bottom: 0,
    backgroundColor: '#C7C7C7',
    boxShadow: '0px 0px 0px inset',
    borderRadius: 0
  },

  /**
   * @desc style object of an horizontal scrollbar underlying div
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  scrollbarHMountStyle: {
    position: 'absolute',
    background: '#F8F8F8',
    border: '1px solid #D9D9D9'
  },

  /**
   * @desc style object of an vertical scrollbar underlying div
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  scrollbarVMountStyle: {
    position: 'absolute',
    background: '#F8F8F8',
    border: '1px solid #D9D9D9',
    borderTopWidth: '0'
  },

  /**
   * @desc style object of an div, that contains link info
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
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

  /**
   * @desc style object of an div, that contains link info, when mouse moved over it
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  linkDetailsHoveredStyle: {
    boxShadow: '0 0 2px 0 rgba(0,0,0,.15), 0 2px 2px 0 rgba(0,0,0,.4)'
  },

  /**
   * @desc Maximum length of link, that will be displayed on link details popover.
   * If length of string greater than this value, value will be truncated
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  linkDetailsMaxStringLength: 30,

  /**
   * @desc Link details hide timeout in milliseconds
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  linkDetailsHideTimeout: 1000,

  /**
   * @desc style object of an link info anchor tag
   * @default
   * @type {Object}
   * @memberOf module:defaults
   */
  linkDetailsAnchorStyle: {
    color: '#337ab7',
    textDecoration: 'none',
    lineHeight: '19px',
    fontFamily: 'Arial,sans-serif'
  },

  /**
   * @desc pixels count that will be used as canvas right padding on render
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  canvasWidthOffset: 14,

  /**
   * @desc pixels count that will be used as canvas bottom padding on render
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  canvasHeightOffset: 13,

  /**
   * @desc if true, context menu icon will be shown on every table cell
   * Best use of this parameter is set it on column or row
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  showCellContextMenuIcon: false,

  /**
   * @desc font of context menu icon
   * Best use of this parameter is set font family on one of connected icon-pack's, to render needed icon
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  contextMenuIconFont: 'normal normal lighter 14px fontAwesome',

  /**
   * @desc if true, context menu icon style will be set to hovered
   * (Utility prop. You don't need to set this param in most cases)
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  contextMenuIconIsHovered: false,

  /**
   * @desc Color of context menu icon, when not hovered
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  contextMenuIconColor: '#616161',

  /**
   * @desc Color of context menu icon, when hovered
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  contextMenuIconHoveredColor: '#616161',

  /**
   * @desc Color of context menu button border
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  contextMenuButtonStrokeStyle: '#C6C6C6',

  /**
   * @desc Color of context menu button background color
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  contextMenuButtonFillStyle: '#F8F8F8',

  /**
   * @desc Color of context menu button background color when hovered
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  contextMenuButtonHoveredFillStyle: '#f0f0f0',

  /**
   * @desc String, that will be displayed as context menu icon
   * Best way to use this parameter is set it's value on such unicode char, provided by your icons pack
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  contextMenuIconUnicodeChar: decodeURI('\uF0D7'),

  /**
   * @desc String, that will be displayed as error icon
   * Best way to use this parameter is set it's value on such unicode char, provided by your icons pack
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  errorIconUnicodeChar: decodeURI('\uF071'),

  /**
   * @desc height of icon, that represents total number of errors
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  totalErrorsCountIconHeight: 16,

  /**
   * @desc width of icon, that represents total number of errors
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  totalErrorsCountIconWidth: 18,

  /**
   * @desc font of error icon
   * Best use of this parameter is set font family on one of connected icon-pack's, to render needed icon
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  errorIconFont: '13px fontAwesome',

  /**
   * @desc color of error icon
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  errorIconColor: '#FF3D3D',

  /**
   * @desc Prefered width of button
   * (Utility prop. You don't need to set this param in most cases. Used in context menu feature)
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  contextMenuButtonIconPreferedWidth: 8,

  /**
   * @desc space between cell right border and button
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  contextMenuButtonRightMargin: 5,

  /**
   * @desc context menu button height
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  contextMenuButtonHeight: 12,

  /**
   * @desc space between context menu button content and border
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  contextMenuButtonPadding: 3,

  /**
   * @desc Space from context menu icon to main text of cell
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  contextMenuLeftSpaceToCutText: 5,

  /**
   * @desc Font of column type sign
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnTypeSignFont: '900 10px "Helvetica Neue",Helvetica,Arial,sans-serif',

  /**
   * @desc Color of column type sign
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnTypeSignColor: '#343434',

  /**
   * @desc Font of column title prefix
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnTitlePrefixFont: '800 12px "Helvetica Neue",Helvetica,Arial,sans-serif',

  /**
   * @desc Color of column title prefix
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnTitlePrefixColor: '#818181',

  /**
   * @desc Space from context menu icon to main text of cell
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  columnTitlePrefixRightSpace: 5,

  /**
   * @desc Font of text (total number of errors), that rendered inside warning icon
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnWarningFont: '1000 9px "Helvetica Neue",Helvetica,Arial,sans-serif',

  /**
   * @desc color of error icon
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnWarningFontColor: 'white',

  /**
   * @desc color of total errors icon
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnWarningIconColor: '#FF3D3D',

  /**
   * @desc classes of tooltip container when placed at bottom
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  warningTooltipBottomClass: 'tooltip bottom ng-animate in-add fade in main-page-tooltip',

  /**
   * @desc classes of tooltip container when placed at right
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  warningTooltipRightClass: 'tooltip right ng-animate in-add fade in main-page-tooltip',

  /**
   * @desc classes of tooltip-arrow
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  warningTooltipArrowClass: 'tooltip-arrow',

  /**
   * @desc classes of tooltip-inner
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  warningTooltipInnerClass: 'tooltip-inner',

  /**
   * @desc tooltip opacity when visible
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  warningTooltipOpacity: 0.8,

  /**
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  columnMoveInsertLineColor: '#777777',

  /**
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  columnMoveInsertLineWidth: 2,

  /**
   * @desc Color of number, that displays total count of each group while aggregated
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  cellValuePostfixColor: '#8F8F8F',

  /**
   * @desc Font of aggregation total number
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  cellValuePostfixFont: '13px "Helvetica Neue",Helvetica,Arial,sans-serif',

  /**
   * @desc Space between main cell content and postfix
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  cellValuePostfixLeftOffset: 5,

  /**
   * @desc font of aggregation group expand icon
   * Best use of this parameter is set font family on one of connected icon-pack's, to render needed icon
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  aggregationGroupExpandIconFont: 'normal normal lighter 14px fontAwesome',

  /**
   * @desc color of aggregated row expand icon
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  aggregationGroupExpandIconColor: '#9F9F9F',

  /**
   * @desc icon (or text(not recomended)) that will be displayed as expand action trigger
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  aggregationGroupExpandIconExpandedChar: decodeURI('\uF196'),

  /**
   * @desc icon (or text(not recomended)) that will be displayed as collapse action trigger
   * @default
   * @type {string}
   * @memberOf module:defaults
   */
  aggregationGroupExpandIconCollapsedChar: decodeURI('\uF147'),

  /**
   * @desc additional left offset of each tree level.
   * Other words, every child row will be displayed with additional offset
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  aggregationGroupTreeLevelOffset: 17,

  /**
   * @desc width of clickable area, that starts on group expand icon start
   * Utility param. Used to perform clicks on icon
   * @default
   * @type {number}
   * @memberOf module:defaults
   */
  aggregationGroupExpandIconClickableWidth: 15,

  /**
   * font of aggregation grand total
   * @default
   * @type {cssFont}
   * @memberOf module:defaults
   */
  grandAggregationCellFont: 'bold 13px "Helvetica Neue",Helvetica,Arial,sans-serif',

  /**
   * If true, values prefixes will not be rendered even if exist
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  ignoreValuePrefix: false,

  /**
   * If true, values postfixes will not be rendered even if exist
   * @default
   * @type {boolean}
   * @memberOf module:defaults
   */
  ignoreValuePostfix: false,

  /**
   * @summary placeholder for drawing null values
   */
  nullCellPlaceholder: 'Ø',

  /**
   * @summary color of placeholder for null values
   */
  nullCellColor: '#d4d4d4',

  /**
   * @summary tag in which wrapped text which needed to highlight, for instance, search result
   */
  highLightText: '',

  /**
   * @summary color for highlight text, for instance, search result
   */
  highlightColor: '#F7FFBA',

  /**
   * @summary value for managing behaviour with aggregated data
   */
  isPivot: false
};

var warned = {};

function rowPropertiesDeprecationWarning() {
  if (!warned.rowProperties) {
    warned.rowProperties = true;
    console.warn('The `rowProperties` property has been deprecated as of v2.1.0 in favor of `rowStripes`. (Will be removed in a future release.)');
  }
}

Object.defineProperties(defaults, {
  rowProperties: {
    get: function get() {
      rowPropertiesDeprecationWarning();
      return this.rowStripes;
    },
    set: function set(rowProperties) {
      rowPropertiesDeprecationWarning();
      this.rowStripes = rowProperties;
    }
  }
});

function columnOnlyError() {
  throw new HypergridError('Attempt to set/get column-only property on a non-column properties object.');
}

['name', 'type', 'header', 'calculator'].forEach(function (key) {
  Object.defineProperty(defaults, key, {
    set: columnOnlyError
  });
});

/** @typedef {string} cssColor
 * @see https://developer.mozilla.org/docs/Web/CSS/color_value
 */

/** @typedef {string} cssFont
 * @see https://developer.mozilla.org/docs/Web/CSS/font
 */

/**
 * Returns any value of `keyChar` that passes the following logic test:
 * 1. If a non-printable, white-space character, then nav key.
 * 2. If not (i.e., a normal character), can still be a nav key if not editing on key down.
 * 3. If not, can still be a nav key if CTRL key is down.
 *
 * Note: Callers are typcially only interested in the following values of `keyChar` and will ignore all others:
 * * `'LEFT'` and `'LEFTSHIFT'`
 * * `'RIGHT'` and `'RIGHTSHIFT'`
 * * `'UP'` and `'UPSHIFT'`
 * * `'DOWN'` and `'DOWNSHIFT'`
 *
 * @param {string} keyChar - A value from Canvas's `charMap`.
 * @param {boolean} [ctrlKey=false] - The CTRL key was down.
 * @returns {undefined|string} `undefined` means not a nav key; otherwise returns `keyChar`.
 * @memberOf module:defaults
 */
function navKey(keyChar, ctrlKey) {
  var result;
  if (keyChar.length > 1 || !this.editOnKeydown || ctrlKey) {
    result = keyChar; // return the mapped value
  }
  return result;
}

/**
 * Returns only values of `keyChar` that, when run through {@link module:defaults.navKeyMap|navKeyMap}, pass the {@link module:defaults.navKey|navKey} logic test.
 *
 * @param {string} keyChar - A value from Canvas's `charMap`, to be remapped through {@link module:defaults.navKeyMap|navKeyMap}.
 * @param {boolean} [ctrlKey=false] - The CTRL key was down.
 * @returns {undefined|string} `undefined` means not a nav key; otherwise returns `keyChar`.
 * @memberOf module:defaults
 */
function mappedNavKey(keyChar, ctrlKey) {
  keyChar = this.navKeyMap[keyChar];
  return keyChar && this.navKey(keyChar);
}

/** @summary Reapply cell properties after `getCell`.
 * @type {boolean}
 * @default
 * @memberOf module:defaults
 */
function reapplyCellProperties(value) {
  if (!warned.reapplyCellProperties) {
    console.warn('The `.reapplyCellProperties` property has been deprecated as of v2.1.3 in favor of using the new `.propClassLayers` property. (May be removed in a future release.) This property is now a setter which sets `.propClassLayers` to `.propClassLayersMap.DEFAULT` (grid ← columns ← stripes ← rows ← cells) on truthy or `propClassLayersMap.NO_ROWS` (grid ← columns ← cells) on falsy, which is what you will see on properties stringification. This will give the same effect in most cases as the former property implementation, but not in all cases due to it no longer being applied dynamically. Developers should discontinue use of this property and start specifying `.propClassLayers` instead.');
    warned.reapplyCellProperties = true;
  }
  this.propClassLayers = value ? propClassLayersMap.NO_ROWS : propClassLayersMap.DEFAULT;
}

function deleteProp(propName) {
  var descriptor = Object.getOwnPropertyDescriptor(this, propName);
  if (!descriptor) {
    return false; // own property not found
  } else if (!descriptor.get) {
    return delete this[propName]; // non-accessor property found (returns !descriptor.configurable)
  } else if (descriptor.get.toString().indexOf('.var.')) {
    this.var[propName] = Object.getPrototypeOf(this)[propName];
  } else {
    return true; // property not deletable
  }
  this.grid.repaint();
  return false; // delete was successful
}

/**
 * @summary Execute value if "calculator" (function) or if column has calculator.
 * @desc This function is referenced here so:
 * 1. It will be available to the cell renderers
 * 2. Its context will naturally be the `config` object
 * @default {@link module:defaults.exec|exec}
 * @method
 * @param vf - Value or function.
 * @memberOf module:defaults
 */
function exec(vf) {
  if (this.dataRow) {
    var calculator = (typeof vf === 'undefined' ? 'undefined' : _typeof(vf))[0] === 'f' && vf || this.calculator;
    if (calculator) {
      vf = calculator(this.dataRow, this.name, this.subrow);
    }
  }
  return vf;
}

// Add non-enumerable "utility" props so they will be available wherever props are available.
Object.defineProperties(defaults, {
  mixIn: { value: require('overrider').mixIn },
  delete: { value: deleteProp },
  propClassEnum: { value: propClassEnum },
  propClassLayersMap: { value: propClassLayersMap },
  navKey: { value: navKey },
  mappedNavKey: { value: mappedNavKey },
  reapplyCellProperties: { set: reapplyCellProperties },
  exec: { value: exec }
});

module.exports = defaults;
