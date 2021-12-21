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
#include <memory>
#include <vector>
#include <map>
#include <algorithm>
#include <functional>
#include <iostream>
#include <perspective/multi_sort.h>
#include <perspective/sort_specification.h>
#include <perspective/gnode_state.h>
#include <perspective/config.h>
#include <perspective/exports.h>
#include <perspective/sym_table.h>
#include <set>
#include <unordered_map>
#include <unordered_set>

namespace perspective {

class PERSPECTIVE_EXPORT t_ftrav {
public:
    t_ftrav(bool handle_nan_sort);

    std::vector<t_tscalar> get_all_pkeys(
        const std::vector<std::pair<t_uindex, t_uindex>>& cells) const;

    std::vector<t_tscalar> get_pkeys(
        const std::vector<std::pair<t_uindex, t_uindex>>& cells) const;

    std::vector<t_tscalar> get_pkeys() const;
    std::vector<t_tscalar> get_pkeys(t_index begin_row, t_index end_row) const;

    t_tscalar get_pkey(t_index idx) const;

    void sort_by(std::shared_ptr<const t_gstate> state, const t_config& config,
        const std::vector<t_sortspec>& sortby);

    t_index size() const;

    void get_row_indices(const std::unordered_set<t_tscalar>& pkeys,
        std::unordered_map<t_tscalar, t_index>& out_map) const;

    void get_row_indices(t_index bidx, t_index eidx, const std::unordered_set<t_tscalar>& pkeys,
        std::unordered_map<t_tscalar, t_index>& out_map) const;

    void reset();

    bool validate_cells(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const;

    void step_begin();

    void step_end(std::shared_ptr<const t_gstate> state, t_config& config);

    const std::vector<t_sortspec>& get_sort_by() const;
    bool empty_sort_by() const;

    void reset_step_state();

private:
    std::vector<t_sortspec> m_sortby;
    t_symtable m_symtable;
    size_t m_nrows = 0, m_ncols = 0;
    std::shared_ptr<t_table_index> m_index;
};

} // end namespace perspective
