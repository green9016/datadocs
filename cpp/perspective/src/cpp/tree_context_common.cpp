/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/filter.h>
#include <perspective/path.h>
#include <perspective/sparse_tree.h>
#include <perspective/table.h>
#include <perspective/traversal.h>
#include <perspective/env_vars.h>
#include <perspective/dense_tree.h>
#include <perspective/dense_tree_context.h>

namespace perspective {

void
notify_sparse_tree_common(std::shared_ptr<t_table> strands,
    std::shared_ptr<t_table> strand_deltas, std::shared_ptr<t_stree> tree,
    std::shared_ptr<t_traversal> traversal, bool process_traversal,
    const std::vector<t_aggspec>& aggregates,
    const std::vector<std::pair<std::string, std::string>>& tree_sortby,
    const std::vector<t_sortspec>& ctx_sortby, const std::vector<t_fterm>& ctx_fterms,
    const t_gstate& gstate, t_config& config, const t_table& flattened, bool is_row,
    t_ctx2* ctx2) {
    t_filter fltr;
    if (t_env::log_data_nsparse_strands()) {
        std::cout << "nsparse_strands" << std::endl;
        strands->pprint();
    }

    if (t_env::log_data_nsparse_strand_deltas()) {
        std::cout << "nsparse_strand_deltas" << std::endl;
        strand_deltas->pprint();
    }

    auto pivots = tree->get_pivots();

    /*std::cout << "ctx_sortby ======== " << ctx_sortby.size() << std::endl;
    for (t_index idx = 0, tsize = ctx_sortby.size(); idx < tsize; ++idx) {
        std::cout << "sort at index " << idx << " is m_agg_index=== " << ctx_sortby[idx].m_agg_index
            << " m_sort_type === " << ctx_sortby[idx].m_sort_type
            << " m_sortby_index === " << ctx_sortby[idx].m_sortby_index
            << " m_subtotal_index === " << ctx_sortby[idx].m_subtotal_index
            << " m_limit === " << ctx_sortby[idx].m_limit << std::endl;
    }

    std::cout << "ctx_fterms ======== " << ctx_fterms.size() << std::endl;
    for (t_index idx = 0, hsize = ctx_fterms.size(); idx < hsize; ++idx) {
        auto having = ctx_fterms[idx];
        std::cout << "having at index " << idx << " ====have m_colname " << having.m_colname
            << " ===m_level " << having.m_level << " ===m_filterby_index " << having.m_filterby_index
            << " ===m_subtotal_index " << having.m_subtotal_index << std::endl;
    }*/

    t_dtree dtree(strands, pivots, tree_sortby);
    dtree.init();

    // Init mask for sort and limit
    t_mask dt_msk = t_mask(strands->num_rows());
    for (t_index idx = 0, msize = dt_msk.size(); idx < msize; ++idx) {
        dt_msk.set(idx, true);
    }

    // Create row path for pivot
    // New: Add ctx_sortby parameter
    // sort and limit base on pivot column will applied here
    // before updating shape and calculating aggegated values
    dtree.check_pivot(fltr, pivots.size() + 1, config, dt_msk, ctx_sortby);

    if (config.get_cancel_query_status()) {
        return;
    }

    if (t_env::log_data_nsparse_dtree()) {
        std::cout << "nsparse_dtree" << std::endl;
        dtree.pprint(fltr);
    }

    t_dtree_ctx dctx(strands, strand_deltas, dtree, aggregates);

    dctx.init();

    // Update row path from dense tree context
    tree->update_shape_from_static(dctx, config);

    if (config.get_cancel_query_status()) {
        return;
    }

    auto zero_strands = tree->zero_strands();

    t_uindex t_osize = process_traversal ? traversal->size() : 0;
    if (process_traversal) {
        traversal->drop_tree_indices(zero_strands);
    }
    t_uindex t_nsize = process_traversal ? traversal->size() : 0;
    if (t_osize != t_nsize) {
        tree->set_has_deltas(true);
    }

    auto non_zero_ids = tree->non_zero_ids(zero_strands);
    auto non_zero_leaves = tree->non_zero_leaves(zero_strands);

    tree->drop_zero_strands();

    tree->populate_leaf_index(non_zero_leaves);

    // Update saved mask in case sort and limit
    tree->update_saved_mask(dt_msk);

    // Calculated aggregated value
    tree->update_aggs_from_static(dctx, gstate, config);

    if (config.get_cancel_query_status()) {
        return;
    }

    // Get sort and limit base on column values.
    std::vector<t_sortspec> sort_vec;
    for (const auto& s : ctx_sortby) {
        if (s.m_sortby_index != t_index(-1) && s.m_limit != t_index(-1)) {
            sort_vec.push_back(s);
        }
    }
    // Check sort, limit or having existed in context filters and sorts
    if (is_row && (ctx_fterms.size() > 0 || sort_vec.size() > 0)) {
        tree->update_limiting_having_tree(dctx, gstate, config, sort_vec, ctx_fterms, ctx2);
    }

    std::set<t_uindex> visited;

    struct t_leaf_path {
        std::vector<t_tscalar> m_path;
        t_uindex m_lfidx;
    };

    std::vector<t_leaf_path> leaf_paths(non_zero_leaves.size());

    t_uindex count = 0;

    for (auto lfidx : non_zero_leaves) {
        leaf_paths[count].m_lfidx = lfidx;
        tree->get_sortby_path(lfidx, leaf_paths[count].m_path);
        std::reverse(leaf_paths[count].m_path.begin(), leaf_paths[count].m_path.end());
        ++count;
    }

    std::sort(leaf_paths.begin(), leaf_paths.end(),
        [](const t_leaf_path& a, const t_leaf_path& b) { return a.m_path < b.m_path; });

    if (!leaf_paths.empty() && traversal.get() && traversal->size() == 1) {
        if (traversal->get_node(0).m_expanded) {
            traversal->populate_root_children(tree);
        }
    } else {
        for (const auto& lpath : leaf_paths) {
            t_uindex lfidx = lpath.m_lfidx;
            auto ancestry = tree->get_ancestry(lfidx);

            t_uindex num_tnodes_existed = 0;

            for (auto nidx : ancestry) {
                if (non_zero_ids.find(nidx) == non_zero_ids.end()
                    || visited.find(nidx) != visited.end()) {
                    ++num_tnodes_existed;
                } else {
                    break;
                }
            }

            if (process_traversal) {
                traversal->add_node(ctx_sortby, ancestry, num_tnodes_existed);
            }

            for (auto nidx : ancestry) {
                visited.insert(nidx);
            }
        }
    }

    /*auto aggtbl = tree->get_aggtable();
    auto aggschema = aggtbl->get_schema();
    for(t_uindex cidx = 0, size = aggschema.size(); cidx < size; ++cidx) {
        auto colname = aggschema.m_columns[cidx];
        std::cout << "==========colname " << colname << std::endl;
        auto col_ = aggtbl->get_column(colname).get();
        for (t_uindex ridx = 0, rsize = col_->size(); ridx < rsize; ++ridx) {
            auto value = col_->get_scalar(ridx);
            std::cout << "value at " << ridx << " is " << value.to_string() << std::endl;
        }
    }*/
}

void
notify_sparse_tree(std::shared_ptr<t_stree> tree, std::shared_ptr<t_traversal> traversal,
    bool process_traversal, const std::vector<t_aggspec>& aggregates,
    const std::vector<std::pair<std::string, std::string>>& tree_sortby,
    const std::vector<t_sortspec>& ctx_sortby, const std::vector<t_fterm>& ctx_fterms,
    const t_table& flattened, const t_table& delta, const t_table& prev, const t_table& current,
    const t_table& transitions, const t_table& existed, t_config& config, const t_gstate& gstate,
    std::map<std::string, std::vector<double>>& default_binning, t_mask msk, bool is_row, t_ctx2* ctx2) {

    tree->init_saved_mask(msk);

    std::map<t_index, t_index> period_map;
    std::vector<t_binning_info> binning_vec;
    auto strand_values = tree->build_strand_table(
        flattened, delta, prev, current, transitions, aggregates, config, period_map, binning_vec, default_binning);

    if (config.has_previous_filters()) {
        tree->update_period_map(period_map);
    }
    tree->update_binning_vec(binning_vec);
    
    if (config.get_cancel_query_status()) {
        return;
    }

    auto strands = strand_values.first;
    auto strand_deltas = strand_values.second;
    notify_sparse_tree_common(strands, strand_deltas, tree, traversal, process_traversal,
        aggregates, tree_sortby, ctx_sortby, ctx_fterms, gstate, config, flattened, is_row, ctx2);
}

void
notify_sparse_tree(std::shared_ptr<t_stree> tree, std::shared_ptr<t_traversal> traversal,
    bool process_traversal, const std::vector<t_aggspec>& aggregates,
    const std::vector<std::pair<std::string, std::string>>& tree_sortby,
    const std::vector<t_sortspec>& ctx_sortby, const std::vector<t_fterm>& ctx_fterms,
    const t_table& flattened, t_config& config, const t_gstate& gstate,
    std::map<std::string, std::vector<double>>& default_binning, t_mask msk,
    bool is_row, t_ctx2* ctx2) {

    tree->init_saved_mask(msk);

    std::map<t_index, t_index> period_map;
    std::vector<t_binning_info> binning_vec;
    auto strand_values = tree->build_strand_table(flattened, aggregates, config, period_map, binning_vec, default_binning);

    if (config.has_previous_filters()) {
        tree->update_period_map(period_map);
    }
    tree->update_binning_vec(binning_vec);
    
    if (config.get_cancel_query_status()) {
        return;
    }

    auto strands = strand_values.first;
    auto strand_deltas = strand_values.second;
    notify_sparse_tree_common(strands, strand_deltas, tree, traversal, process_traversal,
        aggregates, tree_sortby, ctx_sortby, ctx_fterms, gstate, config, flattened, is_row, ctx2);
}

std::vector<t_path>
ctx_get_expansion_state(
    std::shared_ptr<const t_stree> tree, std::shared_ptr<const t_traversal> traversal) {
    std::vector<t_path> paths;
    std::vector<t_index> expanded;
    traversal->get_expanded(expanded);

    paths.reserve(expanded.size());
    for (int i = 0, loop_end = expanded.size(); i < loop_end; i++) {
        std::vector<t_tscalar> path;
        tree->get_path(expanded[i], path);
        paths.push_back(t_path(path));
    }
    return paths;
}

std::vector<t_tscalar>
ctx_get_path(std::shared_ptr<const t_stree> tree, std::shared_ptr<const t_traversal> traversal,
    t_index idx) {
    if (idx < 0 || idx >= t_index(traversal->size())) {
        std::vector<t_tscalar> rval;
        return rval;
    }

    auto tree_index = traversal->get_tree_index(idx);
    std::vector<t_tscalar> rval;
    tree->get_path(tree_index, rval);
    return rval;
}

std::vector<t_ftreenode>
ctx_get_flattened_tree(t_index idx, t_depth stop_depth, t_traversal& trav,
    const t_config& config, const std::vector<t_sortspec>& sortby) {
    t_index ptidx = trav.get_tree_index(idx);
    trav.set_depth(sortby, stop_depth);
    if (!sortby.empty()) {
        trav.sort_by(config, sortby, *(trav.get_tree()));
    }
    t_index new_tvidx = trav.tree_index_lookup(ptidx, idx);
    return trav.get_flattened_tree(new_tvidx, stop_depth);
}

} // end namespace perspective
