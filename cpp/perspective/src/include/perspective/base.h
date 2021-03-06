/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#pragma once
#ifdef WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#endif
#include <perspective/first.h>
#include <perspective/raw_types.h>
#include <perspective/exports.h>
#include <sstream>
#include <csignal>
#include <iostream>
#include <cstring>
#include <cstdint>
#include <memory>
#include <functional>
#include <algorithm>
#include <iomanip>
#include <chrono>
#include <fstream>
#include <perspective/portable.h>
#include <boost/functional/hash.hpp>

namespace perspective {

const std::int32_t PSP_VERSION = 67;
#ifdef PSP_WASM
const double PSP_TABLE_GROW_RATIO = 1.3;
#else
const double PSP_TABLE_GROW_RATIO = 1.2;
#endif

const std::int32_t PSP_MAXIMUM_TRUNCATE_STR = 450;

#ifdef WIN32
#define PSP_RESTRICT __restrict
#define PSP_THR_LOCAL __declspec(thread)
#else
#define PSP_RESTRICT __restrict__
#define PSP_THR_LOCAL __thread
#endif

#define PSP_PFOR tbb::parallel_for

const t_index INVALID_INDEX = -1;
const std::string ERROR_COLUMN = "__error__";
const std::string COMBINED_NAME = "__values__";
const std::string BINNING_OTHER_TEXT = "Other/Blank";
const std::string GROUP_FILTER_NAME = "__GROUP_FILTER__";

#ifdef PSP_PARALLEL_FOR
#define PSP_PSORT tbb::parallel_sort
#else
#define PSP_PSORT std::sort
#endif
#define DEFAULT_CAPACITY 4000
#define DEFAULT_CHUNK_SIZE 4000
#define DEFAULT_EMPTY_CAPACITY 8
#define ROOT_AGGIDX 0
#ifndef CHAR_BIT
#define CHAR_BIT 8
#endif

PERSPECTIVE_EXPORT void psp_abort();

//#define PSP_TRACE_SENTINEL() t_trace _psp_trace_sentinel;
#define PSP_TRACE_SENTINEL()
#define _ID(x)                                                                                 \
    x // https://stackoverflow.com/questions/25144589/c-macro-overloading-is-not-working
#define GET_PSP_VERBOSE_ASSERT(_1, _2, _3, NAME, ...) NAME

#ifdef PSP_DEBUG
#define PSP_VERBOSE_ASSERT1(COND, MSG)                                                         \
    {                                                                                          \
        if (!(COND)) {                                                                         \
            std::stringstream ss;                                                              \
            ss << __FILE__ << ":" << __LINE__ << ": " << MSG << " : "                          \
               << perspective::get_error_str();                                                \
            perror(ss.str().c_str());                                                          \
            psp_abort();                                                                       \
        }                                                                                      \
    }

#define PSP_VERBOSE_ASSERT2(COND, EXPR, MSG)                                                   \
    {                                                                                          \
        if (!(COND EXPR)) {                                                                    \
            std::stringstream ss;                                                              \
            ss << __FILE__ << ":" << __LINE__ << ": " << MSG << " : "                          \
               << perspective::get_error_str();                                                \
            perror(ss.str().c_str());                                                          \
            psp_abort();                                                                       \
        }                                                                                      \
    }

#define PSP_COMPLAIN_AND_ABORT(X)                                                              \
    {                                                                                          \
        std::stringstream ss;                                                                  \
        ss << __FILE__ << ":" << __LINE__ << ": " << X;                                        \
        perror(ss.str().c_str());                                                              \
        psp_abort();                                                                           \
    }

#define PSP_ASSERT_SIMPLE_TYPE(X)                                                              \
static_assert(                                               \
std::is_pod<X>::value && std::is_standard_layout<X>::value , \
" Unsuitable type found. "

//#define LOG_LIFETIMES 1

#ifdef LOG_LIFETIMES
#define LOG_CONSTRUCTOR(X)                                                                     \
    std::cout << "constructing L: " << __LINE__ << " " << (X) << " <" << this << ">"           \
              << std::endl;

#define LOG_DESTRUCTOR(X)                                                                      \
    std::cout << "destroying L: " << __LINE__ << " " << (X) << " <" << this << ">" << std::endl;

#define LOG_INIT(X)                                                                            \
    std::cout << "initing L: " << __LINE__ << " " << (X) << " <" << this << ">" << std::endl;
#else
#define LOG_CONSTRUCTOR(X)
#define LOG_DESTRUCTOR(X)
#define LOG_INIT(X)
#endif
#else
#define PSP_VERBOSE_ASSERT1(COND, MSG)                                                         \
    {                                                                                          \
        if (!(COND))                                                                           \
            psp_abort();                                                                       \
    }
#define PSP_VERBOSE_ASSERT2(EXPR, COND, MSG)                                                   \
    {                                                                                          \
        if (!(EXPR COND))                                                                      \
            psp_abort();                                                                       \
    }
#define PSP_COMPLAIN_AND_ABORT(X) psp_abort();
#define PSP_ASSERT_SIMPLE_TYPE(X)
#define LOG_CONSTRUCTOR(X)
#define LOG_DESTRUCTOR(X)
#define LOG_INIT(X)
#endif

#define PSP_VERBOSE_ASSERT(...)                                                                \
    _ID(GET_PSP_VERBOSE_ASSERT(__VA_ARGS__, PSP_VERBOSE_ASSERT2, PSP_VERBOSE_ASSERT1)(         \
        __VA_ARGS__))

// Currently only supporting single ports
enum t_gnode_processing_mode { NODE_PROCESSING_SIMPLE_DATAFLOW, NODE_PROCESSING_KERNEL };

enum t_pivot_mode {
    PIVOT_MODE_NORMAL,
    PIVOT_MODE_KERNEL,
    PIVOT_MODE_CONCATENATE,
    PIVOT_MODE_TIME_BUCKET_MIN,
    PIVOT_MODE_TIME_BUCKET_HOUR,
    PIVOT_MODE_TIME_BUCKET_DAY,
    PIVOT_MODE_TIME_BUCKET_WEEK,
    PIVOT_MODE_TIME_BUCKET_MONTH,
    PIVOT_MODE_TIME_BUCKET_YEAR
};

enum t_select_mode {
    SELECT_MODE_ALL,
    SELECT_MODE_RANGE,
    SELECT_MODE_MASK,
    SELECT_MODE_PKEY,
    SELECT_MODE_KERNEL
};

enum t_backing_store { BACKING_STORE_MEMORY, BACKING_STORE_DISK };

enum t_filter_op {
    FILTER_OP_LT,
    FILTER_OP_LTEQ,
    FILTER_OP_GT,
    FILTER_OP_GTEQ,
    FILTER_OP_EQ,
    FILTER_OP_NE,
    FILTER_OP_BEGINS_WITH,
    FILTER_OP_ENDS_WITH,
    FILTER_OP_CONTAINS,
    FILTER_OP_OR,
    FILTER_OP_IN,
    FILTER_OP_NOT_IN,
    FILTER_OP_AND,
    FILTER_OP_IS_NAN,
    FILTER_OP_IS_NOT_NAN,
    FILTER_OP_IS_VALID,
    FILTER_OP_IS_NOT_VALID,
    FILTER_OP_IS_EMPTY,
    FILTER_OP_IS_NOT_EMPTY,
    FILTER_OP_IS_TRUE,
    FILTER_OP_IS_FALSE,
    FILTER_OP_NOT_CONTAIN,
    FILTER_OP_AFTER,
    FILTER_OP_BEFORE,
    FILTER_OP_BETWEEN,
    FILTER_OP_LAST_7_DAYS,
    FILTER_OP_LAST_10_DAYS,
    FILTER_OP_LAST_30_DAYS,
    FILTER_OP_TODAY,
    FILTER_OP_YESTERDAY,
    FILTER_OP_THIS_WEEK,
    FILTER_OP_LAST_WEEK,
    FILTER_OP_THIS_MONTH,
    FILTER_OP_LAST_MONTH,
    FILTER_OP_THIS_QUARTER,
    FILTER_OP_LAST_QUARTER,
    FILTER_OP_THIS_YEAR,
    FILTER_OP_LAST_YEAR,
    FILTER_OP_YEAR_TO_DATE,
    FILTER_OP_ALL_DATE_RANGE,
    FILTER_OP_IN_ANY,
    FILTER_OP_IN_ALL,
    FILTER_OP_IGNORE_ALL,
    FILTER_OP_RELATIVE_DATE,
    FILTER_OP_TOP_N,
    FILTER_OP_ELE_EQ,
    FILTER_OP_ELE_NE,
    FILTER_OP_ELE_CONTAINS,
    FILTER_OP_ELE_NOT_CONTAINS,
    FILTER_OP_ELE_BEGINS_WITH,
    FILTER_OP_ELE_ENDS_WITH,
    FILTER_OP_ELE_IN_ANY,
    FILTER_OP_ELE_NOT_IN_ANY,
    FILTER_OP_ELE_IS_TRUE,
    FILTER_OP_ELE_IS_FALSE,
    FILTER_OP_ELE_GT,
    FILTER_OP_ELE_GTEQ,
    FILTER_OP_ELE_LT,
    FILTER_OP_ELE_LTEQ,
    FILTER_OP_ELE_BEFORE,
    FILTER_OP_ELE_AFTER,
    FILTER_OP_ELE_BETWEEN,
    FILTER_OP_GROUP_FILTER
};

PERSPECTIVE_EXPORT std::string filter_op_to_str(t_filter_op op);
PERSPECTIVE_EXPORT t_filter_op str_to_filter_op(const std::string& str);

enum t_computed_function_name {
    INVALID_COMPUTED_FUNCTION,
    ADD,
    SUBTRACT,
    MULTIPLY,
    DIVIDE,
    PERCENT_OF,
    POW,
    EQUALS,
    NOT_EQUALS,
    GREATER_THAN,
    LESS_THAN,
    INVERT,
    POW2,
    SQRT,
    ABS,
    LOG,
    EXP,
    UPPERCASE,
    LOWERCASE,
    LENGTH,
    IS,
    CONCAT_SPACE,
    CONCAT_COMMA,
    BUCKET_10,
    BUCKET_100,
    BUCKET_1000,
    BUCKET_0_1,
    BUCKET_0_0_1,
    BUCKET_0_0_0_1,
    HOUR_OF_DAY,
    DAY_OF_WEEK,
    MONTH_OF_YEAR,
    SECOND_BUCKET,
    MINUTE_BUCKET,
    HOUR_BUCKET,
    DAY_BUCKET,
    WEEK_BUCKET,
    MONTH_BUCKET,
    YEAR_BUCKET
};

PERSPECTIVE_EXPORT 
t_computed_function_name str_to_computed_function_name(const std::string& name);
PERSPECTIVE_EXPORT
std::string computed_function_name_to_string(t_computed_function_name name);

enum t_header { HEADER_ROW, HEADER_COLUMN };

enum t_sorttype {
    SORTTYPE_ASCENDING,
    SORTTYPE_DESCENDING,
    SORTTYPE_NONE,
    SORTTYPE_ASCENDING_ABS,
    SORTTYPE_DESCENDING_ABS
};

PERSPECTIVE_EXPORT t_sorttype str_to_sorttype(const std::string& str);
PERSPECTIVE_EXPORT std::string sorttype_to_str(t_sorttype type);

enum t_aggtype {
    AGGTYPE_SUM,
    AGGTYPE_MUL,
    AGGTYPE_COUNT,
    AGGTYPE_MEAN,
    AGGTYPE_WEIGHTED_MEAN,
    AGGTYPE_UNIQUE,
    AGGTYPE_ANY,
    AGGTYPE_MEDIAN,
    AGGTYPE_JOIN,
    AGGTYPE_SCALED_DIV,
    AGGTYPE_SCALED_ADD,
    AGGTYPE_SCALED_MUL,
    AGGTYPE_DOMINANT,
    AGGTYPE_FIRST,
    AGGTYPE_LAST,
    AGGTYPE_PY_AGG,
    AGGTYPE_AND,
    AGGTYPE_OR,
    AGGTYPE_LAST_VALUE,
    AGGTYPE_HIGH_WATER_MARK,
    AGGTYPE_LOW_WATER_MARK,
    AGGTYPE_UDF_COMBINER,
    AGGTYPE_UDF_REDUCER,
    AGGTYPE_SUM_ABS,
    AGGTYPE_SUM_NOT_NULL,
    AGGTYPE_MEAN_BY_COUNT,
    AGGTYPE_IDENTITY,
    AGGTYPE_DISTINCT_COUNT,
    AGGTYPE_DISTINCT_LEAF,
    AGGTYPE_PCT_SUM_PARENT,
    AGGTYPE_PCT_SUM_GRAND_TOTAL,
    AGGTYPE_CUSTOM,
    AGGTYPE_DISTINCT_VALUES
};

PERSPECTIVE_EXPORT t_aggtype str_to_aggtype(const std::string& str);

enum t_searchtype {
    SEARCHTYPE_NULL,
    SEARCHTYPE_EQUALS,
    SEARCHTYPE_STARTS_WITH,
    SEARCHTYPE_EDGE,
    SEARCHTYPE_CONTAINS
};

PERSPECTIVE_EXPORT t_searchtype str_to_searchtype(const std::string& str);

enum t_dataformattype {
    DATA_FORMAT_NONE,
    DATA_FORMAT_TEXT,
    DATA_FORMAT_YES_NO,
    DATA_FORMAT_TRUE_FALSE,
    DATA_FORMAT_NUMBER,
    DATA_FORMAT_FINANCIAL,
    DATA_FORMAT_DATE_V1,
    DATA_FORMAT_DATE_V2,
    DATA_FORMAT_DATE_V3,
    DATA_FORMAT_DURATION,
    DATA_FORMAT_TIME,
    DATA_FORMAT_DATETIME,
    DATA_FORMAT_PERCENT,
    DATA_FORMAT_QUARTER,
    DATA_FORMAT_WEEK,
    DATA_FORMAT_MONTH,
    DATA_FORMAT_DAY_V1,
    DATA_FORMAT_DAY_V2,
    DATA_FORMAT_DAY_V3
};

PERSPECTIVE_EXPORT t_dataformattype str_to_data_format_type(const std::string& str);

enum t_computed_param_type {
    COMPUTED_PARAM_NONE,
    COMPUTED_PARAM_COLNAME,
    COMPUTED_PARAM_SUB_FORMULA
};

PERSPECTIVE_EXPORT t_computed_param_type str_to_computed_param_type(const std::string& str);

enum t_formula_op_type {
    FORMULA_OP_NONE,
    FORMULA_OP_COPY
};

PERSPECTIVE_EXPORT t_formula_op_type str_to_formula_op_type(const std::string& str);

enum t_agg_level_type {
    AGG_LEVEL_NONE,
    AGG_LEVEL_YEAR,
    AGG_LEVEL_QUARTER,
    AGG_LEVEL_MONTH,
    AGG_LEVEL_WEEK,
    AGG_LEVEL_DAY,
    AGG_LEVEL_HOUR,
    AGG_LEVEL_MINUTE,
    AGG_LEVEL_SECOND,
    AGG_LEVEL_DATE
};

PERSPECTIVE_EXPORT t_agg_level_type str_to_agg_level_type(const std::string& str);

enum t_pivot_type {
    PIVOT_TYPE_NONE,
    PIVOT_TYPE_ROW,
    PIVOT_TYPE_COLUMN
};

PERSPECTIVE_EXPORT t_pivot_type str_to_pivot_type(const std::string& str);

enum t_binning_type {
    BINNING_TYPE_NONE,
    BINNING_TYPE_AUTO,
    BINNING_TYPE_CUSTOM
};

PERSPECTIVE_EXPORT t_binning_type str_to_binning_type(const std::string& str);

enum t_query_percent_type {
    QUERY_PERCENT_NONE,
    QUERY_PERCENT_NOTIFY,
    QUERY_PERCENT_TRAVERSAL_STEP_END,
    QUERY_PERCENT_CTX_STEP_END,
    QUERY_PERCENT_FILTER,
    QUERY_PERCENT_SEARCH,
    QUERY_PERCENT_CHECK_PIVOT,
    QUERY_PERCENT_UPDATE_SHAPE,
    QUERY_PERCENT_UPDATE_AGG
};

enum t_combined_mode {
    COMBINED_MODE_COLUMN,
    COMBINED_MODE_ROW
};

PERSPECTIVE_EXPORT t_combined_mode str_to_combined_mode(const std::string& str);

enum t_error_code {
    NULL_ERROR = 0,
    TYPE_ERROR = 1
};

PERSPECTIVE_EXPORT t_error_code num_to_error_code(t_index num);

enum t_pivot_view_mode {
    PIVOT_VIEW_MODE_NESTED,
    PIVOT_VIEW_MODE_FLAT
};

PERSPECTIVE_EXPORT t_pivot_view_mode num_to_pivot_view_mode(t_index idx);

enum t_limit_type {
    LIMIT_TYPE_ITEMS,
    LIMIT_TYPE_PECENT
};

PERSPECTIVE_EXPORT t_limit_type str_to_limit_type(const std::string& str);

enum t_show_type {
    SHOW_TYPE_DEFAULT,
    SHOW_TYPE_ROW,
    SHOW_TYPE_COLUMN,
    SHOW_TYPE_PARENT_ROW,
    SHOW_TYPE_PARENT_COLUMN,
    SHOW_TYPE_GRAND_TOTAL,
    SHOW_TYPE_DIFF_PREVIOUS_VALUE,
    SHOW_TYPE_PERCENT_PREVIOUS_VALUE,
    SHOW_TYPE_RUNNING_TOTAL,
    SHOW_TYPE_RUNNING_PERCENT
};

PERSPECTIVE_EXPORT t_show_type str_to_show_type(const std::string& str);

enum t_filter_previous {
    FILTER_PREVIOUS_NO,
    FILTER_PREVIOUS_YES
};

PERSPECTIVE_EXPORT t_filter_previous str_to_filter_previous(const std::string& str);

enum t_filter_period {
    FILTER_PERIOD_NONE,
    FILTER_PERIOD_PREVIOUS,
    FILTER_PERIOD_THIS,
    FILTER_PERIOD_NEXT
};

PERSPECTIVE_EXPORT t_filter_period str_to_filter_period(const std::string& str);

enum t_filter_date_unit {
    FILTER_DATE_UNIT_NONE,
    FILTER_DATE_UNIT_DAY,
    FILTER_DATE_UNIT_WEEK,
    FILTER_DATE_UNIT_MONTH,
    FILTER_DATE_UNIT_QUARTER,
    FILTER_DATE_UNIT_YEAR
};

PERSPECTIVE_EXPORT t_filter_date_unit str_to_filter_date_unit(const std::string& str);

enum t_period_type {
    PERIOD_TYPE_NONE,
    PERIOD_TYPE_PREVIOUS
};

PERSPECTIVE_EXPORT t_period_type str_to_period_type(const std::string& str);

enum t_totals { TOTALS_BEFORE, TOTALS_HIDDEN, TOTALS_AFTER };

enum t_ctx_type {
    ZERO_SIDED_CONTEXT,
    ONE_SIDED_CONTEXT,
    TWO_SIDED_CONTEXT,
    GROUPED_ZERO_SIDED_CONTEXT,
    GROUPED_PKEY_CONTEXT,
    GROUPED_COLUMNS_CONTEXT
};

enum t_op { OP_INSERT, OP_DELETE, OP_CLEAR };

enum t_value_transition {
    VALUE_TRANSITION_EQ_FF,
    // VALUE_TRANSITION_EQ_FT nonsensical
    // VALUE_TRANSITION_EQ_TF nonsensical
    VALUE_TRANSITION_EQ_TT,
    // VALUE_TRANSITION_NEQ_FF nonsensical
    VALUE_TRANSITION_NEQ_FT,
    VALUE_TRANSITION_NEQ_TF,
    VALUE_TRANSITION_NEQ_TT,
    // VALUE_TRANSITION_EQ_FDF, nonsensical
    // VALUE_TRANSITION_EQ_FDT, nonsensical
    // VALUE_TRANSITION_EQ_TDF, nonsensical
    // VALUE_TRANSITION_EQ_TDT, nonsensical
    // VALUE_TRANSITION_NEQ_FDF, nonsensical
    // VALUE_TRANSITION_NEQ_FDT, nonsensical
    VALUE_TRANSITION_NEQ_TDF,
    VALUE_TRANSITION_NEQ_TDT,
    VALUE_TRANSITION_NVEQ_FT
};

enum t_gnode_type {
    GNODE_TYPE_PKEYED,         // Explicit user set pkey
    GNODE_TYPE_IMPLICIT_PKEYED // pkey is row based
};

enum t_gnode_port {
    PSP_PORT_FLATTENED,   // same schema as iport (pkey,op)
    PSP_PORT_DELTA,       // same schema as state
    PSP_PORT_PREV,        // same schema as state
    PSP_PORT_CURRENT,     // same schema as state
    PSP_PORT_TRANSITIONS, // same schema as state
    PSP_PORT_EXISTED      // same schema as state
};

enum t_ctx_feature {
    CTX_FEAT_PROCESS,
    CTX_FEAT_MINMAX,
    CTX_FEAT_DELTA,
    CTX_FEAT_ALERT,
    CTX_FEAT_ENABLED,
    CTX_FEAT_LAST_FEATURE
};

enum t_deptype { DEPTYPE_COLUMN, DEPTYPE_AGG, DEPTYPE_SCALAR };

enum t_cmp_op {
    CMP_OP_LT,
    CMP_OP_LTEQ,
    CMP_OP_GT,
    CMP_OP_GTEQ,
    CMP_OP_EQ,
    CMP_OP_NE,
    CMP_OP_BEGINS_WITH,
    CMP_OP_ENDS_WITH,
    CMP_OP_CONTAINS,
    CMP_OP_OR,
    CMP_OP_IN,
    CMP_OP_AND
};

enum t_invmode {
    INV_SUBST_CANONICAL, // Substitute canonical data with canonical
                         // forms
    INV_EXCLUDE,         // Exclude invalid data from calculations
    INV_PROPAGATE        // Propagate invalid virally
};

enum t_range_mode {
    RANGE_ROW,
    RANGE_ROW_COLUMN,
    RANGE_ROW_PATH,
    RANGE_ROW_COLUMN_PATH,
    RANGE_ALL,
    RANGE_EXPR
};

enum t_fetch {
    FETCH_RANGE,
    FETCH_ROW_PATHS,
    FETCH_COLUMN_PATHS,
    FETCH_ROW_INDICES,
    FETCH_COLUMN_INDICES,
    FETCH_ROW_DATA_SLICE,
    FETCH_COLUMN_DATA_SLICE,
    FETCH_STYLE_SLICE,
    FETCH_USER_DATA_SLICE,
    FETCH_ROW_DEPTH,
    FETCH_COLUMN_DEPTH,
    FETCH_IS_ROW_EXPANDED,
    FETCH_IS_COLUMN_EXPANDED,
    FETCH_IS_ROOT,
    FETCH_COLUMN_NAMES,
    FETCH_CONFIG
};

enum t_fmode { FMODE_SIMPLE_CLAUSES, FMODE_JIT_EXPR };

enum t_warning_type {
    WARNING_TYPE_NONE,
    WARNING_TYPE_LIMITED_VALUES,
    WARNING_TYPE_LIMITED_SIZE,
    WARNING_TYPE_LIMITED_BOTH
};

#ifdef WIN32
#define PSP_NON_COPYABLE(X)
#else
#define PSP_NON_COPYABLE(X)                                                                    \
    X(const X&) = delete;                                                                      \
    X& operator=(const X&) = delete
#endif

PERSPECTIVE_EXPORT std::string get_error_str();
PERSPECTIVE_EXPORT bool is_numeric_type(t_dtype dtype);
PERSPECTIVE_EXPORT bool is_floating_point(t_dtype dtype);
PERSPECTIVE_EXPORT bool is_linear_order_type(t_dtype dtype);
PERSPECTIVE_EXPORT std::string get_dtype_descr(t_dtype dtype);
PERSPECTIVE_EXPORT std::string dtype_to_str(t_dtype dtype);
PERSPECTIVE_EXPORT std::string get_status_descr(t_status dtype);
PERSPECTIVE_EXPORT t_uindex get_dtype_size(t_dtype dtype);
PERSPECTIVE_EXPORT bool is_vlen_dtype(t_dtype dtype);
PERSPECTIVE_EXPORT bool is_neq_transition(t_value_transition t);
PERSPECTIVE_EXPORT t_dtype list_type_to_dtype(t_dtype type);

template <typename T>
inline std::ostream&
operator<<(std::ostream& os, const std::vector<T>& row) {
    for (int i = 0, loop_end = row.size(); i < loop_end; ++i) {
        os << row[i] << ", ";
    }

    return os;
}

template <typename FIRST_T, typename SECOND_T>
inline std::ostream&
operator<<(std::ostream& os, const std::pair<FIRST_T, SECOND_T>& p) {
    os << "<" << p.first << ", " << p.second << ">";
    return os;
}

void check_init(bool init, const char* file, std::int32_t line);

t_uindex root_pidx();

struct PERSPECTIVE_EXPORT t_cmp_charptr {
    bool
    operator()(const char* a, const char* b) const {
        return std::strcmp(a, b) < 0;
    }
};

struct t_cchar_umap_cmp : public std::binary_function<const char*, const char*, bool> {
    inline bool
    operator()(const char* x, const char* y) const {
        return strcmp(x, y) == 0;
    }
};

struct t_cchar_umap_hash {
    inline t_uindex
    operator()(const char* s) const {
        return boost::hash_range(s, s + std::strlen(s));
    }
};

bool is_internal_colname(const std::string& c);

bool is_deterministic_sized(t_dtype dtype);

template <typename DATA_T>
std::string
psp_to_str(const DATA_T& s) {
    std::stringstream ss;
    ss << s;
    return ss.str();
}

template <typename T>
PERSPECTIVE_EXPORT t_dtype type_to_dtype();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<std::int64_t>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<std::int32_t>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<std::int16_t>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<std::int8_t>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<std::uint64_t>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<std::uint32_t>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<std::uint16_t>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<std::uint8_t>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<double>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<float>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<bool>();

class t_date;
class t_time;
class t_duration;
class t_decimal;

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<t_time>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<t_duration>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<t_date>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<t_decimal>();

template <>
PERSPECTIVE_EXPORT t_dtype type_to_dtype<std::string>();

PERSPECTIVE_EXPORT t_dtype dtype_from_dtype_and_agg_level(t_dtype dtype, t_agg_level_type agg_level);

PERSPECTIVE_EXPORT t_dataformattype dftype_from_dftype_and_agg_level(t_dataformattype dftype, t_agg_level_type agg_level);

struct PERSPECTIVE_EXPORT t_binning_info {
    t_binning_type type;
    double size;
    double min;
    double max;
    bool is_double;
};

struct PERSPECTIVE_EXPORT t_selection_info {
    t_index start_row;
    t_index end_row;
    t_index start_col;
    t_index end_col;
    std::map<t_uindex, t_uindex> index_map;
};

} // end namespace perspective

namespace std {
template <>
struct hash<std::pair<perspective::t_uindex, perspective::t_uindex>> {
    typedef std::pair<perspective::t_uindex, perspective::t_uindex> argument_type;
    typedef std::size_t result_type;

    result_type
    operator()(argument_type const& s) const {
        result_type const h1(std::hash<perspective::t_uindex>()(s.first));
        result_type const h2(std::hash<perspective::t_uindex>()(s.second));
        return h1 ^ (h2 << 1);
    }
};

void string_to_lower(string& str);

} // end namespace std
