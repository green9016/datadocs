/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import perspective from "@jpmorganchase/perspective";
import {undrag} from "./dragdrop.js";
import {renderers} from "./renderers.js";

import {PerspectiveElement} from "./perspective_element.js";
import { PivotList } from "../pivot_list.js";
export class DomElement extends PerspectiveElement {
    _clear_columns() {
        this._pivotList.clear();
    }

    set_aggregate_attribute(aggs) {
        let is_set = false;
        let aggregates = aggs.reduce((obj, agg) => {
            if (this._aggregate_defaults[agg.column] !== agg.op) {
                obj[agg.column] = agg.op;
                is_set = true;
            }
            return obj;
        }, {});
        if (is_set) {
            this.setAttribute("aggregates", JSON.stringify(aggregates));
        } else {
            this.removeAttribute("aggregates");
        }
    }

    _get_type(name) {
        let all = this._get_view_inactive_columns();
        if (all.length > 0) {
            const type = all.find(x => x.getAttribute("name") === name);
            if (type) {
                return type.getAttribute("type");
            }
            else {
                return "integer";
            }
        }
        else {
            return "";
        }
    }

    _get_row(container, name, drag_id){
      var row = undefined;

      var prows = [];
      if (container === "row_pivots"){
          prows = this._row_pivots.getElementsByTagName("perspective-row");
      }else if(container === "column_pivots"){
          prows = this._column_pivots.getElementsByTagName("perspective-row");
      }else if(container === "value_pivots"){
          prows = this._value_pivots.getElementsByTagName("perspective-row");
      }else if(container === "active_columns") {
        prows = this._pivotList.getActiveCols();
      }else if(container === "filters"){
          prows = this._filters.getElementsByTagName("perspective-row");
      }

      var index = Array.prototype.slice.call(prows).findIndex((v)=>v.getAttribute("name").toUpperCase() === name.toUpperCase() && v.getAttribute("drag_id") === drag_id);
      if (index != -1){
        row = prows[index];
      }

      return row;
    }

    _generage_drag_id(){
      // Just make sure that it's always string
      return "d" + Math.random();
    }

    // Generates a new row in state + DOM
    // This can save up to 1 second.
    _new_row(name, type, aggregate, data_format, filter, sort, computed, container, options = {}) {

        let row = document.createElement("perspective-row");
        options = options || {};
        var agg_level = options.agg_l;
        var drag_id = options.drag_id;
        data_format = data_format || options.df;
        var show_type = options.st;
        var prev_value = options.p;
        var binning = options.b;
        var subtotals = options.subtotals;
        var sort_by = options.sort_by;
        var sort_order = options.sort_o;
        var sort_sub = options.sort_sub;
        var limit = options.limit;
        var limit_type = options.limit_t;

        if (!filter && (container === "active_columns" || container === "row_pivots" || container === "column_pivots")) {
            let filters = JSON.parse(this.getAttribute("filters")) || [];
            for (let f of filters) {
                if (f.n === name) {
                    filter = {...f};
                    filter.n = undefined;
                    filter = JSON.stringify(filter);
                    break;
                }
            }
        }
        if (!type) {
            let all = this._get_view_dom_columns("#inactive_columns perspective-row");
            if (all.length > 0) {
                type = all.find(x => x.getAttribute("name") === name);
                if (type) {
                    type = type.getAttribute("type");
                } else if (name === perspective.COMBINED_NAME && (container == "row_pivots" || container == "column_pivots")) {
                    type = perspective.COMBINED_TYPE_STR;
                } else {
                    type = "integer";
                }
            } else {
                type = "";
            }
        }

        if (!aggregate) {
            if (this.c_info) {
                let info = this.c_info.find(x => x.name === name);
                if (info) {
                    aggregate = info.aggregate;
                } else {
                    aggregate = perspective.AGGREGATE_DEFAULTS[type];
                    if (name === "__rownum__") {
                        aggregate = "count";
                    }
                }
            } else {
                aggregate = perspective.AGGREGATE_DEFAULTS[type];
                if (name === "__rownum__") {
                    aggregate = "count";
                }
            }
        }

        if (!data_format) {
            if (this.c_info) {
                let info = this.c_info.find(x => x.name === name);
                if (info) {
                    data_format = info.data_format;
                } else {
                    data_format = perspective.DATA_FORMAT_DEFAULTS[type];
                }
            } else {
                data_format = perspective.SEARCH_TYPE_DEFAULTS[type];
            }
        }

        if (filter) {
            if (this.is_cinfo_pivot(false)) {
                let view_aggregates = this._get_view_aggregates();
                let columns = [{n:name,t:type,dname:this._get_dname_name(name)}]
                .concat(view_aggregates.map(x => {
                    return {
                        n: x.new_base_name,
                        t: perspective.STATISTIC_AGGREGATES.includes(x.op) ? "float" : x.type,
                        dname: this._get_dname_name(x.new_base_name)
                    }
                }));
                row.setAttribute("filter_by_list", JSON.stringify(columns));
            }
            else if (type === "string") {
            }
            row.setAttribute("filter", filter);
        }

        if (sort) {
            row.setAttribute("sort_order", sort["order"]);
            if (this.is_cinfo_pivot(false)) {
                var view_aggregates = this._get_view_aggregates();
                var columns = [{n:name,dname:this._get_dname_name(name)}].concat(view_aggregates.map(x => {
                    return {
                        n: x.new_base_name,
                        dname: this._get_dname_name(x.new_base_name)
                    };
                }));
                row.setAttribute("sort_by_list", JSON.stringify(columns));
                row.setAttribute("sort_by", sort["sort_by"] || name);
                if (sort["subtotal"]) {
                    row.setAttribute("subtotal", sort["subtotal"]);
                }
            }
            if (sort["limit"]) {
                row.setAttribute("limit", sort["limit"]);
            } else {
                row.setAttribute("limit", "none");
            }
        }

        row.setAttribute("type", type);
        row.setAttribute("name", name);
        row.setAttribute("new_base_name", name);
        row.setAttribute("container", container);
        row.setAttribute("aggregate", aggregate);
        row.setAttribute("data_format", data_format);
        if (container == "active_columns"){
            row.setAttribute("active_field", true);
        }else if(container == "inactive_columns"){
            row.setAttribute("active_field", false);
        }

        if (["row_pivots", "column_pivots"].includes(container) == true){

            row.setAttribute("sort_by", sort_by || name);

            row.setAttribute("sort_order", sort_order || "asc");

            if (sort_sub){
              row.setAttribute("subtotal", sort_sub);
            }

            row.setAttribute("limit", limit || "none");

            if (limit_type){
              row.setAttribute("limit_type", limit_type);
            }
        }

        if (container === "sort") {
            if (sort && sort["limit_type"]) {
                row.setAttribute("limit_type", sort["limit_type"]);
            }
            if (this.is_column_pivot() && this.is_row_pivot()) {
                var row_pivots = JSON.parse(this.getAttribute("row-pivots"));
                var r_index = row_pivots.findIndex((v)=>v.n === name);
                if (r_index !== -1) {
                    row.setAttribute("subtotal_list", JSON.stringify(this.SUB_TOTAL_LIST));
                    if (sort && sort["subtotal"]) {
                        row.setAttribute("subtotal", sort["subtotal"]);
                    } else {
                        row.setAttribute("subtotal", this.SUB_TOTAL_LIST[0]);
                    }
                }
            }
        } else if (container === "filters") {
            if (this.is_column_pivot() && this.is_row_pivot()) {
                var row_pivots = JSON.parse(this.getAttribute("row-pivots"));
                var r_index = row_pivots.findIndex((v)=>v.n === name);
                if (r_index !== -1) {
                    row.setAttribute("filter_sublist", JSON.stringify(this.SUB_TOTAL_LIST));
                    if (filter && filter["subtotal"]) {
                        row.setAttribute("filter_subtotal", filter["subtotal"]);
                    } else {
                        row.setAttribute("filter_subtotal", this.SUB_TOTAL_LIST[0]);
                    }
                }
            }
        } else if (container === "active_columns") {
            // Update sort and sort num for active columns
            let c_index = this.c_info.findIndex(f => name === f.name);
            if (c_index !== -1) {
                let sort_order = this.c_info[c_index].sort_order;
                let sort_num = this.c_info[c_index].sort_num;
                if (!sort_order || sort_order === "null" || sort_order === "undefined") {
                    row.removeAttribute("sort_order");
                } else {
                    row.setAttribute("sort_order", sort_order);
                }
                if (!sort_num || sort_num === "null" || sort_num === "undefined") {
                    row.removeAttribute("sort_num");
                } else {
                    row.setAttribute("sort_num", sort_num);
                }
            }
        }//else if(container === "value_pivots" || container === "active_columns"){
        var v_name = this._get_disp_name_aggregate(name, aggregate, prev_value, show_type || "default");
        row.setAttribute("vname", v_name);
        //}

        if (container === "value_pivots"){
          var alias_name = this._get_disp_name_aggregate(name, aggregate);
          row.setAttribute("dname", alias_name);
          row.setAttribute("alias_name", alias_name);
          if (prev_value){
            row.setAttribute("period", prev_value);
          }
        }else{
          var alias_name = this._get_dname_name(name);
          if (container === "filters" && name === perspective.__FILTER_SEARCH__) {
              //let search_text = (filter) ? JSON.parse(filter).site_search || "" : "";
              //alias_name = "Search = \"" + search_text + "\"";
              alias_name = "Search";
          }else if(container === "filters" && name === perspective.GROUP_FILTER_NAME){
            alias_name = perspective.GROUP_FILTER_ALIAS_NAME;// "(multiple fields)";
          }
          row.setAttribute("dname", alias_name);
          row.setAttribute("alias_name", alias_name);
        }

        if (["row_pivots", "column_pivots", "value_pivots"].includes(container) == true){
            var src_field_index = this.c_info.findIndex((v)=>v.name === name);
            if (src_field_index != -1){
              row.setAttribute("source_field", this.c_info[src_field_index].dname);
            }else{
              row.setAttribute("source_field", name);
            }

        }else{
          row.setAttribute("source_field", name);
        }

        if (["row_pivots", "column_pivots", "value_pivots"].includes(container) == true){
          if (subtotals !== null && subtotals !== undefined){
            row.setAttribute("subtotals", subtotals);
          }

          if (prev_value !== null && prev_value != undefined){
            row.setAttribute("period", prev_value);
          }

          if (binning){
            row.setAttribute("binning", JSON.stringify(binning));
          }
        }

        if (this.is_cinfo_pivot(false)) {
            row.setAttribute("show_type", show_type || "default");
        }

        // Generate drag id
        row.setAttribute("drag_id", drag_id || this._generage_drag_id());

        row.addEventListener("visibility-clicked", this._column_visibility_clicked.bind(this));
        row.addEventListener("aggregate-selected", event => this._column_aggregate_clicked.call(this, event.detail));
        row.addEventListener("period-selected", event => this._column_period_clicked.call(this, event.detail));
        row.addEventListener("show-as-selected", event => this._column_show_type_clicked.call(this, event.detail));
        row.addEventListener("data-format-selected", event => this._column_data_format_clicked.call(this, event.detail));
        //row.addEventListener("filter-selected", this._column_filter_clicked.bind(this));
        row.addEventListener("filter-selected", event => this._column_change_filter_clicked.call(this, event));
        row.addEventListener("filter-by-selected", event => this._column_filter_by_clicked.call(this, event.detail));
        row.addEventListener("filter-subtotal-selected", event => this._column_filter_subtotal_clicked.call(this, event.detail));
        row.addEventListener("close-clicked", event => undrag.call(this, event.detail));
        row.addEventListener("info-clicked", event => this._open_row_settings.call(this, event.detail));
        row.addEventListener("sort_order", this._sort_order_clicked.bind(this));
        row.addEventListener("column-validate-name", this._validate_column_name.bind(this));
        row.addEventListener("column-change-name", this._change_column_name.bind(this));
        row.addEventListener("aggregate-level-selected", event => this._column_agg_level_clicked.call(this, event.detail));
        row.addEventListener("sort-by-selected", event => this._column_sort_by_clicked.call(this, event.detail));
        row.addEventListener("sort-subtotal-selected", event => this._column_sort_subtotal_clicked.call(this, event.detail));
        row.addEventListener("limit-group-selected", event => this._column_limit_select_clicked.call(this, event.detail));
        row.addEventListener("limit-type-selected", event => this._column_limit_type_selected.call(this, event.detail));
        row.addEventListener("clicked_search_item", event => this.open_search_box.call(this, event));
        row.addEventListener("click", event => {

          event.preventDefault();
          event.stopPropagation();
          this.close_popup();
          //this.close_all();
        });

        row.addEventListener("row-drag", () => {
            this._contains_row_dragging = true;
            this.classList.add("dragging");
            var current_name = row.getAttribute("name");
            var row_drag_type = row.getAttribute("type");
            var row_drag_agg_level = row.getAttribute("agg_level");
            var row_drag_id = row.getAttribute("drag_id");
            var c = row.getAttribute("container");
            var new_aggregate = this._suggestion_aggregate(current_name, type, row.getAttribute("period") || "none", this._get_column_show_type(row));
            if (row.classList.contains("computed-pivot")) {
                new_aggregate = aggregate;
            }
            if (c === "row_pivots" || c === "column_pivots" || c === "filters"){
              var prows = [];
              if (c === "row_pivots"){
                  prows = this._row_pivots.getElementsByTagName("perspective-row");
              }else if(c === "column_pivots"){
                  prows = this._column_pivots.getElementsByTagName("perspective-row");
              }/*else if(c === "value_pivots"){
                  prows = this._value_pivots.getElementsByTagName("perspective-row");
              }*/ else if(c === "filters"){
                  prows = this._filters.getElementsByTagName("perspective-row");
              }

              this._original_index = -1;
              this._original_index = Array.prototype.slice.call(prows).findIndex(x =>
                x.getAttribute("name") === current_name && x.getAttribute("drag_id") === row_drag_id);

              if (this._original_index !== -1) {
                  this._drop_target_hover = prows[this._original_index];
                  row.setAttribute("aggregate", new_aggregate);
                  const period = this._visible_column_period() ? row.getAttribute("period") : "none";
                  var v_name = this._get_disp_name_aggregate(name, new_aggregate, period, this._get_column_show_type(row));
                  this._drop_target_hover.setAttribute("vname", v_name);
                  this._drop_target_added = this._drop_target_hover;
                  if (c === "filters" && this._drop_target_hover && this._drop_target_hover.getAttribute("name") === perspective.__FILTER_SEARCH__){
                    // Do not show the drop-target in case the search tag in Filters
                  }else{
                    setTimeout(() => row.setAttribute("drop-target", true));
                  }

              } else {
                  this._drop_target_hover = this._new_row(current_name, type, new_aggregate, data_format, undefined, undefined, undefined, "active_columns");
                  this._drop_target_added = this._drop_target_hover;
              }
              let available_list = this._get_available_show_types(this._drop_target_hover);
              if (available_list.length > 0) {
                  this._drop_target_hover.setAttribute("show_type", this._suggestion_show_type(this._drop_target_hover));
              }
            }else if (this.is_row_pivot() || this.is_value_pivot()) {
                
                console.error("removed computed new row-------", computed);
                if (c !== "value_pivots" && c !== "active_columns") {
                    this._original_index = -1;
                    this._drop_target_hover = this._new_row(current_name, type, new_aggregate, data_format, undefined, undefined, computed, c);
                    this._drop_target_added = this._drop_target_hover;
                    let available_list = this._get_available_show_types(this._drop_target_hover);
                    if (available_list.length > 0) {
                        this._drop_target_hover.setAttribute("show_type", this._suggestion_show_type(this._drop_target_hover));
                    }
                } else if (c === "value_pivots") {
                    this._original_index = Array.prototype.slice.call(this._value_pivots.querySelector("ul").children).findIndex(x => x.getAttribute("new_base_name") === row.getAttribute("new_base_name"));
                    if (this._original_index !== -1) {
                        this._drop_target_hover = this._value_pivots.querySelector("ul").children[this._original_index];
                        this._drop_target_added = this._drop_target_hover;
                        setTimeout(() => row.setAttribute("drop-target", true));
                    } else {
                        this._drop_target_hover = this._new_row(current_name, type, new_aggregate, data_format, undefined, undefined, computed, "value_pivots");
                        this._drop_target_added = this._drop_target_hover;
                    }
                    let available_list = this._get_available_show_types(this._drop_target_hover);
                    if (available_list.length > 0) {
                        this._drop_target_hover.setAttribute("show_type", this._suggestion_show_type(this._drop_target_hover));
                    }
                } else {
                    const ac = this._pivotList.getActiveCols(true);
                    this._original_index = ac.findIndex(x => x.getAttribute("new_base_name") === row.getAttribute("new_base_name"));
                    if (this._original_index !== -1) {
                        this._drop_target_hover = ac[this._original_index];
                        // Update new aggregate for drop target hover
                        this._drop_target_hover.setAttribute("aggregate", new_aggregate);
                        // Update new value name for drop target hover
                        const period = this._visible_column_period() ? row.getAttribute("period") : "none";
                        var v_name = this._get_disp_name_aggregate(name, new_aggregate, period, this._get_column_show_type(row));
                        this._drop_target_hover.setAttribute("vname", v_name);
                        this._drop_target_added = this._drop_target_hover;
                        setTimeout(() => row.setAttribute("drop-target", true));
                    } else {
                        this._drop_target_hover = this._new_row(current_name, type, new_aggregate, data_format, undefined, undefined, computed, "active_columns");
                        this._drop_target_added = this._drop_target_hover;
                    }
                    let available_list = this._get_available_show_types(this._drop_target_hover);
                    if (available_list.length > 0) {
                        this._drop_target_hover.setAttribute("show_type", this._suggestion_show_type(this._drop_target_hover));
                    }
                }
            } else {
                const ac = this._pivotList.getActiveCols(true);
                this._original_index = ac.findIndex(x => x.getAttribute("name") === current_name);
                if (this._original_index !== -1) {
                    this._drop_target_hover = ac[this._original_index];
                    this._drop_target_added = this._drop_target_hover;
                    setTimeout(() => row.setAttribute("drop-target", true));
                } else {
                    this._drop_target_hover = this._new_row(current_name, type, aggregate, data_format, undefined, undefined, undefined, "active_columns");
                    this._drop_target_added = this._drop_target_hover;
                }
                let available_list = this._get_available_show_types(this._drop_target_hover);
                if (available_list.length > 0) {
                    this._drop_target_hover.setAttribute("show_type", this._suggestion_show_type(this._drop_target_hover));
                }
            }
        });
        row.addEventListener("row-dragend", () => {this._contains_row_dragging = false; this.classList.remove("dragging");});

        if (perspective.AGGREGATE_LEVEL_LIST.includes(type) && ["row_pivots", "column_pivots"].includes(container)) {
            if (!agg_level){
              agg_level = this.create_default_agg_level(container, name, type);
            }
            if(!agg_level){
              agg_level = perspective.AGGREGATE_LEVEL_DEFAULTS[type];
            }
            row.setAttribute("agg_level", agg_level);
        }

        return row;
    }

    create_default_agg_level(container_name, col_name, type){
        if (!container_name || !col_name || !type){
          return undefined;
        }

        if (perspective.AGGREGATE_LEVEL_LIST.includes(type) == false
          || ["row_pivots", "column_pivots"].includes(container_name) == false) {
          return undefined;
        }

        var existed_agg_levels = this._get_existed_agg_level(col_name);
        var default_agg_level = perspective.AGGREGATE_LEVEL_DEFAULTS[type];

        // If the default agg_level doesn't exist, it will be used
        if (!existed_agg_levels.includes(default_agg_level)){
            return default_agg_level;
        }

        // Need to find and choose another default agg_level
        default_agg_level = undefined;
        for (let agg_level of perspective.TYPE_AGGREGATE_LEVELS[type]) {
            if (!existed_agg_levels.includes(agg_level)) {
                default_agg_level = agg_level;
                break;
            }
        }

        return default_agg_level;
    }

    is_stackcol_expanded(row, col){
        return true;
    }

    // Collapse a group columns in stack header
    collapse_stackcol(row, col){
        return true;
    }

    // Expand a group columns in stack header
    expand_stackcol(row, col){
        return true;
    }

    get_row_pivots(current = true){
        if (current) {
            var current_request = this.get_request_structure("current");
            var combined_field = current_request["combined_field"] || {};
            var row_pivots = current_request["row_pivots"] || [];
            if (combined_field && combined_field["combined_index"] != -1
                && combined_field["combined_mode"] == perspective.COMBINED_MODES.row) {
                row_pivots.splice(combined_field["combined_index"], 0, {
                    n: perspective.COMBINED_NAME,
                    dname: this._get_dname_name(perspective.COMBINED_NAME),
                    drag_id: this._generage_drag_id()
                });
            }
            return row_pivots;
        } else {
            return JSON.parse(this.getAttribute("row-pivots"));
        }
    }

    is_row_pivot(current = false) {
        if (current) {
            var current_request = this.get_request_structure("current");
            return (current_request["row_pivots"] || []).length > 0;
        } else {
            var row_pivots = JSON.parse(this.getAttribute("row-pivots"));
            if (!row_pivots) return false;
            //return row_pivots.filter(x => x != perspective.COMBINED_NAME).length > 0;
            return row_pivots.filter((v) => v.n != perspective.COMBINED_NAME).length > 0;
        }
    }

    get_column_pivots(current = true){
        if (current) {
            var current_request = this.get_request_structure("current");
            var combined_field = current_request["combined_field"] || {};
            var column_pivots = [...(current_request["column_pivots"] || [])];
            if (combined_field && combined_field["combined_index"] != -1
                && combined_field["combined_mode"] == perspective.COMBINED_MODES.column) {
                    column_pivots.splice(combined_field["combined_index"], 0, {
                        n: perspective.COMBINED_NAME,
                        dname: this._get_dname_name(perspective.COMBINED_NAME),
                        drag_id: this._generage_drag_id()
                });
            }
            return column_pivots;
        } else {
            return JSON.parse(this.getAttribute("column-pivots"));
        }
    }

    get_value_pivots(current = true) {
        if (current) {
            var current_request = this.get_request_structure("current");
            var value_pivots = [...(current_request["value_pivots"] || [])];
            return value_pivots;
        } else {
            return JSON.parse(this.getAttribute("value-pivots"));
        }
    }

    get_attr_value_pivots() {
      return JSON.parse(this.getAttribute("value-pivots") || "[]");
    }

    get_value_obj_pivots(current = true){
      return this._get_raw_value_pivots();
    }

    is_column_pivot(current = false) {
        if (current) {
            var current_request = this.get_request_structure("current");
            return (current_request["column_pivots"] || []).length > 0;
        } else {
            var column_pivots = JSON.parse(this.getAttribute("column-pivots"));
            if (!column_pivots) return false;
            //return column_pivots.filter(x => x != perspective.COMBINED_NAME).length > 0;
            return column_pivots.filter((v) => v.n != perspective.COMBINED_NAME).length > 0;
        }
    }

    is_value_pivot(current = false) {
        if (current) {
            var current_request = this.get_request_structure("current");
            return (current_request["value_pivots"] || []).length > 0;
        } else {
            var value_pivots = JSON.parse(this.getAttribute("value-pivots")) || [];
            return value_pivots.length > 0;
        }
    }

    is_row_combined(current = false) {
        if (current) {
            var current_request = this.get_request_structure("current");
            return (current_request["combined_field"] && current_request["combined_field"].combined_mode === perspective.COMBINED_MODES.row);
        } else {
            var row_pivots = JSON.parse(this.getAttribute("row-pivots"));
            return row_pivots.filter((v) => v.n == perspective.COMBINED_NAME).length > 0;
        }
    }

    contains_col_combined() {
        const col_pivots = JSON.parse(this.getAttribute("column-pivots"));
        return col_pivots.filter((v) => v.n == perspective.COMBINED_NAME).length > 0;
    }

    _after_move_column_updates(m_columns, from, len, placeholderIndex, notify = false) {
        const _is_row_pivot = this.is_row_pivot(true);
        const is_column_pivot = this.is_column_pivot(false);
        const is_value_pivot = this.is_value_pivot(true);

        var _this = this;
        if(_is_row_pivot || is_column_pivot || is_value_pivot){
          const col_pivots = this.get_column_pivots(false); // param = false: include the Values. param = true: not include the value
          const is_flat_pivot = this.is_flat_pivot(true);
          const contains_col_combined = this.contains_col_combined();

          if (is_value_pivot){
            if ((_is_row_pivot && !is_column_pivot && contains_col_combined && col_pivots.length === 1) // Row pivots and only Values in column pivot
              || (_is_row_pivot && !is_column_pivot && is_flat_pivot)){

                if (!m_columns || m_columns.length === 0){
                  // Nothing to do
                  return;
                }

                var value_pivots = JSON.parse(this.getAttribute("value-pivots")) || [];

                const actual_from = value_pivots.findIndex((fp)=>fp.base_name === m_columns[0]);
                let actual_placeholder_index = placeholderIndex;

                if (from < placeholderIndex){
                  actual_placeholder_index = Math.min(actual_from + (placeholderIndex - from), value_pivots.length -1);
                }else{
                  actual_placeholder_index = Math.max(actual_from - (from - placeholderIndex), 0);
                }

                for (var ai = 0; ai < m_columns.length; ai++){
                  const curr_i = value_pivots.findIndex((fp)=>fp.base_name === m_columns[ai]);

                  // Move a column to left
                  if (actual_placeholder_index <= actual_from){
                      const curr_obj = value_pivots[curr_i];

                      // Delete item that will be moved
                      value_pivots.splice(curr_i, 1);

                      // Add the moved item again
                      value_pivots.splice(actual_placeholder_index + ai, 0, curr_obj);
                  }else{

                      // Move a column to right
                      const curr_obj = value_pivots[curr_i];

                      // Delete item that will be moved
                      value_pivots.splice(curr_i, 1);

                      // Add the moved item again
                      value_pivots.splice(actual_placeholder_index, 0, curr_obj);
                  }

                }

                this._force_to_fetch_only = true;
                this.setAttribute("value-pivots", JSON.stringify(value_pivots));
                this._force_to_fetch_only = false;

            }
          }
        }else{

          const active_lis = this._get_view_dom_columns("#active_columns perspective-row");
          var c_index = placeholderIndex;

          var last = (c_index > 0 &&
              c_index == this._pivotList.getActiveCount()- 1) ? true : false;

          var pre_columns_elements = [];
          active_lis.forEach(x => {
              if (m_columns.includes(_is_row_pivot ? x.getAttribute("dname") : x.getAttribute("name"))) {
                  pre_columns_elements.unshift(x);
                  _this._pivotList.removeActiveRow(x);
              }
          });

          if (placeholderIndex > from){
              c_index = c_index - len + 1;
          }

          pre_columns_elements.forEach(function(row) {
              if (c_index == 0) {
                  _this._pivotList.insertActiveRow(row, 0);
              } else if (c_index < _this._pivotList.getActiveCount()) {
                  _this._pivotList.insertActiveRow(row, c_index);
              } else {
                  // Most right column
                  _this._pivotList.addActiveRow(row);
              }

              _this.updates_cinfo_after_columns_moved([_is_row_pivot ? row.getAttribute("dname") : row.getAttribute("name")], from, 1, placeholderIndex, true);
          });
          this._pivotList.refresh();

          this._check_responsive_layout();
          let cols = this._get_view_columns();

          if (this.is_cinfo_pivot(true)) {
              this._update_column_view(cols);
          }else if(this.is_cinfo_search(true)){
              //this.visibility_column_notification();
              //this._update_column_view(cols);
              this._update_column_without_view(cols);
          }else{
              //this.visibility_column_notification();
              if (notify){
                  this._plugin.notify_column_updates.call(this, this.get_cinfo());
              }
              this._update_column_without_view(cols);
          }

        }
    }

    // Call from hypergrid
    move_columns_updates(m_columns, from, len, placeholderIndex){
        var _is_row_pivot = this.is_row_pivot(true);

        if (_is_row_pivot && placeholderIndex > 0){
            placeholderIndex = placeholderIndex - 1;
            from = from - 1;
        }

        this._handle_manage_action(perspective.ACTION_TYPE.order_columns, undefined, {},
            _ => {
                var new_from = (from < placeholderIndex) ? (placeholderIndex - (len - 1)) : placeholderIndex;
                var new_placeholderIndex = (from > placeholderIndex) ? (from + (len - 1)) : from;
                this._after_move_column_updates(m_columns, new_from, len, new_placeholderIndex, true);
            },
            _ => {
                this._after_move_column_updates(m_columns, from, len, placeholderIndex, true);
            });

        this._after_move_column_updates(m_columns, from, len, placeholderIndex, false);
    }

    did_active_columns(c_name){
        var c_active = this._get_view_columns() || [];
        if (!c_active.includes(c_name)){
            c_active.push(c_name);
        }
        var c_info = this.get_cinfo(false);
        var arrSort = c_info.filter(function(item){
            return c_active.includes(item.name);
        }).sort(function(a, b){return a.index - b.index});
        if (!arrSort){
            arrSort = [];
        }

        c_active = arrSort.map(function(item){
            return item.name;
        });

        return c_active;
    }

    _after_did_inactive_columns(notify) {
        this._check_responsive_layout();
        let cols = this._get_view_columns();

        if (this.is_cinfo_pivot(true)) {
            this._update_column_view(cols);
        }else if(this.is_cinfo_search(true)){
            this.visibility_column_notification(true);
            this._update_column_view(cols);
        }else{
            this.visibility_column_notification(true);
            if (notify){
                this._plugin.notify_column_updates.call(this, this.get_cinfo(true));
            }
            if (this.AUTO_QUERY || !this._can_request_building()) {
                this._update_column_without_view(cols);
            }
        }
    }

    // ["company", "city"]
    // Call from hypergrid
    did_inactive_columns(c_names, notify = false){
        c_names = c_names || [];
        if (c_names.length < 1){
            return;
        }
        const active_lis = this._get_view_dom_columns("#active_columns perspective-row");

        var remove_count = 0;
        var rows = [];
        active_lis.forEach(x => {
            if (c_names.includes(x.getAttribute("name"))){
                // Remove
                //this._active_columns.removeChild(x);
                rows.push(x);
                remove_count += 1;
            }
        });

        if (remove_count < 1){

            // Do nothing
            return;
        }

        var options = {
            c_names: c_names
        }
        this._handle_manage_action(perspective.ACTION_TYPE.hide_grid_columns, undefined, options,
            _ => {
                this._after_did_inactive_columns(true);
            },
            _ => {
                this._after_did_inactive_columns(true);
            });
        rows.forEach(x => {
            this._pivotList.removeActiveRow(x);
        });
        this._pivotList.refresh();
        this._after_did_inactive_columns(notify);
    }

    /*
     *  cols_data: [{name: "header", hide_value: "x", column_pivot_index: 0}]
     *  Results will be: headerX not in "x"
     */
    did_hide_stack_columns2(cols_data, is_stack_header){
      cols_data = cols_data || [];
      if (cols_data.length < 1){
          return;
      }

      if (!is_stack_header){
        return;
      }

      let is_colmn_pivot = this.is_column_pivot(false);
      let is_row_pivot = this.is_row_pivot(false);
      let is_row_combined = this.is_row_combined(false);
      /*
      if (!is_row_pivot) {
          if (is_row_combined) {
              let old_value = this.getAttribute("value-pivots");
              var new_values = [];
              var hidden_rows = [];
              for (let row_path of row_ids) {
                  if (row_path.length < 1) {
                      continue;
                  }
                  hidden_rows.push(row_path[0]);
              }
              let value_elems = this._get_view_dom_columns("#value_pivots perspective-row");
              for (let col of value_elems) {
                  if (!hidden_rows.includes(col.getAttribute("vname"))) {
                      new_values.push({
                          n: col.getAttribute("name"),
                          t: col.getAttribute("type"),
                          agg: col.getAttribute("aggregate"),
                          df: col.getAttribute("data_format"),
                          st: col.getAttribute("show_type") || "default",
                          p: col.getAttribute("period") || "none",
                          drag_id: col.getAttribute("drag_id"),
                          dname: col.getAttribute("dname")
                      });
                  }
              }
              let new_value = JSON.stringify(new_values);
              var options = {
                  old_value: old_value,
                  new_value: new_value,
                  attribute: "value-pivots"
              };
              if (hidden_rows.length > 0 && new_values.length < 2) {
                  options.dependencies = [{
                      old_value: this.getAttribute("row-pivots"),
                      new_value: JSON.stringify([]),
                      attribute: "row-pivots"
                  }];
                  this.setAttribute("row-pivots", JSON.stringify([]));
              }
              this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options);
              this.setAttribute("value-pivots", new_value);
          } else {
              return;
          }
      } else {
          var current_filters = JSON.parse(this.getAttribute("filters"));
          var old_filters = [...current_filters];
          var filter_map = {};
          for (let idx in current_filters) {
              let filter = current_filters[idx];
              let name = filter.n;
              let operator = filter.operator;
              if (operator === "not in") {
                  filter_map[name] = idx;
              }
          }
          var filters = {};
          let row_elems = this._get_view_dom_columns("#row_pivots perspective-row");
          for (let row_path of row_ids) {
              if (row_path.length < 1 || row_path.length > row_elems.length) {
                  continue;
              }
              var r_index = row_path.length - 1;
              var elem = row_elems[r_index];
              var name = elem.getAttribute("name");
              if (name === perspective.COMBINED_NAME) {
                  if (row_path.length - 2 >= 0) {
                      r_index = row_path.length - 2;
                      elem = row_elems[r_index];
                      name = elem.getAttribute("name");
                  } else {
                      continue;
                  }
              }
              if (!filters[name]) {
                  filters[name] = [];
              }
              filters[name].push(row_path[r_index]);
          }
          for (let name in filters) {
              var values = filters[name];
              if (filter_map[name]) {
                  var filter = current_filters[filter_map[name]];
                  values = filter.operand.concat(values);
                  filter.operand = values;
                  current_filters[filter_map[name]] = filter;
              } else {
                  let filter = {n: name, operator: "not in", operand: values};
                  current_filters.push(filter);
              }
          }
          var options = {
              old_value: JSON.stringify(old_filters),
              new_value: JSON.stringify(current_filters),
              attribute: "filters"
          }
          this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options);
          this.setAttribute("filters", JSON.stringify(current_filters));
      }
      */

      var current_filters = JSON.parse(this.getAttribute("filters"));
      var old_filters = JSON.parse(this.getAttribute("filters"));

      let requires_updates = false;
      for (let col_data of cols_data){
        if (!col_data.name || !col_data.hide_value){
          continue;
        }

        const f_index = current_filters.findIndex((v)=>v.n === col_data.name);

        // Update filter
        if (f_index !== -1){
          // Add the hide_value into ignore_list if existed
          if (current_filters[f_index].ignore_list && current_filters[f_index].ignore_list.length > 0){
            if (!current_filters[f_index].ignore_list.includes(col_data.hide_value)){
              current_filters[f_index].ignore_list.push(col_data.hide_value);
            }
          }else if(current_filters[f_index].selected_list && current_filters[f_index].selected_list.length > 0){ // Remove the hide_value from selected_list if existed
            const existed_index = current_filters[f_index].selected_list.indexOf(col_data.hide_value);
            if (existed_index !== -1){ // Remove it
              current_filters[f_index].selected_list.splice(existed_index, 1);
            }
          }else{
            current_filters[f_index].ignore_list = [col_data.hide_value];
          }
        }else{
          let filter = {n: col_data.name, ignore_list: [col_data.hide_value]};
          current_filters.push(filter);
        }

        requires_updates = true;
      }

      if (!requires_updates){
        // Something is not right. Don't update anything
        return;
      }

      var options = {
          old_value: JSON.stringify(old_filters),
          new_value: JSON.stringify(current_filters),
          attribute: "filters"
      }

      // Need to reuse the prev cols settings
      this.keep_using_prev_cols_settings = true;

      this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options);
      this.setAttribute("filters", JSON.stringify(current_filters));

    }

    /* Using group filter to hide stack columns
        cols_data: [
        [
          {name: "Header", hide_value: "x", column_pivot_index: 0},
          {name: "HeaderC", hide_value: "thanks", column_pivot_index: 1},
        ],
        [
          {name: "Header", hide_value: "y", column_pivot_index: 0},
          {name: "HeaderC", hide_value: "pretty", column_pivot_index: 1},
        ],
      ]

      group filter

      Header = "x" AND HeaderC = "thanks"

      OR

      Header = "y" AND HeaderC = "pretty"
     */
    did_hide_stack_columns(cols_data, is_stack_header){
      cols_data = cols_data || [];
      if (cols_data.length < 1){
          return;
      }

      if (!is_stack_header){
        return;
      }

      let is_colmn_pivot = this.is_column_pivot(false);
      let is_row_pivot = this.is_row_pivot(false);
      let is_row_combined = this.is_row_combined(false);

      var current_filters = JSON.parse(this.getAttribute("filters"));
      //var old_filters = JSON.parse(this.getAttribute("filters"));

      let requires_updates = false;

      let mapping_fields = {};
      for (let col_data of cols_data){

        if (!Array.isArray(col_data)){
          continue;
        }

        let field_values = [];

        for (let col_data_item of col_data){
          if (!col_data_item.name || !col_data_item.hide_value){
            continue;
          }

          if (col_data_item.name === perspective.COMBINED_NAME){
            continue;
          }

          field_values.push({name: col_data_item.name, value: [col_data_item.hide_value]});
        }

        if (field_values.length === 0){
          continue;
        }

        mapping_fields = this.build_mapping_field_item_for_group_filter(mapping_fields, field_values);

        if (!mapping_fields || Object.keys(mapping_fields).length === 0){
          continue;
        }

        requires_updates = true;
      }

      if (!requires_updates){
        // Something is not right. Don't update anything
        return;
      }

      const group_filter_index = current_filters.findIndex((v)=>v.n === perspective.GROUP_FILTER_NAME);
      let curr_group_filter;
      if (group_filter_index !== -1){
        curr_group_filter = current_filters[group_filter_index].group_filter;
      }

      let group_filter = this.build_the_group_filter(curr_group_filter, mapping_fields);

      // Update the group filter
      if (group_filter_index !== -1){
        current_filters[group_filter_index].group_filter = group_filter;
      }else{ // Add a new group filter tag
        current_filters.push({n: perspective.GROUP_FILTER_NAME, group_filter: group_filter});
      }

      var options = {
          old_value: this.getAttribute("filters"),
          new_value: JSON.stringify(current_filters),
          attribute: "filters"
      }

      // Need to reuse the prev cols settings
      this.keep_using_prev_cols_settings = true;

      this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options);
      this.setAttribute("filters", JSON.stringify(current_filters));
    }

    // Only update cinfo, not update list active elements
    /*_updates_cinfo_after_columns_moved(m_columns, from, len, placeholderIndex){
        var _this = this;
        var c_info = this.get_cinfo();
        var pre_cinfo_items = [];

        m_columns.forEach(function(c_name){
            var i = c_info.findIndex(function(item){
                return item.name === c_name;
            });
            pre_cinfo_items.unshift(c_info[i]);
        });
    }*/

    updates_cinfo_after_columns_moved(m_columns, from, len, placeholderIndex, current = false){
        var c_active = this._get_view_columns() || [];
        var _c_info = this.get_cinfo(current);
        var pre_c, // Previous string name in active columns
            pre_c_i, // Index of c_info
            pre_c_obj, // item value of c_info at pre_c_i
            curr_c_i; // index of c_info
        for (var i_c = 0; i_c < c_active.length; i_c++){
            if (!pre_c){
                pre_c = c_active[i_c];
            }else{
                // Previous column index
                pre_c_i = _c_info.findIndex(function(item){
                    return item.name == pre_c;
                });

                // Current column index
                curr_c_i = _c_info.findIndex(function(item){
                    return item.name == c_active[i_c];
                });

                // Reorder items
                if (pre_c_i > curr_c_i){

                    // Move a column to left
                    if (placeholderIndex <= from){
                        pre_c_obj = _c_info[pre_c_i];

                        // Delete item that will be moved
                        _c_info.splice(pre_c_i, 1);

                        // Add the moved item again
                        _c_info.splice(curr_c_i, 0, pre_c_obj);
                    }else{

                        // Move a column to right
                        pre_c_obj = _c_info[curr_c_i];

                        // Delete item that will be moved
                        _c_info.splice(curr_c_i, 1);

                        // Add the moved item again
                        _c_info.splice(pre_c_i, 0, pre_c_obj);
                    }
                }

                // Update current columns name as previous name
                pre_c = c_active[i_c];
            }
        }

        // Update columns index
        _c_info = _c_info.map(function(item, i){
            item.index = i;
            return item;
        });

        this.set_cinfo(_c_info, current);
    }

    visibility_column_notification(current = false) {
        var c_active = this._get_view_columns() || [];

        var _c_info = [];
        for (var idx in this.c_info) {
            var _col = this.c_info[idx];
            if (c_active.includes(_col['name'])) {
                _col['active'] = true;
            } else {
                _col['active'] = false;
            }
            _c_info.push(_col);
        }

        this.set_cinfo(_c_info, current);
    }

    /*
      Add group filter to hide rows based on multiple columns/fields

      row_ids = [
        [x, great],
        [x, thanks],
        [y, pretty],
        [z]
      ]

      separator = "/"

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
    _hide_rows_in_row_pivots(row_ids){
      const separator = "/";//"__||__";
      let is_row_pivot = this.is_row_pivot(false);

      if (!is_row_pivot){
        return;
      }

      let row_pivots = JSON.parse(this.getAttribute("row-pivots"));

      let find_original_name_by_row_path = function(row_path){

        if (!row_path || row_path.length === 0){
          return;
        }

        let r_index = row_path.length - 1;

        let row_pivot_obj = row_pivots[r_index];
        if (!row_pivot_obj){
          return;
        }

        let name = row_pivot_obj.n;
        let value = row_path[r_index];

        if (name && name === perspective.COMBINED_NAME) {
          if (row_path.length - 2 >= 0) {
            r_index = row_path.length - 2;
            name = row_pivots[r_index].n;
            value = row_path[r_index];
          }else {
            return;
          }
        }

        return {name: name, value: value};
      }

      var current_filters = JSON.parse(this.getAttribute("filters"));
      //var old_filters = JSON.parse(this.getAttribute("filters"));

      // Create the mapping fields
      let mapping_fields = {};

      for (let row_path of row_ids) {
        if (row_path.length === 0 || row_path.length > row_pivots.length) {
          continue;
        }

        // Build the mapping fields item
        let field_values = [];

        let next_row_path = [];
        for (let i = 0; i < row_path.length; i++){
          next_row_path.push(row_path[i]);
          const field_value_obj = find_original_name_by_row_path(next_row_path);
          if (field_value_obj){

            if (field_values.findIndex((e_v)=>e_v.name === field_value_obj.name) !== -1){
              // Duplicate
              continue;
            }

            if (!Array.isArray(field_value_obj.value)){
              field_value_obj.value = [field_value_obj.value];
            }
            field_values.push(field_value_obj);
          }
        }
        /*
        let mapping_key = field_values.map((v)=>v.name).join(separator);

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
        */
        mapping_fields = this.build_mapping_field_item_for_group_filter(mapping_fields, field_values);
      }

      const group_filter_index = current_filters.findIndex((v)=>v.n === perspective.GROUP_FILTER_NAME);
      let curr_group_filter;
      if (group_filter_index !== -1){
        curr_group_filter = current_filters[group_filter_index].group_filter;
      }

      let group_filter = this.build_the_group_filter(curr_group_filter, mapping_fields);

      // Update the group filter
      if (group_filter_index !== -1){
        current_filters[group_filter_index].group_filter = group_filter;
      }else{ // Add a new group filter tag
        current_filters.push({n: perspective.GROUP_FILTER_NAME, group_filter: group_filter});
      }

      var options = {
          old_value: this.getAttribute("filters"),
          new_value: JSON.stringify(current_filters),
          attribute: "filters"
      }
      this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options);
      this.setAttribute("filters", JSON.stringify(current_filters));
    }

    did_hide_rows(row_ids, is_row_path=false){
        if (is_row_path && is_row_path === true){
            let is_row_pivot = this.is_row_pivot(false);
            let is_row_combined = this.is_row_combined(false);

            if (is_row_pivot === true){
              //this._hide_rows_in_row_pivots_old(row_ids);
              this._hide_rows_in_row_pivots(row_ids);
            }else if (is_row_combined){
              this._hide_rows_in_value_pivot(row_ids);
            }else{
              return;
            }
        }else if (this.pk){
            this.is_hidding_rows = true;
            var c_active = this._get_view_columns() || [];
            var current_filters = JSON.parse(this.getAttribute("filters"));
            //var old_filters = [...current_filters];

            row_ids = row_ids || [];
            row_ids = row_ids.map(id => String(id));

            // Find the filter pk
            var id = this.pk;
            var filter_pk_i = current_filters.findIndex(function(item){
                return item.n == id;
            });

            var filter_pk_obj;

            if (filter_pk_i != -1){

                // The filter pk is already existed
                filter_pk_obj = current_filters[filter_pk_i];
                if (filter_pk_obj && filter_pk_obj.operator == "not in"){

                    // Update filter value
                    filter_pk_obj.operand = filter_pk_obj.operand.concat(row_ids)
                        .filter(function (x, i, a) {
                            return a.indexOf(x) == i;
                        });
                    current_filters[filter_pk_i] = filter_pk_obj;
                }else{

                    // Create filter value
                    filter_pk_obj = {n: this.pk, operator: "not in", operand: row_ids};
                    if (filter_pk_i == 0){
                        current_filters[filter_pk_i] = filter_pk_obj;
                    }else{

                        // Move this filter to first
                        current_filters.splice(filter_pk_i, 1);
                        current_filters.unshift(filter_pk_obj);
                    }

                }
            }else{

                // Create a new filter pk
                filter_pk_obj = {n: this.pk, operator: "not in", operand: row_ids};
                current_filters.unshift(filter_pk_obj);
            }

            // Save the filter pk
            //this.setAttribute("filters", JSON.stringify(current_filters));
            var options = {
                target: {
                    attribute: "filters",
                    new_value: JSON.stringify(current_filters),
                    old_value: this.getAttribute("filters")
                }
            };
            this._handle_manage_action(perspective.ACTION_TYPE.add_tag, undefined, options);
            this.setAttribute("filters", JSON.stringify(current_filters));

            // Auto open the side panel if it is not active
            if (!this.AUTO_QUERY && !this._show_config /*this._config_button.classList.contains("side-panel-active") === false*/){
                //this._did_toggle_config();
                this._cb_run_auto_query_tooltip.classList.remove("hidden");
            }
        }
    }

    // only call when is_row_pivot == false and is_row_combined == true
    _hide_rows_in_value_pivot(row_ids){
      let old_value = this.getAttribute("value-pivots");
      var new_values = [];
      var hidden_rows = [];
      for (let row_path of row_ids) {
          if (row_path.length < 1) {
              continue;
          }
          hidden_rows.push(row_path[0]);
      }
      let value_elems = this._get_view_dom_columns("#value_pivots perspective-row");
      for (let col of value_elems) {
          if (!hidden_rows.includes(col.getAttribute("vname"))) {
              new_values.push({
                  n: col.getAttribute("name"),
                  t: col.getAttribute("type"),
                  agg: col.getAttribute("aggregate"),
                  df: col.getAttribute("data_format"),
                  st: col.getAttribute("show_type") || "default",
                  p: col.getAttribute("period") || "none",
                  drag_id: col.getAttribute("drag_id"),
                  base_name: col.getAttribute("new_base_name"),
                  dname: col.getAttribute("dname")
              });
          }
      }
      let new_value = JSON.stringify(new_values);
      var options = {
          old_value: old_value,
          new_value: new_value,
          attribute: "value-pivots"
      };
      if (hidden_rows.length > 0 && new_values.length < 2) {
          options.dependencies = [{
              old_value: this.getAttribute("row-pivots"),
              new_value: JSON.stringify([]),
              attribute: "row-pivots"
          }];
          this.setAttribute("row-pivots", JSON.stringify([]));
      }
      this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options);
      this.setAttribute("value-pivots", new_value);
    }

    // This function will be deleted once the group filter is done
    _hide_rows_in_row_pivots_old(row_ids){
      var current_filters = JSON.parse(this.getAttribute("filters"));
      //var old_filters = [...current_filters];
      var filter_map = {};
      for (let idx in current_filters) {
          let filter = current_filters[idx];
          let name = filter.n;
          let operator = filter.operator;
          if (operator === "not in") {
              filter_map[name] = idx;
          }
      }
      var filters = {};
      let row_elems = this._get_view_dom_columns("#row_pivots perspective-row");
      for (let row_path of row_ids) {
          if (row_path.length < 1 || row_path.length > row_elems.length) {
              continue;
          }
          var r_index = row_path.length - 1;
          var elem = row_elems[r_index];
          var name = elem.getAttribute("name");
          if (name === perspective.COMBINED_NAME) {
              if (row_path.length - 2 >= 0) {
                  r_index = row_path.length - 2;
                  elem = row_elems[r_index];
                  name = elem.getAttribute("name");
              } else {
                  continue;
              }
          }
          if (!filters[name]) {
              filters[name] = [];
          }
          filters[name].push(row_path[r_index]);
      }
      for (let name in filters) {
          var values = filters[name];
          if (filter_map[name]) {
              var filter = current_filters[filter_map[name]];
              values = filter.operand.concat(values);
              filter.operand = values;
              current_filters[filter_map[name]] = filter;
          } else {
              let filter = {n: name, operator: "not in", operand: values};
              current_filters.push(filter);
          }
      }
      var options = {
          old_value: this.getAttribute("filters"),
          new_value: JSON.stringify(current_filters),
          attribute: "filters"
      }
      this._handle_manage_action(perspective.ACTION_TYPE.change_viewer_attribute, undefined, options);
      this.setAttribute("filters", JSON.stringify(current_filters));
    }

    _reorder_column_view(columns, reset = false){

        // Not allow to call to cpp regarding reordering columns
        return;
    }

    // Just Fetch data based on column index and keep all columns, not create view to do a new query
    _update_column_without_view(columns) {
        if(this.columnViewUpdating) {
            return;
        }
        this.columnViewUpdating = true;

        var value_cols = [];
        const lis = this._get_view_dom_columns("#inactive_columns perspective-row");
        const active_lis = this._get_view_dom_columns("#active_columns perspective-row");
        var is_row_pivot = this.is_row_pivot();
        var is_column_pivot = this.is_column_pivot();
        var is_value_pivot = this.is_value_pivot();
        if (is_row_pivot || is_column_pivot || is_value_pivot) {
            // Action for active columns
            var colnames = [];
            var remove_children = [];
            active_lis.forEach(x => {
                var name = x.getAttribute("name");
                var new_base_name = is_row_pivot ? this._get_disp_name_aggregate(x.getAttribute("name"),
                            x.getAttribute("aggregate"), x.getAttribute("period"), this._get_column_show_type(x))
                    : name;
                if (this._valid_active_columns(name) || colnames.includes(name) || (!is_row_pivot && x.getAttribute("aggregate") === "custom")) {
                    remove_children.push(x);
                }
                //colnames.push(new_base_name);
                colnames.push(name);
                if (x.hasAttribute("computed_column")) {
                    var computed_column = JSON.parse(x.getAttribute("computed_column"));
                    if (typeof computed_column === "string") {
                        computed_column = JSON.parse(computed_column);
                    }
                    x.classList.add("computed");
                    if (computed_column.is_pivot) {
                        x.classList.add("computed-pivot");
                    }
                }
                // set attribute new_base_name
                x.setAttribute("new_base_name", new_base_name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(new_base_name));
                x.setAttribute("alias_name", this._get_dname_name(name));
            });
            // Delete item for active columns
            remove_children.forEach(x => this._pivotList.removeActiveRow(x));
            this._pivotList.refresh();

            // Action for inactive columns
            var inactive_remove_children = [];
            colnames = [];
            var computed_columns = this._get_computed_columns();
            //var current_columns = columns || this._get_view_columns();
            var current_columns = columns || this._get_view_column_base_names();
            lis.forEach(x => {
                var name = x.getAttribute("name");
                const index = current_columns.indexOf(name);
                //if ((index !== -1 || colnames.includes(name) || computed_columns.includes(name)) && x.classList.contains("computed-pivot")) {
                if (index !== -1 || computed_columns.includes(name)) {
                    x.classList.add("active");
                } else {
                    colnames.push(name);
                    x.classList.remove("active");
                }
                if (!is_row_pivot && x.getAttribute("aggregate") === "custom") {
                    inactive_remove_children.push(x);
                }
                // set attribute new_base_name
                x.setAttribute("new_base_name", name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(name));
                x.setAttribute("alias_name", this._get_dname_name(name));
            });

            // Action for value pivots items
            const value_list = this._get_view_dom_columns("#value_pivots perspective-row");
            colnames = [];
            var value_remove_children = [];
            value_list.forEach(x => {
                var new_base_name = this._get_disp_name_aggregate(x.getAttribute("name"), x.getAttribute("aggregate"),
                    x.getAttribute("period"), this._get_column_show_type(x));
                if ((colnames.includes(new_base_name) || x.getAttribute("aggregate") === "custom")) {
                    value_remove_children.push(x);
                } else {
                    value_cols.push({n: x.getAttribute("name"),
                        t: x.getAttribute("type"),
                        agg: x.getAttribute("aggregate"),
                        df: x.getAttribute("data_format"),
                        st: x.getAttribute("show_type"),
                        p: x.getAttribute("period") || "none",
                        drag_id: x.getAttribute("drag_id"),
                        base_name: x.getAttribute("new_base_name"),
                        dname: x.getAttribute("dname")
                    });
                }
                colnames.push(new_base_name);
                if (x.hasAttribute("computed_column")) {
                    var computed_column = JSON.parse(x.getAttribute("computed_column"));
                    if (typeof computed_column === "string") {
                        computed_column = JSON.parse(computed_column);
                    }
                    x.classList.add("computed");
                    if (computed_column.is_pivot) {
                        x.classList.add("computed-pivot");
                    }
                }
                // set attribute new_base_name
                x.setAttribute("new_base_name", new_base_name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(new_base_name));
                x.setAttribute("alias_name", this._get_dname_name(x.getAttribute("name")));
            });
            if (!columns) {
                //columns = this._get_view_columns();
                columns = this._get_view_column_base_names();
            }
            inactive_remove_children.forEach(x => this._pivotList.removeInactiveRow(x));
            this._pivotList.refresh();
            var value_inner = this._value_pivots.querySelector("ul");
            value_remove_children.forEach(x => value_inner.removeChild(x));
            this.setAttribute("agg-custom", JSON.stringify([]));
        } else {
            if (!columns) {
                //columns = this._get_view_columns();
                columns = this._get_view_column_base_names();
            }
            var inactive_remove_children = [];
            lis.forEach(x => {
                var name = x.getAttribute("name");
                const index = columns.indexOf(x.getAttribute("name"));
                if (x.getAttribute("aggregate") === "custom") {
                    inactive_remove_children.push(x);
                }
                if (index === -1) {
                    x.classList.remove("active");
                } else {
                    x.classList.add("active");
                }

                // set attribute new_base_name
                x.setAttribute("new_base_name", name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(name));
                x.setAttribute("alias_name", this._get_dname_name(name));

                // set attribute for sort
                let c_index = this.c_info.findIndex(f => name === f.name);
                if (c_index !== -1) {
                    let sort_order = this.c_info[c_index].sort_order;
                    let sort_num = this.c_info[c_index].sort_num;
                    if (!sort_order || sort_order === "null" || sort_order === "undefined") {
                        x.removeAttribute("sort_order");
                    } else {
                        x.setAttribute("sort_order", sort_order);
                    }
                    if (!sort_num || sort_num === "null" || sort_num === "undefined") {
                        x.removeAttribute("sort_num");
                    } else {
                        x.setAttribute("sort_num", sort_num);
                    }
                }
            });
            var col_names = [];
            var remove_children = [];
            active_lis.forEach(x => {
                const name = x.getAttribute("name");
                if (col_names.includes(name) || x.getAttribute("aggregate") === "custom") {
                    remove_children.push(x);
                } else {
                    col_names.push(name)
                }
                // set attribute new_base_name
                x.setAttribute("new_base_name", name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(name));
                x.setAttribute("alias_name", this._get_dname_name(name));
            });
            inactive_remove_children.forEach(x => this._pivotList.removeInactiveRow(x));
            remove_children.forEach(x => this._pivotList.removeActiveRow(x));
            this._pivotList.refresh();
            //columns = this._get_view_columns();
            this.setAttribute("agg-custom", JSON.stringify([]));
            // Reset Value area in case non-aggregation
            this._value_pivots.querySelector("ul").innerHTML = "";
            value_cols = [];
        }
        if (columns.length === lis.length) {
            this._pivotList.addClass("collapse");
        } else {
            this._pivotList.removeClass("collapse");
        }
        // if (columns.length == 0) {
        //     this._pivotList.addClassOfActive("hidden");
        // } else {
        //     this._pivotList.removeClassOfActive("hidden");
        // }

        let data_format = {};
        let aggregates = {};
        this.c_info.forEach(info => {
            data_format[info.name] = info.data_format;
            aggregates[info.name] = info.aggregate;
        });
        lis.forEach(x => {
            const colname = x.getAttribute("name");
            x.setAttribute("data_format", data_format[colname]);
            x.setAttribute("aggregate", aggregates[colname]);
        });

        this.columnViewUpdating = false;
    }

    _diff_computed_column_view(old_computed_columns, new_computed_columns) {
        const to_remove = [];
        const new_names = new_computed_columns.map(x => x.column);
        for (const column of old_computed_columns) {
            if (!new_names.includes(column.column)) {
                to_remove.push(column);
            }
        }
        return to_remove;
    }

    _reset_computed_column_view(computed_columns) {
        if (!computed_columns || computed_columns.length === 0) {
            return;
        }

        const computed_names = computed_columns.map(x => x.column);

        // Remove computed columns from all
        const filtered_active = this._get_view_active_column_names().filter(x => !computed_names.includes(x));

        const aggregates = this._get_view_aggregates().filter(x => !computed_names.includes(x.column));
        const rp = this._get_view_row_pivots().filter(x => !computed_names.includes(x));
        const cp = this._get_view_column_pivots().filter(akzzzzzx => !computed_names.includes(x));
        const sort = this._get_view_sorts().filter(x => !computed_names.includes(x[0]));
        const filters = this._get_view_filters().filter(x => !computed_names.includes(x[0]));

        // Aggregates as an array is from the attribute API
        this.set_aggregate_attribute(aggregates);

        this.setAttribute("columns", JSON.stringify(filtered_active));
        this.setAttribute("row-pivots", JSON.stringify(rp));
        this.setAttribute("column-pivots", JSON.stringify(cp));
        this.setAttribute("sort", JSON.stringify(sort));
        this.setAttribute("filters", JSON.stringify(filters));

        // Remove inactive computed columns
        const inactive_computed = this._get_view_all_columns().filter(x => x.classList.contains("computed"));

        for (const col of inactive_computed) {
            this._inactive_columns.removeChild(col);
        }

        // Re-check on whether to collapse inactive columns
        const pop_cols = this._get_view_active_columns().filter(x => typeof x !== "undefined" && x !== null);
        const lis = this._get_view_inactive_columns();

        if (pop_cols.length === lis.length) {
            this._inactive_columns.parentElement.classList.add("collapse");
        } else {
            this._inactive_columns.parentElement.classList.remove("collapse");
        }
    }

    _update_computed_column_view(computed_schema) {
        
        const computed_columns = this._get_view_parsed_computed_columns();
        const columns = this._get_view_all_column_names();
        const active = this._get_view_active_column_names();

        console.log('_update_computed_column_view--------', this.get_cinfo(), columns);

        if (Object.keys(computed_schema).length === 0 || computed_columns.length === 0) {
            return;
        }

        let added_count = 0;

        const attr = JSON.parse(this.getAttribute("columns")) || [];
        let reset_columns_attr = false;

        console.log('---shown cols------', attr);

        for (const cc of computed_columns) {
            const name = cc.column;

            // Check for whether the computed column is in the attribute but
            // NOT in the DOM - occurs when restore is called and a race
            // condition between `computed-columns` and `columns` occurs.
            const should_reset = !columns.includes(name) && attr.includes(name);

            if (should_reset) {
                reset_columns_attr = true;
            }

            // If the column already exists or is already in the active DOM,
            // don't add it to the inactive DOM
            const should_add = !columns.includes(name) && !active.includes(name);

            if (!should_add) {
                continue;
            }
            const row = this._new_row(
                name, // name
                computed_schema[name], // type
                null, // agg 
                null, // data format
                null, // filter
                null, // sort
                name, // computed
                "inactive_columns");
            // this._pivotList.addInactiveRow(row, true);
            this._inactive_columns_frag.push(row);
            row.classList.add("active");
            
            const rowActive = this._new_row(
                name, // name
                computed_schema[name], // type
                null, // agg 
                null, // data format
                null, // filter
                null, // sort
                name, // computed
                "active_columns");
            this._pivotList.addActiveRow(rowActive, true);

            added_count++;
        }

        // if (reset_columns_attr) {
            // this._update_column_view(attr, true);
        // } else {
        //     // Remove collapse so that new inactive columns show up
        //     if (added_count > 0 && this._inactive_columns.parentElement.classList.contains("collapse")) {
        //         this._inactive_columns.parentElement.classList.remove("collapse");
        //     }
        // }
    }

    _update_column_view(columns, reset = false) {

        if(this.columnViewUpdating) {
            return;
        }
        this.columnViewUpdating = true;

        var value_cols = [];
        const lis = this._get_view_dom_columns("#inactive_columns perspective-row");
        const active_lis = this._get_view_dom_columns("#active_columns perspective-row");
        var is_row_pivot = this.is_row_pivot();
        var is_column_pivot = this.is_column_pivot();
        var is_value_pivot = this.is_value_pivot();
        // Show/Hide dropdown for nested/flat mode
        /*if (is_row_pivot && !is_column_pivot) {
            this._pivot_view_group.style.display = "inline-block";
        } else if (this._pivot_view_group.style.display != "none") {
            this._pivot_view_group.style.display = "none";
            //this.setAttribute("pivot_view_mode", 0);
        }*/

        if (is_row_pivot || is_column_pivot || is_value_pivot) {
            // Action for active columns
            var colnames = [];
            var remove_children = [];
            var show_period = this._visible_column_period();
            active_lis.forEach(x => {
                // Check show/hide show as value
                if (x.shadowRoot) {
                    x.shadowRoot.querySelector("#column_show_type").style.display = this._visible_column_show_type(x) ?
                    "inline-block" : "none";
                    x.shadowRoot.querySelector("#column_period").style.display = show_period ? "inline-block" : "none";
                }

                var name = x.getAttribute("name");
                var new_base_name = this._get_disp_name_aggregate(name, x.getAttribute("aggregate"), x.getAttribute("period"),
                                        this._get_column_show_type(x));

                if (!this._valid_active_columns(name) || colnames.includes(name) || (!is_row_pivot && x.getAttribute("aggregate") === "custom")) {
                    remove_children.push(x);
                }
                //colnames.push(new_base_name);
                colnames.push(name);
                if (x.hasAttribute("computed_column")) {
                    var computed_column = JSON.parse(x.getAttribute("computed_column"));
                    if (typeof computed_column === "string") {
                        computed_column = JSON.parse(computed_column);
                    }
                    x.classList.add("computed");
                    if (computed_column.is_pivot) {
                        x.classList.add("computed-pivot");
                    }
                }
                // set attribute new_base_name
                x.setAttribute("new_base_name", new_base_name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(new_base_name));
                x.setAttribute("alias_name", this._get_dname_name(name));
            });
            // Remove items in active elemenst
            remove_children.forEach(x => this._pivotList.removeActiveRow(x));
            this._pivotList.refresh();

            // Action for inactive columns
            var inactive_remove_children = [];
            colnames = [];
            var computed_columns = this._get_computed_columns();
            var current_columns = columns || this._get_view_column_base_names();
            lis.forEach(x => {
                var name = x.getAttribute("name");
                const index = current_columns.indexOf(name);
                //if ((index !== -1 || colnames.includes(name) || computed_columns.includes(name)) && x.classList.contains("computed-pivot")) {
                if (index !== -1 || computed_columns.includes(name)) {
                    x.classList.add("active");
                } else {
                    colnames.push(name);
                    x.classList.remove("active");
                }
                if (!is_row_pivot && x.getAttribute("aggregate") === "custom") {
                    inactive_remove_children.push(x);
                }
                // set attribute new_base_name
                x.setAttribute("new_base_name", name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(name));
                x.setAttribute("alias_name", this._get_dname_name(name));
            });

            // Action for values list
            const value_list = this._get_view_dom_columns("#value_pivots perspective-row");
            colnames = [];
            var value_remove_children = [];
            value_list.forEach(x => {
                var new_base_name = this._get_disp_name_aggregate(x.getAttribute("name"), x.getAttribute("aggregate"),
                                x.getAttribute("period"), this._get_column_show_type(x));
                if ((colnames.includes(new_base_name) || x.getAttribute("aggregate") === "custom")) {
                    value_remove_children.push(x);
                } else {
                    value_cols.push({n: x.getAttribute("name"),
                        t: x.getAttribute("type"),
                        agg: x.getAttribute("aggregate"),
                        df: x.getAttribute("data_format"),
                        st: x.getAttribute("show_type"),
                        p: x.getAttribute("period") || "none",
                        drag_id: x.getAttribute("drag_id"),
                        base_name: x.getAttribute("new_base_name"),
                        dname: x.getAttribute("dname")
                    });
                }
                colnames.push(new_base_name);
                if (x.hasAttribute("computed_column")) {
                    var computed_column = JSON.parse(x.getAttribute("computed_column"));
                    if (typeof computed_column === "string") {
                        computed_column = JSON.parse(computed_column);
                    }
                    x.classList.add("computed");
                    if (computed_column.is_pivot) {
                        x.classList.add("computed-pivot");
                    }
                }
                // set attribute new_base_name
                x.setAttribute("new_base_name", new_base_name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(new_base_name));
                x.setAttribute("alias_name", this._get_dname_name(x.getAttribute("name")));
            });
            if (!columns) {
                //columns = this._get_view_columns();
                columns = this._get_view_column_base_names();
            }
            inactive_remove_children.forEach(x => this._pivotList.removeInactiveRow(x));
            this._pivotList.refresh();
            var value_inner = this._value_pivots.querySelector("ul");
            value_remove_children.forEach(x => value_inner.removeChild(x));
            this.setAttribute("agg-custom", JSON.stringify([]));
        } else {
            if (!columns) {
                //columns = this._get_view_columns();
                columns = this._get_view_column_base_names();
            }
            var inactive_remove_children = [];
            lis.forEach(x => {
                var name = x.getAttribute("name");
                const index = columns.indexOf(x.getAttribute("name"));
                if (x.getAttribute("aggregate") === "custom") {
                    inactive_remove_children.push(x);
                }
                if (index === -1) {
                    x.classList.remove("active");
                } else {
                    x.classList.add("active");
                }

                // set attribute new_base_name
                x.setAttribute("new_base_name", name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(name));
                x.setAttribute("alias_name", this._get_dname_name(name));
            });
            var col_names = [];
            var remove_children = [];
            active_lis.forEach(x => {
                const name = x.getAttribute("name");
                if (col_names.includes(name) || x.getAttribute("aggregate") === "custom") {
                    remove_children.push(x);
                } else {
                    col_names.push(name)
                }
                // set attribute new_base_name
                x.setAttribute("new_base_name", name);
                // set attribute dname
                x.setAttribute("dname", this._get_dname_name(name));
                x.setAttribute("alias_name", this._get_dname_name(name));

                // set attribute for sort
                let c_index = this.c_info.findIndex(f => name === f.name);
                if (c_index !== -1) {
                    let sort_order = this.c_info[c_index].sort_order;
                    let sort_num = this.c_info[c_index].sort_num;
                    if (!sort_order || sort_order === "null" || sort_order === "undefined") {
                        x.removeAttribute("sort_order");
                    } else {
                        x.setAttribute("sort_order", sort_order);
                    }
                    if (!sort_num || sort_num === "null" || sort_num === "undefined") {
                        x.removeAttribute("sort_num");
                    } else {
                        x.setAttribute("sort_num", sort_num);
                    }
                }
            });
            inactive_remove_children.forEach(x => this._pivotList.removeInactiveRow(x));
            remove_children.forEach(x => this._pivotList.removeActiveRow(x));
            this._pivotList.refresh();
            //columns = this._get_view_columns();
            this.setAttribute("agg-custom", JSON.stringify([]));
            // Reset Value area in case non-aggregation
            this._value_pivots.querySelector("ul").innerHTML = "";
            value_cols = [];
        }
        if (columns.length === lis.length) {
            this._pivotList.addClass("collapse");
        } else {
            this._pivotList.removeClass("collapse");
        }
        if (columns.length == 0) {
            this._pivotList.addClassOfActive("hidden");
        } else {
            this._pivotList.removeClassOfActive("hidden");
        }

        let data_format = {};
        let aggregates = {};
        this.c_info.forEach(info => {
            data_format[info.name] = info.data_format;
            aggregates[info.name] = info.aggregate;
        });
        lis.forEach(x => {
            const colname = x.getAttribute("name");
            x.setAttribute("data_format", data_format[colname]);
            x.setAttribute("aggregate", aggregates[colname]);
        });
        // Update dropdown items per page
        this._update_items_per_page();
        if (reset) {
            // Set attributes should be called only once, not for every column.
            this.setAttribute("columns", JSON.stringify(columns));
            this._update_column_hyperlist(columns, "active_columns", name => {
                const ref = lis.find(x => x.getAttribute("name") === name);
                if (ref) {
                    this.columnViewUpdating = false;
                    // data_format and aggregate were already calculated above.
                    return this._new_row(ref.getAttribute("name"), ref.getAttribute("type"), ref.getAttribute("aggregate"), ref.getAttribute("data_format"), undefined, undefined, ref.getAttribute("computed_column"), "active_columns");
                }
            });
        }
        this.setAttribute("columns", JSON.stringify(columns));
        this.setAttribute("value-pivots", JSON.stringify(value_cols));
        this.columnViewUpdating = false;
    }

    // Only for _active_columns instead of _update_column_list
    _update_column_hyperlist(columns, container_name, callback, accessor) {
        let active_columns = [];
        if (container_name == 'active_columns') {
            active_columns = this._pivotList.getActiveCols(true);
        }
        else if (container_name == 'inactive_columns') {
            console.error('Unexpected case - please confirm again');
            return;
        }

        accessor = accessor || ((x, y) => {
            if (x && (container_name === "row-pivots" || container_name === "column-pivots")) {
                return y.getAttribute("name") === x.n
            } else {
                return y.getAttribute("name") === x
            }
        });

        for (let i = 0, j = 0; i < active_columns.length || j < columns.length; i++, j++) {
            const name = columns[j];

            const col = active_columns[i];
            const next_col = active_columns[i + 1];
            if (!col) {
                const node = callback(name);
                if (node) {
                    this._pivotList.addActiveRow(node);
                }
            } else if (typeof name === "undefined") {
                this._pivotList.removeActiveRow(col);
            } else if (!accessor(name, col)) {
                if (next_col && accessor(name, next_col)) {
                    this._pivotList.removeActiveRow(col);
                    i++;
                } else {
                    const node = callback(name);
                    if (node) {
                        this._pivotList.insertActiveRowBefore(node, col);
                        i--;
                    }
                }
            }
        }
    }

    _update_column_list(columns, container, callback, accessor) {
        var container_name = container.getAttribute("for");
        accessor = accessor || ((x, y) =>{
          if (x && (container_name === "row-pivots" || container_name === "column-pivots")){
            return y.getAttribute("name") === x.n
          }else{
            return y.getAttribute("name") === x
          }
        });
        const active_columns = Array.prototype.slice.call(container.children);
        for (let i = 0, j = 0; i < active_columns.length || j < columns.length; i++, j++) {
            const name = columns[j];
            /*var name = undefined;
            if (container_name === "row-pivots" || container_name === "column-pivots"){
              name = columns[j] !== undefined ? columns[j].n : undefined;
            }else{
              name = columns[j];
            }*/
            const col = active_columns[i];
            const next_col = active_columns[i + 1];
            if (!col) {
                const node = callback(name);
                if (node) {
                    container.appendChild(node);
                }
            } else if (typeof name === "undefined") {
                container.removeChild(col);
            } else if (!accessor(name, col)) {
                if (next_col && accessor(name, next_col)) {
                    container.removeChild(col);
                    i++;
                    //  j--;
                } else {
                    const node = callback(name);
                    if (node) {
                        container.insertBefore(node, col);
                        i--;
                    }
                }
            }
        }
    }

    _has_combined_column() {
        var combined_index = Array.prototype.slice.call(this._row_pivots.querySelector("ul").children)
            .findIndex(x => x.getAttribute("type") === perspective.COMBINED_TYPE_STR);
        if (combined_index === -1) {
            combined_index = Array.prototype.slice.call(this._column_pivots.querySelector("ul").children)
                .findIndex(x => x.getAttribute("type") === perspective.COMBINED_TYPE_STR);
            if (combined_index === -1) {
                return false;
            }
        }
        return true;
    }

    _update_combined_column() {
        this._force_to_fetch_only = true;
        if (this.is_cinfo_pivot(false)) {
            // Case 1: remove combined column
            if (this._value_pivots.querySelector("ul").children.length <= 1) {
                var remove_children = [];
                this._get_view_dom_columns("#row_pivots perspective-row").forEach(x => {
                    if (x.getAttribute("type") === perspective.COMBINED_TYPE_STR) {
                        remove_children.push(x);
                    }
                });
                if (remove_children.length > 0) {
                    remove_children.forEach(x => this._row_pivots.querySelector("ul").removeChild(x));

                    var row_pivots = JSON.parse(this.getAttribute("row-pivots"));
                    //this.setAttribute("row-pivots", JSON.stringify(row_pivots.filter(x => x !== perspective.COMBINED_NAME)));
                    this.setAttribute("row-pivots", JSON.stringify(row_pivots.filter((v) => v.n !== perspective.COMBINED_NAME)));
                } else {
                    remove_children = [];
                    this._get_view_dom_columns("#column_pivots perspective-row").forEach(x => {
                        if (x.getAttribute("type") === perspective.COMBINED_TYPE_STR) {
                            remove_children.push(x);
                        }
                    });
                    if (remove_children.length > 0) {
                        remove_children.forEach(x => this._column_pivots.querySelector("ul").removeChild(x));

                        var column_pivots = JSON.parse(this.getAttribute("column-pivots"));
                        //this.setAttribute("column-pivots", JSON.stringify(column_pivots.filter(x => x !== perspective.COMBINED_NAME)));
                        this.setAttribute("column-pivots", JSON.stringify(column_pivots.filter((v) => v.n !== perspective.COMBINED_NAME)));
                    }
                }
            }
            // Case 2: add combined column if not existed
            else {
                var combined_index = Array.prototype.slice.call(this._row_pivots.querySelector("ul").children)
                    .findIndex(x => x.getAttribute("type") === perspective.COMBINED_TYPE_STR);
                if (combined_index === -1) {
                    combined_index = Array.prototype.slice.call(this._column_pivots.querySelector("ul").children)
                        .findIndex(x => x.getAttribute("type") === perspective.COMBINED_TYPE_STR);
                    if (combined_index === -1) {
                        // Default add to column pivots container
                        var column_pivots = JSON.parse(this.getAttribute("column-pivots"));
                        if (!this.is_flat_pivot(false)) {
                            column_pivots.push({
                                n: perspective.COMBINED_NAME,
                                dname: this._get_dname_name(perspective.COMBINED_NAME),
                                drag_id: this._generage_drag_id()
                            });
                        }
                        this.setAttribute("column-pivots", JSON.stringify(column_pivots));
                    }
                }
            }
        } else {
            this.setAttribute("column-pivots", JSON.stringify([]));
            this.setAttribute("row-pivots", JSON.stringify([]));
        }
        this._force_to_fetch_only = false;
    }

    is_flat_pivot(current = true){
        var nested_or_flat_mode = this._get_pivot_view(current);

        if (nested_or_flat_mode && nested_or_flat_mode === 1){
            return true;
        }

        return false;
    }

    is_nested_pivot(current = true){
      var nested_or_flat_mode = this._get_pivot_view(current);

      if (!nested_or_flat_mode || nested_or_flat_mode === 0){

          // Nested mode
          return true;
      }

      return false;
    }

    _set_row_styles() {
        let style = "";
        if (this._plugin.initial && this._plugin.initial.names) {
            for (const nidx in this._plugin.initial.names) {
                const name = this._plugin.initial.names[nidx];
                style += `#active_columns perspective-row:nth-child(${parseInt(nidx) + 1}){margin-top:23px;}`;
                style += `#active_columns perspective-row:nth-child(${parseInt(nidx) + 1}):before{content:"${name}";}`;
            }
        }
        this.shadowRoot.querySelector("#psp_styles").innerHTML = style;
    }

    _show_column_selectors() {
        this.shadowRoot.querySelector("#columns_container").style.visibility = "visible";
        this.shadowRoot.querySelector("#side_panel__actions").style.visibility = "visible";
    }

    // set viewer state
    _set_column_defaults() {
        let cols = this._get_view_dom_columns("#inactive_columns perspective-row");
        let active_cols = this._get_view_dom_columns();
        if (cols.length > 0) {
            if (this._plugin.initial) {
                let pref = [];
                let count = this._plugin.initial.count || 2;
                if (active_cols.length === count) {
                    pref = active_cols.map(x => x.getAttribute("name"));
                } else if (active_cols.length < count) {
                    pref = active_cols.map(x => x.getAttribute("name"));
                    this._fill_numeric(cols, pref);
                    if (pref.length < count) {
                        this._fill_numeric(cols, pref, true);
                    }
                } else {
                    if (this._plugin.initial.type === "number") {
                        this._fill_numeric(active_cols, pref);
                        if (pref.length < count) {
                            this._fill_numeric(cols, pref);
                        }
                        if (pref.length < count) {
                            this._fill_numeric(cols, pref, true);
                        }
                    }
                }
                this.setAttribute("columns", JSON.stringify(pref.slice(0, count)));
            } else if (this._plugin.selectMode === "select") {
                this.setAttribute("columns", JSON.stringify([cols[0].getAttribute("name")]));
            }
        }
    }

    _fill_numeric(cols, pref, bypass = false) {
        for (let col of cols) {
            let type = col.getAttribute("type");
            let name = col.getAttribute("name");
            if (bypass || (["float", "integer"].indexOf(type) > -1 && pref.indexOf(name) === -1)) {
                pref.push(name);
            }
        }
    }

    _check_responsive_layout() {
        if (this.clientHeight < 500 && this._get_view_columns({active: false}).length > this._get_view_columns().length) {
            this.shadowRoot.querySelector("#app").classList.add("columns_horizontal");
        } else {
            this.shadowRoot.querySelector("#app").classList.remove("columns_horizontal");
        }
    }

    _update_run_query_button(active = false) {
        if (active) {
            //this._vis_run_query.classList.add("hightlight");
            this._run_auto_query.classList.remove("inactive");
            this._cb_run_auto_query.classList.remove("inactive");
        } else {
            //this._vis_run_query.classList.remove("hightlight");
            this._run_auto_query.classList.add("inactive");
            this._cb_run_auto_query.classList.add("inactive");
        }
    }

    _update_disabled_aggregate_level(name) {
        var existed_agg_levels = this._get_existed_agg_level(name);
        var column_elems = this._get_view_dom_columns("#row_pivots perspective-row")
            .concat(this._get_view_dom_columns("#column_pivots perspective-row"))
            .filter(function(col) { return col.getAttribute("name") === name; });
        var pr_settings = this._get_view_dom_columns("#psp_popup_data perspective-row-settings") || [];
        pr_settings = pr_settings.filter((v)=>v.getAttribute("name") === name && (v.getAttribute("container") === "row_pivots" || v.getAttribute("container") === "column_pivots"));

        if (pr_settings && pr_settings.length > 0){
          column_elems = column_elems.concat(pr_settings);
        }
        column_elems.forEach(col => {
            col._update_disable_aggregate_levels(existed_agg_levels);
        });
    }

    _update_default_binning_params(name, pr_settings) {
        this._get_default_binning(name).then(result => {
            pr_settings.setAttribute("default_binning", JSON.stringify(result));
        });
    }

    /**
     * update style for redo/undo buttons
     */
    _update_redo_undo_button() {
        //Undo button
        if (this.redo_undo_manager.can_undo) {
            this._vis_undo_button.classList.add("hightlight");
            this._vis_undo_button.disabled = false;
        } else {
            this._vis_undo_button.classList.remove("hightlight");
            this._vis_undo_button.disabled = true;
        }

        //Redo button
        if (this.redo_undo_manager.can_redo) {
            this._vis_redo_button.classList.add("hightlight");
            this._vis_redo_button.disabled = false;
        } else {
            this._vis_redo_button.classList.remove("hightlight");
            this._vis_redo_button.disabled = true;
        }
    }

    // setup functions
    _register_ids() {
        this._aggregate_selector = this.shadowRoot.querySelector("#aggregate_selector");
        this._vis_selector = this.shadowRoot.querySelector("#vis_selector");
        this._filters = this.shadowRoot.querySelector("#filters");

        // Search box at top content
        this._searchs = this.shadowRoot.querySelector("#searchs");
        this._search_container = this.shadowRoot.querySelector("#search_container");
        this._search_icon = this.shadowRoot.querySelector("#search_icon");
        this._search_input_id = this.shadowRoot.querySelector("#search_input_id");
        //this._searchs_input_class = this.shadowRoot.querySelector(".psp-text-field__input-searchs");
        this._search_option_icon = this.shadowRoot.querySelector("#search_option_icon"); // Three dots

        // Available fields
        this._search_fields = this.shadowRoot.querySelector("#search_fields");
        this._search_fields_icon = this.shadowRoot.querySelector("#search_fields_icon");
        this._row_pivots = this.shadowRoot.querySelector("#row_pivots");
        this._column_pivots = this.shadowRoot.querySelector("#column_pivots");
        this._datavis = this.shadowRoot.querySelector("#pivot_chart");
        this._side_panel_actions = this.shadowRoot.querySelector("#side_panel__actions");
        this._add_computed_column = this.shadowRoot.querySelector("#add-computed-column");
        this._add_export_csv = this.shadowRoot.querySelector("#add-export-csv");
        this._add_export_excel = this.shadowRoot.querySelector("#add-export-excel");
        this._add_export_json = this.shadowRoot.querySelector("#add-export-json");
        this._computed_column = this.shadowRoot.querySelector("perspective-computed-column");
        this._formula_bar = this.shadowRoot.querySelector("perspective-formula-bar");
        this._formula_helper = this.shadowRoot.querySelector("perspective-formula-helper");
        this._formula_bar.setFormulaHelper(this._formula_helper);
        this._formula_bar.setViewer(this);
        
        this._computed_column_inputs = this._computed_column.querySelector("#psp-cc-computation-inputs");
        this._inner_drop_target = this.shadowRoot.querySelector("#drop_target_inner");
        this._drop_target = this.shadowRoot.querySelector("#drop_target");
        this._config_button = this.shadowRoot.querySelector("#config_button");
        this._config_button_container = this.shadowRoot.querySelector("#config_button_container");
        this._config_button_tooltip = this.shadowRoot.querySelector("#config_button_tooltip");
        // this._formula_input_box = this.shadowRoot.querySelector("#formula-input-box");
        this._config_button_x = this.shadowRoot.querySelector("#config_button_x");
        this._config_button_newdesign = this.shadowRoot.querySelector("#config_button_newdesign");
        this._sp_perspective = this.shadowRoot.querySelector("#sp_perspective");
        this._reset_button = this.shadowRoot.querySelector("#reset_button");
        this._download_button = this.shadowRoot.querySelector("#download_button");
        this._copy_button = this.shadowRoot.querySelector("#copy_button");
        this._side_panel = this.shadowRoot.querySelector("#side_panel");
        this._top_panel = this.shadowRoot.querySelector("#top_panel");
        this._sort = this.shadowRoot.querySelector("#sort");
        this._transpose_button = this.shadowRoot.querySelector("#transpose_button");
        this._plugin_information = this.shadowRoot.querySelector(".plugin_information");
        this._plugin_information_action = this.shadowRoot.querySelector(".plugin_information__action");
        this._plugin_information_dismiss = this.shadowRoot.querySelector(".plugin_information__action--dismiss");
        this._plugin_information_message = this.shadowRoot.querySelector("#plugin_information_count");
        this._pivot_file_zone_container = this.shadowRoot.querySelector("#pivot_file_zone_container");
        this._pivot_header_container = this.shadowRoot.querySelector("#pivot_header_container");
        this._pivot_input_file = this.shadowRoot.querySelector("#pivot_input_file");
        this._pivot_drop_file_area = this.shadowRoot.querySelector("#pivot_chart");
        this._pivot_drop_file_area_highlight = this.shadowRoot.querySelector("#pivot_drop_file_area_highlight");
        this._pivot_ingesting_data_percentage = this.shadowRoot.querySelector("#pivot_ingesting_data_percentage");
        this._pivot_ingesting_bar = this.shadowRoot.querySelector("#pivot_ingesting_bar");

        this._pivot_ingesting_label = this.shadowRoot.querySelector("#pivot_ingesting_label");

        this._pivot_drop_file_area_error = this.shadowRoot.querySelector("#pivot_drop_file_area_error");
        this._pivot_loading_data_cancel = this.shadowRoot.querySelector("#pivot_loading_data_cancel");
        this._pivot_loading_data_finalizing = this.shadowRoot.querySelector("#pivot_loading_data_finalizing");
        this._pivot_tabs_bar = this.shadowRoot.querySelector("#pivot_tabs_bar");
        this._tabs_bar_progress = this.shadowRoot.querySelector("#tabs_bar_progress");
        this._tabs_bar_progress_bar = this.shadowRoot.querySelector("#tabs_bar_progress_bar");
        this._pivot_tabs_bar_msg = this.shadowRoot.querySelector("#pivot_tabs_bar_msg");
        this._pivot_tabs_bar_source = this.shadowRoot.querySelector("#pivot_tabs_bar_source");
        this._pivot_tabs_bar_autoquery = this.shadowRoot.querySelector("#pivot_tabs_bar_autoquery");
        this._pivot_tabs_bar_dimension = this.shadowRoot.querySelector("#pivot_tabs_bar_dimension");
        this._pivot_tabs_bar_avg = this.shadowRoot.querySelector("#pivot_tabs_bar_avg");
        this._pivot_tabs_bar_count = this.shadowRoot.querySelector("#pivot_tabs_bar_count");
        this._pivot_tabs_bar_sum = this.shadowRoot.querySelector("#pivot_tabs_bar_sum");
        this._pivot_tabs_bar_zoom = this.shadowRoot.querySelector("#pivot_tabs_bar_zoom");
        this._pivot_zoom_in_btn = this.shadowRoot.querySelector("#pivot_zoom_in_btn");
        this._pivot_zoom_out_btn = this.shadowRoot.querySelector("#pivot_zoom_out_btn");
        this._zoomer_percent = this.shadowRoot.querySelector("#zoomer_percent");
        this._zoomer = this.shadowRoot.querySelector("#zoomer");

        this._pivot_querying_percentage = this.shadowRoot.querySelector("#pivot_querying_percentage");
        this._pivot_querying_cancel = this.shadowRoot.querySelector("#pivot_querying_cancel");
        this._pivot_querying_bar = this.shadowRoot.querySelector("#pivot_querying_bar");

        this._pivot_error_message_id = this.shadowRoot.querySelector("#pivot_error_message_id");

        //this._vis_auto_query = this.shadowRoot.querySelector("#vis_auto_query");
        this._auto_query_checkbox = this.shadowRoot.querySelector("#auto_query_checkbox");
        //this._vis_run_query = this.shadowRoot.querySelector("#run-query-button");
        this._run_auto_query = this.shadowRoot.querySelector("#run_auto_query");

        this._cb_run_auto_query_tooltip = this.shadowRoot.querySelector("#cb_run_auto_query_tooltip");
        this._cb_run_auto_query = this.shadowRoot.querySelector("#cb_run_auto_query");

        this._vis_max_col = this.shadowRoot.querySelector("#vis_max_col");
        this._vis_max_row = this.shadowRoot.querySelector("#vis_max_row");
        //this._vis_pivot_view = this.shadowRoot.querySelector("#vis_pivot_view");
        this._flatten_agg_view = this.shadowRoot.querySelector("#flatten_agg_view");
        //this._pivot_view_group = this.shadowRoot.querySelector("#pivot_view_group");
        this._value_pivots = this.shadowRoot.querySelector("#value_pivots");

        this._powers = this.shadowRoot.querySelector("#powers");

        this._checkall_fields = this.shadowRoot.querySelector("#checkall_fields");
        this._checkall_fields_checkmark = this.shadowRoot.querySelector("#checkall_fields_checkmark");

        //pagination group
        this._pagination_group = this.shadowRoot.querySelector("#pagination_group");
        this._page_item_group = this.shadowRoot.querySelector("#page_item_group");
        this._vis_page_item = this.shadowRoot.querySelector("#vis_page_item");
        this._pagination_page_number = this.shadowRoot.querySelector("#pagination_page_number");
        this._pagination_back_button = this.shadowRoot.querySelector("#pagination-back-button");
        this._pagination_forward_button = this.shadowRoot.querySelector("#pagination-forward-button");

        //Redo/Undo group
        this._vis_redo_button = this.shadowRoot.querySelector("#vis-redo-button");
        this._vis_undo_button = this.shadowRoot.querySelector("#vis-undo-button");

        this._psp_popup_outbound = this.shadowRoot.querySelector("#psp_popup_outbound");
        this._psp_popup = this.shadowRoot.querySelector("#psp_popup");
        this._psp_popup_container = this.shadowRoot.querySelector("#psp_popup_container");
        this._psp_popup_data = this.shadowRoot.querySelector("#psp_popup_data");
        this._psp_popup_button_x_container = this.shadowRoot.querySelector("#psp_popup_button_x_container");
        this._psp_popup_button_x = this.shadowRoot.querySelector("#psp_popup_button_x");
        this._psp_popup_title = this.shadowRoot.querySelector("#psp_popup_title");
        this._psp_popup_header_container = this.shadowRoot.querySelector("#psp_popup_header_container");
        this._psp_popup_header_content = this.shadowRoot.querySelector("#psp_popup_header_content");

        this._psp_popup_sheet = this.shadowRoot.querySelector("#psp_popup_sheet");
        this._psp_popup_sheet_data = this.shadowRoot.querySelector("#psp_popup_sheet_data");
        this._psp_popup_sheet_button_x = this.shadowRoot.querySelector("#psp_popup_sheet_button_x");
        //this._psp_popup_sheet_button_back = this.shadowRoot.querySelector("#psp_popup_sheet_button_back");
        this._psp_popup_sheet_title = this.shadowRoot.querySelector("#psp_popup_sheet_title");
        this._psp_popup_sheet_back_container = this.shadowRoot.querySelector("#psp_popup_sheet_back_container");

        this._psp_tooltip = this.shadowRoot.querySelector("#psp_tooltip");

        //this._available_fields_container = this.shadowRoot.querySelector("#available_fields_columns");

        this._available_fields_container = this.shadowRoot.querySelector("#available_fields_container");
        this._available_fields_columns = this.shadowRoot.querySelector("#available_fields_columns");

        // Rows, Columns, Values and Filters Cautions
        this._row_pivot_caution = this.shadowRoot.querySelector("#row_pivot_caution");
        this._column_pivot_caution = this.shadowRoot.querySelector("#column_pivot_caution");
        this._value_pivot_caution = this.shadowRoot.querySelector("#value_pivot_caution");
        this._filter_caution = this.shadowRoot.querySelector("#filter_caution");

        this._resize_panel_shield = this.shadowRoot.querySelector("#resize_panel_shield");
        this._resize_panel_container = this.shadowRoot.querySelector("#resize_panel_container");
        this._resize_panel_bottom_content = this.shadowRoot.querySelector("#resize_panel_bottom_content");

        this._row_col_blocks = this.shadowRoot.querySelector("#row_col_blocks");
        this._value_filter_blocks = this.shadowRoot.querySelector("#value_filter_blocks");

        if (!this._pivotList) {
            this._pivotList = new PivotList(this);
        }
    }

    // sets state, manipulates DOM
    _register_view_options() {
        let current_renderers = renderers.getInstance();
        for (let name in current_renderers) {
            const display_name = current_renderers[name].name || name;
            const opt = `<option value="${name}">${display_name}</option>`;
            this._vis_selector.innerHTML += opt;
        }
    }

    // sets state
    _register_data_attribute() {
        // TODO this feature needs to become a real attribute.
        if (this.getAttribute("data")) {
            let data = this.getAttribute("data");
            try {
                data = JSON.parse(data);
            } catch (e) {}
            this.load(data);
        }
    }

    /*load_auto_query_options() {
        this._vis_auto_query.innerHTML = `<option value="on" selected>On</option>`;
        this._vis_auto_query.innerHTML += `<option value="off">Off</option>`;
    }*/

    load_max_col_options() {
        this._vis_max_col.innerHTML = `<option value="2000" selected>2000</option>`;
        this._vis_max_col.innerHTML += `<option value="0">no-limit</option>`;
    }

    load_max_row_options() {
        this._vis_max_row.innerHTML = `<option value="1000">1000</option>`;
        this._vis_max_row.innerHTML += `<option value="0" selected>no-limit</option>`;
    }

    /*load_pivot_view_options() {
        this._vis_pivot_view.innerHTML = `<option value="0">Nested mode</option>`;
        this._vis_pivot_view.innerHTML += `<option value="1">Flat mode</option>`;
    }*/

    load_page_item_options() {
        var page_items = ["--", 1, 50, 100, 500, 1000];
        this._vis_page_item.innerHTML = page_items.map(option => `<option value="${option}">${option}</option>`).join("");
    }
}
