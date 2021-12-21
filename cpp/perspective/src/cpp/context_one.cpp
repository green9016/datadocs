/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/sort_specification.h>
#include <perspective/get_data_extents.h>
#include <perspective/context_one.h>
#include <perspective/extract_aggregate.h>
#include <perspective/filter.h>
#include <perspective/sparse_tree.h>
#include <perspective/tree_context_common.h>
#include <perspective/logtime.h>
#include <perspective/env_vars.h>
#include <perspective/traversal.h>

namespace perspective {

t_ctx1::t_ctx1(const t_schema& schema, const t_config& pivot_config)
    : t_ctxbase<t_ctx1>(schema, pivot_config)
    , m_depth(0)
    , m_depth_set(false) {}

t_ctx1::~t_ctx1() {}

void
t_ctx1::init() {
    auto pivots = m_config.get_row_pivots();
    m_tree = std::make_shared<t_stree>(pivots, m_config.get_aggregates(), m_schema, m_config);
    m_tree->init();
    m_traversal
        = std::shared_ptr<t_traversal>(new t_traversal(m_tree, m_config.handle_nan_sort()));
    m_minmax = std::vector<t_minmax>(m_config.get_num_aggregates());
    m_traversal_indices = {};
    m_default_binning = {};
    
    m_init = true;
}

t_index
t_ctx1::get_row_count() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    auto row_combined = has_row_combined();
    auto flat_mode = has_pivot_view_flat();
    if (row_combined || flat_mode) {
        if (m_config.get_num_rpivots() == 0 && row_combined) {
            return m_config.get_num_aggregates() + 1;
        } else if (flat_mode && m_config.get_num_rpivots() == 0 && m_config.get_num_cpivots() == 0) {
            return 2;
        }
        return m_traversal_indices.size();
    }
    auto tsize = m_traversal->size();
    return tsize + 1;
}

t_index
t_ctx1::get_column_count() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    if (has_pivot_view_flat()) {
        if (has_row_combined()) {
            return m_config.get_num_rpivots() + std::min(m_config.get_num_aggregates() + 1, static_cast<t_uindex>(2));
        }
        return m_config.get_num_rpivots() + m_config.get_num_aggregates();
    } else {
        if (has_row_combined()) {
            return std::min(m_config.get_num_aggregates() + 1, static_cast<t_uindex>(2));
        }
        return m_config.get_num_aggregates() + 1;
    }
}

t_index
t_ctx1::open(t_header header, t_index idx) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return open(idx);
}

std::string
t_ctx1::repr() const {
    std::stringstream ss;
    ss << "t_ctx1<" << this << ">";
    return ss.str();
}

t_index
t_ctx1::open(t_index idx) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    // If we manually open/close a node, stop automatically expanding
    m_depth_set = false;
    m_depth = 0;

    if (idx >= t_index(m_traversal->size()))
        return 0;

    t_index retval = m_traversal->expand_node(m_sortby, idx);
    m_rows_changed = (retval > 0);
    return retval;
}

t_index
t_ctx1::combined_open(t_index idx) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    if (has_row_combined() || has_pivot_view_flat()) {
        if (idx >= m_traversal_indices.size()) {
            return 0;
        }
        t_indiceinfo nindice = m_traversal_indices[idx];
        auto combined_idx = m_config.get_combined_index();
        if (combined_idx == nindice.m_depth && nindice.m_agg_index != -1 && !nindice.m_show_data) {
            return 0;
        }
        if (!nindice.m_show_data || combined_idx < nindice.m_depth) {
            auto retval = open(nindice.m_idx);
            // Update traversal indices vector
            update_traversal_indices();
            return retval;
        } else {
            return 0;
        }
    } else {
        return open(idx);
    }
}

t_index
t_ctx1::close(t_index idx) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    // If we manually open/close a node, stop automatically expanding
    m_depth_set = false;
    m_depth = 0;

    if (idx >= t_index(m_traversal->size()))
        return 0;

    t_index retval = m_traversal->collapse_node(idx);
    m_rows_changed = (retval > 0);
    return retval;
}

t_index
t_ctx1::combined_close(t_index idx) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    if (has_row_combined() || has_pivot_view_flat()) {
        if (idx >= m_traversal_indices.size()) {
            return 0;
        }
        t_indiceinfo nindice = m_traversal_indices[idx];
        auto combined_idx = m_config.get_combined_index();
        if (combined_idx == nindice.m_depth && nindice.m_agg_index != -1 && !nindice.m_show_data) {
            return 0;
        }
        if (!nindice.m_show_data || combined_idx < nindice.m_depth) {
            auto retval = close(nindice.m_idx);
            // Update traversal indices vector
            update_traversal_indices();
            return retval;
        } else {
            return 0;
        }
    } else {
        return close(idx);
    }
}

std::vector<t_tscalar>
t_ctx1::get_data(t_index start_row, t_index end_row, t_index start_col, t_index end_col,
    std::map<std::uint32_t, std::uint32_t> idx_map) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    bool flat_mode = has_pivot_view_flat();
    bool row_combined = has_row_combined();
    auto subtotal_map = m_config.get_subtotal_map_by_type();
    t_uindex ctx_nrows = get_row_count() + (flat_mode ? 0 : 1);
    t_uindex treesize = m_traversal->size();
    t_uindex ncols = get_column_count();

    // get pagination spec to calculate start row and end row base on page number
    auto paginationspec = m_config.get_paginationspec();
    if (paginationspec.enable_pagination()) {
        auto items_per_page = paginationspec.get_items_per_page();
        auto page_num = paginationspec.get_page_num();

        // New start_row and end_row
        start_row += (page_num - 1) * items_per_page;
        end_row += (page_num - 1) * items_per_page;
    }

    auto ext
        = sanitize_get_data_extents(ctx_nrows, ncols, start_row, end_row, start_col, end_col);

    t_index nrows = ext.m_erow - ext.m_srow;
    t_index stride = ext.m_ecol - ext.m_scol;

    std::vector<t_tscalar> tmpvalues(nrows * ncols);
    std::vector<t_tscalar> values(nrows * stride);

    const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
    std::vector<const t_column*> aggcols(m_config.get_num_aggregates());
    auto aggtable = m_tree->get_aggtable();
    auto running_tbl = m_tree->get_running_table();
    auto none = mknone();
    auto col_size = m_config.get_num_aggregates();
    std::vector<t_show_type> show_type_vec(col_size);
    std::vector<t_tscalar> total_sca_vec(col_size);
    std::map<std::string, t_index> previous_map;
    std::vector<t_index> running_vec;
    auto format_value = [&total_sca_vec, &show_type_vec, none](t_tscalar value, t_index aggidx, t_tscalar pvalue) {
        switch(show_type_vec[aggidx]) {
            case SHOW_TYPE_PARENT_COLUMN:
            case SHOW_TYPE_ROW: {
                if (!value.is_none()) {
                    value.set(100.00);
                    value.m_data_format_type = DATA_FORMAT_PERCENT;
                }
            } break;
            case SHOW_TYPE_COLUMN:
            case SHOW_TYPE_GRAND_TOTAL:
            case SHOW_TYPE_RUNNING_PERCENT: {
                if (!value.is_none()) {
                    value.set(100*value.to_double()/total_sca_vec[aggidx].to_double());
                    value.m_data_format_type = DATA_FORMAT_PERCENT;
                }
            } break;
            case SHOW_TYPE_PARENT_ROW: {
                if (pvalue.is_none() || !pvalue.is_valid()) {
                    value.set(none);
                } else {
                    value.set(100*value.to_double()/pvalue.to_double());
                    value.m_data_format_type = DATA_FORMAT_PERCENT;
                }
            } break;
            case SHOW_TYPE_DIFF_PREVIOUS_VALUE: {
                if (value.is_none() || !value.is_valid()) {
                    value.set(none);
                } else {
                    if (!pvalue.is_none() && pvalue.is_valid()) {
                        auto v_df = value.m_data_format_type;
                        value.set(value.to_double() - pvalue.to_double());
                        value.m_data_format_type = v_df;
                    }
                }
            } break;
            case SHOW_TYPE_PERCENT_PREVIOUS_VALUE: {
                if (value.is_none() || !value.is_valid()) {
                    value.set(none);
                } else {
                    if (!pvalue.is_none() && pvalue.is_valid()) {
                        value.set(100*value.to_double()/pvalue.to_double());
                        value.m_data_format_type = DATA_FORMAT_PERCENT;
                    } else {
                        value.set(none);
                    }
                }
            } break;
            default: {
                // Default value
            } break;
        }

        return value;
    };

    if (row_combined || (flat_mode && !(m_config.get_num_rpivots() == 0 && m_config.get_num_cpivots() == 0))) {
        for (t_uindex aggidx = 0, loop_end = aggcols.size(); aggidx < loop_end; ++aggidx) {
            show_type_vec[aggidx] = m_config.get_show_type(aggspecs[aggidx].name());
            if (m_config.get_period_type(aggspecs[aggidx].name()) == PERIOD_TYPE_PREVIOUS) {
                previous_map[aggspecs[aggidx].name()] = aggidx;
            }
            if (show_type_vec[aggidx] == SHOW_TYPE_RUNNING_TOTAL || show_type_vec[aggidx] == SHOW_TYPE_RUNNING_PERCENT) {
                aggcols[aggidx] = running_tbl->get_const_column(aggspecs[aggidx].name()).get();
            } else {
                aggcols[aggidx] = aggtable->get_const_column(aggidx).get();
            }
            if (show_type_vec[aggidx] == SHOW_TYPE_COLUMN || show_type_vec[aggidx] == SHOW_TYPE_GRAND_TOTAL
                || show_type_vec[aggidx] == SHOW_TYPE_RUNNING_PERCENT) {
                total_sca_vec[aggidx] = aggcols[aggidx]->get_scalar(0);
            }
        }
        std::map<std::uint32_t, std::uint32_t> cols_idx;
        for (t_index cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
            cols_idx[cidx] = idx_map.find(cidx) == idx_map.end() ? cidx : idx_map[cidx];
        }

        std::vector<std::pair<t_uindex, t_uindex>> cells;
        for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
            for (t_index cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
                cells.push_back(std::pair<t_index, t_index>(ridx, cols_idx[cidx]));
            }
        }

        auto cells_info = resolve_cells(cells);
        auto num_rpivots = m_config.get_num_rpivots() + (row_combined ? 1 : 0);
        std::vector<std::vector<t_tscalar>> row_values;
        if (flat_mode && ext.m_scol < num_rpivots) {
            row_values = get_flat_mode_row_paths(ext.m_srow, ext.m_erow);
        } else if (row_combined && m_config.get_num_rpivots() == 0) {
            for (t_uindex aggidx = ext.m_srow - 1, loop_end = aggspecs.size(); aggidx < loop_end; ++aggidx) {
                std::vector<t_tscalar> r_values = std::vector<t_tscalar>();
                auto aggcol = aggtable->get_const_column(aggidx).get();
                r_values.push_back(get_interned_tscalar(aggcol->get_scalar(0)));
                row_values.push_back(r_values);
            }
        } 
        for (auto ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
            auto r_values = row_values[ridx - ext.m_srow];
            for (auto cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
                auto insert_idx = (ridx - ext.m_srow) * stride + cidx - ext.m_scol;
                if (flat_mode && cidx < num_rpivots) {
                    values[insert_idx].set(r_values[cidx]);
                    continue;
                } else if (row_combined && m_config.get_num_rpivots() == 0) {
                    values[insert_idx].set(r_values[0]);
                    continue;
                }
                const t_cellinfo& cinfo = cells_info[insert_idx];
                if (cinfo.m_idx < 0) {
                    values[insert_idx].set(none);
                } else {
                    auto depth = m_tree->get_depth(cinfo.m_idx);
                    auto is_expanded = m_traversal->get_node_expanded(m_traversal_indices[cinfo.m_ridx].m_idx);
                    if (is_expanded && !subtotal_map[depth]) {
                        values[insert_idx].set(none);
                        continue;
                    }
                    t_index pnidx = m_tree->get_parent_idx(cinfo.m_idx);
                    t_index agg_pridx = pnidx == INVALID_INDEX ? INVALID_INDEX : m_tree->get_aggidx(pnidx);
                    t_tscalar value
                        = extract_aggregate(aggspecs[cinfo.m_agg_index], aggcols[cinfo.m_agg_index],
                            cinfo.m_idx, agg_pridx);
                    t_tscalar pvalue;
                    if (show_type_vec[cinfo.m_agg_index] == SHOW_TYPE_PARENT_ROW && agg_pridx != INVALID_INDEX) {
                        t_index ppnidx = m_tree->get_parent_idx(pnidx);
                        t_index agg_ppridx = ppnidx == INVALID_INDEX ? INVALID_INDEX : m_tree->get_aggidx(ppnidx);
                        pvalue = extract_aggregate(aggspecs[cinfo.m_agg_index], aggcols[cinfo.m_agg_index], agg_pridx, agg_ppridx);
                    } else if (show_type_vec[cinfo.m_agg_index] == SHOW_TYPE_DIFF_PREVIOUS_VALUE || show_type_vec[cinfo.m_agg_index] == SHOW_TYPE_PERCENT_PREVIOUS_VALUE) {
                        auto prev_name = "Previous " + aggspecs[cinfo.m_agg_index].name();
                        if (previous_map.find(prev_name) != previous_map.end()) {
                            pvalue = extract_aggregate(aggspecs[previous_map[prev_name]], aggcols[previous_map[prev_name]], cinfo.m_idx, agg_pridx);
                        } else {
                            pvalue.set(none);
                        }
                    } else {
                        pvalue.set(none);
                    }
                    if (!value.is_valid() && !value.is_error())
                        value.set(none); // todo: fix null handling
                    value = format_value(value, cinfo.m_agg_index, pvalue);
                    values[insert_idx].set(value);
                }
            }
        }
    } else {
        for (t_uindex aggidx = 0, loop_end = aggcols.size(); aggidx < loop_end; ++aggidx) {
            auto updated_aggidx = aggidx + 1;
            auto cidx = idx_map.find(updated_aggidx) == idx_map.end() ? aggidx : idx_map[updated_aggidx] - 1;
            if (m_config.get_period_type(aggspecs[aggidx].name()) == PERIOD_TYPE_PREVIOUS) {
                previous_map[aggspecs[aggidx].name()] = aggidx;
            }
            if (cidx >= col_size) {
                continue;
            }
            show_type_vec[aggidx] = m_config.get_show_type(aggspecs[aggidx].name());
            if (show_type_vec[aggidx] == SHOW_TYPE_RUNNING_TOTAL || show_type_vec[aggidx] == SHOW_TYPE_RUNNING_PERCENT) {
                aggcols[aggidx] = running_tbl->get_const_column(aggspecs[aggidx].name()).get();
            } else {
                aggcols[aggidx] = aggtable->get_const_column(cidx).get();
            }
            if (show_type_vec[aggidx] == SHOW_TYPE_COLUMN || show_type_vec[aggidx] == SHOW_TYPE_GRAND_TOTAL
                || show_type_vec[aggidx] == SHOW_TYPE_RUNNING_PERCENT) {
                total_sca_vec[aggidx] = aggcols[aggidx]->get_scalar(0);
            }
        }
        auto num_rpivots = m_config.get_num_rpivots();

        for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
            t_index new_ridx = ridx;
            if (treesize == (unsigned)ridx) {
                new_ridx = 0;
            }
            t_index nidx = m_traversal->get_tree_index(new_ridx);
            t_index pnidx = m_tree->get_parent_idx(nidx);
            auto depth = m_tree->get_depth(nidx);
            auto is_expanded = m_traversal->get_node_expanded(new_ridx);
            auto is_none = is_expanded && !subtotal_map[depth];

            t_uindex agg_ridx = m_tree->get_aggidx(nidx);
            t_index agg_pridx = pnidx == INVALID_INDEX ? INVALID_INDEX : m_tree->get_aggidx(pnidx);

            t_tscalar tree_value = m_tree->get_value(nidx);
            tmpvalues[(ridx - ext.m_srow) * ncols] = tree_value;

            for (t_index aggidx = 0, loop_end = aggcols.size(); aggidx < loop_end; ++aggidx) {
                t_tscalar value;
                if (is_none) {
                    value.set(none);
                } else {
                    value = extract_aggregate(aggspecs[aggidx], aggcols[aggidx], agg_ridx, agg_pridx);
                    t_tscalar pvalue;
                    if (show_type_vec[aggidx] == SHOW_TYPE_PARENT_ROW && agg_pridx != INVALID_INDEX) {
                        t_index ppnidx = m_tree->get_parent_idx(pnidx);
                        t_index agg_ppridx = ppnidx == INVALID_INDEX ? INVALID_INDEX : m_tree->get_aggidx(ppnidx);
                        pvalue = extract_aggregate(aggspecs[aggidx], aggcols[aggidx], agg_pridx, agg_ppridx);
                    } else if (show_type_vec[aggidx] == SHOW_TYPE_DIFF_PREVIOUS_VALUE || show_type_vec[aggidx] == SHOW_TYPE_PERCENT_PREVIOUS_VALUE) {
                        auto prev_name = "Previous " + aggspecs[aggidx].name();
                        if (previous_map.find(prev_name) != previous_map.end()) {
                            pvalue = extract_aggregate(aggspecs[previous_map[prev_name]], aggcols[previous_map[prev_name]], agg_ridx, agg_pridx);
                        } else {
                            pvalue.set(none);
                        }
                    } else {
                        pvalue.set(none);
                    }
                    if (!value.is_valid() && !value.is_error())
                        value.set(none); // todo: fix null handling
                    
                    value = format_value(value, aggidx, pvalue);
                }
                if (num_rpivots > 0) {
                    tmpvalues[(ridx - ext.m_srow) * ncols + 1 + aggidx].set(value);
                } else {
                    tmpvalues[(ridx - ext.m_srow) * ncols + aggidx].set(value);
                }
            }
        }

        for (auto ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
            for (auto cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
                auto insert_idx = (ridx - ext.m_srow) * stride + cidx - ext.m_scol;
                auto src_idx = (ridx - ext.m_srow) * ncols + cidx;
                values[insert_idx].set(tmpvalues[src_idx]);
            }
        }
    }
    return values;
}

std::map<std::pair<t_uindex, t_uindex>, t_tscalar>
t_ctx1::get_selection_summarize(std::vector<t_selection_info> selections) const {
    bool flat_mode = has_pivot_view_flat();
    t_uindex ctx_nrows = get_row_count();
    t_uindex ncols = get_column_count();

    std::map<std::pair<t_uindex, t_uindex>, t_tscalar> value_map;
    for (t_uindex idx = 0, ssize = selections.size(); idx < ssize; ++idx) {
        auto selection = selections[idx];
        auto ext = sanitize_get_data_extents(
            ctx_nrows, ncols, selection.start_row, selection.end_row + 1, selection.start_col, selection.end_col + 1);
        t_index stride = ext.m_ecol - ext.m_scol;
        auto data = get_data(selection.start_row, selection.end_row + 1, selection.start_col, selection.end_col + 1, selection.index_map);
        for (t_uindex cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
            for (t_uindex ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
                auto v = data[(ridx - ext.m_srow) * stride + (cidx - ext.m_scol)];
                auto vpair = std::pair<std::pair<t_uindex, t_uindex>, t_tscalar>(std::pair<t_uindex, t_uindex>(cidx, ridx), v);
                value_map.insert(vpair);
            }
        }
    }

    return value_map;
}

std::vector<std::vector<t_tscalar>>
t_ctx1::get_flat_mode_row_paths(t_uindex srow, t_uindex erow) const {
    std::vector<std::vector<t_tscalar>> rval;
    t_uindex ctx_nrows = get_row_count();

    // GAB: memory optim: do a first pass to compute the number of elements, to be able to reserve memory
    t_index count = 0;
    for (t_uindex ridx = srow; ridx < erow; ++ridx) {
        if (ridx >= ctx_nrows) {
            continue;
        }
        count++;
    }

    rval.reserve(count);
    for (t_uindex ridx = srow; ridx < erow; ++ridx) {
        if (ridx >= ctx_nrows) {
            continue;
        }
        auto r_paths = unity_get_row_path(ridx);
        std::reverse(r_paths.begin(), r_paths.end());
        std::vector<t_tscalar> updated_r_paths;
        for (t_uindex idx = 0, psize = r_paths.size(); idx < psize; ++idx) {
            if ((r_paths[idx].is_valid() && r_paths[idx].to_string() == std::string(""))
                || (!r_paths[idx].is_valid() && !r_paths[idx].is_error())) {
                updated_r_paths.push_back(get_interned_tscalar("(blank)"));
            } else {
                updated_r_paths.push_back(r_paths[idx]);
            }
        }
        rval.push_back(updated_r_paths);
    }
    return rval;
}

std::vector<t_cellinfo>
t_ctx1::resolve_cells(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const {
    std::vector<t_cellinfo> rval(cells.size());

    t_index n_aggs = m_config.get_num_aggregates();

    t_uindex ncols = unity_get_column_count();
    t_uindex tsize = m_traversal->size();
    t_uindex ctx_nrows = get_row_count();
    bool flat_mode = has_pivot_view_flat();
    bool row_combined = has_row_combined();
    t_uindex num_rpivots = m_config.get_num_rpivots();

    for (t_index idx = 0, loop_end = cells.size(); idx < loop_end; ++idx) {
        const auto& cell = cells[idx];

        t_uindex first_val = cell.first;
        if ((!flat_mode && cell.second == 0) || cell.second > ncols || cell.first >= ctx_nrows
            || (flat_mode && cell.second < num_rpivots)) {
            rval[idx].m_idx = INVALID_INDEX;
            continue;
        }

        t_indiceinfo tvpair = m_traversal_indices[cell.first];
        if (!tvpair.m_show_data) {
            rval[idx].m_idx = INVALID_INDEX;
            continue;
        }
        rval[idx].m_idx = m_traversal->get_tree_index(tvpair.m_idx);
        rval[idx].m_ridx = cell.first;
        rval[idx].m_cidx = cell.second;
        rval[idx].m_treenum = 0;
        rval[idx].m_agg_index = (flat_mode && !row_combined) ? (cell.second - num_rpivots) : tvpair.m_agg_index;
    }
    return rval;
}

void
t_ctx1::update_traversal_indices() {
    m_traversal_indices = {};
    m_traversal->get_row_indices_vector(m_traversal_indices, m_config.get_combined_index(),
        has_row_combined() ? m_config.get_num_aggregates() : 0, m_config.get_subtotal_map_by_type(), has_pivot_view_flat());
}

void
t_ctx1::update_data_format(const std::vector<t_data_format_spec>& data_formats) {
    std::map<std::string, t_dataformattype> df_type_map;
    std::map<t_depth, t_dataformattype> df_depth_map;
    auto name_depth_map = m_tree->get_pivot_map();
    for (t_uindex df_idx = 0, loop_end = data_formats.size(); df_idx < loop_end; ++df_idx) {
        auto data_format = data_formats[df_idx];
        auto df_name = data_format.get_name();
        df_type_map[df_name] = data_format.get_type();
        if (name_depth_map.find(df_name) != name_depth_map.end()) {
            df_depth_map[name_depth_map[df_name]] = data_format.get_type();
        }
    }
    const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
    std::vector<t_data_format_spec> agg_data_formats;
    for (t_uindex idx = 0, loop_end = m_schema.m_columns.size(); idx < loop_end; ++idx) {
        auto colname = m_schema.m_columns[idx];
        if (idx >= aggspecs.size()) {
            break;
        }
        //auto tbl_colname = m_schema.get_tbl_colname(m_schema.m_columns[idx]);
        //auto it = df_type_map.find(tbl_colname);
        auto it = df_type_map.find(colname);
        auto aggspec = aggspecs[idx];
        //if (it != df_type_map.end() && aggspec.can_change_data_format()) {
        if (it != df_type_map.end()) {
            agg_data_formats.push_back(t_data_format_spec(colname, it->second));
        }
    }
    auto aggtable = m_tree->get_aggtable();
    aggtable->update_data_formats(agg_data_formats);

    auto running_tbl = m_tree->get_running_table();
    auto schema = running_tbl->get_schema();
    std::vector<t_data_format_spec> running_data_formats;
    for (t_uindex idx = 0, loop_end = schema.m_columns.size(); idx < loop_end; ++idx) {
        auto colname = schema.m_columns[idx];
        auto it = df_type_map.find(colname);
        if (it != df_type_map.end()) {
            running_data_formats.push_back(t_data_format_spec(colname, it->second));
        }
    }
    running_tbl->update_data_formats(running_data_formats);

    // Update data format for col path
    if (df_depth_map.size() > 0) {
        m_tree->update_data_format_depth(df_depth_map);
    }
}

void
t_ctx1::notify(const t_table& flattened, const t_table& delta, const t_table& prev,
    const t_table& current, const t_table& transitions, const t_table& existed) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    psp_log_time(repr() + " notify.enter");

    // init saved mask
    t_mask saved_msk(flattened.size());
    for (t_index idx = 0, flat_size = flattened.size(); idx < flat_size; ++idx) {
        saved_msk.set(idx, true);
    }

    notify_sparse_tree(m_tree, m_traversal, true, m_config.get_aggregates(),
        m_config.get_sortby_pairs(), m_sortby, m_config.get_hterms(), flattened,
        delta, prev, current, transitions, existed, m_config, *m_state,
        m_default_binning, saved_msk, true);
    psp_log_time(repr() + " notify.exit");
}

void
t_ctx1::step_begin() {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    reset_step_state();
}

void
t_ctx1::step_end() {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    m_minmax = m_tree->get_min_max();
    sort_by(m_sortby);
    if (m_depth_set) {
        set_depth(m_depth);
    }

    // Build running table
    auto aggspecs = get_aggregates();
    for (t_index aggidx = 0, aggsize = aggspecs.size(); aggidx < aggsize; ++aggidx) {
        auto col_name = aggspecs[aggidx].name();
        auto show_type = m_config.get_show_type(col_name);
        build_running_table(col_name, show_type);
    }
}

t_aggspec
t_ctx1::get_aggregate(t_uindex idx) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    if (idx >= m_config.get_num_aggregates())
        return t_aggspec();
    return m_config.get_aggregates()[idx];
}

t_tscalar
t_ctx1::get_aggregate_name(t_uindex idx) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    t_tscalar s;
    if (idx >= m_config.get_num_aggregates())
        return s;
    s.set(m_config.get_aggregates()[idx].name_scalar());
    return s;
}

const std::vector<t_aggspec>&
t_ctx1::get_aggregates() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_config.get_aggregates();
}

std::vector<t_tscalar>
t_ctx1::get_row_path(t_index idx) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    if (idx < 0)
        return std::vector<t_tscalar>();
    return ctx_get_path(m_tree, m_traversal, idx);
}

void
t_ctx1::reset_sortby() {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    m_sortby = std::vector<t_sortspec>();
}

void
t_ctx1::sort_by(const std::vector<t_sortspec>& sortby) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    m_sortby = sortby;
    if (m_sortby.empty()) {
        return;
    }
    m_traversal->sort_by(m_config, sortby, *(m_tree.get()));
}

void
t_ctx1::set_depth(t_depth depth) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    if (m_config.get_num_rpivots() == 0)
        return;
    depth = std::min<t_depth>(m_config.get_num_rpivots() - 1, depth);
    t_index retval = 0;
    retval = m_traversal->set_depth(m_sortby, depth);
    m_rows_changed = (retval > 0);
    m_depth = depth;
    if (has_row_combined() || has_pivot_view_flat()) {
        // Update traversal indices vector
        update_traversal_indices();
    }
    m_depth_set = true;
}

std::vector<t_tscalar>
t_ctx1::get_pkeys(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");

    if (!m_traversal->validate_cells(cells)) {
        std::vector<t_tscalar> rval;
        return rval;
    }

    std::vector<t_tscalar> rval;

    // GAB: memory optim: do a first pass to compute the number of elements, to be able to reserve memory
    t_index count = 0;
    for (const auto& c : cells) {
        auto ptidx = m_traversal->get_tree_index(c.first);
        auto pkeys = m_tree->get_pkeys(ptidx);

        count+=pkeys.size();
    }

    rval.reserve(count);
    for (const auto& c : cells) {
        auto ptidx = m_traversal->get_tree_index(c.first);
        auto pkeys = m_tree->get_pkeys(ptidx);

        rval.insert(std::end(rval), std::begin(pkeys), std::end(pkeys));
    }
    return rval;
}

std::vector<t_tscalar>
t_ctx1::get_cell_data(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    if (!m_traversal->validate_cells(cells)) {
        std::vector<t_tscalar> rval;
        return rval;
    }

    std::vector<t_tscalar> rval(cells.size());
    t_tscalar empty = mknone();

    auto aggtable = m_tree->get_aggtable();
    auto aggcols = aggtable->get_const_columns();
    const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();

    for (t_index idx = 0, loop_end = cells.size(); idx < loop_end; ++idx) {
        const auto& cell = cells[idx];
        if (cell.second == 0) {
            rval[idx].set(empty);
            continue;
        }

        t_index rptidx = m_traversal->get_tree_index(cell.first);
        t_uindex aggidx = cell.second - 1;

        t_index p_rptidx = m_tree->get_parent_idx(rptidx);
        t_uindex agg_ridx = m_tree->get_aggidx(rptidx);
        t_index agg_pridx
            = p_rptidx == INVALID_INDEX ? INVALID_INDEX : m_tree->get_aggidx(p_rptidx);

        rval[idx] = extract_aggregate(aggspecs[aggidx], aggcols[aggidx], agg_ridx, agg_pridx);
    }

    return rval;
}

bool
t_ctx1::get_deltas_enabled() const {
    return m_features[CTX_FEAT_DELTA];
}

void
t_ctx1::set_feature_state(t_ctx_feature feature, bool state) {
    m_features[feature] = state;
}

void
t_ctx1::set_alerts_enabled(bool enabled_state) {
    m_features[CTX_FEAT_ALERT] = enabled_state;
    m_tree->set_alerts_enabled(enabled_state);
}

void
t_ctx1::set_deltas_enabled(bool enabled_state) {
    m_features[CTX_FEAT_DELTA] = enabled_state;
    m_tree->set_deltas_enabled(enabled_state);
}

void
t_ctx1::set_minmax_enabled(bool enabled_state) {
    m_features[CTX_FEAT_MINMAX] = enabled_state;
    m_tree->set_minmax_enabled(enabled_state);
}

const std::vector<t_minmax>&
t_ctx1::get_min_max() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_minmax;
}

/**
 * @brief Returns updated cells.
 *
 * @param bidx
 * @param eidx
 * @return t_stepdelta
 */
t_stepdelta
t_ctx1::get_step_delta(t_index bidx, t_index eidx) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    bidx = std::min(bidx, t_index(m_traversal->size()));
    eidx = std::min(eidx, t_index(m_traversal->size()));

    t_stepdelta rval(m_rows_changed, m_columns_changed, get_cell_delta(bidx, eidx));
    m_tree->clear_deltas();
    return rval;
}

/**
 * @brief Returns the row indices that have been updated with new data.
 *
 * @param bidx
 * @param eidx
 * @return t_rowdelta
 */
t_rowdelta
t_ctx1::get_row_delta(t_index bidx, t_index eidx) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    bidx = std::min(bidx, t_index(m_traversal->size()));
    eidx = std::min(eidx, t_index(m_traversal->size()));
    std::vector<std::int32_t> rows;

    const auto& deltas = m_tree->get_deltas();
    for (t_index idx = bidx; idx < eidx; ++idx) {
        t_index ptidx = m_traversal->get_tree_index(idx);
        // Retrieve delta from storage
        auto iterators = deltas->get<by_tc_nidx_aggidx>().equal_range(ptidx);
        bool unique_ridx = std::find(rows.begin(), rows.end(), idx) == rows.end();
        if ((iterators.first != iterators.second) && unique_ridx)
            rows.push_back(idx);
    }

    std::sort(rows.begin(), rows.end());
    t_rowdelta rval(m_rows_changed, rows);
    m_tree->clear_deltas();
    return rval;
}

std::vector<t_cellupd>
t_ctx1::get_cell_delta(t_index bidx, t_index eidx) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    eidx = std::min(eidx, t_index(m_traversal->size()));
    std::vector<t_cellupd> rval;
    const auto& deltas = m_tree->get_deltas();

    t_index count=0;
    for (t_index idx = bidx; idx < eidx; ++idx) {
        t_index ptidx = m_traversal->get_tree_index(idx);
        auto iterators = deltas->get<by_tc_nidx_aggidx>().equal_range(ptidx);
        for (auto iter = iterators.first; iter != iterators.second; ++iter) {
            count++;
        }
    }

    rval.reserve(count);
    for (t_index idx = bidx; idx < eidx; ++idx) {
        t_index ptidx = m_traversal->get_tree_index(idx);
        auto iterators = deltas->get<by_tc_nidx_aggidx>().equal_range(ptidx);
        for (auto iter = iterators.first; iter != iterators.second; ++iter) {
            rval.push_back(
                t_cellupd(idx, iter->m_aggidx + 1, iter->m_old_value, iter->m_new_value));
        }
    }
    return rval;
}

void
t_ctx1::reset() {
    auto pivots = m_config.get_row_pivots();
    m_tree = std::make_shared<t_stree>(pivots, m_config.get_aggregates(), m_schema, m_config);
    m_tree->init();
    m_tree->set_deltas_enabled(get_feature_state(CTX_FEAT_DELTA));
    m_traversal
        = std::shared_ptr<t_traversal>(new t_traversal(m_tree, m_config.handle_nan_sort()));
}

void
t_ctx1::reset_step_state() {
    m_rows_changed = false;
    m_columns_changed = false;
    if (t_env::log_progress()) {
        std::cout << "t_ctx1.reset_step_state " << repr() << std::endl;
    }
}

t_index
t_ctx1::sidedness() const {
    return 1;
}

std::vector<t_stree*>
t_ctx1::get_trees() {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    std::vector<t_stree*> rval(1);
    rval[0] = m_tree.get();
    return rval;
}

bool
t_ctx1::has_deltas() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_tree->has_deltas();
}

t_minmax
t_ctx1::get_agg_min_max(t_uindex aggidx, t_depth depth) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_tree->get_agg_min_max(aggidx, depth);
}

void
t_ctx1::notify(const t_table& flattened) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    //update_data_formats();

    // init saved mask
    t_mask saved_msk(flattened.size());
    for (t_index idx = 0, flat_size = flattened.size(); idx < flat_size; ++idx) {
        saved_msk.set(idx, true);
    }

    notify_sparse_tree(m_tree, m_traversal, true, m_config.get_aggregates(),
        m_config.get_sortby_pairs(), m_sortby, m_config.get_hterms(), flattened, m_config, *m_state,
        m_default_binning, saved_msk, true);
}

void
t_ctx1::pprint() const {
    std::cout << "\t" << std::endl;
    for (auto idx = 1; idx < get_column_count(); ++idx) {
        std::cout << get_aggregate(idx - 1).agg_str() << ", " << std::endl;
    }

    std::vector<const t_column*> aggcols(m_config.get_num_aggregates());
    auto aggtable = m_tree->get_aggtable();
    t_schema aggschema = aggtable->get_schema();
    auto none = mknone();

    for (t_uindex aggidx = 0, loop_end = aggcols.size(); aggidx < loop_end; ++aggidx) {
        const std::string& aggname = aggschema.m_columns[aggidx];
        aggcols[aggidx] = aggtable->get_const_column(aggname).get();
    }

    const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();

    for (auto ridx = 0; ridx < get_row_count(); ++ridx) {
        t_index nidx = m_traversal->get_tree_index(ridx);
        t_index pnidx = m_tree->get_parent_idx(nidx);

        t_uindex agg_ridx = m_tree->get_aggidx(nidx);
        t_index agg_pridx = pnidx == INVALID_INDEX ? INVALID_INDEX : m_tree->get_aggidx(pnidx);

        std::cout << get_row_path(ridx) << " => ";
        for (t_index aggidx = 0, loop_end = aggcols.size(); aggidx < loop_end; ++aggidx) {
            t_tscalar value
                = extract_aggregate(aggspecs[aggidx], aggcols[aggidx], agg_ridx, agg_pridx);
            if (!value.is_valid())
                value.set(none); // todo: fix null handling

            std::cout << value << ", ";
        }

        std::cout << "\n";
    }

    std::cout << "=================" << std::endl;
}

t_index
t_ctx1::get_row_idx(const std::vector<t_tscalar>& path) const {
    auto nidx = m_tree->resolve_path(0, path);
    if (nidx == INVALID_INDEX) {
        return nidx;
    }

    return m_traversal->get_traversal_index(nidx);
}

t_dtype
t_ctx1::get_column_dtype(t_uindex idx) const {
    if (idx == 0 || idx >= static_cast<t_uindex>(get_column_count()))
        return DTYPE_NONE;
    return m_tree->get_aggtable()->get_const_column(idx - 1)->get_dtype();
}

t_depth
t_ctx1::get_trav_depth(t_index idx) const {
    return m_traversal->get_depth(idx);
}

std::vector<t_tscalar>
t_ctx1::unity_get_row_data(t_uindex idx) const {
    auto rval = get_data(idx, idx + 1, 0, get_column_count(), {});
    if (rval.empty())
        return std::vector<t_tscalar>();

    return std::vector<t_tscalar>(rval.begin() + 1, rval.end());
}

std::vector<t_tscalar>
t_ctx1::unity_get_column_data(t_uindex idx) const {
    PSP_COMPLAIN_AND_ABORT("Not implemented");
    return std::vector<t_tscalar>();
}

std::vector<t_tscalar>
t_ctx1::unity_get_row_path(t_uindex idx) const {
    if (has_row_combined() || has_pivot_view_flat()) {
        // Check for case row number is 0 and has row combined
        auto num_rpivots = m_config.get_num_rpivots();
        auto num_aggs = m_config.get_num_aggregates();
        if (has_row_combined() && num_rpivots == 0 && idx <= num_aggs && idx > 0) {
            const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
            std::vector<t_tscalar> r_paths = std::vector<t_tscalar>();
            r_paths.push_back(get_interned_tscalar(aggspecs[idx - 1].name()));
            return r_paths;
        }
        if (idx >= m_traversal_indices.size()) {
            return std::vector<t_tscalar>();
        }
        t_indiceinfo nindice = m_traversal_indices[idx];
        auto combined_idx = m_config.get_combined_index();
        if (has_pivot_view_flat() && !has_row_combined()) {
            return get_row_path(nindice.m_idx);
        }
        auto tsize = m_traversal->size();
        if (combined_idx < nindice.m_depth) {
            const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
            auto r_paths = get_row_path(nindice.m_idx);
            auto aggname = aggspecs[nindice.m_agg_index].name();
            r_paths.insert(r_paths.begin() + (nindice.m_depth - combined_idx), get_interned_tscalar(aggname));
            return r_paths;
        } else if (combined_idx == nindice.m_depth && nindice.m_agg_index != -1 && !nindice.m_show_data) {
            const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
            auto r_paths = get_row_path(nindice.m_idx);
            auto aggname = aggspecs[nindice.m_agg_index].name();
            r_paths.insert(r_paths.begin(), get_interned_tscalar(aggname));
            return r_paths;
        }
        if (!nindice.m_show_data) {
            return get_row_path(nindice.m_idx);
        } else {
            const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
            auto r_paths = get_row_path(nindice.m_idx);
            auto aggname = aggspecs[nindice.m_agg_index].name();
            if (r_paths.size() == 0) {
                r_paths.push_back(get_interned_tscalar(aggname));
            } else {
                if (m_traversal->get_node_expanded(nindice.m_idx)) {
                    r_paths[0] = get_interned_tscalar(r_paths.begin()->to_string() + " " + aggname);
                } else {
                    r_paths.insert(r_paths.begin(), get_interned_tscalar(aggname));
                }
            }
            return r_paths;
        }
    } else {
        if (idx == t_index(m_traversal->size())) {
            std::vector<t_tscalar> rval;
            rval.push_back(get_interned_tscalar("Total"));
            return rval;
        }
        return get_row_path(idx);
    }
}

std::vector<std::int8_t>
t_ctx1::unity_get_row_path_extra(t_uindex idx) const {
    if (has_row_combined()) {
        // Check for case row number is 0 and has row combined
        auto num_rpivots = m_config.get_num_rpivots();
        auto num_aggs = m_config.get_num_aggregates();
        if (num_rpivots == 0 && idx <= num_aggs && idx > 0) {
            return std::vector<std::int8_t> {true, false};
        }

        if (idx >= m_traversal_indices.size()) {
            return std::vector<std::int8_t> {false, false};
        }
        t_indiceinfo nindice = m_traversal_indices[idx];
        auto combined_idx = m_config.get_combined_index();
        auto tsize = m_traversal->size();
        if (combined_idx < nindice.m_depth) {
            if (m_traversal->get_depth(nindice.m_idx) == m_config.get_num_rpivots() && nindice.m_show_data) {
                return std::vector<std::int8_t> {true, false};
            }
            return std::vector<std::int8_t> {false, false};
        }
        if (!nindice.m_show_data) {
            if ((m_traversal->get_depth(nindice.m_idx) == m_config.get_num_rpivots())
                || (m_traversal->get_depth(nindice.m_idx) == combined_idx && nindice.m_agg_index != -1)) {
                    return std::vector<std::int8_t> {false, false, true};
                }
            return std::vector<std::int8_t> {false, false};
        } else {
            if (m_traversal->get_node_expanded(nindice.m_idx)
                || m_traversal->get_depth(nindice.m_idx) == m_config.get_num_rpivots()) {
                return std::vector<std::int8_t> {true, false};
            } else {
                return std::vector<std::int8_t> {true, true};
            }
        }
    } else {
        if (idx >= m_traversal->size()) {
            return std::vector<std::int8_t> {true, false};
        }
        if (m_traversal->get_depth(idx) == m_config.get_num_rpivots()) {
            return std::vector<std::int8_t> {true, false};
        }
        return std::vector<std::int8_t> {false, false};
    }
}

bool
t_ctx1::has_row_path() const {
    return true;
}

bool
t_ctx1::has_row_combined() const {
    return m_config.has_row_combined();
}

bool
t_ctx1::has_pivot_view_flat() const {
    return m_config.is_pivot_view_flat_mode();
}

std::map<std::string, std::string>
t_ctx1::longest_text_cols() const {
    printf( "t_ctx1::longest_text_cols\n");

    auto flat_mode = has_pivot_view_flat();
    std::vector<std::string> row_pivots;
    auto rpivots = m_config.get_row_pivots();
    for (t_index idx = 0, rsize = rpivots.size(); idx < rsize; ++idx) {
        row_pivots.push_back(rpivots[idx].colname());
    }
    std::map<std::string, std::string> text_cols;

    t_uindex ctx_nrows = get_row_count();
    t_uindex ncols = get_column_count();
    t_uindex treesize = m_traversal->size();

    auto ext
        = sanitize_get_data_extents(ctx_nrows, ncols, 0, 20, 0, ncols);

    t_index nrows = ext.m_erow - ext.m_srow;
    t_index stride = ext.m_ecol - ext.m_scol;

    std::vector<t_tscalar> tmpvalues(nrows * ncols);

    const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
    std::vector<const t_column*> aggcols(m_config.get_num_aggregates());
    auto aggtable = m_tree->get_aggtable();
    auto none = mknone();
    auto col_size = m_config.get_num_aggregates();
    std::string colname;
    std::string str = "";

    // Add longest text for column index is 0
    if (ext.m_scol == 0 && !flat_mode) {
        colname = "__ROW_PATH__";
        for (auto ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
            auto r_paths = unity_get_row_path(ridx);
            if (r_paths.size() > 0) {
                auto str_val = r_paths[0].to_string();
                if (str_val.size() > str.size()) {
                    str = str_val;
                }
            }
        }
        text_cols[colname] = str;
    }

    if (has_row_combined()) {
        auto combined_idx = m_config.get_combined_index();
        row_pivots.insert(row_pivots.begin() + combined_idx, COMBINED_NAME);
    }
    std::vector<std::vector<t_tscalar>> row_paths;
    if (flat_mode && ext.m_scol < row_pivots.size()) {
        row_paths = get_flat_mode_row_paths(ext.m_srow, ext.m_erow);
        auto rpsize = row_paths.size();
        for (t_index cidx = 0, psize = row_pivots.size(); cidx < psize; ++cidx) {
            colname = row_pivots[cidx];
            str = "";
            for (auto ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
                if (ridx - ext.m_srow >= rpsize) {
                    continue;
                }
                t_tscalar value = row_paths[ridx - ext.m_srow][cidx];
                std::string str_val = value.to_string();
                if (str_val.size() > str.size()) {
                    str = str_val;
                }
            }
            text_cols[colname] = str;
        }
    }

    // Case 1: Add longest text for other column with field "Values" in Group by
    if (has_row_combined()) {
        for (t_uindex aggidx = 0, loop_end = aggcols.size(); aggidx < loop_end; ++aggidx) {
            aggcols[aggidx] = aggtable->get_const_column(aggidx).get();
        }

        std::vector<std::pair<t_uindex, t_uindex>> cells;
        for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
            for (t_index cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
                cells.push_back(std::pair<t_index, t_index>(ridx, cidx));
            }
        }

        auto cells_info = resolve_cells(cells);
        for (t_index cidx = std::max(ext.m_scol, t_index(!flat_mode ? 1 : row_pivots.size())); cidx < ext.m_ecol; ++cidx) {
            colname = flat_mode ? " " : COMBINED_NAME;
            str = "";
            for (auto ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
                t_tscalar value;
                auto insert_idx = (ridx - ext.m_srow) * stride + cidx - ext.m_scol;
                const t_cellinfo& cinfo = cells_info[insert_idx];
                if (cinfo.m_idx < 0) {
                    value.set(none);
                } else {
                    t_index pnidx = m_tree->get_parent_idx(cinfo.m_idx);
                    t_index agg_pridx = pnidx == INVALID_INDEX ? INVALID_INDEX : m_tree->get_aggidx(pnidx);
                    value
                        = extract_aggregate(aggspecs[cinfo.m_agg_index], aggcols[cinfo.m_agg_index],
                            cinfo.m_idx, agg_pridx);
                    if (!value.is_valid())
                        value.set(none); // todo: fix null handling
                }
                auto str_val = value.to_string();
                if (str_val.size() > str.size()) {
                    str = str_val;
                }
            }
            text_cols[colname] = str;
        }
    // Case 2: Add longest text for other column with field "Values" in Split by
    } else {
        for (t_uindex aggidx = 0, loop_end = aggcols.size(); aggidx < loop_end; ++aggidx) {
            aggcols[aggidx] = aggtable->get_const_column(aggidx).get();
        }

        for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
            t_index new_ridx = ridx;
            if (treesize <= (unsigned)ridx) {
                new_ridx = 0;
            }
            t_index nidx = m_traversal->get_tree_index(new_ridx);
            t_index pnidx = m_tree->get_parent_idx(nidx);

            t_uindex agg_ridx = m_tree->get_aggidx(nidx);
            t_index agg_pridx = pnidx == INVALID_INDEX ? INVALID_INDEX : m_tree->get_aggidx(pnidx);

            t_tscalar tree_value = m_tree->get_value(nidx);
            tmpvalues[(ridx - ext.m_srow) * ncols] = tree_value;

            for (t_index aggidx = 0, loop_end = aggcols.size(); aggidx < loop_end; ++aggidx) {
                t_tscalar value
                    = extract_aggregate(aggspecs[aggidx], aggcols[aggidx], agg_ridx, agg_pridx);
                if (!value.is_valid())
                    value.set(none); // todo: fix null handling
                tmpvalues[(ridx - ext.m_srow) * ncols + 1 + aggidx].set(value);
            }
        }
        for (auto cidx = std::max(ext.m_scol, t_index(!flat_mode ? 1 : row_pivots.size())); cidx < ext.m_ecol; ++cidx) {
            colname = aggspecs[cidx - (!flat_mode ? 1 : row_pivots.size())].name();
            str = "";
            for (auto ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
                auto insert_idx = (ridx - ext.m_srow) * stride + cidx - ext.m_scol;
                auto src_idx = (ridx - ext.m_srow) * ncols + cidx;
                auto str_val = tmpvalues[src_idx].to_string();
                if (str_val.size() > str.size()) {
                    str = str_val;
                }
            }
            text_cols[colname] = str;
        }
    }
    printf( "t_ctx1::longest_text_cols---ended\n");

    return text_cols;
}

std::map<std::string, double>
t_ctx1::get_default_binning(const std::string& colname) const {
    std::map<std::string, double> binning_map;
    auto it = m_default_binning.find(colname);
    if (it != m_default_binning.end()) {
        auto dbinning = it->second;
        if (dbinning[0] != std::numeric_limits<double>::infinity()) {
            binning_map["min"] = dbinning[0];
        }
        if (dbinning[1] != std::numeric_limits<double>::infinity() * -1.0) {
            binning_map["max"] = dbinning[1];
        }
        if (dbinning[2] != 0 && dbinning[0] != std::numeric_limits<double>::infinity()
            && dbinning[1] != std::numeric_limits<double>::infinity() * -1.0) {
            binning_map["size"] = std::floor((dbinning[1] - dbinning[0])*100/dbinning[2]) / 100;
            if (binning_map["size"] < 0.01) {
                binning_map["size"] = 0.01;
            }
        }
    }
    return binning_map;
}

std::map<std::string, t_uindex>
t_ctx1::get_truncated_columns() const {
    auto aggtable = m_tree->get_aggtable();
    return aggtable->get_truncated_columns();
}

std::vector<t_tscalar>
t_ctx1::unity_get_row_header(t_uindex idx) const {
    return std::vector<t_tscalar>();
}

std::vector<t_tscalar>
t_ctx1::unity_get_column_path(t_uindex idx) const {
    return std::vector<t_tscalar>();
}

t_uindex
t_ctx1::unity_get_row_depth(t_uindex ridx) const {
    return m_traversal->get_depth(ridx);
}

t_uindex
t_ctx1::unity_get_column_depth(t_uindex cidx) const {
    return 0;
}

std::string
t_ctx1::unity_get_column_name(t_uindex idx) const {
    return m_config.unity_get_column_name(idx);
}

std::string
t_ctx1::unity_get_column_display_name(t_uindex idx) const {
    return m_config.unity_get_column_display_name(idx);
}

std::vector<std::string>
t_ctx1::unity_get_column_names() const {
    std::vector<std::string> rv;

    for (t_uindex idx = 0, loop_end = unity_get_column_count(); idx < loop_end; ++idx) {
        rv.push_back(unity_get_column_name(idx));
    }
    return rv;
}

std::vector<std::string>
t_ctx1::unity_get_column_display_names() const {
    std::vector<std::string> rv;

    for (t_uindex idx = 0, loop_end = unity_get_column_count(); idx < loop_end; ++idx) {
        rv.push_back(unity_get_column_display_name(idx));
    }
    return rv;
}

t_uindex
t_ctx1::unity_get_column_count() const {
    if (has_pivot_view_flat()) {
        return get_column_count();
    } else {
        return get_column_count() - 1;
    }
    //return get_column_count() - 1;
}

bool
t_ctx1::get_show_leave() const {
    return true;
}

t_uindex
t_ctx1::unity_get_row_count() const {
    return get_row_count();
}

bool
t_ctx1::unity_get_row_expanded(t_uindex idx) const {
    if (has_row_combined()) {
        auto tsize = m_traversal->size();
        if (idx >= m_traversal_indices.size()) {
            return m_traversal->get_node_expanded(tsize);
        }
        t_indiceinfo nindice = m_traversal_indices[idx];
        return m_traversal->get_node_expanded(nindice.m_idx);
    } else {
        return m_traversal->get_node_expanded(idx);
    }
}

bool
t_ctx1::unity_get_column_expanded(t_uindex idx) const {
    return false;
}

void
t_ctx1::clear_deltas() {
    m_tree->clear_deltas();
}

void
t_ctx1::unity_init_load_step_end() {}

std::shared_ptr<t_table>
t_ctx1::get_table() const {
    auto schema = m_tree->get_aggtable()->get_schema();
    auto pivots = m_config.get_row_pivots();
    auto tbl = std::make_shared<t_table>(schema, m_tree->size());
    tbl->init();
    tbl->extend(m_tree->size());

    std::vector<t_column*> aggcols = tbl->get_columns();
    auto n_aggs = aggcols.size();
    std::vector<t_column*> pivcols;

    std::stringstream ss;
    for (const auto& c : pivots) {
        pivcols.push_back(tbl->add_column(c.colname(), m_schema.get_dtype(c.colname()), true, m_schema.get_data_format_type(c.colname())));
    }

    auto idx = 0;
    for (auto nidx : m_tree->dfs()) {
        auto depth = m_tree->get_depth(nidx);
        if (depth > 0) {
            pivcols[depth - 1]->set_scalar(idx, m_tree->get_value(nidx));
        }
        for (t_uindex aggnum = 0; aggnum < n_aggs; ++aggnum) {
            auto aggscalar = m_tree->get_aggregate(nidx, aggnum);
            aggcols[aggnum]->set_scalar(idx, aggscalar);
        }
        ++idx;
    }
    return tbl;
}

void
t_ctx1::build_running_table(std::string col_name, t_show_type show_type) {
    if (show_type == SHOW_TYPE_RUNNING_TOTAL || show_type == SHOW_TYPE_RUNNING_PERCENT) {
        auto running_tbl = m_tree->get_running_table();
        auto schema = running_tbl->get_schema();
        auto none = mknone();
        auto aggtable = m_tree->get_aggtable();
        const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
        t_aggspec aggspec;
        for (t_index idx = 0, aggsize = aggspecs.size(); idx < aggsize; ++idx) {
            if (col_name == aggspecs[idx].name()) {
                aggspec = aggspecs[idx];
                break;
            }
        }
        auto agg_col = aggtable->get_const_column(col_name).get();
        t_uindex treesize = m_traversal->size();
        running_tbl->set_size(aggtable->size());
        if (!schema.has_column(col_name)) {
            t_dtype type = DTYPE_FLOAT64;
            if (aggspec.agg() == AGGTYPE_MEAN || aggspec.agg() == AGGTYPE_MEAN_BY_COUNT) {
                type = DTYPE_F64PAIR;
            }
            running_tbl->add_column(col_name, type, agg_col->is_status_enabled(), agg_col->get_data_format_type());
        }
        t_column* running_col = running_tbl->get_column(col_name).get();
        t_tscalar running_total;
        running_total.set(double(0));
        for (t_index ridx = 0; ridx <= treesize; ++ridx) {
            t_index new_ridx = ridx;
            if (treesize <= (unsigned)ridx) {
                new_ridx = 0;
            }
            auto node = m_traversal->get_node(new_ridx);
            t_index nidx = node.m_tnid;
            bool is_leaf = !node.m_expanded;
            t_index pnidx = m_tree->get_parent_idx(nidx);

            t_uindex agg_ridx = m_tree->get_aggidx(nidx);
            t_index agg_pridx = pnidx == INVALID_INDEX ? INVALID_INDEX : m_tree->get_aggidx(pnidx);

            t_tscalar value
                = extract_aggregate(aggspec, agg_col, agg_ridx, agg_pridx);
            if (!value.is_valid())
                value.set(none); // todo: fix null handling
            
            if (!value.is_none() && is_leaf) {
                running_total.set(running_total.to_double() + value.to_double());
            }
            if (!is_leaf && !value.is_none() && new_ridx != 0) {
                value.set(running_total.to_double() + value.to_double());
            } else if (ridx != 0) {
                value.set(running_total.to_double());
            }
            if (aggspec.agg() == AGGTYPE_MEAN || aggspec.agg() == AGGTYPE_MEAN_BY_COUNT) {
                std::pair<double, double>* running_pair
                        = running_col->get_nth<std::pair<double, double>>(nidx);
                running_pair->first = value.to_double();
                running_pair->second = double(1);
                if (nidx == treesize - 1) {
                    value.set(running_total.to_double());
                    std::pair<double, double>* total_pair
                            = running_col->get_nth<std::pair<double, double>>(0);
                    total_pair->first = value.to_double();
                    total_pair->second = double(1);
                }
            } else {
                running_col->set_scalar(nidx, value);
                if (nidx == treesize - 1) {
                    value.set(running_total.to_double());
                    running_col->set_scalar(0, value);
                }
            }
        }
    }
}

void
t_ctx1::update_column_name(const std::string& old_name, const std::string& new_name) {
    // Update column name for config
    m_config.update_column_name(old_name, new_name);

    std::map<std::string, std::string> col_map = {{new_name, old_name}};

    // Update column name for schema
    m_schema.rename_columns(col_map);

    // Update column name for tree
    m_tree->update_column_name(old_name, new_name);
}

void
t_ctx1::update_show_type(std::string col_name, t_show_type show_type) {
    m_config.update_show_type(col_name, show_type);
    build_running_table(col_name, show_type);
}

void
t_ctx1::update_pagination_setting(t_index page_items, t_index page_num) {
    m_config.update_pagination_setting(page_items, page_num);
}

} // end namespace perspective
