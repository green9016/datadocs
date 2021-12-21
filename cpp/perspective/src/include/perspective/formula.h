#pragma once
#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/exports.h>
#include <perspective/aggspec.h>
#include <perspective/schema.h>
#include <vector>

namespace perspective {
class PERSPECTIVE_EXPORT t_formulaspec;

class PERSPECTIVE_EXPORT t_paramspec {
public:
    t_paramspec();

    t_paramspec(t_computed_param_type param_type);

    ~t_paramspec();

    void set_colname(const std::string& colname);
    void set_sub_formula(t_formulaspec* sub_fromula);

    t_computed_param_type get_param_type() const;
    t_formulaspec* get_sub_formula() const;
    std::string get_colname() const;

    t_dtype get_param_dtype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
        std::map<std::string, std::string> col_map) const;
    t_dataformattype get_param_dftype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
        std::map<std::string, std::string> col_map) const;
private:
    t_computed_param_type m_param_type;
    t_formulaspec* m_sub_formula;
    std::string m_colname;
};

class PERSPECTIVE_EXPORT t_formulaspec {
public:
    t_formulaspec();

    t_formulaspec(t_formula_op_type m_op_type, const std::vector<t_paramspec>& params);

    ~t_formulaspec();

    t_dtype get_formula_dtype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
        std::map<std::string, std::string> col_map) const;
    t_dataformattype get_formula_dftype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
        std::map<std::string, std::string> col_map) const;

    std::vector<t_paramspec> get_param_specs() const;
    t_formula_op_type get_op_type() const;

private:
    t_formula_op_type m_op_type;
    std::vector<t_paramspec> m_params;
};

class PERSPECTIVE_EXPORT t_calculation {
public:
    t_calculation();

    t_calculation(t_formulaspec formula_spec);

    ~t_calculation();

    t_tscalar get_param_val(t_paramspec paramspec, std::map<std::string, t_tscalar>& scalar_values) const;
    t_tscalar get_formula_result(std::map<std::string, t_tscalar>& scalar_values) const;
private:
    t_formulaspec m_formula_spec;
};
}