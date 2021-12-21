/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/dependency.h>

namespace perspective {

t_dep::t_dep(const t_dep_recipe& v)
    : m_name(v.m_name)
    , m_disp_name(v.m_disp_name)
    , m_type(v.m_type)
    , m_imm(v.m_imm)
    , m_dtype(v.m_dtype)
    , m_dftype(v.m_dftype) {}

t_dep::t_dep(const std::string& name, t_deptype type)
    : m_name(name)
    , m_disp_name(name)
    , m_type(type)
    , m_dtype(DTYPE_NONE)
    , m_dftype(DATA_FORMAT_NONE) {}

t_dep::t_dep(t_tscalar imm)
    : m_type(DEPTYPE_SCALAR)
    , m_imm(imm)
    , m_dtype(DTYPE_NONE)
    , m_dftype(DATA_FORMAT_NONE) {}

t_dep::t_dep(
    const std::string& name, const std::string& disp_name, t_deptype type, t_dtype dtype, t_dataformattype dftype)
    : m_name(name)
    , m_disp_name(disp_name)
    , m_type(type)
    , m_dtype(dtype)
    , m_dftype(dftype) {}

const std::string&
t_dep::name() const {
    return m_name;
}

const std::string&
t_dep::disp_name() const {
    return m_disp_name;
}

t_deptype
t_dep::type() const {
    return m_type;
}

t_tscalar
t_dep::imm() const {
    return m_imm;
}

t_dtype
t_dep::dtype() const {
    return m_dtype;
}

t_dataformattype
t_dep::data_format_type() const {
    return m_dftype;
}

t_dep_recipe
t_dep::get_recipe() const {
    t_dep_recipe rv;
    rv.m_name = m_name;
    rv.m_disp_name = m_disp_name;
    rv.m_type = m_type;
    rv.m_imm = m_imm;
    rv.m_dtype = m_dtype;
    rv.m_dftype = m_dftype;
    return rv;
}

void
t_dep::update_column_name(const std::string& old_name, const std::string& new_name) {
    if (m_name != old_name) {
        return;
    }
    m_name = new_name;
    if (m_disp_name == old_name) {
        m_disp_name = new_name;
    }
}

} // end namespace perspective
