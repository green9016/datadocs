/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/portable.h>
#include <perspective/column_meta.h>
SUPPRESS_WARNINGS_VC(4505)
#include <perspective/column.h>
#include <perspective/defaults.h>
#include <perspective/base.h>
#include <perspective/sym_table.h>
#include <perspective/scalar.h>

#ifdef PSP_ENABLE_PYTHON
namespace py = boost::python;
namespace np = boost::python::numpy;
#include <perspective/numpy.h>
#endif

namespace perspective {
static bool
get_integer(const t_tscalar& scal, int64_t* out) noexcept {
    if (!scal.is_valid() || scal.is_error()) {
        return false;
    }

    switch (scal.get_dtype()) {
        case t_dtype::DTYPE_INT8:
        case t_dtype::DTYPE_INT16:
        case t_dtype::DTYPE_INT32:
        case t_dtype::DTYPE_INT64:
        case t_dtype::DTYPE_UINT8:
        case t_dtype::DTYPE_UINT16:
        case t_dtype::DTYPE_UINT32:
        case t_dtype::DTYPE_UINT64:
            if (out)
                *out = scal.to_int64();
            return true;
        case t_dtype::DTYPE_STR: {
            const char* p = scal.get_char_ptr();
            if (!p || !*p)
                return false;
            int64_t value = atoll(p);
            if (value != 0 || !strcmp(p, "0")) {
                if (out)
                    *out = value;
                return true;
            }
            return false;
        }
        default:
            return false;
    }
}

static bool
get_double(const t_tscalar& scal, double* out) noexcept {
    if (!scal.is_valid() || scal.is_error()) {
        return false;
    }
    switch (scal.get_dtype()) {
        case t_dtype::DTYPE_INT8:
        case t_dtype::DTYPE_INT16:
        case t_dtype::DTYPE_INT32:
        case t_dtype::DTYPE_INT64:
        case t_dtype::DTYPE_UINT8:
        case t_dtype::DTYPE_UINT16:
        case t_dtype::DTYPE_UINT32:
        case t_dtype::DTYPE_UINT64:
            if (out)
                *out = (double)scal.to_int64();
            return true;
        case t_dtype::DTYPE_FLOAT32:
        case t_dtype::DTYPE_FLOAT64:
            if (out)
                *out = scal.to_double();
            return true;
        case t_dtype::DTYPE_STR: {
            char* end = 0;
            auto s = scal.get_char_ptr();
            auto double_val = strtod(s, &end);
            bool is_double = end != s && double_val != HUGE_VAL;
            if (is_double && out)
                *out = double_val;
        }
        default:
            return false;
    }
}

// TODO : move to delegated constructors in C++11

t_column_recipe::t_column_recipe()
    : m_vlenidx(0)
    , m_size(0) {}

t_column::t_column()
    : m_dtype(DTYPE_NONE)
    , m_init(false)
    , m_isvlen(false)
    , m_data(nullptr)
    , m_vocab(nullptr)
    , m_status(nullptr)
    , m_size(0)
    , m_status_enabled(false)
    , m_from_recipe(false)
    , m_data_format_type(DATA_FORMAT_NONE)
    , m_errors(nullptr)
    , m_truncated(WARNING_TYPE_NONE)
{
    LOG_CONSTRUCTOR("t_column");
}

t_column::t_column(const t_column_recipe& recipe)
    : m_dtype(recipe.m_dtype)
    , m_init(false)
    , m_size(recipe.m_size)
    , m_status_enabled(recipe.m_status_enabled)
    , m_from_recipe(true)
    , m_data_format_type(recipe.m_data_format_type)
    , m_truncated(recipe.m_truncated)

{
    LOG_CONSTRUCTOR("t_column");
    m_data.reset(new t_lstore(recipe.m_data));
    m_isvlen = is_vlen_dtype(recipe.m_dtype);

    if (m_isvlen) {
        m_vocab.reset(new t_vocab(recipe));
    } else {
        m_vocab.reset(new t_vocab);
    }

    if (m_status_enabled) {
        m_status.reset(new t_lstore(recipe.m_status));
    } else {
        m_status.reset(new t_lstore);
    }

    m_errors.reset();
}

void
t_column::column_copy_helper(const t_column& other) {
    m_dtype = other.m_dtype;
    m_init = false;
    m_isvlen = other.m_isvlen;
    m_data.reset(new t_lstore(other.m_data->get_recipe()));
    m_vocab.reset(new t_vocab(other.m_vocab->get_vlendata()->get_recipe(),
        other.m_vocab->get_extents()->get_recipe()));
    m_status.reset(new t_lstore(other.m_status->get_recipe()));

    m_size = other.m_size;
    m_status_enabled = other.m_status_enabled;
    m_from_recipe = false;
    m_data_format_type = other.m_data_format_type;
    m_truncated = other.m_truncated;
}

t_column::t_column(const t_column& c) {
    PSP_VERBOSE_ASSERT(this != &c, "Assigning self");
    column_copy_helper(c);
    m_init = false;
}

t_column&
t_column::operator=(const t_column& c) {
    PSP_VERBOSE_ASSERT(this != &c, "Assigning self");
    column_copy_helper(c);
    m_init = false;
    return *this;
}

t_column::t_column(t_dtype dtype, bool missing_enabled, const t_lstore_recipe& a,
    t_dataformattype data_format_type)
    : t_column(
          dtype, missing_enabled, a, a.m_capacity / get_dtype_size(dtype), data_format_type) {}

t_column::t_column(t_dtype dtype, bool missing_enabled, const t_lstore_recipe& a,
    t_uindex row_capacity, t_dataformattype data_format_type)
    : m_dtype(dtype)
    , m_init(false)
    , m_size(0)
    , m_status_enabled(missing_enabled)
    , m_from_recipe(false)
    , m_data_format_type(data_format_type)
    , m_truncated(WARNING_TYPE_NONE) {

    m_data.reset(new t_lstore(a));
    // TODO make sure that capacity from a
    // is not causing an overrreserve in places
    // most notably in valid columns
    LOG_CONSTRUCTOR("t_column");
    m_isvlen = is_vlen_dtype(m_dtype);

    if (is_vlen_dtype(dtype)) {
        t_lstore_recipe vlendata_args(a);
        t_lstore_recipe extents_args(a);

        vlendata_args.m_capacity = DEFAULT_EMPTY_CAPACITY;
        extents_args.m_capacity = DEFAULT_EMPTY_CAPACITY;

        vlendata_args.m_colname = a.m_colname + std::string("_vlendata");
        extents_args.m_colname = a.m_colname + std::string("_extents");

        m_vocab.reset(new t_vocab(vlendata_args, extents_args));
    } else {
        m_vocab.reset(new t_vocab);
    }

    if (is_status_enabled()) {
        t_lstore_recipe missing_args(a);
        missing_args.m_capacity = row_capacity;

        missing_args.m_colname = a.m_colname + std::string("_missing");
        m_status.reset(new t_lstore(missing_args));
    } else {
        m_status.reset(new t_lstore);
    }

    m_errors.reset();
}

bool
t_column::is_status_enabled() const {
    return m_status_enabled;
}

void
t_column::init() {
    LOG_INIT("t_column");

    m_data->init();

    m_errors.reset();

    if (is_vlen_dtype(m_dtype)) {
        m_vocab->init(m_from_recipe);
    }

    if (is_status_enabled()) {
        m_status->init();
    }

    if (is_deterministic_sized(m_dtype))
        m_elemsize = get_dtype_size(m_dtype);
    m_init = true;
    COLUMN_CHECK_VALUES();
}

t_column::~t_column() { LOG_DESTRUCTOR("t_column"); }

t_dtype
t_column::get_dtype() const {
    return m_dtype;
}

void
t_column::set_dtype(t_dtype dtype) {
    m_dtype = dtype;
}

t_dataformattype
t_column::get_data_format_type() const {
    return m_data_format_type;
}

void
t_column::set_data_format_type(t_dataformattype dftype) {
    m_data_format_type = dftype;
}

// extend based on dtype size
void
t_column::extend_dtype(t_uindex idx) {
    t_uindex new_extents = idx * get_dtype_size(m_dtype);
    m_data->reserve(new_extents);
    m_data->set_size(new_extents);
    m_size = m_data->size() / get_dtype_size(m_dtype);

    if (is_status_enabled()) {
        t_uindex sz = idx * get_dtype_size(DTYPE_UINT8);
        m_status->reserve(sz);
        m_status->set_size(sz);
    }
}

t_uindex
t_column::get_interned(const std::string& s) {
    COLUMN_CHECK_STRCOL();
    return m_vocab->get_interned(s);
}
t_uindex
t_column::get_interned(const char* s) {
    COLUMN_CHECK_STRCOL();
    return m_vocab->get_interned(s);
}

template <>
void
t_column::push_back<const char*>(const char* elem) {
    COLUMN_CHECK_STRCOL();
    if (!elem) {
        m_data->push_back(static_cast<t_uindex>(0));
        return;
    }

    t_uindex idx = m_vocab->get_interned(elem);
    m_data->push_back(idx);
    ++m_size;
}

template <>
void
t_column::push_back<char*>(char* elem) {
    COLUMN_CHECK_STRCOL();
    t_uindex idx = m_vocab->get_interned(elem);
    m_data->push_back(idx);
    ++m_size;
}

template <>
void
t_column::push_back<std::string>(std::string elem) {
    COLUMN_CHECK_STRCOL();
    push_back(elem.c_str());
    ++m_size;
}

template <>
void
t_column::push_back<const char*>(const char* elem, t_status status) {
    COLUMN_CHECK_STRCOL();
    push_back(elem);
    m_status->push_back(status);
    ++m_size;
}

template <>
void
t_column::push_back<char*>(char* elem, t_status status) {
    COLUMN_CHECK_STRCOL();
    push_back(elem);
    m_status->push_back(status);
    ++m_size;
}

template <>
void
t_column::push_back<std::string>(std::string elem, t_status status) {
    COLUMN_CHECK_STRCOL();
    push_back(elem);
    m_status->push_back(status);
    ++m_size;
}

template <>
PERSPECTIVE_EXPORT void
t_column::push_back<t_tscalar>(t_tscalar elem) {
    elem.m_type = m_dtype;

    switch (m_dtype) {
        case DTYPE_NONE: {
            PSP_COMPLAIN_AND_ABORT("Encountered none");
        } break;
        case DTYPE_INT64: {
            push_back(elem.get<std::int64_t>(), elem.m_status);
        } break;
        case DTYPE_INT32: {
            push_back(elem.get<std::int32_t>(), elem.m_status);
        } break;
        case DTYPE_INT16: {
            push_back(elem.get<std::int16_t>(), elem.m_status);
        } break;
        case DTYPE_INT8: {
            push_back(elem.get<std::int8_t>(), elem.m_status);
        } break;
        case DTYPE_UINT64: {
            push_back(elem.get<std::uint64_t>(), elem.m_status);
        } break;
        case DTYPE_UINT32: {
            push_back(elem.get<std::uint32_t>(), elem.m_status);
        } break;
        case DTYPE_UINT16: {
            push_back(elem.get<std::uint16_t>(), elem.m_status);
        } break;
        case DTYPE_UINT8: {
            push_back(elem.get<std::uint8_t>(), elem.m_status);
        } break;
        case DTYPE_FLOAT64: {
            push_back(elem.get<double>(), elem.m_status);
        } break;
        case DTYPE_FLOAT32: {
            push_back(elem.get<float>(), elem.m_status);
        } break;
        case DTYPE_BOOL: {
            push_back(elem.get<bool>(), elem.m_status);
        } break;
        case DTYPE_TIME: {
            push_back(elem.get<double>(), elem.m_status);
        } break;
        case DTYPE_DURATION: {
            push_back(elem.get<double>(), elem.m_status);
        } break;
        case DTYPE_DATE: {
            push_back(elem.get<std::int32_t>(), elem.m_status);
        } break;
        case DTYPE_STR: {
            push_back(elem.get<const char*>(), elem.m_status);
        } break;
        case DTYPE_LIST_STR: {
            push_back(elem.get<std::vector<std::string>>(), elem.m_status);
        } break;
        case DTYPE_LIST_BOOL: {
            push_back(elem.get<std::vector<bool>>(), elem.m_status);
        } break;
        case DTYPE_LIST_FLOAT64: {
            push_back(elem.get<std::vector<double>>(), elem.m_status);
        } break;
        case DTYPE_LIST_INT64: {
            push_back(elem.get<std::vector<std::int64_t>>(), elem.m_status);
        } break;
        case DTYPE_LIST_DATE: {
            push_back(elem.get<std::vector<t_date>>(), elem.m_status);
        } break;
        case DTYPE_LIST_TIME: {
            push_back(elem.get<std::vector<t_time>>(), elem.m_status);
        } break;
        case DTYPE_LIST_DURATION: {
            push_back(elem.get<std::vector<t_duration>>(), elem.m_status);
        } break;
        case DTYPE_DECIMAL: {
            push_back(elem.get<t_decimal>(), elem.m_status);
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Unexpected type"); }
    }
    ++m_size;
}

void
t_column::set_truncated(t_warning_type truncated) {
    m_truncated = truncated;
}

const t_lstore&
t_column::data_lstore() const {
    return *m_data;
}

t_uindex
t_column::size() const {
    return m_size;
}

void
t_column::set_size(t_uindex size) {
#ifdef PSP_COLUMN_VERIFY
    PSP_VERBOSE_ASSERT(size * get_dtype_size(m_dtype) <= m_data->capacity(),
        "Not enough space reserved for column");
#endif
    m_size = size;
    m_data->set_size(m_elemsize * size);

    if (is_status_enabled())
        m_status->set_size(get_dtype_size(DTYPE_UINT8) * size);
}

void
t_column::reserve(t_uindex size) {
    m_data->reserve(get_dtype_size(m_dtype) * size);
    if (is_status_enabled())
        m_status->reserve(get_dtype_size(DTYPE_UINT8) * size);
}

t_lstore*
t_column::_get_data_lstore() {
    return m_data.get();
}

t_tscalar
t_column::get_unnest_scalar(t_uindex idx, t_uindex uidx, t_agg_level_type agg_level, t_binning_info binning,
    t_dataformattype df_type, std::vector<double>& dbinning) const {
    COLUMN_CHECK_ACCESS(idx);
    t_tscalar rv;
    rv.clear();
    bool is_empty = false;
    t_dtype new_type = m_dtype;

    switch (m_dtype) {
        case DTYPE_LIST_STR: {
            std::vector<std::string> value = *(m_data->get_nth<std::vector<std::string>>(idx));
            if (value.size() == 0 || uidx >= value.size() || uidx < 0) {
                is_empty = true;
                new_type = DTYPE_STR;
                break;
            }
            if (is_vlen_dtype(DTYPE_STR) && !m_vocab->is_init()) {
                m_vocab->init(m_from_recipe);
            }
            t_uindex sidx = m_vocab->get_interned(value[uidx].c_str());
            rv.set(m_vocab->unintern_c(sidx));
        } break;
        case DTYPE_LIST_BOOL: {
            std::vector<bool> value = *(m_data->get_nth<std::vector<bool>>(idx));
            if (value.size() == 0 || uidx >= value.size() || uidx < 0) {
                is_empty = true;
                new_type = DTYPE_BOOL;
                break;
            }
            rv.set((bool)value[uidx]);
        } break;
        case DTYPE_LIST_FLOAT64: {
            std::vector<double> value = *(m_data->get_nth<std::vector<double>>(idx));
            if (value.size() == 0 || uidx >= value.size() || uidx < 0) {
                is_empty = true;
                new_type = DTYPE_FLOAT64;
                break;
            }
            rv.set(value[uidx]);
        } break;
        case DTYPE_LIST_INT64: {
            std::vector<std::int64_t> value
                = *(m_data->get_nth<std::vector<std::int64_t>>(idx));
            if (value.size() == 0 || uidx >= value.size() || uidx < 0) {
                is_empty = true;
                new_type = DTYPE_INT64;
                break;
            }
            rv.set(value[uidx]);
        } break;
        case DTYPE_LIST_DATE: {
            std::vector<t_date> value = *(m_data->get_nth<std::vector<t_date>>(idx));
            if (value.size() == 0 || uidx >= value.size() || uidx < 0) {
                is_empty = true;
                new_type = DTYPE_DATE;
                break;
            }
            if (agg_level != AGG_LEVEL_NONE) {
                struct tm t;
                bool rcode = value[uidx].as_tm(t);
                if (rcode) {
                    if (agg_level == AGG_LEVEL_DAY) {
                        // 2016 is leap year
                        t_date date = t_date(2016, value[uidx].month(t), value[uidx].day(t));
                        rv.set(date);
                    } else if (agg_level == AGG_LEVEL_YEAR || agg_level == AGG_LEVEL_QUARTER || agg_level == AGG_LEVEL_WEEK
                        || agg_level == AGG_LEVEL_MONTH) {
                        std::int64_t num = std::int64_t(value[uidx].agg_level_num(t, agg_level));
                        rv.set(num);
                    } else {
                        rv.set(get_interned_tscalar(value[uidx].agg_level_str(t, agg_level).c_str()));
                    }
                } else {
                    PSP_COMPLAIN_AND_ABORT("Could not return date value.");
                }
            } else {
                rv.set(value[uidx]);
            }
        } break;
        case DTYPE_LIST_TIME: {
            std::vector<t_time> value = *(m_data->get_nth<std::vector<t_time>>(idx));
            if (value.size() == 0 || uidx >= value.size() || uidx < 0) {
                is_empty = true;
                new_type = DTYPE_TIME;
                break;
            }
            if (agg_level != AGG_LEVEL_NONE) {
                struct tm t;
                bool rcode = value[uidx].as_tm(t);
                if (rcode) {
                    if (agg_level == AGG_LEVEL_DAY) {
                        t_time time = value[uidx];
                        // 2016 is leap year
                        t_date date = t_date(2016, time.month(t), time.day(t));
                        rv.set(date);
                    } else if (agg_level == AGG_LEVEL_DATE) {
                        t_time time = value[uidx];
                        // 2016 is leap year
                        t_date date = t_date(time.year(t), time.month(t), time.day(t));
                        rv.set(date);
                    } else if (agg_level == AGG_LEVEL_YEAR || agg_level == AGG_LEVEL_QUARTER || agg_level == AGG_LEVEL_WEEK
                        || agg_level == AGG_LEVEL_MONTH) {
                        std::int64_t num = std::int64_t(value[uidx].agg_level_num(t, agg_level));
                        rv.set(num);
                    } else if (agg_level == AGG_LEVEL_HOUR || agg_level == AGG_LEVEL_MINUTE || agg_level == AGG_LEVEL_SECOND) {
                        double num = value[uidx].agg_level_num(t, agg_level);
                        t_duration duration = t_duration(num);
                        rv.set(duration);
                    } else {
                        rv.set(get_interned_tscalar(value[uidx].agg_level_str(t, agg_level).c_str()));
                    }
                } else {
                    PSP_COMPLAIN_AND_ABORT("Could not return date value.");
                }
            } else {
                rv.set(value[uidx]);
            }
        } break;
        case DTYPE_LIST_DURATION: {
            std::vector<t_duration> value = *(m_data->get_nth<std::vector<t_duration>>(idx));
            if (value.size() == 0 || uidx >= value.size() || uidx < 0) {
                is_empty = true;
                new_type = DTYPE_DURATION;
                break;
            }
            if (agg_level != AGG_LEVEL_NONE) {
                if (agg_level == AGG_LEVEL_HOUR || agg_level == AGG_LEVEL_MINUTE || agg_level == AGG_LEVEL_SECOND) {
                    double num = value[uidx].agg_level_num(agg_level);
                    t_duration duration = t_duration(num);
                    rv.set(duration);
                } else {
                    rv.set(get_interned_tscalar(value[uidx].agg_level_str(get_data_format_type(), agg_level).c_str()));
                }
            } else {
                rv.set(value[uidx]);
            }
        } break;
        case DTYPE_DATE: {
            if (agg_level != AGG_LEVEL_NONE) {
                const t_date::t_rawtype* v = m_data->get_nth<t_date::t_rawtype>(idx);
                t_date value = t_date(*v);
                struct tm t;
                bool rcode = value.as_tm(t);
                if (rcode) {
                    rv.set(get_interned_tscalar(value.agg_level_str(t, agg_level).c_str()));
                } else {
                    PSP_COMPLAIN_AND_ABORT("Could not return date value.");
                }
            } else {
                rv = get_scalar(idx);
            }
        } break;
        case DTYPE_TIME: {
            if (agg_level != AGG_LEVEL_NONE) {
                const t_time::t_rawtype* v = m_data->get_nth<t_time::t_rawtype>(idx);
                t_time value = t_time(*v);
                struct tm t;
                bool rcode = value.as_tm(t);
                if (rcode) {
                    rv.set(get_interned_tscalar(value.agg_level_str(t, agg_level).c_str()));
                } else {
                    PSP_COMPLAIN_AND_ABORT("Could not return datetime value.");
                }
            } else {
                rv = get_scalar(idx);
            }
        } break;
        case DTYPE_DURATION: {
            if (agg_level != AGG_LEVEL_NONE) {
                const t_duration::t_rawtype* v = m_data->get_nth<t_duration::t_rawtype>(idx);
                t_duration value = t_duration(*v);
                rv.set(get_interned_tscalar(value.agg_level_str(get_data_format_type(), agg_level).c_str()));
            } else {
                rv = get_scalar(idx);
            }
        } break;
        default: { rv = get_scalar(idx); } break;
    }

    if (is_status_enabled())
        rv.m_status = *get_nth_status(idx);

    if (is_empty) {
        rv = mknull(new_type);
    }
    if (dbinning.size() == 3) {
        if (rv.is_valid()) {
            double tmp_double;
            if (rv.m_type == DTYPE_DATE || rv.m_type == DTYPE_TIME) {
                tmp_double = rv.to_agg_level_number(AGG_LEVEL_YEAR);
            } else {
                tmp_double = rv.to_double();
            }
            if (tmp_double < dbinning[0])
                dbinning[0] = tmp_double;
            if (tmp_double > dbinning[1])
                dbinning[1] = tmp_double;
        }
        dbinning[2]++;
    }
    // Format value for binning
    if (binning.type != BINNING_TYPE_NONE) {
        rv = rv.to_binning_middle_value(binning);
        rv.m_data_format_type = df_type;
    }

    return rv;
}

t_tscalar
t_column::get_scalar(t_uindex idx, bool include_error) const {
    COLUMN_CHECK_ACCESS(idx);
    t_tscalar rv;
    rv.clear();

    switch (m_dtype) {
        case DTYPE_NONE: {
        } break;
        case DTYPE_INT64: {
            rv.set(*(m_data->get_nth<std::int64_t>(idx)));
        } break;
        case DTYPE_INT32: {
            rv.set(*(m_data->get_nth<std::int32_t>(idx)));
        } break;
        case DTYPE_INT16: {
            rv.set(*(m_data->get_nth<std::int16_t>(idx)));
        } break;
        case DTYPE_INT8: {
            rv.set(*(m_data->get_nth<std::int8_t>(idx)));
        } break;

        case DTYPE_UINT64: {
            rv.set(*(m_data->get_nth<std::uint64_t>(idx)));
        } break;
        case DTYPE_UINT32: {
            rv.set(*(m_data->get_nth<std::uint32_t>(idx)));
        } break;
        case DTYPE_UINT16: {
            rv.set(*(m_data->get_nth<std::uint16_t>(idx)));
        } break;
        case DTYPE_UINT8: {
            rv.set(*(m_data->get_nth<std::uint8_t>(idx)));
        } break;

        case DTYPE_FLOAT64: {
            rv.set(*(m_data->get_nth<double>(idx)));
        } break;
        case DTYPE_FLOAT32: {
            rv.set(*(m_data->get_nth<float>(idx)));
        } break;
        case DTYPE_BOOL: {
            rv.set(*(m_data->get_nth<bool>(idx)));
        } break;
        case DTYPE_TIME: {
            const t_time::t_rawtype* v = m_data->get_nth<t_time::t_rawtype>(idx);
            rv.set(t_time(*v));
        } break;
        case DTYPE_DURATION: {
            const t_duration::t_rawtype* v = m_data->get_nth<t_duration::t_rawtype>(idx);
            rv.set(t_duration(*v));
        } break;
        case DTYPE_DATE: {
            const t_date::t_rawtype* v = m_data->get_nth<t_date::t_rawtype>(idx);
            rv.set(t_date(*v));
        } break;
        case DTYPE_STR: {
            COLUMN_CHECK_STRCOL();
            const t_uindex* sidx = m_data->get_nth<t_uindex>(idx);
            rv.set(m_vocab->unintern_c(*sidx));
        } break;
        case DTYPE_F64PAIR: {
            const std::pair<double, double>* pair
                = m_data->get_nth<std::pair<double, double>>(idx);
            rv.set(pair->first / pair->second);
        } break;
        case DTYPE_LIST_STR: {
            rv.set(*(m_data->get_nth<std::vector<std::string>>(idx)));
        } break;
        case DTYPE_LIST_BOOL: {
            rv.set(*(m_data->get_nth<std::vector<bool>>(idx)));
        } break;
        case DTYPE_LIST_FLOAT64: {
            rv.set(*(m_data->get_nth<std::vector<double>>(idx)));
        } break;
        case DTYPE_LIST_INT64: {
            rv.set(*(m_data->get_nth<std::vector<std::int64_t>>(idx)));
        } break;
        case DTYPE_LIST_DATE: {
            rv.set(*(m_data->get_nth<std::vector<t_date>>(idx)));
        } break;
        case DTYPE_LIST_TIME: {
            rv.set(*(m_data->get_nth<std::vector<t_time>>(idx)));
        } break;
        case DTYPE_LIST_DURATION: {
            rv.set(*(m_data->get_nth<std::vector<t_duration>>(idx)));
        } break;
        case DTYPE_DECIMAL: {
            rv.set(*(m_data->get_nth<t_decimal>(idx)));
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Unexpected type"); }
    }

    if (include_error && is_error(idx)) {
        rv.set(get_interned_tscalar(get_error_message(idx).c_str()));
    }

    // set data format type
    rv.m_data_format_type = m_data_format_type;

    if (is_status_enabled())
        rv.m_status = *get_nth_status(idx);

    return rv;
}

t_tscalar
t_column::get_pivot_scalar(t_uindex idx) const {
    t_tscalar value = get_scalar(idx);
    if (value.is_error()) {
        std::string error_msg = "This value contained an error.";
        value.set(get_interned_tscalar(error_msg.c_str()));
        value.m_status = STATUS_ERROR;
    }
    return value;
}

t_cell_error
t_column::get_error(t_uindex idx) const {
    COLUMN_CHECK_ACCESS(idx);
    t_cell_error rv;

    auto &errors = *m_errors;
    rv = t_cell_error{errors[idx].m_code, errors[idx].m_value};

    return rv;
}

std::string
t_column::get_error_message(t_uindex idx) const {
    auto error = get_error(idx);
    std::string msg = "";
    auto raw_value = error.m_value;

    switch(error.m_code) {
        case TYPE_ERROR: {
            msg = "The value '" + (raw_value.size() > 30 ? (raw_value.substr(0, 30) + "...") : raw_value) + "' cannot be converted to a " + dtype_to_str(m_dtype);
        } break;
    }

    return msg;
}

void
t_column::unset(t_uindex idx) {
    clear(idx, STATUS_CLEAR);
}

void
t_column::clear(t_uindex idx) {
    clear(idx, STATUS_INVALID);
}

void
t_column::clear(t_uindex idx, t_status status) {
    switch (m_dtype) {
        case DTYPE_STR: {
            t_uindex v = 0;
            set_nth<t_uindex>(idx, v, status);
        } break;
        case DTYPE_TIME:
        case DTYPE_DURATION:
        case DTYPE_FLOAT64:
        case DTYPE_UINT64:
        case DTYPE_INT64: {
            std::uint64_t v = 0;
            set_nth<std::uint64_t>(idx, v, status);
        } break;
        case DTYPE_DATE:
        case DTYPE_FLOAT32:
        case DTYPE_UINT32:
        case DTYPE_INT32: {
            std::uint32_t v = 0;
            set_nth<std::uint32_t>(idx, v, status);
        } break;
        case DTYPE_UINT16:
        case DTYPE_INT16: {
            std::uint16_t v = 0;
            set_nth<std::uint16_t>(idx, v, status);
        } break;
        case DTYPE_BOOL:
        case DTYPE_UINT8:
        case DTYPE_INT8: {
            std::uint8_t v = 0;
            set_nth<std::uint8_t>(idx, v, status);
        } break;
        case DTYPE_F64PAIR: {
            std::pair<std::uint64_t, std::uint64_t> v;
            v.first = 0;
            v.second = 0;
            set_nth<std::pair<std::uint64_t, std::uint64_t>>(idx, v, status);
        } break;
        case DTYPE_LIST_STR: {
            std::vector<std::string> v;
            set_nth<std::vector<std::string>>(idx, v, status);
        } break;
        case DTYPE_LIST_BOOL: {
            std::vector<bool> v;
            set_nth<std::vector<bool>>(idx, v, status);
        } break;
        case DTYPE_LIST_FLOAT64: {
            std::vector<double> v;
            set_nth<std::vector<double>>(idx, v, status);
        } break;
        case DTYPE_LIST_INT64: {
            std::vector<std::int64_t> v;
            set_nth<std::vector<std::int64_t>>(idx, v, status);
        } break;
        case DTYPE_LIST_DATE: {
            std::vector<t_date> v;
            set_nth<std::vector<t_date>>(idx, v, status);
        } break;
        case DTYPE_LIST_TIME: {
            std::vector<t_time> v;
            set_nth<std::vector<t_time>>(idx, v, status);
        } break;
        case DTYPE_LIST_DURATION: {
            std::vector<t_duration> v;
            set_nth<std::vector<t_duration>>(idx, v, status);
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Unexpected type"); }
    }
}

template <>
char*
t_column::get_nth<char>(t_uindex idx) {
    PSP_COMPLAIN_AND_ABORT("Unsafe operation detected");
    ++idx;
    return 0;
}

template <>
const char*
t_column::get_nth<const char>(t_uindex idx) const {
    COLUMN_CHECK_ACCESS(idx);
    COLUMN_CHECK_STRCOL();
    const t_uindex* sidx = get_nth<t_uindex>(idx);
    return m_vocab->unintern_c(*sidx);
}

// idx is in items
const t_status*
t_column::get_nth_status(t_uindex idx) const {
    PSP_VERBOSE_ASSERT(is_status_enabled(), "Status not available for column");
    COLUMN_CHECK_ACCESS(idx);
    t_status* status = m_status->get_nth<t_status>(idx);
    return status;
}

bool
t_column::is_valid(t_uindex idx) const {
    PSP_VERBOSE_ASSERT(is_status_enabled(), "Status not available for column");
    COLUMN_CHECK_ACCESS(idx);
    t_status status = *m_status->get_nth<t_status>(idx);
    return status == STATUS_VALID || status == STATUS_WARNING;
}

bool
t_column::is_cleared(t_uindex idx) const {
    PSP_VERBOSE_ASSERT(is_status_enabled(), "Status not available for column");
    COLUMN_CHECK_ACCESS(idx);
    t_status status = *m_status->get_nth<t_status>(idx);
    return status == STATUS_CLEAR;
}

bool
t_column::is_error(t_uindex idx) const {
    PSP_VERBOSE_ASSERT(is_status_enabled(), "Status not available for column");
    COLUMN_CHECK_ACCESS(idx);
    t_status status = *m_status->get_nth<t_status>(idx);
    return status == STATUS_ERROR;
}

bool
t_column::is_warning(t_uindex idx) const {
    PSP_VERBOSE_ASSERT(is_status_enabled(), "Status not available for column");
    COLUMN_CHECK_ACCESS(idx);
    t_status status = *m_status->get_nth<t_status>(idx);
    return status == STATUS_WARNING;
}

template <>
void
t_column::set_nth<const char*>(t_uindex idx, const char* elem) {
    COLUMN_CHECK_STRCOL();
    set_nth_body(idx, elem, STATUS_VALID);
}

template <>
void
t_column::set_nth<std::string>(t_uindex idx, std::string elem) {
    COLUMN_CHECK_STRCOL();
    set_nth(idx, elem.c_str(), STATUS_VALID);
}

template <>
void
t_column::set_nth<const char*>(t_uindex idx, const char* elem, t_status status) {
    COLUMN_CHECK_STRCOL();
    set_nth_body(idx, elem, status);
}

template <>
void
t_column::set_nth<std::string>(t_uindex idx, std::string elem, t_status status) {
    COLUMN_CHECK_STRCOL();
    set_nth(idx, elem.c_str(), status);
}

void
t_column::set_error(t_uindex idx, t_cell_error error) {
    m_errors->insert(std::pair<t_uindex, t_cell_error>(idx, error));
}

void
t_column::set_valid(t_uindex idx, bool valid) {
    set_status(idx, valid ? STATUS_VALID : STATUS_INVALID);
}

void
t_column::set_error_status(t_uindex idx) {
    set_status(idx, STATUS_ERROR);
}

void
t_column::set_warning_status(t_uindex idx) {
    set_status(idx, STATUS_WARNING);
}

void
t_column::set_status(t_uindex idx, t_status status) {
    m_status->set_nth<t_status>(idx, status);
}

void
t_column::set_scalar(t_uindex idx, t_tscalar value) {
    COLUMN_CHECK_ACCESS(idx);
    value.m_type = m_dtype;

    switch (m_dtype) {
        case DTYPE_NONE: {
        } break;
        case DTYPE_INT64: {
            std::int64_t tgt = value.get<std::int64_t>();
            set_nth<std::int64_t>(idx, tgt, value.m_status);
        } break;
        case DTYPE_INT32: {
            std::int32_t tgt = value.get<std::int32_t>();
            set_nth<std::int32_t>(idx, tgt, value.m_status);
        } break;
        case DTYPE_INT16: {
            std::int16_t tgt = value.get<std::int16_t>();
            set_nth<std::int16_t>(idx, tgt, value.m_status);
        } break;
        case DTYPE_INT8: {
            std::int8_t tgt = value.get<std::int8_t>();
            set_nth<std::int8_t>(idx, tgt, value.m_status);
        } break;
        case DTYPE_UINT64: {
            std::uint64_t tgt = value.get<std::uint64_t>();
            set_nth<std::uint64_t>(idx, tgt, value.m_status);
        } break;
        case DTYPE_UINT32: {
            std::uint32_t tgt = value.get<std::uint32_t>();
            set_nth<std::uint32_t>(idx, tgt, value.m_status);
        } break;
        case DTYPE_UINT16: {
            std::uint16_t tgt = value.get<std::uint16_t>();
            set_nth<std::uint16_t>(idx, tgt, value.m_status);
        } break;
        case DTYPE_UINT8: {
            std::uint8_t tgt = value.get<std::uint8_t>();
            set_nth<std::uint8_t>(idx, tgt, value.m_status);
        } break;
        case DTYPE_FLOAT64: {
            double tgt = value.get<double>();
            set_nth<double>(idx, tgt, value.m_status);
        } break;
        case DTYPE_FLOAT32: {
            float tgt = value.get<float>();
            set_nth<float>(idx, tgt, value.m_status);
        } break;
        case DTYPE_BOOL: {
            bool tgt = value.get<bool>();
            set_nth<bool>(idx, tgt, value.m_status);
        } break;
        case DTYPE_TIME: {
            t_time tgt = value.get<t_time>();
            set_nth<t_time>(idx, tgt, value.m_status);
        } break;
        case DTYPE_DURATION: {
            t_duration tgt = value.get<t_duration>();
            set_nth<t_duration>(idx, tgt, value.m_status);
        } break;
        case DTYPE_DATE: {
            t_date tgt = value.get<t_date>();
            set_nth<t_date>(idx, tgt, value.m_status);
        } break;
        case DTYPE_STR: {
            COLUMN_CHECK_STRCOL();
            const char* tgt = value.get_char_ptr();
            std::string empty;

            if (tgt) {
                PSP_VERBOSE_ASSERT(
                    value.m_type == DTYPE_STR, "Setting non string scalar on string column");
                set_nth<const char*>(idx, tgt, value.m_status);
            } else {
                set_nth<const char*>(idx, empty.c_str(), value.m_status);
            }
        } break;
        case DTYPE_LIST_STR: {
            std::vector<std::string> tgt = value.get<std::vector<std::string>>();
            set_nth<std::vector<std::string>>(idx, tgt, value.m_status);
        } break;
        case DTYPE_LIST_BOOL: {
            std::vector<bool> tgt = value.get<std::vector<bool>>();
            set_nth<std::vector<bool>>(idx, tgt, value.m_status);
        } break;
        case DTYPE_LIST_FLOAT64: {
            std::vector<double> tgt = value.get<std::vector<double>>();
            set_nth<std::vector<double>>(idx, tgt, value.m_status);
        } break;
        case DTYPE_LIST_INT64: {
            std::vector<std::int64_t> tgt = value.get<std::vector<std::int64_t>>();
            set_nth<std::vector<std::int64_t>>(idx, tgt, value.m_status);
        } break;
        case DTYPE_LIST_DATE: {
            std::vector<t_date> tgt = value.get<std::vector<t_date>>();
            set_nth<std::vector<t_date>>(idx, tgt, value.m_status);
        } break;
        case DTYPE_LIST_TIME: {
            std::vector<t_time> tgt = value.get<std::vector<t_time>>();
            set_nth<std::vector<t_time>>(idx, tgt, value.m_status);
        } break;
        case DTYPE_LIST_DURATION: {
            std::vector<t_duration> tgt = value.get<std::vector<t_duration>>();
            set_nth<std::vector<t_duration>>(idx, tgt, value.m_status);
        } break;
        case DTYPE_DECIMAL: {
            t_decimal tgt = value.get<t_decimal>();
            set_nth<t_decimal>(idx, tgt, value.m_status);
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Unexpected type"); }
    }
}

bool
t_column::is_vlen() const {
    return is_vlen_dtype(m_dtype);
}

void
t_column::append(const t_column& other) {
    PSP_VERBOSE_ASSERT(m_dtype == other.m_dtype, "Mismatched dtypes detected");
    if (is_vlen()) {
        if (size() == 0) {

            m_data->fill(*other.m_data);

            if (other.is_status_enabled()) {
                m_status->fill(*other.m_status);
            }

            m_vocab->fill(*(other.m_vocab->get_vlendata()), *(other.m_vocab->get_extents()),
                other.m_vocab->get_vlenidx());

            set_size(other.size());
            m_vocab->rebuild_map();
        } else {
            for (t_uindex idx = 0, loop_end = other.size(); idx < loop_end; ++idx) {
                const char* s = other.get_nth<const char>(idx);
                push_back(s);
            }

            if (is_status_enabled()) {
                m_status->append(*other.m_status);
            }
        }
    } else {
        m_data->append(*other.m_data);

        if (is_status_enabled()) {
            m_status->append(*other.m_status);
        }
    }

    COLUMN_CHECK_VALUES();
}

void
t_column::clear() {
    m_data->set_size(0);
    if (m_dtype == DTYPE_STR)
        m_data->clear();
    if (is_status_enabled()) {
        m_status->clear();
    }
    m_errors.reset();
    m_size = 0;
}

void
t_column::pprint() const {
    for (t_uindex idx = 0, loop_end = size(); idx < loop_end; ++idx) {
        std::cout << idx << " => " << get_scalar(idx) << std::endl;
    }
}

t_column_recipe
t_column::get_recipe() const {
    t_column_recipe rval;
    rval.m_dtype = m_dtype;
    rval.m_data = m_data->get_recipe();
    rval.m_isvlen = is_vlen_dtype(m_dtype);

    if (rval.m_isvlen) {
        rval.m_vlendata = m_vocab->get_vlendata()->get_recipe();
        rval.m_extents = m_vocab->get_extents()->get_recipe();
    }

    rval.m_status_enabled = m_status_enabled;
    if (m_status_enabled) {
        rval.m_status = m_status->get_recipe();
    }

    rval.m_truncated = m_truncated;
    rval.m_vlenidx = m_vocab->get_vlenidx();
    rval.m_size = m_size;
    return rval;
}

void
t_column::copy_vocabulary(const t_column* other) {
#ifdef PSP_COLUMN_VERIFY
    other->verify();
#endif
    COLUMN_CHECK_STRCOL();
    m_vocab->copy_vocabulary(*(other->m_vocab.get()));
    COLUMN_CHECK_VALUES();
}

void
t_column::pprint_vocabulary() const {
    if (!is_vlen_dtype(m_dtype))
        return;
    m_vocab->pprint_vocabulary();
}

std::shared_ptr<t_column>
t_column::clone() const {
    auto rval = std::make_shared<t_column>(*this);
    rval->init();
    rval->set_size(size());
    rval->m_data->fill(*m_data);

    if (rval->is_status_enabled()) {
        rval->m_status->fill(*m_status);
    }

    rval->m_truncated = m_truncated;

    if (is_vlen_dtype(get_dtype())) {
        rval->m_vocab->clone(*m_vocab);
    }

    if (m_errors) {
        rval->m_errors = std::make_shared<std::map<t_uindex, t_cell_error>>(*m_errors);
    }
#ifdef PSP_COLUMN_VERIFY
    rval->verify();
#endif
    return rval;
}

std::shared_ptr<t_column>
t_column::clone(const t_mask& mask) const {
    if (mask.count() == size()) {
        return clone();
    }

    auto rval = std::make_shared<t_column>(*this);
    rval->init();
    rval->set_size(mask.size());

    rval->m_data->fill(*m_data, mask, get_dtype_size(get_dtype()));

    rval->m_truncated = m_truncated;

    if (rval->is_status_enabled()) {
        rval->m_status->fill(*m_status, mask, sizeof(t_status));
    }

    if (is_vlen_dtype(get_dtype())) {
        rval->m_vocab->clone(*m_vocab);
    }
#ifdef PSP_COLUMN_VERIFY
    rval->verify();
#endif
    return rval;
}

void
t_column::valid_raw_fill() {
    m_status->raw_fill(STATUS_VALID);
}

void
t_column::copy(const t_column* other, const std::vector<t_uindex>& indices, t_uindex offset) {
    PSP_VERBOSE_ASSERT(m_dtype == other->get_dtype(), "Cannot copy from diff dtype");

    switch (m_dtype) {
        case DTYPE_NONE: {
            return;
        }
        case DTYPE_INT64: {
            copy_helper<std::int64_t>(other, indices, offset);
        } break;
        case DTYPE_INT32: {
            copy_helper<std::int32_t>(other, indices, offset);
        } break;
        case DTYPE_INT16: {
            copy_helper<std::int16_t>(other, indices, offset);
        } break;
        case DTYPE_INT8: {
            copy_helper<std::int8_t>(other, indices, offset);
        } break;
        case DTYPE_UINT64: {
            copy_helper<std::uint64_t>(other, indices, offset);
        } break;
        case DTYPE_UINT32: {
            copy_helper<std::uint32_t>(other, indices, offset);
        } break;
        case DTYPE_UINT16: {
            copy_helper<std::uint16_t>(other, indices, offset);
        } break;
        case DTYPE_UINT8: {
            copy_helper<std::uint8_t>(other, indices, offset);
        } break;
        case DTYPE_FLOAT64: {
            copy_helper<double>(other, indices, offset);
        } break;
        case DTYPE_FLOAT32: {
            copy_helper<float>(other, indices, offset);
        } break;
        case DTYPE_BOOL: {
            copy_helper<std::uint8_t>(other, indices, offset);
        } break;
        case DTYPE_TIME: {
            copy_helper<double>(other, indices, offset);
        } break;
        case DTYPE_DURATION: {
            copy_helper<double>(other, indices, offset);
        } break;
        case DTYPE_DATE: {
            copy_helper<std::int32_t>(other, indices, offset);
        } break;
        case DTYPE_STR: {
            copy_helper<const char>(other, indices, offset);
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Unexpected type"); }
    }
}

template <>
void
t_column::copy_helper<const char>(
    const t_column* other, const std::vector<t_uindex>& indices, t_uindex offset) {
    t_uindex eidx = std::min(other->size(), static_cast<t_uindex>(indices.size()));
    reserve(eidx + offset);

    for (t_uindex idx = 0; idx < eidx; ++idx) {
        set_scalar(offset + idx, other->get_scalar(indices[idx]));
    }
    COLUMN_CHECK_VALUES();
}

template <>
void
t_column::fill(
    std::vector<const char*>& vec, const t_uindex* bidx, const t_uindex* eidx) const {

    PSP_VERBOSE_ASSERT(eidx - bidx > 0, "Invalid pointers passed in");

    for (t_uindex idx = 0, loop_end = eidx - bidx; idx < loop_end; ++idx)

    {
        vec[idx] = get_nth<const char>(*(bidx + idx));
    }
    COLUMN_CHECK_VALUES();
}

void
t_column::verify() const {
    if (is_vlen_dtype(m_dtype) && m_init) {
        m_vocab->verify();
    }

    verify_size();
}

void
t_column::verify_size(t_uindex idx) const {
    if (m_dtype == DTYPE_USER_FIXED)
        return;

    PSP_VERBOSE_ASSERT(idx * get_dtype_size(m_dtype) <= m_data->capacity(),
        "Not enough space reserved for column");

    PSP_VERBOSE_ASSERT(idx * get_dtype_size(m_dtype) <= m_data->capacity(),
        "Not enough space reserved for column");

    if (is_status_enabled()) {
        PSP_VERBOSE_ASSERT(idx * get_dtype_size(DTYPE_UINT8) <= m_status->capacity(),
            "Not enough space reserved for column");
    }

    if (is_vlen_dtype(m_dtype)) {
        m_vocab->verify_size();
    }
}

void
t_column::verify_size() const {
    verify_size(size());
}

const char*
t_column::unintern_c(t_uindex idx) const {
    return m_vocab->unintern_c(idx);
}

void
t_column::_rebuild_map() {
    m_vocab->rebuild_map();
}

void
t_column::borrow_vocabulary(const t_column& o) {
    m_vocab = const_cast<t_column&>(o).m_vocab;
}

std::vector<double>
t_column::get_column_binning_params() const {
    if (!m_meta) {
        return std::vector<double>();
    }
    auto& meta = *m_meta;
    auto type = get_dtype();
    double min, max, bin_size;
    double num_bin = std::ceil(std::sqrt(size()));
    if (type == DTYPE_FLOAT32 || type == DTYPE_FLOAT64 || type == DTYPE_LIST_FLOAT64) {
        min = std::floor(meta.min_double * 100) / 100;
        max = std::ceil(meta.max_double * 100) / 100;
        bin_size = std::floor((max - min)*100/num_bin) / 100;
    } else {
        min = std::floor(meta.min_double);
        max = std::ceil(meta.max_double);
        bin_size = std::floor((max - min)/num_bin);
    }
    // Check for case bin size is zero
    if (bin_size == 0.0) {
        bin_size = 10;
    }
    // Check for case max <= min;
    if (max <= min) {
        max = min + bin_size;
    }

    return std::vector<double>{min, max, bin_size};
}

t_warning_type
t_column::get_truncated() const {
    return m_truncated;
}

bool
t_column::is_truncated() const {
    return m_truncated != WARNING_TYPE_NONE;
}

void
t_column::update_metadata() {
    if (m_meta)
        return;
    m_meta.reset(new t_column_meta);
    auto& meta = *m_meta;

    const t_uindex n = size();
    int64_t tmp_integer = 0;
    double tmp_double = 0.0;
    for (t_uindex i = 0; i < n; ++i) {
        const t_tscalar& v = this->get_scalar(i);

        // is_integer
        const bool is_integer = get_integer(v, &tmp_integer);
        set_column_prop(meta.is_integer, is_integer, i == 0);
        if (is_integer) {
            if (tmp_integer < meta.min_double)
                meta.min_double = tmp_integer;
            if (tmp_integer > meta.max_double)
                meta.max_double = tmp_integer;
        }

        // is_unsigned
        const bool is_unsigned = is_integer && tmp_integer >= 0;
        set_column_prop(meta.is_unsigned, is_unsigned, i == 0);

        // is_double
        const bool is_double = get_double(v, &tmp_double);
        set_column_prop(meta.is_double, is_double, i == 0);
        if (is_double) {
            if (tmp_double < meta.min_double)
                meta.min_double = tmp_double;
            if (tmp_double > meta.max_double)
                meta.max_double = tmp_double;
        }

		// is_date
        bool is_date = false;
        if (v.is_str()) {
			t_date _;
			is_date = t_date::from_string(v.get_char_ptr(), _);
        } else if (v.get_dtype() == t_dtype::DTYPE_DATE) {
            is_date = true;
		}
        set_column_prop(meta.is_date, is_date, i == 0);

        // contains_multiple_words
        bool contains_multiple_words = false;
        auto type = v.get_dtype();
        if (type == t_dtype::DTYPE_STR) {
            auto p = v.get_char_ptr();
            auto len = strlen(p);
            for (size_t j = 0; j < len; ++j) {
                if (isspace(p[j])) {
                    contains_multiple_words = true;
                    break;
                }
            }
        } else if (type == t_dtype::DTYPE_LIST_STR) {
            if (v.m_list_size > 1) {
                contains_multiple_words = true;
            } else {
                auto str = v.to_search_string();
                for (auto ch : str) {
                    if (isspace(ch)) {
                        contains_multiple_words = true;
                        break;
                    }
                }
            }
        } else if (type == t_dtype::DTYPE_LIST_FLOAT64 || type == t_dtype::DTYPE_LIST_INT64) {
            contains_multiple_words = v.m_list_size > 1;
            if (v.is_valid() && !v.is_error() && !v.is_none()) {
                std::vector<double> list_num;
                if (type == t_dtype::DTYPE_LIST_INT64) {
                    auto list_int64 = v.get<std::vector<int64_t>>();
                    list_num = std::vector<double>(list_int64.begin(), list_int64.end());
                } else {
                    list_num = v.get<std::vector<double>>();
                }
                for (auto &num : list_num) {
                    tmp_double = num;
                    if (tmp_double < meta.min_double)
                        meta.min_double = tmp_double;
                    if (tmp_double > meta.max_double)
                        meta.max_double = tmp_double;
                }
            }
        } else if (type == t_dtype::DTYPE_LIST_DATE || type == t_dtype::DTYPE_LIST_TIME) {
            contains_multiple_words = v.m_list_size > 1;
            if (v.is_valid() && !v.is_error() && !v.is_none() && v.m_list_size > 0) {
                std::vector<t_tscalar> value_vec;
                if (type == t_dtype::DTYPE_LIST_DATE) {
                    auto list_date = v.get<std::vector<t_date>>();
                    for (auto &date : list_date) {
                        value_vec.push_back(mktscalar(date));
                    }
                } else {
                    auto list_time = v.get<std::vector<t_time>>();
                    for (auto &time : list_time) {
                        value_vec.push_back(mktscalar(time));
                    }
                }
                for (auto &sca : value_vec) {
                    tmp_double = sca.to_agg_level_number(AGG_LEVEL_YEAR);
                    if (tmp_double < meta.min_double)
                        meta.min_double = tmp_double;
                    if (tmp_double > meta.max_double)
                        meta.max_double = tmp_double;
                }
            }
        } else if (is_dtype_list(type)) {
            contains_multiple_words = v.m_list_size > 1;
        } else if (type == t_dtype::DTYPE_DATE || type == t_dtype::DTYPE_TIME) {
            if (v.is_valid() && !v.is_error() && !v.is_none()) {
                double tmp_double = v.to_agg_level_number(AGG_LEVEL_YEAR);
                if (tmp_double < meta.min_double)
                    meta.min_double = tmp_double;
                if (tmp_double > meta.max_double)
                    meta.max_double = tmp_double;
            }
        }
        set_column_prop(meta.contains_multiple_words, contains_multiple_words, i == 0);

        // contains_digits
        bool contains_digits = is_double;
        if (!contains_digits) {
            if (type == t_dtype::DTYPE_STR) {
                auto p = v.get_char_ptr();
                auto len = strlen(p);
                for (size_t i = 0; i < len; ++i) {
                    if (isdigit(p[i])) {
                        contains_digits = true;
                        break;
                    }
                }
            } else if (v.is_numeric() || type == t_dtype::DTYPE_DATE
                || type == t_dtype::DTYPE_DECIMAL || type == t_dtype::DTYPE_DURATION
                || type == t_dtype::DTYPE_TIME) {
                contains_digits = true;
            } else if (type == t_dtype::DTYPE_LIST_INT64 || type == t_dtype::DTYPE_LIST_FLOAT64
                || type == t_dtype::DTYPE_LIST_TIME) {
                contains_digits = v.m_list_size > 0;
            }
        }
        set_column_prop(meta.contains_digits, contains_digits, i == 0);

        if (v.is_str()) {
            const auto p = v.get_char_ptr();
            const auto len = strlen(p);

            // max_length/min_length
            if (meta.max_length) {
                if ((int64_t)len > *meta.max_length)
                    *meta.max_length = len;
            }
            if (meta.min_length) {
                if (len < *meta.min_length)
                    *meta.min_length = len;
            }

            // has_word_starts_with
            if (!contains_multiple_words) {
                if (p[0])
                    meta.has_word_starts_with[tolower(p[0])] = true;
            } else {
                for (size_t j = 0; j < len; ++j) {
                    if (j == 0 || isspace(p[j - 1])) {
                        char ch = p[j];
                        meta.has_word_starts_with[tolower(ch)] = true;
                    }
                }
            }
        } else {
            meta.max_length.reset();
            meta.min_length.reset();
        }
    }

    if (meta.is_integer == t_column_prop::MIXED)
        meta.is_unsigned = t_column_prop::MIXED;

    /*int64_t base = 1;
    for (size_t i = 0; i < size(); ++i) {
        const t_tscalar& v = this->get_scalar(i);
        m_meta.num_meta_updates++;

        bool is_int = true;
        int64_t int_val = -1;
        auto t = v.get_dtype();
        if (t != t_dtype::DTYPE_INT8 && t != t_dtype::DTYPE_INT16 && t != t_dtype::DTYPE_INT32
            && t != t_dtype::DTYPE_INT64 && t != t_dtype::DTYPE_UINT8
            && t != t_dtype::DTYPE_UINT16 && t != t_dtype::DTYPE_UINT32
            && t != t_dtype::DTYPE_UINT64) {
            if (t == t_dtype::DTYPE_STR) {
                auto ll = std::atoll(v.get_char_ptr());
                if (std::to_string(ll) != v.get_char_ptr()) {
                    is_int = false;
                } else {
                    int_val = ll;
                }
            } else {
                is_int = false;
            }
        } else {
            int_val = v.to_int64();
        }

        if (i != 0 && base + 1 != int_val) {
            m_meta.ordinal = 0;
        }

        base = int_val;

        bool is_double = false;
        double double_val = -1;
        if (!is_int && t != t_dtype::DTYPE_FLOAT32 && t != t_dtype::DTYPE_FLOAT64) {
            if (t == t_dtype::DTYPE_STR) {
                char* end = 0;
                auto s = v.get_char_ptr();
                double_val = strtod(s, &end);
                is_double = end != s && double_val != HUGE_VAL;
            } else {
                is_double = false;
            }
        } else if (is_int) {
            double_val = int_val;
            is_double = true;
        } else if (t == t_dtype::DTYPE_FLOAT32 || t == t_dtype::DTYPE_FLOAT64) {
            double_val = v.to_double();
            is_double = true;
        }

        if (m_meta.all_int && !is_int) {
            m_meta.all_int = false;
        }
        if (m_meta.all_non_int && is_int) {
            m_meta.all_non_int = false;
        }
        if (m_meta.all_double && !is_double) {
            m_meta.all_double = false;
        }
        if (m_meta.all_non_double && is_double) {
            m_meta.all_non_double = false;
        }

        if (is_double) {
            if (double_val < m_meta.min_number)
                m_meta.min_number = double_val;
            if (double_val > m_meta.max_number)
                m_meta.max_number = double_val;
        }

        if (m_meta.all_digits) {
            if (!is_int || (is_double && !is_int))
                m_meta.all_digits = false;
        }
        if (m_meta.no_digits) {
            if (is_double || is_int)
                m_meta.no_digits = false;
            else if (v.is_str()) {
                bool has_digit = false;
                auto str = v.get_char_ptr();
                int len = (int)strlen(str);
                for (int i = 0; i < len; ++i) {
                    if (isdigit(str[i])) {
                        has_digit = true;
                        break;
                    }
                }
                if (has_digit)
                    m_meta.no_digits = false;
            } else {
                m_meta.no_digits = false;
            }
        }
        //m_meta.all_digits = m_meta.all_digits
        //    && (is_int || v.to_string().find_first_not_of("0123456789") == std::string::npos);
        //m_meta.no_digits = m_meta.no_digits
        //   && (!is_int && v.to_string().find_first_of("0123456789") == std::string::npos);

        // const size_t this_length = v.is_str() ? strlen(v.get_char_ptr()) :
        // v.to_string().size(); if (this_length < m_meta.min_str_length)
        //    m_meta.min_str_length = this_length;
        // if (this_length > m_meta.max_str_length)
        //    m_meta.max_str_length = this_length;
    }*/
}

#ifdef PSP_ENABLE_PYTHON
np::ndarray
t_column::_as_numpy() {
    if (is_vlen_dtype(m_dtype))
        return m_data->_as_numpy(DTYPE_UINT64);
    return m_data->_as_numpy(m_dtype);
}
#endif

} // end namespace perspective
