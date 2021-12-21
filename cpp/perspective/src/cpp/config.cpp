/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/config.h>

namespace perspective {

bool
t_pivot_info::operator==(const t_pivot_info& rhs) const {
    return colname == rhs.colname && pivot_type == rhs.pivot_type && index == rhs.index;
}

t_config_recipe::t_config_recipe()
    : m_child_pkey_column("psp_pkey") {}

t_config::t_config() {
    m_start_time = clock();
}

t_config::t_config(const t_config_recipe& r)
    : m_detail_columns(r.m_detail_columns)
    , m_totals(r.m_totals)
    , m_combiner(r.m_combiner)
    , m_handle_nan_sort(r.m_handle_nan_sort)
    , m_parent_pkey_column(r.m_parent_pkey_column)
    , m_child_pkey_column(r.m_child_pkey_column)
    , m_grouping_label_column(r.m_grouping_label_column)
    , m_fmode(r.m_fmode)
    , m_filter_exprs(r.m_filter_exprs)
    , m_sinfo(r.m_sinfo)
    , m_col_map(r.m_col_map)
    , m_pivot_info(r.m_pivot_info)
    , m_max_rows(r.m_max_rows)
    , m_max_columns(r.m_max_columns)
    , m_pivot_view_mode(r.m_pivot_view_mode)
    , m_show_types(r.m_show_types)
    , m_period_types(r.m_period_types)
{
    m_start_time = clock();
    for (const auto& v : r.m_row_pivots) {
        m_row_pivots.push_back(t_pivot(v));
    }

    for (const auto& v : r.m_col_pivots) {
        m_col_pivots.push_back(t_pivot(v));
    }

    for (const auto& v : r.m_aggregates) {
        m_aggregates.push_back(t_aggspec(v));
    }

    for (const auto& v : r.m_search_types) {
        m_search_types.push_back(t_searchspec(v));
    }

    for (const auto& v : r.m_data_formats) {
        m_data_formats.push_back(t_data_format_spec(v));
    }

    if (m_fmode == FMODE_SIMPLE_CLAUSES) {
        for (const auto& v : r.m_fterms) {
            m_fterms.push_back(t_fterm(v));
        }

        for (const auto& v : r.m_previous_fterms) {
            m_previous_fterms.push_back(t_fterm(v));
        }
    }

    for (const auto& v : r.m_hterms) {
        m_hterms.push_back(t_fterm(v));
    }

    for (const auto& v : r.m_sterms) {
        m_sterms.push_back(v);
    }

    // should be removed
    for (const auto& v : r.m_computedspecs) {
        m_computedspecs.push_back(t_computedspec(v));
    }

    for (const auto& v : r.m_computed_columns) {
        m_computed_columns.push_back(v);
    }

    std::vector<std::string> sort_pivot;
    std::vector<std::string> sort_pivot_by;

    for (const auto& v : r.m_sortby) {
        sort_pivot.push_back(v.first);
        sort_pivot_by.push_back(v.second);
    }

    m_paginationspec = t_paginationspec(r.m_paginationspec);

    setup(m_detail_columns, sort_pivot, sort_pivot_by);
}

t_config::t_config(
    const std::vector<t_pivot>& row_pivots, const std::vector<t_aggspec>& aggregates,
    const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats)
    : m_row_pivots(row_pivots)
    , m_aggregates(aggregates)
    , m_search_types(search_types)
    , m_data_formats(data_formats)
    , m_fmode(FMODE_SIMPLE_CLAUSES) {
    m_start_time = clock();
    setup(m_detail_columns, std::vector<std::string>{}, std::vector<std::string>{});
}

t_config::t_config(const std::vector<t_pivot>& row_pivots,
    const std::vector<t_pivot>& col_pivots, const std::vector<t_aggspec>& aggregates,
    const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats,
    const std::vector<std::string>& detail_columns, const t_totals totals,
    const std::vector<std::string>& sort_pivot, const std::vector<std::string>& sort_pivot_by,
    t_filter_op combiner, const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, bool handle_nan_sort,
    const std::string& parent_pkey_column, const std::string& child_pkey_column,
    const std::string& grouping_label_column, t_fmode fmode,
    const std::vector<std::string>& filter_exprs, const std::string& grand_agg_str)
    : m_row_pivots(row_pivots)
    , m_col_pivots(col_pivots)
    , m_aggregates(aggregates)
    , m_search_types(search_types)
    , m_data_formats(data_formats)
    , m_detail_columns(detail_columns)
    , m_totals(totals)
    , m_combiner(combiner)
    , m_fterms(fterms)
    , m_sterms(sterms)
    , m_handle_nan_sort(handle_nan_sort)
    , m_parent_pkey_column(parent_pkey_column)
    , m_child_pkey_column(child_pkey_column)
    , m_grouping_label_column(grouping_label_column)
    , m_fmode(fmode)
    , m_filter_exprs(filter_exprs)
    , m_grand_agg_str(grand_agg_str) {
    m_start_time = clock();
    setup(detail_columns, sort_pivot, sort_pivot_by);
}

// view config
t_config::t_config(const std::vector<std::string>& row_pivots,
    const std::vector<std::string>& col_pivots, const std::vector<t_aggspec>& aggregates,
    const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats,
    const std::vector<t_sortspec>& sortspecs, const std::vector<t_sortspec>& col_sortspecs,
    t_filter_op combiner, const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms,
    t_search_info sinfo, const std::vector<std::string>& col_names, bool column_only,
    const std::vector<t_computed_column_definition>& computed_columns, const std::map<std::string, std::string> col_map,
    const std::vector<t_pivot_info> pivot_info, const std::vector<t_fterm>& hterms,
    t_combined_field combined_field, t_index max_rows, t_index max_columns, t_pivot_view_mode pivot_view_mode,
    std::map<std::string, t_show_type> show_types, std::vector<t_fterm> previous_fterms, std::map<std::string, t_period_type> period_types,
    t_paginationspec paginationspec)
    : m_column_only(column_only)
    , m_sortspecs(sortspecs)
    , m_col_sortspecs(col_sortspecs)
    , m_aggregates(aggregates)
    , m_search_types(search_types)
    , m_data_formats(data_formats)
    , m_detail_columns(col_names)
    , m_combiner(combiner)
    , m_fterms(fterms)
    , m_previous_fterms(previous_fterms)
    , m_sterms(sterms)
    , m_sinfo(sinfo)
    , m_computed_columns(computed_columns)
    , m_col_map(col_map)
    , m_pivot_info(pivot_info)
    , m_hterms(hterms)
    , m_combined_field(combined_field)
    , m_max_rows(max_rows)
    , m_max_columns(max_columns)
    , m_pivot_view_mode(pivot_view_mode)
    , m_show_types(show_types)
    , m_period_types(period_types)
    , m_paginationspec(paginationspec) {
    m_start_time = clock();
    std::int32_t index = 0;
    std::int32_t name_idx = 0;
    for (const auto& p : row_pivots) {
        auto pivot_item = get_pivot_info(p, PIVOT_TYPE_ROW, index);
        m_row_pivots.push_back(t_pivot(p, pivot_item.agg_level, pivot_item.subtotal, pivot_item.binning, pivot_item.pivot_name));
        index++;
        name_idx++;
    }
    index = 0;
    for (const auto& p : col_pivots) {
        auto pivot_item = get_pivot_info(p, PIVOT_TYPE_COLUMN, index);
        m_col_pivots.push_back(t_pivot(p, pivot_item.agg_level, pivot_item.subtotal, pivot_item.binning, pivot_item.pivot_name));
        index++;
        name_idx++;
    }
};

// grouped_pkeys
t_config::t_config(const std::vector<std::string>& row_pivots,
    const std::vector<std::string>& detail_columns, t_filter_op combiner,
    const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, const std::string& parent_pkey_column,
    const std::string& child_pkey_column, const std::string& grouping_label_column)
    : m_detail_columns(detail_columns)
    , m_combiner(combiner)
    , m_fterms(fterms)
    , m_sterms(sterms)
    , m_handle_nan_sort(true)
    , m_parent_pkey_column(parent_pkey_column)
    , m_child_pkey_column(child_pkey_column)
    , m_grouping_label_column(grouping_label_column)
    , m_fmode(FMODE_SIMPLE_CLAUSES)

{
    m_start_time = clock();
    std::int32_t index = 0;
    for (const auto& p : row_pivots) {
        auto pivot_item = get_pivot_info(p, PIVOT_TYPE_ROW, index);
        m_row_pivots.push_back(t_pivot(p, pivot_item.agg_level, pivot_item.subtotal, pivot_item.binning, pivot_item.pivot_name));
        index++;
    }

    setup(m_detail_columns, std::vector<std::string>{}, std::vector<std::string>{});
}

// ctx2
t_config::t_config(const std::vector<std::string>& row_pivots, const std::vector<std::string>& col_pivots,
    const std::vector<t_aggspec>& aggregates, const std::vector<t_searchspec>& search_types,
    const std::vector<t_data_format_spec>& data_formats)
    //: t_config(row_pivots, col_pivots, aggregates, search_types, data_formats, TOTALS_HIDDEN, FILTER_OP_AND, {}, {})
    : t_config(row_pivots, col_pivots, aggregates, search_types, data_formats, TOTALS_AFTER, FILTER_OP_AND, {}, {})

{}

t_config::t_config(const std::vector<t_pivot>& row_pivots,
    const std::vector<t_pivot>& col_pivots, const std::vector<t_aggspec>& aggregates,
    const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats,
    const t_totals totals, t_filter_op combiner, const std::vector<t_fterm>& fterms,
    const std::vector<t_sterm>& sterms, t_search_info sinfo, bool column_only, const std::vector<t_computed_column_definition>& computed_columns,
    const std::vector<t_sortspec> sortspecs, const std::vector<t_sortspec> col_sortspecs,
    const std::map<std::string, std::string> col_map, const std::vector<t_pivot_info> pivot_info,
    const std::vector<t_fterm>& hterms, t_combined_field combined_field, t_index max_rows, t_index max_columns,
    t_pivot_view_mode pivot_view_mode, std::map<std::string, t_show_type> show_types, std::vector<t_fterm> previous_fterms,
    std::map<std::string, t_period_type> period_types, t_paginationspec paginationspec)
    : m_row_pivots(row_pivots)
    , m_col_pivots(col_pivots)
    , m_column_only(column_only)
    , m_sortspecs(sortspecs)
    , m_col_sortspecs(col_sortspecs)
    , m_aggregates(aggregates)
    , m_search_types(search_types)
    , m_data_formats(data_formats)
    , m_totals(totals)
    , m_combiner(combiner)
    , m_fterms(fterms)
    , m_previous_fterms(previous_fterms)
    , m_sterms(sterms)
    , m_sinfo(sinfo)
    , m_computed_columns(computed_columns)
    , m_col_map(col_map)
    , m_pivot_info(pivot_info)
    , m_hterms(hterms)
    , m_handle_nan_sort(true)
    , m_fmode(FMODE_SIMPLE_CLAUSES)
    , m_combined_field(combined_field)
    , m_max_rows(max_rows)
    , m_max_columns(max_columns)
    , m_pivot_view_mode(pivot_view_mode)
    , m_show_types(show_types)
    , m_period_types(period_types)
    , m_paginationspec(paginationspec) {
    m_start_time = clock();
    setup(m_detail_columns, std::vector<std::string>{}, std::vector<std::string>{});
}

t_config::t_config(const std::vector<std::string>& row_pivots,
    const std::vector<std::string>& col_pivots, const std::vector<t_aggspec>& aggregates,
    const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats,
    const t_totals totals, t_filter_op combiner, const std::vector<t_fterm>& fterms,
    const std::vector<t_sterm>& sterms)
    : m_aggregates(aggregates)
    , m_search_types(search_types)
    , m_data_formats(data_formats)
    , m_totals(totals)
    , m_combiner(combiner)
    , m_fterms(fterms)
    , m_sterms(sterms)
    , m_handle_nan_sort(true)
    , m_fmode(FMODE_SIMPLE_CLAUSES) {
    m_start_time = clock();
    std::int32_t index = 0;
    std::int32_t name_idx = 0;
    for (const auto& p : row_pivots) {
        auto pivot_item = get_pivot_info(p, PIVOT_TYPE_ROW, index);
        m_row_pivots.push_back(t_pivot(p, pivot_item.agg_level, pivot_item.subtotal, pivot_item.binning, pivot_item.pivot_name));
        index++;
        name_idx++;
    }

    index = 0;
    for (const auto& p : col_pivots) {
        auto pivot_item = get_pivot_info(p, PIVOT_TYPE_COLUMN, index);
        m_col_pivots.push_back(t_pivot(p, pivot_item.agg_level, pivot_item.subtotal, pivot_item.binning, pivot_item.pivot_name));
        index++;
        name_idx++;
    }

    setup(m_detail_columns, std::vector<std::string>{}, std::vector<std::string>{});
}

// t_ctx1
t_config::t_config(
    const std::vector<std::string>& row_pivots, const std::vector<t_aggspec>& aggregates,
    const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats)
    : m_aggregates(aggregates)
    , m_search_types(search_types)
    , m_data_formats(data_formats)
    , m_totals(TOTALS_BEFORE)
    , m_combiner(FILTER_OP_AND)
    , m_handle_nan_sort(true)
    , m_fmode(FMODE_SIMPLE_CLAUSES) {
    m_start_time = clock();
    std::int32_t index = 0;
    for (const auto& p : row_pivots) {
        auto pivot_item = get_pivot_info(p, PIVOT_TYPE_ROW, index);
        m_row_pivots.push_back(t_pivot(p, pivot_item.agg_level, pivot_item.subtotal, pivot_item.binning, pivot_item.pivot_name));
        index++;
    }

    setup(m_detail_columns, std::vector<std::string>{}, std::vector<std::string>{});
}

t_config::t_config(const std::vector<std::string>& row_pivots, const t_aggspec& agg)
    : m_aggregates(std::vector<t_aggspec>{agg})
    , m_totals(TOTALS_BEFORE)
    , m_combiner(FILTER_OP_AND)
    , m_handle_nan_sort(true)
    , m_fmode(FMODE_SIMPLE_CLAUSES) {
    m_start_time = clock();
    std::int32_t index = 0;
    for (const auto& p : row_pivots) {
        auto pivot_item = get_pivot_info(p, PIVOT_TYPE_ROW, index);
        m_row_pivots.push_back(t_pivot(p, pivot_item.agg_level, pivot_item.subtotal, pivot_item.binning, pivot_item.pivot_name));
        index++;
    }

    setup(m_detail_columns, std::vector<std::string>{}, std::vector<std::string>{});
}

t_config::t_config(const std::vector<t_pivot>& row_pivots,
    const std::vector<t_aggspec>& aggregates, const std::vector<t_searchspec>& search_types,
    const std::vector<t_data_format_spec>& data_formats, t_filter_op combiner,
    const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, t_search_info sinfo,
    const std::vector<t_computed_column_definition>& computed_columns, std::vector<t_sortspec> sortspecs,
    const std::map<std::string, std::string> col_map, const std::vector<t_pivot_info> pivot_info,
    const std::vector<t_fterm>& hterms, t_combined_field combined_field, t_index max_rows, t_index max_columns,
    t_pivot_view_mode pivot_view_mode, std::map<std::string, t_show_type> show_types, std::vector<t_fterm> previous_fterms,
    std::map<std::string, t_period_type> period_types, t_paginationspec paginationspec)
    : m_row_pivots(row_pivots)
    , m_sortspecs(sortspecs)
    , m_aggregates(aggregates)
    , m_search_types(search_types)
    , m_data_formats(data_formats)
    , m_totals(TOTALS_BEFORE)
    , m_combiner(combiner)
    , m_fterms(fterms)
    , m_previous_fterms(previous_fterms)
    , m_sterms(sterms)
    , m_sinfo(sinfo)
    , m_handle_nan_sort(true)
    , m_fmode(FMODE_SIMPLE_CLAUSES)
    , m_computed_columns(computed_columns)
    , m_col_map(col_map)
    , m_pivot_info(pivot_info)
    , m_hterms(hterms)
    , m_combined_field(combined_field)
    , m_max_rows(max_rows)
    , m_max_columns(max_columns)
    , m_pivot_view_mode(pivot_view_mode)
    , m_show_types(show_types)
    , m_period_types(period_types)
    , m_paginationspec(paginationspec) {
    m_start_time = clock();
    setup(m_detail_columns, std::vector<std::string>{}, std::vector<std::string>{});
}

t_config::t_config(const std::vector<std::string>& row_pivots,
    const std::vector<t_aggspec>& aggregates, const std::vector<t_searchspec>& search_types,
    const std::vector<t_data_format_spec>& data_formats, t_filter_op combiner,
    const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms,
    const std::vector<t_computed_column_definition>& computed_columns, const std::map<std::string, std::string> col_map,
    const std::vector<t_pivot_info> pivot_info)
    : m_aggregates(aggregates)
    , m_search_types(search_types)
    , m_data_formats(data_formats)
    , m_totals(TOTALS_BEFORE)
    , m_combiner(combiner)
    , m_fterms(fterms)
    , m_sterms(sterms)
    , m_handle_nan_sort(true)
    , m_fmode(FMODE_SIMPLE_CLAUSES)
    , m_computed_columns(computed_columns)
    , m_col_map(col_map)
    , m_pivot_info(pivot_info) {
    m_start_time = clock();
    std::int32_t index = 0;
    for (const auto& p : row_pivots) {
        auto pivot_item = get_pivot_info(p, PIVOT_TYPE_ROW, index);
        m_row_pivots.push_back(t_pivot(p, pivot_item.agg_level, pivot_item.subtotal, pivot_item.binning, pivot_item.pivot_name));
        index++;
    }

    setup(m_detail_columns, std::vector<std::string>{}, std::vector<std::string>{});
}

// t_ctx0
t_config::t_config(const std::vector<std::string>& detail_columns)
    : t_config(detail_columns, FILTER_OP_AND, {}, {}, t_search_info(), std::vector<t_searchspec>{}, {}, {}) {}

t_config::t_config(const std::vector<std::string>& detail_columns, t_filter_op combiner,
    const std::vector<t_fterm>& fterms, const std::vector<t_sterm>& sterms, t_search_info sinfo,
    const std::vector<t_searchspec>& search_types, const std::vector<t_data_format_spec>& data_formats,
    const std::vector<t_computed_column_definition>& computed_columns,
    const std::map<std::string, std::string> col_map, t_index max_rows, t_index max_columns,
    t_paginationspec paginationspec)
    : m_search_types(search_types)
    , m_data_formats(data_formats)
    , m_detail_columns(detail_columns)
    , m_combiner(combiner)
    , m_fterms(fterms)
    , m_sterms(sterms)
    , m_sinfo(sinfo)
    , m_fmode(FMODE_SIMPLE_CLAUSES)
    , m_col_map(col_map)
    , m_max_rows(max_rows)
    , m_max_columns(max_columns)
    , m_computed_columns(computed_columns)
    , m_paginationspec(paginationspec) {}

void
t_config::setup(const std::vector<std::string>& detail_columns,
    const std::vector<std::string>& sort_pivot, const std::vector<std::string>& sort_pivot_by) {
    t_index count = 0;
    for (std::vector<std::string>::const_iterator iter = detail_columns.begin();
         iter != detail_columns.end(); ++iter) {
        m_detail_colmap[*iter] = count;
        count++;
    }

    m_has_pkey_agg = false;

    for (std::vector<t_aggspec>::const_iterator iter = m_aggregates.begin();
         iter != m_aggregates.end(); ++iter) {
        switch (iter->agg()) {
            case AGGTYPE_AND:
            case AGGTYPE_OR:
            case AGGTYPE_ANY:
            case AGGTYPE_FIRST:
            case AGGTYPE_LAST:
            case AGGTYPE_MEAN:
            case AGGTYPE_WEIGHTED_MEAN:
            case AGGTYPE_UNIQUE:
            case AGGTYPE_MEDIAN:
            case AGGTYPE_JOIN:
            case AGGTYPE_DOMINANT:
            case AGGTYPE_PY_AGG:
            case AGGTYPE_SUM_NOT_NULL:
            case AGGTYPE_SUM_ABS:
            case AGGTYPE_MUL:
            case AGGTYPE_DISTINCT_COUNT:
            case AGGTYPE_DISTINCT_LEAF:
            case AGGTYPE_CUSTOM:
            case AGGTYPE_DISTINCT_VALUES:
                m_has_pkey_agg = true;
                break;
            default:
                break;
        }

        if (m_has_pkey_agg)
            break;
    }

    for (t_index idx = 0, loop_end = sort_pivot.size(); idx < loop_end; ++idx) {
        m_sortby[sort_pivot[idx]] = sort_pivot_by[idx];
    }

    populate_sortby(m_row_pivots);
    populate_sortby(m_col_pivots);
}

void
t_config::populate_sortby(const std::vector<t_pivot>& pivots) {
    for (t_index idx = 0, loop_end = pivots.size(); idx < loop_end; ++idx) {
        const t_pivot& pivot = pivots[idx];

        PSP_VERBOSE_ASSERT(
            pivot.mode() == PIVOT_MODE_NORMAL, "Only normal pivots supported for now");
        std::string pstr = pivot.colname();
        if (m_sortby.find(pstr) == m_sortby.end())
            m_sortby[pstr] = pstr;
    }
}

t_index
t_config::get_colidx(const std::string& colname) const {
    std::map<std::string, t_index>::const_iterator iter = m_detail_colmap.find(colname);
    if (iter == m_detail_colmap.end()) {
        return INVALID_INDEX;
    } else {
        return iter->second;
    }
}

std::string
t_config::repr() const {
    std::stringstream ss;
    ss << "t_config<" << this << ">";
    return ss.str();
}

t_uindex
t_config::get_num_aggregates() const {
    return m_aggregates.size();
}

t_uindex
t_config::get_num_columns() const {
    return m_detail_columns.size();
}

std::string
t_config::col_at(t_uindex idx) const {
    if (idx >= m_detail_columns.size())
        return "";
    return m_detail_columns[idx];
}

bool
t_config::has_pkey_agg() const {
    return m_has_pkey_agg;
}

std::string
t_config::get_totals_string() const {
    switch (m_totals) {
        case TOTALS_BEFORE: {
            return "before";
        } break;
        case TOTALS_HIDDEN: {
            return "hidden";
        } break;
        case TOTALS_AFTER: {
            return "after";
        } break;
        default: { return "INVALID_TOTALS"; } break;
    }
}

std::string
t_config::get_sort_by(const std::string& pivot) const {
    std::string rval;
    std::map<std::string, std::string>::const_iterator iter = m_sortby.find(pivot);

    if (iter == m_sortby.end()) {
        return pivot;
    } else {
        rval = iter->second;
    }
    return rval;
}

bool
t_config::validate_colidx(t_index idx) const {
    if (idx < 0 || idx >= static_cast<t_index>(get_num_columns()))
        return false;
    return true;
}

const std::vector<std::string>&
t_config::get_column_names() const {
    return m_detail_columns;
}

t_uindex
t_config::get_num_rpivots() const {
    return m_row_pivots.size();
}

t_uindex
t_config::get_num_cpivots() const {
    return m_col_pivots.size();
}

bool
t_config::is_column_only() const {
    return m_column_only;
}

const std::vector<t_pivot>&
t_config::get_row_pivots() const {
    return m_row_pivots;
}

const std::vector<t_pivot>&
t_config::get_column_pivots() const {
    return m_col_pivots;
}

std::vector<std::pair<std::string, std::string>>
t_config::get_sortby_pairs() const {
    std::vector<std::pair<std::string, std::string>> rval(m_sortby.size());
    t_uindex idx = 0;
    for (std::map<std::string, std::string>::const_iterator iter = m_sortby.begin();
         iter != m_sortby.end(); ++iter) {
        rval[idx].first = iter->first;
        rval[idx].second = iter->second;
        ++idx;
    }
    return rval;
}

const std::vector<t_sortspec>&
t_config::get_sortspecs() const {
    return m_sortspecs;
}

const std::vector<t_sortspec>&
t_config::get_col_sortspecs() const {
    return m_col_sortspecs;
}

const std::vector<t_aggspec>&
t_config::get_aggregates() const {
    return m_aggregates;
}

const std::vector<t_searchspec>&
t_config::get_search_types() const {
    return m_search_types;
}

const std::vector<t_data_format_spec>&
t_config::get_data_formats() const {
    return m_data_formats;
}

const std::map<std::string, t_dataformattype>
t_config::get_data_format_map() const {
    std::map<std::string, t_dataformattype> df_map;
    for (const auto& df : m_data_formats) {
        df_map[df.get_name()] = df.get_type();
    }

    return df_map;
}

const std::vector<t_computedspec>&
t_config::get_computedspecs() const {
    return m_computedspecs;
}

const std::vector<t_computed_column_definition>&
t_config::get_computed_columns() const {
    return m_computed_columns;
}

const std::map<std::string, t_show_type>&
t_config::get_show_types() const {
    return m_show_types;
}

const std::map<std::string, std::string>&
t_config::get_col_map() const {
    return m_col_map;
}

const std::vector<t_pivot_info>&
t_config::get_pivot_info_vec() const {
    return m_pivot_info;
}

const t_pivot_info
t_config::get_pivot_info(const std::string colname, t_pivot_type pivot_type, std::int32_t index) const {
    t_pivot_info compare_info{colname, pivot_type, index};
    auto iter = std::find(m_pivot_info.begin(), m_pivot_info.end(), compare_info);
    if (iter == m_pivot_info.end()) {
        compare_info.agg_level = AGG_LEVEL_NONE;
        compare_info.pivot_name = colname;
        compare_info.subtotal = true;
        compare_info.binning = t_binning_info{BINNING_TYPE_NONE};
        return compare_info;
    } else {
        return (*iter);
    }
}

bool
t_config::has_filters() const {
    switch (m_fmode) {
        case FMODE_SIMPLE_CLAUSES: {
            return !m_fterms.empty();
        } break;
        default: { return false; }
    }
    return false;
}

bool
t_config::has_previous_filters() const {
    return !m_previous_fterms.empty();
}

bool
t_config::has_havings() const {
    return !m_hterms.empty();
}

bool
t_config::has_sorts() const {
    return !m_sortspecs.empty();
}

bool
t_config::has_row_combined() const {
    return m_combined_field.m_combined_mode == COMBINED_MODE_ROW
            && m_combined_field.m_combined_index > -1;
}

bool
t_config::has_column_combined() const {
    return m_combined_field.m_combined_mode == COMBINED_MODE_COLUMN
            && m_combined_field.m_combined_index > -1;
}

t_uindex
t_config::get_combined_index() const {
    return m_combined_field.m_combined_index;
}

bool
t_config::has_havings(t_uindex level) const {
    for (t_uindex idx = 0, loop_end = m_hterms.size(); idx < loop_end; ++idx) {
        if (level == m_hterms[idx].get_level()) {
            return true;
        }
    }
    return false;
}

bool
t_config::has_search() const {
    return !m_sterms.empty();
}

const std::vector<t_fterm>&
t_config::get_fterms() const {
    return m_fterms;
}

const std::vector<t_fterm>&
t_config::get_previous_fterms() const {
    return m_previous_fterms;
}

const std::vector<t_fterm>&
t_config::get_hterms() const {
    return m_hterms;
}

const std::vector<t_fterm>
t_config::get_top_n_filters() const {
    std::vector<t_fterm> top_n_filters;
    for (t_index idx = 0, fsize = m_fterms.size(); idx < fsize; ++idx) {
        if (m_fterms[idx].m_op == FILTER_OP_TOP_N) {
            top_n_filters.push_back(t_fterm(m_fterms[idx].get_recipe()));
        }
    }

    return top_n_filters;
}

const std::vector<t_fterm>
t_config::get_top_n_filters(const std::string& colname) const {
    std::vector<t_fterm> top_n_filters;
    for (t_index idx = 0, fsize = m_fterms.size(); idx < fsize; ++idx) {
        if (m_fterms[idx].m_op == FILTER_OP_TOP_N && m_fterms[idx].m_colname == colname) {
            top_n_filters.push_back(t_fterm(m_fterms[idx].get_recipe()));
        }
    }

    for (t_index idx = 0, fsize = m_hterms.size(); idx < fsize; ++idx) {
        if (m_hterms[idx].m_op == FILTER_OP_TOP_N && m_hterms[idx].m_colname == colname) {
            top_n_filters.push_back(t_fterm(m_hterms[idx].get_recipe()));
        }
    }

    return top_n_filters;
}

const std::map<std::string, t_period_type>
t_config::get_period_types() const {
    return m_period_types;
}

const t_period_type
t_config::get_period_type(std::string colname) const {
    auto iter = m_period_types.find(colname);

    if (iter != m_period_types.end()) {
        return iter->second;
    }
    return PERIOD_TYPE_NONE;
}

const t_paginationspec
t_config::get_paginationspec() const {
    return m_paginationspec;
}

const std::map<t_depth, bool>
t_config::get_subtotal_map_by_type(t_pivot_type pivot_type) const {
    std::map<t_depth, bool> subtotal_map;

    subtotal_map[0] = true;
    for(t_uindex idx = 0, rp_size = m_pivot_info.size(); idx < rp_size; ++idx) {
        if (m_pivot_info[idx].pivot_type == pivot_type) {
            subtotal_map[m_pivot_info[idx].index + 1] = m_pivot_info[idx].subtotal;
        }
    }

    return subtotal_map;
}

const std::vector<t_fterm>
t_config::get_hterms(t_depth level) const {
    std::vector<t_fterm> hterms;
    for (t_uindex idx = 0, loop_end = m_hterms.size(); idx < loop_end; ++idx) {
        if (level == m_hterms[idx].get_level()) {
            hterms.push_back(m_hterms[idx]);
        }
    }
    return hterms;
}

const std::vector<t_sterm>&
t_config::get_sterms() const {
    return m_sterms;
}

t_search_info
t_config::get_sinfo() const {
    return m_sinfo;
}

t_combined_field
t_config::get_combined_field() const {
    return m_combined_field;
}

t_filter_op
t_config::get_combiner() const {
    return m_combiner;
}

t_totals
t_config::get_totals() const {
    return m_totals;
}

std::vector<t_pivot>
t_config::get_pivots() const {
    std::vector<t_pivot> rval = m_row_pivots;
    for (const auto& piv : m_col_pivots) {
        rval.push_back(piv);
    }
    return rval;
}

bool
t_config::handle_nan_sort() const {
    return m_handle_nan_sort;
}

const std::string&
t_config::get_parent_pkey_column() const {
    return m_parent_pkey_column;
}

const std::string&
t_config::get_child_pkey_column() const {
    return m_child_pkey_column;
}

const std::string&
t_config::get_grouping_label_column() const {
    return m_grouping_label_column;
}

t_index
t_config::get_max_rows() const {
    return m_max_rows;
}

t_index
t_config::get_max_columns() const {
    return m_max_columns;
}

t_pivot_view_mode
t_config::get_pivot_view_mode() const {
    return m_pivot_view_mode;
}

t_show_type
t_config::get_show_type(std::string col) const {
    auto iter = m_show_types.find(col);
    if (iter != m_show_types.end()) {
        return iter->second;
    }

    return SHOW_TYPE_DEFAULT;
}

void
t_config::update_column_name(const std::string& old_name, const std::string& new_name) {
    std::cout << "-----t_config::update_column_name----" << std::endl;
    // Update for aggregates
    for (auto& aggspec: m_aggregates) {
        if (old_name == aggspec.name()) {
            aggspec.update_column_name(old_name, new_name);
        }
    }

    // Update for data format
    for (auto& df_spec: m_data_formats) {
        if (df_spec.get_name() == old_name) {
            df_spec.update_column_name(old_name, new_name);
        }
    }

    // Update for datail columns
    std::replace(m_detail_columns.begin(), m_detail_columns.end(), old_name, new_name);

    // Update for column map
    auto cm_it = m_col_map.find(old_name);
    if (cm_it != m_col_map.end()) {
        std::swap(m_col_map[new_name], cm_it->second);
        m_col_map.erase(cm_it);
    }

    // Update for show types
    auto st_it = m_show_types.find(old_name);
    if (st_it != m_show_types.end()) {
        std::swap(m_show_types[new_name], st_it->second);
        m_show_types.erase(st_it);
    }

    // Update for period types
    auto pr_it = m_period_types.find(old_name);
    if (pr_it != m_period_types.end()) {
        std::swap(m_period_types[new_name], pr_it->second);
        m_period_types.erase(pr_it);
    }

    // Update for detail column
    auto dc_it = m_detail_colmap.find(old_name);
    if (dc_it != m_detail_colmap.end()) {
         std::swap(m_detail_colmap[new_name], dc_it->second);
        m_detail_colmap.erase(dc_it);
    }
}

void
t_config::update_show_type(const std::string& col_name, t_show_type show_type) {
    m_show_types[col_name] = show_type;
}

void
t_config::update_pagination_setting(t_index page_items, t_index page_num) {
    m_paginationspec = t_paginationspec(page_items, page_num);
}

bool
t_config::is_pivot_view_flat_mode() const {
    return m_pivot_view_mode == PIVOT_VIEW_MODE_FLAT;
}

t_config_recipe
t_config::get_recipe() const {
    t_config_recipe rv;

    for (const auto& p : m_row_pivots) {
        rv.m_row_pivots.push_back(p.get_recipe());
    }

    for (const auto& p : m_col_pivots) {
        rv.m_col_pivots.push_back(p.get_recipe());
    }

    rv.m_sortby = get_sortby_pairs();

    for (const auto& a : m_aggregates) {
        rv.m_aggregates.push_back(a.get_recipe());
    }

    for (const auto& s : m_search_types) {
        rv.m_search_types.push_back(s.get_recipe());
    }

    rv.m_totals = m_totals;
    rv.m_combiner = m_combiner;

    for (const auto& ft : m_fterms) {
        rv.m_fterms.push_back(ft.get_recipe());
    }

    for (const auto& ft : m_previous_fterms) {
        rv.m_previous_fterms.push_back(ft.get_recipe());
    }

    for (const auto& ht: m_hterms) {
        rv.m_hterms.push_back(ht.get_recipe());
    }

    for (const auto& st : m_sterms) {
        rv.m_sterms.push_back(st);
    }

    for (const auto& cs : m_computedspecs) {
        rv.m_computedspecs.push_back(cs.get_recipe());
    }

    for (const auto& cs : m_computed_columns) {
        rv.m_computed_columns.push_back(cs);
    }

    rv.m_handle_nan_sort = m_handle_nan_sort;
    rv.m_parent_pkey_column = m_parent_pkey_column;
    rv.m_child_pkey_column = m_child_pkey_column;
    rv.m_grouping_label_column = m_grouping_label_column;
    rv.m_col_map = m_col_map;
    rv.m_pivot_info = m_pivot_info;
    rv.m_max_rows = m_max_rows;
    rv.m_max_columns = m_max_columns;
    rv.m_pivot_view_mode = m_pivot_view_mode;
    rv.m_show_types = m_show_types;
    rv.m_period_types = m_period_types;
    rv.m_paginationspec = m_paginationspec.get_recipe();
    rv.m_sinfo = m_sinfo;
    return rv;
}

std::string
t_config::unity_get_column_name(t_uindex idx) const {
    if (m_aggregates.empty()) {
        if (idx >= m_detail_columns.size())
            return "";
        return m_detail_columns[idx];
    }

    return m_aggregates[idx % m_aggregates.size()].name();
}

std::string
t_config::unity_get_column_display_name(t_uindex idx) const {
    if (m_aggregates.empty()) {
        if (idx >= m_detail_columns.size())
            return "";
        return m_detail_columns[idx];
    }

    return m_aggregates[idx % m_aggregates.size()].disp_name();
}

t_fmode
t_config::get_fmode() const {
    return m_fmode;
}

void
t_config::set_percentage_store() {
    t_query_percentage percentage_store;
    if (get_num_rpivots() == 0 && get_num_cpivots() == 0) {
        percentage_store.is_traversal_step_end = true;
        percentage_store.is_ctx_step_end = true;
        if (!has_filters() || !has_search()) {
            percentage_store.is_notify = true;
        }
    } else {
        percentage_store.is_agg = true;
    }

    if (has_filters()) {
        percentage_store.is_filter = true;
    }

    if (has_search()) {
        percentage_store.is_search = true;
    }
    m_percentage_store = percentage_store;
}

void
t_config::set_num_trees(t_uindex num_trees) {
    m_percentage_store.num_trees = num_trees;
}

void
t_config::set_current_tree_idx(t_uindex tree_idx) {
    m_percentage_store.curr_tree_idx = tree_idx;
}

void
t_config::reset_percentage_for_new_tree() {
    m_percentage_store.filter_val = 0;
    m_percentage_store.search_val = 0;
    m_percentage_store.agg_check_pivot_val = 0;
    m_percentage_store.agg_update_shape_val = 0;
    m_percentage_store.agg_update_agg_val = 0;
}

void
t_config::calculate_query_percentage() {
    std::int32_t updated_percentage = 0;
    if (!m_percentage_store.is_agg) {
        if (m_percentage_store.is_search && m_percentage_store.is_filter) {
            updated_percentage = (m_percentage_store.search_val * 70/100) + (m_percentage_store.filter_val * 20/100) + 
                (m_percentage_store.ctx_step_end_val * 5/100) + (m_percentage_store.traversal_step_end_val * 5/100);
        } else if (m_percentage_store.is_search) {
            updated_percentage = (m_percentage_store.search_val * 70/100) + (m_percentage_store.notify_val * 10/100) + 
                (m_percentage_store.ctx_step_end_val * 10/100) + (m_percentage_store.traversal_step_end_val * 10/100);
        } else if (m_percentage_store.is_filter) {
            updated_percentage = (m_percentage_store.filter_val * 30/100) + (m_percentage_store.notify_val * 20/100) + 
                (m_percentage_store.ctx_step_end_val * 30/100) + (m_percentage_store.traversal_step_end_val * 20/100);
        } else {
            updated_percentage = (m_percentage_store.notify_val * 20/100) + (m_percentage_store.ctx_step_end_val * 40/100) + 
                (m_percentage_store.traversal_step_end_val * 40/100);
        }
    } else {
        if (m_percentage_store.is_search && m_percentage_store.is_filter) {
            updated_percentage = (m_percentage_store.filter_val * 20/100) + (m_percentage_store.search_val * 40/100) + ((m_percentage_store.agg_check_pivot_val * 20/100) + (m_percentage_store.agg_update_shape_val * 30/100) +
                (m_percentage_store.agg_update_agg_val * 50/100)) * 40/100;
        } else if (m_percentage_store.is_search) {
            updated_percentage = (m_percentage_store.search_val * 50/100) + ((m_percentage_store.agg_check_pivot_val * 20/100) + (m_percentage_store.agg_update_shape_val * 30/100) +
                (m_percentage_store.agg_update_agg_val * 50/100)) * 50/100;
        } else if (m_percentage_store.is_filter) {
            updated_percentage = (m_percentage_store.filter_val * 20/100) + ((m_percentage_store.agg_check_pivot_val * 20/100) + (m_percentage_store.agg_update_shape_val * 30/100) +
                (m_percentage_store.agg_update_agg_val * 50/100)) * 80/100;
        } else {
            updated_percentage = (m_percentage_store.agg_check_pivot_val * 20/100) + (m_percentage_store.agg_update_shape_val * 30/100) +
                (m_percentage_store.agg_update_agg_val * 50/100);
        }
        updated_percentage = (m_percentage_store.curr_tree_idx - 1)*100/m_percentage_store.num_trees + updated_percentage/m_percentage_store.num_trees;
    }
    if (updated_percentage > m_current_percentage) {
        set_current_percentage(updated_percentage);
        query_percentage_callback();
        update_cancel_query_status();
    }
}

void
t_config::update_query_percentage_store(t_query_percent_type percent_type, std::int32_t percentage) {
    switch (percent_type) {
        case QUERY_PERCENT_NOTIFY: {
            m_percentage_store.notify_val = percentage;
        } break;

        case QUERY_PERCENT_TRAVERSAL_STEP_END: {
            m_percentage_store.traversal_step_end_val = percentage;
        } break;

        case QUERY_PERCENT_CTX_STEP_END: {
            m_percentage_store.ctx_step_end_val = percentage;
        } break;

        case QUERY_PERCENT_SEARCH: {
            m_percentage_store.search_val = percentage;
        } break;

        case QUERY_PERCENT_FILTER: {
            m_percentage_store.filter_val = percentage;
        } break;

        case QUERY_PERCENT_CHECK_PIVOT: {
            m_percentage_store.agg_check_pivot_val = percentage;
        } break;

        case QUERY_PERCENT_UPDATE_SHAPE: {
            m_percentage_store.agg_update_shape_val = percentage;
        } break;

        case QUERY_PERCENT_UPDATE_AGG: {
            m_percentage_store.agg_update_agg_val = percentage;
        } break;

        default: {
            PSP_COMPLAIN_AND_ABORT("Undefined percent type.");
        } break;
    }
    calculate_query_percentage();
}

void
t_config::query_percentage_callback() const {
    #ifdef PSP_ENABLE_WASM
    m_update_query_percentage.call<emscripten::val>("call", emscripten::val::object(), m_current_percentage);
    #endif
}

std::int32_t
t_config::get_current_percentage() const {
    return m_current_percentage;
}

void
t_config::set_current_percentage(std::int32_t percentage) {
    m_current_percentage = percentage;
}

void
t_config::update_cancel_query_status() {
    auto diff_time = double(clock() - m_start_time) / CLOCKS_PER_SEC;
    if (!m_is_cancel_query && diff_time >= 2) {
        #ifdef PSP_ENABLE_WASM
        emscripten_sleep(1);
        m_is_cancel_query = m_cancel_access.call<bool>("call");
        #endif
    }
}

bool
t_config::get_cancel_query_status() const {
    return m_is_cancel_query;
}

#ifdef PSP_ENABLE_WASM
void
t_config::set_update_query_percentage(emscripten::val update_query_percentage) {
    m_update_query_percentage = update_query_percentage;
}

void
t_config::set_cancel_access(emscripten::val cancel_access) {
    m_cancel_access = cancel_access;
}
#endif

void
t_config::update_data_format(const std::string &col_name, t_dataformattype df_type) {
    auto value = t_data_format_spec(col_name, df_type);
    std::replace (m_data_formats.begin(), m_data_formats.end(), value, value);
}

void
t_config::update_data_formats(const std::vector<t_data_format_spec> &data_formats) {
    for (const auto &item: data_formats) {
        std::replace (m_data_formats.begin(), m_data_formats.end(), item, item);
    }
}

} // end namespace perspective
