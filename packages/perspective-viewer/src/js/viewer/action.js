/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import perspective from "@jpmorganchase/perspective";

export class Action {
    constructor(type, information, viewer, undo_callback, redo_callback) {
        // type of action
        this._type = type;
        // information of action
        this._information = information;
        // viewer object
        this._viewer = viewer;
        // Callback after undo
        this._undo_cb = undo_callback;
        // Callback after redo
        this._redo_cb = redo_callback;
    }

    /**
     * Perform action or redo action
     */
    execute() {
        switch(this._type) {
            case perspective.ACTION_TYPE.show_column: {
                if (this._information.active_cols) {
                    this._viewer._pivotList.clearActiveRows();
                    this._information.active_cols.new_value.forEach(r => {
                        this.show_column(r);
                    });
                } else {
                    this.show_column(this._information.row);
                }
                if (this._information.value_pivots) {
                    this._viewer.setAttribute("value-pivots", this._information.value_pivots.new_value);
                }
                if (this._information.row_pivots) {
                    this._viewer.setAttribute("row-pivots", this._information.row_pivots.new_value);
                }
                if (this._information.column_pivots) {
                    this._viewer.setAttribute("column-pivots", this._information.column_pivots.new_value);
                }
                if (this._information.sort) {
                    this._viewer.setAttribute("sort", this._information.sort.new_value);
                }
            } break;

            case perspective.ACTION_TYPE.hide_column: {
                if ("viewer_attributes" in this._information) {
                    this._viewer._force_to_fetch_only = true;
                    for (let attr of this._information.viewer_attributes) {
                        this._viewer.setAttribute(attr.attribute, attr.new_value);
                    }
                    this._viewer._force_to_fetch_only = false;
                }
                this.hide_column(this._information.row);
                if (this._information.row_pivots) {
                    this._viewer.setAttribute("row-pivots", JSON.stringify(this._information.row_pivots.new_value));
                }
                if (this._information.column_pivots) {
                    this._viewer.setAttribute("column-pivots", JSON.stringify(this._information.column_pivots.new_value));
                }
                if (this._information.value_pivots) {
                    this._viewer.setAttribute("value-pivots", JSON.stringify(this._information.value_pivots.new_value));
                }
                if (this._information.dependency_elems) {
                    for (let depend of this._information.dependency_elems) {
                        var depend_ele = this.get_selected_column_by_name_drag_id(depend.row[0], depend.row[1], depend.row[2]);
                        if (depend_ele) {
                            for (let attr of depend.attributes) {
                                depend_ele.setAttribute(attr.attribute, attr.new_value);
                            }
                        }
                    }
                }
            } break;

            case perspective.ACTION_TYPE.hide_grid_columns: {
                this._information.rows.forEach(x => {
                    this.hide_column(x);
                });
            } break;

            case perspective.ACTION_TYPE.change_active_dropdown: {
                if ("viewer_attributes" in this._information) {
                    this._viewer._force_to_fetch_only = true;
                    for (let attr of this._information.viewer_attributes) {
                        this._viewer.setAttribute(attr.attribute, attr.new_value);
                    }
                    this._viewer._force_to_fetch_only = false;
                }
                let is_pivot = this._viewer.is_cinfo_pivot(false);
                var column_ele = (this._information.row) ?
                    this.get_selected_column_by_name_drag_id(this._information.row[0], this._information.row[1], this._information.row[2])
                    : null;
                if (column_ele) {
                    if (this._information.attribute) {
                        column_ele.setAttribute(this._information.attribute, this._information.new_value);
                        if (!is_pivot && ["sort_order", "sort_num"].includes(this._information.attribute)) {
                            this.update_sort_to_cinfo(column_ele.getAttribute("name"), this._information.attribute, this._information.new_value);
                        }
                    }
                    if (this._information.dependency_attribute) {
                        for (let depend of this._information.dependency_attribute) {
                            column_ele.setAttribute(depend.attribute, depend.new_value);
                            if (!is_pivot && ["sort_order", "sort_num"].includes(depend.attribute)) {
                                this.update_sort_to_cinfo(column_ele.getAttribute("name"), depend.attribute, depend.new_value);
                            }
                        }
                    }
                }
                if (this._information.dependency_elems) {
                    for (let depend of this._information.dependency_elems) {
                        var depend_ele = this.get_selected_column_by_name_drag_id(depend.row[0], depend.row[1], depend.row[2]);
                        if (depend_ele) {
                            for (let attr of depend.attributes) {
                                depend_ele.setAttribute(attr.attribute, attr.new_value);
                                if (!is_pivot && ["sort_order", "sort_num"].includes(attr.attribute)) {
                                    this.update_sort_to_cinfo(depend_ele.getAttribute("name"), attr.attribute, attr.new_value);
                                }
                            }
                        }
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_column_name: {
                var column_ele = this.get_selected_column_by_name_drag_id(this._information.row[0], this._information.row[1], this._information.row[2]);
                if (column_ele) {
                    column_ele.setAttribute("dname", this._information.new_dname_value);
                    column_ele.setAttribute("alias_name", this._information.new_alias_value);
                    if (column_ele.getAttribute("container") === "value_pivots") {
                        column_ele.setAttribute("vname", this._information.new_dname_value);
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_sort: {
                var column_ele = this.get_selected_column_by_name(this._information.row[0], "#" + this._information.row[1] + " perspective-row");
                if (column_ele) {
                    column_ele.setAttribute(this._information.attribute, this._information.new_value);
                    if (this._information.dependency_attribute) {
                        for (let depend of this._information.dependency_attribute) {
                            column_ele.setAttribute(depend.attribute, depend.new_value);
                        }
                    }
                }
                if (this._information.dependency_elems) {
                    for (let depend of this._information.dependency_elems) {
                        var depend_ele = this.get_selected_column_by_name_drag_id(depend.row[0], depend.row[1], depend.row[2]);
                        if (depend_ele) {
                            for (let attr of depend.attributes) {
                                depend_ele.setAttribute(attr.attribute, attr.new_value);
                            }
                        }
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_filter: {
                if (this._information.row) {
                    let selector = "#" + this._information.row[1] + " perspective-row";
                    var column_ele = this.get_selected_column_by_name(this._information.row[0], selector);
                    if (column_ele) {
                        column_ele.setAttribute(this._information.attribute, this._information.new_value);
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_group_by_dropdown: {
                if ("viewer_attributes" in this._information) {
                    this._viewer._force_to_fetch_only = true;
                    for (let attr of this._information.viewer_attributes) {
                        this._viewer.setAttribute(attr.attribute, attr.new_value);
                    }
                    this._viewer._force_to_fetch_only = false;
                }
                var column_eles = this._viewer._get_view_dom_columns("#row_pivots perspective-row")
                                        .concat(this._viewer._get_view_dom_columns("#column_pivots perspective-row"));
                var column_ele;
                for (var ele of column_eles) {
                    if (ele.getAttribute("name") == this._information.row[0]) {
                        column_ele = ele;
                        break;
                    }
                }
                if (column_ele) {
                    column_ele.setAttribute(this._information.attribute, this._information.new_value);
                }
            } break;

            case perspective.ACTION_TYPE.change_viewer_attribute: {
                this._viewer.setAttribute(this._information.attribute, this._information.new_value);
                if (this._information.dependencies) {
                    for (let dependency of this._information.dependencies) {
                        this._viewer.setAttribute(dependency.attribute, dependency.new_value);
                    }
                }
            } break;

            case perspective.ACTION_TYPE.close_tag: {
                if (this._information.new_filters) {
                    this._viewer.setAttribute("filters", this._information.new_filters);
                }
                this._viewer.setAttribute(this._information.attribute, this._information.new_value);

                if (this._information.new_value_pivots != null && this._information.new_value_pivots != undefined) {
                    this._viewer.setAttribute("value-pivots", this._information.new_value_pivots);
                }

                if (this._information.new_sorts) {
                    this._viewer.setAttribute("sort", this._information.new_sorts);
                }
                if (this._information.new_row_pivots) {
                    this._viewer.setAttribute("row-pivots", this._information.new_row_pivots);
                }
                if (this._information.new_column_pivots) {
                    this._viewer.setAttribute("column-pivots", this._information.new_column_pivots);
                }

                if (this._information.new_active_list != null && this._information.new_active_list != undefined) {
                    this._viewer._update_column_view(this._information.new_active_list, true);
                } else {
                    this._viewer._update_column_view();
                }
            } break;

            case perspective.ACTION_TYPE.add_tag: {
                if (this._information.target.new_filters) {
                    this._viewer.setAttribute("filters", this._information.target.new_filters);
                }
                if (this._information.source) {
                    this._viewer.setAttribute(this._information.source.attribute, this._information.source.new_value);
                }
                // Case sort filter
                this._viewer.setAttribute(this._information.target.attribute, this._information.target.new_value);
                if (this._information.target.new_sorts) {
                    this._viewer.setAttribute("sort", this._information.target.new_sorts);
                }
                if (this._information.row_pivots) {
                    this._viewer.setAttribute("row-pivots", this._information.row_pivots.new_value);
                }
                if (this._information.column_pivots) {
                    this._viewer.setAttribute("column-pivots", this._information.column_pivots.new_value);
                }
                if (this._information.value_pivots) {
                    this._viewer.setAttribute("value-pivots", this._information.value_pivots.new_value);
                }
                if (this._information.target.new_active_list) {
                    this._viewer._update_column_view(this._information.target.new_active_list, true);
                } else {
                    this._viewer._update_column_view();
                }
            } break;

            case perspective.ACTION_TYPE.change_data_formats: {
                var column_eles = this._viewer._get_view_dom_columns("#" + this._information.container + " perspective-row");
                var name_attr = this._information.name_attr;
                for (var ele of column_eles) {
                    var name = ele.getAttribute(name_attr);
                    if (this._information.new_value[name]) {
                        ele.setAttribute("data_format", this._information.new_value[name]);
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_multiple_sorts: {
                var column_eles = this._viewer._get_view_dom_columns("#row_pivots perspective-row")
                        .concat(this._viewer._get_view_dom_columns("#column_pivots perspective-row"));
                for (let column_ele of column_eles) {
                    let key = column_ele.getAttribute("name") + column_ele.getAttribute("drag_id");
                    if (this._information.items[key]) {
                        var item = this._information.items[key];
                        for (let attr in item) {
                            column_ele.setAttribute(attr, item[attr].new_value);
                        }
                    }
                }
                if (this._information.dependency_elems) {
                    for (let depend of this._information.dependency_elems) {
                        var depend_ele = this.get_selected_column_by_name_drag_id(depend.row[0], depend.row[1], depend.row[2]);
                        if (depend_ele) {
                            for (let attr of depend.attributes) {
                                depend_ele.setAttribute(attr.attribute, attr.new_value);
                            }
                        }
                    }
                }
            } break;

            case perspective.ACTION_TYPE.order_columns: {} break;

            case perspective.ACTION_TYPE.change_site_search: {
                if ("new_search_selected_map" in this._information) {
                    this._viewer.c_info.forEach((v)=>{
                        v.is_search_selected = this._information.new_search_selected_map[v.name];
                    });
                } else if (this._information.column_name) {
                    const i = this._viewer.c_info.findIndex((v)=>v.name === this._information.column_name);
                    if (i !== -1){
                        this._viewer.c_info[i].search_type = this._information.new_search_type;
                    }
                }
                if ("new_site_search_obj" in this._information) {
                    this._viewer._site_search_obj = {...this._information.new_site_search_obj};
                }
            } break;

            case perspective.ACTION_TYPE.change_column_width: {
                let c_info = this._viewer.get_cinfo();
                for (let column of this._information.columns) {
                    if (this._information.pivot) {
                        this._viewer.column_width_cache_pivot[column.c_name] = column.new_value;
                    } else {
                        this._viewer.column_width_cache[column.c_name] = column.new_value;
                    }
                    let index = c_info.findIndex(info => info.name === column.c_name);
                    if (index !== -1) {
                        if (column.new_value) {
                            c_info[index].user_width = column.new_value.user_width;
                        } else {
                            c_info[index].user_width = undefined;
                        }
                    }
                }
                this._viewer.set_cinfo(c_info);
            } break;

            default: {} break;
        }
        if (this._redo_cb) {
            this._redo_cb();
        }
    }

    /**
     * Undo action
     */
    undo() {
        switch(this._type) {
            case perspective.ACTION_TYPE.show_column: {
                if (this._information.active_cols) {
                    this._viewer._pivotList.clearActiveRows();
                    this._information.active_cols.old_value.forEach(r => {
                        this.show_column(r);
                    });
                } else {
                    this.hide_column(this._information.row);
                }
                if (this._information.value_pivots) {
                    this._viewer.setAttribute("value-pivots", this._information.value_pivots.old_value);
                }
                if (this._information.row_pivots) {
                    this._viewer.setAttribute("row-pivots", this._information.row_pivots.old_value);
                }
                if (this._information.column_pivots) {
                    this._viewer.setAttribute("column-pivots", this._information.column_pivots.old_value);
                }
                if (this._information.sort) {
                    this._viewer.setAttribute("sort", this._information.sort.old_value);
                }
            } break;

            case perspective.ACTION_TYPE.hide_column: {
                if ("viewer_attributes" in this._information) {
                    this._viewer._force_to_fetch_only = true;
                    for (let attr of this._information.viewer_attributes) {
                        this._viewer.setAttribute(attr.attribute, attr.old_value);
                    }
                    this._viewer._force_to_fetch_only = false;
                }
                if (this._information.active_cols) {
                    this._viewer._pivotList.clearActiveRows();
                    this._information.active_cols.forEach(r => {
                        this.show_column(r);
                    });
                }
                this.show_column(this._information.row);
                if (this._information.row_pivots) {
                    this._viewer.setAttribute("row-pivots", JSON.stringify(this._information.row_pivots.old_value));
                }
                if (this._information.column_pivots) {
                    this._viewer.setAttribute("column-pivots", JSON.stringify(this._information.column_pivots.old_value));
                }
                if (this._information.value_pivots) {
                    this._viewer.setAttribute("value-pivots", JSON.stringify(this._information.value_pivots.old_value));
                }
                if (this._information.dependency_elems) {
                    for (let depend of this._information.dependency_elems) {
                        var depend_ele = this.get_selected_column_by_name_drag_id(depend.row[0], depend.row[1], depend.row[2]);
                        if (depend_ele) {
                            for (let attr of depend.attributes) {
                                depend_ele.setAttribute(attr.attribute, attr.old_value);
                            }
                        }
                    }
                }
            } break;

            case perspective.ACTION_TYPE.hide_grid_columns: {
                this._information.rows.forEach(x => {
                    this.show_column(x);
                });
            } break;

            case perspective.ACTION_TYPE.change_active_dropdown: {
                if ("viewer_attributes" in this._information) {
                    this._viewer._force_to_fetch_only = true;
                    for (let attr of this._information.viewer_attributes) {
                        this._viewer.setAttribute(attr.attribute, attr.old_value);
                    }
                    this._viewer._force_to_fetch_only = false;
                }
                let is_pivot = this._viewer.is_cinfo_pivot(false);
                var column_ele = (this._information.row) ?
                    this.get_selected_column_by_name_drag_id(this._information.row[0], this._information.row[1], this._information.row[2])
                    : null;
                if (column_ele) {
                    if (this._information.attribute) {
                        column_ele.setAttribute(this._information.attribute, this._information.old_value);
                        if (!is_pivot && ["sort_order", "sort_num"].includes(this._information.attribute)) {
                            this.update_sort_to_cinfo(column_ele.getAttribute("name"), this._information.attribute, this._information.old_value);
                        }
                    }
                    if (this._information.dependency_attribute) {
                        for (let depend of this._information.dependency_attribute) {
                            column_ele.setAttribute(depend.attribute, depend.old_value);
                            if (!is_pivot && ["sort_order", "sort_num"].includes(depend.attribute)) {
                                this.update_sort_to_cinfo(column_ele.getAttribute("name"), depend.attribute, depend.old_value);
                            }
                        }
                    }
                }
                if (this._information.dependency_elems) {
                    for (let depend of this._information.dependency_elems) {
                        var depend_ele = this.get_selected_column_by_name_drag_id(depend.row[0], depend.row[1], depend.row[2]);
                        if (depend_ele) {
                            for (let attr of depend.attributes) {
                                depend_ele.setAttribute(attr.attribute, attr.old_value);
                                if (!is_pivot && ["sort_order", "sort_num"].includes(attr.attribute)) {
                                    this.update_sort_to_cinfo(depend_ele.getAttribute("name"), attr.attribute, attr.old_value);
                                }
                            }
                        }
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_column_name: {
                var column_ele = this.get_selected_column_by_name_drag_id(this._information.row[0], this._information.row[1], this._information.row[2]);
                if (column_ele) {
                    column_ele.setAttribute("dname", this._information.old_dname_value);
                    column_ele.setAttribute("alias_name", this._information.old_alias_value);
                    if (column_ele.getAttribute("container") === "value_pivots") {
                        column_ele.setAttribute("vname", this._information.old_dname_value);
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_sort: {
                var column_ele = this.get_selected_column_by_name(this._information.row[0], "#" + this._information.row[1] + " perspective-row");
                if (column_ele) {
                    column_ele.setAttribute(this._information.attribute, this._information.old_value);
                    if (this._information.dependency_attribute) {
                        for (let depend of this._information.dependency_attribute) {
                            column_ele.setAttribute(depend.attribute, depend.old_value);
                        }
                    }
                }
                if (this._information.dependency_elems) {
                    for (let depend of this._information.dependency_elems) {
                        var depend_ele = this.get_selected_column_by_name_drag_id(depend.row[0], depend.row[1], depend.row[2]);
                        if (depend_ele) {
                            for (let attr of depend.attributes) {
                                depend_ele.setAttribute(attr.attribute, attr.old_value);
                            }
                        }
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_filter: {
                if (this._information.row) {
                    let selector = "#" + this._information.row[1] + " perspective-row";
                    var column_ele = this.get_selected_column_by_name(this._information.row[0], selector);
                    if (column_ele) {
                        column_ele.setAttribute(this._information.attribute, this._information.old_value);
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_group_by_dropdown: {
                if ("viewer_attributes" in this._information) {
                    this._viewer._force_to_fetch_only = true;
                    for (let attr of this._information.viewer_attributes) {
                        this._viewer.setAttribute(attr.attribute, attr.old_value);
                    }
                    this._viewer._force_to_fetch_only = false;
                }
                var column_eles = this._viewer._get_view_dom_columns("#row_pivots perspective-row")
                                        .concat(this._viewer._get_view_dom_columns("#column_pivots perspective-row"));
                var column_ele;
                for (var ele of column_eles) {
                    if (ele.getAttribute("name") == this._information.row[0]) {
                        column_ele = ele;
                        break;
                    }
                }
                if (column_ele) {
                    column_ele.setAttribute(this._information.attribute, this._information.old_value);
                }
            } break;

            case perspective.ACTION_TYPE.change_viewer_attribute: {
                this._viewer.setAttribute(this._information.attribute, this._information.old_value);
                if (this._information.dependencies) {
                    for (let dependency of this._information.dependencies) {
                        this._viewer.setAttribute(dependency.attribute, dependency.old_value);
                    }
                }
            } break;

            case perspective.ACTION_TYPE.close_tag: {
                if (this._information.old_filters) {
                    this._viewer.setAttribute("filters", this._information.old_filters);
                }
                if (this._information.old_value_pivots != null && this._information.old_value_pivots != undefined) {
                    this._viewer.setAttribute("value-pivots", this._information.old_value_pivots);
                }

                this._viewer.setAttribute(this._information.attribute, this._information.old_value);

                if (this._information.old_sorts) {
                    this._viewer.setAttribute("sort", this._information.old_sorts);
                }
                if (this._information.old_row_pivots) {
                    this._viewer.setAttribute("row-pivots", this._information.old_row_pivots);
                }
                if (this._information.old_column_pivots) {
                    this._viewer.setAttribute("column-pivots", this._information.old_column_pivots);
                }
                if (this._information.old_active_list != null && this._information.old_active_list != undefined) {
                    this._viewer._pivotList.clearActiveRows();
                    this._information.old_active_list.forEach(x => {
                        let row = this._viewer._new_row(x[0], x[1], x[2], x[3], undefined, undefined, x[4], "active_columns", {st: x[5]});
                        this._viewer._pivotList.addActiveRow(row);
                    });
                }

                this._viewer._update_column_view();
            } break;

            case perspective.ACTION_TYPE.add_tag: {
                if (this._information.target.old_filters) {
                    this._viewer.setAttribute("filters", this._information.target.old_filters);
                }
                if (this._information.source) {
                    this._viewer.setAttribute(this._information.source.attribute, this._information.source.old_value);
                }
                this._viewer.setAttribute(this._information.target.attribute, this._information.target.old_value);
                if (this._information.target.old_sorts) {
                    this._viewer.setAttribute("sort", this._information.target.old_sorts);
                }
                if (this._information.row_pivots) {
                    this._viewer.setAttribute("row-pivots", this._information.row_pivots.old_value);
                }
                if (this._information.column_pivots) {
                    this._viewer.setAttribute("column-pivots", this._information.column_pivots.old_value);
                }
                if (this._information.value_pivots) {
                    this._viewer.setAttribute("value-pivots", this._information.value_pivots.old_value);
                }
                if (this._information.target.old_active_list != null && this._information.target.old_active_list != undefined) {
                    this._viewer._update_column_view(this._information.target.old_active_list, true);
                } else {
                    this._viewer._update_column_view();
                }
            } break;

            case perspective.ACTION_TYPE.change_data_formats: {
                var column_eles = this._viewer._get_view_dom_columns("#" + this._information.container + " perspective-row");
                var name_attr = this._information.name_attr;
                for (var ele of column_eles) {
                    var name = ele.getAttribute(name_attr);
                    if (this._information.old_value[name]) {
                        ele.setAttribute("data_format", this._information.old_value[name]);
                    }
                }
            } break;

            case perspective.ACTION_TYPE.change_multiple_sorts: {
                var column_eles = this._viewer._get_view_dom_columns("#row_pivots perspective-row")
                        .concat(this._viewer._get_view_dom_columns("#column_pivots perspective-row"));
                for (let column_ele of column_eles) {
                    let key = column_ele.getAttribute("name") + column_ele.getAttribute("drag_id");
                    if (this._information.items[key]) {
                        var item = this._information.items[key];
                        for (let attr in item) {
                            column_ele.setAttribute(attr, item[attr].old_value);
                        }
                    }
                }
                if (this._information.dependency_elems) {
                    for (let depend of this._information.dependency_elems) {
                        var depend_ele = this.get_selected_column_by_name_drag_id(depend.row[0], depend.row[1], depend.row[2]);
                        if (depend_ele) {
                            for (let attr of depend.attributes) {
                                depend_ele.setAttribute(attr.attribute, attr.old_value);
                            }
                        }
                    }
                }
            } break;

            case perspective.ACTION_TYPE.order_columns: {} break;

            case perspective.ACTION_TYPE.change_site_search: {
                if ("old_search_selected_map" in this._information) {
                    this._viewer.c_info.forEach((v)=>{
                        v.is_search_selected = this._information.old_search_selected_map[v.name];
                    });
                } else if (this._information.column_name) {
                    const i = this._viewer.c_info.findIndex((v)=>v.name === this._information.column_name);
                    if (i !== -1){
                        this._viewer.c_info[i].search_type = this._information.old_search_type;
                    }
                }
                if ("old_site_search_obj" in this._information) {
                    this._viewer._site_search_obj = {...this._information.old_site_search_obj};
                }
            } break;

            case perspective.ACTION_TYPE.change_column_width: {
                let c_info = this._viewer.get_cinfo();
                for (let column of this._information.columns) {
                    if (this._information.pivot) {
                        this._viewer.column_width_cache_pivot[column.c_name] = column.old_value;
                    } else {
                        this._viewer.column_width_cache[column.c_name] = column.old_value;
                    }
                    const index = c_info.findIndex(info => info.name === column.c_name);
                    if (index !== -1) {
                        if (column.old_value) {
                            c_info[index].user_width = column.old_value.user_width;
                        } else {
                            c_info[index].user_width = undefined;
                        }
                    }
                }
                this._viewer.set_cinfo(c_info);
            } break;

            default: {} break;
        }
        if (this._undo_cb) {
            this._undo_cb();
        }
    }

    /**
     * Redo/undo show/hide column
     */
    show_column(r) {
        // Add row to active columns
        if (r) {
            let row = this._viewer._new_row(r[0], r[1], r[2], r[3], undefined, undefined, r[4], "active_columns", {st: r[5]});
            if (!this._viewer.is_cinfo_pivot(false)) {
                var c_name = r[0];
                var c_active = this._viewer.did_active_columns(c_name);
                var c_index = c_active.indexOf(c_name);

                if (c_index == 0){
                    this._viewer._pivotList.insertActiveRow(row, 0);
                }else if (c_index > 0){
                    this._viewer._pivotList.insertActiveRow(row, c_index);
                }else{
                    // Unknown
                    this._viewer._pivotList.addActiveRow(row);
                }
            }else{
                this._viewer._pivotList.addActiveRow(row);
            }
        }
    }

    /**
     * Redo/undo hide/show column
     */
    hide_column(row) {
        // Add row to active columns
        if (row) {
            var column_ele = this.get_selected_column_by_name(row[0]);
            if (column_ele) {
                this._viewer._pivotList.removeActiveRow(column_ele, true);
            }
        }
    }

    /**
     * Update sort_order and sort_num for cinfo value
     * @param {*} name 
     * @param {*} key 
     * @param {*} value 
     */
    update_sort_to_cinfo(name, key, value) {
        if (key !== "sort_order" && key !== "sort_num") {
            return;
        }
        let c_index = this._viewer.c_info.findIndex(info => name === info.name);
        if (c_index !== -1) {
            this._viewer.c_info[c_index][key] = value;
        }
    }

    /**
     * Get selected column base on name anad aggregate
     * @param {*} name
     * @param {*} drag_id
     * @param {*} container
     */
    get_selected_column_by_name_drag_id(name, drag_id, container) {
        var selector = "#active_columns perspective-row";
        if (container) {
            selector = "#" + container + " perspective-row";
        }
        var column_eles = this._viewer._get_view_dom_columns(selector);
        var column_ele;
        for (var ele of column_eles) {
            if (ele.getAttribute("name") == name &&
                ele.getAttribute("drag_id") == drag_id) {
                column_ele = ele;
                break;
            }
        }
        return column_ele;
    }

    /**
     * Get selected column base on name
     * @param {*} name
     * @param {*} selector
     */
    get_selected_column_by_name(name, selector) {
        var column_eles = this._viewer._get_view_dom_columns(selector);
        var column_ele;
        for (var ele of column_eles) {
            if (ele.getAttribute("name") == name) {
                column_ele = ele;
                break;
            }
        }
        return column_ele;
    }

    /**
     * check can update change width
     * @param {*} information 
     */
    can_update_change_width(information) {
        if (information.pivot !== this._information.pivot) {
            return false;
        }
        if (information.timer - this._information.timer >= 1000) {
            return false;
        }
        if (information.columns.length !== this._information.columns.length) {
            return false;
        }
        for (let i = 0; i < information.columns.length; i++) {
            if (information.columns[i].c_name !== this._information.columns[i].c_name) {
                return false;
            }
        }
        return true;
    }

    /**
     * Process update change width information
     * @param {*} information 
     */
    update_change_width_information(information) {
        for (let i = 0; i < information.columns.length; i++) {
            this._information.columns[i].new_value = information.columns[i].new_value;
        }
    }
}