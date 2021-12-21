/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import _ from "lodash";

import perspective from "@jpmorganchase/perspective";
import {CancelTask} from "./cancel_task.js";
import {COMPUTATIONS} from "../computed_column.js";

import {StateElement} from "./state_element.js";
import {PivotList} from "../pivot_list.js";
/******************************************************************************
 *
 *  Helpers
 *
 */

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

let TYPE_ORDER = {integer: 2, string: 0, float: 3, boolean: 4, datetime: 1};

const column_sorter = schema => (a, b) => {
    const s1 = TYPE_ORDER[schema[a]];
    const s2 = TYPE_ORDER[schema[b]];
    let r = 0;
    if (s1 == s2) {
        r = a.toLowerCase() < b.toLowerCase() ? -1 : 1;
    } else {
        r = s1 < s2 ? -1 : 1;
    }
    return r;
};

function get_attributes_with_defaults(attributes, schema, cols) {
    const found = new Set();
    const rval_attributes = [];

    for (const col of attributes) {
        let type = schema[col.column];
        if (!type) {
            type = "integer";
        }

        found.add(col.column);
        if (type) {
            if (col.st === "" || perspective.TYPE_SEARCH_TYPES[type].indexOf(col.st) === -1) {
                col.st = perspective.SEARCH_TYPE_DEFAULTS[type];
            }
            if (col.df === "" || perspective.TYPE_DATA_FORMATS[type].indexOf(col.df) === -1) {
                col.df = perspective.DATA_FORMAT_DEFAULTS[type];
            }
            if (col.df === "" || perspective.TYPE_AGGREGATES[type].indexOf(col.agg) === -1) {
                col.agg = perspective.AGGREGATE_DEFAULTS[type];
            }
            rval_attributes.push(col);
        } else {
            console.warn(`No column "${col.column}" found (specified in aggregates attribute).`);
        }
    }

    // Add columns detected from dataset.
    for (const col of cols) {
        if (!found.has(col)) {
            rval_attributes.push({
                column: col,
                st: perspective.SEARCH_TYPE_DEFAULTS[schema[col]],
                df: perspective.DATA_FORMAT_DEFAULTS[schema[col]],
                agg: perspective.AGGREGATE_DEFAULTS[schema[col]]
            });
        }
    }

    return rval_attributes;
}

function calculate_throttle_timeout(render_time) {
    const view_count = document.getElementsByTagName("perspective-viewer").length;
    const timeout = render_time * view_count * 2;
    return Math.min(10000, Math.max(0, timeout));
}

/******************************************************************************
 *
 * PerspectiveElement
 *
 */

export class PerspectiveElement extends StateElement {
    _validate_parsed_computed_columns(computed_columns, computed_schema) {
        if (!computed_columns || computed_columns.length === 0) return [];

        const validated = [];
        for (const computed of computed_columns) {
            if (computed_schema[computed.column]) {
                validated.push(computed);
            }
        }
        return validated;
    }
    async _check_recreate_computed_columns() {
        // const computed_columns = JSON.parse(this.getAttribute("computed-columns"));
        // if (computed_columns.length > 0) {
        //     for (const col of computed_columns) {
        //         await this._create_computed_column({
        //             detail: {
        //                 column_name: col.name,
        //                 input_columns: col.inputs.map(x => ({name: x})),
        //                 computation: COMPUTATIONS[col.func]
        //             }
        //         });
        //     }
        //     this._debounce_update({ignore_size_check: false});
        //     return true;
        // }
        return false;
    }

    async _load_table(table, computed = false) {
        this.shadowRoot.querySelector("#app").classList.add("hide_message");
        const resolve = this._set_updating();

        if (this._table && !computed) {
            this.removeAttribute("computed-columns");
            this.removeAttribute("agg-custom");
        }

        this._clear_state();
        this._table = table;

        console.log('load table-------------');

        if (!this._computed_expression_parser.is_initialized) {
            const computed_functions = await table.get_computed_functions();
            console.log(
                computed_functions, '----get_computed_functions---'
            );
            this._computed_expression_parser.init(computed_functions);
            console.log(
                computed_functions, '--parser inited-----'
            );
        }

        if (this.hasAttribute("computed-columns") && !computed) {
            if (await this._check_recreate_computed_columns()) {
                return;
            }
        }

        const [cols, schema, longest_text_cols] = await Promise.all([table.columns(),
            table.schema(true), table.longest_text_cols()]);

        console.log("--longest_text_cols------", longest_text_cols);
        this._clear_columns();

        this._initial_col_order = cols.slice();
        this.c_info = [];
        this.pk = undefined;
        let updates_c_info_attributes = false;
        if (!this.hasAttribute("columns") || !this._first_load_grid_data) {
            this.setAttribute("columns", JSON.stringify(this._initial_col_order));

            var rownum_alias;
            if (this._initial_col_order.findIndex((v)=>v.toUpperCase() === "ROW") == -1){
                rownum_alias = "Row"
            }else if(this._initial_col_order.findIndex((v)=>v.toUpperCase() === "ROW #") == -1){
                rownum_alias = "Row #"
            }else if(this._initial_col_order.findIndex((v)=>v.toUpperCase() === "ROW NUMBER") == -1){
                rownum_alias = "Row number";
            }

            var count_alias;
            if (this._initial_col_order.findIndex((v)=>v.toUpperCase() === "COUNT") == -1){
                count_alias = "Count"
            }else if(this._initial_col_order.findIndex((v)=>v.toUpperCase() === "RECORD COUNT") == -1){
                count_alias = "Record count"
            }

            var dname_mapping = {};
            var c_info = [];
            this._initial_col_order.forEach((c, i) => {
                /*c_info.push({"name": c, "index": i, "original_index": i,
                    "dname": c, "active": true, "default_width": null, "user_width": null,
                    "text": longest_text_cols[c], "type": schema[c] });*/
                var dname = c;
                var active = true;
                if (c === "__rownum__"){
                    active = false;
                    dname = rownum_alias || dname;
                    dname_mapping[c] = dname;
                }

                if (c === "__count__"){
                    active = false;
                    dname = count_alias || dname;
                    dname_mapping[c] = dname;
                }
                c_info.push(this._build_cinfo_item(c, i, i, dname, active, null, null, longest_text_cols[c], schema[c]));
            });
            dname_mapping[perspective.COMBINED_NAME] = perspective.COMBINED_ALIAS_NAME;
            let dname_pivots = JSON.parse(this.getAttribute("dname-pivots")) || {};
            dname_pivots[perspective.COMBINED_NAME] = perspective.COMBINED_ALIAS_NAME;
            this.setAttribute("dname-pivots", JSON.stringify(dname_pivots));
            this.c_info = c_info;
            this.column_width_cache = [];
            this.column_width_cache_pivot = [];

            updates_c_info_attributes = true;

            if (!this.is_cinfo_pivot(false)){
              this._table.set_dname_mappings(dname_mapping);
              this._checkall_fields.checked = true;
            }

            // Hard code pk id
            if (this._initial_col_order.includes("__rownum__")){
                this.pk = "__rownum__";
            }

            //this.load_auto_query_options();
            this.load_max_col_options();
            this.load_max_row_options();
            //this.load_pivot_view_options();
            this.load_page_item_options();
        }

        cols.sort(column_sorter(schema));

        // // Update aggregates
        // const computed_aggregates = Object.entries(computed_schema).map(([column, op]) => ({
        //     column,
        //     op: op.op
        // }));

        // // Update search types
        // const computed_search_types = Object.entries(computed_schema).map(([column, type]) => ({
        //     column,
        //     search_type: type.type
        // }));

        // // Update data formats
        // const computed_data_formats = Object.entries(computed_schema).map(([column, format]) => ({
        //     column,
        //     data_format: format.format
        // }));

        const all_cols = cols;

        // Default search type, data format
        if (updates_c_info_attributes === true){
            let previous_c_info_attribute = [];
            this.c_info.forEach(info => {
                let attr = {"column": info.name, "st": info.search_type, "df": info.data_format};
                if (info.sort) {
                    attr["sort_order"] = info.sort_order;
                    attr["sort_num"] = info.sort_num;
                }
                previous_c_info_attribute.push(attr);
            });
            // let computed_df_map = {};
            // for (let col of computed_data_formats) {
            //     computed_df_map[col.column] = col.data_format;
            // }
            // let aggregate_map = {};
            // for (let col of computed_aggregates) {
            //     aggregate_map[col.column] = col.op;
            // }
            // for (let col of computed_search_types) {
            //     previous_c_info_attribute.push({"column": col.column, "st": col.search_type,
            //         "df": computed_df_map[col.column], "agg": aggregate_map[col.column]});
            // }

            console.log('------previous_c_info_attribute--------',previous_c_info_attribute, schema, all_cols);
            const update_c_info_attribute = get_attributes_with_defaults(previous_c_info_attribute, schema, all_cols);
            for (let attr of update_c_info_attribute){
                const c_index = this.c_info.findIndex((v)=>v.name === attr.column);
                if (c_index !== -1){
                    this.c_info[c_index].default_search_type = attr.st;
                    this.c_info[c_index].search_type = attr.st;
                    this.c_info[c_index].sort_order = attr.sort_order;
                    this.c_info[c_index].sort_num = attr.sort_num;
                    this.c_info[c_index].default_data_format = attr.df;
                    this.c_info[c_index].data_format = attr.df;
                    this.c_info[c_index].default_aggregate = attr.agg;
                    this.c_info[c_index].aggregate = attr.agg;
                }
            }
        }

        let shown = JSON.parse(this.getAttribute("columns")).filter(x => all_cols.indexOf(x) > -1);
        if (shown.length === 0) {
            shown = this._initial_col_order;
        }

        if (!this.is_cinfo_pivot()){
            if (shown && shown.length > 0 ){

                var inactive_rn = this.c_info.findIndex((v)=>v.name === "__rownum__" && !v.active);

                if (inactive_rn != -1){
                    var i_rn = shown.indexOf("__rownum__");
                    if (i_rn != -1){
                      shown.splice(i_rn, 1);
                    }
                }

                var inactive_count = this.c_info.findIndex((v)=>v.name === "__count__" && !v.active);

                if (inactive_count != -1){
                    var i_count = shown.indexOf("__count__");
                    if (i_count != -1){
                      shown.splice(i_count, 1);
                    }
                }
            }
        }

        this._inactive_columns_frag = []; //document.createDocumentFragment();
        for (const name of all_cols) {
            const row = this._new_row(name, schema[name], null, null, null, null, null, "inactive_columns");
            this._inactive_columns_frag.push(row);
            if (shown.includes(name)) {
                row.classList.add("active");
            }
        }

        this._active_columns_frag = []; //document.createDocumentFragment();
        for (const x of shown) {
            const active_row = this._new_row(x, schema[x], undefined, undefined, undefined, undefined, undefined, "active_columns", {});
            this._active_columns_frag.push(active_row);
        }

        // integrate hyperlist component to the project
        if (!this._pivotList) {
            this._pivotList = new PivotList(this);
        }
        this._pivotList.init();

        if (all_cols.length === shown.length) {
            this._pivotList.addClass("collapse");
        } else {
            this._pivotList.removeClass("collapse");
        }

        this._show_column_selectors();

        this.filters = this.getAttribute("filters");
        this.searchs = this.getAttribute("searchs");

        await this._run_query(true);
        resolve();
    }

    _build_cinfo_item(name, index, original_index, dname, active, default_width, user_width,
            longest_text, type, is_search_selected, default_search_type, search_type, sort_order, sort_num,
            default_data_format, data_format, default_aggregate, aggregate, computed_expression){
        return {
                "name": name, "index": index, "original_index": original_index,
                "dname": dname, "active": active, "default_width": default_width,
                "user_width": user_width, "text": longest_text, "type": type, "is_search_selected": is_search_selected,
                "default_search_type": default_search_type, "search_type": search_type, "sort_order": sort_order,
                "sort_num": sort_num, "default_data_format": default_data_format, "data_format": data_format,
                "default_aggregate": default_aggregate, "aggregate": aggregate, "computed_expression": computed_expression};
    }

    async _warn_render_size_exceeded() {
        if (this._show_warnings && typeof this._plugin.max_size !== "undefined") {
            const num_columns = await this._view.num_columns();
            const num_rows = await this._view.num_rows();
            const count = num_columns * num_rows;
            if (count >= this._plugin.max_size) {
                this._plugin_information.classList.remove("hidden");
                const over_per = Math.floor((count / this._plugin.max_size) * 100) - 100;
                const warning = `Rendering estimated ${numberWithCommas(count)} (+${numberWithCommas(over_per)}%) points.  `;
                this._plugin_information_message.innerText = warning;
                this.removeAttribute("updating");
                return true;
            } else {
                this._plugin_information.classList.add("hidden");
            }
        }
        return false;
    }

    _view_on_update(time_out) {
        if (!this._debounced) {
            this._debounced = setTimeout(async () => {
                this._debounced = undefined;
                const timer = this._render_time();
                if (this._task && !this._task.initial) {
                    this._task.cancel();
                }
                const task = (this._task = new CancelTask());
                const updater = this._plugin.update || this._plugin.create;
                try {
                    await updater.call(this, this._datavis, this._view, task);
                    timer();
                    task.cancel();
                } catch (err) {
                    console.error("Error rendering plugin.", err);
                } finally {
                    this.dispatchEvent(new Event("perspective-view-update"));
                }
            }, time_out || calculate_throttle_timeout(this.getAttribute("render_time")));
        }
    }

    async _validate_filters() {
        const filters = [];
        let _is_pivot = this.is_cinfo_pivot(false);
        let row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
        let column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
        for (const node of this._get_view_filter_nodes()) {
            let name = node.getAttribute("name");
            if (name === perspective.__FILTER_SEARCH__) {
                continue;
            }
            const operandNode = node.shadowRoot.getElementById("filter_operand");
            const exclamation = node.shadowRoot.getElementById("row_exclamation");
            const {operator, operand, filter_by, subtotal, ignore_list, selected_list, unselected_all, group_filter} = JSON.parse(node.getAttribute("filter"));
            let filter = [name, operator, operand, _is_pivot ? filter_by : null, _is_pivot ? subtotal : null];
            if (operator === "relative date" && operand && perspective.RELATIVE_DATE_PERIOD_THIS.includes(operand[0])) {
                filter[1] = operand[0];
            } else if (operator === "in" || operator === "not in") {
                if (operand && operand.length > 0) {
                    filter[2] = operand.map(x => {
                        if (x.length > 0) {
                            if (x[0] === '"' || x[0] === '\'') {
                                x = x.substring(1, x.length - 1);
                            }
                            if (x[x.length - 1] === '"' || x[x.length - 1] === '\'') {
                                x = x.substring(0, x.length - 1);
                            }
                        }
                        return x;
                    });
                }
            }
            filter[6] = "OFF";
            filter[7] = null;
            if (name === perspective.GROUP_FILTER_NAME) {
                filter[1] = "group filter";
                filter[2] = undefined;
                let dependencies = [];
                for (let cname in group_filter) {
                    const gf = group_filter[cname];
                    if (gf.filters && gf.filters.length > 0) {
                        for (let subf_arr of gf.filters) {
                            let sub_filters = [];
                            for (let subf of subf_arr) {
                                let sub_agg_level = "OFF";
                                let sub_binning_info =  {type: "OFF"};
                                let index = row_pivots.findIndex(f => f.n === subf.n);
                                if (index !== -1) {
                                    sub_agg_level = row_pivots[index].agg_l;
                                    sub_binning_info = (row_pivots[index].b) ? JSON.parse(row_pivots[index].b) : {type: "OFF"};
                                } else {
                                    index = column_pivots.findIndex(f => f.n === subf.n);
                                    if (index !== -1) {
                                        sub_agg_level = column_pivots[index].agg_l;
                                        sub_binning_info = (column_pivots[index].b) ? JSON.parse(column_pivots[index].b) : {type: "OFF"};
                                    }
                                }
                                if (sub_binning_info && sub_binning_info.type !== "OFF") {
                                    sub_binning_info.is_double = this._check_is_double_for_binning(subf.n);
                                }
                                sub_filters.push([subf.n, "not in", subf.ignore_list, null, null, undefined, sub_agg_level, sub_binning_info]);
                            }
                            if (sub_filters.length > 0) {
                                dependencies.push(sub_filters);
                            }
                        }
                    }
                }
                if (dependencies.length > 0) {
                    filter[2] = dependencies;
                }
            }
            if ((name === perspective.GROUP_FILTER_NAME && group_filter && group_filter.length > 0)
                || ((await this._table.is_valid_filter(filter)) && (operand !== "" || await this._table.is_one_side_operator(operator)))) {
                filters.push(filter);
                node.title = "";
                operandNode.style.borderColor = "";
                exclamation.hidden = true;
            } else {
                node.title = "Invalid Filter";
                operandNode.style.borderColor = "red";
                exclamation.hidden = false;
            }

            let agg_level = "OFF";
            let binning_info = {type: "OFF"};
            let index = row_pivots.findIndex(f => f.n === name);
            if (index !== -1) {
                agg_level = row_pivots[index].agg_l;
                binning_info = (row_pivots[index].b) ? JSON.parse(row_pivots[index].b) : {type: "OFF"};
            } else {
                index = column_pivots.findIndex(f => f.n === name);
                if (index !== -1) {
                    agg_level = column_pivots[index].agg_l;
                    binning_info = (column_pivots[index].b) ? JSON.parse(column_pivots[index].b) : {type: "OFF"};
                }
            }
            if (binning_info && binning_info.type !== "OFF") {
                binning_info.is_double = this._check_is_double_for_binning(name);
            }
            if (unselected_all === true){
                filters.push([name, "ignore all"]);
            }else if(selected_list && selected_list.length > 0){
                const f_selected_list = selected_list.map(item => (item !== null && item !== undefined) ? item.toString() : "");
                let selected_filter = [name, "in", f_selected_list];
                selected_filter[6] = agg_level;
                selected_filter[7] = binning_info;
                filters.push(selected_filter);
            }else if(ignore_list && ignore_list.length > 0){
                const f_ignore_list = ignore_list.map(item => (item !== null && item !== undefined) ? item.toString() : "");
                let ignore_filter = [name, "not in", f_ignore_list];
                ignore_filter[6] = agg_level;
                ignore_filter[7] = binning_info;
                filters.push(ignore_filter);
            }
        }

        return filters;
    }

    async _validate_havings() {
        const havings = [];
        for (const node of this._get_view_having_nodes()) {
            const operandNode = node.shadowRoot.getElementById("having_operand");
            const exclamation = node.shadowRoot.getElementById("row_exclamation");
            const {operator, operand, aggregate, level} = JSON.parse(node.getAttribute("having"));
            const having = [this._get_disp_name_aggregate(node.getAttribute("name"), aggregate, node.getAttribute("period"), this._get_column_show_type(node)), operator, operand, level, node.getAttribute("name"), aggregate];
            if ((await this._table.is_valid_having(having)) && operand !== "") {
                havings.push(having);
                node.title = "";
                operandNode.style.borderColor = "";
                exclamation.hidden = true;
            } else {
                node.title = "Invalid Having";
                operandNode.style.borderColor = "red";
                exclamation.hidden = false;
            }
        }

        return havings;
    }

    clear_column_width_cache(current = false){
        if (this.is_cinfo_pivot(current)) {
            this._clear_column_width_cache_pivot();
        }else{
            this._clear_column_width_cache_default();
        }
    }

    _clear_column_width_cache_default(){
        this.column_width_cache = [];
    }

    _clear_column_width_cache_pivot(){
        this.column_width_cache_pivot = [];
    }

    // Get list default widths from cache
    get_column_width_cache(current = true){
        if (this.is_cinfo_pivot(current)) {
            return this._get_column_width_cache_pivot();
        }else{
            return this._get_column_width_cache_default();
        }
    }

    _get_column_width_cache_default(){
        return this.column_width_cache;
    }

    _get_column_width_cache_pivot(){
        return this.column_width_cache_pivot;
    }

    // Get default width by column name
    get_column_width_cache_by_id(id, current = false){
        if (this.is_cinfo_pivot(current)) {
            return this.column_width_cache_pivot[id];
        }else{
            return this.column_width_cache[id];
        }
    }

    init_column_width_cache(current = true){
        var c_info = this.get_cinfo(current) || [];
        if (this.is_cinfo_pivot(current)) {
            this._init_column_width_cache_pivot(current);
        }else{
            this._init_column_width_cache_default(current);
        }
    }

    // init default widths for all columns
    _init_column_width_cache_default(current = true){
        var c_info = this.get_cinfo(current) || [];
        if (!this.is_cinfo_pivot(current)) {
            this.column_width_cache = [];
            c_info.forEach((v, i)=>{
                this.column_width_cache[v.name] = {default_width: v.default_width, user_width: v.user_width};
            });
        }
    }

    // init default widths for all columns
    _init_column_width_cache_pivot(current = true){
        var c_info = this.get_cinfo(current) || [];
        if (this.is_cinfo_pivot(current)) {
            this.column_width_cache_pivot = [];
            c_info.forEach((v, i)=>{
                this.column_width_cache_pivot[v.name] = {default_width: v.default_width, user_width: v.user_width};
            });
        }
    }

    update_column_width_cache(c_name, default_width, user_width, current = true){
        if (!c_name){
            return;
        }
        if (this.is_cinfo_pivot(current)) {
            this._update_column_width_cache_pivot(c_name, default_width, user_width);
        }else{
            this._update_column_width_cache_default(c_name, default_width, user_width);
        }
    }

    _update_column_width_cache_default(c_name, default_width, user_width, user_changes_width = false){
      let old_value = undefined;
      if (this.column_width_cache[c_name]){
        old_value = {
            default_width: this.column_width_cache[c_name].default_width,
            user_width: this.column_width_cache[c_name].user_width
        };
        this.column_width_cache[c_name].default_width = default_width;
        this.column_width_cache[c_name].user_width = user_width;
      }else{
        this.column_width_cache[c_name] = {default_width: default_width, user_width: user_width};
      }
      let options = {
        columns: [{
          c_name: c_name,
          old_value: old_value,
          new_value: {default_width: default_width, user_width: user_width}
        }],
        pivot: false
      };

      // Handle undo/redo. Need to use _.debounce 400
      if (user_changes_width === true){
        this._handle_manage_action(perspective.ACTION_TYPE.change_column_width, undefined, options,
            _ => {
                if (this._plugin.notify_column_widths) {
                    this._plugin.notify_column_widths.call(this, this._get_column_width_cache_default());
                }
            },
            _ => {
                if (this._plugin.notify_column_widths) {
                    this._plugin.notify_column_widths.call(this, this._get_column_width_cache_default());
                }
            });
      }
    }

    /*
    arr_col_width = [
      {original_name: "Header", index: 1, user_width: 250, default_width: 102},
      {original_name: "HeaderA", index: 2, user_width: 500, default_width: 102},
      {original_name: undefined, index: 3, user_width: 500, default_width: 102},
    ]
    */
    _update_multiple_column_width_cache_default(arr_col_width, user_changes_width = false){

      if (!arr_col_width || arr_col_width.length === 0){
        return;
      }

      let arr_cols = [];
      for (let i = 0; i < arr_col_width.length; i++){
        if (!arr_col_width[i].original_name){
          continue;
        }

        let c_name = arr_col_width[i].original_name;
        let default_width = arr_col_width[i].user_width;
        let user_width = arr_col_width[i].user_width;

        let old_value;
        if (this.column_width_cache[c_name]){
          old_value = {
              default_width: this.column_width_cache[c_name].default_width,
              user_width: this.column_width_cache[c_name].user_width
          };
          this.column_width_cache[c_name].default_width = default_width;
          this.column_width_cache[c_name].user_width = user_width;
        }else{
          this.column_width_cache[c_name] = {default_width: default_width, user_width: user_width};
        }

        arr_cols.push({
          c_name: c_name,
          old_value: old_value,
          new_value: {default_width: default_width, user_width: user_width}
        });
      }

      if (arr_cols.length === 0){
        return;
      }

      let options = {
        columns: arr_cols,
        pivot: false
      };

      // Undo/redo
      if (user_changes_width === true){
        this._handle_manage_action(perspective.ACTION_TYPE.change_column_width, undefined, options,
            _ => {
                if (this._plugin.notify_column_widths) {
                    this._plugin.notify_column_widths.call(this, this._get_column_width_cache_default());
                }
            },
            _ => {
                if (this._plugin.notify_column_widths) {
                    this._plugin.notify_column_widths.call(this, this._get_column_width_cache_default());
                }
            });
      }
    }

    _update_column_width_cache_pivot(c_name, default_width, user_width, user_changes_width = false){
      let old_value = undefined;
      if (this.column_width_cache_pivot[c_name]){
        old_value = {
            default_width: this.column_width_cache_pivot[c_name].default_width,
            user_width: this.column_width_cache_pivot[c_name].user_width
        };
        this.column_width_cache_pivot[c_name].default_width = default_width;
        this.column_width_cache_pivot[c_name].user_width = user_width;
      }else{
        this.column_width_cache_pivot[c_name] = {default_width: default_width, user_width: user_width};
      }

      let options = {
        columns: [{
            c_name: c_name,
            old_value: old_value,
            new_value: {default_width: default_width, user_width: user_width}
        }],
        pivot: true
      };

      // Handle undo/redo. Need to use _.debounce 400
      if (user_changes_width === true){
        this._handle_manage_action(perspective.ACTION_TYPE.change_column_width, undefined, options,
            _ => {
                if (this._plugin.notify_column_widths) {
                    this._plugin.notify_column_widths.call(this, this._get_column_width_cache_pivot());
                }
            },
            _ => {
                if (this._plugin.notify_column_widths) {
                    this._plugin.notify_column_widths.call(this, this._get_column_width_cache_pivot());
                }
            });
      }
    }

    _update_multiple_column_width_cache_pivot(arr_col_width, user_changes_width = false){

      if (!arr_col_width || arr_col_width.length === 0){
        return;
      }

      let arr_cols = [];
      for (let i = 0; i < arr_col_width.length; i++){
        if (!arr_col_width[i].original_name){
          continue;
        }

        let c_name = arr_col_width[i].original_name;
        let default_width = arr_col_width[i].user_width;
        let user_width = arr_col_width[i].user_width;

        let old_value;
        if (this.column_width_cache_pivot[c_name]){
          old_value = {
              default_width: this.column_width_cache_pivot[c_name].default_width,
              user_width: this.column_width_cache_pivot[c_name].user_width
          };
          this.column_width_cache_pivot[c_name].default_width = default_width;
          this.column_width_cache_pivot[c_name].user_width = user_width;
        }else{
          this.column_width_cache_pivot[c_name] = {default_width: default_width, user_width: user_width};
        }

        arr_cols.push({
          c_name: c_name,
          old_value: old_value,
          new_value: {default_width: default_width, user_width: user_width}
        });
      }

      if (arr_cols.length === 0){
        return;
      }

      let options = {
        columns: arr_cols,
        pivot: true
      };

      // Undo/redo
      if (user_changes_width === true){
        this._handle_manage_action(perspective.ACTION_TYPE.change_column_width, undefined, options,
            _ => {
                if (this._plugin.notify_column_widths) {
                    this._plugin.notify_column_widths.call(this, this._get_column_width_cache_pivot());
                }
            },
            _ => {
                if (this._plugin.notify_column_widths) {
                    this._plugin.notify_column_widths.call(this, this._get_column_width_cache_pivot());
                }
            });
      }
    }

    // Update alias to cinfo in case non-aggregation
    update_column_alias(c_name, c_alias){
      if (!c_alias || c_alias.trim() == ""){
        return;
      }

      if (!this.is_cinfo_pivot()){
        const i = this.c_info.findIndex(function(v){
            return v.name == c_name;
        });

        if (i != -1){
          this.c_info[i].dname = c_alias;
        }
      }
    }

    is_cinfo_pivot(current = false){
        if (this.is_row_pivot(current) || this.is_column_pivot(current) || this.is_value_pivot(current)) {
            return true;
        }

        return false;
    }

    is_cinfo_search(current = false){
        if (!this.is_cinfo_pivot(current) && this.contains_searchs(current)){
            return true;
        }
        return false;
    }

    is_cinfo_default(current = true){
        if (!this.is_cinfo_pivot(current) && !this.is_cinfo_search(current)){
            return true;
        }
        return false;
    }

    sync_cinfo_dname(name, new_dname, current = false){
      var c_info = this.get_cinfo(current);
      if (!c_info) {
          return;
      }
      var c_i = c_info.findIndex((item)=> {return item.name === name});
      if (c_i != -1){
          c_info[c_i].dname = new_dname;
          this.set_cinfo(c_info, current);
      }
    }

    // Get the columns that will apply for search
    get_the_search_column_selections(){
      return (this.c_info || []).filter((v)=>v.is_search_selected === true).map((m)=>m.name);
    }

    get_default_cinfo(){
      return this.c_info;
    }

    get_cinfo(current = true){
        if (this.is_cinfo_pivot(current)) {
            return this.c_info_pivot;
        }else if(this.is_cinfo_search(current)){
            return this.c_info_search || [];
        }else{
            return this.c_info;
        }
    }

    set_cinfo(c_info, current = false){
        // Force to set c_info
        //this.c_info = c_info;
        //return;
        if (this.is_cinfo_pivot(current)) {
            this.c_info_pivot = c_info;
        }else if(this.is_cinfo_search(current)){

            // Sync active/inactive columns between default and search
            var u_c_info = this.c_info;
            var update_c_info = u_c_info.map(function(item){
                const i = c_info.findIndex(function(v){
                    return v.name == item.name;
                });

                if (i == -1){
                    item.active = false;
                }else{
                    //item.index = c_info[i].index;
                    item.active = c_info[i].active;
                }

                return item;
            });

            this.c_info_search = c_info;
            this.c_info = update_c_info;
        }else{
            this.c_info = c_info;
        }
    }

    get_pk_index(){
      var c_index = -1;
      var pk = this.pk;

      if (!pk){
        return c_index;
      }

      if (!this.is_cinfo_pivot()){
        const i = this.c_info.findIndex(function(v){
            return v.name == pk;
        });

        if (i != -1){
          c_index = this.c_info[i].original_index;
        }
      }

      return c_index;
    }

    set_request_structure(key, request_struct) {
        this.REQUEST_STRUCTURE[key] = {...request_struct};
    }

    get_request_structure(key) {
        return this.REQUEST_STRUCTURE[key] || {};
    }

    update_current_request_structure_columns(old_col, new_col) {
        let current_request = this.get_request_structure("current");
        if (current_request && current_request["columns"]) {
            current_request["columns"] = current_request["columns"].map(col => col === old_col ? new_col : col);
            this.set_request_structure("current", current_request);
        }
    }

    contains_searchs(current = true){
        if (current) {
            var current_request = this.get_request_structure("current");
            return (current_request.search && current_request.search.text && current_request.search.text !== "");
        } else {
            const searchs = this._validate_searchs();
            if (searchs && searchs.text && searchs.text !== ""){
                return true;
            }
            return false;
        }
    }

    _validate_searchs() {
        let searchs = null;
        const view_searchs = this.getAttribute("searchs");
        if (view_searchs && view_searchs !== "") {
            searchs = {
                text: view_searchs,
                columns: this.get_the_search_column_selections(),
                unselected_all: this._site_search_obj.unselected_all
            };
        }

        return searchs;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async _new_view(ignore_size_check = false) {
        if (!this._table) return;
        this._check_responsive_layout();

        while(this.create_new_view) {
            await this.sleep(1);
        }
        this.create_new_view = true;
        if (this._view) {
            if (this.memory_pressure) {
                console.debug("deleting the view due to memory pressure")
                this._view.delete();
                this._view.remove_update(this._view_updater);
                this._view.remove_delete();
                this._view = undefined;
            }
            else {
                this._prev_view = this._view;
            }
        }
        if (this._first_load_grid_data) {
            // Begin start running query
            this.handle_status_bar_text("running_query");
            if (this._first_create_view_data) {
                this._begin_query_time = new Date().getTime();
            } else {
                this._first_create_view_data = true;
            }
        }
        var request_structure = await this._build_request_structure();
        console.log('------------table view config-----------', request_structure);
        this._view = this._table.view(request_structure, this.queryingPercentage.bind(this), this.didQueryProgress.bind(this),
        async data => {
            if (!data.success) {
                this.create_new_view = false;
                this.didQueryProgress(false);
                if (this._first_load_grid_data) {
                    this._view.num_rows().then(nrows => {
                        // Query running success
                        this.handle_status_bar_text("query_successed", {
                            time: (new Date().getTime() - this._begin_query_time)/1000,
                            nrows: nrows
                        });
                    });
                }
                return;
            }
            if (this._prev_view) {
                  this._prev_view.delete();
                  this._prev_view.remove_update(this._view_updater);
                  this._prev_view.remove_delete();
                  this._prev_view = null;
            }
            this.create_new_view = false;
            this.set_request_structure("current", request_structure);
            this.set_request_structure("building", {});
            this._update_run_query_button(false);
            this._update_redo_undo_button();
            
            // Update subtotal list for column pivot
            if (this.is_column_pivot(false) && this.is_row_pivot(false)) {
                this._view.subtotal_list().then(value => {
                    this.SUB_TOTAL_LIST = value;
                    this._update_sort_filter_elements.call(this);
                });
            } else if (this.is_cinfo_pivot(false)) {
                this.SUB_TOTAL_LIST = [];
                this._update_sort_filter_elements.call(this);
            } else {
                this.SUB_TOTAL_LIST = [];
            }

            if (!ignore_size_check) {
                if (await this._warn_render_size_exceeded()) {
                    return;
                }
            }

            this._view_updater = () => this._view_on_update();
            this._view.on_update(this._view_updater);

            const timer = this._render_time();
            this._render_count = (this._render_count || 0) + 1;
            if (this._task) {
                this._task.cancel();
            }

            const task = (this._task = new CancelTask(() => this._render_count--, true));

            var cpp_time = new Date().getTime();
            try {
                await this._plugin.create.call(this, this._datavis, this._view, task);
                this.show_warning_sections();
            } catch (err) {
                console.warn(err);
            } finally {
                if (!this.hasAttribute("render_time")) {
                    this.dispatchEvent(new Event("perspective-view-update"));
                }
                timer();
                task.cancel();
                if (this._render_count === 0) {
                    this.removeAttribute("updating");
                    this.dispatchEvent(new Event("perspective-update-complete"));
                }

                if (this._first_load_grid_data) {
                    this._view.num_rows().then(nrows => {
                        // Query running success
                        var query_complete_time = new Date().getTime();
                        this.handle_status_bar_text("query_successed", {
                            time: (query_complete_time - this._begin_query_time)/1000,
                            nrows: nrows
                        });
                        console.log("Running query time " + ((query_complete_time - this._begin_query_time)/1000) + "s total (Part 1: "
                            + ((cpp_time - this._begin_query_time)/1000) + "s c++, Part 2: " + ((query_complete_time - cpp_time)/1000)
                            + "s load grid)");
                    });
                }
                this.didQueryProgress(false);
            }
        }, error => {
            this.create_new_view = false;
            if (error == 3) {
                if (this._first_load_grid_data) {
                    // Query running error
                    this.handle_status_bar_text("query_cancelled", {
                        time: (new Date().getTime() - this._begin_query_time)/1000
                    });
                }
                this.didQueryProgress(false);
                this._cancel_query_highlight();
                setTimeout(this._cancel_query_unhighlight.bind(this), 1000);
                this._view = this._prev_view;
            } else if (this._first_load_grid_data) {
                // Query running error
                this.handle_status_bar_text("query_error");
            }
        });
    }

    _render_time() {
        const t = performance.now();
        return () => this.setAttribute("render_time", performance.now() - t);
    }

    _clear_state(clear_table = true) {
        if (this._task) {
            this._task.cancel();
        }
        const all = [];
        if (this._view) {
            const view = this._view;
            this._view = undefined;
            all.push(view.delete());
            view.remove_update(this._view_updater);
            view.remove_delete();
        }
        if (this._table && clear_table) {
            const table = this._table;
            this._table = undefined;
            if (table._owner_viewer && table._owner_viewer === this) {
                all.push(table.delete());
            }
        }
        return Promise.all(all);
    }

    _set_updating() {
        this.setAttribute("updating", true);
        let resolve;
        this._updating_promise = new Promise(_resolve => {
            resolve = _resolve;
        });
        return resolve;
    }

    // setup for update
    _register_debounce_instance() {
        const _update = _.debounce((resolve, ignore_size_check) => {
            this._new_view(ignore_size_check).then(resolve);
        }, 0);
        this._debounce_update = async ({ignore_size_check = false} = {}) => {
            if (this._table) {
                let resolve = this._set_updating();
                await new Promise(resolve => _update(resolve, ignore_size_check));
                resolve();
            }
        };
    }

    _get_worker() {
        if (this._table) {
            return this._table._worker;
        }
        return perspective.shared_worker();
    }
}
