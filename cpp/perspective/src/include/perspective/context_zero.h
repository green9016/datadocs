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
#include <perspective/context_base.h>
#include <perspective/sort_specification.h>
#include <perspective/histogram.h>
#include <perspective/sym_table.h>
#include <perspective/traversal.h>
#include <perspective/flat_traversal.h>
#include <perspective/table.h>

namespace perspective {

class t_table;

class PERSPECTIVE_EXPORT t_ctx0 : public t_ctxbase<t_ctx0> {
public:
    t_ctx0();

    t_ctx0(const t_schema& schema, const t_config& config);

    ~t_ctx0();
#include <perspective/context_common_decls.h>

    t_tscalar get_column_name(t_index idx);

    const std::vector<std::string>& get_column_names() const;

    void sort_by();
    const std::vector<t_sortspec>& get_sort_by() const;

    using t_ctxbase<t_ctx0>::get_data;

    bool has_row_path() const;

    std::map<std::string, std::string> longest_text_cols() const;

    std::map<std::string, double> get_default_binning(const std::string& colname) const;

protected:
    std::vector<t_tscalar> get_all_pkeys(
        const std::vector<std::pair<t_uindex, t_uindex>>& cells) const;

    void calc_step_delta(const t_table& flattened, const t_table& prev, const t_table& curr,
        const t_table& transitions);

private:
    std::shared_ptr<t_ftrav> m_traversal;
    std::shared_ptr<t_zcdeltas> m_deltas;
    std::vector<t_minmax> m_minmax;
    t_symtable m_symtable;
    bool m_has_delta;
};

} // end namespace perspective
