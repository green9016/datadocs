/******************************************************************************
 *
 * Copyright (c) 2019, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */
#pragma once

#if defined(PSP_ENABLE_WASM) || defined(PSP_ENABLE_PYTHON)

#include <perspective/base.h>
#include <perspective/gnode.h>
#include <perspective/table.h>
#include <perspective/pool.h>
#include <perspective/context_zero.h>
#include <perspective/context_one.h>
#include <perspective/context_two.h>
#include <perspective/view.h>
#include <random>
#include <cmath>
#include <sstream>
#include <perspective/sym_table.h>
#include <codecvt>

typedef std::codecvt_utf8<wchar_t> utf8convert_type;
typedef std::codecvt_utf8_utf16<wchar_t> utf16convert_type;

namespace perspective {
namespace binding {

    /******************************************************************************
     *
     * Utility
     */
    template <typename T, typename U>
    std::vector<U> vecFromArray(T& arr);

    template <typename T>
    bool hasValue(T val);

    template <typename T>
    bool _is_one_side_operator(T val);

    template <typename T>
    bool is_number(const std::string& s);

    template <typename T>
    bool is_float(const std::string& s);

    /******************************************************************************
     *
     * Data Loading
     */
    t_index _get_aggregate_index(const std::vector<std::string>& agg_names, std::string name);

    std::vector<std::string> _get_aggregate_names(const std::vector<t_aggspec>& aggs);

    template <typename T>
    std::vector<t_sortspec> _get_sort(
        std::vector<std::string>& col_names,bool is_column_sort, T j_sortby,
        std::vector<std::string>& row_pivots, std::vector<std::string>& column_pivots);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    t_fterm _get_fterm_in(t_schema schema, T j_date_parser, t_dtype col_type, t_agg_level_type agg_level, std::vector<std::string> j_terms,
        t_index level, t_index filterby_index, t_index subtotal_index, t_binning_info binning_info, std::string col, t_filter_op comp);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    std::vector<t_fterm> _get_fterms(t_schema schema, T j_date_parser, T j_filters, std::vector<std::string>& col_names,
        std::vector<std::string>& row_pivots, bool is_having);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template<typename T>
    std::vector<t_fterm> _get_hterms(std::shared_ptr<t_schema> schema, std::vector<t_aggspec> aggregates,
        T j_date_parser, T j_havings, std::map<std::string, std::string> col_map,
        std::vector<std::string>& col_names, std::vector<std::string>& row_pivots);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    std::pair<std::vector<t_sterm>, t_search_info> _get_sterms(
        std::shared_ptr<t_schema> schema, T j_date_parser, T j_searchs);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    std::vector<t_aggspec> _get_aggspecs(
        std::shared_ptr<t_schema> schema, std::string separator, bool column_only, T j_aggs);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    std::vector<t_searchspec> _get_searchspecs(
        std::shared_ptr<t_schema> schema, T j_search_types);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    std::vector<t_data_format_spec> _get_data_format_specs(
        std::shared_ptr<t_schema> schema, T j_data_formats);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    t_formulaspec _get_formulaspec(T js_formula);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    std::vector<t_computed_column_definition> _get_computed_columns(
        std::shared_ptr<t_schema> schema, T j_computed_columns);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    std::map<std::string, std::string> _get_col_map(T j_col_map);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template<typename T>
    std::vector<t_pivot_info> _get_pivot_info(T j_pivot_info);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template<typename T>
    std::map<std::string, t_show_type> _get_show_type(T j_show_type);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template<typename T>
    std::map<std::string, t_period_type> _get_period_type(T j_period_type);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template<typename T>
    t_paginationspec _get_pagination_spec(T j_pagination);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template<typename T>
    t_combined_field _get_combined_field(T j_combined_field);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template<typename T>
    t_binning_info get_binning_info(T j_binning_info);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    void process_rename_columns(std::shared_ptr<t_gnode> gnode, const std::map<std::string, std::string> col_map);

    /**
     * Converts a scalar value to its language-specific representation.
     *
     * Params
     * ------
     * t_tscalar scalar
     *
     * Returns
     * -------
     * T
     */
    template <typename T>
    T scalar_to(const t_tscalar& scalar);

    template <typename T>
    T scalar_vec_to(const std::vector<t_tscalar>& scalars, std::uint32_t idx);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    namespace arrow {

        template <typename T>
        void vecFromTypedArray(const T& typedArray, void* data, std::int32_t length,
            const char* destType = nullptr);

        template <typename T>
        void fill_col_valid(T dcol, std::shared_ptr<t_column> col, t_index cidx, std::shared_ptr<t_column> error_col);

        template <typename T>
        void fill_col_dict(T dictvec, std::shared_ptr<t_column> col);

    } // namespace arrow

    template <typename T>
    void _fill_col_numeric(T accessor, t_table& tbl, std::shared_ptr<t_column> col,
        std::string name, std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update);

    template <typename T>
    void _fill_col_int64(T accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update);

    template <typename T>
    void _fill_col_time(T accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update);

    template <typename T>
    void _fill_col_date(T accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update);

    template <typename T>
    void _fill_col_bool(T accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update);

    template <typename T>
    void _fill_col_string(T accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update);

    /**
     * Fills the column with data from language.
     *
     * Params
     * ------
     * tbl - pointer to the table object
     * ocolnames - vector of column names
     * accessor - the data accessor interface
     * odt - vector of data types
     * offset
     * is_arrow - flag for arrow data
     * name - name of column
     * cidx - index of column
     *
     * Returns
     * -------
     *
     */
    template<typename T>
    void _fill_col_data(t_table& tbl, std::vector<std::string> ocolnames, T accessor,
        std::vector<t_dtype> odt, std::uint32_t offset, bool is_arrow, bool is_update,
        std::string name, t_index cidx, std::shared_ptr<t_column> error_col);

    /**
     * Fills the table with data from language.
     *
     * Params
     * ------
     * tbl - pointer to the table object
     * ocolnames - vector of column names
     * accessor - the data accessor interface
     * odt - vector of data types
     * offset
     * is_arrow - flag for arrow data
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    void _fill_data(t_table& tbl, std::vector<std::string> ocolnames, T accessor,
        std::vector<t_dtype> odt, std::uint32_t offset, bool is_arrow, bool is_update);

    /******************************************************************************
     *
     * Public
     */

    template <typename T>
    void set_column_nth(t_column* col, t_uindex idx, T value);

    /**
     * Helper function for computed columns
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename T>
    void table_add_computed_column(t_table& table, T computed_defs);

    /**
     * DataAccessor
     *
     * parses and converts input data into a canonical format for
     * interfacing with Perspective.
     */

    // Name parsing
    template <typename T>
    std::vector<std::string> column_names(T data, std::int32_t format);

    // Type inferrence for fill_col and data_types
    template <typename T, typename U>
    t_dtype infer_type(T x, U date_validator, U time_validator, U date_time_validator);

    template <typename T, typename U>
    t_dtype get_data_type(T data, std::int32_t format, std::string name, U date_validator, U time_validator, U date_time_validator);

    template <typename T, typename U>
    std::vector<t_dtype> data_types(
        T data, std::int32_t format, std::vector<std::string> names, U date_validator, U time_validator, U date_time_validator);

    /**
     * Create a default gnode.
     *
     * Params
     * ------
     * j_colnames - a JS Array of column names.
     * j_dtypes - a JS Array of column types.
     *
     * Returns
     * -------
     * A gnode.
     */
    std::shared_ptr<t_gnode> make_gnode(const t_schema& iscm);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::vector<t_dataformattype> get_data_format_types_from_dtype(std::vector<t_dtype> dtypes);

    /**
     * Create a populated table.
     *
     * Params
     * ------
     * chunk - a JS object containing parsed data and associated metadata
     * offset
     * limit
     * index
     * is_delete - sets the table operation
     *
     * Returns
     * -------
     * a populated table.
     */
    template <typename T>
    std::shared_ptr<t_gnode> make_table(t_pool* pool, T gnode, T accessor, T computed,
        std::uint32_t offset, std::uint32_t limit, std::string index, bool is_update,
        bool is_delete, bool is_arrow);

    /**
     * Copies the internal table from a gnode
     *
     * Params
     * ------
     *
     * Returns
     * -------
     * A gnode.
     */
    template <typename T>
    std::shared_ptr<t_gnode> clone_gnode_table(
        t_pool* pool, std::shared_ptr<t_gnode> gnode, T computed);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    t_schema create_aggregation_schema(t_schema schema, t_config config);

    /**
     * Creates the configuration object for a new View.
     *
     * Params
     * ------
     *
     * Returns
     * -------
     * A t_config object.
     */
    template <typename T>
    t_config make_view_config(
        std::shared_ptr<t_schema> schema, std::string separator, T date_parser, T config);

    /**
     * Creates a new zero-sided View.
     *
     * Params
     * ------
     *
     * Returns
     * -------
     * A shared pointer to a View<CTX_T>.
     */

    template <typename T>
    void make_view_zero(t_pool* pool, std::shared_ptr<t_gnode> gnode,
        std::string name, std::string separator, T config, T date_parser, T update_query_percentage,
        T enable_query_progress, T cancel_access, T resolve, T reject);

    /**
     * Creates a new one-sided View.
     *
     * Params
     * ------
     *
     * Returns
     * -------
     * A shared pointer to a View<t_ctx1>.
     */

    template <typename T>
    void make_view_one(t_pool* pool, std::shared_ptr<t_gnode> gnode,
        std::string name, std::string separator, T config, T date_parser, T update_query_percentage,
        T enable_query_progress, T cancel_access, T resolve, T reject);

    /**
     * Creates a new two-sided View.
     *
     * Params
     * ------
     *
     * Returns
     * -------
     * A shared pointer to a View<t_ctx2>.
     */

    template <typename T>
    void make_view_two(t_pool* pool, std::shared_ptr<t_gnode> gnode,
        std::string name, std::string separator, T config, T date_parser, T update_query_percentage,
        T enable_query_progress, T cancel_access, T resolve, T reject);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::shared_ptr<t_ctx0> make_context_zero(t_schema schema, t_filter_op combiner, 
        std::vector<std::string> columns, std::vector<t_fterm> filters, std::vector<t_sterm> searchs,
        t_search_info sinfo, std::vector<t_searchspec> search_types, std::vector<t_data_format_spec> data_format,
        std::vector<t_sortspec> sorts, t_pool* pool, std::shared_ptr<t_gnode> gnode, std::string name,
        emscripten::val update_query_percentage, emscripten::val cancel_access, t_index max_rows, t_index max_columns,
        t_paginationspec paginationspec, std::vector<t_computed_column_definition> computed_columns);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::shared_ptr<t_ctx1> make_context_one(t_schema schema, std::vector<t_pivot> pivots,
        t_filter_op combiner, std::vector<t_fterm> filters, std::vector<t_sterm> searchs,
        t_search_info sinfo, std::vector<t_aggspec> aggregates, std::vector<t_searchspec> search_types,
        std::vector<t_data_format_spec> data_formats, std::vector<t_sortspec> sorts,
        std::int32_t pivot_depth, t_pool* pool, std::shared_ptr<t_gnode> gnode, std::string name,
        std::vector<t_computed_column_definition> computed_columns, std::map<std::string, std::string> col_map,
        std::vector<t_pivot_info> pivot_vec, std::vector<t_fterm> havings, t_combined_field combined_field,
        emscripten::val update_query_percentage, emscripten::val cancel_access, t_index max_rows, t_index max_columns,
        t_pivot_view_mode pivot_view_mode, std::map<std::string, t_show_type> show_types, std::vector<t_fterm> previous_filters,
        std::map<std::string, t_period_type> period_types, t_paginationspec paginationspec);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::shared_ptr<t_ctx2> make_context_two(t_schema schema, std::vector<t_pivot> rpivots,
        std::vector<t_pivot> cpivots, t_filter_op combiner, std::vector<t_fterm> filters, std::vector<t_sterm> searchs, t_search_info sinfo,
        std::vector<t_aggspec> aggregates, std::vector<t_searchspec> search_types, std::vector<t_data_format_spec> data_formats,
        std::vector<t_sortspec> sorts, std::vector<t_sortspec> col_sorts, std::int32_t rpivot_depth,
        std::int32_t cpivot_depth, bool column_only, t_pool* pool, std::shared_ptr<t_gnode> gnode, std::string name,
        std::vector<t_computed_column_definition> computed_columns, std::map<std::string, std::string> col_map,
        std::vector<t_pivot_info> pivot_vec, std::vector<t_fterm> havings, t_combined_field combined_field,
        emscripten::val update_query_percentage, emscripten::val cancel_access, t_index max_rows, t_index max_columns,
        t_pivot_view_mode pivot_view_mode, std::map<std::string, t_show_type> show_types, std::vector<t_fterm> previous_filters,
        std::map<std::string, t_period_type> period_types, t_paginationspec paginationspec);

    template <typename T>
    t_schema get_table_computed_schema(
        std::shared_ptr<t_gnode> gnode,
        T j_computed_columns
    );

    std::vector<t_dtype>
    get_computation_input_types(const std::string& computed_function_name);

    template <typename T>
    void sort(std::shared_ptr<t_ctx2> ctx2, T j_sortby);

    template <typename T>
    T get_column_data(std::shared_ptr<t_table> table, std::string colname);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <typename CTX_T, typename T>
    T get_data(std::shared_ptr<View<CTX_T>> view, std::uint32_t start_row,
        std::uint32_t end_row, std::uint32_t start_col, std::uint32_t end_col);

    template <typename T>
    T get_data_two_skip_headers(std::shared_ptr<View<t_ctx2>> view, std::uint32_t depth,
        std::uint32_t start_row, std::uint32_t end_row, std::uint32_t start_col,
        std::uint32_t end_col);

    /**
     * @brief Get the t_data_slice object, which contains an underlying slice of data and
     * metadata required to interact with it.
     *
     * @param view
     * @param start_row
     * @param end_row
     * @param start_col
     * @param end_col
     */
    template <typename CTX_T, typename T>
    std::shared_ptr<t_data_slice<CTX_T>> get_data_slice(std::shared_ptr<View<CTX_T>> view,
        std::uint32_t start_row, std::uint32_t end_row, std::uint32_t start_col,
        std::uint32_t end_col, T list_idx);

    /**
     * @brief Get the summarize for selection object, which contains an underlying slice of data and
     * metadata required to interact with it.
     * @param view
     * @param start_row
     * @param end_row
     * @param start_col
     * @param end_col
    */
    template<typename CTX_T, typename T>
    std::map<std::string, double> get_selection_summarize(std::shared_ptr<View<CTX_T>> view, T selections);

    /**
     * @brief Retrieve a single value from the data slice and serialize it to an output
     * type that interfaces with the binding language.
     *
     * @param view
     * @param start_row
     * @param end_row
     * @param start_col
     * @param end_col
     * @return val
     */
    template <typename CTX_T, typename T>
    T get_from_data_slice(
        std::shared_ptr<t_data_slice<CTX_T>> data_slice, t_uindex ridx, t_uindex cidx, bool full_value, bool include_error);

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    bool predict_slow_query(t_config cfg, std::shared_ptr<t_gnode> gnode);

    std::map<std::string, std::map<std::string, std::string>> get_computed_functions();

} // end namespace binding
} // end namespace perspective

#endif