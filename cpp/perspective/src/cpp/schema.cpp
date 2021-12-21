/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/schema.h>

namespace perspective {

t_schema_recipe::t_schema_recipe() {}

t_schema::t_schema() {}

t_schema::t_schema(const t_schema_recipe& recipe)
    : t_schema(recipe.m_columns, recipe.m_types, recipe.m_data_format_types, recipe.m_columns, recipe.m_computed_cols) {}

t_schema::t_schema(const std::vector<std::string>& columns, const std::vector<t_dtype>& types,
    const std::vector<t_dataformattype> & data_format_types, const std::vector<std::string>& tbl_columns,
    const std::vector<std::string>& computed_cols)
    : m_columns(columns)
    , m_types(types)
    , m_data_format_types(data_format_types)
    , m_computed_cols(computed_cols)
    , m_status_enabled(columns.size())
    , m_pkeyidx(0)
    , m_opidx(0) {
    PSP_VERBOSE_ASSERT(columns.size() == types.size(), "Size mismatch");

    bool pkey_found = false;
    bool op_found = false;

    std::string pkey_str("psp_pkey");
    std::string op_str("psp_op");
    for (std::vector<std::string>::size_type idx = 0, loop_end = types.size(); idx < loop_end;
         ++idx) {
        m_colidx_map[columns[idx]] = idx;
        m_coldt_map[columns[idx]] = types[idx];
        if (tbl_columns.empty() || idx >= tbl_columns.size()) {
            m_customcol_map[columns[idx]] = columns[idx];
        } else {
            m_customcol_map[columns[idx]] = tbl_columns[idx];
        }
        if (m_data_format_types.empty()) {
            m_data_format_types = {};
        }
        if (data_format_types.empty() || idx >= data_format_types.size()) {
            m_data_format_types.push_back(get_default_data_format_type(types[idx]));
        }
        m_coldatatype_map[columns[idx]] = m_data_format_types[idx];
        m_status_enabled[idx] = true;
        if (columns[idx] == pkey_str) {
            pkey_found = true;
            m_pkeyidx = idx;
        }

        if (columns[idx] == op_str) {
            op_found = true;
            m_opidx = idx;
        }
    }

    m_is_pkey = pkey_found && op_found;
}

t_uindex
t_schema::get_num_columns() const {
    return m_columns.size();
}

t_uindex
t_schema::size() const {
    return m_columns.size();
}

t_uindex
t_schema::get_colidx(const std::string& colname) const {
    auto iter = m_colidx_map.find(colname);
    if (iter == m_colidx_map.end()) {
        std::cout << "Column " << colname << " does not exist in schema." << std::endl;
        PSP_COMPLAIN_AND_ABORT("");
    }
    return iter->second;
}

t_dtype
t_schema::get_dtype(const std::string& colname) const {
    auto iter = m_coldt_map.find(colname);
    if (iter == m_coldt_map.end()) {
        std::cout << "Column " << colname << " does not exist in schema." << std::endl;
        PSP_COMPLAIN_AND_ABORT("");
    }
    return iter->second;
}

t_dataformattype
t_schema::get_data_format_type(const std::string& colname) const {
    auto iter = m_coldatatype_map.find(colname);
    if (iter == m_coldatatype_map.end()) {
        std::cout << "Column " << colname << " does not exist in schema." << std::endl;
        PSP_COMPLAIN_AND_ABORT("");
    }
    return iter->second;
}

std::string
t_schema::get_tbl_colname(const std::string& colname) const {
    auto iter = m_customcol_map.find(colname);
    if (iter == m_customcol_map.end()) {
        if (colname == "psp_pkey") {
            return "psp_pkey";
        }
        PSP_COMPLAIN_AND_ABORT("");
    }
    return iter->second;
}

bool
t_schema::is_pkey() const {
    return m_is_pkey;
}

bool
t_schema::operator==(const t_schema& rhs) const {
    return m_columns == rhs.m_columns && m_types == rhs.m_types
        && m_status_enabled == rhs.m_status_enabled;
}

void
t_schema::add_column(const std::string& colname, t_dtype dtype, t_dataformattype datatype,
    const std::string& tbl_colname) {
    auto iter = m_colidx_map.find(colname);
    if (iter != m_colidx_map.end()) {
        return;
    }

    t_uindex idx = m_columns.size();
    m_columns.push_back(colname);
    m_status_enabled.push_back(true);
    m_types.push_back(dtype);
    m_data_format_types.push_back(datatype);
    m_colidx_map[colname] = idx;
    m_coldt_map[colname] = dtype;
    m_coldatatype_map[colname] = datatype;
    m_customcol_map[colname] = tbl_colname;

    if (colname == std::string("psp_pkey")) {
        m_pkeyidx = idx;
        m_is_pkey = true;
    }

    if (colname == std::string("psp_op")) {
        m_opidx = idx;
        m_is_pkey = true;
    }
}

void
t_schema::remove_column(const std::string& colname) {
    auto iter = m_colidx_map.find(colname);
    if (iter == m_colidx_map.end()) {
        return;
    }
    t_uindex idx = iter->second;
    m_columns.erase(m_columns.begin() + idx);
    m_status_enabled.erase(m_status_enabled.begin() + idx);
    m_types.erase(m_types.begin() + idx);
    m_data_format_types.erase(m_data_format_types.begin() + idx);
    m_colidx_map.erase(colname);
    m_coldt_map.erase(colname);
    m_coldatatype_map.erase(colname);
    m_customcol_map.erase(colname);
}

void
t_schema::retype_column(const std::string& colname, t_dtype dtype, t_dataformattype datatype,
    const std::string& tbl_colname) {
    if (colname == std::string("psp_pkey") || colname == std::string("psp_op")) {
        PSP_COMPLAIN_AND_ABORT("Cannot retype primary key or operation columns.");
    }
    if (!has_column(colname)) {
        PSP_COMPLAIN_AND_ABORT("Cannot retype a column that does not exist.");
    }

    t_uindex idx = get_colidx(colname);
    m_types[idx] = dtype;
    m_colidx_map[colname] = idx;
    m_coldt_map[colname] = dtype;
    m_coldatatype_map[colname] = datatype;
    m_customcol_map[colname] = tbl_colname;
}

t_schema_recipe
t_schema::get_recipe() const {
    t_schema_recipe rval;
    rval.m_columns = m_columns;
    rval.m_types = m_types;
    return rval;
}

bool
t_schema::has_column(const std::string& colname) const {
    auto iter = m_colidx_map.find(colname);
    return iter != m_colidx_map.end();
}

bool
t_schema::is_computed_col(const std::string& cname) const {
    auto iter = std::find(m_computed_cols.begin(), m_computed_cols.end(), cname);
    return iter != m_computed_cols.end();
}

const std::vector<std::string>&
t_schema::columns() const {
    return m_columns;
}

const std::vector<t_dtype>
t_schema::types() const {
    return m_types;
}

const std::vector<t_dataformattype>
t_schema::data_format_types() const {
    return m_data_format_types;
}

t_table_static_ctx
t_schema::get_table_context() const {
    t_table_static_ctx rv;
    for (size_t idx = 0, loop_end = m_columns.size(); idx < loop_end; ++idx) {
        t_column_static_ctx v;
        v.m_colname = m_columns[idx];
        v.m_dtype = m_types[idx];
        rv.m_columns.push_back(v);
    }
    return rv;
}

std::string
t_schema::str() const {
    std::stringstream ss;
    ss << *this;
    return ss.str();
}

t_schema
t_schema::drop(const std::set<std::string>& columns) const {
    std::vector<std::string> cols;
    std::vector<t_dtype> types;
    std::vector<t_dataformattype> dftypes;

    for (t_uindex idx = 0, loop_end = m_columns.size(); idx < loop_end; ++idx) {
        if (columns.find(m_columns[idx]) == columns.end()) {
            cols.push_back(m_columns[idx]);
            types.push_back(m_types[idx]);
            dftypes.push_back(m_data_format_types[idx]);
        }
    }
    return t_schema(cols, types, dftypes);
}

t_schema
t_schema::operator+(const t_schema& o) const {
    t_schema rv(m_columns, m_types, m_data_format_types);
    for (t_uindex idx = 0, loop_end = o.m_columns.size(); idx < loop_end; ++idx) {
        const std::string& colname = o.m_columns[idx];
        rv.add_column(colname, o.m_types[idx], m_data_format_types[idx], o.m_customcol_map.find(colname)->second);
    }
    return rv;
}

void
t_schema::update_data_formats(const std::vector<t_data_format_spec>& data_formats) {
    t_sdatatypemap data_formats_map;
    for (t_uindex idx = 0, loop_end = data_formats.size(); idx < loop_end; ++idx) {
        auto data_format = data_formats[idx];
        data_formats_map[data_format.get_name()] = data_format.get_type();
    }
    std::vector<t_dataformattype> new_data_format_types{};
    for (t_uindex idx = 0, loop_end = m_columns.size(); idx < loop_end; ++idx) {
        auto col_name = m_columns[idx];
        auto iter = data_formats_map.find(col_name);
        if (iter == data_formats_map.end()) {
            auto df_iter = m_coldatatype_map.find(col_name);
            if (df_iter != m_coldatatype_map.end()) {
                new_data_format_types.push_back(df_iter->second);
            } else {
                new_data_format_types.push_back(get_default_data_format_type(m_types[idx]));
            }
        } else {
            new_data_format_types.push_back(iter->second);
            m_coldatatype_map[col_name] = iter->second;
        }
    }
    m_data_format_types = new_data_format_types;
}

void
t_schema::rename_columns(const std::map<std::string, std::string>& col_map) {
    for (const auto& it : col_map) {
        std::string old_name = it.second;
        std::string new_name = it.first;

        // update m_columns:
        std::replace(m_columns.begin(), m_columns.end(), old_name, new_name);

        // update m_colidx_map:
        t_suidxmap::iterator it_coldix = m_colidx_map.find(old_name);
        if (it_coldix != m_colidx_map.end()) {
            m_colidx_map[new_name] = it_coldix->second;
            m_colidx_map.erase(it_coldix);
        } else {
            PSP_COMPLAIN_AND_ABORT("Could not find index for this name");
        }

        // update m_coldt_map:
        t_sdtmap::iterator it_coldt = m_coldt_map.find(old_name);
        if (it_coldt != m_coldt_map.end()) {
            m_coldt_map[new_name] = it_coldt->second;
            m_coldt_map.erase(it_coldt);
        } else {
            PSP_COMPLAIN_AND_ABORT("Could not find type for this name");
        }

        // update m_coldatatype_map
        t_sdatatypemap::iterator it_coldft = m_coldatatype_map.find(old_name);
        if (it_coldft != m_coldatatype_map.end()) {
            m_coldatatype_map[new_name] = it_coldft->second;
            m_coldatatype_map.erase(it_coldft);
        } else {
            PSP_COMPLAIN_AND_ABORT("Could not find data format for this name");
        }

        // update m_customcol_map
        t_customcolmap::iterator it_cuscol = m_customcol_map.find(old_name);
        if (it_cuscol != m_customcol_map.end()) {
            m_customcol_map[new_name] = it_cuscol->second;
            m_customcol_map.erase(it_cuscol);
        } else {
            PSP_COMPLAIN_AND_ABORT("Could not find custom column for this name");
        }
    }
}

} // end namespace perspective

namespace std {

std::ostream&
operator<<(std::ostream& os, const perspective::t_schema& s) {
    using namespace perspective;
    const std::vector<std::string>& cols = s.columns();
    const std::vector<t_dtype>& types = s.types();

    os << "t_schema<\n";
    for (size_t idx = 0, loop_end = cols.size(); idx < loop_end; ++idx) {
        os << "\t" << idx << ". " << cols[idx] << ", " << get_dtype_descr(types[idx])
           << std::endl;
    }
    os << ">\n";
    return os;
}
} // namespace std
