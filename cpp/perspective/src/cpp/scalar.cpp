/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/raw_types.h>
#include <perspective/scalar.h>
#include <perspective/sym_table.h>
#include <cstring>
#include <cstdio>
#include <functional>
#include <boost/cstdint.hpp>
#include <vector>
#include <boost/algorithm/string/case_conv.hpp>
#include <sstream>
#include <cmath>
#include <limits>
SUPPRESS_WARNINGS_VC(4800)

namespace utils {
// UTILS

inline bool
lower_test(char l, char r) {
    return (std::tolower(l) == std::tolower(r));
}

inline int
ifind(int len, const char* text, const std::string& search) {
    auto fpos = std::search(text, text + len, search.begin(), search.end(), lower_test);
    if (fpos != text + len)
        return std::distance(text, fpos);
    return std::string::npos;
}

inline int
strcicmp(char const* a, char const* b) {
    for (;; a++, b++) {
        int d = tolower((unsigned char)*a) - tolower((unsigned char)*b);
        if (d != 0 || !*a)
            return d;
    }
}

inline bool
contains(const char* self, const char* other) {
    if (!self || !other)
        return false;
    std::string ostr = other;
    size_t idx = ifind(strlen(self), self, ostr);
    return idx != std::string::npos;
}
inline bool
is_number(const char* s, double* out = nullptr) {
    if (!s)
        return false;
    char* end = 0;
    double val = strtod(s, &end);
    if (out)
        *out = val;
    return end != s && val != HUGE_VAL;
}

inline bool
edge(const char* sstr, const std::string& ostr) {
    int len = strlen(sstr);
    {
        bool space = false;
        for (int i = 0; i < INT32_MAX; ++i) {
            auto ch = sstr[i];
            if (!ch)
                break;
            if (isspace(ch)) {
                space = 1;
                break;
            }
        }
        if (!space && tolower(ostr[0]) != tolower(sstr[0]))
            return false;
    }
    size_t idx = ifind(len, sstr, ostr);
    if (idx == std::string::npos) {
        return false;
    }
    if (idx == 0) {
        return true;
    } else {
        size_t eidx = ifind(len, sstr, " " + ostr);
        if (eidx != std::string::npos) {
            return true;
        }
    }
    return false;
}

bool
begins_with(const char* string, const char* prefix) {
    while (*prefix) {
        if (tolower(*prefix++) != tolower(*string++))
            return false;
    }
    return true;
}
} // namespace utils

namespace perspective {
static const std::vector<const char*> month_names = {"_____________________zero", "jan", "feb",
    "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"};

bool
t_tscalar::is_none() const {
    return m_type == DTYPE_NONE;
}

bool
t_tscalar::is_str() const {
    return m_type == DTYPE_STR;
}

bool
t_tscalar::is_of_type(unsigned char t) const {
    return m_type == t;
}

bool
t_tscalar::operator==(const t_tscalar& rhs) const {
    if (m_status != rhs.m_status)
        return false;

    if ((!is_numeric() || !rhs.is_numeric()) && m_type != rhs.m_type) {
        return false;
    }

    if (m_type == DTYPE_BOOL)
        return get<bool>() == rhs.get<bool>();

    switch (m_type) {
        case DTYPE_DATE: {
            return get<t_date>() == rhs.get<t_date>();
        } break;
        case DTYPE_DURATION: {
            return get<t_duration>() == rhs.get<t_duration>();
        } break;
        case DTYPE_TIME: {
            return get<t_time>() == rhs.get<t_time>();
        } break;
        case DTYPE_LIST_BOOL: {
            if (m_list_size != rhs.m_list_size) {
                return false;
            }
            std::vector<bool> list_bool = get<std::vector<bool>>();
            std::vector<bool> rhs_list_bool = rhs.get<std::vector<bool>>();
            for (t_uindex idx = 0; idx < m_list_size; ++idx) {
                if (list_bool[idx] != rhs_list_bool[idx]) {
                    return false;
                }
            }
            return true;
        } break;

        case DTYPE_LIST_FLOAT64: {
            if (m_list_size != rhs.m_list_size) {
                return false;
            }
            std::vector<double> list_float = get<std::vector<double>>();
            std::vector<double> rhs_list_float = rhs.get<std::vector<double>>();
            for (t_uindex idx = 0; idx < m_list_size; ++idx) {
                if (list_float[idx] != rhs_list_float[idx]) {
                    return false;
                }
            }
            return true;
        } break;

        case DTYPE_LIST_INT64: {
            if (m_list_size != rhs.m_list_size) {
                return false;
            }
            std::vector<std::int64_t> list_int = get<std::vector<std::int64_t>>();
            std::vector<std::int64_t> rhs_list_int = rhs.get<std::vector<std::int64_t>>();
            for (t_uindex idx = 0; idx < m_list_size; ++idx) {
                if (list_int[idx] != rhs_list_int[idx]) {
                    return false;
                }
            }
            return true;
        } break;

        case DTYPE_LIST_DATE: {
            if (m_list_size != rhs.m_list_size) {
                return false;
            }
            std::vector<t_date> list_date = get<std::vector<t_date>>();
            std::vector<t_date> rhs_list_date = rhs.get<std::vector<t_date>>();
            for (t_uindex idx = 0; idx < m_list_size; ++idx) {
                if (list_date[idx] != rhs_list_date[idx]) {
                    return false;
                }
            }
            return true;
        } break;

        case DTYPE_LIST_TIME: {
            if (m_list_size != rhs.m_list_size) {
                return false;
            }
            std::vector<t_time> list_time = get<std::vector<t_time>>();
            std::vector<t_time> rhs_list_time = rhs.get<std::vector<t_time>>();
            for (t_uindex idx = 0; idx < m_list_size; ++idx) {
                if (list_time[idx] != rhs_list_time[idx]) {
                    return false;
                }
            }
            return true;
        } break;

        case DTYPE_LIST_DURATION: {
            if (m_list_size != rhs.m_list_size) {
                return false;
            }
            std::vector<t_duration> list_duration = get<std::vector<t_duration>>();
            std::vector<t_duration> rhs_list_duration = rhs.get<std::vector<t_duration>>();
            for (t_uindex idx = 0; idx < m_list_size; ++idx) {
                if (list_duration[idx] != rhs_list_duration[idx]) {
                    return false;
                }
            }
            return true;
        } break;

        case DTYPE_LIST_STR: {
            if (m_list_size != rhs.m_list_size) {
                return false;
            }
            std::vector<std::string> list_string = get<std::vector<std::string>>();
            std::vector<std::string> rhs_list_string = rhs.get<std::vector<std::string>>();
            for (t_uindex idx = 0; idx < m_list_size; ++idx) {
                if (strcmp(list_string[idx].c_str(), rhs_list_string[idx].c_str()) != 0) {
                    return false;
                }
            }
            return true;
        } break;

        default:
            break;
    }

    if (m_type != DTYPE_STR)
        return m_data.m_uint64 == rhs.m_data.m_uint64;

    return strcmp(get_char_ptr(), rhs.get_char_ptr()) == 0;
}

bool
t_tscalar::operator!=(const t_tscalar& rhs) const {
    return !operator==(rhs);
}

bool
t_tscalar::operator<(const t_tscalar& rhs) const {
    if (m_type == rhs.m_type && is_valid() && rhs.is_valid()) {
        if (m_type == DTYPE_DURATION) {
            return get<t_duration>() < rhs.get<t_duration>();
        } else if (m_type == DTYPE_TIME) {
            return get<t_time>() < rhs.get<t_time>();
        }
    }
    return compare_common<std::less>(rhs);
}

bool
t_tscalar::operator>(const t_tscalar& rhs) const {
    if (m_type == rhs.m_type && is_valid() && rhs.is_valid()) {
        if (m_type == DTYPE_DURATION) {
            return get<t_duration>() > rhs.get<t_duration>();
        } else if (m_type == DTYPE_TIME) {
            return get<t_time>() > rhs.get<t_time>();
        }
    }
    return compare_common<std::greater>(rhs);
}

bool
t_tscalar::operator>=(const t_tscalar& rhs) const {
    if (m_type == rhs.m_type && is_valid() && rhs.is_valid()) {
        if (m_type == DTYPE_DURATION) {
            return get<t_duration>() >= rhs.get<t_duration>();
        } else if (m_type == DTYPE_TIME) {
            return get<t_time>() >= rhs.get<t_time>();
        }
    }
    return compare_common<std::greater_equal>(rhs);
}

bool
t_tscalar::operator<=(const t_tscalar& rhs) const {
    if (m_type == rhs.m_type && is_valid() && rhs.is_valid()) {
        if (m_type == DTYPE_DURATION) {
            return get<t_duration>() <= rhs.get<t_duration>();
        } else if (m_type == DTYPE_TIME) {
            return get<t_time>() <= rhs.get<t_time>();
        }
    }
    return compare_common<std::less_equal>(rhs);
}

bool
t_tscalar::is_numeric() const {
    return is_numeric_type(static_cast<t_dtype>(m_type));
}

void
t_tscalar::clear() {
    m_type = DTYPE_NONE;
    m_data_format_type = DATA_FORMAT_NONE;
    m_data.m_uint64 = 0;
    m_status = STATUS_INVALID;
}

t_tscalar
t_tscalar::canonical(t_dtype dtype) {
    t_tscalar rval;
    rval.clear();
    rval.m_status = STATUS_VALID;

    switch (dtype) {
        case DTYPE_INT64: {
            rval.set(std::int64_t(0));
        } break;
        case DTYPE_INT32: {
            rval.set(std::int32_t(0));
        } break;
        case DTYPE_INT16: {
            rval.set(std::int16_t(0));
        } break;
        case DTYPE_INT8: {
            rval.set(std::int8_t(0));
        } break;

        case DTYPE_UINT64: {
            rval.set(std::uint64_t(0));
        } break;
        case DTYPE_UINT32: {
            rval.set(std::uint32_t(0));
        } break;
        case DTYPE_UINT16: {
            rval.set(std::uint16_t(0));
        } break;
        case DTYPE_UINT8: {
            rval.set(std::uint8_t(0));
        } break;

        case DTYPE_FLOAT64: {
            rval.set(double(0));
        } break;
        case DTYPE_FLOAT32: {
            rval.set(float(0));
        } break;
        case DTYPE_DATE: {
            rval.set(t_date(std::int32_t(0)));
        } break;
        case DTYPE_TIME: {
            rval.set(t_time(0));
        } break;
        case DTYPE_DURATION: {
            rval.set(t_duration(0));
        } break;
        case DTYPE_BOOL: {
            rval.set(bool(0));
        } break;
        case DTYPE_NONE: {
            // handled trivially
        } break;
        case DTYPE_STR: {
            rval.m_type = DTYPE_STR;
            rval.m_data_format_type = DATA_FORMAT_TEXT;
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Found unknown dtype."); }
    }

    return rval;
}

void
t_tscalar::set(std::int64_t v) {
    m_type = DTYPE_INT64;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_int64 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::int32_t v) {
    m_type = DTYPE_INT32;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_uint64 = 0;
    m_data.m_int32 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::int16_t v) {
    m_type = DTYPE_INT16;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_uint64 = 0;
    m_data.m_int16 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::int8_t v) {
    m_type = DTYPE_INT8;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_uint64 = 0;
    m_data.m_int8 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::uint64_t v) {
    m_type = DTYPE_UINT64;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_uint64 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::uint32_t v) {
    m_type = DTYPE_UINT32;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_uint64 = 0;
    m_data.m_uint32 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::uint16_t v) {
    m_type = DTYPE_UINT16;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_uint64 = 0;
    m_data.m_uint16 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::uint8_t v) {
    m_type = DTYPE_UINT8;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_uint64 = 0;
    m_data.m_uint8 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(double v) {
    m_type = DTYPE_FLOAT64;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_float64 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(float v) {
    m_type = DTYPE_FLOAT32;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_uint64 = 0;
    m_data.m_float32 = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(bool v) {
    m_type = DTYPE_BOOL;
    m_data_format_type = DATA_FORMAT_TRUE_FALSE;
    m_data.m_uint64 = 0;
    m_data.m_bool = v;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(const char* v) {
    m_type = DTYPE_STR;
    m_data_format_type = DATA_FORMAT_TEXT;
    if (can_store_inplace(v)) {
        strncpy(reinterpret_cast<char*>(&m_data), v, SCALAR_INPLACE_LEN);
        m_inplace = true;
    } else {
        m_data.m_charptr = v;
        m_inplace = false;
    }

    m_status = STATUS_VALID;
}

void
t_tscalar::set(const t_date v) {
    m_type = DTYPE_DATE;
    m_data_format_type = DATA_FORMAT_DATE_V1;
    m_data.m_int32 = v.raw_value();
    m_status = STATUS_VALID;
}

void
t_tscalar::set(const t_time v) {
    m_type = DTYPE_TIME;
    m_data_format_type = DATA_FORMAT_DATETIME;
    m_data.m_float64 = v.raw_value();
    m_status = STATUS_VALID;
}

void
t_tscalar::set(const t_duration v) {
    m_type = DTYPE_DURATION;
    m_data_format_type = DATA_FORMAT_DURATION;
    m_data.m_float64 = v.raw_value();
    m_status = STATUS_VALID;
}

void
t_tscalar::set(const t_none v) {
    m_data.m_uint64 = 0;
    m_type = DTYPE_NONE;
    m_data_format_type = DATA_FORMAT_NONE;
    m_status = STATUS_VALID;
}

void
t_tscalar::set(const t_tscalar v) {
    m_type = v.m_type;
    memcpy(&m_data, &(v.m_data), SCALAR_INPLACE_LEN);
    m_status = v.m_status;
    m_inplace = v.m_inplace;
    m_list_size = v.m_list_size;
    m_data_format_type = v.m_data_format_type;
}

void
t_tscalar::set(std::vector<std::string> v) {
    m_type = DTYPE_LIST_STR;
    m_data_format_type = DATA_FORMAT_TEXT;
    m_list_size = v.size();
    m_data.m_list_string = new std::string[m_list_size];
    for (t_uindex i = 0; i < m_list_size; i++) {
        m_data.m_list_string[i] = v[i];
    }
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::vector<bool> v) {
    m_type = DTYPE_LIST_BOOL;
    m_data_format_type = DATA_FORMAT_TRUE_FALSE;
    m_list_size = v.size();
    m_data.m_list_bool = new bool[m_list_size];
    for (t_uindex i = 0; i < m_list_size; i++) {
        m_data.m_list_bool[i] = v[i];
    }
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::vector<double> v) {
    m_type = DTYPE_LIST_FLOAT64;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_list_size = v.size();
    m_data.m_list_float64 = new double[m_list_size];
    for (t_uindex i = 0; i < m_list_size; i++) {
        m_data.m_list_float64[i] = v[i];
    }
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::vector<std::int64_t> v) {
    m_type = DTYPE_LIST_INT64;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_list_size = v.size();
    m_data.m_list_int64 = new std::int64_t[m_list_size];
    for (t_uindex i = 0; i < m_list_size; i++) {
        m_data.m_list_int64[i] = v[i];
    }
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::vector<t_date> v) {
    m_type = DTYPE_LIST_DATE;
    m_data_format_type = DATA_FORMAT_DATE_V1;
    m_list_size = v.size();
    m_data.m_list_int32 = new std::int32_t[m_list_size];
    for (t_uindex i = 0; i < m_list_size; i++) {
        m_data.m_list_int32[i] = v[i].raw_value();
    }
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::vector<t_time> v) {
    m_type = DTYPE_LIST_TIME;
    m_data_format_type = DATA_FORMAT_DATETIME;
    m_list_size = v.size();
    m_data.m_list_float64 = new double[m_list_size];
    for (t_uindex i = 0; i < m_list_size; i++) {
        m_data.m_list_float64[i] = v[i].raw_value();
    }
    m_status = STATUS_VALID;
}

void
t_tscalar::set(std::vector<t_duration> v) {
    m_type = DTYPE_LIST_DURATION;
    m_data_format_type = DATA_FORMAT_DURATION;
    m_list_size = v.size();
    m_data.m_list_float64 = new double[m_list_size];
    for (t_uindex i = 0; i < m_list_size; i++) {
        m_data.m_list_float64[i] = v[i].raw_value();
    }
    m_status = STATUS_VALID;
}

void
t_tscalar::set(t_decimal v) {
    m_type = DTYPE_DECIMAL;
    m_data_format_type = DATA_FORMAT_NUMBER;
    m_data.m_decimal = new char[v.decNumberToString().length()];
    strcpy(m_data.m_decimal, v.decNumberToString().c_str());
    m_status = STATUS_VALID;
}

void
t_tscalar::set_list(std::set<t_tscalar> values, t_dtype dtype) {
    switch(dtype) {
        case DTYPE_LIST_BOOL: {
            std::vector<bool> list_bool{};
            for(auto v: values) {
                if (!v.is_valid() || v.is_error() || v.is_none()) {
                    continue;
                }
                list_bool.push_back(v.get<bool>());
            }
            set(list_bool);
        } break;
        case DTYPE_LIST_DATE: {
            std::vector<t_date> list_date{};
            for(auto v: values) {
                if (!v.is_valid() || v.is_error() || v.is_none()) {
                    continue;
                }
                list_date.push_back(v.get<t_date>());
            }
            set(list_date);
        } break;
        case DTYPE_LIST_TIME: {
            std::vector<t_time> list_time{};
            for(auto v: values) {
                if (!v.is_valid() || v.is_error() || v.is_none()) {
                    continue;
                }
                list_time.push_back(v.get<t_time>());
            }
            set(list_time);
        } break;
        case DTYPE_LIST_DURATION: {
            std::vector<t_duration> list_duration{};
            for(auto v: values) {
                if (!v.is_valid() || v.is_error() || v.is_none()) {
                    continue;
                }
                list_duration.push_back(v.get<t_duration>());
            }
            set(list_duration);
        } break;
        case DTYPE_LIST_INT64: {
            std::vector<std::int64_t> list_int64{};
            for(auto v: values) {
                if (!v.is_valid() || v.is_error() || v.is_none()) {
                    continue;
                }
                list_int64.push_back(v.get<std::int64_t>());
            }
            set(list_int64);
        } break;
        case DTYPE_LIST_FLOAT64: {
            std::vector<double> list_double{};
            for(auto v: values) {
                if (!v.is_valid() || v.is_error() || v.is_none()) {
                    continue;
                }
                list_double.push_back(v.get<double>());
            }
            set(list_double);
        } break;
        case DTYPE_LIST_STR: {
            std::vector<std::string> list_str{};
            for(auto v: values) {
                if (!v.is_valid() || v.is_error() || v.is_none()) {
                    continue;
                }
                list_str.push_back(v.to_string());
            }
            set(list_str);
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Unexpected scalar list type");
        } break;
    }
}

t_tscalar
t_tscalar::abs() const {
    t_tscalar rval;
    rval.clear();
    rval.m_type = m_type;
    rval.m_data_format_type = m_data_format_type;

    if (!is_valid())
        return rval;

    switch (m_type) {
        case DTYPE_INT64: {
            std::int64_t v = std::abs(to_double());
            rval.set(v);
        } break;
        case DTYPE_INT32: {
            std::int32_t v = std::abs(to_double());
            rval.set(v);
        } break;
        case DTYPE_INT16: {
            std::int16_t v = std::abs(to_double());
            rval.set(v);
        } break;
        case DTYPE_INT8: {
            std::int8_t v = std::abs(to_double());
            rval.set(v);
        } break;
        case DTYPE_UINT64:
        case DTYPE_UINT32:
        case DTYPE_UINT16:
        case DTYPE_UINT8: {
            return *this;
        } break;

        case DTYPE_FLOAT64: {
            rval.set(std::abs(m_data.m_float64));
        } break;
        case DTYPE_FLOAT32: {
            rval.set(std::abs(m_data.m_float32));
        } break;
        case DTYPE_DECIMAL: {
            t_decimal v = get<t_decimal>();
            rval.set(t_decimal(std::to_string(std::abs(v.decNumberToDouble()))));
        } break;
        default: {
            // no-op
        }
    }
    return rval;
}

t_tscalar
t_tscalar::negate() const {
    t_tscalar rval;
    rval.clear();
    rval.m_type = m_type;
    rval.m_data_format_type = m_data_format_type;

    if (!is_valid())
        return rval;

    switch (m_type) {
        case DTYPE_INT64: {
            rval.set(-(m_data.m_int64));
        } break;
        case DTYPE_INT32: {
            rval.set(-(m_data.m_int32));
        } break;
        case DTYPE_INT16: {
            rval.set(-(m_data.m_int16));
        } break;
        case DTYPE_INT8: {
            rval.set(-(m_data.m_int8));
        } break;

        case DTYPE_UINT64: {
            rval.set(~m_data.m_uint64);
        } break;
        case DTYPE_UINT32: {
            rval.set(~m_data.m_uint32);
        } break;
        case DTYPE_UINT16: {
            rval.set(~m_data.m_uint16);
        } break;
        case DTYPE_UINT8: {
            rval.set(~m_data.m_uint8);
        } break;

        case DTYPE_FLOAT64: {
            rval.set(-(m_data.m_float64));
        } break;
        case DTYPE_FLOAT32: {
            rval.set(-(m_data.m_float32));
        } break;
        default: {
            // no-op
        }
    }
    return rval;
}

t_tscalar
t_tscalar::add(const t_tscalar& other) const {
    t_tscalar rval;
    rval.clear();
    rval.m_type = m_type;
    rval.m_data_format_type = m_data_format_type;

    if (!other.is_valid())
        return *this;

    if (!is_valid())
        return other;

    if (m_type != other.m_type)
        return rval;

    if (m_type == DTYPE_NONE) {
        rval.set(other);
        return rval;
    }

    if (other.m_type == DTYPE_NONE) {
        return *this;
    }

    switch (m_type) {
        case DTYPE_INT64: {
            rval.set(m_data.m_int64 + other.m_data.m_int64);
        } break;
        case DTYPE_INT32: {
            rval.set(m_data.m_int32 + other.m_data.m_int32);
        } break;
        case DTYPE_INT16: {
            rval.set(m_data.m_int16 + other.m_data.m_int16);
        } break;
        case DTYPE_INT8: {
            rval.set(m_data.m_int8 + other.m_data.m_int8);
        } break;

        case DTYPE_UINT64: {
            rval.set(m_data.m_uint64 + other.m_data.m_uint64);
        } break;
        case DTYPE_UINT32: {
            rval.set(m_data.m_uint32 + other.m_data.m_uint32);
        } break;
        case DTYPE_UINT16: {
            rval.set(m_data.m_uint16 + other.m_data.m_uint16);
        } break;
        case DTYPE_UINT8: {
            rval.set(m_data.m_uint8 + other.m_data.m_uint8);
        } break;

        case DTYPE_FLOAT64: {
            rval.set(m_data.m_float64 + other.m_data.m_float64);
        } break;
        case DTYPE_FLOAT32: {
            rval.set(m_data.m_float32 + other.m_data.m_float32);
        } break;
        case DTYPE_DECIMAL: {
            rval.set(t_decimal(m_data.m_decimal) + t_decimal(other.m_data.m_decimal));
        }
        default: {
            // no-op
        }
    }
    return rval;
}

t_tscalar
t_tscalar::difference(const t_tscalar& other) const {
    t_tscalar rval;
    rval.clear();
    rval.m_type = m_type;
    rval.m_data_format_type = m_data_format_type;

    if (!other.is_valid())
        return *this;

    if (!is_valid())
        return other.negate();

    if (m_type != other.m_type)
        return rval;

    if (m_type == DTYPE_NONE) {
        rval.set(other.negate());
        return rval;
    }

    if (other.m_type == DTYPE_NONE) {
        return *this;
    }

    switch (m_type) {
        case DTYPE_INT64: {
            rval.set(m_data.m_int64 - other.m_data.m_int64);
        } break;
        case DTYPE_INT32: {
            rval.set(m_data.m_int32 - other.m_data.m_int32);
        } break;
        case DTYPE_INT16: {
            rval.set(m_data.m_int16 - other.m_data.m_int16);
        } break;
        case DTYPE_INT8: {
            rval.set(m_data.m_int8 - other.m_data.m_int8);
        } break;

        case DTYPE_UINT64: {
            rval.set(m_data.m_uint64 - other.m_data.m_uint64);
        } break;
        case DTYPE_UINT32: {
            rval.set(m_data.m_uint32 - other.m_data.m_uint32);
        } break;
        case DTYPE_UINT16: {
            rval.set(m_data.m_uint16 - other.m_data.m_uint16);
        } break;
        case DTYPE_UINT8: {
            rval.set(m_data.m_uint8 - other.m_data.m_uint8);
        } break;

        case DTYPE_FLOAT64: {
            rval.set(m_data.m_float64 - other.m_data.m_float64);
        } break;
        case DTYPE_FLOAT32: {
            rval.set(m_data.m_float32 - other.m_data.m_float32);
        } break;
        default: {
            // no-op
        }
    }
    return rval;
}

t_tscalar
t_tscalar::mul(const t_tscalar& other) const {

    bool fp = is_floating_point() || other.is_floating_point();
    t_tscalar rval;

    if (fp) {
        rval.set(to_double() * other.to_double());
        return rval;
    }

    bool is_s = is_signed() || other.is_signed();
    if (is_s) {
        rval.set(to_int64() * other.to_int64());
        return rval;
    }

    rval.set(to_uint64() * other.to_uint64());
    return rval;
}

std::string
t_tscalar::repr() const {
    std::stringstream ss;
    ss << get_dtype_descr(static_cast<t_dtype>(m_type)) << ":" << get_status_descr(m_status)
       << ":" << to_string();
    return ss.str();
}

bool
t_tscalar::is_valid() const {
    return m_status == STATUS_VALID || m_status == STATUS_WARNING;
}

bool
t_tscalar::is_error() const {
    return m_status == STATUS_ERROR;
}

bool
t_tscalar::is_list() const {
    switch (m_type) {
        case DTYPE_LIST_STR:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64:
        case DTYPE_LIST_BOOL:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_TIME:
        case DTYPE_LIST_DURATION: {
            return true;
        } break;

        default: {
            return false;
        } break;
    }
}

bool
t_tscalar::is_list_empty() const {
    return m_list_size == 0;
}

bool
t_tscalar::is_floating_point() const {
    return (m_type == DTYPE_FLOAT32 || m_type == DTYPE_FLOAT64);
}

bool
t_tscalar::is_signed() const {
    return (m_type == DTYPE_INT64 || m_type == DTYPE_INT32 || m_type == DTYPE_INT16
        || m_type == DTYPE_INT8);
}

bool
t_tscalar::in_any(const t_tscalar& rhs) const {
    bool rv = false;
    switch (m_type) {
        case DTYPE_LIST_STR: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<std::string> list_str = get<std::vector<std::string>>();
                std::vector<std::string> rhs_list_str = rhs.get<std::vector<std::string>>();
                for (t_uindex idx = 0, loop_end = list_str.size(); idx < loop_end; ++idx) {
                    rv = std::find(rhs_list_str.begin(), rhs_list_str.end(), list_str[idx])
                        != rhs_list_str.end();
                    if (rv) {
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_BOOL: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<bool> list_bool = get<std::vector<bool>>();
                std::vector<bool> rhs_list_bool = rhs.get<std::vector<bool>>();
                for (t_uindex idx = 0, loop_end = list_bool.size(); idx < loop_end; ++idx) {
                    rv = std::find(rhs_list_bool.begin(), rhs_list_bool.end(), list_bool[idx])
                        != rhs_list_bool.end();
                    if (rv) {
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_FLOAT64: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<double> list_float = get<std::vector<double>>();
                std::vector<double> rhs_list_float = rhs.get<std::vector<double>>();
                for (t_uindex idx = 0, loop_end = list_float.size(); idx < loop_end; ++idx) {
                    rv = std::find(
                             rhs_list_float.begin(), rhs_list_float.end(), list_float[idx])
                        != rhs_list_float.end();
                    if (rv) {
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_INT64: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<std::int64_t> list_int = get<std::vector<std::int64_t>>();
                std::vector<std::int64_t> rhs_list_int = rhs.get<std::vector<std::int64_t>>();
                for (t_uindex idx = 0, loop_end = list_int.size(); idx < loop_end; ++idx) {
                    rv = std::find(rhs_list_int.begin(), rhs_list_int.end(), list_int[idx])
                        != rhs_list_int.end();
                    if (rv) {
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_DATE: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<t_date> list_date = get<std::vector<t_date>>();
                std::vector<t_date> rhs_list_date = rhs.get<std::vector<t_date>>();
                for (t_uindex idx = 0, loop_end = list_date.size(); idx < loop_end; ++idx) {
                    rv = std::find(rhs_list_date.begin(), rhs_list_date.end(), list_date[idx])
                        != rhs_list_date.end();
                    if (rv) {
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_TIME: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<t_time> list_time = get<std::vector<t_time>>();
                std::vector<t_time> rhs_list_time = rhs.get<std::vector<t_time>>();
                for (t_uindex idx = 0, loop_end = list_time.size(); idx < loop_end; ++idx) {
                    rv = std::find(rhs_list_time.begin(), rhs_list_time.end(), list_time[idx])
                        != rhs_list_time.end();
                    if (rv) {
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_DURATION: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<t_duration> list_duration = get<std::vector<t_duration>>();
                std::vector<t_duration> rhs_list_duration = rhs.get<std::vector<t_duration>>();
                for (t_uindex idx = 0, loop_end = list_duration.size(); idx < loop_end; ++idx) {
                    rv = std::find(rhs_list_duration.begin(), rhs_list_duration.end(),
                             list_duration[idx])
                        != rhs_list_duration.end();
                    if (rv) {
                        break;
                    }
                }
            }
        } break;

        default: { PSP_COMPLAIN_AND_ABORT("Encountered unknown filter operation."); } break;
    }
    return rv;
}

bool
t_tscalar::in_all(const t_tscalar& rhs) const {
    bool rv = true;
    switch (m_type) {
        case DTYPE_LIST_STR: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<std::string> list_str = get<std::vector<std::string>>();
                std::vector<std::string> rhs_list_str = rhs.get<std::vector<std::string>>();
                for (t_uindex idx = 0, loop_end = rhs_list_str.size(); idx < loop_end; ++idx) {
                    if (std::find(list_str.begin(), list_str.end(), rhs_list_str[idx])
                        == list_str.end()) {
                        rv = false;
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_BOOL: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<bool> list_bool = get<std::vector<bool>>();
                std::vector<bool> rhs_list_bool = rhs.get<std::vector<bool>>();
                for (t_uindex idx = 0, loop_end = rhs_list_bool.size(); idx < loop_end; ++idx) {
                    if (std::find(list_bool.begin(), list_bool.end(), rhs_list_bool[idx])
                        == list_bool.end()) {
                        rv = false;
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_FLOAT64: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<double> list_float = get<std::vector<double>>();
                std::vector<double> rhs_list_float = rhs.get<std::vector<double>>();
                for (t_uindex idx = 0, loop_end = rhs_list_float.size(); idx < loop_end;
                     ++idx) {
                    if (std::find(list_float.begin(), list_float.end(), rhs_list_float[idx])
                        == list_float.end()) {
                        rv = false;
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_INT64: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<std::int64_t> list_int = get<std::vector<std::int64_t>>();
                std::vector<std::int64_t> rhs_list_int = rhs.get<std::vector<std::int64_t>>();
                for (t_uindex idx = 0, loop_end = rhs_list_int.size(); idx < loop_end; ++idx) {
                    if (std::find(list_int.begin(), list_int.end(), rhs_list_int[idx])
                        == list_int.end()) {
                        rv = false;
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_DATE: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<t_date> list_date = get<std::vector<t_date>>();
                std::vector<t_date> rhs_list_date = rhs.get<std::vector<t_date>>();
                for (t_uindex idx = 0, loop_end = rhs_list_date.size(); idx < loop_end; ++idx) {
                    if (std::find(list_date.begin(), list_date.end(), rhs_list_date[idx])
                        == list_date.end()) {
                        rv = false;
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_TIME: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<t_time> list_time = get<std::vector<t_time>>();
                std::vector<t_time> rhs_list_time = rhs.get<std::vector<t_time>>();
                for (t_uindex idx = 0, loop_end = rhs_list_time.size(); idx < loop_end; ++idx) {
                    if (std::find(list_time.begin(), list_time.end(), rhs_list_time[idx])
                        == list_time.end()) {
                        rv = false;
                        break;
                    }
                }
            }
        } break;

        case DTYPE_LIST_DURATION: {
            if (rhs.m_list_size == 0) {
                rv = true;
            } else {
                std::vector<t_duration> list_duration = get<std::vector<t_duration>>();
                std::vector<t_duration> rhs_list_duration = rhs.get<std::vector<t_duration>>();
                for (t_uindex idx = 0, loop_end = rhs_list_duration.size(); idx < loop_end;
                     ++idx) {
                    if (std::find(
                            list_duration.begin(), list_duration.end(), rhs_list_duration[idx])
                        == list_duration.end()) {
                        rv = false;
                        break;
                    }
                }
            }
        } break;

        default: { rv = false; } break;
    }
    return rv;
}

t_tscalar::operator bool() const {
    if (m_status != STATUS_VALID)
        return false;

    switch (m_type) {
        case DTYPE_INT64: {
            return bool(get<std::int64_t>());
        } break;
        case DTYPE_INT32: {
            return bool(get<std::int32_t>());
        } break;
        case DTYPE_INT16: {
            return bool(get<std::int16_t>());
        } break;
        case DTYPE_INT8: {
            return bool(get<std::int8_t>());
        } break;
        case DTYPE_UINT64: {
            return bool(get<std::uint64_t>());
        } break;
        case DTYPE_UINT32: {
            return bool(get<std::uint32_t>());
        } break;
        case DTYPE_UINT16: {
            return bool(get<std::uint16_t>());
        } break;
        case DTYPE_UINT8: {
            return bool(get<std::uint8_t>());
        } break;
        case DTYPE_FLOAT64: {
            return bool(get<double>());
        } break;
        case DTYPE_FLOAT32: {
            return bool(get<float>());
        } break;
        case DTYPE_DATE: {
            return bool(get<std::int32_t>());
        } break;
        case DTYPE_TIME: {
            return bool(get<double>());
        } break;
        case DTYPE_DURATION: {
            return bool(get<double>());
        } break;
        case DTYPE_BOOL: {
            return bool(get<bool>());
        } break;
        case DTYPE_NONE: {
            return bool(false);
        } break;
        case DTYPE_STR: {
            return m_data.m_charptr != 0;
        } break;
        case DTYPE_LIST_STR:
        case DTYPE_LIST_BOOL:
        case DTYPE_LIST_FLOAT64:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_TIME:
        case DTYPE_LIST_DURATION: {
            return m_list_size > 0;
        } break;
        case DTYPE_DECIMAL: {
            t_decimal v(m_data.m_decimal);
            return bool(v);
        }
        default: {
#ifdef PSP_DEBUG
            std::cout << __FILE__ << ":" << __LINE__ << " Reached unknown type " << m_type
                      << std::endl;
#endif
        }
    }
    return false;
}

std::string
t_tscalar::to_string(bool for_expr, bool full_value, bool include_error) const {
    if (include_error) {
        if (m_status == STATUS_ERROR) {
            if (m_error_description.empty()) {
                return std::string("ERROR");
            }
            return m_error_description;
        }
        else if (m_status != STATUS_VALID)
            return std::string("null");
    } else {
        if (m_status != STATUS_VALID)
            return std::string("null");
    }

    std::stringstream ss;
    switch (m_type) {
        case DTYPE_NONE: {
            return std::string("");
        } break;
        case DTYPE_INT64: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << get<std::int64_t>();
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(get<std::int64_t>());
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(get<std::int64_t>());
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(get<std::int64_t>());
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(get<std::int64_t>());
            } else if (m_data_format_type == DATA_FORMAT_MONTH) {
                ss << month_(get<std::int64_t>());
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_INT32: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << get<std::int32_t>();
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(get<std::int32_t>());
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(get<std::int32_t>());
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(get<std::int32_t>());
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(get<std::int32_t>());
            } else if (m_data_format_type == DATA_FORMAT_MONTH) {
                ss << month_(get<std::int32_t>());
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_INT16: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << get<std::int16_t>();
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(get<std::int16_t>());
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(get<std::int16_t>());
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(get<std::int16_t>());
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(get<std::int16_t>());
            } else if (m_data_format_type == DATA_FORMAT_MONTH) {
                ss << month_(get<std::int16_t>());
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_UINT64: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << get<std::uint64_t>();
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(get<std::uint64_t>());
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(get<std::uint64_t>());
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(get<std::uint64_t>());
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(get<std::uint64_t>());
            } else if (m_data_format_type == DATA_FORMAT_MONTH) {
                ss << month_(get<std::uint64_t>());
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_UINT32: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << get<std::uint32_t>();
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(get<std::uint32_t>());
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(get<std::uint32_t>());
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(get<std::uint32_t>());
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(get<std::uint32_t>());
            } else if (m_data_format_type == DATA_FORMAT_MONTH) {
                ss << month_(get<std::uint32_t>());
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_UINT16: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << get<std::uint16_t>();
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(get<std::uint16_t>());
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(get<std::uint16_t>());
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(get<std::uint16_t>());
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(get<std::uint16_t>());
            } else if (m_data_format_type == DATA_FORMAT_MONTH) {
                ss << month_(get<std::uint16_t>());
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_FLOAT64: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << get<double>();
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(get<double>());
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(get<double>());
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(get<double>());
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(get<double>());
            } else if (m_data_format_type == DATA_FORMAT_MONTH) {
                ss << month_(get<double>());
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_FLOAT32: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << get<float>();
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(get<float>());
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(get<float>());
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(get<float>());
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(get<float>());
            } else if (m_data_format_type == DATA_FORMAT_MONTH) {
                ss << month_(get<float>());
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_DATE: {
            t_date value = get<t_date>();
            struct tm t;
            bool rcode = value.as_tm(t);
            if (rcode) {
                if (m_data_format_type == DATA_FORMAT_DATE_V1
                    || m_data_format_type == DATA_FORMAT_DATE_V2
                    || m_data_format_type == DATA_FORMAT_DATE_V3
                    || m_data_format_type == DATA_FORMAT_DAY_V1
                    || m_data_format_type == DATA_FORMAT_DAY_V2
                    || m_data_format_type == DATA_FORMAT_DAY_V3) {
                    return value.str(t, m_data_format_type);
                } else {
                    PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
                }
            } else {
                PSP_COMPLAIN_AND_ABORT("Could not return date value.");
            }
        } break;
        case DTYPE_BOOL: {
            if (m_data_format_type == DATA_FORMAT_YES_NO) {
                ss << (get<bool>() ? "yes" : "no");
            } else if (m_data_format_type == DATA_FORMAT_TRUE_FALSE) {
                ss << (get<bool>() ? "true" : "false");
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_INT8: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << std::int32_t(get<std::int8_t>());
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(std::int32_t(get<std::int8_t>()));
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(std::int32_t(get<std::int8_t>()));
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(std::int32_t(get<std::int8_t>()));
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(std::int32_t(get<std::int8_t>()));
            } else if (m_data_format_type == DATA_FORMAT_MONTH) {
                ss << month_(std::int32_t(get<std::int8_t>()));
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_UINT8: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                ss << std::uint32_t(get<std::uint8_t>());
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                ss << financial_(std::uint32_t(get<std::uint8_t>()));
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                ss << percentage_(std::uint32_t(get<std::uint8_t>()));
            } else if (m_data_format_type == DATA_FORMAT_QUARTER) {
                ss << quarter_(std::uint32_t(get<std::uint8_t>()));
            } else if (m_data_format_type == DATA_FORMAT_WEEK) {
                ss << week_(std::uint32_t(get<std::uint8_t>()));
            } else if (m_data_format_type ==  DATA_FORMAT_MONTH) {
                ss << month_(std::uint32_t(get<std::uint8_t>()));
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
            return ss.str();
        } break;
        case DTYPE_TIME: {
            if (m_data_format_type == DATA_FORMAT_DATETIME) {
                t_time value = get<t_time>();
                struct tm t;
                bool rcode = value.as_tm(t);
                if (rcode) {
                    return value.str(t, m_data_format_type);
                } else {
                    PSP_COMPLAIN_AND_ABORT("Could not return datetime value.");
                }
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
        } break;
        case DTYPE_DURATION: {
            if (m_data_format_type == DATA_FORMAT_DURATION
                || m_data_format_type == DATA_FORMAT_TIME) {
                t_duration value = get<t_duration>();
                return value.str(m_data_format_type);
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
        } break;
        case DTYPE_STR: {
            if (for_expr) {
                ss << "'";
            }

            if (!m_data.m_charptr) {
                if (for_expr) {
                    ss << "'";
                }

                return ss.str();
            }

            ss << get_char_ptr();
            if (for_expr) {
                ss << "'";
            }
            if (full_value) {
                return ss.str();
            } else {
                auto str = ss.str();
                if (str.size() > PSP_MAXIMUM_TRUNCATE_STR) {
                    return str.substr(0, PSP_MAXIMUM_TRUNCATE_STR) + "...";
                } else {
                    return str;
                }
            }
        } break;
        case DTYPE_DECIMAL: {
            return m_data.m_decimal;
        } break;

        case DTYPE_LIST_STR:
        case DTYPE_LIST_BOOL:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_TIME:
        case DTYPE_LIST_DURATION: {
            auto list_str = to_list_string();
            std::stringstream ss;
            ss << "[";
            for (t_index idx = 0, strsize = list_str.size(); idx < strsize; ++idx) {
                ss << list_str[idx];
                if (idx < strsize - 1) {
                    ss << ", ";
                }
            }
            ss << "]";
            return ss.str();
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Unrecognized dtype"); }
    }
    return std::string("null");
}

std::string
t_tscalar::to_search_string() const {
    if (m_status != STATUS_VALID)
        return std::string("null");

    std::stringstream ss;
    switch (m_type) {
        case DTYPE_LIST_STR: {
            std::vector<std::string> list_val = get<std::vector<std::string>>();
            for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                if (idx == 0) {
                    ss << list_val[idx];
                } else {
                    ss << " " << list_val[idx];
                }
            }
            return ss.str();
        } break;

        case DTYPE_LIST_BOOL: {
            std::vector<bool> list_val = get<std::vector<bool>>();
            for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                if (idx == 0) {
                    ss << (list_val[idx] ? "true" : "false");
                } else {
                    ss << " " << (list_val[idx] ? "true" : "false");
                }
            }
            return ss.str();
        } break;

        case DTYPE_LIST_INT64: {
            std::vector<std::int64_t> list_val = get<std::vector<std::int64_t>>();
            for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                if (idx == 0) {
                    ss << list_val[idx];
                } else {
                    ss << " " << list_val[idx];
                }
            }
            return ss.str();
        } break;

        case DTYPE_LIST_FLOAT64: {
            std::vector<double> list_val = get<std::vector<double>>();
            for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                if (idx == 0) {
                    ss << list_val[idx];
                } else {
                    ss << " " << list_val[idx];
                }
            }
            return ss.str();
        } break;

        case DTYPE_LIST_DATE: {
            std::vector<t_date> list_val = get<std::vector<t_date>>();
            for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                struct tm t;
                bool rcode = list_val[idx].as_tm(t);
                if (rcode) {
                    if (idx == 0) {
                        ss << list_val[idx].str(t, m_data_format_type);
                    } else {
                        ss << " " << list_val[idx].str(t, m_data_format_type);
                    }
                }
            }
            return ss.str();
        } break;

        case DTYPE_LIST_TIME: {
            std::vector<t_time> list_val = get<std::vector<t_time>>();
            for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                struct tm t;
                bool rcode = list_val[idx].as_tm(t);
                if (rcode) {
                    if (idx == 0) {
                        ss << list_val[idx].str(t, m_data_format_type);
                    } else {
                        ss << " " << list_val[idx].str(t, m_data_format_type);
                    }
                }
            }
            return ss.str();
        } break;

        case DTYPE_LIST_DURATION: {
            std::vector<t_duration> list_val = get<std::vector<t_duration>>();
            for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                if (idx == 0) {
                    ss << list_val[idx].str(m_data_format_type);
                } else {
                    ss << " " << list_val[idx].str(m_data_format_type);
                }
            }
            return ss.str();
        } break;

        default:
            break;
    }

    return to_string();
}

double
t_tscalar::to_agg_level_number(t_agg_level_type agg_level) const {
    if (m_status != STATUS_VALID) {
        PSP_COMPLAIN_AND_ABORT("Unrecognized aggregate level");
        return INVALID_INDEX;
    }

    switch (m_type)
    {
    case DTYPE_DATE: {
        t_date value = get<t_date>();
        struct tm t;
        bool rcode = value.as_tm(t);
        if (rcode) {
            return value.agg_level_num(t, agg_level);
        } else {
            PSP_COMPLAIN_AND_ABORT("Could not return date value.");
        }
    } break;

    case DTYPE_TIME: {
        t_time value = get<t_time>();
        struct tm t;
        bool rcode = value.as_tm(t);
        if (rcode) {
            return value.agg_level_num(t, agg_level);
        } else {
            PSP_COMPLAIN_AND_ABORT("Could not return datetime value.");
        }
    } break;

    case DTYPE_DURATION: {
        t_duration value = get<t_duration>();
        return value.agg_level_num(agg_level);
    } break;

    default: {
        PSP_COMPLAIN_AND_ABORT("Unrecognized aggregate level");
    } break;
    }

    return to_double();
}

std::string
t_tscalar::to_agg_level_string(t_agg_level_type agg_level) const {
    if (m_status != STATUS_VALID)
        return std::string("null");
    
    switch (m_type)
    {
    case DTYPE_DATE: {
        t_date value = get<t_date>();
        struct tm t;
        bool rcode = value.as_tm(t);
        if (rcode) {
            return value.agg_level_str(t, agg_level);
        } else {
            PSP_COMPLAIN_AND_ABORT("Could not return date value.");
        }
    } break;

    case DTYPE_TIME: {
        t_time value = get<t_time>();
        struct tm t;
        bool rcode = value.as_tm(t);
        if (rcode) {
            return value.agg_level_str(t, agg_level);
        } else {
            PSP_COMPLAIN_AND_ABORT("Could not return datetime value.");
        }
    } break;

    case DTYPE_DURATION: {
        t_duration value = get<t_duration>();
        return value.agg_level_str(m_data_format_type, agg_level);
    } break;

    default: {
        PSP_COMPLAIN_AND_ABORT("Unrecognized aggregate level");
    } break;
    }

    return to_string();
}

std::string
t_tscalar::to_binning_string(t_binning_info binning, t_dataformattype df_type) const {

    // Return default string for case binning type is none
    if (binning.type == BINNING_TYPE_NONE) {
        return to_string();
    }

    std::stringstream ss;
    switch (m_type)
    {
    case DTYPE_FLOAT32:
    case DTYPE_FLOAT64: {
        // Check value valid or not
        if (m_status != STATUS_VALID) {
            return BINNING_OTHER_TEXT;
        }
        auto value = to_double();
        // Check value outsize of boundary
        if (value < binning.min || value > binning.max) {
            return BINNING_OTHER_TEXT;
        }
        double pos = std::floor((value - binning.min)/binning.size);
        double begin = pos * binning.size + binning.min;
        double end = (pos + 1) * binning.size + binning.min;
        if (binning.type == BINNING_TYPE_CUSTOM) {
            begin = (begin < binning.min) ? binning.min : begin;
            end = (end > binning.max) ? binning.max : end;
            if (binning.max != end || (end - begin == binning.size)) {
                if (binning.is_double || df_type == DATA_FORMAT_FINANCIAL) {
                    end = end - 0.01;
                } else {
                    end = end - 1;
                }
            }
        }
        auto begin_sca = mktscalar(begin);
        begin_sca.m_data_format_type = df_type;
        auto end_sca = mktscalar(end);
        end_sca.m_data_format_type = df_type;

        ss << begin_sca.to_string() << " - " << end_sca.to_string();

        return ss.str();
    } break;

    case DTYPE_INT64:
    case DTYPE_INT32:
    case DTYPE_INT16:
    case DTYPE_INT8:
    case DTYPE_UINT64:
    case DTYPE_UINT32:
    case DTYPE_UINT16:
    case DTYPE_UINT8: {
        // Check value valid or not
        if (m_status != STATUS_VALID) {
            return BINNING_OTHER_TEXT;
        }
        auto value = to_int64();
        // Check value outsize of boundary
        if (value < binning.min || value > binning.max) {
            return BINNING_OTHER_TEXT;
        }
        std::int64_t pos = std::floor((value - binning.min)/binning.size);
        double begin = pos * binning.size + binning.min;
        double end = (pos + 1) * binning.size + binning.min;
        if (binning.type == BINNING_TYPE_CUSTOM) {
            begin = (begin < binning.min) ? binning.min : begin;
            end = (end > binning.max) ? binning.max : end;
            if (binning.max != end || (end - begin == binning.size)) {
                if (binning.is_double || df_type == DATA_FORMAT_FINANCIAL) {
                    end = end - 0.01;
                } else {
                    end = end - 1;
                }
            }
        }

        auto begin_sca = mktscalar(begin);
        begin_sca.m_data_format_type = df_type;
        auto end_sca = mktscalar(end);
        end_sca.m_data_format_type = df_type;

        ss << begin_sca.to_string() << " - " << end_sca.to_string();

        return ss.str();
    } break;

    case DTYPE_NONE: {
        return BINNING_OTHER_TEXT;
    } break;

    default: {
        PSP_COMPLAIN_AND_ABORT("Unrecognized binning type");
    } break;
    }

    return to_string();
}

t_tscalar
t_tscalar::to_binning_middle_value(t_binning_info binning) const {
    // Return default string for case binning type is none
    if (binning.type == BINNING_TYPE_NONE) {
        return mknull(DTYPE_FLOAT64);
    }

    std::stringstream ss;
    switch (m_type)
    {
    case DTYPE_FLOAT32:
    case DTYPE_FLOAT64: {
        // Check value valid or not
        if (m_status != STATUS_VALID) {
            return mknull(DTYPE_FLOAT64);
        }
        auto value = to_double();
        // Check value outsize of boundary
        if (value < binning.min || value > binning.max) {
            return mknull(DTYPE_FLOAT64);
        }
        double pos = std::floor((value - binning.min)/binning.size);
        double begin = pos * binning.size + binning.min;
        double end = (pos + 1) * binning.size + binning.min;
        if (binning.type == BINNING_TYPE_CUSTOM) {
            begin = (begin < binning.min) ? binning.min : begin;
            end = (end > binning.max) ? binning.max : end;
        }
        return (begin + end)/2;
    } break;

    case DTYPE_INT64:
    case DTYPE_INT32:
    case DTYPE_INT16:
    case DTYPE_INT8:
    case DTYPE_UINT64:
    case DTYPE_UINT32:
    case DTYPE_UINT16:
    case DTYPE_UINT8: {
        // Check value valid or not
        if (m_status != STATUS_VALID) {
            return mknull(DTYPE_FLOAT64);
        }
        auto value = to_int64();
        // Check value outsize of boundary
        if (value < binning.min || value > binning.max) {
            return mknull(DTYPE_FLOAT64);
        }
        std::int64_t pos = std::floor((value - binning.min)/binning.size);
        std::int64_t begin = pos * binning.size + binning.min;
        std::int64_t end = (pos + 1) * binning.size + binning.min;
        if (binning.type == BINNING_TYPE_CUSTOM) {
            begin = (begin < binning.min) ? binning.min : begin;
            end = (end > binning.max) ? binning.max : end;
        }

        return (((double)begin + (double)end)) / 2;
    } break;

    case DTYPE_NONE: {
        return mknull(DTYPE_FLOAT64);
    } break;

    default: {
        PSP_COMPLAIN_AND_ABORT("Unrecognized binning type");
    } break;
    }

    return mknull(DTYPE_FLOAT64);
}

std::string
t_tscalar::formatted_with_binning(t_binning_info binning) const {
    if (m_status != STATUS_VALID) {
        return BINNING_OTHER_TEXT;
    }
    if (binning.type == BINNING_TYPE_NONE) {
        return BINNING_OTHER_TEXT;
    }
    std::stringstream ss;
    switch (m_type)
    {
    case DTYPE_FLOAT64: {
        auto haft_size = binning.size / 2;
        auto value = to_double();
        double begin = binning.min;
        double end = binning.max;
        if (value - haft_size > begin) {
            begin = value - haft_size;
        } else {
            end = value + (value - begin);
        }
        if (value + haft_size < end) {
            end = value + haft_size;
        } else {
            begin = value - (end - value);
        }
        auto begin_sca = mktscalar(begin);
        begin_sca.m_data_format_type = m_data_format_type;
        if (binning.max != end || (end - begin == binning.size)) {
            if (binning.is_double || m_data_format_type == DATA_FORMAT_FINANCIAL) {
                end = end - 0.01;
            } else {
                end = end - 1;
            }
        }
        auto end_sca = mktscalar(end);
        end_sca.m_data_format_type = m_data_format_type;

        //ss << begin_sca.to_string() << " - " << end_sca.to_string();
        double intpart;
        if (m_data_format_type == DATA_FORMAT_NUMBER) {
            ss << std::setprecision(2) << std::fixed;
            if( modf(begin, &intpart) == 0) {
                ss << begin_sca.to_string();
            } else {
                ss << begin;
            }
            ss << " - ";
            if( modf(end, &intpart) == 0) {
                ss << end_sca.to_string();
            } else {
                ss << end;
            }
        } else {
            ss << begin_sca.to_string() << " - " << end_sca.to_string();
        }

        return ss.str();
    } break;

    default: {
        return BINNING_OTHER_TEXT;
    } break;
    }
}

std::string
t_tscalar::format_binning_string(t_dataformattype previous_df) const {
    std::string str_val = to_string();
    if (str_val == BINNING_OTHER_TEXT) {
        return BINNING_OTHER_TEXT;
    }
    auto found = str_val.find(" - ");
    if (found != std::string::npos) {
        std::string first_str = str_val.substr(0, found);
        std::string second_str = str_val.substr(found + 3, str_val.size());
        if (previous_df == DATA_FORMAT_FINANCIAL) {
            first_str = first_str.substr(2, first_str.size());
            replace_str(first_str, ",", "");
            second_str = second_str.substr(2, second_str.size());
            replace_str(second_str, ",", "");
        } else if (previous_df == DATA_FORMAT_PERCENT) {
            first_str = first_str.substr(0, first_str.size() - 1);
            replace_str(first_str, ",", "");
            second_str = second_str.substr(0, second_str.size() - 1);
            replace_str(second_str, ",", "");
        }
        std::stringstream ss;
        auto first_num = atof(first_str.c_str());
        auto second_num = atof(second_str.c_str());
        auto begin_sca = mktscalar(first_num);
        begin_sca.m_data_format_type = m_data_format_type;
        auto end_sca = mktscalar(second_num);
        end_sca.m_data_format_type = m_data_format_type;
        ss << begin_sca.to_string() << " - " << end_sca.to_string();
        return ss.str();
    } else {
        return str_val;
    }
}

std::vector<std::string>
t_tscalar::to_list_string() const {
    std::vector<std::string> list_str;
    switch (m_type) {
        case DTYPE_LIST_STR: {
            list_str = get<std::vector<std::string>>();
        } break;

        case DTYPE_LIST_BOOL: {
            std::vector<bool> list_val = get<std::vector<bool>>();
            for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                if (m_data_format_type == DATA_FORMAT_YES_NO) {
                    list_str.push_back((list_val[idx] ? "yes" : "no"));
                } else if (m_data_format_type == DATA_FORMAT_TRUE_FALSE) {
                    list_str.push_back((list_val[idx] ? "true" : "false"));
                } else {
                    PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
                }
            }
        } break;

        case DTYPE_LIST_INT64: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                std::vector<std::int64_t> list_val = get<std::vector<std::int64_t>>();
                for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                    std::stringstream ss;
                    ss << list_val[idx];
                    list_str.push_back(ss.str());
                }
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                std::vector<std::int64_t> list_val = get<std::vector<std::int64_t>>();
                for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                    list_str.push_back(financial_(list_val[idx]));
                }
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                std::vector<std::int64_t> list_val = get<std::vector<std::int64_t>>();
                for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                    list_str.push_back(percentage_(list_val[idx]));
                }
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
        } break;

        case DTYPE_LIST_FLOAT64: {
            if (m_data_format_type == DATA_FORMAT_NUMBER) {
                std::vector<double> list_val = get<std::vector<double>>();
                for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                    std::stringstream ss;
                    ss << list_val[idx];
                    list_str.push_back(ss.str());
                }
            } else if (m_data_format_type == DATA_FORMAT_FINANCIAL) {
                std::vector<double> list_val = get<std::vector<double>>();
                for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                    list_str.push_back(financial_(list_val[idx]));
                }
            } else if (m_data_format_type == DATA_FORMAT_PERCENT) {
                std::vector<double> list_val = get<std::vector<double>>();
                for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                    list_str.push_back(percentage_(list_val[idx]));
                }
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
        } break;

        case DTYPE_LIST_DATE: {
            if (m_data_format_type == DATA_FORMAT_DATE_V1
                || m_data_format_type == DATA_FORMAT_DATE_V2
                || m_data_format_type == DATA_FORMAT_DATE_V3
                || m_data_format_type == DATA_FORMAT_DAY_V1
                || m_data_format_type == DATA_FORMAT_DAY_V2
                || m_data_format_type == DATA_FORMAT_DAY_V3) {
                std::vector<t_date> list_val = get<std::vector<t_date>>();
                for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                    struct tm t;
                    bool rcode = list_val[idx].as_tm(t);
                    if (rcode) {
                        list_str.push_back(list_val[idx].str(t, m_data_format_type));
                    }
                }
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
        } break;

        case DTYPE_LIST_TIME: {
            if (m_data_format_type == DATA_FORMAT_DATETIME) {
                std::vector<t_time> list_val = get<std::vector<t_time>>();
                for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                    struct tm t;
                    bool rcode = list_val[idx].as_tm(t);
                    if (rcode) {
                        list_str.push_back(list_val[idx].str(t, m_data_format_type));
                    }
                }
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
        } break;

        case DTYPE_LIST_DURATION: {
            if (m_data_format_type == DATA_FORMAT_DURATION
                || m_data_format_type == DATA_FORMAT_TIME) {
                std::vector<t_duration> list_val = get<std::vector<t_duration>>();
                for (t_uindex idx = 0, loop_end = list_val.size(); idx < loop_end; ++idx) {
                    list_str.push_back(list_val[idx].str(m_data_format_type));
                }
            } else {
                PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
            }
        } break;

        default:
            break;
    }

    return list_str;
}

double
t_tscalar::to_double() const {
    switch (m_type) {
        case DTYPE_INT64: {
            return get<std::int64_t>();
        } break;
        case DTYPE_INT32: {
            return get<std::int32_t>();
        } break;
        case DTYPE_INT16: {
            return get<std::int16_t>();
        } break;
        case DTYPE_INT8: {
            return get<std::int8_t>();
        } break;
        case DTYPE_UINT64: {
            return get<std::uint64_t>();
        } break;
        case DTYPE_UINT32: {
            return get<std::uint32_t>();
        } break;
        case DTYPE_UINT16: {
            return get<std::uint16_t>();
        } break;
        case DTYPE_UINT8: {
            return get<std::uint8_t>();
        } break;
        case DTYPE_FLOAT64: {
            return get<double>();
        } break;
        case DTYPE_FLOAT32: {
            return get<float>();
        } break;
        case DTYPE_DATE: {
            return get<std::int32_t>();
        } break;
        case DTYPE_TIME: {
            return get<double>();
        } break;
        case DTYPE_DURATION: {
            return get<double>();
        } break;
        case DTYPE_BOOL: {
            return get<bool>();
        } break;
        case DTYPE_DECIMAL: {
            t_decimal v = get<t_decimal>();
            return v.decNumberToDouble();
        } break;
        case DTYPE_NONE:
        default: { return 0; }
    }

    return 0;
}

t_tscalar
t_tscalar::coerce_numeric_dtype(t_dtype dtype) const {
    switch (dtype) {
        case DTYPE_INT64: {
            return coerce_numeric<std::int64_t>();
        } break;
        case DTYPE_INT32: {
            return coerce_numeric<std::int32_t>();
        } break;
        case DTYPE_INT16: {
            return coerce_numeric<std::int16_t>();
        } break;
        case DTYPE_INT8: {
            return coerce_numeric<std::int8_t>();
        } break;
        case DTYPE_UINT64: {
            return coerce_numeric<std::uint64_t>();
        } break;
        case DTYPE_UINT32: {
            return coerce_numeric<std::uint32_t>();
        } break;
        case DTYPE_UINT16: {
            return coerce_numeric<std::uint16_t>();
        } break;
        case DTYPE_UINT8: {
            return coerce_numeric<std::uint8_t>();
        } break;
        case DTYPE_FLOAT64: {
            return coerce_numeric<double>();
        } break;
        case DTYPE_FLOAT32: {
            return coerce_numeric<float>();
        } break;
        case DTYPE_BOOL: {
            return coerce_numeric<bool>();
        } break;
        default: { return *this; }
    }

    return mknone();
}

std::int64_t
t_tscalar::to_int64() const {
    switch (m_type) {
        case DTYPE_INT64: {
            return get<std::int64_t>();
        } break;
        case DTYPE_INT32: {
            return get<std::int32_t>();
        } break;
        case DTYPE_INT16: {
            return get<std::int16_t>();
        } break;
        case DTYPE_INT8: {
            return get<std::int8_t>();
        } break;
        case DTYPE_UINT64: {
            return get<std::uint64_t>();
        } break;
        case DTYPE_UINT32: {
            return get<std::uint32_t>();
        } break;
        case DTYPE_UINT16: {
            return get<std::uint16_t>();
        } break;
        case DTYPE_UINT8: {
            return get<std::uint8_t>();
        } break;
        case DTYPE_FLOAT64: {
            return get<double>();
        } break;
        case DTYPE_FLOAT32: {
            return get<float>();
        } break;
        case DTYPE_DATE: {
            return get<std::int32_t>();
        } break;
        /*case DTYPE_TIME: {
            return get<std::int64_t>();
        } break; */
        case DTYPE_BOOL: {
            return get<bool>();
        } break;
        case DTYPE_NONE:
        default: { return 0; }
    }

    return 0;
}

std::uint64_t
t_tscalar::to_uint64() const {
    switch (m_type) {
        case DTYPE_INT64: {
            return get<std::int64_t>();
        } break;
        case DTYPE_INT32: {
            return get<std::int32_t>();
        } break;
        case DTYPE_INT16: {
            return get<std::int16_t>();
        } break;
        case DTYPE_INT8: {
            return get<std::int8_t>();
        } break;
        case DTYPE_UINT64: {
            return get<std::uint64_t>();
        } break;
        case DTYPE_UINT32: {
            return get<std::uint32_t>();
        } break;
        case DTYPE_UINT16: {
            return get<std::uint16_t>();
        } break;
        case DTYPE_UINT8: {
            return get<std::uint8_t>();
        } break;
        case DTYPE_FLOAT64: {
            return get<double>();
        } break;
        case DTYPE_FLOAT32: {
            return get<float>();
        } break;
        case DTYPE_DATE: {
            return get<std::int32_t>();
        } break;
        /*case DTYPE_TIME: {
            return get<std::int64_t>();
        } break; */
        case DTYPE_BOOL: {
            return get<bool>();
        } break;
        case DTYPE_NONE:
        default: { return 0; }
    }

    return 0;
}

template <>
std::vector<std::string>
t_tscalar::to_list() const {
    return get<std::vector<std::string>>();
}

template <>
std::vector<bool>
t_tscalar::to_list() const {
    return get<std::vector<bool>>();
}

template <>
std::vector<double>
t_tscalar::to_list() const {
    return get<std::vector<double>>();
}

template <>
std::vector<std::int64_t>
t_tscalar::to_list() const {
    return get<std::vector<std::int64_t>>();
}

template <>
std::vector<t_date>
t_tscalar::to_list() const {
    return get<std::vector<t_date>>();
}

template <>
std::vector<t_time>
t_tscalar::to_list() const {
    return get<std::vector<t_time>>();
}

template <>
std::vector<t_duration>
t_tscalar::to_list() const {
    return get<std::vector<t_duration>>();
}

template<>
std::vector<t_tscalar>
t_tscalar::to_list() const {
    std::vector<t_tscalar> values;

    if (!is_valid()) {
        return values;
    }

    switch(m_type) {
        case DTYPE_LIST_STR: {
            std::vector<std::string> list = to_list<std::vector<std::string>>();
            for (std::string& it: list) {
                values.push_back(mktscalar(it.c_str()));
            }
        } break;
        case DTYPE_LIST_BOOL: {
            std::vector<bool> list = to_list<std::vector<bool>>();
            for (bool it: list) {
                values.push_back(mktscalar(it));
            }
        } break;
        case DTYPE_LIST_INT64: {
            std::vector<std::int64_t> list = to_list<std::vector<std::int64_t>>();
            for (std::int64_t& it: list) {
                values.push_back(mktscalar(it));
            }
        } break;
        case DTYPE_LIST_FLOAT64: {
            std::vector<double> list = to_list<std::vector<double>>();
            for (double& it: list) {
                values.push_back(mktscalar(it));
            }
        } break;
        case DTYPE_LIST_DATE: {
            std::vector<t_date> list = to_list<std::vector<t_date>>();
            for (t_date& it: list) {
                values.push_back(mktscalar(it));
            }
        } break;
        case DTYPE_LIST_TIME: {
            std::vector<t_time> list = to_list<std::vector<t_time>>();
            for (t_time& it: list) {
                values.push_back(mktscalar(it));
            }
        } break;
        case DTYPE_LIST_DURATION: {
            std::vector<t_duration> list = to_list<std::vector<t_duration>>();
            for (t_duration& it: list) {
                values.push_back(mktscalar(it));
            }
        } break;
        default: {
            PSP_COMPLAIN_AND_ABORT("Can't convert to list");
        } break;
    }

    return values;
}

bool
t_tscalar::begins_with(const t_tscalar& other) const {
    if (m_status != STATUS_VALID || m_type != DTYPE_STR || other.m_type != DTYPE_STR)
        return false;
    std::string sstr = to_string();
    std::string ostr = other.to_string();
    std::string_to_lower(sstr);
    std::string_to_lower(ostr);
    return sstr.find(ostr) == 0;
}

bool
t_tscalar::string_begins_with(const t_tscalar& other, const std::string& str) const {
    if (m_status != STATUS_VALID)
        return false;
    std::string sstr = str;
    std::string ostr = other.to_string();
    std::string_to_lower(sstr);
    std::string_to_lower(ostr);
    return sstr.find(ostr) == 0;
}

bool
t_tscalar::ends_with(const t_tscalar& other) const {
    if (m_status != STATUS_VALID || m_type != DTYPE_STR || other.m_type != DTYPE_STR)
        return false;
    std::string sstr = to_string();
    std::string ostr = other.to_string();
    std::string_to_lower(sstr);
    std::string_to_lower(ostr);
    size_t idx = sstr.rfind(ostr);
    return (idx != std::string::npos) && (idx + ostr.size() == sstr.size());
}

bool
t_tscalar::contains(const t_tscalar& other) const {
    if (m_status != STATUS_VALID)
        return false;
    std::string sstr = to_string();
    std::string ostr = other.to_string();
    std::string_to_lower(sstr);
    std::string_to_lower(ostr);
    size_t idx = sstr.find(ostr);
    return idx != std::string::npos;
}

bool
t_tscalar::string_contains(const t_tscalar& other, const std::string& str) const {
    if (m_status != STATUS_VALID)
        return false;
    std::string sstr = str;
    std::string ostr = other.to_string();
    std::string_to_lower(sstr);
    std::string_to_lower(ostr);
    size_t idx = sstr.find(ostr);
    return idx != std::string::npos;
}

bool
t_tscalar::not_contain(const t_tscalar& other) const {
    return !contains(other);
}

bool
t_tscalar::edge(const t_tscalar& other) const {
    if (m_status != STATUS_VALID || m_type != DTYPE_STR || other.m_type != DTYPE_STR)
        return false;

    std::string sstr = to_string();
    std::string ostr = other.to_string();
    std::string_to_lower(sstr);
    std::string_to_lower(ostr);
    size_t idx = sstr.find(ostr);
    if (idx == std::string::npos) {
        return false;
    }
    if (idx == 0) {
        return true;
    } else {
        std::stringstream ss;
        ss << " " << ostr;
        size_t eidx = sstr.find(ss.str());
        if (eidx != std::string::npos) {
            return true;
        }
    }
    return false;
}

bool
t_tscalar::string_edge(const t_tscalar& other, const std::string& str) const {
    if (m_status != STATUS_VALID)
        return false;
    std::string sstr = str;
    std::string ostr = other.to_string();
    std::string_to_lower(sstr);
    std::string_to_lower(ostr);
    size_t idx = sstr.find(ostr);
    if (idx == std::string::npos) {
        return false;
    }
    if (idx == 0) {
        return true;
    } else {
        std::stringstream ss;
        ss << " " << ostr;
        size_t eidx = sstr.find(ss.str());
        if (eidx != std::string::npos) {
            return true;
        }
    }
    return false;
}

bool
t_tscalar::pp_search_contains(const std::string& other, double* d, t_date* date) const {
    if (m_status != STATUS_VALID) {
        return false;
    }
    switch (m_type) {
        case DTYPE_STR: {
            if (date) {
                auto p = this->get_char_ptr();
                t_date this_date;
                int n = strlen(p);
                for (int i = 0; i < n; ++i) {
                    bool success = t_date::from_string(p + i, this_date);
                    if (success && this_date == *date)
                        return true;
                }
                return false;
            }
            return utils::contains(this->get_char_ptr(), other.data());
        } break;
        case DTYPE_DATE: {
            if (date) {
                return *date == this->get<t_date>();
            } else {
                auto date = this->get<t_date>();
                tm tm_;
                date.as_tm(tm_);

                char buf[48] = {0};
                sprintf(buf, "%d", date.year(tm_));
                if (utils::contains(buf, other.data())) {
                    return true;
                }
                int month = date.month(tm_);
                sprintf(buf, "%d", month);
                if (utils::contains(buf, other.data())) {
                    return true;
                }
                if (utils::contains(month_names[month], other.data())) {
                    return true;
                }
                sprintf(buf, "%d", date.day(tm_));
                if (utils::contains(buf, other.data())) {
                    return true;
                }
                return false;
            }
        } break;
        case DTYPE_BOOL:
        case DTYPE_INT64:
        case DTYPE_FLOAT64:
        case DTYPE_DURATION:
        case DTYPE_TIME:
        case DTYPE_LIST_BOOL:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64:
        case DTYPE_LIST_STR:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_TIME:
        case DTYPE_LIST_DURATION: {
            auto s = this->to_search_string();
            return utils::contains(s.data(), other.data());
        } break;

        default: { return false; } break;
    }
}

bool
t_tscalar::pp_search_edge(const std::string& other, double* d, t_date* date) const {
    if (m_status != STATUS_VALID) {
        return false;
    }

    switch (m_type) {
        case DTYPE_STR: {
            auto p = this->get_char_ptr();
            if (date) {
                t_date this_date;
                int n = strlen(p);
                for (int i = 0; i < n; ++i) {
                    if (i == 0 || isspace(p[i - 1])) {
                        bool success = t_date::from_string(p + i, this_date);
                        if (success && this_date == *date)
                            return true;
                    }
                }
                return false;
            }
            return p && utils::edge(p, other);
        } break;
        case DTYPE_DATE: {
            if (date) {
                return *date == this->get<t_date>();
            } else {

				auto date = this->get<t_date>();
                tm tm_;
                date.as_tm(tm_);

                char buf[48] = {0};
                sprintf(buf, "%d", date.year(tm_));
                if (utils::edge(buf, other)) {
                    return true;
                }
                int month = date.month(tm_);
                sprintf(buf, "%d", month);
                if (utils::edge(buf, other)) {
                    return true;
                }
                if (utils::edge(month_names[month], other)) {
                    return true;
                }
                sprintf(buf, "%d", date.day(tm_));
                if (utils::edge(buf, other)) {
                    return true;
                }
                return false;
            }
        } break;

        case DTYPE_BOOL:
        case DTYPE_INT64:
        case DTYPE_FLOAT64:
        case DTYPE_TIME:
        case DTYPE_LIST_BOOL:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64:
        case DTYPE_LIST_STR:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_TIME:
        case DTYPE_DURATION:
        case DTYPE_LIST_DURATION: {
            auto s = this->to_search_string();
            bool res = utils::edge(s.data(), other);
            return res;
        } break;

        default:
            return false;
    }
}

bool
t_tscalar::pp_search_begins_with(const std::string& other, double* d, t_date* date) const {
    if (m_status != STATUS_VALID) {
        return false;
    }

    switch (m_type) {
        case DTYPE_STR: {
            return utils::begins_with(this->get_char_ptr(), other.data());
        } break;

        case DTYPE_DATE: {
            if (date) {
                return *date == this->get<t_date>();
            } else {
                auto s = this->to_search_string();
                return utils::begins_with(s.data(), other.data());
            }
        } break;
        case DTYPE_BOOL:
        case DTYPE_INT64:
        case DTYPE_FLOAT64:
        case DTYPE_DURATION:
        case DTYPE_TIME: {
            auto s = this->to_search_string();
            return utils::begins_with(s.data(), other.data());
        } break;
        case DTYPE_LIST_BOOL:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64:
        case DTYPE_LIST_STR:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_TIME:
        case DTYPE_LIST_DURATION: {
            std::vector<std::string> list_temp = to_list_string();
            for (size_t idx = 0, loop_end = list_temp.size(); idx < loop_end; ++idx) {
                bool is_begin_with = utils::begins_with(list_temp[idx].data(), other.data());
                if (is_begin_with) {
                    return true;
                }
            }
            return false;
        } break;

        default:
            return false;
    }
}

bool
t_tscalar::pp_search_equals(const std::string& other, double* d, t_date* date) const {
    if (m_status != STATUS_VALID) {
        return false;
    }
    switch (m_type) {
        case DTYPE_BOOL:
        case DTYPE_TIME:
        case DTYPE_DURATION: {
            auto s = this->to_search_string();
            if (utils::is_number(other.data()) != utils::is_number(s.data())) {
                return false;
            }
            return !utils::strcicmp(s.data(), other.data());
        } break;
        case DTYPE_DATE: {
            if (!date)
                return false;
            return this->get<t_date>() == *date;
        } break;
        case DTYPE_STR: {
            auto p = this->get_char_ptr();
            if (date) {
                t_date this_date;
                bool success = t_date::from_string(p, this_date);
                return success && this_date == *date;
            }
            return p && !utils::strcicmp(p, other.data());
        } break;
        case DTYPE_INT64:
        case DTYPE_FLOAT64: {
            if (!d)
                return false;
            double this_number = this->to_double();
            return std::abs(*d - this_number) < 0.0001;
        } break;

        case DTYPE_LIST_BOOL:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_TIME:
        case DTYPE_LIST_DURATION:
        case DTYPE_LIST_STR: {
            std::vector<std::string> list_str = to_list_string();
            bool rv = false;
            for (t_uindex idx = 0, loop_end = list_str.size(); idx < loop_end; ++idx) {
                std::string lower_str = boost::to_lower_copy<std::string>(list_str[idx]);
                t_tscalar temp = mktscalar(lower_str.c_str());
                rv = temp.to_string() == other;
                if (rv) {
                    return rv;
                }
            }
            return false;
        } break;

        default:
            return false;
    }
}

std::string
repr(const t_tscalar& s) {
    return s.to_string();
}

size_t
hash_value(const t_tscalar& s) {
    std::size_t seed = 0;
    if (s.m_type == DTYPE_STR) {
        const char* c = s.get_char_ptr();
        boost::hash_combine(seed, boost::hash_range(c, c + std::strlen(c)));

    } else {
        boost::hash_combine(seed, s.m_data.m_uint64);
    }

    boost::hash_combine(seed, s.m_type);
    boost::hash_combine(seed, s.m_status);
    return seed;
}

t_tscalar
mktscalar() {
    t_tscalar rval;
    rval.set(t_none());
    return rval;
}

template <>
std::int64_t
t_tscalar::get() const {
    return m_data.m_int64;
}

template <>
std::int32_t
t_tscalar::get() const {
    return m_data.m_int32;
}

template <>
std::int16_t
t_tscalar::get() const {
    return m_data.m_int16;
}

template <>
std::int8_t
t_tscalar::get() const {
    return m_data.m_int8;
}

template <>
std::uint64_t
t_tscalar::get() const {
    return m_data.m_uint64;
}

template <>
std::uint32_t
t_tscalar::get() const {
    return m_data.m_uint32;
}

template <>
std::uint16_t
t_tscalar::get() const {
    return m_data.m_uint16;
}

template <>
std::uint8_t
t_tscalar::get() const {
    return m_data.m_uint8;
}

template <>
double
t_tscalar::get() const {
    return m_data.m_float64;
}

template <>
float
t_tscalar::get() const {
    return m_data.m_float32;
}

template <>
bool
t_tscalar::get() const {
    return m_data.m_bool;
}

template <>
const char*
t_tscalar::get() const {
    return get_char_ptr();
}

template <>
t_date
t_tscalar::get() const {
    return t_date(m_data.m_int32);
}

template <>
t_time
t_tscalar::get() const {
    return t_time(m_data.m_float64);
}

template <>
t_duration
t_tscalar::get() const {
    return t_duration(m_data.m_float64);
}

template <>
t_none
t_tscalar::get() const {
    return t_none();
}

template <>
std::vector<std::string>
t_tscalar::get() const {
    std::vector<std::string> v;
    for (t_uindex i = 0; i < m_list_size; i++) {
        v.push_back(m_data.m_list_string[i]);
    }
    return v;
}

template <>
std::vector<bool>
t_tscalar::get() const {
    std::vector<bool> v;
    for (t_uindex i = 0; i < m_list_size; i++) {
        v.push_back(m_data.m_list_bool[i]);
    }
    return v;
}

template <>
std::vector<double>
t_tscalar::get() const {
    std::vector<double> v;
    for (t_uindex i = 0; i < m_list_size; i++) {
        v.push_back(m_data.m_list_float64[i]);
    }
    return v;
}

template <>
std::vector<std::int64_t>
t_tscalar::get() const {
    std::vector<std::int64_t> v;
    for (t_uindex i = 0; i < m_list_size; i++) {
        v.push_back(m_data.m_list_int64[i]);
    }
    return v;
}

template <>
std::vector<t_date>
t_tscalar::get() const {
    std::vector<t_date> v;
    for (t_uindex i = 0; i < m_list_size; i++) {
        v.push_back(t_date(m_data.m_list_int32[i]));
    }
    return v;
}

template <>
std::vector<t_time>
t_tscalar::get() const {
    std::vector<t_time> v;
    for (t_uindex i = 0; i < m_list_size; i++) {
        v.push_back(t_time(m_data.m_list_float64[i]));
    }
    return v;
}

template <>
std::vector<t_duration>
t_tscalar::get() const {
    std::vector<t_duration> v;
    for (t_uindex i = 0; i < m_list_size; i++) {
        v.push_back(t_duration(m_data.m_list_float64[i]));
    }
    return v;
}

template <>
t_decimal
t_tscalar::get() const {
    return t_decimal(m_data.m_decimal);
}

t_dtype
t_tscalar::get_dtype() const {
    return static_cast<t_dtype>(m_type);
}

bool
t_tscalar::cmp(t_filter_op op, const t_tscalar& other) const {
    const t_tscalar& value = *this;

    switch (op) {
        case FILTER_OP_BEFORE: {
            return value < other;
        } break;
        case FILTER_OP_LT: {
            switch (m_type) {
                case DTYPE_LIST_STR:
                case DTYPE_LIST_FLOAT64:
                case DTYPE_LIST_INT64:
                case DTYPE_LIST_BOOL:
                case DTYPE_LIST_DATE:
                case DTYPE_LIST_TIME:
                case DTYPE_LIST_DURATION: {
                    return value.compare_filter_list_common<std::less>(other);
                    // return value < other;
                } break;

                default: { return value < other; } break;
            }
        } break;
        case FILTER_OP_LTEQ: {
            switch (m_type) {
                case DTYPE_LIST_STR:
                case DTYPE_LIST_FLOAT64:
                case DTYPE_LIST_INT64:
                case DTYPE_LIST_BOOL:
                case DTYPE_LIST_DATE:
                case DTYPE_LIST_TIME:
                case DTYPE_LIST_DURATION: {
                    return value.compare_filter_list_common<std::less>(other) || other == value;
                } break;

                default: { return value < other || other == value; } break;
            }
        } break;
        case FILTER_OP_AFTER: {
            return value > other;
        } break;
        case FILTER_OP_GT: {
            switch (m_type) {
                case DTYPE_LIST_STR:
                case DTYPE_LIST_FLOAT64:
                case DTYPE_LIST_INT64:
                case DTYPE_LIST_BOOL:
                case DTYPE_LIST_DATE:
                case DTYPE_LIST_TIME:
                case DTYPE_LIST_DURATION: {
                    return value.compare_filter_list_common<std::greater>(other);
                    // return value > other;
                } break;

                default: { return value > other; } break;
            }
        } break;
        case FILTER_OP_LAST_7_DAYS:
        case FILTER_OP_LAST_10_DAYS:
        case FILTER_OP_LAST_30_DAYS: {
            return value > other || other == value;
        } break;
        case FILTER_OP_GTEQ: {
            switch (m_type) {
                case DTYPE_LIST_STR:
                case DTYPE_LIST_FLOAT64:
                case DTYPE_LIST_INT64:
                case DTYPE_LIST_BOOL:
                case DTYPE_LIST_DATE:
                case DTYPE_LIST_TIME:
                case DTYPE_LIST_DURATION: {
                    return value.compare_filter_list_common<std::greater>(other)
                        || other == value;
                } break;

                default: { return value > other || other == value; } break;
            }
        } break;
        case FILTER_OP_EQ: {
            if (value.m_type == DTYPE_STR) {
                if (other.m_type != DTYPE_STR) {
                    return false;
                }
                if (value.is_valid() != other.is_valid()) {
                    return false;
                }
                //return other == value;
                return other.pp_search_equals(value.to_string(), nullptr, nullptr);
            } else {
                return other == value;
            }
        } break;
        case FILTER_OP_NE: {
            //return other != value;
            if (value.m_type == DTYPE_STR) {
                if (other.m_type != DTYPE_STR) {
                    return true;
                }
                if (value.is_valid() != other.is_valid()) {
                    return true;
                }
                return !other.pp_search_equals(value.to_string(), nullptr, nullptr);
            } else {
                return other != value;
            }
        } break;
        case FILTER_OP_BEGINS_WITH: {
            return value.begins_with(other);
        } break;
        case FILTER_OP_ENDS_WITH: {
            return value.ends_with(other);
        } break;
        case FILTER_OP_CONTAINS: {
            return value.contains(other);
        } break;
        case FILTER_OP_NOT_CONTAIN: {
            return value.not_contain(other);
        };
        case FILTER_OP_IS_NAN: {
            return std::isnan(to_double());
        } break;
        case FILTER_OP_IS_NOT_NAN: {
            return !std::isnan(to_double());
        } break;
        case FILTER_OP_IS_VALID: {
            return m_status == STATUS_VALID;
        } break;
        case FILTER_OP_IS_NOT_VALID: {
            return m_status != STATUS_VALID;
        } break;
        case FILTER_OP_IS_EMPTY: {
            switch (m_type) {
                case DTYPE_LIST_STR:
                case DTYPE_LIST_FLOAT64:
                case DTYPE_LIST_INT64:
                case DTYPE_LIST_BOOL:
                case DTYPE_LIST_DATE:
                case DTYPE_LIST_TIME:
                case DTYPE_LIST_DURATION: {
                    return m_status != STATUS_VALID || m_list_size == 0;
                } break;

                default: { return m_status != STATUS_VALID; } break;
            }
        } break;
        case FILTER_OP_IS_NOT_EMPTY: {
            switch (m_type) {
                case DTYPE_LIST_STR:
                case DTYPE_LIST_FLOAT64:
                case DTYPE_LIST_INT64:
                case DTYPE_LIST_BOOL:
                case DTYPE_LIST_DATE:
                case DTYPE_LIST_TIME:
                case DTYPE_LIST_DURATION: {
                    return m_status == STATUS_VALID && m_list_size > 0;
                } break;

                default: { return m_status == STATUS_VALID; } break;
            }
        } break;
        case FILTER_OP_IS_TRUE: {
            if (m_status != STATUS_VALID || m_type != DTYPE_BOOL)
                return false;
            return get<bool>();
        } break;
        case FILTER_OP_IS_FALSE: {
            if (m_status != STATUS_VALID || m_type != DTYPE_BOOL)
                return false;
            return !get<bool>();
        } break;
        case FILTER_OP_ELE_EQ: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_EQ;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_NE: {
            return !cmp(FILTER_OP_ELE_EQ, other);
        } break;
        case FILTER_OP_ELE_CONTAINS: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_CONTAINS;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_NOT_CONTAINS: {
            return !cmp(FILTER_OP_ELE_CONTAINS, other);
        } break;
        case FILTER_OP_ELE_BEGINS_WITH: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_BEGINS_WITH;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_ENDS_WITH: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_ENDS_WITH;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_IS_TRUE: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_IS_TRUE;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_IS_FALSE: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_IS_FALSE;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_GT: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_GT;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_GTEQ: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_GTEQ;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_LT: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_LT;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_LTEQ: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_LTEQ;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_BEFORE: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_BEFORE;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_AFTER: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_AFTER;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        case FILTER_OP_ELE_BETWEEN: {
            std::vector<t_tscalar> elems = to_list<std::vector<t_tscalar>>();
            t_filter_op new_op = FILTER_OP_BETWEEN;
            for (auto& elem: elems) {
                if (elem.cmp(new_op, other)) {
                    return true;
                }
            }
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Invalid filter op"); } break;
    }

    return false;
}

const char*
t_tscalar::get_char_ptr() const {
    if (is_inplace())
        return m_data.m_inplace_char;
    return m_data.m_charptr;
}

bool
t_tscalar::is_inplace() const {
    return m_inplace;
}

bool
t_tscalar::can_store_inplace(const char* s) {
    return strlen(s) + 1 <= static_cast<size_t>(SCALAR_INPLACE_LEN);
}

bool
t_tscalar::require_to_str() const {
    switch (m_type) {
        case DTYPE_FLOAT64:
        case DTYPE_FLOAT32:
        case DTYPE_UINT8:
        case DTYPE_UINT16:
        case DTYPE_UINT32:
        case DTYPE_INT8:
        case DTYPE_INT16:
        case DTYPE_INT32:
        case DTYPE_UINT64:
        case DTYPE_INT64:
        case DTYPE_LIST_FLOAT64:
        case DTYPE_LIST_INT64: {
            if (m_data_format_type == DATA_FORMAT_FINANCIAL || m_data_format_type == DATA_FORMAT_PERCENT
                || m_data_format_type == DATA_FORMAT_QUARTER || m_data_format_type == DATA_FORMAT_WEEK
                || m_data_format_type == DATA_FORMAT_MONTH) {
                return true;
            }
        } break;

        default: { return false; } break;
    }
    return false;
}

bool
t_tscalar::is_nan() const {
    if (m_type == DTYPE_FLOAT64)
        return std::isnan(get<double>());
    if (m_type == DTYPE_FLOAT32)
        return std::isnan(get<float>());
    return false;
}

t_tscalar
mknone() {
    t_tscalar rval;
    rval.set(t_none());
    return rval;
}

t_tscalar
mknull(t_dtype dtype) {
    t_tscalar rval;
    rval.m_data.m_uint64 = 0;
    rval.m_status = STATUS_INVALID;
    rval.m_type = dtype;
    rval.m_data_format_type = get_default_data_format_type(dtype);
    if (dtype == DTYPE_STR) {
        rval.m_inplace = true;
    }
    return rval;
}

t_tscalar
mkempty(t_dtype dtype) {
    t_tscalar rval;
    rval.m_data.m_uint64 = 0;
    rval.m_status = STATUS_EMPTY;
    rval.m_type = dtype;
    rval.m_data_format_type = get_default_data_format_type(dtype);
    if (dtype == DTYPE_STR) {
        rval.m_inplace = true;
    }
    return rval;
}

t_tscalar
mkerror(t_dtype dtype) {
    t_tscalar rval;
    rval.m_data.m_uint64 = 0;
    rval.m_status = STATUS_ERROR;
    rval.m_type = dtype;
    rval.m_data_format_type = get_default_data_format_type(dtype);
    if (dtype == DTYPE_STR) {
        rval.m_inplace = true;
    }
    return rval;
}

t_tscalar
mkerror(const std::string& error) {
    t_tscalar rval;
    rval.m_data.m_uint64 = 0;
    rval.m_status = STATUS_ERROR;
    rval.m_type = DTYPE_STR;
    rval.m_data_format_type = get_default_data_format_type(DTYPE_STR);
    rval.m_error_description = error;
    rval.m_inplace = true;
    
    return rval;
}

t_tscalar
mkclear(t_dtype dtype) {
    t_tscalar rval = mknull(dtype);
    rval.m_status = STATUS_CLEAR;
    return rval;
}

t_tscalar
mk_agg_level_one(t_tscalar source, t_agg_level_type agg_level, t_dtype dtype, t_dataformattype dftype) {
    t_tscalar rval;

    if (agg_level == AGG_LEVEL_NONE) {
        return source;
    }

    if (source.is_error()) {
        return mkerror(dtype);
    }

    if (!source.is_valid()) {
        return mknull(dtype);
    }

    if (agg_level == AGG_LEVEL_YEAR || agg_level == AGG_LEVEL_QUARTER || agg_level == AGG_LEVEL_WEEK
        || agg_level == AGG_LEVEL_MONTH) {
        std::int64_t num = std::int64_t(source.to_agg_level_number(agg_level));
        rval.set(num);
    } else if (agg_level == AGG_LEVEL_HOUR || agg_level == AGG_LEVEL_MINUTE || agg_level == AGG_LEVEL_SECOND) {
        double num = source.to_agg_level_number(agg_level);
        t_duration duration = t_duration(num);  
        rval.set(duration);
    } else if (agg_level == AGG_LEVEL_DAY) {
        t_date date;
        if (dtype == DTYPE_DATE) {
            date = source.get<t_date>();
        }
        if (dtype == DTYPE_TIME) {
            t_time time = source.get<t_time>();
            date = t_date(std::int32_t(time.raw_value()));
        }
        struct tm t;
        bool rcode = date.as_tm(t);
        if (rcode) {
            // 2016 is leap year
            t_date new_date = t_date(2016, date.month(t), date.day(t));
            rval.set(new_date);
        }
    } else if (agg_level == AGG_LEVEL_DATE) {
        t_date date;
        if (dtype == DTYPE_DATE) {
            date = source.get<t_date>();
        }
        if (dtype == DTYPE_TIME) {
            t_time time = source.get<t_time>();
            date = t_date(std::int32_t(time.raw_value()));
        }
        rval.set(date);
    }

    rval.m_status = source.m_status;
    rval.m_type = dtype;
    rval.m_data_format_type = dftype;

    return rval;
}

template <>
t_tscalar
t_tscalar::coerce_numeric<bool>() const {
    t_tscalar rv;

    if (m_type == DTYPE_STR) {
        auto v = get<const char*>();
        std::string s1("True");
        std::string s2("true");
        std::string s3("TRUE");

        if (strcmp(v, s1.c_str()) == 0 || strcmp(v, s2.c_str()) == 0
            || strcmp(v, s3.c_str()) == 0) {
            rv.set(true);
            return rv;
        }
        rv.set(false);
        return rv;
    }
    bool v = static_cast<bool>(m_data.m_uint64);
    rv.set(v);
    return rv;
}

} // end namespace perspective

namespace std {
std::ostream&
operator<<(std::ostream& os, const perspective::t_tscalar& t) {
    os << repr(t);
    return os;
}

std::ostream&
operator<<(std::ostream& os, const std::vector<perspective::t_tscalar>& t) {
    for (const auto& s : t) {
        os << s << ", ";
    }
    return os;
}

} // end namespace std
