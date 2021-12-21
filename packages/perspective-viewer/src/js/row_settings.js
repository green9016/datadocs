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
import template from "../html/row_settings.html";

import style from "../less/row_settings.less";

import flatpickr from "./flatpickr";
import style_flatpickr from "../less/flatpickr.less";

const SELECT_ALL_KEY = "__SELECT_ALL__";
const ADD_CURRENT_SELECTION_KEY = "__ADD_CURRENT_SELECTION__";
const ADD_CURRENT_SELECTION_TEXT = "Add current selection to filter";

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
@bindTemplate(template, {toString: () => style + "\n" + style_flatpickr + "\n" + awesomplete_style}) // eslint-disable-next-line no-unused-vars
class RowSettings extends HTMLElement {

    constructor() {
        super();

        this._sort_filter_query = {};
        this.selected_fields = [];

        this.original_c_info = [];
        this.c_info = [];
        this.filter_by_sub_visibility = false;

        this.prev_filter_selections = [];
        this.is_filter_selection_added = false;
    }

    set name(n) {
        let elem = this.shadowRoot.querySelector("#name");
        elem.innerHTML = this.getAttribute("name");
    }

    set new_base_name(v) {
        let el = this.shadowRoot.querySelector("#rename_field");
        //el.value = this.getAttribute("new_base_name");
        el.setAttribute("placeholder", v);
    }

    set dname(n) {
        let elem = this.shadowRoot.querySelector("#rename_field");
        elem.value = this.getAttribute("dname");

        //let el_alias_name = this.shadowRoot.querySelector("#alias_name");
        //el_alias_name.innerHTML = this.getAttribute("dname");
    }

    set alias_name(value) {
        let el = this.shadowRoot.querySelector("#alias_name");
        el.innerHTML = this.getAttribute("alias_name");
    }

    set source_field(value) {
        let el = this.shadowRoot.querySelector("#source_field");
        el.innerHTML = this.getAttribute("source_field");
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
        let binning_dropdown = this.shadowRoot.querySelector("#binning");
        let adv_nb_filter_operator = this.shadowRoot.querySelector("#adv_nb_filter_operator");
        let data_format_dropdown = this.shadowRoot.querySelector("#column_data_format");
        let agg_level_dropdown = this.shadowRoot.querySelector("#aggregate_level");
        //let limit_select_dropdown = this.shadowRoot.querySelector("#limit_select");
        let limit_type_dropdown = this.shadowRoot.querySelector("#limit_type_select");
        let period_dropdown = this.shadowRoot.querySelector("#column_period");
        let sort_order_dropdown = this.shadowRoot.querySelector("#sort_order");
        let column_subtotals_dropdown = this.shadowRoot.querySelector("#column_subtotals");

        let adv_sort_asc_title = this.shadowRoot.querySelector("#adv_sort_asc_title");
        let adv_sort_desc_title = this.shadowRoot.querySelector("#adv_sort_desc_title");
        let adv_nb_filter_period_dropdown = this.shadowRoot.querySelector("#adv_nb_filter_period");
        let adv_nb_filter_date_unit_dropdown = this.shadowRoot.querySelector("#adv_nb_filter_date_unit");
        let adv_nb_filter_top_n_type_dropdown = this.shadowRoot.querySelector("#adv_nb_filter_top_n_type");
        /*
        limit_select_dropdown.innerHTML = ["none", 1, 2, 3, 6, 7, 8, 9, 10, 20, 30,
            40, 50, 60, 70, 80, 90, 100, 1000, 2000].map(option =>{
              var str = `<option value="${option}">${option}</option>`;
              if (option === "none"){
                str = `<option value="${option}">--</option>`;
              }
              return str;
            }).join("");
        */
        //limit_select_dropdown.innerHTML = [20, 50, 100, 1000, 2000].map(option =>`<option value="${option}">${option}</option>`).join("");
        limit_type_dropdown.innerHTML = ["Items", "Percent"].map(option => `<option value="${option}">${option}</option>`).join("");
        show_type_dropdown.innerHTML = ["default", "%_of_row", "%_of_column", "%_of_parent_row", "%_of_parent_column",
            "diff_from_prev_value", "%_of_prev_value", "running_total", "running_%", "%_of_grand_total"].map(option => `<option value="${perspective.SHOW_TYPE_SHOW_NAME[option]}">${perspective.SHOW_TYPE_SHOW_NAME[option]}</option>`).join("");
        binning_dropdown.innerHTML = perspective.BINNING_TYPE.map(option => `<option value="${option.value}">${option.key}</option>`).join("");
        period_dropdown.innerHTML = ["none", "previous"].map(option => `<option value="${option}">${option}</option>`).join("");
        sort_order_dropdown.innerHTML = [{value: "asc", text: "A-Z"}, {value: "desc", text: "Z-A"}].map(option => `<option value="${option.value}">${option.text}</option>`).join("");
        if (!JSON.parse(this.getAttribute("filter"))) {
            this.update_filter_operator_dropdown();
        }
        adv_nb_filter_period_dropdown.innerHTML = perspective.RELATIVE_DATE_PERIOD.map(option => `<option value="${option.value}" ${option.active ? "" : "disabled"}>${option.name}</option>`).join("");
        adv_nb_filter_date_unit_dropdown.innerHTML = perspective.RELATIVE_DATE_UNIT.map(option => `<option value="${option}">${perspective.RELATIVE_DATE_UNIT_SHOW_NAME[option]}</option>`).join("");
        column_subtotals_dropdown.innerHTML = ["Yes", "No"].map(op => `<option value="${op}">${op}</option>`).join("");
        adv_nb_filter_top_n_type_dropdown.innerHTML = ["Items", "Percent"].map(op => `<option value="${op}">${op}</option>`).join("");
        var nb_of_data_format = 0;
        switch (type) {
            case "float":
            case "integer":
            case "decimal":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.float.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.float.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                nb_of_data_format = perspective.TYPE_DATA_FORMATS.float.length;
                break;
            case "boolean":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.boolean.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.boolean.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                nb_of_data_format = perspective.TYPE_DATA_FORMATS.boolean.length;
                break;
            case "date":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.datetime.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.date.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.date.map(level => { var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                nb_of_data_format = perspective.TYPE_DATA_FORMATS.date.length;
                break;
            case "datetime":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.datetime.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.datetime.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.datetime.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                nb_of_data_format = perspective.TYPE_DATA_FORMATS.datetime.length;
                break;
            case "duration":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.datetime.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.duration.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.duration.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                nb_of_data_format = perspective.TYPE_DATA_FORMATS.duration.length;
                break;
            case "string":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.string.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.string.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                break;
            case "list_string":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.list_string.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.string.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                break;
            case "list_boolean":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.list_boolean.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.boolean.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                nb_of_data_format = perspective.TYPE_DATA_FORMATS.boolean.length;
                break;
            case "list_integer":
            case "list_float":
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.list_float.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.float.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                nb_of_data_format = perspective.TYPE_DATA_FORMATS.float.length;
                break;
            case "list_date":
            case "list_datetime":
            case "list_duration":
                if (type === "list_date") {
                    data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.date.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                    agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.list_date.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                    nb_of_data_format = perspective.TYPE_DATA_FORMATS.date.length;
                } else if (type === "list_datetime") {
                    data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.datetime.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                    agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.list_datetime.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`;}).join("");
                    nb_of_data_format = perspective.TYPE_DATA_FORMATS.datetime.length;
                } else {
                    data_format_dropdown.innerHTML = perspective.TYPE_DATA_FORMATS.duration.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
                    agg_level_dropdown.innerHTML = perspective.TYPE_AGGREGATE_LEVELS.list_duration.map(level => {var level_text = (level || "").toLowerCase(); return `<option value="${level}">${level_text}</option>`; }).join("");
                    nb_of_data_format = perspective.TYPE_DATA_FORMATS.duration.length;
                }
                agg_dropdown.innerHTML = perspective.TYPE_AGGREGATES.list_datetime.map(agg => `<option value="${agg}">${perspective.AGGREGATE_OPERATOR_NAMES[agg]}</option>`).join("");
                break;
            default:
        }
        if (!this.hasAttribute("aggregate")) {
            this.setAttribute("aggregate", perspective.AGGREGATE_DEFAULTS[type]);
        }

        if (["date", "datetime", "duration", "list_date", "list_datetime", "list_duration"].includes(type)){
            let agg_level_container = this.shadowRoot.querySelector("#agg_level_container");
            agg_level_dropdown.classList.remove("hidden");
            agg_level_container.style.display = "flex";
        }

        // Hide the binning if the field type in ROWS/COLUMNS is not a number
        if (["float", "integer", "decimal", "list_integer", "list_float"].includes(type) === false){
          var binning_container = this.shadowRoot.querySelector("#binning_container");
          var binning_size_container = this.shadowRoot.querySelector("#binning_size_container");
          binning_container.style.display = "none";
          binning_size_container.style.display = "none";
        }

        // Sort title
        let str_asc = "Sort A to Z";
        let str_desc = "Sort Z to A";
        if (["float", "integer", "decimal", "duration", "list_float", "list_integer", "list_duration"].includes(type) === true){ // Numberic or time
          str_asc = "Sort Smaller to Largest";
          str_desc = "Sort Largest to Smaller";
        }else if (["date", "datetime", "list_date", "list_datetime"].includes(type) === true){ // Date or datetime
          str_asc = "Sort Oldest to Newest";
          str_desc = "Sort Newest to Oldest";
        }else{ // String
        }
        adv_sort_asc_title.textContent = str_asc;
        adv_sort_desc_title.textContent = str_desc;

        if (type == "string" || !data_format_dropdown || data_format_dropdown == 0){
          var format_as_container = this.shadowRoot.querySelector("#format_as_container");
          format_as_container.classList.add("hidden");
          format_as_container.style.display = "none";
        }

        this.shadowRoot.querySelector("#format_as_text").innerHTML = this._type_to_text(type) + ":";

        let adv_nb_filter_operand = this.shadowRoot.querySelector("#adv_nb_filter_operand");
        let adv_nb_filter_second_operand = this.shadowRoot.querySelector("#adv_nb_filter_second_operand");
        this._callback = event => {
            const filter = JSON.parse(this.getAttribute("filter")) || {};
            const operator = this._adv_nb_filter_operator.value;
            const old_operand = filter.operand || "";
            if ((operator === "between" || operator === "element between") && (adv_nb_filter_operand.value === "" || adv_nb_filter_second_operand.value === ""
                || !adv_nb_filter_operand.value || !adv_nb_filter_second_operand.value)) {
                return;
            }
            const new_operand = (operator === "between" || operator === "element between") ? [adv_nb_filter_operand.value || "", adv_nb_filter_second_operand.value || ""].toString()
                    : (adv_nb_filter_operand.value || "");
            if (old_operand !== new_operand) {
                this._update_filter(event)
            }
        };
        adv_nb_filter_operand.addEventListener("keyup", (event) => {
            let key_code = event.which || event.keyCode;
            if (key_code === 13) {
                this._callback(event);
            }
        });
        adv_nb_filter_operand.addEventListener("blur", (event) => {
            this._callback(event);
        });
        adv_nb_filter_second_operand.addEventListener("keyup", (event) => {
            let key_code = event.which || event.keyCode;
            if (key_code === 13) {
                this._callback(event);
            }
        });
        adv_nb_filter_second_operand.addEventListener("blur", (event) => {
            this._callback(event);
        });
    }

    choices(choices) {
        let adv_nb_filter_operand = this.shadowRoot.querySelector("#adv_nb_filter_operand");
        let adv_nb_filter_operator = this.shadowRoot.querySelector("#adv_nb_filter_operator");
        new Awesomplete(adv_nb_filter_operand, {
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
                if (adv_nb_filter_operator.value === "in" || adv_nb_filter_operator.value === "not in" || adv_nb_filter_operator.value === "between" || filter_operator.value === "element between") {
                    this.input.value = before + text + ", ";
                } else {
                    this.input.value = before + text;
                }
            }
        });
        adv_nb_filter_operand.addEventListener("awesomplete-selectcomplete", this._callback);
    }

    set filter(f) {
        const adv_nb_filter_operator = this.shadowRoot.querySelector("#adv_nb_filter_operator");
        let advanced_search_input = this.shadowRoot.querySelector("#advanced_search_input");
        let filter = JSON.parse(this.getAttribute("filter") || "{}");
        if (filter && filter.group_filter !== undefined && typeof filter.group_filter === "object"){
          this.render_group_filter(filter.group_filter);
          return;
        }
        let filter_operator_list = [];
        let type = this.getAttribute("type");
        if (!filter || !filter.operator) {
            if (filter && filter.filter_by && filter.filter_by !== this.getAttribute("name")) {
                const filter_by_list = JSON.parse(this.getAttribute("filter_by_list")) || [];
                for (let by of filter_by_list) {
                    if (by.n === filter.filter_by) {
                        type = by.t;
                        break;
                    }
                }
            }
            filter_operator_list = this._get_filter_operator_list(type);
        }
        let is_date_type = type === "date" || type === "datetime";
        filter = filter || {operator: null, operand: null};
        if (adv_nb_filter_operator.value !== filter.operator) {
            adv_nb_filter_operator.value = filter.operator || filter_operator_list[0];
        }
        const adv_nb_filter_operand = this.shadowRoot.querySelector("#adv_nb_filter_operand");
        const adv_nb_filter_second_operand = this.shadowRoot.querySelector("#adv_nb_filter_second_operand");
        const adv_nb_filter_operand_date = this.shadowRoot.querySelector("#adv_nb_filter_operand_date");
        const adv_nb_filter_second_operand_date = this.shadowRoot.querySelector("#adv_nb_filter_second_operand_date");
        const adv_nb_filter_top_n_type = this.shadowRoot.querySelector("#adv_nb_filter_top_n_type");
        let adv_nb_filter_operand_container = this.shadowRoot.querySelector("#adv_nb_filter_operand_container");
        let adv_nb_filter_second_operand_container = this.shadowRoot.querySelector("#adv_nb_filter_second_operand_container");
        let adv_nb_filter_period_container = this.shadowRoot.querySelector("#adv_nb_filter_period_container");
        let adv_filter_right = this.shadowRoot.querySelector("#adv_filter_right");
        let adv_nb_filter_date_unit_container = this.shadowRoot.querySelector("#adv_nb_filter_date_unit_container");
        let adv_nb_filter_top_n_type_container = this.shadowRoot.querySelector("#adv_nb_filter_top_n_type_container");
        let filter_suggestion_warning_message = this.shadowRoot.querySelector("#filter_suggestion_warning_message");
        if (perspective.ONE_SIDE_OPERATOR.indexOf(this._adv_nb_filter_operator.value) !== -1 || !filter || !filter.operator) {
            //adv_nb_filter_operand.type = "hidden";
            adv_nb_filter_operand_container.classList.add("hidden");
            adv_nb_filter_second_operand_container.classList.add("hidden");
            adv_nb_filter_period_container.classList.add("hidden");
            adv_filter_right.classList.remove("contains-4items");
            adv_nb_filter_date_unit_container.classList.add("hidden");
            adv_nb_filter_top_n_type_container.classList.add("hidden");
        } else {
            if (this._adv_nb_filter_operator.value === "relative date") {
                adv_nb_filter_period_container.classList.remove("hidden");
                adv_filter_right.classList.add("contains-4items");
                let adv_nb_filter_period = this.shadowRoot.querySelector("#adv_nb_filter_period");
                if (adv_nb_filter_period.value && perspective.RELATIVE_DATE_PERIOD_THIS.includes(adv_nb_filter_period.value)) {
                    //adv_nb_filter_operand.type = "hidden";
                    adv_nb_filter_operand_container.classList.add("hidden");
                    adv_nb_filter_date_unit_container.classList.add("hidden");
                } else {
                    //adv_nb_filter_operand.type = "number";
                    adv_nb_filter_operand_container.classList.remove("hidden");
                    adv_nb_filter_date_unit_container.classList.remove("hidden");
                }
                adv_nb_filter_second_operand_container.classList.add("hidden");
                adv_nb_filter_top_n_type_container.classList.add("hidden");
            } else {
                //adv_nb_filter_operand.type = "text";
                adv_nb_filter_period_container.classList.add("hidden");
                adv_filter_right.classList.remove("contains-4items");
                adv_nb_filter_date_unit_container.classList.add("hidden");
                if (this._adv_nb_filter_operator.value === "between" || this._adv_nb_filter_operator.value === "element between") {
                    adv_nb_filter_second_operand_container.classList.remove("hidden");
                } else {
                    adv_nb_filter_second_operand_container.classList.add("hidden");
                }
                if (this._adv_nb_filter_operator.value === "top n") {
                    adv_nb_filter_top_n_type_container.classList.remove("hidden");
                } else {
                    adv_nb_filter_top_n_type_container.classList.add("hidden");
                }
            }
        }
        let operand = (filter.operand || filter.operand === 0) ? filter.operand.toString() : "";

        const _op = this._adv_nb_filter_operator.value;
        if (_op === "relative date"){
          adv_nb_filter_operand.setAttribute("placeholder", "#");
        }else if(_op === "before" || _op === "after" || _op === "between" || _op === "element between" || _op === "==" || _op == "!="){
          if (type === "date") {
            adv_nb_filter_operand_date.setAttribute("placeholder", "yyyy-mm-dd");
            adv_nb_filter_second_operand_date.setAttribute("placeholder", "yyyy-mm-dd");
          } else if (type === "datetime") {
            adv_nb_filter_operand_date.setAttribute("placeholder", "yyyy-mm-dd: H:i:s");
            adv_nb_filter_second_operand_date.setAttribute("placeholder", "yyyy-mm-dd: H:i:s");
          } else {
            adv_nb_filter_operand.setAttribute("placeholder", "Value");
            adv_nb_filter_second_operand.setAttribute("placeholder", "Value");
          }
        } else {
            adv_nb_filter_operand.setAttribute("placeholder", "Value");
            adv_nb_filter_second_operand.setAttribute("placeholder", "Value");
        }

        if (this._adv_nb_filter_operator.value === "relative date") {
            operand = filter.operand ? filter.operand : [];
            adv_nb_filter_operand.value = operand[1];
            const adv_nb_filter_period = this.shadowRoot.querySelector("#adv_nb_filter_period");
            const adv_nb_filter_date_unit = this.shadowRoot.querySelector("#adv_nb_filter_date_unit");
            adv_nb_filter_period.value = operand[0] || "previous";
            adv_nb_filter_date_unit.value = operand[2] || "days";
        } else if (this._adv_nb_filter_operator.value === "between" || this._adv_nb_filter_operator.value === "element between") {
            operand = filter.operand || [];
            if (is_date_type) {
              adv_nb_filter_operand_date.value = operand[0] || "";
              this.first_fp.setDate(operand[0] || "");
              adv_nb_filter_second_operand_date.value = operand[1] || "";
              this.second_fp.setDate(operand[1] || "");
            } else {
              adv_nb_filter_operand.value = operand[0] || "";
              adv_nb_filter_second_operand.value = operand[1] || "";
            }
        } else if (this._adv_nb_filter_operator.value === "top n") {
            operand = filter.operand || [];
            adv_nb_filter_operand.value = operand[0] || "";
            adv_nb_filter_top_n_type.value = operand[1] || "Items";
        } else if (this._adv_nb_filter_operator.value === "in" || this._adv_nb_filter_operator.value === "not in") {
          adv_nb_filter_operand.value = operand;
        } else {
            if (is_date_type) {
              adv_nb_filter_operand_date.value = operand || "";
              this.first_fp.setDate(operand || "");
            } else {
              adv_nb_filter_operand.value = operand;
            }
        }

        // Update for operand type date or normal
        if (is_date_type && this._adv_nb_filter_operator.value !== "relative date" && this._adv_nb_filter_operator.value !== "top n"
          && this._adv_nb_filter_operator.value !== "in" && this._adv_nb_filter_operator.value !== "not in") {
          this._update_filter_operand("date");
        } else {
          this._update_filter_operand();
        }

        let filter_search = filter.search || "";
        if (filter_search !== undefined && filter_search !== null && filter_search !== "" && filter.datalist_contains_all === false){
          advanced_search_input.value = filter_search;
        }
        if (filter.datalist_contains_all === false) {
          //filter_suggestion_warning_message.classList.remove("hidden");
          filter_suggestion_warning_message.style.display = "flex";
        } else {
          //filter_suggestion_warning_message.classList.add("hidden");
          filter_suggestion_warning_message.style.display = "none";
        }

        // Update for ignore list
        const ignore_list = filter.ignore_list || [];
        const selected_list = filter.selected_list || [];
        const unselected_all = filter.unselected_all || false;
        const suggestion_list = this.shadowRoot.querySelector("#suggestion_list");
        var checkall_id_checkmark;
        var input_checkall_id;
        let nb_of_active_items = 0;
        let checked_all = true;
        let unchecked_all = true;
        for (let suggestion of suggestion_list.children) {
            let name = suggestion.getAttribute("data"); //suggestion.querySelector(".filter-data-item").innerHTML;
            let input = suggestion.querySelector("input[name=cb_filters]");
            const active = suggestion.classList.contains("hidden") === false;
            if (name === SELECT_ALL_KEY) {
              checkall_id_checkmark = this.shadowRoot.querySelector("#checkall_id_checkmark");
              input_checkall_id = this.shadowRoot.querySelector("#input_checkall_id");

              checkall_id_checkmark.classList.remove("checkmark-indeterminate");
              input_checkall_id.indeterminate = false;

                if (!unselected_all && ignore_list.length === 0 && selected_list.length === 0) {
                    input.checked = true;
                } else {
                    input.checked = false;
                    if (ignore_list.length > 0 || selected_list.length > 0){
                      checkall_id_checkmark.classList.add("checkmark-indeterminate");
                      input_checkall_id.indeterminate = true;
                    }
                }
            }else if(name === ADD_CURRENT_SELECTION_KEY){
              // Pass. Do nothing

              if (filter.datalist_contains_all === false){
                let is_previous_auto_filter_applied = false;
                /*
                // Check the previous auto filter is applied or not
                if (filter_search !== undefined && filter_search !== null && filter_search !== ""
                  && this.prev_filter_selections.length > 0 && this.prev_filter_selections[this.prev_filter_selections.length -1].search_text === filter_search){

                  //if (this.prev_filter_selections.length -2 >= 0){
                  if (this.prev_filter_selections.length >= 1){
                    //let pfs = this.prev_filter_selections[this.prev_filter_selections.length -2];
                    let pfs = this.prev_filter_selections[0];
                    if (pfs
                      && (
                        (pfs.ignore_list && pfs.ignore_list.length > 0)
                        || (pfs.selected_list && pfs.selected_list.length > 0)
                        )
                    ){
                      is_previous_auto_filter_applied = true;
                    }
                  }
                }

                if (is_previous_auto_filter_applied === true){
                  suggestion.classList.remove("hidden");
                }else{
                  suggestion.classList.add("hidden");
                }
                */

                // First item when the popup is open: this.prev_filter_selections[0]
                // Previous: this.prev_filter_selections[this.prev_filter_selections.length -2]
                let pfs = this.prev_filter_selections.length > 0 ? this.prev_filter_selections[0]: undefined;

                // Check the previous auto filter is applied or not
                if (filter_search !== undefined && filter_search !== null && filter_search !== ""
                  && pfs){

                  if (pfs.unselected_all === true || (pfs.ignore_list && pfs.ignore_list.length > 0) || (pfs.selected_list && pfs.selected_list.length > 0)){
                    is_previous_auto_filter_applied = true;
                  }

                }

                if (is_previous_auto_filter_applied === true /*|| (pfs && pfs.is_custom_filter === true)*/){
                  suggestion.classList.remove("hidden");
                }else{
                  suggestion.classList.add("hidden");
                }

              }

            } else if (active){
                if (unselected_all === true || ignore_list.includes(name) || (selected_list.length > 0 && !selected_list.includes(name))) {
                    input.checked = false;
                    checked_all = false;
                } else {
                    input.checked = true;
                    unchecked_all = false;
                }

                nb_of_active_items += 1;
            }
        }

        if (input_checkall_id && checkall_id_checkmark){
          if (nb_of_active_items == 0){
            checkall_id_checkmark.classList.remove("checkmark-indeterminate");
            input_checkall_id.indeterminate = false;
          }else if (nb_of_active_items > 0 && checked_all === true){
            input_checkall_id.checked = true;
            checkall_id_checkmark.classList.remove("checkmark-indeterminate");
            input_checkall_id.indeterminate = false;
          }else if(nb_of_active_items > 0 && unchecked_all === true){
            input_checkall_id.checked = false;
            checkall_id_checkmark.classList.remove("checkmark-indeterminate");
            input_checkall_id.indeterminate = false;
          }else if (nb_of_active_items > 0){
            input_checkall_id.checked = false;
            checkall_id_checkmark.classList.add("checkmark-indeterminate");
            input_checkall_id.indeterminate = true;
          }
        }

        if (filter && filter.datalist_contains_all && filter.search) {
            advanced_search_input.value = filter.search;
        }

        this._update_filter_dropdown_value();
        this._update_clear_filter_button();

        // Mark all checkboxes as unchecked if the custom filter is applied
        if (filter && filter.is_custom_filter === true){
          this._clear_auto_filter_checkboxes(filter.is_custom_filter);
        }

        this._show_auto_or_custom_filter(filter.is_custom_filter);

        // Init the prev filter selections
        if (this.prev_filter_selections && this.prev_filter_selections.length === 0){
          this._add_the_prev_filter_selection(filter.search, selected_list, ignore_list, unselected_all, filter.datalist_contains_all, filter.is_custom_filter);
        }
    }

    set aggregate(a) {
        let agg_dropdown = this.shadowRoot.querySelector("#column_aggregate");
        let aggregate = this.getAttribute("aggregate");
        if (agg_dropdown.value !== aggregate && this.hasAttribute("type")) {
            let type = this.getAttribute("type");
            agg_dropdown.value = aggregate || perspective.AGGREGATE_DEFAULTS[type];
        }

        // Show/hide display as container
        let show_data_as_container = this.shadowRoot.querySelector("#show_data_as_container");
        let container = this.getAttribute("container");
        let type = this.getAttribute("type");
        if ((perspective.STATISTIC_AGGREGATES.includes(aggregate) || type === "integer" || type === "float")
            && container === "value_pivots" && aggregate !== "unique") {
            show_data_as_container.classList.remove("hidden");
        } else {
            show_data_as_container.classList.add("hidden");
        }

        this._update_data_format_as_dropdown();
    }

    set period(p) {
        let period_dropdown = this.shadowRoot.querySelector("#column_period");
        let period = this.getAttribute("period");
        if (period_dropdown.value !== period) {
            period_dropdown.value = period || "none";
        }

        var prev_value = this.shadowRoot.querySelector("#pre_value_checkbox");
        if (period === "previous"){
          prev_value.checked = true;
        }else{
          prev_value.checked = false;
        }
    }

    set show_type(s) {
        let show_type_dropdown = this.shadowRoot.querySelector("#column_show_type");
        let show_type = this.getAttribute("show_type");
        if (show_type_dropdown.value !== show_type) {
            show_type_dropdown.value = show_type || "default";
        }

        this._update_data_format_as_dropdown();
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

        this._update_style_for_aggregate_level(agg_level);
    }

    _update_nb_of_searching_fields(nb_selected_fields, nb_fields){
      /*
      if (nb_selected_fields === 0){
        this._nb_of_selected_fields.innerHTML = "Currently searching 0 fields";
      }else if (nb_selected_fields === nb_fields){
        this._nb_of_selected_fields.innerHTML = "Currently searching <strong>all</strong> (" + nb_selected_fields  + " of " + nb_fields + ") fields";
      }else{
        this._nb_of_selected_fields.innerHTML = "Currently searching " + nb_selected_fields  + " of " + nb_fields + " fields";
      }
      */
      if (nb_selected_fields === 0){
        this._nb_of_selected_fields.innerHTML = "Currently searching 0 fields";
      }else if (nb_selected_fields === this.c_info.length){
        this._nb_of_selected_fields.innerHTML = "Currently searching <strong>all</strong> (" + nb_selected_fields  + " of " + this.c_info.length + ") fields";
      }else{
        this._nb_of_selected_fields.innerHTML = "Currently searching " + nb_selected_fields  + " of " + this.c_info.length + " fields";
      }
    }

    _get_nb_of_search_fields(){
      return Array.prototype.slice.call(this._search_fields.children).filter((pr)=>pr.classList.contains("hidden") === false).length;
    }

    _update_fields_datalist(c_info){
      var search_fields = this.shadowRoot.querySelector("#search_fields");

      let filter = JSON.parse(this.getAttribute("filter")) || {};
      let site_search = filter.site_search || "";

      c_info = c_info || this.c_info;

      // Save the current selected fields
      this.selected_fields = c_info.filter((f)=>f.is_search_selected === true || f.is_search_selected === undefined).map((v)=>v.name);

      //const select_all_with_search_text = this._search_fields_input.value ? "(Select All Search Results)" : "(Select All)";
      var fragment = document.createDocumentFragment();
      var _this = this;
      let unall = true;
      let ckall = true;
      var new_row_field = function(v){
        var li = document.createElement("li");
        li.setAttribute("data", v.name);
        li.classList.add("flex");

        // Set display name
        li.setAttribute("data-dname", v.dname || v.name);

        var label = document.createElement("label");
        label.classList.add("checkbox-container");

        var input = document.createElement("input");
        input.setAttribute("type", "checkbox");
        input.setAttribute("name", "cb_field");

        input.addEventListener("change", (event) => {
            var field_checkall_id_checkmark = _this.shadowRoot.querySelector("#field_checkall_id_checkmark");
            var field_input_checkall_id = _this.shadowRoot.querySelector("#field_input_checkall_id");

            let unchecked_all = true;
            let checked_all = true;
            let selected_list = [];

            //let nb_of_active_items = Array.prototype.slice.call(_this._search_fields.children).filter((pr)=>pr.classList.contains("hidden") === false).length;

              Array.prototype.slice.call(_this._search_fields.children).forEach((pr)=>{
                let _input = pr.querySelector("input[name=cb_field]");
                if (pr.classList.contains("hidden") === false){
                  if (_input.checked === true){
                    selected_list.push(pr.getAttribute("data"));
                    unchecked_all = false;
                  }else{
                    checked_all = false;
                  }
                }
              });

              if (unchecked_all === true){
                selected_list = [];
              }

              if (unchecked_all === true){ // Auto mark as Unselected all
                field_checkall_id_checkmark.classList.remove("checkmark-indeterminate");
                field_input_checkall_id.indeterminate = false;
                field_input_checkall_id.checked = false;
              }else if(checked_all === true){ // Auto mark as Checked all
                field_checkall_id_checkmark.classList.remove("checkmark-indeterminate");
                field_input_checkall_id.indeterminate = false;
                field_input_checkall_id.checked = true;
              }else { // Indeterminate
                field_checkall_id_checkmark.classList.add("checkmark-indeterminate");
                field_input_checkall_id.indeterminate = true;
                field_input_checkall_id.check = false;
              }
            /*
            if (unchecked_all === true){
              _this._update_nb_of_searching_fields(0, _this.c_info.length);
              return;
            }
            */
            _this._updates_search(selected_list);
        });

        var div = document.createElement("div");
        div.classList.add("filter-data-item");

        var span = document.createElement("span");
        span.classList.add("checkmark");

        // Default - Selected all items
        //if (!_this.selected_fields || _this.selected_fields.length === 0 || v.is_search_selected === true){
        if (v.is_search_selected === true || v.is_search_selected === undefined){
          input.checked = true;
          input.indeterminate = false;
          span.classList.remove("checkmark-indeterminate");
          unall = false;
        }else{
          //if (v.name !== SELECT_ALL_KEY){
            ckall = false;
          //}
        }
        /*
        if (v.name === SELECT_ALL_KEY){
          li.setAttribute("id", "field_checkall_id");
          input.setAttribute("id", "field_input_checkall_id");
          span.setAttribute("id", "field_checkall_id_checkmark");
          div.setAttribute("id", "field_checkall_text_id");

          div.textContent = select_all_with_search_text;// "(Select All)";
        }else{
          div.textContent = v.dname || v.name;
        }
        */
        let content = v.dname || v.name;
        div.textContent = (content && content.length > perspective.MAX_TRUNCATED_SUGGESTION_VALUES)
                          ? (content.substring(0, perspective.MAX_TRUNCATED_SUGGESTION_VALUES) + "...")
                          : content;

        label.appendChild(input);
        label.appendChild(span);



        li.appendChild(label);
        li.appendChild(div);

        //if (v.name !== SELECT_ALL_KEY){
          var div_agglevel = document.createElement("div");
          div_agglevel.classList.add("search-type");

          var select_agglevel = document.createElement("select");
          select_agglevel.classList.add("search-type-dropdown");

          const type = v.type;
          let options = [];
          if (["float", "integer", "decimal"].includes(type) === true){
            options = perspective.TYPE_SEARCH_TYPES.float;
          }else if(type === "boolean"){
            options = perspective.TYPE_SEARCH_TYPES.boolean;
          }else if(["date", "datetime", "duration"].includes(type) === true){
            options = perspective.TYPE_SEARCH_TYPES.datetime;
          }else if(type === "string"){
            options = perspective.TYPE_SEARCH_TYPES.string;
          }else if(type === "list_string"){
            options = perspective.TYPE_SEARCH_TYPES.list_string;
          }else if(type === "list_boolean"){
            options = perspective.TYPE_SEARCH_TYPES.list_boolean;
          }else if(["list_integer", "list_float"].includes(type) === true){
            options = perspective.TYPE_SEARCH_TYPES.list_float;
          }else if(["list_date", "list_datetime", "list_duration"].includes(type) === true){
            options = perspective.TYPE_SEARCH_TYPES.list_datetime;
          }

          select_agglevel.innerHTML = options.map(s => `<option value="${s.type}">${s.text}</option>`).join("");
          if (v.search_type){
            select_agglevel.value = v.search_type;
          }
          select_agglevel.setAttribute("column_name", v.name);
          select_agglevel.addEventListener("change", (event)=>{
            if (event.target){
              const st_value = event.target.value;
              const column_name = event.target.getAttribute("column_name");
              if (column_name !== undefined){
                _this._updates_search_type(column_name, st_value);
              }
            }
          });
          div_agglevel.appendChild(select_agglevel);

          li.appendChild(div_agglevel);
        //}

        fragment.appendChild(li);
      }

      // Create the checkbox checkall
      //new_row_field({name: SELECT_ALL_KEY});

      // Create the fields
      let nb_active_fields = 0;
      for (let v of c_info){
        new_row_field(v);
        if (v.is_search_selected === undefined || v.is_search_selected === true){
          nb_active_fields++;
        }
      }

      var field_checkall_id_checkmark = this.shadowRoot.querySelector("#field_checkall_id_checkmark");
      var field_input_checkall_id = this.shadowRoot.querySelector("#field_input_checkall_id");

      if (unall === true){ // Auto mark as Unselected all
        field_checkall_id_checkmark.classList.remove("checkmark-indeterminate");
        field_input_checkall_id.indeterminate = false;
        field_input_checkall_id.checked = false;
      }else if(ckall === true){ // Auto mark as Checked all
        field_checkall_id_checkmark.classList.remove("checkmark-indeterminate");
        field_input_checkall_id.indeterminate = false;
        field_input_checkall_id.checked = true;
      }else{ // Indeterminate
        field_checkall_id_checkmark.classList.add("checkmark-indeterminate");
        field_input_checkall_id.indeterminate = true;
        field_input_checkall_id.check = false;
      }

      field_input_checkall_id.addEventListener("change", (event) => {

          let selections = [];

          // Mark all as checked
          Array.prototype.slice.call(_this._search_fields.children).forEach((pr)=>{

            if (pr.classList.contains("hidden") === false){
              let _input = pr.querySelector("input[name=cb_field]");
              if (event.target.checked) {
                _input.checked = true;
                selections.push(pr.getAttribute("data"));
              }else{
                _input.checked = false;
              }
            }
          });

          field_checkall_id_checkmark.classList.remove("checkmark-indeterminate");
          field_input_checkall_id.indeterminate = false;
          /*
          if (selections.length === 0){
            _this._update_nb_of_searching_fields(0, _this._get_nb_of_search_fields());
            return;
          }
          */
          _this._updates_search(selections);
      });

      this._update_nb_of_searching_fields(nb_active_fields, c_info.length);

      search_fields.innerHTML = "";
      search_fields.appendChild(fragment);
    }

    // Set list of fields/columns in case __FILTER_SEARCH__
    set fields_datalist(values) {

        let filter = JSON.parse(this.getAttribute("filter") || "{}");
        let site_search = filter.site_search || "";

        let site_search_af = this.getAttribute("site_search_af");
        if (site_search_af === undefined){
          site_search_af = "";
        }

        // Save the original c_info that includes both visible and invisible fields
        this.original_c_info = JSON.parse(values);

        // the c_info will be based on the search within visible fields is on or off
        if (site_search_af === true){
          this.c_info = this.original_c_info.filter((v)=>v.active === site_search_af);
          this._search_within_visible_fields.checked = true;
        }else{
          this.c_info = Object.assign([], this.original_c_info);
          this._search_within_visible_fields.checked = false;
        }

        this._update_fields_datalist();
    }

    _updates_search(selected_fields, nb_fields, old_site_search_af){

      selected_fields = Array.prototype.slice.call(this._search_fields.children).map((pr)=>{
        let _input = pr.querySelector("input[name=cb_field]");

        return {name: pr.getAttribute("data"), checked: _input.checked};
      }).filter((f)=>f.checked === true).map((m)=>m.name);

      var old_selected = this.selected_fields;
      this.selected_fields = selected_fields;
      const new_site_search_af = this._search_within_visible_fields.checked;

      if (old_site_search_af === undefined || old_site_search_af === null){
        old_site_search_af = new_site_search_af;

        // Assign False if it's undefined
        old_site_search_af = old_site_search_af || false;
      }
      /*
      // No need to provide the selected list in case the select all
      if (!new_site_search_af && selected_fields.length === this.c_info.length){
        selected_fields = [];
      }

      nb_fields = this._get_nb_of_search_fields();

      if (!new_site_search_af && selected_fields.length === 0){
        this._update_nb_of_searching_fields(this.c_info.length, nb_fields);
      }else{
        this._update_nb_of_searching_fields(selected_fields.length, nb_fields);
      }
      */

      this._update_nb_of_searching_fields(selected_fields.length);

      let selected_all = selected_fields.length > 0 && selected_fields.length === this.c_info.length ? true: false;

      if (selected_all === true){
        // No need to pass all fields are checked in order to improve performance
        selected_fields = [];
      }

      this.dispatchEvent(
          new CustomEvent("updates-search-fields", {
              detail: {
                  row_settings: this,
                  new_selected_fields: selected_fields,
                  old_selected_fields: old_selected,
                  new_site_search_af: new_site_search_af,
                  old_site_search_af: old_site_search_af,
                  selected_all: selected_all
              }
          })
      );
    }

    _updates_search_type(column_name, search_type){

      const o_i = this.original_c_info.findIndex((v)=>v.name === column_name);
      const c_i = this.c_info.findIndex((v)=>v.name === column_name);

      if (o_i !== -1 && c_i !== -1){
        let old_search_type = this.c_info[o_i].search_type;
        this.original_c_info[o_i].search_type = search_type;
        this.c_info[o_i].search_type = search_type;

        this.dispatchEvent(
            new CustomEvent("updates-search-type", {
                detail: {
                    row_settings: this,
                    column_name: column_name,
                    new_search_type: search_type,
                    old_search_type: old_search_type
                }
            })
        );
      }
    }

    _clear_the_prev_filter_selection(){
      // Clear
      //this.prev_filter_selections = [];
      this.is_filter_selection_added = false;
    }

    // If the search text is empty, it will require to clear the prev filter selections.
    _add_the_prev_filter_selection(search_text, selected_list, ignore_list, unselected_all, datalist_contains_all, is_custom_filter){
      search_text = search_text || this._advanced_search_input.value;
      if (search_text === undefined || search_text === null){
        search_text = "";
      }

      // Init if not existed
      if (!this.prev_filter_selections){
        this.prev_filter_selections = [];
      }

      // Need to convert the ignore list into the selected list
      if (ignore_list && ignore_list.length > 0){
        if (!selected_list || selected_list.length === 0){
          selected_list = [];
          Array.prototype.slice.call(this._suggestion_list.children).forEach((pr)=>{
            if (pr.getAttribute("id") !== "checkall_id" && pr.getAttribute("id") !== ADD_CURRENT_SELECTION_KEY){
              if (!ignore_list.includes(pr.getAttribute("data"))){
                selected_list.push(pr.getAttribute("data"));
              }
            }

          });

        }
      }

      if (this.prev_filter_selections.length > 0 && this.prev_filter_selections[this.prev_filter_selections.length -1].search_text === search_text){

        // Replace the last item
        this.prev_filter_selections[this.prev_filter_selections.length -1].selected_list = selected_list || [];
        //this.prev_filter_selections[this.prev_filter_selections.length -1].ignore_list = ignore_list || [];
        this.prev_filter_selections[this.prev_filter_selections.length -1].unselected_all = unselected_all;
        this.prev_filter_selections[this.prev_filter_selections.length -1].datalist_contains_all = datalist_contains_all;
      }else{

        this.prev_filter_selections.push({
          search_text: search_text,
          selected_list: selected_list || [],
          //ignore_list: ignore_list || [],
          unselected_all: unselected_all,
          datalist_contains_all: datalist_contains_all,
          is_custom_filter: is_custom_filter
        });
      }

    }

    set filter_datalist(values) {
        let filter = JSON.parse(this.getAttribute("filter")) || {};
        let ignore_list = filter.ignore_list || [];
        let selected_list = filter.selected_list || [];
        let unselected_all = filter.unselected_all || false;
        var suggestion_list = this.shadowRoot.querySelector("#suggestion_list");
        const full_list = JSON.parse(values);
        var _this = this;

        const select_all_with_search_text = this._advanced_search_input.value ? "(Select All Search Results)" : "(Select All)";
        var fragment = document.createDocumentFragment();
        var new_row_field = function(v){
          v = (v !== null && v !== undefined) ? v.toString() : "";
          var li = document.createElement("li");
          li.setAttribute("data", v);

          var label = document.createElement("label");
          label.classList.add("checkbox-container");

          var input = document.createElement("input");
          input.setAttribute("type", "checkbox");
          input.setAttribute("name", "cb_filters");

          input.addEventListener("change", (event) => {
              var checkall_id_checkmark = _this.shadowRoot.querySelector("#checkall_id_checkmark");
              var input_checkall_id = _this.shadowRoot.querySelector("#input_checkall_id");

              const filter = JSON.parse(_this.getAttribute("filter")) || {};
              var curr_ignore_list = filter.ignore_list || [];
              var curr_selected_list = filter.selected_list || [];
              var curr_unselected_all = filter.unselected_all || false;

              let nb_of_active_items = Array.prototype.slice.call(_this._suggestion_list.children).filter((pr)=>pr.classList.contains("hidden") === false && pr.getAttribute("id") !== "checkall_id" && pr.getAttribute("id") !== ADD_CURRENT_SELECTION_KEY).length;

              if (v === SELECT_ALL_KEY) {
                  if (event.target.checked) {
                      curr_ignore_list = [];
                      curr_selected_list = [];

                      // Mark all as checked
                      Array.prototype.slice.call(_this._suggestion_list.children).forEach((pr)=>{
                        let _input = pr.querySelector("input[name=cb_filters]");
                        if (pr.classList.contains("hidden") === false && pr.getAttribute("id") !== "checkall_id" && pr.getAttribute("id") !== ADD_CURRENT_SELECTION_KEY){

                          _input.checked = true;
                          if (_this._advanced_search_input.value){
                            curr_selected_list.push(pr.getAttribute("data"));
                          }
                        }
                      });

                      curr_unselected_all = false;

                  } else {
                      curr_ignore_list = [];
                      curr_selected_list = [];

                      // Mark all as unchecked
                      Array.prototype.slice.call(_this._suggestion_list.children).forEach((pr)=>{
                        if (pr.classList.contains("hidden") === false && pr.getAttribute("id") !== "checkall_id" && pr.getAttribute("id") !== ADD_CURRENT_SELECTION_KEY){
                          let _input = pr.querySelector("input[name=cb_filters]");
                          _input.checked = false;
                        }
                      });

                      curr_unselected_all = true;
                  }

                  checkall_id_checkmark.classList.remove("checkmark-indeterminate");
                  input_checkall_id.indeterminate = false;

              }else if(v === ADD_CURRENT_SELECTION_KEY){
                if (event.target.checked) {
                  _this.is_filter_selection_added = true;
                }else{
                  _this.is_filter_selection_added = false;
                }
              }else {

                curr_ignore_list = [];
                curr_selected_list = [];
                curr_unselected_all = false;

                let unchecked_all = true;
                let checked_all = true;

                let search = _this._advanced_search_input.value || "";
                search = search.trim();

                Array.prototype.slice.call(_this._suggestion_list.children).forEach((pr)=>{
                  let _input = pr.querySelector("input[name=cb_filters]");
                  if (pr.classList.contains("hidden") === false && pr.getAttribute("id") !== "checkall_id" && pr.getAttribute("id") !== ADD_CURRENT_SELECTION_KEY){

                    if (search === undefined || search === null || search === ""){
                      if (_input.checked === true){
                        curr_selected_list.push(pr.getAttribute("data"));
                        unchecked_all = false;
                      }else{
                        curr_ignore_list.push(pr.getAttribute("data"));
                        checked_all = false;
                      }
                    }else{
                      if (_input.checked === true){
                        curr_selected_list.push(pr.getAttribute("data"));
                        unchecked_all = false;
                      }else{
                        checked_all = false;
                      }
                    }

                  }
                });

                if (search === undefined || search === null || search === ""){
                  if (curr_ignore_list.length >= curr_selected_list.length){
                    curr_ignore_list = [];
                  }else{
                    curr_selected_list = [];
                  }
                }

                if (unchecked_all === true){
                  curr_unselected_all = true;
                  curr_ignore_list = [];
                  curr_selected_list = [];
                }

                if (unchecked_all === true){ // Auto mark as Unselected all
                  checkall_id_checkmark.classList.remove("checkmark-indeterminate");
                  input_checkall_id.indeterminate = false;
                  input_checkall_id.checked = false;
                }else if(checked_all === true){ // Auto mark as Checked all
                  checkall_id_checkmark.classList.remove("checkmark-indeterminate");
                  input_checkall_id.indeterminate = false;
                  input_checkall_id.checked = true;
                }else { // Indeterminate
                  checkall_id_checkmark.classList.add("checkmark-indeterminate");
                  input_checkall_id.indeterminate = true;
                  input_checkall_id.check = false;
                }

              }

              //if (_this.getAttribute("container") === "active_columns"){
                if (curr_unselected_all === true){
                  // Prevent the user to click on OK button
                  _this._adv_btn_ok.classList.add("inactive");

                  // Not allow to perform a query in case unselected all.
                  return;
                }
              //}

              _this._update_filter({ignore_list: curr_ignore_list, selected_list: curr_selected_list, unselected_all: curr_unselected_all});
          });

          var div = document.createElement("div");
          div.classList.add("filter-data-item");

          var span = document.createElement("span");
          span.classList.add("checkmark");

          // Default - Selected all items
          if (filter === undefined || filter.unselected_all === undefined){
            input.checked = true;
            input.indeterminate = false;
            span.classList.remove("checkmark-indeterminate");
          }

          if (v === SELECT_ALL_KEY){
            li.setAttribute("id", "checkall_id");
            input.setAttribute("id", "input_checkall_id");
            span.setAttribute("id", "checkall_id_checkmark");
            div.setAttribute("id", "checkall_text_id");

            div.textContent = select_all_with_search_text;// "(Select All)";
          }else if(v === ADD_CURRENT_SELECTION_KEY){
            li.setAttribute("id", ADD_CURRENT_SELECTION_KEY);
            input.setAttribute("id", "input_" + ADD_CURRENT_SELECTION_KEY);
            span.setAttribute("id", "checkmark_" + ADD_CURRENT_SELECTION_KEY);
            div.setAttribute("id", "text_" + ADD_CURRENT_SELECTION_KEY);

            div.textContent = ADD_CURRENT_SELECTION_TEXT;

            if (_this._advanced_search_input.value){
              // Show
              li.classList.remove("hidden");
            }else{
              // Hide
              li.classList.add("hidden");
            }

            // Default uncheck
            input.checked = false;
          }else if (v === null || v === undefined || v === ""){
            div.textContent = "(blank)";
          }else{
            div.textContent = v.length >= perspective.MAX_TRUNCATED_SUGGESTION_VALUES ?
                      (v.substring(0, perspective.MAX_TRUNCATED_SUGGESTION_VALUES) + "...")
                      : v;
          }

          label.appendChild(input);
          label.appendChild(span);



          li.appendChild(label);
          li.appendChild(div);
          fragment.appendChild(li);
        }

        // Add select all checkbox
        new_row_field(SELECT_ALL_KEY);

        //
        new_row_field(ADD_CURRENT_SELECTION_KEY);

        // Add items into the list
        for (let v of full_list){
          new_row_field(v);
        }

        suggestion_list.innerHTML = "";
        suggestion_list.appendChild(fragment);
    }

    set sort_num(v) {}

    set sort_by(value) {
        let sort_by_dropdown = this.shadowRoot.querySelector("#sort_by");
        let sort_by = this.getAttribute("sort_by");
        let name = this.getAttribute("name");
        if (sort_by_dropdown.value !== sort_by) {
            sort_by_dropdown.value = sort_by;
        }
        //sort_by_dropdown.style.width = get_text_width(sort_by);
        let subtotal_list = JSON.parse(this.getAttribute("subtotal_list"));
        let container = this.getAttribute("container");
        if (sort_by != name && subtotal_list && subtotal_list.length > 0
            && (container === "row_pivots" || container === "sort")) {
            this._sort_subtotal_group.classList.remove("hidden");
            let subtotal_list = JSON.parse(this.getAttribute("subtotal_list")) || [];
            let old_subtotal = this.getAttribute("subtotal") || subtotal_list[0];
            //this._sort_subtotal.style.width = get_text_width(old_subtotal);
        } else {
            this._sort_subtotal_group.classList.add("hidden");
        }

        // Update value for sort order by dropdown
        let sort_order_by_dropdown = this.shadowRoot.querySelector("#sort_order_by");
        let sort_order = this.getAttribute("sort_order");
        if (sort_order && sort_order !== "null" && sort_order !== "undefined") {
            sort_order_by_dropdown.value = encodeURIComponent(JSON.stringify({order:sort_order, by:sort_by}));
        }

        this._update_sort_dropdown_value();
    }

    set sort_order(sort_order) {
        this._sort_order.value = sort_order;
        let adv_sort_asc_highlight = this.shadowRoot.querySelector("#adv_sort_asc_highlight");
        let adv_sort_desc_highlight = this.shadowRoot.querySelector("#adv_sort_desc_highlight");
        let old_sort_group = this.shadowRoot.querySelector("#adv_sort_content").parentElement;
        let new_sort_group = null;

        let adv_sort_asc_clear = this.shadowRoot.querySelector("#adv_sort_asc_clear");
        let adv_sort_desc_clear = this.shadowRoot.querySelector("#adv_sort_desc_clear");

        if (sort_order === "asc") {
            adv_sort_asc_highlight.classList.add("active");
            new_sort_group = this.shadowRoot.querySelector("#adv_sort_content_asc");
            adv_sort_asc_clear.classList.remove("hidden");
        } else {
            adv_sort_asc_highlight.classList.remove("active");
            adv_sort_asc_clear.classList.add("hidden");
        }

        if (sort_order === "desc") {
            adv_sort_desc_highlight.classList.add("active");
            new_sort_group = this.shadowRoot.querySelector("#adv_sort_content_desc");
            adv_sort_desc_clear.classList.remove("hidden");
        } else {
            adv_sort_desc_highlight.classList.remove("active");
            adv_sort_desc_clear.classList.add("hidden");
        }

        //old_sort_group.classList.add("hidden");
        if (new_sort_group) {
            for (let child of Array.prototype.slice.call(old_sort_group.children)) {
                new_sort_group.appendChild(child);
            }
            //new_sort_group.classList.remove("hidden");
        }

        // Update value for sort order by dropdown
        let sort_order_by_dropdown = this.shadowRoot.querySelector("#sort_order_by");
        let sort_by = this.getAttribute("sort_by") || this.getAttribute("name");
        if (sort_by) {
            sort_order_by_dropdown.value = encodeURIComponent(JSON.stringify({order:sort_order, by:sort_by}));
        }

    }

    set subtotal(value) {
        var subtotal_dropdown = this.shadowRoot.querySelector("#sort_subtotal");
        let subtotal = this.getAttribute("subtotal");
        if (subtotal_dropdown.value !== subtotal) {
            subtotal_dropdown.value = subtotal;
        }

        this._update_sort_dropdown_value();
    }

    set limit(value) {
        let input_limit = this.shadowRoot.querySelector("#input_limit");
        let limit = this.getAttribute("limit");
        if (limit === "none"){
          limit = "";
        }
        if (input_limit.value !== limit) {
            input_limit.value = limit;
        }
    }

    set limit_type(value) {
        let limit_type_dropdown = this.shadowRoot.querySelector("#limit_type_select");
        let limit_type = this.getAttribute("limit_type");
        if (limit_type_dropdown.value !== limit_type) {
            limit_type_dropdown.value = limit_type;
        }

        //limit_type_dropdown.style.width = get_text_width(limit_type);

        //let limit_select_dropdown = this.shadowRoot.querySelector("#limit_select");

        /*
        let old_limit = limit_select_dropdown.value;
        var limit_list = ["none", 1, 2, 3, 6, 7, 8, 9, 10, 20, 30,
            40, 50, 60, 70, 80, 90, 100, 1000, 2000];
        if (limit_type == "Percent") {
            limit_list = ["none"];
            limit_list = limit_list.concat(Array.from({ length: 100 }, (_, i) => 1 + i));
        }
        limit_select_dropdown.innerHTML = limit_list.map(option => `<option value="${option}">${option}</option>`).join("");
        limit_select_dropdown.value = old_limit;
        */

        /*var limits = [];
        if (limit_type === "Percent"){
          limits = [10, 30, 50, 80, 100];
        }else{
          limits = [20, 50, 100, 1000, 2000];
        }

        limit_select_dropdown.innerHTML = limits.map(option => `<option value="${option}">${option}</option>`).join("");*/
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
        var agg_level_container = this.shadowRoot.querySelector("#agg_level_container");
        var custom_name_container = this.shadowRoot.querySelector("#custom_name_container");
        var summarize_as_container = this.shadowRoot.querySelector("#summarize_as_container");
        var prev_value_container = this.shadowRoot.querySelector("#prev_value_container");
        var show_data_as_container = this.shadowRoot.querySelector("#show_data_as_container");
        var format_as_container = this.shadowRoot.querySelector("#format_as_container");

        var binning_container = this.shadowRoot.querySelector("#binning_container");
        //var binning_size_container = this.shadowRoot.querySelector("#binning_size_container");

        var sort_container = this.shadowRoot.querySelector("#sort_container");
        var subtotals_container = this.shadowRoot.querySelector("#subtotals_container");

        var limit_container = this.shadowRoot.querySelector("#limit_container");

        var advanced_sort_container = this.shadowRoot.querySelector("#advanced_sort_container");
        var advanced_filter_container = this.shadowRoot.querySelector("#advanced_filter_container");
        var adv_sort_content = this.shadowRoot.querySelector("#adv_sort_content");

        var adv_sort_content_asc = this.shadowRoot.querySelector("#adv_sort_content_asc");
        var adv_sort_content_desc = this.shadowRoot.querySelector("#adv_sort_content_desc");

        var adv_sort_content_asc_clear = this.shadowRoot.querySelector("#adv_sort_content_asc_clear");
        var adv_sort_content_desc_clear = this.shadowRoot.querySelector("#adv_sort_content_desc_clear");

        var filter_container_id = this.shadowRoot.querySelector("#filter_container_id");
        var filter_component = this.shadowRoot.querySelector("#filter_component");

        if (c === "row_pivots" || c === "column_pivots"){
          //el_alias_name.classList.remove("hidden");
          //v_el.classList.add("hidden");

          agg_level_container.classList.remove("hidden");

          // Hide custom name in ROWS/COLUMNS
          custom_name_container.classList.add("hidden");

          sort_container.classList.remove("hidden");
          limit_container.classList.remove("hidden");
          subtotals_container.classList.remove("hidden");
          format_as_container.classList.remove("hidden");
          binning_container.classList.remove("hidden");
          //binning_size_container.classList.remove("hidden");
          advanced_sort_container.classList.remove("hidden");
          advanced_filter_container.classList.remove("hidden");
          adv_sort_content.classList.remove("hidden");
          adv_sort_content_asc.classList.remove("hidden");
          adv_sort_content_desc.classList.remove("hidden");

          adv_sort_content_asc_clear.classList.add("hidden");
          adv_sort_content_desc_clear.classList.add("hidden");

          //this.set_more_default();
        }else if (c === "value_pivots"){

          //el_alias_name.classList.add("hidden");
          //v_el.classList.remove("hidden");

          //el_alias_name.classList.remove("hidden");

          //custom_name_container.classList.remove("hidden");
          summarize_as_container.classList.remove("hidden");
          prev_value_container.classList.remove("hidden");
          show_data_as_container.classList.remove("hidden");
          //format_as_container.classList.remove("hidden");
          advanced_sort_container.classList.add("hidden");
          advanced_filter_container.classList.add("hidden");
          adv_sort_content.classList.add("hidden");
          adv_sort_content_asc.classList.add("hidden");
          adv_sort_content_desc.classList.add("hidden");

          adv_sort_content_asc_clear.classList.remove("hidden");
          adv_sort_content_desc_clear.classList.remove("hidden");

          //this.set_more_default();
        } else if (c === "active_columns") {
            advanced_sort_container.classList.add("hidden");
            advanced_filter_container.classList.add("hidden");
            adv_sort_content.classList.add("hidden");
            adv_sort_content_asc.classList.add("hidden");
            adv_sort_content_desc.classList.add("hidden");

            adv_sort_content_asc_clear.classList.remove("hidden");
            adv_sort_content_desc_clear.classList.remove("hidden");
        }else if(c === "filters"){

          for (let fc_element of Array.prototype.slice.call(filter_component.children)) {
              filter_container_id.appendChild(fc_element);
          }

          filter_container_id.classList.remove("hidden");
          custom_name_container.classList.add("hidden");
          advanced_filter_container.classList.add("hidden");

        }

        /*
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
        }*/
    }

    set specificied_field(field){
      if (field === perspective.__FILTER_SEARCH__){
        var search_container_id = this.shadowRoot.querySelector("#search_container_id");
        search_container_id.classList.remove("hidden");

        this.shadowRoot.querySelector("#advanced_container_id").classList.add("hidden");
        this.shadowRoot.querySelector("#basic_container_id").style.display = "none";
      }
    }

    set site_search_af(v){

    }

    set is_multiple_filters_applied(applied){
      /*
      var cfc_container = this.shadowRoot.querySelector("#cfc_container");
      var filter_title_container = this.shadowRoot.querySelector("#filter_title_container");

      if (applied === true || applied === "true"){
        cfc_container.classList.remove("hidden");
        filter_title_container.classList.remove("full");
      }else{
        cfc_container.classList.add("hidden");
      }
      */
    }

    set advanced_feature(v){

      var advanced_container_id = this.shadowRoot.querySelector("#advanced_container_id");
      var basic_container_id = this.shadowRoot.querySelector("#basic_container_id");
      var filter_container_id = this.shadowRoot.querySelector("#filter_container_id");
      var row_filter_title = this.shadowRoot.querySelector("#row_filter_title");

      var cfc_container = this.shadowRoot.querySelector("#cfc_container");
      var filter_title_container = this.shadowRoot.querySelector("#filter_title_container");

      if (v === "QUICK_FILTER"){
        advanced_container_id.classList.remove("hidden");
        basic_container_id.classList.add("hidden");

        cfc_container.classList.remove("hidden");
        filter_title_container.classList.remove("full");

        row_filter_title.classList.remove("hidden");
      }else if(v === "FILTER"){
        advanced_container_id.classList.add("hidden");
        basic_container_id.classList.add("hidden");
        row_filter_title.classList.add("hidden");

        cfc_container.classList.remove("hidden");
        filter_title_container.classList.remove("full");

      }else if(v === perspective.__FILTER_SEARCH__){
        //advanced_container_id.classList.add("hidden");
        //basic_container_id.classList.remove("hidden");
        advanced_container_id.style.display = "none";
        basic_container_id.style.display = "none";
        filter_container_id.style.display = "none";

        var search_container_id = this.shadowRoot.querySelector("#search_container_id");
        search_container_id.classList.remove("hidden");
      }else if(v === perspective.GROUP_FILTER_NAME){

        advanced_container_id.classList.add("hidden");
        basic_container_id.classList.add("hidden");
        filter_container_id.classList.add("hidden");

        advanced_container_id.style.display = "none";
        basic_container_id.style.display = "none";
        filter_container_id.style.display = "none";

        var group_filter_container_id = this.shadowRoot.querySelector("#group_filter_container_id");
        group_filter_container_id.classList.remove("hidden");
      }else{
        advanced_container_id.classList.add("hidden");
        basic_container_id.classList.remove("hidden");
      }
    }

    set enable_prev_value(enable){
      var prev_value_container = this.shadowRoot.querySelector("#prev_value_container");
      if (enable && (enable === true || enable === "true")){
        prev_value_container.classList.remove("hidden");
      }else{
        prev_value_container.classList.add("hidden");
      }
    }

    set sort_by_list(sort_list) {
        var old_sort_by = this.getAttribute("sort_by") || [this.getAttribute("name")];
        let sort_by_list = JSON.parse(sort_list);
        const options = sort_by_list.map(option => `<option value="${option.n}">${option.dname}</option>`).join(""); // JSON.parse(sort_list)
        var sort_by_dropdown = this.shadowRoot.querySelector("#sort_by");
        sort_by_dropdown.innerHTML = options; //options.map(option => `<option value="${option}">${option}</option>`).join("");
        sort_by_dropdown.value = old_sort_by;

        // Update sort order by dropdown
        let sort_order_by_dropdown = this.shadowRoot.querySelector("#sort_order_by");
        let old_value = encodeURIComponent(JSON.stringify({
            order: this.getAttribute("sort_order") || "asc",
            by: this.getAttribute("sort_by") || this.getAttribute("name")
        }));
        let sort_order_by_content = "";
        for (let by of sort_by_list) {
            sort_order_by_content += `<option value="${encodeURIComponent(JSON.stringify({order: "asc", by: by.n}))}">${by.dname + " (A-Z)"}</option>`;
            sort_order_by_content += `<option value="${encodeURIComponent(JSON.stringify({order: "desc", by: by.n}))}">${by.dname + " (Z-A)"}</option>`;
        }
        sort_order_by_dropdown.innerHTML = sort_order_by_content;
        sort_order_by_dropdown.value = old_value;

        this._build_sort_dropdown();
    }

    set subtotal_list(value) {
        const options = JSON.parse(value).map(option => `<option value="${option}">${option}</option>`).join(""); // JSON.parse(value).options
        let old_subtotal = this.getAttribute("subtotal") || options[0];
        let subtotal_dropdown = this.shadowRoot.querySelector("#sort_subtotal");
        subtotal_dropdown.innerHTML = options; //options.map(option => `<option value="${option}">${option}</option>`).join("");
        subtotal_dropdown.value = old_subtotal;

        this._build_sort_dropdown();
    }

    set filter_by_list(filter_list) {
        this._build_filter_dropdown();
    }

    set filter_sublist(value) {
        this._build_filter_dropdown();
    }

    set binning(binning) {
        binning = (binning && binning !== "null" && binning !== "undefined") ? JSON.parse(binning) : {type: "OFF"};
        this._binning_dropdown.value = binning.type;
        /*if (binning.type === "CUSTOM") {
            this._binning_size_container.classList.remove("inactive");
            this._binning_size_container.classList.remove("hidden");
            this._binning_max.value = binning.max;
            this._binning_min.value = binning.min;
            this._binning_size.value = binning.size;
            this._binning_holder.classList.add("hidden");
        } else*/ if (binning.type === "ON") {
            this._binning_holder.classList.add("hidden");
            this._binning_size_container.classList.remove("inactive");
            this._binning_size_container.classList.remove("hidden");
            //this._update_default_binning_values();
            let default_binning = JSON.parse(this.getAttribute("default_binning"));
            this._binning_max.value = (binning.max !== undefined && binning.max !== null) ? binning.max : default_binning.max;
            this._binning_min.value = (binning.min !== undefined && binning.min !== null) ? binning.min : default_binning.min;
            this._binning_size.value = (binning.size !== undefined && binning.size !== null) ? binning.size : default_binning.size;
        } else {
            this._binning_holder.classList.remove("hidden");
            this._binning_size_container.classList.add("hidden");
            this._binning_max.value = "";
            this._binning_min.value = "";
            this._binning_size.value = "";
        }
    }

    set default_binning(v) {
        /*let binning = JSON.parse(this.getAttribute("binning"));
        if (binning && binning.type === "AUTO") {
            this._update_default_binning_values();
        }*/
    }

    set subtotals(subtotals){
      var is_checked = true;
      if (!subtotals || subtotals == "false" ){
        is_checked = false;
      }

      //this._subtotals_checkbox.checked = is_checked;

      let column_subtotals = this.shadowRoot.querySelector("#column_subtotals");
      column_subtotals.value = is_checked ? "Yes" : "No";
    }

    set auto_query(v) {
        let adv_cb_auto_apply = this.shadowRoot.querySelector("#adv_cb_auto_apply");
        let adv_cb_auto_apply_in_cfc_auto = this.shadowRoot.querySelector("#adv_cb_auto_apply_in_cfc_auto");
        let adv_btn_cancel = this.shadowRoot.querySelector("#adv_btn_cancel");
        //let adv_btn_ok = this.shadowRoot.querySelector("#adv_btn_ok");
        let auto_query_actions = this.shadowRoot.querySelector("#auto_query_actions");
        var is_checked = true;
        if (v === false || v === "false") {
            is_checked = false;
            //adv_btn_cancel.classList.remove("hidden");
            //adv_btn_ok.classList.remove("hidden");
            auto_query_actions.classList.remove("hidden");
        } else {
            //adv_btn_cancel.classList.add("hidden");
            //adv_btn_ok.classList.add("hidden");
            auto_query_actions.classList.add("hidden");
        }
        if (adv_cb_auto_apply.checked !== is_checked) {
            adv_cb_auto_apply.checked = is_checked;
            adv_cb_auto_apply_in_cfc_auto.checked = is_checked
        }
    }

    set exec_query(v){
      /*
      let value = v ? JSON.parse(v) : false;
      if (value && value !== "false" && v !== "false"){
        let search = this._advanced_search_input.value || "";
        search = search.trim();

        let old_filter = this.getAttribute("filter");
        let old_filter_obj = JSON.parse(old_filter);
        old_filter_obj.search = search;
        this.setAttribute("filter", JSON.stringify(old_filter_obj));

        let ignore_list = [];
        let selected_list = [];
        let unselected_all = false;

        let unchecked_all = true;
        let checked_all = true;

        Array.prototype.slice.call(this._suggestion_list.children).forEach((pr)=>{
          let _input = pr.querySelector("input[name=cb_filters]");
          if (pr.classList.contains("hidden") === false && pr.getAttribute("id") !== "checkall_id"){
            if (search === ""){
              if (_input.checked === true){
                unchecked_all = false;
              }else{
                ignore_list.push(pr.getAttribute("data"));
              }
            }else{
              if (_input.checked === true){
                selected_list.push(pr.getAttribute("data"));
              }else{
                checked_all = false;
              }
            }
          }
        });

        if (search === ""){
          if (unchecked_all === true){
            unselected_all = true;
          }
        }

        if (value && value.reset_filter) {
            this._update_filter({ignore_list: [], selected_list: [], unselected_all: false, search: ""}, old_filter);
        } else {
            this._update_filter({ignore_list: ignore_list, selected_list: selected_list, unselected_all: unselected_all}, old_filter);
        }
      }
      this.setAttribute("exec_query", false);
      */

      v = v ? JSON.parse(v): {};

      let ignore_list = [];
      let selected_list = [];
      let unselected_all = false;

      let unchecked_all = true;
      let checked_all = true;

      let search = v.search;
      let reset_filter = v.reset_filter;

      Array.prototype.slice.call(this._suggestion_list.children).forEach((pr)=>{

        if (pr.classList.contains("hidden") === false && pr.getAttribute("id") !== "checkall_id" && pr.getAttribute("id") !== ADD_CURRENT_SELECTION_KEY){
          let _input = pr.querySelector("input[name=cb_filters]");
          if (!_input.checked){
            _input.checked = true;
          }
          selected_list.push(pr.getAttribute("data"));
        }
      });

      if (search === undefined || search === null || search === "" || reset_filter === true){
        ignore_list = [];
        selected_list = [];
        unselected_all = false;
      }else if(selected_list.length === 0
        /*&& (
          this.getAttribute("container") === "active_columns"
          || (this.getAttribute("container") === "row_pivots" && this.getAttribute("is_flat_pivot") === "true")
        )*/){
        // Prevent the user to click on OK button
        this.shadowRoot.querySelector("#adv_btn_ok").classList.add("inactive");

        // Not allow to run query if there are no items
        return;
      }

      this._update_filter({ignore_list: ignore_list, selected_list: selected_list, unselected_all: unselected_all, search: search});
    }

    set hide_calendar(obj){
      /*
      var calendars = this.shadowRoot.querySelectorAll(".flatpickr-calendar");
      for (let calendar of calendars){
        calendar.classList.remove("open");
      }
      */

      if (this.first_fp){
        this.first_fp.close();
      }

      if (this.second_fp){
        this.second_fp.close();
      }
    }

    _update_data_format_as_dropdown(agg_level) {
      let container = this.getAttribute("container");
      let type = this.getAttribute("type");
      agg_level = agg_level || this.getAttribute("agg_level");

      // Update hide/show format container for case agg_level
      let format_as_container = this.shadowRoot.querySelector("#format_as_container");
      if (container === "row_pivots" || container === "column_pivots") {
        if (["YEAR", "QUARTER", "MONTH", "WEEK", "HOUR", "MINUTE"].includes(agg_level)) {
          format_as_container.classList.add("hidden");
        } else {
            // Update data format as dropdown for agg level is DAY
            if (agg_level === "DAY" || agg_level === "DATE") {
              let df_value = this._data_format_dropdown.value;
              let list_values = perspective.TYPE_DATA_FORMATS.date;
              if (type === "datetime" || type === "list_datetime") {
                list_values = perspective.TYPE_DATA_FORMATS.datetime;
              } else if (type === "duration" || type === "list_duration") {
                list_values = perspective.TYPE_DATA_FORMATS.duration;
              }
              this._data_format_dropdown.innerHTML = list_values.map(format => `<option value="${format}">${perspective.DATA_FORMAT_AGG_LEVEL_SHOW_TEXTS[agg_level][format]
                    || perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
              this._data_format_dropdown.value = df_value;
            } else if (agg_level === "OFF") {
              let df_value = this._data_format_dropdown.value;
              let list_values = perspective.TYPE_DATA_FORMATS.date;
              if (type === "datetime" || type === "list_datetime") {
                list_values = perspective.TYPE_DATA_FORMATS.datetime;
              } else if (type === "duration" || type === "list_duration") {
                list_values = perspective.TYPE_DATA_FORMATS.duration;
              }
              this._data_format_dropdown.innerHTML = list_values.map(format => `<option value="${format}">${perspective.DATA_FORMAT_SHOW_TEXTS[format]}</option>`).join("");
              this._data_format_dropdown.value = df_value;
            }
            format_as_container.classList.remove("hidden");
        }
      } else if (container === "value_pivots") {
        if (["date", "datetime", "duration", "list_date", "list_datetime", "list_duration"].includes(type)) {
          let aggregate = this.getAttribute("aggregate");
          if (perspective.STATISTIC_AGGREGATES.includes(aggregate) && aggregate !== "min" && aggregate !== "max") {
            format_as_container.classList.add("hidden");
          } else {
            format_as_container.classList.remove("hidden");
          }
        } else {
          let show_type = this.getAttribute("show_type");
          if (perspective.SHOW_TYPE_PERCENTS.includes(show_type)) {
            format_as_container.classList.add("hidden");
          } else {
            format_as_container.classList.remove("hidden");
          }
        }
      }
    }

    update_filter_operator_dropdown(filter_by = undefined, operator = undefined) {
        let type = this.getAttribute("type");
        let name = this.getAttribute("name");
        const adv_nb_filter_operator = this.shadowRoot.querySelector("#adv_nb_filter_operator");
        if (filter_by && filter_by !== name) {
            let filter_by_list = JSON.parse(this.getAttribute("filter_by_list")) || [];
            for (let by of filter_by_list) {
                if (by.n === filter_by) {
                    type = by.t;
                    break;
                }
            }
        }
        let filter_operator_list = this._get_filter_operator_list(type);
        const operator_values = [];
        let options_html = "";
        for (let op of filter_operator_list) {
          if (typeof op === "object") {
            options_html += `<optgroup label="${op[0]}">`;
            for (let idx = 1; idx < op.length; idx++) {
              options_html += `<option value="${op[idx]}" ${op[idx] === perspective.SEPARATOR_TEXT ? "disabled" : ""}">${perspective.FILTER_OPERATER_TEXTS[op[idx]]}</option>`;
              operator_values.push(op[idx]);
            }
            options_html += `</optgroup>`;
          } else {
            options_html += `<option value="${op}" ${op === perspective.SEPARATOR_TEXT ? "disabled" : ""}>${perspective.FILTER_OPERATER_TEXTS[op]}</option>`;
            operator_values.push(op);
          }
        }
        adv_nb_filter_operator.innerHTML = options_html;
        //adv_nb_filter_operator.value = operator || filter_operator_list[0];

        if (options_html && operator_values.length > 0){
          const selected_operator = operator && operator_values.includes(operator) === true ? operator : operator_values[0];
          adv_nb_filter_operator.value = selected_operator;
        }
    }

    update_filter_dropdown_visibility(visibility = false) {
      this.filter_by_sub_visibility = visibility;
      let advanced_filter_container = this.shadowRoot.querySelector("#advanced_filter_container");
      let adv_filter_dropdown = this.shadowRoot.querySelector("#adv_filter_dropdown");
      if (visibility) {
        advanced_filter_container.classList.remove("hidden");
        if (!adv_filter_dropdown.value || adv_filter_dropdown.value === "none") {
          this._update_adv_filter_visibility(false);
        } else {
          this._update_adv_filter_visibility(false);
        }
      } else {
        advanced_filter_container.classList.add("hidden");
        this._update_adv_filter_visibility(true);
      }
    }

    _update_adv_filter_visibility(visibility = false) {
      let adv_filter_left = this.shadowRoot.querySelector("#adv_filter_left");
      let adv_filter_right = this.shadowRoot.querySelector("#adv_filter_right");
      let adv_second_filter_left = this.shadowRoot.querySelector("#adv_second_filter_left");
      let adv_second_filter_right = this.shadowRoot.querySelector("#adv_second_filter_right");
      if (visibility) {
        adv_filter_left.classList.remove("hidden");
        adv_filter_right.classList.remove("hidden");
        adv_second_filter_left.classList.remove("hidden");
        adv_second_filter_right.classList.remove("hidden");
      } else {
        adv_filter_left.classList.add("hidden");
        adv_filter_right.classList.add("hidden");
        adv_second_filter_left.classList.add("hidden");
        adv_second_filter_right.classList.add("hidden");
      }
    }

    _get_filter_operator_list(type) {
        switch(type) {
            case "float":
            case "integer":
            case "decimal":
                return ["Number filter"].concat(perspective.TYPE_FILTERS.float);

            case "boolean":
                return ["Bool filter"].concat(perspective.TYPE_FILTERS.boolean);

            case "date":
                return ["Date filter"].concat(perspective.TYPE_FILTERS.date);

            case "datetime":
                return ["Datetime filter"].concat(perspective.TYPE_FILTERS.datetime);

            case "duration":
                return ["Time filter"].concat(perspective.TYPE_FILTERS.duration);

            case "string":
                return ["String filter"].concat(perspective.TYPE_FILTERS.string);

            case "list_string":
                return ["List filter"].concat(perspective.TYPE_FILTERS.list_string);

            case "list_boolean":
                return ["List filter"].concat(perspective.TYPE_FILTERS.list_boolean);

            case "list_float":
                return ["List filter"].concat(perspective.TYPE_FILTERS.list_float);

            case "list_integer":
                return ["List filter"].concat(perspective.TYPE_FILTERS.list_integer);

            case "list_date":
                return ["List filter"].concat(perspective.TYPE_FILTERS.list_date);

            case "list_duration":
                return ["List filter"].concat(perspective.TYPE_FILTERS.list_duration);

            case "list_datetime":
                return ["List filter"].concat(perspective.TYPE_FILTERS.list_datetime);

            default:
                return [];
        }
    }

    _type_to_text(type, post_fix = "format") {

      let str;
      if (["float", "integer", "decimal"].includes(type) === true){
        str = "Number";
      }else if(type === "boolean"){
        str = "Boolean";
      }else if(type === "date"){
        str = "Date";
      }else if(type === "datetime"){
        str = "Datetime";
      }else if(type === "duration"){
        str = "Time";
      }else if(type === "string"){
        str = "String";
      }else if(["list_string", "list_boolean", "list_float", "list_integer", "list_date", "list_duration", "list_datetime"]){
        str = "List";
      }

      if (!str){
        str = "Format as";
      }else{
        str = str + " " + post_fix;
      }
      return str;
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

    _update_style_for_aggregate_level(agg_level) {
        let container = this.getAttribute("container");
        let type = this.getAttribute("type");

        this._update_data_format_as_dropdown(agg_level);

        // Update hide/show binning container for case agg_level=YEAR
        if (["date", "datetime", "list_date", "list_datetime"].includes(type)) {
            let binning_container = this.shadowRoot.querySelector("#binning_container");
            let binning_holder = this.shadowRoot.querySelector("#binning_holder");
            let binning_size_container = this.shadowRoot.querySelector("#binning_size_container");
            if (agg_level === "YEAR" && (container === "row_pivots" || container === "column_pivots")) {
                binning_container.style.display = "flex";
                binning_holder.classList.add("hidden");
                binning_size_container.style.display = "flex";
            } else {
                binning_container.style.display = "none";
                binning_size_container.style.display = "none";
            }
        }
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

        this._update_style_for_aggregate_level(agg_level);
    }

    _update_display_as_dropdown(pivot_type, have_previous = false, disable_list = []) {
        let old_show_type = this.getAttribute("show_type") || "default";
        let display_as_types = [
            {
                type: "default",
                active: !disable_list.includes("default"),
                name: perspective.SHOW_TYPE_SHOW_NAME["default"]
            },
            {
                type: perspective.SEPARATOR_TEXT,
                active: false,
                name: perspective.SEPARATOR_TEXT
            },
            {
                type: "running_total",
                active: !disable_list.includes("running_total"),
                name: perspective.SHOW_TYPE_SHOW_NAME["running_total"]
            },
            {
                type: "running_%",
                active: !disable_list.includes("running_%"),
                name: perspective.SHOW_TYPE_SHOW_NAME["running_%"]
            },
            {
                type: perspective.SEPARATOR_TEXT,
                active: false,
                name: perspective.SEPARATOR_TEXT
            },
            {
                type: "%_of_row",
                active: !disable_list.includes("%_of_row"),
                name: perspective.SHOW_TYPE_SHOW_NAME["%_of_row"]
            },
            {
                type: "%_of_column",
                active: !disable_list.includes("%_of_column"),
                name: perspective.SHOW_TYPE_SHOW_NAME["%_of_column"]
            },
            {
                type: "%_of_grand_total",
                active: !disable_list.includes("%_of_grand_total"),
                name: perspective.SHOW_TYPE_SHOW_NAME["%_of_grand_total"]
            }
        ];

        if (pivot_type !== "none") {
            display_as_types.push({
                type: perspective.SEPARATOR_TEXT,
                active: false,
                name: perspective.SEPARATOR_TEXT
            });
            if (pivot_type === "col" || pivot_type === "row_col") {
                display_as_types.push({
                    type: "%_of_parent_column",
                    active: !disable_list.includes("%_of_parent_column"),
                    name: perspective.SHOW_TYPE_SHOW_NAME["%_of_parent_column"]
                });
            }
            if (pivot_type === "row" || pivot_type === "row_col") {
                display_as_types.push({
                    type: "%_of_parent_row",
                    active: !disable_list.includes("%_of_parent_row"),
                    name: perspective.SHOW_TYPE_SHOW_NAME["%_of_parent_row"]
                });
            }
            if ((pivot_type === "col" && old_show_type === "%_of_parent_row")
                || (pivot_type === "row" && old_show_type === "%_of_parent_column")) {
                old_show_type = "default";
            }
        } else {
            if (old_show_type === "%_of_parent_row" || old_show_type === "%_of_parent_column") {
                old_show_type = "default";
            }
        }

        if (have_previous) {
            display_as_types = display_as_types.concat([
                {
                    type: perspective.SEPARATOR_TEXT,
                    active: false
                },
                {
                    type: "diff_from_prev_value",
                    active: !disable_list.includes("diff_from_prev_value"),
                    name: perspective.SHOW_TYPE_SHOW_NAME["diff_from_prev_value"]
                },
                {
                    type: "%_of_prev_value",
                    active: !disable_list.includes("%_of_prev_value"),
                    name: perspective.SHOW_TYPE_SHOW_NAME["%_of_prev_value"]
                }
            ]);
        } else {
            if (old_show_type === "diff_from_prev_value" || old_show_type === "%_of_prev_value") {
                old_show_type = "default";
            }
        }
        let show_type_dropdown = this.shadowRoot.querySelector("#column_show_type");
        show_type_dropdown.innerHTML = display_as_types.map(option => {
            if (option.active) {
                return `<option value="${option.type}">${option.name}</option>`;
            } else {
                return `<option value="${option.type}" disabled>${option.name}</option>`;
            }
        }).join("");

        show_type_dropdown.value = old_show_type;
    }

    _update_show_type_checkbox_text(period_op = false) {
        if (period_op) {
            let pre_checklist_text = this.shadowRoot.querySelector("#pre_checklist_text");
            pre_checklist_text.innerHTML = "Grab previous " + period_op + " value";
        }
    }

    _update_aggregate_dropdown(col_in_pivot = false) {
      var op = this._agg_dropdown.getElementsByTagName("option");
      for (var i = 0; i < op.length; i++) {
        // lowercase comparison for case-insensitivity
        (op[i].value.toLowerCase() == "any" && col_in_pivot)
          ? op[i].disabled = true
          : op[i].disabled = false ;
      }
    }

    _update_sort_dropdown_value() {
        let name = this.getAttribute("name");
        let sort_by = this.getAttribute("sort_by");
        let subtotal = this.getAttribute("subtotal");
        let adv_sort_dropdown = this.shadowRoot.querySelector("#adv_sort_dropdown");
        let subtotal_list = JSON.parse(this.getAttribute("subtotal_list")) || [];
        let selected_value;

        if (!sort_by || sort_by === name || sort_by === "null" || sort_by === "undefined") {
            selected_value = encodeURIComponent(JSON.stringify({by:name}));
        } else if (subtotal_list.length == 0) {
            selected_value = encodeURIComponent(JSON.stringify({by:sort_by}));
        } else {
            if (!subtotal || subtotal === "null" || subtotal === "undefined") {
                subtotal = subtotal_list[0];
            }
            selected_value = encodeURIComponent(JSON.stringify({by:sort_by, sub:subtotal}));
        }

        adv_sort_dropdown.value = selected_value;
    }

    _build_sort_dropdown() {
        let adv_sort_dropdown = this.shadowRoot.querySelector("#adv_sort_dropdown");
        let old_sort_by = this.getAttribute("sort_by");
        let old_sort_subtotal = this.getAttribute("subtotal");

        let sort_by_list = JSON.parse(this.getAttribute("sort_by_list")) || [];
        let sort_subtotal_list = JSON.parse(this.getAttribute("subtotal_list")) || [];

        let name = this.getAttribute("name");
        /*
        let options = [{
            value: encodeURIComponent(JSON.stringify({by: name})),
            active: true,
            show_name: name
        }];
        */
        let dname = name;
        let index = sort_by_list.findIndex(x => x.n === name);
        if (index !== -1) {
          dname = sort_by_list[index].dname;
        }
        let options_html = `<option value="${encodeURIComponent(JSON.stringify({by: name}))}">${dname}</option>`;
        let selected_value = encodeURIComponent(JSON.stringify({by: name}));
        let count = 0;
        if (sort_subtotal_list.length > 0) {
            if (sort_subtotal_list.includes("Total")) {
              for (let by of sort_by_list) {
                if (by.n === name) {
                  continue;
                }
                options_html += `<option value="${encodeURIComponent(JSON.stringify({by: by.n, sub: "Total"}))}">${by.dname}</option>`;
                count++;
              }
            }
            for (let by of sort_by_list) {
                if (by.n !== name) {
                  options_html += `<option value="${perspective.SEPARATOR_TEXT}" disabled>${perspective.SEPARATOR_TEXT}</option>`;
                  /*
                    options.push({
                        value: by + perspective.SEPARATOR_TEXT,
                        active: false,
                        show_name: perspective.SEPARATOR_TEXT
                    });
                    options.push({
                        value: by + " in...",
                        active: false,
                        show_name: by + " in..."
                    });
                    */
                    const label = by.dname + " in...";
                    options_html = options_html + `<optgroup label="${label}">`;
                    for (let sub of sort_subtotal_list) {
                        if (sub === "Total") {
                          continue;
                        }
                        /*
                        options.push({
                            value: encodeURIComponent(JSON.stringify({by: by, sub: sub})),
                            active: true,
                            show_name: persective.TAB_SPACES + sub
                        });
                        */
                        options_html = options_html + `<option value="${encodeURIComponent(JSON.stringify({by: by, sub: sub}))}">${sub}</option>`;

                        count++;

                        if (/*options.length*/ count >= perspective.MAX_DROPDOWN) {
                            break;
                        }
                    }
                    options_html = options_html + `</optgroup>`;
                    if (/*options.length*/ count >= perspective.MAX_DROPDOWN) {
                        break;
                    }

                    count++;
                }
            }
            if (old_sort_by && old_sort_by != name && old_sort_by !== "null" && old_sort_by !== "undefined") {
                if (!old_sort_subtotal || old_sort_subtotal === "null" || old_sort_subtotal === "undefined") {
                    old_sort_subtotal = sort_subtotal_list[0];
                }
                selected_value = encodeURIComponent(JSON.stringify({by: old_sort_by, sub: old_sort_subtotal}));
            }
        } else {
            for (let by of sort_by_list) {
                if (by.n !== name) {
                  /*
                    options.push({
                        value: encodeURIComponent(JSON.stringify({by: by})),
                        active: true,
                        show_name: by
                    });
                    */
                    options_html = options_html + `<option value="${encodeURIComponent(JSON.stringify({by: by.n}))}">${by.dname}</option>`;
                    if (/*options.length*/ count >= perspective.MAX_DROPDOWN) {
                        break;
                    }
                    count++;
                }
            }
            if (old_sort_by && old_sort_by !== name && old_sort_by !== "null" && old_sort_by !== "undefined") {
                selected_value = encodeURIComponent(JSON.stringify({by: old_sort_by}));
            }
        }
        /*
        adv_sort_dropdown.innerHTML = options.map(option => {
            if (option.active) {
                return `<option value="${option.value}">${option.show_name}</option>`;
            } else {
                return `<option value="${option.value}" disabled>${option.show_name}</option>`;
            }
        }).join("");
        */
        adv_sort_dropdown.innerHTML = options_html;
        adv_sort_dropdown.value = selected_value;
    }

    _update_filter_dropdown_value() {
        let name = this.getAttribute("name");
        let container = this.getAttribute("container");
        const filter = JSON.parse(this.getAttribute("filter")) || {};
        const is_custom_filter_applied = this._is_custom_filter_applied(filter);
        let filter_by = filter.filter_by;
        let filter_subtotal = filter.subtotal;
        let adv_filter_dropdown = this.shadowRoot.querySelector("#adv_filter_dropdown");
        let subtotal_list = JSON.parse(this.getAttribute("filter_sublist")) || [];
        let selected_value;

        if (!filter_by || filter_by === "null" || filter_by === "undefined") {
            if (is_custom_filter_applied) {
              selected_value = encodeURIComponent(JSON.stringify({by:name}));
            } else {
              selected_value = "none";
            }
        } else if (filter_by === name) {
            selected_value = encodeURIComponent(JSON.stringify({by:name}));
        } else if (subtotal_list.length == 0) {
            selected_value = encodeURIComponent(JSON.stringify({by:filter_by}));
        } else {
            if (!filter_subtotal || filter_subtotal === "null" || filter_subtotal === "undefined") {
                filter_subtotal = subtotal_list[0];
            }
            selected_value = encodeURIComponent(JSON.stringify({by:filter_by, sub:filter_subtotal}));
        }

        adv_filter_dropdown.value = selected_value;
        if (selected_value === "none" && (this.filter_by_sub_visibility || ["row_pivots", "column_pivots"].includes(container))) {
          this._update_adv_filter_visibility(false);
        } else {
          this._update_adv_filter_visibility(true);
        }
    }

    _build_filter_dropdown() {
        let adv_filter_dropdown = this.shadowRoot.querySelector("#adv_filter_dropdown");
        const filter = JSON.parse(this.getAttribute("filter")) || {};
        let old_filter_by = filter.filter_by;
        let old_filter_subtotal = filter.subtotal;

        let filter_by_list = JSON.parse(this.getAttribute("filter_by_list")) || [];
        let filter_subtotal_list = JSON.parse(this.getAttribute("filter_sublist")) || [];

        let name = this.getAttribute("name");
        /*
        let options = [{
            value: encodeURIComponent(JSON.stringify({by: name})),
            active: true,
            show_name: name
        }];
        */
        let dname = name;
        let index = filter_by_list.findIndex(x => x.n === name);
        if (index !== -1) {
          dname = filter_by_list[index].dname;
        }
        let options_html = `<option value="none">Choose field to filter</option>`
          + `<option value="${encodeURIComponent(JSON.stringify({by: name}))}">${dname}</option>`;
        let selected_value = "none";
        let count = 0;
        if (filter_subtotal_list.length > 0) {
            if (filter_subtotal_list.includes("Total")) {
              for (let by of filter_by_list) {
                if (by.n === name) {
                  continue;
                }
                options_html += `<option value="${encodeURIComponent(JSON.stringify({by: by.n, sub: "Total"}))}">${by.dname}</option>`;
                count++;
              }
            }
            for (let by of filter_by_list) {
                if (by.n !== name) {
                    options_html += `<option value="${perspective.SEPARATOR_TEXT}" disabled>${perspective.SEPARATOR_TEXT}</option>`;
                    /*
                    options.push({
                        value: by.n + perspective.SEPARATOR_TEXT,
                        active: false,
                        show_name: perspective.SEPARATOR_TEXT
                    });
                    options.push({
                        value: by.n + " in...",
                        active: false,
                        show_name: by.n + " in..."
                    });
                    */
                    const label = by.dname + " in...";
                    options_html = options_html + `<optgroup label="${label}">`;
                    for (let sub of filter_subtotal_list) {
                        if (sub === "Total") {
                          continue;
                        }
                        /*
                        options.push({
                            value: encodeURIComponent(JSON.stringify({by: by.n, sub: sub})),
                            active: true,
                            show_name: persective.TAB_SPACES + sub
                        });
                        */
                        options_html = options_html + `<option value="${encodeURIComponent(JSON.stringify({by: by.n, sub: sub}))}">${sub}</option>`;
                        count++;
                        if (/*options.length*/ count >= perspective.MAX_DROPDOWN) {
                            break;
                        }
                    }
                    if (/*options.length*/ count >= perspective.MAX_DROPDOWN) {
                        break;
                    }

                    count++;
                }
            }
            if (old_filter_by && old_filter_by != name && old_filter_by !== "null" && old_filter_by !== "undefined") {
                if (!old_filter_subtotal || old_filter_subtotal === "null" || old_filter_subtotal === "undefined") {
                    old_filter_subtotal = filter_subtotal_list[0];
                }
                selected_value = encodeURIComponent(JSON.stringify({by: old_filter_by, sub: old_filter_subtotal}));
            }
        } else {
            for (let by of filter_by_list) {
                if (by.n !== name) {
                    /*
                    options.push({
                        value: encodeURIComponent(JSON.stringify({by: by.n})),
                        active: true,
                        show_name: by.n
                    });
                    */
                    options_html = options_html + `<option value="${encodeURIComponent(JSON.stringify({by: by.n}))}">${by.dname}</option>`;
                    count++;
                    if (/*options.length*/ count >= perspective.MAX_DROPDOWN) {
                        break;
                    }
                }
            }
            if (old_filter_by && old_filter_by !== name && old_filter_by !== "null" && old_filter_by !== "undefined") {
                selected_value = encodeURIComponent(JSON.stringify({by: old_filter_by}));
            }
        }
        /*
        adv_filter_dropdown.innerHTML = options.map(option => {
            if (option.active) {
                return `<option value="${option.value}">${option.show_name}</option>`;
            } else {
                return `<option value="${option.value}" disabled>${option.show_name}</option>`;
            }
        }).join("");
        */
        adv_filter_dropdown.innerHTML = options_html;
        adv_filter_dropdown.value = selected_value;
    }

    _update_clear_filter_button() {
        const name = this.getAttribute("name");
        let show_clear_filter_button = false;
        let adv_filter_dropdown = this.shadowRoot.querySelector("#adv_filter_dropdown");
        const filter_by_sub = (adv_filter_dropdown.value && adv_filter_dropdown.value !== "none") ? JSON.parse(decodeURIComponent(adv_filter_dropdown.value)) : {by:name};
        if (filter_by_sub.by !== name) {
            show_clear_filter_button = true;
        }
        let adv_nb_filter_operator = this.shadowRoot.querySelector("#adv_nb_filter_operator");
        if (adv_nb_filter_operator.value && !perspective.INVALID_FILTER_OPERATORS.includes(adv_nb_filter_operator.value)) {
            show_clear_filter_button = true;
        }
        let advanced_search_input = this.shadowRoot.querySelector("#advanced_search_input");
        if (advanced_search_input.value && advanced_search_input.value !== "") {
            show_clear_filter_button = true;
        }
        const suggestion_list = this.shadowRoot.querySelector("#suggestion_list");
        for (let suggestion of suggestion_list.children) {
            let name = suggestion.getAttribute("data"); //suggestion.querySelector(".filter-data-item").innerHTML;
            if (name === "__ADD_CURRENT_SELECTION__") {
              continue;
            }
            let input = suggestion.querySelector("input[name=cb_filters]");
            if (!input.checked) {
                show_clear_filter_button = true;
                break;
            }
        }

        let adv_clear_filter = this.shadowRoot.querySelector("#adv_clear_filter");
        if (show_clear_filter_button) {
            adv_clear_filter.classList.remove("hidden");
        } else {
            adv_clear_filter.classList.add("hidden");
        }
    }

    _update_sort_order(event, old_sort_order, new_sort_order, old_sort_num = undefined, new_sort_num = undefined) {
        this.setAttribute("sort_order", new_sort_order);
        if (this._is_auto_query()) {
            event.detail = {
                row_settings: this,
                name: this.getAttribute("name"),
                new_sort_order: new_sort_order,
                old_sort_order: old_sort_order
            };
            if ((new_sort_num && new_sort_num !== "null" && new_sort_num !== "undefined")
                || (old_sort_num && old_sort_num !== "null" && old_sort_num !== "undefined")) {
                event.detail.old_sort_num = old_sort_num;
                event.detail.new_sort_num = new_sort_num;
            }
            this.dispatchEvent(
                new CustomEvent("sort_order-selected", { detail: event })
            );
        } else {
            var options = {
                sort_order: {
                    old_value: old_sort_order,
                    new_value: new_sort_order
                }
            };
            if ((new_sort_num && new_sort_num !== "null" && new_sort_num !== "undefined")
                || (old_sort_num && old_sort_num !== "null" && old_sort_num !== "undefined")) {
                options.sort_num = {
                    old_value: old_sort_num,
                    new_value: new_sort_num
                }
            }
            this._update_sort_filter_query(options);
        }
    }

    // clear all checkboxes as unchecked
    _clear_auto_filter_checkboxes(is_custom_filter){

      if (is_custom_filter === undefined || is_custom_filter === null){
        const filter = JSON.parse(this.getAttribute("filter") || "{}");
        is_custom_filter = filter.is_custom_filter;
      }

      if (is_custom_filter === true){
        const suggestion_list = this.shadowRoot.querySelector("#suggestion_list");

        for (let suggestion of suggestion_list.children) {
          let name = suggestion.getAttribute("data");
          let input = suggestion.querySelector("input[name=cb_filters]");

          if (name === SELECT_ALL_KEY) {
            let checkall_id_checkmark = this.shadowRoot.querySelector("#checkall_id_checkmark");
            checkall_id_checkmark.classList.remove("checkmark-indeterminate");
            input.indeterminate = false;
          }

          if (input){
            input.checked = false;
          }

        }
      }
    }

    // Reset auto filters
    _clear_auto_filter_obj(filter){
      if (filter && typeof(filter) === "object"){
        delete filter.search;
        delete filter.unselected_all;
        delete filter.ignore_list;
        delete filter.selected_list;
      }
    }

    _is_auto_filter_applied(filter){
      if (!filter){
        return false;
      }

      if ((filter.search !== undefined && filter.search !== null && filter.search !== "")
        || (filter.ignore_list && filter.ignore_list.length >0)
        || (filter.selected_list && filter.selected_list.length >0)
        || (filter.unselected_all === true)
      ){
        return true;
      }

      return false;
    }

    // Reset custom filters
    _clear_custom_filter(filter){
      if (filter && typeof(filter) === "object"){
        delete filter.operator;
        delete filter.operand;
        delete filter.filter_by;
        delete filter.subtotal;

        if (filter.is_custom_filter === true){
          filter.is_custom_filter = false;
        }
      }
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

    _update_filter(event, old_filter = undefined) {

        this._adv_btn_ok.classList.remove("inactive");

        let advanced_feature = this.getAttribute("advanced_feature");
        let filter_operand = this.shadowRoot.querySelector("#adv_nb_filter_operand");
        let filter_operand_date = this.shadowRoot.querySelector("#adv_nb_filter_operand_date");
        let filter_second_operand = this.shadowRoot.querySelector("#adv_nb_filter_second_operand");
        let filter_second_operand_date = this.shadowRoot.querySelector("#adv_nb_filter_second_operand_date");
        let filter_top_n_type = this.shadowRoot.querySelector("#adv_nb_filter_top_n_type");
        let adv_nb_filter_operator = this.shadowRoot.querySelector("#adv_nb_filter_operator");
        let filter_period = this.shadowRoot.querySelector("#adv_nb_filter_period");
        let filter_date_unit = this.shadowRoot.querySelector("#adv_nb_filter_date_unit");
        let val = (adv_nb_filter_operator.value === "between" || adv_nb_filter_operator.value === "element between") ? [filter_operand.value || "", filter_second_operand.value || ""] : filter_operand.value;
        var type = this.getAttribute("type");
        let name = this.getAttribute("name");
        let filter_by = name;
        let filter_subtotal;
        let operator_val = perspective.INVALID_FILTER_OPERATORS.includes(adv_nb_filter_operator.value) ? undefined : adv_nb_filter_operator.value;
        if (["FILTER", "QUICK_FILTER"].includes(advanced_feature)) {
            let adv_filter_dropdown = this.shadowRoot.querySelector("#adv_filter_dropdown");
            if (!adv_filter_dropdown.value || adv_filter_dropdown.value === "none") {
              filter_by = undefined;
              filter_subtotal = undefined;
            } else {
              const filter_by_sub = adv_filter_dropdown.value ? JSON.parse(decodeURIComponent(adv_filter_dropdown.value)) : {by:name};
              filter_by = filter_by_sub.by;
              filter_subtotal = filter_by_sub.sub;
            }
        }
        if (filter_by && filter_by !== name) {
            const filter_by_list = JSON.parse(this.getAttribute("filter_by_list")) || [];
            for (let by of filter_by_list) {
                if (by.n === filter_by) {
                    type = by.t;
                    break;
                }
            }
        }

        if (((type === "date") || (type === "datetime")) && operator_val !== "relative date" && operator_val !== "top n"
            && operator_val !== "in" && operator_val !== "not in") {
          val = (adv_nb_filter_operator.value === "between" || adv_nb_filter_operator.value === "element between") ? [filter_operand_date.value || "", filter_second_operand_date.value || ""] : filter_operand_date.value;
        }
        switch (type) {
            case "float":
                if (operator_val !== "in" && operator_val !== "not in" && operator_val !== "between" && operator_val !== "element between") {
                    val = parseFloat(val);
                } else if (operator_val === "between" || operator_val === "element between") {
                    val = val.map(x => x.trim());
                    let new_val = [];
                    for (let idx in val) {
                        if (parseFloat(val[idx]) || parseFloat(val[idx]) === 0) {
                            new_val.push(val[idx]);
                        } else {
                            new_val.push(null);
                        }
                    }
                    val = new_val;
                }
                break;
            case "integer":
                if (operator_val !== "in" && operator_val !== "not in" && operator_val !== "between" && operator_val !== "element between") {
                    val = parseInt(val);
                } else if (operator_val === "between" || operator_val === "element between") {
                    val = val.map(x => x.trim());
                    let new_val = [];
                    for (let idx in val) {
                        if (parseInt(val[idx]) || parseInt(val[idx]) === 0) {
                            new_val.push(val[idx]);
                        } else {
                            new_val.push(null);
                        }
                    }
                    val = new_val;
                }
                break;
            case "decimal":
                if (operator_val !== "in" && operator_val !== "not in" && operator_val !== "between" && operator_val !== "element between") {
                    val = parseFloat(val);
                } else if (operator_val === "between" || operator_val === "element between") {
                    val = val.map(x => x.trim());
                    let new_val = [];
                    for (let idx in val) {
                        if (parseFloat(val[idx]) || parseFloat(val[idx]) === 0) {
                            new_val.push(val[idx]);
                        } else {
                            new_val.push(null);
                        }
                    }
                    val = new_val;
                }
                break;
            case "boolean":
                val = val.toLowerCase().indexOf("true") > -1;
                break;
            case "list_integer": {
              if (operator_val && operator_val !== "") {
                if (operator_val === "between" || operator_val === "element between") {
                  val = val.map(x => x.trim());
                  let new_val = [];
                  for (let idx in val) {
                      if (parseInt(val[idx]) || parseInt(val[idx]) === 0) {
                          new_val.push(val[idx]);
                      } else {
                          new_val.push(null);
                      }
                  }
                  val = new_val;
                } else if (val !== null && perspective.ONE_SIDE_OPERATOR.indexOf(operator_val) === -1
                    && !perspective.NOT_CAST_LIST_VALUE_OPERATOR.includes(operator_val)) {
                    if (val[0] === "[" && val[val.length - 1] === "]") {
                      val = val.substring(1, val.length - 1);
                    }
                    val = val.split(",").map(x => x.trim());
                } else if (val !== null) {
                  val = parseInt(val);
                }
              }
            } break;
            case "list_float": {
              if (operator_val && operator_val !== "") {
                if (operator_val === "between" || operator_val === "element between") {
                  val = val.map(x => x.trim());
                  let new_val = [];
                  for (let idx in val) {
                      if (parseFloat(val[idx]) || parseFloat(val[idx]) === 0) {
                          new_val.push(val[idx]);
                      } else {
                          new_val.push(null);
                      }
                  }
                  val = new_val;
                } else if (val !== null && perspective.ONE_SIDE_OPERATOR.indexOf(operator_val) === -1
                      && !perspective.NOT_CAST_LIST_VALUE_OPERATOR.includes(operator_val)) {
                      if (val[0] === "[" && val[val.length - 1] === "]") {
                        val = val.substring(1, val.length - 1);
                      }
                      val = val.split(",").map(x => x.trim());
                  } else if (val !== null) {
                    val = parseFloat(val);
                  }
              }
            } break;
            case "list_boolean":
            case "list_string":
            case "list_datetime":
            case "list_date":
            case "list_duration":
              if (operator_val && operator_val !== "") {
                if (operator_val === "between" || operator_val === "element between") {
                  val = val.map(x => x.trim());
                } else if (val !== null && perspective.ONE_SIDE_OPERATOR.indexOf(operator_val) === -1
                      && !perspective.NOT_CAST_LIST_VALUE_OPERATOR.includes(operator_val)) {
                      if (val[0] === "[" && val[val.length - 1] === "]") {
                        val = val.substring(1, val.length - 1);
                      }
                      val = val.split(",").map(x => x.trim());
                }
              }
              break;
            case "string":
            default: {
                if (operator_val === "between" || operator_val === "element between") {
                    val = val.map(x => x.trim());
                }
            }
        }
        if (operator_val === "in" || operator_val === "not in") {
            if (["string", "date", "datetime", "duration", "list_string", "list_date", "list_duration", "list_datetime"].includes(type)) {
              val = this._parse_string_to_array(val);
            } else {
              val = val.split(",").map(x => x.trim());
            }
        } else if (operator_val === "top n") {
            val = [(parseInt(val)||"").toString()].concat([filter_top_n_type.value || "Items"]);
        }
        let operand = val;
        if (operator_val === "relative date") {
            let period_val = filter_period.value || "previous";
            let operand_val =  perspective.RELATIVE_DATE_PERIOD_THIS.includes(period_val) ? "" : (parseInt(val) ? val : null);
            operand = [period_val, operand_val, filter_date_unit.value || "days"];
        }
        operand = (operand || operand === 0) ? operand : undefined;
        old_filter = old_filter || this.getAttribute("filter");
        var old_filter_obj = JSON.parse(old_filter) || {};
        var ignore_list = [];
        if (event && event.ignore_list) {
            ignore_list = event.ignore_list;
        } else {
            if (old_filter_obj && old_filter_obj.ignore_list) {
                ignore_list = old_filter_obj.ignore_list;
            }
        }

        var selected_list = [];
        if (event && event.selected_list) {
            selected_list = event.selected_list;
        } else {
            if (old_filter_obj && old_filter_obj.selected_list) {
                selected_list = old_filter_obj.selected_list;
            }
        }

        var unselected_all = false;
        if (event && event.unselected_all === true) {
          unselected_all = true;
        }

        let search = this._advanced_search_input.value || "";
        if (event && event.search) {
            search = event.search;
        }

        let is_custom_filter = this._cfc_link.getAttribute("is_custom_filter");
        if (is_custom_filter === true || is_custom_filter === "true"){
          is_custom_filter = true;
        }else {
          is_custom_filter = false;
        }

        this._add_the_prev_filter_selection(search, selected_list, ignore_list, unselected_all, old_filter_obj.datalist_contains_all, is_custom_filter);

        if (this.is_filter_selection_added && this.prev_filter_selections && this.prev_filter_selections.length > 0){

          // Only apply if the search text is not empty
          if (search !== undefined && search !== null && search !== ""){
            /*
            let prev_index = -1;
            for (var pi = this.prev_filter_selections.length-1; pi >= 0; pi--){
              if (this.prev_filter_selections[pi].search_text !== search){
                prev_index = pi;
                break;
              }
            }
            */
            let prev_index = 0;

            // Need to add the current selections into the new selected list
            let prev_selected_list = prev_index !== -1 ? this.prev_filter_selections[prev_index].selected_list : [];
            if (!prev_selected_list){
              prev_selected_list = [];
            }

            if (this.prev_filter_selections[prev_index] && this.prev_filter_selections[prev_index].is_custom_filter === true){
              // Selected all
              ignore_list = [];
              selected_list = [];
              unselected_all = false;
            }else{
              for (let prev_item of prev_selected_list){
                if (!selected_list.includes(prev_item)){
                  selected_list.push(prev_item);
                }
              }
            }

          }
        }

        let nf = {operator: operator_val, operand: operand,
            filter_by: filter_by, subtotal: filter_subtotal, ignore_list: ignore_list,
            selected_list: selected_list, unselected_all: unselected_all,
            datalist_contains_all: old_filter_obj.datalist_contains_all, search: search, is_custom_filter: is_custom_filter};

        //if the custom-filter is applied first, the auto-filter will be automatically cleared
        let is_curr_custom_filter_applied = this._is_custom_filter_applied(old_filter_obj);
        let is_new_custom_filter_applied = this._is_custom_filter_applied(nf);

        let is_curr_auto_filter_applied = this._is_auto_filter_applied(old_filter_obj);
        let is_new_auto_filter_applied = this._is_auto_filter_applied(nf);

        if (is_curr_custom_filter_applied === false && is_new_custom_filter_applied === true){
          this._clear_auto_filter_obj(nf);
        }else if(is_curr_auto_filter_applied === false && is_new_auto_filter_applied === true){
          this._clear_custom_filter(nf);
        }

        // Need to update prev_filter_selections
        if (is_custom_filter !== nf.is_custom_filter && this.prev_filter_selections && this.prev_filter_selections.length > 0){
          this.prev_filter_selections[this.prev_filter_selections.length -1].is_custom_filter = nf.is_custom_filter;
        }

        var new_filter = JSON.stringify(nf);
        this.setAttribute("filter", new_filter);

        if (this._is_auto_query()) {
            if (event) {
                this.dispatchEvent(new CustomEvent("filter-selected", {detail: {
                    row_settings: this,
                    name: name,
                    new_filter: new_filter,
                    old_filter: old_filter
                }}));
            }
        } else {
            this._update_sort_filter_query({
                filter: {
                    old_value: old_filter,
                    new_value: new_filter
                }
            });
        }
    }

    _parse_string_to_array(str) {
      let rval = [];
      let temp_arr = str.split(",");
      if (temp_arr.length > 0) {
        let begin_str_char = '';
        let current_str = [];
        for (let sub_str of temp_arr) {
          let temp_str = sub_str.trim();
          // Update begin char string
          if (begin_str_char === '') {
            begin_str_char = (temp_str[0] === '"' || temp_str[0] === '\'') ? temp_str[0] : '';
            // If begin char is '', push string to current string
            if (begin_str_char === '') {
              current_str.push(sub_str);
              rval.push(current_str.join(",").trim());
              current_str = [];
            }
            // Case begin char is '"' or '\''
            else {
              let end_str_char = '';
              if (temp_str[temp_str.length - 1] === '"' || temp_str[temp_str.length - 1] === '\'') {
                if (temp_str.length - 2 >= 0 && temp_str[temp_str.length - 2] === '\\') {
                  end_str_char = '';
                } else {
                  end_str_char = temp_str[temp_str.length - 1];
                }
              }
              if (end_str_char !== begin_str_char) {
                current_str.push(sub_str);
              } else {
                current_str.push(sub_str);
                rval.push(current_str.join(",").trim());
                current_str = [];
              }
            }
          }
          // Check begin char and end char, concat if needed
          else {
            let end_str_char = '';
            if (temp_str[temp_str.length - 1] === '"' || temp_str[temp_str.length - 1] === '\'') {
              if (temp_str.length - 2 >= 0 && temp_str[temp_str.length - 2] === '\\') {
                end_str_char = '';
              } else {
                end_str_char = temp_str[temp_str.length - 1];
              }
            }
            if (end_str_char !== begin_str_char) {
              current_str.push(sub_str);
            } else {
              current_str.push(sub_str);
              rval.push(current_str.join(",").trim());
              current_str = [];
            }
          }
        }
        if (current_str.length > 0) {
          rval.push(current_str.join(",").trim());
        }
      }
      return rval;
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

    /**
     * Build binning attribute for row settings and row
     */
    _build_binning_attribute() {
        let binning_type = this._binning_dropdown.value;
        var binning = {
            type: binning_type
        };
        if (binning_type === "ON") {
            const type = this.getAttribute("type");
            const is_float = type === "float" || type === "list_float";
            binning.max = is_float ? parseFloat(this._binning_max.value) : parseInt(this._binning_max.value);
            binning.min = is_float ? parseFloat(this._binning_min.value) : parseInt(this._binning_min.value);
            binning.size = is_float ? parseFloat(this._binning_size.value) : parseInt(this._binning_size.value);
        }
        return binning;
    }

    /**
     * Function check validate binning
     */
    _validate_binning() {
        let type = this.getAttribute("type");
        let agg_level = this.getAttribute("agg_level");
        if (["integer", "float", "list_integer", "list_float"].includes(type)
            || (["date", "datetime", "list_date", "list_datetime"].includes(type) && agg_level === "YEAR")) {
            let binning_type = this._binning_dropdown.value;
            if (binning_type === "ON") {
                let is_float = type === "float" || type === "list_float";
                let max = is_float ? parseFloat(this._binning_max.value) : parseInt(this._binning_max.value);
                let min = is_float ? parseFloat(this._binning_min.value) : parseInt(this._binning_min.value);
                let size = is_float ? parseFloat(this._binning_size.value) : parseInt(this._binning_size.value);
                if (isNaN(max) || isNaN(min) || isNaN(size)) {
                    return false;
                }
                if (max <= min) {
                    return false;
                }
                if (size <= 0) {
                    return false;
                }
                return true;
            } else {
                return true;
            }
        } else {
            return false;
        }
    }

    /**
     * Validate binning and notify to viewer by calling event binning-updated
     * @param {*} event
     */
    _update_binning(event) {
        if (this._validate_binning()) {
            var old_binning = this.getAttribute("binning");
            var new_binning = JSON.stringify(this._build_binning_attribute());
            if (old_binning === new_binning) {
                return;
            }
            this.setAttribute("binning", new_binning);
            event.detail = {
                row_settings: this,
                name: this.getAttribute("name"),
                new_binning: new_binning,
                old_binning: old_binning
            };
            this.dispatchEvent(new CustomEvent("binning-updated", {detail: event}));
        }
    }

    _update_filter_operand(type = "normal") {
      let adv_nb_filter_operand = this.shadowRoot.querySelector("#adv_nb_filter_operand");
      let adv_nb_filter_second_operand = this.shadowRoot.querySelector("#adv_nb_filter_second_operand");
      let adv_nb_filter_operand_date = this.shadowRoot.querySelector("#adv_nb_filter_operand_date");
      let adv_nb_filter_operand_date_calendar = this.shadowRoot.querySelector("#adv_nb_filter_operand_date_calendar");
      let adv_nb_filter_second_operand_date = this.shadowRoot.querySelector("#adv_nb_filter_second_operand_date");
      let adv_nb_filter_second_operand_date_calendar = this.shadowRoot.querySelector("#adv_nb_filter_second_operand_date_calendar");
      if (type === "date") {
        adv_nb_filter_operand_date.classList.remove("hidden");
        adv_nb_filter_operand_date_calendar.classList.remove("hidden");
        adv_nb_filter_second_operand_date.classList.remove("hidden");
        adv_nb_filter_second_operand_date_calendar.classList.remove("hidden");
        adv_nb_filter_operand.classList.add("hidden");
        adv_nb_filter_second_operand.classList.add("hidden");
      } else {
        adv_nb_filter_operand.classList.remove("hidden");
        adv_nb_filter_second_operand.classList.remove("hidden");
        adv_nb_filter_operand_date.classList.add("hidden");
        adv_nb_filter_operand_date_calendar.classList.add("hidden");
        adv_nb_filter_second_operand_date.classList.add("hidden");
        adv_nb_filter_second_operand_date_calendar.classList.add("hidden");
      }
    }

    _filter_search_data_list(search_text = undefined, reset_filter = false){
      this.dispatchEvent(new CustomEvent("filter-search-datalist", {detail: {
          row_settings: this,
          search_text: search_text ? search_text : this._advanced_search_input.value || "",
          reset_filter: reset_filter
      }}));
    }

    filter_data_list(reset_filter = false){
      var search_text = this._advanced_search_input.value || "";
      const search_text_upper = search_text.toUpperCase().trim();

      const filter = JSON.parse(this.getAttribute("filter")) || {};
      const datalist_contains_all = filter? filter.datalist_contains_all: false;

      if (search_text === undefined || search_text === null || search_text === ""){
        this._clear_the_prev_filter_selection();
      }

      if (!datalist_contains_all){
        // Search datalist in CPP
        this._filter_search_data_list(undefined, reset_filter);
        return;
      }

      const select_all_with_search_text = search_text_upper ? "(Select All Search Results)" : "(Select All)";

      var a_rows = this._suggestion_list.getElementsByTagName("li");

      var checkall_id_checkmark = this.shadowRoot.querySelector("#checkall_id_checkmark");
      var input_checkall_id = this.shadowRoot.querySelector("#input_checkall_id");
      var checkall_text_id = this.shadowRoot.querySelector("#checkall_text_id");

      if (!input_checkall_id){
        return;
      }

      checkall_text_id.textContent = select_all_with_search_text;

      let ignore_list = [];
      let selected_list = [];
      let unselected_all = false;//(reset_filter === true) ? false : true;
      //let selected_all = true;

      for (var i = 0; i < a_rows.length; i++) {
          var data = a_rows[i].getAttribute("data");

          const input = a_rows[i].querySelector("input[name=cb_filters]");

          if (reset_filter === true // All checkboxes are automatically checked in case the user clears filter
              || (search_text === undefined || search_text === null || search_text === "") // In case the user remove the search
            ) {
            if(data === ADD_CURRENT_SELECTION_KEY){

              // Must hide the current selection checkbox
              input.checked = false;
              a_rows[i].classList.add("hidden");
            }else{
              a_rows[i].classList.remove("hidden");
              input.checked = true;
            }

            continue;
          }

          if (!data){
            // Only hide (blank) in case filter search
            a_rows[i].classList.add("hidden");
            continue;
          }

          if (a_rows[i].getAttribute("id") === "checkall_id"){
            // Pass: Always keep (Select All) active
          }else if(data === ADD_CURRENT_SELECTION_KEY){
            input.checked = false;
            /*
            // Only show if the previous search option is applied
            if (search_text !== undefined && search_text !== null && search_text !== ""
              && filter
              && (
                (filter.search !== undefined && filter.search !== null && filter.search !== "")
                || (filter.ignore_list && filter.ignore_list.length > 0)
                || (filter.selected_list && filter.selected_list.length > 0)
              )
            ){
              a_rows[i].classList.remove("hidden");
            }else{
              a_rows[i].classList.add("hidden");
            }
            */

            // Only show if the auto filter or custom filter is applied when the popup opens
            const started_filter = this.prev_filter_selections.length > 0 ? this.prev_filter_selections[0]: undefined;
            if (search_text !== undefined && search_text !== null && search_text !== ""
              && started_filter
              && (
                //started_filter.is_custom_filter === true ||
                (started_filter.search !== undefined && started_filter.search !== null && started_filter.search !== "")
                || (started_filter.ignore_list && started_filter.ignore_list.length > 0)
                || (started_filter.selected_list && started_filter.selected_list.length > 0)
              )
            ){
              a_rows[i].classList.remove("hidden");
            }else{
              a_rows[i].classList.add("hidden");
            }

          }else if (!search_text_upper || data.toUpperCase().indexOf(search_text_upper) > -1) {
            a_rows[i].classList.remove("hidden");
            input.checked = true;
            selected_list.push(data);
          }else{
            a_rows[i].classList.add("hidden");
            input.checked = false;
          }
      }

      if (input_checkall_id && checkall_id_checkmark){
        /*
        if (unselected_all === true){// Unselected all
          input_checkall_id.checked = false;
          input_checkall_id.indeterminate = false;
          checkall_id_checkmark.classList.remove("checkmark-indeterminate");
        }else if(selected_all === true){ // Selected all
          input_checkall_id.checked = true;
          input_checkall_id.indeterminate = false;
          checkall_id_checkmark.classList.remove("checkmark-indeterminate");
        }else{ // Indeterminate
          input_checkall_id.checked = false;
          input_checkall_id.indeterminate = true;
          checkall_id_checkmark.classList.add("checkmark-indeterminate");
        }
        */
        input_checkall_id.checked = true;
        input_checkall_id.indeterminate = false;
        checkall_id_checkmark.classList.remove("checkmark-indeterminate");
      }

      if (reset_filter === true // All checkboxes are automatically checked in case the user clears filter
          || (search_text === undefined || search_text === null || search_text === "") // In case the user remove the search
        ){
          selected_list = [];
          search_text = "";
      }else if(selected_list.length === 0
        /*&& (
          this.getAttribute("container") === "active_columns"
          || (this.getAttribute("container") === "row_pivots" && this.getAttribute("is_flat_pivot") === "true")
        )*/){

        // Prevent the user to click on OK button
        this._adv_btn_ok.classList.add("inactive");

        // Not allow to run query if there are no items
        return;
      }

      this._update_filter({ignore_list: ignore_list, selected_list: selected_list, unselected_all: unselected_all, search: search_text});
    }

    _is_auto_query() {
        var auto_query = this.getAttribute("auto_query");
        var advanced_feature = this.getAttribute("advanced_feature");
        if ((auto_query === "false" || auto_query === false) && (["FILTER", "QUICK_FILTER"].includes(advanced_feature))) {
            return false;
        }
        return true;
    }

    _reset_sort_filter_query() {
        if (!this._sort_filter_query
            || (Object.keys(this._sort_filter_query).length === 0 && this._sort_filter_query.constructor === Object)) {
            return;
        }

        if (this._is_auto_query()) {
            return;
        }

        if ("sort_order" in this._sort_filter_query) {
            this.setAttribute("sort_order", this._sort_filter_query.sort_order.old_value);
        }
        if ("filter" in this._sort_filter_query) {
            this.setAttribute("filter", this._sort_filter_query.filter.old_value);
        }
        if ("sort_by" in this._sort_filter_query) {
            this.setAttribute("sort_by", this._sort_filter_query.sort_by.old_value);
        }
        if ("subtotal" in this._sort_filter_query) {
            this.setAttribute("subtotal", this._sort_filter_query.subtotal.old_value);
        }
        if ("sort_num" in this._sort_filter_query) {
            this.setAttribute("sort_num", this._sort_filter_query.sort_num.old_value);
        }
        this._sort_filter_query = {};
    }

    _update_sort_filter_query(options) {
        if (!this._sort_filter_query) {
            this._sort_filter_query = {};
        }
        if ("sort_order" in options) {
            if (this._sort_filter_query.sort_order) {
                this._sort_filter_query.sort_order = {
                    new_value: options.sort_order.new_value,
                    old_value: this._sort_filter_query.sort_order.old_value
                };
            } else {
                this._sort_filter_query.sort_order = options.sort_order;
            }
        }
        if ("filter" in options) {
            if (this._sort_filter_query.filter) {
                this._sort_filter_query.filter = {
                    new_value: options.filter.new_value,
                    old_value: this._sort_filter_query.filter.old_value
                }
            } else {
                this._sort_filter_query.filter = options.filter;
            }
        }
        if ("sort_by" in options) {
            if (this._sort_filter_query.sort_by) {
                this._sort_filter_query.sort_by = {
                    new_value: options.sort_by.new_value,
                    old_value: this._sort_filter_query.sort_by.old_value
                };
            } else {
                this._sort_filter_query.sort_by = options.sort_by;
            }
        }
        if ("subtotal" in options) {
            if (this._sort_filter_query.subtotal) {
                this._sort_filter_query.subtotal = {
                    new_value: options.subtotal.new_value,
                    old_value: this._sort_filter_query.subtotal.old_value
                };
            } else {
                this._sort_filter_query.subtotal = options.subtotal;
            }
        }
        if ("sort_num" in options) {
            if (this._sort_filter_query.sort_num) {
                let old_sort_num = this._sort_filter_query.sort_num.old_value;
                if ((options.new_value && options.new_value !== "null" && options.new_value !== "undefined")
                    || (old_sort_num && old_sort_num !== "null" && old_sort_num !== "undefined")) {
                    this._sort_filter_query.sort_num = {
                        new_value: options.sort_num.new_value,
                        old_value: old_sort_num
                    };
                } else {
                    delete this._sort_filter_query["sort_num"];
                }
            } else {
                this._sort_filter_query.sort_num = options.sort_num;
            }
        }
    }

    /*_update_default_binning_values() {
        let binning = JSON.parse(this.getAttribute("binning"));
        if (!binning || binning.type !== "ON") {
            return;
        }
        let default_binning = JSON.parse(this.getAttribute("default_binning"));
        if (!default_binning) {
            return;
        }
        let binning_max = this.shadowRoot.querySelector("#binning_max");
        let binning_min = this.shadowRoot.querySelector("#binning_min");
        let binning_size = this.shadowRoot.querySelector("#binning_size");
        binning_max.value = default_binning.max;
        binning_min.value = default_binning.min;
        binning_size.value = default_binning.size;
    }*/

    _filter_fields_datalist(){
      var search_text = this._search_fields_input.value || "";
      const search_text_upper = search_text.toUpperCase().trim();

      //const select_all_with_search_text = search_text_upper ? "(Select All Search Results)" : "(Select All)";

      var a_rows = this._search_fields.getElementsByTagName("li");

      var checkall_id_checkmark = this.shadowRoot.querySelector("#field_checkall_id_checkmark");
      var input_checkall_id = this.shadowRoot.querySelector("#field_input_checkall_id");
      var checkall_text_id = this.shadowRoot.querySelector("#field_checkall_text_id");

      if (!input_checkall_id){
        return;
      }

      //checkall_text_id.textContent = select_all_with_search_text;

      let selected_fields = [];
      let unall = true;
      let ckall = true;

      for (var i = 0; i < a_rows.length; i++) {
          var data = a_rows[i].getAttribute("data-dname") || a_rows[i].getAttribute("data");

          const input = a_rows[i].querySelector("input[name=cb_field]");

          //if (a_rows[i].getAttribute("id") === "field_checkall_id"){
          //  continue;
          //}

          // In case the user remove the search
          if ((search_text === undefined || search_text === null || search_text === "")) {
            a_rows[i].classList.remove("hidden");
            //input.checked = true;
            if (input.checked === true){
              selected_fields.push(data);
              unall = false;
            }else{
              ckall = false;
            }
            continue;
          }

          if (!data){
            a_rows[i].classList.add("hidden");
            continue;
          }
          /*
          if (a_rows[i].getAttribute("id") === "field_checkall_id"){
            // Pass: Always keep (Select All) active
          }else
          */
          if (data.toUpperCase().indexOf(search_text_upper) > -1) {
            a_rows[i].classList.remove("hidden");
            //input.checked = true;
            if (input.checked === true){
              selected_fields.push(data);
              unall = false;
            }else{
              ckall = false;
            }
          }else{
            a_rows[i].classList.add("hidden");
            //input.checked = false;
          }
      }

      if (input_checkall_id && checkall_id_checkmark){
        //input_checkall_id.checked = true;
        //input_checkall_id.indeterminate = false;
        //checkall_id_checkmark.classList.remove("checkmark-indeterminate");

        if (unall === true){ // Auto mark as Unselected all
          checkall_id_checkmark.classList.remove("checkmark-indeterminate");
          input_checkall_id.indeterminate = false;
          input_checkall_id.checked = false;
        }else if(ckall === true){ // Auto mark as Checked all
          checkall_id_checkmark.classList.remove("checkmark-indeterminate");
          input_checkall_id.indeterminate = false;
          input_checkall_id.checked = true;
        }else{ // Indeterminate
          checkall_id_checkmark.classList.add("checkmark-indeterminate");
          input_checkall_id.indeterminate = true;
          input_checkall_id.check = false;
        }

      }

      /*
      // In case the user remove the search
      if (search_text === undefined || search_text === null || search_text === ""){
          selected_fields = [];
          search_text = "";
      }
      */
      /*
      if(selected_fields.length === 0){
        this._update_nb_of_searching_fields(selected_fields.length, this.c_info.length);

        // Not allow to update
        return;
      }
      */
      this._updates_search(selected_fields);
    }

    is_digit(key){
      const is_d = /^\d+$/.test(key);
      if (!is_d){
          return false;
      }
      return true;
    }

    // Negative, float
    is_number(key){

      // Improve this later
      if (key === "." || key === "-"){
        return true;
      }
      const is_d = /^-?\d+$/.test(key);
      if (!is_d){
          return false;
      }
      return true;
    }
    /*
    // Default to close/collapse more
    set_more_default(always_expand = false){
      let more = this.shadowRoot.querySelector("#more");
      let more_collapsible = this.shadowRoot.querySelector("#more_collapsible");

      // In case we do not need to use more
      if (always_expand === true){
        more.classList.add("more-expanded");
        more.classList.remove("more-collapsed");
        more_collapsible.classList.remove("hidden");

        // Hide the more action
        more.classList.add("hidden");
      }else{
        // Default
        more.classList.remove("more-expanded");
        more.classList.add("more-collapsed");
        more_collapsible.classList.add("hidden");
      }
    }
    */
    _clicked_auto_query(is_checked){
      let old_auto_query = this.getAttribute("auto_query");
      this.setAttribute("auto_query", is_checked);
      this.dispatchEvent(
          new CustomEvent("column-auto-query-checked", {
              detail: {
                  row_settings: this,
                  new_auto_query: is_checked,
                  old_auto_query: old_auto_query
              }
          })
      );
      if (is_checked){
        if (this._sort_filter_query
              && !(Object.keys(this._sort_filter_query).length === 0 && this._sort_filter_query.constructor === Object)) {
          // Excute current sort filter query
          this.dispatchEvent(
              new CustomEvent("column-excute-quick-sort-filter", {
                  detail: {
                      row_settings: this,
                      sort_filter_query: this._sort_filter_query
                  }
              })
          );
        }
      }else{
        // Reset sort sort filter query object
        this._sort_filter_query = {};
      }
    }

    _show_auto_or_custom_filter(is_custom_filter){

      if (is_custom_filter && (is_custom_filter === true || is_custom_filter === "true")){
        is_custom_filter = true;
      }else{
        is_custom_filter = false;
      }
      var cfc_auto = this.shadowRoot.querySelectorAll(".cfc-auto");
      var cfc_custom = this.shadowRoot.querySelectorAll(".cfc-custom");

      // Custom filter
      if (is_custom_filter === true){

        for (let cfc_a of cfc_auto){
          cfc_a.classList.add("hidden");
        }
        for (let cfc_c of cfc_custom){
          cfc_c.classList.remove("hidden");
        }
        this._cfc_link.textContent = "Auto Filter";//"Auto Filter";
        this._cfc_link.setAttribute("is_custom_filter", true);

      }else{ // Auto Query
        for (let cfc_a of cfc_auto){
          cfc_a.classList.remove("hidden");
        }
        for (let cfc_c of cfc_custom){
          cfc_c.classList.add("hidden");
        }
        this._cfc_link.textContent = "Custom Filter";
        this._cfc_link.setAttribute("is_custom_filter", false);

        // Focus on filter search input
        let advanced_search_input = this.shadowRoot.querySelector("#advanced_search_input");
        if (advanced_search_input){
          advanced_search_input.focus();
        }
      }
    }

    _get_summary_of_group_filter_item(filter){

      if (!filter){
        return "";
      }

      if (!filter.ignore_list || filter.ignore_list.length === 0){
        return "";
      }

      let operator;

      // Simply understand that is for hidding feature
      if (filter.ignore_list.length === 1){
        operator = "=";// "!=";
      }else{
        operator = "in";// "not in";
      }

      let str = filter.ignore_list.join(", ");
      /*
      if (typeof filter.ignore_list[0] === "string"){
        str = operator + ' "' + str + '"';
      }else{
        str = operator + ' ' + str ;
      }
      */
      if (["float", "integer", "decimal", "boolean", "date", "datetime", "duration"].includes(filter.t) === true){
        if (filter.ignore_list.length > 1){
          str = operator + ' (' + str + ')';
        }else{
          str = operator + ' ' + str ;
        }
      }else{
        str = operator + ' "' + str + '"';
      }

      return str;
    }

    render_group_filter(group_filter){

      if (!group_filter || Object.keys(group_filter).length === 0){
        return;
      }

      var fragment = document.createDocumentFragment();

      let needs_separator = false;

      for (let base_key in group_filter){
        if (group_filter.hasOwnProperty(base_key)) {
          if (!Array.isArray(group_filter[base_key].filters)){
            continue;
          }

          let operator = group_filter[base_key].operator;

          for (let gf of group_filter[base_key].filters){

            if (!Array.isArray(gf)){
              continue;
            }

            let div_row = document.createElement("div");
            div_row.setAttribute("class", "row row-group-filter flex");

            for (let gf_index = 0; gf_index < gf.length; gf_index++){

              let div_gf_filter = document.createElement("div");
              div_gf_filter.setAttribute("class", "gf-filter flex");

              let div_field = document.createElement("div");
              div_field.setAttribute("class", "gf-filter-field");
              div_field.textContent = gf[gf_index].n;
              div_gf_filter.appendChild(div_field);

              let div_summary = document.createElement("div");
              div_summary.setAttribute("class", "gf-filter-summary");
              div_summary.textContent = this._get_summary_of_group_filter_item(gf[gf_index]);
              div_gf_filter.appendChild(div_summary);

              div_row.appendChild(div_gf_filter);

              if (gf.length === 1 || gf_index === gf.length -1){
                // No need to add "AND" or "OR"
              }else{
                let div_gf_operator = document.createElement("div");
                div_gf_operator.setAttribute("class", "gf-operator flex");
                div_gf_operator.textContent = operator;

                div_row.appendChild(div_gf_operator);

              }
            }

            if (needs_separator === true){

              // Create OR as a separator line
              let div_row_separator = document.createElement("div");
              div_row_separator.setAttribute("class", "row row-group-filter flex");

              let div_gf_separator = document.createElement("div");
              div_gf_separator.setAttribute("class", "gf-separator-operator");
              div_gf_separator.textContent = "OR";

              div_row_separator.appendChild(div_gf_separator);
              fragment.appendChild(div_row_separator);

              let div_flex_break = document.createElement("div");
              div_flex_break.setAttribute("class", "flex-break");
              fragment.appendChild(div_flex_break);
            }

            fragment.appendChild(div_row);

            // Add flex-break to make sure a new row/line for next item
            let div_flex_break2 = document.createElement("div");
            div_flex_break2.setAttribute("class", "flex-break");
            fragment.appendChild(div_flex_break2);

            needs_separator = true;
          }

        }
      }

      let group_filter_data = this.shadowRoot.querySelector("#group_filter_data");
      group_filter_data.innerHTML = "";
      group_filter_data.appendChild(fragment);

      // Add event for the clear group filter
      let btn_clear_group_filter = this.shadowRoot.querySelector("#btn_clear_group_filter");

      btn_clear_group_filter.addEventListener("click", () => {
          let curr_filter = this.getAttribute("filter");

          // Clear group filter
          let new_filter = '{"group_filter":{}}';
          let name = this.getAttribute("name");
          this.dispatchEvent(new CustomEvent("filter-selected", {detail: {
              row_settings: this,
              name: name,
              new_filter: new_filter,
              old_filter: curr_filter
          }}));

          // Clear group filter that show in popup
          group_filter_data.innerHTML = "";
      });

    }

    _register_ids() {
        this._agg_dropdown = this.shadowRoot.querySelector("#column_aggregate");
        this._show_type_dropdown = this.shadowRoot.querySelector("#column_show_type");
        this._data_format_dropdown = this.shadowRoot.querySelector("#column_data_format");
        this._binning_dropdown = this.shadowRoot.querySelector("#binning");
        this._binning_max = this.shadowRoot.querySelector("#binning_max");
        this._binning_min = this.shadowRoot.querySelector("#binning_min");
        this._binning_size = this.shadowRoot.querySelector("#binning_size");
        this._binning_size_container = this.shadowRoot.querySelector("#binning_size_container");
        this._binning_holder = this.shadowRoot.querySelector("#binning_holder");
        this._rename_field = this.shadowRoot.querySelector("#rename_field");
        this._rename_exclamation = this.shadowRoot.querySelector("#rename_exclamation");
        this._rename_submit = this.shadowRoot.querySelector("#rename_submit");
        this._sort_order = this.shadowRoot.querySelector("#sort_order");
        this._agg_level = this.shadowRoot.querySelector("#aggregate_level");
        this._sort_by = this.shadowRoot.querySelector("#sort_by");
        this._sort_order_by = this.shadowRoot.querySelector("#sort_order_by");
        this._sort_subtotal_group = this.shadowRoot.querySelector("#sort_subtotal_group");
        this._sort_subtotal = this.shadowRoot.querySelector("#sort_subtotal");
        this._input_limit = this.shadowRoot.querySelector("#input_limit");
        //this._limit_select = this.shadowRoot.querySelector("#limit_select");
        this._limit_type_select = this.shadowRoot.querySelector("#limit_type_select");
        this._period_select = this.shadowRoot.querySelector("#column_period");
        this._pre_value_checkbox = this.shadowRoot.querySelector("#pre_value_checkbox");
        //this._subtotals_checkbox = this.shadowRoot.querySelector("#subtotals_checkbox");
        this._column_subtotals = this.shadowRoot.querySelector("#column_subtotals");

        this._adv_sort_asc = this.shadowRoot.querySelector("#adv_sort_asc");
        this._adv_sort_desc = this.shadowRoot.querySelector("#adv_sort_desc");
        this._adv_sort_asc_clear = this.shadowRoot.querySelector("#adv_sort_asc_clear");
        this._adv_sort_desc_clear = this.shadowRoot.querySelector("#adv_sort_desc_clear");
        this._adv_sort_dropdown = this.shadowRoot.querySelector("#adv_sort_dropdown");

        this._adv_nb_filter_operator = this.shadowRoot.querySelector("#adv_nb_filter_operator");
        this._adv_nb_filter_operand_container = this.shadowRoot.querySelector("#adv_nb_filter_operand_container");
        this._adv_nb_filter_operand = this.shadowRoot.querySelector("#adv_nb_filter_operand");
        this._adv_nb_filter_operand_date = this.shadowRoot.querySelector("#adv_nb_filter_operand_date");
        this._adv_nb_filter_second_operand_container = this.shadowRoot.querySelector("#adv_nb_filter_second_operand_container");
        this._adv_nb_filter_second_operand = this.shadowRoot.querySelector("#adv_nb_filter_second_operand");
        this._adv_nb_filter_second_operand_date = this.shadowRoot.querySelector("#adv_nb_filter_second_operand_date");
        this._adv_nb_filter_top_n_type_container = this.shadowRoot.querySelector("#adv_nb_filter_top_n_type_container");
        this._adv_nb_filter_top_n_type = this.shadowRoot.querySelector("#adv_nb_filter_top_n_type");
        this._adv_filter_dropdown = this.shadowRoot.querySelector("#adv_filter_dropdown");
        this._suggestion_list = this.shadowRoot.querySelector("#suggestion_list");
        this._advanced_search_input = this.shadowRoot.querySelector("#advanced_search_input");
        this._adv_clear_filter = this.shadowRoot.querySelector("#adv_clear_filter");
        this._adv_nb_filter_period = this.shadowRoot.querySelector("#adv_nb_filter_period");
        this._adv_nb_filter_period_container = this.shadowRoot.querySelector("#adv_nb_filter_period_container");
        this._adv_filter_right = this.shadowRoot.querySelector("#adv_filter_right");
        this._adv_nb_filter_date_unit = this.shadowRoot.querySelector("#adv_nb_filter_date_unit");
        this._adv_nb_filter_date_unit_container = this.shadowRoot.querySelector("#adv_nb_filter_date_unit_container");

        this._adv_cb_auto_apply = this.shadowRoot.querySelector("#adv_cb_auto_apply");
        this._adv_cb_auto_apply_in_cfc_auto = this.shadowRoot.querySelector("#adv_cb_auto_apply_in_cfc_auto");
        this._adv_btn_cancel = this.shadowRoot.querySelector("#adv_btn_cancel");
        this._adv_btn_ok = this.shadowRoot.querySelector("#adv_btn_ok");

        this._search_fields = this.shadowRoot.querySelector("#search_fields");
        this._search_fields_input = this.shadowRoot.querySelector("#search_fields_input");

        // Only search within visible fields: ON/OFF
        this._search_within_visible_fields = this.shadowRoot.querySelector("#search_within_visible_fields");

        this._nb_of_selected_fields = this.shadowRoot.querySelector("#nb_of_selected_fields");
        this._cfc_link = this.shadowRoot.querySelector("#cfc_link");

        this._filter_component = this.shadowRoot.querySelector("#filter_component");
        //this._more = this.shadowRoot.querySelector("#more");
        //this._more_collapsible = this.shadowRoot.querySelector("#more_collapsible");

        this._adv_nb_filter_operand_date_calendar = this.shadowRoot.querySelector("#adv_nb_filter_operand_date_calendar");
        this._adv_nb_filter_second_operand_date_calendar = this.shadowRoot.querySelector("#adv_nb_filter_second_operand_date_calendar");

    }

    _register_callbacks() {
        var _this = this;
        this._agg_dropdown.addEventListener("change", event => {
            var old_aggregate = this.getAttribute("aggregate");
            this.setAttribute("aggregate", this._agg_dropdown.value);
            event.detail = {
                row_settings: this,
                old_agg: old_aggregate,
                new_agg: this._agg_dropdown.value
            }
            this.dispatchEvent(new CustomEvent("aggregate-selected", {detail: event}));
        });
        this._period_select.addEventListener("change", event => {
            var old_period = this.getAttribute("period") || "none";
            this.setAttribute("period", this._period_select.value);
            event.detail = {
                row_settings: this,
                old_period: old_period,
                new_period: this._period_select.value
            }
            this.dispatchEvent(new CustomEvent("period-selected", {detail: event}));
        });

        this._pre_value_checkbox.addEventListener("click", event => {

            var old_period = this.getAttribute("period") || "none";
            var is_checked = this._pre_value_checkbox.checked;

            var new_period = is_checked ? "previous" : "none";
            this.setAttribute("period", new_period);

            this.dispatchEvent(new CustomEvent("period-selected", {detail: {
              row_settings: this,
              old_period: old_period,
              new_period: new_period,
              event: event
            }}));
        });

        /*this._subtotals_checkbox.addEventListener("click", event => {

            var old_subtotals = this.getAttribute("subtotals");

            var is_checked = this._subtotals_checkbox.checked;

            // In case the attribute subtotals is not found
            if (old_subtotals === null || old_subtotals === undefined) {
                old_subtotals = !is_checked;
            }

            this.setAttribute("subtotals", is_checked);

            this.dispatchEvent(new CustomEvent("subtotals-clicked", {detail: {
              row_settings: this,
              old_subtotals: old_subtotals,
              new_subtotals: is_checked,
              event: event
            }}));
        });*/
        this._column_subtotals.addEventListener("change", event => {
            var old_subtotals = this.getAttribute("subtotals");

            var new_subtotals = (this._column_subtotals.value == "Yes");

            // In case the attribute subtotals is not found
            if (old_subtotals === null || old_subtotals === undefined) {
                old_subtotals = !new_subtotals;
            }

            this.setAttribute("subtotals", new_subtotals);

            this.dispatchEvent(new CustomEvent("subtotals-clicked", {detail: {
              row_settings: this,
              old_subtotals: old_subtotals,
              new_subtotals: new_subtotals,
              event: event
            }}));
        });

        this._show_type_dropdown.addEventListener("change", event => {
            var old_show_type = this.getAttribute("show_type");
            this.setAttribute("show_type", this._show_type_dropdown.value);

            this._update_data_format_as_dropdown();
            event.detail = {
                new_base_name: this.getAttribute("new_base_name"),
                new_show_type: this._show_type_dropdown.value,
                old_show_type: old_show_type,
                row_settings: this
            };
            this.dispatchEvent(new CustomEvent("show-as-selected", {detail: event}));
        });
        this._data_format_dropdown.addEventListener("change", event => {
            var old_data_format = this.getAttribute("data_format");
            this.setAttribute("data_format", this._data_format_dropdown.value);
            event.detail = {
                row_settings: this,
                new_base_name: this.getAttribute("new_base_name"),
                new_data_format: this._data_format_dropdown.value,
                old_data_format: old_data_format
            };
            this.dispatchEvent(new CustomEvent("data-format-selected", {detail: event}));
        });
        const debounced_binning = _.debounce(event => this._update_binning(event), 50);
        this._binning_dropdown.addEventListener("change", event => {
            if (this._binning_dropdown.value === "ON") {
                this._binning_holder.classList.add("hidden");
                this._binning_size_container.classList.remove("inactive");
                this._binning_size_container.classList.remove("hidden");
                let default_binning = JSON.parse(this.getAttribute("default_binning"));
                if (default_binning) {
                  if ((!this._binning_max.value || this._binning_max.value === "") && "max" in default_binning) {
                    this._binning_max.value = default_binning.max;
                  }
                  if ((!this._binning_min.value || this._binning_min.value === "") && "min" in default_binning) {
                    this._binning_min.value = default_binning.min;
                  }
                  if ((!this._binning_size.value || this._binning_size.value === "") && "size" in default_binning) {
                    this._binning_size.value = default_binning.size;
                  }
                }
            } else {
                this._binning_size_container.classList.add("inactive");
            }
            debounced_binning(event);
        });
        this._binning_max.addEventListener("keyup", _ => {
            if (this._binning_dropdown.value === "ON") {
                debounced_binning({});
            }
        });
        this._binning_max.addEventListener("keypress", (event) => {
          var key = event.keyCode || event.which;
          key = String.fromCharCode(key);

          if (!this.is_number(key)){
              event.returnValue = false;
              if(event.preventDefault){
                event.preventDefault();
              }
              return false;
          }
          return true;
        });
        this._binning_min.addEventListener("keyup", _ => {
            if (this._binning_dropdown.value === "ON") {
                debounced_binning({});
            }
        });
        this._binning_min.addEventListener("keypress", (event) => {
          var key = event.keyCode || event.which;
          key = String.fromCharCode(key);

          if (!this.is_number(key)){
              event.returnValue = false;
              if(event.preventDefault){
                event.preventDefault();
              }
              return false;
          }
          return true;
        });
        this._binning_size.addEventListener("keyup", _ => {
            if (this._binning_dropdown.value === "ON") {
                debounced_binning({});
            }
        });
        this._binning_size.addEventListener("keypress", (event) => {
          var key = event.keyCode || event.which;
          key = String.fromCharCode(key);

          if (!this.is_number(key)){
              event.returnValue = false;
              if(event.preventDefault){
                event.preventDefault();
              }
              return false;
          }
          return true;
        });
        /*this._sort_order.addEventListener("click", event => {
            this.dispatchEvent(new CustomEvent("sort_order", {detail: event}));
        });*/
        this._sort_order.addEventListener("change", event => {
            var old_sort_order = this.getAttribute("sort_order") || "asc";
            this._update_sort_order(event, old_sort_order, this._sort_order.value);
        });

        this._adv_sort_asc.addEventListener("click", event => {
            let old_sort_order = this.getAttribute("sort_order");
            let old_sort_num = this.getAttribute("sort_num");
            let new_sort_order = "asc";
            if (old_sort_order === new_sort_order && old_sort_num && (old_sort_num === 1 || old_sort_num === "1")) {
                return;
            }
            this.setAttribute("sort_num", 1);
            this._update_sort_order({}, old_sort_order, new_sort_order, old_sort_num, 1);
        });

        this._adv_sort_asc.addEventListener("mouseover", event => {
          let curr_sort_content = this.shadowRoot.querySelector("#adv_sort_content").parentElement;
          let sort_content_desc = this.shadowRoot.querySelector("#adv_sort_content_asc");

          if (sort_content_desc.children.length === 0){
            for (let child of Array.prototype.slice.call(curr_sort_content.children)) {
                sort_content_desc.appendChild(child);
            }
          }
        });

        this._adv_sort_asc.addEventListener("mouseout", event => {
          const s_order = this.getAttribute("sort_order");
          let curr_sort_content = this.shadowRoot.querySelector("#adv_sort_content").parentElement;

          let new_sort_content;
          if (s_order === "asc"){
            new_sort_content = this.shadowRoot.querySelector("#adv_sort_content_asc");
          }else if(s_order === "desc"){
            new_sort_content = this.shadowRoot.querySelector("#adv_sort_content_desc");
          }else{
            new_sort_content = this.shadowRoot.querySelector("#adv_sort_content_default");
          }

          let e = event.toElement || event.relatedTarget;
          let insides_element = false;
          let src = e;
          for (var i=0; i<=5; i++){
            if (!src || !src.parentElement){
              break;
            }
            src = src.parentElement;
            if (src === this._adv_sort_asc){
              insides_element = true;
              break;
            }
          }

          if (!insides_element){
            for (let child of Array.prototype.slice.call(curr_sort_content.children)) {
                new_sort_content.appendChild(child);
            }
          }

        });

        if (this._adv_sort_asc_clear) {
            this._adv_sort_asc_clear.addEventListener("click", (event) => {
                let old_sort_order = this.getAttribute("sort_order");
                let old_sort_num = this.getAttribute("sort_num");
                let new_sort_order = undefined;
                event.preventDefault();
                event.stopPropagation();
                if (old_sort_order === new_sort_order) {
                    return;
                }
                this.setAttribute("sort_num", undefined);
                this._update_sort_order({}, old_sort_order, new_sort_order, old_sort_num, undefined);

            });
        }

        this._adv_sort_desc.addEventListener("click", event => {
            var old_sort_order = this.getAttribute("sort_order");
            let old_sort_num = this.getAttribute("sort_num");
            let new_sort_order = "desc";
            if (old_sort_order === new_sort_order && old_sort_num && (old_sort_num === "1" || old_sort_num === 1)) {
                return;
            }
            this.setAttribute("sort_num", 1);
            this._update_sort_order({}, old_sort_order, new_sort_order, old_sort_num, 1);
        });

        this._adv_sort_desc.addEventListener("mouseover", event => {
          let curr_sort_content = this.shadowRoot.querySelector("#adv_sort_content").parentElement;
          let sort_content_desc = this.shadowRoot.querySelector("#adv_sort_content_desc");

          if (sort_content_desc.children.length === 0){
            for (let child of Array.prototype.slice.call(curr_sort_content.children)) {
                sort_content_desc.appendChild(child);
            }
          }
        });

        this._adv_sort_desc.addEventListener("mouseout", event => {
          const s_order = this.getAttribute("sort_order");
          let curr_sort_content = this.shadowRoot.querySelector("#adv_sort_content").parentElement;

          let new_sort_content;
          if (s_order === "asc"){
            new_sort_content = this.shadowRoot.querySelector("#adv_sort_content_asc");
          }else if(s_order === "desc"){
            new_sort_content = this.shadowRoot.querySelector("#adv_sort_content_desc");
          }else{
            new_sort_content = this.shadowRoot.querySelector("#adv_sort_content_default");
          }

          let e = event.toElement || event.relatedTarget;
          let insides_element = false;
          let src = e;
          for (var i=0; i<=5; i++){
            if (!src || !src.parentElement){
              break;
            }
            src = src.parentElement;
            if (src === this._adv_sort_desc){
              insides_element = true;
              break;
            }
          }

          if (!insides_element){
            for (let child of Array.prototype.slice.call(curr_sort_content.children)) {
                new_sort_content.appendChild(child);
            }
          }

        });

        if (this._adv_sort_desc_clear) {
            this._adv_sort_desc_clear.addEventListener("click", (event) => {
                let old_sort_order = this.getAttribute("sort_order");
                let old_sort_num = this.getAttribute("sort_num");
                let new_sort_order = undefined;
                event.preventDefault();
                event.stopPropagation();
                if (old_sort_order === new_sort_order) {
                    return;
                }
                this.setAttribute("sort_num", undefined);
                this._update_sort_order({}, old_sort_order, new_sort_order, old_sort_num, undefined);
            });
        }

        this._rename_field.addEventListener("keyup", event => {
            const new_name = this._rename_field.value;
            const old_name = this.getAttribute("dname");
            if (new_name === "") {
                this._rename_exclamation.hidden = true;
            }
            var key_code = event.which || event.keyCode;

            if (key_code === 13){
              if (old_name !== new_name) {
                this.dispatchEvent(new CustomEvent("column-change-name", {detail: {
                  new_name: this._rename_field.value,
                  event: event,
                  row_settings: this
                }}));
              }
              return true;
            }else{
              this.dispatchEvent(new CustomEvent("column-validate-name", {detail: {
                  new_name: new_name,
                  row_settings: this
              }}));
            }
        });
        this._rename_field.addEventListener("blur", event => {
            const new_name = this._rename_field.value;
            const old_name = this.getAttribute("dname");
            if (old_name !== new_name) {
              this.dispatchEvent(new CustomEvent("column-change-name", {detail: {
                new_name: this._rename_field.value,
                event: event,
                row_settings: this
              }}));
            }
        });
        this._rename_submit.addEventListener("click", event => {
            const new_name = this._rename_field.value;
            const old_name = this.getAttribute("dname");
            if (old_name !== new_name) {
              this.dispatchEvent(new CustomEvent("column-change-name", {detail: {
                  new_name: this._rename_field.value,
                  event: event,
                  row_settings: this
              }}));
            }
            return true;
        });

        const debounced_filter = _.debounce(event => this._update_filter(event), 50);
        this._adv_nb_filter_operator.addEventListener("change", () => {
            let operator = this._adv_nb_filter_operator.value;
            this._adv_nb_filter_operand.setAttribute("placeholder", "Value");
            let type = this.getAttribute("type");
            if (this._adv_filter_dropdown.value !== "" && this._adv_filter_dropdown.value !== "none") {
              let filter_by_sub = JSON.parse(decodeURIComponent(this._adv_filter_dropdown.value)) || {};
              const filter_by = filter_by_sub.by;
              if (filter_by && filter_by !== this.getAttribute("name")) {
                const filter_by_list = JSON.parse(this.getAttribute("filter_by_list")) || [];
                for (let by of filter_by_list) {
                    if (by.n === filter_by) {
                        type = by.t;
                        break;
                    }
                }
              }
            }
            let is_date_type = (type === "date" || type === "datetime");
            let operand = is_date_type ? this._adv_nb_filter_operand_date.value : this._adv_nb_filter_operand.value;
            let second_operand = is_date_type ? this._adv_nb_filter_second_operand_date.value : this._adv_nb_filter_second_operand.value;
            if (operator === "relative date"){
              this._adv_nb_filter_operand.setAttribute("placeholder", "#");
            }else if(operator === "before" || operator === "after" || operator === "between" || operator === "element between" || operator === "==" || operator == "!="){
              if (type === "date") {
                this._adv_nb_filter_operand_date.setAttribute("placeholder", "yyyy-mm-dd");
                this._adv_nb_filter_second_operand_date.setAttribute("placeholder", "yyyy-mm-dd");
              } else if (type === "datetime") {
                this._adv_nb_filter_operand_date.setAttribute("placeholder", "yyyy-mm-dd: H:i:s");
                this._adv_nb_filter_second_operand_date.setAttribute("placeholder", "yyyy-mm-dd: H:i:s");
              } else {
                this._adv_nb_filter_operand.setAttribute("placeholder", "Value");
                this._adv_nb_filter_second_operand.setAttribute("placeholder", "Value");
              }
            } else {
              this._adv_nb_filter_operand.setAttribute("placeholder", "Value");
              this._adv_nb_filter_second_operand.setAttribute("placeholder", "Value");
            }
            if (operator && !perspective.INVALID_FILTER_OPERATORS.includes(operator)
                && !perspective.ONE_SIDE_OPERATOR.includes(operator)) {
                if (operator === "relative date") {
                    this._adv_nb_filter_operand.value = "";
                    this._adv_nb_filter_operand_date.value = "";
                    this._adv_nb_filter_second_operand.value = "";
                    this._adv_nb_filter_second_operand_date.value = "";
                    this._adv_nb_filter_second_operand_container.classList.add("hidden");
                    this._adv_nb_filter_top_n_type_container.classList.add("hidden");

                    // Remove class hidden for normal operand
                    this._update_filter_operand();

                    this._adv_nb_filter_period_container.classList.remove("hidden");
                    this._adv_filter_right.classList.add("contains-4items");
                    let period = this._adv_nb_filter_period.value;
                    if (perspective.RELATIVE_DATE_PERIOD_THIS.includes(period)) {
                        //this._adv_nb_filter_operand.type = "hidden";
                        this._adv_nb_filter_operand_container.classList.add("hidden");
                        this._adv_nb_filter_date_unit_container.classList.add("hidden");
                        this._adv_nb_filter_date_unit_container.classList.add("hidden");
                    } else {
                        //this._adv_nb_filter_operand.type = "number";
                        this._adv_nb_filter_operand_container.classList.remove("hidden");
                        this._adv_nb_filter_operand.focus();
                        this._adv_nb_filter_date_unit_container.classList.remove("hidden");
                        this._adv_nb_filter_date_unit_container.classList.remove("hidden");
                        return;
                    }
                    //this._adv_nb_filter_second_operand_container.classList.add("hidden");
                    //this._adv_nb_filter_top_n_type_container.classList.add("hidden");
                } else {
                    //this._adv_nb_filter_operand.type = "text";
                    this._adv_nb_filter_operand_container.classList.remove("hidden");
                    if (operator === "between" || operator === "element between") {
                        this._adv_nb_filter_second_operand_container.classList.remove("hidden");
                    } else {
                        this._adv_nb_filter_second_operand_container.classList.add("hidden");
                    }
                    if (operator === "top n") {
                        this._adv_nb_filter_top_n_type_container.classList.remove("hidden");
                    } else {
                        this._adv_nb_filter_top_n_type_container.classList.add("hidden");
                    }
                    if (is_date_type && operator !== "top n" && operator !== "in" && operator !== "not in") {
                      this._update_filter_operand("date");
                    } else {
                      this._adv_nb_filter_operand.focus();
                      this._update_filter_operand();
                    }
                    this._adv_nb_filter_period_container.classList.add("hidden");
                    this._adv_filter_right.classList.remove("contains-4items");
                    this._adv_nb_filter_date_unit_container.classList.add("hidden");
                    if (!operand || operand === "" || ((operator === "between" || operator === "element between") && (!second_operand || second_operand === ""))) {
                        return;
                    }
                }
            } else if (perspective.INVALID_FILTER_OPERATORS.includes(operator)) {
                this._adv_nb_filter_period_container.classList.add("hidden");
                this._adv_filter_right.classList.remove("contains-4items");
                this._adv_nb_filter_date_unit_container.classList.add("hidden");
                this._adv_nb_filter_top_n_type_container.classList.add("hidden");
                //this._adv_nb_filter_operand.type = "hidden";
                this._adv_nb_filter_operand_container.classList.add("hidden");
                this._adv_nb_filter_second_operand_container.classList.add("hidden");
                this._adv_nb_filter_operand.value = "";
                this._adv_nb_filter_operand_date.value = "";
                this._adv_nb_filter_second_operand_date.value = "";
                return;
            } else if (perspective.ONE_SIDE_OPERATOR.includes(operator)) {
                this._adv_nb_filter_operand_container.classList.add("hidden");
                this._adv_nb_filter_second_operand_container.classList.add("hidden");
                this._adv_nb_filter_period_container.classList.add("hidden");
                this._adv_filter_right.classList.remove("contains-4items");
                this._adv_nb_filter_date_unit_container.classList.add("hidden");
                this._adv_nb_filter_top_n_type_container.classList.add("hidden");
            }
            debounced_filter({
                detail: this._adv_nb_filter_operand.value
            });
        });
        this._adv_filter_dropdown.addEventListener("change", () => {
            if (this._adv_filter_dropdown.value === "none") {
              this._update_adv_filter_visibility(false);
            } else {
              this._update_adv_filter_visibility(true);
              let new_value = JSON.parse(decodeURIComponent(this._adv_filter_dropdown.value));
              const new_filter_by = new_value.by;
              this.update_filter_operator_dropdown(new_filter_by, undefined);
            }
            this._adv_nb_filter_operand_container.classList.add("hidden");
            this._adv_nb_filter_second_operand_container.classList.add("hidden");
            this._adv_nb_filter_top_n_type_container.classList.add("hidden");
            this._adv_nb_filter_operand.value = "";
            this._adv_nb_filter_operand_date.value = "";
            this._adv_nb_filter_second_operand.value = "";
            this._adv_nb_filter_second_operand_date.value = "";
            return;
        });
        this._adv_clear_filter.addEventListener("click", () => {
            this._advanced_search_input.value = "";
            this._adv_nb_filter_operand.value = "";
            this._adv_nb_filter_operand_date.value = "";
            this._adv_nb_filter_second_operand.value = "";
            this._adv_nb_filter_second_operand_date.value = "";
            this.update_filter_operator_dropdown(undefined, "none");
            //let filter_by_sub = encodeURIComponent(JSON.stringify({by:this.getAttribute("name")}));
            this._adv_filter_dropdown.value = "none";
            this.filter_data_list(true);
        });
        this._adv_nb_filter_period.addEventListener("change", () => {
            this._adv_nb_filter_second_operand_container.classList.add("hidden");
            this._adv_nb_filter_top_n_type_container.classList.add("hidden");
            if (perspective.RELATIVE_DATE_PERIOD_THIS.includes(this._adv_nb_filter_period.value)) {
                this._adv_nb_filter_date_unit_container.classList.add("hidden");
                //this._adv_nb_filter_operand.type = "hidden";
                this._adv_nb_filter_operand_container.classList.add("hidden");
                this._adv_nb_filter_date_unit_container.classList.add("hidden");
            } else {
                this._adv_nb_filter_date_unit_container.classList.remove("hidden");
                //this._adv_nb_filter_operand.type = "number";
                this._adv_nb_filter_operand_container.classList.remove("hidden");
                this._adv_nb_filter_date_unit_container.classList.remove("hidden");
                this._adv_nb_filter_operand.focus();
                if (!this._adv_nb_filter_operand.value || this._adv_nb_filter_operand.value === "") {
                    return;
                }
            }
            debounced_filter({
                detail: this._adv_nb_filter_period.value
            });

        });

        this._adv_nb_filter_operand.addEventListener("keypress", (event)=>{

          if (this._adv_nb_filter_period_container.classList.contains("hidden")
            && this._adv_nb_filter_top_n_type_container.classList.contains("hidden")){
            return true;
          }

          var key = event.keyCode || event.which;
          key = String.fromCharCode(key);

          //var is_digit = /^\d+$/.test(key);
          if (!this.is_digit(key)){
              event.returnValue = false;
              if(event.preventDefault){
                event.preventDefault();
              }
              return false;
          }
          return true;
        });

        this._adv_nb_filter_date_unit.addEventListener("change", () => {
            if (this._adv_nb_filter_period.value !== "this") {
                this._adv_nb_filter_operand.focus();
                if (!this._adv_nb_filter_operand.value || this._adv_nb_filter_operand.value === "") {
                    return;
                }
            }
            debounced_filter({
                detail: this._adv_nb_filter_date_unit.value
            });

        });

        this._adv_nb_filter_top_n_type.addEventListener("change", (event) => {
            if (!this._adv_nb_filter_operand.value || this._adv_nb_filter_operand.value === "") {
                return;
            }
            debounced_filter({
                detail: this._adv_nb_filter_top_n_type.value
            });
        });

        /*
        this._advanced_search_input.addEventListener("keyup", () => {
            this.dispatchEvent(new CustomEvent("change-suggestion-filter-search", {detail: {
                row_settings: this,
                search_text: this._advanced_search_input.value
            }}))
        });
        */
        this._advanced_search_input.addEventListener("input", _.debounce(_ => this.filter_data_list.call(this, false), 400));
        this._agg_level.addEventListener("change", () => {
            var old_agg_level = this.getAttribute("agg_level");
            this.setAttribute("agg_level", this._agg_level.value);
            this.dispatchEvent(
                new CustomEvent("aggregate-level-selected", {
                    detail: {
                        row_settings: this,
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
                        row_settings: this,
                        name: this.getAttribute("name")
                    }
                })
            );
        });
        this._sort_order_by.addEventListener("change", () => {
            let old_sort_order = this.getAttribute("sort_order");
            let old_sort_by = this.getAttribute("sort_by");
            let order_by = JSON.parse(decodeURIComponent(this._sort_order_by.value));
            let new_sort_order = order_by.order;
            let new_sort_by = order_by.by;
            this.setAttribute("sort_order", new_sort_order);
            this.setAttribute("sort_by", new_sort_by);
            this.dispatchEvent(
                new CustomEvent("sort-order-by-selected", {
                    detail: {
                        new_sort_by: new_sort_by,
                        old_sort_by: old_sort_by,
                        new_sort_order: new_sort_order,
                        old_sort_order: old_sort_order,
                        row_settings: this,
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
                        row_settings: this,
                        name: this.getAttribute("name")
                    }
                })
            );
        });

        this._adv_sort_dropdown.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        this._adv_sort_dropdown.addEventListener("change", () => {
            let name = this.getAttribute("name");
            let subtotal_list = JSON.parse(this.getAttribute("subtotal_list")) || [];
            let old_subtotal = this.getAttribute("subtotal");
            let old_sort_by = this.getAttribute("sort_by") || name;
            let old_value;
            if (old_sort_by !== name && old_subtotal && old_subtotal !== "null" && old_subtotal !== "undefined") {
                old_value = encodeURIComponent(JSON.stringify({by:old_sort_by, sub: old_subtotal}));
            } else {
                old_value = encodeURIComponent(JSON.stringify({by:old_sort_by}));
            }
            if (old_value === this._adv_sort_dropdown.value) {
                return;
            }
            let new_value = JSON.parse(decodeURIComponent(this._adv_sort_dropdown.value));

            // In case the sort order is changed
            let curr_sort_content = this.shadowRoot.querySelector("#adv_sort_content").parentElement;
            const old_sort_order = this.getAttribute("sort_order");
            const old_sort_num = this.getAttribute("sort_num");
            const new_sort_num = 1;
            let new_sort_order;

            if (old_sort_order === "asc"){
              if (curr_sort_content.getAttribute("id") === "adv_sort_content_desc"){
                new_sort_order = "desc";
              }
            }else if(old_sort_order === "desc"){
              if (curr_sort_content.getAttribute("id") === "adv_sort_content_asc"){
                new_sort_order = "asc";
              }
            }

            this.setAttribute("sort_by", new_value.by);
            this.setAttribute("subtotal", new_value.sub);
            if (new_sort_order) {
                this.setAttribute("sort_order", new_sort_order);
                this.setAttribute("sort_num", new_sort_num);
            }

            if (this._is_auto_query()) {
                let options = {
                    new_sort_by: new_value.by,
                    old_sort_by: old_sort_by,
                    row_settings: this,
                    name: this.getAttribute("name")
                };
                if (subtotal_list.length > 0 && new_value.by !== name) {
                    options["new_subtotal"] = new_value.sub || subtotal_list[0];
                    options["old_subtotal"] = old_subtotal;
                }

                if (new_sort_order){
                  options["old_sort_order"] = old_sort_order;
                  options["new_sort_order"] = new_sort_order;
                  options["new_sort_num"] = new_sort_num;
                  options["old_sort_num"] = old_sort_num;
                }

                this.dispatchEvent(
                    new CustomEvent("sort-dropdown-selected", {
                        detail: options
                    })
                );
            } else {
                let options = {
                    subtotal: {
                        new_value: new_value.sub,
                        old_value: old_subtotal
                    },
                    sort_by: {
                        new_value: new_value.by,
                        old_value: old_sort_by
                    }
                };
                if (new_sort_order) {
                    options["sort_order"] = {
                        new_value: new_sort_order,
                        old_value: old_sort_order
                    };
                    options["sort_num"] = {
                        new_value: new_sort_num,
                        old_value: old_sort_num
                    };
                }
                this._update_sort_filter_query(options);
            }
        });

        this._input_limit.addEventListener("keypress", event => {

          var key = event.keyCode || event.which;
          key = String.fromCharCode(key);

          //var is_digit = /^\d+$/.test(key);
          if (!this.is_digit(key)){
              event.returnValue = false;
              if(event.preventDefault){
                event.preventDefault();
              }
              return false;
          }
          return true;
        });

        this._input_limit.addEventListener("keyup", event => {
            var max = this._limit_type_select.value === "Percent" ? 100: 2000;

            var old_limit = this.getAttribute("limit");
            if (old_limit && old_limit !== "none"){
              old_limit = parseInt(old_limit);
            }else{
              old_limit = "none";
            }

            var value = parseInt(this._input_limit.value);
            if (!value || value < 1){
              value = "none";
            }else if(value > max){
              value = max;
            }

            var key_code = event.which || event.keyCode;

            if (key_code === 13){
              if (value === "none"){
                this._input_limit.value = "";
              }

              if (value !== old_limit){
                this.setAttribute("limit", value);
                this.dispatchEvent(
                    new CustomEvent("limit-group-selected", {
                        detail: {
                            new_limit: value,
                            old_limit: old_limit,
                            name: this.getAttribute("name"),
                            row_settings: this
                        }
                    })
                );
              }
            }
        });

        this._input_limit.addEventListener("blur", event => {
          var max = this._limit_type_select.value === "Percent" ? 100: 2000;
          var old_limit = this.getAttribute("limit");
          if (old_limit && old_limit !== "none"){
            old_limit = parseInt(old_limit);
          }else{
            old_limit = "none";
          }

          var value = parseInt(this._input_limit.value);
          if (!value || value < 1){
            value = "none";
          }else if(value > max){
            value = max;
          }

          if (value === "none"){
            this._input_limit.value = "";
          }
          if (value !== old_limit){
            this.setAttribute("limit", value);
            this.dispatchEvent(
                new CustomEvent("limit-group-selected", {
                    detail: {
                        new_limit: value,
                        old_limit: old_limit,
                        name: this.getAttribute("name"),
                        row_settings: this
                    }
                })
            );
          }
        });
        /*
        this._limit_select.addEventListener("change", () => {
            var old_limit = this.getAttribute("limit") || "none";
            this.setAttribute("limit", this._limit_select.value);
            this.dispatchEvent(
                new CustomEvent("limit-group-selected", {
                    detail: {
                        new_limit: this._limit_select.value,
                        old_limit: old_limit,
                        name: this.getAttribute("name"),
                        row_settings: this
                    }
                })
            );
        });
        */
        this._limit_type_select.addEventListener("change", () => {
            var old_limit_type = this.getAttribute("limit_type") || "Items";
            this.setAttribute("limit", "none");
            this.setAttribute("limit_type", this._limit_type_select.value);
            this.dispatchEvent(
                new CustomEvent("limit-type-selected", {
                    detail: {
                        row_settings: this,
                        new_limit_type: this._limit_type_select.value,
                        old_limit_type: old_limit_type,
                        name: this.getAttribute("name")
                    }
                })
            );
        });


        this._adv_btn_cancel.addEventListener("click", () => {
            // Hit Cancel button
            //this._reset_sort_filter_query();
            this.dispatchEvent(
                new CustomEvent("column-popup-close", {
                    detail: {
                        row_settings: this
                    }
                })
            );
        });

        this._adv_btn_ok.addEventListener("click", () => {
            // Hit Ok button
            if (this._adv_btn_ok.classList.contains("inactive")){
              // Pass. Not allow to click this button
            }else if (this._sort_filter_query
                && !(Object.keys(this._sort_filter_query).length === 0 && this._sort_filter_query.constructor === Object)) {
                // Excute current sort filter query
                this.dispatchEvent(
                    new CustomEvent("column-excute-quick-sort-filter", {
                        detail: {
                            row_settings: this,
                            sort_filter_query: this._sort_filter_query,
                            close_after_excute: true
                        }
                    })
                );
                this._sort_filter_query = {};
            } else {
                this.dispatchEvent(
                    new CustomEvent("column-popup-close", {
                        detail: {
                            row_settings: this
                        }
                    })
                );
            }
        });

        this._adv_cb_auto_apply.addEventListener("click", event => {

            var is_checked = this._adv_cb_auto_apply.checked;
            this._adv_cb_auto_apply_in_cfc_auto.checked = is_checked;
            this._clicked_auto_query(is_checked);
            /*
            let old_auto_query = this.getAttribute("auto_query");
            this.setAttribute("auto_query", is_checked);
            this.dispatchEvent(
                new CustomEvent("column-auto-query-checked", {
                    detail: {
                        row_settings: this,
                        new_auto_query: is_checked,
                        old_auto_query: old_auto_query
                    }
                })
            );
            if (is_checked){
              if (this._sort_filter_query
                    && !(Object.keys(this._sort_filter_query).length === 0 && this._sort_filter_query.constructor === Object)) {
                // Excute current sort filter query
                this.dispatchEvent(
                    new CustomEvent("column-excute-quick-sort-filter", {
                        detail: {
                            row_settings: this,
                            sort_filter_query: this._sort_filter_query
                        }
                    })
                );
              }
            }else{
              // Reset sort sort filter query object
              this._sort_filter_query = {};
            }
            */
        });

        this._adv_cb_auto_apply_in_cfc_auto.addEventListener("click", event => {

            var is_checked = this._adv_cb_auto_apply_in_cfc_auto.checked;
            this._adv_cb_auto_apply.checked = is_checked;
            this._clicked_auto_query(is_checked);
        });

        this._search_fields_input.addEventListener("input", _.debounce(_ => this._filter_fields_datalist.call(this, false), 400));

        this._search_within_visible_fields.addEventListener("click", event => {

            //const old_filter = JSON.parse(this.getAttribute("filter")) || {};
            //let old_site_search_af = old_filter ? old_filter.site_search_af : false;
            let old_site_search_af = this.getAttribute("site_search_af") || false;

            if (old_site_search_af === undefined || old_site_search_af === null){
              old_site_search_af = false;
            }

            //let new_filter = Object.assign({}, old_filter);
            const site_search_af = this._search_within_visible_fields.checked;
            //new_filter.site_search_af = site_search_af;

            // the c_info will be based on the search within visible fields is on or off
            if (site_search_af === true){
              this.c_info = this.original_c_info.filter((v)=>v.active === site_search_af);
            }else{
              this.c_info = Object.assign([], this.original_c_info);
            }

            //this.setAttribute("filter", JSON.stringify(new_filter));

            this.setAttribute("site_search_af", site_search_af);

            this._update_fields_datalist();

            if (site_search_af === true){ // Search within visible fields
              this._updates_search(this.c_info.map((v)=>v.name), undefined, old_site_search_af);
            }else{ // Search in all fields
              this._updates_search([], undefined, old_site_search_af);
            }

        });

        this._cfc_link.addEventListener("click", () => {
            /*
            var cfc_auto = this.shadowRoot.querySelectorAll(".cfc-auto");
            var cfc_custom = this.shadowRoot.querySelectorAll(".cfc-custom");

            if (cfc_auto[0].classList.contains("hidden") === true){
              for (let cfc_a of cfc_auto){
                cfc_a.classList.remove("hidden");
              }
              for (let cfc_c of cfc_custom){
                cfc_c.classList.add("hidden");
              }
              this._cfc_link.textContent = "Custom Filter";
              this._cfc_link.setAttribute("is_custom_filter", false);
            }else{
              for (let cfc_a of cfc_auto){
                cfc_a.classList.add("hidden");
              }
              for (let cfc_c of cfc_custom){
                cfc_c.classList.remove("hidden");
              }
              this._cfc_link.textContent = "Auto Filter";//"Auto Filter";
              this._cfc_link.setAttribute("is_custom_filter", true);
            }
            */
            let will_be_custom_filter = this._cfc_link.getAttribute("is_custom_filter");
            if (will_be_custom_filter && (will_be_custom_filter === true || will_be_custom_filter === "true")){
              will_be_custom_filter = false;
            }else{
              will_be_custom_filter = true;
            }

            this._show_auto_or_custom_filter(will_be_custom_filter);
        });
        /*
        this._more.addEventListener("click", () => {

            if (this._more.classList.contains("more-expanded")){
              this._more.classList.remove("more-expanded");
              this._more.classList.add("more-collapsed");
              this._more_collapsible.classList.add("hidden");
            }else{
              this._more.classList.add("more-expanded");
              this._more.classList.remove("more-collapsed");
              this._more_collapsible.classList.remove("hidden");
            }
        });
        */
        let type = this.getAttribute("type");
        let fp_options = {
          header_top: 60,
          appendTo: this.shadowRoot,
          onChange: (_, dateStr) => {
            const operator = this._adv_nb_filter_operator.value;
            const operand = this._adv_nb_filter_operand_date.value;
            const second_operand = this._adv_nb_filter_second_operand_date.value
            if ((operator === "between" || operator === "element between") && (operand === "" || second_operand === ""
                || !operand || !second_operand)) {
                return;
            }
            debounced_filter({
              detail: dateStr
            });
          }
        };
        if (type === "datetime") {
          fp_options["enableTime"] = true;
          fp_options["enableSeconds"] = true;
        }

        this.first_fp = flatpickr.call(this, this._adv_nb_filter_operand_date, fp_options);  // flatpickr
        this.second_fp = flatpickr.call(this, this._adv_nb_filter_second_operand_date, fp_options);  // flatpickr

        this._adv_nb_filter_operand_date_calendar.addEventListener("click", ()=>{
          var v = this._adv_nb_filter_operand_date.value || "";
          if (v && v.trim() !== ""){
            this.first_fp.setDate(v.trim());
          }

          this.first_fp.open();
        });

        this._adv_nb_filter_operand_date.addEventListener("keyup", (event)=>{
          var key_code = event.which || event.keyCode;

          if (key_code === 13){
            const operator = this._adv_nb_filter_operator.value;
            const operand = this._adv_nb_filter_operand_date.value;
            const second_operand = this._adv_nb_filter_second_operand_date.value;

            if (operator === undefined || operator === null || operator === ""){
              return;
            }

            if (operator && ["before", "after", "==", "!="].includes(operator) === true){

              // Requires the value of operand
              if (operand === undefined || operand === null || operand === ""){
                return;
              }
            }

            // Between option requires two value
            if ((operator === "between" || operator === "element between") &&
              (operand === undefined || operand === null || operand === ""
                || second_operand === undefined || second_operand === null || second_operand === "")) {
              return;
            }
            debounced_filter({
              detail: operand
            });
          }
        });

        this._adv_nb_filter_operand_date.addEventListener("blur", ()=>{
          const operator = this._adv_nb_filter_operator.value;
          const operand = this._adv_nb_filter_operand_date.value;
          const second_operand = this._adv_nb_filter_second_operand_date.value

          if (operator === undefined || operator === null || operator === ""){
            return;
          }

          if (operator && ["before", "after", "==", "!="].includes(operator) === true){

            // Requires the value of operand
            if (operand === undefined || operand === null || operand === ""){
              return;
            }
          }

          // Between option requires two value
          if ((operator === "between" || operator === "element between") &&
            (operand === undefined || operand === null || operand === ""
              || second_operand === undefined || second_operand === null || second_operand === "")) {
            return;
          }
          debounced_filter({
            detail: operand
          });
        });

        this._adv_nb_filter_second_operand_date_calendar.addEventListener("click", ()=>{
          var v = this._adv_nb_filter_second_operand_date.value || "";
          if (v && v.trim() !== ""){
            this.second_fp.setDate(v.trim());
          }

          this.second_fp.open();
        });

        this._adv_nb_filter_second_operand_date.addEventListener("keyup", (event)=>{
          var key_code = event.which || event.keyCode;

          if (key_code === 13){
            const operator = this._adv_nb_filter_operator.value;
            const operand = this._adv_nb_filter_operand_date.value;
            const second_operand = this._adv_nb_filter_second_operand_date.value
            if ((operator === "between" || operator === "element between") && (operand === "" || second_operand === ""
                || !operand || !second_operand)) {
                return;
            }
            debounced_filter({
              detail: operand
            });
          }
        });

        this._adv_nb_filter_second_operand_date.addEventListener("blur", ()=>{
          const operator = this._adv_nb_filter_operator.value;
          const operand = this._adv_nb_filter_operand_date.value;
          const second_operand = this._adv_nb_filter_second_operand_date.value
          if ((operator === "between" || operator === "element between") && (operand === "" || second_operand === ""
              || !operand || !second_operand)) {
              return;
          }
          debounced_filter({
            detail: operand
          });
        });

    }

    connectedCallback() {
        this._register_ids();
        this._register_callbacks();
    }
}
