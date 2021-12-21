/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/filter.h>
#include <unordered_set>

namespace perspective {

t_fterm::t_fterm() {}

t_fterm::t_fterm(const t_fterm_recipe& v) {
    m_colname = v.m_colname;
    m_op = v.m_op;
    m_threshold = v.m_threshold;
    m_bag = v.m_bag;
    m_level = v.m_level;
    m_filterby_index = v.m_filterby_index;
    m_subtotal_index = v.m_subtotal_index;
    m_previous = v.m_previous;
    m_agg_level = v.m_agg_level;
    m_binning = v.m_binning;
    *m_dependency = t_fterm_dependency(*(v.m_dependency));
    //m_use_interned
    //    = (m_op == FILTER_OP_EQ || m_op == FILTER_OP_NE) && m_threshold.m_type == DTYPE_STR;
    m_use_interned = false;
}

t_fterm::t_fterm(const std::string& colname, t_filter_op op, t_tscalar threshold,
    const std::vector<t_tscalar>& bag, t_index level, t_index filterby_index,
    t_index subtotal_index, t_filter_previous previous, t_agg_level_type agg_level,
    t_binning_info binning, t_fterm_dependency* dependency)
    : m_colname(colname)
    , m_op(op)
    , m_threshold(threshold)
    , m_bag(bag)
    , m_level(level)
    , m_filterby_index(filterby_index)
    , m_subtotal_index(subtotal_index)
    , m_previous(previous)
    , m_agg_level(agg_level)
    , m_binning(binning)
    , m_dependency(dependency) {
    //m_use_interned
    //    = (op == FILTER_OP_EQ || op == FILTER_OP_NE) && threshold.m_type == DTYPE_STR;
    m_use_interned = false;
}

void
t_fterm::coerce_numeric(t_dtype dtype) {
    m_threshold.set(m_threshold.coerce_numeric_dtype(dtype));
    for (auto& f : m_bag) {
        if (f.is_valid()) {
            f.set(f.coerce_numeric_dtype(dtype));
        }
    }
}

t_fterm_recipe
t_fterm::get_recipe() const {
    t_fterm_recipe rv;
    rv.m_colname = m_colname;
    rv.m_op = m_op;
    rv.m_threshold = m_threshold;
    rv.m_bag = m_bag;
    rv.m_level = m_level;
    rv.m_filterby_index = m_filterby_index;
    rv.m_subtotal_index = m_subtotal_index;
    rv.m_previous = m_previous;
    rv.m_agg_level = m_agg_level;
    rv.m_binning = m_binning;
    rv.m_dependency = m_dependency->get_recipe();
    return rv;
}

t_uindex
t_fterm::get_level() const {
    return m_level;
}

std::string
t_fterm::get_expr() const {
    std::stringstream ss;

    ss << m_colname << " ";

    switch (m_op) {
        case FILTER_OP_LT:
        case FILTER_OP_LTEQ:
        case FILTER_OP_GT:
        case FILTER_OP_GTEQ:
        case FILTER_OP_EQ:
        case FILTER_OP_NE:
        case FILTER_OP_CONTAINS:
        case FILTER_OP_NOT_CONTAIN:
        case FILTER_OP_AFTER:
        case FILTER_OP_BEFORE:
        case FILTER_OP_ELE_EQ:
        case FILTER_OP_ELE_NE:
        case FILTER_OP_ELE_GT:
        case FILTER_OP_ELE_GTEQ:
        case FILTER_OP_ELE_LT:
        case FILTER_OP_ELE_LTEQ: {
            ss << filter_op_to_str(m_op) << " ";
            ss << m_threshold.to_string(true);
        } break;
        case FILTER_OP_NOT_IN:
        case FILTER_OP_IN_ANY:
        case FILTER_OP_IN_ALL:
        case FILTER_OP_IN:
        case FILTER_OP_BETWEEN:
        case FILTER_OP_ELE_BETWEEN: {
            ss << " " << filter_op_to_str(m_op) << " (";
            for (auto v : m_bag) {
                ss << v.to_string(true) << ", ";
            }
            ss << " )";
        } break;
        case FILTER_OP_BEGINS_WITH:
        case FILTER_OP_ENDS_WITH: {
            ss << "." << filter_op_to_str(m_op) << "( " << m_threshold.to_string(true) << " )";
        } break;
        case FILTER_OP_IGNORE_ALL: {
            ss << " " << filter_op_to_str(m_op);
        } break;
        case FILTER_OP_RELATIVE_DATE: {
            ss << " " << filter_op_to_str(m_op) << " (";
            for (auto v : m_bag) {
                ss << v.to_string(true) << ", ";
            }
            ss << " )";
        } break;
        case FILTER_OP_TOP_N: {
            ss << " " << filter_op_to_str(m_op) << " " << m_bag[0].to_string(true) << " type " << m_bag[1].to_string(true);
        } break;
        case FILTER_OP_GROUP_FILTER: {
            ss << " " << filter_op_to_str(m_op) << "(";
            ss << filter_op_to_str(m_dependency->m_combiner) << "(";
            for (t_uindex idx = 0, fsize = m_dependency->m_fterms.size(); idx < fsize; ++idx) {
                auto sub_f = m_dependency->m_fterms[idx];
                ss << sub_f.get_expr();
            }
            ss << ")";
            ss << " )";
        } break;
        default: { ss << " is failed_compilation"; }
    }

    return ss.str();
}

template<class T, class F>
static t_fterm::t_prepared
prepare_block(const t_column *col, F f) {
    const t_status *status = col->get_nth_status(0);
    const T *value = col->get_nth<T>(0);
    return [=](t_uindex first, t_uindex last) {
        uint32_t mask = 0;
        for(t_uindex i = first; i < last; ++i) {
            bool b = f(status[i], value[i]);
            mask |= b << (i - first);
        }
        return mask;
    };
}

template<class T, class U>
static t_fterm::t_prepared
prepare_in_t(const t_column *col, bool negate, const std::vector<t_tscalar> &bag) {
    static_assert(sizeof(T) == sizeof(U), "bit size mismatch");
    std::unordered_set<U> hash_bag;
    for(auto &x : bag) {
        T v = x.get<T>();
        U u;
        memcpy(&u, &v, sizeof(u));
        hash_bag.insert(u);
    }
    return prepare_block<U>(col, [=](t_status s, U x) {
        return s == STATUS_VALID && (hash_bag.find(x) != hash_bag.end()) != negate;
    });
}

static t_fterm::t_prepared
prepare_in_str(const t_column *col, bool negate, const std::vector<t_tscalar> &bag) {
    std::unordered_set<t_uindex> hash_bag;
    const t_vocab *vocab = &*col->get_vocab();
    for(auto &x : bag) {
        t_uindex u;
        if(vocab->string_exists(x.get_char_ptr(), u))
            hash_bag.insert(u);
    }
    return prepare_block<t_uindex>(col, [=](t_status s, t_uindex x) {
        return s == STATUS_VALID && (hash_bag.find(x) != hash_bag.end()) != negate;
    });
}

static t_fterm::t_prepared
prepare_in(const t_column *col, bool negate, std::vector<t_tscalar> bag) {
    t_dtype dtype = col->get_dtype();
    for(auto &x : bag)
        x = x.coerce_numeric_dtype(dtype);
    switch(dtype) {
    case DTYPE_INT64: return prepare_in_t<int64_t,uint64_t>(col, negate, bag);
    case DTYPE_INT32: return prepare_in_t<int32_t,uint32_t>(col, negate, bag);
    case DTYPE_INT16: return prepare_in_t<int16_t,uint16_t>(col, negate, bag);
    case DTYPE_INT8: return prepare_in_t<int8_t,uint8_t>(col, negate, bag);
    case DTYPE_UINT64: return prepare_in_t<uint64_t,uint64_t>(col, negate, bag);
    case DTYPE_UINT32: return prepare_in_t<uint32_t,uint32_t>(col, negate, bag);
    case DTYPE_UINT16: return prepare_in_t<uint16_t,uint16_t>(col, negate, bag);
    case DTYPE_UINT8: return prepare_in_t<uint8_t,uint8_t>(col, negate, bag);
    case DTYPE_FLOAT64: return prepare_in_t<double,uint64_t>(col, negate, bag);
    case DTYPE_FLOAT32: return prepare_in_t<float,uint32_t>(col, negate, bag);
    case DTYPE_BOOL: return prepare_in_t<bool,uint8_t>(col, negate, bag);
    case DTYPE_TIME: return prepare_in_t<t_time::t_rawtype,uint64_t>(col, negate, bag);
    case DTYPE_DATE: return prepare_in_t<t_date::t_rawtype,uint32_t>(col, negate, bag);
    case DTYPE_DURATION: return prepare_in_t<t_duration::t_rawtype,uint64_t>(col, negate, bag);
    case DTYPE_STR: return prepare_in_str(col, negate, bag);
    default: return nullptr;
    }
}

template<class T>
static t_fterm::t_prepared
prepare_between_t(const t_column *col, const t_tscalar &low, const t_tscalar &high) {
    T lo = low.get<T>(), hi = high.get<T>();
    if(hi < lo)
        std::swap(lo, hi);
    return prepare_block<T>(col, [=](t_status s, T x){ return s == STATUS_VALID && lo <= x && x < hi; });
}

static t_fterm::t_prepared
prepare_between(const t_column *col, t_tscalar low, t_tscalar high) {
    t_dtype dtype = col->get_dtype();
    low = low.coerce_numeric_dtype(dtype);
    high = high.coerce_numeric_dtype(dtype);

    switch(dtype) {
    case DTYPE_INT64: return prepare_between_t<int64_t>(col, low, high);
    case DTYPE_INT32: return prepare_between_t<int32_t>(col, low, high);
    case DTYPE_INT16: return prepare_between_t<int16_t>(col, low, high);
    case DTYPE_INT8: return prepare_between_t<int8_t>(col, low, high);
    case DTYPE_UINT64: return prepare_between_t<uint64_t>(col, low, high);
    case DTYPE_UINT32: return prepare_between_t<uint32_t>(col, low, high);
    case DTYPE_UINT16: return prepare_between_t<uint16_t>(col, low, high);
    case DTYPE_UINT8: return prepare_between_t<uint8_t>(col, low, high);
    case DTYPE_FLOAT64: return prepare_between_t<double>(col, low, high);
    case DTYPE_FLOAT32: return prepare_between_t<float>(col, low, high);
    default: return nullptr;
    }
}

t_fterm::t_prepared
t_fterm::optimized_prepare(const t_column *col) const {
    if(m_agg_level != AGG_LEVEL_NONE || m_binning.type != BINNING_TYPE_NONE)
        return nullptr;

    switch (m_op) {
        case FILTER_OP_NOT_IN: return prepare_in(col, true, m_bag);
        case FILTER_OP_IN: return prepare_in(col, false, m_bag);

        case FILTER_OP_BETWEEN:
        case FILTER_OP_TODAY:
        case FILTER_OP_YESTERDAY:
        case FILTER_OP_THIS_WEEK:
        case FILTER_OP_LAST_WEEK:
        case FILTER_OP_THIS_MONTH:
        case FILTER_OP_LAST_MONTH:
        case FILTER_OP_THIS_QUARTER:
        case FILTER_OP_LAST_QUARTER:
        case FILTER_OP_THIS_YEAR:
        case FILTER_OP_LAST_YEAR:
        case FILTER_OP_YEAR_TO_DATE:
        case FILTER_OP_RELATIVE_DATE:
            return prepare_between(col, m_bag[0], m_bag[1]);

        case FILTER_OP_IGNORE_ALL: return [](t_uindex,t_uindex) { return 0; };
        case FILTER_OP_TOP_N: return [](t_uindex,t_uindex) { return (t_uindex)-1; };
        default: return nullptr;
    }
}

t_fterm::t_prepared
t_fterm::prepare(const t_column *col, t_dataformattype force_df) const
{
    if(t_prepared ret = optimized_prepare(col))
        return ret;

    // slow way -- call the tscalar code-path
    const t_fterm *ft = this;
    return [=](t_uindex first, t_uindex last) {
        uint32_t mask = 0;
        for(t_uindex i = first; i < last; ++i) {
            t_tscalar cell_val = col->get_scalar(i);
            auto agg_level = m_agg_level;
            t_dataformattype df_type = dftype_from_dftype_and_agg_level(col->get_data_format_type(), agg_level);
            if (agg_level == AGG_LEVEL_YEAR) {
                if (cell_val.is_error()) {
                    cell_val = mkerror(DTYPE_INT64);
                } else if (!cell_val.is_valid()) {
                    cell_val = mknull(DTYPE_INT64);
                } else {
                    auto col_type = dtype_from_dtype_and_agg_level(col->get_dtype(), agg_level);
                    cell_val = mk_agg_level_one(cell_val, agg_level, col_type, df_type);
                }
            } else if (agg_level != AGG_LEVEL_NONE) {
                if (cell_val.is_error()) {
                    cell_val = mkerror(DTYPE_STR);
                } else if (!cell_val.is_valid()) {
                    cell_val = mknull(DTYPE_STR);
                } else {
                    auto col_type = dtype_from_dtype_and_agg_level(col->get_dtype(), agg_level);
                    auto temp_sca = mk_agg_level_one(cell_val, agg_level, col_type, df_type);
                    cell_val = get_interned_tscalar(temp_sca.to_string());
                }
            }
            if (m_binning.type != BINNING_TYPE_NONE) {
                if (cell_val.m_type == DTYPE_LIST_INT64 || cell_val.m_type == DTYPE_LIST_FLOAT64) {
                    auto vlist = cell_val.to_list<std::vector<t_tscalar>>();
                    std::set<t_tscalar> vset;
                    for (t_uindex idx = 0, vsize = vlist.size(); idx < vsize; ++idx) {
                        auto str_val = vlist[idx].to_binning_string(m_binning, df_type);
                        vset.insert(get_interned_tscalar(str_val.c_str()));
                    }
                    if (vset.size() == 0) {
                        cell_val = mkempty(cell_val.m_type);
                    } else {
                        cell_val.set_list(vset, DTYPE_LIST_STR);
                    }
                } else {
                    if (force_df == DATA_FORMAT_FINANCIAL || force_df == DATA_FORMAT_PERCENT) {
                        df_type = force_df;
                    }
                    auto str_val = cell_val.to_binning_string(m_binning, df_type);
                    cell_val = get_interned_tscalar(str_val.c_str());
                }
            }
            bool b = (*ft)(cell_val);
            mask |= b << (i - first);
        }
        return mask;
    };
}

t_filter::t_filter()
    : m_mode(SELECT_MODE_ALL) {}

t_filter::t_filter(const std::vector<std::string>& columns)
    : m_mode(SELECT_MODE_ALL)
    , m_columns(columns) {}

t_filter::t_filter(const std::vector<std::string>& columns, t_uindex bidx, t_uindex eidx)
    : m_mode(SELECT_MODE_RANGE)
    , m_bidx(bidx)
    , m_eidx(eidx)
    , m_columns(columns) {}

t_filter::t_filter(const std::vector<std::string>& columns, t_uindex mask_size)
    : m_mode(SELECT_MODE_MASK)
    , m_columns(columns)
    , m_mask(std::make_shared<t_mask>(mask_size)) {}

t_uindex
t_filter::num_cols() const {
    return m_columns.size();
}

bool
t_filter::has_filter() const {
    return m_mode != SELECT_MODE_ALL;
}

const std::vector<std::string>&
t_filter::columns() const {
    return m_columns;
}

t_select_mode
t_filter::mode() const {
    return m_mode;
}

t_uindex
t_filter::bidx() const {
    return m_bidx;
}

t_uindex
t_filter::eidx() const {
    return m_eidx;
}

t_maskcsptr
t_filter::cmask() const {
    return t_maskcsptr(m_mask);
}

t_masksptr
t_filter::mask() const {
    return t_masksptr(m_mask);
}

t_uindex
t_filter::count() const {
    return m_mask->count();
}

t_fterm_dependency::t_fterm_dependency(const t_fterm_dependency_recipe& v) {
    m_combiner = v.m_combiner;
    m_fterms = {};
    for (t_uindex idx = 0, fsize = v.m_fterms.size(); idx < fsize; ++idx) {
        m_fterms.push_back(t_fterm(v.m_fterms[idx]));
    }
}

t_fterm_dependency_recipe*
t_fterm_dependency::get_recipe() const {
    t_fterm_dependency_recipe* rv = new t_fterm_dependency_recipe();
    rv->m_combiner = m_combiner;
    rv->m_fterms = {};
    for (t_uindex idx = 0, fsize = m_fterms.size(); idx < fsize; ++idx) {
        rv->m_fterms.push_back(m_fterms[idx].get_recipe());
    }
    return rv;
}

} // end namespace perspective
