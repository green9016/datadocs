/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/aggspec.h>
#include <perspective/base.h>
#include <sstream>

namespace perspective {

t_col_name_type::t_col_name_type()
    : m_type(DTYPE_NONE)
    , m_dftype(DATA_FORMAT_NONE) {}

t_col_name_type::t_col_name_type(const std::string& name, t_dtype type, t_dataformattype dftype)
    : m_name(name)
    , m_type(type)
    , m_dftype(dftype) {}

t_aggspec::t_aggspec() {}

t_aggspec::t_aggspec(const t_aggspec_recipe& v) {
    m_name = v.m_name;
    m_disp_name = v.m_name;
    m_agg = v.m_agg;

    for (const auto& d : v.m_dependencies) {
        m_dependencies.push_back(d);
    }

    for (const auto& d : v.m_odependencies) {
        m_odependencies.push_back(d);
    }

    m_sort_type = v.m_sort_type;
    m_agg_one_idx = v.m_agg_one_idx;
    m_agg_two_idx = v.m_agg_two_idx;
    m_agg_one_weight = v.m_agg_one_weight;
    m_agg_two_weight = v.m_agg_two_weight;
    m_invmode = v.m_invmode;
}

t_aggspec::t_aggspec(
    const std::string& name, t_aggtype agg, const std::vector<t_dep>& dependencies)
    : m_name(name)
    , m_disp_name(name)
    , m_agg(agg)
    , m_dependencies(dependencies) {}

t_aggspec::t_aggspec(const std::string& aggname, t_aggtype agg, const std::string& dep)
    : m_name(aggname)
    , m_disp_name(aggname)
    , m_agg(agg)
    , m_dependencies(std::vector<t_dep>{t_dep(dep, DEPTYPE_COLUMN)}) {}

t_aggspec::t_aggspec(t_aggtype agg, const std::string& dep)
    : m_agg(agg)
    , m_dependencies(std::vector<t_dep>{t_dep(dep, DEPTYPE_COLUMN)}) {}

t_aggspec::t_aggspec(const std::string& name, const std::string& disp_name, t_aggtype agg,
    const std::vector<t_dep>& dependencies)
    : m_name(name)
    , m_disp_name(disp_name)
    , m_agg(agg)
    , m_dependencies(dependencies) {}

t_aggspec::t_aggspec(const std::string& name, const std::string& disp_name, t_aggtype agg,
    const std::vector<t_dep>& dependencies, t_sorttype sort_type)
    : m_name(name)
    , m_disp_name(disp_name)
    , m_agg(agg)
    , m_dependencies(dependencies)
    , m_sort_type(sort_type) {}

t_aggspec::t_aggspec(const std::string& aggname, const std::string& disp_aggname, t_aggtype agg,
    t_uindex agg_one_idx, t_uindex agg_two_idx, double agg_one_weight, double agg_two_weight)
    : m_name(aggname)
    , m_disp_name(disp_aggname)
    , m_agg(agg)
    , m_agg_one_idx(agg_one_idx)
    , m_agg_two_idx(agg_two_idx)
    , m_agg_one_weight(agg_one_weight)
    , m_agg_two_weight(agg_two_weight) {}

t_aggspec::~t_aggspec() {}

std::string
t_aggspec::name() const {
    return m_name;
}

t_tscalar
t_aggspec::name_scalar() const {
    t_tscalar s;
    s.set(m_name.c_str());
    return s;
}

std::string
t_aggspec::disp_name() const {
    return m_disp_name;
}

t_aggtype
t_aggspec::agg() const {
    return m_agg;
}

std::string
t_aggspec::agg_str() const {
    switch (m_agg) {
        case AGGTYPE_SUM: {
            return "sum";
        } break;
        case AGGTYPE_SUM_ABS: {
            return "sum_abs";
        } break;
        case AGGTYPE_MUL: {
            return "mul";
        } break;
        case AGGTYPE_COUNT: {
            return "count";
        } break;
        case AGGTYPE_MEAN: {
            return "mean";
        } break;
        case AGGTYPE_WEIGHTED_MEAN: {
            return "weighted_mean";
        } break;
        case AGGTYPE_UNIQUE: {
            return "unique";
        } break;
        case AGGTYPE_ANY: {
            return "any";
        } break;
        case AGGTYPE_MEDIAN: {
            return "median";
        } break;
        case AGGTYPE_JOIN: {
            return "join";
        } break;
        case AGGTYPE_SCALED_DIV: {
            return "scaled_div";
        } break;
        case AGGTYPE_SCALED_ADD: {
            return "scaled_add";
        } break;
        case AGGTYPE_SCALED_MUL: {
            return "scaled_mul";
        } break;
        case AGGTYPE_DOMINANT: {
            return "dominant";
        } break;
        case AGGTYPE_FIRST: {
            return "first";
        } break;
        case AGGTYPE_LAST: {
            return "last";
        } break;
        case AGGTYPE_PY_AGG: {
            return "py_agg";
        } break;
        case AGGTYPE_AND: {
            return "and";
        } break;
        case AGGTYPE_OR: {
            return "or";
        } break;
        case AGGTYPE_LAST_VALUE: {
            return "last_value";
        }
        case AGGTYPE_HIGH_WATER_MARK: {
            return "high_water_mark";
        }
        case AGGTYPE_LOW_WATER_MARK: {
            return "low_water_mark";
        }
        case AGGTYPE_UDF_COMBINER: {
            std::stringstream ss;
            ss << "udf_combiner_" << disp_name();
            return ss.str();
        }
        case AGGTYPE_UDF_REDUCER: {

            std::stringstream ss;
            ss << "udf_reducer_" << disp_name();
            return ss.str();
        }
        case AGGTYPE_SUM_NOT_NULL: {
            return "sum_not_null";
        }
        case AGGTYPE_MEAN_BY_COUNT: {
            return "mean_by_count";
        }
        case AGGTYPE_IDENTITY: {
            return "identity";
        }
        case AGGTYPE_DISTINCT_COUNT: {
            return "distinct_count";
        }
        case AGGTYPE_DISTINCT_LEAF: {
            return "distinct_leaf";
        }
        case AGGTYPE_PCT_SUM_PARENT: {
            return "pct_sum_parent";
        }
        case AGGTYPE_PCT_SUM_GRAND_TOTAL: {
            return "pct_sum_grand_total";
        }
        case AGGTYPE_CUSTOM: {
            return "custom";
        }
        case AGGTYPE_DISTINCT_VALUES: {
            return "distinct values";
        }
        default: {
            PSP_COMPLAIN_AND_ABORT("Unknown agg type");
            return "unknown";
        } break;
    }
}

const std::vector<t_dep>&
t_aggspec::get_dependencies() const {
    return m_dependencies;
}

t_dtype
get_simple_accumulator_type(t_dtype coltype) {
    switch (coltype) {
        case DTYPE_BOOL:
        case DTYPE_INT64:
        case DTYPE_INT32:
        case DTYPE_INT16:
        case DTYPE_INT8: {
            return DTYPE_INT64;
        } break;
        case DTYPE_UINT64:
        case DTYPE_UINT32:
        case DTYPE_UINT16:
        case DTYPE_UINT8: {
            return DTYPE_UINT64;
        }
        case DTYPE_FLOAT64:
        case DTYPE_FLOAT32: {
            return DTYPE_FLOAT64;
        }
        case DTYPE_DECIMAL: {
            return DTYPE_DECIMAL;
        }

        default: { PSP_COMPLAIN_AND_ABORT("Unexpected coltype"); }
    }
    return DTYPE_NONE;
}

t_dtype
to_list_type(t_dtype coltype) {
    switch (coltype) {
        case DTYPE_INT64:
        case DTYPE_INT32:
        case DTYPE_INT16:
        case DTYPE_UINT64:
        case DTYPE_UINT32:
        case DTYPE_UINT16:
        case DTYPE_UINT8:
        case DTYPE_INT8: {
            return DTYPE_LIST_INT64;
        } break;
        case DTYPE_BOOL: {
            return DTYPE_LIST_BOOL;
        }
        case DTYPE_STR: {
            return DTYPE_LIST_STR;
        }
        case DTYPE_DATE: {
            return DTYPE_LIST_DATE;
        }
        case DTYPE_TIME: {
            return DTYPE_LIST_TIME;
        }
        case DTYPE_DURATION: {
            return DTYPE_LIST_DURATION;
        }
        case DTYPE_FLOAT64:
        case DTYPE_FLOAT32: {
            return DTYPE_LIST_FLOAT64;
        }

        default: { PSP_COMPLAIN_AND_ABORT("Unexpected coltype"); }
    }

    return DTYPE_NONE;
}

t_sorttype
t_aggspec::get_sort_type() const {
    return m_sort_type;
}

t_uindex
t_aggspec::get_agg_one_idx() const {
    return m_agg_one_idx;
}

t_uindex
t_aggspec::get_agg_two_idx() const {
    return m_agg_two_idx;
}

double
t_aggspec::get_agg_one_weight() const {
    return m_agg_one_weight;
}

double
t_aggspec::get_agg_two_weight() const {
    return m_agg_two_weight;
}

t_invmode
t_aggspec::get_inv_mode() const {
    return m_invmode;
}

std::vector<std::string>
t_aggspec::get_input_depnames() const {
    std::vector<std::string> rval;
    for (const auto& d : m_dependencies) {
        rval.push_back(d.name());
    }
    return rval;
}

std::vector<std::string>
t_aggspec::get_output_depnames() const {
    std::vector<std::string> rval;
    for (const auto& d : m_dependencies) {
        rval.push_back(d.name());
    }
    return rval;
}

std::vector<t_col_name_type>
t_aggspec::get_output_specs(const t_schema& schema) const {
    switch (agg()) {
        case AGGTYPE_SUM:
        case AGGTYPE_SUM_ABS:
        case AGGTYPE_PCT_SUM_PARENT:
        case AGGTYPE_PCT_SUM_GRAND_TOTAL:
        case AGGTYPE_MUL:
        case AGGTYPE_SUM_NOT_NULL: {
            t_dtype coltype = schema.get_dtype(m_dependencies[0].name());
            t_dataformattype dftype = schema.get_data_format_type(m_dependencies[0].name());
            return mk_col_name_type_vec(name(), get_simple_accumulator_type(coltype), dftype);
        }
        case AGGTYPE_ANY:
        case AGGTYPE_UNIQUE:
        case AGGTYPE_DOMINANT:
        case AGGTYPE_MEDIAN:
        case AGGTYPE_FIRST:
        case AGGTYPE_LAST:
        case AGGTYPE_OR:
        case AGGTYPE_LAST_VALUE:
        case AGGTYPE_HIGH_WATER_MARK:
        case AGGTYPE_LOW_WATER_MARK:
        case AGGTYPE_IDENTITY:
        case AGGTYPE_DISTINCT_LEAF:
        case AGGTYPE_CUSTOM: {
            t_dtype coltype = schema.get_dtype(m_dependencies[0].name());
            t_dataformattype dftype = schema.get_data_format_type(m_dependencies[0].name());
            std::vector<t_col_name_type> rval(1);
            rval[0].m_name = name();
            rval[0].m_type = coltype;
            rval[0].m_dftype = dftype;
            return rval;
        }
        case AGGTYPE_COUNT: {
            //return mk_col_name_type_vec(name(), DTYPE_INT64, DATA_FORMAT_NUMBER);
            // Get data format for case count from schema
            t_dataformattype dftype = DATA_FORMAT_NUMBER;
            auto iter = schema.m_coldatatype_map.find(name());
            if (iter != schema.m_coldatatype_map.end()) {
                dftype = iter->second;
            }
            return mk_col_name_type_vec(name(), DTYPE_INT64, dftype);
        }
        case AGGTYPE_MEAN_BY_COUNT:
        case AGGTYPE_MEAN: {
            //return mk_col_name_type_vec(name(), DTYPE_F64PAIR, DATA_FORMAT_NUMBER);
            t_dataformattype dftype = DATA_FORMAT_NUMBER;
            auto iter = schema.m_coldatatype_map.find(name());
            if (iter != schema.m_coldatatype_map.end()) {
                dftype = iter->second;
            }
            return mk_col_name_type_vec(name(), DTYPE_F64PAIR, dftype);
        }
        case AGGTYPE_WEIGHTED_MEAN: {
            //return mk_col_name_type_vec(name(), DTYPE_F64PAIR, DATA_FORMAT_NUMBER);
            t_dataformattype dftype = DATA_FORMAT_NUMBER;
            auto iter = schema.m_coldatatype_map.find(name());
            if (iter != schema.m_coldatatype_map.end()) {
                dftype = iter->second;
            }
            return mk_col_name_type_vec(name(), DTYPE_F64PAIR, dftype);
        }
        case AGGTYPE_JOIN: {
            //return mk_col_name_type_vec(name(), DTYPE_STR, DATA_FORMAT_TEXT);
            t_dataformattype dftype = DATA_FORMAT_TEXT;
            auto iter = schema.m_coldatatype_map.find(name());
            if (iter != schema.m_coldatatype_map.end()) {
                dftype = iter->second;
            }
            return mk_col_name_type_vec(name(), DTYPE_STR, dftype);
        }
        case AGGTYPE_SCALED_DIV:
        case AGGTYPE_SCALED_ADD:
        case AGGTYPE_SCALED_MUL: {
            //return mk_col_name_type_vec(name(), DTYPE_FLOAT64, DATA_FORMAT_NUMBER);
            t_dataformattype dftype = DATA_FORMAT_NUMBER;
            auto iter = schema.m_coldatatype_map.find(name());
            if (iter != schema.m_coldatatype_map.end()) {
                dftype = iter->second;
            }
            return mk_col_name_type_vec(name(), DTYPE_FLOAT64, dftype);
        }
        case AGGTYPE_UDF_COMBINER:
        case AGGTYPE_UDF_REDUCER: {
            std::vector<t_col_name_type> rval;
            for (const auto& d : m_odependencies) {
                t_col_name_type tp(d.name(), d.dtype(), d.data_format_type());
                rval.push_back(tp);
            }
            return rval;
        }
        case AGGTYPE_AND: {
            //return mk_col_name_type_vec(name(), DTYPE_BOOL, DATA_FORMAT_TRUE_FALSE);
            t_dataformattype dftype = DATA_FORMAT_TRUE_FALSE;
            auto iter = schema.m_coldatatype_map.find(name());
            if (iter != schema.m_coldatatype_map.end()) {
                dftype = iter->second;
            }
            return mk_col_name_type_vec(name(), DTYPE_BOOL, dftype);
        }
        case AGGTYPE_DISTINCT_COUNT: {
            //return mk_col_name_type_vec(name(), DTYPE_UINT32, DATA_FORMAT_NUMBER);
            t_dataformattype dftype = DATA_FORMAT_NUMBER;
            auto iter = schema.m_coldatatype_map.find(name());
            if (iter != schema.m_coldatatype_map.end()) {
                dftype = iter->second;
            }
            return mk_col_name_type_vec(name(), DTYPE_UINT32, dftype);
        }
        case AGGTYPE_DISTINCT_VALUES: {
            t_dtype coltype = schema.get_dtype(m_dependencies[0].name());
            t_dataformattype dftype = schema.get_data_format_type(m_dependencies[0].name());
            return mk_col_name_type_vec(name(), to_list_type(coltype), dftype);
        }
        default: { PSP_COMPLAIN_AND_ABORT("Unknown agg type"); }
    }

    return std::vector<t_col_name_type>();
}

std::vector<t_col_name_type>
t_aggspec::get_formula_output_specs(const t_schema& schema, std::string tbl_colname) const {
    switch (agg()) {
        case AGGTYPE_SUM:
        case AGGTYPE_SUM_ABS:
        case AGGTYPE_PCT_SUM_PARENT:
        case AGGTYPE_PCT_SUM_GRAND_TOTAL:
        case AGGTYPE_MUL:
        case AGGTYPE_SUM_NOT_NULL: {
            t_dtype coltype = schema.get_dtype(tbl_colname);
            t_dataformattype dftype = schema.get_data_format_type(tbl_colname);
            return mk_col_name_type_vec(name(), get_simple_accumulator_type(coltype), dftype);
        }
        case AGGTYPE_ANY:
        case AGGTYPE_UNIQUE:
        case AGGTYPE_DOMINANT:
        case AGGTYPE_MEDIAN:
        case AGGTYPE_FIRST:
        case AGGTYPE_LAST:
        case AGGTYPE_OR:
        case AGGTYPE_LAST_VALUE:
        case AGGTYPE_HIGH_WATER_MARK:
        case AGGTYPE_LOW_WATER_MARK:
        case AGGTYPE_IDENTITY:
        case AGGTYPE_DISTINCT_LEAF:
        case AGGTYPE_CUSTOM: {
            t_dtype coltype = schema.get_dtype(tbl_colname);
            t_dataformattype dftype = schema.get_data_format_type(tbl_colname);
            std::vector<t_col_name_type> rval(1);
            rval[0].m_name = name();
            rval[0].m_type = coltype;
            rval[0].m_dftype = dftype;
            return rval;
        }
        case AGGTYPE_DISTINCT_VALUES: {
            t_dtype coltype = schema.get_dtype(tbl_colname);
            t_dataformattype dftype = schema.get_data_format_type(tbl_colname);
            return mk_col_name_type_vec(name(), to_list_type(coltype), dftype);
        }
        default: {
            return get_output_specs(schema);
        }
    }
}

bool
t_aggspec::can_change_data_format() const {
    switch (agg()) {
        case AGGTYPE_SUM:
        case AGGTYPE_SUM_ABS:
        case AGGTYPE_PCT_SUM_PARENT:
        case AGGTYPE_PCT_SUM_GRAND_TOTAL:
        case AGGTYPE_MUL:
        case AGGTYPE_SUM_NOT_NULL:
        case AGGTYPE_ANY:
        case AGGTYPE_UNIQUE:
        case AGGTYPE_DOMINANT:
        case AGGTYPE_MEDIAN:
        case AGGTYPE_FIRST:
        case AGGTYPE_LAST:
        case AGGTYPE_OR:
        case AGGTYPE_LAST_VALUE:
        case AGGTYPE_HIGH_WATER_MARK:
        case AGGTYPE_LOW_WATER_MARK:
        case AGGTYPE_IDENTITY:
        case AGGTYPE_DISTINCT_LEAF:
        case AGGTYPE_CUSTOM:
        case AGGTYPE_DISTINCT_VALUES: {
            return true;
        } break;

        default: {
            return false;
        } break;
    }

    return false;
}

std::vector<t_col_name_type>
t_aggspec::mk_col_name_type_vec(const std::string& name, t_dtype dtype, t_dataformattype dftype) const {
    std::vector<t_col_name_type> rval(1);
    rval[0].m_name = name;
    rval[0].m_type = dtype;
    rval[0].m_dftype = dftype;
    return rval;
}

bool
t_aggspec::is_combiner_agg() const {
    return m_agg == AGGTYPE_UDF_COMBINER;
}

bool
t_aggspec::is_reducer_agg() const {
    return m_agg == AGGTYPE_UDF_REDUCER;
}

bool
t_aggspec::is_non_delta() const {
    switch (m_agg) {
        case AGGTYPE_LAST_VALUE:
        case AGGTYPE_LOW_WATER_MARK:
        case AGGTYPE_HIGH_WATER_MARK: {
            return true;
        }
        default:
            return false;
    }
    return false;
}

std::string
t_aggspec::get_first_depname() const {
    if (m_dependencies.empty())
        return "";

    return m_dependencies[0].name();
}

t_aggspec_recipe
t_aggspec::get_recipe() const {
    t_aggspec_recipe rv;
    rv.m_name = m_name;
    rv.m_disp_name = m_name;
    rv.m_agg = m_agg;

    for (const auto& d : m_dependencies) {
        rv.m_dependencies.push_back(d.get_recipe());
    }

    for (const auto& d : m_odependencies) {
        rv.m_odependencies.push_back(d.get_recipe());
    }

    rv.m_sort_type = m_sort_type;
    rv.m_agg_one_idx = m_agg_one_idx;
    rv.m_agg_two_idx = m_agg_two_idx;
    rv.m_agg_one_weight = m_agg_one_weight;
    rv.m_agg_two_weight = m_agg_two_weight;
    rv.m_invmode = m_invmode;

    return rv;
}

void
t_aggspec::update_column_name(const std::string& old_name, const std::string& new_name) {
    if (m_name != old_name) {
        return;
    }
    m_name = new_name;
    if (old_name == m_disp_name) {
        m_disp_name = new_name;
    }
    for (auto& d : m_odependencies) {
        if (old_name == d.name()) {
            d.update_column_name(old_name, new_name);
        }
    }
    for (auto& d : m_dependencies) {
        if (old_name == d.name()) {
            d.update_column_name(old_name, new_name);
        }
    }
}

} // end namespace perspective
