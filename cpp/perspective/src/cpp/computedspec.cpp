#include <perspective/first.h>
#include <perspective/computedspec.h>
#include <perspective/base.h>
#include <sstream>

namespace perspective {
t_computedspec::t_computedspec() {}

t_computedspec::t_computedspec(const t_computed_recipe& v) {
    m_name = v.m_name;
    m_formulaspec = v.m_formulaspec;
}

t_computedspec::t_computedspec(
    const std::string& name, t_formulaspec formulaspec)
    : m_name(name)
    , m_formulaspec(formulaspec) {}

t_computedspec::~t_computedspec() {}

std::string
t_computedspec::get_name() const {
    return m_name;
}

t_formulaspec
t_computedspec::get_formulaspec() const {
    return m_formulaspec;
}

t_computed_recipe
t_computedspec::get_recipe() const {
    t_computed_recipe rv;
    rv.m_name = m_name;
    rv.m_formulaspec = m_formulaspec;

    return rv;
}

t_dtype
t_computedspec::get_computed_dtype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
    std::map<std::string, std::string> col_map) const {
        t_dtype dtype = m_formulaspec.get_formula_dtype(aggregate_map, schema, col_map);
        return dtype;
    }

t_dataformattype
t_computedspec::get_computed_dftype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
    std::map<std::string, std::string> col_map) const {
        t_dataformattype df_type = m_formulaspec.get_formula_dftype(aggregate_map, schema, col_map);
        return df_type;
}

bool
t_computedspec::operator==(const t_computedspec& other) const {
    return m_name == other.m_name;
}

}