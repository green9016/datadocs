/******************************************************************************
 *
 * Copyright (c) 2019, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/base.h>
#include <perspective/binding.h>
#include <perspective/emscripten.h>
#include <perspective/gnode.h>
#include <perspective/table.h>
#include <perspective/pool.h>
#include <perspective/context_zero.h>
#include <perspective/context_one.h>
#include <perspective/context_two.h>
#include <perspective/view.h>
#include <random>
#include <cmath>
#include <sstream>
#include <regex>
#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <perspective/sym_table.h>
#include <codecvt>
#include <boost/optional.hpp>
#include <string>
#include <perspective/filter_utils.h>
#include <perspective/search_utils.h>

#include "malloc.h"

using namespace emscripten;
using namespace perspective;

// Gab: Emscripten memory report utilities
unsigned int getTotalMemory() {
    return EM_ASM_INT( return HEAP8.length );
}

unsigned int getPeakMemory() {
    struct mallinfo i = mallinfo();
    return i.usmblks + 5 * 1024 * 1024;  // Add the Stack size (part of full memory)
}

unsigned int getFreeMemory() {
    struct mallinfo i = mallinfo();
    unsigned int totalMemory = getTotalMemory();
    unsigned int dynamicTop = EM_ASM_INT( return HEAPU32[DYNAMICTOP_PTR >> 2] );
    return totalMemory - dynamicTop + i.fordblks;
}

void printMemoryReport(const char* header_str) {
    printf( "[MEMORY_DEBUG] %s\n", header_str );
    printf( " Used memory: %u B (%.2f MB) (%.2f%%)\n", getTotalMemory() - getFreeMemory(), (double)( getTotalMemory() - getFreeMemory() ) / (double)( 1024 * 1024 ),
            ( getTotalMemory() - getFreeMemory() ) * 100.0 / getTotalMemory() );
    printf( " Free memory: %u B (%.2f MB)\n", getFreeMemory(), (double)getFreeMemory() / (double)( 1024 * 1024 ) );
    // GAB: Peak memory is buggy when using 'emmalloc'
    printf( " Peak used memory: %u B (%.2f MB)\n", getPeakMemory(), (double)getPeakMemory() / (double)( 1024 * 1024 ) );
    printf( " Total memory: %u B (%.2f MB)\n", getTotalMemory(), (double)getTotalMemory() / (double)( 1024 * 1024 ) );
}

EM_JS(void, take_args, (val data), {
    console.log('I received: ', data);
});

namespace perspective {
namespace binding {
    static const std::string ONE_SIDE_OPERATOR[] = {"is true", "is false", "empty", "not empty", "last 7 days", "last 10 days", "last 30 days", "today",
        "yesterday", "this week", "last week", "this month", "last month", "this quarter", "last quarter", "this year", "last year", "year to date",
        "all date range", "ignore all", "element is true", "element is false"};

    template <>
    bool
    _is_one_side_operator(val op) {
        auto it = std::find(std::begin(ONE_SIDE_OPERATOR), std::end(ONE_SIDE_OPERATOR), op.as<std::string>());
        if (it != std::end(ONE_SIDE_OPERATOR)) {
            return true;
        } else {
            return false;
        }
    }

    bool is_number(const std::string& s)
    {
        static const std::regex intRegex{ R"(\d+)"};
        return std::regex_match(s, intRegex);
    }

    bool is_float(const std::string& s)
    {
        static const std::regex doubleRegex{ R"([+\-]?(?:0|[1-9]\d*)(?:\.\d*)?(?:[eE][+\-]?\d+)?)" };
        return std::regex_match(s, doubleRegex);
    }
    /******************************************************************************
     *
     * Utility
     */
    template <>
    bool
    hasValue(val item) {
        return (!item.isUndefined() && !item.isNull());
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <>
    t_binning_info get_binning_info(val j_binning_info) {
        t_binning_info binning_info;

        if (hasValue(j_binning_info)) {
            // Check have binning type
            if (hasValue(j_binning_info["type"])) {
                binning_info.type = str_to_binning_type(j_binning_info["type"].as<std::string>());
                // Check have binning size
                if (hasValue(j_binning_info["size"])) {
                    binning_info.size = j_binning_info["size"].as<double>();
                }
                // Check have binning min value
                if (hasValue(j_binning_info["min"])) {
                    binning_info.min = j_binning_info["min"].as<double>();
                }
                // Check have binning max value
                if (hasValue(j_binning_info["max"])) {
                    binning_info.max = j_binning_info["max"].as<double>();
                }
                // Check type is double or not
                if (hasValue(j_binning_info["is_double"])) {
                    binning_info.is_double = j_binning_info["is_double"].as<bool>();
                } else {
                    binning_info.is_double = false;
                }
            } else {
                binning_info.type = BINNING_TYPE_NONE;
            }
        } else {
            binning_info = t_binning_info{BINNING_TYPE_NONE};
        }

        return binning_info;
    }

    /******************************************************************************
     *
     * Data Loading
     */
    t_index
    _get_aggregate_index(const std::vector<std::string>& agg_names, std::string name) {
        for (std::size_t idx = 0, max = agg_names.size(); idx != max; ++idx) {
            if (agg_names[idx] == name) {
                return t_index(idx);
            }
        }

        return t_index(-1);
    }

    std::vector<std::string>
    _get_aggregate_names(const std::vector<t_aggspec>& aggs) {
        std::vector<std::string> names;
        for (const t_aggspec& agg : aggs) {
            names.push_back(agg.name());
        }
        return names;
    }

    template <>
    std::vector<t_sortspec>
    _get_sort(std::vector<std::string>& col_names, bool is_column_sort, val j_sortby,
        std::vector<std::string>& row_pivots, std::vector<std::string>& column_pivots) {
        std::vector<t_sortspec> svec{};
        std::vector<val> sortbys = vecFromArray<val, val>(j_sortby);

        auto _is_valid_sort = [is_column_sort](val sort_item) {
            /**
             * If column sort, make sure string matches. Otherwise make
             * sure string is *not* a column sort.
             */
            std::string op = sort_item[1].as<std::string>();
            bool is_col_sortop = op.find("col") != std::string::npos;
            return (is_column_sort && is_col_sortop) || (!is_col_sortop && !is_column_sort);
        };

        for (auto idx = 0; idx < sortbys.size(); ++idx) {
            val sort_item = sortbys[idx];
            t_index agg_index;
            std::string col_name;
            t_sorttype sorttype;
            t_index sort_by_pos = t_index(-1);
            t_index subtotal_pos = t_index(-1);
            t_index limit = t_index(-1);
            t_limit_type limit_type = LIMIT_TYPE_ITEMS;

            std::string sort_op_str;
            std::string sort_by_str;
            if (!_is_valid_sort(sort_item)) {
                continue;
            }

            col_name = sort_item[0].as<std::string>();
            sort_op_str = sort_item[1].as<std::string>();
            if (hasValue(sort_item[2])) {
                sort_by_str = sort_item[2].as<std::string>();
            }
            sorttype = str_to_sorttype(sort_op_str);

            // Get sort for case context two: have Split by
            if (column_pivots.size() > 0) {
                // Case 1: Don't have Group by
                if (row_pivots.size() == 0) {
                    if (!is_column_sort) {
                        continue;
                    }
                    agg_index = _get_aggregate_index(column_pivots, col_name);
                    sort_by_pos = _get_aggregate_index(col_names, sort_by_str);
                // Case 2: have Group by
                } else {
                    agg_index = _get_aggregate_index(column_pivots, col_name);
                    // Case: Sort tag exist in Split by container
                    if (agg_index != -1) {
                        if (!is_column_sort) {
                            continue;
                        }
                        agg_index = _get_aggregate_index(column_pivots, col_name);
                        sort_by_pos = _get_aggregate_index(col_names, sort_by_str);
                    } else {
                        agg_index = _get_aggregate_index(row_pivots, col_name);
                        // Case: Sort tag exist in Group by container
                        if (agg_index != -1 && !is_column_sort) {
                            sort_by_pos = _get_aggregate_index(col_names, sort_by_str);
                            // Case have choose subtotal
                            if (col_name != sort_by_str && hasValue(sort_item[3])) {
                                subtotal_pos = sort_item[3].as<std::int32_t>();
                            }
                        }
                        // Otherwise: exist
                        else {
                            continue;
                        }
                    }
                }
            // Get sort for case context one: have Group by only
            } else if (row_pivots.size() > 0) {
                agg_index = _get_aggregate_index(row_pivots, col_name);
                sort_by_pos = _get_aggregate_index(col_names, sort_by_str);
            // Get sort for case context zero: don't have both Group by and Split by
            } else {
                agg_index = _get_aggregate_index(col_names, col_name);
            }
            if (hasValue(sort_item[4])) {
                limit = sort_item[4].as<std::int32_t>();
            }

            if (hasValue(sort_item[5])) {
                limit_type = str_to_limit_type(sort_item[5].as<std::string>());
            }

            svec.push_back(t_sortspec(agg_index, sorttype, sort_by_pos, subtotal_pos, limit, limit_type));
        }
        return svec;
    }

    template <>
    std::pair<std::vector<t_sterm>, t_search_info>
    _get_sterms(std::shared_ptr<t_schema> schema, val j_date_parser, val j_searchs) {
        std::vector<t_sterm> svec{};
        std::vector<val> searchs = vecFromArray<val, val>(j_searchs);
        std::set<std::string> columns{};
        bool unselected_all = false;

        for (t_index sidx = 0, ssize = searchs.size(); sidx < ssize; ++sidx) {
            val search = searchs[sidx];
            std::string text = search["text"].as<std::string>();
            std::string lower_search = boost::to_lower_copy<std::string>(text);
            t_sterm full_term(lower_search, true);
            //svec.push_back(create_search_term(full_term, lower_search));
            svec.push_back(full_term);
            std::vector<std::string> words;
            split1(lower_search, words);
            for (t_uindex idx = 0, loop_end = words.size(); idx < loop_end; ++idx) {
                std::string lower_str = words[idx];
                t_sterm term(lower_str);
                //svec.push_back(create_search_term(term, lower_str));
                svec.push_back(term);
            }

            if (hasValue(search["columns"])) {
                val j_columns = search["columns"];
                std::vector<std::string> scolumns = vecFromArray<val, std::string>(j_columns);
                if (scolumns.size() > 0) {
                    columns.insert(scolumns.begin(), scolumns.end());
                }
            }
            if (hasValue(search["unselected_all"])) {
                unselected_all = search["unselected_all"].as<bool>();
            }
        }
        t_search_info s_info;
        if (columns.size() > 0 || unselected_all) {
            s_info = t_search_info(std::vector<std::string>(columns.begin(), columns.end()), unselected_all);
        }
        return std::pair<std::vector<t_sterm>, t_search_info>(svec, s_info);
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <>
    t_fterm
    _get_fterm_in(t_schema schema, val j_date_parser, t_dtype col_type, t_agg_level_type agg_level, std::vector<std::string> j_terms,
        t_index level, t_index filterby_index, t_index subtotal_index, t_binning_info binning_info, std::string col, t_filter_op comp) {
        std::vector<t_tscalar> terms{};
        t_tscalar null_sca = mknull(col_type);
        t_tscalar error_sca = mkerror(col_type);
        t_tscalar empty_sca = mkempty(col_type);
        if (agg_level == AGG_LEVEL_YEAR) {
            col_type = DTYPE_INT64;
            null_sca = mknull(col_type);
            error_sca = mkerror(col_type);
            empty_sca = mkempty(col_type);
        } else if (agg_level != AGG_LEVEL_NONE) {
            null_sca = mknull(DTYPE_STR);
            error_sca = mkerror(DTYPE_STR);
        }
        for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
            t_tscalar term;
            std::string str = get_interned_cstr(j_terms[jidx].c_str());
            if (str.at(0) == '"' || str.at(0) == '\'') {
                str = str.substr(1, str.size());
            }
            if (str.at(str.size() - 1) == '"' || str.at(str.size() - 1) == '\'') {
                str = str.substr(0, str.size() - 1);
            }
            auto str_val = str.c_str();
            if (str_val == std::string("")) {
                terms.push_back(null_sca);
                if (col_type != DTYPE_STR) {
                    continue;
                }
            } else if (str_val == std::string("(error)")) {
                terms.push_back(error_sca);
                if (col_type != DTYPE_STR) {
                    continue;
                }
            } else if (str_val == std::string("(blank)")) {
                terms.push_back(null_sca);
                if (col_type != DTYPE_STR) {
                    continue; 
                } else {
                    terms.push_back(get_interned_tscalar(std::string("").c_str()));
                }
            } else if (str_val == std::string("(empty)")) {
                terms.push_back(empty_sca);
                if (col_type != DTYPE_STR) {
                    continue; 
                } else {
                    terms.push_back(get_interned_tscalar(std::string("").c_str()));
                }
            } else if (str_val == BINNING_OTHER_TEXT) {
                terms.push_back(null_sca);
                terms.push_back(error_sca);
                terms.push_back(empty_sca);
                if (col_type != DTYPE_STR) {
                    continue;
                } else {
                    terms.push_back(get_interned_tscalar(std::string("").c_str()));
                }
            }
            t_dtype new_ctype = col_type;
            if (binning_info.type != BINNING_TYPE_NONE) {
                new_ctype = DTYPE_STR;
            }
            switch (new_ctype)
            {
            case DTYPE_INT8:
            case DTYPE_INT16:
            case DTYPE_UINT16:
            case DTYPE_UINT8:
            case DTYPE_UINT32:
            case DTYPE_INT32: {
                std::int32_t int_val = atoi(str_val);
                term = mktscalar(int_val);
            } break;

            case DTYPE_LIST_INT64:
            case DTYPE_INT64:
            case DTYPE_UINT64: {
                double float_val = atof(str_val);
                term = mktscalar(std::int64_t(float_val));
            } break;
            case DTYPE_LIST_FLOAT64:
            case DTYPE_FLOAT32:
            case DTYPE_FLOAT64: {
                double float_val = atof(str_val);
                term = mktscalar(float_val);
            } break;
            case DTYPE_DATE:
            case DTYPE_LIST_DATE: {
                if (agg_level == AGG_LEVEL_NONE) {
                    val parsed_date = j_date_parser.call<val>("parse", val(str_val));
                    if (parsed_date.isNull() || parsed_date.call<val>("getHours").as<std::int32_t>() != 0
                                                || parsed_date.call<val>("getMinutes").as<std::int32_t>() != 0
                                                || parsed_date.call<val>("getSeconds").as<std::int32_t>() != 0) {
                        continue;
                    }
                    term = mktscalar(jsdate_to_t_date(parsed_date));
                } else {
                    term = get_interned_tscalar(str_val);
                }
            } break;
            case DTYPE_TIME:
            case DTYPE_LIST_TIME: {
                if (agg_level == AGG_LEVEL_NONE) {
                    val parsed_date = j_date_parser.call<val>("parse", val(str_val));
                    if (parsed_date.isNull()) {
                        continue;
                    }
                    term = mktscalar(jsdate_to_t_time(parsed_date));
                } else {
                    term = get_interned_tscalar(str_val);
                }
            } break;
            case DTYPE_DURATION:
            case DTYPE_LIST_DURATION: {
                val parsed_date = j_date_parser.call<val>("parse", val(str_val));
                if (parsed_date.isNull()) {
                    continue;
                }
                term = mktscalar(t_duration(parsed_date.call<val>("getHours").as<std::int32_t>(),
                                            parsed_date.call<val>("getMinutes").as<std::int32_t>(),
                                            parsed_date.call<val>("getSeconds").as<std::int32_t>()));
            } break;
            default: {
                term = get_interned_tscalar(str_val);
            } break;
            }
            terms.push_back(term);
        }
        std::sort(terms.begin(), terms.end());
        return t_fterm(col, comp, mktscalar(0), terms, level, filterby_index, subtotal_index, FILTER_PREVIOUS_NO, agg_level, binning_info);
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <>
    std::vector<t_fterm>
    _get_fterms(t_schema schema, val j_date_parser, val j_filters, std::vector<std::string>& col_names,
        std::vector<std::string>& row_pivots, bool is_having) {
        std::vector<t_fterm> fvec{};
        std::vector<val> filters = vecFromArray<val, val>(j_filters);

        auto _is_valid_filter = [j_date_parser](t_dtype type, std::vector<val> filter, bool one_side_operator, t_filter_op comp) {
            if (one_side_operator) {
                return true;
            }
            if (type == DTYPE_DATE || type == DTYPE_TIME || type == DTYPE_DURATION) {
                if (comp == FILTER_OP_NOT_IN || comp == FILTER_OP_IN || comp == FILTER_OP_BETWEEN || comp == FILTER_OP_RELATIVE_DATE
                    || comp == FILTER_OP_TOP_N) {
                    return hasValue(filter[2]);
                } else {
                    val parsed_date = j_date_parser.call<val>("parse", filter[2]);
                    return hasValue(parsed_date);
                }
            } else {
                return hasValue(filter[2]);
            }
        };

        for (auto fidx = 0; fidx < filters.size(); ++fidx) {
            std::vector<val> filter = vecFromArray<val, val>(filters[fidx]);
            std::string col = filter[0].as<std::string>();
            t_filter_op comp = str_to_filter_op(filter[1].as<std::string>());
            bool one_side_operator = _is_one_side_operator(filter[1]);
            t_index level = _get_aggregate_index(row_pivots, col);
            t_index filterby_index = t_index(-1);
            if (hasValue(filter[3])) {
                auto filter_by_str = filter[3].as<std::string>();
                filterby_index = _get_aggregate_index(col_names, filter_by_str);
            }
            t_index subtotal_index = t_index(-1);
            // Case 1: get filter
            if (!is_having) {
                // Filter doen't have filterby operator
                if (filterby_index != -1) {
                    continue;
                }
            }
            // Case 2: get having
            else {
                // Having need colname in row pivots or have filterby operator
                if (level == -1 || filterby_index == -1) {
                    continue;
                }
                level = level + 1;
                // Get subtotal index
                if (hasValue(filter[4])) {
                    subtotal_index = filter[4].as<t_index>();
                }
                // Update new col
                col = filter[3].as<std::string>();
            }

            // Check previous value for filter
            t_filter_previous previous = FILTER_PREVIOUS_NO;
            if (hasValue(filter[5])) {
                previous = str_to_filter_previous(filter[5].as<std::string>());
            }

            // Check aggregate level for filter
            t_agg_level_type agg_level = AGG_LEVEL_NONE;
            if (hasValue(filter[6])) {
                agg_level = str_to_agg_level_type(filter[6].as<std::string>());
            }

            // Check binning info for filter
            t_binning_info binning_info{BINNING_TYPE_NONE};
            if (hasValue(filter[7])) {
                binning_info = get_binning_info(filter[7]);
            }

            // check validity and if_date
            t_dtype col_type = DTYPE_NONE;
            if (col != GROUP_FILTER_NAME) {
                col_type = schema.get_dtype(col);
            }
            bool is_valid = _is_valid_filter(col_type, filter, one_side_operator, comp);

            if (!is_valid) {
                continue;
            }

            switch (comp) {
                case FILTER_OP_NOT_IN:
                case FILTER_OP_IN: {
                    std::vector<std::string> j_terms
                        = vecFromArray<val, std::string>(filter[2]);
                    fvec.push_back(_get_fterm_in(schema, j_date_parser, col_type, agg_level, j_terms, level, filterby_index, subtotal_index, binning_info, col, comp));
                } break;
                case FILTER_OP_BETWEEN:
                case FILTER_OP_ELE_BETWEEN: {
                    std::vector<t_tscalar> terms{};
                    std::vector<std::string> j_terms
                        = vecFromArray<val, std::string>(filter[2]);
                    if (j_terms.size() != 2) {
                        continue;
                    }
                    for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                        t_tscalar term;
                        auto str_val = get_interned_cstr(j_terms[jidx].c_str());
                        switch (col_type)
                        {
                        case DTYPE_DATE:
                        case DTYPE_LIST_DATE: {
                            val parsed_date = j_date_parser.call<val>("parse", val(str_val));
                            if (parsed_date.isNull() || parsed_date.call<val>("getHours").as<std::int32_t>() != 0
                                                        || parsed_date.call<val>("getMinutes").as<std::int32_t>() != 0
                                                        || parsed_date.call<val>("getSeconds").as<std::int32_t>() != 0) {
                                continue;
                            }
                            term = mktscalar(jsdate_to_t_date(parsed_date));
                        } break;
                        case DTYPE_TIME:
                        case DTYPE_LIST_TIME: {
                            val parsed_date = j_date_parser.call<val>("parse", val(str_val));
                            if (parsed_date.isNull()) {
                                continue;
                            }
                            term = mktscalar(jsdate_to_t_time(parsed_date));
                        } break;
                        case DTYPE_DURATION:
                        case DTYPE_LIST_DURATION: {
                            val parsed_date = j_date_parser.call<val>("parse", val(str_val));
                            if (parsed_date.isNull()) {
                                continue;
                            }
                            term = mktscalar(t_duration(parsed_date.call<val>("getHours").as<std::int32_t>(),
                                                        parsed_date.call<val>("getMinutes").as<std::int32_t>(),
                                                        parsed_date.call<val>("getSeconds").as<std::int32_t>()));
                        } break;
                        case DTYPE_INT8:
                        case DTYPE_INT16:
                        case DTYPE_UINT16:
                        case DTYPE_UINT8:
                        case DTYPE_UINT32:
                        case DTYPE_INT32: {
                            std::int32_t int_val = atoi(str_val);
                            term = mktscalar(int_val);
                        } break;
                        case DTYPE_INT64:
                        case DTYPE_UINT64:
                        case DTYPE_LIST_INT64: {
                            double float_val = atof(str_val);
                            term = mktscalar(std::int64_t(float_val));
                        } break;

                        case DTYPE_FLOAT32:
                        case DTYPE_FLOAT64:
                        case DTYPE_LIST_FLOAT64: {
                            double float_val = atof(str_val);
                            term = mktscalar(float_val);
                        } break;
                        default: {
                            continue;
                        } break;
                        }
                        terms.push_back(term);
                    }
                    if (terms.size() != 2) {
                        continue;
                    }
                    fvec.push_back(t_fterm(col, comp, mktscalar(0), terms, level, filterby_index, subtotal_index));
                } break;
                case FILTER_OP_TOP_N: {
                    std::vector<t_tscalar> terms{};
                    std::vector<std::string> j_terms
                        = vecFromArray<val, std::string>(filter[2]);
                    if (j_terms.size() != 2) {
                        continue;
                    }
                    auto str_val = get_interned_cstr(j_terms[0].c_str());
                    std::int32_t int_val = atoi(str_val);
                    t_tscalar term = mktscalar(int_val);
                    terms.push_back(term);
                    term = mktscalar(get_interned_cstr(j_terms[1].c_str()));
                    terms.push_back(term);
                    fvec.push_back(t_fterm(col, comp, mktscalar(0), terms, level, filterby_index, subtotal_index));
                } break;
                case FILTER_OP_LAST_7_DAYS:
                case FILTER_OP_LAST_10_DAYS:
                case FILTER_OP_LAST_30_DAYS: {
                    t_tscalar term;
                    val previous_period = val::global();
                    val jsdate = val::global("Date").new_();
                    std::vector<t_tscalar> terms{};
                    val parsed_date = j_date_parser.call<val>("get_date_range", val(static_cast<int>(comp)), val(static_cast<int>(0)));
                    if (previous == FILTER_PREVIOUS_YES) {
                        previous_period = j_date_parser.call<val>("get_previous_date_range", val(static_cast<int>(comp)), val(static_cast<int>(0)));
                    }
                    switch (col_type)
                        {
                        case DTYPE_DATE: {
                            if (parsed_date.isNull() || parsed_date.call<val>("getHours").as<std::int32_t>() != 0
                                                        || parsed_date.call<val>("getMinutes").as<std::int32_t>() != 0
                                                        || parsed_date.call<val>("getSeconds").as<std::int32_t>() != 0) {
                                continue;
                            }
                            term = mktscalar(jsdate_to_t_date(parsed_date));
                            if (previous == FILTER_PREVIOUS_YES) {
                                terms.push_back(mktscalar(jsdate_to_t_date(previous_period)));
                                terms.push_back(mktscalar(jsdate_to_t_date(jsdate)));
                            }
                        } break;
                        case DTYPE_TIME: {
                            if (parsed_date.isNull()) {
                                continue;
                            }
                            term = mktscalar(jsdate_to_t_time(parsed_date));
                            if (previous == FILTER_PREVIOUS_YES) {
                                terms.push_back(mktscalar(jsdate_to_t_time(previous_period)));
                                terms.push_back(mktscalar(jsdate_to_t_time(jsdate)));
                            }
                        } break;
                        default: {
                            continue;
                        } break;
                        }
                    fvec.push_back(t_fterm(col, comp, term, {terms[0]}, level, filterby_index, subtotal_index, previous));
                    if (previous == FILTER_PREVIOUS_YES) {
                        fvec.push_back(t_fterm(col, FILTER_OP_BETWEEN, mktscalar(0), terms, level, filterby_index, subtotal_index));
                    }
                } break;
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
                case FILTER_OP_YEAR_TO_DATE: {
                    t_tscalar term;
                    val previous_period = val::global();
                    std::vector<t_tscalar> terms{};
                    val first_parsed_date = j_date_parser.call<val>("get_date_range", val(static_cast<int>(comp)), val(static_cast<int>(0)));
                    val second_parsed_date = j_date_parser.call<val>("get_date_range", val(static_cast<int>(comp)), val(static_cast<int>(1)));
                    if (previous == FILTER_PREVIOUS_YES) {
                        previous_period = j_date_parser.call<val>("get_previous_date_range", val(static_cast<int>(comp)), val(static_cast<int>(0)));
                    }
                    switch (col_type)
                        {
                        case DTYPE_DATE: {
                            if (first_parsed_date.isNull() || first_parsed_date.call<val>("getHours").as<std::int32_t>() != 0
                                                        || first_parsed_date.call<val>("getMinutes").as<std::int32_t>() != 0
                                                        || first_parsed_date.call<val>("getSeconds").as<std::int32_t>() != 0) {
                                continue;
                            }
                            if (second_parsed_date.isNull() || second_parsed_date.call<val>("getHours").as<std::int32_t>() != 0
                                                        || second_parsed_date.call<val>("getMinutes").as<std::int32_t>() != 0
                                                        || second_parsed_date.call<val>("getSeconds").as<std::int32_t>() != 0) {
                                continue;
                            }
                            terms.push_back(mktscalar(jsdate_to_t_date(first_parsed_date)));
                            terms.push_back(mktscalar(jsdate_to_t_date(second_parsed_date)));
                            if (previous == FILTER_PREVIOUS_YES) {
                                terms.push_back(mktscalar(jsdate_to_t_date(previous_period)));
                            }
                        } break;
                        case DTYPE_TIME: {
                            if (first_parsed_date.isNull() || second_parsed_date.isNull()) {
                                continue;
                            }
                            terms.push_back(mktscalar(jsdate_to_t_time(first_parsed_date)));
                            terms.push_back(mktscalar(jsdate_to_t_time(second_parsed_date)));
                            if (previous == FILTER_PREVIOUS_YES) {
                                terms.push_back(mktscalar(jsdate_to_t_time(previous_period)));
                            }
                        } break;
                        default: {
                            continue;
                        } break;
                        }
                    fvec.push_back(t_fterm(col, comp, mktscalar(0), terms, level, filterby_index, subtotal_index, previous));
                    if (previous == FILTER_PREVIOUS_YES) {
                        fvec.push_back(t_fterm(col, FILTER_OP_BETWEEN, mktscalar(0), {terms[2], terms[1]}, level, filterby_index, subtotal_index));
                    }
                } break;
                case FILTER_OP_ALL_DATE_RANGE: {
                    continue;
                } break;
                case FILTER_OP_IN_ANY:
                case FILTER_OP_IN_ALL:
                case FILTER_OP_ELE_IN_ANY:
                case FILTER_OP_ELE_NOT_IN_ANY: {
                    t_tscalar term;
                    switch (col_type)
                    {
                        case DTYPE_LIST_STR: {
                            std::vector<std::string> j_terms
                                = vecFromArray<val, std::string>(filter[2]);
                            term = mktscalar(j_terms);
                        } break;
                        case DTYPE_LIST_BOOL: {
                            std::vector<bool> j_terms
                                = vecFromArray<val, bool>(filter[2]);
                            term = mktscalar(j_terms);
                        } break;
                        case DTYPE_LIST_FLOAT64: {
                            std::vector<std::string> j_terms
                                = vecFromArray<val, std::string>(filter[2]);
                            std::vector<double> terms;
                            for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                terms.push_back(atof(j_terms[jidx].c_str()));
                            }
                            term = mktscalar(terms);
                        } break;
                        case DTYPE_LIST_INT64: {
                            std::vector<std::string> j_terms
                                = vecFromArray<val, std::string>(filter[2]);
                            std::vector<std::int64_t> terms;
                            for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                terms.push_back(std::int64_t(atof(j_terms[jidx].c_str())));
                            }
                            term = mktscalar(terms);
                        } break;
                        case DTYPE_LIST_DATE: {
                            std::vector<std::string> j_terms
                                = vecFromArray<val, std::string>(filter[2]);
                            std::vector<t_date> terms;
                            for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                val parsed_date = j_date_parser.call<val>("parse", j_terms[jidx]);
                                terms.push_back(jsdate_to_t_date(parsed_date));
                            }
                            term = mktscalar(terms);
                        } break;
                        case DTYPE_LIST_TIME: {
                            std::vector<std::string> j_terms
                                = vecFromArray<val, std::string>(filter[2]);
                            std::vector<t_time> terms;
                            for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                val parsed_date = j_date_parser.call<val>("parse", j_terms[jidx]);
                                terms.push_back(jsdate_to_t_time(parsed_date));
                            }
                            term = mktscalar(terms);
                        } break;
                        case DTYPE_LIST_DURATION: {
                            std::vector<std::string> j_terms
                                = vecFromArray<val, std::string>(filter[2]);
                            std::vector<t_duration> terms;
                            for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                val parsed_date = j_date_parser.call<val>("parse", j_terms[jidx]);
                                terms.push_back(t_duration(parsed_date.call<val>("getHours").as<std::int32_t>(),
                                                            parsed_date.call<val>("getMinutes").as<std::int32_t>(),
                                                            parsed_date.call<val>("getSeconds").as<std::int32_t>()));
                            }
                            term = mktscalar(terms);
                        } break;
                        
                        default: {
                            PSP_COMPLAIN_AND_ABORT("Encountered unknown filter operation.");
                            continue;
                        } break;
                    }
                    fvec.push_back(t_fterm(col, comp, term, std::vector<t_tscalar>(), level, filterby_index, subtotal_index));
                } break;
                case FILTER_OP_ELE_EQ:
                case FILTER_OP_ELE_NE:
                case FILTER_OP_ELE_CONTAINS:
                case FILTER_OP_ELE_NOT_CONTAINS:
                case FILTER_OP_ELE_BEGINS_WITH:
                case FILTER_OP_ELE_ENDS_WITH:
                case FILTER_OP_ELE_GT:
                case FILTER_OP_ELE_GTEQ:
                case FILTER_OP_ELE_LT:
                case FILTER_OP_ELE_LTEQ:
                case FILTER_OP_ELE_BEFORE:
                case FILTER_OP_ELE_AFTER: {
                    t_tscalar term;
                    switch (col_type)
                    {
                        case DTYPE_LIST_STR: {
                            term = mktscalar(
                                    get_interned_cstr(filter[2].as<std::string>().c_str()));
                        } break;
                        case DTYPE_LIST_BOOL: {
                            term = mktscalar(filter[2].as<bool>());
                        } break;
                        case DTYPE_LIST_FLOAT64: {
                            term = mktscalar(filter[2].as<double>());
                        } break;
                        case DTYPE_LIST_INT64: {
                            term = mktscalar(std::int64_t(filter[2].as<double>()));
                        } break;
                        case DTYPE_LIST_DATE: {
                            val parsed_date = j_date_parser.call<val>("parse", filter[2]);
                            if (!parsed_date.isNull() && parsed_date.call<val>("getHours").as<std::int32_t>() == 0
                                                        && parsed_date.call<val>("getMinutes").as<std::int32_t>() == 0
                                                        && parsed_date.call<val>("getSeconds").as<std::int32_t>() == 0) {
                                term = mktscalar(jsdate_to_t_date(parsed_date));
                            }
                        } break;
                        case DTYPE_LIST_TIME: {
                            val parsed_date = j_date_parser.call<val>("parse", filter[2]);
                            if (!parsed_date.isNull()) {
                                //double time = parsed_date.call<val>("getTime").as<double>()/(SECS_PER_DAY*1000);
                                term = mktscalar(jsdate_to_t_time(parsed_date));
                            }
                        } break;
                        case DTYPE_LIST_DURATION: {
                            val parsed_date = j_date_parser.call<val>("parse", filter[2]);
                            if (!parsed_date.isNull()) {
                                //double time = parsed_date.call<val>("getTime").as<double>()/(SECS_PER_DAY*1000);
                                term = mktscalar(t_duration(parsed_date.call<val>("getHours").as<std::int32_t>(),
                                                            parsed_date.call<val>("getMinutes").as<std::int32_t>(),
                                                            parsed_date.call<val>("getSeconds").as<std::int32_t>()));
                            }
                        } break;
                        
                        default: {
                            PSP_COMPLAIN_AND_ABORT("Encountered unknown filter operation.");
                            continue;
                        } break;
                    }
                    fvec.push_back(t_fterm(col, comp, term, std::vector<t_tscalar>(), level, filterby_index, subtotal_index));
                } break;
                case FILTER_OP_RELATIVE_DATE: {
                    std::vector<t_tscalar> terms{};
                    std::vector<std::string> j_terms
                        = vecFromArray<val, std::string>(filter[2]);
                    if (j_terms.size() != 3) {
                        continue;
                    }
                    auto filter_period = str_to_filter_period(j_terms[0]);
                    std::int32_t int_val = 0;
                    if (filter_period != FILTER_PERIOD_THIS) {
                        int_val = atoi(get_interned_cstr(j_terms[1].c_str()));
                        if (int_val <= 0) {
                            continue;
                        }
                    }
                    auto filter_date_unit = str_to_filter_date_unit(j_terms[2]);
                    val first_parsed_date = j_date_parser.call<val>("get_date_range", val(static_cast<int>(comp)), val(static_cast<int>(0)),
                                        val(static_cast<int>(filter_period)), val(static_cast<int>(filter_date_unit)), val(static_cast<int>(int_val)));
                    val second_parsed_date = j_date_parser.call<val>("get_date_range", val(static_cast<int>(comp)), val(static_cast<int>(1)),
                                        val(static_cast<int>(filter_period)), val(static_cast<int>(filter_date_unit)), val(static_cast<int>(int_val)));
                    switch (col_type)
                        {
                        case DTYPE_DATE: {
                            if (first_parsed_date.isNull() || first_parsed_date.call<val>("getHours").as<std::int32_t>() != 0
                                                        || first_parsed_date.call<val>("getMinutes").as<std::int32_t>() != 0
                                                        || first_parsed_date.call<val>("getSeconds").as<std::int32_t>() != 0) {
                                continue;
                            }
                            if (second_parsed_date.isNull() || second_parsed_date.call<val>("getHours").as<std::int32_t>() != 0
                                                        || second_parsed_date.call<val>("getMinutes").as<std::int32_t>() != 0
                                                        || second_parsed_date.call<val>("getSeconds").as<std::int32_t>() != 0) {
                                continue;
                            }
                            terms.push_back(mktscalar(jsdate_to_t_date(first_parsed_date)));
                            terms.push_back(mktscalar(jsdate_to_t_date(second_parsed_date)));
                        } break;
                        case DTYPE_TIME: {
                            if (first_parsed_date.isNull() || second_parsed_date.isNull()) {
                                continue;
                            }
                            terms.push_back(mktscalar(jsdate_to_t_time(first_parsed_date)));
                            terms.push_back(mktscalar(jsdate_to_t_time(second_parsed_date)));
                        } break;
                        default: {
                            continue;
                        } break;
                        }
                    fvec.push_back(t_fterm(col, comp, mktscalar(0), terms, level, filterby_index, subtotal_index, previous));
                } break;
                case FILTER_OP_GROUP_FILTER: {
                    std::vector<val> j_terms
                        = vecFromArray<val, val>(filter[2]);
                    t_fterm_dependency* fdependency = new t_fterm_dependency();
                    fdependency->m_combiner = FILTER_OP_AND;
                    std::vector<t_fterm> first_sub_filters;
                    for (t_uindex idx = 0, tsize = j_terms.size(); idx < tsize; ++idx) {
                        auto j_sub_filter = vecFromArray<val, val>(j_terms[idx]);
                        t_fterm_dependency* sfdependency = new t_fterm_dependency();
                        sfdependency->m_combiner = FILTER_OP_OR;
                        std::vector<t_fterm> second_sub_filters;
                        for (t_uindex sidx = 0, ssize = j_sub_filter.size(); sidx < ssize; ++sidx) {
                            std::vector<val> j_filter = vecFromArray<val, val>(j_sub_filter[sidx]);
                            auto sub_name = j_filter[0].as<std::string>();
                            std::vector<std::string> j_sub_terms = vecFromArray<val, std::string>(j_filter[2]);
                            t_agg_level_type sub_agg_level = AGG_LEVEL_NONE;
                            if (hasValue(j_filter[6])) {
                                sub_agg_level = str_to_agg_level_type(j_filter[6].as<std::string>());
                            }
                            t_binning_info sub_binning_info = t_binning_info{BINNING_TYPE_NONE};
                            if (hasValue(j_filter[7])) {
                                sub_binning_info = get_binning_info(j_filter[7]);
                            }
                            auto sub_filter = _get_fterm_in(schema, j_date_parser, schema.get_dtype(sub_name), sub_agg_level, j_sub_terms,
                                level, filterby_index, subtotal_index, sub_binning_info, sub_name, FILTER_OP_NOT_IN);
                            second_sub_filters.push_back(sub_filter);
                        }
                        sfdependency->m_fterms = second_sub_filters;
                        t_fterm sub_f = t_fterm(col, comp, mktscalar(0), std::vector<t_tscalar>(), level, filterby_index, subtotal_index, previous,
                            agg_level, t_binning_info{BINNING_TYPE_NONE}, sfdependency);
                        first_sub_filters.push_back(sub_f);
                    }
                    fdependency->m_fterms = first_sub_filters;
                    fvec.push_back(t_fterm(col, comp, mktscalar(0), std::vector<t_tscalar>(), level, filterby_index, subtotal_index, previous,
                            agg_level, t_binning_info{BINNING_TYPE_NONE}, fdependency));
                } break;
                default: {
                    t_tscalar term;
                    switch (col_type) {
                        case DTYPE_INT8:
                        case DTYPE_INT16:
                        case DTYPE_UINT16:
                        case DTYPE_UINT8:
                        case DTYPE_UINT32:
                        case DTYPE_INT32: {
                            if (!one_side_operator) {
                                term = mktscalar(filter[2].as<std::int32_t>());
                            }
                        } break;
                        case DTYPE_INT64:
                        case DTYPE_UINT64: {
                            if (!one_side_operator) {
                                term = mktscalar(std::int64_t(filter[2].as<double>()));
                            }
                        } break;
                        case DTYPE_FLOAT32:
                        case DTYPE_FLOAT64: {
                            if (!one_side_operator) {
                                term = mktscalar(filter[2].as<double>());
                            }
                        } break;
                        case DTYPE_BOOL: {
                            if (!one_side_operator) {
                                term = mktscalar(filter[2].as<bool>());
                            }
                        } break;
                        case DTYPE_DATE: {
                            if (!one_side_operator) {
                                val parsed_date = j_date_parser.call<val>("parse", filter[2]);
                                if (!parsed_date.isNull() && parsed_date.call<val>("getHours").as<std::int32_t>() == 0
                                                            && parsed_date.call<val>("getMinutes").as<std::int32_t>() == 0
                                                            && parsed_date.call<val>("getSeconds").as<std::int32_t>() == 0) {
                                    term = mktscalar(jsdate_to_t_date(parsed_date));
                                }
                            }
                        } break;
                        case DTYPE_TIME: {
                            if (!one_side_operator) {
                                val parsed_date = j_date_parser.call<val>("parse", filter[2]);
                                if (!parsed_date.isNull()) {
                                    //double time = parsed_date.call<val>("getTime").as<double>()/(SECS_PER_DAY*1000);
                                    term = mktscalar(jsdate_to_t_time(parsed_date));
                                }
                            }
                        } break;
                        case DTYPE_DURATION: {
                            if (!one_side_operator) {
                                val parsed_date = j_date_parser.call<val>("parse", filter[2]);
                                if (!parsed_date.isNull()) {
                                    //double time = parsed_date.call<val>("getTime").as<double>()/(SECS_PER_DAY*1000);
                                    term = mktscalar(t_duration(parsed_date.call<val>("getHours").as<std::int32_t>(),
                                                                parsed_date.call<val>("getMinutes").as<std::int32_t>(),
                                                                parsed_date.call<val>("getSeconds").as<std::int32_t>()));
                                }
                            }
                        } break;
                        case DTYPE_LIST_STR: {
                            if (!one_side_operator) {
                                std::vector<std::string> j_terms
                                    = vecFromArray<val, std::string>(filter[2]);
                                term = mktscalar(j_terms);
                            }
                        } break;
                        case DTYPE_LIST_BOOL: {
                            if (!one_side_operator) {
                                std::vector<bool> j_terms
                                    = vecFromArray<val, bool>(filter[2]);
                                term = mktscalar(j_terms);
                            }
                        } break;
                        case DTYPE_LIST_FLOAT64: {
                            if (!one_side_operator) {
                                std::vector<std::string> j_terms
                                    = vecFromArray<val, std::string>(filter[2]);
                                std::vector<double> terms;
                                for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                    terms.push_back(atof(j_terms[jidx].c_str()));
                                }
                                term = mktscalar(terms);
                            }
                        } break;
                        case DTYPE_LIST_INT64: {
                            if (!one_side_operator) {
                                std::vector<std::string> j_terms
                                    = vecFromArray<val, std::string>(filter[2]);
                                std::vector<std::int64_t> terms;
                                for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                    terms.push_back(std::int64_t(atof(j_terms[jidx].c_str())));
                                }
                                term = mktscalar(terms);
                            }
                        } break;
                        case DTYPE_LIST_DATE: {
                            if (!one_side_operator) {
                                std::vector<std::string> j_terms
                                    = vecFromArray<val, std::string>(filter[2]);
                                std::vector<t_date> terms;
                                for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                    val parsed_date = j_date_parser.call<val>("parse", j_terms[jidx]);
                                    terms.push_back(jsdate_to_t_date(parsed_date));
                                }
                                term = mktscalar(terms);
                            }
                        } break;
                        case DTYPE_LIST_TIME: {
                            if (!one_side_operator) {
                                std::vector<std::string> j_terms
                                    = vecFromArray<val, std::string>(filter[2]);
                                std::vector<t_time> terms;
                                for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                    val parsed_date = j_date_parser.call<val>("parse", j_terms[jidx]);
                                    terms.push_back(jsdate_to_t_time(parsed_date));
                                }
                                term = mktscalar(terms);
                            }
                        } break;
                        case DTYPE_LIST_DURATION: {
                            if (!one_side_operator) {
                                std::vector<std::string> j_terms
                                    = vecFromArray<val, std::string>(filter[2]);
                                std::vector<t_duration> terms;
                                for (auto jidx = 0; jidx < j_terms.size(); ++jidx) {
                                    val parsed_date = j_date_parser.call<val>("parse", j_terms[jidx]);
                                    terms.push_back(t_duration(parsed_date.call<val>("getHours").as<std::int32_t>(),
                                                                parsed_date.call<val>("getMinutes").as<std::int32_t>(),
                                                                parsed_date.call<val>("getSeconds").as<std::int32_t>()));
                                }
                                term = mktscalar(terms);
                            }
                        } break;
                        default: {
                            if (!one_side_operator) {
                                term = mktscalar(
                                    get_interned_cstr(filter[2].as<std::string>().c_str()));
                            }
                        }
                    }

                    fvec.push_back(t_fterm(col, comp, term, std::vector<t_tscalar>(), level, filterby_index, subtotal_index));
                }
            }
        }
        return fvec;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <>
    std::vector<t_fterm>
    _get_hterms(std::shared_ptr<t_schema> schema, std::vector<t_aggspec> aggregates, val j_date_parser, val j_havings,
        std::map<std::string, std::string> col_map, std::vector<std::string>& col_names,
        std::vector<std::string>& row_pivots) {
        std::vector<std::string> columns;
        std::vector<t_dtype> dtypes;
        std::vector<t_dataformattype> dftypes;

        for (t_uindex idx = 0, loop_end = aggregates.size(); idx < loop_end; ++idx) {
            auto aggspec = aggregates[idx];
            auto it = col_map.find(aggspec.name());
            if (it == col_map.end() || aggspec.agg() == AGGTYPE_CUSTOM) {
                continue;
            }
            std::vector<t_col_name_type> column_name_types = aggspec.get_formula_output_specs(*(schema.get()), it->second);
            columns.push_back(column_name_types[0].m_name);
            auto type = column_name_types[0].m_type;
            if (column_name_types[0].m_type == DTYPE_F64PAIR) {
                type = DTYPE_FLOAT64;
            }
            dtypes.push_back(type);
            dftypes.push_back(column_name_types[0].m_dftype);
        }

        t_schema having_schema(columns, dtypes, dftypes);

        return _get_fterms(having_schema, j_date_parser, j_havings, col_names, row_pivots, true);
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::vector<t_aggspec>
    _get_aggspecs(std::shared_ptr<t_schema> schema, std::string separator, bool column_only, val j_aggs) {
        std::vector<t_aggspec> aggspecs;

        if (j_aggs.typeOf().as<std::string>() == "object") {
            // Construct aggregates from array
            std::vector<val> aggs = vecFromArray<val, val>(j_aggs);

            for (auto idx = 0; idx < aggs.size(); ++idx) {
                val agg = aggs[idx];
                val col = agg["column"];
                std::string col_name;
                std::string agg_op = "any";
                if (hasValue(agg["op"])) {
                    agg_op = agg["op"].as<std::string>();
                }
                std::vector<t_dep> dependencies;

                std::string disp_name = agg["column"].as<std::string>();

                if (hasValue(agg["disp_name"])) {
                    disp_name = agg["disp_name"].as<std::string>();
                }

                // Disable column only
                /*if (column_only) {
                    agg_op = "any";
                }*/

                if (col.typeOf().as<std::string>() == "string") {
                    col_name = col.as<std::string>();
                    dependencies.push_back(t_dep(col_name, DEPTYPE_COLUMN));
                } else {
                    std::vector<val> deps = vecFromArray<val, val>(col);

                    if ((agg_op != "weighted mean" && deps.size() != 1)
                        || (agg_op == "weighted mean" && deps.size() != 2)) {
                        PSP_COMPLAIN_AND_ABORT(agg_op + " has incorrect arity ("
                            + std::to_string(deps.size()) + ") for column dependencies.");
                    }

                    for (auto didx = 0; didx < deps.size(); ++didx) {
                        if (!hasValue(deps[didx])) {
                            continue;
                        }
                        std::string dep = deps[didx].as<std::string>();
                        dependencies.push_back(t_dep(dep, DEPTYPE_COLUMN));
                    }

                    col_name = deps[0].as<std::string>();

                    if (hasValue(agg["name"])) {
                        col_name = agg["name"].as<std::string>();
                    }
                }

                t_aggtype aggtype = str_to_aggtype(agg_op);

                if (aggtype == AGGTYPE_FIRST || aggtype == AGGTYPE_LAST) {
                    if (dependencies.size() == 1) {
                        dependencies.push_back(t_dep("psp_pkey", DEPTYPE_COLUMN));
                    }
                    //aggspecs.push_back(t_aggspec(
                    //    col_name, col_name, aggtype, dependencies, SORTTYPE_ASCENDING));
                    aggspecs.push_back(t_aggspec(
                        col_name, disp_name, aggtype, dependencies, SORTTYPE_ASCENDING));
                } else {
                    //aggspecs.push_back(t_aggspec(col_name, aggtype, dependencies));
                    aggspecs.push_back(t_aggspec(col_name, disp_name, aggtype, dependencies));
                }
            }
        } else {
            // No specified aggregates - set defaults for each column
            auto col_names = schema->columns();
            auto col_types = schema->types();

            for (std::size_t aidx = 0, max = col_names.size(); aidx != max; ++aidx) {
                std::string name = col_names[aidx];
                std::vector<t_dep> dependencies{t_dep(name, DEPTYPE_COLUMN)};
                std::string agg_op = "any";

                if (!column_only) {
                    std::string type_str = dtype_to_str(col_types[aidx]);
                    if (type_str == "float" || type_str == "integer") {
                        agg_op = "sum";
                    } else {
                        agg_op = "distinct count";
                    }
                }

                aggspecs.push_back(t_aggspec(name, str_to_aggtype(agg_op), dependencies));
            }
        }

        return aggspecs;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::vector<t_searchspec>
    _get_searchspecs(std::shared_ptr<t_schema> schema, val j_search_types) {
        std::vector<t_searchspec> searchspecs;

        if (j_search_types.typeOf().as<std::string>() == "object") {
            // Construct search types from array
            std::vector<val> search_types = vecFromArray<val, val>(j_search_types);
            
            for (auto idx = 0; idx < search_types.size(); ++idx) {
                val search_type = search_types[idx];
                std::string col_name = search_type["column"].as<std::string>();
                std::string type = search_type["type"].as<std::string>();

                t_searchtype searchtype = str_to_searchtype(type);

                searchspecs.push_back(t_searchspec(col_name, searchtype));
            }
        } else {
            // No specified search types - set defaults for each column
            auto col_names = schema->columns();
            auto col_types = schema->types();

            for (std::size_t aidx = 0, max = col_names.size(); aidx != max; ++aidx) {
                std::string name = col_names[aidx];
                std::string type = get_default_search_type(col_types[aidx]);

                searchspecs.push_back(t_searchspec(name, str_to_searchtype(type)));
            }
        }

        return searchspecs;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */

    std::vector<t_data_format_spec>
    _get_data_format_specs(std::shared_ptr<t_schema> schema, val j_data_formats) {
        std::vector<t_data_format_spec> data_format_specs;

        if (j_data_formats.typeOf().as<std::string>() == "object") {
            // Construct data formats from array
            std::vector<val> data_formats = vecFromArray<val, val>(j_data_formats);
            
            for (auto idx = 0; idx < data_formats.size(); ++idx) {
                val data_format = data_formats[idx];
                std::string col_name = data_format["column"].as<std::string>();
                std::string format = data_format["format"].as<std::string>();

                t_dataformattype data_format_type = str_to_data_format_type(format);

                data_format_specs.push_back(t_data_format_spec(col_name, data_format_type));
            }
        } else {
            // No specified data formats - set defaults for each column
            auto col_names = schema->columns();
            auto col_types = schema->types();

            for (std::size_t aidx = 0, max = col_names.size(); aidx != max; ++aidx) {
                std::string name = col_names[aidx];
                std::string format = get_default_data_format(col_types[aidx]);

                data_format_specs.push_back(t_data_format_spec(name, str_to_data_format_type(format)));
            }
        }
        return data_format_specs;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    t_formulaspec
    _get_formulaspec(val js_formula) {
        std::string op = js_formula["op"].as<std::string>();
        t_formula_op_type op_type = str_to_formula_op_type(op);
        std::vector<t_paramspec> params;
        t_uindex length = js_formula["params"]["length"].as<std::int32_t>();
        for (t_uindex idx = 0; idx < length; ++idx) {
            if (js_formula["params"][idx].typeOf().as<std::string>() == "object") {
                t_paramspec paramspec(COMPUTED_PARAM_SUB_FORMULA);
                t_formulaspec sub_formula = _get_formulaspec(js_formula["params"][idx]);
                paramspec.set_sub_formula(&sub_formula);
                params.push_back(paramspec);
            } else if (js_formula["params"][idx].typeOf().as<std::string>() == "string") {
                t_paramspec paramspec(COMPUTED_PARAM_COLNAME);
                paramspec.set_colname(js_formula["params"][idx].as<std::string>());
                params.push_back(paramspec);
            }
        }
        return t_formulaspec(op_type, params);
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */

    std::vector<t_computed_column_definition>
    _get_computed_columns(std::shared_ptr<t_schema> schema, val j_computed_columns) {
        std::vector<t_computed_column_definition> computed_columns;

        if (j_computed_columns.typeOf().as<std::string>() == "object") {
            std::vector<val> em_computed_columns = vecFromArray<val, val>(j_computed_columns);

            for (auto idx = 0; idx < em_computed_columns.size(); ++idx) {
                val column = em_computed_columns[idx];
                std::string computed_column_name = column["column"].as<std::string>();
                std::cout << "computed-column-name-------" << computed_column_name << std::endl;

                std::string computed_function_name = column["computed_function_name"].as<std::string>();
                t_computed_function_name func_name = str_to_computed_function_name(computed_function_name);
                val input_cols = column["inputs"];
                std::vector<std::string> em_inputs
                        = vecFromArray<val, std::string>(input_cols);
                val input_col_types = column["input_types"];
                std::vector<std::string> em_input_col_types
                        = vecFromArray<val, std::string>(input_col_types);
                std::vector<t_dtype> input_types;
                for (auto j = 0; j < em_inputs.size(); ++j) {
                    t_dtype dtype = DTYPE_STR;
                    if (em_input_col_types[j] == "number") {
                        dtype = DTYPE_FLOAT64;
                    }
                    else if (em_input_col_types[j] == "string") {
                        dtype = DTYPE_STR;
                    }
                    else if (em_input_col_types[j] == "column") {
                        dtype = schema->get_dtype(em_inputs[j]);
                    }

                    std::cout << "dtype---------" << dtype_to_str(dtype) << std::endl;
                    input_types.push_back(dtype);
                }
                
                t_computation computation = t_computed_column::get_computation(func_name, input_types);
                t_dtype output_column_type = computation.m_return_type;
                t_dataformattype output_column_format = get_default_data_format_type(output_column_type);

                if (schema->has_column(computed_column_name)) {
                    schema->retype_column(computed_column_name, output_column_type, output_column_format, computed_column_name);
                }
                else {
                    schema->add_column(computed_column_name, output_column_type, output_column_format, computed_column_name);
                }

                auto tp = std::make_tuple(
                    computed_column_name,
                    func_name,
                    em_inputs,
                    em_input_col_types,
                    computation
                );
                computed_columns.push_back(tp);
            }
        }
        
        return computed_columns;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */

    std::map<std::string, std::string>
    _get_col_map(val j_col_map) {
        std::map<std::string, std::string> col_map;

        if (j_col_map.typeOf().as<std::string>() == "object") {
            // Construct column map from array
            std::vector<val> column_maps = vecFromArray<val, val>(j_col_map);

            for (auto idx = 0; idx < column_maps.size(); ++idx) {
                val column_map = column_maps[idx];
                std::string name = column_map["name"].as<std::string>();
                std::string original_name = column_map["original_name"].as<std::string>();

                col_map[name] = original_name;
            }
        }
        
        return col_map;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::vector<t_pivot_info> _get_pivot_info(val j_pivot_info) {
        std::vector<t_pivot_info> pivot_info_vec;

        if (j_pivot_info.typeOf().as<std::string>() == "object") {
            // Construct column map from array
            std::vector<val> pivot_vec = vecFromArray<val, val>(j_pivot_info);

            for (t_uindex idx = 0, loop_end = pivot_vec.size(); idx < loop_end; ++idx) {
                auto pivot_info = pivot_vec[idx];
                t_pivot_info info;
                info.colname = pivot_info["column"].as<std::string>();
                if (hasValue(pivot_info["level"])) {
                    info.agg_level = str_to_agg_level_type(pivot_info["level"].as<std::string>());
                } else {
                    info.agg_level = AGG_LEVEL_NONE;
                }
                if (hasValue(pivot_info["type"])) {
                    info.pivot_type = str_to_pivot_type(pivot_info["type"].as<std::string>());
                } else {
                    info.pivot_type = PIVOT_TYPE_ROW;
                }
                info.index = pivot_info["index"].as<std::int32_t>();
                info.pivot_name = pivot_info["pivot_name"].as<std::string>();
                // Check setting subtotal is exist or not
                if (hasValue(pivot_info["subtotal"])) {
                    info.subtotal = pivot_info["subtotal"].as<bool>();
                } else {
                    info.subtotal = true;
                }
                // Check setting binning is exist or not
                if (hasValue(pivot_info["binning"])) {
                    auto js_binning_info = pivot_info["binning"];
                    t_binning_info binning_info;
                    // Check have binning type
                    if (hasValue(js_binning_info["type"])) {
                        binning_info.type = str_to_binning_type(js_binning_info["type"].as<std::string>());
                        // Check have binning size
                        if (hasValue(js_binning_info["size"])) {
                            binning_info.size = js_binning_info["size"].as<double>();
                        }
                        // Check have binning min value
                        if (hasValue(js_binning_info["min"])) {
                            binning_info.min = js_binning_info["min"].as<double>();
                        }
                        // Check have binning max value
                        if (hasValue(js_binning_info["max"])) {
                            binning_info.max = js_binning_info["max"].as<double>();
                        }
                        // Check type is double or not
                        if (hasValue(js_binning_info["is_double"])) {
                            binning_info.is_double = js_binning_info["is_double"].as<bool>();
                        } else {
                            binning_info.is_double = false;
                        }
                    } else {
                        binning_info.type = BINNING_TYPE_NONE;
                    }
                    info.binning = binning_info;
                } else {
                    info.binning = t_binning_info{BINNING_TYPE_NONE};
                }

                pivot_info_vec.push_back(info);
            }
        }

        return pivot_info_vec;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::map<std::string, t_show_type> _get_show_type(val j_show_type) {
        std::map<std::string, t_show_type> show_types;

        if (j_show_type.typeOf().as<std::string>() == "object") {
            // Construct show type from array
            std::vector<val> show_type_vec = vecFromArray<val, val>(j_show_type);

            for (t_uindex idx = 0, loop_end = show_type_vec.size(); idx < loop_end; ++idx) {
                auto show_type = show_type_vec[idx];
                auto type = show_type["type"].as<std::string>();
                show_types[show_type["column"].as<std::string>()] = str_to_show_type(type);
            }
        }

        return show_types;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::map<std::string, t_period_type> _get_period_type(val j_period_type) {
        std::map<std::string, t_period_type> period_types;

        if (j_period_type.typeOf().as<std::string>() == "object") {
            // Construct period type from array
            std::vector<val> period_type_vec = vecFromArray<val, val>(j_period_type);

            for (t_uindex idx = 0, loop_end = period_type_vec.size(); idx < loop_end; ++idx) {
                auto period_type = period_type_vec[idx];
                auto type = period_type["type"].as<std::string>();
                period_types[period_type["column"].as<std::string>()] = str_to_period_type(type);
            }
        }

        return period_types;
    }

    /**
     * Get pagination spec from js object
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     * t_paginationspec
     */
    t_paginationspec _get_pagination_spec(val j_pagination) {
        t_paginationspec pagination_spec;

        if (j_pagination.typeOf().as<std::string>() == "object") {
            t_index items_per_page = j_pagination["page_items"].as<std::int32_t>();
            t_index page_num = j_pagination["page_number"].as<std::int32_t>();
            pagination_spec = t_paginationspec(items_per_page, page_num);
        }

        return pagination_spec;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    t_combined_field _get_combined_field(val j_combined_field) {
        t_combined_field combined_field;

        if (j_combined_field.typeOf().as<std::string>() == "object") {
            combined_field.m_combined_mode = str_to_combined_mode(j_combined_field["combined_mode"].as<std::string>());
            combined_field.m_combined_index = j_combined_field["combined_index"].as<std::int32_t>();
        }

        return combined_field;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    void process_rename_columns(std::shared_ptr<t_gnode> gnode, const std::map<std::string, std::string> col_map) {
        t_table* tbl = gnode->get_table();

        // rename for columns of core table
        tbl->rename_columns(col_map);

        // rename for columns of current tbl schema:
        gnode->rename_tbl_columns(col_map);
    }

    /******************************************************************************
     *
     * Date Parsing
     */

    t_date
    jsdate_to_t_date(val date) {
        return t_date(date.call<val>("getFullYear").as<std::int32_t>(),
            date.call<val>("getMonth").as<std::int32_t>() + 1,
            date.call<val>("getDate").as<std::int32_t>());
    }

    val
    t_date_to_jsdate(t_date date) {
        struct tm tstruct;
        date.as_tm(tstruct);
        val jsdate = val::global("Date").new_();
        jsdate.call<val>("setYear", date.year(tstruct));
        jsdate.call<val>("setMonth", date.month(tstruct));
        jsdate.call<val>("setDate", date.day(tstruct));
        jsdate.call<val>("setHours", 0);
        jsdate.call<val>("setMinutes", 0);
        jsdate.call<val>("setSeconds", 0);
        jsdate.call<val>("setMilliseconds", 0);
        return jsdate;
    }

    /******************************************************************************
     *
     * Time Parsing
     */
    
    t_time
    jsdate_to_t_time(val time) {
        return t_time(time.call<val>("getFullYear").as<std::int32_t>(),
            time.call<val>("getMonth").as<std::int32_t>() + 1,
            time.call<val>("getDate").as<std::int32_t>(),
            time.call<val>("getHours").as<std::int32_t>(),
            time.call<val>("getMinutes").as<std::int32_t>(),
            time.call<val>("getSeconds").as<std::int32_t>());
    }

    /**
     * Converts a scalar value to its JS representation.
     *
     * Params
     * ------
     * t_tscalar scalar
     *
     * Returns
     * -------
     * val
     */
    val
    scalar_to_val(const t_tscalar& scalar, bool cast_double, bool cast_string, bool exact_type,
        bool full_value, bool include_error) {

        if (include_error && scalar.is_error()) {
            val obj = val::global("Object").new_();
            obj.set("type", val("ERROR"));
            obj.set("description", val(scalar.to_string(false, full_value, true)));
            return obj;
        }

        if (scalar.m_status == STATUS_EMPTY) {
            return val("(empty)");
        }

        if (!scalar.is_valid()) {
            return val::null();
        }
        switch (scalar.get_dtype()) {
            case DTYPE_BOOL: {
                if (cast_string || exact_type) {
                    return val(scalar.to_string());
                } else {
                    if (scalar) {
                        return val(true);
                    } else {
                        return val(false);
                    }
                }
            }
            case DTYPE_TIME: {
                if (cast_double) {
                    auto x = scalar.to_double();
                    double y = *reinterpret_cast<double*>(&x);
                    return val(y);
                } else if (cast_string || exact_type) {
                    return val(scalar.to_string());
                } else {
                    return val(scalar.to_double());
                }
            }
            case DTYPE_DURATION: {
                if (cast_double) {
                    auto x = scalar.to_double();
                    double y = *reinterpret_cast<double*>(&x);
                    return val(y);
                } else if (cast_string || exact_type) {
                    return val(scalar.to_string());
                } else {
                    return val(scalar.to_double());
                }
            }
            case DTYPE_FLOAT64:
            case DTYPE_FLOAT32: {
                if (cast_double) {
                    auto x = scalar.to_uint64();
                    double y = *reinterpret_cast<double*>(&x);
                    return val(y);
                } else if (cast_string || (exact_type && scalar.require_to_str())) {
                    return val(scalar.to_string());
                } else {
                    return val(scalar.to_double());
                }
            }
            case DTYPE_DATE: {
                if (cast_string || exact_type) {
                    return val(scalar.to_string());
                } else {
                    return val(static_cast<std::int32_t>(scalar.to_int64()));
                }
            }
            case DTYPE_UINT8:
            case DTYPE_UINT16:
            case DTYPE_UINT32:
            case DTYPE_INT8:
            case DTYPE_INT16:
            case DTYPE_INT32: {
                if (cast_string || (exact_type && scalar.require_to_str())) {
                    return val(scalar.to_string());
                } else {
                    return val(static_cast<std::int32_t>(scalar.to_int64()));
                }
            }
            case DTYPE_UINT64:
            case DTYPE_INT64: {
                if (cast_string || (exact_type && scalar.require_to_str())) {
                    return val(scalar.to_string());
                } else {
                    // This could potentially lose precision
                    std::int64_t value = scalar.to_int64();
                    return val(double(value));
                    //return val(static_cast<std::int32_t>(value));
                }
            }
            case DTYPE_NONE: {
                return val::null();
            }
            case DTYPE_LIST_STR: {
                return val(scalar.to_list<std::vector<std::string>>());
            }
            case DTYPE_LIST_BOOL: {
                if (cast_string || exact_type) {
                    std::vector<std::string> list_str = scalar.to_list_string();
                    return val(list_str);
                } else {
                    std::vector<bool> list_bool = scalar.to_list<std::vector<bool>>();
                    std::vector<std::int8_t> value;
                    for (int i = 0; i < list_bool.size(); i++) {
                        value.push_back(list_bool[i]);
                    }
                    return val(value);
                }
            }
            case DTYPE_LIST_FLOAT64: {
                if (cast_string || (exact_type && scalar.require_to_str())) {
                    std::vector<std::string> list_str = scalar.to_list_string();
                    return val(list_str);
                } else {
                    return val(scalar.to_list<std::vector<double>>());
                }
            }
            case DTYPE_LIST_INT64: {
                if (cast_string || (exact_type && scalar.require_to_str())) {
                    std::vector<std::string> list_str = scalar.to_list_string();
                    return val(list_str);
                } else {
                    std::vector<std::int64_t> list_int = scalar.to_list<std::vector<std::int64_t>>();
                    std::vector<double> value;
                    for (int i = 0; i < list_int.size(); i++) {
                        value.push_back(double(list_int[i]));
                    }
                    return val(value);
                }
            }
            case DTYPE_LIST_DATE: {
                std::vector<t_date> list_date = scalar.to_list<std::vector<t_date>>();
                if (cast_string || exact_type) {
                    std::vector<std::string> list_str = scalar.to_list_string();
                    return val(list_str);
                } else {
                    std::vector<std::int32_t> value;
                    for (int i = 0; i < list_date.size(); i++) {
                        value.push_back(list_date[i].raw_value());
                    }
                    return val(value);
                }
            }
            case DTYPE_LIST_TIME: {
                std::vector<t_time> list_time = scalar.to_list<std::vector<t_time>>();
                if (cast_double) {
                    std::vector<double> value;
                    for (int i = 0; i < list_time.size(); i++) {
                        value.push_back(list_time[i].raw_value());
                    }
                    return val(value);
                } else if (cast_string || exact_type) {
                    std::vector<std::string> list_str = scalar.to_list_string();
                    return val(list_str);
                } else {
                    std::vector<double> value;
                    for (int i = 0; i < list_time.size(); i++) {
                        value.push_back(list_time[i].raw_value());
                    }
                    return val(value);
                }
            }
            case DTYPE_LIST_DURATION: {
                std::vector<t_duration> list_duration = scalar.to_list<std::vector<t_duration>>();
                if (cast_double) {
                    std::vector<double> value;
                    for (int i = 0; i < list_duration.size(); i++) {
                        value.push_back(list_duration[i].raw_value());
                    }
                    return val(value);
                } else if (cast_string || exact_type) {
                    std::vector<std::string> list_str = scalar.to_list_string();
                    return val(list_str);
                } else {
                    std::vector<double> value;
                    for (int i = 0; i < list_duration.size(); i++) {
                        value.push_back(list_duration[i].raw_value());
                    }
                    return val(value);
                }
            } break;
            case DTYPE_DECIMAL: {
                t_decimal v = scalar.get<t_decimal>();
                return val(v.decNumberToString());
            }
            case DTYPE_STR:
            default: {
                std::wstring_convert<utf8convert_type, wchar_t> converter("", L"<Invalid>");
                return val(converter.from_bytes(scalar.to_string(false, full_value, true)));
            }
        }
    }

    val
    scalar_vec_to_val(const std::vector<t_tscalar>& scalars, std::uint32_t idx) {
        return scalar_to_val(scalars[idx], false, true, true, true, true);
    }

    val
    scalar_vec_to_string(const std::vector<t_tscalar>& scalars, std::uint32_t idx) {
        return scalar_to_val(scalars[idx], false, true);
    }

    template <typename T, typename U>
    std::vector<U>
    vecFromArray(T& arr) {
        return vecFromJSArray<U>(arr);
    }

    template <>
    val
    scalar_to(const t_tscalar& scalar) {
        return scalar_to_val(scalar);
    }

    template <>
    val
    scalar_vec_to(const std::vector<t_tscalar>& scalars, std::uint32_t idx) {
        return scalar_vec_to_val(scalars, idx);
    }

    std::vector<std::string>
    val_to_string_vec(val arr) {
        return vecFromArray<val, std::string>(arr);
    }

    /**
     * Converts a std::vector<T> to a Typed Array, slicing directly from the
     * WebAssembly heap.
     */
    template <typename T>
    val
    vector_to_typed_array(std::vector<T>& xs) {
        T* st = &xs[0];
        uintptr_t offset = reinterpret_cast<uintptr_t>(st);
        return val::module_property("HEAPU8").call<val>(
            "slice", offset, offset + (sizeof(T) * xs.size()));
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */

    namespace arrow {

        template <>
        void
        vecFromTypedArray(
            const val& typedArray, void* data, std::int32_t length, const char* destType) {
            // GAB Note: update this part from upstream perspective, to let emscripten "latest-upstream" version works
            val constructor = destType == nullptr ? typedArray["constructor"] : val::global(destType);
            val memory = val::module_property("HEAP8")["buffer"];
            std::uintptr_t ptr = reinterpret_cast<std::uintptr_t>(data);
            val memoryView = constructor.new_(memory, ptr, length);
            val slice = typedArray.call<val>("slice", 0, length);
            memoryView.call<void>("set", slice);
        }

        template <>
        void
        fill_col_valid(val dcol, std::shared_ptr<t_column> col, t_index cidx, std::shared_ptr<t_column> error_col) {
            // dcol should be the Uint8Array containing the null bitmap
            t_uindex nrows = col->size();

            // arrow packs bools into a bitmap
            for (auto i = 0; i < nrows; ++i) {
                std::uint8_t elem = dcol[i / 8].as<std::uint8_t>();
                bool v = elem & (1 << (i % 8));
                if (!v && error_col && error_col->is_valid(i)) {
                    auto errors = error_col->get_scalar(i);
                    val JSON = val::global("JSON");
                    val json = JSON.call<val>("parse", errors.to_string());
                    bool has_key = json.call<val>("hasOwnProperty", std::to_string(cidx)).as<bool>();
                    if (has_key) {
                        val error = json[std::to_string(cidx)];
                        t_cell_error cell_error{num_to_error_code(std::stoi(error["c"].as<std::string>())),
                            error["v"].as<std::string>()};
                        col->set_error_status(i);
                        col->set_error(i, cell_error);
                    } else {
                        col->set_valid(i, v);
                    }
                } else {
                    col->set_valid(i, v);
                }
            }
        }

        template <>
        void
        fill_col_dict(val dictvec, std::shared_ptr<t_column> col) {
            // ptaylor: This assumes the dictionary is either a Binary or Utf8 Vector. Should it
            // support other Vector types?
            val vdata = dictvec["values"];
            std::int32_t vsize = vdata["length"].as<std::int32_t>();
            std::vector<unsigned char> data;
            data.reserve(vsize);
            data.resize(vsize);
            vecFromTypedArray(vdata, data.data(), vsize);

            val voffsets = dictvec["valueOffsets"];
            std::int32_t osize = voffsets["length"].as<std::int32_t>();
            std::vector<std::int32_t> offsets;
            offsets.reserve(osize);
            offsets.resize(osize);
            vecFromTypedArray(voffsets, offsets.data(), osize);

            // Get number of dictionary entries
            std::uint32_t dsize = dictvec["length"].as<std::uint32_t>();

            t_vocab* vocab = &*col->get_vocab();
            std::string elem;

            for (std::uint32_t i = 0; i < dsize; ++i) {
                std::int32_t bidx = offsets[i];
                std::size_t es = offsets[i + 1] - bidx;
                elem.assign(reinterpret_cast<char*>(data.data()) + bidx, es);
                t_uindex idx = vocab->get_interned(elem);
                // Make sure there are no duplicates in the arrow dictionary
                assert(idx == i);
            }
        }
    } // namespace arrow

    namespace js_typed_array {
        val ArrayBuffer = val::global("ArrayBuffer");
        val Int8Array = val::global("Int8Array");
        val Int16Array = val::global("Int16Array");
        val Int32Array = val::global("Int32Array");
        val UInt8Array = val::global("Uint8Array");
        val UInt32Array = val::global("Uint32Array");
        val Float32Array = val::global("Float32Array");
        val Float64Array = val::global("Float64Array");
    } // namespace js_typed_array

    template <typename T>
    const val typed_array = val::null();

    template <>
    const val typed_array<double> = js_typed_array::Float64Array;
    template <>
    const val typed_array<float> = js_typed_array::Float32Array;
    template <>
    const val typed_array<std::int8_t> = js_typed_array::Int8Array;
    template <>
    const val typed_array<std::int16_t> = js_typed_array::Int16Array;
    template <>
    const val typed_array<std::int32_t> = js_typed_array::Int32Array;
    template <>
    const val typed_array<std::uint32_t> = js_typed_array::UInt32Array;

    template <typename F, typename T = F>
    T get_scalar(t_tscalar& t);

    template <>
    double
    get_scalar<double>(t_tscalar& t) {
        return t.to_double();
    }
    template <>
    float
    get_scalar<float>(t_tscalar& t) {
        return t.to_double();
    }
    template <>
    std::int8_t
    get_scalar<std::int8_t>(t_tscalar& t) {
        return static_cast<std::int8_t>(t.to_int64());
    }
    template <>
    std::int16_t
    get_scalar<std::int16_t>(t_tscalar& t) {
        return static_cast<std::int16_t>(t.to_int64());
    }
    template <>
    std::int32_t
    get_scalar<std::int32_t>(t_tscalar& t) {
        return static_cast<std::int32_t>(t.to_int64());
    }
    template <>
    std::uint32_t
    get_scalar<std::uint32_t>(t_tscalar& t) {
        return static_cast<std::uint32_t>(t.to_int64());
    }
    template <>
    double
    get_scalar<t_date, double>(t_tscalar& t) {
        auto x = t.to_uint64();
        return *reinterpret_cast<double*>(&x);
    }

    template <>
    double
    get_scalar<t_duration, double>(t_tscalar& t) {
        return t.to_double();
    }

    template <typename T, typename F = T, typename O = T>
    val
    col_to_typed_array(std::vector<t_tscalar> data, bool column_pivot_only) {
        int start_idx = column_pivot_only ? 1 : 0;
        int data_size = data.size() - start_idx;
        std::vector<T> vals;
        vals.reserve(data.size());
        int nullSize = ceil(data_size / 64.0) * 2;
        int nullCount = 0;
        std::vector<std::uint32_t> validityMap;
        validityMap.resize(nullSize);
        for (int idx = 0; idx < data.size() - start_idx; idx++) {
            t_tscalar scalar = data[idx + start_idx];
            if (scalar.is_valid() && scalar.get_dtype() != DTYPE_NONE) {
                vals.push_back(get_scalar<F, T>(scalar));
                validityMap[idx / 32] |= 1 << (idx % 32);
            } else {
                vals.push_back({});
                nullCount++;
            }
        }
        val arr = val::global("Array").new_();
        arr.call<void>("push", typed_array<O>.new_(vector_to_typed_array(vals)["buffer"]));
        arr.call<void>("push", nullCount);
        arr.call<void>("push", vector_to_typed_array(validityMap));
        return arr;
    }

    template <>
    val
    col_to_typed_array<std::string>(std::vector<t_tscalar> data, bool column_pivot_only) {
        int start_idx = column_pivot_only ? 1 : 0;
        int data_size = data.size() - start_idx;

        t_vocab vocab;
        vocab.init(false);

        int nullSize = ceil(data_size / 64.0) * 2;
        int nullCount = 0;
        std::vector<std::uint32_t> validityMap; // = new std::uint32_t[nullSize];
        validityMap.resize(nullSize);
        val indexBuffer = js_typed_array::ArrayBuffer.new_(data_size * 4);
        val indexArray = js_typed_array::UInt32Array.new_(indexBuffer);

        for (int idx = 0; idx < data.size(); idx++) {
            t_tscalar scalar = data[idx + start_idx];
            if (scalar.is_valid() && scalar.get_dtype() != DTYPE_NONE) {
                auto adx = vocab.get_interned(scalar.to_string());
                indexArray.call<void>("fill", val(adx), idx, idx + 1);
                validityMap[idx / 32] |= 1 << (idx % 32);
            } else {
                nullCount++;
            }
        }
        val dictBuffer = js_typed_array::ArrayBuffer.new_(
            vocab.get_vlendata()->size() - vocab.get_vlenidx());
        val dictArray = js_typed_array::UInt8Array.new_(dictBuffer);
        std::vector<std::uint32_t> offsets;
        offsets.reserve(vocab.get_vlenidx() + 1);
        std::uint32_t index = 0;
        for (auto i = 0; i < vocab.get_vlenidx(); i++) {
            const char* str = vocab.unintern_c(i);
            offsets.push_back(index);
            while (*str) {
                dictArray.call<void>("fill", val(*str++), index, index + 1);
                index++;
            }
        }
        offsets.push_back(index);

        val arr = val::global("Array").new_();
        arr.call<void>("push", dictArray);
        arr.call<void>(
            "push", js_typed_array::UInt32Array.new_(vector_to_typed_array(offsets)["buffer"]));
        arr.call<void>("push", indexArray);
        arr.call<void>("push", nullCount);
        arr.call<void>("push", vector_to_typed_array(validityMap));
        return arr;
    }

    // Given a column index, serialize data to TypedArray
    template <typename T>
    val
    col_to_js_typed_array(std::shared_ptr<View<T>> view, t_index idx, bool column_pivot_only,
        t_uindex start_row, t_uindex end_row) {
        std::shared_ptr<T> ctx = view->get_context();
        std::vector<t_tscalar> data = ctx->get_data(start_row, end_row, idx, idx + 1, {});
        auto dtype = ctx->get_column_dtype(idx);

        switch (dtype) {
            case DTYPE_INT8: {
                return col_to_typed_array<std::int8_t>(data, column_pivot_only);
            } break;
            case DTYPE_INT16: {
                return col_to_typed_array<std::int16_t>(data, column_pivot_only);
            } break;
            case DTYPE_TIME: {
                return col_to_typed_array<double, t_date, std::int32_t>(
                    data, column_pivot_only);
            } break;
            case DTYPE_DURATION: {
                return col_to_typed_array<double, t_duration, std::int32_t>(
                    data, column_pivot_only);
            } break;
            case DTYPE_INT32:
            case DTYPE_UINT32: {
                return col_to_typed_array<std::uint32_t>(data, column_pivot_only);
            } break;
            case DTYPE_INT64: {
                return col_to_typed_array<std::int32_t>(data, column_pivot_only);
            } break;
            case DTYPE_FLOAT32: {
                return col_to_typed_array<float>(data, column_pivot_only);
            } break;
            case DTYPE_FLOAT64: {
                return col_to_typed_array<double>(data, column_pivot_only);
            } break;
            case DTYPE_STR: {
                return col_to_typed_array<std::string>(data, column_pivot_only);
            } break;
            default: {
                PSP_COMPLAIN_AND_ABORT("Unhandled aggregate type");
                return val::undefined();
            }
        }
    }

    void
    _fill_col_int64(val accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            val data = accessor["values"];
            // arrow packs 64 bit into two 32 bit ints
            arrow::vecFromTypedArray(data, col->get_nth<std::int64_t>(0), nrows * 2);
        } else {
            for (auto i = 0; i < nrows; ++i) {
                val item = accessor.call<val>("marshal", cidx, i, type);

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                if (item.isUndefined() || std::isnan(item.as<double>()))
                    continue;

                std::int64_t elem = std::int64_t(item.as<double>());
                col->set_nth(i, elem);
            }
            /*PSP_COMPLAIN_AND_ABORT(
                "Unreachable - can't have DTYPE_INT64 column from non-arrow data"); */
        }
    }

    void
    _fill_col_time(val accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            val data = accessor["values"];
            // arrow packs 64 bit into two 32 bit ints
            arrow::vecFromTypedArray(data, col->get_nth<double>(0), nrows);
        } else {
            for (auto i = 0; i < nrows; ++i) {
                val item = accessor.call<val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                /*auto elem = static_cast<std::int64_t>(
                    item.call<val>("getTime").as<double>()); // dcol[i].as<T>(); */
                t_time elem = jsdate_to_t_time(item);
                col->set_nth(i, elem.raw_value());
            }
        }
    }

    void
    _fill_col_duration(val accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            val data = accessor["values"];

            arrow::vecFromTypedArray(data, col->get_nth<double>(0), nrows);

            /*
            // arrow packs 64 bit into two 32 bit ints
            arrow::vecFromTypedArray(data, col->get_nth<t_time>(0), nrows * 2);

            std::int8_t unit = accessor["type"]["unit"].as<std::int8_t>();
            if (unit != 1) {
                // Slow path - need to convert each value
                std::int64_t factor = 1;
                if (unit == 3) {
                    factor = 1e6;
                } else if (unit == 2) {
                    factor = 1e3;
                }
                for (auto i = 0; i < nrows; ++i) {
                    col->set_nth<std::int64_t>(i, *(col->get_nth<std::int64_t>(i)) / factor);
                }
            }
             */
        } else {
            for (auto i = 0; i < nrows; ++i) {
                val item = accessor.call<val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                t_duration elem(item.call<val>("getHours").as<std::int32_t>(),
                            item.call<val>("getMinutes").as<std::int32_t>(),
                            item.call<val>("getSeconds").as<std::int32_t>());
                col->set_nth(i, elem.raw_value());
            }
        }
    }

    void
    _fill_col_date(val accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            val data = accessor["values"];
            //take_args(data);
            arrow::vecFromTypedArray(data, col->get_nth<std::int32_t>(0), nrows);
        } else {
            for (auto i = 0; i < nrows; ++i) {
                val item = accessor.call<val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                col->set_nth(i, jsdate_to_t_date(item));
            }
        }
    }

    void
    _fill_col_bool(val accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            // arrow packs bools into a bitmap
            val data = accessor["values"];
            for (auto i = 0; i < nrows; ++i) {
                std::uint8_t elem = data[i / 8].as<std::uint8_t>();
                bool v = elem & (1 << (i % 8));
                col->set_nth(i, v);
            }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                val item = accessor.call<val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                auto elem = item.as<bool>();
                col->set_nth(i, elem);
            }
        }
    }

    void
    _fill_col_string(val accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {

        t_uindex nrows = col->size();

        if (is_arrow) {
            if (accessor["constructor"]["name"].as<std::string>() == "DictionaryVector") {

                val dictvec = accessor["dictionary"];
                arrow::fill_col_dict(dictvec, col);

                // Now process index into dictionary

                // Perspective stores string indices in a 32bit unsigned array
                // Javascript's typed arrays handle copying from various bitwidth arrays
                // properly
                val vkeys = accessor["indices"]["values"];
                arrow::vecFromTypedArray(
                    vkeys, col->get_nth<t_uindex>(0), nrows, "Uint32Array");

            } else if (accessor["constructor"]["name"].as<std::string>() == "Utf8Vector"
                || accessor["constructor"]["name"].as<std::string>() == "BinaryVector") {

                val vdata = accessor["values"];
                std::int32_t vsize = vdata["length"].as<std::int32_t>();
                std::vector<std::uint8_t> data;
                data.reserve(vsize);
                data.resize(vsize);
                arrow::vecFromTypedArray(vdata, data.data(), vsize);

                val voffsets = accessor["valueOffsets"];
                std::int32_t osize = voffsets["length"].as<std::int32_t>();
                std::vector<std::int32_t> offsets;
                offsets.reserve(osize);
                offsets.resize(osize);
                arrow::vecFromTypedArray(voffsets, offsets.data(), osize);

                std::string elem;

                for (std::int32_t i = 0; i < nrows; ++i) {
                    std::int32_t bidx = offsets[i];
                    std::size_t es = offsets[i + 1] - bidx;
                    elem.assign(reinterpret_cast<char*>(data.data()) + bidx, es);
                    col->set_nth(i, elem);
                }
            }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                val item = accessor.call<val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                std::wstring welem = item.as<std::wstring>();
                std::wstring_convert<utf16convert_type, wchar_t> converter;
                std::string elem = converter.to_bytes(welem);
                col->set_nth(i, elem);
            }
        }
    }

    void
    _fill_col_numeric(val accessor, t_table& tbl, std::shared_ptr<t_column> col,
        std::string name, std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            val data = accessor["values"];

            switch (type) {
                case DTYPE_INT8: {
                    arrow::vecFromTypedArray(data, col->get_nth<std::int8_t>(0), nrows);
                } break;
                case DTYPE_INT16: {
                    arrow::vecFromTypedArray(data, col->get_nth<std::int16_t>(0), nrows);
                } break;
                case DTYPE_INT32: {
                    arrow::vecFromTypedArray(data, col->get_nth<std::int32_t>(0), nrows);
                } break;
                case DTYPE_FLOAT32: {
                    arrow::vecFromTypedArray(data, col->get_nth<float>(0), nrows);
                } break;
                case DTYPE_FLOAT64: {
                    arrow::vecFromTypedArray(data, col->get_nth<double>(0), nrows);
                } break;
                default:
                    break;
            }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                val item = accessor.call<val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                switch (type) {
                    case DTYPE_INT8: {
                        col->set_nth(i, item.as<std::int8_t>());
                    } break;
                    case DTYPE_INT16: {
                        col->set_nth(i, item.as<std::int16_t>());
                    } break;
                    case DTYPE_INT32: {
                        // This handles cases where a long sequence of e.g. 0 precedes a clearly
                        // float value in an inferred column. Would not be needed if the type
                        // inference checked the entire column/we could reset parsing.
                        double fval = item.as<double>();
                        if (fval > 2147483647 || fval < -2147483648) {
                            std::cout << "Promoting to float" << std::endl;
                            tbl.promote_column(name, DTYPE_FLOAT64, DATA_FORMAT_NUMBER, i, true);
                            col = tbl.get_column(name);
                            type = DTYPE_FLOAT64;
                            col->set_nth(i, fval);
                        } else if (isnan(fval)) {
                            std::cout << "Promoting to string" << std::endl;
                            tbl.promote_column(name, DTYPE_STR, DATA_FORMAT_TEXT, i, false);
                            col = tbl.get_column(name);
                            _fill_col_string(
                                accessor, col, name, cidx, DTYPE_STR, is_arrow, is_update);
                            return;
                        } else {
                            col->set_nth(i, static_cast<std::int32_t>(fval));
                        }
                    } break;
                    case DTYPE_FLOAT32: {
                        col->set_nth(i, item.as<float>());
                    } break;
                    case DTYPE_FLOAT64: {
                        col->set_nth(i, item.as<double>());
                    } break;
                    default:
                        break;
                }
            }
        }
    }

    void
    _fill_col_list(val accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
            t_uindex nrows = col->size();

        if (is_arrow) {
            val vdata = accessor["data"]["childData"][0]["values"];
            std::int32_t vsize = vdata["length"].as<std::int32_t>();

            val voffsets = accessor["valueOffsets"];
            std::int32_t osize = voffsets["length"].as<std::int32_t>();
            std::vector<std::int32_t> offsets;
            offsets.reserve(osize);
            offsets.resize(osize);
            arrow::vecFromTypedArray(voffsets, offsets.data(), osize);
            switch(type) {
                case DTYPE_LIST_INT64: {
                    std::vector<std::int64_t> data;
                    data.reserve(vsize/2);
                    data.resize(vsize/2);
                    arrow::vecFromTypedArray(vdata, data.data(), vsize);

                    for (std::int32_t i = 0; i < nrows; ++i) {
                        std::int32_t bidx = offsets[i];
                        std::int32_t eidx = offsets[i + 1];
                        std::vector<std::int64_t> elem(data.begin() + bidx, data.begin() + eidx);
                        col->set_nth(i, elem);
                    }
                } break;

                case DTYPE_LIST_DURATION:
                case DTYPE_LIST_TIME:
                case DTYPE_LIST_FLOAT64: {
                    std::vector<double> data;
                    data.reserve(vsize);
                    data.resize(vsize);
                    arrow::vecFromTypedArray(vdata, data.data(), vsize);

                    for (std::int32_t i = 0; i < nrows; ++i) {
                        std::int32_t bidx = offsets[i];
                        std::int32_t eidx = offsets[i + 1];
                        std::vector<double> elem(data.begin() + bidx, data.begin() + eidx);
                        col->set_nth(i, elem);
                    }
                } break;

                case DTYPE_LIST_DATE: {
                    std::vector<int32_t> data;
                    data.reserve(vsize);
                    data.resize(vsize);
                    arrow::vecFromTypedArray(vdata, data.data(), vsize);

                    for (std::int32_t i = 0; i < nrows; ++i) {
                        std::int32_t bidx = offsets[i];
                        std::int32_t eidx = offsets[i + 1];
                        std::vector<int32_t> elem(data.begin() + bidx, data.begin() + eidx);
                        col->set_nth(i, elem);
                    }
                } break;

                case DTYPE_LIST_BOOL: {
                    vsize = offsets[nrows];
                    std::vector<bool> data;
                    data.reserve(vsize);
                    data.resize(vsize);
                    for (t_uindex i = 0; i < vsize; ++i) {
                        std::uint8_t elem = vdata[i / 8].as<std::uint8_t>();
                        bool v = elem & (1 << (i % 8));
                        data[i] = v;
                    }

                    for (std::int32_t i = 0; i < nrows; ++i) {
                        std::int32_t bidx = offsets[i];
                        std::int32_t eidx = offsets[i + 1];
                        std::vector<bool> elem(data.begin() + bidx, data.begin() + eidx);
                        col->set_nth(i, elem);
                    }
                } break;

                case DTYPE_LIST_STR: {
                    std::vector<std::uint8_t> data;
                    data.reserve(vsize);
                    data.resize(vsize);
                    arrow::vecFromTypedArray(vdata, data.data(), vsize);

                    val vsuboffsets = accessor["data"]["childData"][0]["valueOffsets"];
                    std::int32_t osubsize = vsuboffsets["length"].as<std::int32_t>();
                    std::vector<std::int32_t> sub_offsets;
                    sub_offsets.reserve(osubsize);
                    sub_offsets.resize(osubsize);
                    arrow::vecFromTypedArray(vsuboffsets, sub_offsets.data(), osubsize);

                    std::int32_t curr_idx = 0;

                    for (std::int32_t i = 0; i < nrows; ++i) {
                        std::vector<std::string> elem;
                        std::int32_t bidx = offsets[i];
                        std::int32_t eidx = offsets[i + 1];

                        for (std::int32_t idx = curr_idx; idx < osubsize; ++idx) {
                            if (sub_offsets[idx] >= eidx) {
                                curr_idx = idx;
                                break;
                            }
                            std::string item;
                            std::int32_t sub_bidx = sub_offsets[idx];
                            std::int32_t sub_es = sub_offsets[idx + 1] - sub_bidx;
                            item.assign(reinterpret_cast<char*>(data.data()) + sub_bidx, sub_es);
                            elem.push_back(item);
                        }
                        col->set_nth(i, elem);
                    }
                } break;
                default: {}
            }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                int list_size = accessor.call<val>("list_size", cidx, i, type).as<int>();
                if (list_size == 0) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }
                switch (type) {
                    case DTYPE_LIST_STR: {
                        std::vector<std::string> value;
                        for (auto j = 0; j < list_size; ++j) {
                            val item = accessor.call<val>("marshal", cidx, i, type, j);

                            if (item.isUndefined() || item.isNull())
                                continue;

                            std::wstring welem = item.as<std::wstring>();
                            std::wstring_convert<utf16convert_type, wchar_t> converter;
                            std::string elem = converter.to_bytes(welem);
                            value.push_back(elem);
                        }
                        col->set_nth(i, value);

                    } break;
                    case DTYPE_LIST_BOOL: {
                        std::vector<bool> value;
                        for (auto j = 0; j < list_size; ++j) {
                            val item = accessor.call<val>("marshal", cidx, i, type, j);

                            if (item.isUndefined() || item.isNull())
                                continue;

                            value.push_back(item.as<bool>());
                        }
                        col->set_nth(i, value);
                    } break;
                    case DTYPE_LIST_INT64: {
                        std::vector<std::int64_t> value;
                        for (auto j = 0; j < list_size; ++j) {
                            val item = accessor.call<val>("marshal", cidx, i, type, j);

                            if (item.isUndefined() || item.isNull())
                                continue;

                            std::int64_t fval = std::int64_t(item.as<double>());
                            value.push_back(fval);
                        }
                        col->set_nth(i, value);
                    } break;
                    case DTYPE_LIST_FLOAT64: {
                        std::vector<double> value;
                        for (auto j = 0; j < list_size; ++j) {
                            val item = accessor.call<val>("marshal", cidx, i, type, j);

                            if (item.isUndefined() || item.isNull())
                                continue;

                            double fval = item.as<double>();
                            value.push_back(fval);
                        }
                        col->set_nth(i, value);
                    } break;
                    case DTYPE_LIST_DATE: {
                        std::vector<t_date> value;
                        for (auto j = 0; j < list_size; ++j) {
                            val item = accessor.call<val>("marshal", cidx, i, type, j);

                            if (item.isUndefined() || item.isNull())
                                continue;

                            value.push_back(jsdate_to_t_date(item));
                        }
                        col->set_nth(i, value);
                    } break;
                    case DTYPE_LIST_TIME: {
                        std::vector<t_time> value;
                        for (auto j = 0; j < list_size; ++j) {
                            val item = accessor.call<val>("marshal", cidx, i, type, j);

                            if (item.isUndefined() || item.isNull())
                                continue;

                            t_time elem = jsdate_to_t_time(item);
                            value.push_back(elem);
                        }
                        col->set_nth(i, value);
                    } break;
                    case DTYPE_LIST_DURATION: {
                        std::vector<t_duration> value;
                        for (auto j = 0; j < list_size; ++j) {
                            val item = accessor.call<val>("marshal", cidx, i, type, j);

                            if (item.isUndefined() || item.isNull())
                                continue;

                            t_duration elem(item.call<val>("getHours").as<std::int32_t>(),
                                            item.call<val>("getMinutes").as<std::int32_t>(),
                                            item.call<val>("getSeconds").as<std::int32_t>());
                            value.push_back(elem);
                        }
                        col->set_nth(i, value);
                    } break;
                    default:
                        break;
                }
            }
        }
    }

    void
    _fill_col_decimal(val accessor, std::shared_ptr<t_column> col, std::string name,
        std::int32_t cidx, t_dtype type, bool is_arrow, bool is_update) {
        t_uindex nrows = col->size();

        if (is_arrow) {
            val vdata = accessor["values"];
            std::int32_t vsize = vdata["length"].as<std::int32_t>();
            std::vector<std::uint8_t> data;
            data.reserve(vsize);
            data.resize(vsize);
            arrow::vecFromTypedArray(vdata, data.data(), vsize);

            val voffsets = accessor["valueOffsets"];
            std::int32_t osize = voffsets["length"].as<std::int32_t>();
            std::vector<std::int32_t> offsets;
            offsets.reserve(osize);
            offsets.resize(osize);
            arrow::vecFromTypedArray(voffsets, offsets.data(), osize);

            std::string elem;

            for (std::int32_t i = 0; i < nrows; ++i) {
                std::int32_t bidx = offsets[i];
                std::size_t es = offsets[i + 1] - bidx;
                elem.assign(reinterpret_cast<char*>(data.data()) + bidx, es);
                t_decimal value(elem);
                col->set_nth(i, value);
            }
        } else {
            for (auto i = 0; i < nrows; ++i) {
                val item = accessor.call<val>("marshal", cidx, i, type);

                if (item.isUndefined())
                    continue;

                if (item.isNull()) {
                    if (is_update) {
                        col->unset(i);
                    } else {
                        col->clear(i);
                    }
                    continue;
                }

                std::wstring welem = item.as<std::wstring>();
                std::wstring_convert<utf16convert_type, wchar_t> converter;
                std::string elem = converter.to_bytes(welem);
                t_decimal value(elem);
                col->set_nth(i, value);
            }
        }
    }

    /**
     * Fills the column with data from Javascript.
     *
     * Params
     * ------
     * tbl - pointer to the table object
     * ocolnames - vector of column names
     * accessor - the JS data accessor interface
     * odt - vector of data types
     * offset
     * is_arrow - flag for arrow data
     * name - name of column
     * cidx - index of column
     *
     * Returns
     * -------
     *
     */

    void
    _fill_col_data(t_table& tbl, std::vector<std::string> ocolnames, val accessor,
        std::vector<t_dtype> odt, std::uint32_t offset, bool is_arrow, bool is_update,
        std::string name, t_index cidx, std::shared_ptr<t_column> error_col) {

        auto col = tbl.get_column(name);
        auto col_type = odt[cidx];

        val dcol = val::undefined();

        if (is_arrow) {
            dcol = accessor["cdata"][cidx];
        } else {
            dcol = accessor;
        }

        switch (col_type) {
            case DTYPE_INT64: {
                _fill_col_int64(dcol, col, name, cidx, col_type, is_arrow, is_update);
            } break;
            case DTYPE_BOOL: {
                _fill_col_bool(dcol, col, name, cidx, col_type, is_arrow, is_update);
            } break;
            case DTYPE_DATE: {
                _fill_col_date(dcol, col, name, cidx, col_type, is_arrow, is_update);
            } break;
            case DTYPE_TIME: {
                _fill_col_time(dcol, col, name, cidx, col_type, is_arrow, is_update);
            } break;
            case DTYPE_DURATION: {
                _fill_col_duration(dcol, col, name, cidx, col_type, is_arrow, is_update);
            } break;
            case DTYPE_STR: {
                _fill_col_string(dcol, col, name, cidx, col_type, is_arrow, is_update);
            } break;
            case DTYPE_LIST_STR:
            case DTYPE_LIST_BOOL:
            case DTYPE_LIST_DATE:
            case DTYPE_LIST_TIME:
            case DTYPE_LIST_DURATION:
            case DTYPE_LIST_FLOAT64:
            case DTYPE_LIST_INT64: {
                _fill_col_list(dcol, col, name, cidx, col_type, is_arrow, is_update);
            } break;
            case DTYPE_DECIMAL: {
                _fill_col_decimal(dcol, col, name, cidx, col_type, is_arrow, is_update);
            } break;
            case DTYPE_NONE: {
                break;
            }
            default:
                _fill_col_numeric(
                    dcol, tbl, col, name, cidx, col_type, is_arrow, is_update);
        }

        if (is_arrow) {
            // Fill validity bitmap
            std::uint32_t null_count = dcol["nullCount"].as<std::uint32_t>();

            if (null_count == 0) {
                col->valid_raw_fill();
            } else {
                val validity = dcol["nullBitmap"];
                arrow::fill_col_valid(validity, col, cidx, error_col);
            }
        }
    }

    /**
     * Fills the table with data from Javascript.
     *
     * Params
     * ------
     * tbl - pointer to the table object
     * ocolnames - vector of column names
     * accessor - the JS data accessor interface
     * odt - vector of data types
     * offset
     * is_arrow - flag for arrow data
     *
     * Returns
     * -------
     *
     */
    void
    _fill_data(t_table& tbl, std::vector<std::string> ocolnames, val accessor,
        std::vector<t_dtype> odt, std::uint32_t offset, bool is_arrow, bool is_update) {
        std::shared_ptr<t_column> error_col = nullptr;

        std::vector<std::string>::iterator it = std::find(ocolnames.begin(), ocolnames.end(), ERROR_COLUMN);
        if (it != ocolnames.end()) {
            t_index error_cidx = std::distance(ocolnames.begin(), it);
            _fill_col_data(tbl, ocolnames, accessor, odt, offset, is_arrow, is_update, ERROR_COLUMN, error_cidx, error_col);
            error_col = tbl.get_column(ERROR_COLUMN);
        }

        for (auto cidx = 0; cidx < ocolnames.size(); ++cidx) {
            auto name = ocolnames[cidx];
            if (name == ERROR_COLUMN) {
                continue;
            }
            _fill_col_data(tbl, ocolnames, accessor, odt, offset, is_arrow, is_update, name, cidx, error_col);
        }
    }

    /******************************************************************************
     *
     * Public
     */
    template <>
    void
    set_column_nth(t_column* col, t_uindex idx, val value) {

        // Check if the value is a javascript null
        if (value.isNull()) {
            col->unset(idx);
            return;
        }

        switch (col->get_dtype()) {
            case DTYPE_BOOL: {
                col->set_nth<bool>(idx, value.as<bool>(), STATUS_VALID);
                break;
            }
            case DTYPE_FLOAT64: {
                col->set_nth<double>(idx, value.as<double>(), STATUS_VALID);
                break;
            }
            case DTYPE_FLOAT32: {
                col->set_nth<float>(idx, value.as<float>(), STATUS_VALID);
                break;
            }
            case DTYPE_UINT32: {
                col->set_nth<std::uint32_t>(idx, value.as<std::uint32_t>(), STATUS_VALID);
                break;
            }
            case DTYPE_UINT64: {
                col->set_nth<std::uint64_t>(idx, value.as<std::uint64_t>(), STATUS_VALID);
                break;
            }
            case DTYPE_INT32: {
                col->set_nth<std::int32_t>(idx, value.as<std::int32_t>(), STATUS_VALID);
                break;
            }
            case DTYPE_INT64: {
                col->set_nth<std::int64_t>(idx, std::int64_t(value.as<double>()), STATUS_VALID);
                break;
            }
            case DTYPE_STR: {
                std::wstring welem = value.as<std::wstring>();

                std::wstring_convert<utf16convert_type, wchar_t> converter;
                std::string elem = converter.to_bytes(welem);
                col->set_nth(idx, elem, STATUS_VALID);
                break;
            }
            case DTYPE_DATE: {
                col->set_nth<std::int32_t>(idx, static_cast<std::int32_t>(value.as<std::int32_t>()), STATUS_VALID);
                break;
            }
            case DTYPE_TIME: {
                col->set_nth<double>(
                    idx, static_cast<double>(value.as<double>()), STATUS_VALID);
                break;
            }
            case DTYPE_DURATION: {
                col->set_nth<double>(
                    idx, static_cast<double>(value.as<double>()), STATUS_VALID);
                break;
            }
            case DTYPE_LIST_BOOL: {
                std::vector<std::int8_t> temp_vec = value.as<std::vector<std::int8_t>>();
                std::vector<bool> value_vec;
                for (t_uindex idx = 0, loop_end = temp_vec.size(); idx < loop_end; ++idx) {
                    value_vec.push_back(bool(temp_vec[idx]));
                }
                col->set_nth<std::vector<bool>>(
                    idx, value_vec, STATUS_VALID);
                break;
            }
            case DTYPE_LIST_INT64: {
                std::vector<double> temp_vec = value.as<std::vector<double>>();
                std::vector<std::int64_t> value_vec{};
                for (t_uindex idx = 0, loop_end = temp_vec.size(); idx < loop_end; ++idx) {
                    value_vec.push_back(std::int64_t(temp_vec[idx]));
                }
                col->set_nth<std::vector<std::int64_t>>(
                    idx, value_vec, STATUS_VALID);
                break;
            }
            case DTYPE_LIST_FLOAT64: {
                col->set_nth<std::vector<double>>(
                    idx, value.as<std::vector<double>>(), STATUS_VALID);
                break;
            }
            case DTYPE_LIST_DATE: {
                std::vector<std::int32_t> temp_vec = value.as<std::vector<std::int32_t>>();
                std::vector<t_date> value_vec{};
                for (t_uindex idx = 0, loop_end = temp_vec.size(); idx < loop_end; ++idx) {
                    value_vec.push_back(t_date(temp_vec[idx]));
                }
                col->set_nth<std::vector<t_date>>(
                    idx, value_vec, STATUS_VALID);
                break;
            }
            case DTYPE_LIST_TIME: {
                std::vector<double> temp_vec = value.as<std::vector<double>>();
                std::vector<t_time> value_vec{};
                for (t_uindex idx = 0, loop_end = temp_vec.size(); idx < loop_end; ++idx) {
                    value_vec.push_back(t_time(temp_vec[idx]));
                }
                col->set_nth<std::vector<t_time>>(
                    idx, value_vec, STATUS_VALID);
                break;
            }
            case DTYPE_LIST_DURATION: {
                std::vector<double> temp_vec = value.as<std::vector<double>>();
                std::vector<t_duration> value_vec{};
                for (t_uindex idx = 0, loop_end = temp_vec.size(); idx < loop_end; ++idx) {
                    value_vec.push_back(t_duration(temp_vec[idx]));
                }
                col->set_nth<std::vector<t_duration>>(
                    idx, value_vec, STATUS_VALID);
                break;
            }
            case DTYPE_LIST_STR: {
                col->set_nth<std::vector<std::string>>(
                    idx, value.as<std::vector<std::string>>(), STATUS_VALID);
                break;
            }
            case DTYPE_UINT8:
            case DTYPE_UINT16:
            case DTYPE_INT8:
            case DTYPE_INT16:
            default: {
                // Other types not implemented
            }
        }
    }

    /**
     * Helper function for computed columns
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    template <>
    void
    table_add_computed_column(t_table& table, val computed_defs) {

        std::cout << "table_add_computed_column---" << std::endl;
        
        auto vcomputed_defs = vecFromArray<val, val>(computed_defs);
        for (auto i = 0; i < vcomputed_defs.size(); ++i) {
            val coldef = vcomputed_defs[i];
            std::string name = coldef["column"].as<std::string>();
            val inputs = coldef["inputs"];
            val func = coldef["func"];
            val type = coldef["type"];
            val dataformattype = coldef["df_type"];

            std::string stype;

            if (type.isUndefined()) {
                stype = "string";
            } else {
                stype = type.as<std::string>();
            }

            t_dtype dtype;
            if (stype == "integer") {
                dtype = DTYPE_INT64;
            } else if (stype == "float") {
                dtype = DTYPE_FLOAT64;
            } else if (stype == "boolean") {
                dtype = DTYPE_BOOL;
            } else if (stype == "date") {
                dtype = DTYPE_DATE;
            } else if (stype == "datetime") {
                dtype = DTYPE_TIME;
            } else if (stype == "duration") {
                dtype = DTYPE_DURATION;
            } else if (stype == "list_integer") {
                dtype = DTYPE_LIST_INT64;
            } else if (stype == "list_float") {
                dtype = DTYPE_LIST_FLOAT64;
            } else if (stype == "list_boolean") {
                dtype = DTYPE_LIST_BOOL;
            } else if (stype == "list_date") {
                dtype = DTYPE_LIST_DATE;
            } else if (stype == "list_datetime") {
                dtype = DTYPE_LIST_TIME;
            } else if (stype == "list_duration") {
                dtype = DTYPE_LIST_DURATION;
            } else if (stype == "list_string") {
                dtype = DTYPE_LIST_STR;
            } else {
                dtype = DTYPE_STR;
            }

            std::string sdftype;

            if (dataformattype.isUndefined()) {
                sdftype = "text";
            } else {
                sdftype = dataformattype.as<std::string>();
            }

            t_dataformattype dftype;
            if (sdftype == "text") {
                dftype = DATA_FORMAT_TEXT;
            } else if (sdftype == "yes/no") {
                dftype = DATA_FORMAT_YES_NO;
            } else if (sdftype == "true/false") {
                dftype = DATA_FORMAT_TRUE_FALSE;
            } else if (sdftype == "number") {
                dftype = DATA_FORMAT_NUMBER;
            } else if (sdftype == "financial") {
                dftype = DATA_FORMAT_FINANCIAL;
            } else if (sdftype == "date v1") {
                dftype = DATA_FORMAT_DATE_V1;
            } else if (sdftype == "date v2") {
                dftype = DATA_FORMAT_DATE_V2;
            } else if (sdftype == "date v3") {
                dftype = DATA_FORMAT_DATE_V3;
            } else if (sdftype == "duration") {
                dftype = DATA_FORMAT_DURATION;
            } else if (sdftype == "time") {
                dftype = DATA_FORMAT_TIME;
            } else if (sdftype == "datetime") {
                dftype = DATA_FORMAT_DATETIME;
            } else if (sdftype == "percent") {
                dftype = DATA_FORMAT_PERCENT;
            } else if (sdftype == "quarter") {
                dftype = DATA_FORMAT_QUARTER;
            } else if (sdftype == "week") {
                dftype = DATA_FORMAT_WEEK;
            } else if (sdftype == "month") {
                dftype = DATA_FORMAT_MONTH;
            } else if (sdftype == "day v1") {
                dftype = DATA_FORMAT_DAY_V1;
            } else if (sdftype == "day v2") {
                dftype = DATA_FORMAT_DAY_V2;
            } else if (sdftype == "day v3") {
                dftype = DATA_FORMAT_DAY_V3;
            } else {
                dftype = get_default_data_format_type(dtype);
            }

            // Get list of input column names
            auto icol_names = vecFromArray<val, std::string>(inputs);

            // Get t_column* for all input columns
            std::vector<const t_column*> icols;
            for (const auto& cc : icol_names) {
                icols.push_back(table._get_column(cc));
            }

            int arity = icols.size();

            // Add new column
            t_column* out = table.add_column(name, dtype, true, dftype);

            val i1 = val::undefined(), i2 = val::undefined(), i3 = val::undefined(),
                i4 = val::undefined();

            t_uindex size = table.size();
            for (t_uindex ridx = 0; ridx < size; ++ridx) {
                val value = val::undefined();

                switch (arity) {
                    case 0: {
                        value = func();
                        break;
                    }
                    case 1: {
                        i1 = scalar_to_val(icols[0]->get_scalar(ridx));
                        if (!i1.isNull()) {
                            value = func(i1);
                        }
                        break;
                    }
                    case 2: {
                        i1 = scalar_to_val(icols[0]->get_scalar(ridx));
                        i2 = scalar_to_val(icols[1]->get_scalar(ridx));
                        if (!i1.isNull() && !i2.isNull()) {
                            value = func(i1, i2);
                        }
                        break;
                    }
                    case 3: {
                        i1 = scalar_to_val(icols[0]->get_scalar(ridx));
                        i2 = scalar_to_val(icols[1]->get_scalar(ridx));
                        i3 = scalar_to_val(icols[2]->get_scalar(ridx));
                        if (!i1.isNull() && !i2.isNull() && !i3.isNull()) {
                            value = func(i1, i2, i3);
                        }
                        break;
                    }
                    case 4: {
                        i1 = scalar_to_val(icols[0]->get_scalar(ridx));
                        i2 = scalar_to_val(icols[1]->get_scalar(ridx));
                        i3 = scalar_to_val(icols[2]->get_scalar(ridx));
                        i4 = scalar_to_val(icols[3]->get_scalar(ridx));
                        if (!i1.isNull() && !i2.isNull() && !i3.isNull() && !i4.isNull()) {
                            value = func(i1, i2, i3, i4);
                        }
                        break;
                    }
                    default: {
                        // Don't handle other arity values
                        break;
                    }
                }

                if (!value.isUndefined()) {
                    set_column_nth(out, ridx, value);
                }
            }
        }
    }

    /**
     * DataAccessor
     *
     * parses and converts input data into a canonical format for
     * interfacing with Perspective.
     */

    // Name parsing
    std::vector<std::string>
    column_names(val data, std::int32_t format) {
        std::vector<std::string> names;
        val Object = val::global("Object");

        if (format == 0) {
            if (data[0].isUndefined() || data[0].isNull()) {
                return names;
            }
            std::int32_t max_check = 50;
            val data_names = Object.call<val>("keys", data[0]);
            names = vecFromArray<val, std::string>(data_names);
            std::int32_t check_index = std::min(max_check, data["length"].as<std::int32_t>());

            for (auto ix = 0; ix < check_index; ix++) {
                val next = Object.call<val>("keys", data[ix]);

                if (names.size() != next["length"].as<std::int32_t>()) {
                    auto old_size = names.size();
                    auto new_names = vecFromJSArray<std::string>(next);
                    if (max_check == 50) {
                        std::cout << "Data parse warning: Array data has inconsistent rows"
                                  << std::endl;
                    }

                    for (auto s = new_names.begin(); s != new_names.end(); ++s) {
                        if (std::find(names.begin(), names.end(), *s) == names.end()) {
                            names.push_back(*s);
                        }
                    }

                    std::cout << "Extended from " << old_size << "to " << names.size()
                              << std::endl;
                    max_check *= 2;
                }
            }
        } else if (format == 1 || format == 2) {
            val keys = Object.call<val>("keys", data);
            names = vecFromArray<val, std::string>(keys);
        }
        return names;
    }

    // Type inferrence for fill_col and data_types
    t_dtype
    infer_type(val x, val date_validator, val time_validator, val date_time_validator) {
        std::string jstype = x.typeOf().as<std::string>();
        t_dtype t = t_dtype::DTYPE_STR;

        // Unwrap numbers inside strings
        val x_number = val::global("Number").call<val>("call", val::object(), x);
        bool number_in_string = (jstype == "string") && (x["length"].as<std::int32_t>() != 0)
            && (!val::global("isNaN").call<bool>("call", val::object(), x_number));

        if (x.isNull()) {
            t = t_dtype::DTYPE_NONE;
        } else if (jstype == "number" || number_in_string) {
            if (number_in_string) {
                x = x_number;
            }
            double x_float64 = x.as<double>();
            //if ((std::fmod(x_float64, 1.0) == 0.0) && (x_float64 < 10000.0)
            if (((int64_t)x_float64 == x_float64) && (x_float64 != 0.0)) {
                //t = t_dtype::DTYPE_INT32;
                t = t_dtype::DTYPE_INT64;
            } else {
                t = t_dtype::DTYPE_FLOAT64;
                //t = t_dtype::DTYPE_DECIMAL;
            }
        } else if (jstype == "boolean") {
            t = t_dtype::DTYPE_BOOL;
        } else if (x.instanceof (val::global("Date"))) {
            std::int32_t hours = x.call<val>("getHours").as<std::int32_t>();
            std::int32_t minutes = x.call<val>("getMinutes").as<std::int32_t>();
            std::int32_t seconds = x.call<val>("getSeconds").as<std::int32_t>();
            std::int32_t milliseconds = x.call<val>("getMilliseconds").as<std::int32_t>();
            std::int32_t year = x.call<val>("getFullYear").as<std::int32_t>();
            std::int32_t month = x.call<val>("getMonth").as<std::int32_t>() + 1;
            std::int32_t date = x.call<val>("getDate").as<std::int32_t>();

            if (hours == 0 && minutes == 0 && seconds == 0 && milliseconds == 0) {
                t = t_dtype::DTYPE_DATE;
            } else if (year == 1900 && month == 0 && date == 0) {
                t = t_dtype::DTYPE_DURATION;
            } else {
                t = t_dtype::DTYPE_TIME;
            }
        } else if (jstype == "string") {
            if (date_validator.call<val>("call", val::object(), x).as<bool>()) {
                t = t_dtype::DTYPE_DATE;
            } else if (time_validator.call<val>("call", val::object(), x).as<bool>()) {
                t = t_dtype::DTYPE_DURATION;
            } else if (date_time_validator.call<val>("call", val::object(), x).as<bool>()) {
                t = t_dtype::DTYPE_TIME;
            } else {
                std::string lower = x.call<val>("toLowerCase").as<std::string>();
                if (lower == "true" || lower == "false") {
                    t = t_dtype::DTYPE_BOOL;
                } else {
                    t = t_dtype::DTYPE_STR;
                }
            }
        } else if (jstype == "object") {
            std::int32_t i = 0;
            boost::optional<t_dtype> inferredType;
            while (!inferredType.is_initialized() && i < 100
                && i < x["length"].as<std::int32_t>()) {
                if (!x[i].isNull()) {
                    inferredType = infer_type(x[i], date_validator, time_validator, date_time_validator);
                } else {
                    inferredType = t_dtype::DTYPE_STR;
                }

                i++;
            }
            if (!inferredType.is_initialized()) {
                t = t_dtype::DTYPE_LIST_STR;
            } else {
                switch (inferredType.get())
                {
                case t_dtype::DTYPE_BOOL:
                    t = t_dtype::DTYPE_LIST_BOOL;
                    break;

                case t_dtype::DTYPE_TIME:
                    t = t_dtype::DTYPE_LIST_TIME;
                    break;

                case t_dtype::DTYPE_DATE:
                    t = t_dtype::DTYPE_LIST_DATE;
                    break;

                case t_dtype::DTYPE_DURATION:
                    t = t_dtype::DTYPE_LIST_DURATION;
                    break;

                case t_dtype::DTYPE_FLOAT64:
                    t = t_dtype::DTYPE_LIST_FLOAT64;
                    break;

                case t_dtype::DTYPE_INT32:
                case t_dtype::DTYPE_INT64:
                    t = t_dtype::DTYPE_LIST_INT64;
                    break;

                default:
                    t = t_dtype::DTYPE_LIST_STR;
                    break;
                }
            }
        }

        return t;
    }

    t_dtype
    get_data_type(val data, std::int32_t format, const std::string& name, val date_validator, val time_validator, val date_time_validator) {
        std::int32_t i = 0;
        boost::optional<t_dtype> inferredType;

        if (format == 0) {
            // loop parameters differ slightly so rewrite the loop
            while (!inferredType.is_initialized() && i < 100
                && i < data["length"].as<std::int32_t>()) {
                if (data[i].call<val>("hasOwnProperty", name).as<bool>() == true) {
                    if (!data[i][name].isNull()) {
                        inferredType = infer_type(data[i][name], date_validator, time_validator, date_time_validator);
                    } else {
                        inferredType = t_dtype::DTYPE_STR;
                    }
                }

                i++;
            }
        } else if (format == 1) {
            while (!inferredType.is_initialized() && i < 100
                && i < data[name]["length"].as<std::int32_t>()) {
                if (!data[name][i].isNull()) {
                    inferredType = infer_type(data[name][i], date_validator, time_validator, date_time_validator);
                } else {
                    inferredType = t_dtype::DTYPE_STR;
                }

                i++;
            }
        }

        if (!inferredType.is_initialized()) {
            return t_dtype::DTYPE_STR;
        } else {
            return inferredType.get();
        }
    }

    std::vector<t_dtype>
    data_types(val data, std::int32_t format, const std::vector<std::string>& names,
        val date_validator, val time_validator, val date_time_validator) {
        if (names.size() == 0) {
            PSP_COMPLAIN_AND_ABORT("Cannot determine data types without column names!");
        }

        std::vector<t_dtype> types;

        if (format == 2) {
            val keys = val::global("Object").template call<val>("keys", data);
            std::vector<std::string> data_names = vecFromArray<val, std::string>(keys);

            for (const std::string& name : data_names) {
                std::string value = data[name].as<std::string>();
                t_dtype type;

                if (value == "integer") {
                    type = t_dtype::DTYPE_INT64;
                } else if (value == "float") {
                    type = t_dtype::DTYPE_FLOAT64;
                } else if (value == "string") {
                    type = t_dtype::DTYPE_STR;
                } else if (value == "boolean") {
                    type = t_dtype::DTYPE_BOOL;
                } else if (value == "datetime") {
                    type = t_dtype::DTYPE_TIME;
                } else if (value == "duration") {
                    type = t_dtype::DTYPE_DURATION;
                } else if (value == "date") {
                    type = t_dtype::DTYPE_DATE;
                } else {
                    PSP_COMPLAIN_AND_ABORT(
                        "Unknown type '" + value + "' for key '" + name + "'");
                }

                types.push_back(type);
            }

            return types;
        } else {
            for (const std::string& name : names) {
                t_dtype type = get_data_type(data, format, name, date_validator, time_validator, date_time_validator);
                types.push_back(type);
            }
        }

        return types;
    }

    /**
     * Create a default gnode.
     *
     * Params
     * ------
     * j_colnames - a JS Array of column names.
     * j_dtypes - a JS Array of column types.
     *
     * Returns
     * -------
     * A gnode.
     */
    std::shared_ptr<t_gnode>
    make_gnode(const t_schema& iscm) {
        std::vector<std::string> ocolnames(iscm.columns());
        std::vector<t_dtype> odt(iscm.types());
        std::vector<t_dataformattype> dftypes(iscm.data_format_types());

        if (iscm.has_column("psp_pkey")) {
            t_uindex idx = iscm.get_colidx("psp_pkey");
            ocolnames.erase(ocolnames.begin() + idx);
            odt.erase(odt.begin() + idx);
            dftypes.erase(dftypes.begin() + idx);
        }

        if (iscm.has_column("psp_op")) {
            t_uindex idx = iscm.get_colidx("psp_op");
            ocolnames.erase(ocolnames.begin() + idx);
            odt.erase(odt.begin() + idx);
            dftypes.erase(dftypes.begin() + idx);
        }

        t_schema oscm(ocolnames, odt, dftypes);

        // Create a gnode
        auto gnode = std::make_shared<t_gnode>(oscm, iscm);
        gnode->init();

        return gnode;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::vector<t_dataformattype>
    get_data_format_types_from_dtype(std::vector<t_dtype> dtypes) {
        std::vector<t_dataformattype> dftypes{};

        for (t_uindex idx = 0, loop_end = dtypes.size(); idx < loop_end; ++idx) {
            dftypes.push_back(get_default_data_format_type(dtypes[idx]));
        }

        return dftypes;
    }

    /**
     * Create a populated table.
     *
     * Params
     * ------
     * chunk - a JS object containing parsed data and associated metadata
     * offset
     * limit
     * index
     * is_delete - sets the table operation
     *
     * Returns
     * -------
     * a populated table.
     */
    template <>
    std::shared_ptr<t_gnode>
    make_table(t_pool* pool, val gnode, val accessor, val computed, std::uint32_t offset,
        std::uint32_t limit, std::string index, bool is_update, bool is_delete, bool is_arrow) {

        MEM_REPORT("call make_table()");

        const std::uint32_t size = accessor["row_count"].as<std::int32_t>();

        std::vector<std::string> colnames;
        std::vector<t_dtype> dtypes;

        // Determine metadata
        if (is_arrow || (is_update || is_delete)) {
            // TODO: fully remove intermediate passed-through JS arrays for non-arrow data
            val names = accessor["names"];
            val types = accessor["types"];
            colnames = vecFromArray<val, std::string>(names);
            dtypes = vecFromArray<val, t_dtype>(types);
        } else {
            // Infer names and types
            val data = accessor["data"];
            const std::int32_t format = accessor["format"].as<std::int32_t>();
            colnames = column_names(data, format);
            dtypes = data_types(data, format, colnames, accessor["date_validator"], accessor["time_validator"], accessor["date_time_validator"]);
        }

        const std::vector<t_dataformattype> dftypes = get_data_format_types_from_dtype(dtypes);

        // Check if index is valid after getting column names
        const bool valid_index = std::find(colnames.begin(), colnames.end(), index) != colnames.end();
        if (index != "" && !valid_index) {
            PSP_COMPLAIN_AND_ABORT("Specified index '" + index + "' does not exist in data.")
        }

        const bool is_new_gnode = gnode.isUndefined();
        std::shared_ptr<t_gnode> new_gnode;
        if (!is_new_gnode) {
            new_gnode = gnode.as<std::shared_ptr<t_gnode>>();
        }

        // GAB: enclose the local table creation in a block, so that the table is released at
        // end of the block, before calling pool->process()  (the table is no more needed at that point
        // as it have been already copied in the pool)
        {
            // Create the table
            // TODO assert size > 0
            t_table tbl(t_schema(colnames, dtypes, dftypes));
            tbl.init();
            tbl.extend(size);

            MEM_REPORT("make_table() / local table have been created and extended to the number of rows");

            _fill_data(tbl, colnames, accessor, dtypes, offset, is_arrow,
                !(is_new_gnode || new_gnode->mapping_size() == 0));

            MEM_REPORT("make_table() / local table have been filled with input data");

            // Set up pkey and op columns
            if (is_delete) {
                auto op_col = tbl.add_column("psp_op", DTYPE_UINT8, false, DATA_FORMAT_NUMBER);
                op_col->raw_fill<std::uint8_t>(OP_DELETE);
            } else {
                auto op_col = tbl.add_column("psp_op", DTYPE_UINT8, false, DATA_FORMAT_NUMBER);
                op_col->raw_fill<std::uint8_t>(OP_INSERT);
            }

//            GAB: Test to let PSP generate rownum and rowncount column, instead of Ingest
//            => Not really better in the end
//            auto rownum_col = tbl.add_column("__rownum__", DTYPE_INT32, true, DATA_FORMAT_NUMBER);
//            for (auto ridx = 0; ridx < tbl.size(); ++ridx) {
//                rownum_col->set_nth<std::int32_t>(ridx, (std::int32_t)(2+ridx));
//            }
//            auto count_col = tbl.add_column("__count__", DTYPE_INT8, true, DATA_FORMAT_NUMBER);
//            for (auto ridx = 0; ridx < tbl.size(); ++ridx) {
//                count_col->set_nth<std::int8_t>(ridx,(std::int8_t)1);
//            }

            if (index == "") {
                // If user doesn't specify an column to use as the pkey index, just use
                // row number
                auto key_col = tbl.add_column("psp_pkey", DTYPE_INT32, false, DATA_FORMAT_NUMBER);

                for (auto ridx = 0; ridx < tbl.size(); ++ridx) {
                    key_col->set_nth<std::int32_t>(ridx, (ridx + offset) % limit);
                }
            } else {
                tbl.clone_column(index, "psp_pkey");
            }

std::cout << "---------make_table--------" << std::endl;
            if (!computed.isUndefined()) {
                table_add_computed_column(tbl, computed);
            }

            if (is_new_gnode) {
                new_gnode = make_gnode(tbl.get_schema());
                pool->register_gnode(new_gnode.get());
            }

            MEM_REPORT("make_table() / psp_op,psp_pkey columns have been added to the local table");

            pool->send(new_gnode->get_id(), 0, tbl);
        }

        MEM_REPORT("make_table() / local table have been released");

        pool->_process();

        MEM_REPORT("make_table() / flatenned table now released ");

        MEM_REPORT("quit make_table()");

        return new_gnode;
    }

    /**
     * Copies the internal table from a gnode
     *
     * Params
     * ------
     *
     * Returns
     * -------
     * A gnode.
     */
    template <>
    std::shared_ptr<t_gnode>
    clone_gnode_table(t_pool* pool, std::shared_ptr<t_gnode> gnode, val computed) {
        t_table* raw_tbl = gnode->get_table();
        t_table* tbl = gnode->_get_pkeyed_table();
        table_add_computed_column(*tbl, computed);
        std::shared_ptr<t_gnode> new_gnode = make_gnode(tbl->get_schema());
        pool->register_gnode(new_gnode.get());
        pool->send(new_gnode->get_id(), 0, *tbl);
        pool->_process();
        t_table* gnode_tbl = new_gnode->get_table();
        gnode_tbl->set_dname_mapping(raw_tbl->get_dname_mapping());
        return new_gnode;
    }

    t_schema
    create_aggregation_schema(t_schema schema, t_config config) {
        auto aggregates = config.get_aggregates();
        auto computedspecs = config.get_computedspecs();
        auto col_map = config.get_col_map();
        auto data_formats = config.get_data_formats();
        std::vector<std::string> cols;
        std::vector<t_dtype> types;
        std::vector<t_dataformattype> dftypes;
        std::vector<std::string> tbl_cols;
        std::vector<std::string> computed_cols;
        std::map<std::string, t_aggspec> aggregate_map;
        std::map<std::string, t_dataformattype> dftypes_map;

        for (t_uindex idx = 0, loop_end = aggregates.size(); idx < loop_end; ++idx) {
            t_aggspec aggregate = aggregates[idx];
            aggregate_map[aggregate.name()] = aggregate;
        }

        // Get data formats map from config
        for (auto const& df_spec : data_formats) {
            dftypes_map[df_spec.get_name()] = df_spec.get_type();
        }

        for (auto const& it : col_map) {
            if (std::find(computedspecs.begin(), computedspecs.end(), t_computedspec(it.second, {})) == computedspecs.end()) {
                cols.push_back(it.first);
                std::string colname = it.second;
                tbl_cols.push_back(colname);
                types.push_back(schema.get_dtype(colname));
                t_dataformattype dftype = dftypes_map[it.first];
                dftypes.push_back(dftype);
            }
        }

        if (!computedspecs.empty()) {
            for (t_uindex idx = 0, loop_end = computedspecs.size(); idx < loop_end; ++idx) {
                t_computedspec computedspec = computedspecs[idx];
                computed_cols.push_back(computedspec.get_name());
                cols.push_back(computedspec.get_name());
                tbl_cols.push_back(computedspec.get_name());
                types.push_back(computedspec.get_computed_dtype(aggregate_map, schema, col_map));
                dftypes.push_back(computedspec.get_computed_dftype(aggregate_map, schema, col_map));
            }
        }

        std::vector<std::string> columns = schema.columns();

        for (auto const& it : aggregate_map) {
            if (std::find(cols.begin(), cols.end(), it.first) == cols.end()) {
                std::string colname = it.first;
                cols.push_back(colname);
                tbl_cols.push_back(colname);
                types.push_back(schema.get_dtype(colname));
                //dftypes.push_back(schema.get_data_format_type(colname));
                dftypes.push_back(dftypes_map[colname]);
            }
        }

        /*for (t_uindex idx = 0, loop_end = m_columns.size(); idx < loop_end; ++idx) {
            std::cout << "column name: " << m_columns[idx] << std::endl;
            cols.push_back(m_columns[idx]);
            tbl_cols.push_back(m_columns[idx]);
            types.push_back(m_types[idx]);
            dftypes.push_back(m_data_format_types[idx]);
        }*/
        return t_schema(cols, types, dftypes, tbl_cols, computed_cols);
    }

    template <>
    t_config
    make_view_config(
        std::shared_ptr<t_schema> schema, std::string separator, val date_parser, val config) {
        val j_row_pivot = config["row_pivots"];
        val j_column_pivot = config["column_pivots"];
        val j_aggregate = config["aggregate"];
        val j_filter = config["filter"];
        val j_sort = config["sort"];
        val j_search = config["search"];
        val j_search_type = config["search_type"];
        val j_data_format = config["data_format"];
        val j_computed_column = config["computed_columns"];
        val j_col_map = config["column_map"];
        val j_pivot_info = config["pivot_info"];
        val j_combined_field = config["combined_field"];
        val j_max_columns = config["max_columns"];
        val j_max_rows = config["max_rows"];
        val j_pivot_view_mode = config["pivot_view_mode"];
        val j_show_types = config["show_type"];
        val j_period = config["period"];
        val j_pagination = config["pagination_setting"];

        std::vector<std::string> row_pivots;
        std::vector<std::string> column_pivots;
        std::vector<t_aggspec> aggregates;
        std::vector<t_fterm> filters{};
        std::vector<t_fterm> previous_filters{};
        std::vector<t_fterm> havings;
        std::vector<t_sortspec> sorts;
        std::vector<t_sortspec> col_sorts;
        std::vector<t_sterm> search_terms;
        t_search_info search_info;
        std::vector<t_searchspec> search_types;
        std::vector<t_data_format_spec> data_formats;
        std::vector<t_computed_column_definition> computed_columns;
        std::map<std::string, std::string> column_map;
        std::vector<t_pivot_info> pivot_info_vec;
        std::map<std::string, t_show_type> show_types;
        std::map<std::string, t_period_type> period_types;
        t_combined_field combined_field;
        t_index max_rows = -1;
        t_index max_columns = -1;
        t_paginationspec paginationspec;

        t_filter_op filter_op = t_filter_op::FILTER_OP_AND;
        t_filter_op having_op = t_filter_op::FILTER_OP_AND;
        t_pivot_view_mode pivot_view_mode = t_pivot_view_mode::PIVOT_VIEW_MODE_NESTED;

        if (hasValue(j_row_pivot)) {
            row_pivots = vecFromArray<val, std::string>(j_row_pivot);
        }

        if (hasValue(j_column_pivot)) {
            column_pivots = vecFromArray<val, std::string>(j_column_pivot);
        }

        bool column_only = false;

        if (row_pivots.size() == 0 && column_pivots.size() > 0) {
            column_only = true;
        }

        aggregates = _get_aggspecs(schema, separator, column_only, j_aggregate);

        search_types = _get_searchspecs(schema, j_search_type);

        data_formats = _get_data_format_specs(schema, j_data_format);

        combined_field = _get_combined_field(j_combined_field);

        if (hasValue(j_computed_column)) {
            computed_columns = _get_computed_columns(schema, j_computed_column);
        }

        if (hasValue(j_col_map)) {
            column_map = _get_col_map(j_col_map);
        }

        std::vector<std::string> col_names;
        if (aggregates.size() > 0) {
            col_names = _get_aggregate_names(aggregates);
        }

        // Enable max columns
        auto col_size = col_names.size();
        if (hasValue(j_max_columns)) {
            max_columns = j_max_columns.as<std::int32_t>();
            if (max_columns > col_size && row_pivots.size() == 0 && column_pivots.size() == 0) {
                max_columns = std::min(t_index(schema->size()), max_columns);
                if (max_columns > col_size) {
                    auto extra_columns = std::vector<std::string>(schema->m_columns.begin() + col_size, schema->m_columns.begin() + max_columns);
                    std::cout << "-----add-extra-column---c-----" << col_names << std::endl;
                    std::cout << "-----add-extra-column---s-----" << schema->m_columns << std::endl;
                    for (auto extra_it = extra_columns.begin(); extra_it != extra_columns.end(); ++extra_it) {
                        if (std::find(col_names.begin(), col_names.end(), *extra_it) == col_names.end()) {
                            col_names.push_back(*extra_it);
                        }
                    }
                }
            }
        } else if (schema->size() > col_size) {
            col_names = std::vector<std::string>(schema->m_columns.begin(), schema->m_columns.end());
        }

        // Enable max rows
        if (hasValue(j_max_rows)) {
            max_rows = j_max_rows.as<t_index>();
        }

        //if (hasValue(j_pivot_view_mode) && !column_only) {
        if (hasValue(j_pivot_view_mode)) {
            pivot_view_mode = num_to_pivot_view_mode(j_pivot_view_mode.as<t_index>());
        }

        if (hasValue(j_filter)) {
            auto raw_filters = _get_fterms(*(schema.get()), date_parser, j_filter, col_names, row_pivots, false);
            if (row_pivots.size() > 0 || column_pivots.size() > 0) {
                for (t_uindex idx = 0, fsize = raw_filters.size(); idx < fsize; ++idx) {
                    auto filter = raw_filters[idx];
                    if (filter.m_previous == FILTER_PREVIOUS_YES) {
                        previous_filters.push_back(filter);
                    } else {
                        filters.push_back(filter);
                    }
                }
            } else {
                filters = raw_filters;
            }
            if (hasValue(config["filter_op"])) {
                filter_op = str_to_filter_op(config["filter_op"].as<std::string>());
            }
        }

        if (hasValue(j_filter) && row_pivots.size() > 0) {
            havings = _get_hterms(schema, aggregates, date_parser, j_filter, column_map, col_names, row_pivots);
            if (hasValue(config["having_op"])) {
                having_op = str_to_filter_op(config["having_op"].as<std::string>());
            }
        }

        if (hasValue(j_sort)) {
            sorts = _get_sort(col_names, false, j_sort, row_pivots, column_pivots);
            col_sorts = _get_sort(col_names, true, j_sort, row_pivots, column_pivots);
        }

        if (hasValue(j_search)) {
            auto searchs = _get_sterms(schema, date_parser, j_search);
            search_terms = searchs.first;
            search_info = searchs.second;
        }

        if (hasValue(j_pivot_info)) {
            pivot_info_vec = _get_pivot_info(j_pivot_info);
        }

        if (hasValue(j_show_types)) {
            show_types = _get_show_type(j_show_types);
        }

        if (hasValue(j_period)) {
            period_types = _get_period_type(j_period);
        }

        // Get pagination spec from javascript config object
        if (hasValue(j_pagination)) {
            paginationspec = _get_pagination_spec(j_pagination);
        }

        std::cout << "computed-leng------------" << computed_columns.size() << std::endl;

        // remove duplicate column names
        auto view_config = t_config(row_pivots, column_pivots, aggregates, search_types, data_formats, sorts, col_sorts,
            filter_op, filters, search_terms, search_info, col_names, column_only, computed_columns, column_map, pivot_info_vec,
            havings, combined_field, max_rows, max_columns, pivot_view_mode, show_types, previous_filters, period_types, paginationspec);

        return view_config;
    }

    /**
     * Creates a new View.
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     * A shared pointer to a View<CTX_T>.
     */
    template <>
    void
    make_view_zero(t_pool* pool, std::shared_ptr<t_gnode> gnode, std::string name,
        std::string separator, val config, val date_parser, val update_query_percentage,
        val enable_query_progress, val cancel_access, val resolve, val reject) {
        std::shared_ptr<t_schema> schema = std::make_shared<t_schema>(gnode->get_tblschema());
        // Rename column for table if needed
        if (hasValue(config["column_map"])) {
            auto col_map = _get_col_map(config["column_map"]);
            if (col_map.size() > 0) {
                process_rename_columns(gnode, col_map);
                schema = std::make_shared<t_schema>(gnode->get_tblschema());
            }
        }

        MEM_REPORT("call make_view_zero()");

std::cout << "ctx0------------"<<std::endl;
        t_config view_config = make_view_config<val>(schema, separator, date_parser, config);

        if (predict_slow_query(view_config, gnode)) {
            enable_query_progress.call<val>("call", val::object(), true);
        }

        auto col_names = view_config.get_column_names();
        auto filter_op = view_config.get_combiner();
        auto filters = view_config.get_fterms();
        auto searchs = view_config.get_sterms();
        auto sinfo = view_config.get_sinfo();
        auto sorts = view_config.get_sortspecs();
        auto search_types = view_config.get_search_types();
        auto data_formats = view_config.get_data_formats();
        auto max_rows = view_config.get_max_rows();
        auto max_columns = view_config.get_max_columns();
        auto paginationspec = view_config.get_paginationspec();
        auto computed_columns = view_config.get_computed_columns();

        auto ctx = make_context_zero(
            *(schema.get()), filter_op, col_names, filters, searchs, sinfo, search_types, data_formats, sorts, pool, gnode, name,
            update_query_percentage, cancel_access, max_rows, max_columns, paginationspec, computed_columns);

        // Check cancel before create view pointer.
        emscripten_sleep(1);
        if (cancel_access.call<bool>("call")) {
            resolve(val::null());
            return;
        }

        auto view_ptr
            = std::make_shared<View<t_ctx0>>(pool, ctx, gnode, name, separator, view_config);

        resolve(view_ptr);

        MEM_REPORT("quit make_view_zero()");

        return;
    }

    template <>
    void
    make_view_one(t_pool* pool, std::shared_ptr<t_gnode> gnode, std::string name,
        std::string separator, val config, val date_parser, val update_query_percentage,
        val enable_query_progress, val cancel_access, val resolve, val reject) {

        MEM_REPORT("call make_view_one()");

std::cout << "ctx1------------"<<std::endl;

        std::shared_ptr<t_schema> schema = std::make_shared<t_schema>(gnode->get_tblschema());
        t_config view_config = make_view_config<val>(schema, separator, date_parser, config);

        if (predict_slow_query(view_config, gnode)) {
            enable_query_progress.call<val>("call", val::object(), true);
        }

        auto aggregates = view_config.get_aggregates();
        auto search_types = view_config.get_search_types();
        auto data_formats = view_config.get_data_formats();
        auto row_pivots = view_config.get_row_pivots();
        auto filter_op = view_config.get_combiner();
        auto filters = view_config.get_fterms();
        auto sorts = view_config.get_sortspecs();
        auto searchs = view_config.get_sterms();
        auto sinfo = view_config.get_sinfo();
        auto computed_columns = view_config.get_computed_columns();
        auto col_map = view_config.get_col_map();
        auto pivot_info_vec = view_config.get_pivot_info_vec();
        auto havings = view_config.get_hterms();
        auto combined_field = view_config.get_combined_field();
        auto max_rows = view_config.get_max_rows();
        auto max_columns = view_config.get_max_columns();
        auto pivot_view_mode = view_config.get_pivot_view_mode();
        auto show_types = view_config.get_show_types();
        auto previous_filters = view_config.get_previous_fterms();
        auto period_types = view_config.get_period_types();
        auto paginationspec = view_config.get_paginationspec();

        std::int32_t pivot_depth = -1;
        if (hasValue(config["row_pivot_depth"])) {
            pivot_depth = config["row_pivot_depth"].as<std::int32_t>();
        }

        auto ctx = make_context_one(*(schema.get()), row_pivots, filter_op, filters, searchs, sinfo, aggregates, search_types, data_formats,
            sorts, pivot_depth, pool, gnode, name, computed_columns, col_map, pivot_info_vec, havings, combined_field,
            update_query_percentage, cancel_access, max_rows, max_columns, pivot_view_mode, show_types, previous_filters,
            period_types, paginationspec);
        
        // Check cancel before create view pointer.
        emscripten_sleep(1);
        if (cancel_access.call<bool>("call")) {
            resolve(val::null());
            return;
        }
        
        auto view_ptr
            = std::make_shared<View<t_ctx1>>(pool, ctx, gnode, name, separator, view_config);

        resolve(view_ptr);

        MEM_REPORT("quit make_view_one()");

        return;
    }

    template <>
    void
    make_view_two(t_pool* pool, std::shared_ptr<t_gnode> gnode, std::string name,
        std::string separator, val config, val date_parser, val update_query_percentage,
        val enable_query_progress, val cancel_access, val resolve, val reject) {

        MEM_REPORT("call make_view_two()");

std::cout << "ctx2------------"<<std::endl;

        std::shared_ptr<t_schema> schema = std::make_shared<t_schema>(gnode->get_tblschema());
        t_config view_config = make_view_config<val>(schema, separator, date_parser, config);

        if (predict_slow_query(view_config, gnode)) {
            enable_query_progress.call<val>("call", val::object(), true);
        }

        bool column_only = view_config.is_column_only();
        auto column_names = view_config.get_column_names();
        auto row_pivots = view_config.get_row_pivots();
        auto column_pivots = view_config.get_column_pivots();
        auto aggregates = view_config.get_aggregates();
        auto search_types = view_config.get_search_types();
        auto data_formats = view_config.get_data_formats();
        auto filter_op = view_config.get_combiner();
        auto filters = view_config.get_fterms();
        auto searchs = view_config.get_sterms();
        auto sinfo = view_config.get_sinfo();
        auto sorts = view_config.get_sortspecs();
        auto col_sorts = view_config.get_col_sortspecs();
        auto computed_columns = view_config.get_computed_columns();
        auto col_map = view_config.get_col_map();
        auto pivot_info_vec = view_config.get_pivot_info_vec();
        auto havings = view_config.get_hterms();
        auto combined_field = view_config.get_combined_field();
        auto max_rows = view_config.get_max_rows();
        auto max_columns = view_config.get_max_columns();
        auto pivot_view_mode = view_config.get_pivot_view_mode();
        auto show_types = view_config.get_show_types();
        auto previous_filters = view_config.get_previous_fterms();
        auto period_types = view_config.get_period_types();
        auto paginationspec = view_config.get_paginationspec();

        std::int32_t rpivot_depth = -1;
        std::int32_t cpivot_depth = -1;

        if (hasValue(config["row_pivot_depth"])) {
            rpivot_depth = config["row_pivot_depth"].as<std::int32_t>();
        }

        if (hasValue(config["column_pivot_depth"])) {
            cpivot_depth = config["column_pivot_depth"].as<std::int32_t>();
        }

        auto ctx = make_context_two(*(schema.get()), row_pivots, column_pivots, filter_op, filters, searchs, sinfo,
            aggregates, search_types, data_formats, sorts, col_sorts, rpivot_depth, cpivot_depth, column_only, pool, gnode,
            name, computed_columns, col_map, pivot_info_vec, havings, combined_field, update_query_percentage, cancel_access,
            max_rows, max_columns, pivot_view_mode, show_types, previous_filters, period_types, paginationspec);
        
        // Check cancel before create view pointer.
        emscripten_sleep(1);
        if (cancel_access.call<bool>("call")) {
            resolve(val::null());
            return;
        }

        auto view_ptr
            = std::make_shared<View<t_ctx2>>(pool, ctx, gnode, name, separator, view_config);

        resolve(view_ptr);

        MEM_REPORT("quit make_view_two()");


        return;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::shared_ptr<t_ctx0>
    make_context_zero(t_schema schema, t_filter_op combiner, std::vector<std::string> columns,
        std::vector<t_fterm> filters, std::vector<t_sterm> searchs, t_search_info sinfo, std::vector<t_searchspec> search_types,
        std::vector<t_data_format_spec> data_formats, std::vector<t_sortspec> sorts, t_pool* pool,

        std::shared_ptr<t_gnode> gnode, std::string name, val update_query_percentage, emscripten::val cancel_access, t_index max_rows,
        t_index max_columns, t_paginationspec paginationspec, std::vector<t_computed_column_definition> computed_columns) {

        MEM_REPORT("call make_context_zero()");

        auto cfg = t_config(columns, combiner, filters, searchs, sinfo, search_types, data_formats, computed_columns,
            std::map<std::string, std::string>(), max_rows, max_columns, paginationspec);
        cfg.set_update_query_percentage(update_query_percentage);
        cfg.set_percentage_store();
        cfg.set_cancel_access(cancel_access);
        auto ctx0 = std::make_shared<t_ctx0>(schema, cfg);

        ctx0->init();
        ctx0->sort_by(sorts);
        pool->register_context(gnode->get_id(), name, ZERO_SIDED_CONTEXT,
            reinterpret_cast<std::uintptr_t>(ctx0.get()));

        if (ctx0->get_config().get_cancel_query_status()) {
            return ctx0;
        }

        MEM_REPORT("quit make_context_zero()");

        return ctx0;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::shared_ptr<t_ctx1>
    make_context_one(t_schema schema, std::vector<t_pivot> pivots, t_filter_op combiner,
        std::vector<t_fterm> filters, std::vector<t_sterm> searchs, t_search_info sinfo, std::vector<t_aggspec> aggregates,
        std::vector<t_searchspec> search_types, std::vector<t_data_format_spec> data_formats,
        std::vector<t_sortspec> sorts, std::int32_t pivot_depth, t_pool* pool, std::shared_ptr<t_gnode> gnode,
        std::string name, std::vector<t_computed_column_definition> computed_columns, std::map<std::string, std::string> col_map,
        std::vector<t_pivot_info> pivot_info_vec, std::vector<t_fterm> havings, t_combined_field combined_field,
        emscripten::val update_query_percentage, emscripten::val cancel_access, t_index max_rows, t_index max_columns,
        t_pivot_view_mode pivot_view_mode, std::map<std::string, t_show_type> show_types, std::vector<t_fterm> previous_filters,
        std::map<std::string, t_period_type> period_types, t_paginationspec paginationspec) {

        MEM_REPORT("call make_context_one()");

        auto cfg = t_config(pivots, aggregates, search_types, data_formats, combiner, filters, searchs, sinfo, computed_columns,
            sorts, col_map, pivot_info_vec, havings, combined_field, max_rows, max_columns, pivot_view_mode, show_types,
            previous_filters, period_types, paginationspec);
        cfg.set_update_query_percentage(update_query_percentage);
        cfg.set_percentage_store();
        cfg.set_cancel_access(cancel_access);
        // update tbl_schema before create new schema
        //schema.update_data_formats(cfg.get_data_formats());
        auto new_schema = create_aggregation_schema(schema, cfg);
        auto ctx1 = std::make_shared<t_ctx1>(new_schema, cfg);

        ctx1->init();
        ctx1->sort_by(sorts);
        pool->register_context(gnode->get_id(), name, ONE_SIDED_CONTEXT,
            reinterpret_cast<std::uintptr_t>(ctx1.get()));

        if (ctx1->get_config().get_cancel_query_status()) {
            return ctx1;
        }

        if (pivot_depth > -1) {
            ctx1->set_depth(pivot_depth - 1);
        } else {
            ctx1->set_depth(pivots.size());
        }

        MEM_REPORT("quit make_context_one()");

        return ctx1;
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    std::shared_ptr<t_ctx2>
    make_context_two(t_schema schema, std::vector<t_pivot> rpivots,
        std::vector<t_pivot> cpivots, t_filter_op combiner, std::vector<t_fterm> filters, std::vector<t_sterm> searchs, t_search_info sinfo,
        std::vector<t_aggspec> aggregates, std::vector<t_searchspec> search_types, std::vector<t_data_format_spec> data_formats,
        std::vector<t_sortspec> sorts, std::vector<t_sortspec> col_sorts, std::int32_t rpivot_depth, std::int32_t cpivot_depth,
        bool column_only, t_pool* pool, std::shared_ptr<t_gnode> gnode, std::string name,std::vector<t_computed_column_definition> computed_columns,
        std::map<std::string, std::string> col_map, std::vector<t_pivot_info> pivot_info_vec, std::vector<t_fterm> havings,
        t_combined_field combined_field, emscripten::val update_query_percentage, emscripten::val cancel_access, t_index max_rows, t_index max_columns,
        t_pivot_view_mode pivot_view_mode, std::map<std::string, t_show_type> show_types, std::vector<t_fterm> previous_filters,
        std::map<std::string, t_period_type> period_types, t_paginationspec paginationspec) {

        MEM_REPORT("call make_context_two()");

        //t_totals total = sorts.size() > 0 ? TOTALS_BEFORE : TOTALS_HIDDEN;
        t_totals total = TOTALS_AFTER;

        auto cfg
            = t_config(rpivots, cpivots, aggregates, search_types, data_formats, total, combiner,
                filters, searchs, sinfo, column_only, computed_columns, sorts, col_sorts, col_map, pivot_info_vec,
                havings, combined_field, max_rows, max_columns, pivot_view_mode, show_types,
                previous_filters, period_types, paginationspec);
        
        cfg.set_update_query_percentage(update_query_percentage);
        cfg.set_percentage_store();
        cfg.set_cancel_access(cancel_access);
        // update tbl_schema before create new schema
        //schema.update_data_formats(cfg.get_data_formats());
        auto new_schema = create_aggregation_schema(schema, cfg);
        auto ctx2 = std::make_shared<t_ctx2>(new_schema, cfg);

        ctx2->init();
        pool->register_context(gnode->get_id(), name, TWO_SIDED_CONTEXT,
            reinterpret_cast<std::uintptr_t>(ctx2.get()));
        
        if (ctx2->get_config().get_cancel_query_status()) {
            return ctx2;
        }

        if (rpivot_depth > -1) {
            ctx2->set_depth(t_header::HEADER_ROW, rpivot_depth - 1);
        } else {
            ctx2->set_depth(t_header::HEADER_ROW, rpivots.size());
        }

        if (cpivot_depth > -1) {
            ctx2->set_depth(t_header::HEADER_COLUMN, cpivot_depth - 1);
        } else {
            ctx2->set_depth(t_header::HEADER_COLUMN, cpivots.size());
        }

        if (sorts.size() > 0) {
            ctx2->sort_by(sorts);
        }

        if (col_sorts.size() > 0) {
            ctx2->column_sort_by(col_sorts);
        }

        MEM_REPORT("quit make_context_two()");

        return ctx2;
    }

    template <>
    t_schema
    get_table_computed_schema(
        std::shared_ptr<t_gnode> gnode,
        val j_computed_columns) {
        // Convert into vector of tuples
        t_table* table = gnode->get_table();
        std::vector<t_computed_column_definition> computed_columns;
        std::vector<val> em_computed_columns = vecFromArray<val, val>(j_computed_columns);

        for (auto idx = 0; idx < em_computed_columns.size(); ++idx) {
            val column = em_computed_columns[idx];
            std::string computed_column_name = column["column"].as<std::string>();
            std::string computed_function_name = column["computed_function_name"].as<std::string>();
            t_computed_function_name func_name = str_to_computed_function_name(computed_function_name);
            val input_cols = column["inputs"];
            std::vector<std::string> em_inputs
                    = vecFromArray<val, std::string>(input_cols);
            val input_col_types = column["input_types"];
            std::vector<std::string> em_input_col_types
                    = vecFromArray<val, std::string>(input_col_types);
            t_computation invalid_computation = t_computation();

            // Further validation is needed in `get_computed_schema`, so
            // default initialize input and return types and send to the
            // `Table`, as we cannot assume the configuration is valid
            // at this point.
            auto tp = std::make_tuple(
                computed_column_name,
                func_name,
                em_inputs,
                em_input_col_types,
                invalid_computation);
            computed_columns.push_back(tp);
        }

        t_schema computed_schema = table->get_computed_schema(computed_columns);
        return computed_schema;
    }

    std::vector<t_dtype>
    get_computation_input_types(const std::string& computed_function_name) {
        t_computed_function_name function = str_to_computed_function_name(computed_function_name);
        return t_computed_column::get_computation_input_types(function);
    }
    /******************************************************************************
     *
     * Data serialization
     */

    /**
     * @brief Get a slice of data for a single column, serialized to val.
     *
     * @tparam
     * @param table
     * @param colname
     * @return val
     */
    template <>
    val
    get_column_data(std::shared_ptr<t_table> table, std::string colname) {
        val arr = val::array();
        auto col = table->get_column(colname);
        for (auto idx = 0; idx < col->size(); ++idx) {
            arr.set(idx, scalar_to_val(col->get_scalar(idx)));
        }
        return arr;
    }

    /**
     * @brief Get the t_data_slice object, which contains an underlying slice of data and
     * metadata required to interact with it.
     *
     * @param view
     * @param start_row
     * @param end_row
     * @param start_col
     * @param end_col
     * @return val
     */
    template <typename CTX_T>
    std::shared_ptr<t_data_slice<CTX_T>>
    get_data_slice(std::shared_ptr<View<CTX_T>> view, std::uint32_t start_row,
        std::uint32_t end_row, std::uint32_t start_col, std::uint32_t end_col,
        val list_idx) {
        auto index_vec = vecFromArray<val, std::uint32_t>(list_idx);
        std::map<std::uint32_t, std::uint32_t> idx_map;
        for (t_uindex idx = start_col; idx < end_col; ++idx) {
            idx_map[idx] = index_vec[idx - start_col];
        }
        auto data_slice = view->get_data(start_row, end_row, start_col, end_col, idx_map);
        return data_slice;
    }

    template<typename CTX_T>
    std::map<std::string, double>
    get_selection_summarize(std::shared_ptr<View<CTX_T>> view, val selections) {
        std::vector<t_selection_info> selection_vec;
        std::vector<val> j_selections = vecFromArray<val, val>(selections);
        for (t_uindex idx = 0, ssize = j_selections.size(); idx < ssize; ++idx) {
            val j_selection = j_selections[idx];
            t_index start_col = j_selection["start_col"].as<t_index>();
            t_index end_col = j_selection["end_col"].as<t_index>();
            t_index start_row = j_selection["start_row"].as<t_index>();
            t_index end_row = j_selection["end_row"].as<t_index>();
            val list_idx = j_selection["list_idx"];
            auto index_vec = vecFromArray<val, std::uint32_t>(list_idx);
            std::map<t_uindex, t_uindex> idx_map;
            for (t_uindex idx = start_col; idx <= end_col; ++idx) {
                idx_map[idx] = index_vec[idx - start_col];
            }
            selection_vec.push_back(t_selection_info{start_row, end_row, start_col, end_col, idx_map});
        }
        return view->get_selection_summarize(selection_vec);
    }

    /**
     * @brief Retrieve a single value from the data slice and serialize it to an output
     * type that interfaces with the binding language.
     *
     * @param view
     * @param start_row
     * @param end_row
     * @param start_col
     * @param end_col
     * @return val
     */
    template <typename CTX_T>
    val
    get_from_data_slice(
        std::shared_ptr<t_data_slice<CTX_T>> data_slice, t_uindex ridx, t_uindex cidx, bool full_value, bool include_error) {
        auto d = data_slice->get(ridx, cidx);
        return scalar_to_val(d, false, false, true, full_value, include_error);
    }

    /**
     *
     *
     * Params
     * ------
     *
     *
     * Returns
     * -------
     *
     */
    bool predict_slow_query(t_config cfg, std::shared_ptr<t_gnode> gnode) {
        const t_table* tbl = gnode->get_table();
        std::int32_t num_rows = tbl->size();
        return true;
        //return num_rows >= 500000 && (cfg.has_search() || cfg.get_num_rpivots() > 0 || cfg.get_num_cpivots() > 0);
    }

    std::map<std::string, std::map<std::string, std::string>>
    get_computed_functions() {
        return t_computed_column::computed_functions;
    }

} // end namespace binding
} // end namespace perspective

using namespace perspective::binding;

/**
 * Main
 */
int
main(int argc, char** argv) {

    t_computed_column::make_computations();
    // clang-format off
EM_ASM({

    if (typeof self !== "undefined") {
        if (self.dispatchEvent && !self._perspective_initialized && self.document) {
            self._perspective_initialized = true;
            var event = self.document.createEvent("Event");
            event.initEvent("perspective-ready", false, true);
            self.dispatchEvent(event);
        } else if (!self.document && self.postMessage) {
            self.postMessage({});
        }
    }

});
    // clang-format on
}

/******************************************************************************
 *
 * Embind
 */

EMSCRIPTEN_BINDINGS(perspective) {
    /******************************************************************************
     *
     * View
     */
    // Bind a View for each context type

    class_<View<t_ctx0>>("View_ctx0")
        .constructor<t_pool*, std::shared_ptr<t_ctx0>, std::shared_ptr<t_gnode>, std::string,
            std::string, t_config>()
        .smart_ptr<std::shared_ptr<View<t_ctx0>>>("shared_ptr<View_ctx0>")
        .function("sides", &View<t_ctx0>::sides)
        .function("num_rows", &View<t_ctx0>::num_rows)
        .function("num_columns", &View<t_ctx0>::num_columns)
        .function("get_row_expanded", &View<t_ctx0>::get_row_expanded)
        .function("schema", &View<t_ctx0>::schema)
        .function("agg_custom_schema", &View<t_ctx0>::agg_custom_schema)
        .function("column_names", &View<t_ctx0>::column_names)
        .function("schema_with_range", &View<t_ctx2>::schema_with_range)
        .function("column_names_with_range", &View<t_ctx2>::column_names_with_range)
        .function("_get_deltas_enabled", &View<t_ctx0>::_get_deltas_enabled)
        .function("_set_deltas_enabled", &View<t_ctx0>::_set_deltas_enabled)
        .function("get_context", &View<t_ctx0>::get_context, allow_raw_pointers())
        .function("get_row_pivots", &View<t_ctx0>::get_row_pivots)
        .function("get_column_pivots", &View<t_ctx0>::get_column_pivots)
        .function("get_aggregates", &View<t_ctx0>::get_aggregates)
        .function("get_filters", &View<t_ctx0>::get_filters)
        .function("get_sorts", &View<t_ctx0>::get_sorts)
        .function("get_step_delta", &View<t_ctx0>::get_step_delta)
        .function("get_row_delta", &View<t_ctx0>::get_row_delta)
        .function("is_column_only", &View<t_ctx0>::is_column_only)
        .function("get_dname_mapping", &View<t_ctx0>::get_dname_mapping)
        .function("set_dname_mapping", &View<t_ctx0>::set_dname_mapping)
        .function("clear_dname_mapping", &View<t_ctx0>::clear_dname_mapping)
        .function("update_dname_mapping", &View<t_ctx0>::update_dname_mapping)
        .function("update_data_format", &View<t_ctx0>::update_data_format)
        .function("update_data_formats", &View<t_ctx0>::update_data_formats)
        .function("has_row_path", &View<t_ctx0>::has_row_path)
        .function("longest_text_cols", &View<t_ctx0>::longest_text_cols)
        .function("all_column_names", &View<t_ctx0>::all_column_names)
        .function("update_pagination_setting", &View<t_ctx0>::update_pagination_setting)
        .function("enable_cache", &View<t_ctx0>::enable_cache)
        .function("disable_cache", &View<t_ctx0>::disable_cache)
        .function("create_suggestion_column", &View<t_ctx0>::create_suggestion_column)
        .function("get_suggestion_size", &View<t_ctx0>::get_suggestion_size)
        .function("get_suggestion_value", &View<t_ctx0>::get_suggestion_value)
        .function("reset_suggestion_column", &View<t_ctx0>::reset_suggestion_column);

    class_<View<t_ctx1>>("View_ctx1")
        .constructor<t_pool*, std::shared_ptr<t_ctx1>, std::shared_ptr<t_gnode>, std::string,
            std::string, t_config>()
        .smart_ptr<std::shared_ptr<View<t_ctx1>>>("shared_ptr<View_ctx1>")
        .function("sides", &View<t_ctx1>::sides)
        .function("num_rows", &View<t_ctx1>::num_rows)
        .function("num_columns", &View<t_ctx1>::num_columns)
        .function("get_row_expanded", &View<t_ctx1>::get_row_expanded)
        .function("expand", &View<t_ctx1>::expand)
        .function("collapse", &View<t_ctx1>::collapse)
        .function("set_depth", &View<t_ctx1>::set_depth)
        .function("schema", &View<t_ctx1>::schema)
        .function("agg_custom_schema", &View<t_ctx1>::agg_custom_schema)
        .function("column_names", &View<t_ctx1>::column_names)
        .function("_get_deltas_enabled", &View<t_ctx1>::_get_deltas_enabled)
        .function("_set_deltas_enabled", &View<t_ctx1>::_set_deltas_enabled)
        .function("get_context", &View<t_ctx1>::get_context, allow_raw_pointers())
        .function("get_row_pivots", &View<t_ctx1>::get_row_pivots)
        .function("get_column_pivots", &View<t_ctx1>::get_column_pivots)
        .function("get_aggregates", &View<t_ctx1>::get_aggregates)
        .function("get_filters", &View<t_ctx1>::get_filters)
        .function("get_sorts", &View<t_ctx1>::get_sorts)
        .function("get_step_delta", &View<t_ctx1>::get_step_delta)
        .function("get_row_delta", &View<t_ctx1>::get_row_delta)
        .function("is_column_only", &View<t_ctx1>::is_column_only)
        .function("get_dname_mapping", &View<t_ctx1>::get_dname_mapping)
        .function("set_dname_mapping", &View<t_ctx1>::set_dname_mapping)
        .function("clear_dname_mapping", &View<t_ctx1>::clear_dname_mapping)
        .function("update_dname_mapping", &View<t_ctx1>::update_dname_mapping)
        .function("update_data_format", &View<t_ctx1>::update_data_format)
        .function("update_data_formats", &View<t_ctx1>::update_data_formats)
        .function("has_row_path", &View<t_ctx1>::has_row_path)
        .function("longest_text_cols", &View<t_ctx1>::longest_text_cols)
        .function("all_column_names", &View<t_ctx1>::all_column_names)
        .function("update_column_name", &View<t_ctx1>::update_column_name)
        .function("update_show_type", &View<t_ctx1>::update_show_type)
        .function("update_pagination_setting", &View<t_ctx1>::update_pagination_setting)
        .function("enable_cache", &View<t_ctx1>::enable_cache)
        .function("disable_cache", &View<t_ctx1>::disable_cache)
        .function("create_suggestion_column", &View<t_ctx1>::create_suggestion_column)
        .function("get_suggestion_size", &View<t_ctx1>::get_suggestion_size)
        .function("get_suggestion_value", &View<t_ctx1>::get_suggestion_value)
        .function("reset_suggestion_column", &View<t_ctx1>::reset_suggestion_column)
        .function("get_default_binning", &View<t_ctx1>::get_default_binning)
        .function("get_truncated_columns", &View<t_ctx1>::get_truncated_columns);

    class_<View<t_ctx2>>("View_ctx2")
        .constructor<t_pool*, std::shared_ptr<t_ctx2>, std::shared_ptr<t_gnode>, std::string,
            std::string, t_config>()
        .smart_ptr<std::shared_ptr<View<t_ctx2>>>("shared_ptr<View_ctx2>")
        .function("sides", &View<t_ctx2>::sides)
        .function("num_rows", &View<t_ctx2>::num_rows)
        .function("num_columns", &View<t_ctx2>::num_columns)
        .function("get_row_expanded", &View<t_ctx2>::get_row_expanded)
        .function("expand", &View<t_ctx2>::expand)
        .function("collapse", &View<t_ctx2>::collapse)
        .function("set_depth", &View<t_ctx2>::set_depth)
        .function("schema", &View<t_ctx2>::schema)
        .function("agg_custom_schema", &View<t_ctx2>::agg_custom_schema)
        .function("column_names", &View<t_ctx2>::column_names)
        .function("_get_deltas_enabled", &View<t_ctx2>::_get_deltas_enabled)
        .function("_set_deltas_enabled", &View<t_ctx2>::_set_deltas_enabled)
        .function("get_context", &View<t_ctx2>::get_context, allow_raw_pointers())
        .function("get_row_pivots", &View<t_ctx2>::get_row_pivots)
        .function("get_column_pivots", &View<t_ctx2>::get_column_pivots)
        .function("get_aggregates", &View<t_ctx2>::get_aggregates)
        .function("get_filters", &View<t_ctx2>::get_filters)
        .function("get_sorts", &View<t_ctx2>::get_sorts)
        .function("get_row_path", &View<t_ctx2>::get_row_path)
        .function("get_step_delta", &View<t_ctx2>::get_step_delta)
        .function("get_row_delta", &View<t_ctx2>::get_row_delta)
        .function("is_column_only", &View<t_ctx2>::is_column_only)
        .function("get_dname_mapping", &View<t_ctx2>::get_dname_mapping)
        .function("set_dname_mapping", &View<t_ctx2>::set_dname_mapping)
        .function("clear_dname_mapping", &View<t_ctx2>::clear_dname_mapping)
        .function("update_dname_mapping", &View<t_ctx2>::update_dname_mapping)
        .function("update_data_format", &View<t_ctx2>::update_data_format)
        .function("update_data_formats", &View<t_ctx2>::update_data_formats)
        .function("has_row_path", &View<t_ctx2>::has_row_path)
        .function("longest_text_cols", &View<t_ctx2>::longest_text_cols)
        .function("all_column_names", &View<t_ctx2>::all_column_names)
        .function("update_column_name", &View<t_ctx2>::update_column_name)
        .function("update_show_type", &View<t_ctx2>::update_show_type)
        .function("update_pagination_setting", &View<t_ctx2>::update_pagination_setting)
        .function("enable_cache", &View<t_ctx2>::enable_cache)
        .function("disable_cache", &View<t_ctx2>::disable_cache)
        .function("create_suggestion_column", &View<t_ctx2>::create_suggestion_column)
        .function("get_suggestion_size", &View<t_ctx2>::get_suggestion_size)
        .function("get_suggestion_value", &View<t_ctx2>::get_suggestion_value)
        .function("reset_suggestion_column", &View<t_ctx2>::reset_suggestion_column)
        .function("get_default_binning", &View<t_ctx2>::get_default_binning)
        .function("get_truncated_columns", &View<t_ctx2>::get_truncated_columns);

    /******************************************************************************
     *
     * t_table
     */
    class_<t_table>("t_table")
        .smart_ptr<std::shared_ptr<t_table>>("shared_ptr<t_table>")
        .function("size", &t_table::size)
        .function("get_computed_schema", &t_table::get_computed_schema)
        .function("longest_text_cols", reinterpret_cast<std::map<std::string, std::string> (t_table::*)() const>(&t_table::longest_text_cols));

    /******************************************************************************
     *
     * t_schema
     */
    class_<t_schema>("t_schema")
        .function("columns", &t_schema::columns, allow_raw_pointers())
        .function("types", &t_schema::types, allow_raw_pointers());

    /******************************************************************************
     *
     * t_gnode
     */
    class_<t_gnode>("t_gnode")
        .smart_ptr<std::shared_ptr<t_gnode>>("shared_ptr<t_gnode>")
        .function("get_id", reinterpret_cast<t_uindex (t_gnode::*)() const>(&t_gnode::get_id))
        .function("get_tblschema", &t_gnode::get_tblschema)
        .function("reset", &t_gnode::reset)
        .function("get_table", &t_gnode::get_table, allow_raw_pointers())
        .function("get_dname_mapping", &t_gnode::get_dname_mapping)
        .function("set_dname_mapping", &t_gnode::set_dname_mapping)
        .function("clear_dname_mapping", &t_gnode::clear_dname_mapping)
        .function("set_dname_mappings", &t_gnode::set_dname_mappings)
        .function("get_default_binning", &t_gnode::get_default_binning);

    /******************************************************************************
     *
     * t_data_slice
     */
    class_<t_data_slice<t_ctx0>>("t_data_slice_ctx0")
        .smart_ptr<std::shared_ptr<t_data_slice<t_ctx0>>>("shared_ptr<t_data_slice<t_ctx0>>>")
        .function("get_column_names", &t_data_slice<t_ctx0>::get_column_names)
        .function("get_short_column_names", &t_data_slice<t_ctx0>::get_short_column_names);

    class_<t_data_slice<t_ctx1>>("t_data_slice_ctx1")
        .smart_ptr<std::shared_ptr<t_data_slice<t_ctx1>>>("shared_ptr<t_data_slice<t_ctx1>>>")
        .function("get_column_names", &t_data_slice<t_ctx1>::get_column_names)
        .function("get_short_column_names", &t_data_slice<t_ctx1>::get_short_column_names)
        .function("get_row_path", &t_data_slice<t_ctx1>::get_row_path)
        .function("get_row_header", &t_data_slice<t_ctx1>::get_row_header)
        .function("get_row_path_extra", &t_data_slice<t_ctx1>::get_row_path_extra);

    class_<t_data_slice<t_ctx2>>("t_data_slice_ctx2")
        .smart_ptr<std::shared_ptr<t_data_slice<t_ctx2>>>("shared_ptr<t_data_slice<t_ctx2>>>")
        .function("get_column_names", &t_data_slice<t_ctx2>::get_column_names)
        .function("get_short_column_names", &t_data_slice<t_ctx2>::get_short_column_names)
        .function("get_row_path", &t_data_slice<t_ctx2>::get_row_path)
        .function("get_row_header", &t_data_slice<t_ctx2>::get_row_header)
        .function("get_row_path_extra", &t_data_slice<t_ctx2>::get_row_path_extra);

    /******************************************************************************
     *
     * t_ctx0
     */
    class_<t_ctx0>("t_ctx0").smart_ptr<std::shared_ptr<t_ctx0>>("shared_ptr<t_ctx0>");

    /******************************************************************************
     *
     * t_ctx1
     */
    class_<t_ctx1>("t_ctx1").smart_ptr<std::shared_ptr<t_ctx1>>("shared_ptr<t_ctx1>");

    /******************************************************************************
     *
     * t_ctx2
     */
    class_<t_ctx2>("t_ctx2").smart_ptr<std::shared_ptr<t_ctx2>>("shared_ptr<t_ctx2>");

    /******************************************************************************
     *
     * t_pool
     */
    class_<t_pool>("t_pool")
        .constructor<>()
        .smart_ptr<std::shared_ptr<t_pool>>("shared_ptr<t_pool>")
        .function("unregister_gnode", &t_pool::unregister_gnode)
        .function("set_update_delegate", &t_pool::set_update_delegate);

    /******************************************************************************
     *
     * t_tscalar
     */
    class_<t_tscalar>("t_tscalar");

    /******************************************************************************
     *
     * t_binning_info
     */
    class_<t_binning_info>("t_binning_info");

    /******************************************************************************
     *
     * t_updctx
     */
    value_object<t_updctx>("t_updctx")
        .field("gnode_id", &t_updctx::m_gnode_id)
        .field("ctx_name", &t_updctx::m_ctx);

    /******************************************************************************
     *
     * t_cellupd
     */
    value_object<t_cellupd>("t_cellupd")
        .field("row", &t_cellupd::row)
        .field("column", &t_cellupd::column)
        .field("old_value", &t_cellupd::old_value)
        .field("new_value", &t_cellupd::new_value);

    /******************************************************************************
     *
     * t_stepdelta
     */
    value_object<t_stepdelta>("t_stepdelta")
        .field("rows_changed", &t_stepdelta::rows_changed)
        .field("columns_changed", &t_stepdelta::columns_changed)
        .field("cells", &t_stepdelta::cells);

    /******************************************************************************
     *
     * t_rowdelta
     */
    value_object<t_rowdelta>("t_rowdelta")
        .field("rows_changed", &t_rowdelta::rows_changed)
        .field("rows", &t_rowdelta::rows);

    /******************************************************************************
     *
     * vector
     */
    register_vector<std::int32_t>("std::vector<std::int32_t>");
    register_vector<std::int8_t>("std::vector<std::int8_t>");
    register_vector<t_dtype>("std::vector<t_dtype>");
    register_vector<t_cellupd>("std::vector<t_cellupd>");
    register_vector<t_tscalar>("std::vector<t_tscalar>");
    register_vector<std::vector<t_tscalar>>("std::vector<std::vector<t_tscalar>>");
    register_vector<std::string>("std::vector<std::string>");
    register_vector<t_updctx>("std::vector<t_updctx>");
    register_vector<t_uindex>("std::vector<t_uindex>");
    register_vector<double>("std::vector<double>");
    //register_vector<bool>("std::vector<bool>");

    /******************************************************************************
     *
     * map
     */
    register_map<std::string, std::string>("std::map<std::string, std::string>");
    register_map<double, double>("std::map<double, double>");
    register_map<std::string, double>("std::map<std::string, double>");
    register_map<std::string, std::uint32_t>("std::map<std::string, std::uint32_t>");
    register_map<std::string, std::map<std::string, std::string>>("std::map<std::string, std::map<std::string, std::string>>");

    /******************************************************************************
     *
     * t_dtype
     */
    enum_<t_dtype>("t_dtype")
        .value("DTYPE_NONE", DTYPE_NONE)
        .value("DTYPE_INT64", DTYPE_INT64)
        .value("DTYPE_INT32", DTYPE_INT32)
        .value("DTYPE_INT16", DTYPE_INT16)
        .value("DTYPE_INT8", DTYPE_INT8)
        .value("DTYPE_UINT64", DTYPE_UINT64)
        .value("DTYPE_UINT32", DTYPE_UINT32)
        .value("DTYPE_UINT16", DTYPE_UINT16)
        .value("DTYPE_UINT8", DTYPE_UINT8)
        .value("DTYPE_FLOAT64", DTYPE_FLOAT64)
        .value("DTYPE_FLOAT32", DTYPE_FLOAT32)
        .value("DTYPE_BOOL", DTYPE_BOOL)
        .value("DTYPE_TIME", DTYPE_TIME)
        .value("DTYPE_DURATION", DTYPE_DURATION)
        .value("DTYPE_DATE", DTYPE_DATE)
        .value("DTYPE_ENUM", DTYPE_ENUM)
        .value("DTYPE_OID", DTYPE_OID)
        .value("DTYPE_PTR", DTYPE_PTR)
        .value("DTYPE_F64PAIR", DTYPE_F64PAIR)
        .value("DTYPE_USER_FIXED", DTYPE_USER_FIXED)
        .value("DTYPE_STR", DTYPE_STR)
        .value("DTYPE_USER_VLEN", DTYPE_USER_VLEN)
        .value("DTYPE_LAST_VLEN", DTYPE_LAST_VLEN)
        .value("DTYPE_LAST", DTYPE_LAST)
        .value("DTYPE_LIST_STR", DTYPE_LIST_STR)
        .value("DTYPE_LIST_INT64", DTYPE_LIST_INT64)
        .value("DTYPE_LIST_FLOAT64", DTYPE_LIST_FLOAT64)
        .value("DTYPE_LIST_BOOL", DTYPE_LIST_BOOL)
        .value("DTYPE_LIST_TIME", DTYPE_LIST_TIME)
        .value("DTYPE_LIST_DATE", DTYPE_LIST_DATE)
        .value("DTYPE_LIST_DURATION", DTYPE_LIST_DURATION)
        .value("DTYPE_DECIMAL", DTYPE_DECIMAL);

    /******************************************************************************
     *
     * assorted functions
     */
    function("make_table", &make_table<val>, allow_raw_pointers());
    function("clone_gnode_table", &clone_gnode_table<val>, allow_raw_pointers());
    function("scalar_vec_to_val", &scalar_vec_to_val);
    function("get_binning_info", &get_binning_info<val>, allow_raw_pointers());
    function("scalar_vec_to_string", &scalar_vec_to_string);
    function("table_add_computed_column", &table_add_computed_column<val>);
    function("col_to_js_typed_array_zero", &col_to_js_typed_array<t_ctx0>);
    function("col_to_js_typed_array_one", &col_to_js_typed_array<t_ctx1>);
    function("col_to_js_typed_array_two", &col_to_js_typed_array<t_ctx2>);
    function("make_view_zero", &make_view_zero<val>, allow_raw_pointers());
    function("make_view_one", &make_view_one<val>, allow_raw_pointers());
    function("make_view_two", &make_view_two<val>, allow_raw_pointers());
    function("get_data_slice_zero", &get_data_slice<t_ctx0>, allow_raw_pointers());
    function("get_from_data_slice_zero", &get_from_data_slice<t_ctx0>, allow_raw_pointers());
    function("get_data_slice_one", &get_data_slice<t_ctx1>, allow_raw_pointers());
    function("get_from_data_slice_one", &get_from_data_slice<t_ctx1>, allow_raw_pointers());
    function("get_data_slice_two", &get_data_slice<t_ctx2>, allow_raw_pointers());
    function("get_from_data_slice_two", &get_from_data_slice<t_ctx2>, allow_raw_pointers());
    function("val_to_string_vec", &val_to_string_vec);
    function("get_selection_summarize_zero", &get_selection_summarize<t_ctx0>, allow_raw_pointers());
    function("get_selection_summarize_one", &get_selection_summarize<t_ctx1>, allow_raw_pointers());
    function("get_selection_summarize_two", &get_selection_summarize<t_ctx2>, allow_raw_pointers());
    function("get_computed_functions", &get_computed_functions);
    function("get_table_computed_schema", &get_table_computed_schema<val>, allow_raw_pointers());
    function("get_computation_input_types", &get_computation_input_types);

}
