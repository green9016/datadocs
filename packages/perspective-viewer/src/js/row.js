/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import _ from "lodash";

import Awesomplete from "awesomplete";
import awesomplete_style from "!!css-loader!awesomplete/awesomplete.css";

import {bindTemplate} from "./utils.js";

import perspective from "@jpmorganchase/perspective";
import template from "../html/row.html";

import style from "../less/row.less";

function get_text_width(text, max = 0) {
    let span = document.createElement("span");
    // FIXME get these values form the stylesheet
    span.style.visibility = "hidden";
    span.style.fontFamily = "monospace";
    span.style.fontSize = "12px";
    span.style.position = "absolute";
    span.innerHTML = text;
    document.body.appendChild(span);
    let width = `${Math.max(max, span.offsetWidth) + 20}px`;
    document.body.removeChild(span);
    return width;
}

// Eslint complains here because we don't do anything, but actually we globally
// register this class as a CustomElement
@bindTemplate(template, {toString: () => style + "\n" + awesomplete_style}) // eslint-disable-next-line no-unused-vars
class Row extends HTMLElement {
    set name(n) {
        let elem = this.shadowRoot.querySelector("#name");
        elem.innerHTML = this.getAttribute("name");

        if (n === perspective.__FILTER_SEARCH__){
          //let dragable_id = this.shadowRoot.querySelector("#dragable_id");
          //dragable_id.setAttribute("draggable", false);
          //dragable_id.classList.add("search");
          //dragable_id.addEventListener("click", event => {
          //    this.dispatchEvent(new CustomEvent("clicked_search_item", {detail: event}));
          //});
          this.shadowRoot.querySelector("#alias_name").classList.add("colon-hidden");
          this.shadowRoot.querySelector("#v_name").classList.add("colon-hidden");
        }
    }

    set new_base_name(n) {
        /*let elem = this.shadowRoot.querySelector("#rename_field");
        elem.value = this.getAttribute("new_base_name");*/
    }

    set dname(n) {
        let elem = this.shadowRoot.querySelector("#rename_field");
        elem.value = this.getAttribute("dname");

        //let el_alias_name = this.shadowRoot.querySelector("#alias_name");
        //el_alias_name.innerHTML = this.getAttribute("dname");
    }

    set alias_name(value) {
        let el = this.shadowRoot.querySelector("#alias_name");
        if (value === perspective.GROUP_FILTER_ALIAS_NAME){
          el.innerHTML = "(" + value + ")";
        }else{
          el.innerHTML = this.getAttribute("alias_name");
        }
    }

    // item name in VALUES
    set vname(value) {
        let elem = this.shadowRoot.querySelector("#v_name");
        elem.innerHTML = this.getAttribute("vname");
    }

    set hname(n) {
        let elem = this.shadowRoot.querySelector("#name");
        elem.innerHTML = this.getAttribute("hname");
    }

    set type(t) {
        let elem = this.shadowRoot.querySelector("#name");
        let el_alias_name = this.shadowRoot.querySelector("#alias_name");
        let type = this.getAttribute("type");
        if (!type) return;
        elem.classList.add(type);
        el_alias_name.classList.add(type);
        let agg_dropdown = this.shadowRoot.querySelector("#column_aggregate");
        let show_type_dropdown = this.shadowRoot.querySelector("#column_show_type");
        let filter_dropdown = this.shadowRoot.querySelector("#filter_operator");
        let search_type_dropdown = this.shadowRoot.querySelector("#column_search_type");
        let data_format_dropdown = this.shadowRoot.querySelector("#column_data_format");
        let agg_level_dropdown = this.shadowRoot.querySelector("#aggregate_level");
        let limit_select_dropdown = this.shadowRoot.querySelector("#limit_select");
        let limit_type_dropdown = this.shadowRoot.querySelector("#limit_type_select");
        let period_dropdown = this.shadowRoot.querySelector("#column_period");
        limit_select_dropdown.innerHTML = ["none", 1, 2, 3, 6, 7, 8, 9, 10, 20, 30,
            40, 50, 60, 70, 80, 90, 100, 1000, 2000].map(option => `<option value="${option}">${option}</option>`).join("");
        limit_type_dropdown.innerHTML = ["Items", "Percent"].map(option => `<option value="${option}">${option}</option>`).join("");
        show_type_dropdown.innerHTML = ["default", "%_of_row", "%_of_column", "%_of_parent_row", "%_of_parent_column",
            "diff_from_prev_value", "%_of_prev_value", "running_total", "running_%", "%_of_grand_total"].map(option => `<option value="${perspective.SHOW_TYPE_SHOW_NAME[option]}">${option}</option>`).join("");
        period_dropdown.innerHTML = ["none", "previous"].map(option => `<option value="${option}">${option}</option>`).join("");
        switch (type) {
            case "float":
            case "integer":
            case "decimal":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.float.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.float.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.float.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.float.map(format => `<option value="${format}">${format}</option>`).join("");
                break;
            case "boolean":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.boolean.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.boolean.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.boolean.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.boolean.map(format => `<option value="${format}">${format}</option>`).join("");
                break;
            case "date":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.datetime.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.datetime.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.datetime.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.date.map(format => `<option value="${format}">${format}</option>`).join("");
                agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.date.map(level => { var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                break;
            case "datetime":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.datetime.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.datetime.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.datetime.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.datetime.map(format => `<option value="${format}">${format}</option>`).join("");
                agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.datetime.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                break;
            case "duration":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.datetime.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.datetime.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.datetime.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.duration.map(format => `<option value="${format}">${format}</option>`).join("");
                agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.duration.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                break;
            case "string":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.string.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.string.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.string.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.string.map(format => `<option value="${format}">${format}</option>`).join("");
                break;
            case "list_string":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.list_string.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.list_string.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.list_string.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.string.map(format => `<option value="${format}">${format}</option>`).join("");
                break;
            case "list_boolean":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.list_boolean.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.list_boolean.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.list_boolean.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.boolean.map(format => `<option value="${format}">${format}</option>`).join("");
                break;
            case "list_integer":
            case "list_float":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.list_float.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.list_float.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.list_float.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.float.map(format => `<option value="${format}">${format}</option>`).join("");
                break;
            case "list_date":
            case "list_datetime":
            case "list_duration":
                if (type === "list_date") {
                    data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.date.map(format => `<option value="${format}">${format}</option>`).join("");
                    agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.list_date.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                } else if (type === "list_datetime") {
                    data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.datetime.map(format => `<option value="${format}">${format}</option>`).join("");
                    agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.list_datetime.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`;}).join("");
                } else {
                    data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.duration.map(format => `<option value="${format}">${format}</option>`).join("");
                    agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.list_duration.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                }
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.list_datetime.map(agg => `<option value="${agg}">${agg}</option>`).join("");
                filter_dropdown.innerHTML = perspective.TYPE_FILTERS.list_datetime.map(op => `<option value="${op}">${op}</option>`).join("");
                search_type_dropdown.innerHTML = perspective.TYPE_SEARCH_TYPES.list_datetime.map(v => `<option value="${v.type}">${v.text}</option>`).join("");
                break;
            default:
        }
        if (!this.hasAttribute("aggregate")) {
            this.setAttribute("aggregate", perspective.AGGREGATE_DEFAULTS[type]);
        }
        let filter_operand = this.shadowRoot.querySelector("#filter_operand");
        this._callback = event => this._update_filter(event);
        filter_operand.addEventListener("keyup", this._callback.bind(this));
    }

    choices(choices) {
        let filter_operand = this.shadowRoot.querySelector("#filter_operand");
        let filter_operator = this.shadowRoot.querySelector("#filter_operator");
        new Awesomplete(filter_operand, {
            label: this.getAttribute("name"),
            list: choices,
            minChars: 0,
            filter: function(text, input) {
                return Awesomplete.FILTER_CONTAINS(text, input.match(/[^,]*$/)[0]);
            },
            item: function(text, input) {
                return Awesomplete.ITEM(text, input.match(/[^,]*$/)[0]);
            },
            replace: function(text) {
                let before = this.input.value.match(/^.+,\s*|/)[0];
                if (filter_operator.value === "in" || filter_operator.value === "not in" || filter_operator.value === "between") {
                    this.input.value = before + text + ", ";
                } else {
                    this.input.value = before + text;
                }
            }
        });
        filter_operand.addEventListener("awesomplete-selectcomplete", this._callback);
    }

    set filter(f) {
        const filter_dropdown = this.shadowRoot.querySelector("#filter_operator");
        const filter = JSON.parse(this.getAttribute("filter"))
            || {operator: perspective.FILTER_DEFAULTS[this.getAttribute("type")], operand: null};
        if (filter_dropdown.value !== filter.operator) {
            filter_dropdown.value = filter.operator || perspective.FILTER_DEFAULTS[this.getAttribute("type")];
        }
        filter_dropdown.style.width = get_text_width(filter_dropdown.value);
        const filter_input = this.shadowRoot.querySelector("#filter_operand");
        if (perspective.ONE_SIDE_OPERATOR.indexOf(this._filter_operator.value) !== -1) {
            filter_input.type = "hidden";
        } else {
            filter_input.type = "text";
        }
        const operand = filter.operand ? filter.operand.toString() : "";
        /*if (!this._initialized) {
            filter_input.value = operand;
        }*/
        filter_input.value = operand;
        filter_input.style.width = get_text_width(operand, 30);

        // Build filter summary
        this._build_filter_summary(filter);
    }

    set aggregate(a) {
        let agg_dropdown = this.shadowRoot.querySelector("#column_aggregate");
        let aggregate = this.getAttribute("aggregate");
        if (agg_dropdown.value !== aggregate && this.hasAttribute("type")) {
            let type = this.getAttribute("type");
            agg_dropdown.value = aggregate || perspective.AGGREGATE_DEFAULTS[type];
        }
    }

    set period(p) {
        let period_dropdown = this.shadowRoot.querySelector("#column_period");
        let period = this.getAttribute("period");
        if (period_dropdown.value !== period) {
            period_dropdown.value = period || "none";
        }
        var show_types = ["default", "%_of_row", "%_of_column", "%_of_parent_row", "%_of_parent_column",
        "diff_from_prev_value", "%_of_prev_value", "running_total", "running_%", "%_of_grand_total"];
        if (period === "previous") {
            show_types = ["default", "%_of_row", "%_of_column", "%_of_parent_row", "%_of_parent_column",
            "running_total", "running_%", "%_of_grand_total"];
        }
        let show_type_dropdown = this.shadowRoot.querySelector("#column_show_type");
        show_type_dropdown.innerHTML = show_types.map(option => `<option value="${option}">${perspective.SHOW_TYPE_SHOW_NAME[option]}</option>`).join("");
    }

    set show_type(s) {
        let show_type_dropdown = this.shadowRoot.querySelector("#column_show_type");
        let show_type = this.getAttribute("show_type");
        if (show_type_dropdown.value !== show_type) {
            show_type_dropdown.value = show_type || "default";
        }
    }

    set search_type(a) {
    }

    set data_format(a) {
        let data_format_dropdown = this.shadowRoot.querySelector("#column_data_format");
        let data_format = this.getAttribute("data_format");
        if (data_format_dropdown.value !== data_format && this.hasAttribute("type")) {
            let type = this.getAttribute("type");
            data_format_dropdown.value = data_format || perspective.DATA_FORMAT_DEFAULTS[type];
        }
    }

    set agg_level(a) {
        let agg_level_dropdown = this.shadowRoot.querySelector("#aggregate_level");
        let agg_level = this.getAttribute("agg_level");
        if (agg_level_dropdown.value !== agg_level && this.hasAttribute("type")) {
            let type = this.getAttribute("type");
            agg_level_dropdown.value = agg_level || perspective.AGGREGATE_LEVEL_DEFAULTS[type];
        }
    }

    set filter_by(value) {
        let filter_by_dropdown = this.shadowRoot.querySelector("#filter_by");
        let filter_by = this.getAttribute("filter_by");
        let name = this.getAttribute("name");
        if (filter_by_dropdown.value != filter_by) {
            filter_by_dropdown.value = filter_by;
        }
        filter_by_dropdown.style.width = get_text_width(filter_by);
        let filter_sublist = JSON.parse(this.getAttribute("filter_sublist"));
        if (filter_by != name && filter_sublist && filter_sublist.length > 0) {
            this._filter_subtotal_group.style.display = "inline";
        } else {
            this._filter_subtotal_group.style.display = "none";
        }
    }

    set filter_subtotal(value) {
        let filter_subtotal_dropdown = this.shadowRoot.querySelector("#filter_subtotal");
        let filter_subtotal = this.getAttribute("filter_subtotal");
        if (filter_subtotal_dropdown.value !== filter_subtotal) {
            filter_subtotal_dropdown.value = filter_subtotal;
        }
        filter_subtotal_dropdown.style.width = get_text_width(filter_subtotal);
    }

    set sort_by(value) {
        let sort_by_dropdown = this.shadowRoot.querySelector("#sort_by");
        let sort_by = this.getAttribute("sort_by");
        let name = this.getAttribute("name");
        if (sort_by_dropdown.value !== sort_by) {
            sort_by_dropdown.value = sort_by;
        }
        sort_by_dropdown.style.width = get_text_width(sort_by);
        let subtotal_list = JSON.parse(this.getAttribute("subtotal_list"));
        if (sort_by != name && subtotal_list && subtotal_list.length > 0) {
            this._sort_subtotal_group.style.display = "inline";
        } else {
            this._sort_subtotal_group.style.display = "none";
        }
    }

    set subtotal(value) {
        let subtotal_dropdown = this.shadowRoot.querySelector("#sort_subtotal");
        let subtotal = this.getAttribute("subtotal");
        if (subtotal_dropdown.value !== subtotal) {
            subtotal_dropdown.value = subtotal;
        }
        subtotal_dropdown.style.width = get_text_width(subtotal);
    }

    set limit(value) {
        let limit_select_dropdown = this.shadowRoot.querySelector("#limit_select");
        let limit = this.getAttribute("limit");
        if (limit_select_dropdown.value !== limit) {
            limit_select_dropdown.value = limit;
        }
        limit_select_dropdown.style.width = get_text_width(limit);
    }

    set limit_type(value) {
        let limit_type_dropdown = this.shadowRoot.querySelector("#limit_type_select");
        let limit_type = this.getAttribute("limit_type");
        if (limit_type_dropdown.value !== limit_type) {
            limit_type_dropdown.value = limit_type;
        }
        limit_type_dropdown.style.width = get_text_width(limit_type);

        let limit_select_dropdown = this.shadowRoot.querySelector("#limit_select");
        var limit_list = ["none", 1, 2, 3, 6, 7, 8, 9, 10, 20, 30,
            40, 50, 60, 70, 80, 90, 100, 1000, 2000];
        if (limit_type == "Percent") {
            limit_list = ["none"];
            limit_list = limit_list.concat(Array.from({ length: 100 }, (_, i) => 1 + i));
        }
        limit_select_dropdown.innerHTML = limit_list.map(option => `<option value="${option}">${option}</option>`).join("");
        this.setAttribute("limit", "none");
    }

    set computed_column(c) {
        // const data = this._get_computed_data();
        // const computed_input_column = this.shadowRoot.querySelector('#computed_input_column');
        // const computation_name = this.shadowRoot.querySelector('#computation_name');
        // computation_name.textContent = data.computation.name;
        // computed_input_column.textContent = data.input_column;
    }

    set container(c) {

        var el = this.shadowRoot.querySelector("#name");
        var el_alias_name = this.shadowRoot.querySelector("#alias_name");
        var v_el = this.shadowRoot.querySelector("#v_name");
        if (c === "row_pivots" || c === "column_pivots" || c === "filters"){
            el.classList.add("colon");
            el_alias_name.classList.add("colon");
        }else{
            el.classList.remove("colon");
            el_alias_name.classList.remove("colon");
        }

        if (c === "value_pivots"){
            //el.classList.add("hidden");
            el_alias_name.classList.add("hidden");
            v_el.classList.remove("hidden");
        }else{
            //el.classList.remove("hidden");
            el_alias_name.classList.remove("hidden");
            v_el.classList.add("hidden");
        }

        if (c === "filters"){
          this.shadowRoot.querySelector("#filter_summary_container").classList.remove("hidden");
        }
    }

    set sort_by_list(sort_list) {
        const options = JSON.parse(sort_list);
        let sort_by_dropdown = this.shadowRoot.querySelector("#sort_by");
        sort_by_dropdown.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join("");
    }

    set subtotal_list(value) {
        const options = JSON.parse(value);
        let subtotal_dropdown = this.shadowRoot.querySelector("#sort_subtotal");
        subtotal_dropdown.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join("");
    }

    set filter_by_list(filter_list) {
        const options = JSON.parse(filter_list);
        let filter_by_dropdown = this.shadowRoot.querySelector("#filter_by");
        filter_by_dropdown.innerHTML = options.map(option => `<option value="${option.n}">${option.dname}</option>`).join("");
    }

    set filter_sublist(value) {
        const options = JSON.parse(value);
        let filter_sublist_dropdown = this.shadowRoot.querySelector("#filter_subtotal");
        filter_sublist_dropdown.innerHTML = options.map(option => `<option value="${option}">${option}</option>`).join("");
    }

    set active_field(checked) {
        let elem = this.shadowRoot.querySelector("#checkbox_id");
        if (checked === true || checked === 'true'){
          elem.checked = true;
          //elem.setAttribute("checked", "checked");
        }else{
          elem.checked = false;
          //elem.removeAttribute("checked");
        }
    }

    // attribute for binning
    set binning(binning) {
    }

    _get_computed_data() {
        const data = JSON.parse(this.getAttribute("computed_column"));
        return {
            column_name: data.column_name,
            input_columns: data.input_columns,
            input_type: data.input_type,
            computation: data.computation,
            type: data.type
        };
    }

    _update_disable_aggregate_levels(agg_levels) {
        var agg_level = this.getAttribute("agg_level") || "OFF";
        const index = agg_levels.indexOf(agg_level);
        var disable_aggregate_levels = [...agg_levels];
        if (index > -1) {
            disable_aggregate_levels.splice(index, 1);
        }
        let agg_level_dropdown = this.shadowRoot.querySelector("#aggregate_level");
        for (var i = 0; i < agg_level_dropdown.length; i++) {
            var option = agg_level_dropdown.options[i];
            if (disable_aggregate_levels.includes(option.value)) {
                option.disabled = true;
            } else {
                option.disabled = false;
            }
        }
    }

    _update_filter(event) {
        let filter_operand = this.shadowRoot.querySelector("#filter_operand");
        let filter_operator = this.shadowRoot.querySelector("#filter_operator");
        let filter_ignore_values = this.shadowRoot.querySelector("#ignore_values");
        let val = filter_operand.value;
        var type = this.getAttribute("type");
        let filter_by = this.getAttribute("filter_by");
        if (filter_by && filter_by !== this.getAttribute("name")) {
            const aggregate = this.getAttribute("aggregate");
            if (perspective.STATISTIC_AGGREGATES.indexOf(aggregate) != -1) {
                type = "integer";
            }
        }
        switch (type) {
            case "float":
                if (filter_operator.value !== "in" && filter_operator.value !== "not in" && filter_operator.value !== "between") {
                    val = parseFloat(val);
                }
                break;
            case "integer":
                if (filter_operator.value !== "in" && filter_operator.value !== "not in" && filter_operator.value !== "between") {
                    val = parseInt(val);
                }
                break;
            case "decimal":
                if (filter_operator.value !== "in" && filter_operator.value !== "not in" && filter_operator.value !== "between") {
                    val = parseFloat(val);
                }
                break;
            case "boolean":
                val = val.toLowerCase().indexOf("true") > -1;
                break;
            case "list_boolean":
            case "list_string":
            case "list_integer":
            case "list_float":
            case "list_datetime":
            case "list_date":
            case "list_duration":
                if (val !== null && perspective.ONE_SIDE_OPERATOR.indexOf(filter_operator.value) === -1) {
                    val = val.split(",").map(x => x.trim());
                }
                break;
            case "string":
            default:
        }
        if (filter_operator.value === "in" || filter_operator.value === "not in" || filter_operator.value === "between") {
            val = val.split(",").map(x => x.trim());
        }
        var old_filter = this.getAttribute("filter");
        var new_filter = JSON.stringify({operator: filter_operator.value, operand: val,
            filter_by: this.getAttribute("filter_by"), subtotal: this.getAttribute("filter_subtotal"),
            ignore_list: filter_ignore_values.value});
        this.setAttribute("filter", new_filter);
        if (event) {
            this.dispatchEvent(new CustomEvent("filter-selected", {detail: {
                row: this,
                name: this.getAttribute("name"),
                new_filter: new_filter,
                old_filter: old_filter
            }}));
        }
    }

    _set_data_transfer(event) {
        if (this.hasAttribute("filter")) {
            let {operator, operand} = JSON.parse(this.getAttribute("filter")) || {operator: undefined, operand: undefined};
            event.dataTransfer.setData("text",
                JSON.stringify([this.getAttribute("name"), operator, operand,
                    this.getAttribute("type"), this.getAttribute("aggregate"), this.getAttribute("new_base_name"), this.getAttribute("container"), this.getAttribute("drag_id")]));
        } else {
            event.dataTransfer.setData(
                "text",
                JSON.stringify([this.getAttribute("name"), undefined, undefined,
                    this.getAttribute("type"), this.getAttribute("aggregate"), this.getAttribute("new_base_name"), this.getAttribute("container"), this.getAttribute("drag_id")])
            );
        }
        this.dispatchEvent(new CustomEvent("row-drag"));
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

    _build_filter_summary(filter){
      if (!filter){
        return;
      }

      let filter_summary = this.shadowRoot.querySelector("#filter_summary");
      let summary = "";

      // Search tag
      if (this.getAttribute("name") === perspective.__FILTER_SEARCH__){
        if (filter.site_search !== undefined && filter.site_search !== null && filter.site_search !== ""){
          if (this.getAttribute("name") === perspective.__FILTER_SEARCH__){
            summary = '= "' + filter.site_search + '"';
          }
        }

        if (summary !== ""){
          filter_summary.innerHTML = summary;
          filter_summary.classList.add("contains-data");
        }
      }else{// FILTERS

        const is_custom_filter = this._is_custom_filter_applied(filter);
        const is_auto_filter = this._is_auto_filter_applied(filter);

        // Custom filter
        if (is_custom_filter === true){
          if (filter.operator !== undefined && filter.operator !== null && filter.operator !== ""){

            // Keep using the short operator name
            if (["==", "!=", ">", ">=", "<", "<="].includes(filter.operator) === true){
              if (filter.operand !== undefined && filter.operand !== null && filter.operand !== ""){
                if (filter.operator === "=="){
                  // No need to show '='
                  summary = filter.operand.toString();
                }else{
                  summary = perspective.FILTER_OPERATER_OBJ[filter.operator].name + ' ' + filter.operand.toString();
                }
              }

            }else if(["in", "not in", "in (any)", "in (all)", "element in", "element not in"].includes(filter.operator) === true){ // In, not in

                if (typeof filter.operand === "object"){
                  if (filter.operand.length === 1){
                    if (["in", "element in"].includes(filter.operator) === true){
                      summary = filter.operand[0].toString();
                    }else if(["not in", "element not in"].includes(filter.operator) === true){
                      // Using '!=' instead of 'not in'
                      summary = "!=" + " " + filter.operand[0].toString();
                    }else{
                      summary = perspective.FILTER_OPERATER_OBJ[filter.operator].name + " " + filter.operand[0].toString();
                    }
                  }else if (filter.operand.length > 1){
                    summary = '(multiple)';
                  }else{
                    // Do nothing
                  }
                }
            }else if(["empty", "not empty", "is true", "is false", "element is true", "element is false"].includes(filter.operator) === true){ // Only operator
              summary = perspective.FILTER_OPERATER_OBJ[filter.operator].name;
            }else if(["contains", "not contain", "element contains", "element not contains"].includes(filter.operator) === true){// Contains, not contain
              if (filter.operand !== undefined && filter.operand !== null && filter.operand !== ""){
                summary = perspective.FILTER_OPERATER_OBJ[filter.operator].name + ' ' + filter.operand;
              }
            }else if(["begins with", "ends with", "element begins with", "element ends with"].includes(filter.operator) === true){ // Starts/Ends with
              if (filter.operand !== undefined && filter.operand !== null && filter.operand !== ""){
                summary = perspective.FILTER_OPERATER_OBJ[filter.operator].name + ' ' + filter.operand;
              }
            }else if(["before", "after", "element before", "element after"].includes(filter.operator) === true){ // Before, After
              if (filter.operand !== undefined && filter.operand !== null && filter.operand !== ""){
                summary = perspective.FILTER_OPERATER_OBJ[filter.operator].name + ' ' + filter.operand;
              }

            }else if(["between", "element between"].includes(filter.operator) === true){

              if (typeof filter.operand === "object"){
                if (filter.operand.length > 1){
                  summary = perspective.FILTER_OPERATER_OBJ[filter.operator].name + ' ' + filter.operand[0] + ' and ' + filter.operand[1];
                }
              }

            }else if(filter.operator === "relative date"){
              if (typeof filter.operand === "object"){
                if (filter.operand.length > 0 && filter.operand[0] !== undefined && filter.operand[0] !== null){
                  if (["next", "previous"].includes(filter.operand[0]) === true){
                    let op_0 = filter.operand[0];
                    let op_1 = filter.operand[1];
                    let op_2 = filter.operand[2];
                    if (op_1 !== undefined && op_1 !== null && op_2 !== undefined && op_2 !== null){
                      summary = (
                        (op_0 === "previous" ? "prev": op_0.toString().toLowerCase()) + " "
                        + op_1 + " "
                        + (perspective.RELATIVE_DATE_UNIT_SHOW_NAME[op_2] !== undefined ? perspective.RELATIVE_DATE_UNIT_SHOW_NAME[op_2].toString().toLowerCase(): op_2.toString().toLowerCase())
                      )
                    }
                  }else if(perspective.RELATIVE_DATE_PERIOD_THIS.includes(filter.operand[0]) === true){
                    summary = filter.operand[0].toString().toLowerCase();
                  }else{
                    // Something is not right. Do nothing
                  }
                }
              }
            }else if(filter.operator === "top n"){
              let op_0 = filter.operand[0];
              let op_1 = filter.operand[1];
              if (op_0 !== undefined && op_0 !== null && op_1 !== undefined && op_1 !== null){
                // Top 3
                // Top 3%
                summary = "top" + " " + op_0 + (op_1 === "Percent" ? "%": "");
              }
            }else{
              summary = perspective.FILTER_OPERATER_OBJ[filter.operator] ? perspective.FILTER_OPERATER_OBJ[filter.operator].name : filter.operator;
            }

            if (filter.subtotal !== undefined && filter.subtotal !== null && filter.subtotal !== ""){
              summary = summary + ' ' + filter.subtotal.toString();
            }
          }

        }else if(is_auto_filter === true){ // Auto filter
          if(filter.ignore_list !== undefined && filter.ignore_list !== null && filter.ignore_list.length > 0){
            if (filter.ignore_list.length > 1){
              summary = '(multiple)';
            }else{
              //summary = 'not in ' + (filter.ignore_list[0] === "" ? "(blank)" : filter.ignore_list[0]);

              // Using operator '!=' instead of 'not in' as we have only one item
              summary = '!= ' + (filter.ignore_list[0] === "" ? "(blank)" : filter.ignore_list[0]);
            }

          }else if(filter.selected_list !== undefined && filter.selected_list !== null && filter.selected_list.length > 0){
            if (filter.selected_list.length > 1){
              summary = '(multiple)';
            }else{
              //summary = 'in ' + (filter.selected_list[0] === "" ? "(blank)" : filter.selected_list[0]);

              // Using operator '=' instead of 'in' as we have only one item
              //summary = '= ' + (filter.selected_list[0] === "" ? "(blank)" : filter.selected_list[0]);
              summary = filter.selected_list[0] === "" ? "(blank)" : filter.selected_list[0]; // No need to show '='
            }
          }
        }

        filter_summary.innerHTML = summary || " -- ";
        filter_summary.classList.add("contains-data");
      }

    }

    _register_ids() {
        this._li = this.shadowRoot.querySelector(".row_draggable");
        this._visible = this.shadowRoot.querySelector(".is_visible");
        this._checkbox_id = this.shadowRoot.querySelector("#checkbox_id");
        this._row_close = this.shadowRoot.querySelector("#row_close");
        this._agg_dropdown = this.shadowRoot.querySelector("#column_aggregate");
        this._show_type_dropdown = this.shadowRoot.querySelector("#column_show_type");
        this._search_type_dropdown = this.shadowRoot.querySelector("#column_search_type");
        this._data_format_dropdown = this.shadowRoot.querySelector("#column_data_format");
        this._rename_field = this.shadowRoot.querySelector("#rename_field");
        this._rename_exclamation = this.shadowRoot.querySelector("#rename_exclamation");
        this._rename_submit = this.shadowRoot.querySelector("#rename_submit");
        this._sort_order = this.shadowRoot.querySelector("#sort_order");
        this._filter_operand = this.shadowRoot.querySelector("#filter_operand");
        this._filter_operator = this.shadowRoot.querySelector("#filter_operator");
        this._filter_by = this.shadowRoot.querySelector("#filter_by");
        this._filter_subtotal_group = this.shadowRoot.querySelector("#filter_subtotal_group");
        this._filter_subtotal = this.shadowRoot.querySelector("#filter_subtotal");
        this._edit_computed_column_button = this.shadowRoot.querySelector("#row_edit");
        this._agg_level = this.shadowRoot.querySelector("#aggregate_level");
        this._sort_by = this.shadowRoot.querySelector("#sort_by");
        this._sort_subtotal_group = this.shadowRoot.querySelector("#sort_subtotal_group");
        this._sort_subtotal = this.shadowRoot.querySelector("#sort_subtotal");
        this._limit_select = this.shadowRoot.querySelector("#limit_select");
        this._limit_type_select = this.shadowRoot.querySelector("#limit_type_select");
        this._period_select = this.shadowRoot.querySelector("#column_period");

        this._row_icon_info = this.shadowRoot.querySelector("#row_icon_info");
        this._filter_summary_container = this.shadowRoot.querySelector("#filter_summary_container");
    }

    _register_callbacks() {
        this._li.addEventListener("dragstart", this._set_data_transfer.bind(this));
        this._li.addEventListener("dragend", () => {
            this.dispatchEvent(new CustomEvent("row-dragend"));
        });
        this._visible.addEventListener("mousedown", event => this.dispatchEvent(new CustomEvent("visibility-clicked", {detail: event})));
        this._checkbox_id.addEventListener("click", event => {
          let is_inactive = this.parentElement.getAttribute("id") === "inactive_columns";
          if (is_inactive && is_inactive == true){
            this._checkbox_id.checked = false;
          }
        });
        this._row_close.addEventListener("mousedown", event => this.dispatchEvent(new CustomEvent("close-clicked", {detail: event})));
        var _this = this;
        this._row_icon_info.addEventListener("mousedown", event => {
            event.preventDefault();
            event.stopPropagation();
            const clicked_icon_bounds = this._row_icon_info.getBoundingClientRect();
            const hosted_icon_bounds = this.shadowRoot.host.getBoundingClientRect();
            event.data = {
              name: _this.getAttribute("name"),
              container: _this.getAttribute("container"),
              drag_id: _this.getAttribute("drag_id"),
              clicked_icon_bounds: clicked_icon_bounds,
              hosted_icon_bounds: hosted_icon_bounds
            };

            this.dispatchEvent(new CustomEvent("info-clicked", {detail: event}));
        });
        this._row_icon_info.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
        });
        this._agg_dropdown.addEventListener("change", event => {
            var old_aggregate = this.getAttribute("aggregate");
            this.setAttribute("aggregate", this._agg_dropdown.value);
            event.detail = {
                row: this,
                old_agg: old_aggregate,
                new_agg: this._agg_dropdown.value
            }
            this.dispatchEvent(new CustomEvent("aggregate-selected", {detail: event}));
        });
        this._period_select.addEventListener("change", event => {
            var old_period = this.getAttribute("period") || "none";
            this.setAttribute("period", this._period_select.value);
            event.detail = {
                row: this,
                old_period: old_period,
                new_period: this._period_select.value
            }
            this.dispatchEvent(new CustomEvent("period-selected", {detail: event}));
        });
        this._show_type_dropdown.addEventListener("change", event => {
            var old_show_type = this.getAttribute("show_type");
            this.setAttribute("show_type", this._show_type_dropdown.value);
            event.detail = {
                name: this.getAttribute("new_base_name"),
                new_show_type: this._show_type_dropdown.value,
                old_show_type: old_show_type,
                row: this
            };
            this.dispatchEvent(new CustomEvent("show-as-selected", {detail: event}));
        });
        this._search_type_dropdown.addEventListener("change", event => {
            var old_search_type = this.getAttribute("search_type");
            this.setAttribute("search_type", this._search_type_dropdown.value);
            this.dispatchEvent(new CustomEvent("search-type-selected", {
                detail: {
                    row: this,
                    name: this.getAttribute("name"),
                    new_search_type: this._search_type_dropdown.value,
                    old_search_type: old_search_type
                }
            }));
        });
        this._data_format_dropdown.addEventListener("change", event => {
            var old_data_format = this.getAttribute("data_format");
            this.setAttribute("data_format", this._data_format_dropdown.value);
            event.detail = {
                row: this,
                name: this.getAttribute("new_base_name"),
                new_data_format: this._data_format_dropdown.value,
                old_data_format: old_data_format
            };
            this.dispatchEvent(new CustomEvent("data-format-selected", {detail: event}));
        });
        this._sort_order.addEventListener("click", event => {
            this.dispatchEvent(new CustomEvent("sort_order", {detail: event}));
        });

        this._rename_field.addEventListener("keyup", () => {
            console.log("rename_field_keyup-----")
            const new_name = this._rename_field.value;
            if (new_name === "") {
                this._rename_exclamation.hidden = true;
            }
            this.dispatchEvent(new CustomEvent("column-validate-name", {detail: {
                new_name: new_name,
                row: this
            }}));
        });
        this._rename_submit.addEventListener("click", event => {
            this.dispatchEvent(new CustomEvent("column-change-name", {detail: {
                new_name: this._rename_field.value,
                event: event,
                row: this
            }}));
            return true;
        });

        const debounced_filter = _.debounce(event => this._update_filter(event), 50);
        this._filter_operator.addEventListener("change", () => {
            this._filter_operator.style.width = get_text_width(this._filter_operator.value);
            const filter_input = this.shadowRoot.querySelector("#filter_operand");
            /*if (perspective.ONE_SIDE_OPERATOR.indexOf(this._filter_operator.value) !== -1) {
                filter_input.type = "hidden";
            } else {
                filter_input.type = "text";
            }*/
            filter_input.style.width = get_text_width("" + this._filter_operand.value, 30);
            debounced_filter({
                detail: this._filter_operator.value
            });
        });
        this._filter_by.addEventListener("change", () => {
            var old_filter_by = this.getAttribute("filter_by") || this.getAttribute("name");
            this.setAttribute("filter_by", this._filter_by.value);
            this.dispatchEvent(
                new CustomEvent("filter-by-selected", {
                    detail: {
                        row: this,
                        update_filter_func: debounced_filter,
                        new_filter_by: this._filter_by.value,
                        old_filter_by: old_filter_by,
                        name: this.getAttribute("name")
                    }
                })
            );
        });
        this._filter_subtotal.addEventListener("change", () => {
            var subtotal_list = JSON.parse(this.getAttribute("subtotal_list")) || [];
            var old_filter_subtotal = this.getAttribute("filter_subtotal");
            if (!old_filter_subtotal || old_filter_subtotal === "undefined") {
                old_filter_subtotal = subtotal_list[0];
            }
            this.setAttribute("filter_subtotal", this._filter_subtotal.value);
            /*debounced_filter({
                detail: this._filter_subtotal.value
            });*/
            this.dispatchEvent(
                new CustomEvent("filter-subtotal-selected", {
                    detail: {
                        row: this,
                        update_filter_func: debounced_filter,
                        new_filter_subtotal: this._filter_subtotal.value,
                        old_filter_subtotal: old_filter_subtotal,
                        name: this.getAttribute("name")
                    }
                })
            );
        });

        this._edit_computed_column_button.addEventListener("click", () => {
            this.dispatchEvent(
                new CustomEvent("perspective-computed-column-edit", {
                    bubbles: true,
                    detail: this._get_computed_data()
                })
            );
        });
        this._agg_level.addEventListener("change", () => {
            var old_agg_level = this.getAttribute("agg_level");
            this.setAttribute("agg_level", this._agg_level.value);
            this.dispatchEvent(
                new CustomEvent("aggregate-level-selected", {
                    detail: {
                        row: this,
                        name: this.getAttribute("name"),
                        new_agg_level: this._agg_level.value,
                        old_agg_level: old_agg_level
                    }
                })
            );
        });
        this._sort_by.addEventListener("change", () => {
            var old_sort_by = this.getAttribute("sort_by") || this.getAttribute("name");
            this.setAttribute("sort_by", this._sort_by.value);
            this.dispatchEvent(
                new CustomEvent("sort-by-selected", {
                    detail: {
                        new_sort_by: this._sort_by.value,
                        old_sort_by: old_sort_by,
                        row: this,
                        name: this.getAttribute("name")
                    }
                })
            );
        });
        this._sort_subtotal.addEventListener("change", () => {
            var subtotal_list = JSON.parse(this.getAttribute("subtotal_list")) || [];
            var old_subtotal = this.getAttribute("subtotal");
            if (!old_subtotal || old_subtotal === "undefined") {
                old_subtotal = subtotal_list[0];
            }
            this.setAttribute("subtotal", this._sort_subtotal.value);
            this.dispatchEvent(
                new CustomEvent("sort-subtotal-selected", {
                    detail: {
                        new_subtotal: this._sort_subtotal.value,
                        old_subtotal: old_subtotal,
                        row: this,
                        name: this.getAttribute("name")
                    }
                })
            );
        });
        this._limit_select.addEventListener("change", () => {
            var old_limit = this.getAttribute("limit") || "none";
            this.setAttribute("limit", this._limit_select.value);
            this.dispatchEvent(
                new CustomEvent("limit-group-selected", {
                    detail: {
                        new_limit: this._limit_select.value,
                        old_limit: old_limit,
                        name: this.getAttribute("name"),
                        row: this
                    }
                })
            );
        });
        this._limit_type_select.addEventListener("change", () => {
            var old_limit_type = this.getAttribute("limit_type") || "Items";
            this.setAttribute("limit_type", this._limit_type_select.value);
            this.dispatchEvent(
                new CustomEvent("limit-type-selected", {
                    detail: {
                        row: this,
                        new_limit_type: this._limit_type_select.value,
                        old_limit_type: old_limit_type,
                        name: this.getAttribute("name")
                    }
                })
            );
        });

        this._filter_summary_container.addEventListener("mousedown", event => {
            event.preventDefault();
            event.stopPropagation();
            const clicked_icon_bounds = this._row_icon_info.getBoundingClientRect();
            const hosted_icon_bounds = this.shadowRoot.host.getBoundingClientRect();
            event.data = {
              name: _this.getAttribute("name"),
              container: _this.getAttribute("container"),
              drag_id: _this.getAttribute("drag_id"),
              clicked_icon_bounds: clicked_icon_bounds,
              hosted_icon_bounds: hosted_icon_bounds
            };

            this.dispatchEvent(new CustomEvent("info-clicked", {detail: event}));
        });
        this._filter_summary_container.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
        });
    }

    connectedCallback() {
        this._register_ids();
        this._register_callbacks();
    }
}
