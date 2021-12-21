/******************************************************************************
 *
 * Copyright (c) 2019, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#pragma once
#include <perspective/first.h>
#include <perspective/exports.h>
#include <perspective/base.h>
#include <perspective/raw_types.h>
#include <perspective/gnode.h>
#include <perspective/pool.h>
#include <perspective/config.h>
#include <perspective/context_zero.h>
#include <perspective/context_one.h>
#include <perspective/context_two.h>
#include <perspective/data_slice.h>
#include <cstddef>
#include <memory>
#include <map>

namespace perspective {

template <typename CTX_T>
class PERSPECTIVE_EXPORT View {
public:
    View(t_pool* pool, const std::shared_ptr<CTX_T> &ctx, const std::shared_ptr<t_gnode> &gnode,
        const std::string &name, const std::string &separator, const t_config &config);

    ~View();

    /**
     * @brief The number of pivoted sides of this View.
     *
     * @return std::int32_t
     */
    std::int32_t sides() const;

    /**
     * @brief The number of aggregated rows in this View. This is affected by
     * the "row_pivot" configuration parameter supplied to this View's
     * contructor.
     *
     *
     * @return std::int32_t the number of aggregated rows
     */
    std::int32_t num_rows() const;

    /**
     * @brief The number of aggregated columns in this View. This is affected by
     * the "column_pivot" configuration parameter supplied to this View's
     * contructor.
     *
     *
     * @return std::int32_t the number of aggregated columns
     */
    std::int32_t num_columns() const;

    /**
     * @brief The schema of this View.  A schema is an std::map, the keys of which
     * are the columns of this View, and the values are their string type names.
     * If this View is aggregated, theses will be the aggregated types;
     * otherwise these types will be the same as the columns in the underlying
     * Table.
     *
     * @return std::map<std::string, std::string>
     */
    std::map<std::string, std::string> schema() const;

    std::map<std::string, std::string> schema_with_range(t_uindex start_col, t_uindex end_col) const;

    std::map<std::string, std::string> agg_custom_schema() const;

    /**
     * @brief The column names of this View. If the View is aggregated, the
     * individual column names will be joined with a separator character
     * specified by the user, or defaulting to "|".
     *
     * @return std::vector<std::vector<t_tscalar>>
     */
    std::vector<std::vector<t_tscalar>> column_names(
        bool skip = false, std::int32_t depth = 0, bool from_schema=false, bool subtotal = false) const;

    std::vector<std::vector<t_tscalar>> column_names_with_range(
        bool skip, std::int32_t depth, bool from_schema, bool subtotal, t_uindex startcol, t_uindex endcol) const;


    std::vector<std::vector<t_tscalar>> all_column_names() const;

    /**
     * @brief Returns shared pointer to a t_data_slice object, which contains the
     * underlying slice of data as well as the metadata required to interface
     * with it.
     *
     * @tparam
     * @param start_row
     * @param end_row
     * @param start_col
     * @param end_col
     * @return std::shared_ptr<t_data_slice<t_ctx0>>
     */
    std::shared_ptr<t_data_slice<CTX_T>> get_data(
        t_uindex start_row, t_uindex end_row, t_uindex start_col, t_uindex end_col,
        const std::map<std::uint32_t, std::uint32_t> &idx_map);

    /**
     * @brief Returns std map, which contains the
     * summarize of selection area like: SUM, COUNT, AVG
     *
     * @tparam
     * @param start_row
     * @param end_row
     * @param start_col
     * @param end_col
     * @return std::shared_ptr<t_data_slice<t_ctx0>>
     */
    std::map<std::string, double> get_selection_summarize(std::vector<t_selection_info> selections);

    // Delta calculation
    bool _get_deltas_enabled() const;
    void _set_deltas_enabled(bool enabled_state);

    // Pivot table operations

    /**
     * @brief Whether the row at "ridx" is expanded or collapsed.
     *
     * @param ridx
     * @return std::int32_t
     */
    std::int32_t get_row_expanded(std::int32_t ridx) const;

    /**
     * @brief Expands the row at "ridx".
     *
     * @param ridx
     * @param row_pivot_length
     * @return t_index
     */
    t_index expand(std::int32_t ridx, std::int32_t row_pivot_length);

    /**
     * @brief Collapses the row at "ridx".
     *
     * @param ridx
     * @return t_index
     */
    t_index collapse(std::int32_t ridx);

    /**
     * @brief Set the expansion "depth" of the pivot tree.
     *
     * @param depth
     * @param row_pivot_length
     */
    void set_depth(std::int32_t depth, std::int32_t row_pivot_length);

    /**
     * @brief Enable internal cache to speed up some calculations. 
     */
    void enable_cache();

    /**
     * @brief Disable internal cache and clear all cached data. 
     */ 
    void disable_cache();

    // Getters
    std::shared_ptr<CTX_T> get_context() const;
    const std::vector<std::string>& get_row_pivots() const;
    const std::vector<std::string>& get_column_pivots() const;
    const std::vector<t_aggspec>& get_aggregates() const;
    const std::vector<t_fterm>& get_filters() const;
    const std::vector<t_sortspec>& get_sorts() const;
    const std::vector<t_data_format_spec>& get_data_formats() const;
    std::vector<t_tscalar> get_row_path(t_uindex idx) const;
    t_stepdelta get_step_delta(t_index bidx, t_index eidx) const;
    t_rowdelta get_row_delta(t_index bidx, t_index eidx) const;
    bool is_column_only() const;
    const std::map<std::string, std::string>& get_dname_mapping() const;
    const std::map<std::string, std::string>& set_dname_mapping(const std::string& colname, const std::string& dname);
    const std::map<std::string, std::string>& clear_dname_mapping(const std::string& colname);
    const std::map<std::string, std::string>& update_dname_mapping(const std::string& current_name, const std::string& new_name);
    void update_data_format(const std::string& name, const std::string& data_format);
    void update_data_formats(const std::vector<std::string>& names, const std::vector<std::string>& formats);
    void update_show_type(const std::string& col_name, const std::string& show_type);
    const std::map<std::string, std::string>& update_column_name(const std::string& old_name, const std::string& new_name);
    void update_pagination_setting(t_index page_items, t_index page_num);
    void create_suggestion_column(const std::string& name, const std::string& agg_level, const t_binning_info binning_info,
        const std::string& data_format, const std::string& search_term, t_index limit);
    t_index get_suggestion_size() const;
    std::vector<t_tscalar> get_suggestion_value(t_index start_row, t_index end_row) const;
    void reset_suggestion_column();
    bool has_row_path() const;
    std::map<std::string, std::string> longest_text_cols() const;
    std::map<std::string, double> get_default_binning(const std::string& colname) const;
    std::map<std::string, t_uindex> get_truncated_columns() const;

private:
    std::string _map_aggregate_types(
        const std::string& name, const std::string& typestring) const;

    void _schema(const std::vector<std::vector<t_tscalar>> &cols, std::map<std::string, std::string> &out) const;

    t_pool* m_pool;
    std::shared_ptr<CTX_T> m_ctx;
    std::shared_ptr<t_gnode> m_gnode;
    std::shared_ptr<t_column> m_suggestion_col;
    std::string m_name;
    std::string m_separator;

    std::vector<std::string> m_row_pivots;
    std::vector<std::string> m_column_pivots;
    std::vector<t_aggspec> m_aggregates;
    std::vector<t_fterm> m_filters;
    std::vector<t_sortspec> m_sorts;
    std::vector<t_data_format_spec> m_dftypes;
    std::map<std::string, std::string> m_show_type_names;
    bool m_column_only;
    t_uindex m_row_offset;
    t_uindex m_col_offset;

    t_config m_config;

    struct Cache {
        bool m_is_enabled = false;
        std::map<std::tuple<bool, std::int32_t, bool, bool>,std::vector<std::vector<t_tscalar>>> m_column_names_cache;
    } mutable m_cache;
};
} // end namespace perspective