/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import "@webcomponents/webcomponentsjs";
import "@webcomponents/shadycss/custom-style-interface.min.js";

import perspective from "@jpmorganchase/perspective";

import _ from "lodash";
import {polyfill} from "mobile-drag-drop";

import {bindTemplate, json_attribute, array_attribute, copy_to_clipboard} from "./utils.js";
import {renderers, register_debug_plugin} from "./viewer/renderers.js";
import {COMPUTATIONS} from "./computed_column.js";
import {COMPUTED_EXPRESSION_PARSER} from "./computed_column/computed_column_parser.js";

import "./row.js";
import "./row_settings.js";
import "./formula/formula_bar.js";
import "./formula/formula_helper.js";
import "./formula/expression_editor.js";

import template from "../html/viewer.html";

import view_style from "../less/viewer.less";
import default_style from "../less/default.less";

import {ActionElement} from "./viewer/action_element.js";

import {RedoUndoManager} from "./viewer/command_manager.js";

import IngestClient from "@datadocs/ingest";

import {Tooltip} from "./viewer/tooltip.js";

polyfill({});

/**
 * Module for `<perspective-viewer>` custom element.  There are no exports from
 * this module, however importing it has a side effect:  the
 * {@link module:perspective_viewer~PerspectiveViewer} class is registered as a
 * custom element, after which it can be used as a standard DOM element.  The
 * documentation in this module defines the instance structure of a
 * `<perspective-viewer>` DOM object instantiated typically, through HTML or any
 * relevent DOM method e.g. `document.createElement("perspective-viewer")` or
 * `document.getElementsByTagName("perspective-viewer")`.
 *
 * @module perspective-viewer
 */

/**
 * HTMLElement class for `<perspective-viewer>` custom element.  This class is
 * not exported, so this constructor cannot be invoked in the typical manner;
 * instead, instances of the class are created through the Custom Elements DOM
 * API.
 *
 * Properties of an instance of this class, such as {@link module:perspective_viewer~PerspectiveViewer#columns},
 * are reflected on the DOM element as Attributes, and should be accessed as
 * such - e.g. `instance.setAttribute("columns", JSON.stringify(["a", "b"]))`.
 *
 * @class PerspectiveViewer
 * @extends {HTMLElement}
 * @example
 * // Create a new `<perspective-viewer>`
 * const elem = document.createElement("perspective-viewer");
 * elem.setAttribute("columns", JSON.stringify(["a", "b"]));
 * document.body.appendChild(elem);
 *
 */
@bindTemplate(template, view_style, default_style) // eslint-disable-next-line no-unused-vars
class PerspectiveViewer extends ActionElement {
    constructor() {
        super();
        this._register_debounce_instance();
        this._show_config = true;
        this._show_warnings = true;
        // Not empty Grid
        this._show_grid_data = true;
        this._first_load_grid_data = false;
        this._first_create_view_data = false;
        this._file_name = "";
        this._contains_row_dragging = false;
        this._show_multiple_date_aggregate_warning = false;
        this._resize_handler = _.debounce(this.notifyResize, 250).bind(this);
        window.addEventListener("load", this._resize_handler);
        window.addEventListener("resize", this._resize_handler);
        this.REQUEST_STRUCTURE = {
            current: {},
            building: {}
        };
        this.AUTO_QUERY = true;
        this.SUB_TOTAL_LIST = [];
        this.ROW_PIVOT_VALUES = [];
        this._begin_query_time = 0;
        this._added_source_time = null;

        this.redo_undo_manager = new RedoUndoManager(_ => {
            this._update_redo_undo_button();
        });

        this.ERR_MULTIPLE_FILE = "Multiple files currently not supported";
        this.ERR_FILE_PARSER = "That file type is either invalid or not currently supported.";
        this.ERR_CANCEL_QUERY = "Query cancelled.";

        this._popup_offset = { x: 0, y: 0 };

        this._site_search_obj = {site_search_af: false};

        this._started_new_query_time = 0;
        this._tooltip = null;

        this.keep_using_prev_cols_settings = false;

        this.resize_available_fields_percentage = null;
        this._computed_expression_parser = COMPUTED_EXPRESSION_PARSER;
    }

    bootIngest() {
        if (!this.client_promise) {
            this.client_promise = IngestClient.init_ingest_client();
        }
    }

    updateVisSelector() {
        this._vis_selector.innerHTML = "";
        this._register_view_options();
    }

    connectedCallback() {
        if (Object.keys(renderers.getInstance()).length === 0) {
            register_debug_plugin();
        }

        this.setAttribute("settings", true);

        this._register_ids();
        this._register_callbacks();
        this._register_view_options();
        this._register_data_attribute();
        this.toggleConfig();

        for (let attr of ["row-pivots", "column-pivots", "filters", "sort"]) {
            if (!this.hasAttribute(attr)) {
                this.setAttribute(attr, "[]");
            }
        }
    }

    /**
     * Sets this `perspective.table.view`'s `sort` property, an array of column
     * names.
     *
     * @kind member
     * @type {array<string>} Array of arrays tuples of column name and
     * direction, where the possible values are "asc", "desc", "asc abs",
     * "desc abs" and "none".
     * @fires PerspectiveViewer#perspective-config-update
     * @example <caption>via Javascript DOM</caption>
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('sort', JSON.stringify([["x","desc"]));
     * @example <caption>via HTML</caption>
     * <perspective-viewer sort='[["x","desc"]]'></perspective-viewer>
     */
    @array_attribute
    sort(sort) {
        if (this._updating_name) {
            this._update_rename_for_list("#sort perspective-row");
        } else {
            var inner = this._sort.querySelector("ul");
            this._update_column_list(
                sort,
                inner,
                s => {
                    let dir = "none"; //"asc";
                    let sort_by;
                    let subtotal;
                    let limit;
                    let limit_type;
                    if (Array.isArray(s)) {
                        dir = s[1] || "none"; //"asc";
                        sort_by = s[2];
                        subtotal = s[3];
                        limit = s[4];
                        limit_type = s[5];
                        s = s[0];
                    }
                    var sort_term = {
                        order: dir,
                        sort_by: sort_by,
                        subtotal: subtotal,
                        limit: limit,
                        limit_type: limit_type
                    };
                    return this._new_row(s, false, false, false, false, sort_term, undefined, "sort");
                },
                (sort, node) => {
                    if (Array.isArray(sort)) {
                        return node.getAttribute("name") === sort[0] && node.getAttribute("sort_order") === sort[1];
                    }
                    return node.getAttribute("name") === sort;
                }
            );
            this.dispatchEvent(new Event("perspective-config-update"));
            this._run_query();
        }
    }

    /**
     * The set of visible columns.
     *
     * @kind member
     * @param {array} columns An array of strings, the names of visible columns.
     * @fires PerspectiveViewer#perspective-config-update
     * @example <caption>via Javascript DOM</caption>
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('columns', JSON.stringify(["x", "y'"]));
     * @example <caption>via HTML</caption>
     * <perspective-viewer columns='["x", "y"]'></perspective-viewer>
     */
    @array_attribute
    columns(show) {
        if (!this._updating_dropdown) {
            this._update_column_view(show, true);
            this.dispatchEvent(new Event("perspective-config-update"));
            this._run_query();
        }
    }

    /**
     * The set of visible columns.
     *
     * @kind member
     * @param {array} computed-columns An array of computed column objects
     * @fires PerspectiveViewer#perspective-config-update
     * @example <caption>via Javascript DOM</caption>
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('computed-columns', JSON.stringify([{name: "x+y", func: "add", inputs: ["x", "y"]}]));
     * @example <caption>via HTML</caption>
     * <perspective-viewer computed-columns="[{name:'x+y',func:'add',inputs:['x','y']}]""></perspective-viewer>
     */
    @array_attribute
    "computed-columns"(computed_columns) {
        const resolve = this._set_updating();
        this._computed_column._close_computed_column();
        (async () => {
            if (computed_columns === null || computed_columns === undefined || computed_columns.length === 0) {
                // Remove computed columns from the DOM, and reset the config
                // to exclude all computed columns.
                if (this.hasAttribute("computed-columns")) {
                    this.removeAttribute("computed-columns");
                    const parsed = this._get_view_parsed_computed_columns();
                    this._reset_computed_column_view(parsed);
                    this.removeAttribute("parsed-computed-columns");
                    resolve();
                    return;
                }
                computed_columns = [];
            }

            let parsed_computed_columns = [];

            if (this._computed_expression_parser.is_initialized) {
              for (const column of computed_columns) {
                parsed_computed_columns = parsed_computed_columns.concat(this._computed_expression_parser.parse(`${column.expression}as[${column.column}]`));
              }
            }

            // Attempt to validate the parsed computed columns against the Table
            let computed_schema = {};

            if (this._table) {
                computed_schema = await this._table.computed_schema(parsed_computed_columns);
                const validated = await this._validate_parsed_computed_columns(parsed_computed_columns, computed_schema);

                console.log('-----computed-------------------', computed_schema, parsed_computed_columns, validated);
                if (validated.length !== parsed_computed_columns.length) {
                    // Generate a diff error message with the invalid columns
                    const diff = [];
                    for (let i = 0; i < parsed_computed_columns.length; i++) {
                        if (i > validated.length - 1) {
                            diff.push(parsed_computed_columns[i]);
                        } else {
                            if (parsed_computed_columns[i].column !== validated[i].column) {
                                diff.push(parsed_computed_columns[i]);
                            }
                        }
                    }
                    console.warn("Could not apply these computed columns:", JSON.stringify(diff));
                }
                parsed_computed_columns = validated;
            }

            console.log("------parsed---------", parsed_computed_columns);

            // Need to refresh the UI so that previous computed columns used in
            // pivots, columns, etc. get cleared
            const old_columns = this._get_view_parsed_computed_columns();
            const to_remove = this._diff_computed_column_view(old_columns, parsed_computed_columns);
            this._reset_computed_column_view(to_remove);

            // Always store a copy of the parsed computed columns for
            // validation of column names, etc.
            this.setAttribute("parsed-computed-columns", JSON.stringify(parsed_computed_columns));
            
            this.dispatchEvent(new Event("perspective-config-update"));
            this.dispatchEvent(new Event("perspective-computed-column-update"));
            await this._debounce_update();

            this._update_computed_column_view(computed_schema);

            resolve();
        })();
    }

    @array_attribute
    "agg-custom"(agg_custom) {
        if (agg_custom.length > 0 && !this._updating_name) {
            const resolve = this._set_updating();
            this._computed_column._close_computed_column();
            if (this.is_row_pivot()) {
                (async () => {
                    await this._debounce_update();
                    for (let col of agg_custom) {
                        this._create_pivot_computed_column({
                            column_name: col.name,
                            computation: COMPUTATIONS[col.func],
                            is_pivot: true
                        });
                    }
                    resolve();
                    this.dispatchEvent(new Event("perspective-config-update"));
                    this._update_column_view();
                })();
            }
        }
    }

    /**
     * The set of column aggregate configurations.
     *
     * @kind member
     * @param {object} aggregates A dictionary whose keys are column names, and
     * values are valid aggregations.  The `aggergates` attribute works as an
     * override;  in lieu of a key for a column supplied by the developers, a
     * default will be selected and reflected to the attribute based on the
     * column's type.  See {@link perspective/src/js/defaults.js}
     * @fires PerspectiveViewer#perspective-config-update
     * @example <caption>via Javascript DOM</caption>
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('aggregates', JSON.stringify({x: "distinct count"}));
     * @example <caption>via HTML</caption>
     * <perspective-viewer aggregates='{"x": "distinct count"}'></perspective-viewer>
     */
    @json_attribute
    aggregates(show) {
        let lis = this._get_view_dom_columns();
        lis.map(x => {
            let agg = show[x.getAttribute("name")];
            if (agg) {
                x.setAttribute("aggregate", agg);
            }
        });
        this.dispatchEvent(new Event("perspective-config-update"));
        if (!this._updating_name) {
            this._run_query();
        }
    }

    /**
     * The set of column filter configurations.
     *
     * @kind member
     * @type {array} filters An arry of filter config objects.  A filter
     * config object is an array of three elements:
     *     * The column name.
     *     * The filter operation as a string.  See
     *       {@link perspective/src/js/defaults.js}
     *     * The filter argument, as a string, float or Array<string> as the
     *       filter operation demands.
     * @fires PerspectiveViewer#perspective-config-update
     * @example <caption>via Javascript DOM</caption>
     * let filters = [
     *     ["x", "<", 3],
     *     ["y", "contains", "abc"]
     * ];
     * let elem = document.getElementById('my_viewer');
     * elem.setAttribute('filters', JSON.stringify(filters));
     * @example <caption>via HTML</caption>
     * <perspective-viewer filters='[["x", "<", 3], ["y", "contains", "abc"]]'></perspective-viewer>
     */
    @array_attribute
    filters(filters) {
        if (this._updating_name) {
            this._update_rename_for_list("#filters perspective-row");
        } else {
            if (!this._updating_filter && typeof this._table !== "undefined") {
                var inner = this._filters.querySelector("ul");
                this._update_column_list(
                    filters,
                    inner,
                    filter => {
                        const fterms = JSON.stringify({
                            operator: filter.operator,
                            operand: filter.operand,
                            filter_by: filter.filter_by,
                            subtotal: filter.subtotal,
                            ignore_list: filter.ignore_list,
                            selected_list: filter.selected_list,
                            unselected_all: filter.unselected_all,
                            datalist_contains_all: filter.datalist_contains_all,
                            search: filter.search,
                            site_search: filter.site_search,
                            is_custom_filter: filter.is_custom_filter,
                            group_filter: filter.group_filter
                        });
                        return this._new_row(filter.n, undefined, undefined, undefined, fterms, undefined, undefined, "filters");
                    },
                    (filter, node) =>
                        node.getAttribute("name") === filter.n &&
                        node.getAttribute("filter") ===
                            JSON.stringify({
                                operator: filter.operator,
                                operand: filter.operand,
                                filter_by: filter.filter_by,
                                subtotal: filter.subtotal,
                                ignore_list: filter.ignore_list,
                                selected_list: filter.selected_list,
                                unselected_all: filter.unselected_all,
                                datalist_contains_all: filter.datalist_contains_all,
                                search: filter.search,
                                site_search: filter.site_search,
                                is_custom_filter: filter.is_custom_filter
                            })
                );
            }
            this.dispatchEvent(new Event("perspective-config-update"));
            if (!this._force_to_fetch_only) {
                this._run_query();
            }
        }
    }

    set searchs(searchs) {
        this.dispatchEvent(new Event("perspective-config-update"));
        var searchs = this.getAttribute("searchs");
        this._set_view_searchs(searchs || "");
        this._run_query();
    }


    /**
     * Sets the currently selected plugin, via its `name` field.
     *
     * @type {string}
     * @fires PerspectiveViewer#perspective-config-update
     */
    set view(v) {
        this._vis_selector.value = this.getAttribute("view");
        this._set_row_styles();
        this._set_column_defaults();
        this.dispatchEvent(new Event("perspective-config-update"));
    }

    /**
     * Sets this `perspective.table.view`'s `column_pivots` property.
     *
     * @kind member
     * @type {Array<String>} Array of column names
     * @fires PerspectiveViewer#perspective-config-update
     */
    @array_attribute
    "column-pivots"(pivots) {
        if (this._updating_name) {
            this._update_rename_for_list("#column-pivots perspective-row");
        } else {
            var inner = this._column_pivots.querySelector("ul");
            this._update_column_list(
                pivots,
                inner,
                pivot => this._new_row(pivot.n, pivot.t, pivot.agg, undefined, undefined, undefined, undefined, "column_pivots", pivot),
                (pivot, node) => {
                  let p_agg = pivot.agg_l || "OFF";
                  let node_agg = node.getAttribute("agg_level") || "OFF";
                  if (p_agg != node_agg) {
                    node.setAttribute("agg_level", p_agg);
                  }
                });
            this.dispatchEvent(new Event("perspective-config-update"));
            if (!this._force_to_fetch_only) {
                this._run_query();
            }
        }
    }

    /**
     * Sets this `perspective.table.view`'s `row_pivots` property.
     *
     * @kind member
     * @type {array<string>} Array of column names
     * @fires PerspectiveViewer#perspective-config-update
     */
    @array_attribute
    "row-pivots"(pivots) {
        if (this._updating_name) {
            this._update_rename_for_list("#row-pivots perspective-row");
        } else {
            var inner = this._row_pivots.querySelector("ul");
            this._update_column_list(
              pivots,
              inner,
              pivot => this._new_row(pivot.n, pivot.t, pivot.agg, undefined, undefined, undefined, undefined, "row_pivots", /*undefined, pivot.agg_l, pivot.drag_id,*/ pivot),
              (pivot, node) => {
                  let p_agg = pivot.agg_l || "OFF";
                  let node_agg = node.getAttribute("agg_level") || "OFF";
                  if (p_agg != node_agg) {
                    node.setAttribute("agg_level", p_agg);
                  }
              });
            this.dispatchEvent(new Event("perspective-config-update"));
            if (!this._force_to_fetch_only) {
                this._run_query();
            }
        }
    }

    /**
     * Sets this `perspective.table.view`'s `value_pivots` property.
     *
     * @kind member
     * @type {array<string>} Array of column names
     * @fires PerspectiveViewer#perspective-config-update
     */
    @array_attribute
    "value-pivots"(pivots) {
        if (this._updating_name) {
            this._update_rename_for_list("#value-pivots perspective-row");
        } else {
            var inner = this._value_pivots.querySelector("ul");
            this._update_column_list(pivots, inner,
                pivot => {
                    var row = this._new_row(pivot.n, pivot.t, pivot.agg, undefined, undefined, undefined, undefined, "value_pivots", /*undefined, undefined, pivot.drag_id,*/ pivot);
                    var new_base_name = this.is_cinfo_pivot(false) ? this._get_disp_name_aggregate(pivot.n, pivot.agg, pivot.p, this._get_column_show_type(row)) : pivot.n;
                    // set attribute new_base_name
                    row.setAttribute("new_base_name", new_base_name);
                    // set attribute dname
                    row.setAttribute("dname", pivot.dname);
                    row.setAttribute("vname", pivot.dname)
                    row.setAttribute("alias_name", pivot.dname);
                    return row;
                });
            this.dispatchEvent(new Event("perspective-config-update"));
            if (!this._force_to_fetch_only) {
                this._run_query();
            }
        }
    }

    @json_attribute
    "dname-pivots"(dnames) {
    }

    /**
     * Set maximum columns attribute and update max col dropdown value
     */
    set max_col(m) {
        var max_col = this.getAttribute("max_col");
        if (this._vis_max_col.value !== max_col) {
            this._vis_max_col.value = max_col;
        }
    }

    /**
     * Set maximum rows attribute and update max row dropdown value
     */
    set max_row(m) {
        var max_row = this.getAttribute("max_row");
        if (this._vis_max_row.value !== max_row) {
            this._vis_max_row.value = max_row;
        }
    }

    /**
     * Set pivot view mode and update pivot view dropdown value
     */
    set pivot_view_mode(m) {
        var pivot_view_mode = this.getAttribute("pivot_view_mode");
        /*if (this._vis_pivot_view.value !== pivot_view_mode) {
            this._vis_pivot_view.value = pivot_view_mode;
        }*/
        var is_checked = (pivot_view_mode && parseInt(pivot_view_mode) === 1) ? true : false;
        if (this._flatten_agg_view.checked !== is_checked){
          this._flatten_agg_view.checked = is_checked;
        }

        // Only Update when the Rows or Columns Pivot is enabled
        if (this.is_cinfo_pivot(false)){
          this._update_value_pivot_view();
          this._update_items_per_page();
        }
    }

    set pagination(m) {
        var pagination = JSON.parse(this.getAttribute("pagination")) || {
            page_items: 0,
            page_number: 0
        };
        if (this._vis_page_item.value !== pagination.page_items) {
            this._vis_page_item.value = pagination.page_items == 0 ? "--" : pagination.page_items;
        }
        this._pagination_page_number.innerHTML = pagination.page_number;
        this._set_pagination_group(pagination.page_number);
        this._update_items_per_page();
    }

    /**
     * This element's `perspective` worker instance.  This property is not
     * reflected as an HTML attribute, and is readonly;  it can be effectively
     * set however by calling the `load() method with a `perspective.table`
     * instance from the preferred worker.
     *
     * @readonly
     * @example
     * let elem = document.getElementById('my_viewer');
     * let table = elem.worker.table([{x:1, y:2}]);
     * elem.load(table);
     */
    get worker() {
        return this._get_worker();
    }

    /**
     * This element's `perspective.table` instance.
     *
     * @readonly
     */
    get table() {
        return this._table;
    }

    /**
     * This element's `perspective.table.view` instance.  The instance itself
     * will change after every `PerspectiveViewer#perspective-config-update` event.
     *
     * @readonly
     */
    get view() {
        return this._view;
    }

    /**
     * Load data.  If `load` or `update` have already been called on this
     * element, its internal `perspective.table` will also be deleted.
     *
     * @param {any} data The data to load.  Works with the same input types
     * supported by `perspective.table`.
     * @returns {Promise<void>} A promise which resolves once the data is
     * loaded and a `perspective.view` has been created.
     * @fires module:perspective_viewer~PerspectiveViewer#perspective-click PerspectiveViewer#perspective-view-update
     * @example <caption>Load JSON</caption>
     * const my_viewer = document.getElementById('#my_viewer');
     * my_viewer.load([
     *     {x: 1, y: 'a'},
     *     {x: 2, y: 'b'}
     * ]);
     * @example <caption>Load CSV</caption>
     * const my_viewer = document.getElementById('#my_viewer');
     * my_viewer.load("x,y\n1,a\n2,b");
     * @example <caption>Load perspective.table</caption>
     * const my_viewer = document.getElementById('#my_viewer');
     * const tbl = perspective.table("x,y\n1,a\n2,b");
     * my_viewer.load(tbl);
     */
    load(data, options) {
        try {
            data = data.trim();
        } catch (e) {}
        let table;
        if (data.hasOwnProperty("_name")) {
            table = data;
        } else {
            table = this.worker.table(data, options);
            table._owner_viewer = this;
        }
        return this._load_table(table);
    }

    /**
     * Updates this element's `perspective.table` with new data.
     *
     * @param {any} data The data to load.  Works with the same input types
     * supported by `perspective.table.update`.
     * @fires PerspectiveViewer#perspective-view-update
     * @example
     * const my_viewer = document.getElementById('#my_viewer');
     * my_viewer.update([
     *     {x: 1, y: 'a'},
     *     {x: 2, y: 'b'}
     * ]);
     */
    update(data) {
        if (this._table === undefined) {
            this.load(data);
        } else {
            this._table.update(data);
        }
    }

    /**
     * Determine whether to reflow the viewer and redraw.
     *
     */
    notifyResize() {
        this._check_responsive_layout();
        if (!document.hidden && this.offsetParent) {
            this._plugin.resize.call(this);
        }
    }

    /**
     * Duplicate an existing `<perspective-element>`, including data and view
     * settings.  The underlying `perspective.table` will be shared between both
     * elements
     *
     * @param {any} widget A `<perspective-viewer>` instance to clone.
     */
    clone(widget) {
        if (widget.hasAttribute("index")) {
            this.setAttribute("index", widget.getAttribute("index"));
        }
        if (this._inner_drop_target) {
            this._inner_drop_target.innerHTML = widget._inner_drop_target.innerHTML;
        }

        this._load_table(widget.table);
        this.restore(widget.save());
    }

    /**
     * Deletes this element's data and clears it's internal state (but not its
     * user state).  This (or the underlying `perspective.table`'s equivalent
     * method) must be called in order for its memory to be reclaimed.
     *
     * @param {boolean} delete_table Should a delete call also be made to the
     * underlying `table()`.
     * @returns {Promise<boolean>} Whether or not this call resulted in the
     * underlying `perspective.table` actually being deleted.
     */
    delete(delete_table = true) {
        let x = this._clear_state(delete_table);
        if (this._plugin.delete) {
            this._plugin.delete.call(this);
        }
        window.removeEventListener("load", this._resize_handler);
        window.removeEventListener("resize", this._resize_handler);
        return x;
    }

    /**
     * Serialize this element's attribute/interaction state.
     *
     * @returns {object} a serialized element.
     */
    save() {
        let obj = {};
        for (let key = 0; key < this.attributes.length; key++) {
            let attr = this.attributes[key];
            if (["id"].indexOf(attr.name) === -1) {
                obj[attr.name] = attr.value;
            }
        }
        if (this._plugin.save) {
            obj.plugin_config = this._plugin.save.call(this);
        }
        return obj;
    }

    /**
     * Restore this element to a state as generated by a reciprocal call to
     * `save`.
     *
     * @param {object} x returned by `save`.
     * @returns {Promise<void>} A promise which resolves when the changes have
     * been applied.
     */
    async restore(x) {
        for (let key in x) {
            let val = x[key];
            if (typeof val !== "string") {
                val = JSON.stringify(val);
            }
            this.setAttribute(key, val);
        }
        if (this._plugin.restore && x.plugin_config) {
            this._plugin.restore.call(this, x.plugin_config);
        }
        await this._debounce_update();
    }

    /**
     * Flush any pending attribute modifications to this element.
     *
     * @returns {Promise<void>} A promise which resolves when the current
     * attribute state has been applied.
     */
    async flush() {
        await new Promise(setTimeout);
        while (this.hasAttribute("updating")) {
            await this._updating_promise;
        }
    }

    /**
     * Clears the rows in the current {@link table}.
     */
    clear() {
        this._table.clear();
    }

    update_status_bar_width(canvas_width){
        /*if (!canvas_width && this.hypergrid && this.hypergrid.div){
            canvas_width = Math.floor(this.hypergrid.div.clientWidth);
        }

        if (canvas_width && canvas_width > 0){
            this._pivot_tabs_bar.style.width = canvas_width + "px";
        }*/
    }

    handle_status_bar_text(type, options = {}) {
        var limited = "(limited to " + perspective.MAX_COLS_TEXT + " columns)";
        var msg = "";
        switch(type) {
            case "no_source": {
                msg = "No source loaded";
            } break;

            case "ingesting": {
                msg = "Loading data...";
            } break;

            case "running_query": {
                msg = "Running Query…";
            } break;

            case "query_successed": {
                msg = options.nrows + " rows returned in " + options.time + "s";
                var nb_of_cols = this._plugin.get_nb_cols.call(this);
                if (nb_of_cols && nb_of_cols >= perspective.MAX_COLS){
                  msg = msg + " " + limited;
                }
            } break;

            case "query_error": {
                msg = "Query error";
            } break;

            case "query_cancelled": {
                msg = "Query cancelled in " + options.time + "s";
            } break;

            case "select_sheets" : {
              msg = "Select the sheet to import";
              this._tabs_bar_progress.classList.add("hidden");
            }

            default: {
            } break;
        }
        this._pivot_tabs_bar_msg.innerHTML = msg;
    }

    _hide_all_lasso_selections(){
      this._pivot_tabs_bar_count.classList.add("hidden");
      this._pivot_tabs_bar_avg.classList.add("hidden");
      this._pivot_tabs_bar_sum.classList.add("hidden");

      this._pivot_tabs_bar_dimension.classList.add("hidden");

    }

    
    // Hypergrid will call this function to calculate and display the status bar
    update_status_lasso_selections(count, nb_r, nb_c, options){

      console.log("-------update_status_lasso_selections-------", count, nb_r, nb_c, options);
      // Handle dimension
      if ((!nb_r && !nb_c) || (nb_r <=1 && nb_c <= 1)){ // Do not show when the user only selects a cell
        this._pivot_tabs_bar_dimension.classList.add("hidden");
      }else if (nb_r > 1 || nb_c > 1){
        this._pivot_tabs_bar_dimension.classList.remove("hidden");

        if (nb_r > 0 && nb_c > 0){
          this._pivot_tabs_bar_dimension.innerHTML = nb_r + "R x " + nb_c + "C";
        }else if(nb_r > 0){
          this._pivot_tabs_bar_dimension.innerHTML = nb_r + "R";
        }else{
          this._pivot_tabs_bar_dimension.innerHTML = nb_c + "C";
        }
      }else{
        this._pivot_tabs_bar_dimension.classList.add("hidden");
      }

      // Handle count
      if (!count || count <= 1){
        this._pivot_tabs_bar_count.classList.add("hidden");
        this._pivot_tabs_bar_avg.classList.add("hidden");
        this._pivot_tabs_bar_sum.classList.add("hidden");
      }else{
        this._pivot_tabs_bar_count.classList.remove("hidden");
        this._pivot_tabs_bar_count.innerHTML = perspective.STATUS_BAR_COUNT_TEXT + " " + count;
      }

      // Will update avg and sum
      if (options && Array.isArray(options)){
        this._query_and_update_status_lasso_selections(options);
      }

      if (!this.hypergrid.cellEditor) {
        if (options && options.length > 0) {
          const selection = this.hypergrid.getGridCellFromLastSelection(true);
          var value = (selection.column.colDef && selection.column.colDef.computed_expression) 
                ? "=" + selection.column.colDef.computed_expression
                : selection.cellData.foundedValue;
          this._formula_bar._expression_editor.set_readonly(!selection.isCellEditable);
          this._formula_bar._expression_editor.set_text(value);
          this._formula_bar.setEvent(selection);
          this._formula_bar._formula_helper.clear();
        }
        else {
          this._formula_bar._expression_editor.set_text("");
          this._formula_bar.setEvent(undefined);
          this._formula_bar._formula_helper.clear();
        }
      }
    }

    _query_and_update_status_lasso_selections(options){

      if (!options || !Array.isArray(options) || options.length === 0){
        return;
      }

      this.get_selection_summarize(options, result => {
          if (!result.count_num || result.count_num <= 0) {
            this._pivot_tabs_bar_avg.classList.add("hidden");
            this._pivot_tabs_bar_sum.classList.add("hidden");
          } else {
            this._pivot_tabs_bar_avg.classList.remove("hidden");
            this._pivot_tabs_bar_avg.innerHTML = perspective.STATUS_BAR_AVG_TEXT + " " + result.avg;
            this._pivot_tabs_bar_sum.classList.remove("hidden");
            this._pivot_tabs_bar_sum.innerHTML = perspective.STATUS_BAR_SUM_TEXT + " " + result.sum;
          }
      });
    }
    
    handle_status_bar_autoquery() {
        this._pivot_tabs_bar_autoquery.innerHTML = this.AUTO_QUERY ? "Auto-Query: On" : "Auto-Query: Off";
    }

    handle_status_bar_count(count) {
        this.pivot_tabs_bar_count.innerHTML = "Count: " + count;
    }

    time_since(time, requires_seconds = false) {

      var seconds = Math.floor((new Date().getTime() - time) / 1000);

      var interval = Math.floor(seconds / 31536000);

      if (interval > 1) {
        return interval + " years ago";
      }
      interval = Math.floor(seconds / 2592000);
      if (interval > 1) {
        return interval + " months ago";
      }
      interval = Math.floor(seconds / 86400);
      if (interval > 1) {
        return interval + " days ago";
      }
      interval = Math.floor(seconds / 3600);
      if (interval > 1) {
        return interval + " hours ago";
      }
      interval = Math.floor(seconds / 60);
      if (interval > 1) {
        return interval + " mins ago";
      }
      if (interval === 1){
        return "1 min ago";
      }

      if (requires_seconds === true){
        return Math.floor(seconds) + " secs ago";
      }else{
        if (seconds < 5){
          return "just now";
        }else{
          return "a few secs ago";
        }
      }
    }

    handle_status_bar_added_source() {
        if (!this._added_source_time) {
            this._added_source_time = new Date().getTime();
        }
        /*
        let currentTime = new Date().getTime();
        let msg = "";
        let diff_time_in_second = parseInt((currentTime - this._added_source_time)/1000);
        let next_update_time = 1000;
        // Added time less than 1 minutes
        if (diff_time_in_second < 60) {
            msg = "added " + diff_time_in_second + " seconds ago";
            next_update_time = 1000;
        } else
        // Added time grater than 1 minute and less than 1 hour
        if (diff_time_in_second >= 60 && diff_time_in_second < 60*60) {
            let diff_time_in_minute = parseInt(diff_time_in_second/60);
            msg = "added " + diff_time_in_minute + " minutes ago";
            next_update_time = 60*1000;
        } else
        // Added time grater than 1 hour and less than one day
        if (diff_time_in_second >= 60*60 && diff_time_in_second < 24*60*60) {
            let diff_time_in_hour = parseInt(diff_time_in_second/(60*60));
            msg = "added " + diff_time_in_hour + " hours ago";
            next_update_time = 60*60*1000;
        } else
        // Added time grater than one day
        if (diff_time_in_second >= 24*60*60) {
            let diff_time_in_day = parseInt(diff_time_in_second/(24*60*60));
            if (diff_time_in_day === 1) {
                msg = "added yesterday";
            } else {
                msg = "added " + diff_time_in_day + " days ago";
            }
            next_update_time = 24*60*60*1000;
        }
        */
        const str_time = this.time_since(this._added_source_time);
        const seconds = (new Date().getTime() - this._added_source_time)/1000;

        let next_update_time;
        if (seconds <= 5){
          next_update_time = 1000
        }else if(seconds <= 60 * 60){
          next_update_time = 60*1000;
        }else{
          next_update_time = 60*60*1000;
        }

        this._pivot_tabs_bar_source.innerHTML = "Source: " + this._file_name + ".csv, added " + str_time;
        setTimeout(this.handle_status_bar_added_source.bind(this), next_update_time);
    }

    handle_status_bar(){
        //var text_type = null;
        if (!this._show_grid_data){
            //msg = "No source loaded";
            this.handle_status_bar_text("no_source");
            this._pivot_tabs_bar_source.classList.add("hidden");
            this._pivot_tabs_bar_autoquery.classList.add("hidden");
            this._pivot_tabs_bar_dimension.classList.add("hidden");
            this._pivot_tabs_bar_count.classList.add("hidden");
            this._pivot_tabs_bar_zoom.classList.add("hidden");
            //this._pivot_tabs_bar.classList.remove("with-header-outsite-of-perspective");
            this._pivot_tabs_bar.classList.add("no-source-loaded");
        }else{
            //msg = "1,028 records loaded in 0.48s (limited to 2k columns)";
            this._pivot_tabs_bar_source.classList.remove("hidden");
            this._pivot_tabs_bar_autoquery.classList.remove("hidden");
            //this._pivot_tabs_bar_dimension.classList.remove("hidden");
            //this._pivot_tabs_bar_count.classList.remove("hidden");
            this._pivot_tabs_bar_zoom.classList.remove("hidden");

            //this._pivot_tabs_bar.classList.add("with-header-outsite-of-perspective");
            this._pivot_tabs_bar.classList.remove("no-source-loaded");
        }

        //this._pivot_tabs_bar_msg.innerHTML = msg;
        //this.handle_status_bar_text(text_type);
        this._pivot_tabs_bar.classList.remove("hidden");
    }

    loadedNotification(){
        this._show_grid_data = true;
        this._first_load_grid_data = true;
        this._pivot_file_zone_container.classList.add("hidden");
        //this._pivot_header_container.classList.remove("hidden");
        document.getElementById("pivot_header_container").classList.remove("hidden");
        this._config_button.classList.remove("hidden");
        this._pivot_ingesting_data_percentage.classList.remove("show-percentage");
        //this._tabs_bar_progress.classList.add("hidden");
        this._plugin._resize.call(this, true);
        this.handle_status_bar();
        //document.getElementById("js-datadocs-header").style.display="block";

        //document.getElementById("search-results").classList.add("widget");
        ////this._pivot_tabs_bar.classList.remove("hidden");
        if (this.hypergrid && this.hypergrid.canvas && this.hypergrid.canvas.canvas){
          this.hypergrid.canvas.canvas.style["borderRadius"] = "4px 4px 0 0";
        }

        this.handle_status_bar_text("running_query");
    }

    ingestedNotification(){
        this._show_grid_data = true;
        //this._pivot_file_zone_container.classList.add("hidden");
        //this._config_button.classList.remove("hidden");
        //this._pivot_ingesting_data_percentage.classList.remove("show-percentage");
        //document.getElementById("js-datadocs-header").style.display="block";

        //document.getElementById("search-results").classList.add("widget");
        //document.getElementById("tabs-bar").classList.remove("hidden");

        this._pivot_loading_data_cancel.classList.add("hidden");
        this._pivot_loading_data_finalizing.classList.remove("hidden");
        //this._pivot_tabs_bar_source.innerHTML = "Source: " + this._file_name + ".csv, added 12 mins ago";
        this.handle_status_bar_added_source();
    }

    ingestingNotification(rest_percent=false){
        this._show_grid_data = true;
        this._first_create_view_data = false;
        if (rest_percent){
          this.ingestingPercentage(1);
        }
        this._pivot_ingesting_data_percentage.classList.add("show-percentage");
        this._pivot_ingesting_data_percentage.classList.remove("hidden");
        this._tabs_bar_progress.classList.remove("hidden");
        this._pivot_loading_data_cancel.classList.remove("hidden");
        this._pivot_loading_data_finalizing.classList.add("hidden");

        this.handle_status_bar_text("ingesting");
    }

    sheetsNotification(){
        this._pivot_ingesting_data_percentage.classList.add("hidden");
        this._pivot_querying_percentage.classList.add("hidden");
        this.handle_status_bar_text("select_sheets");
    }

    cancelIngestingData(){
        this._show_grid_data = false;
        this.bootIngest();
        return this.client_promise.then((client) => {
          return client.cancel_ingesting_data().then(() => {
            this._show_grid_data = false;
            this.ingestingPercentage(1);
            this._pivot_ingesting_data_percentage.classList.remove("show-percentage");
            this._tabs_bar_progress.classList.add("hidden");
            this.client_promise = IngestClient.init_ingest_client();
          });
        });
    }

    cancelQueryingData() {
        if (this._table) {
            this._table.cancel_query_data();
        }
    }

    ingestErrors(err_msg){
        this.handleErrors(err_msg);
    }

    loadErrors(){
        this.handleErrors();
    }

    handleErrors(err_msg){
        this._show_grid_data = false;
        this._pivot_ingesting_data_percentage.classList.remove("show-percentage");
        this._tabs_bar_progress.classList.add("hidden");

        if (err_msg !== undefined){
            this._pivot_error_message_id.innerHTML = err_msg;
            this._pivot_drop_file_area_error.classList.add("highlight");

            setTimeout(()=>{
                this._pivot_drop_file_area_error.classList.remove("highlight");
            }, 1000 * 4);
        }

        this.handle_status_bar_text("no_source");
    }

    emptyGridNotification(){
        this._show_grid_data = false;

        // Grid
        //document.getElementById("search-results").classList.remove("widget");
        ////this._pivot_tabs_bar.classList.add("hidden");
        //this._datavis.classList.add("read-only");

        this._pivot_file_zone_container.classList.remove("hidden");
        this._config_button.classList.add("hidden");
        this._pivot_ingesting_data_percentage.classList.remove("show-percentage");
        this._tabs_bar_progress.classList.add("hidden");
    }

    ingestingPercentage(percent){
        percent = percent ? Math.min(Math.max(0, percent), 100): 0;

        this._pivot_ingesting_bar.style.width = percent + '%';
        this._tabs_bar_progress_bar.style.width = percent + '%';
    }

    queryingPercentage(percent){
        percent = percent ? Math.min(Math.max(0, percent), 100): 0;

        this._pivot_querying_bar.style.width = percent + '%';
        this._tabs_bar_progress_bar.style.width = percent + '%';

        // Make a decision to show the percentage after 0.25s
        if (new Date().getTime() - this._begin_query_time >= 70 /*this._started_new_query_time >= 250*/
          && this._pivot_querying_percentage.classList.contains("lighter")
          && this._pivot_querying_percentage.classList.contains("hidden")){
          this._pivot_querying_percentage.classList.remove("hidden");
        }
    }

    didQueryProgress(enable = false){
        // Turn off/on the long running queries based on the predictSlowQuery function

        if (this._show_grid_data && enable){
            this._pivot_ingesting_data_percentage.classList.remove("show-percentage");

            // Add the class `hidden` (except the query after loaded) and remove it after 0.25s
            if (this._pivot_querying_percentage.classList.contains("lighter")){
              this._pivot_querying_percentage.classList.add("hidden");
            }
            this._started_new_query_time = new Date().getTime();

            this._pivot_querying_percentage.classList.add("show-percentage");
            this._tabs_bar_progress.classList.remove("hidden");
            this.queryingPercentage(1);
        }else{
            this._pivot_querying_percentage.classList.remove("show-percentage");
            this._tabs_bar_progress.classList.add("hidden");

            // Handle to show the percentage after 0.25s
            if (this._show_grid_data){
              this._pivot_querying_percentage.classList.remove("hidden");
              if (!this._pivot_querying_percentage.classList.contains("lighter")){
                this._pivot_querying_percentage.classList.add("lighter");
              }
            }
            this._started_new_query_time = 0;

        }
    }

    showError(error){
        return notify({message: error.message, icon: 'warning'});
    }

    showWarning(warning){
        return notify({message: warning.message, icon: 'warning'});
    }

    showSuccess(success){
        return notify({message: success.message, icon: 'success'});
    }

    showNotification(message, wait, callback){
        return alertify.notify(message, wait, callback);
    }

    closeAllNotifications() {
        alertify.dismissAll();
    }

    updateZoomerPercent() {
      this._zoomer_percent.innerHTML = Math.round((this._current_zoom || 1) * 100) + "%";
    }

    updateZommerSlider() {
      this._zoomer.value = this._current_zoom || 1;
    }

    notify(content){
        var container = document.createElement("div");
        container.className = "content";

        var wait = 4;

        function getNotificationClass() {
            if (content.icon) {
                switch (content.icon) {
                    case 'notification':
                        return 'fa-warning notification';
                    case 'success':
                        return 'fa-check-circle notification';
                    case 'warning':
                    default:
                        return 'fa-warning';
                }
            }
        }

        if(content.message){
            const iconClass = getNotificationClass();
            var sl = document.createElement("span");
            sl.className = "fa fa-lg" + iconClass;

            var il = document.createElement("i");
            il.className = "fa fa-lg" + iconClass;

            var e_msg = document.createElement("span");
            e_msg.textContent = content.message;

            sl.appendChild(il);
            sl.appendChild(e_msg);
            container.appendChild(sl);
            if(content.wait != undefined){
                wait = content.wait;
            }
        } else {
            container.appendChild(content);
        }

        var al = document.createElement("a");
        al.className = "close";
        al.innerHTML = '<svg x="0px" y="0px" width="12px" height="12px" viewBox="0 0 10 10" focusable="false"><polygon class="a-s-fa-Ha-pa" fill="#FFFFFF" points="10,1.01 8.99,0 5,3.99 1.01,0 0,1.01 3.99,5 0,8.99 1.01,10 5,6.01 8.99,10 10,8.99 6.01,5 "></polygon></svg>';

        container.appendChild(al);

        var msg = alertify.notify(container, 'notification', wait);
        if(!content.keepOthers) {
            msg.dismissOthers();
        }
        msg.ondismiss = function(e){
            var closing = !e;
            if(closing) {
                if (content.ondismiss) {
                    content.ondismiss(e);
                }
            }
            return closing;
        };
        return msg;
    }

    /**
     * Replaces all rows in the current {@link table}.
     */
    replace(data) {
        this._table.replace(data);
    }

    /**
     * Reset's this element's view state and attributes to default.  Does not
     * delete this element's `perspective.table` or otherwise modify the data
     * state.
     *
     */
    reset() {
        this.setAttribute("row-pivots", JSON.stringify([]));
        this.setAttribute("column-pivots", JSON.stringify([]));
        this.setAttribute("filters", JSON.stringify([]));
        this.setAttribute("searchs", "");
        this.setAttribute("sort", JSON.stringify([]));
        this.setAttribute("value-pivots", JSON.stringify([]));
        this.removeAttribute("index");
        if (this._initial_col_order) {
            this.setAttribute("columns", JSON.stringify(this._initial_col_order || []));
        } else {
            this.removeAttribute("columns");
        }
        this.setAttribute("view", Object.keys(renderers.getInstance())[0]);
        this.dispatchEvent(new Event("perspective-config-update"));
        this._hide_context_menu();
    }

    /**
     * Download this element's data as a CSV file.
     *
     * @param {boolean} [flat=false] Whether to use the element's current view
     * config, or to use a default "flat" view.
     * @memberof PerspectiveViewer
     */
    async download(flat = false) {
        const view = flat ? this._table.view() : this._view;
        const csv = await view.to_csv();
        const element = document.createElement("a");
        const binStr = csv;
        const len = binStr.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            arr[i] = binStr.charCodeAt(i);
        }
        const blob = new Blob([arr]);
        element.setAttribute("href", URL.createObjectURL(blob));
        element.setAttribute("download", "perspective.csv");
        element.style.display = "none";
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        this._hide_context_menu();
    }

    /**
     * Copies this element's view data (as a CSV) to the clipboard.  This method
     * must be called from an event handler, subject to the browser's
     * restrictions on clipboard access.  See
     * {@link https://www.w3.org/TR/clipboard-apis/#allow-read-clipboard}.
     */
    copy(flat = false) {
        let data;
        const view = flat ? this._table.view() : this._view;
        view.to_csv()
            .then(csv => {
                data = csv;
            })
            .catch(err => {
                console.error(err);
                data = "";
            });
        let count = 0;
        let f = () => {
            if (typeof data !== "undefined") {
                copy_to_clipboard(data);
            } else if (count < 200) {
                count++;
                setTimeout(f, 50);
            } else {
                console.warn("Timeout expired - copy to clipboard cancelled.");
            }
        };
        f();
        this._hide_context_menu();
    }

    /**
     * Opens/closes the element's config menu.
     */
    toggleConfig() {
        this._toggle_config();
    }

    convert_file(data, selected_files = [], sheet_name, extension = undefined) {
        this.bootIngest();
        return this.client_promise.then((client) => {
          return client.convert_file(data, selected_files, sheet_name, this.ingestingPercentage.bind(this), extension);
        });
    }

    probe_file(data, extension = undefined, selected_files = []) {
        this.bootIngest();
        return this.client_promise.then((client) => {
          return client.probe_file(data, extension, selected_files);
        });
    }

    probe_compress(data, extension = undefined, selected_files = []) {
      this.bootIngest();
      return this.client_promise.then((client) => {
        return client.probe_compress(data, extension, selected_files);
      });
    }

    get_coumn_types() {
        this.bootIngest();
        return this.client_promise.then((client) => {
          return client.get_coumn_types();
        });
    }

    // Call from hypergrid
    set_column_dname(original_name, current_name, new_name) {
        if (this._validate_new_name(original_name, new_name) && !this.is_column_pivot(true)) {
            var row;
            //set attribute dname for row
            var selector = "#active_columns perspective-row";
            var container = "active_columns";
            if (this.is_cinfo_pivot(false)) {
                if (original_name === perspective.COMBINED_NAME) {
                  if (this.is_row_combined(false)) {
                    selector = "#row_pivots perspective-row";
                    container = "row_pivots";
                  } else {
                    selector = "#column_pivots perspective-row";
                    container = "column_pivots";
                  }
                } else {
                  selector = "#value_pivots perspective-row";
                  container = "value_pivots";
                }
            }
            var old_alias_name;
            let has_period = this._visible_column_period();
            let drag_id;
            this._get_view_dom_columns(selector).forEach(x => {
                if (x.getAttribute("new_base_name") == original_name) {
                    row = x;
                    old_alias_name = x.getAttribute("alias_name");
                    x.setAttribute("dname", new_name);
                    x.setAttribute("alias_name", new_name);
                    let period = has_period ? x.getAttribute("period") : "none";
                    var v_name = this._get_disp_name_aggregate(x.getAttribute("name"), x.getAttribute("aggregate"),
                                    period, this._get_column_show_type(x));
                    x.setAttribute("vname", v_name);
                    drag_id = x.getAttribute("drag_id");
                }
            });
            let name = row ? row.getAttribute("name") : null;

            var options = {
                new_dname_value: new_name,
                old_dname_value: current_name || original_name,
                new_alias_value: new_name,
                old_alias_value: old_alias_name
            };
            this._handle_manage_action(perspective.ACTION_TYPE.change_column_name, row, options,
                _ => {
                    this._after_change_column_name(name, original_name, current_name, container, drag_id);
                },
                _ => {
                    this._after_change_column_name(name, original_name, new_name, container, drag_id);
                });
            this._force_to_fetch_only = true;
            // Will create a function later
            if (container && original_name && drag_id){
                if (container === "value_pivots") {
                  var value_pivots = JSON.parse(this.getAttribute("value-pivots") || "[]");
                  var index = value_pivots.findIndex((v)=>v.base_name === original_name && v.drag_id === drag_id);
                  if (index != -1){
                      value_pivots[index].dname = new_name;
                      this.setAttribute("value-pivots", JSON.stringify(value_pivots));
                  }
                } else if (container === "column_pivots") {
                  var column_pivots = JSON.parse(this.getAttribute("column-pivots") || "[]");
                  var index = column_pivots.findIndex((v)=> {
                    if (original_name === perspective.COMBINED_NAME) {
                      return v.n === original_name;
                    }
                    return v.n === original_name && v.drag_id === drag_id;
                  });
                  if (index != -1){
                    column_pivots[index].dname = new_name;
                    this.setAttribute("column-pivots", JSON.stringify(column_pivots));
                  }
                } else if (container === "row_pivots") {
                  var row_pivots = JSON.parse(this.getAttribute("row-pivots") || "[]");
                  var index = row_pivots.findIndex((v)=> {
                    if (original_name === perspective.COMBINED_NAME) {
                      return v.n === original_name;
                    }
                    return v.n === original_name && v.drag_id === drag_id;
                  });
                  if (index != -1){
                    row_pivots[index].dname = new_name;
                    this.setAttribute("row-pivots", JSON.stringify(row_pivots));
                  }
                }
            }
            this._force_to_fetch_only = false;
            this._update_name_mapping(original_name, new_name, true, container);
        } else {
            if (this._plugin.update_column_displayname) {
                var column_map = {};
                column_map[original_name] = current_name;
                this._plugin.update_column_displayname.call(this, column_map);
            }
            this._show_warning_message(this.is_column_pivot(true) ? "Not editable in pivot mode" : "All field names must be unique!");
        }
    }

    /**
     * Handle button to call sort from outside of viewer
     * @param {*} direction
     */
    async handle_sort_button(direction) {
        if (!direction) {
            return;
        }
        if (this._first_load_grid_data) {
            // Get list selected columns from grid
            var columns = await this._plugin.selected_columns_to_apply_sort.call(this);
            if (columns && columns.length > 0) {
                //columns = this.is_cinfo_pivot(false) ? [{n:"sum of Row", level:0, in_pivot:"value_pivots", subtotal:"y"}] : columns;
                //Call function update sorts attribute in action element
                this._column_sort_update(columns, direction);
            }
        }
    }

    // Handle button to call undo from outside of viewer
    handle_undo_button() {
        if (this._first_load_grid_data) {
            this.redo_undo_manager.undo();
        }
    }

    // Handle button to call redo from outside of viewer
    handle_redo_button() {
        if (this._first_load_grid_data) {
            this.redo_undo_manager.redo();
        }
    }

    // Handle button to call data format for numberic column from outside of viewer
    handle_numberic_data_format_button(data_format) {
        if (this._first_load_grid_data && !this.is_column_pivot(false)) {
            var is_pivot = this.is_cinfo_pivot(false);
            // Get list selected columns from grid
            var columns = this._plugin.selected_columns.call(this);
            if (columns && columns.length > 0) {
                // Check type of columns and pushed to data_formats json
                var data_formats = {};
                var is_values = columns.includes(perspective.COMBINED_NAME);
                var selector = is_pivot ? "#value_pivots perspective-row" : "#active_columns perspective-row";
                this._get_view_dom_columns(selector, col => {
                    var type = col.getAttribute("type");
                    var name = is_pivot ? col.getAttribute("new_base_name") : col.getAttribute("name");
                    var aggregate = col.getAttribute("aggregate");
                    if ((["float", "integer", "list_float", "list_integer"].includes(type) || (is_pivot && perspective.STATISTIC_AGGREGATES.includes(aggregate)))
                        && (is_values || columns.includes(name))) {
                        data_formats[name] = data_format;
                    }
                });
                this._column_data_formats_update(data_formats);
            }
        }
    }

    _is_auto_filter_applied(filter){
      if (!filter){
        return false;
      }

      if (filter.unselected_all === true
        || (filter.ignore_list && filter.ignore_list.length >0)
        || (filter.selected_list && filter.selected_list.length >0)
      ){
        return true;
      }

      return false;
    }

    _is_custom_filter_applied(filter){
      if (!filter){
        return false;
      }

      if ((filter.operator !== undefined && filter.operator !== null && filter.operator !== "")
        || (filter.operand !== undefined && filter.operand !== null && filter.operand !== "")
        || (filter.filter_by !== undefined && filter.filter_by !== null && filter.filter_by !== "")
        || (filter.subtotal !== undefined && filter.subtotal !== null && filter.subtotal !== "")
      ){
        // Validate operand value if it's required
        if (filter.operand === undefined || filter.operand === null || filter.operand === ""){
          if (["empty", "not empty", "is true", "is false", "element is true", "element is false"].includes(filter.operator) === false){
            return false;
          }
        }
        return true;
      }

      return false;
    }

    _is_group_filter_applied(filter){
      if (!filter){
        return false;
      }

      if (filter.group_filter && typeof filter.group_filter === "object" && Object.keys(filter.group_filter).length > 0){
        return true;
      }

      return false;
    }

    // Check if it contains filter or not
    is_filter(filter){
      if (!filter || typeof(filter) !== "object"){
        return false;
      }
      /*
      const filter_keys = Object.keys(filter);

      return filter_keys.findIndex((v)=>{
        if(["datalist_contains_all", "search", "site_search", "filter_by", "operator", "operand", "unselected_all", "ignore_list", "selected_list"].includes(v) === false){
          return false;
        }

        if (v === "datalist_contains_all"
          || (v === "search" && filter[v] === "")
          || (v === "search" && filter[v] !== ""
              && !filter["unselected_all"]
              && (!filter["ignore_list"] || filter["ignore_list"].length === 0)
              && (!filter["selected_list"] || filter["selected_list"].length === 0) )
          || (v === "site_search")
          || (v === "filter_by")
          || (v === "operator" && (filter[v] !== "empty" && filter[v] !== "not empty"))
          || (v === "operand" && (filter[v] === undefined || filter[v] === null || filter[v] === ""))
        ){
          return false;
        }else if ((v === "unselected_all" || v === "ignore_list" || v === "selected_list")
            && !filter["unselected_all"]
            && (!filter["ignore_list"] || filter["ignore_list"].length === 0)
            && (!filter["selected_list"] || filter["selected_list"].length === 0)){
          return false;
        }else{
          return true;
        }
      }) !== -1 ? true: false;
      */

      const is_auto_filter = this._is_auto_filter_applied(filter);
      const is_custom_filter = this._is_custom_filter_applied(filter);
      const is_group_filter = this._is_group_filter_applied(filter);

      if (is_auto_filter === true || is_custom_filter === true || is_group_filter === true){
        return true;
      }
      return false;
    }

    /**
     * Call from hypergrid to get sort priority number
     * [
     *  {name: "f1", is_sort: true, nb_sort: 2, sort_order: "asc", is_filter: true},
     * ]
     */
    get_fsort_selections(container) {
        let results = [];
        const is_pivot = this.is_cinfo_pivot(false);

        var children = null;
        if (container && container === "column_pivots"){
            children = Array.prototype.slice.call(this._column_pivots.getElementsByTagName("perspective-row"));
        }else if (is_pivot) {
            children = Array.prototype.slice.call(this._row_pivots.getElementsByTagName("perspective-row"));
        } else {
            children = this._pivotList.getActiveCols();
        }
        /*
        for (let child of children) {

          let value = {};
          const name = child.getAttribute("name");

          // Sort
          let nb_sort = 0;
          let sort_order = child.getAttribute("sort_order");
          let sort_num = child.getAttribute("sort_num");
          if (sort_order && sort_order !== "null" && sort_order !== "undefined") {
            value.is_sort = true;
            value.sort_order = sort_order;
          }

          if (sort_order && sort_order !== "null" && sort_order !== "undefined"
              && sort_num && sort_num !== "null" && sort_num !== "undefined") {

              if (parseInt(sort_num) > 0){
                value.is_sort = true;
                value.nb_sort = parseInt(sort_num);
              }
          }

          // Filter

          let filter = JSON.parse(child.getAttribute("filter")) || {};
          let is_filter = this.is_filter(filter);

          if (is_filter === true){
            value.is_filter = is_filter;
          }

          if (value.is_sort || value.is_filter){
            value.name = name;
            results.push(value);
          }
        }
        */

        // Sort
        for (let child of children) {

          let value = {};
          const name = child.getAttribute("name");

          let nb_sort = 0;
          let sort_order = child.getAttribute("sort_order");
          let sort_num = child.getAttribute("sort_num");
          if (sort_order && sort_order !== "null" && sort_order !== "undefined") {
            value.is_sort = true;
            value.sort_order = sort_order;
          }

          if (sort_order && sort_order !== "null" && sort_order !== "undefined"
              && sort_num && sort_num !== "null" && sort_num !== "undefined") {

              if (parseInt(sort_num) > 0){
                value.is_sort = true;
                value.nb_sort = parseInt(sort_num);
              }
          }

          if (value.is_sort){
            value.name = name;
            results.push(value);
          }
        }

        // Filter
        var f_children = Array.prototype.slice.call(this._filters.getElementsByTagName("perspective-row"));
        for (let f_child of f_children) {

          let value = {};
          const name = f_child.getAttribute("name");

          let filter = JSON.parse(f_child.getAttribute("filter")) || {};
          let is_filter = this.is_filter(filter);
          if (is_filter === true){
            value.is_filter = is_filter;
          }

          if (value.is_filter){
            const r_i = results.findIndex((r)=>r.name === name);
            if (r_i !== -1){
              // Update
              results[r_i].is_filter = value.is_filter;
            }else{
              value.name = name;
              results.push(value);
            }
          }
        }

        if (container && ["column_pivots", "row_pivots"].includes(container) && results && results.length > 0){
          const col_pivots = this.get_column_pivots();
          const row_pivots = this.get_row_pivots();

          if (container === "column_pivots"){
            results = results.filter((v)=>{

              // COLUMNS pivot
              if (col_pivots.includes(v.name)){
                return true;
              }else if(row_pivots.includes(v.name)){
                // Ignore item in ROWS pivot
                return false;
              }

              // Other field filter
              return true;
            });
          }else if(container === "row_pivots"){
            results = results.filter((v)=>{

              // ROWS pivot
              if (row_pivots.includes(v.name)){
                return true;
              }else if(col_pivots.includes(v.name)){
                // Ignore item in COLUMNS pivot
                return false;
              }

              // Other field filter
              return true;
            });
          }
        }

        return results;
    }

    create_tooltip(event, options){
      if (!this._tooltip){
        this._tooltip = new Tooltip(this);
      }

      return this._tooltip;
    }

    /*
      FILTER - Multiple fields: Each group filter can include multiple filters

      f1, f2, f3, f4, f5, f6 are the filter object
      f1 = {"n":"Header","ignore_list":["y","x"]}

      EXAMPLE #1: Level 1
      f1 AND f2 AND f3
      -----------------
      AND: [f1, f2, f3]

      EXAMPLE #2: Level 1
      f4 OR f5
      ----------------
      OR: [f4, f5]

      EXAMPLE #3: Level 2
      (f1 AND f2) OR (f3 AND f4)
      --------------------------
      OR: [
        {AND: [f1, f2]},
        {AND: [f3, f4]}
      ]

      EXAMPLE #4: Level 3
      ((f1 AND f2) OR (f5 AND f6)) OR (f3 AND f4)
      --------------------------
      OR: [
        {OR: [
              {AND: [f1, f2]},
              {AND: [f5, f6]}
             ]},
        {AND: [f3, f4]}
      ]

      AVAILABLE PATHS
      [EMPTY AS ROOT]
      OR [ROOT]
      OR/OR => [
                {AND: [f1, f2]},
                {AND: [f5, f6]}
               ]
      OR/OR/AND => [f1, f2], [f5, f6]
     */
    _create_group_filter(base_group_filter, arr_filters, to_path, operator = "AND"){

      if (!base_group_filter){
        base_group_filter = {};
      }

      let group_filter = {};

      if (!["AND", "OR"].includes(operator)){
        return base_group_filter || {};
      }

      group_filter[operator] = arr_filters;

      // using group_filter if the base_group_filter is empty
      if (Object.keys(base_group_filter).length === 0 && base_group_filter.constructor === Object){
        return group_filter;
      }

      // Now we need to add a new filter into the base group filter

      const keys = Object.keys(base_group_filter);

      // Add to root
      if (!to_path){
        // Need to validate the operator
        if (keys.length === 1 && keys[0] === operator
          && base_group_filter[operator] && Array.isArray(base_group_filter[operator])){
          base_group_filter[operator].push(group_filter);
        }else{
          // Something is not right.
        }
      }else{
        const arr_paths = to_path.split("/");

        // Only support 3 levels
        if (arr_paths.length <= 3){
          if (arr_paths.length <= 1){
            if (keys[0] === operator && Array.isArray(base_group_filter[operator])){
              base_group_filter[operator].push(group_filter);
              return base_group_filter;
            }
          }else if(arr_paths.length === 2){

            let level_index = base_group_filter[keys[0]].findIndex((v)=>{
              if (typeof v === "object"){
                const ks = Object.keys(v);

                if (ks.includes(operator)){
                  return true;
                }
              }

              return false;
            });
            if (keys[0] === arr_paths[0] && level_index !== -1){
              base_group_filter[keys[0]][operator].push(group_filter);
              return base_group_filter;
            }
          }else if (arr_paths.length === 3){

          }
        }else{
          // Something is not right.
        }

      }

      return group_filter;

    }

    /*
    @params curr_multiple_filters: current group filter
    */
    _add_filter_to_group_filter(curr_multiple_filters, path, arr_filters, operator = "AND"){

    }

    /*
      mapping_fields = {
        "Header/HeaderC": {
                            fields: [
                                [
                                  {name: Header, value: [x]},
                                  {name: HeaderC, value: [great, thanks]}
                                ],
                                [
                                  {name: Header, value: [y]},
                                  {name: HeaderC, value: [pretty]}
                                ]
                            ]
                          },

        "Header": {
                    fields: [
                      [
                        {name: Header, value: [z]}
                      ]
                    ]
                  }
      }

      group_filter = {
        "Header/HeaderC": {
                            operator: "AND",
                            filters: [
                                [
                                  {n: Header, ignore_list: [x]},
                                  {n: HeaderC, ignore_list: [great, thanks]}
                                ],
                                [
                                  {n: Header, ignore_list: [y]},
                                  {n: HeaderC, ignore_list: [pretty]}
                                ]
                            ],
                            fields: [
                                [
                                  {name: Header, value: [x]},
                                  {name: HeaderC, value: [great, thanks]}
                                ],
                                [
                                  {name: Header, value: [y]},
                                  {name: HeaderC, value: [pretty]}
                                ]
                            ]
                          },

        "Header": {
                    operator: "AND"
                    filters: [
                      [
                        {n: Header, ignore_list: [z]}
                      ]
                    ],
                    fields: [
                      [
                        {name: Header, value: [z]}
                      ]
                    ]
                  }
      }
    */
    build_the_group_filter(base_group_filter, mapping_fields, operator = "AND"){
      let group_filter = {};
      if (!mapping_fields || Object.keys(mapping_fields).length === 0){
        return base_group_filter || group_filter;
      }

      if (!["AND", "OR"].includes(operator)){
        operator = "AND";
      }

      const c_info = this.get_default_cinfo() || [];

      if (base_group_filter && Object.keys(base_group_filter).length >= 0){
        // Need to merge mapping fields
        for (let base_key in mapping_fields){
          if (mapping_fields.hasOwnProperty(base_key)) {
            if (base_group_filter.hasOwnProperty(base_key)){// Update or add
              if (base_group_filter[base_key].fields && mapping_fields[base_key].fields
              /*&& base_group_filter[base_key].fields.length === mapping_fields[base_key].fields.length*/){

                for (let mf_i = 0; mf_i < mapping_fields[base_key].fields.length; mf_i++){

                  const existed_field_index = base_group_filter[base_key].fields.findIndex((arr_v)=>{

                    // Compare arr_v with field_values
                    let update = true;
                    for (let ui = 0; ui < arr_v.length; ui++){
                      if (arr_v[ui].name !== mapping_fields[base_key].fields[mf_i][ui].name){
                        update = false;
                        break;
                      }

                      // Not last item in the array. Make sure all parent values are existed, except the last item
                      if (ui !== arr_v.length -1){
                        let existed_fv = mapping_fields[base_key].fields[mf_i][ui].value.findIndex((ui_v)=>{
                          if (arr_v[ui].value.includes(ui_v)){
                            return true;
                          }
                          return false;
                        });

                        if (existed_fv === -1){
                          update = false;
                          break;
                        }
                      }else{ // Last item
                        update = true;
                      }
                    }
                    return update;

                  });

                  // Update the existing field
                  if (existed_field_index !== -1){

                    let last_item_index = base_group_filter[base_key].fields[existed_field_index].length -1;

                    let arr_values_of_last_item = mapping_fields[base_key].fields[mf_i][mapping_fields[base_key].fields[mf_i].length -1].value;

                    for (let li = 0; li < arr_values_of_last_item.length; li++){
                      // Only add the value that doesn't exist
                      if (!base_group_filter[base_key].fields[existed_field_index][last_item_index].value.includes(arr_values_of_last_item[li])){
                        base_group_filter[base_key].fields[existed_field_index][last_item_index].value.push(arr_values_of_last_item[li]);
                      }
                    }

                  }else{// Add a new field
                    base_group_filter[base_key].fields.push(mapping_fields[base_key].fields[mf_i]);
                  }
                  /*
                  // Validate
                  let is_valid = true;
                  for (let vi = 0; vi < base_group_filter[base_key].fields[mf_i].length; vi++){
                    if (base_group_filter[base_key].fields[vi].name !== mapping_fields[base_key].fields[vi].name){
                      is_valid = false;
                      break;
                    }
                  }

                  // Check each item and do merge
                  if (is_valid){
                    for (let bi = 0; bi < base_group_filter[base_key].fields.length; bi++){
                      if (mapping_fields[base_key].fields[bi].value
                        && base_group_filter[base_key].fields[bi].value !== mapping_fields[base_key].fields[bi].value){

                        // Make sure the value is an array
                        let vl = mapping_fields[base_key].fields[bi].value;
                        if (vl !== undefined && !Array.isArray(vl)){
                          vl = [vl];
                        }

                        if (!Array.isArray(vl)){
                          vl = [];
                        }

                        for (let mi = 0; mi < vl.length; mi++){
                          if (!base_group_filter[base_key].fields[bi].value.includes(vl[mi])){
                            base_group_filter[base_key].fields[bi].value.push(vl[mi]);
                          }
                        }

                      }
                    }
                  }
                  */
                }

              }
            }else{ // Add New
              base_group_filter[base_key] = mapping_fields[base_key];
            }

          }
        }
      }

      if (base_group_filter && Object.keys(base_group_filter).length >= 0){
        mapping_fields = base_group_filter;
      }
      /*
      for (let key in mapping_fields) {
          if (mapping_fields.hasOwnProperty(key)) {
              let list_filters = [];

              // Validate the value.
              if (!mapping_fields[key].fields || mapping_fields[key].fields.length === 0){
                continue;
              }

              // Create each filter
              for (let mf of mapping_fields[key].fields){
                let filter = {n: mf.name, ignore_list: mf.value};
                list_filters.push(filter);
              }

              // Init if not existed
              if (!group_filter[key]){
                group_filter[key] = {};
              }

              // Ready to assign values
              group_filter[key].operator = operator;
              group_filter[key].filters = list_filters;
              group_filter[key].fields = mapping_fields[key].fields;
          }
      }
      */
      let types = [];
      for (let key in mapping_fields) {
          if (mapping_fields.hasOwnProperty(key)) {

              // Validate the value.
              if (!mapping_fields[key].fields || mapping_fields[key].fields.length === 0){
                continue;
              }

              // Create each filter
              for (let arr_mf of mapping_fields[key].fields){
                if (Array.isArray(arr_mf)){
                  let list_filters = [];
                  for (let mf of arr_mf){
                    let type;

                    if (types.includes(mf.name)){
                      type = types[mf.name];
                    }

                    // Get the type from c_info
                    if (!type){
                      const t_index = c_info.findIndex((t)=>t.name === mf.name);
                      if (t_index !== -1){
                        type = c_info[t_index].type;
                        types.push(type);
                      }
                    }

                    let filter = {n: mf.name, ignore_list: mf.value, t: type};
                    list_filters.push(filter);
                  }

                  // Init if not existed
                  if (!group_filter[key]){
                    group_filter[key] = {};
                  }

                  if (!group_filter[key].filters || !Array.isArray(group_filter[key].filters)){
                    group_filter[key].filters = [];
                  }

                  // Ready to assign values
                  group_filter[key].operator = operator;
                  group_filter[key].filters.push(list_filters);

                }

              }

              if (group_filter[key]){
                group_filter[key].fields = mapping_fields[key].fields;
              }
          }
      }

      return group_filter;
    }

    /*
      mapping_fields = {
        "Header/HeaderC": {
                            fields: [
                                [
                                  {name: Header, value: [x]},
                                  {name: HeaderC, value: [great, thanks]}
                                ],
                                [
                                  {name: Header, value: [y]},
                                  {name: HeaderC, value: [pretty]}
                                ]
                            ]
                          },

        "Header": {
                    fields: [
                      [
                        {name: Header, value: [z]}
                      ]
                    ]
                  }
      }

      field_values = [
        {name: Header, value: [x]},
        {name: HeaderC, value: [great, thanks]}
      ]
    */
    build_mapping_field_item_for_group_filter(mapping_fields, field_values){

      if (!mapping_fields){
        mapping_fields = {};
      }

      let mapping_key = field_values.map((v)=>v.name).join(perspective.GROUP_FILTER_SEPARATOR_FIELD);

      if (!mapping_fields[mapping_key]) {
        mapping_fields[mapping_key] = {};
        mapping_fields[mapping_key].fields = [field_values];
      }else{
        if (!mapping_fields[mapping_key].fields){
          mapping_fields[mapping_key].fields = [];
        }

        // Check to update or add a new item

        const existed_field_index = mapping_fields[mapping_key].fields.findIndex((arr_v)=>{

          // Compare arr_v with field_values
          let update = true;
          for (let ui = 0; ui < arr_v.length; ui++){
            if (arr_v[ui].name !== field_values[ui].name){
              update = false;
              break;
            }

            // Not last item in the array. Make sure all parent values are existed, except the last item
            if (ui !== arr_v.length -1){
              let existed_fv = field_values[ui].value.findIndex((ui_v)=>{
                if (arr_v[ui].value.includes(ui_v)){
                  return true;
                }
                return false;
              });

              if (existed_fv === -1){
                update = false;
                break;
              }
            }else{ // Last item
              update = true;
            }
          }
          return update;

        });

        // Update the existing field
        if (existed_field_index !== -1){

          let last_item_index = mapping_fields[mapping_key].fields[existed_field_index].length -1;

          let arr_values_of_last_item = field_values[field_values.length -1].value;

          for (let li = 0; li < arr_values_of_last_item.length; li++){
            // Only add the value that doesn't exist
            if (!mapping_fields[mapping_key].fields[existed_field_index][last_item_index].value.includes(arr_values_of_last_item[li])){
              mapping_fields[mapping_key].fields[existed_field_index][last_item_index].value.push(arr_values_of_last_item[li]);
            }
          }

        }else{// Add a new field
          mapping_fields[mapping_key].fields.push(field_values);
        }

      }

      return mapping_fields;
    }

    get_combined_name(){
      return perspective.COMBINED_NAME;
    }

    /*
    arr_paths = [
      ["C.csv"],
      ["Test", "OneSheet.xlsx"],
      ["Test", "SubTest", "Test.xlsx"],
      ["Test", "all.zip"],
      ["Ex1.xlsx"],
      ["dupes-more.csv"]
    ]

    result = [
      [{name: "C.csv", type: "csv"}],
      [{name:"Test", type: "folder"}, {name: "OneSheet.xlsx", type: "excel"}],
      [{name: "Test", type: "folder"}, {name: "SubTest", type: "folder"}, {name: "Test.xlsx", type: "excel"}],
      [{name: "Test", type: "folder"}, {name: "all.zip", type: "zip"],
      [{name: "Ex1.xlsx", type: "excel"}],
      [{name: "dupes-more.csv", type: "csv"}],
      [{name: "sheet_1", type: "excel_tab"}],
      [{name: "sheet_2", type: "excel_tab"}]
    ]
    */
    did_format_zip_items(arr_paths){
      if (!arr_paths || !Array.isArray(arr_paths) || arr_paths.length === 0){
        return arr_paths;
      }

      // No things to do if it's not an array objects
      if (Array.isArray(arr_paths[0]) && arr_paths[0].length > 0
        && typeof arr_paths[0][0] === "object" && Object.keys(arr_paths[0][0]).length === 0){
        return arr_paths;
      }

      let arr_objects = [];
      for (let arr_path of arr_paths){
        if (!Array.isArray(arr_path) || arr_path.length === 0){
          continue;
        }

        let arr_obj = [];
        for (let item of arr_path){
          // Get extension
          let ext = perspective.RE_EXTENSION.exec(item)[1];
          arr_obj.push({name: item, type: typeof ext === "string" && ext ? ext.toLowerCase() : "folder"});
        }
        arr_objects.push(arr_obj);
      }

      return arr_objects;
    }

    get_current_zoom_ratio() {
      return this._current_zoom || 1;
    }
}

/**
 * `perspective-click` is fired whenever underlying `view`'s grid or chart are
 * clicked providing a detail that includes a `config`, `column_names` and
 * `row`.
 *
 * @event module:perspective_viewer~PerspectiveViewer#perspective-click
 * @type {object}
 * @property {array} column_names - Includes a list of column names.
 * @property {object} config - Contains a property `filters` that can be applied
 * to a `<perspective-viewer>` through the use of `restore()` updating it to
 * show the filtered subset of data..
 * @property {array} row - Includes the data row.
 */

/**
 * `perspective-config-update` is fired whenever an configuration attribute has
 * been modified, by the user or otherwise.
 *
 * @event module:perspective_viewer~PerspectiveViewer#perspective-config-update
 * @type {string}
 */

/**
 * `perspective-view-update` is fired whenever underlying `view`'s data has
 * updated, including every invocation of `load` and `update`.
 *
 * @event module:perspective_viewer~PerspectiveViewer#perspective-view-update
 * @type {string}
 */
