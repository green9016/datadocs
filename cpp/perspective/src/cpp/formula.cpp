#include <perspective/first.h>
#include <perspective/formula.h>
#include <perspective/base.h>
#include <sstream>

namespace perspective {
t_paramspec::t_paramspec() {}

t_paramspec::t_paramspec(t_computed_param_type param_type)
    : m_param_type(param_type) {}

t_paramspec::~t_paramspec() {}

void
t_paramspec::set_colname(const std::string& colname) {
    m_colname = colname;
}

void
t_paramspec::set_sub_formula(t_formulaspec* sub_fromula) {
    m_sub_formula = sub_fromula;
}

t_computed_param_type
t_paramspec::get_param_type() const {
    return m_param_type;
}

t_formulaspec*
t_paramspec::get_sub_formula() const {
    return m_sub_formula;
}

std::string
t_paramspec::get_colname() const {
    return m_colname;
}

t_dtype
t_paramspec::get_param_dtype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
    std::map<std::string, std::string> col_map) const {
    switch(m_param_type) {
        case COMPUTED_PARAM_COLNAME: {
            auto iter = aggregate_map.find(m_colname);
            if (iter == aggregate_map.end()) {
                PSP_COMPLAIN_AND_ABORT("Invalid column name");
                return DTYPE_NONE;
            }
            t_aggspec aggspec = iter->second;
            auto it = col_map.find(m_colname);
            std::string tbl_colname = m_colname;
            if (it != col_map.end()) {
                tbl_colname = it->second;
            }
            std::vector<t_col_name_type> column_name_types = aggspec.get_formula_output_specs(schema, tbl_colname);
            return column_name_types[0].m_type;
        } break;
        case COMPUTED_PARAM_SUB_FORMULA: {
            return m_sub_formula->get_formula_dtype(aggregate_map, schema, col_map);
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Invalid param type");
            return DTYPE_NONE;
        } break;
    }
}

t_dataformattype
t_paramspec::get_param_dftype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
    std::map<std::string, std::string> col_map) const {
    switch(m_param_type) {
        case COMPUTED_PARAM_COLNAME: {
            auto iter = aggregate_map.find(m_colname);
            if (iter == aggregate_map.end()) {
                PSP_COMPLAIN_AND_ABORT("Invalid column name");
                return DATA_FORMAT_NONE;
            }
            t_aggspec aggspec = iter->second;
            auto it = col_map.find(m_colname);
            std::string tbl_colname = m_colname;
            if (it != col_map.end()) {
                tbl_colname = it->second;
            }
            std::vector<t_col_name_type> column_name_types = aggspec.get_formula_output_specs(schema, tbl_colname);
            return column_name_types[0].m_dftype;
        } break;
        case COMPUTED_PARAM_SUB_FORMULA: {
            return m_sub_formula->get_formula_dftype(aggregate_map, schema, col_map);
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Invalid param type");
            return DATA_FORMAT_NONE;
        } break;
    }
}

t_formulaspec::t_formulaspec() {}

t_formulaspec::t_formulaspec(t_formula_op_type op_type, const std::vector<t_paramspec>& params)
    : m_op_type(op_type)
    , m_params(params) {}

t_formulaspec::~t_formulaspec() {}

t_dtype
t_formulaspec::get_formula_dtype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
    std::map<std::string, std::string> col_map) const {
    std::vector<t_dtype> param_dtypes;
    for (t_uindex idx = 0, loop_end = m_params.size(); idx < loop_end; ++idx) {
        param_dtypes.push_back(m_params[idx].get_param_dtype(aggregate_map, schema, col_map));
    }

    switch(m_op_type) {
        case FORMULA_OP_COPY: {
            if (param_dtypes.empty() || param_dtypes.size() != 1) {
                PSP_COMPLAIN_AND_ABORT("Invalid computed params");
                return DTYPE_NONE;
            }
            return param_dtypes[0];
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Invalid op type");
            return DTYPE_NONE;
        } break;
    }
}

t_dataformattype
t_formulaspec::get_formula_dftype(std::map<std::string, t_aggspec>& aggregate_map, t_schema schema,
    std::map<std::string, std::string> col_map) const {
    std::vector<t_dataformattype> param_dftypes;
    for (t_uindex idx = 0, loop_end = m_params.size(); idx < loop_end; ++idx) {
        param_dftypes.push_back(m_params[idx].get_param_dftype(aggregate_map, schema, col_map));
    }

    switch(m_op_type) {
        case FORMULA_OP_COPY: {
            if (param_dftypes.empty() || param_dftypes.size() != 1) {
                PSP_COMPLAIN_AND_ABORT("Invalid computed params");
                return DATA_FORMAT_NONE;
            }
            return param_dftypes[0];
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Invalid op type");
            return DATA_FORMAT_NONE;
        } break;
    }
}

std::vector<t_paramspec>
t_formulaspec::get_param_specs() const {
    return m_params;
}

t_formula_op_type
t_formulaspec::get_op_type() const {
    return m_op_type;
}

t_calculation::t_calculation() {}

t_calculation::t_calculation(t_formulaspec formula_spec)
    : m_formula_spec(formula_spec) {}

t_calculation::~t_calculation() {}

t_tscalar
t_calculation::get_param_val(t_paramspec paramspec, std::map<std::string, t_tscalar>& scalar_values) const {
    switch(paramspec.get_param_type()) {
        case COMPUTED_PARAM_COLNAME: {
            auto iter = scalar_values.find(paramspec.get_colname());
            if (iter == scalar_values.end()) {
                PSP_COMPLAIN_AND_ABORT("Invalid column name");
                return mknone();
            }
            return iter->second;
        } break;
        case COMPUTED_PARAM_SUB_FORMULA: {
            t_calculation sub_calculation(*(paramspec.get_sub_formula()));
            return sub_calculation.get_formula_result(scalar_values);
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Invalid param type");
            return mknone();
        } break;
    }
}

t_tscalar
t_calculation::get_formula_result(std::map<std::string, t_tscalar>& scalar_values) const {
    std::vector<t_tscalar> param_val;
    std::vector<t_paramspec> paramspecs = m_formula_spec.get_param_specs();
    for (t_uindex idx = 0, loop_end = paramspecs.size(); idx < loop_end; ++idx) {
        param_val.push_back(get_param_val(paramspecs[idx], scalar_values));
    }

    switch(m_formula_spec.get_op_type()) {
        case FORMULA_OP_COPY: {
            if (param_val.empty() || param_val.size() != 1) {
                PSP_COMPLAIN_AND_ABORT("Invalid computed params");
                return mknone();
            }
            return param_val[0];
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Invalid op type");
            return mknone();
        } break;
    }
}
}