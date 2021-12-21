/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <boost/config.hpp>
#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/raw_types.h>
#include <perspective/table.h>
#include <perspective/column.h>
#include <perspective/storage.h>
#include <perspective/scalar.h>
#include <perspective/tracing.h>
#include <perspective/utils.h>
#include <perspective/logtime.h>
#include <perspective/column_meta.h>
#include <sstream>
namespace perspective {

t_table_recipe::t_table_recipe() {}

void
t_table::set_capacity(t_uindex idx) {
    m_capacity = idx;
#ifdef PSP_TABLE_VERIFY
    if (m_init) {
        for (auto c : m_columns) {
            c->verify_size();
            c->verify_size(m_capacity);
        }
    }

#endif
}

t_table::t_table(const t_table_recipe& recipe)
    : m_name(recipe.m_name)
    , m_dirname(recipe.m_dirname)
    , m_schema(recipe.m_schema)
    , m_size(recipe.m_size)
    , m_backing_store(recipe.m_backing_store)
    , m_init(false)
    , m_recipe(recipe)
    , m_from_recipe(true) {
    set_capacity(recipe.m_capacity);
}

t_table::t_table(const t_schema& s, t_uindex init_cap)
    : m_name("")
    , m_dirname("")
    , m_schema(s)
    , m_size(0)
    , m_backing_store(BACKING_STORE_MEMORY)
    , m_init(false)
    , m_from_recipe(false) {
    PSP_TRACE_SENTINEL();
    LOG_CONSTRUCTOR("t_table");
    set_capacity(init_cap);
}

t_table::t_table(const std::string& name, const std::string& dirname, const t_schema& s,
    t_uindex init_cap, t_backing_store backing_store)
    : m_name(name)
    , m_dirname(dirname)
    , m_schema(s)
    , m_size(0)
    , m_backing_store(backing_store)
    , m_init(false)
    , m_from_recipe(false) {
    PSP_TRACE_SENTINEL();
    LOG_CONSTRUCTOR("t_table");
    set_capacity(init_cap);
}

// THIS CONSTRUCTOR INITS. Do not use in production.
t_table::t_table(const t_schema& s, const std::vector<std::vector<t_tscalar>>& v)
    : m_name("")
    , m_dirname("")
    , m_schema(s)
    , m_size(0)
    , m_backing_store(BACKING_STORE_MEMORY)
    , m_init(false)
    , m_from_recipe(false) {
    PSP_TRACE_SENTINEL();
    LOG_CONSTRUCTOR("t_table");
    auto ncols = s.size();
    PSP_VERBOSE_ASSERT(
        std::all_of(v.begin(), v.end(),
            [ncols](const std::vector<t_tscalar>& vec) { return vec.size() == ncols; }),
        "Mismatched row size found");
    set_capacity(v.size());
    init();
    extend(v.size());
    std::vector<t_column*> cols = get_columns();
    for (t_uindex cidx = 0; cidx < ncols; ++cidx) {
        auto col = cols[cidx];
        for (t_uindex ridx = 0, loop_end = v.size(); ridx < loop_end; ++ridx) {
            col->set_scalar(ridx, v[ridx][cidx]);
        }
    }
}

t_table::~t_table() {
    PSP_TRACE_SENTINEL();
    LOG_DESTRUCTOR("t_table");
}

const std::string&
t_table::name() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_name;
}

void
t_table::init() {
    PSP_TRACE_SENTINEL();
    LOG_INIT("t_table");
    m_columns = std::vector<std::shared_ptr<t_column>>(m_schema.size());

    if (m_from_recipe) {
        t_uindex idx = 0;
        for (const auto& crecipe : m_recipe.m_columns) {
            m_columns[idx] = std::make_shared<t_column>(crecipe);
            m_columns[idx]->init();
            ++idx;
        }
        set_size(m_size);
        m_init = true;
        return;
    }

#ifdef PSP_PARALLEL_FOR
    PSP_PFOR(0, int(m_schema.size()), 1,
        [this](int idx)
#else
    for (t_uindex idx = 0, loop_end = m_schema.size(); idx < loop_end; ++idx)
#endif
        {
            const std::string& colname = m_schema.m_columns[idx];
            t_dtype dtype = m_schema.m_types[idx];
            t_dataformattype dftype = m_schema.m_data_format_types[idx];
            m_columns[idx]
                = make_column(colname, dtype, m_schema.m_status_enabled[idx], dftype);
            m_columns[idx]->init();
        }
#ifdef PSP_PARALLEL_FOR
    );
#endif

    m_init = true;

    m_dname_mapping = {};
}

std::shared_ptr<t_column>
t_table::make_column(
    const std::string& colname, t_dtype dtype, bool status_enabled, t_dataformattype dftype) {
    t_lstore_recipe a(m_dirname, m_name + std::string("_") + colname,
        m_capacity * get_dtype_size(dtype), m_backing_store);
    return std::make_shared<t_column>(dtype, status_enabled, a, m_capacity, dftype);
}

t_uindex
t_table::num_columns() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_schema.size();
}

t_uindex
t_table::num_rows() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_size;
}

t_uindex
t_table::size() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return num_rows();
}

std::map<std::string, std::string>
t_table::longest_text_cols() const {
    printf( "t_table::longest_text_cols %d, %d\n", num_rows(), num_columns());

    std::map<std::string, std::string> text_cols;
    t_uindex rsize = num_rows();
    t_uindex mrows = 20;
    mrows = std::min(mrows, rsize);

    for (t_uindex cidx = 0, ncols = num_columns(); cidx < ncols; ++cidx) {
        auto colname = m_schema.m_columns[cidx];
        if (colname == "psp_op" || colname == "psp_pkey") {
            continue;
        }

        std::cout << colname << "\n";

        auto col = get_const_column(colname).get();
        std::string str = "";

        std::cout << "start scanning row--------" << "\n";

        for (t_uindex ridx = 0; ridx < mrows; ++ridx) {
            auto scalar = col->get_scalar(ridx);
            auto str_val = scalar.to_string();
            if (str_val.size() > str.size()) {
                str = str_val;
            }
        }

        std::cout << "end scanning row--------" << "\n";

        text_cols[colname] = str;
    }
    printf( "t_table::longest_text_cols---ended\n");

    return text_cols;
}

t_dtype
t_table::get_dtype(const std::string& colname) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_schema.get_dtype(colname);
}

t_dataformattype
t_table::get_data_format_type(const std::string& colname) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_schema.get_data_format_type(colname);
}

std::shared_ptr<t_column>
t_table::get_column(const std::string& colname) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    t_uindex idx = m_schema.get_colidx(colname);
    return m_columns[idx];
}

std::shared_ptr<t_column>
t_table::get_column(t_uindex idx) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_columns[idx];
}

std::shared_ptr<const t_column>
t_table::get_const_column(const std::string& colname) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    t_uindex idx = m_schema.get_colidx(colname);
    return m_columns[idx];
}

std::shared_ptr<const t_column>
t_table::get_const_column(t_uindex idx) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_columns[idx];
}

std::vector<t_column*>
t_table::get_columns() {
    std::vector<t_column*> rval(m_columns.size());
    t_uindex idx = 0;
    for (const auto& c : m_columns) {
        rval[idx] = c.get();
        ++idx;
    }
    return rval;
}

std::vector<const t_column*>
t_table::get_const_columns() const {
    std::vector<const t_column*> rval(m_columns.size());
    t_uindex idx = 0;
    for (const auto& c : m_columns) {
        rval[idx] = c.get();
        ++idx;
    }
    return rval;
}

void
t_table::extend(t_uindex nelems) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    PSP_VERBOSE_ASSERT(m_init, "Table not inited");
    for (t_uindex idx = 0, loop_end = m_schema.size(); idx < loop_end; ++idx) {
        m_columns[idx]->extend_dtype(nelems);
    }
    m_size = std::max(nelems, m_size);
    set_capacity(std::max(nelems, m_capacity));
}

void
t_table::set_size(t_uindex size) {
    PSP_TRACE_SENTINEL();
    for (t_uindex idx = 0, loop_end = m_schema.size(); idx < loop_end; ++idx) {
        m_columns[idx]->set_size(size);
    }
    m_size = size;
}

void
t_table::reserve(t_uindex capacity) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    for (t_uindex idx = 0, loop_end = m_schema.size(); idx < loop_end; ++idx) {
        m_columns[idx]->reserve(capacity);
    }
    set_capacity(std::max(capacity, m_capacity));
}

t_column*
t_table::_get_column(const std::string& colname) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    t_uindex idx = m_schema.get_colidx(colname);
    return m_columns[idx].get();
}

const t_schema&
t_table::get_schema() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_schema;
}

t_schema
t_table::get_computed_schema(
    std::vector<t_computed_column_definition> computed_columns) const {
    std::vector<std::string> computed_column_names;
    std::vector<t_dtype> computed_column_types;

    computed_column_names.reserve(computed_columns.size());
    computed_column_types.reserve(computed_columns.size());
    
    // Computed columns live on the `t_gstate` master table, so use that schema
    auto schema = get_schema();

    for (const auto& computed : computed_columns) {
        bool skip = false;
        std::string name = std::get<0>(computed);

        // If the computed column has already been created, i.e. it exists on
        // the master table, return that type instead of doing a further lookup.
        if (schema.has_column(name)) {
            computed_column_names.push_back(name);
            computed_column_types.push_back(schema.get_dtype(name));
            continue;
        }

        t_computed_function_name computed_function_name = std::get<1>(computed);
        std::vector<std::string> input_columns = std::get<2>(computed);
        std::vector<std::string> input_col_types = std::get<3>(computed);
        
        // Look up return types
        std::vector<t_dtype> input_types;
        for (std::int32_t idx = 0; idx < input_columns.size(); ++idx) {
            auto input_column = input_columns[idx];
            auto input_col_type = input_col_types[idx];
            
            t_dtype type;

            if (input_col_type == "number") {
                type = DTYPE_FLOAT64;
            }
            else if (input_col_type == "string") {
                type = DTYPE_STR;
            }
            else {
                if (!schema.has_column(input_column)) {
                    auto it = std::find(
                        computed_column_names.begin(),
                        computed_column_names.end(),
                        input_column);
                    if (it == computed_column_names.end()) {
                        // Column doesn't exist anywhere, so treat this column
                        // as completely invalid. This also means that columns
                        // on its right, which may or may not depend on this column,
                        // are also invalidated.
                        std::cerr 
                            << "Input column `"
                            << input_column
                            << "` does not exist."
                            << std::endl;
                        skip = true;
                        break;
                    } else {
                        auto name_idx = std::distance(
                            computed_column_names.begin(), it);
                        type = computed_column_types[name_idx];
                    }
                } else {
                    type = schema.get_dtype(input_column);
                }
            }
            input_types.push_back(type);
        }

        t_computation computation = t_computed_column::get_computation(
            computed_function_name, input_types);

        if (computation.m_name == INVALID_COMPUTED_FUNCTION) {
            // Build error message and set skip to true
            std::vector<t_dtype> expected_dtypes = 
                t_computed_column::get_computation_input_types(computed_function_name);

            std::stringstream ss;
            ss
                << "Error: `"
                << computed_function_name_to_string(computed_function_name)
                << "`"
                << " expected input column types: [ ";
            for (t_dtype dtype : expected_dtypes) {
                ss << "`" << get_dtype_descr(dtype) << "` ";
            }
            ss << "], but received: [ ";
            for (t_dtype dtype : input_types) {
                ss << "`" << get_dtype_descr(dtype) << "` ";
            }
            ss << "]." << std::endl;
            std::cerr << ss.str();
            skip = true;
        }

        if (skip) {
            // this column depends on a column that does not exist, or has
            // an invalid type, so don't write into the
            continue;
        }

        t_dtype output_column_type = computation.m_return_type;

std::cout << "get_computed_schema----" << name << std::endl;
        computed_column_names.push_back(name);
        computed_column_types.push_back(output_column_type);
    }


    std::vector<t_dataformattype> computed_column_dftypes(computed_column_types.size());
    for (t_uindex idx = 0, loop_end = computed_column_types.size(); idx < loop_end; ++idx) {
        computed_column_dftypes.push_back(get_default_data_format_type(computed_column_types[idx]));
    }

    t_schema computed_schema(computed_column_names, computed_column_types, computed_column_dftypes);

    return computed_schema;
}

std::shared_ptr<t_table>
t_table::flatten() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    PSP_VERBOSE_ASSERT(is_pkey_table(), "Not a pkeyed table");

    std::shared_ptr<t_table> flattened = std::make_shared<t_table>(
        "", "", m_schema, DEFAULT_EMPTY_CAPACITY, BACKING_STORE_MEMORY);
    flattened->init();
    flatten_body<std::shared_ptr<t_table>>(flattened);
    return flattened;
}

bool
t_table::is_pkey_table() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_schema.is_pkey();
}

bool
t_table::is_same_shape(t_table& tbl) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    return m_schema == tbl.m_schema;
}

void
t_table::pprint() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    pprint(size(), &std::cout);
}

void
t_table::pprint(const std::string& fname) const {

    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    std::ofstream file;
    file.open(fname);
    pprint(size(), &file);
}

void
t_table::pprint(t_uindex nrows, std::ostream* os) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");

    if (!os)
        os = &std::cout;

    t_uindex nrows_ = nrows ? nrows : num_rows();
    nrows_ = std::min(nrows_, num_rows());

    t_uindex ncols = num_columns();

    std::vector<const t_column*> columns(ncols);
    for (t_uindex idx = 0; idx < ncols; ++idx) {
        columns[idx] = m_columns[idx].get();
        (*os) << m_schema.m_columns[idx] << ", ";
    }

    (*os) << std::endl;
    (*os) << "==========================" << std::endl;

    for (t_uindex ridx = 0; ridx < nrows_; ++ridx) {
        for (t_uindex cidx = 0; cidx < ncols; ++cidx) {
            (*os) << columns[cidx]->get_scalar(ridx).to_string() << ", ";
        }
        (*os) << std::endl;
    }
}

void
t_table::pprint(const std::vector<t_uindex>& vec) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    t_uindex nrows = vec.size();
    t_uindex ncols = num_columns();

    std::vector<const t_column*> columns(ncols);
    for (t_uindex idx = 0; idx < ncols; ++idx) {
        columns[idx] = m_columns[idx].get();
        std::cout << m_schema.m_columns[idx] << ", ";
    }

    std::cout << std::endl;
    std::cout << "==========================" << std::endl;

    for (t_uindex ridx = 0; ridx < nrows; ++ridx) {
        for (t_uindex cidx = 0; cidx < ncols; ++cidx) {
            std::cout << columns[cidx]->get_scalar(vec[ridx]) << ", ";
        }
        std::cout << std::endl;
    }
}

void
t_table::append(const t_table& other) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");

    t_uindex cursize = size();

    std::vector<const t_column*> src_cols;
    std::vector<t_column*> dst_cols;

    std::set<std::string> incoming;

    for (const auto& cname : other.m_schema.m_columns) {
        PSP_VERBOSE_ASSERT(
            other.get_const_column(cname)->get_dtype() == get_column(cname)->get_dtype(),
            "Mismatched column dtypes");
        src_cols.push_back(other.get_const_column(cname).get());
        dst_cols.push_back(get_column(cname).get());
        incoming.insert(cname);
    }
    t_uindex other_size = other.num_rows();

    for (const auto& cname : m_schema.m_columns) {
        if (incoming.find(cname) == incoming.end()) {
            get_column(cname)->extend_dtype(cursize + other_size);
        }
    }

#ifdef PSP_PARALLEL_FOR
    PSP_PFOR(0, int(src_cols.size()), 1,
        [&src_cols, dst_cols](int colidx)
#else
    for (t_uindex colidx = 0, loop_end = src_cols.size(); colidx < loop_end; ++colidx)
#endif
        { dst_cols[colidx]->append(*(src_cols[colidx])); }
#ifdef PSP_PARALLEL_FOR
    );
#endif
    set_capacity(std::max(m_capacity, m_size + other.num_rows()));
    set_size(m_size + other.num_rows());
}

void
t_table::clear() {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    for (t_uindex idx = 0, loop_end = m_columns.size(); idx < loop_end; ++idx) {
        m_columns[idx]->clear();
    }
    m_size = 0;
}

t_table_recipe
t_table::get_recipe() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    t_table_recipe rval;
    rval.m_name = m_name;
    rval.m_dirname = m_dirname;
    rval.m_schema = m_schema.get_recipe();
    rval.m_size = m_size;
    rval.m_capacity = m_capacity;
    rval.m_backing_store = m_backing_store;
    for (const auto& cname : m_schema.m_columns) {
        std::shared_ptr<const t_column> cptr = get_const_column(cname);
        rval.m_columns.push_back(cptr->get_recipe());
    }
    return rval;
}

t_mask
t_table::filter_cpp(
    t_filter_op combiner, const std::vector<t_fterm>& fterms, t_config& config) const {
    size_t nterms = fterms.size();
    std::vector<t_fterm::t_prepared> prepared;
    std::vector<std::vector<t_fterm::t_prepared>> dependency_prepareds;
    prepared.reserve(nterms);
    auto data_format_map = config.get_data_format_map();
    for(size_t i = 0; i < nterms; ++i) {
        std::vector<t_fterm::t_prepared> sub_prepareds;
        if (fterms[i].m_op == FILTER_OP_GROUP_FILTER) {
            prepared.push_back(nullptr);
            if (fterms[i].m_dependency->m_fterms.size() > 0) {
                for (t_uindex didx = 0, dsize = fterms[i].m_dependency->m_fterms.size(); didx < dsize; ++didx) {
                    auto sub_filter = fterms[i].m_dependency->m_fterms[didx];
                    for (t_uindex sidx = 0, ssize = sub_filter.m_dependency->m_fterms.size(); sidx < ssize; ++sidx) {
                        auto sub_f = sub_filter.m_dependency->m_fterms[sidx];
                        const t_column *col = &*get_const_column(sub_f.m_colname);
                        auto it = data_format_map.find(sub_f.m_colname);
                        t_dataformattype force_df = DATA_FORMAT_NONE;
                        if (it != data_format_map.end()) {
                            force_df = it->second;
                        }
                        sub_prepareds.push_back(sub_f.prepare(col, force_df));
                    }
                }
            }
            dependency_prepareds.push_back(sub_prepareds);
            continue;
        }
        dependency_prepareds.push_back(sub_prepareds);
        const t_column *col = &*get_const_column(fterms[i].m_colname);
        auto it = data_format_map.find(fterms[i].m_colname);
        t_dataformattype force_df = DATA_FORMAT_NONE;
        if (it != data_format_map.end()) {
            force_df = it->second;
        }
        prepared.push_back(fterms[i].prepare(col, force_df));
    }

    bool conjunction = combiner == FILTER_OP_AND;
    int32_t percentage = 0, prev_percentage = 0;
    t_uindex n = size();
    t_mask mask;
    mask.reserve(n);
    for(t_uindex i = 0; i < n; i += 32) {
        uint32_t mask_block = -int32_t(conjunction);
        for(size_t j = 0; j < nterms; ++j) {
            uint32_t m;
            if (fterms[j].m_op == FILTER_OP_GROUP_FILTER) {
                bool f_sub_conjunction = fterms[j].m_dependency->m_combiner == FILTER_OP_AND;
                uint32_t depend_mask_block = -int32_t(f_sub_conjunction);
                if (fterms[j].m_dependency->m_fterms.size() > 0) {
                    t_uindex prepared_idx = 0;
                    for (t_uindex didx = 0, dsize = fterms[j].m_dependency->m_fterms.size(); didx < dsize; ++didx) {
                        auto sub_filter = fterms[j].m_dependency->m_fterms[didx];
                        bool s_sub_conjunction = sub_filter.m_dependency->m_combiner == FILTER_OP_AND;
                        uint32_t sub_mask_block = -int32_t(s_sub_conjunction);
                        for (t_uindex sidx = 0, ssize = sub_filter.m_dependency->m_fterms.size(); sidx < ssize; ++sidx) {
                            auto sub_f = sub_filter.m_dependency->m_fterms[sidx];
                            auto sub_p = dependency_prepareds[j][prepared_idx];
                            prepared_idx++;
                            uint32_t m = sub_p(i, std::min(i+32, n));
                            if (s_sub_conjunction) {
                                sub_mask_block &= m;
                            } else {
                                sub_mask_block |= m;
                            }
                        }
                        if (f_sub_conjunction) {
                            depend_mask_block &= sub_mask_block;
                        } else {
                            depend_mask_block |= sub_mask_block;
                        }
                    }
                }
                m = depend_mask_block;
            } else {
                m = prepared[j](i, std::min(i+32, n));
            };
            if(conjunction)
                mask_block &= m;
            else
                mask_block |= m;
        }
        mask.append(mask_block);

        percentage = (i * 100) / n;
        if (percentage > prev_percentage) {
            config.update_query_percentage_store(QUERY_PERCENT_FILTER, percentage);
            prev_percentage = percentage;
        }
        if (config.get_cancel_query_status()) {
            return mask;
        }
    }
    return mask;
}

t_mask
t_table::having_cpp(
    t_filter_op combiner, const std::vector<t_fterm>& fterms_, t_config& config,
    t_uindex level, std::map<t_uindex, t_depth> dmap) const {
    auto self = const_cast<t_table*>(this);
    auto fterms = fterms_;

    t_mask mask(size());
    t_uindex fterm_size = fterms.size();
    std::vector<t_uindex> indices(fterm_size);
    std::vector<const t_column*> columns(fterm_size);

    for (t_uindex idx = 0; idx < fterm_size; ++idx) {
        indices[idx] = m_schema.get_colidx(fterms[idx].m_colname);
        columns[idx] = get_const_column(fterms[idx].m_colname).get();
        fterms[idx].coerce_numeric(columns[idx]->get_dtype());
        if (fterms[idx].m_use_interned) {
            t_tscalar& thr = fterms[idx].m_threshold;
            auto col = self->get_column(fterms[idx].m_colname);
            auto interned = col->get_interned(thr.get_char_ptr());
            thr.set(interned);
        }
    }

    std::int32_t percentage = 0;
    std::int32_t prev_percentage = 0;
    switch (combiner) {
        case FILTER_OP_AND: {
            t_tscalar cell_val;

            for (t_uindex ridx = 0, rloop_end = size(); ridx < rloop_end; ++ridx) {
                bool pass = true;
                for (t_uindex cidx = 0; cidx < fterm_size; ++cidx) {
                    if (!pass)
                        break;

                    const auto& ft = fterms[cidx];
                    if (dmap[ridx] != level) {
                        pass = false;
                        continue;
                    }
                    bool tval;

                    if (ft.m_use_interned) {
                        cell_val.set(*(columns[cidx]->get_nth<t_uindex>(ridx)));
                        tval = ft(cell_val);
                    } else {
                        cell_val = columns[cidx]->get_scalar(ridx);
                        tval = ft(cell_val);
                    }

                    if (!(cell_val.is_valid() || ft.m_op == FILTER_OP_IS_EMPTY) || !tval) {
                        pass = false;
                        break;
                    }
                }

                mask.set(ridx, pass);

                percentage = (ridx * 100) / rloop_end;
                if (percentage > prev_percentage) {
                    config.update_query_percentage_store(QUERY_PERCENT_FILTER, percentage);
                }
                if (config.get_cancel_query_status()) {
                    return mask;
                }
            }
        } break;
        case FILTER_OP_OR: {
            for (t_uindex ridx = 0, rloop_end = size(); ridx < rloop_end; ++ridx) {
                bool pass = false;
                if (dmap[ridx] == level) {
                    for (t_uindex cidx = 0; cidx < fterm_size; ++cidx) {
                        t_tscalar cell_val = columns[cidx]->get_scalar(ridx);
                        if (fterms[cidx](cell_val)) {
                            pass = true;
                            break;
                        }
                    }
                }
                mask.set(ridx, pass);

                percentage = (ridx * 100) / rloop_end;
                if (percentage > prev_percentage) {
                    config.update_query_percentage_store(QUERY_PERCENT_FILTER, percentage);
                }

                if (config.get_cancel_query_status()) {
                    return mask;
                }
            }
        } break;
        default: { PSP_COMPLAIN_AND_ABORT("Unknown filter op"); } break;
    }

    return mask;
}

inline bool
isValidDate(const std::string& s) {
    if (s.size() == 0)
        return false;
    switch (s[0]) {
        case 'J':
        case 'F':
        case 'M':
        case 'A':
        case 'S':
        case 'O':
        case 'N':
        case 'D':
            break;
        default:
            return false;
    }
    return true;
}

constexpr auto PUNCTUATIONS = "!\"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'";

inline std::vector<t_sterm>
sterm_split(const std::string& sterm_raw) {
    std::vector<t_sterm> results;
    std::string current_res;
    for (auto ch : sterm_raw) {
        if (!isspace(ch)) {
            current_res.push_back(ch);
        } else {
            if (!current_res.empty()) {
                results.push_back(current_res);
            }
            current_res.clear();
        }
    }
    if (!current_res.empty()) {
        results.push_back(current_res);
    }

    for (auto& res_ : results) {
        auto& res = res_.get_sterm();
        while (res.size() && res.find_first_of(PUNCTUATIONS) == 0)
            res_ = std::string(res.begin() + 1, res.end());
        while (res.size() && res.find_last_of(PUNCTUATIONS) == res.size() - 1)
            res_ = std::string(res.begin(), res.end() - 1);
    }
    return results;
}

inline std::string
sterms_join(const std::vector<t_sterm>& sterms) {
    std::string res;
    for (auto& st : sterms) {
        res += st.get_sterm() + ' ';
    }
    res.pop_back();
    return res;
}

t_mask
t_table::search_cpp(std::vector<t_searchspec> search_types, const std::vector<t_sterm>& sterms_,
    t_config& config) const {

    const_cast<t_table*>(this)->build_metadata();

    clock_t search_start = clock();

    t_mask mask(size());
    t_uindex num_cols = num_columns();
    std::vector<const t_column*> columns;
    std::vector<std::string> colnames;
    std::vector<t_tscalar> columnLastVal;
    std::vector<int8_t> columnLastRes;
    std::vector<t_searchtype> col_st;
    std::map<std::string, t_searchtype> search_maps;
    auto sinfo = config.get_sinfo();

    for (t_uindex sidx = 0, loop_end = search_types.size(); sidx < loop_end; ++sidx) {
        t_searchspec search_type = search_types[sidx];
        auto colname = search_type.get_name();
        search_maps[colname] = sinfo.contain_search_column(colname) ? search_type.get_type() : SEARCHTYPE_NULL;
    }

    for (t_uindex idx = 0, loop_end = num_cols; idx < loop_end; ++idx) {
        const std::string& colname = m_schema.m_columns[idx];
        if (colname == "psp_op" || colname == "psp_pkey") {
            continue;
        }
        auto columnData = get_const_column(colname).get();
        if (columnData->m_meta) { // TODO (background-built meta data)
                                  // ...
        } else {
            // ...
        }
        colnames.push_back(colname);
        col_st.push_back(search_maps[colname]);
        columns.push_back(columnData);
    }
    columnLastVal.resize(columns.size());
    columnLastRes.resize(columns.size(), -1);

    t_tscalar cell_val, scal;

    std::cout << "input sterms_.size() == " << sterms_.size() << std::endl;
    for (int i = 0; i < sterms_.size(); ++i) {
        std::cout << "sterm #" << i << " == " << sterms_[i].get_sterm() << std::endl;
    }

    std::string sterm_raw = sterms_.size() > 0 ? sterms_[0].get_sterm() : "NULL";
    std::cout << "sterm_raw='" << sterm_raw << "'" << std::endl;

    std::vector<t_sterm> sterms_word;
    std::vector<t_sterm> sterms_multiword;
    std::vector<int8_t> sterms_word_passed;
    std::vector<int8_t> sterms_after_date_passed;

    sterms_word = sterm_split(sterm_raw);
    t_date sterm_date;
    bool sterm_is_date = false;
    char sterms_after_date_raw[512] = {0};
    if (t_date::from_string(sterm_raw.data(), sterm_date)) {
        sterm_is_date = true;
        std::cout << "Date found" << std::endl;

        std::string loose;
        std::stringstream ss(sterm_raw);
        ss >> loose >> loose >> loose;
        ss.getline(sterms_after_date_raw, sizeof(sterms_after_date_raw));

        std::cout << "sterms_after_date_raw" << sterms_after_date_raw << std::endl;
    }

	// Check if other sterms are before the date
    if (!sterm_is_date) {
        auto copy = sterms_word;
        std::string before;
		while (copy.size() > 0) {
            auto joined = sterms_join(copy);
            if (t_date::from_string(joined.data(), sterm_date)) {
                sterm_is_date = true;
                std::stringstream ss(joined);
                std::string loose;
                ss >> loose >> loose >> loose;
                char tmp[512] = {0};
                ss.getline(tmp, sizeof(tmp));
                before += tmp;
                break;
			}
            before += copy[0].get_sterm() + " ";
            copy = {copy.begin() + 1, copy.end()};
		}
        if (sterm_is_date) {
            while (before.size() > 0 && before.back() == ' ')
                before.pop_back();
            std::cout << "Find date (not the first sterm)" << std::endl;
            std::cout << "Sterms before/after are: " << before << std::endl;
            strcpy(sterms_after_date_raw, before.data());
		}
	}

    std::vector<std::string> sterms_after_date;
    sterms_after_date.push_back({});
    for (size_t i = 0, n = strlen(sterms_after_date_raw); i < n; ++i) {
        if (isspace(sterms_after_date_raw[i])) {
            sterms_after_date.push_back({});
        } else {
            sterms_after_date.back().push_back(sterms_after_date_raw[i]);
        }
    }

	auto sterms_after_date_set
        = std::set<std::string>(sterms_after_date.begin(), sterms_after_date.end());
    sterms_after_date_set.erase("");
    sterms_after_date = {sterms_after_date_set.begin(), sterms_after_date_set.end()};
	
	std::vector<t_sterm> sterms_after_date_;
    for (auto &v : sterms_after_date) {
        sterms_after_date_.push_back(v);
    }

	for (auto v : sterms_after_date) {
        std::cout << "STERMS_AFTER_DATE " << v << std::endl;
	}

    sterms_word_passed.resize(sterms_word.size(), 0);
    sterms_after_date_passed.resize(sterms_after_date.size(), 0);

    sterms_multiword.resize(2);
    sterms_multiword[0] = sterm_raw;
    sterms_multiword[1] = sterms_join(sterms_word);
    if (sterms_multiword[0].get_sterm() == sterms_multiword[1].get_sterm())
        sterms_multiword.pop_back();
    if (sterms_multiword[0].get_sterm() == sterms_word[0].get_sterm()) {
        sterms_multiword.pop_back();
    }

    for (int i = 1; i < sterms_word.size(); ++i) {
        auto new_sterm = sterms_word[i - 1].get_sterm() + " " + sterms_word[i].get_sterm();
        if (sterms_multiword.end()
            == std::find_if(sterms_multiword.begin(), sterms_multiword.end(),
                   [new_sterm](const t_sterm& v) { return v.get_sterm() == new_sterm; })) {
            sterms_multiword.push_back(new_sterm);
        }
    }

    /// std::cout << "sterms_multiword.size() == " << sterms_multiword.size() << std::endl;

    std::vector<uint8_t> sterm_word_is_int(sterms_word.size());
    std::vector<uint8_t> sterm_word_is_double(sterms_word.size());
    std::vector<double> sterm_word_double(sterms_word.size(), 0.0);
    for (size_t i = 0; i < sterms_word.size(); ++i) {
        auto& st = sterms_word[i];
        sterm_word_is_int[i] = !st.get_sterm().empty()
            && st.get_sterm().find_first_not_of("-0123456789") == std::string::npos
            && std::count(st.get_sterm().begin(), st.get_sterm().end(), '-') <= 1;
        sterm_word_is_double[i] = !st.get_sterm().empty()
            && st.get_sterm().find_first_not_of("-0123456789.") == std::string::npos
            && std::count(st.get_sterm().begin(), st.get_sterm().end(), '.') <= 1
            && std::count(st.get_sterm().begin(), st.get_sterm().end(), '-') <= 1;
        if (sterm_word_is_double[i]) {
            std::istringstream ss(st.get_sterm());
            ss >> sterm_word_double[i];
        }
    }

    std::int32_t percentage = 0;
    std::int32_t prev_percentage = 0;

    // Skips
    bool undo_search = false;
    double max_double = -1 * std::numeric_limits<double>::infinity();
    for (int col = 0; col < columns.size(); ++col) {
        auto col_max_double = columns[col]->m_meta->max_double;
        if (col_max_double > max_double)
            max_double = col_max_double;
    }
    if (!sterm_is_date) {
		for (int sterm = 0; sterm < (int)sterms_word.size(); ++sterm) {
			bool sterm_is_double_ = sterm_word_is_double[sterm];

			if (sterm_is_double_) {
                constexpr auto g_21centuryMaxYear = 2099;
                if (max_double < sterm_word_double[sterm] && sterm_word_double[sterm] > g_21centuryMaxYear) {
					undo_search = true;
					std::cout << "Skipping all columns" << std::endl;
					break;
				}
			}
		}
	}

    const auto num_columns = columns.size();
    const auto col_st_sz = col_st.size();
    const auto sterms_word_size = sterms_word.size();
    const auto num_rows = undo_search ? 0 : size();
    const auto sterms_after_date_passed_size = sterms_after_date.size();
    const auto sterms_date = {t_sterm(sterm_date)};
    for (t_uindex row = 0; row < num_rows; ++row) {
        memset(sterms_word_passed.data(), 0, sizeof(int8_t) * sterms_word_size);
        memset(
            sterms_after_date_passed.data(), 0, sizeof(int8_t) * sterms_after_date_passed_size);
        bool all_sterms_passed = false;
        bool date_sterm_passed = false;
        for (size_t idx = 0; idx < num_columns; ++idx) {
            scal = columns[idx]->get_scalar(row);

            auto& meta = *columns[idx]->m_meta;
            if (idx >= col_st_sz)
                break;
            auto type = col_st[idx];
            if (type == t_searchtype::SEARCHTYPE_NULL)
                continue;

            const bool has_multiword = meta.contains_multiple_words != t_column_prop::NO_MATCH;
            const bool has_singleword
                = meta.contains_multiple_words != t_column_prop::ALL_MATCH;

            if (sterm_is_date) {
                for (auto& st : sterms_date) {
                    if (st.call_pp(scal, type)) {
                        date_sterm_passed = true;
                        break;
                    }
                }
            }
            if (has_multiword && !date_sterm_passed) {
                if (type == t_searchtype::SEARCHTYPE_EQUALS && !sterms_multiword.empty()) {
                    for (auto& st : sterms_multiword) {
                        if (st.call_pp(scal, type)) {
                            all_sterms_passed = true;
                            break;
                        }
                    }
                } else {
                    // A
                    for (size_t sterm = 0; sterm < sterms_word_size; ++sterm) {
                        auto& st = sterms_word[sterm];
                        if (st.call_pp(scal, type)) {
                            sterms_word_passed[sterm] = 1;
                        }
                    }
                }
            }
            if (has_singleword && !all_sterms_passed && !date_sterm_passed) {
                // B
                /// std::cout << "sterms_word_size" << sterms_word_size << std::endl;
                for (size_t sterm = 0; sterm < sterms_word_size; ++sterm) {
                    auto& st = sterms_word[sterm];

                    // begin check meta
                    bool sterm_is_int_ = sterm_word_is_int[sterm];
                    bool sterm_is_double_ = sterm_word_is_double[sterm];

                    if (type == t_searchtype::SEARCHTYPE_EQUALS) {
                        if (!sterm_is_int_ && meta.is_integer == t_column_prop::ALL_MATCH) {
                            continue;
                        }
                        if (sterm_is_int_ && meta.is_integer == t_column_prop::NO_MATCH) {
                            continue;
                        }
                        if (!sterm_is_double_ && meta.is_double == t_column_prop::ALL_MATCH) {
                            continue;
                        }
                        if (sterm_is_double_ && meta.is_double == t_column_prop::NO_MATCH) {
                            continue;
                        }
                    }

                    if (sterm_is_double_ && meta.contains_digits == t_column_prop::NO_MATCH) {
                        continue;
                    }
                    if (!sterm_is_double_ && !sterm_is_int_) {
                        auto sz = st.get_sterm().size();
                        if (meta.max_length && sz > *meta.max_length)
                            continue;
                        if (type != t_searchtype::SEARCHTYPE_CONTAINS) {
                            if (meta.is_date != t_column_prop::ALL_MATCH
                                && !meta.has_word_starts_with[tolower(st.get_sterm()[0])]) {
                                continue;
                            }
                        }
                    }
                    // end check meta

                    if (type == t_searchtype::SEARCHTYPE_EDGE
                        && meta.is_date == t_column_prop::NO_MATCH
                        && meta.contains_multiple_words == t_column_prop::NO_MATCH)
                        type = t_searchtype::SEARCHTYPE_STARTS_WITH;

                    if (type != t_searchtype::SEARCHTYPE_NULL
                        && meta.is_date == t_column_prop::ALL_MATCH && sterm_is_date) {
                        type = t_searchtype::SEARCHTYPE_EQUALS;
                    }

                    bool pass = st.call_pp(scal, type);
                    if (pass) {
                        sterms_word_passed[sterm] = 1;
                    }
                }
            }
        }

        if (!all_sterms_passed && date_sterm_passed) {
            size_t n = sterms_after_date_passed_size;

            for (size_t idx = 0; idx < num_columns; ++idx) {
                scal = columns[idx]->get_scalar(row);

                auto& meta = *columns[idx]->m_meta;
                if (idx >= col_st_sz)
                    break;
                auto type = col_st[idx];
                if (type == t_searchtype::SEARCHTYPE_NULL)
                    continue;

                for (size_t sterm = 0; sterm < n; ++sterm) {
                    auto& st = sterms_after_date_[sterm];
                    if (st.call_pp(scal, type)) {
                        sterms_after_date_passed[sterm] = 1;
                    }
                }
			}

			bool ok = true;
			for (size_t i = 0; i < n; ++i) {
                if (!sterms_after_date_passed[i]) {
                    ok = false;
                    break;
				}
			}
            if (ok)
                all_sterms_passed = true;
        }

        if (!all_sterms_passed) {
            size_t succeed = 0;
            for (size_t sterm = 0; sterm < sterms_word_size; ++sterm) {
                if (sterms_word_passed[sterm])
                    ++succeed;
            }
            if (succeed == sterms_word_size)
                all_sterms_passed = true;
        }

        if (all_sterms_passed) {
            mask.set(row, true);
        }

        percentage = (row * 100) / num_rows;
        if (percentage > prev_percentage) {
            config.update_query_percentage_store(QUERY_PERCENT_SEARCH, percentage);
        }
        if (config.get_cancel_query_status()) {
            return mask;
        }
    }

    config.update_query_percentage_store(QUERY_PERCENT_SEARCH, 100);

    std::cout << "search_cpp " << double(clock() - search_start) / CLOCKS_PER_SEC << std::endl;

    return mask;
}

t_uindex
t_table::get_capacity() const {
    return m_capacity;
}

t_table*
t_table::clone_(const t_mask& mask) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    t_schema schema = m_schema;

    t_table* rval = new t_table("", "", schema, 5, BACKING_STORE_MEMORY);
    rval->init();

    for (const auto& cname : schema.m_columns) {
        rval->set_column(cname, get_const_column(cname)->clone(mask));
    }

    rval->set_size(mask.count());
    rval->set_dname_mapping(m_dname_mapping);
    return rval;
}

std::shared_ptr<t_table>
t_table::clone(const t_mask& mask) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    auto tbl = clone_(mask);
    return std::shared_ptr<t_table>(tbl);
}

std::shared_ptr<t_table>
t_table::clone() const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    t_schema schema = m_schema;
    auto rval = std::make_shared<t_table>("", "", schema, 5, BACKING_STORE_MEMORY);
    rval->init();

    for (const auto& cname : schema.m_columns) {
        rval->set_column(cname, get_const_column(cname)->clone());
    }
    rval->set_size(size());
    rval->set_dname_mapping(m_dname_mapping);
    return rval;
}

std::shared_ptr<t_column>
t_table::add_column_sptr(
    const std::string& name, t_dtype dtype, bool status_enabled, t_dataformattype dftype) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    PSP_VERBOSE_ASSERT(
        !m_from_recipe, "Adding columns to recipe based tables not supported yet.");

    if (m_schema.has_column(name)) {
        return m_columns.at(m_schema.get_colidx(name));
    }
    m_schema.add_column(name, dtype, dftype, name);
    m_columns.push_back(make_column(name, dtype, status_enabled, dftype));
    m_columns.back()->init();
    m_columns.back()->reserve(std::max(size(), std::max(static_cast<t_uindex>(8), m_capacity)));
    m_columns.back()->set_size(size());
    return m_columns.back();
}

void
t_table::remove_column(
    const std::string& name) {
    if (!m_schema.has_column(name)) return;

    t_uindex idx = m_schema.get_colidx(name);
    m_columns.erase(m_columns.begin() + idx);

    m_schema.remove_column(name);
}

t_column*
t_table::add_column(
    const std::string& name, t_dtype dtype, bool status_enabled, t_dataformattype dftype) {
    return add_column_sptr(name, dtype, status_enabled, dftype).get();
}

void
t_table::promote_column(const std::string& name, t_dtype new_dtype, t_dataformattype new_dftype,
    std::int32_t iter_limit, bool fill) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");

    if (!m_schema.has_column(name)) {
        std::cout << "Cannot promote a column that does not exist." << std::endl;
        return;
    }

    t_uindex idx = m_schema.get_colidx(name);
    std::shared_ptr<t_column> current_col = m_columns[idx];

    // create the new column and copy data
    std::shared_ptr<t_column> promoted_col
        = make_column(name, new_dtype, current_col->is_status_enabled(), new_dftype);
    promoted_col->init();
    promoted_col->reserve(std::max(size(), std::max(static_cast<t_uindex>(8), m_capacity)));
    promoted_col->set_size(size());

    if (fill) {
        for (auto i = 0; i < iter_limit; ++i) {
            switch (new_dtype) {
                case DTYPE_FLOAT64: {
                    std::int32_t* val = current_col->get_nth<std::int32_t>(i);
                    double fval = static_cast<double>(*val);
                    promoted_col->set_nth(i, fval);
                } break;
                case DTYPE_STR: {
                    std::int32_t* val = current_col->get_nth<std::int32_t>(i);
                    std::string fval = std::to_string(*val);
                    promoted_col->set_nth(i, fval);
                } break;
                default: { PSP_COMPLAIN_AND_ABORT("Bad promotion"); }
            }
        }
    }

    // finally, mutate schema and columns
    m_schema.retype_column(name, new_dtype, new_dftype, name);
    set_column(idx, promoted_col);
}

void
t_table::set_column(t_uindex idx, std::shared_ptr<t_column> col) {
    m_columns[idx] = col;
}

void
t_table::set_column(const std::string& name, std::shared_ptr<t_column> col) {
    t_uindex idx = m_schema.get_colidx(name);
    set_column(idx, col);
}

t_column*
t_table::clone_column(const std::string& existing_col, const std::string& new_colname) {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");

    PSP_VERBOSE_ASSERT(
        !m_from_recipe, "Adding columns to recipe based tables not supported yet.");

    if (!m_schema.has_column(existing_col)) {
        std::cout << "Cannot clone non existing column";
        return 0;
    }

    t_uindex idx = m_schema.get_colidx(existing_col);
    m_schema.add_column(new_colname, m_columns[idx]->get_dtype(), m_columns[idx]->get_data_format_type(), new_colname);
    m_columns.push_back(m_columns[idx]->clone());
    m_columns.back()->reserve(std::max(size(), std::max(static_cast<t_uindex>(8), m_capacity)));
    m_columns.back()->set_size(size());
    return m_columns.back().get();
}

std::string
t_table::repr() const {
    std::stringstream ss;
    ss << "t_table<" << this << ">";
    return ss.str();
}

void
t_table::verify() const {
    for (auto& c : m_columns) {
        c->verify_size(m_capacity);
        c->verify();
    }

    for (auto& c : m_columns) {
        PSP_VERBOSE_ASSERT(c, || (size() == c->size()), "Ragged table encountered");
    }
}

void
t_table::reset() {
    m_size = 0;
    m_capacity = DEFAULT_EMPTY_CAPACITY;
    init();
}

std::vector<t_tscalar>
t_table::get_scalvec() const {
    auto nrows = size();
    auto cols = get_const_columns();
    auto ncols = cols.size();
    std::vector<t_tscalar> rv;
    for (t_uindex idx = 0; idx < nrows; ++idx) {
        for (t_uindex cidx = 0; cidx < ncols; ++cidx) {
            rv.push_back(cols[cidx]->get_scalar(idx));
        }
    }
    return rv;
}

void
t_table::update_data_formats(const std::vector<t_data_format_spec>& data_formats) {
    // update new data format types for current schema
    m_schema.update_data_formats(data_formats);

    // update data format type for each column
    for (t_uindex idx = 0, loop_end = data_formats.size(); idx < loop_end; ++idx) {
        auto data_format = data_formats[idx];
        auto column = _get_column(data_format.get_name());
        column->set_data_format_type(data_format.get_type());
    }
}

std::shared_ptr<t_column> t_table::operator[](const std::string& name) {
    if (!m_schema.has_column(name)) {
        return std::shared_ptr<t_column>(nullptr);
    }
    return m_columns[m_schema.get_colidx(name)];
}

bool
operator==(const t_table& lhs, const t_table& rhs) {
    return lhs.get_scalvec() == rhs.get_scalvec();
}

void
t_table::build_metadata() {
    auto cols = this->get_columns();
    for (auto col : cols) {
        if (col->m_meta == nullptr) {
            col->update_metadata();
        }
    }
}

void
t_table::rename_columns(const std::map<std::string, std::string>& col_map) {
    m_schema.rename_columns(col_map);
}

void
t_table::set_dname_mapping(const std::map<std::string, std::string>& dname_mapping) {
    for (const auto& it : dname_mapping) {
        m_dname_mapping[it.first] = it.second;
    }
}

void
t_table::clear_dname_mapping(const std::string& colname) {
    m_dname_mapping.erase(colname);
}

void
t_table::update_dname_mapping(const std::string& current_name, const std::string& new_name) {
    if (current_name == new_name) {
        return;
    }

    auto it = m_dname_mapping.find(current_name);
    if (it != m_dname_mapping.end()) {
        m_dname_mapping[new_name] = it->second;
        m_dname_mapping.erase(it);
    }
}

const std::map<std::string, std::string>&
t_table::get_dname_mapping() const {
    return m_dname_mapping;
}

std::map<std::string, t_uindex>
t_table::get_truncated_columns() const {
    std::map<std::string, t_uindex> truncated_columns{};
    for (t_uindex idx = 0, loop_end = m_schema.size(); idx < loop_end; ++idx) {
        auto truncated_type = m_columns[idx]->get_truncated();
        if (truncated_type == WARNING_TYPE_LIMITED_VALUES) {
            truncated_columns.insert(std::pair<std::string, t_uindex>(m_schema.m_columns[idx], t_uindex(1)));
        } else if (truncated_type == WARNING_TYPE_LIMITED_SIZE) {
            truncated_columns.insert(std::pair<std::string, t_uindex>(m_schema.m_columns[idx], t_uindex(2)));
        } else if (truncated_type == WARNING_TYPE_LIMITED_BOTH) {
            truncated_columns.insert(std::pair<std::string, t_uindex>(m_schema.m_columns[idx], t_uindex(3)));
        }
    }
    return truncated_columns;
}

} // end namespace perspective