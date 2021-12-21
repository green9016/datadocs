/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/pivot.h>
#include <sstream>

namespace perspective {

t_pivot::t_pivot(const t_pivot_recipe& r) {
    m_colname = r.m_colname;
    m_name = r.m_name;
    m_mode = r.m_mode;
    m_agg_level = r.m_agg_level;
    m_subtotal = r.m_subtotal;
    m_binning = r.m_binning;
}

t_pivot::t_pivot(const std::string& colname, t_agg_level_type agg_level, bool subtotal, t_binning_info binning
    , const std::string& pivot_name)
    : m_colname(colname)
    , m_name(colname)
    , m_mode(PIVOT_MODE_NORMAL)
    , m_agg_level(agg_level)
    , m_subtotal(subtotal)
    , m_binning(binning)
    , m_pivot_name(pivot_name) {}

t_pivot::t_pivot(const std::string& colname, t_pivot_mode mode, t_agg_level_type agg_level, bool subtotal,
    t_binning_info binning, const std::string& pivot_name)
    : m_colname(colname)
    , m_name(colname)
    , m_mode(mode)
    , m_agg_level(agg_level)
    , m_subtotal(subtotal)
    , m_binning(binning)
    , m_pivot_name(pivot_name) {}

const std::string&
t_pivot::name() const {
    return m_name;
}

const std::string&
t_pivot::colname() const {
    return m_colname;
}

const std::string&
t_pivot::pivot_name() const {
    return m_pivot_name;
}

t_pivot_mode
t_pivot::mode() const {
    return m_mode;
}

t_agg_level_type
t_pivot::agg_level() const {
    return m_agg_level;
}

bool
t_pivot::subtotal() const {
    return m_subtotal;
}

t_binning_info
t_pivot::binning() const {
    return m_binning;
}

t_pivot_recipe
t_pivot::get_recipe() const {
    t_pivot_recipe rv;
    rv.m_colname = m_colname;
    rv.m_name = m_name;
    rv.m_mode = m_mode;
    rv.m_agg_level = m_agg_level;
    rv.m_subtotal = m_subtotal;
    rv.m_binning = m_binning;
    return rv;
}

} // end namespace perspective
