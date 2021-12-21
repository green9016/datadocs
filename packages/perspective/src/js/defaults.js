/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

export const CONFIG_ALIASES = {
    row_pivot: "row_pivots",
    "row-pivot": "row_pivots",
    "row-pivots": "row_pivots",
    col_pivot: "column_pivots",
    col_pivots: "column_pivots",
    column_pivot: "column_pivots",
    "column-pivot": "column_pivots",
    "column-pivots": "column_pivots",
    filters: "filter",
    sorts: "sort",
    searchs: "search"
};

export const SEPARATOR_TEXT = "------------------";
export const ELEMENT_LIST_TEXT = "Element in list...";
export const TAB_SPACES = "&nbsp;&nbsp;&nbsp;&nbsp;";
export const INVALID_FILTER_OPERATORS = ["Number filter", "Bool filter", "Date filter", "Datetime filter", "Time filter", "String filter", "List filter"];

export const LIST_TYPES = ['list_string', 'list_boolean', 'list_integer', 'list_float', 'list_date', 'list_duration', 'list_datetime'];

export const CONFIG_VALID_KEYS = ["viewport", "row_pivots", "column_pivots", "aggregates", "columns", "filter", "search", "search_types",
    "data_formats", "sort", "row_pivot_depth", "filter_op", "agg_custom", "row_pivot_info", "column_pivot_info", "column_map", "combined_field",
    "max_rows", "max_columns", "pivot_view_mode", "show_types", "periods", "pagination_setting", "value_pivots", "computed_columns"];

/*const NUMBER_AGGREGATES = [
    "any",
    "avg",
    "count",
    "distinct count",
    "dominant",
    "first by index",
    "last by index",
    "last",
    "high",
    "low",
    "mean",
    "mean by count",
    "median",
    "pct sum parent",
    "pct sum grand total",
    "sum",
    "sum abs",
    "sum not null",
    "unique",
    "distinct values"
];*/
const NUMBER_AGGREGATES = ["any", "sum", "count", "distinct count", "distinct values", "min", "max", "median"];

//const STRING_AGGREGATES = ["any", "count", "distinct count", "distinct leaf", "dominant", "first by index", "last by index", "last", "mean by count", "unique", "distinct values"];
const STRING_AGGREGATES = ["any", "count", "distinct count", "distinct values"];

const DATE_AGGREGATES = ["any", "count", "distinct count", "distinct values", "min", "max"];

export const STATISTIC_AGGREGATES = ["avg", "count", "dominant", "mean", "mean by count", "distinct count", "sum",
    "median", "pct sum parent", "pct sum grand total", "sum abs", "sum not null", "min", "max"];

const LIST_AGGREGATES = ["any"];

//const BOOLEAN_AGGREGATES = ["any", "count", "distinct count", "sum", "distinct leaf", "dominant", "first by index", "last by index", "last", "mean by count", "unique", "and", "or", "distinct values"];
const BOOLEAN_AGGREGATES = ["any", "sum", "count", "distinct count", "distinct values"];

export const SORT_ORDERS = ["none", "asc", "desc", "col asc", "col desc", "asc abs", "desc abs", "col asc abs", "col desc abs"];

export const SORT_ORDER_IDS = [2, 0, 1, 0, 1, 3, 4, 3, 4];

export const TYPE_AGGREGATES = {
    string: STRING_AGGREGATES,
    float: NUMBER_AGGREGATES,
    integer: NUMBER_AGGREGATES,
    decimal: NUMBER_AGGREGATES,
    boolean: BOOLEAN_AGGREGATES,
    datetime: DATE_AGGREGATES,
    date: DATE_AGGREGATES,
    duration: DATE_AGGREGATES,
    list_string: LIST_AGGREGATES,
    list_boolean: LIST_AGGREGATES,
    list_float: LIST_AGGREGATES,
    list_integer: LIST_AGGREGATES,
    list_date: LIST_AGGREGATES,
    list_duration: LIST_AGGREGATES,
    list_datetime: LIST_AGGREGATES
};

export const AGGREGATE_DEFAULTS = {
    string: "count",
    float: "sum",
    integer: "sum",
    decimal: "sum",
    boolean: "sum",
    datetime: "count",
    date: "count",
    duration: "count",
    list_string: "any",
    list_boolean: "any",
    list_float: "any",
    list_integer: "any",
    list_date: "any",
    list_duration: "any",
    list_datetime: "any"
};

export const AGGREGATE_DEFAULT_NAMES = {
    "any": "ANY",
    "avg": "AVG",
    "count": "COUNT",
    "distinct count": "DISTINCT COUNT",
    "dominant": "DOMINANT",
    "first by index": "FIRST BY INDEX",
    "last by index": "LAST BY INDEX",
    "last": "LAST",
    "high": "HIGH",
    "low": "LOW",
    "mean": "MEAN",
    "mean by count": "MEAN BY COUNT",
    "median": "MEDIAN",
    "pct sum parent": "PCT SUM PARENT",
    "pct sum grand total": "PCT SUM GRAND TOTAL",
    "sum": "SUM",
    "sum abs": "SUM ABS",
    "sum not null": "SUM NOT NULL",
    "unique": "UNIQUE",
    "distinct leaf": "DISTINCT LEAF",
    "and": "AND",
    "or": "OR",
    "distinct values": "DISTINCT VALUES",
    "min": "MIN",
    "max": "MAX"
};

export const AGGREGATE_DEFAULT_VNAMES = {
    "any": "Any",
    "avg": "Avg",
    "count": "Count",
    "distinct count": "Distinct count",
    "dominant": "Dominant",
    "first by index": "First by index",
    "last by index": "Last by index",
    "last": "Last",
    "high": "High",
    "low": "Low",
    "mean": "Mean",
    "mean by count": "Mean by count",
    "median": "Median",
    "pct sum parent": "Pct sum parent",
    "pct sum grand total": "Pct sum grand total",
    "sum": "Sum",
    "sum abs": "Sum abs",
    "sum not null": "Sum not null",
    "unique": "Unique",
    "distinct leaf": "Distinct leaf",
    "and": "And",
    "or": "Or",
    "distinct values": "Distinct values",
    "min": "Min",
    "max": "Max"
};

export const AGGREGATE_OPERATOR_NAMES = {
    "any": "No calculation",
    "avg": "Avg",
    "count": "Count",
    "distinct count": "Distinct Count",
    "dominant": "Dominant",
    "first by index": "First by Index",
    "last by index": "Last by Index",
    "last": "Last",
    "high": "High",
    "low": "Low",
    "mean": "Mean",
    "mean by count": "Mean by Count",
    "median": "Median",
    "pct sum parent": "Pct Sum Parent",
    "pct sum grand total": "Pct Sum Grand Total",
    "sum": "Sum",
    "sum abs": "Sum Abs",
    "sum not null": "Sum Not Null",
    "unique": "Unique",
    "distinct leaf": "Distinct Leaf",
    "and": "And",
    "or": "Or",
    "distinct values": "Distinct Values",
    "min": "Min",
    "max": "Max"
};

//const SEARCH_TYPES = ["null", "equals", "startswith", "edge", "contains"];
//const SEARCH_TYPES = ["null", "equals", "edge", "contains"];
const SEARCH_TYPES = [{type: "edge", text: "Edge"}, {type: "equals", text: "Exact"}, {type: "contains", text: "Contains"}];
export const SEARCH_TYPE_NULL = "null";

export const TYPE_SEARCH_TYPES = {
    string: SEARCH_TYPES,
    float: SEARCH_TYPES,
    integer: SEARCH_TYPES,
    decimal: SEARCH_TYPES,
    boolean: SEARCH_TYPES,
    datetime: SEARCH_TYPES,
    date: SEARCH_TYPES,
    duration: SEARCH_TYPES,
    list_string: SEARCH_TYPES,
    list_boolean: SEARCH_TYPES,
    list_float: SEARCH_TYPES,
    list_integer: SEARCH_TYPES,
    list_date: SEARCH_TYPES,
    list_duration: SEARCH_TYPES,
    list_datetime: SEARCH_TYPES
};

export const SEARCH_TYPE_DEFAULTS = {
    string: "edge",
    float: "edge",
    integer: "edge",
    decimal: "edge",
    boolean: "edge",
    datetime: "edge",
    date: "edge",
    duration: "edge",
    list_string: "edge",
    list_boolean: "edge",
    list_float: "edge",
    list_integer: "edge",
    list_date: "edge",
    list_duration: "edge",
    list_datetime: "edge"
};

const DATA_FORMATS = ["text", "yes/no", "true/false", "number", "financial", "date v1", "date v2",
        "date v3", "duration", "time", "datetime", "percent"];

const STRING_DATA_FORMATS = ["text"];

const BOOLEAN_DATA_FORMATS = ["yes/no", "true/false"];

export const NUMBER_DATA_FORMATS = ["number", "financial", "percent"];

const DATE_DATA_FORMATS = ["date v1", "date v2", "date v3"];

const DURATION_DATA_FORMATS = ["duration", "time"];

const DATETIME_DATA_FORMATS = ["datetime"];

export const TYPE_DATA_FORMATS = {
    string: STRING_DATA_FORMATS,
    float: NUMBER_DATA_FORMATS,
    integer: NUMBER_DATA_FORMATS,
    decimal: NUMBER_DATA_FORMATS,
    boolean: BOOLEAN_DATA_FORMATS,
    datetime: DATETIME_DATA_FORMATS,
    date: DATE_DATA_FORMATS,
    duration: DURATION_DATA_FORMATS,
    list_string: STRING_DATA_FORMATS,
    list_boolean: BOOLEAN_DATA_FORMATS,
    list_float: NUMBER_DATA_FORMATS,
    list_integer: NUMBER_DATA_FORMATS,
    list_date: DATE_DATA_FORMATS,
    list_duration: DURATION_DATA_FORMATS,
    list_datetime: DATETIME_DATA_FORMATS
};

export const DATA_FORMAT_DEFAULTS = {
    string: "text",
    float: "number",
    integer: "number",
    decimal: "number",
    boolean: "true/false",
    datetime: "datetime",
    date: "date v1",
    duration: "duration",
    list_string: "text",
    list_boolean: "true/false",
    list_float: "number",
    list_integer: "number",
    list_date: "date v1",
    list_duration: "duration",
    list_datetime: "datetime"
};

export const DATA_FORMAT_SHOW_TEXTS = {
    "text": "text",
    "yes/no": "yes/no",
    "true/false": "true/false",
    "number": "number",
    "financial": "financial",
    "date v1": "Jan 1, 2020",
    "date v2": "2020-01-01",
    "date v3": "01/01/2020",
    "duration": "1:02:03",
    "time": "1:02 AM",
    "datetime": "2020-01-01 1:12:00",
    "percent": "percent"
};

export const DATA_FORMAT_AGG_LEVEL_SHOW_TEXTS = {
    "DAY": {
        "date v1": "Jan 1",
        "date v2": "01-01",
        "date v3": "01/01",
        "datetime": "01-01"
    },
    "DATE": {
        "datetime": "2020-01-01"
    }
};

const DATE_AGGREGATE_LEVEL = ["YEAR", "QUARTER", "MONTH", "WEEK", "DAY", "OFF"];
const DATETIME_AGGREGATE_LEVEL = ["YEAR", "QUARTER", "MONTH", "WEEK", "DAY", "HOUR", "MINUTE", "DATE", "OFF"];
const DURATION_AGGREGATE_LEVEL = ["HOUR", "MINUTE", "OFF"];

export const AGGREGATE_LEVEL_LIST = ["date", "datetime", "duration", "list_date", "list_datetime", "list_duration"];

export const TYPE_AGGREGATE_LEVELS = {
    date: DATE_AGGREGATE_LEVEL,
    datetime: DATETIME_AGGREGATE_LEVEL,
    duration: DURATION_AGGREGATE_LEVEL,
    list_date: DATE_AGGREGATE_LEVEL,
    list_datetime: DATETIME_AGGREGATE_LEVEL,
    list_duration: DURATION_AGGREGATE_LEVEL
};

export const AGGREGATE_LEVEL_DEFAULTS = {
    date: "YEAR",
    datetime: "YEAR",
    duration: "HOUR",
    list_date: "YEAR",
    list_datetime: "YEAR",
    list_duration: "HOUR"
};

//const BOOLEAN_FILTERS = ["&", "|", "==", "!=", "or", "and"];

const BOOLEAN_FILTERS = [SEPARATOR_TEXT, "is true", "is false", SEPARATOR_TEXT, "empty", "not empty", SEPARATOR_TEXT, "top n"];

//const NUMBER_FILTERS = ["<", ">", "==", "<=", ">=", "!=", "is nan", "is not nan"];

const NUMBER_FILTERS = [SEPARATOR_TEXT, "==", "!=", SEPARATOR_TEXT, ">", ">=", "<", "<=", "between", SEPARATOR_TEXT, "in", "not in", SEPARATOR_TEXT, "empty", "not empty", SEPARATOR_TEXT, "top n"];

const DURATION_FILTERS = [SEPARATOR_TEXT, "==", "!=", SEPARATOR_TEXT, ">", ">=", "<", "<=", "between", SEPARATOR_TEXT, "in", "not in", SEPARATOR_TEXT, "empty", "not empty", SEPARATOR_TEXT, "top n"];

//const STRING_FILTERS = ["==", "contains", "!=", "in", "not in", "begins with", "ends with", "empty", "not empty"];

const STRING_FILTERS = [SEPARATOR_TEXT, "==", "!=", SEPARATOR_TEXT, "contains", "not contain", SEPARATOR_TEXT, "in", "not in", SEPARATOR_TEXT, "begins with", "ends with", SEPARATOR_TEXT, "empty", "not empty", SEPARATOR_TEXT, "top n"];

//const DATETIME_FILTERS = ["<", ">", "==", "<=", ">=", "!=", "empty", "not empty"];

const LIST_STRING_FILTERS = [SEPARATOR_TEXT, "==", "!=", "empty", "not empty", SEPARATOR_TEXT, [ELEMENT_LIST_TEXT, "element equals", "element not equals", "element contains",
        "element not contains", "element begins with", "element ends with", "element in", "element not in"]];

const LIST_BOOLEAN_FILTERS = [SEPARATOR_TEXT, "==", "!=", "empty", "not empty", SEPARATOR_TEXT, [ELEMENT_LIST_TEXT, "element is true", "element is false"]];

const LIST_NUMBER_FILTERS = [SEPARATOR_TEXT, "==", "!=", "empty", "not empty", SEPARATOR_TEXT, [ELEMENT_LIST_TEXT, "element equals", "element not equals", "element greater", "element greater or equal", "element less", "element less or equal",
    "element between", "element in", "element not in"]];

const LIST_DATETIME_FILTERS = [SEPARATOR_TEXT, "==", "!=", "empty", "not empty", SEPARATOR_TEXT, [ELEMENT_LIST_TEXT, "element equals", "element not equals", "element before", "element after", "element between", "element in", "element not in"]];

const LIST_DURATION_FILTERS = [SEPARATOR_TEXT, "==", "!=", "empty", "not empty", SEPARATOR_TEXT, [ELEMENT_LIST_TEXT, "element equals", "element not equals", "element greater", "element greater or equal", "element less", "element less or equal",
    "element between", "element in", "element not in"]];

const LIST_FILTERS = [SEPARATOR_TEXT, "==", "!=", "empty", "not empty", SEPARATOR_TEXT, "in (any)", "in (all)"];

/*const DATETIME_FILTERS = ["==", "!=", "after", "before", "between", "in", "not in", "empty", "not empty", "last 7 days", "last 10 days",
    "last 30 days", "today", "yesterday", "this week", "last week", "this month", "last month", "this quarter", "last quarter", "this year",
    "last year", "year to date", "all date range"];*/
const DATETIME_FILTERS = [SEPARATOR_TEXT, "==", "!=", SEPARATOR_TEXT, "before", "after", "between", SEPARATOR_TEXT, "in", "not in", SEPARATOR_TEXT, "relative date", SEPARATOR_TEXT, "empty", "not empty", SEPARATOR_TEXT, "top n"];

export const COLUMN_SEPARATOR_STRING = "|";
export const FLATTEN_COLUMN_SEPARATOR_STRING = " - ";

export const TYPE_FILTERS = {
    string: STRING_FILTERS,
    float: NUMBER_FILTERS,
    integer: NUMBER_FILTERS,
    decimal: NUMBER_FILTERS,
    boolean: BOOLEAN_FILTERS,
    datetime: DATETIME_FILTERS,
    date: DATETIME_FILTERS,
    duration: DURATION_FILTERS,
    list_string: LIST_STRING_FILTERS,
    list_boolean: LIST_BOOLEAN_FILTERS,
    list_float: LIST_NUMBER_FILTERS,
    list_integer: LIST_NUMBER_FILTERS,
    list_date: LIST_DATETIME_FILTERS,
    list_duration: LIST_DATETIME_FILTERS,
    list_datetime: LIST_DURATION_FILTERS
};

export const FILTER_OPERATER_TEXTS = {
    "------------------": SEPARATOR_TEXT,
    "==": "Equals",
    "!=": "Does not equal",
    "contains": "Contains",
    "not contain": "Does not contain",
    ">": "Greater than",
    ">=": "Greater than or equal to",
    "<": "Less than",
    "<=": "Less than or equal to",
    "between": "Between",
    "empty": "Is empty",
    "not empty": "Is not empty",
    "before": "Before",
    "after": "After",
    "relative date": "Relative date",
    "is true": "Is true",
    "is false": "Is false",
    "begins with": "Starts with",
    "ends with": "Ends with",
    "in": "Is in",
    "not in": "Is not in",
    "in (any)": "Is in (any)",
    "in (all)": "Is in (all)",
    "Number filter": "Choose number filter",
    "Bool filter": "Choose bool filter",
    "Date filter": "Choose date filter",
    "Datetime filter": "Choose datetime filter",
    "Time filter": "Choose time filter",
    "String filter": "Choose text filter",
    "List filter": "Choose list filter",
    "top n": "Top N",
    "element equals": "Equals",
    "element not equals": "Does not equal",
    "element contains": "Contains",
    "element not contains": "Does not contain",
    "element begins with": "Starts with",
    "element ends with": "Ends with",
    "element in": "Is in",
    "element not in": "Is not in",
    "element is true": "Is true",
    "element is false": "Is false",
    "element greater": "Greater than",
    "element greater or equal": "Greater than or equal to",
    "element less": "Less than",
    "element less or equal": "Less than or equal to",
    "element before": "Before",
    "element after": "After",
    "element between": "Between"
};

// Operator must be: lowercase, no space
export const FILTER_OPERATER_OBJ = {
    "==":           {operator: "==",          name: "=",            text: "Equals"},
    "!=":           {operator: "!=",          name: "!=",           text: "Does not equal"},
    "contains":     {operator: "contains",    name: "contains",     text: "Contains"},
    "not contain":  {operator: "not_contain", name: "not contain",  text: "Does not contain"},
    ">":            {operator: ">",           name: ">",            text: "Greater than"},
    ">=":           {operator: ">=",          name: ">=",           text: "Greater than or equal to"},
    "<":            {operator: "<",           name: "<",            text: "Less than"},
    "<=":           {operator: "<=",          name: "<=",           text: "Less than or equal to"},
    "between":      {operator: "between",     name: "between",      text: "Between"},
    "empty":        {operator: "empty",       name: "empty",        text: "Is empty"},
    "not empty":    {operator: "not_empty",   name: "not empty",    text: "Is not empty"},
    "before":       {operator: "before",      name: "<",       text: "Before"},
    "after":        {operator: "after",       name: ">",        text: "After"},
    "relative date": {operator: "relative_date", name: "relative date", text: "Relative date"},
    "is true":      {operator: "is_true",     name: "is true",      text: "Is true"},
    "is false":     {operator: "is_false",    name: "is false",     text: "Is false"},
    "begins with":  {operator: "begins_with", name: "starts with",  text: "Starts with"},
    "ends with":    {operator: "ends_with",   name: "ends with",    text: "Ends with"},
    "in":           {operator: "in",          name: "in",           text: "Is in"},
    "not in":       {operator: "not_in",      name: "not in",       text: "Is not in"},
    "in (any)":     {operator: "in_any",      name: "in (any)",     text: "Is in (any)"},
    "in (all)":     {operator: "in_all",      name: "in (all)",     text: "Is in (all)"},
    "top n":        {operator: "top_n",       name: "top n",        text: "Top N"},

    "element equals":       {operator: "element_equals",        name: "equals",       text: "Equals"},
    "element not equals":   {operator: "element_not_equals",    name: "not equals",   text: "Does not equal"},
    "element contains":     {operator: "element_contains",      name: "contains",     text: "Contains"},
    "element not contains": {operator: "element_not_contains",  name: "not contains", text: "Does not contain"},
    "element begins with":  {operator: "element_begins_with",   name: "starts with",  text: "Starts with"},
    "element ends with":    {operator: "element_ends_with",     name: "ends with",    text: "Ends with"},
    "element in":           {operator: "element_in",            name: "in",           text: "Is in"},
    "element not in":       {operator: "element_not_in",        name: "not in",       text: "Is not in"},

    "element is true":      {operator: "element_is_true",       name: "is true",      text: "Is true"},
    "element is false":     {operator: "element_is_false",      name: "is false",     text: "Is false"},
    "element greater":      {operator: "element_greater",       name: "greater than", text: "Greater than"},
    "element greater or equal":{operator: "element_greater_or_equal", name: "greater or equal", text: "Greater than or equal to"},
    "element less":         {operator: "element_less",          name: "less than",    text: "Less than"},
    "element less or equal":{operator: "element_less_or_equal", name: "less or equal",text: "Less than or equal to"},
    "element before":       {operator: "element_before",        name: "before",       text: "Before"},
    "element after":        {operator: "element_after",         name: "after",        text: "After"},
    "element between":      {operator: "element_between",       name: "between",      text: "Between"}
};

export const FILTER_DEFAULTS = {
    string: "==",
    float: "==",
    integer: "==",
    decimal: "==",
    boolean: "is true",
    datetime: "==",
    date: "==",
    duration: "==",
    list_string: "==",
    list_boolean: "==",
    list_float: "==",
    list_integer: "==",
    list_date: "==",
    list_duration: "==",
    list_datetime: "=="
};

export const ONE_SIDE_OPERATOR = ["is true", "is false", "empty", "not empty", "last 7 days", "last 10 days", "last 30 days", "today", "yesterday",
    "this week", "last week", "this month", "last month", "this quarter", "last quarter", "this year", "last year", "year to date", "all date range",
    "ignore all", "element is true", "element is false"];

export const NOT_CAST_LIST_VALUE_OPERATOR = ["element equals", "element not equals", "element contains", "element not contains", "element begins with",
    "element ends with", "element greater", "element greater or equal", "element less", "element less or equal", "element before", "element after"];

export const FILTERS_PERIOD_OPERATORS = ["last 7 days", "last 10 days", "last 30 days", "today", "yesterday", "this week", "last week", "this month",
    "last month", "this quarter", "last quarter", "this year", "last year", "year to date"];

export const TYPED_ARRAY_SENTINEL_VALUE_INT8 = 255;
export const TYPED_ARRAY_SENTINEL_VALUE_INT16 = 32767;
export const TYPED_ARRAY_SENTINEL_VALUE_INT32 = 2147483647;
export const TYPED_ARRAY_SENTINEL_VALUE_FLOAT32 = 3.40282e38;
export const TYPED_ARRAY_SENTINEL_VALUE_FLOAT64 = Number.MAX_VALUE;
export const COMBINED_TYPE_STR = "combined";
export const COMBINED_NAME = "__values__"; // Will change to "__VALUES__"
export const COMBINED_ALIAS_NAME = "Values";
export const COMBINED_MODES = {
    column: "column",
    row: "row"
};
export const ACTION_TYPE = {
    show_column: "show_column",
    hide_column: "hide_column",
    hide_grid_columns: "hide_grid_columns",
    change_active_dropdown: "change_active_dropdown",
    change_sort: "change_sort",
    change_filter: "change_filter",
    change_group_by_dropdown: "change_group_by_dropdown",
    change_column_name: "change_column_name",
    order_columns: "order_columns",
    close_tag: "close_tag",
    add_tag: "add_tag",
    change_data_formats: "change_data_formats",
    change_viewer_attribute: "change_viewer_attribute",
    change_multiple_sorts: "change_multiple_sorts",
    change_site_search: "change_site_search",
    change_column_width: "change_column_width"
};
export const BINNING_TYPE = [
    { key: "Off", value: "OFF" },
    { key: "On", value: "ON" }
];
export const PIVOT_VIEW_MODES = {
    flatten: 1,
    nested: 0
};
export const MAX_COLS = 2000;
export const MAX_COLS_TEXT = "2k";
export const MAX_DROPDOWN = 2000;
export const MAX_FILTER_OPTIONS = 1000;
export const MAX_TRUNCATED_SUGGESTION_VALUES = 80;

export const __FILTER_SEARCH__ = "__FILTER_SEARCH__";

export const SHOW_TYPE_DISPLAY_NAME = {
    "default": "",
    "running_total": " (running total)",
    "running_%": " (running %)",
    "%_of_row": " (% of row)",
    "%_of_column": " (% of column)",
    "%_of_grand_total": " (% of grand total)",
    "%_of_parent_column": " (% of parent column)",
    "%_of_parent_row": " (% of parent row)",
    "%_of_prev_value": " (% of prev value)",
    "diff_from_prev_value": " (diff from prev value)"
};

export const SHOW_TYPE_SHOW_NAME = {
    "default": "Default",
    "running_total": "Running total",
    "running_%": "Running %",
    "%_of_row": "% of row",
    "%_of_column": "% of column",
    "%_of_grand_total": "% of grand total",
    "%_of_parent_column": "% of parent column",
    "%_of_parent_row": "% of parent row",
    "%_of_prev_value": "% of previous value",
    "diff_from_prev_value": "Difference from previous value"
};

export const SHOW_TYPE_PERCENTS = ["running_%", "%_of_row", "%_of_column", "%_of_grand_total",
            "%_of_parent_column", "%_of_parent_row", "%_of_prev_value"];

export const RELATIVE_DATE_PERIOD = [
    {
        value: "next",
        active: true,
        name: "Next"
    },
    {
        value: "previous",
        active: true,
        name: "Prev"
    },
    {
        value: SEPARATOR_TEXT,
        active: false,
        name: SEPARATOR_TEXT
    },
    {
        value: "today",
        active: true,
        name: "Today"
    },
    {
        value: "this week",
        active: true,
        name: "This week"
    },
    {
        value: "this month",
        active: true,
        name: "This month"
    },
    {
        value: "this quarter",
        active: true,
        name: "This quarter"
    },
    {
        value: "this year",
        active: true,
        name: "This year"
    }
];

export const RELATIVE_DATE_PERIOD_THIS = ["today", "this week", "this month", "this quarter", "this year"];

export const RELATIVE_DATE_UNIT = ["days", "weeks", "months", "quarters", "years"];
export const RELATIVE_DATE_UNIT_SHOW_NAME = {
    "days": "Days",
    "weeks": "Weeks",
    "months": "Months",
    "quarters": "Quarters",
    "years": "Years"
};

export const GROUP_FILTER_NAME = "__GROUP_FILTER__";
export const GROUP_FILTER_ALIAS_NAME = "multiple fields";
export const GROUP_FILTER_SEPARATOR_FIELD = "/";

export const STATUS_BAR_COUNT_TEXT = "Count:";
export const STATUS_BAR_AVG_TEXT = "Average:";
export const STATUS_BAR_SUM_TEXT = "Sum:";

export const RE_EXTENSION = /(?:\.([^.]+))?$/;

// Ignore files that should not shown in the list files
export const IGNORE_FILE_NAMES = [
  '__MACOSX',
  '.DS_Store',
  '.vscode',
  '.idea',
  '.coverage',
];

export const ARCHIVE_EXTENSIONS = ["zip"];
