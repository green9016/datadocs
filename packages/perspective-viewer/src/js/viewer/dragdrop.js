/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import perspective from "@jpmorganchase/perspective";

function calc_index(event) {
    var ac = this._pivotList.getActiveCols(false);
    if (ac.length == 0) {
        return 0;
    } else {
        /*for (let cidx in this._active_columns.children) {
            let child = this._active_columns.children[cidx];
            if (child.offsetTop + child.offsetHeight > event.offsetY + this._active_columns.scrollTop) {
                return parseInt(cidx);
            }
        }
        return this._active_columns.children.length;*/

        var h = this._pivotList.getItemHeight();
        var predict_index = Math.floor((event.offsetY + this._pivotList.getScrollTop()) / h);
        var start_index = Math.max(0, predict_index - 2);
        var end_index = Math.min(ac.length, predict_index + 3);
        for (var cidx = start_index; cidx < end_index; cidx++) {
            let child = ac[cidx];
            if (child.offsetTop + child.offsetHeight > event.offsetY + this._pivotList.getScrollTop()) {
                return parseInt(cidx);
            }
        }

        return ac.length;
    }
}

function _can_undrag(event, target) {
    /*
    if (event.dataTransfer && typeof(event.dataTransfer.getData) === "function"){
      let data = event.dataTransfer.getData("text");
      if (data) {
          data = JSON.parse(data);
      }
      // Not allow to drop the Search item
      if (data && data.length > 0 && data[0] === perspective.__FILTER_SEARCH__){
        return false;
      }
    }
    */
    // Case target is sort
    if (target === "sort") {
        // Case 1: in pivot mode: can not undrag
        if (this.is_cinfo_pivot(false)) {
            return false;
        }
    }/*else if(target === "row-pivots" || target === "column-pivots" || target === "value-pivots" || target === "filters"){
      return false;
    }*/

    return true;
}

function _can_drop(event) {
    const drop_targets = ["available_fields_columns", "column_pivots", "row_pivots", "sort", "filters", "psp-cc-computation-inputs", "value_pivots"];
    const can_drop = !this._drop_target_hover.classList.contains("computed-pivot");

    let data = event.dataTransfer.getData("text");
    if (data) {
        data = JSON.parse(data);
    }
    /*
    // Not allow to drop the Search item
    if (data && data.length > 0 && data[0] === perspective.__FILTER_SEARCH__){
      return false;
    }
    */

    let target = event.currentTarget.getAttribute('id');

    // Not allow to drop the search/group tag
    if (target && drop_targets.includes(target)) {
      if (this._drop_target_hover
        && (this._drop_target_hover.getAttribute("name") === perspective.__FILTER_SEARCH__
          || this._drop_target_hover.getAttribute("name") === perspective.GROUP_FILTER_NAME)){
        return false;
      }
    }

    // Case target is sort
    if (target === "sort") {

        // Case 1: in pivot mode: can not drop
        if (this.is_cinfo_pivot(false) && data) {
            /*data = JSON.parse(data);
            var pivot_columns = this._get_view_row_pivots().concat(this._get_view_column_pivots());
            if (pivot_columns.indexOf(data[0]) !== -1) {
                return true;
            } else {
                return false;
            }*/
            return false;
        }
    }
    // Case target is filter
    /*else if (target === "filters") {
        let data = event.dataTransfer.getData("text");
        // Case: in pivot mode: can not drop if column isn't in row-pivot or column-pivots
        if (this.is_cinfo_pivot(false) && data) {
            data = JSON.parse(data);
            var pivot_columns = this._get_view_row_pivots().concat(this._get_view_column_pivots());
            if (pivot_columns.indexOf(data[0]) !== -1) {
                return true;
            } else {
                return false;
            }
        }
    }*/
    // Case target is colum pivots
    else if (target === "column_pivots" || target === "row_pivots") {
        //let data = event.dataTransfer.getData("text");
        if (data) {
            //data = JSON.parse(data);
            var source_attr = data[6];
            if (source_attr !== "column_pivots" && source_attr !== "row_pivots") {
                var is_date = perspective.AGGREGATE_LEVEL_LIST.includes(data[3]);
                if (is_date) {
                    var agg_levels = perspective.TYPE_AGGREGATE_LEVELS[data[3]];
                    var existed_agg_levels = this._get_existed_agg_level(data[0]);
                    if (existed_agg_levels.length >= agg_levels.length) {
                        return false;
                    }
                }
            }
        }
        /*if (target === "column_pivots" && this.is_flat_pivot(false)) {
            return false;
        }*/
    }
    // Case target is values pivot
    else if (target === "value_pivots") {
        // Can drag and drop in case not pivots
        /*if (!this.is_cinfo_pivot(false)) {
            return false;
        }*/
    }

    // Can't drop "Values" item to some containers
    if (["available_fields_columns", "sort", "filters", "psp-cc-computation-inputs", "value_pivots"].includes(target)) {
        if (this._drop_target_hover) {
            if (this._drop_target_hover.getAttribute("name") === perspective.COMBINED_NAME) {
                return false;
            }
        }
    }

    return (drop_targets.indexOf(target) > -1 && can_drop);
}

export function undrag(event) {
    this.close_all();
    /*
    // Not allow to undrag the search item
    if (this._drop_target_hover && this._drop_target_hover.getAttribute("name") === perspective.__FILTER_SEARCH__){
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    */
    let prev_is_pivot = this.is_cinfo_pivot(false);
    let div = event.target.getRootNode().host;
    let parent = div;
    if (parent.tagName === "PERSPECTIVE-VIEWER") {
        parent = event.target.parentElement;
    } else {
        parent = div.parentElement;
    }
    let idx = Array.prototype.slice.call(parent.children).indexOf(div.tagName === "PERSPECTIVE-ROW" ? div : event.target);
    let attr_name = parent.getAttribute("for");
    if (!_can_undrag.call(this, event, attr_name)) return;

    if (event.dataTransfer.dropEffect === "move"){
      // Not allow to undrag if it's moving
      return;
    }

    let old_value = this.getAttribute(attr_name);
    let pivots = JSON.parse(this.getAttribute(attr_name));
    let name = pivots[idx];

    // FILTER search tag - just need to clear search, no need to update the attribute filters here
    if (attr_name === "filters" && name && name.n === perspective.__FILTER_SEARCH__){
      this._search_input_id.value = "";
      this._column_searchs_changed();
      return;
    }

    // Init old filter, active, value and sorts
    var old_filters;
    var old_sorts;
    var old_row_pivots = null;
    var old_column_pivots = null;
    var old_active_list = null;
    var old_value_pivots = null;
    let have_pivot_agg_level_on = false;

    if (event.dataTransfer.dropEffect !== "move"){
      if (attr_name === "row-pivots" || attr_name === "column-pivots") {
          let pivot = pivots[idx];
          if (pivot.agg_l && pivot.agg_l !== "OFF") {
              have_pivot_agg_level_on = true;
          }
      }
      pivots.splice(idx, 1);
    }

    var get_old_list = function(children_eles) {
        var old_list = [];
        for (var cidx = 0; cidx < children_eles.length; cidx++) {
            let row = children_eles[cidx];
            old_list.push([row.getAttribute("name"), row.getAttribute("type"), row.getAttribute("aggregate"),
                row.getAttribute("data_format"), row.getAttribute("computed")]);
        }
        return old_list;
    };

    if (attr_name === "row-pivots" || attr_name === "column-pivots") {
        old_filters = JSON.parse(this.getAttribute("filters"));
        old_sorts = JSON.parse(this.getAttribute("sort"));
        if (pivots.length === 0) {
            this.is_hidding_rows = true;
            //var column_pivots = (JSON.parse(this.getAttribute("column-pivots")) || []).filter(x => x != perspective.COMBINED_NAME);
            var column_pivots = (JSON.parse(this.getAttribute("column-pivots")) || []).filter((v) => v.n != perspective.COMBINED_NAME);
            //var row_pivots = (JSON.parse(this.getAttribute("row-pivots")) || []).filter(x => x != perspective.COMBINED_NAME);
            var row_pivots = (JSON.parse(this.getAttribute("row-pivots")) || []).filter((v) => v.n != perspective.COMBINED_NAME);
            if ((attr_name === "row-pivots" && column_pivots.length === 0)
                || (attr_name === "column-pivots" && row_pivots.length === 0)) {
                old_active_list = get_old_list.call(this, this._pivotList.getActiveCols(false));
                old_value_pivots = this.getAttribute("value-pivots");
                if (attr_name === "column-pivots") {
                    old_row_pivots = this.getAttribute("row-pivots");
                } else {
                    old_column_pivots = this.getAttribute("column-pivots");
                }
            }
        }
    } else if (attr_name === "value-pivots") {
        old_filters = JSON.parse(this.getAttribute("filters"));
        old_active_list = get_old_list.call(this, this._pivotList.getActiveCols(false));
    }

    this.setAttribute(attr_name, JSON.stringify(pivots));

    var new_value_pivots = null;
    // Remove all active column for case remove Values field
    var curr_is_pivot = this.is_cinfo_pivot(false);
    if (this.is_cinfo_pivot(false) && !this._has_combined_column()
        && (attr_name === "row-pivots" || attr_name === "column-pivots")
        && name.n === perspective.COMBINED_NAME) {
        old_value_pivots = this.getAttribute("value-pivots");
        old_active_list = get_old_list.call(this, this._pivotList.getActiveCols(false));
        new_value_pivots = "[]";
        this.setAttribute("value-pivots", new_value_pivots);
        curr_is_pivot = this.is_cinfo_pivot(false);
    } else if (!this.is_cinfo_pivot(false) && this._has_combined_column()) {
        this.setAttribute("row-pivots", JSON.stringify([]));
        this.setAttribute("column-pivots", JSON.stringify([]));
    }

    var new_active_list = null;
    var new_row_pivots = null;
    var new_column_pivots = null;
    //var pivots_length = JSON.parse(this.getAttribute("row-pivots")).filter(x => x !== perspective.COMBINED_NAME).length
    //        + JSON.parse(this.getAttribute("column-pivots")).filter(x => x !== perspective.COMBINED_NAME).length;
    var pivots_length = JSON.parse(this.getAttribute("row-pivots")).filter((v) => v.n !== perspective.COMBINED_NAME).length
            + JSON.parse(this.getAttribute("column-pivots")).filter((v) => v.n !== perspective.COMBINED_NAME).length
            + JSON.parse(this.getAttribute("value-pivots") || "[]").length;
    if ((attr_name === "row-pivots" || attr_name === "column-pivots" || attr_name === "value-pivots") && pivots_length == 0) {
        // Reset alias mapping
        //this.setAttribute("dname-mapping", JSON.stringify({}));

        // Clear column width from cache
        this._clear_column_width_cache_pivot();
        new_active_list = this.c_info.filter(f => f["active"]).map(m => m["name"]);

        //this._checkall_fields.checked = this.c_info.findIndex((v)=>v.name != "__rownum__" && v.name != "__count__" && !v.active) != -1 ? false: true;
        this._auto_mark_checkall_fields(this.c_info);

        //this._checkall_fields_checkmark.classList.remove("disable-opacity");
        this._update_checkall_fields_visibility(true);

        // add or remove combined column
        this._update_combined_column();

        this._update_column_view(new_active_list, true);
        if (attr_name === "column-pivots") {
            new_row_pivots = this.getAttribute("row-pivots");
        } else if(attr_name === "row-pivots") {
            new_column_pivots = this.getAttribute("column-pivots");
        }
    } else {
        if (attr_name === "value-pivots") {
            this._update_combined_column();
        }
        this._update_column_view();
    }

    // Change from pivot mode to flat mode: remove all sort, filter (excep the search item) and value pivots
    if (prev_is_pivot && !curr_is_pivot) {
        this.setAttribute("sort", JSON.stringify([]));

        /*let curr_filters = JSON.parse(this.getAttribute("filters") || "[]");
        const search_item_index = curr_filters.findIndex((f)=>f.n === perspective.__FILTER_SEARCH__);
        if (search_item_index !== -1){
          this.setAttribute("filters", JSON.stringify([curr_filters[search_item_index]]));
        }else{
          this.setAttribute("filters", JSON.stringify([]));
        }*/
        //this.setAttribute("value-pivots", JSON.stringify([]));
    } else if (curr_is_pivot && (attr_name === "row-pivots" || attr_name === "column-pivots")) {
        // Update sort, filter for removed tag from row pivots and column pivots
        let sorts = JSON.parse(this.getAttribute("sort") || "[]");
        let new_sorts = [];
        sorts.forEach(s => {
            if (s[0] !== name.n) {
                new_sorts.push(s);
            }
        });
        this.setAttribute("sort", JSON.stringify(new_sorts));
        let filters = JSON.parse(this.getAttribute("filters") || "[]");
        let new_filters = [];
        new_filters = filters.filter(f => f.n !== name.n || !f.filter_by || f.filter_by === name.n);
        if (have_pivot_agg_level_on) {
            let f_index = new_filters.findIndex(f => f.n === name.n);
            if (f_index !== -1) {
                let filter = {...new_filters[f_index]};
                filter.ignore_list = [];
                filter.selected_list = [];
                filter.unselected_all = false;
                filter.search = "";
                if (this._check_empty_filter(filter)) {
                    new_filters = new_filters.filter(f => f.n !== name.n);
                } else {
                    new_filters[f_index] = filter;
                }
            }
        }
        this.setAttribute("filters", JSON.stringify(new_filters));
    } else if (curr_is_pivot && attr_name === "value-pivots") {
        let filters = JSON.parse(this.getAttribute("filters") || "[]");
        let new_filters = [];
        let vname = this._get_disp_name_aggregate(name.n, name.agg, name.p, name.s || "default");
        new_filters = filters.filter(f => f.filter_by !== vname);
        this.setAttribute("filters", JSON.stringify(new_filters));
    }

    let new_value = this.getAttribute(attr_name);
    // Get new filters and sorts
    var new_filters;
    var new_sorts;
    if (attr_name === "row-pivots" || attr_name === "column-pivots") {
        new_filters = JSON.parse(this.getAttribute("filters"));
        new_sorts = JSON.parse(this.getAttribute("sort"));
    } else if (attr_name === "value-pivots") {
        new_filters = JSON.parse(this.getAttribute("filters"));
    }

    // Action for undrag column
    var options = {
        new_value: new_value,
        old_value: old_value,
        attribute: attr_name
    }
    if (["row-pivots", "column-pivots", "value-pivots"].includes(attr_name)) {
        if (old_active_list != null) {
            options.old_active_list = old_active_list;
        }
        if (new_active_list != null) {
            options.new_active_list = new_active_list;
        }
    }

    if (attr_name === "row-pivots" || attr_name === "column-pivots") {
        options["old_filters"] = JSON.stringify(old_filters || []);
        options["old_sorts"] = JSON.stringify(old_sorts || []);
        options["new_filters"] = JSON.stringify(new_filters || []);
        options["new_sorts"] = JSON.stringify(new_sorts || []);
        if (new_value_pivots) {
            options.new_value_pivots = new_value_pivots;
        }
        if (old_value_pivots) {
            options.old_value_pivots = old_value_pivots;
        }
        if (new_row_pivots) {
            options.new_row_pivots = new_row_pivots;
        }
        if (old_row_pivots) {
            options.old_row_pivots = old_row_pivots;
        }
        if (new_column_pivots) {
            options.new_column_pivots = new_column_pivots;
        }
        if (old_column_pivots) {
            options.old_column_pivots = old_column_pivots;
        }
    } else if (attr_name === "value-pivots") {
        options["old_filters"] = JSON.stringify(old_filters || []);
        options["new_filters"] = JSON.stringify(new_filters || []);
    }
    this._handle_manage_action(perspective.ACTION_TYPE.close_tag, undefined, options,
        _ => {
            if (attr_name === "row-pivots" || attr_name === "column-pivots") {
                // Update disable list agg_level for case undrag "row-pivots" and "column-pivots"
                this._update_disabled_aggregate_level(name);

                if (attr_name === "row_pivots" || attr_name === "column_pivots" && pivots_length === 0){
                    this._update_checkall_fields_visibility(false);
                }
            }
        }, _ => {
            // Update disable list agg_level for case undrag "row-pivots" and "column-pivots"
            if (attr_name === "row-pivots" || attr_name === "column-pivots") {
                this._update_disabled_aggregate_level(name);

                if (pivots_length === 0){
                    this._auto_mark_checkall_fields(this.c_info);
                    this._update_checkall_fields_visibility(true);
                }
            }
        });

    // Update disable list agg_level for case undrag "row-pivots" and "column-pivots"
    if (attr_name === "row-pivots" || attr_name === "column-pivots") {
        this._update_disabled_aggregate_level(name);
    }
}

export function drop(ev) {
    this.close_all();

    ev.preventDefault();
    ev.currentTarget.classList.remove("dropping");
    if (this._drop_target_hover) {
        this._drop_target_hover.removeAttribute("drop-target");
    }

    if (this._drop_target_added) {
        this._drop_target_added.removeAttribute("drop-target");
    }

    // Not allow to drop the search/group item
    if (this._drop_target_hover
      && (this._drop_target_hover.getAttribute("name") === perspective.__FILTER_SEARCH__
        || this._drop_target_hover.getAttribute("name") === perspective.GROUP_FILTER_NAME)){
      ev.stopPropagation();
      return;
    }

    let prev_is_pivot = this.is_cinfo_pivot(false);
    let cols = !prev_is_pivot ? this.c_info.filter(f => f["active"]).map(m => m["name"]) : null;

    let data = ev.dataTransfer.getData("text");
    if (!data) return;
    data = JSON.parse(data);
    var source_attr = data[6];
    if (data[6] === "row_pivots") {
        source_attr = "row-pivots";
    } else if (data[6] === "column_pivots") {
        source_attr = "column-pivots";
    } else if (data[6] === "value_pivots") {
        source_attr = "value-pivots";
    }
    if (!_can_drop.call(this, ev)) return;

    // Update the columns attribute
    let name = ev.currentTarget.querySelector("ul").getAttribute("for") || ev.currentTarget.getAttribute("id").replace("_", "-");
    let have_source = source_attr !== "active_columns" && source_attr !== "inactive_columns" && source_attr !== name;
    let is_target_pivot = name === "row-pivots" || name === "column-pivots";

    if (!is_target_pivot && data[3] == perspective.COMBINED_TYPE_STR && data[0] == perspective.COMBINED_NAME){
      // Not allow "Values" to move to other blocks, except Rows/Columns
      return;
    }

    var old_target_value = this.getAttribute(name) || "[]";
    var old_source_value = have_source ? this.getAttribute(source_attr) || "[]" : null;
    var old_filters = is_target_pivot ? this.getAttribute("filters") || "[]" : null;
    let old_filters_obj = JSON.parse(this.getAttribute("filters")) || [];
    let new_filters_obj = {...old_filters_obj};
    var old_sorts = is_target_pivot ? this.getAttribute("sort") || "[]" : null;
    var old_row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
    var old_column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
    let have_pivot_agg_level_on = false;

    var is_multiple_date_agg = false;
    var is_date = perspective.AGGREGATE_LEVEL_LIST.includes(data[3]);
    var flat_mode = this.is_flat_pivot(false);
    let hover_agg = this._drop_target_hover.getAttribute("aggregate");
    var added_agg_level = this._drop_target_added ? this._drop_target_added.getAttribute("agg_level"): undefined;
    var drag_id = this._drop_target_added ? this._drop_target_added.getAttribute("drag_id"): undefined;
    var data_format = this._drop_target_added ? this._drop_target_added.getAttribute("data_format") : undefined;
    var show_type = this._drop_target_added ? this._drop_target_added.getAttribute("show_type") : undefined;
    var subtotals = this._drop_target_added ? this._drop_target_added.getAttribute("subtotals") : undefined;
    var prev_value = this._drop_target_added ? this._drop_target_added.getAttribute("period") : undefined;
    var binning = this._drop_target_added ? this._drop_target_added.getAttribute("binning") : undefined;
    if (binning){
      binning = JSON.parse(binning);
    }

    var added_sort_by = this._drop_target_added ? this._drop_target_added.getAttribute("sort_by") : undefined;
    var added_sort_order = this._drop_target_added ? this._drop_target_added.getAttribute("sort_order") : undefined;
    var added_sort_sub = this._drop_target_added ? this._drop_target_added.getAttribute("subtotal") : undefined;
    var added_limit = this._drop_target_added ? this._drop_target_added.getAttribute("limit") : undefined;
    var added_limit_type = this._drop_target_added ? this._drop_target_added.getAttribute("limit_type") : undefined;
    var added_new_base_name = this._drop_target_added ? this._drop_target_added.getAttribute("new_base_name") : undefined;
    var added_dname = this._drop_target_added ? this._drop_target_added.getAttribute("dname") : undefined;
    var old_value_pivots = this.getAttribute("value-pivots");
    var new_value_pivots = this.getAttribute("value-pivots");

    if (subtotals != null && subtotals != undefined){
      if (typeof subtotals === "string"){
        subtotals = (subtotals === "true");
      }
    }

    // Duplicate
    if (source_attr !== name){
        if (name === "row-pivots"){
          let prows = JSON.parse(this.getAttribute("row-pivots") || "[]");
          var r_index = prows.findIndex((v)=>v.n === data[0]);
          //if (prows.includes(data[0]) == true){
          if (r_index != -1){

            // Allow date and datetime types
            if (is_date && !flat_mode){
                // Pass
                is_multiple_date_agg = true;
            }else{
              return;
            }
          }
        }else if(name === "column-pivots"){
          let prows = JSON.parse(this.getAttribute("column-pivots") || "[]");
          var r_index = prows.findIndex((v)=>v.n === data[0]);
          //if (prows.includes(data[0]) == true){
          if (r_index != -1){

            // Allow date and datetime types
            if (is_date){
                // Pass
                is_multiple_date_agg = true;
            }else{
              return;
            }
          }
        }else if(name === "value-pivots"){
          let prows = JSON.parse(this.getAttribute("value-pivots") || "[]");
          let visible_period = this._visible_column_period();
          for (let pivot of prows) {
              if (data[0] === pivot.n && hover_agg === pivot.agg && (!visible_period || (prev_value || "none") === (pivot.p || "none"))
                    && show_type === pivot.st) {
                  return;
              }
          }
        }else if(name === "filters"){
          let prows = JSON.parse(this.getAttribute("filters") || "[]");
          const f_index = prows.findIndex((f)=>f.n === data[0]);
          //if (prows.map((v)=>v.n).includes(data[0]) == true){
          if (f_index !== -1){
            // Don't allow duplicate for filters
            // Open current popup settings
            //let ul_c = this._filters.getElementsByTagName("ul")[0];
            //ul_c.removeChild(this._drop_target_added);
            /*
            let f_prows = this._filters.getElementsByTagName("perspective-row");

            let f_drag_id = prows[f_index].drag_id;

            // Find drag_id in the filter tag
            if (!f_drag_id){
              const f_tag_index = Array.prototype.slice.call(f_prows).findIndex((tag)=>tag.getAttribute("name") === data[0]);
              if (f_tag_index !== -1){
                f_drag_id = f_prows[f_tag_index].getAttribute("drag_id");
              }
            }
            */
            ev.data = {name: prows[f_index].n, container: "filters", drag_id: prows[f_index].drag_id};
            this._open_row_settings(ev);
            return;
          }
        }
    }

    // Remove source item if it will be moved to another block
    var moved_sources = ["row-pivots", "column-pivots", "value-pivots", "filters", "sort"];
    if (source_attr !== name){
      if (moved_sources.includes(source_attr) == true){
        if (source_attr === "row-pivots"){
          var row_pivots = JSON.parse(this.getAttribute("row-pivots") || "[]");
          var r_index = -1;
          if (added_agg_level) {
            r_index = row_pivots.findIndex((v)=>v.n === data[0] && (v.agg_l || "OFF") === added_agg_level);
          } else {
            r_index = row_pivots.findIndex((v)=>v.n === data[0]);
          }
          //if (row_pivots.indexOf(data[0]) !== -1) {
          if (r_index != -1){
              let pivot = row_pivots[r_index];
              new_filters_obj = old_filters_obj.filter(f => f.n !== pivot.n || !f.filter_by || f.filter_by === pivot.n);
              if (name !== "colum-pivots" && pivot.agg_l && pivot.agg_l !== "OFF") {
                  have_pivot_agg_level_on = true;
              }
              //row_pivots.splice(row_pivots.indexOf(data[0]), 1);
              row_pivots.splice(r_index, 1);
              this.setAttribute("row-pivots", JSON.stringify(row_pivots));
          }
        }else if (source_attr === "column-pivots"){
          var col_pivots = JSON.parse(this.getAttribute("column-pivots") || "[]");
          var r_index = -1;
          if (added_agg_level) {
            r_index = col_pivots.findIndex((v)=>v.n === data[0] && (v.agg_l || "OFF") === added_agg_level);
          } else {
            r_index = col_pivots.findIndex((v)=>v.n === data[0]);
          }
          //if (col_pivots.indexOf(data[0]) !== -1) {
          if (r_index !== -1) {
              if (name !== "row-pivots") {
                let pivot = col_pivots[r_index];
                new_filters_obj = old_filters_obj.filter(f => f.n !== pivot.n || !f.filter_by || f.filter_by === pivot.n);
                if (pivot.agg_l && pivot.agg_l !== "OFF") {
                    have_pivot_agg_level_on = true;
                }
              }
              //col_pivots.splice(col_pivots.indexOf(data[0]), 1);
              col_pivots.splice(r_index, 1);
              this.setAttribute("column-pivots", JSON.stringify(col_pivots));
          }
        }else if (source_attr === "value-pivots"){
          var value_pivots = JSON.parse(this.getAttribute("value-pivots") || "[]");
          //value_pivots.splice(value_pivots.indexOf(data[0]), 1);
          var j = value_pivots.findIndex((v)=>v.n === data[0] && v.agg === hover_agg);
          if (j != -1){
            let pivot = value_pivots[j];
            value_pivots.splice(j, 1);
            let vname = this._get_disp_name_aggregate(pivot.n, pivot.agg, pivot.p, pivot.st || "default");
            this.setAttribute("value-pivots", JSON.stringify(value_pivots));
            new_filters_obj = old_filters_obj.filter(f => f.filter_by !== vname);
          }
        }else if (source_attr === "filters"){
          var filters = JSON.parse(this.getAttribute("filters") || "[]");
          var j = filters.findIndex((v)=>v.n === data[0]);
          if (j !== -1) {
              filters.splice(j, 1);
              this.setAttribute("filters", JSON.stringify(filters));
          }
        }
      }
    }

    if (have_pivot_agg_level_on) {
        let f_index = new_filters_obj.findIndex(f => f.n === data[0]);
        if (f_index !== -1) {
            let filter = {...new_filters_obj[f_index]};
            filter.ignore_list = [];
            filter.selected_list = [];
            filter.unselected_all = false;
            filter.search = "";
            if (this._check_empty_filter(filter)) {
                new_filters_obj = new_filters_obj.filter(f => f.n !== data[0]);
            } else {
                new_filters_obj[f_index] = filter;
            }
        }
    }
    if (old_filters_obj.length > 0 && new_filters_obj.length < old_filters_obj.length) {
        this.setAttribute("filters", JSON.stringify(new_filters_obj));
    }

    var columns = [];

    // Move inside container (row pivots, column pivots and values)
    var moved_inside_container = false;
    if (source_attr === name){
        var ordered_prows = [];

        if (name === "row-pivots"){
            moved_inside_container = true;
            ordered_prows = this._row_pivots.getElementsByTagName("perspective-row");

        }else if (name === "column-pivots"){
            moved_inside_container = true;
            ordered_prows = this._column_pivots.getElementsByTagName("perspective-row");
        }else if (name === "value-pivots"){
            moved_inside_container = true;
            ordered_prows = this._value_pivots.getElementsByTagName("perspective-row");
        }else if (name === "filters"){
            moved_inside_container = true;
            ordered_prows = this._filters.getElementsByTagName("perspective-row");
        }

        if (moved_inside_container == true){
          /*if (name === "filters"){
            var f_columns = JSON.parse(this.getAttribute(name) || "[]");

            var l_columns = [];
            for (var pi =0; pi < ordered_prows.length; pi++){
              l_columns.push(ordered_prows[pi].getAttribute("name"));
              var f_i = f_columns.findIndex((v)=>v[0] === ordered_prows[pi].getAttribute("name"));
              if (f_i != -1){
                columns.push(f_columns[f_i]);
              }
            }

            // Do not re-query if it doesn't change
            if (this._original_index != -1 && this._original_index === l_columns.indexOf(data[0])){
                return;
            }

          }else{
            for (var pi =0; pi < ordered_prows.length; pi++){
                columns.push(ordered_prows[pi].getAttribute("name"));
            }

            // Do not re-query if it doesn't change
            if (this._original_index != -1 && this._original_index === columns.indexOf(data[0])){
                return;
            }
          }*/

          var f_columns = JSON.parse(this.getAttribute(name) || "[]");

          var l_columns = [];
          for (var pi =0; pi < ordered_prows.length; pi++){
            //l_columns.push(ordered_prows[pi].getAttribute("name"));
            l_columns.push({"name": ordered_prows[pi].getAttribute("name"), "drag_id": ordered_prows[pi].getAttribute("drag_id")});

            var f_i = -1;
            if (name === "filters"){
              f_i = f_columns.findIndex((v)=>v.n === ordered_prows[pi].getAttribute("name"));
            }else if (name === "row-pivots" || name === "column-pivots"){
                f_i = f_columns.findIndex((v)=>v.n === ordered_prows[pi].getAttribute("name"));
            }else{
              f_i = f_columns.findIndex((v)=>v === ordered_prows[pi].getAttribute("name"));
            }
            if (f_i != -1){
              columns.push(f_columns[f_i]);
            }
          }

          // Do not re-query if it doesn't change
          //if (this._original_index != -1 && this._original_index === l_columns.indexOf(data[0])){
          if (this._original_index != -1 && this._original_index === l_columns.findIndex((v)=>v.name === data[0] && v.drag_id === data[7])){
              return;
          }

        }
    }

    if (!columns || columns.length === 0){
        columns = JSON.parse(this.getAttribute(name) || "[]");
    }

    var data_index = -1;//columns.indexOf(data[0]);
    if (["row-pivots", "column-pivots"].includes(name) === true){
        data_index = columns.findIndex((v)=>v.n === data[0]);
    }else if (name === "value-pivots") {
        for(let idx in columns) {
            let item = columns[idx];
            if (item.n === data[0] && hover_agg === item.a) {
                data_index = idx;
                break;
            }
        }
    }else{
        data_index = columns.indexOf(data[0]);
    }

    //if (data_index !== -1 && ["column-pivots", "row-pivots"].indexOf(name) == -1) {
    if (data_index !== -1 && !moved_inside_container && !is_multiple_date_agg) {
        columns.splice(data_index, 1);
    }

    var pivots_length_before = JSON.parse(this.getAttribute("row-pivots")).length + JSON.parse(this.getAttribute("column-pivots")).length
                            + JSON.parse(this.getAttribute("value-pivots") || "[]").length;

    const filtering = name.indexOf("filter") > -1;
    if (filtering) {
        if (moved_inside_container == true){
          this.setAttribute(name, JSON.stringify(columns));
        }else{
          //this.setAttribute(name, JSON.stringify(columns.concat([[data[0], data[1], data[2]]])));
          var f_value = {n: data[0], operator: data[1], operand: data[2]};
          var ul = this._filters.getElementsByTagName("ul")[0];
          var added_index = Array.prototype.slice.call(ul.children).indexOf(this._drop_target_added);
          if (added_index !== -1){
            columns.splice(added_index, 0, f_value);
          }else{
            columns.push(f_value);
          }
          this.setAttribute(name, JSON.stringify(columns));

          // Auto open the filter settings popup
          ev.data = {name: f_value.n, container: "filters"};
          this._open_row_settings(ev);

        }
    } else if (name.indexOf("sort") > -1) {
        this.setAttribute(name, JSON.stringify(columns.concat([[data[0]]])));
    } else if (is_target_pivot && data[3] == perspective.COMBINED_TYPE_STR) {
        this._force_to_fetch_only = true;
        if (moved_inside_container == true){
            this.setAttribute(name, JSON.stringify(columns));
        }else{
            this.setAttribute(name, JSON.stringify(columns.concat([{
                n: data[0],
                dname: added_dname || this._get_dname_name(perspective.COMBINED_NAME),
                drag_id: this._generage_drag_id()
            }])));
        }
        this._force_to_fetch_only = false;
    } else if(name === "value-pivots"){
        if (moved_inside_container == true){
            this.setAttribute(name, JSON.stringify(columns));
        }else{
            // Get index to insert
            /*var h = 22;
            let prows = this._value_pivots.querySelector("ul").children;
            let new_index = Math.floor((ev.offsetY - 5 + this._value_pivots.scrollTop) / h);
            new_index = Math.min(Math.max(new_index, 0), prows.length -1 > 0 ? prows.length -1 : 0);
            var v_pivot = {
                n: data[0],
                t: data[3],
                agg: this._drop_target_hover.getAttribute("aggregate")
            }
            if (source_attr === "")
            columns.splice(new_index, 0, v_pivot);

            this.setAttribute(name, JSON.stringify(columns));
            */
            var v_pivot = {n: data[0],
                t: data[3],
                agg: this._drop_target_hover.getAttribute("aggregate"),
                df: data_format || perspective.DATA_FORMAT_DEFAULTS[data[3]],//this._get_default_data_format(data[3]),
                drag_id: drag_id || this._generage_drag_id(),
                st: show_type || "default",
                dname: this._get_dname_name(added_dname || data[0])
            }

            if (added_new_base_name){
              v_pivot.base_name = added_new_base_name;
              //v_pivot.dname = added_new_base_name;
            }

            if (prev_value){
              v_pivot.p = prev_value;
            }
            var ul = this._value_pivots.getElementsByTagName("ul")[0];
            var added_index = Array.prototype.slice.call(ul.children).indexOf(this._drop_target_added);
            if (added_index !== -1){
              columns.splice(added_index, 0, v_pivot);
            }else{
              columns.push(v_pivot);
            }
            this.setAttribute(name, JSON.stringify(columns));
        }
    }else if (name === "row-pivots") {
        if (moved_inside_container == true){
            this.setAttribute(name, JSON.stringify(columns));
        }else{
            var ul = this._row_pivots.getElementsByTagName("ul")[0];
            var add_data = {n: data[0], t:data[3]/*, agg: hover_agg*/, df: data_format || perspective.DATA_FORMAT_DEFAULTS[data[3]], drag_id: drag_id || this._generage_drag_id(),
              dname: added_dname || data[0]
            };

            if (added_agg_level){
              add_data.agg_l = added_agg_level;
            }

            if (subtotals != null && subtotals != undefined){
              add_data.subtotals = subtotals;
            }

            if (binning){
              add_data.b = binning;
            }

            if (added_sort_by){
              add_data.sort_by = added_sort_by;
            }

            if (added_sort_order){
              add_data.sort_o = added_sort_order;
            }

            if (added_sort_sub){
              add_data.sort_sub = added_sort_sub;
            }

            if (added_limit_type){
              add_data.limit = added_limit;
            }
            if (added_limit){
              add_data.limit_t = added_limit_type;
            }

            var added_index = Array.prototype.slice.call(ul.children).indexOf(this._drop_target_added);
            if (added_index !== -1){
              columns.splice(added_index, 0, add_data);
              this.setAttribute(name, JSON.stringify(columns));
            }else{
              this.setAttribute(name, JSON.stringify(columns.concat([add_data])));
            }

            let col_pivots = JSON.parse(this.getAttribute("column-pivots") || "[]");

            if (is_date == true){
              // Pass
            }else{
              //var c_index = col_pivots.indexOf(data[0]);
              var c_index = col_pivots.findIndex((v)=>v.n === data[0]);
              if (c_index !== -1){
                //col_pivots.splice(col_pivots.indexOf(data[0]), 1);
                col_pivots.splice(c_index, 1);
                this.setAttribute("column-pivots", JSON.stringify(col_pivots));
              }
            }

            // Remove tag with current name and aggregate is no calculation (any)
            let value_pivots_obj = JSON.parse(new_value_pivots) || [];
            new_value_pivots = JSON.stringify(value_pivots_obj.filter(p => !(p.n === data[0] && p.agg === "any")));
            this.setAttribute("value-pivots", new_value_pivots);
        }
    } else if (name === "column-pivots") {
        if (moved_inside_container == true){
            this.setAttribute(name, JSON.stringify(columns));
        }else{
            var ul = this._column_pivots.getElementsByTagName("ul")[0];
            var add_data = {n: data[0], t:data[3]/*, agg: hover_agg*/, df: data_format || perspective.DATA_FORMAT_DEFAULTS[data[3]], drag_id: drag_id || this._generage_drag_id(),
              dname: added_dname || data[0]
            };

            if (added_agg_level){
              add_data.agg_l = added_agg_level;
            }

            if (subtotals != null && subtotals != undefined){
              add_data.subtotals = subtotals;
            }

            if (binning){
              add_data.b = binning;
            }

            if (added_sort_by){
              add_data.sort_by = added_sort_by;
            }

            if (added_sort_order){
              add_data.sort_o = added_sort_order;
            }

            if (added_limit_type){
              add_data.limit = added_limit;
            }
            if (added_limit){
              add_data.limit_t = added_limit_type;
            }

            var added_index = Array.prototype.slice.call(ul.children).indexOf(this._drop_target_added);
            if (added_index !== -1){
              columns.splice(added_index, 0, add_data);
              this.setAttribute(name, JSON.stringify(columns));
            }else{
              this.setAttribute(name, JSON.stringify(columns.concat([add_data])));
            }
            let row_pivots = JSON.parse(this.getAttribute("row-pivots") || "[]");

            if (is_date == true){
              // Pass
            }else{
              //var r_index = row_pivots.indexOf(data[0]);
              var r_index = row_pivots.findIndex((v)=>v.n === data[0]);
              if (r_index !== -1){
                row_pivots.splice(r_index, 1);
                this.setAttribute("row-pivots", JSON.stringify(row_pivots));
              }
            }

            // Remove tag with current name and aggregate is no calculation (any)
            let value_pivots_obj = JSON.parse(new_value_pivots) || [];
            new_value_pivots = JSON.stringify(value_pivots_obj.filter(p => !(p.n === data[0] && p.agg === "any")));
            this.setAttribute("value-pivots", new_value_pivots);
        }
    }

    var pivots_length_after = JSON.parse(this.getAttribute("row-pivots")).length + JSON.parse(this.getAttribute("column-pivots")).length
                                + JSON.parse(this.getAttribute("value-pivots") || "[]").length;
    if (pivots_length_before == 0 && pivots_length_after > 0){
        //this._checkall_fields.checked = false;
        //this._checkall_fields.indeterminate = false;
        //this._checkall_fields_checkmark.classList.add("disable-opacity");
        this._update_checkall_fields_visibility(false);
    }

    let curr_is_pivot = this.is_cinfo_pivot(false);
    // Deselect the dropped column
    /*if (this._plugin.deselectMode === "pivots" && name !== "sort" && !filtering && !having) {
        if (this._get_visible_column_count() > 1) {
            for (let x of this.shadowRoot.querySelectorAll("#active_columns perspective-row")) {
                if (x.getAttribute("name") === data[0]) {
                    this._active_columns.removeChild(x);
                    break;
                }
            }
        }
        this._update_column_view();
    }*/

    var add_active_tag = function(old_row) {
        var base_columns = this._get_view_column_base_names();
        let name = old_row.getAttribute("name");
        // Check and add column name to active list
        if (!base_columns.includes(name) && name !== perspective.COMBINED_NAME) {
            var row = this._new_row(old_row.getAttribute("name"), old_row.getAttribute("type"), old_row.getAttribute("aggregate")
                , old_row.getAttribute("data_format"), undefined, undefined
                , old_row.getAttribute("computed_column"), "active_columns");
            this._pivotList.addActiveRow(row, true);
        }
    };

    var new_active_list;

    // Remove all left tags on active columns for row pivots
    if (this._plugin.deselectMode === "pivots") {
        if (is_target_pivot){
            if (this._get_view_dom_columns("#row_pivots perspective-row").length
                + this._get_view_dom_columns("#column_pivots perspective-row").length
                + this._get_view_dom_columns("#value_pivots perspective-row").length == 1) {
                this._pivotList.clearActiveRows();
            }

            if (source_attr === "value-pivots") {
                // add or remove combined column
                this._update_combined_column();
            }

            add_active_tag.call(this, this._drop_target_hover);

            this._update_column_view();
        } else if (["value-pivots", "filters", "sort"].includes(name)) {
            add_active_tag.call(this, this._drop_target_hover);

            // add or remove combined column
            this._update_combined_column();
            if (!curr_is_pivot) {
                new_active_list = this.c_info.filter(f => f["active"]).map(m => m["name"]);

                this._auto_mark_checkall_fields(this.c_info);
                //this._checkall_fields_checkmark.classList.remove("disable-opacity");
                this._update_checkall_fields_visibility(true);

                this._update_column_view(new_active_list, true);
            } else {
                this._update_column_view();
            }
        }
    }

    // Change from flat mode to pivot mode: Clear all sort, filters (except the search item), value pivots
    if (!prev_is_pivot && curr_is_pivot) {
        this.setAttribute("sort", JSON.stringify([]));

        /*let curr_filters = JSON.parse(this.getAttribute("filters") || "[]");
        const search_item_index = curr_filters.findIndex((f)=>f.n === perspective.__FILTER_SEARCH__);
        if (search_item_index !== -1){
          this.setAttribute("filters", JSON.stringify([curr_filters[search_item_index]]));
        }else{
          this.setAttribute("filters", JSON.stringify([]));
        }*/
        //this.setAttribute("value-pivots", JSON.stringify([]));
        if (name === "row-pivots" || name === "column-pivots") {
            let dname_pivots = JSON.parse(this.getAttribute("dname-pivots")) || {};
            new_value_pivots = JSON.stringify([{
                "n": "__rownum__",
                "t": "integer",
                "agg": "count",
                "df": "number",
                "st": "default",
                "p": "none",
                "drag_id": this._generage_drag_id(),
                "base_name": "Count of " + this._get_dname_name("__rownum__"),
                "dname": dname_pivots["Count of " + this._get_dname_name("__rownum__")] || ("Count of " + this._get_dname_name("__rownum__"))
            }]);
            this.setAttribute("value-pivots", new_value_pivots);
            const elements = this._get_view_dom_columns("#inactive_columns perspective-row");
            var curr_elem = null;
            for (let elem of elements) {
                if (elem.getAttribute("name") == "__rownum__") {
                    curr_elem = elem;
                    break;
                }
            }
            if (curr_elem) {
                curr_elem.classList.add("active");
                add_active_tag.call(this, curr_elem);
            }
        }
    } else if (prev_is_pivot && curr_is_pivot && is_target_pivot) {
        let sorts = JSON.parse(this.getAttribute("sort"));
        var sort_index = -1;
        for (let index in sorts) {
            let sort = sorts[index];
            if (sort[0] === data[0]) {
                sort_index = index;
                break;
            }
        }
        if (sort_index !== -1) {
            sorts.splice(sort_index, 1);
        }
        if (data[0] !== perspective.COMBINED_NAME) {
            sorts.push([data[0]]);
        }
        this.setAttribute("sort", JSON.stringify(sorts));
    }
    new_active_list = this._get_view_column_base_names();

    var new_target_value = this.getAttribute(name) || "[]";
    var new_source_value = have_source ? this.getAttribute(source_attr) || "[]" : null;
    var new_filters = is_target_pivot ? this.getAttribute("filters") || "[]" : null;
    var new_sorts = is_target_pivot ? this.getAttribute("sort") || "[]" : null;
    var new_row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
    var new_column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
    var options = {
        target: {
            attribute: name,
            new_value: new_target_value,
            old_value: old_target_value
        }
    };
    if (new_filters_obj.length < old_filters_obj.length) {
        options.target.new_filters = this.getAttribute("filters");
        options.target.old_filters = JSON.stringify(old_filters_obj);
    }
    if (is_target_pivot) {
        options.target.new_filters = new_filters;
        options.target.new_sorts = new_sorts;
        options.target.old_filters = old_filters;
        options.target.old_sorts = old_sorts;
    }
    if (!prev_is_pivot && curr_is_pivot) {
        options.target.old_active_list = cols;
    }
    if (new_active_list) {
        options.target.new_active_list = new_active_list;
    }
    if (have_source) {
        options.source = {
            attribute: source_attr,
            new_value: new_source_value,
            old_value: old_source_value
        };
    }
    if ((source_attr !== "row-pivots" && name !== "row-pivots" && new_row_pivots.length !== old_row_pivots.length)
        || (moved_inside_container && name === "row-pivots")) {
        options.row_pivots = {
            new_value: JSON.stringify(new_row_pivots),
            old_value: JSON.stringify(old_row_pivots)
        };
    }
    if ((source_attr !== "column-pivots" && name !== "column-pivots" && new_column_pivots.length !== old_column_pivots.length)
        || (moved_inside_container && name === "column-pivots")) {
        options.column_pivots = {
            new_value: JSON.stringify(new_column_pivots),
            old_value: JSON.stringify(old_column_pivots)
        };
    }
    if (new_value_pivots !== old_value_pivots) {
        options.value_pivots = {
            new_value: new_value_pivots,
            old_value: old_value_pivots
        };
    }

    this._handle_manage_action(perspective.ACTION_TYPE.add_tag, undefined, options,
        _ => {
            // Update disable list agg_level for case undrag "row-pivots" and "column-pivots"
            if (is_date && name === "row-pivots" || name === "column-pivots") {
                this._update_disabled_aggregate_level(data[0]);
            }

            if (!prev_is_pivot && curr_is_pivot){
              this._auto_mark_checkall_fields(this.c_info);
              this._update_checkall_fields_visibility(true);
            }else if(prev_is_pivot && !curr_is_pivot){
              this._update_checkall_fields_visibility(false);
            }
        }, _ => {
            // Update disable list agg_level for case undrag "row-pivots" and "column-pivots"
            if (is_date && name === "row-pivots" || name === "column-pivots") {
                this._update_disabled_aggregate_level(data[0]);
            }

            if (!prev_is_pivot && curr_is_pivot){
              this._update_checkall_fields_visibility(false);
            }else if(prev_is_pivot && !curr_is_pivot){
              this._auto_mark_checkall_fields(this.c_info);
              this._update_checkall_fields_visibility(true);
            }
        });

    // Update disable list agg_level for case undrag "row-pivots" and "column-pivots"
    if (is_date && name === "row-pivots" || name === "column-pivots") {
        this._update_disabled_aggregate_level(data[0]);
    }

    this._run_query();
}

// Handle column actions
export function column_undrag(event) {
    this.close_all();
    //let data = event.target.parentElement.parentElement;
    let data = event.target;
    const active_cols = this._pivotList.getActiveCols(true);
    active_cols.map(x => {
        x.className = "";
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
    });

    //if (this._get_visible_column_count() > 0 && event.dataTransfer.dropEffect !== "move") {
    if (event.dataTransfer.dropEffect !== "move") {
        this._pivotList.removeActiveRow(data, true);
        if (this.is_cinfo_pivot(false)) {
            this._perform_hide_column(data);
        } else {
            //this._update_column_view();
            var options = {};
            /*if (!is_active_columns) {
                options.values = [[data.getAttribute("name"), data.getAttribute("type"), data.getAttribute("aggregate"),
                data.getAttribute("data_format"), data.getAttribute("computed")]];
            }*/
            this._handle_manage_action(perspective.ACTION_TYPE.hide_column, data, options,
                _ => {
                    this._after_visibility_clicked(false);
                },
                _ => {
                    this._after_visibility_clicked(true);
                });
            if (this.is_cinfo_pivot(false)) {
                // add or remove combined column
                this._update_combined_column();

                this._update_column_view();
            }else{
                this.visibility_column_notification();
                this._plugin.notify_column_updates.call(this, this.get_cinfo(false));
                this._update_column_without_view();
            }
        }

        this._auto_mark_checkall_fields();
    }
    this._pivotList.removeClassOfActive("dropping");
    this._row_pivots.classList.remove("dropping");
}

export function column_dragleave(event) {
    // Check can drag leave
    if (this._drop_target_hover.getAttribute("name") === perspective.COMBINED_NAME) {
        return;
    }

    let src = event.relatedTarget;
    while (src && (src !== this._pivotList.getActiveContainer() && src !== this._value_pivots)) {
        src = src.parentElement;
    }
    if (src === null) {
        var source = this._drop_target_hover.getAttribute("container");
        this._pivotList.removeClassOfActive("dropping");
        if (this._drop_target_hover.parentElement === this._pivotList.getActiveContainer()) {
            this._pivotList.removeActiveRow(this._drop_target_hover, true);
        }
        // Add back current item when source is "active columns" or "value pivots" or "row_pivots", "column_pivots"
        if (this._original_index !== -1 && ["value_pivots", "active_columns", "row_pivots", "column_pivots"].includes(source)) {
            if (source === 'active_columns') {
                if (this._original_index < this._pivotList.getActiveCount()) {
                    var row = this._pivotList.getActiveCols()[this._original_index];
                    if (row.getAttribute("name") === this._drop_target_hover.getAttribute("name")) {
                        this._pivotList.removeActiveRow(row, true);
                    }
                    if (this._original_index < this._pivotList.getActiveCount()) {
                        this._pivotList.swapActiveRowByObj(row, this._original_index);
                    } else {
                        this._pivotList.swapActiveRowByObj(row, this._pivotList.getActiveCount());
                    }
                } else {
                    this._pivotList.swapActiveRowByObj(this._drop_target_hover, this._pivotList.getActiveCount());
                }
            } else {
                var source_container = null;
                if (source === "value_pivots"){
                    source_container = this._value_pivots.querySelector("ul");
                } else if (source === "row_pivots") {
                    source_container = this._row_pivots.querySelector("ul");
                } else if (source === "column_pivots") {
                    source_container = this._column_pivots.querySelector("ul");
                }
                if (this._original_index < source_container.children.length) {
                    var row = source_container.children[this._original_index];
                    if (row.getAttribute("name") === this._drop_target_hover.getAttribute("name")) {
                        source_container.removeChild(row);
                    }
                    if (this._original_index < source_container.children.length) {
                        source_container.insertBefore(this._drop_target_hover, source_container.children[this._original_index]);
                    } else {
                        source_container.appendChild(this._drop_target_hover);
                    }
                } else {
                    source_container.appendChild(this._drop_target_hover);
                }
            }
        }
        this._drop_target_hover.removeAttribute("drop-target");
    }
}

export function column_dragover(event) {

    // Not allow to undrag the search item
    if (this._drop_target_hover
      && (this._drop_target_hover.getAttribute("name") === perspective.__FILTER_SEARCH__
        || this._drop_target_hover.getAttribute("name") === perspective.GROUP_FILTER_NAME)){
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    // If the area doesn't allow to drop this item, the next event will be called.
    if (!_can_drop.call(this, event)) {
        return;
    }

    event.preventDefault();
    if (this.is_column_pivot()){
        // Not allow to reorder columns when the column pivot is enabled
        return;
    }

    var source = this._drop_target_hover.getAttribute("container");
    event.dataTransfer.dropEffect = "move";
    if (event.currentTarget.className !== "dropping") {
        event.currentTarget.classList.add("dropping");
    }
    if (!this._drop_target_hover.hasAttribute("drop-target")) {
        this._drop_target_hover.setAttribute("drop-target", true);
    }
    let new_index = calc_index.call(this, event);

    let active_cols = this._pivotList.getActiveCols(true);
    let current_index = active_cols.indexOf(this._drop_target_hover);
    if (current_index < new_index) new_index += 1;

    if (current_index == -1) {
        // if dragging element is inactive_column.
        if (new_index < active_cols.length) {
            if (!active_cols[new_index].hasAttribute("drop-target")) {
                this._pivotList.swapActiveRowWithInactive(this._drop_target_hover, new_index);
            }
        } else {
            if ((active_cols.length === 0) || !active_cols[active_cols.length - 1].hasAttribute("drop-target")) {
                this._pivotList.swapActiveRowWithInactive(this._drop_target_hover, active_cols.length);
            }
        }
    }
    else {
        // if dragging element is active column.
        if (new_index < active_cols.length) {
            if (!active_cols[new_index].hasAttribute("drop-target")) {
                this._pivotList.swapActiveRow(current_index, new_index);
            }
        } else {
            if ((active_cols.length === 0) || !active_cols[active_cols.length - 1].hasAttribute("drop-target")) {
                this._pivotList.swapActiveRow(current_index, active_cols.length);
            }
        }
    }

    // Add old column to right position for case source from "value_pivots" or "filters" and target is "active_columns"
    if (["value_pivots", "filters"].includes(source) && this._original_index !== -1) {
        var source_container = (source === "value_pivots") ? this._value_pivots.querySelector("ul") : this._filters.querySelector("ul");
        if (this._original_index <= source_container.children.length) {
            var row = source_container.children[this._original_index];
            if (!row || this._drop_target_hover.getAttribute("name") !== row.getAttribute("name")) {
                var old_row = this._drop_target_hover;
                var new_row = this._new_row(old_row.getAttribute("name"), old_row.getAttribute("type"), old_row.getAttribute("aggregate")
                        , old_row.getAttribute("data_format"), old_row.getAttribute("filter"), undefined
                        , old_row.getAttribute("computed_column"), source);
                if (this._original_index <= source_container.children.length) {
                    source_container.insertBefore(new_row, source_container.children[this._original_index]);
                } else {
                    source_container.appendChild(new_row);
                }
            }
        }
    }
}

export function column_drop(ev) {
    this.close_all();

    // Not allow to undrag the search item
    if (this._drop_target_hover
      && (this._drop_target_hover.getAttribute("name") === perspective.__FILTER_SEARCH__
        || this._drop_target_hover.getAttribute("name") === perspective.GROUP_FILTER_NAME)){
      ev.stopPropagation();
      ev.preventDefault();
      return;
    }

    // If the area doesn't allow to drop this item, the next event will be called.
    if (!_can_drop.call(this, ev)) {
        return;
    }

    ev.preventDefault();
    if (this.is_column_pivot()){
        // Not allow to drop a column when the column pivot is enabled
        return;
    }

    var old_active_list = [];
    this._get_view_dom_columns().forEach(col => {
        old_active_list.push([col.getAttribute("name"), col.getAttribute("type"), col.getAttribute("aggregate"),
                col.getAttribute("data_format"), col.getAttribute("computed"),
                col.getAttribute("show_type")]);
    });
    var old_value_pivots = JSON.parse(this.getAttribute("value-pivots")) || [];
    var old_row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
    var old_column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
    var old_sort = JSON.parse(this.getAttribute("sort")) || [];
    var moved_column_name = undefined;
    var from_pivot_to_non_pivot = false;
    var from_pivot = false;
    ev.currentTarget.classList.remove("dropping");
    var old_container = this._drop_target_hover.getAttribute("container");
    if (
        this._drop_target_hover.parentElement == this._pivotList.getActiveContainer() &&
        !this._pivotList.isActive(this._drop_target_hover) ||
        this._drop_target_hover.parentElement != this._pivotList.getActiveContainer() &&
        this._pivotList.isActive(this._drop_target_hover)
    ) {
        console.error("_drop_target_hover paretn is active but not added to active columns");
    }
    if (this._drop_target_hover.parentElement === this._pivotList.getActiveContainer()) {
        moved_column_name = this.is_cinfo_pivot(false) ? this._drop_target_hover.getAttribute("dname") : this._drop_target_hover.getAttribute("name");
        this._drop_target_hover.removeAttribute("drop-target");
        this._drop_target_hover.setAttribute("container", "active_columns");

        if (old_container === "row_pivots" || old_container === "column_pivots") {
            var row_pivots = this._get_view_row_pivots();
            var column_pivots = this._get_view_column_pivots();
            var pivots = row_pivots.concat(column_pivots);
            if (pivots.length === 0 || (pivots.length === 1 && pivots[0] === perspective.COMBINED_NAME)) {
                from_pivot_to_non_pivot = true;
                row_pivots = [];
                column_pivots= [];
            }
            this.setAttribute("row-pivots", JSON.stringify(row_pivots));
            this.setAttribute("column-pivots", JSON.stringify(column_pivots));
            from_pivot = true;
        }
    }
    let active_cols = this._pivotList.getActiveCols(true);
    active_cols.map(x => {
        x.className = "";
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
    });
    let data = ev.dataTransfer.getData("text");
    if (!data) return;

    //this._update_column_view();

    var _is_cinfo_pivot = this.is_cinfo_pivot(false);
    var from = -1;
    var moved_index = -1;
    if (moved_column_name) {
        var c_info = this.get_cinfo(false);
        from = c_info.filter(function(v){
            return v.active === true;
        }).findIndex(function(item){
            return item.name === moved_column_name;
        });
        const column_lis = this._get_view_dom_columns("#active_columns perspective-row");
        moved_index = column_lis.findIndex(function(x){
            return moved_column_name === x.getAttribute(_is_cinfo_pivot ? "dname" : "name");
        });
    }
    var options = {};
    if (_is_cinfo_pivot) {
        if (["inactive_columns", "value_pivots", "filters"].includes(old_container)) {
            this._drop_target_hover.setAttribute("active_field", true);
            var type = this._drop_target_hover.getAttribute("type");
            var name = this._drop_target_hover.getAttribute("name");
            var data_format = perspective.DATA_FORMAT_DEFAULTS[type];//this._get_default_data_format(type);
            let pivot_names = old_row_pivots.concat(old_column_pivots).map(f => f.n);

            // Add to row for case type is string or boolean
            // We will add to row if it doesn't exist
            if (["string", "list_string", "boolean", "list_boolean"].includes(type) && !pivot_names.includes(name)) {
                var new_row_pivots = [...old_row_pivots];
                var new_sort = [...old_sort];
                //new_row_pivots.push(name);
                new_row_pivots.push({n: name, t: type, df: data_format, subtotals: true});
                new_sort.push([name]);
                this.setAttribute("row-pivots", JSON.stringify(new_row_pivots));
                this.setAttribute("sort", JSON.stringify(new_sort));
            } else if (["datetime", "list_datetime", "date", "list_date", "duration", "list_duration"].includes(type)
                && !pivot_names.includes(name)) {
                var new_column_pivots = [...old_column_pivots];
                var new_sort = [...old_sort];
                //new_column_pivots.push(name);
                new_column_pivots.push({n: name, t: type, df: data_format, subtotals: true});
                new_sort.push([name]);
                this.setAttribute("column-pivots", JSON.stringify(new_column_pivots));
                this.setAttribute("sort", JSON.stringify(new_sort));
            } else {
                var aggregate = this._suggestion_aggregate(name, type, this._drop_target_hover.getAttribute("period") || "none", this._get_column_show_type(this._drop_target_hover));
                if (this._drop_target_hover.classList.contains("computed-pivot")) {
                    aggregate = "custom";
                }
                let available_list = this._get_available_show_types(this._drop_target_hover);
                let show_type = available_list.length > 0 ? this._suggestion_show_type(this._drop_target_hover) : "default";
                let vname = this._get_disp_name_aggregate(name, aggregate, undefined, show_type);
                var new_value_pivots = old_value_pivots.concat([{
                    n: name,
                    t: type,
                    agg: aggregate,
                    df: data_format,
                    st: show_type,
                    dname: this._get_dname_name(vname)
                }]);
                this.setAttribute("value-pivots", JSON.stringify(new_value_pivots));
            }
        }
        // add or remove combined column
        this._update_combined_column();

        this._update_column_view();
    }else{
        if (from_pivot_to_non_pivot) {
            var new_active_list = this.c_info.filter(f => f["active"]).map(m => m["name"]);

            this._auto_mark_checkall_fields(this.c_info);
            this._update_checkall_fields_visibility(true);

            // add or remove combined column
            this._update_combined_column();
            this._update_column_view(new_active_list, true);
        } else {
            if (moved_column_name){
                this.updates_cinfo_after_columns_moved([moved_column_name], from, 1, moved_index);
            }
            this.visibility_column_notification();
            this._plugin.notify_column_updates.call(this, this.get_cinfo(false));
            this._update_column_without_view();
        }
    }
    if (from !== -1 && !from_pivot) {
        if (from !== moved_index) {
            var len = 1;
            this._handle_manage_action(perspective.ACTION_TYPE.order_columns, undefined, {},
                _ => {
                    var new_from = (from < moved_index) ? (moved_index - (len - 1)) : moved_index;
                    var new_moved_index = (from > moved_index) ? (from + (len - 1)) : from;
                    this._after_move_column_updates([moved_column_name], new_from, len, new_moved_index, true);
                },
                _ => {
                    this._after_move_column_updates([moved_column_name], from, len, moved_index, true);
                });
        }
    } else {
        var new_active_list = [];
        this._get_view_dom_columns().forEach(col => {
            new_active_list.push([col.getAttribute("name"), col.getAttribute("type"), col.getAttribute("aggregate"),
                    col.getAttribute("data_format"), col.getAttribute("computed"),
                    col.getAttribute("show_type")]);
        });
        var new_value_pivots = JSON.parse(this.getAttribute("value-pivots")) || [];
        var new_row_pivots = JSON.parse(this.getAttribute("row-pivots")) || [];
        var new_column_pivots = JSON.parse(this.getAttribute("column-pivots")) || [];
        var new_sort = JSON.parse(this.getAttribute("sort")) || [];
        if (old_active_list.length !== new_active_list.length) {
            options.active_cols = {
                old_value: old_active_list,
                new_value: new_active_list
            };
        }
        if (old_row_pivots.length !== new_row_pivots.length) {
            options.row_pivots = {
                old_value: JSON.stringify(old_row_pivots),
                new_value: JSON.stringify(new_row_pivots)
            };
        }
        if (old_column_pivots.length !== new_column_pivots.length) {
            options.column_pivots = {
                old_value: JSON.stringify(old_column_pivots),
                new_value: JSON.stringify(new_column_pivots)
            };
        }
        if (old_value_pivots.length !== new_value_pivots.length) {
            options.value_pivots = {
                old_value: JSON.stringify(old_value_pivots),
                new_value: JSON.stringify(new_value_pivots)
            }
        }
        if (old_sort.length !== new_sort.length) {
            options.sort = {
                old_value: JSON.stringify(old_sort),
                new_value: JSON.stringify(new_sort)
            };
        }
        this._handle_manage_action(perspective.ACTION_TYPE.show_column, this._drop_target_hover, options,
            _ => {
                this._after_visibility_clicked(true);
            },
            _ => {
                this._after_visibility_clicked(false);
            });
    }
}

export function drag_enter(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    if (_can_drop.call(this, ev)) {
        ev.currentTarget.classList.add("dropping");
    }
    //ev.currentTarget.classList.add("dropping");
}

export function allow_drop(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    if (_can_drop.call(this, ev)) {
        ev.currentTarget.classList.add("dropping");
        ev.dataTransfer.dropEffect = "move";
    }
    //ev.currentTarget.classList.add("dropping");
    //ev.dataTransfer.dropEffect = "move";
}

export function dragover(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    //if (this._drop_target_hover && this._drop_target_hover.getAttribute("name") === perspective.__FILTER_SEARCH__){
    //  return;
    //}
    if (_can_drop.call(this, ev)) {

        ev.dataTransfer.dropEffect = "move";
        if (ev.currentTarget.className !== "dropping") {
            ev.currentTarget.classList.add("dropping");
        }
        if (!this._drop_target_hover.hasAttribute("drop-target")) {
            this._drop_target_hover.setAttribute("drop-target", true);
        }

        if (!this._drop_target_added.hasAttribute("drop-target")) {
            this._drop_target_added.setAttribute("drop-target", true);
        }

        /*let data = ev.dataTransfer.getData("text");
        if (!data) return;
        data = JSON.parse(data);
        var source_attr = data[6];
        if (data[6] === "row_pivots") {
            source_attr = "row-pivots";
        } else if (data[6] === "column_pivots") {
            source_attr = "column-pivots";
        }*/

        var prows = [];
        var ul;
        var scroll_top;
        var feature_name = ev.currentTarget ? ev.currentTarget.getAttribute("id"): null;
        let source_name = this._drop_target_hover.getAttribute("container");

        if (feature_name === "row_pivots"){
            prows = this._row_pivots.getElementsByTagName("perspective-row");
            ul = this._row_pivots.getElementsByTagName("ul")[0];
            scroll_top = this._row_pivots.scrollTop;
        }else if(feature_name === "column_pivots"){
            prows = this._column_pivots.getElementsByTagName("perspective-row");
            ul = this._column_pivots.getElementsByTagName("ul")[0];
            scroll_top = this._column_pivots.scrollTop;
        }else if(feature_name === "value_pivots"){
            prows = this._value_pivots.getElementsByTagName("perspective-row");
            ul = this._value_pivots.getElementsByTagName("ul")[0];
            scroll_top = this._value_pivots.scrollTop;
        }else if(feature_name === "filters"){
            prows = this._filters.getElementsByTagName("perspective-row");
            ul = this._filters.getElementsByTagName("ul")[0];
            scroll_top = this._filters.scrollTop;
        }

        //if ((prows.length == 0 || !ul) && !(feature_name === "value_pivots" && source_name !== "value_pivots")){
        if (!ul){
          return;
        }

        var hover_name = this._drop_target_hover.getAttribute("name");

        // Not allow to drag the search/group item in FILTERS
        if (hover_name === perspective.__FILTER_SEARCH__ || hover_name === perspective.GROUP_FILTER_NAME){
          return;
        }
        var hover_type = this._drop_target_hover.getAttribute("type");
        var is_date = perspective.AGGREGATE_LEVEL_LIST.includes(hover_type);
        var flat_mode = this.is_flat_pivot(false);
        let hover_agg = this._drop_target_hover.getAttribute("aggregate");
        var is_multiple_date_agg = false;

        // Duplicate
        // [In the future we will create a function to check duplication]
        if (source_name !== feature_name){
            if (feature_name === "row_pivots"){
              let columns = JSON.parse(this.getAttribute("row-pivots") || "[]");
              var r_index = columns.findIndex((v)=>v.n === hover_name);
              //if (columns.includes(hover_name) == true){
              if (r_index != -1){

                // Allow date and datetime types
                if (is_date && !flat_mode){
                    // Pass
                    is_multiple_date_agg = true;
                }else{
                  return;
                }
              }
            }else if(feature_name === "column_pivots"){
              let columns = JSON.parse(this.getAttribute("column-pivots") || "[]");
              var r_index = columns.findIndex((v)=>v.n === hover_name);
              //if (columns.includes(hover_name) == true){
              if (r_index != -1){

                // Allow date and datetime types
                if (is_date){
                    // Pass
                    is_multiple_date_agg = true;
                }else{
                  return;
                }
              }
            }else if(feature_name === "value_pivots"){
              let columns = JSON.parse(this.getAttribute("value-pivots") || "[]");
              for (let column of columns) {
                  if (hover_name === column.n && hover_agg === column.a) {
                      return;
                  }
              }
            }else if(feature_name === "filters"){
              /*
              let columns = JSON.parse(this.getAttribute("filters") || "[]");
              if (columns.map((v)=>v.n).includes(hover_name) == true){
                return;
              }
              */

              let columns = JSON.parse(this.getAttribute("filters") || "[]");
              const f_index = columns.findIndex((f)=>f.n === hover_name);
              if (f_index !== -1){
                // The filter tag is unique
                return;
              }
            }
        }

        var h = 22;
        let new_index = Math.floor((ev.offsetY - 5 + scroll_top) / h);
        new_index = Math.min(Math.max(new_index, 0), prows.length -1 > 0 ? prows.length -1 : 0);
        let current_index = Array.prototype.slice.call(prows).indexOf(this._drop_target_added);

        if (["row_pivots", "column_pivots", "filters", "value_pivots"].includes(feature_name)/* && feature_name !== source_name*/){

          // Move the item back its block
          // Eg: dragging a item A (multiple date aggregations) from ROWS to COLUMNS (do not drop it here - keep dragging) and moving it back to ROWS.
          if (current_index == -1 && feature_name === source_name){
            current_index = Array.prototype.slice.call(prows).indexOf(this._drop_target_hover);
            if (current_index !== -1){
              this._drop_target_added = this._drop_target_hover;
            }
          }

          if (current_index == -1){

            var hover_agg_level = undefined;
            var hover_binning = undefined;
            var hover_subtotals = undefined;
            var hover_data_format = undefined;

            var hover_prev_value = undefined;
            var hover_show_type = undefined;

            var hover_sort_by = undefined;
            var hover_sort_order = undefined;
            var hover_sort_sub = undefined;
            var hover_limit = undefined;
            var hover_limit_type = undefined;
            var options = {};
            if (["row_pivots", "column_pivots"].includes(feature_name)){
              if (is_date === true){
                hover_agg_level = this._drop_target_hover.getAttribute("agg_level");
                if (!hover_agg_level){
                  hover_agg_level = this.create_default_agg_level(feature_name, this._drop_target_hover.getAttribute("name"), this._drop_target_hover.getAttribute("type"));
                }
                options.agg_l = hover_agg_level;
              }

              hover_binning = this._drop_target_hover.getAttribute("binning");
              if (hover_binning !== null && hover_binning !== undefined){
                hover_binning = JSON.parse(hover_binning);
              }
              hover_subtotals = this._drop_target_hover.getAttribute("subtotals");
              if (hover_subtotals === null || hover_subtotals === undefined){
                // Default subtotal in ROWS/COLUMNS is true
                hover_subtotals = true;
              }
              hover_data_format = this._drop_target_hover.getAttribute("data_format");

              hover_sort_by = this._drop_target_hover.getAttribute("sort_by");;
              hover_sort_order = this._drop_target_hover.getAttribute("sort_order");;
              hover_sort_sub = this._drop_target_hover.getAttribute("subtotal");;
              hover_limit = this._drop_target_hover.getAttribute("limit");;
              hover_limit_type = this._drop_target_hover.getAttribute("limit_type");;

              options.subtotals = hover_subtotals;
              options.b = hover_binning;
              options.df = hover_data_format;

              options.sort_by = hover_sort_by;
              options.sort_o = hover_sort_order;
              options.sort_sub = hover_sort_sub;
              options.limit = hover_limit;
              options.limit_t = hover_limit_type;

            }else if(feature_name === "value_pivots"){

              hover_prev_value = this._drop_target_hover.getAttribute("period");
              hover_show_type = this._drop_target_hover.getAttribute("show_type");
              hover_data_format = this._drop_target_hover.getAttribute("data_format");
              options.p = hover_prev_value;
              options.st = hover_show_type;
              options.df = hover_data_format;

            }
            var added_hover_row = this._new_row(this._drop_target_hover.getAttribute("name"), this._drop_target_hover.getAttribute("type"), this._drop_target_hover.getAttribute("aggregate")
                    , this._drop_target_hover.getAttribute("data_format"), undefined, undefined
                    , this._drop_target_hover.getAttribute("computed_column"), feature_name, options);

            added_hover_row.setAttribute("drag_id", this._generage_drag_id());

            this._drop_target_added = added_hover_row;
            if (new_index < prows.length) {
                if (!prows[new_index].hasAttribute("drop-target")) {
                    ul.insertBefore(this._drop_target_added, ul.children[new_index]);
                }
            } else if (prows.length == 0 || !prows[prows.length - 1].hasAttribute("drop-target")) {
                ul.appendChild(this._drop_target_added);
            }
          }else{
            if (current_index < new_index) new_index += 1;

            if (new_index < prows.length) {
                if (!prows[new_index].hasAttribute("drop-target")) {
                    ul.insertBefore(this._drop_target_added, ul.children[new_index]);
                }
            } else if (prows.length == 0 || !prows[prows.length - 1].hasAttribute("drop-target")) {
                ul.appendChild(this._drop_target_added);
            }
          }

          if (feature_name === "value_pivots" && source_name !== "value_pivots") {
            if (this._original_index !== -1 && source_name === "active_columns") {
                var active_cols = this._pivotList.getActiveCols(false);
                var old_row = this._drop_target_hover;
                var new_row = this._new_row(old_row.getAttribute("name"), old_row.getAttribute("type"), old_row.getAttribute("aggregate")
                        , old_row.getAttribute("data_format"), undefined, undefined
                        , old_row.getAttribute("computed_column"), source_name);
                new_row.setAttribute("drag_id", old_row.getAttribute("drag_id"));
                if (this._original_index < active_cols.length) {
                    var arow = active_cols[this._original_index];
                    if (arow.getAttribute("drag_id") !== old_row.getAttribute("drag_id")) {
                        this._pivotList.insertActiveRow(new_row, this._original_index);
                    }
                } else {
                    this._pivotList.addActiveRow(new_row);
                }
            }
          }
        }
    }
}

export function disallow_drop(ev) {
    if (ev.currentTarget == ev.target || !_can_drop.call(this, ev)) {
    //if (ev.currentTarget == ev.target) {
        ev.stopPropagation();
        ev.preventDefault();
        ev.currentTarget.classList.remove("dropping");
    }
}

export function dragleave(ev) {
    if (ev.currentTarget == ev.target || !_can_drop.call(this, ev)) {
        ev.stopPropagation();
        ev.preventDefault();
        ev.currentTarget.classList.remove("dropping");
        let name = ev.currentTarget.querySelector("ul").getAttribute("for") || ev.currentTarget.getAttribute("id").replace("_", "-");

        let src = ev.relatedTarget;
        //while (src && src !== this._row_pivots) {
        //    src = src.parentElement;
        //}
        src = null;
        if (src === null) {
            this._row_pivots.classList.remove("dropping");

            /*
            if (this._drop_target_hover.parentElement === this._row_pivots) {
                //this._active_columns.removeChild(this._drop_target_hover);
            }
            if (this._original_index !== -1) {
                //this._active_columns.insertBefore(this._drop_target_hover, this._active_columns.children[this._original_index]);
            }
            this._drop_target_hover.removeAttribute("drop-target");
            */
            if (this._drop_target_added.parentElement){
                var ul_c;
                var tag = this._drop_target_added.parentElement.getAttribute("for");
                if (tag === "row-pivots"){
                  ul_c = this._row_pivots.getElementsByTagName("ul")[0];
                  //this._drop_target_hover.parentElement.removeChild(this._drop_target_hover);
                  //ul_c.removeChild(this._drop_target_hover);
                }else if (tag === "column-pivots"){
                  ul_c = this._column_pivots.getElementsByTagName("ul")[0];
                  //ul_c.removeChild(this._drop_target_hover);
                }else if (tag === "value-pivots"){
                  ul_c = this._value_pivots.getElementsByTagName("ul")[0];
                  //ul_c.removeChild(this._drop_target_hover);
                }else if (tag === "filters"){
                  ul_c = this._filters.getElementsByTagName("ul")[0];
                  //ul_c.removeChild(this._drop_target_hover);
                }

                if (ul_c){
                  var hover_row_index = Array.prototype.slice.call(ul_c.children).indexOf(this._drop_target_hover);
                  if (hover_row_index != -1){
                    ul_c.removeChild(this._drop_target_hover);
                  }

                  var added_row_index = Array.prototype.slice.call(ul_c.children).indexOf(this._drop_target_added);

                  // Remove if it doesn't move inside the block
                  if (added_row_index != -1 && this._drop_target_hover !== this._drop_target_added){
                    ul_c.removeChild(this._drop_target_added);
                  }
                }


                let target_name = tag ? tag.replace("-", "_") : null;
                let source_name = this._drop_target_hover.getAttribute("container");

                if (ul_c && this._original_index !== -1 && target_name === source_name) {
                    ul_c.insertBefore(this._drop_target_hover, ul_c.children[this._original_index]);
                }
                this._drop_target_hover.removeAttribute("drop-target");
                this._drop_target_added.removeAttribute("drop-target");

                // Check drag leave of value pivots
                /*if (target_name === "value_pivots" && source_name !== "value_pivots" && source_name !== "invalid_columns") {
                    var source_ul;
                    if (source_name === "row_pivots") {
                        source_ul = this._row_pivots.querySelector("ul");
                    } else if (source_name === "column_pivots") {
                        source_ul = this._column_pivots.querySelector("ul");
                    } else if (source_name === "value_pivots") {
                        source_ul = this._value_pivots.querySelector("ul");
                    } else if (source_name === "active_columns") {
                        source_ul = this._active_columns;
                    } else if (source_name === "filters") {
                        source_ul = this._filters.querySelector("ul");
                    }
                    if (this._original_index !== -1 && source_ul) {
                        if (this._original_index < source_ul.children.length) {
                            let srow = source_ul.children[this._original_index];
                            source_ul.insertBefore(this._drop_target_hover, srow);
                            if (srow.getAttribute("drag_id") === this._drop_target_hover.getAttribute("drag_id")) {
                                source_ul.removeChild(srow);
                            }
                        } else {
                            source_ul.appendChild(this._drop_target_hover);
                        }
                    }
                }*/
            }
        }

    }
}
