/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import perspective from "@jpmorganchase/perspective";
import {renderers} from "./renderers.js";
import { strict } from "assert";
import {parse_formula} from "../utils.js";

export class StateElement extends HTMLElement {
    get _plugin() {
        let current_renderers = renderers.getInstance();
        let view = this.getAttribute("view");
        if (!view) {
            view = Object.keys(current_renderers)[0];
        }
        this.setAttribute("view", view);
        return current_renderers[view] || current_renderers[Object.keys(current_renderers)[0]];
    }

    _get_view_dom_columns(selector, callback) {
        selector = selector || "#active_columns perspective-row";
        let columns = [];
        if (selector == "#inactive_columns perspective-row") {
            columns = this._inactive_columns_frag ? [...this._inactive_columns_frag] : [];
        }
        else if (selector == "#active_columns perspective-row") {
            columns = this._active_columns_frag ? [...this._active_columns_frag] : [];
        }
        else {
            columns = Array.prototype.slice.call(this.shadowRoot.querySelectorAll(selector));
        }

        if (!callback) {
            return columns;
        }
        return columns.map(callback);
    }

    _get_view_all_columns() {
        return this._get_view_dom_columns("#inactive_columns perspective-row");
    }

    _get_view_active_columns() {
        return this._get_view_dom_columns("#active_columns perspective-row");
    }

    _get_view_inactive_columns() {
        return this._get_view_dom_columns("#inactive_columns perspective-row");
    }

    _get_view_active_column_names() {
        return this._get_view_active_columns().map(x => x.getAttribute("name"));
    }

    _get_view_all_column_names() {
        return this._get_view_all_columns().map(x => x.getAttribute("name"));
    }

    _get_all_column_names(active_only = false) {
        var all_column_names = [];
        if (!active_only) {
            all_column_names = this._get_view_dom_columns("#inactive_columns perspective-row", col => {
                return col.getAttribute("name");
            });
        }
        var all_aggregation_names = [];
        all_aggregation_names = this._get_view_dom_columns("#active_columns perspective-row", col => {
            return col.getAttribute("new_base_name");
        });
        return all_column_names.concat(all_aggregation_names);
    }

    _get_all_dnames() {
        return this._get_view_dom_columns("#active_columns perspective-row", col => {
            return col.getAttribute("dname");
        });
    }

    _get_view_columns({active = true} = {}) {
        let selector;
        if (active) {
            selector = "#active_columns perspective-row";
        } else {
            selector = "#inactive_columns perspective-row";
        }
        return this._get_view_dom_columns(selector, col => {
            return col.getAttribute("new_base_name");
        });
    }

    _get_view_column_value_pivots() {
        var selector = "#value_pivots perspective-row";
        return this._get_view_dom_columns(selector, col => {
            return col.getAttribute("new_base_name");
        });
    };

    _get_type_column(selector, name) {
        var type;
        this._get_view_dom_columns(selector, col => {
            if (col.getAttribute("name") === name) {
                type = col.getAttribute("type");
            }
        });
        return type;
    }

    _get_disp_name_aggregate(base_name, aggregate, period, show_type) {
        if (aggregate == "custom") {
            return base_name;
        }
        var new_base_name = this._get_dname_name(base_name);
        period = this._visible_column_period() ? period : "none";

        if (aggregate === "any") {
            return (period === "previous" ? "Previous " : "") + new_base_name
                + this._get_view_show_type_display_name(null, show_type);
        } else {
            return (period === "previous" ? "Previous " : "") + perspective.AGGREGATE_DEFAULT_VNAMES[aggregate]
                + " of " + new_base_name + this._get_view_show_type_display_name(null, show_type);
        }
    }

    _get_dname_name(name) {
        var dnames = JSON.parse(this.getAttribute("dname-pivots"));
        if (dnames && dnames[name]) {
            return dnames[name];
        }

        for (let info of this.c_info)
        {
            if (info.name === name) {
                return info.dname;
            }
        }

        return name;
    }
    /*
    _get_default_data_format(type){
      if (!type){
        return undefined;
      }
      var data_format_options = [];

      switch (type) {
          case "float":
          case "integer":
          case "decimal":
              data_format_options = perspective.TYPE_DATA_FORMATS.float;
              break;
          case "boolean":
              data_format_options = perspective.TYPE_DATA_FORMATS.boolean;
              break;
          case "date":
              data_format_options = perspective.TYPE_DATA_FORMATS.date;
              break;
          case "datetime":
              data_format_options = perspective.TYPE_DATA_FORMATS.datetime;
              break;
          case "duration":
              data_format_options = perspective.TYPE_DATA_FORMATS.duration;
              break;
          case "string":
              data_format_options = perspective.TYPE_DATA_FORMATS.string;
              break;
          case "list_string":
              data_format_options = perspective.TYPE_DATA_FORMATS.string;
              break;
          case "list_boolean":
              data_format_options = perspective.TYPE_DATA_FORMATS.boolean;
              break;
          case "list_integer":
          case "list_float":
              data_format_options = perspective.TYPE_DATA_FORMATS.float;
              break;
          case "list_date":
          case "list_datetime":
          case "list_duration":
              if (type === "list_date") {
                  data_format_options = perspective.TYPE_DATA_FORMATS.date;
              } else if (type === "list_datetime") {
                  data_format_options = perspective.TYPE_DATA_FORMATS.datetime;
              } else {
                  data_format_options = perspective.TYPE_DATA_FORMATS.duration;
              }
              break;
          default:
      }

      if (data_format_options.length > 0){
        return data_format_options[0];
      }else{
        return undefined;
      }
    }
    */

    _suggestion_aggregate(name, type, period, show_type) {
        var current_aggreagtes = [];
        var lis = this._get_view_dom_columns("#value_pivots perspective-row");
        lis.map(x => {
            var x_period = x.getAttribute("period") || "none";
            //var x_show_type = x.getAttribute("show_type") || "default";
            //if (name == x.getAttribute("name") && period == x_period && show_type == x_show_type) {
            if (name == x.getAttribute("name") && period == x_period) {
                let available_list = this._get_available_show_types(x, true);
                if (available_list.length === 0) {
                    current_aggreagtes.push(x.getAttribute("aggregate"));
                }
            }
        });
        if (!current_aggreagtes.includes(name === "__rownum__" ? "count" : perspective.AGGREGATE_DEFAULTS[type])) {
            if (name === "__rownum__") {
                return "count";
            }
            return perspective.AGGREGATE_DEFAULTS[type];
        }
        const col_in_pivot = this._row_col_pivots_has_column(name);
        for (var idx in perspective.TYPE_AGGREGATES[type]) {
            if (current_aggreagtes.indexOf(perspective.TYPE_AGGREGATES[type][idx]) === -1) {
                if (col_in_pivot && perspective.TYPE_AGGREGATES[type][idx] === "any") {
                    continue;
                }
                return perspective.TYPE_AGGREGATES[type][idx];
            }
        }
        if (name === "__rownum__") {
            return "count";
        }
        return perspective.AGGREGATE_DEFAULTS[type];
    }

    /**
     * get suggestion show type
     * @param {*} col
     */
    _suggestion_show_type(col) {
        let available_list = this._get_available_show_types(col);
        if (available_list.length > 0) {
            return available_list[0];
        }
        return "default";
    }

    _valid_aggregate_period_show_type(name, agg, row) {
        var current_aggreagtes = [];
        //var lis = this._get_view_dom_columns();
        var lis = [];
        var container = row.getAttribute("container");
        if (!container){
          return true;
        }

        if (["row_pivots", "column_pivots"].includes(container) == true){
          lis = this._get_view_dom_columns("#row_pivots perspective-row").concat(this._get_view_dom_columns("#column_pivots perspective-row"));
        }else if(container === "value_pivots"){
          lis = this._get_view_dom_columns("#value_pivots perspective-row");
        }
        let row_period = row.getAttribute("period") || "none";
        let show_type = row.getAttribute("show_type") || "default";
        lis.map(x => {
            var x_period = x.getAttribute("period") || "none";
            var x_show_type = x.getAttribute("show_type") || "default";
            if (name == x.getAttribute("name") && row_period == x_period && show_type === x_show_type && x !== row) {
                current_aggreagtes.push(x.getAttribute("aggregate"));
            }
        });
        if (current_aggreagtes.indexOf(agg) !== -1) {
            return false;
        }
        return true;
    }

    _validate_agg_level(name, agg_level, row) {
        var valid_agg_level = true;
        var column_elems = this._get_view_dom_columns("#row_pivots perspective-row").concat(this._get_view_dom_columns("#column_pivots perspective-row"));
        column_elems.forEach(col => {
            if (col.getAttribute("name") === name && col !== row && agg_level === col.getAttribute("agg_level")) {
                valid_agg_level = false;
            }
        });
        return valid_agg_level;
    }

    _get_view_aggregates(selector) {
        selector = selector || (this.is_cinfo_pivot(false) ? "#value_pivots perspective-row" : "#active_columns perspective-row");
        return this._get_view_dom_columns(selector, s => {
            return {
                op: s.getAttribute("aggregate"),
                column: s.getAttribute("name"),
                new_base_name: s.getAttribute("new_base_name"),
                type: s.getAttribute("type")
            };
        });
    }

    _get_view_show_types(selector) {
        selector = selector || "#value_pivots perspective-row";
        return this._get_view_dom_columns(selector, s => {
            let show_type = this._get_column_show_type(s);
            return {
                type: show_type,
                column: s.getAttribute("new_base_name")
            };
        });
    }

    _get_view_show_type_display_name(col, show_type = undefined) {
        if (show_type === undefined && col) {
            show_type = this._get_column_show_type(col);
        }
        return perspective.SHOW_TYPE_DISPLAY_NAME[show_type || "default"];
    }

    _get_view_search_types(selector) {
        var search_types = [];

        let search_type_map = {};
        this.c_info.forEach((v)=>{
            search_type_map[v.name] = v.search_type;
        });

        selector = selector || "#inactive_columns perspective-row";
        this._get_view_dom_columns(selector, s => {
            search_types.push({
                type: search_type_map[s.getAttribute("name")],
                column: s.getAttribute("name")
            });
        });

        return search_types;
    }

    _get_non_aggregated_data_formats() {
        let data_formats = [];
        let data_format_map = {};
        this.c_info.forEach(info => {
            data_format_map[info.name] = info.data_format;
        });

        let selector = "#inactive_columns perspective-row";
        this._get_view_dom_columns(selector, s => {
            if (s.getAttribute("name") !== perspective.COMBINED_NAME) {
                data_formats.push({
                    format: data_format_map[s.getAttribute("name")] || s.getAttribute("data_format"),
                    column: s.getAttribute("name")
                });
            }
        });

        return data_formats;
    }

    _get_view_data_formats(selector) {
        var data_formats = [];

        selector = selector || "#inactive_columns perspective-row";
        this._get_view_dom_columns(selector, s => {
            if (s.getAttribute("name") !== perspective.COMBINED_NAME) {
                data_formats.push({
                    format: s.getAttribute("data_format"),
                    column: s.getAttribute("name")
                });
            }
        });

        return data_formats;
    }

    _get_view_pivot_data_formats() {
        var data_formats = this._get_aggregate_data_formats("#value_pivots perspective-row");
        return data_formats.concat(this._get_view_data_formats("#row_pivots perspective-row"))
                            .concat(this._get_view_data_formats("#column_pivots perspective-row"));
    }

    _get_view_computed_columns() {
        return JSON.parse(this.getAttribute("computed_columns")) || [];
    }

    _get_view_parsed_computed_columns() {
        return JSON.parse(this.getAttribute("parsed-computed-columns")) || [];
    }

    _get_aggregate_data_formats(selector) {
        var data_formats = [];

        selector = selector || "#active_columns perspective-row";
        this._get_view_dom_columns(selector, s => {
            var agg = s.getAttribute("aggregate");
            var df = s.getAttribute("data_format");
            var dname = s.getAttribute("new_base_name");
            if (perspective.STATISTIC_AGGREGATES.includes(agg) && agg !== "min" && agg !== "max") {
                if (!perspective.NUMBER_DATA_FORMATS.includes(df)) {
                    df = "number";
                }
            }
            data_formats.push({
                format: df,
                column: dname
            });
        });

        return data_formats;
    }

    _get_view_column_base_names(selector) {
        selector = selector || "#active_columns perspective-row"
        return this._get_view_dom_columns(selector, col => {
            return col.getAttribute("name");
        });
    }

    _get_view_row_pivots() {
        return this._get_view_column_base_names("#row_pivots perspective-row");
    }

    _get_view_column_pivots() {
        return this._get_view_column_base_names("#column_pivots perspective-row");
    }

    _get_view_value_pivots() {
        return this._get_view_column_base_names("#value_pivots perspective-row");
    }

    _get_raw_value_pivots(selector) {
        selector = selector || "#value_pivots perspective-row"
        return this._get_view_dom_columns(selector, col => {
            return {n: col.getAttribute("name"), base_name: col.getAttribute("new_base_name"), dname: col.getAttribute("dname")};
        });
    }

    _get_view_row_pivots_dropdown() {
        return this._get_view_dom_columns("#row_pivots perspective-row", col => {
            var agg_level = col.getAttribute("agg_level");
            if (!agg_level || agg_level == "" || agg_level == "OFF") {
                return col.getAttribute("name");
            } else {
                return col.getAttribute("name") + "(" + agg_level + ")";
            }
        });
    }

    _get_view_filter_nodes() {
        return this._get_view_dom_columns("#filters perspective-row");
    }

    _get_view_filters() {
        let filters = [];
        let filter_cols = this._get_view_dom_columns("#filters perspective-row");
        for (let col of filter_cols) {
          // Group filter
          if (col.getAttribute("name") === perspective.GROUP_FILTER_NAME){
            let g_filter = JSON.parse(col.getAttribute("filter"));
            if (!g_filter.group_filter || Object.keys(g_filter.group_filter).length == 0) {
                continue;
            }
            g_filter.n = col.getAttribute("name");
            filters.push(g_filter);
          }else{
            let {operator, operand, filter_by, subtotal, ignore_list, selected_list, unselected_all, datalist_contains_all, search, is_custom_filter} = JSON.parse(col.getAttribute("filter"));
            filters.push({n: col.getAttribute("name"), operator: operator, operand: operand, filter_by: filter_by,
                subtotal: subtotal, ignore_list: ignore_list, selected_list: selected_list,
                unselected_all: unselected_all, datalist_contains_all: datalist_contains_all, serach: search, is_custom_filter: is_custom_filter});
          }
        }
        return filters;
    }

    _get_view_periods(selector) {
        var periods = [];

        selector = selector || "#value_pivots perspective-row";
        this._get_view_dom_columns(selector, s => {
            var period = s.getAttribute("period");
            if (period && period !== "none") {
                periods.push({
                    type: s.getAttribute("period") || "none",
                    column: s.getAttribute("new_base_name")
                });
            }
        });

        return periods;
    }

    _get_view_searchs() {
        var searchs = "";
        if (this._search_input_id.value && this._search_input_id.value !== "") {
            searchs = this._search_input_id.value;
        }
        return searchs;
    }

    _set_view_searchs(searchs) {
        this._search_input_id.value = searchs;
    }

    _get_view_sorts() {
        var is_cinfo = this.is_cinfo_pivot(false);
        if (is_cinfo) {
            var sorts = [];
            var elems = this._get_view_dom_columns("#row_pivots perspective-row").concat(this._get_view_dom_columns("#column_pivots perspective-row"))
            elems.forEach(col => {
                let name = col.getAttribute("name");
                if (name === perspective.COMBINED_NAME) {
                    return;
                }
                var order = col.getAttribute("sort_order") || "asc";
                let container = col.getAttribute("container");
                if (container === "column_pivots" && order !== "none") {
                    order = "col " + order;
                }
                let limit = col.getAttribute("limit") || "none";
                let limit_type = col.getAttribute("limit_type") || "Items";
                if (limit_type === "undefined" || limit_type === "null") {
                    limit_type = "Items";
                }
                let sort_by = col.getAttribute("sort_by") || name;
                let sort_subtotal = col.getAttribute("subtotal");
                sorts.push([name, order, sort_by, sort_subtotal, limit, limit_type]);
            });
            return sorts;
        } else {
            var sorts = [];
            let limit_elem = null;
            let elems = this._get_view_dom_columns("#active_columns perspective-row").filter(col => {
                let sort_order = col.getAttribute("sort_order");
                let sort_num = col.getAttribute("sort_num");
                let sort_limit = col.getAttribute("limit");
                if (!limit_elem && sort_limit && sort_limit !== "null" && sort_limit !== "undefined") {
                    limit_elem = col;
                }
                return sort_order && sort_order !== "null" && sort_order !== "undefined"
                        && sort_num && sort_num !== "null" && sort_num !== "undefined";
            });
            if (elems.length === 0 && limit_elem) {
                elems = [limit_elem];
            }
            elems.sort((elem1, elem2) => Number(elem1.getAttribute("sort_num") - Number(elem2.getAttribute("sort_num"))));
            for (let col of elems) {
                let order = col.getAttribute("sort_order") || "none";
                let limit = col.getAttribute("limit") || "none";
                let limit_type = col.getAttribute("limit_type") || "Items";
                if (limit_type === "undefined" || limit_type === "null") {
                    limit_type = "Items";
                }
                sorts.push([col.getAttribute("name"), order, undefined, undefined, limit, limit_type]);
            }

            return sorts;
        }
    }

    _get_view_pivot_info(selector, type = "row") {
        selector = selector || "#row_pivots perspective-row";
        let pivot_info = [];
        let index = 0;
        this._get_view_dom_columns(selector, col => {
            let col_type = col.getAttribute("type");
            if (col_type !== perspective.COMBINED_TYPE_STR) {
                let agg_level = col.getAttribute("agg_level");
                var binning = col.getAttribute("binning");
                var subtotals = col.getAttribute("subtotals");
                if (subtotals === "false" || subtotals === false) {
                    subtotals = false;
                } else {
                    subtotals = true;
                }
                if (binning && (["float", "integer", "list_float", "list_integer"].includes(col_type)
                        || (["date", "datetime", "list_date", "list_datetime"].includes(col_type) && col.getAttribute("agg_level") === "YEAR"))) {
                    binning = JSON.parse(binning);
                } else {
                    binning = {
                        type: "OFF"
                    };
                }
                if (binning && binning.type !== "OFF") {
                    binning.is_double = this._check_is_double_for_binning(col.getAttribute("name"));
                }
                pivot_info.push({
                    level: agg_level || "OFF",
                    index: index,
                    type: type,
                    column: col.getAttribute("name"),
                    pivot_name: type + "_" + col.getAttribute("name") + "_" + index,
                    subtotal: subtotals,
                    binning: binning
                });
                index++;
            }
        });
        return pivot_info;
    }

    _get_column_map(selector) {
        selector = selector || "#active_columns perspective-row";
        var column_map = {};
        this._get_view_dom_columns(selector, col => {
            if (col.classList.contains("computed-pivot")) {
                column_map[col.getAttribute("new_base_name")] = col.getAttribute("new_base_name");
            } else {
                column_map[col.getAttribute("new_base_name")] = col.getAttribute("name");
            }
        });
        return column_map;
    }

    _get_visible_column_count() {
        var count = 0;
        let lis = this.is_cinfo_pivot(false) ? this._get_view_dom_columns("#value_pivots perspective-row")
                                            : this._get_view_dom_columns();
        lis.map(x => {
            if (!x.classList.contains("computed-pivot")) {
                count++;
            }
        });
        return count;
    }

    _get_computed_columns() {
        var computed_columns = [];
        this._get_view_dom_columns().map(x => {
            computed_columns.push(x.getAttribute("name"));
        });
        return computed_columns;
    }

    _validate_new_name(name, new_name) {
        if (new_name == "") {
            return false;
        }
        if (name === new_name) {
            return true;
        }
        var to_upper = x => x.toUpperCase();
        var column_names = this._get_all_column_names().map(to_upper);
        if (column_names.includes(new_name.toUpperCase())) {
            return false;
        } else {
            column_names = this._get_all_dnames().map(to_upper);
            if (column_names.includes(new_name.toUpperCase())) {
                return false;
            }
            // Check new name exist on dname pivots and cinfo
            var dname_pivots = JSON.parse(this.getAttribute("dname-pivots")) || {};
            this.c_info.forEach(info => {
                if (info.dname && info.dname !== info.name) {
                    dname_pivots[info.name] = info.dname;
                }
            });
            for (let original_name in dname_pivots) {
                var dname = dname_pivots[original_name];
                if (original_name !== name && dname.toUpperCase() === new_name.toUpperCase()) {
                    return false;
                }
            }
            return true;
        }
    }

    _validate_active_name(name) {
        const column_names = this._get_all_column_names(true);
        if (name == "") {
            return false;
        }
        if (column_names.includes(name)) {
            return false;
        } else {
            return true;
        }
    }

    _get_max_rows() {
        var value = this.getAttribute("max_row") || 0;
        if (value) {
            return parseInt(value);
        }
        return 0;
    }

    _get_max_columns() {
        /*var value = this._vis_max_col.value;
        if (value) {
            return parseInt(value);
        }
        return 0;*/
        return 2000;
    }

    _get_pivot_view(current = true) {
        var value = this.getAttribute("pivot_view_mode") || "0";
        if (current) {
            var current_request = this.get_request_structure("current");
            value = current_request["pivot_view_mode"];
        }
        if (!value) {
            return 0;
        }
        if (!this.is_cinfo_pivot(current)) {
            return 0;
        }
        /*if (this.is_column_pivot(current)) {
            return 0;
        }*/
        return parseInt(value);
    }

    /**
     * Check can show page item dropdown
     */
    _can_show_items_per_page() {
        var row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
        var nested_or_flat_mode = this._get_pivot_view(false);
        if (row_pivots.length > 1 && nested_or_flat_mode !== 1) {
            return false;
        }
        return true;
    }

    /**
     * get pagination setting
     * page items: row per page
     * page_number: number of page
     */
    _get_pagination_setting() {
        return JSON.parse(this.getAttribute("pagination")) || {
            page_items: 0,
            page_number: 0
        };
    }

    _can_request_building() {
        return Object.keys(this.REQUEST_STRUCTURE.building).length != 0;
    }

    async _build_request_structure() {
        const _is_pivot = this.is_cinfo_pivot(false);
        var row_pivots = this._get_view_row_pivots();
        var column_pivots = this._get_view_column_pivots();
        var value_pivots = this._get_view_value_pivots();
        const filters = await this._validate_filters();
        const view_periods = this._get_view_periods();
        const searchs = this._validate_searchs();
        var view_aggregates = this._get_view_aggregates();
        const view_show_types = _is_pivot ? this._get_view_show_types() : [];
        const view_search_types = this._get_view_search_types("#active_columns perspective-row");
        const view_full_search_types = this._get_view_search_types();
        const view_data_formats = _is_pivot ? this._get_view_pivot_data_formats() : this._get_non_aggregated_data_formats();
        //if (view_aggregates.length === 0) return;
        var sort = this._get_view_sorts();
        const row_pivot_info = this._get_view_pivot_info();
        const column_pivot_info = this._get_view_pivot_info("#column_pivots perspective-row", "column");
        const raw_column_map = this._get_column_map(_is_pivot ? "#value_pivots perspective-row" : "#active_columns perspective-row");
        const max_rows = this._get_max_rows();
        const max_columns = this._get_max_columns();
        const pivot_view_mode = this._get_pivot_view(false);
        // Pagination group
        const pagination_setting = this._get_pagination_setting();

        //let columns = view_aggregates.map(x => x.new_base_name);
        var columns = view_aggregates.map(x => x.new_base_name);
        if (!_is_pivot && !this.is_cinfo_search(false)){
            var _c_info = this.get_cinfo(false);
            var columns = _c_info.sort(function(a, b){return a.original_index - b.original_index})
            .map(v => v.name);
            view_aggregates = this._get_view_aggregates("#inactive_columns perspective-row");
        }
        let aggregates = {};
        for (const a of view_aggregates) {
            aggregates[a.new_base_name] = a.op;
        }

        let periods = {};
        for (const p of view_periods) {
            periods[p.column] = p.type;
        }

        let show_types = {};
        for (const st of view_show_types) {
            show_types[st.column] = st.type;
        }

        let search_types = {};
        for (const a of view_search_types) {
            search_types[a.column] = a.type;
        }

        let remaining_search_types = {};
        for (const a of view_full_search_types) {
            if (!search_types[a.column]) {
                remaining_search_types[a.column] = a.type;
            }
        }
        if (_is_pivot) {
            for (const col_name of row_pivots) {
                if (!search_types[col_name]) {
                    search_types[col_name] = remaining_search_types[col_name];
                }
            }
        } else {
            for (const col_name of columns) {
                if (!search_types[col_name]) {
                    search_types[col_name] = remaining_search_types[col_name];
                }
            }
        }

        let data_formats = {};
        for (const a of view_data_formats) {
            data_formats[a.column] = a.format;
        }

        var agg_custom = [];
        if (this.is_row_pivot(false)) {
            const raw_agg_custom = JSON.parse(this.getAttribute("agg-custom"));
            if (raw_agg_custom) {
                agg_custom = raw_agg_custom.map((computed_col) => {
                    return {
                        name: computed_col.name,
                        formula: parse_formula(computed_col.func, computed_col.inputs)
                    };
                });
            }
        }

        var column_map = [];
        if (column_pivots.length > 0 || row_pivots.length > 0 || value_pivots.length > 0) {
            for (var new_base_name in raw_column_map) {
                column_map.push({
                    name: new_base_name,
                    original_name: raw_column_map[new_base_name]
                })
            }
        }

        // For combined column
        var combined_mode = perspective.COMBINED_MODES.column;
        var combined_index = column_pivots.indexOf(perspective.COMBINED_NAME);
        if (row_pivots.length > 0 && combined_index === -1) {
            combined_index = row_pivots.indexOf(perspective.COMBINED_NAME);
            if (combined_index !== -1) {
                combined_mode = perspective.COMBINED_MODES.row;
                column_pivots = column_pivots.filter(x => x !== perspective.COMBINED_NAME);
                row_pivots = row_pivots.filter(x => x !== perspective.COMBINED_NAME);
            }
        } else if (combined_index !== -1) {
            column_pivots = column_pivots.filter(x => x !== perspective.COMBINED_NAME);
            row_pivots = row_pivots.filter(x => x !== perspective.COMBINED_NAME);
        }

        for (var s of sort) {
            if (s[3]) {
                s[3] = this.SUB_TOTAL_LIST.indexOf(s[3]);
            }
            if (!s[4] || (s[4] === "none")) {
                s[4] = -1;
            } else {
                s[4] = Number(s[4]);
            }
        }

        for (var f of filters) {
            if (column_pivots.indexOf(f[0]) !== -1) {
                //delete f[3];
                delete f[4];
            } else {
                if (f[4]) {
                    f[4] = this.SUB_TOTAL_LIST.indexOf(f[4]);
                }
            }
        }

        // computed column
        const computed_columns = JSON.parse(this.getAttribute("parsed-computed-columns"));
        console.log('computed_columns-----', computed_columns);
        return {
            filter: filters,
            search: searchs ? [searchs] : null,
            row_pivots: row_pivots,
            column_pivots: column_pivots,
            value_pivots: value_pivots,
            aggregates: aggregates,
            periods: periods,
            search_types: search_types,
            data_formats: data_formats,
            columns: columns,
            sort: sort,
            computed_columns: computed_columns,
            row_pivot_info: row_pivot_info,
            column_pivot_info: column_pivot_info,
            column_map: column_map,
            combined_field: {
                combined_mode: combined_mode,
                combined_index: combined_index
            },
            max_rows: max_rows > 0 ? max_rows : null,
            max_columns: max_columns > 0 ? max_columns : null,
            pivot_view_mode: pivot_view_mode,
            show_types: show_types,
            pagination_setting: pagination_setting
        };
    }

    /**
     * Build all information of action from viewer
     * @param {*} type
     * @param {*} row
     */
    _build_action_information(type, row, options = {}) {
        var information = {};
        switch(type) {
            case perspective.ACTION_TYPE.show_column:
            case perspective.ACTION_TYPE.hide_column: {
                information.row = [row.getAttribute("name"), row.getAttribute("type"), row.getAttribute("aggregate"),
                    row.getAttribute("data_format"), row.getAttribute("computed")];
                if (this.is_cinfo_pivot(false)) {
                    information.row[5] = row.getAttribute("show_type");
                }
                if (options.row_pivots) {
                    information.row_pivots = options.row_pivots;
                }
                if (options.column_pivots) {
                    information.column_pivots = options.column_pivots;
                }
                if (options.active_cols) {
                    information.active_cols = options.active_cols;
                }
                if (options.value_pivots) {
                    information.value_pivots = options.value_pivots;
                }
                if (options.sort) {
                    information.sort = options.sort;
                }
                if (options.viewer_attributes) {
                    information.viewer_attributes = options.viewer_attributes;
                }
                if (options.dependency_elems) {
                    information.dependency_elems = options.dependency_elems;
                }
            } break;

            case perspective.ACTION_TYPE.hide_grid_columns: {
                information.rows = [];
                const active_lis = this._get_view_dom_columns("#active_columns perspective-row");
                active_lis.forEach(x => {
                    if (options.c_names.includes(x.getAttribute("name"))){
                        var row = [x.getAttribute("name"), x.getAttribute("type"), x.getAttribute("aggregate"),
                            x.getAttribute("data_format"), x.getAttribute("computed")];

                        if (this.is_cinfo_pivot(false)) {
                            row[6] = x.getAttribute("show_type");
                        }
                        information.rows.push(row);
                    }
                });
            } break;

            case perspective.ACTION_TYPE.change_active_dropdown: {
                if (row) {
                    information.row = [row.getAttribute("name"), row.getAttribute("drag_id"), row.getAttribute("container")];
                }
                if (options.attribute) {
                    information.old_value = options.old_value;
                    information.new_value = options.new_value;
                    information.attribute = options.attribute;
                }
                if (options.dependency_attribute) {
                    information.dependency_attribute = options.dependency_attribute;
                }
                if (options.dependency_elems) {
                    information.dependency_elems = options.dependency_elems;
                }
                if (options.viewer_attributes) {
                    information.viewer_attributes = options.viewer_attributes;
                }
            } break;

            case perspective.ACTION_TYPE.change_column_name: {
                information.row = [row.getAttribute("name"), row.getAttribute("drag_id"), row.getAttribute("container")];
                information.old_dname_value = options.old_dname_value;
                information.new_dname_value = options.new_dname_value;
                information.old_alias_value = options.old_alias_value;
                information.new_alias_value = options.new_alias_value;
            } break;

            case perspective.ACTION_TYPE.change_sort:
            case perspective.ACTION_TYPE.change_group_by_dropdown: {
                information.row = [row.getAttribute("name"), row.getAttribute("container")];
                information.old_value = options.old_value;
                information.new_value = options.new_value;
                information.attribute = options.attribute;
                if (options.dependency_attribute) {
                    information.dependency_attribute = options.dependency_attribute;
                }
                if (options.dependency_elems) {
                    information.dependency_elems = options.dependency_elems;
                }
                if (options.viewer_attributes) {
                    information.viewer_attributes = options.viewer_attributes;
                }
            } break;

            case perspective.ACTION_TYPE.change_filter: {
                if (row) {
                    information.row = [row.getAttribute("name"), row.getAttribute("container")];
                    information.old_value = options.old_value;
                    information.new_value = options.new_value;
                    information.attribute = options.attribute;
                }
            } break;

            case perspective.ACTION_TYPE.change_viewer_attribute: {
                information.old_value = options.old_value;
                information.new_value = options.new_value;
                information.attribute = options.attribute;
                if (options.dependencies) {
                    information.dependencies = options.dependencies;
                }
            } break;

            case perspective.ACTION_TYPE.close_tag: {
                information.old_value = options.old_value;
                information.new_value = options.new_value;
                information.attribute = options.attribute;
                information.old_filters = options.old_filters || null;
                information.new_filters = options.new_filters || null;
                information.old_sorts = options.old_sorts || null;
                information.new_sorts = options.new_sorts || null;
                if (options.old_active_list != null && options.old_active_list != undefined) {
                    information.old_active_list = options.old_active_list;
                }
                if (options.new_active_list != null && options.new_active_list != undefined) {
                    information.new_active_list = options.new_active_list;
                }
                if (options.old_value_pivots != null && options.old_value_pivots != undefined) {
                    information.old_value_pivots = options.old_value_pivots;
                }
                if (options.new_value_pivots != null && options.new_value_pivots != undefined) {
                    information.new_value_pivots = options.new_value_pivots;
                }
                if (options.old_row_pivots != null && options.old_row_pivots != undefined) {
                    information.old_row_pivots = options.old_row_pivots;
                }
                if (options.new_row_pivots != null && options.new_row_pivots != undefined) {
                    information.new_row_pivots = options.new_row_pivots;
                }
                if (options.old_column_pivots != null && options.old_column_pivots != undefined) {
                    information.old_column_pivots = options.old_column_pivots;
                }
                if (options.new_column_pivots != null && options.new_column_pivots != undefined) {
                    information.new_column_pivots = options.new_column_pivots;
                }
            } break;

            case perspective.ACTION_TYPE.add_tag: {
                if (options.target) {
                    information.target = options.target;
                }

                if (options.source) {
                    information.source = options.source;
                }

                if (options.row_pivots) {
                    information.row_pivots = options.row_pivots;
                }
                if (options.column_pivots) {
                    information.column_pivots = options.column_pivots;
                }
                if (options.value_pivots) {
                    information.value_pivots = options.value_pivots;
                }
            } break;

            case perspective.ACTION_TYPE.change_data_formats: {
                information.old_value = options.old_value;
                information.new_value = options.new_value;
                information.name_attr = options.name_attr;
                information.container = options.container;
            } break;

            case perspective.ACTION_TYPE.change_multiple_sorts: {
                information.items = options.items;
                if (options.dependency_elems) {
                    information.dependency_elems = options.dependency_elems;
                }
            } break;

            case perspective.ACTION_TYPE.order_columns: {

            } break;

            case perspective.ACTION_TYPE.change_site_search: {
                information = options;
            } break;

            case perspective.ACTION_TYPE.change_column_width: {
                information = options;
                information.timer = new Date().getTime();
            } break;

            default: {} break;
        }

        return information;
    }

    _visible_column_show_type(col) {
        let type = col.getAttribute("type");
        let aggregate = col.getAttribute("aggregate");
        if (type === "integer" || type === "float") {
            if (aggregate === "unique") {
                return false;
            } else {
                return true;
            }
        } else {
            if (perspective.STATISTIC_AGGREGATES.includes(aggregate)) {
                return true;
            } else {
                return false;
            }
        }
    }

    /**
     * Get show type for request to cpp
     * @param {*} col
     */
    _get_column_show_type(col) {
        let show_type = this._visible_column_show_type(col) ? (col.getAttribute("show_type") || "default") : "default";
        let pivot_type = this._get_display_as_pivot_type();
        if (pivot_type === "none") {
           if (show_type === "%_of_parent_row" || show_type === "%_of_parent_column") {
               show_type = "default";
           }
        } else if ((pivot_type === "col" && show_type === "%_of_parent_row")
            || (pivot_type === "row" && show_type === "%_of_parent_column")) {
            show_type = "default";
        }

        if ((show_type === "diff_from_prev_value" || show_type === "%_of_prev_value")
            && !this._get_display_as_has_previous(col)) {
            show_type = "default";
        }

        return show_type;
    }

    _visible_column_period() {
        if (this.is_cinfo_pivot(false)) {
            let filters = JSON.parse(this.getAttribute("filters")) || [];
            for (const filter of filters) {
                if (filter.operator === "relative date") {
                    if (perspective.FILTERS_PERIOD_OPERATORS.includes(filter.operand[0])) {
                        return filter.operand[0];
                    }
                }
                if (perspective.FILTERS_PERIOD_OPERATORS.includes(filter.operator)) {
                    return filter.operator;
                }
            }
            const elems = this._get_view_dom_columns("#row_pivots perspective-row")
                        .concat(this._get_view_dom_columns("#column_pivots perspective-row"));
            for (const node of elems) {
                if (!node.getAttribute("filter") || !JSON.parse(node.getAttribute("filter"))) {
                    continue;
                }

                const {operator} = JSON.parse(node.getAttribute("filter"));
                if (perspective.FILTERS_PERIOD_OPERATORS.includes(operator)) {
                    return operator;
                }
            }
            return false;
        } else {
            return false;
        }
    }

    _current_contain_column(col_name, key = "columns") {
        var current_request = this.get_request_structure("current");
        return (current_request[key] || []).includes(col_name);
    }

    _can_change_dropdown() {
        if (this.AUTO_QUERY || !this._can_request_building()) {
            return true;
        }

        var current_request = this.get_request_structure("current");
        var current_side = this._get_side_from_request(current_request);
        var building_request = this.get_request_structure("building");
        var building_side = this._get_side_from_request(building_request);
        if (current_side == 0 && building_side == 0) {
            return true;
        } else if (current_side == 1 && building_side == 1) {
            var current_rpivots = current_request["row_pivots"];
            var building_rpivots = building_request["row_pivots"];
            if (current_rpivots.length == building_rpivots.length) {
                for (var i = 0; i < current_rpivots.length; i++) {
                    if (current_rpivots[i] != building_rpivots[i]) {
                        return false;
                    }
                }
                return true;
            }
        }
        return false;
    }

    _get_side_from_request(request) {
        if ((request["column_pivots"] || []).length > 0) {
            return 2;
        } else if ((request["row_pivots"] || []).length > 0) {
            return 1;
        } else {
            return 0;
        }
    }

    _get_existed_agg_level(name) {
        var agg_levels = [];
        var column_elems = this._get_view_dom_columns("#row_pivots perspective-row").concat(this._get_view_dom_columns("#column_pivots perspective-row"));
        column_elems.forEach(col => {
            if (col.getAttribute("name") === name) {
                var agg_level = col.getAttribute("agg_level");
                if (agg_level || agg_level !== "OFF") {
                    agg_levels.push(agg_level);
                } else {
                    agg_levels.push("OFF");
                }
            }
        });
        return agg_levels;
    }

    /**
     * Check valid tag name in active columns
     * case non-aggregation mode: always return true
     * case aggregation mode:
     * - true: if tag exist in "row_pivots", "column_pivots" or "value_pivots"
     * - false: other case
     * @param {} name
     */
    _valid_active_columns(name) {
        if (this.is_cinfo_pivot(false)) {
            // Check for row pivots
            var row_pivots = this._get_view_row_pivots();
            if (row_pivots.includes(name)) {
                return true;
            }

            // Check for column pivots
            var column_pivots = this._get_view_column_pivots();
            if (column_pivots.includes(name)) {
                return true;
            }

            // Check for value pivots
            var value_pivots = this._get_view_value_pivots();
            if (value_pivots.includes(name)) {
                return true;
            }

            // not valid for active columns
            return false;
        } else {
            return true;
        }
    }

    /**
     * Get valid active column list
     * case non-aggregation mode: get list from active area
     * case aggregation mode: get list if tag exist in "row_pivots", "column_pivots" or "value_pivots"
     */
    _valid_active_column_list() {
        if (this.is_cinfo_pivot(false)) {
            var row_pivots = this._get_view_row_pivots();
            var column_pivots = this._get_view_column_pivots();
            var value_pivots = this._get_view_value_pivots();
            var pivots = row_pivots.concat(column_pivots).concat(value_pivots).filter(x => x !== perspective.COMBINED_NAME);
            var valid_list = [];
            pivots.forEach(v => {
                if (!valid_list.includes(v)) {
                    valid_list.push(v);
                }
            });
            return valid_list;
        } else {
            return this._get_view_column_base_names();
        }
    }

    /**
     * Get list of suggestion values for quick sort filter
     * @param {*} name
     * @param {*} cb
     */
    _get_filter_datalist(name, agg_level = "OFF", binning = {type: "OFF"}, data_format = "none", search_term = "",  limit = 1000, cb = undefined) {
        if (name !== perspective.GROUP_FILTER_NAME) {
            if (binning && binning.type !== "OFF") {
                binning.is_double = this._check_is_double_for_binning(name);
            }
            this._view.create_suggestion_column(name, agg_level, binning, data_format, search_term, limit).then(result => {
                cb(result);
            });
        }
    }

    /**
     * get min, max, bin size of default binning
     * @param {*} name
     */
    _get_default_binning(name) {
        return this._view.get_default_binning(name);
    }

    /**
     *
     */
    _get_display_as_pivot_type() {
        let type = "none";
        if (this.is_row_pivot(false) && this.is_column_pivot(false)) {
            type = "row_col";
        } else if (this.is_row_pivot(false)) {
            type = "row";
        } else if (this.is_column_pivot(false)) {
            type = "col";
        }
        return type;
    }

    /**
     * can have previous for show type value
     * @param {*} col
     */
    _get_display_as_has_previous(col) {
        if (col.getAttribute("period") === "previous") {
            return false;
        }
        if (!this._visible_column_period()) {
            return false;
        }
        let colname = col.getAttribute("name");
        let aggregate = col.getAttribute("aggregate");
        let values_elems = this._get_view_dom_columns("#value_pivots perspective-row");
        for (let elem of values_elems) {
            if (elem.getAttribute("period") === "previous" && elem.getAttribute("name") === colname
                && elem.getAttribute("aggregate") === aggregate) {
                return true;
            }
        }
        return false;
    }

    /**
     * get disabled show types
     * @param {*} col
     */
    _get_display_as_disabled_list(col) {
        let disabled_list = [];
        let colname = col.getAttribute("name");
        let aggregate = col.getAttribute("aggregate");
        let values_elems = this._get_view_dom_columns("#value_pivots perspective-row");
        for (let elem of values_elems) {
            if (col !== elem && elem.getAttribute("name") === colname && elem.getAttribute("aggregate") === aggregate) {
                disabled_list.push(elem.getAttribute("show_type"));
            }
        }

        return disabled_list;
    }

    /**
     * get available show types
     * @param {*} col
     */
    _get_available_show_types(col, ignore_col = false) {
        let colname = col.getAttribute("name");
        let aggregate = col.getAttribute("aggregate");
        let type = col.getAttribute("type");
        let available_list = ["default"];
        if ((type === "float" || type === "integer" || perspective.STATISTIC_AGGREGATES.includes(aggregate))) {
            available_list = ["default", "running_total", "running_%", "%_of_row",
                "%_of_column", "%_of_grand_total"];
            let pivot_type = this._get_display_as_pivot_type();
            let have_previous = this._get_display_as_has_previous(col);

            if (pivot_type !== "none") {
                if (pivot_type === "col" || pivot_type === "row_col") {
                    available_list.push("%_of_parent_column");
                }
                if (pivot_type === "row" || pivot_type === "row_col") {
                    available_list.push("%_of_parent_row");
                }
            }

            if (have_previous) {
                available_list = available_list.concat(["diff_from_prev_value", "%_of_prev_value"]);
            }
        }

        let values_elems = this._get_view_dom_columns("#value_pivots perspective-row");
        for (let elem of values_elems) {
            if ((ignore_col || col !== elem) && elem.getAttribute("name") === colname && elem.getAttribute("aggregate") === aggregate) {
                const index = available_list.indexOf(elem.getAttribute("show_type") || "default");
                if (index > -1) {
                    available_list.splice(index, 1);
                }
            }
        }
        return available_list;
    }

    /**
     * Function to check current filter is empty or not
     * @param {*} filter
     */
    _check_empty_filter(filter) {
        if (!filter || filter === "null" || filter === "undefined") {
            return true;
        }

        if (filter.operator) {
            return false;
        }

        if (filter.search && filter.search !== "") {
            return false;
        }

        if ((filter.ignore_list && filter.ignore_list.length > 0)
            || (filter.selected_list && filter.selected_list.length > 0)) {
            return false;
        }

        if (filter.unselected_all === true) {
            return false;
        }

        return true;
    }

    /**
     * return warning section for row pivots, column pivots and value pivots
     */
    async get_warning_sections() {
        let warning_sections = [];

        if (this.is_cinfo_pivot(false)) {
            if (this._show_multiple_date_aggregate_warning) {
                this._show_multiple_date_aggregate_warning = false;
                warning_sections.push({
                    container: "row_pivots",
                    contains_warning: true,
                    title: "Warning",
                    msg: "When in flattened mode, you may only have one grouping per field. If you would like to see the complete date, turn the grouping 'Off'"
                });
            }
            let nb_of_cols = this._plugin.get_nb_cols.call(this);
            if (nb_of_cols && nb_of_cols >= perspective.MAX_COLS){
                warning_sections.push({
                    container: "column_pivots",
                    contains_warning: true,
                    title: "Warning",
                    msg: "This query has been limited to 2,000 columns." //"Limited to 2,000 columns."
                });
            }

            let truncated_columns = await this._view.get_truncated_columns();
            let truncated_type = 0;
            let truncated_cols = Object.keys(truncated_columns);
            for (let column in truncated_columns) {
                if (truncated_columns[column] === 1) {
                    if (truncated_type === 2 || truncated_type === 3) {
                        truncated_type = 3;
                        break;
                    } else {
                        truncated_type = 1;
                    }
                } else if (truncated_columns[column] === 2) {
                    if (truncated_type === 1 || truncated_type === 3) {
                        truncated_type = 3;
                        break;
                    } else {
                        truncated_type = 2;
                    }
                } else {
                    truncated_type = 3;
                    break;
                }
            }
            if (truncated_type > 0) {
                let msg = "";
                if (truncated_type === 1) {
                    msg = "Limited to 1,000 values for " + truncated_cols.join(", ") + ".";
                } else if (truncated_type === 2) {
                    msg = "Distinct values limit of 2MB data reached for " + truncated_cols.join(", ") + ".";
                } else {
                    msg = "Some values were truncated for " + truncated_cols.join(", ") + ".";
                }
                warning_sections.push({
                    container: "value_pivots",
                    contains_warning: true,
                    title: "Warning",
                    msg: msg
                });
            }
        }

        return warning_sections;
    }

    /**
     Query to get: Count, Sum, Avg

     Example:

     // SELECT ALL COLUMNS and ROWS - The user clicks on the most left corner to select all
     options = undefine or []

     // SELECTIONS
     options = [
       {
         end_col: 11,
         end_row: 26,
         start_col: 0,
         start_row: 0,
         index_map: {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11}
       },
     ]

     // SELECT A FEW COLUMNS
     options = [

      // Select the first colum (column #0)
       {
         end_col: 1,
         end_row: 20000,
         start_col: 0,
         start_row: 0,
         index_map: {0: 0, 1: 1}
       },

       // Select the column 10
       {
         end_col: 11,
         end_row: 20000,
         start_col: 10,
         start_row: 0,
         index_map: {10: 10, 11: 11}
       },
     ]
     */
    get_selection_summarize(options, cb) {
      /*
        options = options || {
            end_col: 11,
            end_row: 26,
            start_col: 0,
            start_row: 0,
            index_map: {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11}
        };
      */

      this._view.get_selection_summarize(options).then(result => {
          cb(result);
      });
    }

    /**
     * Check column name in row pivots or column pivots
     * @param {*} colname
     */
    _row_col_pivots_has_column(colname) {
        const row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
        let index = row_pivots.findIndex(p => p.n === colname);
        if (index === -1) {
            const column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
            index = column_pivots.findIndex(p => p.n === colname);
        }

        return index !== -1;
    }

    /**
     * get is_double value for case binning is on
     * @param {*} name
     */
    _check_is_double_for_binning(name) {
        var i_rows = this._pivotList.getInactiveCols(false);
        let is_double = false;
        let type;
        for (let row of i_rows) {
            if (row.getAttribute("name") === name) {
                type = row.getAttribute("type");
                break;
            }
        }
        switch (type) {
            case "date":
            case "list_date":
            case "integer":
            case "list_integer": {
                is_double = false;
            } break;

            case "float":
            case "list_float": {
                is_double = true;
            } break;

            default: {
                is_double = false;
            } break;
        }
        return is_double;
    }
}
