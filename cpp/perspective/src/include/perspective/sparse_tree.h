/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#pragma once
#include <perspective/portable.h>
SUPPRESS_WARNINGS_VC(4503)

#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/exports.h>
#include <boost/multi_index_container.hpp>
#include <boost/multi_index/member.hpp>
#include <boost/multi_index/hashed_index.hpp>
#include <boost/multi_index/ordered_index.hpp>
#include <boost/multi_index/composite_key.hpp>
#include <perspective/sort_specification.h>
#include <perspective/sparse_tree_node.h>
#include <perspective/pivot.h>
#include <perspective/aggspec.h>
#include <perspective/step_delta.h>
#include <perspective/min_max.h>
#include <perspective/mask.h>
#include <perspective/sym_table.h>
#include <perspective/table.h>
#include <perspective/dense_tree.h>
#include <vector>
#include <algorithm>
#include <deque>
#include <sstream>
#include <queue>

namespace perspective {

class t_gstate;
class t_dtree_ctx;
class t_config;
class t_ctx2;

using boost::multi_index_container;
using namespace boost::multi_index;

typedef std::pair<t_depth, t_index> t_dptipair;
typedef std::vector<t_dptipair> t_dptipairvec;

struct by_idx {};

struct by_depth {};

struct by_pidx {};

struct by_pidx_hash {};

struct by_nstrands {};

struct by_idx_pkey {};

struct by_idx_lfidx {};

PERSPECTIVE_EXPORT t_tscalar get_dominant(std::vector<t_tscalar>& values);

struct t_build_strand_table_common_rval {
    t_schema m_flattened_schema;
    t_schema m_strand_schema;
    t_schema m_aggschema;
    t_uindex m_npivotlike;
    std::vector<std::string> m_pivot_like_columns;
    t_uindex m_pivsize;
    bool m_unnest = false;
    std::vector<t_agg_level_type> m_agg_level_vec;
    std::vector<t_binning_info> m_binning_vec;
};

typedef multi_index_container<t_stnode,
    indexed_by<
        ordered_unique<tag<by_idx>,
            BOOST_MULTI_INDEX_MEMBER(t_stnode, t_uindex, m_idx)>,
        hashed_non_unique<tag<by_depth>,
            BOOST_MULTI_INDEX_MEMBER(t_stnode, std::uint8_t, m_depth)>,
        hashed_non_unique<tag<by_nstrands>,
            BOOST_MULTI_INDEX_MEMBER(t_stnode, t_uindex, m_nstrands)>,
        ordered_unique<tag<by_pidx>,
            composite_key<t_stnode, BOOST_MULTI_INDEX_MEMBER(t_stnode, t_uindex, m_pidx),
                BOOST_MULTI_INDEX_MEMBER(t_stnode, t_tscalar, m_sort_value),
                BOOST_MULTI_INDEX_MEMBER(t_stnode, t_tscalar, m_value)>>,
        ordered_unique<tag<by_pidx_hash>,
            composite_key<t_stnode, BOOST_MULTI_INDEX_MEMBER(t_stnode, t_uindex, m_pidx),
                BOOST_MULTI_INDEX_MEMBER(t_stnode, t_tscalar, m_value)>>>>
    t_treenodes;

typedef multi_index_container<t_stpkey,
    indexed_by<ordered_unique<tag<by_idx_pkey>,
        composite_key<t_stpkey, BOOST_MULTI_INDEX_MEMBER(t_stpkey, t_uindex, m_idx),
            BOOST_MULTI_INDEX_MEMBER(t_stpkey, t_tscalar, m_pkey)>>>>
    t_idxpkey;

typedef multi_index_container<t_stleaves,
    indexed_by<ordered_unique<tag<by_idx_lfidx>,
        composite_key<t_stleaves, BOOST_MULTI_INDEX_MEMBER(t_stleaves, t_uindex, m_idx),
            BOOST_MULTI_INDEX_MEMBER(t_stleaves, t_uindex, m_lfidx)>>>>
    t_idxleaf;

typedef t_treenodes::index<by_idx>::type index_by_idx;
typedef t_treenodes::index<by_pidx>::type index_by_pidx;

typedef t_treenodes::index<by_idx>::type::iterator iter_by_idx;
typedef t_treenodes::index<by_pidx>::type::iterator iter_by_pidx;
typedef t_treenodes::index<by_pidx_hash>::type::iterator iter_by_pidx_hash;
typedef t_treenodes::index<by_depth>::type::iterator iter_by_depth;
typedef std::pair<iter_by_pidx, iter_by_pidx> t_by_pidx_ipair;

typedef t_idxpkey::index<by_idx_pkey>::type::iterator iter_by_idx_pkey;

typedef std::pair<iter_by_idx_pkey, iter_by_idx_pkey> t_by_idx_pkey_ipair;

struct PERSPECTIVE_EXPORT t_agg_update_info {
    std::vector<const t_column*> m_src;
    std::vector<t_column*> m_dst;
    std::vector<t_aggspec> m_aggspecs;

    std::vector<t_uindex> m_dst_topo_sorted;
};

struct t_tree_unify_rec {
    t_tree_unify_rec(t_uindex sptidx, t_uindex daggidx, t_uindex saggidx, t_uindex nstrands);

    t_uindex m_sptidx;
    t_uindex m_daggidx;
    t_uindex m_saggidx;
    t_uindex m_nstrands;
};

typedef std::vector<t_tree_unify_rec> t_tree_unify_rec_vec;

class PERSPECTIVE_EXPORT t_stree {
public:
    typedef const t_stree* t_cptr;
    typedef std::shared_ptr<t_stree> t_sptr;
    typedef std::shared_ptr<const t_stree> t_csptr;
    typedef t_stnode t_tnode;
    typedef std::vector<t_stnode> t_tnodevec;

    typedef std::map<const char*, const char*, t_cmp_charptr> t_sidxmap;

    t_stree(const std::vector<t_pivot>& pivots, const std::vector<t_aggspec>& aggspecs,
        const t_schema& schema, const t_config& cfg);
    ~t_stree();

    void init();

    std::string repr() const;

    t_tscalar get_value(t_index idx) const;
    t_tscalar get_sortby_value(t_index idx) const;

    void build_strand_table_phase_1(t_tscalar pkey, t_op op, t_uindex idx, t_uindex npivots,
        t_uindex strand_count_idx, t_uindex aggcolsize, bool force_current_row,
        const std::vector<const t_column*>& piv_pcolcontexts,
        const std::vector<const t_column*>& piv_tcols,
        const std::vector<const t_column*>& agg_ccols,
        const std::vector<const t_column*>& agg_dcols, std::vector<t_column*>& piv_scols,
        std::vector<t_column*>& agg_acols, t_column* agg_scountspar, t_column* spkey,
        t_uindex& insert_count, bool& pivots_neq,
        const std::vector<std::string>& pivot_like) const;

    void build_strand_table_phase_2(t_tscalar pkey, t_uindex idx, t_uindex npivots,
        t_uindex strand_count_idx, t_uindex aggcolsize,
        const std::vector<const t_column*>& piv_pcols,
        const std::vector<const t_column*>& agg_pcols, std::vector<t_column*>& piv_scols,
        std::vector<t_column*>& agg_acols, t_column* agg_scount, t_column* spkey,
        t_uindex& insert_count, const std::vector<std::string>& pivot_like) const;

    std::pair<std::shared_ptr<t_table>, std::shared_ptr<t_table>> build_strand_table(
        const t_table& flattened, const t_table& delta, const t_table& prev,
        const t_table& current, const t_table& transitions,
        const std::vector<t_aggspec>& aggspecs, t_config& config, std::map<t_index, t_index>& period_map,
        std::vector<t_binning_info>& binning_vec, std::map<std::string, std::vector<double>>& default_binning) const;

    std::pair<std::shared_ptr<t_table>, std::shared_ptr<t_table>> build_strand_table(
        const t_table& flattened, const std::vector<t_aggspec>& aggspecs,
        t_config& config, std::map<t_index, t_index>& period_map,
        std::vector<t_binning_info>& binning_vec, std::map<std::string, std::vector<double>>& default_binning) const;

    void update_shape_from_static(const t_dtree_ctx& ctx, t_config& config);
    void update_aggs_from_static(const t_dtree_ctx& ctx, const t_gstate& gstate, t_config& config);
    void update_tree_from_combined_field(const t_dtree_ctx& ctx, t_config& config);

    t_mask having_mask(t_config& config, const std::vector<t_fterm>& fterms_, t_uindex level,
        std::map<t_uindex, t_depth> dmap, t_mask cmsk, t_ctx2* ctx2);
    t_mask limiting_mask(t_sortspec sort, t_uindex level, std::map<t_uindex, t_depth> dmap,
        t_mask cmsk, bool handle_nan_sort, t_ctx2*);
    void recalculate_aggs_from_static(const t_dtree_ctx& ctx, t_depth level, std::map<t_uindex,
        t_depth> dmap, t_mask msk, const t_gstate& gstate, t_config& config);
    void update_limiting_having_tree(const t_dtree_ctx& ctx, const t_gstate& gstate, t_config& config,
        const std::vector<t_sortspec>& ctx_sortby, const std::vector<t_fterm>& ctx_fterms, t_ctx2*);

    t_uindex size() const;

    t_uindex get_num_children(t_uindex idx) const;
    void get_child_nodes(t_uindex idx, t_tnodevec& nodes) const;
    std::vector<t_uindex> zero_strands() const;

    std::set<t_uindex> non_zero_leaves(const std::vector<t_uindex>& zero_strands) const;

    std::set<t_uindex> non_zero_ids(const std::vector<t_uindex>& zero_strands) const;

    std::set<t_uindex> non_zero_ids(
        const std::set<t_uindex>& ptiset, const std::vector<t_uindex>& zero_strands) const;

    t_uindex get_parent_idx(t_uindex idx) const;
    std::vector<t_uindex> get_ancestry(t_uindex idx) const;

    t_index get_sibling_idx(t_index p_ptidx, t_index p_nchild, t_uindex c_ptidx) const;
    t_uindex get_aggidx(t_uindex idx) const;

    std::shared_ptr<const t_table> get_aggtable() const;

    std::shared_ptr<t_table> get_running_table();

    t_table* _get_aggtable();

    t_tnode get_node(t_uindex idx) const;

    void get_path(t_uindex idx, std::vector<t_tscalar>& path) const;
    void get_sortby_path(t_uindex idx, std::vector<t_tscalar>& path) const;

    t_uindex resolve_child(t_uindex root, const t_tscalar& datum) const;

    void drop_zero_strands();

    void add_pkey(t_uindex idx, t_tscalar pkey);
    void remove_pkey(t_uindex idx, t_tscalar pkey);
    void add_leaf(t_uindex nidx, t_uindex lfidx);
    void remove_leaf(t_uindex nidx, t_uindex lfidx);

    t_by_idx_pkey_ipair get_pkeys_for_leaf(t_uindex idx) const;
    t_depth get_depth(t_uindex ptidx) const;
    t_binning_info get_binning_info(t_uindex idx) const;
    t_tscalar format_with_binning(t_tscalar value, t_uindex idx) const;
    void get_drd_indices(t_uindex ridx, t_depth rel_depth, std::vector<t_uindex>& leaves) const;
    std::vector<t_uindex> get_leaves(t_uindex idx) const;
    std::vector<t_tscalar> get_pkeys(t_uindex idx) const;
    std::vector<t_tscalar> get_show_pkeys(t_uindex idx, bool has_previous_filters = false,
        t_period_type period_type = PERIOD_TYPE_NONE) const;
    std::vector<t_uindex> get_child_idx(t_uindex idx) const;
    std::vector<std::pair<t_index, t_index>> get_child_idx_depth(t_uindex idx) const;

    void populate_leaf_index(const std::set<t_uindex>& leaves);

    t_uindex last_level() const;

    const std::vector<t_pivot>& get_pivots() const;
    const std::map<std::string, t_depth> get_pivot_map() const;
    t_index resolve_path(t_uindex root, const std::vector<t_tscalar>& path) const;

    // aggregates should be presized to be same size
    // as agg_indices
    void get_aggregates_for_sorting(t_uindex nidx, const std::vector<t_index>& agg_indices,
        std::vector<t_tscalar>& aggregates, t_ctx2*, const std::vector<t_index>& subtotal_indices = {}) const;

    t_tscalar get_aggregate(t_index idx, t_index aggnum) const;

    void get_child_indices(t_index idx, std::vector<t_index>& out_data) const;

    void set_alerts_enabled(bool enabled_state);

    void set_deltas_enabled(bool enabled_state);

    void set_minmax_enabled(bool enabled_state);

    void set_feature_state(t_ctx_feature feature, bool state);

    template <typename ITER_T>
    t_minmax get_agg_min_max(ITER_T biter, ITER_T eiter, t_uindex aggidx) const;
    t_minmax get_agg_min_max(t_uindex aggidx, t_depth depth) const;
    std::vector<t_minmax> get_min_max() const;

    void init_saved_mask(t_mask msk);
    void update_saved_mask_for_leave(t_mask msk);
    void update_saved_mask(t_mask msk);
    t_mask get_saved_mask() const;
    void update_period_map(std::map<t_index, t_index> period_map);
    void update_binning_vec(std::vector<t_binning_info> binning_vec);
    void update_show_nodes(t_config config);
    void update_data_format_depth(std::map<t_depth, t_dataformattype> df_depth_map);

    void clear_deltas();

    const std::shared_ptr<t_tcdeltas>& get_deltas() const;

    void clear();

    t_tscalar first_last_helper(
        t_uindex nidx, const t_aggspec& spec, const t_gstate& gstate, bool has_previous_filters, t_period_type period_type) const;

    t_tscalar first_last_helper_with_pkeys(t_uindex nidx, const t_aggspec& spec, const t_gstate& gstate,
        std::vector<t_tscalar> pkeys) const;

    bool node_exists(t_uindex nidx);

    t_table* get_aggtable();

    void clear_aggregates(const std::vector<t_uindex>& indices);

    std::pair<iter_by_idx, bool> insert_node(const t_tnode& node);
    bool has_deltas() const;
    void set_has_deltas(bool v);

    std::vector<t_uindex> get_descendents(t_uindex nidx) const;

    t_bfs_iter<t_stree> bfs() const;
    t_dfs_iter<t_stree> dfs() const;
    void pprint() const;
    bool is_leaf(t_uindex nidx) const;

    void update_column_name(const std::string& old_name, const std::string& new_name);

protected:
    void mark_zero_desc();
    t_uindex get_num_aggcols() const;

    bool pivots_changed(t_value_transition t) const;
    t_uindex genidx();
    t_uindex gen_aggidx();
    std::vector<t_uindex> get_children(t_uindex idx) const;
    void update_agg_table(t_uindex nidx, t_agg_update_info& info, t_uindex src_ridx,
        t_uindex dst_ridx, t_index nstrands, const t_gstate& gstate, const t_config& config);
    void update_agg_table_with_having(t_uindex nidx, t_agg_update_info& info, t_uindex src_ridx,
        t_uindex dst_ridx, t_index nstrands, t_mask msk, t_depth level, std::map<t_uindex, t_depth> dmap,
        const t_gstate& gstate, const t_config& config);

    t_build_strand_table_common_rval build_strand_table_common(const t_table& flattened,
        const std::vector<t_aggspec>& aggspecs, const t_config& config) const;

    void populate_pkey_idx(const t_dtree_ctx& ctx, const t_dtree& dtree, t_uindex dptidx,
        t_uindex sptidx, t_uindex ndepth, t_idxpkey& new_idx_pkey);

    t_uindex unnest_strands_row(std::vector<const t_column*>& piv_fcols, t_build_strand_table_common_rval strand_schema,
        t_uindex row_idx, std::vector<t_column*>& unnest_piv_scols, std::vector<t_agg_level_type> agg_level_vec,
        std::vector<t_binning_info> binning_vec, std::vector<std::vector<double>>& default_binning_vec) const;

    t_tscalar format_pivot_scalar(t_tscalar value, t_agg_level_type agg_level, t_binning_info binning, t_dataformattype df_type) const;

private:
    std::vector<t_pivot> m_pivots;
    bool m_init;
    std::shared_ptr<t_treenodes> m_nodes;
    std::shared_ptr<t_idxpkey> m_idxpkey;
    std::shared_ptr<t_idxleaf> m_idxleaf;
    t_uindex m_curidx;
    std::shared_ptr<t_table> m_aggregates;
    std::shared_ptr<t_table> m_running_tbl;
    std::vector<t_aggspec> m_aggspecs;
    t_schema m_schema;
    std::vector<t_uindex> m_agg_freelist;
    t_uindex m_cur_aggidx;
    std::set<t_uindex> m_newids;
    std::set<t_uindex> m_newleaves;
    t_sidxmap m_smap;
    std::vector<const t_column*> m_aggcols;
    std::shared_ptr<t_tcdeltas> m_deltas;
    std::vector<t_minmax> m_minmax;
    t_tree_unify_rec_vec m_tree_unification_records;
    std::vector<bool> m_features;
    t_symtable m_symtable;
    bool m_has_delta;
    std::string m_grand_agg_str;
    t_mask m_saved_msk;
    std::map<t_index, t_index> m_period_map;
    std::vector<t_binning_info> m_binning_vec;
};

template <typename ITER_T>
t_minmax
t_stree::get_agg_min_max(ITER_T biter, ITER_T eiter, t_uindex aggidx) const {
    auto aggcols = m_aggregates->get_const_columns();
    auto col = aggcols[aggidx];
    t_minmax minmax;

    for (auto iter = biter; iter != eiter; ++iter) {
        if (iter->m_idx == 0)
            continue;
        t_uindex aggidx = iter->m_aggidx;
        t_tscalar v = col->get_scalar(aggidx);

        if (minmax.m_min.is_none()) {
            minmax.m_min = v;
        } else {
            minmax.m_min = std::min(v, minmax.m_min);
        }

        if (minmax.m_max.is_none()) {
            minmax.m_max = v;
        } else {
            minmax.m_max = std::max(v, minmax.m_max);
        }
    }
    return minmax;
}

} // end namespace perspective
