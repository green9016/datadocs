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
#include <perspective/config.h>
#include <perspective/table.h>
#include <perspective/mask.h>

namespace perspective {

inline t_mask
having_table_for_config(const t_table& tbl, t_config& config, const std::vector<t_fterm>& fterms_, t_uindex level,
    std::map<t_uindex, t_depth> dmap) {
    return tbl.having_cpp(config.get_combiner(), fterms_, config, level, dmap);
}

} // end namespace perspective
