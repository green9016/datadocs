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
#include <perspective/decimal.h>
#include <cstdint>
#include <limits>

namespace perspective {

void
psp_abort() {
    std::cerr << "abort()" << std::endl;
    std::raise(SIGINT);
}

bool
is_numeric_type(t_dtype dtype) {
    switch (dtype) {
        case DTYPE_UINT8:
        case DTYPE_UINT16:
        case DTYPE_UINT32:
        case DTYPE_UINT64:
        case DTYPE_INT8:
        case DTYPE_INT16:
        case DTYPE_INT32:
        case DTYPE_INT64:
        case DTYPE_FLOAT32:
        case DTYPE_FLOAT64: {
            return true;
        } break;
        default: { return false; }
    }
}

bool
is_linear_order_type(t_dtype dtype) {
    switch (dtype) {
        case DTYPE_UINT8:
        case DTYPE_UINT16:
        case DTYPE_UINT32:
        case DTYPE_UINT64:
        case DTYPE_INT8:
        case DTYPE_INT16:
        case DTYPE_INT32:
        case DTYPE_INT64:
        case DTYPE_FLOAT32:
        case DTYPE_FLOAT64:
        case DTYPE_DATE:
        case DTYPE_TIME:
        case DTYPE_DURATION:
        case DTYPE_BOOL: {
            return true;
        } break;
        default: { return false; }
    }
}

bool
is_floating_point(t_dtype dtype) {
    return (dtype == DTYPE_FLOAT32 || dtype == DTYPE_FLOAT64 || dtype == DTYPE_DECIMAL);
}

bool
is_deterministic_sized(t_dtype dtype) {
    switch (dtype) {
        case DTYPE_PTR:
        case DTYPE_INT64:
        case DTYPE_UINT64:
        case DTYPE_INT32:
        case DTYPE_UINT32:
        case DTYPE_INT16:
        case DTYPE_UINT16:
        case DTYPE_BOOL:
        case DTYPE_INT8:
        case DTYPE_UINT8:
        case DTYPE_FLOAT64:
        case DTYPE_FLOAT32:
        case DTYPE_STR:
        case DTYPE_TIME:
        case DTYPE_DURATION:
        case DTYPE_DATE:
        case DTYPE_F64PAIR:
        case DTYPE_LIST_STR:
        case DTYPE_LIST_BOOL:
        case DTYPE_LIST_FLOAT64:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_TIME:
        case DTYPE_DECIMAL:
        case DTYPE_LIST_DURATION:
        {
            return true;
        }
        default: { return false; }
    }

    PSP_COMPLAIN_AND_ABORT("Reached unreachable");
    return false;
}

t_uindex
get_dtype_size(t_dtype dtype) {
    switch (dtype) {
        case DTYPE_PTR: {
            return sizeof(void*);
        }
        case DTYPE_INT64:
        case DTYPE_UINT64: {
            return sizeof(std::int64_t);
        }
        case DTYPE_INT32:
        case DTYPE_UINT32: {
            return sizeof(std::int32_t);
        }
        case DTYPE_INT16:
        case DTYPE_UINT16: {
            return 2;
        }
        case DTYPE_BOOL:
        case DTYPE_INT8:
        case DTYPE_UINT8:
        case DTYPE_NONE: {
            return 1;
        }
        case DTYPE_FLOAT64: {
            return sizeof(double);
        }
        case DTYPE_FLOAT32: {
            return sizeof(float);
        }
        case DTYPE_STR: {
            return sizeof(t_uindex);
        }
        case DTYPE_TIME: {
            return sizeof(double);
        }
        case DTYPE_DURATION: {
            return sizeof(double);
        }
        case DTYPE_DATE: {
            return sizeof(std::int32_t);
        }
        case DTYPE_F64PAIR: {
            return sizeof(std::pair<double, double>);
        }
        case DTYPE_LIST_BOOL: {
            return sizeof(std::vector<bool>);
        }
        case DTYPE_LIST_DATE: {
            return sizeof(std::vector<std::int32_t>);
        }
        case DTYPE_LIST_TIME: {
            return sizeof(std::vector<double>);
        }
        case DTYPE_LIST_DURATION: {
            return sizeof(std::vector<double>);
        }
        case DTYPE_LIST_FLOAT64: {
            return sizeof(std::vector<double>);
        }
        case DTYPE_LIST_INT64: {
            return sizeof(std::vector<std::int64_t>);
        }
        case DTYPE_LIST_STR: {
            return sizeof(std::vector<std::string>);
        }
        case DTYPE_DECIMAL: {
            return sizeof(decNumber);
        }
        default: { PSP_COMPLAIN_AND_ABORT("Unknown dtype"); }
    }

    PSP_COMPLAIN_AND_ABORT("Reached unreachable");
    return sizeof(DTYPE_INT64);
}

bool
is_vlen_dtype(t_dtype dtype) {
    if (dtype == DTYPE_STR || dtype == DTYPE_USER_VLEN)
        return true;
    return false;
}

std::string
get_dtype_descr(t_dtype dtype) {
    switch (dtype) {
        case DTYPE_NONE: {
            return "none";
        } break;
        case DTYPE_INT64: {
            return "i64";
        } break;
        case DTYPE_INT32: {
            return "i32";
        } break;
        case DTYPE_INT16: {
            return "i16";
        } break;
        case DTYPE_INT8: {
            return "i8";
        } break;
        case DTYPE_UINT64: {
            return "u64";
        } break;
        case DTYPE_UINT32: {
            return "u32";
        } break;
        case DTYPE_UINT16: {
            return "u16";
        } break;
        case DTYPE_UINT8: {
            return "u8";
        } break;
        case DTYPE_BOOL: {
            return "bool";
        } break;
        case DTYPE_FLOAT64: {
            return "f64";
        } break;
        case DTYPE_FLOAT32: {
            return "f32";
        } break;
        case DTYPE_STR: {
            return "str";
        } break;
        case DTYPE_TIME: {
            return "time";
        } break;
        case DTYPE_DURATION: {
            return "duration";
        }
        case DTYPE_DATE: {
            return "date";
        } break;
        case DTYPE_ENUM: {
            return "e";
        } break;
        case DTYPE_OID: {
            return "oid";
        } break;
        case DTYPE_USER_FIXED: {
            return "ufix";
        } break;
        case DTYPE_LAST: {
            return "last";
        } break;
        case DTYPE_USER_VLEN: {
            return "uvlen";
        } break;
        case DTYPE_F64PAIR: {
            return "f64pair";
        } break;
        case DTYPE_DECIMAL: {
            return "decimal";
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Encountered unknown dtype"); }
    }
    return std::string("dummy");
}

std::string
dtype_to_str(t_dtype dtype) {
    std::stringstream str_dtype;
    switch (dtype) {
        case DTYPE_FLOAT32:
        case DTYPE_FLOAT64: {
            str_dtype << "float";
        } break;
        case DTYPE_INT8:
        case DTYPE_INT16:
        case DTYPE_INT32:
        case DTYPE_INT64: {
            str_dtype << "integer";
        } break;
        case DTYPE_UINT64:
        case DTYPE_UINT32:
        case DTYPE_UINT16:
        case DTYPE_UINT8: {
            str_dtype << "integer";
        } break;
        case DTYPE_BOOL: {
            str_dtype << "boolean";
        } break;
        case DTYPE_DATE: {
            str_dtype << "date";
        } break;
        case DTYPE_TIME: {
            str_dtype << "datetime";
        } break;
        case DTYPE_DURATION: {
            str_dtype << "duration";
        } break;
        case DTYPE_STR: {
            str_dtype << "string";
        } break;
        case DTYPE_LIST_STR: {
            str_dtype << "list_string";
        } break;
        case DTYPE_LIST_BOOL: {
            str_dtype << "list_boolean";
        } break;
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64: {
            str_dtype << "list_integer";
        } break;
        case DTYPE_LIST_DATE: {
            str_dtype << "list_date";
        } break;
        case DTYPE_LIST_TIME: {
            str_dtype << "list_datetime";
        } break;
        case DTYPE_LIST_DURATION: {
            str_dtype << "list_duration";
        } break;
        case DTYPE_DECIMAL: {
            str_dtype << "decimal";
        } break;
        default: return "";
    }

    return str_dtype.str();
}

t_computed_function_name
str_to_computed_function_name(const std::string& name) {
    if (name == "+" || name == "add") {
        return t_computed_function_name::ADD;
    } else if (name == "-" || name == "subtract") {
        return t_computed_function_name::SUBTRACT;
    } else if (name == "*" || name == "multiply") {
        return t_computed_function_name::MULTIPLY;
    } else if (name == "/" || name == "divide") {
        return t_computed_function_name::DIVIDE;
    } else if (name == "%" || name == "percent_of") {
        return t_computed_function_name::PERCENT_OF;
    } else if (name == "^" || name == "pow") {
        return t_computed_function_name::POW;
    } else if (name == "==" || name == "equals") {
        return t_computed_function_name::EQUALS;
    } else if (name == "!=" || name == "not_equals") {
        return t_computed_function_name::NOT_EQUALS;
    } else if (name == ">" || name == "greater_than") {
        return t_computed_function_name::GREATER_THAN;
    } else if (name == "<" || name == "less_than") {
        return t_computed_function_name::LESS_THAN;
    } else if (name == "1/x" || name == "invert") {
        return t_computed_function_name::INVERT;
    } else if (name == "x^2" || name == "pow2") {
        return t_computed_function_name::POW2;
    } else if (name == "sqrt") {
        return t_computed_function_name::SQRT;
    } else if (name == "abs") {
        return t_computed_function_name::ABS;
    } else if (name == "log") {
        return t_computed_function_name::LOG;
    } else if (name == "exp") {
        return t_computed_function_name::EXP;
    } else if (name == "Uppercase" || name == "uppercase") {
        return t_computed_function_name::UPPERCASE;
    } else if (name == "Lowercase" || name == "lowercase") {
        return t_computed_function_name::LOWERCASE;
    } else if (name == "length") {
        return t_computed_function_name::LENGTH;
    } else if (name == "is") {
        return t_computed_function_name::IS;
    } else if (name == "concat_space") {
        return t_computed_function_name::CONCAT_SPACE;
    } else if (name == "concat_comma") {
        return t_computed_function_name::CONCAT_COMMA;
    } else if (name == "Bucket (10)" || name == "bin10") {
        return t_computed_function_name::BUCKET_10;
    } else if (name == "Bucket (100)" || name == "bin100") {
        return t_computed_function_name::BUCKET_100;
    } else if (name == "Bucket (1000)" || name == "bin1000") {
        return t_computed_function_name::BUCKET_1000;
    } else if (name == "Bucket (1/10)" || name == "bin10th") {
        return t_computed_function_name::BUCKET_0_1;
    } else if (name == "Bucket (1/100)" || name == "bin100th") {
        return t_computed_function_name::BUCKET_0_0_1;
    } else if (name == "Bucket (1/1000)" || name == "bin1000th") {
        return t_computed_function_name::BUCKET_0_0_0_1;
    } else if (name == "Hour of Day" || name == "hour_of_day") {
        return t_computed_function_name::HOUR_OF_DAY;
    } else if (name == "Day of Week" || name == "day_of_week") {
        return t_computed_function_name::DAY_OF_WEEK;
    } else if (name == "Month of Year" || name == "month_of_year") {
        return t_computed_function_name::MONTH_OF_YEAR;
    } else if (name == "Bucket (s)" || name == "second_bucket") {
        return t_computed_function_name::SECOND_BUCKET;
    } else if (name == "Bucket (m)" || name == "minute_bucket") {
        return t_computed_function_name::MINUTE_BUCKET;
    } else if (name == "Bucket (h)" || name == "hour_bucket") {
        return t_computed_function_name::HOUR_BUCKET;
    } else if (name == "Bucket (D)" || name == "day_bucket") {
        return t_computed_function_name::DAY_BUCKET;
    } else if (name == "Bucket (W)" || name == "week_bucket") {
        return t_computed_function_name::WEEK_BUCKET;
    } else if (name == "Bucket (M)" || name == "month_bucket") {
        return t_computed_function_name::MONTH_BUCKET;
    } else if (name == "Bucket (Y)" || name == "year_bucket") {
        return t_computed_function_name::YEAR_BUCKET;
    } else {
        std::cerr 
            << "Could not find computed function for `" 
            << name << "`" << std::endl;
        return t_computed_function_name::INVALID_COMPUTED_FUNCTION;
    }
}

std::string
computed_function_name_to_string(t_computed_function_name name) {
    switch (name) {
        case INVALID_COMPUTED_FUNCTION: return "invalid computed function";
        case ADD: return "+";
        case SUBTRACT: return "-";
        case MULTIPLY: return "*";
        case DIVIDE: return "/";
        case PERCENT_OF: return "%";
        case POW: return "pow";
        case EQUALS: return "==";
        case NOT_EQUALS: return "!=";
        case GREATER_THAN: return ">";
        case LESS_THAN: return "<";
        case INVERT: return "invert";
        case POW2: return "pow2";
        case SQRT: return "sqrt";
        case ABS: return "abs";
        case LOG: return "log";
        case EXP: return "exp";
        case UPPERCASE: return "uppercase";
        case LOWERCASE: return "lowercase";
        case LENGTH: return "length";
        case IS: return "is";
        case CONCAT_SPACE: return "concat_space";
        case CONCAT_COMMA: return "concat_comma";
        case BUCKET_10: return "bin10";
        case BUCKET_100: return "bin100";
        case BUCKET_1000: return "bin1000";
        case BUCKET_0_1: return "bin10th";
        case BUCKET_0_0_1: return "bin100th";
        case BUCKET_0_0_0_1: return "bin1000th";
        case HOUR_OF_DAY: return "hour_of_day";
        case DAY_OF_WEEK: return "day_of_week";
        case MONTH_OF_YEAR: return "month_of_year";
        case SECOND_BUCKET: return "second_bucket";
        case MINUTE_BUCKET: return "minute_bucket";
        case HOUR_BUCKET: return "hour_bucket";
        case DAY_BUCKET: return "day_bucket";
        case WEEK_BUCKET: return "week_bucket";
        case MONTH_BUCKET: return "month_bucket";
        case YEAR_BUCKET: return "year_bucket";
        default: break;
    }
    
    std::cerr 
        << "Could not convert computed function name to string." << std::endl;
    return "INVALID_COMPUTED_FUNCTION";
}

std::string
filter_op_to_str(t_filter_op op) {
    switch (op) {
        case FILTER_OP_LT: {
            return "<";
        } break;
        case FILTER_OP_LTEQ: {
            return "<=";
        } break;
        case FILTER_OP_GT: {
            return ">";
        } break;
        case FILTER_OP_GTEQ: {
            return ">=";
        } break;
        case FILTER_OP_EQ: {
            return "==";
        } break;
        case FILTER_OP_NE: {
            return "!=";
        } break;
        case FILTER_OP_BEGINS_WITH: {
            return "startswith";
        } break;
        case FILTER_OP_ENDS_WITH: {
            return "endswith";
        } break;
        case FILTER_OP_CONTAINS: {
            return "in";
        } break;
        case FILTER_OP_OR: {
            return "or";
        } break;
        case FILTER_OP_IN: {
            return "in";
        } break;
        case FILTER_OP_NOT_IN: {
            return "not in";
        } break;
        case FILTER_OP_AND: {
            return "and";
        } break;
        case FILTER_OP_IS_NAN: {
            return "is_nan";
        } break;
        case FILTER_OP_IS_NOT_NAN: {
            return "!is_nan";
        } break;
        case FILTER_OP_IS_VALID: {
            return "is not None";
        } break;
        case FILTER_OP_IS_NOT_VALID: {
            return "is None";
        } break;
        case FILTER_OP_IS_EMPTY: {
            return "empty";
        } break;
        case FILTER_OP_IS_NOT_EMPTY: {
            return "not empty";
        } break;
        case FILTER_OP_IS_TRUE: {
            return "is true";
        } break;
        case FILTER_OP_IS_FALSE: {
            return "is false";
        } break;
        case FILTER_OP_NOT_CONTAIN: {
            return "not in";
        } break;
        case FILTER_OP_AFTER: {
            return ">";
        } break;
        case FILTER_OP_BEFORE: {
            return "<";
        } break;
        case FILTER_OP_BETWEEN: {
            return "between";
        } break;
        case FILTER_OP_LAST_7_DAYS: {
            return "last 7 days";
        } break;
        case FILTER_OP_LAST_10_DAYS: {
            return "last 10 days";
        } break;
        case FILTER_OP_LAST_30_DAYS: {
            return "last 30 days";
        } break;
        case FILTER_OP_TODAY: {
            return "today";
        } break;
        case FILTER_OP_YESTERDAY: {
            return "yesterday";
        } break;
        case FILTER_OP_THIS_WEEK: {
            return "this week";
        } break;
        case FILTER_OP_LAST_WEEK: {
            return "last week";
        } break;
        case FILTER_OP_THIS_MONTH: {
            return "this month";
        } break;
        case FILTER_OP_LAST_MONTH: {
            return "last month";
        } break;
        case FILTER_OP_THIS_QUARTER: {
            return "this quarter";
        } break;
        case FILTER_OP_LAST_QUARTER: {
            return "last quarter";
        } break;
        case FILTER_OP_THIS_YEAR: {
            return "this year";
        } break;
        case FILTER_OP_LAST_YEAR: {
            return "last year";
        } break;
        case FILTER_OP_YEAR_TO_DATE: {
            return "year to date";
        } break;
        case FILTER_OP_ALL_DATE_RANGE: {
            return "all date range";
        } break;
        case FILTER_OP_IN_ANY: {
            return "in (any)";
        } break;
        case FILTER_OP_IN_ALL: {
            return "in (all)";
        } break;

        case FILTER_OP_IGNORE_ALL: {
            return "ignore all";
        } break;

        case FILTER_OP_RELATIVE_DATE: {
            return "relative date";
        } break;

        case FILTER_OP_TOP_N: {
            return "top n";
        } break;

        case FILTER_OP_ELE_EQ: {
            return "element equals";
        } break;

        case FILTER_OP_ELE_NE: {
            return "element not equals";
        } break;
        case FILTER_OP_ELE_CONTAINS: {
            return "element contains";
        } break;
        case FILTER_OP_ELE_NOT_CONTAINS: {
            return "element not contains";
        } break;
        case FILTER_OP_ELE_BEGINS_WITH: {
            return "element begins with";
        } break;
        case FILTER_OP_ELE_ENDS_WITH: {
            return "element ends with";
        } break;
        case FILTER_OP_ELE_IN_ANY: {
            return "element in";
        } break;
        case FILTER_OP_ELE_NOT_IN_ANY: {
            return "element not in";
        } break;
        case FILTER_OP_ELE_IS_TRUE: {
            return "element is true";
        } break;
        case FILTER_OP_ELE_IS_FALSE: {
            return "element is false";
        } break;
        case FILTER_OP_ELE_GT: {
            return "element greater";
        } break;
        case FILTER_OP_ELE_GTEQ: {
            return "element greater or equal";
        } break;
        case FILTER_OP_ELE_LT: {
            return "element less";
        } break;
        case FILTER_OP_ELE_LTEQ: {
            return "element less or equal";
        } break;
        case FILTER_OP_ELE_BEFORE: {
            return "element before";
        } break;
        case FILTER_OP_ELE_AFTER: {
            return "element after";
        } break;
        case FILTER_OP_ELE_BETWEEN: {
            return "element between";
        } break;
        case FILTER_OP_GROUP_FILTER: {
            return "group filter";
        } break;
    }
    PSP_COMPLAIN_AND_ABORT("Reached end of function");
    return "";
}

t_filter_op
str_to_filter_op(const std::string& str) {
    if (str == "<") {
        return t_filter_op::FILTER_OP_LT;
    } else if (str == "<=") {
        return t_filter_op::FILTER_OP_LTEQ;
    } else if (str == ">") {
        return t_filter_op::FILTER_OP_GT;
    } else if (str == ">=") {
        return t_filter_op::FILTER_OP_GTEQ;
    } else if (str == "==") {
        return t_filter_op::FILTER_OP_EQ;
    } else if (str == "!=") {
        return t_filter_op::FILTER_OP_NE;
    } else if (str == "begins with" || str == "startswith") {
        return t_filter_op::FILTER_OP_BEGINS_WITH;
    } else if (str == "ends with" || str == "endswith") {
        return t_filter_op::FILTER_OP_ENDS_WITH;
    } else if (str == "in") {
        return t_filter_op::FILTER_OP_IN;
    } else if (str == "contains") {
        return t_filter_op::FILTER_OP_CONTAINS;
    } else if (str == "not contain") {
        return t_filter_op::FILTER_OP_NOT_CONTAIN;
    } else if (str == "not in") {
        return t_filter_op::FILTER_OP_NOT_IN;
    } else if (str == "&" || str == "and") {
        return t_filter_op::FILTER_OP_AND;
    } else if (str == "|") {
        return t_filter_op::FILTER_OP_OR;
    } else if (str == "is nan" || str == "is_nan") {
        return t_filter_op::FILTER_OP_IS_NAN;
    } else if (str == "is not nan" || str == "!is_nan") {
        return t_filter_op::FILTER_OP_IS_NOT_NAN;
    } else if (str == "is not None") {
        return t_filter_op::FILTER_OP_IS_VALID;
    } else if (str == "is None") {
        return t_filter_op::FILTER_OP_IS_NOT_VALID;
    } else if (str == "empty") {
        return t_filter_op::FILTER_OP_IS_EMPTY;
    } else if (str == "not empty") {
        return t_filter_op::FILTER_OP_IS_NOT_EMPTY;
    } else if (str == "is true") {
        return t_filter_op::FILTER_OP_IS_TRUE;
    } else if (str == "is false") {
        return t_filter_op::FILTER_OP_IS_FALSE;
    } else if (str == "after") {
        return t_filter_op::FILTER_OP_AFTER;
    } else if (str == "before") {
        return t_filter_op::FILTER_OP_BEFORE;
    } else if (str == "between") {
        return t_filter_op::FILTER_OP_BETWEEN;
    } else if (str == "last 7 days") {
        return t_filter_op::FILTER_OP_LAST_7_DAYS;
    } else if (str == "last 10 days") {
        return t_filter_op::FILTER_OP_LAST_10_DAYS;
    } else if (str == "last 30 days") {
        return t_filter_op::FILTER_OP_LAST_30_DAYS;
    } else if (str == "today") {
        return t_filter_op::FILTER_OP_TODAY;
    } else if (str == "yesterday") {
        return t_filter_op::FILTER_OP_YESTERDAY;
    } else if (str == "this week") {
        return t_filter_op::FILTER_OP_THIS_WEEK;
    } else if (str == "last week") {
        return t_filter_op::FILTER_OP_LAST_WEEK;
    } else if (str == "this month") {
        return t_filter_op::FILTER_OP_THIS_MONTH;
    } else if (str == "last month") {
        return t_filter_op::FILTER_OP_LAST_MONTH;
    } else if (str == "this quarter") {
        return t_filter_op::FILTER_OP_THIS_QUARTER;
    } else if (str == "last quarter") {
        return t_filter_op::FILTER_OP_LAST_QUARTER;
    } else if (str == "this year") {
        return t_filter_op::FILTER_OP_THIS_YEAR;
    } else if (str == "last year") {
        return t_filter_op::FILTER_OP_LAST_YEAR;
    } else if (str == "year to date") {
        return t_filter_op::FILTER_OP_YEAR_TO_DATE;
    } else if (str == "all date range") {
        return t_filter_op::FILTER_OP_ALL_DATE_RANGE;
    } else if (str == "in (any)") {
        return t_filter_op::FILTER_OP_IN_ANY;
    } else if (str == "in (all)") {
        return t_filter_op::FILTER_OP_IN_ALL;
    } else if (str == "ignore all") {
        return t_filter_op::FILTER_OP_IGNORE_ALL;
    } else if (str == "relative date") {
        return t_filter_op::FILTER_OP_RELATIVE_DATE;
    } else if (str == "top n") {
        return t_filter_op::FILTER_OP_TOP_N;
    } else if (str == "element equals") {
        return t_filter_op::FILTER_OP_ELE_EQ;
    } else if (str == "element not equals") {
        return t_filter_op::FILTER_OP_ELE_NE;
    } else if (str == "element contains") {
        return t_filter_op::FILTER_OP_ELE_CONTAINS;
    } else if (str == "element not contains") {
        return t_filter_op::FILTER_OP_ELE_NOT_CONTAINS;
    } else if (str == "element begins with") {
        return t_filter_op::FILTER_OP_ELE_BEGINS_WITH;
    } else if (str == "element ends with") {
        return t_filter_op::FILTER_OP_ELE_ENDS_WITH;
    } else if (str == "element in") {
        return t_filter_op::FILTER_OP_ELE_IN_ANY;
    } else if (str == "element not in") {
        return t_filter_op::FILTER_OP_ELE_NOT_IN_ANY;
    } else if (str == "element is true") {
        return t_filter_op::FILTER_OP_ELE_IS_TRUE;
    } else if (str == "element is false") {
        return t_filter_op::FILTER_OP_ELE_IS_FALSE;
    } else if (str == "element greater") {
        return t_filter_op::FILTER_OP_ELE_GT;
    } else if (str == "element greater or equal") {
        return t_filter_op::FILTER_OP_ELE_GTEQ;
    } else if (str == "element less") {
        return t_filter_op::FILTER_OP_ELE_LT;
    } else if (str == "element less or equal") {
        return t_filter_op::FILTER_OP_ELE_LTEQ;
    } else if (str == "element before") {
        return t_filter_op::FILTER_OP_ELE_BEFORE;
    } else if (str == "element after") {
        return t_filter_op::FILTER_OP_ELE_AFTER;
    } else if (str == "element between") {
        return t_filter_op::FILTER_OP_ELE_BETWEEN;
    } else if (str == "group filter") {
        return t_filter_op::FILTER_OP_GROUP_FILTER;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown filter operation.");
        // use and as default
        return t_filter_op::FILTER_OP_AND;
    }
}

t_sorttype
str_to_sorttype(const std::string& str) {
    if (str == "none") {
        return SORTTYPE_NONE;
    } else if (str == "asc" || str == "col asc") {
        return SORTTYPE_ASCENDING;
    } else if (str == "desc" || str == "col desc") {
        return SORTTYPE_DESCENDING;
    } else if (str == "asc abs" || str == "col asc abs") {
        return SORTTYPE_ASCENDING_ABS;
    } else if (str == "desc abs" || str == "col desc abs") {
        return SORTTYPE_DESCENDING_ABS;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown sort type string");
        return SORTTYPE_DESCENDING;
    }
}

t_aggtype
str_to_aggtype(const std::string& str) {
    if (str == "distinct count" || str == "distinctcount" || str == "distinct"
        || str == "distinct_count") {
        return t_aggtype::AGGTYPE_DISTINCT_COUNT;
    } else if (str == "sum") {
        return t_aggtype::AGGTYPE_SUM;
    } else if (str == "mul") {
        return t_aggtype::AGGTYPE_MUL;
    } else if (str == "avg" || str == "mean") {
        return t_aggtype::AGGTYPE_MEAN;
    } else if (str == "count") {
        return t_aggtype::AGGTYPE_COUNT;
    } else if (str == "weighted mean" || str == "weighted_mean") {
        return t_aggtype::AGGTYPE_WEIGHTED_MEAN;
    } else if (str == "unique") {
        return t_aggtype::AGGTYPE_UNIQUE;
    } else if (str == "any") {
        return t_aggtype::AGGTYPE_ANY;
    } else if (str == "median") {
        return t_aggtype::AGGTYPE_MEDIAN;
    } else if (str == "join") {
        return t_aggtype::AGGTYPE_JOIN;
    } else if (str == "div") {
        return t_aggtype::AGGTYPE_SCALED_DIV;
    } else if (str == "add") {
        return t_aggtype::AGGTYPE_SCALED_ADD;
    } else if (str == "dominant") {
        return t_aggtype::AGGTYPE_DOMINANT;
    } else if (str == "first by index" || str == "first") {
        return t_aggtype::AGGTYPE_FIRST;
    } else if (str == "last by index") {
        return t_aggtype::AGGTYPE_LAST;
    } else if (str == "py_agg") {
        return t_aggtype::AGGTYPE_PY_AGG;
    } else if (str == "and") {
        return t_aggtype::AGGTYPE_AND;
    } else if (str == "or") {
        return t_aggtype::AGGTYPE_OR;
    } else if (str == "last" || str == "last_value") {
        return t_aggtype::AGGTYPE_LAST_VALUE;
    } else if (str == "high" || str == "high_water_mark" || str == "max") {
        return t_aggtype::AGGTYPE_HIGH_WATER_MARK;
    } else if (str == "low" || str == "low_water_mark" || str == "min") {
        return t_aggtype::AGGTYPE_LOW_WATER_MARK;
    } else if (str == "sum abs") {
        return t_aggtype::AGGTYPE_SUM_ABS;
    } else if (str == "sum not null" || str == "sum_not_null") {
        return t_aggtype::AGGTYPE_SUM_NOT_NULL;
    } else if (str == "mean by count" || str == "mean_by_count") {
        return t_aggtype::AGGTYPE_MEAN_BY_COUNT;
    } else if (str == "identity") {
        return t_aggtype::AGGTYPE_IDENTITY;
    } else if (str == "distinct leaf" || str == "distinct_leaf") {
        return t_aggtype::AGGTYPE_DISTINCT_LEAF;
    } else if (str == "pct sum parent" || str == "pct_sum_parent") {
        return t_aggtype::AGGTYPE_PCT_SUM_PARENT;
    } else if (str == "pct sum grand total" || str == "pct_sum_grand_total") {
        return t_aggtype::AGGTYPE_PCT_SUM_GRAND_TOTAL;
    } else if (str.find("udf_combiner_") != std::string::npos) {
        return t_aggtype::AGGTYPE_UDF_COMBINER;
    } else if (str.find("udf_reducer_") != std::string::npos) {
        return t_aggtype::AGGTYPE_UDF_REDUCER;
    } else if (str == "custom" ) {
        return t_aggtype::AGGTYPE_CUSTOM;
    } else if (str == "distinct values") {
        return t_aggtype::AGGTYPE_DISTINCT_VALUES;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown aggregate operation.");
        // use any as default
        return t_aggtype::AGGTYPE_ANY;
    }
}

t_searchtype
str_to_searchtype(const std::string& str) {
    if (str == "null") {
        return t_searchtype::SEARCHTYPE_NULL;
    } else if (str == "equals") {
        return t_searchtype::SEARCHTYPE_EQUALS;
    } else if (str == "startswith") {
        return t_searchtype::SEARCHTYPE_STARTS_WITH;
    } else if (str == "edge") {
        return t_searchtype::SEARCHTYPE_EDGE;
    } else if (str == "contains") {
        return t_searchtype::SEARCHTYPE_CONTAINS;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown search type.");
        // use null as default
        return t_searchtype::SEARCHTYPE_NULL;
    }
}

t_dataformattype
str_to_data_format_type(const std::string& str) {
    if (str == "text") {
        return t_dataformattype::DATA_FORMAT_TEXT;
    } else if (str == "yes/no") {
        return t_dataformattype::DATA_FORMAT_YES_NO;
    } else if (str == "true/false") {
        return t_dataformattype::DATA_FORMAT_TRUE_FALSE;
    } else if (str == "number") {
        return t_dataformattype::DATA_FORMAT_NUMBER;
    } else if (str == "financial") {
        return t_dataformattype::DATA_FORMAT_FINANCIAL;
    } else if (str == "date v1") {
        return t_dataformattype::DATA_FORMAT_DATE_V1;
    } else if (str == "date v2") {
        return t_dataformattype::DATA_FORMAT_DATE_V2;
    } else if (str == "date v3") {
        return t_dataformattype::DATA_FORMAT_DATE_V3;
    } else if (str == "duration") {
        return t_dataformattype::DATA_FORMAT_DURATION;
    } else if (str == "time") {
        return t_dataformattype::DATA_FORMAT_TIME;
    } else if (str == "datetime") {
        return t_dataformattype::DATA_FORMAT_DATETIME;
    } else if (str == "percent") {
        return t_dataformattype::DATA_FORMAT_PERCENT;
    } else if (str == "quarter") {
        return t_dataformattype::DATA_FORMAT_QUARTER;
    } else if (str == "week") {
        return t_dataformattype::DATA_FORMAT_WEEK;
    } else if (str == "month") {
        return t_dataformattype::DATA_FORMAT_MONTH;
    } else if (str == "day v1") {
        return t_dataformattype::DATA_FORMAT_DAY_V1;
    } else if (str == "day v2") {
        return t_dataformattype::DATA_FORMAT_DAY_V2;
    } else if (str == "day v3") {
        return t_dataformattype::DATA_FORMAT_DAY_V3;
    } else if (str == "none") {
        return t_dataformattype::DATA_FORMAT_NONE;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown data format.");
        // use text as default
        return t_dataformattype::DATA_FORMAT_TEXT;
    }
}

t_computed_param_type
str_to_computed_param_type(const std::string& str) {
    if (str == "colname") {
        return t_computed_param_type::COMPUTED_PARAM_COLNAME;
    } else if (str == "sub_formula") {
        return t_computed_param_type::COMPUTED_PARAM_SUB_FORMULA;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown computed func.");
        // use none as default
        return t_computed_param_type::COMPUTED_PARAM_NONE;
    }
}

t_formula_op_type
str_to_formula_op_type(const std::string& str) {
    if (str == "copy") {
        return t_formula_op_type::FORMULA_OP_COPY;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown computed func.");
        // use none as default
        return t_formula_op_type::FORMULA_OP_NONE;
    }
}

t_agg_level_type str_to_agg_level_type(const std::string& str) {
    if (str == "YEAR") {
        return t_agg_level_type::AGG_LEVEL_YEAR;
    } else if (str == "QUARTER") {
        return t_agg_level_type::AGG_LEVEL_QUARTER;
    } else if (str == "MONTH") {
        return t_agg_level_type::AGG_LEVEL_MONTH;
    } else if (str == "WEEK") {
        return t_agg_level_type::AGG_LEVEL_WEEK;
    } else if (str == "DAY") {
        return t_agg_level_type::AGG_LEVEL_DAY;
    } else if (str == "HOUR") {
        return t_agg_level_type::AGG_LEVEL_HOUR;
    } else if (str == "MINUTE") {
        return t_agg_level_type::AGG_LEVEL_MINUTE;
    } else if (str == "SECOND") {
        return t_agg_level_type::AGG_LEVEL_SECOND;
    } else if (str == "OFF") {
        return t_agg_level_type::AGG_LEVEL_NONE;
    } else if (str == "DATE") {
        return t_agg_level_type::AGG_LEVEL_DATE;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown agg level.");
        // use none as default
        return t_agg_level_type::AGG_LEVEL_NONE;
    }
}

t_pivot_type str_to_pivot_type(const std::string& str) {
    if (str == "row") {
        return t_pivot_type::PIVOT_TYPE_ROW;
    } else if (str == "column") {
        return t_pivot_type::PIVOT_TYPE_COLUMN;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown pivot type.");
        // use none as default
        return t_pivot_type::PIVOT_TYPE_NONE;
    }
}

t_binning_type str_to_binning_type(const std::string& str) {
    if (str == "AUTO") {
        return t_binning_type::BINNING_TYPE_AUTO;
    } else if (str == "ON") {
        return t_binning_type::BINNING_TYPE_CUSTOM;
    } else if (str == "OFF") {
        return t_binning_type::BINNING_TYPE_NONE;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown binning type.");
        // use none as default
        return t_binning_type::BINNING_TYPE_NONE;
    }
}

t_combined_mode str_to_combined_mode(const std::string& str) {
    if (str == "row") {
        return t_combined_mode::COMBINED_MODE_ROW;
    } else if (str == "column") {
        return t_combined_mode::COMBINED_MODE_COLUMN;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown combined mode.");
        // use column as default
        return t_combined_mode::COMBINED_MODE_COLUMN;
    }
}

t_error_code num_to_error_code(t_index num) {
    if (num == 1) {
        return t_error_code::TYPE_ERROR;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown error code.");
        // use null as default
        return t_error_code::NULL_ERROR;
    }
}

t_pivot_view_mode num_to_pivot_view_mode(t_index idx) {
    if (idx == 1) {
        return t_pivot_view_mode::PIVOT_VIEW_MODE_FLAT;
    } else if (idx == 0) {
        return t_pivot_view_mode::PIVOT_VIEW_MODE_NESTED;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown pivot view mode.");
        // use nested as default
        return t_pivot_view_mode::PIVOT_VIEW_MODE_NESTED;
    }
}

t_limit_type str_to_limit_type(const std::string& str) {
    if (str == "Items") {
        return t_limit_type::LIMIT_TYPE_ITEMS;
    } else if (str == "Percent") {
        return t_limit_type::LIMIT_TYPE_PECENT;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown limit type.");
        // use Items as default
        return t_limit_type::LIMIT_TYPE_ITEMS;
    }
}

t_show_type str_to_show_type(const std::string& str) {
    if (str == "default") {
        return t_show_type::SHOW_TYPE_DEFAULT;
    } else if (str == "%_of_row") {
        return t_show_type::SHOW_TYPE_ROW;
    } else if (str == "%_of_column") {
        return t_show_type::SHOW_TYPE_COLUMN;
    } else if (str == "%_of_grand_total") {
        return t_show_type::SHOW_TYPE_GRAND_TOTAL;
    } else if (str == "%_of_parent_row") {
        return t_show_type::SHOW_TYPE_PARENT_ROW;
    } else if (str == "%_of_parent_column") {
        return t_show_type::SHOW_TYPE_PARENT_COLUMN;
    } else if (str == "diff_from_prev_value") {
        return t_show_type::SHOW_TYPE_DIFF_PREVIOUS_VALUE;
    } else if (str == "%_of_prev_value") {
        return t_show_type::SHOW_TYPE_PERCENT_PREVIOUS_VALUE;
    } else if (str == "running_total") {
        return t_show_type::SHOW_TYPE_RUNNING_TOTAL;
    } else if (str == "running_%") {
        return t_show_type::SHOW_TYPE_RUNNING_PERCENT;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown show type.");
        // use Default as default
        return t_show_type::SHOW_TYPE_DEFAULT;
    }
}

t_filter_previous str_to_filter_previous(const std::string& str) {
    if (str == "no") {
        return t_filter_previous::FILTER_PREVIOUS_NO;
    } else if (str == "yes") {
        return t_filter_previous::FILTER_PREVIOUS_YES;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown filter previous.");
        // use No as default
        return t_filter_previous::FILTER_PREVIOUS_NO;
    }
}

t_filter_period str_to_filter_period(const std::string& str) {
    if (str == "previous") {
        return t_filter_period::FILTER_PERIOD_PREVIOUS;
    } else if (str == "this") {
        return t_filter_period::FILTER_PERIOD_THIS;
    } else if (str == "next") {
        return t_filter_period::FILTER_PERIOD_NEXT;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown filter period.");
        // use None as default
        return t_filter_period::FILTER_PERIOD_NONE;
    }
}

t_filter_date_unit str_to_filter_date_unit(const std::string& str) {
    if (str == "days") {
        return t_filter_date_unit::FILTER_DATE_UNIT_DAY;
    } else if (str == "weeks") {
        return t_filter_date_unit::FILTER_DATE_UNIT_WEEK;
    } else if (str == "months") {
        return t_filter_date_unit::FILTER_DATE_UNIT_MONTH;
    } else if (str == "quarters") {
        return t_filter_date_unit::FILTER_DATE_UNIT_QUARTER;
    } else if (str == "years") {
        return t_filter_date_unit::FILTER_DATE_UNIT_YEAR;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown filter date unit.");
        // use None as default
        return t_filter_date_unit::FILTER_DATE_UNIT_NONE;
    }
}

t_period_type str_to_period_type(const std::string& str) {
    if (str == "none") {
        return t_period_type::PERIOD_TYPE_NONE;
    } else if (str == "previous") {
        return t_period_type::PERIOD_TYPE_PREVIOUS;
    } else {
        PSP_COMPLAIN_AND_ABORT("Encountered unknown period type.");
        // use None as default
        return t_period_type::PERIOD_TYPE_NONE;
    }
}

std::string
get_status_descr(t_status status) {
    switch (status) {
        case STATUS_INVALID: {
            return "i";
        }
        case STATUS_VALID: {
            return "v";
        }
        case STATUS_CLEAR: {
            return "c";
        }
        default: { PSP_COMPLAIN_AND_ABORT("Unexpected status found"); }
    }
    return "";
}

void
check_init(bool init, const char* file, std::int32_t line) {
    PSP_VERBOSE_ASSERT(init, "touching uninited object");
}

bool
is_neq_transition(t_value_transition t) {
    return t > VALUE_TRANSITION_EQ_TT;
}

t_dtype list_type_to_dtype(t_dtype list_type) {
    t_dtype rtype = list_type;
    switch (list_type)
    {
    case DTYPE_LIST_STR:
        rtype = DTYPE_STR;
        break;
    
    case DTYPE_LIST_BOOL:
        rtype = DTYPE_BOOL;
        break;
    
    case DTYPE_LIST_FLOAT64:
        rtype = DTYPE_FLOAT64;
        break;

    case DTYPE_LIST_INT64:
        rtype = DTYPE_INT64;
        break;

    case DTYPE_LIST_DATE:
        rtype = DTYPE_DATE;
        break;

    case DTYPE_LIST_TIME:
        rtype = DTYPE_TIME;
        break;

    case DTYPE_LIST_DURATION:
        rtype = DTYPE_DURATION;
        break;
    
    default:
        break;
    }
    return rtype;
}

t_uindex
root_pidx() {
    return std::numeric_limits<t_uindex>::max();
}

bool
is_internal_colname(const std::string& c) {
    return c.compare(std::string("psp_")) == 0;
}

template <typename T>
t_dtype
type_to_dtype() {
    return DTYPE_NONE;
}

template <>
t_dtype
type_to_dtype<std::int64_t>() {
    return DTYPE_INT64;
}

template <>
t_dtype
type_to_dtype<std::int32_t>() {
    return DTYPE_INT32;
}

template <>
t_dtype
type_to_dtype<std::int16_t>() {
    return DTYPE_INT16;
}

template <>
t_dtype
type_to_dtype<std::int8_t>() {
    return DTYPE_INT8;
}

template <>
t_dtype
type_to_dtype<std::uint64_t>() {
    return DTYPE_UINT64;
}

template <>
t_dtype
type_to_dtype<std::uint32_t>() {
    return DTYPE_UINT32;
}

template <>
t_dtype
type_to_dtype<std::uint16_t>() {
    return DTYPE_UINT16;
}

template <>
t_dtype
type_to_dtype<std::uint8_t>() {
    return DTYPE_UINT8;
}

template <>
t_dtype
type_to_dtype<double>() {
    return DTYPE_FLOAT64;
}

template <>
t_dtype
type_to_dtype<float>() {
    return DTYPE_FLOAT32;
}

template <>
t_dtype
type_to_dtype<bool>() {
    return DTYPE_BOOL;
}

template <>
t_dtype
type_to_dtype<t_time>() {
    return DTYPE_TIME;
}

template <>
t_dtype
type_to_dtype<t_duration>() {
    return DTYPE_DURATION;
}

template <>
t_dtype
type_to_dtype<t_date>() {
    return DTYPE_DATE;
}

template <>
t_dtype
type_to_dtype<std::string>() {
    return DTYPE_STR;
}

template <>
t_dtype
type_to_dtype<t_decimal>() {
    return DTYPE_DECIMAL;
}

t_dtype
dtype_from_dtype_and_agg_level(t_dtype dtype, t_agg_level_type agg_level) {
    if (agg_level == AGG_LEVEL_NONE) {
        return dtype;
    } else if (agg_level == AGG_LEVEL_YEAR || agg_level == AGG_LEVEL_QUARTER || agg_level == AGG_LEVEL_MONTH
        || agg_level == AGG_LEVEL_WEEK) {
        return t_dtype::DTYPE_INT64;
    }else if (agg_level == AGG_LEVEL_DAY || agg_level == AGG_LEVEL_DATE) {
        return t_dtype::DTYPE_DATE;
    } else if (agg_level == AGG_LEVEL_HOUR || agg_level == AGG_LEVEL_MINUTE || agg_level == AGG_LEVEL_SECOND) {
        return t_dtype::DTYPE_DURATION;
    }
    return dtype;
}

t_dataformattype
dftype_from_dftype_and_agg_level(t_dataformattype dftype, t_agg_level_type agg_level) {
    if (agg_level == AGG_LEVEL_NONE) {
        return dftype;
    } else if (agg_level == AGG_LEVEL_YEAR) {
        return t_dataformattype::DATA_FORMAT_NUMBER;
    } else if (agg_level == AGG_LEVEL_QUARTER) {
        return t_dataformattype::DATA_FORMAT_QUARTER;
    } else if (agg_level == AGG_LEVEL_WEEK) {
        return t_dataformattype::DATA_FORMAT_WEEK;
    } else if (agg_level == AGG_LEVEL_MONTH) {
        return t_dataformattype::DATA_FORMAT_MONTH;
    } else if (agg_level == AGG_LEVEL_HOUR || agg_level == AGG_LEVEL_MINUTE || agg_level == AGG_LEVEL_SECOND) {
        return t_dataformattype::DATA_FORMAT_TIME;
    } else if (agg_level == AGG_LEVEL_DAY) {
        if (dftype == DATA_FORMAT_DATE_V1) {
            return t_dataformattype::DATA_FORMAT_DAY_V1;
        } else if (dftype == DATA_FORMAT_DATE_V2) {
            return t_dataformattype::DATA_FORMAT_DAY_V2;
        } else {
            return t_dataformattype::DATA_FORMAT_DAY_V3;
        }
    } else if (agg_level == AGG_LEVEL_DATE) {
        return t_dataformattype::DATA_FORMAT_DAY_V2;
    }

    return dftype;
}

/*template <>
t_dtype
type_to_dtype<std::array<std::string, 1000>>() {
    return DTYPE_LIST_STR;
}*/

} // end namespace perspective

namespace std {

void
string_to_lower(string& str) {
    transform(str.begin(), str.end(), str.begin(), ::tolower);
}

} // namespace std
