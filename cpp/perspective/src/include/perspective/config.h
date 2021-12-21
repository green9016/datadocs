/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#pragma once
#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/exports.h>
#include <perspective/aggspec.h>
#include <perspective/searchspec.h>
#include <perspective/pagination.h>
#include <perspective/data_format_spec.h>
#include <perspective/computedspec.h> // - should be removed
#include <perspective/computed.h>
#include <perspective/schema.h>
#include <perspective/config.h>
#include <perspective/pivot.h>
#include <perspective/filter.h>
#include <perspective/search.h>
#include <perspective/sort_specification.h>

#ifdef PSP_ENABLE_WASM
#include <emscripten/val.h>
#include <emscripten.h>
#endif

namespace perspective {

struct PERSPECTIVE_EXPORT t_query_percentage {
    bool is_search = false;
    bool is_filter = false;
    bool is_notify = false;
    bool is_ctx_step_end = false;
    bool is_traversal_step_end = false;
    bool is_agg = false;
    std::int32_t search_val = 0;
    std::int32_t filter_val = 0;
    std::int32_t notify_val = 0;
    std::int32_t ctx_step_end_val = 0;
    std::int32_t traversal_step_end_val = 0;
    std::int32_t agg_check_pivot_val = 0;
    std::int32_t agg_update_shape_val = 0;
    std::int32_t agg_update_agg_val = 0;
    std::int32_t num_trees = 1;
    std::int32_t curr_tree_idx = 1;
};

struct PERSPECTIVE_EXPORT t_pivot_info {
    std::string colname;
    t_pivot_type pivot_type;
    std::int32_t index;
    std::string pivot_name;
    t_agg_level_type agg_level;
    bool subtotal;
    t_binning_info binning;

    bool operator==(const t_pivot_info& rhs) const;
};

struct PERSPECTIVE_EXPORT t_combined_field {
    t_combined_mode m_combined_mode;
    t_index m_combined_index;
};

struct PERSPECTIVE_EXPORT t_config_recipe {
    t_config_recipe();

    std::vector<t_pivot_recipe> m_row_pivots;
    std::vector<t_pivot_recipe> m_col_pivots;
    std::vector<std::pair<std::string, std::string>> m_sortby;
    std::vector<std::pair<std::string, std::string>> m_col_sortby;
    std::vector<t_aggspec_recipe> m_aggregates;
    std::vector<t_searchspec_recipe> m_search_types;
    std::vector<t_data_format_spec_recipe> m_data_formats;
    std::vector<std::string> m_detail_columns;
    t_totals m_totals;
    t_filter_op m_combiner;
    std::vector<t_fterm_recipe> m_fterms;
    std::vector<t_fterm_recipe> m_previous_fterms;
    std::vector<t_sterm> m_sterms;
    t_search_info m_sinfo;
    bool m_handle_nan_sort;
    std::string m_parent_pkey_column;
    std::string m_child_pkey_column;
    std::string m_grouping_label_column;
    t_fmode m_fmode;
    std::vector<std::string> m_filter_exprs;
    std::vector<t_computed_recipe> m_computedspecs; // should be removed
    std::vector<t_computed_column_definition> m_computed_columns;
    std::map<std::string, std::string> m_col_map;
    std::vector<t_pivot_info> m_pivot_info;
    std::vector<t_fterm_recipe> m_hterms;
    t_combined_field m_combined_field;
    t_index m_max_rows;
    t_index m_max_columns;
    t_pivot_view_mode m_pivot_view_mode;
    std::map<std::string, t_show_type> m_show_types;
    std::map<std::string, t_period_type> m_period_types;
    t_paginationspec_recipe m_paginationspec;
};

class PERSPECTIVE_EXPORT t_config {
public:
    t_config();
    t_config(const t_config_recipe& r);
    t_config(const std::vector<t_pivot>& row_pivots, const std::vector<t_aggspec>& aggregates,
        const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats);
    t_config(const std::vector<t_pivot>& row_pivots, const std::vector<t_pivot>& col_pivots,
        const std::vector<t_aggspec>& aggregates, const std::vector<t_searchspec>& search_types,
        const std::vector<t_data_format_spec>& data_formats, const std::vector<std::string>& detail_columns,
        const t_totals totals, const std::vector<std::string>& sort_pivot,
        const std::vector<std::string>& sort_pivot_by, t_filter_op combiner,
        const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, bool handle_nan_sort,
        const std::string& parent_pkey_column, const std::string& child_pkey_column,
        const std::string& grouping_label_column, t_fmode fmode,
        const std::vector<std::string>& filter_exprs, const std::string& grand_agg_str);

    // view config
    t_config(const std::vector<std::string>& row_pivots,
        const std::vector<std::string>& column_pivots, const std::vector<t_aggspec>& aggregates,
        const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats,
        const std::vector<t_sortspec>& sortspecs, const std::vector<t_sortspec>& col_sortspecs,
        t_filter_op combiner, const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, t_search_info sinfo,
        const std::vector<std::string>& col_names, bool column_only, const std::vector<t_computed_column_definition>& computed_columns = {},
        const std::map<std::string, std::string> col_map = std::map<std::string, std::string>(),
        const std::vector<t_pivot_info> pivot_info = {}, const std::vector<t_fterm>& hterms = {},
        t_combined_field combined_field = t_combined_field{COMBINED_MODE_COLUMN, -1}, t_index max_rows = -1,
        t_index max_columns = -1, t_pivot_view_mode pivot_view_mode = PIVOT_VIEW_MODE_NESTED,
        std::map<std::string, t_show_type> show_types = std::map<std::string, t_show_type>(),
        std::vector<t_fterm> previous_fterms = {},
        std::map<std::string, t_period_type> period_types = std::map<std::string, t_period_type>(),
        t_paginationspec paginationspec = t_paginationspec());

    // grouped_pkeys
    t_config(const std::vector<std::string>& row_pivots,
        const std::vector<std::string>& detail_columns, t_filter_op combiner,
        const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, const std::string& parent_pkey_column,
        const std::string& child_pkey_column, const std::string& grouping_label_column);

    // ctx2
    t_config(const std::vector<std::string>& row_pivots,
        const std::vector<std::string>& col_pivots, const std::vector<t_aggspec>& aggregates,
        const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats);

    t_config(const std::vector<t_pivot>& row_pivots, const std::vector<t_pivot>& col_pivots,
        const std::vector<t_aggspec>& aggregates, const std::vector<t_searchspec>& search_types,
        const std::vector<t_data_format_spec>& data_formats, const t_totals totals, t_filter_op combiner,
        const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, t_search_info sinfo, bool column_only,
        const std::vector<t_computed_column_definition>& computed_columns = {}, const std::vector<t_sortspec> sortspecs = {},
        const std::vector<t_sortspec> col_sortspecs = {},
        const std::map<std::string, std::string> col_map = std::map<std::string, std::string>(),
        const std::vector<t_pivot_info> pivot_info = {}, const std::vector<t_fterm>& hterms = {},
        t_combined_field combined_field = t_combined_field{COMBINED_MODE_COLUMN, -1},
        t_index max_rows = -1, t_index max_columns = -1, t_pivot_view_mode pivot_view_mode = PIVOT_VIEW_MODE_NESTED,
        std::map<std::string, t_show_type> show_types = std::map<std::string, t_show_type>(),
        std::vector<t_fterm> previous_fterms = {},
        std::map<std::string, t_period_type> period_types = std::map<std::string, t_period_type>(),
        t_paginationspec paginationspec = t_paginationspec());

    t_config(const std::vector<std::string>& row_pivots,
        const std::vector<std::string>& col_pivots, const std::vector<t_aggspec>& aggregates,
        const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats,
        const t_totals totals, t_filter_op combiner, const std::vector<t_fterm>& fterms,
        const std::vector<t_sterm>& sterms);

    // t_ctx1
    t_config(
        const std::vector<std::string>& row_pivots, const std::vector<t_aggspec>& aggregates,
        const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats);

    t_config(const std::vector<std::string>& row_pivots, const t_aggspec& agg);

    t_config(const std::vector<t_pivot>& row_pivots, const std::vector<t_aggspec>& aggregates,
        const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats,
        t_filter_op combiner, const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, t_search_info sinfo,
        const std::vector<t_computed_column_definition>& computed_columns = {}, std::vector<t_sortspec> sortspecs = {},
        const std::map<std::string, std::string> col_map = std::map<std::string, std::string>(),
        const std::vector<t_pivot_info> pivot_info = {}, const std::vector<t_fterm>& hterms = {},
        t_combined_field combined_field = t_combined_field{COMBINED_MODE_COLUMN, -1}, t_index max_rows = -1,
        t_index max_columns = -1, t_pivot_view_mode pivot_view_mode = PIVOT_VIEW_MODE_NESTED,
        std::map<std::string, t_show_type> show_types = std::map<std::string, t_show_type>(),
        std::vector<t_fterm> previous_fterms = {},
        std::map<std::string, t_period_type> period_types = std::map<std::string, t_period_type>(),
        t_paginationspec paginationspec = t_paginationspec());

    t_config(const std::vector<std::string>& row_pivots,
        const std::vector<t_aggspec>& aggregates, const std::vector<t_searchspec>& search_types,
        const std::vector<t_data_format_spec>& data_formats, t_filter_op combiner,
        const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms,
        const std::vector<t_computed_column_definition>& computed_columns = {},
        const std::map<std::string, std::string> col_map = std::map<std::string, std::string>(),
        const std::vector<t_pivot_info> pivot_info = {});

    // t_ctx0
    t_config(const std::vector<std::string>& detail_columns);
    t_config(const std::vector<std::string>& detail_columns, t_filter_op combiner,
        const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, t_search_info sinfo,
        const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats,
        const std::vector<t_computed_column_definition>& computed_columns = {},
        const std::map<std::string, std::string> col_map = std::map<std::string, std::string>(),
        t_index max_rows = -1, t_index max_columns = -1, t_paginationspec paginationspec = t_paginationspec());

    void setup(const std::vector<std::string>& detail_columns,
        const std::vector<std::string>& sort_pivot,
        const std::vector<std::string>& sort_pivot_by);

    t_index get_colidx(const std::string& colname) const;

    std::string repr() const;

    t_uindex get_num_aggregates() const;

    t_uindex get_num_columns() const;

    std::string col_at(t_uindex idx) const;

    bool has_pkey_agg() const;

    std::string get_totals_string() const;

    std::string get_sort_by(const std::string& pivot) const;

    bool validate_colidx(t_index idx) const;

    const std::vector<std::string>& get_column_names() const;
    t_uindex get_num_rpivots() const;
    t_uindex get_num_cpivots() const;
    bool is_column_only() const;

    std::vector<t_pivot> get_pivots() const;
    const std::vector<t_pivot>& get_row_pivots() const;
    const std::vector<t_pivot>& get_column_pivots() const;
    const std::vector<t_aggspec>& get_aggregates() const;
    const std::vector<t_searchspec>& get_search_types() const;
    const std::vector<t_data_format_spec>& get_data_formats() const;
    const std::map<std::string, t_dataformattype> get_data_format_map() const;
    const std::map<std::string, std::string>& get_col_map() const;
    const std::vector<t_pivot_info>& get_pivot_info_vec() const;
    const t_pivot_info get_pivot_info(const std::string colname, t_pivot_type pivot_type, std::int32_t index) const;

    std::vector<std::pair<std::string, std::string>> get_sortby_pairs() const;
    const std::vector<t_sortspec>& get_sortspecs() const;
    const std::vector<t_sortspec>& get_col_sortspecs() const;
    const std::vector<t_computedspec>& get_computedspecs() const; // should be removed
    const std::vector<t_computed_column_definition>& get_computed_columns() const;

    const std::map<std::string, t_show_type>& get_show_types() const;

    bool has_filters() const;
    bool has_previous_filters() const;
    bool has_search() const;
    bool has_havings() const;
    bool has_sorts() const;
    bool has_havings(t_uindex level) const;
    bool has_row_combined() const;
    bool has_column_combined() const;
    t_uindex get_combined_index() const;

    const std::vector<t_fterm>& get_fterms() const;
    const std::vector<t_fterm>& get_previous_fterms() const;
    const std::vector<t_fterm>& get_hterms() const;
    const std::vector<t_fterm> get_hterms(t_depth level) const;
    const std::vector<t_fterm> get_top_n_filters() const;
    const std::vector<t_fterm> get_top_n_filters(const std::string& colname) const;
    const std::map<std::string, t_period_type> get_period_types() const;
    const t_period_type get_period_type(std::string colname) const;
    const t_paginationspec get_paginationspec() const;
    const std::map<t_depth, bool> get_subtotal_map_by_type(t_pivot_type pivot_type = PIVOT_TYPE_ROW) const;

    const std::vector<t_sterm>& get_sterms() const;
    t_search_info get_sinfo() const;
    t_combined_field get_combined_field() const;

    t_totals get_totals() const;

    t_filter_op get_combiner() const;

    bool handle_nan_sort() const;

    const std::string& get_parent_pkey_column() const;

    const std::string& get_child_pkey_column() const;

    const std::string& get_grouping_label_column() const;

    t_index get_max_rows() const;

    t_index get_max_columns() const;

    t_pivot_view_mode get_pivot_view_mode() const;
    
    t_show_type get_show_type(std::string col) const;

    bool is_pivot_view_flat_mode() const;

    t_config_recipe get_recipe() const;

    std::string unity_get_column_name(t_uindex idx) const;
    std::string unity_get_column_display_name(t_uindex idx) const;
    t_fmode get_fmode() const;

    inline const std::string&
    get_grand_agg_str() const {
        return m_grand_agg_str;
    }

    void set_percentage_store();

    void set_num_trees(t_uindex num_trees);

    void set_current_tree_idx(t_uindex tree_idx);

    void reset_percentage_for_new_tree();

    void calculate_query_percentage();

    void update_query_percentage_store(t_query_percent_type percent_type, std::int32_t percentage);

    void query_percentage_callback() const;

    std::int32_t get_current_percentage() const;

    void set_current_percentage(std::int32_t percentage);

    void update_cancel_query_status();

    bool get_cancel_query_status() const;

    void update_column_name(const std::string& old_name, const std::string& new_name);

    void update_show_type(const std::string& col_name, t_show_type show_type);

    void update_pagination_setting(t_index page_items, t_index page_num);

    #ifdef PSP_ENABLE_WASM
    void set_update_query_percentage(emscripten::val update_query_percentage);
    void set_cancel_access(emscripten::val cancel_access);
    #endif

    void update_data_format(const std::string& col_name, t_dataformattype df_type);

    void update_data_formats(const std::vector<t_data_format_spec>& data_formats);

protected:
    void populate_sortby(const std::vector<t_pivot>& pivots);

private:
    std::vector<t_pivot> m_row_pivots;
    std::vector<t_pivot> m_col_pivots;
    bool m_column_only;
    std::map<std::string, std::string> m_sortby;
    std::vector<t_sortspec> m_sortspecs;
    std::vector<t_sortspec> m_col_sortspecs;
    std::vector<t_aggspec> m_aggregates;
    std::vector<t_searchspec> m_search_types;
    std::vector<t_data_format_spec> m_data_formats;
    std::vector<std::string> m_detail_columns;
    t_totals m_totals;
    std::map<std::string, t_index> m_detail_colmap;
    bool m_has_pkey_agg;
    // t_uindex m_row_expand_depth;
    // t_uindex m_col_expand_depth;
    t_filter_op m_combiner;
    std::vector<t_fterm> m_fterms;
    std::vector<t_fterm> m_previous_fterms;
    std::vector<t_sterm> m_sterms;
    t_search_info m_sinfo;
    bool m_handle_nan_sort;
    std::string m_parent_pkey_column;
    std::string m_child_pkey_column;
    std::string m_grouping_label_column;
    t_fmode m_fmode;
    std::vector<std::string> m_filter_exprs;
    std::string m_grand_agg_str;
    std::vector<t_computedspec> m_computedspecs;    // should be removed
    std::vector<t_computed_column_definition> m_computed_columns;
    std::map<std::string, std::string> m_col_map;
    std::vector<t_pivot_info> m_pivot_info;
    std::vector<t_fterm> m_hterms;
    t_combined_field m_combined_field;
    t_index m_max_rows;
    t_index m_max_columns;
    t_pivot_view_mode m_pivot_view_mode;
    std::map<std::string, t_show_type> m_show_types;
    std::map<std::string, t_period_type> m_period_types;
    t_paginationspec m_paginationspec;
    t_query_percentage m_percentage_store;
    std::int32_t m_current_percentage = 0;
    bool m_is_cancel_query = false;
    clock_t m_start_time;
    #ifdef PSP_ENABLE_WASM
    emscripten::val m_update_query_percentage = emscripten::val::null();
    emscripten::val m_cancel_access = emscripten::val::null();
    #endif
};

} // end namespace perspective
