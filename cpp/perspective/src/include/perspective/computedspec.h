#pragma once
#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/exports.h>
#include <perspective/formula.h>
#include <vector>

namespace perspective {

struct PERSPECTIVE_EXPORT t_computed_recipe {
    t_computed_recipe() {}
    std::string m_name;
    t_formulaspec m_formulaspec;
};

class PERSPECTIVE_EXPORT t_computedspec {
public:
    t_computedspec();

    ~t_computedspec();

    t_computedspec(const t_computed_recipe& v);

    t_computedspec(
        const std::string& name, t_formulaspec formulaspec);

    std::string get_name() const;

    t_formulaspec get_formulaspec() const;

    t_computed_recipe get_recipe() const;

    t_dtype get_computed_dtype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
        std::map<std::string, std::string> col_map) const;

    t_dataformattype get_computed_dftype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
        std::map<std::string, std::string> col_map) const;

    bool operator==(const t_computedspec& other) const;

private:
    std::string m_name;
    t_formulaspec m_formulaspec;
};
}