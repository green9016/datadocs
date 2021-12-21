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
#include <perspective/context_base.h>
#include <perspective/path.h>
#include <perspective/traversal_nodes.h>
#include <perspective/sort_specification.h>
#include <perspective/traversal.h>
#include <perspective/table.h>

namespace perspective {

class PERSPECTIVE_EXPORT t_ctx1 : public t_ctxbase<t_ctx1> {
public:
    t_ctx1();

    t_ctx1(const t_schema& schema, const t_config& config);

    ~t_ctx1();

#include <perspective/context_common_decls.h>

    // ASGGrid data interface

    t_index open(t_header header, t_index idx);
    t_index open(t_index idx);
    t_index combined_open(t_index idx);
    t_index close(t_index idx);
    t_index combined_close(t_index idx);

    t_aggspec get_aggregate(t_uindex idx) const;
    t_tscalar get_aggregate_name(t_uindex idx) const;
    const std::vector<t_aggspec>& get_aggregates() const;
    std::vector<t_tscalar> get_row_path(t_index idx) const;
    void set_depth(t_depth depth);

    t_minmax get_agg_min_max(t_uindex aggidx, t_depth depth) const;

    t_index get_row_idx(const std::vector<t_tscalar>& path) const;

    t_depth get_trav_depth(t_index idx) const;

    using t_ctxbase<t_ctx1>::get_data;

    void update_data_format(const std::vector<t_data_format_spec>& data_formats);

    bool has_row_path() const;

    bool has_row_combined() const;

    bool has_pivot_view_flat() const;

    std::map<std::string, std::string> longest_text_cols() const;

    std::map<std::string, double> get_default_binning(const std::string& colname) const;

    std::map<std::string, t_uindex> get_truncated_columns() const;

protected:
    std::vector<std::vector<t_tscalar>> get_flat_mode_row_paths(t_uindex srow, t_uindex erow) const;
    std::vector<t_cellinfo> resolve_cells(
        const std::vector<std::pair<t_uindex, t_uindex>>& cells) const;
    
    void update_traversal_indices();
private:
    std::shared_ptr<t_traversal> m_traversal;
    std::shared_ptr<t_stree> m_tree;
    std::vector<t_sortspec> m_sortby;
    t_depth m_depth;
    bool m_depth_set;
    std::vector<t_indiceinfo> m_traversal_indices;
    std::map<std::string, std::vector<double>> m_default_binning;
};

} // end namespace perspective
