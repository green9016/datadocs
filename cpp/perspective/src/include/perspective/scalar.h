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
#include <perspective/exports.h>
#include <perspective/date.h>
#include <perspective/time.h>
#include <perspective/duration.h>
#include <perspective/decimal.h>
#include <perspective/none.h>
#include <perspective/data_format_spec.h>
#include <cstring>
#include <cstdio>
#include <functional>
#include <cstdint>
#include <vector>
#include <boost/algorithm/string/case_conv.hpp>
#include <sstream>
#include <functional> //std::hash
#include <boost/algorithm/string.hpp>

namespace perspective {

const t_uindex SCALAR_LIST_MAX_COMPARE_SIZE = 1;

template <template <typename COMPARED_T> class COMPARER_T>
struct PERSPECTIVE_EXPORT t_const_char_comparator {
    inline bool
    operator()(const char* s1, const char* s2) const {
        COMPARER_T<t_index> cmp;
        while (*s1 != '\0' && *s2 != '\0' && ((*s1 == *s2) || (tolower(*s1) == tolower(*s2)))) {
            s1++;
            s2++;
        }
        int cmpval = tolower(*s1) - tolower(*s2);
        return cmp(cmpval, 0);
    }
};

template <template <typename COMPARED_T> class COMPARER_T>
struct PERSPECTIVE_EXPORT t_list_string_comparator {
    inline bool
    operator()(std::vector<std::string> list1, std::vector<std::string> list2,
        bool is_min_size) const {
        COMPARER_T<t_index> cmp;
        t_uindex min_size = std::min<t_uindex>(list1.size(), list2.size());
        if (is_min_size) {
            min_size = std::min<t_uindex>(min_size, SCALAR_LIST_MAX_COMPARE_SIZE);
        }
        for (t_uindex idx = 0; idx < min_size; ++idx) {
            std::string str1 = boost::to_upper_copy<std::string>(list1[idx]);
            std::string str2 = boost::to_upper_copy<std::string>(list2[idx]);
            int cmpval = std::strcmp(str1.c_str(), str2.c_str());
            if (cmpval != 0) {
                return cmp(cmpval, 0);
            }
        }
        if (list1.size() == list2.size()) {
            return cmp(0, 0);
        } else if (list1.size() > list2.size()) {
            return cmp(1, 0);
        } else {
            return cmp(0, 1);
        }
    }
};

template <template <typename COMPARED_T> class COMPARER_T, typename DATA_T>
struct PERSPECTIVE_EXPORT t_list_comparator {
    inline bool
    operator()(std::vector<DATA_T> list1, std::vector<DATA_T> list2, bool is_min_size) const {
        COMPARER_T<DATA_T> cmp;
        COMPARER_T<t_uindex> int_cmp;
        t_uindex min_size = std::min<t_uindex>(list1.size(), list2.size());
        if (is_min_size) {
            min_size = std::min<t_uindex>(min_size, SCALAR_LIST_MAX_COMPARE_SIZE);
        }
        for (t_uindex idx = 0; idx < min_size; ++idx) {
            if (list1[idx] != list2[idx]) {
                return cmp(list1[idx], list2[idx]);
            }
        }
        if (list1.size() == list2.size()) {
            return int_cmp(0, 0);
        } else if (list1.size() > list2.size()) {
            return int_cmp(1, 0);
        } else {
            return int_cmp(0, 1);
        }
    }
};

const int SCALAR_INPLACE_LEN = 13;

union t_scalar_u {
    std::int64_t m_int64;
    std::int32_t m_int32;
    std::int16_t m_int16;
    std::int8_t m_int8;

    std::uint64_t m_uint64;
    std::uint32_t m_uint32;
    std::uint16_t m_uint16;
    std::uint8_t m_uint8;

    double m_float64;
    float m_float32;

    char* m_decimal;

    bool m_bool;

    const char* m_charptr;
    char m_inplace_char[SCALAR_INPLACE_LEN];

    std::string* m_list_string;
    bool* m_list_bool;
    double* m_list_float64;
    std::int64_t* m_list_int64;
    std::int32_t* m_list_int32;
};

// t_scalar should remain a POD type.
struct PERSPECTIVE_EXPORT t_tscalar {
    t_tscalar() = default;

    template <typename T>
    t_tscalar(const T& v) {
        set((T)v);
    }

    template <typename T>
    T get() const;

    void set(std::int64_t v);
    void set(std::int32_t v);
    void set(std::int16_t v);
    void set(std::int8_t v);

    void set(std::uint64_t v);
    void set(std::uint32_t v);
    void set(std::uint16_t v);
    void set(std::uint8_t v);

    void set(bool v);
    void set(t_date v);
    void set(t_time v);
    void set(t_duration v);
    void set(const char* v);
    void set(t_none v);
    void set(double v);
    void set(float v);
    void set(t_tscalar v);

    void set(std::vector<std::string> v);
    void set(std::vector<bool> v);
    void set(std::vector<double> v);
    void set(std::vector<std::int64_t> v);
    void set(std::vector<t_date> v);
    void set(std::vector<t_time> v);
    void set(std::vector<t_duration> v);
    void set(t_decimal v);

    void set_list(std::set<t_tscalar> values, t_dtype dtype);

	// Do NOT use in production
	void
    set(std::string v) {
        auto s = new std::string(v);
        set(s->data());
    }

    bool is_nan() const;
    bool is_none() const;
    bool is_str() const;
    bool is_of_type(unsigned char t) const;
    bool is_floating_point() const;
    bool is_signed() const;
    bool in_any(const t_tscalar& rhs) const;
    bool in_all(const t_tscalar& rhs) const;

    template <template <typename COMPARED_T> class COMPARER_T>
    bool compare_common(const t_tscalar& rhs) const;

    template <template <typename COMPARED_T> class COMPARER_T>
    bool compare_filter_list_common(const t_tscalar& rhs) const;

    bool operator==(const t_tscalar& rhs) const;
    bool operator!=(const t_tscalar& rhs) const;
    bool operator<(const t_tscalar& rhs) const;
    bool operator>(const t_tscalar& rhs) const;
    bool operator>=(const t_tscalar& rhs) const;
    bool operator<=(const t_tscalar& rhs) const;

    bool is_numeric() const;

    static t_tscalar canonical(t_dtype dtype);

    t_tscalar abs() const;
    t_tscalar negate() const;

    t_tscalar add(const t_tscalar& other) const;
    t_tscalar mul(const t_tscalar& other) const;
    t_tscalar difference(const t_tscalar& other) const;

    bool cmp(t_filter_op op, const t_tscalar& other) const;

    std::string repr() const;
    std::string to_string(bool for_expr = false, bool full_value = true, bool include_error = false) const;
    std::string to_search_string() const;
    double to_agg_level_number(t_agg_level_type agg_level) const;
    std::string to_agg_level_string(t_agg_level_type agg_level) const;
    std::string to_binning_string(t_binning_info binning, t_dataformattype df_type) const;
    t_tscalar to_binning_middle_value(t_binning_info binning) const;
    std::string formatted_with_binning(t_binning_info binning) const;
    std::string format_binning_string(t_dataformattype previous_df) const;
    std::vector<std::string> to_list_string() const;
    double to_double() const;
    std::int64_t to_int64() const;
    std::uint64_t to_uint64() const;

    template <typename LIST_T>
    LIST_T to_list() const;

    bool begins_with(const t_tscalar& other) const;
    bool string_begins_with(const t_tscalar& other, const std::string& str) const;
    bool ends_with(const t_tscalar& other) const;
    bool contains(const t_tscalar& other) const;
    bool string_contains(const t_tscalar& other, const std::string& str) const;
    bool not_contain(const t_tscalar& other) const;
    bool edge(const t_tscalar& other) const;
    bool string_edge(const t_tscalar& other, const std::string& str) const;
    bool pp_search_equals(const std::string& other, double* d, t_date *date) const;
    bool pp_search_contains(const std::string& other, double* d, t_date *date) const;
    bool pp_search_edge(const std::string& other, double* d, t_date *date) const;
    bool pp_search_begins_with(const std::string& other, double* d, t_date *date) const;
    bool is_valid() const;
    bool is_error() const;
    bool is_list() const;
    bool is_list_empty() const;
    operator bool() const;
    void clear();
    t_dtype get_dtype() const;
    const char* get_char_ptr() const;
    bool is_inplace() const;
    static bool can_store_inplace(const char* s);
    bool require_to_str() const;

    template <typename DATA_T>
    t_tscalar coerce_numeric() const;

    t_tscalar coerce_numeric_dtype(t_dtype dtype) const;

    t_scalar_u m_data;
    t_uindex m_list_size = 0;
    t_dtype m_type;
    t_dataformattype m_data_format_type;
    t_status m_status;
    std::string m_error_description;
    bool m_inplace;
};

inline t_tscalar operator"" _ts(long double v) {
    t_tscalar rv;
    double tmp = v;
    rv.set(tmp);
    return rv;
}

inline t_tscalar operator"" _ts(unsigned long long int v) {
    t_tscalar rv;
    std::int64_t tmp = v;
    rv.set(tmp);
    return rv;
}

inline t_tscalar operator"" _ts(const char* v, std::size_t len) {
    t_tscalar rv;
    rv.set(v);
    return rv;
}

inline t_tscalar operator"" _ns(long double v) {
    t_tscalar rv;
    rv.m_data.m_uint64 = 0;
    rv.m_type = DTYPE_FLOAT64;
    rv.m_data_format_type = DATA_FORMAT_NUMBER;
    rv.m_status = STATUS_INVALID;
    return rv;
}

inline t_tscalar operator"" _ns(unsigned long long int v) {
    t_tscalar rv;
    rv.m_data.m_uint64 = 0;
    rv.m_type = DTYPE_INT64;
    rv.m_data_format_type = DATA_FORMAT_NUMBER;
    rv.m_status = STATUS_INVALID;
    return rv;
}

inline t_tscalar operator"" _ns(const char* v, std::size_t len) {
    t_tscalar rv;
    rv.m_data.m_uint64 = 0;
    rv.m_type = DTYPE_STR;
    rv.m_data_format_type = DATA_FORMAT_TEXT;
    rv.m_status = STATUS_INVALID;
    return rv;
}

PERSPECTIVE_EXPORT t_tscalar mknone();
PERSPECTIVE_EXPORT t_tscalar mknull(t_dtype dtype);
PERSPECTIVE_EXPORT t_tscalar mkempty(t_dtype dtype);
PERSPECTIVE_EXPORT t_tscalar mkerror(t_dtype dtype);
PERSPECTIVE_EXPORT t_tscalar mkerror(const std::string& err);
PERSPECTIVE_EXPORT t_tscalar mkclear(t_dtype dtype);
PERSPECTIVE_EXPORT t_tscalar mk_agg_level_one(t_tscalar source, t_agg_level_type agg_level, t_dtype dtype, t_dataformattype dftype);

template <typename DATA_T>
t_tscalar
t_tscalar::coerce_numeric() const {
    auto v = to_double();
    DATA_T converted(v);
    t_tscalar rv = mknone();
    rv.set(converted);
    return rv;
}

template <>
t_tscalar t_tscalar::coerce_numeric<bool>() const;

template <>
std::int64_t t_tscalar::get() const;

template <>
std::int32_t t_tscalar::get() const;

template <>
std::int16_t t_tscalar::get() const;

template <>
std::int8_t t_tscalar::get() const;

template <>
std::uint64_t t_tscalar::get() const;

template <>
std::uint32_t t_tscalar::get() const;

template <>
std::uint16_t t_tscalar::get() const;

template <>
std::uint8_t t_tscalar::get() const;

template <>
t_date t_tscalar::get() const;

template <>
t_time t_tscalar::get() const;

template <>
t_duration t_tscalar::get() const;

template <>
const char* t_tscalar::get() const;

template <>
t_none t_tscalar::get() const;

template <>
double t_tscalar::get() const;

template <>
float t_tscalar::get() const;

template <>
bool t_tscalar::get() const;

template <>
std::vector<std::string> t_tscalar::get() const;

template <>
std::vector<bool> t_tscalar::get() const;

template <>
std::vector<double> t_tscalar::get() const;

template <>
std::vector<std::int64_t> t_tscalar::get() const;

template <>
std::vector<t_date> t_tscalar::get() const;

template <>
std::vector<t_time> t_tscalar::get() const;

template <>
std::vector<t_duration> t_tscalar::get() const;

template <>
t_decimal t_tscalar::get() const;

template <>
std::vector<std::string> t_tscalar::to_list() const;

template <>
std::vector<double> t_tscalar::to_list() const;

template <>
std::vector<std::int64_t> t_tscalar::to_list() const;

template <>
std::vector<t_date> t_tscalar::to_list() const;

template <>
std::vector<t_time> t_tscalar::to_list() const;

template <>
std::vector<t_duration> t_tscalar::to_list() const;

template<>
std::vector<t_tscalar> t_tscalar::to_list() const;

template <template <typename COMPARED_T> class COMPARER_T>
bool
t_tscalar::compare_common(const t_tscalar& rhs) const {
    if (m_type != rhs.m_type) {
        if (!is_numeric() || !rhs.is_numeric()) {
            COMPARER_T<unsigned char> cmp;
            return cmp(m_type, rhs.m_type);
        }
    }

    if (m_status != rhs.m_status) {
        COMPARER_T<unsigned char> cmp;
        return cmp(m_status, rhs.m_status);
    }

    if (!is_valid()) {
        COMPARER_T<unsigned char> cmp;
        return cmp(m_status, rhs.m_status);
    }

    switch (m_type) {
        case DTYPE_INT64: {
            COMPARER_T<std::int64_t> cmp;
            return cmp(m_data.m_int64, rhs.m_data.m_int64);
        } break;
        case DTYPE_INT32: {
            COMPARER_T<std::int32_t> cmp;
            return cmp(m_data.m_int32, rhs.m_data.m_int32);
        } break;
        case DTYPE_INT16: {
            COMPARER_T<std::int16_t> cmp;
            return cmp(m_data.m_int16, rhs.m_data.m_int16);
        } break;
        case DTYPE_INT8: {
            COMPARER_T<std::int8_t> cmp;
            return cmp(m_data.m_int8, rhs.m_data.m_int8);
        } break;
        case DTYPE_UINT64: {
            COMPARER_T<std::uint64_t> cmp;
            return cmp(m_data.m_uint64, rhs.m_data.m_uint64);
        } break;
        case DTYPE_UINT32: {
            COMPARER_T<std::uint32_t> cmp;
            return cmp(m_data.m_uint32, rhs.m_data.m_uint32);
        } break;
        case DTYPE_UINT16: {
            COMPARER_T<std::uint16_t> cmp;
            return cmp(m_data.m_uint16, rhs.m_data.m_uint16);
        } break;
        case DTYPE_UINT8: {
            COMPARER_T<std::uint8_t> cmp;
            return cmp(m_data.m_uint8, rhs.m_data.m_uint8);
        } break;
        case DTYPE_FLOAT64: {
            COMPARER_T<double> cmp;
            return cmp(m_data.m_float64, rhs.m_data.m_float64);
        } break;
        case DTYPE_FLOAT32: {
            COMPARER_T<float> cmp;
            return cmp(m_data.m_float32, rhs.m_data.m_float32);
        } break;
        case DTYPE_DATE: {
            COMPARER_T<std::int32_t> cmp;
            return cmp(m_data.m_int32, rhs.m_data.m_int32);
        } break;
        case DTYPE_TIME: {
            COMPARER_T<double> cmp;
            return cmp(m_data.m_float64, rhs.m_data.m_float64);
        } break;
        case DTYPE_DURATION: {
            COMPARER_T<double> cmp;
            return cmp(m_data.m_float64, rhs.m_data.m_float64);
        } break;
        case DTYPE_BOOL: {
            COMPARER_T<bool> cmp;
            return cmp(m_data.m_bool, rhs.m_data.m_bool);
        } break;
        case DTYPE_NONE: {
            COMPARER_T<t_none> cmp;
            return cmp(t_none(), t_none());
        } break;
        case DTYPE_STR: {
            t_const_char_comparator<COMPARER_T> cmp;
            return cmp(get_char_ptr(), rhs.get_char_ptr());
        } break;
        case DTYPE_LIST_STR: {
            t_list_string_comparator<COMPARER_T> cmp;
            return cmp(
                get<std::vector<std::string>>(), rhs.get<std::vector<std::string>>(), true);
        } break;
        case DTYPE_LIST_FLOAT64: {
            t_list_comparator<COMPARER_T, double> cmp;
            return cmp(get<std::vector<double>>(), rhs.get<std::vector<double>>(), true);
        } break;
        case DTYPE_LIST_INT64: {
            t_list_comparator<COMPARER_T, std::int64_t> cmp;
            return cmp(
                get<std::vector<std::int64_t>>(), rhs.get<std::vector<std::int64_t>>(), true);
        } break;
        case DTYPE_LIST_BOOL: {
            t_list_comparator<COMPARER_T, bool> cmp;
            return cmp(get<std::vector<bool>>(), rhs.get<std::vector<bool>>(), true);
        } break;
        case DTYPE_LIST_DATE: {
            t_list_comparator<COMPARER_T, t_date> cmp;
            return cmp(get<std::vector<t_date>>(), rhs.get<std::vector<t_date>>(), true);
        } break;
        case DTYPE_LIST_TIME: {
            t_list_comparator<COMPARER_T, t_time> cmp;
            return cmp(get<std::vector<t_time>>(), rhs.get<std::vector<t_time>>(), true);
        } break;
        case DTYPE_LIST_DURATION: {
            t_list_comparator<COMPARER_T, t_duration> cmp;
            return cmp(
                get<std::vector<t_duration>>(), rhs.get<std::vector<t_duration>>(), true);
        } break;
        default: {
#ifdef PSP_DEBUG
            std::cout << __FILE__ << ":" << __LINE__ << " Reached unknown type " << m_type
                      << std::endl;
#endif
            return false;
        }
    }
}

template <template <typename COMPARED_T> class COMPARER_T>
bool
t_tscalar::compare_filter_list_common(const t_tscalar& rhs) const {
    if (m_type != rhs.m_type) {
        COMPARER_T<unsigned char> cmp;
        return cmp(m_type, rhs.m_type);
    }

    if (m_status != rhs.m_status) {
        COMPARER_T<unsigned char> cmp;
        return cmp(m_status, rhs.m_status);
    }

    switch (m_type) {
        case DTYPE_LIST_STR: {
            t_list_string_comparator<COMPARER_T> cmp;
            return cmp(
                get<std::vector<std::string>>(), rhs.get<std::vector<std::string>>(), false);
        } break;
        case DTYPE_LIST_FLOAT64: {
            t_list_comparator<COMPARER_T, double> cmp;
            return cmp(get<std::vector<double>>(), rhs.get<std::vector<double>>(), false);
        } break;
        case DTYPE_LIST_INT64: {
            t_list_comparator<COMPARER_T, std::int64_t> cmp;
            return cmp(
                get<std::vector<std::int64_t>>(), rhs.get<std::vector<std::int64_t>>(), false);
        } break;
        case DTYPE_LIST_BOOL: {
            t_list_comparator<COMPARER_T, bool> cmp;
            return cmp(get<std::vector<bool>>(), rhs.get<std::vector<bool>>(), false);
        } break;
        case DTYPE_LIST_DATE: {
            t_list_comparator<COMPARER_T, t_date> cmp;
            return cmp(get<std::vector<t_date>>(), rhs.get<std::vector<t_date>>(), false);
        } break;
        case DTYPE_LIST_TIME: {
            t_list_comparator<COMPARER_T, t_time> cmp;
            return cmp(get<std::vector<t_time>>(), rhs.get<std::vector<t_time>>(), false);
        } break;
        case DTYPE_LIST_DURATION: {
            t_list_comparator<COMPARER_T, t_duration> cmp;
            return cmp(
                get<std::vector<t_duration>>(), rhs.get<std::vector<t_duration>>(), false);
        } break;
        default: { return compare_common<COMPARER_T>(rhs); } break;
    }
};

template <typename T>
struct t_tscal_extractor {
    static bool
    extract(T& output, const t_tscalar& in) {
        if (in.is_none()) {
            return false;
        }
        output = in.get<T>();
        return true;
    }
};

std::string repr(const t_tscalar& s);

size_t hash_value(const t_tscalar& s);

template <typename T>
t_tscalar
mktscalar(const T& v) {
    t_tscalar rval;
    rval.set(v);
    return rval;
}

t_tscalar mktscalar();

} // end namespace perspective

namespace std {

template <>
struct hash<perspective::t_tscalar> {
    // Enable the use of std::unordered_map
    size_t
    operator()(const perspective::t_tscalar& key) const {
        return perspective::hash_value(key);
    }
};

PERSPECTIVE_EXPORT std::ostream& operator<<(std::ostream& os, const perspective::t_tscalar& t);
PERSPECTIVE_EXPORT std::ostream& operator<<(
    std::ostream& os, const std::vector<perspective::t_tscalar>& t);
} // namespace std
