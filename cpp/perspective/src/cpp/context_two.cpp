/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/get_data_extents.h>
#include <perspective/context_two.h>
#include <perspective/extract_aggregate.h>
#include <perspective/sparse_tree.h>
#include <perspective/tree_context_common.h>
#include <perspective/logtime.h>
#include <perspective/traversal.h>

namespace perspective {

t_ctx2::t_ctx2()
    : m_row_depth(0)
    , m_row_depth_set(false)
    , m_column_depth(0)
    , m_column_depth_set(false) {}

t_ctx2::t_ctx2(const t_schema& schema, const t_config& pivot_config)
    : t_ctxbase<t_ctx2>(schema, pivot_config)
    , m_row_depth(0)
    , m_row_depth_set(false)
    , m_column_depth(0)
    , m_column_depth_set(false) {}

t_ctx2::~t_ctx2() {}

t_uindex
t_ctx2::get_num_trees() const {
    return m_config.is_column_only() ? m_config.get_num_rpivots() + 2 : m_config.get_num_rpivots() + 1;
}

std::string
t_ctx2::repr() const {
    std::stringstream ss;
    ss << "t_ctx2<" << this << ">";
    return ss.str();
}

void
t_ctx2::init() {
    m_trees = std::vector<std::shared_ptr<t_stree>>(get_num_trees());

    for (t_uindex treeidx = 0, tree_loop_end = m_trees.size(); treeidx < tree_loop_end;
         ++treeidx) {
        std::vector<t_pivot> pivots;
        if (treeidx > 0 && !m_config.is_column_only()) {
            pivots.insert(pivots.end(), m_config.get_row_pivots().begin(),
                m_config.get_row_pivots().begin() + treeidx);
        }


        pivots.insert(pivots.end(), m_config.get_column_pivots().begin(),
            m_config.get_column_pivots().end());

        m_trees[treeidx]
            = std::make_shared<t_stree>(pivots, m_config.get_aggregates(), m_schema, m_config);

        m_trees[treeidx]->init();
    }

    m_rtraversal = std::make_shared<t_traversal>(rtree(), m_config.handle_nan_sort());

    m_ctraversal = std::make_shared<t_traversal>(ctree(), m_config.handle_nan_sort());
    m_minmax = std::vector<t_minmax>(m_config.get_num_aggregates());
    m_init = true;
    m_row_sortby = m_config.get_sortspecs();
    m_default_binning = {};
}

void
t_ctx2::step_begin() {
    reset_step_state();
}

void
t_ctx2::step_end() {
    m_minmax = m_trees.back()->get_min_max();
    if (m_row_depth_set) {
        set_depth(HEADER_ROW, m_row_depth);
    }
    if (m_column_depth_set) {
        set_depth(HEADER_COLUMN, m_column_depth);
    }

    // Build running table
    auto aggspecs = get_aggregates();
    for (t_index aggidx = 0, aggsize = aggspecs.size(); aggidx < aggsize; ++aggidx) {
        auto col_name = aggspecs[aggidx].name();
        auto show_type = m_config.get_show_type(col_name);
        build_running_table(col_name, show_type);
    }
}

t_index
t_ctx2::get_row_count() const {
    if (has_row_combined() || has_pivot_view_flat()) {
        return m_rtraversal_indices.size();
    }
    if (m_config.is_column_only()) {
        return 1;
    }
    return m_rtraversal->size() + 1;
}

t_index
t_ctx2::get_column_count() const {
    return get_num_view_columns();
}

t_index
t_ctx2::open(t_header header, t_index idx) {
    t_index retval;

    if (header == HEADER_ROW) {
        if (!m_rtraversal->is_valid_idx(idx))
            return 0;
        m_row_depth_set = false;
        m_row_depth = 0;
        if (m_row_sortby.empty()) {
            retval = m_rtraversal->expand_node(idx);
        } else {
            retval = m_rtraversal->expand_node(m_row_sortby, idx);
        }
        m_rows_changed = (retval > 0);
    } else {
        if (!m_ctraversal->is_valid_idx(idx))
            return 0;
        retval = m_ctraversal->expand_node(idx);
        m_column_depth_set = false;
        m_column_depth = 0;
        m_columns_changed = (retval > 0);
    }

    return retval;
}

t_index
t_ctx2::combined_open(t_header header, t_index idx) {
    t_index retval;

    if (header == HEADER_ROW) {
        if (has_row_combined() && !m_config.is_column_only()) {
            if (idx >= m_rtraversal_indices.size()) {
                return 0;
            }
            t_indiceinfo r_indice = m_rtraversal_indices[idx];
            auto combined_idx = m_config.get_combined_index();
            if (combined_idx == r_indice.m_depth && r_indice.m_agg_index != -1 && !r_indice.m_show_data) {
                return 0;
            }
            if (!r_indice.m_show_data || combined_idx < r_indice.m_depth) {
                retval = open(header, r_indice.m_idx);
                // Update row traversal indices vector
                update_rtraversal_indices();
                return retval;
            } else {
                return 0;
            }
        } else {
            retval = open(header, idx);
        }
    } else {
        retval = open(header, idx);
    }

    return retval;
}

t_index
t_ctx2::close(t_header header, t_index idx) {
    t_index retval;

    switch (header) {
        case HEADER_ROW: {
            if (!m_rtraversal->is_valid_idx(idx))
                return 0;
            m_row_depth_set = false;
            m_row_depth = 0;
            retval = m_rtraversal->collapse_node(idx);
            m_rows_changed = (retval > 0);
        } break;
        case HEADER_COLUMN: {
            if (!m_ctraversal->is_valid_idx(idx))
                return 0;
            m_column_depth_set = false;
            m_column_depth = 0;
            retval = m_ctraversal->collapse_node(idx);
            m_columns_changed = (retval > 0);
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Invalid header type detected.");
            return INVALID_INDEX;
        } break;
    }
    return retval;
}

t_index
t_ctx2::combined_close(t_header header, t_index idx) {
    t_index retval;
    switch (header) {
        case HEADER_ROW: {
            if (has_row_combined() && !m_config.is_column_only()) {
                if (idx >= m_rtraversal_indices.size()) {
                    return 0;
                }
                t_indiceinfo r_indice = m_rtraversal_indices[idx];
                auto combined_idx = m_config.get_combined_index();
                if (combined_idx == r_indice.m_depth && r_indice.m_agg_index != -1 && !r_indice.m_show_data) {
                    return 0;
                }
                if (!r_indice.m_show_data || combined_idx < r_indice.m_depth) {
                    retval = close(header, r_indice.m_idx);
                    // Update row traversal indices vector
                    update_rtraversal_indices();
                    return retval;
                } else {
                    return 0;
                }
            } else {
                retval = close(header, idx);
            }
        } break;
        case HEADER_COLUMN: {
            retval = close(header, idx);
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Invalid header type detected.");
            return INVALID_INDEX;
        } break;
    }
    return retval;
}

t_totals
t_ctx2::get_totals() const {
    return m_config.get_totals();
}

std::vector<t_index>
t_ctx2::get_ctraversal_indices() const {
    switch (m_config.get_totals()) {
        case TOTALS_BEFORE: {
            t_index nelems = m_ctraversal->size();
            PSP_VERBOSE_ASSERT(nelems > 0, "nelems is <= 0");
            std::vector<t_index> rval(nelems);
            for (t_index cidx = 0; cidx < nelems; ++cidx) {
                rval[cidx] = cidx;
            }
            return rval;
        } break;
        case TOTALS_AFTER: {
            std::vector<t_index> col_order;
            m_ctraversal->post_order(0, col_order);
            return col_order;
        } break;
        case TOTALS_HIDDEN: {
            std::vector<t_index> leaves;
            m_ctraversal->get_leaves(leaves);
            std::vector<t_index> rval(leaves.size() + 1);
            rval[0] = 0;
            for (t_uindex idx = 1, loop_end = rval.size(); idx < loop_end; ++idx) {
                rval[idx] = leaves[idx - 1];
            }
            return rval;
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Unknown total type"); }
    }
    return std::vector<t_index>();
}

void
t_ctx2::get_column_aggregate_info(std::vector<std::pair<t_index, t_index>>& cvec) const {
    auto row_combined = has_row_combined();
    t_uindex naggs = m_config.get_num_aggregates();
    if (!row_combined) {
        m_ctraversal->get_column_aggregate_info(cvec, m_config.get_combined_index(), naggs);
    } else {
        switch (m_config.get_totals()) {
            case TOTALS_BEFORE: {
                t_index nelems = m_ctraversal->size();
                PSP_VERBOSE_ASSERT(nelems > 0, "nelems is <= 0");
                std::vector<t_index> rval(nelems);
                for (t_index cidx = 0; cidx < nelems; ++cidx) {
                    rval[cidx] = cidx;
                }
                cvec.push_back(std::pair<t_index, t_index>(0, -1));
                for (t_index idx = 0, csize = rval.size(); idx < csize; ++idx) {
                    cvec.push_back(std::pair<t_index, t_index>(rval[idx], 0));
                }
            } break;
            case TOTALS_AFTER: {
                std::vector<t_index> col_order;
                m_ctraversal->post_order(0, col_order);
                cvec.push_back(std::pair<t_index, t_index>(0, -1));
                for (t_index idx = 0, csize = col_order.size(); idx < csize; ++idx) {
                    cvec.push_back(std::pair<t_index, t_index>(col_order[idx], 0));
                }
            } break;
            case TOTALS_HIDDEN: {
                std::vector<t_index> leaves;
                m_ctraversal->get_leaves(leaves);
                std::vector<t_index> rval(leaves.size() + 1);
                for (t_uindex idx = 1, loop_end = rval.size(); idx < loop_end; ++idx) {
                    rval[idx] = leaves[idx - 1];
                }
                cvec.push_back(std::pair<t_index, t_index>(0, -1));
                for (t_index idx = 0, csize = rval.size(); idx < csize; ++idx) {
                    cvec.push_back(std::pair<t_index, t_index>(rval[idx], 0));
                }
            } break;
            default: { PSP_COMPLAIN_AND_ABORT("Unknown total type"); }
        }
    }
}

std::vector<t_tscalar>
t_ctx2::get_data(t_index start_row, t_index end_row, t_index start_col, t_index end_col,
    std::map<std::uint32_t, std::uint32_t> idx_map) const {
    bool flat_mode = has_pivot_view_flat();
    bool row_combined = has_row_combined();
    t_index num_aggs = m_config.get_num_aggregates();
    typedef std::pair<t_index, t_index> t_totalpair;
    t_uindex ctx_nrows = get_row_count();
    t_uindex ctx_ncols = get_column_count();
    if (flat_mode && m_config.is_column_only() && num_aggs >= 1) {
        ctx_ncols += 1;
    }

    // get pagination spec to calculate start row and end row base on page number
    auto paginationspec = m_config.get_paginationspec();
    if (paginationspec.enable_pagination()) {
        auto items_per_page = paginationspec.get_items_per_page();
        auto page_num = paginationspec.get_page_num();

        // New start_row and end_row
        start_row += (page_num - 1) * items_per_page;
        end_row += (page_num - 1) * items_per_page;
    }

    auto ext = sanitize_get_data_extents(
        ctx_nrows, ctx_ncols, start_row, end_row, start_col, end_col);

    std::map<std::uint32_t, std::uint32_t> cols_idx;
    for (t_index cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
        cols_idx[cidx] = idx_map.find(cidx) == idx_map.end() ? cidx : idx_map[cidx];
    }

    std::vector<std::pair<t_uindex, t_uindex>> cells;
    for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
        for (t_index cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
            cells.push_back(t_totalpair(ridx, cols_idx[cidx]));
        }
    }

    auto cells_info = resolve_cells(cells);

    t_index nrows = ext.m_erow - ext.m_srow;
    t_index stride = ext.m_ecol - ext.m_scol;
    std::vector<t_tscalar> retval(nrows * stride);

    t_tscalar empty = mknone();

    typedef std::pair<t_uindex, t_uindex> t_aggpair;
    std::map<t_aggpair, const t_column*> aggmap;

    for (t_uindex treeidx = 0, tree_loop_end = m_trees.size(); treeidx < tree_loop_end;
         ++treeidx) {
        auto aggtable = m_trees[treeidx]->get_aggtable();
        auto running_tbl = m_trees[treeidx]->get_running_table();
        t_schema aggschema = aggtable->get_schema();

        for (t_uindex aggidx = 0; aggidx < num_aggs; ++aggidx) {
            const std::string& aggname = aggschema.m_columns[aggidx];
            auto show_type = m_config.get_show_type(aggname);

            if (show_type == SHOW_TYPE_RUNNING_TOTAL || show_type == SHOW_TYPE_RUNNING_PERCENT) {
                aggmap[t_aggpair(treeidx, aggidx)] = running_tbl->get_const_column(aggname).get();
            } else {
                aggmap[t_aggpair(treeidx, aggidx)] = aggtable->get_const_column(aggname).get();
            }
        }
    }

    const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();

    auto rpivots_depth = m_config.get_num_rpivots();
    auto cpivots_depth = m_config.get_num_cpivots();
    auto num_rpivots = rpivots_depth + (row_combined ? 1 : 0);
    std::vector<std::vector<t_tscalar>> row_paths;
    if (flat_mode && ext.m_scol < num_rpivots) {
        row_paths = get_flat_mode_row_paths(ext.m_srow, ext.m_erow);
    }

    auto get_aggregate_value = [&aggmap, this, &aggspecs, empty](t_cellinfo cinfo) {
        t_tscalar value;
        // Check aggregate index here
        auto aggpair = t_aggpair(cinfo.m_treenum, cinfo.m_agg_index);
        auto mit = aggmap.find(aggpair);
        if (mit != aggmap.end()) {
            auto aggcol = mit->second;
            //auto aggcol = aggmap[t_aggpair(cinfo.m_treenum, cinfo.m_agg_index)];

            t_index p_idx = this->m_trees[cinfo.m_treenum]->get_parent_idx(cinfo.m_idx);

            t_uindex agg_ridx = this->m_trees[cinfo.m_treenum]->get_aggidx(cinfo.m_idx);

            t_uindex agg_pridx = p_idx == INVALID_INDEX
                ? INVALID_INDEX
                : this->m_trees[cinfo.m_treenum]->get_aggidx(p_idx);

            value = extract_aggregate(
                aggspecs[cinfo.m_agg_index], aggcol, agg_ridx, agg_pridx);

            if (!value.is_valid() && !value.is_error())
                value.set(empty);
        } else {
            value.set(empty);
        }

        return value;
    };

    std::vector<t_show_type> show_type_vec(num_aggs);
    std::vector<std::pair<t_uindex, t_uindex>> total_cells;
    std::map<std::string, t_index> previous_map;
    for (t_uindex aggidx = 0; aggidx < num_aggs; ++aggidx) {
        auto aggname = m_config.unity_get_column_name(aggidx);
        show_type_vec[aggidx] = m_config.get_show_type(aggname);
        if (m_config.get_period_type(aggname) == PERIOD_TYPE_PREVIOUS) {
            previous_map[aggname] = aggidx;
        }
        switch(show_type_vec[aggidx]) {
            case SHOW_TYPE_ROW: {
                for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
                    if (row_combined) {
                        total_cells.push_back(t_totalpair(ridx, ctx_ncols - 1));
                    } else {
                        total_cells.push_back(t_totalpair(ridx, ctx_ncols - (num_aggs - aggidx)));
                    }
                }
            } break;

            case SHOW_TYPE_COLUMN: {
                for (t_index cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
                    if (flat_mode && cidx < num_rpivots) {
                        continue;
                    }
                    if (row_combined) {
                        total_cells.push_back(t_totalpair(ctx_nrows - (num_aggs - aggidx), cidx));
                    } else {
                        total_cells.push_back(t_totalpair(ctx_nrows - 1, cidx));
                    }
                }
            } break;

            case SHOW_TYPE_GRAND_TOTAL:
            case SHOW_TYPE_RUNNING_PERCENT: {
                if (row_combined) {
                    total_cells.push_back(t_totalpair(ctx_nrows - (num_aggs - aggidx), ctx_ncols - 1));
                } else {
                    total_cells.push_back(t_totalpair(ctx_nrows - 1, ctx_ncols - (num_aggs - aggidx)));
                }
            } break;
            
            default: {} break;
        }
    }

    std::vector<t_cellinfo> total_cells_info = (total_cells.size() > 0) ? resolve_cells(total_cells)
                                                        : std::vector<t_cellinfo>{};
    std::map<t_totalpair, t_tscalar> total_map;
    for (t_uindex idx = 0, cfsize = total_cells_info.size(); idx < cfsize; ++idx) {
        auto cinfo = total_cells_info[idx];
        t_tscalar value;
        if (cinfo.m_idx < 0) {
            continue;
        } else {
            value = get_aggregate_value(cinfo);
        }
        total_map[t_totalpair(cinfo.m_ridx, cinfo.m_cidx)] = value;
    }

    for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
        if (ext.m_scol == 0) {
            if (row_combined && !m_config.is_column_only()) {
                auto r_indice = m_rtraversal_indices[ridx];
                if (r_indice.m_idx == m_rtraversal->size()) {
                    retval[(ridx - ext.m_srow) * stride].set(
                        rtree()->get_value(m_rtraversal->get_tree_index(0)));
                } else {
                    retval[(ridx - ext.m_srow) * stride].set(
                        rtree()->get_value(m_rtraversal->get_tree_index(r_indice.m_idx)));
                }
            } else {
                if (ridx == m_rtraversal->size()) {
                    retval[(ridx - ext.m_srow) * stride].set(
                        rtree()->get_value(m_rtraversal->get_tree_index(0)));
                } else {
                    retval[(ridx - ext.m_srow) * stride].set(
                        rtree()->get_value(m_rtraversal->get_tree_index(ridx)));
                }
            }
        }

        auto r_paths = row_paths[ridx - ext.m_srow];
        //for (t_index cidx = std::max(ext.m_scol, t_index(1)); cidx < ext.m_ecol; ++cidx) {
        for (t_index cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
            t_index insert_idx = (ridx - ext.m_srow) * stride + (cidx - ext.m_scol);
            if (flat_mode && cidx < num_rpivots) {
                retval[insert_idx].set(r_paths[cidx]);
                continue;
            }
            const t_cellinfo& cinfo = cells_info[insert_idx];

            if (cinfo.m_idx < 0) {
                retval[insert_idx].set(empty);
            } else {
                auto value = get_aggregate_value(cinfo);
                switch(show_type_vec[cinfo.m_agg_index]) {
                    case SHOW_TYPE_GRAND_TOTAL:
                    case SHOW_TYPE_RUNNING_PERCENT: {
                        if (!value.is_none()) {
                            auto total_sca = total_map[row_combined ? t_totalpair(ctx_nrows - (num_aggs - cinfo.m_agg_index), ctx_ncols - 1)
                                : t_totalpair(ctx_nrows - 1, ctx_ncols - (num_aggs - cinfo.m_agg_index))];
                            value.set(100*value.to_double()/total_sca.to_double());
                            value.m_data_format_type = DATA_FORMAT_PERCENT;
                        }
                    } break;
                    case SHOW_TYPE_COLUMN: {
                        if (!value.is_none()) {
                            auto total_sca = total_map[row_combined ? t_totalpair(ctx_nrows - (num_aggs - cinfo.m_agg_index), cidx)
                                : t_totalpair(ctx_nrows - 1, cidx)];
                            value.set(100*value.to_double()/total_sca.to_double());
                            value.m_data_format_type = DATA_FORMAT_PERCENT;
                        }
                    } break;
                    case SHOW_TYPE_ROW: {
                        if (!value.is_none()) {
                            auto total_sca = total_map[row_combined ? t_totalpair(ridx, ctx_ncols - 1)
                                : t_totalpair(ridx, ctx_ncols - (num_aggs - cinfo.m_agg_index))];
                            value.set(100*value.to_double()/total_sca.to_double());
                            value.m_data_format_type = DATA_FORMAT_PERCENT;
                        }
                    } break;
                    case SHOW_TYPE_PARENT_COLUMN: {
                        if (!value.is_none()) {
                            auto aggcol = aggmap[t_aggpair(cinfo.m_treenum, cinfo.m_agg_index)];
                            t_index p_idx = m_trees[cinfo.m_treenum]->get_parent_idx(cinfo.m_idx);
                            if (p_idx != INVALID_INDEX) {
                                t_depth p_depth = m_trees[cinfo.m_treenum]->get_depth(p_idx);
                                if (p_depth >= cinfo.m_treenum) {
                                    t_index pp_idx = m_trees[cinfo.m_treenum]->get_parent_idx(p_idx);
                                    t_uindex agg_pridx = p_idx == INVALID_INDEX
                                        ? INVALID_INDEX
                                        : m_trees[cinfo.m_treenum]->get_aggidx(p_idx);
                                    t_uindex agg_ppridx = pp_idx == INVALID_INDEX
                                        ? INVALID_INDEX
                                        : m_trees[cinfo.m_treenum]->get_aggidx(pp_idx);
                                    t_tscalar pvalue;
                                    if (agg_pridx != INVALID_INDEX) {
                                        pvalue = extract_aggregate(
                                            aggspecs[cinfo.m_agg_index], aggcol, agg_pridx, agg_ppridx);
                                        if (!pvalue.is_valid()) {
                                            value.set(empty);
                                        } else {
                                            value.set(100*value.to_double()/pvalue.to_double());
                                            value.m_data_format_type = DATA_FORMAT_PERCENT;
                                        }
                                    } else {
                                        pvalue.set(empty);
                                    }
                                } else {
                                    value.set(empty);
                                }
                            } else {
                                value.set(empty);
                            }
                        }
                    } break;
                    case SHOW_TYPE_PARENT_ROW: {
                        if (!value.is_none()) {
                            if (cinfo.m_treenum > 0) {
                                auto aggcol = aggmap[t_aggpair(cinfo.m_treenum - 1, cinfo.m_agg_index)];
                                t_depth p_depth = m_trees[cinfo.m_treenum]->get_depth(cinfo.m_idx);
                                std::vector<t_tscalar> path;
                                std::vector<t_tscalar> npath;
                                m_trees[cinfo.m_treenum]->get_path(cinfo.m_idx, path);
                                for (t_index idx = 0, psize = path.size(); idx < psize; ++idx) {
                                    if (idx != p_depth - cinfo.m_treenum) {
                                        npath.push_back(path[idx]);
                                    }
                                }
                                t_index pidx = m_trees[cinfo.m_treenum - 1]->resolve_path(0, npath);
                                if (pidx != INVALID_INDEX) {
                                    auto pvalue = aggcol->get_scalar(pidx);
                                    if (pvalue.is_valid()) {
                                        value.set(100*value.to_double()/pvalue.to_double());
                                        value.m_data_format_type = DATA_FORMAT_PERCENT;
                                    } else {
                                        value.set(empty);
                                    }
                                } else {
                                    value.set(empty);
                                }
                            } else {
                                value.set(empty);
                            }
                        }
                    } break;
                    case SHOW_TYPE_DIFF_PREVIOUS_VALUE: {
                        if (!value.is_none() && value.is_valid()) {
                            auto prev_name = "Previous " + m_config.unity_get_column_name(cinfo.m_agg_index);
                            t_tscalar pvalue;
                            if (previous_map.find(prev_name) != previous_map.end()) {
                                t_cellinfo pcinfo(cinfo.m_idx, cinfo.m_treenum, previous_map[prev_name], cinfo.m_ridx, cinfo.m_cidx);
                                pvalue = get_aggregate_value(pcinfo);
                            } else {
                                pvalue.set(empty);
                            }
                            if (!pvalue.is_none() && pvalue.is_valid()) {
                                auto v_df = value.m_data_format_type;
                                value.set(value.to_double() - pvalue.to_double());
                                value.m_data_format_type = v_df;
                            }
                        }
                    } break;
                    case SHOW_TYPE_PERCENT_PREVIOUS_VALUE: {
                        if (!value.is_none() && value.is_valid()) {
                            auto prev_name = "Previous " + m_config.unity_get_column_name(cinfo.m_agg_index);
                            t_tscalar pvalue;
                            if (previous_map.find(prev_name) != previous_map.end()) {
                                t_cellinfo pcinfo(cinfo.m_idx, cinfo.m_treenum, previous_map[prev_name], cinfo.m_ridx, cinfo.m_cidx);
                                pvalue = get_aggregate_value(pcinfo);
                            } else {
                                pvalue.set(empty);
                            }
                            if (!pvalue.is_none() && pvalue.is_valid()) {
                                value.set(100*value.to_double()/pvalue.to_double());
                                value.m_data_format_type = DATA_FORMAT_PERCENT;
                            } else {
                                value.set(empty);
                            }
                        }
                    } break;
                    default: {} break;
                }

                retval[insert_idx].set(value);
            }
        }
    }

    return retval;
}

std::map<std::pair<t_uindex, t_uindex>, t_tscalar>
t_ctx2::get_selection_summarize(std::vector<t_selection_info> selections) const {
    bool flat_mode = has_pivot_view_flat();
    auto column_only = m_config.is_column_only();
    t_index num_aggs = m_config.get_num_aggregates();
    std::map<std::pair<t_uindex, t_uindex>, t_tscalar> value_map;
    t_uindex ctx_nrows = get_row_count();
    t_uindex ctx_ncols = get_column_count();
    if (flat_mode && column_only && num_aggs >= 1) {
        ctx_ncols += 1;
    }
    for (t_uindex idx = 0, ssize = selections.size(); idx < ssize; ++idx) {
        auto selection = selections[idx];
        t_index start_col = selection.start_col;
        t_index end_col = selection.end_col + 1;
        t_index start_row = selection.start_row;
        t_index end_row = selection.end_row + 1;
        std::map<t_uindex, t_uindex> idx_map = selection.index_map;
        t_index new_start_col = start_col;
        if (!flat_mode && !column_only) {
            if (start_col == 0) {
                for (t_index ridx = start_row; ridx < end_row; ++ridx) {
                    auto row_paths = unity_get_row_path(ridx);
                    if (row_paths.size() > 0) {
                        auto v = *row_paths.begin();
                        auto vpair = std::pair<std::pair<t_uindex, t_uindex>, t_tscalar>(std::pair<t_uindex, t_uindex>(0, ridx), v);
                        value_map.insert(vpair);
                    }
                }
                new_start_col = 1;
            }
        }
        if (new_start_col < end_col) {
            auto ext = sanitize_get_data_extents(
                    ctx_nrows, ctx_ncols, start_row, end_row, new_start_col, end_col);
            t_index stride = ext.m_ecol - ext.m_scol;
            auto data = get_data(start_row, end_row, new_start_col, end_col, idx_map);
            for (t_uindex cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
                for (t_uindex ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
                    auto v = data[(ridx - ext.m_srow) * stride + (cidx - ext.m_scol)];
                    auto vpair = std::pair<std::pair<t_uindex, t_uindex>, t_tscalar>(std::pair<t_uindex, t_uindex>(cidx, ridx), v);
                    value_map.insert(vpair);
                }
            }
        }
    }

    return value_map;
}

std::vector<std::vector<t_tscalar>>
t_ctx2::get_flat_mode_row_paths(t_uindex srow, t_uindex erow) const {
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

void
t_ctx2::update_data_format(const std::vector<t_data_format_spec>& data_formats) {
    std::map<std::string, t_dataformattype> df_type_map;
    for (t_uindex df_idx = 0, loop_end = data_formats.size(); df_idx < loop_end; ++df_idx) {
        auto data_format = data_formats[df_idx];
        df_type_map[data_format.get_name()] = data_format.get_type();
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
    for (t_uindex treeidx = 0, tree_loop_end = m_trees.size(); treeidx < tree_loop_end;
    ++treeidx) {
        auto stree = m_trees[treeidx];
        auto aggtable = stree->get_aggtable();
        aggtable->update_data_formats(agg_data_formats);

        auto running_tbl = stree->get_running_table();
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

        auto name_depth_map = stree->get_pivot_map();
        std::map<t_depth, t_dataformattype> df_depth_map;
        for (t_uindex df_idx = 0, loop_end = data_formats.size(); df_idx < loop_end; ++df_idx) {
            auto data_format = data_formats[df_idx];
            auto df_name = data_format.get_name();
            if (name_depth_map.find(df_name) != name_depth_map.end()) {
                df_depth_map[name_depth_map[df_name]] = data_format.get_type();
            }
        }
        if (df_depth_map.size() > 0) {
            stree->update_data_format_depth(df_depth_map);
        }
    }
}

bool
t_ctx2::has_row_path() const {
    auto num_aggs = m_config.get_num_aggregates();
    if (m_config.is_column_only() && num_aggs <= 1 && has_pivot_view_flat()) {
        return true;
    }
    if (!m_config.is_column_only() || num_aggs == 1 || num_aggs == 0 || has_row_combined()) {
        return true;
    }
    return false;
}

bool
t_ctx2::has_row_combined() const {
    return m_config.has_row_combined();
}

bool
t_ctx2::has_pivot_view_flat() const {
    return m_config.is_pivot_view_flat_mode();
}

std::map<std::string, std::string>
t_ctx2::longest_text_cols(std::vector<std::vector<t_tscalar>> column_names) const {
    printf( "t_ctx2::longest_text_cols\n");

    auto flat_mode = has_pivot_view_flat();
    std::vector<std::string> row_pivots;
    auto rpivots = m_config.get_row_pivots();
    auto num_rpivots = m_config.get_num_rpivots();
    auto row_combined = has_row_combined();
    t_index n_aggs = m_config.get_num_aggregates();
    for (t_index idx = 0, rsize = rpivots.size(); idx < rsize; ++idx) {
        row_pivots.push_back(rpivots[idx].colname());
    }
    std::map<std::string, std::string> text_cols;

    t_uindex ctx_nrows = get_row_count();
    t_uindex ctx_ncols = get_column_count();
    if (m_config.is_column_only() && flat_mode && n_aggs <= 1) {
        ctx_ncols++;
    }
    auto ext = sanitize_get_data_extents(
        ctx_nrows, ctx_ncols, 0, 20, 0, ctx_ncols);

    std::vector<std::pair<t_uindex, t_uindex>> cells;
    for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
        for (t_index cidx = ext.m_scol; cidx < ext.m_ecol; ++cidx) {
            cells.push_back(std::pair<t_index, t_index>(ridx, cidx));
        }
    }

    auto cells_info = resolve_cells(cells);

    t_index nrows = ext.m_erow - ext.m_srow;
    t_index stride = ext.m_ecol - ext.m_scol;

    t_tscalar empty = mknone();

    typedef std::pair<t_uindex, t_uindex> t_aggpair;
    std::map<t_aggpair, const t_column*> aggmap;

    for (t_uindex treeidx = 0, tree_loop_end = m_trees.size(); treeidx < tree_loop_end;
         ++treeidx) {
        auto aggtable = m_trees[treeidx]->get_aggtable();
        t_schema aggschema = aggtable->get_schema();

        for (t_uindex aggidx = 0, agg_loop_end = m_config.get_num_aggregates();
             aggidx < agg_loop_end; ++aggidx) {
            const std::string& aggname = aggschema.m_columns[aggidx];

            aggmap[t_aggpair(treeidx, aggidx)] = aggtable->get_const_column(aggname).get();
        }
    }

    const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();

    std::string colname = "";
    std::string str = "";

    // Add longest text for start col is 0
    if (ext.m_scol == 0 && (!flat_mode || (m_config.is_column_only() && flat_mode && n_aggs <= 1))) {
        colname = "__ROW_PATH__";
        if (has_row_path()) {
            for (auto ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
                auto r_paths = m_config.is_column_only() ? unity_get_row_header(ridx) : unity_get_row_path(ridx);
                if (r_paths.size() > 0) {
                    auto str_val = r_paths[0].to_string();
                    if (str_val.size() > str.size()) {
                        str = str_val;
                    }
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

    t_index decrea_idx = ((num_rpivots > 0 || row_combined) && !flat_mode) ? 1 : 0;
    if (m_config.is_column_only() && flat_mode && n_aggs <= 1) {
        decrea_idx = 1;
    }

    // Add longest texts for other column
    for (t_index cidx = std::max(ext.m_scol, t_index(!flat_mode ? ((num_rpivots > 0 || row_combined) ? 1 : 0) : row_pivots.size())); cidx < ext.m_ecol; ++cidx) {
        //t_index psize = column_names[cidx - (!flat_mode ? 1 : 0)].size();
        if (cidx - decrea_idx >= column_names.size()) {
            continue;
        }
        t_index psize = column_names[cidx - decrea_idx].size();

        // Add first path to column name
        colname = psize > 0 ? column_names[cidx - decrea_idx][0].to_string() : "";

        // Add other paths to column name
        for (t_index idx = 1; idx < psize; ++idx) {
            colname += "|" + column_names[cidx - decrea_idx][idx].to_string();
        }
        str = "";
        for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
            t_index insert_idx = (ridx - ext.m_srow) * stride + (cidx - ext.m_scol);
            const t_cellinfo& cinfo = cells_info[insert_idx];

            if (cinfo.m_idx >= 0) {
                // Check aggregate index here
                auto aggpair = t_aggpair(cinfo.m_treenum, cinfo.m_agg_index);
                auto mit = aggmap.find(aggpair);
                if (mit == aggmap.end()) {
                    continue;
                }
                auto aggcol = mit->second;

                t_index p_idx = m_trees[cinfo.m_treenum]->get_parent_idx(cinfo.m_idx);

                t_uindex agg_ridx = m_trees[cinfo.m_treenum]->get_aggidx(cinfo.m_idx);

                t_uindex agg_pridx = p_idx == INVALID_INDEX
                    ? INVALID_INDEX
                    : m_trees[cinfo.m_treenum]->get_aggidx(p_idx);

                auto value = extract_aggregate(
                    aggspecs[cinfo.m_agg_index], aggcol, agg_ridx, agg_pridx);

                if (!value.is_valid())
                    value.set(empty);

                auto str_val = value.to_string();
                if (str_val.size() > str.size()) {
                    str = str_val;
                }
            }
        }
        text_cols[colname] = str;
    }
    printf( "t_ctx2::longest_text_cols--ended\n");

    return text_cols;
}

std::map<std::string, double>
t_ctx2::get_default_binning(const std::string& colname) const {
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
t_ctx2::get_truncated_columns() const {
    auto tree = m_trees[m_trees.size() - 1];
    auto aggtable = tree->get_aggtable();
    return aggtable->get_truncated_columns();
}

void
t_ctx2::column_sort_by(const std::vector<t_sortspec>& sortby) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    m_ctraversal->sort_by(m_config, sortby, *(ctree().get()));
}

void
t_ctx2::sort_by(const std::vector<t_sortspec>& sortby) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    m_sortby = sortby;
    if (m_sortby.empty()) {
        return;
    }
    m_rtraversal->sort_by(m_config, sortby, *(rtree().get()), this);
}

void
t_ctx2::reset_sortby() {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    m_sortby = std::vector<t_sortspec>();
}

void
t_ctx2::notify(const t_table& flattened, const t_table& delta, const t_table& prev,
    const t_table& current, const t_table& transitions, const t_table& existed) {
    psp_log_time(repr() + " notify.enter");

    // init saved mask
    t_mask saved_msk(flattened.size());
    for (t_index idx = 0, flat_size = flattened.size(); idx < flat_size; ++idx) {
        saved_msk.set(idx, true);
    }

    t_uindex tidx = 0;
    m_config.set_num_trees(m_trees.size());

    for (t_uindex tree_idx = 0, loop_end = m_trees.size(); tree_idx < loop_end; ++tree_idx) {
        tidx++;
        m_config.set_current_tree_idx(tidx);
        m_config.reset_percentage_for_new_tree();
        if (is_ctree_idx(tree_idx)) {
            notify_sparse_tree(ctree(), m_ctraversal, true, m_config.get_aggregates(),
                m_config.get_sortby_pairs(), m_column_sortby, std::vector<t_fterm>(),
                flattened, delta, prev, current, transitions, existed, m_config, *m_state,
                m_default_binning, saved_msk, true, this);
            saved_msk = ctree()->get_saved_mask();
        } else if (is_rtree_idx(tree_idx)) {
            notify_sparse_tree(rtree(), m_rtraversal, true, m_config.get_aggregates(),
                m_config.get_sortby_pairs(), m_row_sortby, std::vector<t_fterm>(),
                flattened, delta, prev, current, transitions, existed, m_config, *m_state,
                m_default_binning, saved_msk, false, this);
            saved_msk = ctree()->get_saved_mask();
        } else {
            notify_sparse_tree(m_trees[tree_idx], std::shared_ptr<t_traversal>(0), false,
                m_config.get_aggregates(), m_config.get_sortby_pairs(),
                std::vector<t_sortspec>(), std::vector<t_fterm>(), flattened, delta, prev,
                current, transitions, existed, m_config, *m_state, m_default_binning, saved_msk, false, this);
            saved_msk = ctree()->get_saved_mask();
        }

        if (m_config.get_cancel_query_status()) {
            return;
        }
    }

    if (!m_sortby.empty()) {
        sort_by(m_sortby);
    }
    psp_log_time(repr() + " notify.exit");
}

t_uindex
t_ctx2::calc_translated_colidx(t_uindex n_aggs, t_uindex cidx) const {
    switch (m_config.get_totals()) {
        case TOTALS_BEFORE: {
            return (cidx - 1) / n_aggs;
        } break;
        case TOTALS_AFTER: {
            return (cidx - 1) / n_aggs;
        } break;
        case TOTALS_HIDDEN: {
            return (cidx - 1) / n_aggs + 1;
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Unknown totals type encountered.");
            return -1;
        }
    }
}

std::vector<t_cellinfo>
t_ctx2::resolve_cells(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const {
    std::vector<t_cellinfo> rval(cells.size());
    std::vector<std::pair<t_index, t_index>> c_indices;
    get_column_aggregate_info(c_indices);
    std::vector<t_index> c_tvindices = get_ctraversal_indices();
    auto rsubtotal_map = m_config.get_subtotal_map_by_type();

    std::vector<std::vector<t_tscalar>> col_paths(m_ctraversal->size() + 1);

    for (t_index cidx = 0, loop_end = c_tvindices.size(); cidx < loop_end; ++cidx) {
        auto translated = c_tvindices[cidx];
        const t_tvnode& c_tvnode = m_ctraversal->get_node(translated);
        //col_paths[cidx].reserve(m_config.get_num_cpivots());
        col_paths[translated].reserve(m_config.get_num_cpivots());
        //col_paths[cidx] = get_column_path(c_tvnode);
        col_paths[translated] = get_column_path(c_tvnode);
    }

    t_uindex ncols = get_num_view_columns();
    t_uindex nrows = get_row_count();
    bool flat_mode = has_pivot_view_flat();
    bool row_combined = has_row_combined();
    auto n_row_pivots = m_config.get_num_rpivots();
    t_index n_aggs = m_config.get_num_aggregates();
    auto column_only = m_config.is_column_only();
    t_uindex num_rpivots = m_config.get_num_rpivots() + ((n_aggs > 1 && row_combined) ? 1 : 0);
    if (column_only && flat_mode && n_aggs == 1) {
        ncols += 1;
    }

    for (t_index idx = 0, loop_end = cells.size(); idx < loop_end; ++idx) {
        const auto& cell = cells[idx];

        t_uindex first_val = cell.first;
        if ((!flat_mode && cell.second == 0 && !(!row_combined && n_aggs > 1 && column_only)) || cell.first >= nrows
            || cell.second >= ncols || n_aggs == 0 || (flat_mode && cell.second < num_rpivots)) {
            rval[idx].m_idx = INVALID_INDEX;
            continue;
        } else if (cell.first == nrows || (!row_combined && !flat_mode && cell.first == m_rtraversal->size())) {
            first_val = 0;
        }

        t_indiceinfo r_indice;
        if (row_combined || flat_mode) {
            r_indice = m_rtraversal_indices[first_val];
            if (!r_indice.m_show_data) {
                rval[idx].m_idx = INVALID_INDEX;
                continue;
            }
            first_val = r_indice.m_idx;
        }

        const t_tvnode& r_tvnode = m_rtraversal->get_node(first_val);
        t_index r_ptidx = r_tvnode.m_tnid;
        t_depth r_depth = r_tvnode.m_depth;

        // Check can show subtotal for depth and expanded
        if (!rsubtotal_map[r_depth] && r_tvnode.m_expanded) {
            rval[idx].m_idx = INVALID_INDEX;
            continue;
        }
        std::vector<t_tscalar> r_path = get_row_path(r_tvnode);
        /*t_index agg_idx = (cell.second - 1) % n_aggs;
        t_uindex translated_cidx = calc_translated_colidx(n_aggs, cell.second);

        if (translated_cidx >= c_tvindices.size()) {
            rval[idx].m_idx = INVALID_INDEX;
            continue;
        }

        t_index c_tvidx = c_tvindices[translated_cidx];

        rval[idx].m_ridx = cell.first;
        rval[idx].m_cidx = cell.second;

        if (c_tvidx >= t_index(m_ctraversal->size())) {
            rval[idx].m_idx = INVALID_INDEX;
            continue;
        }

        const t_tvnode& c_tvnode = m_ctraversal->get_node(c_tvidx);
        t_index c_ptidx = c_tvnode.m_tnid;
        const std::vector<t_tscalar>& c_path = col_paths[translated_cidx];
        
        rval[idx].m_agg_index = agg_idx;
        */

        t_uindex second_val = cell.second - ((column_only && flat_mode && n_aggs == 1) ? 1 : 0);

        auto indice_idx = second_val - (flat_mode ? (num_rpivots - 1) : 0);
        if (!row_combined && n_aggs > 1 && column_only && !flat_mode) {
            indice_idx = indice_idx + 1;
        }
        auto c_indice = c_indices[indice_idx];
        if (c_indice.second == -1) {
            rval[idx].m_idx = INVALID_INDEX;
            continue;
        }
        t_index c_tvidx = c_indice.first;

        rval[idx].m_ridx = cell.first;
        rval[idx].m_cidx = cell.second;

        if (c_tvidx >= t_index(m_ctraversal->size())) {
            rval[idx].m_idx = INVALID_INDEX;
            continue;
        }

        const t_tvnode& c_tvnode = m_ctraversal->get_node(c_tvidx);
        t_index c_ptidx = c_tvnode.m_tnid;
        const std::vector<t_tscalar>& c_path = col_paths[c_tvidx];
        
        if (row_combined) {
            rval[idx].m_agg_index = r_indice.m_agg_index;
        } else {
            rval[idx].m_agg_index = c_indice.second;
        }

        if (first_val == 0 || (row_combined && column_only)) {
            rval[idx].m_idx = c_ptidx;
            rval[idx].m_treenum = 0;
        }/* else if (c_path.size() == 0 || c_tvidx == 0) {
            rval[idx].m_idx = r_ptidx;
            rval[idx].m_treenum = m_trees.size() - 1;
        }*/ else {
            t_index tree_idx = r_depth;
            rval[idx].m_treenum = tree_idx;

            if (r_depth + 1 == static_cast<t_depth>(m_trees.size())) {
                rval[idx].m_idx = m_trees[tree_idx]->resolve_path(r_ptidx, c_path);
            } else {
                t_index path_ptidx = m_trees[tree_idx]->resolve_path(0, r_path);
                if (path_ptidx < 0) {
                    rval[idx].m_idx = INVALID_INDEX;
                } else {
                    rval[idx].m_idx = m_trees[tree_idx]->resolve_path(path_ptidx, c_path);
                }
            }
        }
    }
    return rval;
}

void
t_ctx2::update_rtraversal_indices() {
    if (has_row_combined() || has_pivot_view_flat()) {
        m_rtraversal_indices = {};
        if (m_config.is_column_only()) {
            for (t_index aggidx = 0, num_aggs = m_config.get_num_aggregates(); aggidx < num_aggs; ++aggidx) {
                m_rtraversal_indices.push_back(t_indiceinfo{0, true, aggidx, 0});
            }
        } else {
            m_rtraversal->get_row_indices_vector(m_rtraversal_indices, m_config.get_combined_index(),
                has_row_combined() ? m_config.get_num_aggregates() : 0, m_config.get_subtotal_map_by_type(), has_pivot_view_flat());
        }
    }
}

t_index
t_ctx2::sidedness() const {
    return 2;
}

t_uindex
t_ctx2::is_rtree_idx(t_uindex idx) const {
    return idx == m_trees.size() - 1;
}

t_uindex
t_ctx2::is_ctree_idx(t_uindex idx) const {
    return idx == 0;
}

std::shared_ptr<t_stree>
t_ctx2::rtree() {
    return m_trees.back();
}

std::shared_ptr<const t_stree>
t_ctx2::rtree() const {
    return m_trees.back();
}

std::shared_ptr<t_stree>
t_ctx2::ctree() {
    return m_trees.front();
}

std::shared_ptr<const t_stree>
t_ctx2::ctree() const {
    return m_trees.front();
}

t_uindex
t_ctx2::get_num_view_columns() const {
    t_index num_aggs = m_config.get_num_aggregates();
    switch (m_config.get_totals()) {
        case TOTALS_AFTER:
        case TOTALS_BEFORE: {
            if (has_pivot_view_flat()) {
                if (has_row_combined()) {
                    return m_config.get_num_rpivots() + m_ctraversal->size() + (num_aggs <= 1 ? 0 : 1);
                }
                return m_config.get_num_rpivots() + m_ctraversal->size() * std::max(t_index(1), num_aggs);
            }
            if (has_row_combined() || num_aggs == 0) {
                return m_ctraversal->size() + 1;
            }
            return m_ctraversal->size() * num_aggs + 1;
        } break;
        case TOTALS_HIDDEN: {
            if (has_row_combined() || num_aggs == 0) {
                return m_ctraversal->size();
            }
            t_index nitems = (m_ctraversal->size() - 1) * num_aggs;
            return nitems + 1;
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Unknown totals type");
            return -1;
        }
    }
    PSP_COMPLAIN_AND_ABORT("Not implemented");
    return 0;
}

std::vector<t_tscalar>
t_ctx2::get_row_path(t_index idx) const {
    if (idx < 0)
        return std::vector<t_tscalar>();
    return ctx_get_path(rtree(), m_rtraversal, idx);
}

std::vector<t_tscalar>
t_ctx2::get_row_path(const t_tvnode& node) const {
    std::vector<t_tscalar> rval;
    m_trees.back()->get_path(node.m_tnid, rval);
    return rval;
}

std::vector<t_tscalar>
t_ctx2::get_column_path(t_index idx) const {
    if (idx < 0)
        return std::vector<t_tscalar>();
        
    if (idx == 0 || idx == m_ctraversal->size()) {
        return std::vector<t_tscalar>();
    }
    return ctx_get_path(ctree(), m_ctraversal, idx);
}

std::vector<t_tscalar>
t_ctx2::get_column_path(const t_tvnode& node) const {
    std::vector<t_tscalar> rval;
    if (node.m_tnid == 0 || node.m_tnid == m_trees[0]->size()) {
        return std::vector<t_tscalar>();
    }
    m_trees[0]->get_path(node.m_tnid, rval);
    return rval;
}

std::vector<t_tscalar>
t_ctx2::get_column_path_userspace(t_index idx) const {
    t_index translated_idx = translate_column_index(idx);
    if (translated_idx == INVALID_INDEX) {
        return std::vector<t_tscalar>();
    }
    return get_column_path(translated_idx);
}

t_index
t_ctx2::translate_column_index(t_index idx) const {
    t_index rval = INVALID_INDEX;

    switch (m_config.get_totals()) {
        case TOTALS_BEFORE: {
            if (m_config.get_num_aggregates() == 0 || has_row_combined()) {
                rval = idx - 1;
            } else {
                rval = (idx - 1) / m_config.get_num_aggregates();
            }
        } break;
        case TOTALS_AFTER: {
            std::vector<t_index> col_order;
            m_ctraversal->post_order(0, col_order);
            if (m_config.get_num_aggregates() == 0 || has_row_combined()) {
                rval = col_order[idx - 1];
            } else {
                rval = col_order[(idx - 1) / m_config.get_num_aggregates()];
            }
        } break;
        case TOTALS_HIDDEN: {
            std::vector<t_index> leaves;
            m_ctraversal->get_leaves(leaves);
            //rval = leaves[(idx - 1) / m_config.get_num_aggregates()];
            t_index tempidx = idx - 1;
            if (m_config.get_num_aggregates() > 0) {
                tempidx = (idx - 1) / m_config.get_num_aggregates();
            }
            if (leaves.size() == tempidx) {
                rval = 0;
            } else {
                rval = leaves[tempidx];
            }
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Unknown totals type encountered."); }
    }

    return rval;
}

const std::vector<t_aggspec>&
t_ctx2::get_aggregates() const {
    return m_config.get_aggregates();
}

t_tscalar
t_ctx2::get_aggregate_name(t_uindex idx) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    t_tscalar s;
    if (idx >= m_config.get_num_aggregates())
        return s;
    s.set(m_config.get_aggregates()[idx].name_scalar());
    return s;
}

void
t_ctx2::set_depth(t_header header, t_depth depth) {
    t_depth new_depth;

    switch (header) {
        case HEADER_ROW: {
            if (m_config.get_num_rpivots() == 0) {
                if (has_row_combined() || has_pivot_view_flat()) {
                    // Update row traversal indices vector
                    update_rtraversal_indices();
                }
                return;
            }
            new_depth = std::min<t_depth>(m_config.get_num_rpivots() - 1, depth);
            m_rtraversal->set_depth(m_row_sortby, new_depth);
            m_row_depth = new_depth;
            m_row_depth_set = true;
            if (has_row_combined() || has_pivot_view_flat()) {
                // Update row traversal indices vector
                update_rtraversal_indices();
            }
        } break;
        case HEADER_COLUMN: {
            if (m_config.get_num_cpivots() == 0)
                return;
            new_depth = std::min<t_depth>(m_config.get_num_cpivots() - 1, depth);
            m_ctraversal->set_depth(m_column_sortby, new_depth);
            m_column_depth = new_depth;
            m_column_depth_set = true;
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Invalid header"); } break;
    }
}

std::vector<t_tscalar>
t_ctx2::get_pkeys(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const {
    std::unordered_set<t_tscalar> all_pkeys;

    auto tree_info = resolve_cells(cells);
    for (t_index idx = 0, loop_end = tree_info.size(); idx < loop_end; ++idx) {

        const auto& cinfo = tree_info[idx];
        if (cinfo.m_idx != INVALID_INDEX) {
            auto node_pkeys = m_trees[cinfo.m_treenum]->get_pkeys(cinfo.m_idx);
            std::copy(node_pkeys.begin(), node_pkeys.end(),
                std::inserter(all_pkeys, all_pkeys.end()));
        }
    }

    std::vector<t_tscalar> rval(all_pkeys.size());
    std::copy(all_pkeys.begin(), all_pkeys.end(), rval.begin());
    return rval;
}

std::vector<t_tscalar>
t_ctx2::get_cell_data(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const {
    std::vector<t_tscalar> rval(cells.size());
    t_tscalar empty;
    empty.set(std::int64_t(0));

    auto tree_info = resolve_cells(cells);

    for (t_index idx = 0, loop_end = tree_info.size(); idx < loop_end; ++idx) {
        const auto& cinfo = tree_info[idx];
        if (cinfo.m_idx == INVALID_INDEX) {
            rval[idx].set(empty);
        } else {
            rval[idx].set(
                m_trees[cinfo.m_treenum]->get_aggregate(cinfo.m_idx, cinfo.m_agg_index));
        }
    }
    return rval;
}

/**
 * @brief Returns updated cells.
 *
 * @param bidx
 * @param eidx
 * @return t_stepdelta
 */
t_stepdelta
t_ctx2::get_step_delta(t_index bidx, t_index eidx) {
    t_uindex start_row = bidx;
    t_uindex end_row = eidx;
    t_uindex start_col = 1;
    t_uindex end_col = get_num_view_columns();
    t_stepdelta rval;
    rval.rows_changed = true;
    rval.columns_changed = true;
    std::vector<t_cellupd>& updvec = rval.cells;

    t_uindex ctx_nrows = get_row_count();
    t_uindex ctx_ncols = get_column_count();
    auto ext = sanitize_get_data_extents(
        ctx_nrows, ctx_ncols, start_row, end_row, start_col, end_col);

    std::vector<std::pair<t_uindex, t_uindex>> cells;

    for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
        for (t_uindex cidx = 1; cidx < end_col; ++cidx) {
            cells.push_back(std::pair<t_index, t_index>(ridx, cidx));
        }
    }

    auto cells_info = resolve_cells(cells);

    for (const auto& c : cells_info) {
        if (c.m_idx < 0)
            continue;

        const auto& deltas = m_trees[c.m_treenum]->get_deltas();

        auto iterators = deltas->get<by_tc_nidx_aggidx>().equal_range(c.m_idx);

        for (auto iter = iterators.first; iter != iterators.second; ++iter) {
            updvec.push_back(
                t_cellupd(c.m_ridx, c.m_cidx, iter->m_old_value, iter->m_new_value));
        }
    }

    clear_deltas();
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
t_ctx2::get_row_delta(t_index bidx, t_index eidx) {
    t_uindex start_row = bidx;
    t_uindex end_row = eidx;
    t_uindex start_col = 1;
    t_uindex end_col = get_num_view_columns();
    std::vector<std::int32_t> rows;

    t_uindex ctx_nrows = get_row_count();
    t_uindex ctx_ncols = get_column_count();
    auto ext = sanitize_get_data_extents(
        ctx_nrows, ctx_ncols, start_row, end_row, start_col, end_col);

    std::vector<std::pair<t_uindex, t_uindex>> cells;

    // get cells and imbue with additional information
    for (t_index ridx = ext.m_srow; ridx < ext.m_erow; ++ridx) {
        for (t_uindex cidx = 1; cidx < end_col; ++cidx) {
            cells.push_back(std::pair<t_index, t_index>(ridx, cidx));
        }
    }

    auto cells_info = resolve_cells(cells);

    for (const auto& c : cells_info) {
        if (c.m_idx < 0)
            continue;
        const auto& deltas = m_trees[c.m_treenum]->get_deltas();
        auto iterators = deltas->get<by_tc_nidx_aggidx>().equal_range(c.m_idx);
        auto ridx = c.m_ridx;
        bool unique_ridx = std::find(rows.begin(), rows.end(), ridx) == rows.end();
        if ((iterators.first != iterators.second) && unique_ridx)
            rows.push_back(ridx);
    }

    std::sort(rows.begin(), rows.end());
    t_rowdelta rval(true, rows);
    clear_deltas();
    return rval;
}

const std::vector<t_minmax>&
t_ctx2::get_min_max() const {
    return m_minmax;
}

void
t_ctx2::reset() {
    for (t_uindex treeidx = 0, tree_loop_end = m_trees.size(); treeidx < tree_loop_end;
         ++treeidx) {
        std::vector<t_pivot> pivots;
        if (treeidx > 0 && !m_config.is_column_only()) {
            pivots.insert(pivots.end(), m_config.get_row_pivots().begin(),
                m_config.get_row_pivots().begin() + treeidx);
        }

        pivots.insert(pivots.end(), m_config.get_column_pivots().begin(),
            m_config.get_column_pivots().end());

        m_trees[treeidx]
            = std::make_shared<t_stree>(pivots, m_config.get_aggregates(), m_schema, m_config);
        m_trees[treeidx]->init();
        m_trees[treeidx]->set_deltas_enabled(get_feature_state(CTX_FEAT_DELTA));
    }

    m_rtraversal = std::make_shared<t_traversal>(rtree(), m_config.handle_nan_sort());
    m_ctraversal = std::make_shared<t_traversal>(ctree(), m_config.handle_nan_sort());
}

bool
t_ctx2::get_deltas_enabled() const {
    return m_features[CTX_FEAT_DELTA];
}

void
t_ctx2::reset_step_state() {
    m_rows_changed = false;
    m_columns_changed = false;
}

void
t_ctx2::clear_deltas() {
    for (auto& tr : m_trees) {
        tr->clear_deltas();
    }
}

void
t_ctx2::set_feature_state(t_ctx_feature feature, bool state) {
    m_features[feature] = state;
}

void
t_ctx2::set_alerts_enabled(bool enabled_state) {
    m_features[CTX_FEAT_ALERT] = enabled_state;
    for (auto& tr : m_trees) {
        tr->set_alerts_enabled(enabled_state);
    }
}

void
t_ctx2::set_deltas_enabled(bool enabled_state) {
    m_features[CTX_FEAT_DELTA] = enabled_state;
    for (auto& tr : m_trees) {
        tr->set_deltas_enabled(enabled_state);
    }
}

void
t_ctx2::set_minmax_enabled(bool enabled_state) {
    m_features[CTX_FEAT_MINMAX] = enabled_state;
    for (auto& tr : m_trees) {
        tr->set_minmax_enabled(enabled_state);
    }
}

std::vector<t_stree*>
t_ctx2::get_trees() {
    std::vector<t_stree*> rval(m_trees.size());
    t_uindex count = 0;
    for (auto& t : m_trees) {
        rval[count] = t.get();
        ++count;
    }
    return rval;
}

bool
t_ctx2::has_deltas() const {
    bool has_deltas = false;
    for (t_uindex idx = 0, loop_end = m_trees.size(); idx < loop_end; ++idx) {
        has_deltas = has_deltas || m_trees[idx]->has_deltas();
    }
    return has_deltas;
}

std::vector<t_sortspec>
t_ctx2::get_row_sortby(t_index depth) const {
    std::vector<t_sortspec> rval;
    for (t_index idx = 0, ssize = m_row_sortby.size(); idx < ssize; ++idx) {
        auto sort = m_row_sortby[idx];
        if (depth >= sort.m_agg_index) {
            rval.push_back(sort);
        }
    }
    return rval;
}

void
t_ctx2::notify(const t_table& flattened) {
    //update_data_formats();
    auto aggregates = m_config.get_aggregates();
    for (t_uindex aggidx = 0, aggsize = aggregates.size(); aggidx < aggsize; ++aggidx) {
        auto aggspec = aggregates[aggidx];
    }

    t_uindex tidx = 1;

    m_config.set_num_trees(m_trees.size() + 1);
    m_config.set_current_tree_idx(tidx);
    m_config.reset_percentage_for_new_tree();

    // init saved mask
    t_mask saved_msk(flattened.size());
    for (t_index idx = 0, flat_size = flattened.size(); idx < flat_size; ++idx) {
        saved_msk.set(idx, true);
    }

    // Update col path for limit
    notify_sparse_tree(ctree(), m_ctraversal, true, m_config.get_aggregates(),
        m_config.get_sortby_pairs(), m_column_sortby, std::vector<t_fterm>(),
        flattened, m_config, *m_state, m_default_binning, saved_msk, false, this);

    if (m_config.get_cancel_query_status()) {
        return;
    }

    //for (t_uindex tree_idx = 0, loop_end = m_trees.size(); tree_idx < loop_end; ++tree_idx) {
    for (t_index tree_idx = m_trees.size() - 1; tree_idx >= 0; --tree_idx) {
        tidx++;
        m_config.set_current_tree_idx(tidx);
        m_config.reset_percentage_for_new_tree();
        if (is_ctree_idx(tree_idx)) {
            notify_sparse_tree(ctree(), m_ctraversal, true, m_config.get_aggregates(),
                m_config.get_sortby_pairs(), m_column_sortby, std::vector<t_fterm>(),
                flattened, m_config, *m_state, m_default_binning, saved_msk, false, this);
            saved_msk = ctree()->get_saved_mask();
        } else if (is_rtree_idx(tree_idx)) {
            notify_sparse_tree(rtree(), m_rtraversal, true, m_config.get_aggregates(),
                m_config.get_sortby_pairs(), get_row_sortby(tree_idx - 1), m_config.get_hterms(tree_idx),
                flattened, m_config, *m_state, m_default_binning, saved_msk, true, this);
            saved_msk = rtree()->get_saved_mask();
        } else {
            notify_sparse_tree(m_trees[tree_idx], std::shared_ptr<t_traversal>(0), false,
                m_config.get_aggregates(), m_config.get_sortby_pairs(),
                get_row_sortby(tree_idx - 1), m_config.get_hterms(tree_idx),
                flattened, m_config, *m_state, m_default_binning, saved_msk, true, this);
            saved_msk = m_trees[tree_idx]->get_saved_mask();
        }

        if (m_config.get_cancel_query_status()) {
            return;
        }
    }

    if (m_trees.size() > 1) {
        rtree()->init_saved_mask(saved_msk);
        rtree()->update_show_nodes(m_config);
        m_rtraversal->populate_root_children(rtree());
    }
    if (m_row_sortby.size() > 0)
    {
        sort_by(m_row_sortby);
    }
}

void
t_ctx2::pprint() const {}

t_dtype
t_ctx2::get_column_dtype(t_uindex idx) const {
    t_uindex naggs = m_config.get_num_aggregates();

    if (idx == 0)
        return DTYPE_NONE;

    return rtree()->get_aggtable()->get_const_column((idx - 1) % naggs)->get_dtype();
}

std::vector<t_tscalar>
t_ctx2::unity_get_row_data(t_uindex idx) const {
    auto rval = get_data(idx, idx + 1, 0, get_column_count(), {});
    if (rval.empty())
        return std::vector<t_tscalar>();

    return std::vector<t_tscalar>(rval.begin() + 1, rval.end());
}

std::vector<t_tscalar>
t_ctx2::unity_get_column_data(t_uindex idx) const {
    PSP_COMPLAIN_AND_ABORT("Not implemented");
    return std::vector<t_tscalar>();
}

std::vector<t_tscalar>
t_ctx2::unity_get_row_path(t_uindex idx) const {
    if ((has_row_combined() || has_pivot_view_flat())) {
        if (m_config.is_column_only()) {
            const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
            auto aggname = aggspecs[idx].name();
            std::vector<t_tscalar> r_paths;
            r_paths.push_back(get_interned_tscalar(aggname));
            return r_paths;
        }
        if (idx >= m_rtraversal_indices.size()) {
            return std::vector<t_tscalar>();
        }
        t_indiceinfo rindice = m_rtraversal_indices[idx];
        auto combined_idx = m_config.get_combined_index();
        if (has_pivot_view_flat() && !has_row_combined()) {
            return get_row_path(rindice.m_idx);
        }
        auto tsize = m_rtraversal->size();
        if (combined_idx < rindice.m_depth) {
            const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
            auto r_paths = get_row_path(rindice.m_idx);
            auto aggname = aggspecs[rindice.m_agg_index].name();
            r_paths.insert(r_paths.begin() + (rindice.m_depth - combined_idx), get_interned_tscalar(aggname));
            return r_paths;
        } else if (combined_idx == rindice.m_depth && rindice.m_agg_index != -1 && !rindice.m_show_data) {
            const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
            auto r_paths = get_row_path(rindice.m_idx);
            auto aggname = aggspecs[rindice.m_agg_index].name();
            r_paths.insert(r_paths.begin(), get_interned_tscalar(aggname));
            return r_paths;
        }
        if (!rindice.m_show_data) {
            return get_row_path(rindice.m_idx);
        } else {
            const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
            auto r_paths = get_row_path(rindice.m_idx);
            auto aggname = aggspecs[rindice.m_agg_index].name();
            if (r_paths.size() == 0) {
                r_paths.push_back(get_interned_tscalar(aggname));
            } else {
                if (m_rtraversal->get_node_expanded(rindice.m_idx)) {
                    r_paths[0] = get_interned_tscalar(r_paths.begin()->to_string() + " " + aggname);
                } else {
                    r_paths.insert(r_paths.begin(), get_interned_tscalar(aggname));
                }
            }
            return r_paths;
        }
    }
    if (idx == get_row_count() - 1) {
        std::vector<t_tscalar> row_path;
        row_path.push_back(get_interned_tscalar("__ROW_TOTAL__"));
        return row_path;
    }
    return get_row_path(idx);
}

std::vector<std::int8_t>
t_ctx2::unity_get_row_path_extra(t_uindex idx) const {
    if (has_row_combined() && !m_config.is_column_only()) {
        if (idx >= m_rtraversal_indices.size()) {
            return std::vector<std::int8_t> {false, false};
        }
        t_indiceinfo rindice = m_rtraversal_indices[idx];
        auto combined_idx = m_config.get_combined_index();
        auto tsize = m_rtraversal->size();
        if (combined_idx < rindice.m_depth) {
            if (m_rtraversal->get_depth(rindice.m_idx) == m_config.get_num_rpivots() && rindice.m_show_data) {
                return std::vector<std::int8_t> {true, false};
            }
            return std::vector<std::int8_t> {false, false};
        }
        if (!rindice.m_show_data) {
            if ((m_rtraversal->get_depth(rindice.m_idx) == m_config.get_num_rpivots())
                || (m_rtraversal->get_depth(rindice.m_idx) == combined_idx && rindice.m_agg_index != -1)) {
                    return std::vector<std::int8_t> {false, false, true};
                }
            return std::vector<std::int8_t> {false, false};
        } else {
            if (m_rtraversal->get_node_expanded(rindice.m_idx)
                || m_rtraversal->get_depth(rindice.m_idx) == m_config.get_num_rpivots()) {
                return std::vector<std::int8_t> {true, false};
            } else {
                return std::vector<std::int8_t> {true, true};
            }
        }
    } else {
        if (idx >= m_rtraversal->size()) {
            return std::vector<std::int8_t> {false, false};
        }
        if (m_rtraversal->get_depth(idx) == m_config.get_num_rpivots()) {
            return std::vector<std::int8_t> {true, false};
        }
        return std::vector<std::int8_t> {false, false};
    }
}

std::vector<t_tscalar>
t_ctx2::unity_get_row_header(t_uindex idx) const {
    if (idx >= get_row_count()) {
        return std::vector<t_tscalar>();
    }

    const std::vector<t_aggspec> aggs = get_aggregates();
    if (idx >= aggs.size()) {
        return std::vector<t_tscalar>();
    }
    std::vector<std::string> aggregate_names;
    std::vector<t_tscalar> row_headers;
    for (const t_aggspec& agg : aggs) {
        aggregate_names.push_back(agg.name());
    }
    row_headers.push_back(get_aggregate_name(idx % aggregate_names.size()));

    return row_headers;
}

std::vector<t_tscalar>
t_ctx2::unity_get_column_path(t_uindex idx) const {
    auto rv = get_column_path_userspace(idx);
    return rv;
}

t_uindex
t_ctx2::unity_get_row_depth(t_uindex idx) const {
    if (has_row_combined() && !m_config.is_column_only()) {
        if (idx >= m_rtraversal_indices.size()) {
            return get_row_path(idx).size();
        } else {
            return get_row_path(m_rtraversal_indices[idx].m_idx).size();
        }
    } else {
        return get_row_path(idx).size();
    }
}

t_uindex
t_ctx2::unity_get_column_depth(t_uindex idx) const {
    return get_column_path(idx).size();
}

std::string
t_ctx2::unity_get_column_name(t_uindex idx) const {
    return m_config.unity_get_column_name(idx);
}

std::string
t_ctx2::unity_get_column_display_name(t_uindex idx) const {
    return m_config.unity_get_column_display_name(idx);
}

std::vector<std::string>
t_ctx2::unity_get_column_names() const {
    std::vector<std::string> rv;

    for (t_uindex idx = 0, loop_end = unity_get_column_count(); idx < loop_end; ++idx) {
        rv.push_back(unity_get_column_name(idx));
    }
    return rv;
}

std::vector<std::string>
t_ctx2::unity_get_column_display_names() const {
    std::vector<std::string> rv;

    // GAB: memory optim: do a first pass to compute the number of elements, to be able to reserve memory
    t_index count = 0;
    for (t_uindex idx = 0, loop_end = unity_get_column_count(); idx < loop_end; ++idx) {
        count++;
    }

    rv.reserve(count);
    for (t_uindex idx = 0, loop_end = unity_get_column_count(); idx < loop_end; ++idx) {
        rv.push_back(unity_get_column_display_name(idx));
    }
    return rv;
}

t_uindex
t_ctx2::unity_get_column_count() const {
    if (m_config.get_totals() != TOTALS_HIDDEN) {
        if (has_pivot_view_flat()) {
            return get_column_count();
        }
        return get_column_count() - 1;
    }
    std::vector<t_index> leaves;
    m_ctraversal->get_leaves(leaves);
    if (m_config.get_num_aggregates() == 0 || has_row_combined()) {
        return leaves.size();
    }
    return leaves.size() * m_config.get_num_aggregates();
}

bool
t_ctx2::get_show_leave() const {
    if (m_config.is_column_only() && m_config.get_num_aggregates() <= 1) {
        return false;
    }
    return true;
}

t_uindex
t_ctx2::unity_get_row_count() const {
    return get_row_count();
}

bool
t_ctx2::unity_get_row_expanded(t_uindex idx) const {
    if (has_row_combined() && !m_config.is_column_only()) {
        auto tsize = m_rtraversal->size();
        if (idx >= m_rtraversal_indices.size()) {
            return m_rtraversal->get_node_expanded(tsize);
        }
        t_indiceinfo r_indice = m_rtraversal_indices[idx];
        return m_rtraversal->get_node_expanded(r_indice.m_idx);
    } else {
        return m_rtraversal->get_node_expanded(idx);
    }
}

bool
t_ctx2::unity_get_column_expanded(t_uindex idx) const {

    return m_ctraversal->get_node_expanded(
        calc_translated_colidx(idx, m_config.get_num_aggregates()));
}

void
t_ctx2::unity_init_load_step_end() {}

void
t_ctx2::build_running_table(std::string col_name, t_show_type show_type) {
    if (show_type == SHOW_TYPE_RUNNING_TOTAL || show_type == SHOW_TYPE_RUNNING_PERCENT) {
        const std::vector<t_aggspec>& aggspecs = m_config.get_aggregates();
        t_aggspec aggspec;
        for (t_index idx = 0, aggsize = aggspecs.size(); idx < aggsize; ++idx) {
            if (col_name == aggspecs[idx].name()) {
                aggspec = aggspecs[idx];
                break;
            }
        }
        for (t_index tree_idx = m_trees.size() - 1; tree_idx >= 0; --tree_idx) {
            auto running_tbl = m_trees[tree_idx]->get_running_table();
            auto schema = running_tbl->get_schema();
            auto none = mknone();
            auto aggtable = m_trees[tree_idx]->get_aggtable();
            auto agg_col = aggtable->get_const_column(col_name).get();
            t_uindex treesize = m_trees[tree_idx]->size();
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
            for (t_index nidx = 0; nidx < treesize; ++nidx) {
                bool is_leaf = m_trees[tree_idx]->is_leaf(nidx);

                t_tscalar value = agg_col->get_scalar(nidx);
                if (!value.is_valid())
                    value.set(none); // todo: fix null handling
                
                if (!value.is_none() && is_leaf) {
                    running_total.set(running_total.to_double() + value.to_double());
                }
                if (!is_leaf && !value.is_none()) {
                    value.set(running_total.to_double() + value.to_double());
                } else if (nidx != 0) {
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
}

void
t_ctx2::update_column_name(const std::string& old_name, const std::string& new_name) {
    // Update column name for config
    m_config.update_column_name(old_name, new_name);

    std::map<std::string, std::string> col_map = {{new_name, old_name}};

    // Update column name for schema
    m_schema.rename_columns(col_map);

    // Update column name for trees
    for (t_index nidx = 0, treesize = m_trees.size(); nidx < treesize; ++nidx) {
        m_trees[nidx]->update_column_name(old_name, new_name);
    }
}

void
t_ctx2::update_show_type(std::string col_name, t_show_type show_type) {
    m_config.update_show_type(col_name, show_type);
    build_running_table(col_name, show_type);
}

void
t_ctx2::update_pagination_setting(t_index page_items, t_index page_num) {
    m_config.update_pagination_setting(page_items, page_num);
}

} // end namespace perspective
