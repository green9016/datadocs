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
#include <perspective/base.h>
#include <perspective/raw_types.h>
#include <perspective/comparators.h>
#include <perspective/mask.h>
#include <perspective/scalar.h>
#include <perspective/exports.h>
#include <perspective/sym_table.h>
#include <boost/scoped_ptr.hpp>
#include <functional>
#include <set>

namespace perspective {

// Filter operators
template <typename DATA_T, template <typename> class OP_T>
struct t_operator_base {
    inline bool
    operator()(DATA_T value, DATA_T threshold_value) {
        OP_T<DATA_T> cmp;
        return cmp(value, threshold_value);
    }

    inline bool
    operator()(const char* value, const char* threshold_value) {
        t_const_char_comparator<OP_T> cmp;
        return cmp(value, threshold_value);
    }
};

template <typename DATA_T>
using t_operator_lt = t_operator_base<DATA_T, std::less>;

template <typename DATA_T>
using t_operator_lteq = t_operator_base<DATA_T, std::less_equal>;

template <typename DATA_T>
using t_operator_gt = t_operator_base<DATA_T, std::greater>;

template <typename DATA_T>
using t_operator_gteq = t_operator_base<DATA_T, std::greater_equal>;

template <typename DATA_T>
using t_operator_ne = t_operator_base<DATA_T, std::not_equal_to>;

template <typename DATA_T>
using t_operator_eq = t_operator_base<DATA_T, std::equal_to>;

template <typename DATA_T, int DTYPE_T>
struct t_operator_in {
    inline bool
    operator()(const DATA_T& value, const std::set<DATA_T>& threshold_values) {
        return threshold_values.find(value) != threshold_values.end();
    }
};

template <typename DATA_T, int DTYPE_T>
struct t_operator_not_in {
    inline bool
    operator()(const DATA_T& value, const std::set<DATA_T>& threshold_values) {
        return threshold_values.find(value) == threshold_values.end();
    }
};

template <typename DATA_T, int DTYPE_T>
struct t_operator_in_any {
    inline bool
    operator()(const DATA_T& value, const std::set<DATA_T>& threshold_values) {
        return threshold_values.find(value) != threshold_values.end();
    }
};

template <typename DATA_T, int DTYPE_T>
struct t_operator_in_all {
    inline bool
    operator()(const DATA_T& value, const std::set<DATA_T>& threshold_values) {
        return threshold_values.find(value) != threshold_values.end();
    }
};

template <typename DATA_T, int DTYPE_T>
struct t_operator_between {
    inline bool
    operator()(const DATA_T& value, const std::set<DATA_T>& threshold_values) {
        DATA_T first_val = threshold_values[0];
        DATA_T second_val = threshold_values[1];
        if (first_val < second_val) {
            return value >= first_val && value < second_val;
        } else {
            return value < first_val && value >= second_val;
        }
    }
};

template <typename DATA_T, int DTYPE_T>
struct t_operator_date_in_range {
    inline bool
    operator()(const DATA_T& value, const std::set<DATA_T>& threshold_values) {
        DATA_T first_val = threshold_values[0];
        DATA_T second_val = threshold_values[1];
        if (first_val < second_val) {
            return value >= first_val && value < second_val;
        } else {
            return value < first_val && value >= second_val;
        }
    }
};

template <typename DATA_T, int DTYPE_T>
struct t_operator_begins_with {
    inline bool
    operator()(DATA_T value, DATA_T threshold_value) {
        return false;
    }
};

template <typename DATA_T, int DTYPE_T>
struct t_operator_ends_with {
    inline bool
    operator()(DATA_T value, DATA_T threshold_value) {
        return false;
    }
};

template <typename DATA_T, int DTYPE_T>
struct t_operator_contains {
    inline bool
    operator()(DATA_T value, DATA_T threshold_value) {
        return false;
    }
};

template <>
struct t_operator_begins_with<const char*, DTYPE_STR> {
    inline bool
    operator()(const char* value, const char* threshold_value) {
        t_uindex t_vlen = strlen(value);
        t_uindex t_tlen = strlen(threshold_value);
        return t_vlen < t_tlen ? false : strncmp(value, threshold_value, t_tlen) == 0;
    }
};

template <>
struct t_operator_ends_with<t_uindex, DTYPE_STR> {
    inline bool
    operator()(const char* value, const char* threshold_value) {
        t_uindex t_vlen = strlen(value);
        t_uindex t_tlen = strlen(threshold_value);

        return t_vlen < t_tlen ? false
                               : strncmp(value + t_vlen - t_tlen, threshold_value, t_tlen) == 0;
    }
};

template <>
struct t_operator_contains<t_uindex, DTYPE_STR> {
    inline bool
    operator()(const char* value, const char* threshold_value) {
        return strstr(value, threshold_value) != 0;
    }
};

struct PERSPECTIVE_EXPORT t_fterm_dependency_recipe;

struct PERSPECTIVE_EXPORT t_fterm_dependency;

struct PERSPECTIVE_EXPORT t_fterm_recipe {
    t_fterm_recipe() {}

    std::string m_colname;
    t_filter_op m_op;
    t_tscalar m_threshold;
    std::vector<t_tscalar> m_bag;
    t_index m_level;
    t_index m_filterby_index;
    t_index m_subtotal_index;
    t_filter_previous m_previous;
    t_agg_level_type m_agg_level;
    t_binning_info m_binning;
    t_fterm_dependency_recipe *m_dependency;
};

struct PERSPECTIVE_EXPORT t_fterm {
    typedef std::function<uint32_t(t_uindex first, t_uindex last)> t_prepared;

    t_fterm();

    t_fterm(const t_fterm_recipe& v);

    t_fterm(const std::string& colname, t_filter_op op, t_tscalar threshold,
        const std::vector<t_tscalar>& bag, t_index level = t_index(-1),
        t_index filterby_index = t_index(-1), t_index subtotal_index = t_index(-1),
        t_filter_previous previous = FILTER_PREVIOUS_NO, t_agg_level_type agg_level = AGG_LEVEL_NONE,
        t_binning_info binning = t_binning_info{BINNING_TYPE_NONE}, t_fterm_dependency* dependency = nullptr);

    inline bool
    operator()(const t_tscalar &s) const {
        bool rv;
        switch (m_op) {
            case FILTER_OP_NOT_IN: {
                if (s.is_list() && s.is_valid()) {
                    if (s.is_list_empty()) {
                        auto empty_sca = mkempty(s.m_type);
                        rv = !std::binary_search(m_bag.begin(), m_bag.end(), empty_sca);
                    } else {
                        auto values = s.to_list<std::vector<t_tscalar>>();
                        rv = false;
                        for (t_uindex idx = 0, vsize = values.size(); idx < vsize; ++idx) {
                            auto not_in_list = !std::binary_search(m_bag.begin(), m_bag.end(), values[idx]);
                            if (not_in_list) {
                                rv = true;
                                break;
                            }
                        }
                    }
                } else {
                    rv = !std::binary_search(m_bag.begin(), m_bag.end(), s);
                }
            } break;
            case FILTER_OP_IN: {
                if (s.is_list() && s.is_valid()) {
                    if (s.is_list_empty()) {
                        auto empty_sca = mkempty(s.m_type);
                        rv = std::binary_search(m_bag.begin(), m_bag.end(), empty_sca);
                    } else {
                        auto values = s.to_list<std::vector<t_tscalar>>();
                        rv = false;
                        for (t_uindex idx = 0, vsize = values.size(); idx < vsize; ++idx) {
                            auto in_list = std::binary_search(m_bag.begin(), m_bag.end(), values[idx]);
                            if (in_list) {
                                rv = true;
                                break;
                            }
                        }
                    }
                } else {
                    rv = std::binary_search(m_bag.begin(), m_bag.end(), s);
                }
            } break;
            case FILTER_OP_IN_ANY: {
                rv = s.in_any(m_threshold);
            } break;
            case FILTER_OP_IN_ALL: {
                rv = s.in_all(m_threshold);
            } break;
            case FILTER_OP_ELE_BETWEEN: {
                t_tscalar first_val = m_bag[0];
                t_tscalar second_val = m_bag[1];
                std::vector<t_tscalar> elems = s.to_list<std::vector<t_tscalar>>();
                rv = false;
                for (t_uindex idx = 0, esize = elems.size(); idx < esize; ++idx) {
                    auto elem = elems[idx];
                    if (first_val < second_val) {
                        if (elem >= first_val && elem <= second_val) {
                            rv = true;
                            break;
                        }
                    } else {
                        if (elem <= first_val && elem >= second_val) {
                            rv = true;
                            break;
                        }
                    }
                }
            } break;
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
            case FILTER_OP_RELATIVE_DATE: {
                t_tscalar first_val = m_bag[0];
                t_tscalar second_val = m_bag[1];
                if (first_val < second_val) {
                    rv = s >= first_val && s < second_val;
                } else {
                    rv = s < first_val && s >= second_val;
                }
            } break;
            case FILTER_OP_IGNORE_ALL: {
                return false;
            } break;
            case FILTER_OP_TOP_N: {
                // Do nothing for case top here. always set true
                rv = true;
            } break;
            case FILTER_OP_ELE_IN_ANY: {
                rv = s.in_any(m_threshold);
            } break;
            case FILTER_OP_ELE_NOT_IN_ANY: {
                rv = !s.in_any(m_threshold);
            } break;
            case FILTER_OP_GROUP_FILTER: {
                rv = true;
            } break;
            default: { rv = s.cmp(m_op, m_threshold); } break;
        }

        return rv;
    }

    friend bool operator ==(const t_fterm &x, const t_fterm &y) {
        // comparing only fields that appear to be relevant for the result of the filter
        return x.m_colname == y.m_colname
            && x.m_op == y.m_op
            && x.m_threshold == y.m_threshold
            && x.m_bag == y.m_bag;
    }

    std::string get_expr() const;
    t_uindex get_level() const;

    void coerce_numeric(t_dtype dtype);
    t_fterm_recipe get_recipe() const;
    t_prepared optimized_prepare(const t_column *col) const;
    t_prepared prepare(const t_column *col, t_dataformattype force_df) const;

    std::string m_colname;
    t_filter_op m_op;
    t_tscalar m_threshold;
    std::vector<t_tscalar> m_bag;
    t_index m_level;
    t_index m_filterby_index;
    t_index m_subtotal_index;
    t_filter_previous m_previous;
    t_agg_level_type m_agg_level;
    t_binning_info m_binning;
    t_fterm_dependency *m_dependency;
    bool m_use_interned;
};

class PERSPECTIVE_EXPORT t_filter {
public:
    t_filter();
    t_filter(const std::vector<std::string>& columns);

    t_filter(const std::vector<std::string>& columns, t_uindex bidx, t_uindex eidx);

    t_filter(const std::vector<std::string>& columns, t_uindex mask_size);
    t_filter(const t_mask& mask);

    t_uindex num_cols() const;
    bool has_filter() const;
    const std::vector<std::string>& columns() const;
    t_select_mode mode() const;
    t_uindex bidx() const;
    t_uindex eidx() const;
    t_maskcsptr cmask() const;
    t_masksptr mask() const;
    t_uindex count() const;

private:
    t_select_mode m_mode;
    t_uindex m_bidx;
    t_uindex m_eidx;
    std::vector<std::string> m_columns;
    t_masksptr m_mask;
};

struct PERSPECTIVE_EXPORT t_fterm_dependency_recipe {
    t_fterm_dependency_recipe() {}

    t_filter_op m_combiner;
    std::vector<t_fterm_recipe> m_fterms;
};

struct PERSPECTIVE_EXPORT t_fterm_dependency {
    t_fterm_dependency() {}
    t_fterm_dependency(const t_fterm_dependency_recipe& v);

    t_filter_op m_combiner;
    std::vector<t_fterm> m_fterms;

    t_fterm_dependency_recipe* get_recipe() const;
};

} // end namespace perspective
