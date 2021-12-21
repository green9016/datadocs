/******************************************************************************
 *
 * Copyright (c) 2019, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/view.h>
#include <sstream>

namespace perspective {
template <typename CTX_T>
View<CTX_T>::View(t_pool* pool, const std::shared_ptr<CTX_T> &ctx, const std::shared_ptr<t_gnode> &gnode,
    const std::string &name, const std::string &separator, const t_config &config)
    : m_pool(pool)
    , m_ctx(ctx)
    , m_gnode(gnode)
    , m_name(name)
    , m_separator(separator)
    , m_col_offset(0)
    , m_config(config) {

    // We should deprecate t_pivot and just use string column names throughout
    for (const t_pivot& rp : m_config.get_row_pivots()) {
        m_row_pivots.push_back(rp.name());
    }

    for (const t_pivot& cp : m_config.get_column_pivots()) {
        m_column_pivots.push_back(cp.name());
    }

    m_aggregates = m_config.get_aggregates();
    m_filters = m_config.get_fterms();
    m_sorts = m_config.get_sortspecs();
    m_dftypes = m_config.get_data_formats();

    // configure data window for column-only rows
    //is_column_only() ? m_row_offset = 1 : m_row_offset = 0;
    m_row_offset = 0;
    m_suggestion_col = nullptr;
    m_show_type_names = std::map<std::string, std::string>{};
}

template <typename CTX_T>
View<CTX_T>::~View() {
    m_pool->unregister_context(m_gnode->get_id(), m_name);
    m_suggestion_col.reset();
}

template <>
std::int32_t
View<t_ctx0>::sides() const {
    return 0;
}

template <>
std::int32_t
View<t_ctx1>::sides() const {
    return 1;
}

template <>
std::int32_t
View<t_ctx2>::sides() const {
    return 2;
}

template <typename CTX_T>
std::int32_t
View<CTX_T>::num_rows() const {
    auto paginationspec = m_config.get_paginationspec();
    auto flat_mode = m_config.is_pivot_view_flat_mode();
    bool add_one = m_config.get_num_rpivots() > 0 && !flat_mode;
    t_index num_rows = 0;
    if (is_column_only()) {
        //return m_ctx->get_row_count() - 1;
        if (m_config.has_row_combined()) {
            auto max_rows = m_config.get_max_rows();
            auto ctx_num_rows = m_config.get_num_aggregates();
            if (max_rows != -1 && max_rows < ctx_num_rows) {
                num_rows = max_rows;
            } else {
                num_rows = ctx_num_rows;
            }
        } else {
            num_rows = 1;
        }
    } else {
        auto max_rows = m_config.get_max_rows();
        auto ctx_num_rows = m_ctx->get_row_count();
        if (max_rows != -1 && max_rows < ctx_num_rows) {
            if (m_config.get_num_rpivots() > 0) {
                num_rows = max_rows + 1;
            } else {
                num_rows = max_rows;
            }
        } else {
            if (flat_mode && m_config.get_num_rpivots() == 0 && m_config.get_num_cpivots() == 0) {
                num_rows = 2;
            } else {
                num_rows = ctx_num_rows;
            }
        }
        //return m_ctx->get_row_count();
    }

    // Check enable pagination or not
    if (paginationspec.enable_pagination()) {
        auto items_per_page = paginationspec.get_items_per_page();
        auto page_num = paginationspec.get_page_num();
        // Remaining number of rows from current page index
        t_index remaining_rows = num_rows - (page_num - 1) * items_per_page;
        // Case 1: page number > page size
        if (remaining_rows < 0) {
            return 0;
        }
        // Case 2: remaing item > items per page
        else if (remaining_rows > items_per_page) {
            return items_per_page + (add_one ? 1 : 0);
        }
        // Case 3: last page
        else {
            return remaining_rows;
        }
    } else {
        return num_rows;
    }
}

template <typename CTX_T>
std::int32_t
View<CTX_T>::num_columns() const {
    auto max_columns = m_config.get_max_columns();
    auto ctx_num_columns = m_ctx->unity_get_column_count();
    if (max_columns != -1 && max_columns < ctx_num_columns) {
        return max_columns;
    } else {
        return ctx_num_columns;
    }
    //return m_ctx->unity_get_column_count();
}

/**
 * @brief Return correct number of columns when headers need to be skipped.
 *
 * @tparam
 * @return std::int32_t
 */
template <>
std::int32_t
View<t_ctx2>::num_columns() const {
    /*if (m_sorts.size() > 0) {
        auto depth = m_column_pivots.size();
        auto col_length = m_ctx->unity_get_column_count();
        auto count = 0;
        for (t_uindex i = 0; i < col_length; ++i) {
            if (m_ctx->unity_get_column_path(i + 1).size() == depth) {
                count++;
            }
        }
        return count;
    } else {
        return m_ctx->unity_get_column_count();
    }*/
    auto max_columns = m_config.get_max_columns();
    auto ctx_num_columns = m_ctx->unity_get_column_count();
    if (max_columns != -1 && max_columns < ctx_num_columns) {
        return max_columns;
    } else {
        return ctx_num_columns;
    }
    //return m_ctx->unity_get_column_count();
}

// Metadata construction
template <>
std::vector<std::vector<t_tscalar>>
View<t_ctx2>::column_names(bool skip, std::int32_t depth, bool from_schema, bool subtotal) const {
    if (m_cache.m_is_enabled) {
        auto res = m_cache.m_column_names_cache.find(std::make_tuple(skip, depth, from_schema, subtotal));
        if (res != m_cache.m_column_names_cache.end()) {
            return res->second;
        }
    }

    bool flat_mode = m_config.is_pivot_view_flat_mode();
    bool row_combined = m_ctx->has_row_combined();
    t_uindex num_rpivots = m_config.get_num_rpivots() + (row_combined ? 1 : 0);
    t_uindex col_count = flat_mode ? m_ctx->unity_get_column_count() - num_rpivots : m_ctx->unity_get_column_count();
    std::vector<std::vector<t_tscalar>> names;
    std::vector<std::string> aggregate_names;
    auto max_columns = m_config.get_max_columns();

    const std::vector<t_aggspec> aggs = m_ctx->get_aggregates();
    std::cout << "--column_names--";

    for (const t_aggspec& agg : aggs) {
        std::cout << agg.name() << ",";
        aggregate_names.push_back(agg.name());
    }
    std::cout << std::endl;

    auto aggsize = aggregate_names.size();

    //t_uindex col_count = m_ctx->unity_get_column_count();
    if (from_schema) {
        for (t_uindex key = 0; key != col_count; ++key) {
            //std::string name = aggregate_names[key % aggregate_names.size()];
            std::string name;
            if (aggsize > 0) {
                name = aggregate_names[key % aggregate_names.size()];
            }

            std::vector<t_tscalar> col_path = m_ctx->unity_get_column_path(key + 1);
            if (skip && col_path.size() < static_cast<unsigned int>(depth)) {
                continue;
            }

            std::vector<t_tscalar> new_path;
            for (auto path = col_path.rbegin(); path != col_path.rend(); ++path) {
                std::string str = (*path).to_string();
                if ((*path).is_error()) {
                    (*path).set(get_interned_tscalar("(error)"));
                } else if (str == "" || !(*path).is_valid()) {
                    (*path).set(get_interned_tscalar("(blank)"));
                }
                new_path.push_back(*path);
            }
            if (new_path.empty()) {
                new_path.push_back(get_interned_tscalar("Total"));
            }
            if (aggsize > 0) {
                new_path.push_back(m_ctx->get_aggregate_name(key % aggregate_names.size()));
            }
            names.push_back(new_path);
        }
    } else if (!m_config.has_row_combined() && aggsize > 1 && !subtotal) {
        auto combined_idx = m_config.get_combined_index();
        std::vector<std::pair<t_index, t_index>> indices;
        m_ctx->get_column_aggregate_info(indices);
        for (t_uindex key = 0; key != col_count; ++key) {
            std::string name;
            if (key + 1 > indices.size()) {
                break;
            }
            auto indice = indices[key + 1];
            if (indice.second != -1) {
                name = aggregate_names[indice.second];
            }

            //std::vector<t_tscalar> col_path = m_ctx->unity_get_column_path(key + 1);
            std::vector<t_tscalar> col_path = m_ctx->get_column_path(indice.first);
            auto psize = col_path.size();
            if (skip && psize < static_cast<unsigned int>(depth)) {
                continue;
            }

            std::vector<t_tscalar> new_path;
            for (t_index cidx = psize - 1; cidx >= 0; --cidx) {
                if (cidx == psize - 1 - combined_idx && indice.second != -1) {
                    new_path.push_back(m_ctx->get_aggregate_name(indice.second));
                }
                std::string str = col_path[cidx].to_string();
                if (col_path[cidx].is_error()) {
                    col_path[cidx].set(get_interned_tscalar("(error)"));
                } else if (str == "" || !col_path[cidx].is_valid()) {
                    col_path[cidx].set(get_interned_tscalar("(blank)"));
                }
                new_path.push_back(col_path[cidx]);
            }
            if (new_path.empty()) {
                new_path.push_back(get_interned_tscalar("Total"));
            }

            if (psize <= combined_idx && indice.second != -1) {
                new_path.push_back(m_ctx->get_aggregate_name(indice.second));
            }
            names.push_back(new_path);
        }
    } else {
        for (t_uindex key = 0; key != col_count; ++key) {
            std::vector<t_tscalar> col_path = m_ctx->unity_get_column_path(key + 1);
            auto psize = col_path.size();
            if (skip && psize < static_cast<unsigned int>(depth)) {
                continue;
            }

            std::vector<t_tscalar> new_path;
            for (t_index cidx = psize - 1; cidx >= 0; --cidx) {
                std::string str = col_path[cidx].to_string();
                if (col_path[cidx].is_error()) {
                    col_path[cidx].set(get_interned_tscalar("(error)"));
                } else if (str == "" || !col_path[cidx].is_valid()) {
                    col_path[cidx].set(get_interned_tscalar("(blank)"));
                }
                new_path.push_back(col_path[cidx]);
            }
            if (new_path.empty()) {
                new_path.push_back(get_interned_tscalar("Total"));
            }

            names.push_back(new_path);
        }
    }

    // Insert row pivot names to beginning of names
    if (!from_schema && flat_mode) {
        std::vector<std::vector<t_tscalar>> pivot_names;
        auto row_pivots = m_config.get_row_pivots();
        for (t_uindex idx = 0, rsize = row_pivots.size(); idx < rsize; ++idx) {
            auto row_pivot = row_pivots[idx];
            std::vector<t_tscalar> new_path;
            new_path.push_back(get_interned_tscalar(row_pivot.colname()));
            pivot_names.push_back(new_path);
        }
        if (row_combined) {
            auto combined_idx = m_config.get_combined_index();
            std::vector<t_tscalar> new_path;
            new_path.push_back(get_interned_tscalar(COMBINED_NAME));
            pivot_names.insert(pivot_names.begin() + combined_idx, new_path);
        }
        names.insert(names.begin(), pivot_names.begin(), pivot_names.end());
    }

    if (!from_schema && max_columns != -1 && max_columns < names.size()) {
        names.resize(max_columns);
    }

    if (m_cache.m_is_enabled) {
        m_cache.m_column_names_cache.emplace(std::make_tuple(skip, depth, from_schema, subtotal), names);
    }
    return names;
}

/*
 * Same as column_names() function,
 * but only fetch visible column_names inputed by, `start_col` and `end_col`
 * while column_names() fetches whole column names.
 */
template <>
std::vector<std::vector<t_tscalar>>
View<t_ctx2>::column_names_with_range(bool skip, std::int32_t depth, bool from_schema, bool subtotal, t_uindex start_col, t_uindex end_col) const {
    std::chrono::high_resolution_clock::time_point t1 = std::chrono::high_resolution_clock::now();
    bool flat_mode = m_config.is_pivot_view_flat_mode();
    bool row_combined = m_ctx->has_row_combined();
    t_uindex num_rpivots = m_config.get_num_rpivots() + (row_combined ? 1 : 0);
    t_uindex col_count = flat_mode ? m_ctx->unity_get_column_count() - num_rpivots : m_ctx->unity_get_column_count();
    std::vector<std::vector<t_tscalar>> names;
    std::vector<std::string> aggregate_names;

    const std::vector<t_aggspec> aggs = m_ctx->get_aggregates();
    for (const t_aggspec& agg : aggs) {
        aggregate_names.push_back(agg.name());
    }
    auto aggsize = aggregate_names.size();

    //t_uindex col_count = m_ctx->unity_get_column_count();
    if (from_schema) {
        //std::cout << ("column_names_with_range - from_schema.") << std::endl;
        for (t_uindex key = start_col; key != end_col; ++key) {
            //std::string name = aggregate_names[key % aggregate_names.size()];
            std::string name;
            if (aggsize > 0) {
                name = aggregate_names[key % aggregate_names.size()];
            }

            std::vector<t_tscalar> col_path = m_ctx->unity_get_column_path(key + 1);
            if (skip && col_path.size() < static_cast<unsigned int>(depth)) {
                continue;
            }

            std::vector<t_tscalar> new_path;
            for (auto path = col_path.rbegin(); path != col_path.rend(); ++path) {
                std::string str = (*path).to_string();
                if ((*path).is_error()) {
                    (*path).set(get_interned_tscalar("(error)"));
                } else if (str == "" || !(*path).is_valid()) {
                    (*path).set(get_interned_tscalar("(blank)"));
                }
                new_path.push_back(*path);
            }
            if (new_path.empty()) {
                new_path.push_back(get_interned_tscalar("Total"));
            }
            if (aggsize > 0) {
                new_path.push_back(m_ctx->get_aggregate_name(key % aggregate_names.size()));
            }
            names.push_back(new_path);
        }
    } else if (!m_config.has_row_combined() && aggsize > 1 && !subtotal) {
        //std::cout << ("column_names_with_range - Combined.")<< std::endl;
        auto combined_idx = m_config.get_combined_index();
        std::vector<std::pair<t_index, t_index>> indices;
        m_ctx->get_column_aggregate_info(indices);
        for (t_uindex key = 0; key != col_count; ++key) {
            std::string name;
            if (key + 1 > indices.size()) {
                break;
            }
            auto indice = indices[key + 1];
            if (indice.second != -1) {
                name = aggregate_names[indice.second];
            }

            //std::vector<t_tscalar> col_path = m_ctx->unity_get_column_path(key + 1);
            std::vector<t_tscalar> col_path = m_ctx->get_column_path(indice.first);
            auto psize = col_path.size();
            if (skip && psize < static_cast<unsigned int>(depth)) {
                continue;
            }

            std::vector<t_tscalar> new_path;
            //if ((key >= start_col) && (key <= end_col)) {
            for (t_index cidx = psize - 1; cidx >= 0; --cidx) {
                if (cidx == psize - 1 - combined_idx && indice.second != -1) {
                    new_path.push_back(m_ctx->get_aggregate_name(indice.second));
                }
                std::string str = col_path[cidx].to_string();
                if (col_path[cidx].is_error()) {
                    col_path[cidx].set(get_interned_tscalar("(error)"));
                } else if (str == "" || !col_path[cidx].is_valid()) {
                    col_path[cidx].set(get_interned_tscalar("(blank)"));
                }
                new_path.push_back(col_path[cidx]);
            }
            //}
            if (new_path.empty()) {
                new_path.push_back(get_interned_tscalar("Total"));
            }

            if (psize <= combined_idx && indice.second != -1) {
                new_path.push_back(m_ctx->get_aggregate_name(indice.second));
            }
            names.push_back(new_path);
        }
    } else {
        //std::cout << ("column_names_with_range - Else.")<< std::endl;
        for (t_uindex key = 0; key != col_count; ++key) {

            std::vector<t_tscalar> new_path;
            //if ((key >= start_col) && (key <= end_col)) {
            std::vector<t_tscalar> col_path = m_ctx->unity_get_column_path(key + 1);
            auto psize = col_path.size();
            if (skip && psize < static_cast<unsigned int>(depth)) {
                continue;
            }

            for (t_index cidx = psize - 1; cidx >= 0; --cidx) {
                std::string str = col_path[cidx].to_string();
                if (col_path[cidx].is_error()) {
                    col_path[cidx].set(get_interned_tscalar("(error)"));
                } else if (str == "" || !col_path[cidx].is_valid()) {
                    col_path[cidx].set(get_interned_tscalar("(blank)"));
                }
                new_path.push_back(col_path[cidx]);
            }
            //}
            if (new_path.empty()) {
                new_path.push_back(get_interned_tscalar("Total"));
            }

            names.push_back(new_path);
        }
    }

    // Insert row pivot names to beginning of names
    if (!from_schema && flat_mode) {
        std::vector<std::vector<t_tscalar>> pivot_names;
        auto row_pivots = m_config.get_row_pivots();
        for (t_uindex idx = 0, rsize = row_pivots.size(); idx < rsize; ++idx) {
            auto row_pivot = row_pivots[idx];
            std::vector<t_tscalar> new_path;
            new_path.push_back(get_interned_tscalar(row_pivot.colname()));
            pivot_names.push_back(new_path);
        }
        if (row_combined) {
            auto combined_idx = m_config.get_combined_index();
            std::vector<t_tscalar> new_path;
            new_path.push_back(get_interned_tscalar(COMBINED_NAME));
            pivot_names.insert(pivot_names.begin() + combined_idx, new_path);
        }
        names.insert(names.begin(), pivot_names.begin(), pivot_names.end());
    }

    std::chrono::high_resolution_clock::time_point t2 = std::chrono::high_resolution_clock::now();
    //std::cout << "column_names_with_range: " << std::chrono::duration_cast<std::chrono::milliseconds>( t2 - t1 ).count() << "ms" << std::endl;
    return names;
}

template<>
std::vector<std::vector<t_tscalar>>
View<t_ctx1>::column_names(bool skip, std::int32_t depth, bool from_schema, bool subtotal) const {
    bool flat_mode = m_config.is_pivot_view_flat_mode();
    bool row_combined = m_ctx->has_row_combined();
    std::vector<std::vector<t_tscalar>> names;
    t_uindex num_rpivots = m_config.get_num_rpivots() + (row_combined ? 1 : 0);
    t_uindex col_count = flat_mode ? m_ctx->unity_get_column_count() - num_rpivots : m_ctx->unity_get_column_count();

    if (from_schema || !row_combined) {
        std::vector<std::string> aggregate_names;

        const std::vector<t_aggspec> aggs = m_ctx->get_aggregates();
        for (const t_aggspec& agg : aggs) {
            aggregate_names.push_back(agg.name());
        }
        auto aggsize = aggregate_names.size();

        for (t_uindex key = 0; key != col_count; ++key) {
            //std::string name = aggregate_names[key % aggregate_names.size()];
            std::string name;
            if (aggsize > 0) {
                name = aggregate_names[key % aggregate_names.size()];
            }

            std::vector<t_tscalar> col_path = m_ctx->unity_get_column_path(key + 1);
            if (skip && col_path.size() < static_cast<unsigned int>(depth)) {
                continue;
            }

            std::vector<t_tscalar> new_path;
            for (auto path = col_path.rbegin(); path != col_path.rend(); ++path) {
                new_path.push_back(*path);
            }
            if (aggsize > 0) {
                new_path.push_back(m_ctx->get_aggregate_name(key % aggregate_names.size()));
            }
            names.push_back(new_path);
        }
    } else {
        for (t_uindex key = 0; key != col_count; ++key) {
            std::vector<t_tscalar> new_path;
            new_path.push_back(get_interned_tscalar(flat_mode ? " " : COMBINED_NAME));
            names.push_back(new_path);
        }
    }

    // Insert row pivot names to beginning of names
    if (!from_schema && flat_mode) {
        std::vector<std::vector<t_tscalar>> pivot_names;
        auto row_pivots = m_config.get_row_pivots();
        for (t_uindex idx = 0, rsize = row_pivots.size(); idx < rsize; ++idx) {
            auto row_pivot = row_pivots[idx];
            std::vector<t_tscalar> new_path;
            new_path.push_back(get_interned_tscalar(row_pivot.colname()));
            pivot_names.push_back(new_path);
        }
        if (row_combined) {
            auto combined_idx = m_config.get_combined_index();
            std::vector<t_tscalar> new_path;
            new_path.push_back(get_interned_tscalar(COMBINED_NAME));
            pivot_names.insert(pivot_names.begin() + combined_idx, new_path);
        }
        names.insert(names.begin(), pivot_names.begin(), pivot_names.end());
    }

    return names;
}

template <>
std::vector<std::vector<t_tscalar>>
View<t_ctx0>::column_names(bool skip, std::int32_t depth, bool from_schema, bool subtotal) const {
    std::vector<std::vector<t_tscalar>> names;

    for (t_uindex key = 0, max = m_ctx->unity_get_column_count(); key != max; ++key) {
        t_tscalar name = m_ctx->get_column_name(key);
        if (name.to_string() == ERROR_COLUMN) {
            continue;
        };
        std::vector<t_tscalar> col_path;
        col_path.push_back(name);
        names.push_back(col_path);
    }

    return names;
}

template<>
std::vector<std::vector<t_tscalar>>
View<t_ctx0>::all_column_names() const {
    return column_names();
}

template<>
std::vector<std::vector<t_tscalar>>
View<t_ctx1>::all_column_names() const {
    auto col_names = column_names();
    if (!m_config.is_pivot_view_flat_mode() && (m_config.get_num_rpivots() > 0 || m_ctx->has_row_combined())) {
        t_tscalar row_path;
        row_path.set("__ROW_PATH__");
        col_names.insert(col_names.begin(), std::vector<t_tscalar>{row_path});
    }

    return col_names;
}

template<>
std::vector<std::vector<t_tscalar>>
View<t_ctx2>::all_column_names() const {
    auto col_names = column_names();
    auto num_aggs = m_config.get_num_aggregates();
    auto row_combined = m_config.has_row_combined();
    auto column_only = this->is_column_only();
    auto is_pivot_flat = m_config.is_pivot_view_flat_mode();
    if ((!is_pivot_flat && (!column_only
        || (column_only && (num_aggs <= 1 || (num_aggs > 1 && row_combined)))))
        || (num_aggs <= 1 && column_only && is_pivot_flat)) {
        t_tscalar row_path;
        row_path.set("__ROW_PATH__");
        col_names.insert(col_names.begin(), std::vector<t_tscalar>{row_path});
    }

    return col_names;
}

template <typename CTX_T>
std::map<std::string, std::string>
View<CTX_T>::schema() const {
    std::map<std::string, std::string> ret;
    if (m_ctx->get_aggregates().size()) {
        _schema(column_names(false, 0, true), ret);
    }
    return ret;
}

template <>
std::map<std::string, std::string>
View<t_ctx0>::schema() const {
    //t_schema schema = m_gnode->get_tblschema();
    t_schema schema = m_ctx->get_schema();
    std::vector<t_dtype> _types = schema.types();
    std::vector<std::string> names = schema.columns();

    std::map<std::string, t_dtype> types;
    for (std::size_t i = 0, max = names.size(); i != max; ++i) {
        types[names[i]] = _types[i];
    }

    std::vector<std::vector<t_tscalar>> cols = column_names(false, 0, true);
    std::map<std::string, std::string> new_schema;

    for (std::size_t i = 0, max = cols.size(); i != max; ++i) {
        std::string name = cols[i].back().to_string();
        if (name == ERROR_COLUMN) {
            continue;
        }
        new_schema[name] = dtype_to_str(types[name]);
    }

    return new_schema;
}

/*
 * Same as schema() function,
 * but calling column_names_with_range() function instead of column_names().
 */

template <>
std::map<std::string, std::string>
View<t_ctx2>::schema_with_range(t_uindex start_col, t_uindex end_col) const {    
    std::map<std::string, std::string> ret;
    if (m_ctx->get_aggregates().size()) {
        _schema(column_names_with_range(false, 0, true, false, start_col, end_col), ret);
    }
    return ret;
}


template<typename CTX_T>
std::map<std::string, std::string>
View<CTX_T>::agg_custom_schema() const {
    t_schema schema = m_ctx->get_schema();
    auto types = schema.types();
    auto names = schema.columns();

    std::map<std::string, std::string> new_schema;

    for (std::size_t i = 0, max = names.size(); i != max; ++i) {
        if (schema.is_computed_col(names[i])) {
            new_schema[names[i]] = dtype_to_str(types[i]);
        }
    }

    return new_schema;
}

template<typename CTX_T>
inline 
auto 
filter_columns(decltype((std::declval<View<CTX_T>>().column_names())) columns, 
    const std::map<std::uint32_t, std::uint32_t> &filter) {

    auto condition = columns.size();
    decltype(std::declval<View<CTX_T>>().column_names()) ret;
    for(const auto &item : filter) {
        if (item.first > condition) {
            break;
        }
        if (item.second >= condition) {
            continue;
        }
        ret.push_back(columns[item.second]);
    }

    return ret;
}

template <>
std::shared_ptr<t_data_slice<t_ctx0>>
View<t_ctx0>::get_data(
    t_uindex start_row, t_uindex end_row, t_uindex start_col, t_uindex end_col,
    const std::map<std::uint32_t, std::uint32_t> &idx_map) {

    auto slice_ptr = std::make_shared<std::vector<t_tscalar>>(m_ctx->get_data(start_row, end_row, start_col, end_col, idx_map));
    auto col_names = column_names();
    auto short_column_names = filter_columns<t_ctx0>(col_names, idx_map);
    std::cout << "--get_data-cols--" << col_names << std::endl;
    std::cout << "--get_data-shorts--" << short_column_names << std::endl;
    // for (auto val : (*slice_ptr.get())) {
    //     std::cout << "--get_data-v--" << val.to_string() << std::endl;
    // }
    auto data_slice_ptr = std::make_shared<t_data_slice<t_ctx0>>(m_ctx, start_row, end_row,
        start_col, end_col, m_row_offset, m_col_offset, slice_ptr, col_names, short_column_names);
    return data_slice_ptr;
}

template <>
std::shared_ptr<t_data_slice<t_ctx1>>
View<t_ctx1>::get_data(
    t_uindex start_row, t_uindex end_row, t_uindex start_col, t_uindex end_col,
    const std::map<std::uint32_t, std::uint32_t> &idx_map) {
    auto slice_ptr = std::make_shared<std::vector<t_tscalar>>(
        m_ctx->get_data(start_row, end_row, start_col, end_col, idx_map));
    auto col_names = column_names();
    if (!m_config.is_pivot_view_flat_mode() && (m_config.get_num_rpivots() > 0 || m_ctx->has_row_combined())) {
        t_tscalar row_path;
        row_path.set("__ROW_PATH__");
        col_names.insert(col_names.begin(), std::vector<t_tscalar>{row_path});
    }

    auto short_column_names = filter_columns<t_ctx1>(col_names, idx_map);
    auto data_slice_ptr = std::make_shared<t_data_slice<t_ctx1>>(m_ctx, start_row, end_row,
        start_col, end_col, m_row_offset, m_col_offset, slice_ptr, col_names, short_column_names);
    return data_slice_ptr;
}

template <>
std::shared_ptr<t_data_slice<t_ctx2>>
View<t_ctx2>::get_data(
    t_uindex start_row, t_uindex end_row, t_uindex start_col, t_uindex end_col,
    const std::map<std::uint32_t, std::uint32_t> &idx_map) {
    std::vector<t_tscalar> slice;
    std::vector<t_uindex> column_indices;
    std::vector<std::vector<t_tscalar>> cols;
    bool is_sorted = false; //m_sorts.size() > 0;
    bool column_only = is_column_only();

    if (column_only) {
        start_row += m_row_offset;
        end_row += m_row_offset;
    }

    if (is_sorted) {
        /**
         * Perspective generates headers for sorted columns, so we have to
         * skip them in the underlying slice.
         */
        auto depth = m_column_pivots.size();
        auto col_length = m_ctx->unity_get_column_count();
        column_indices.push_back(0);
        for (t_uindex i = 0; i < col_length; ++i) {
            if (m_ctx->unity_get_column_path(i + 1).size() == depth) {
                column_indices.push_back(i + 1);
            }
        }

        // Fetch only visible columns, not whole columns
        cols = column_names_with_range(true, depth, false, false, start_col, end_col);
        column_indices = std::vector<t_uindex>(column_indices.begin() + start_col,
            column_indices.begin() + std::min(end_col, (t_uindex)column_indices.size()));

        std::vector<t_tscalar> slice_with_headers = m_ctx->get_data(
            start_row, end_row, column_indices.front(), column_indices.back() + 1, idx_map);

        auto iter = slice_with_headers.begin();
        while (iter != slice_with_headers.end()) {
            t_uindex prev = column_indices.front();
            for (auto idx = column_indices.begin(); idx != column_indices.end(); idx++) {
                t_uindex col_num = *idx;
                iter += col_num - prev;
                prev = col_num;
                slice.push_back(*iter);
            }
            if (iter != slice_with_headers.end())
                iter++;
        }
    } else {
        // Fetch only visible columns, not whole columns
        cols = column_names_with_range(false, 0, false, false, start_col, end_col);
        slice = m_ctx->get_data(start_row, end_row, start_col, end_col, idx_map);
    }
    auto num_aggs = m_config.get_num_aggregates();
    auto is_pivot_flat = m_config.is_pivot_view_flat_mode();
    bool row_combined = m_ctx->has_row_combined();
    if ((!is_pivot_flat && (!column_only
        || (column_only && (num_aggs <= 1 || (num_aggs > 1 && row_combined)))))
        || (num_aggs <= 1 && column_only && is_pivot_flat)) {
        t_tscalar row_path;
        row_path.set("__ROW_PATH__");
        cols.insert(cols.begin(), std::vector<t_tscalar>{row_path});
    }

    auto short_column_names = filter_columns<t_ctx2>(cols, idx_map);
    auto slice_ptr = std::make_shared<std::vector<t_tscalar>>(slice);
    auto data_slice_ptr = std::make_shared<t_data_slice<t_ctx2>>(m_ctx, start_row, end_row,
        start_col, end_col, m_row_offset, m_col_offset, slice_ptr, cols, column_indices, short_column_names);
    return data_slice_ptr;
}

template<typename CTX_T>
std::map<std::string, double>
View<CTX_T>::get_selection_summarize(std::vector<t_selection_info> selections) {
    auto value_map = m_ctx->get_selection_summarize(selections);
    std::map<std::string, double> summarize{};
    double sum = 0;
    int count_num = 0;
    for (auto it = value_map.begin(); it != value_map.end(); ++it) {
        auto rval = it->second;
        if (rval.is_valid() && rval.is_numeric()) {
            sum += rval.to_double();
            count_num++;
        }
    }
    double intpart;
    double avg = (count_num != 0) ? sum/count_num : 0;
    if (modf(avg, &intpart) != 0) {
        avg = std::floor(avg * 100.0) / 100.0;
    }
    if (modf(sum, &intpart) != 0) {
        sum = std::floor(sum * 100.0) / 100.0;
    }
    summarize.insert(std::pair<std::string, double>("count", value_map.size()));
    summarize.insert(std::pair<std::string, double>("count_num", count_num));
    summarize.insert(std::pair<std::string, double>("sum", sum));
    summarize.insert(std::pair<std::string, double>("avg", avg));
    return summarize;
}

// Delta calculation
template <typename CTX_T>
bool
View<CTX_T>::_get_deltas_enabled() const {
    return m_ctx->get_deltas_enabled();
}

template <>
bool
View<t_ctx0>::_get_deltas_enabled() const {
    return true;
}

template <typename CTX_T>
void
View<CTX_T>::_set_deltas_enabled(bool enabled_state) {
    m_ctx->set_deltas_enabled(enabled_state);
}

template <>
void
View<t_ctx0>::_set_deltas_enabled(bool enabled_state) {}

// Pivot table operations
template <typename CTX_T>
std::int32_t
View<CTX_T>::get_row_expanded(std::int32_t ridx) const {
    return m_ctx->unity_get_row_expanded(ridx);
}

template <>
t_index
View<t_ctx0>::expand(std::int32_t ridx, std::int32_t row_pivot_length) {
    return ridx;
}

template <>
t_index
View<t_ctx1>::expand(std::int32_t ridx, std::int32_t row_pivot_length) {
    //return m_ctx->open(ridx);
    return m_ctx->combined_open(ridx);
}

template <>
t_index
View<t_ctx2>::expand(std::int32_t ridx, std::int32_t row_pivot_length) {
    if (m_ctx->unity_get_row_depth(ridx) < t_uindex(row_pivot_length)) {
        //return m_ctx->open(t_header::HEADER_ROW, ridx);
        return m_ctx->combined_open(t_header::HEADER_ROW, ridx);
    } else {
        return ridx;
    }
}

template <>
t_index
View<t_ctx0>::collapse(std::int32_t ridx) {
    return ridx;
}

template <>
t_index
View<t_ctx1>::collapse(std::int32_t ridx) {
    //return m_ctx->close(ridx);
    return m_ctx->combined_close(ridx);
}

template <>
t_index
View<t_ctx2>::collapse(std::int32_t ridx) {
    //return m_ctx->close(t_header::HEADER_ROW, ridx);
    return m_ctx->combined_close(t_header::HEADER_ROW, ridx);
}

template <>
void
View<t_ctx0>::set_depth(std::int32_t depth, std::int32_t row_pivot_length) {}

template <>
void
View<t_ctx1>::set_depth(std::int32_t depth, std::int32_t row_pivot_length) {
    if (row_pivot_length >= depth) {
        m_ctx->set_depth(depth);
    } else {
        std::cout << "Cannot expand past " << std::to_string(row_pivot_length) << std::endl;
    }
}

template <>
void
View<t_ctx2>::set_depth(std::int32_t depth, std::int32_t row_pivot_length) {
    if (row_pivot_length >= depth) {
        m_ctx->set_depth(t_header::HEADER_ROW, depth);
    } else {
        std::cout << "Cannot expand past " << std::to_string(row_pivot_length) << std::endl;
    }
}

template <typename CTX_T>
void 
View<CTX_T>::enable_cache() {
    m_cache.m_is_enabled = true;
}

template <typename CTX_T>
void 
View<CTX_T>::disable_cache() {
    m_cache.m_is_enabled = false;
    m_cache.m_column_names_cache.clear();
}


// Getters
template <typename CTX_T>
std::shared_ptr<CTX_T>
View<CTX_T>::get_context() const {
    return m_ctx;
}

template <typename CTX_T>
const std::vector<std::string>&
View<CTX_T>::get_row_pivots() const {
    return m_row_pivots;
}

template <typename CTX_T>
const std::vector<std::string>&
View<CTX_T>::get_column_pivots() const {
    return m_column_pivots;
}

template <typename CTX_T>
const std::vector<t_aggspec>&
View<CTX_T>::get_aggregates() const {
    return m_aggregates;
}

template <typename CTX_T>
const std::vector<t_fterm>&
View<CTX_T>::get_filters() const {
    return m_filters;
}

template <typename CTX_T>
const std::vector<t_sortspec>&
View<CTX_T>::get_sorts() const {
    return m_sorts;
}

template <typename CTX_T>
const std::vector<t_data_format_spec>&
View<CTX_T>::get_data_formats() const {
    return m_dftypes;
}

template <>
std::vector<t_tscalar>
View<t_ctx0>::get_row_path(t_uindex idx) const {
    return std::vector<t_tscalar>();
}

template <typename CTX_T>
std::vector<t_tscalar>
View<CTX_T>::get_row_path(t_uindex idx) const {
    return m_ctx->unity_get_row_path(idx);
}

template <typename CTX_T>
t_stepdelta
View<CTX_T>::get_step_delta(t_index bidx, t_index eidx) const {
    return m_ctx->get_step_delta(bidx, eidx);
}

template <typename CTX_T>
t_rowdelta
View<CTX_T>::get_row_delta(t_index bidx, t_index eidx) const {
    return m_ctx->get_row_delta(bidx, eidx);
}

template <typename CTX_T>
bool
View<CTX_T>::is_column_only() const {
    return m_config.is_column_only();
}

template <typename CTX_T>
const std::map<std::string, std::string>&
View<CTX_T>::get_dname_mapping() const {
    return m_gnode->get_dname_mapping();
}

template <typename CTX_T>
const std::map<std::string, std::string>&
View<CTX_T>::set_dname_mapping(const std::string& colname, const std::string& dname) {
    std::map<std::string, std::string> dname_mapping = {{colname, dname}};
    auto tbl = m_gnode->get_table();
    tbl->set_dname_mapping(dname_mapping);
    return get_dname_mapping();
}

template <typename CTX_T>
const std::map<std::string, std::string>&
View<CTX_T>::clear_dname_mapping(const std::string& colname) {
    auto tbl = m_gnode->get_table();
    tbl->clear_dname_mapping(colname);
    return get_dname_mapping();
}

template <typename CTX_T>
const std::map<std::string, std::string>&
View<CTX_T>::update_dname_mapping(const std::string& current_name, const std::string& new_name) {
    auto tbl = m_gnode->get_table();
    tbl->update_dname_mapping(current_name, new_name);
    return get_dname_mapping();
}

template<typename CTX_T>
void
View<CTX_T>::update_data_format(const std::string& col_name, const std::string& data_format) {
    std::string trust_col_name = col_name;
    std::map<std::string, std::string>::iterator it = m_show_type_names.find(col_name);
    if (it != m_show_type_names.end()) {
        trust_col_name = it->second;
    }

    auto df_type = str_to_data_format_type(data_format);

    std::vector<t_data_format_spec> data_formats = {t_data_format_spec(trust_col_name, df_type)};

    // Update data format for config
    m_config.update_data_format(trust_col_name, df_type);

    // Update data format for context one
    m_ctx->update_data_format(data_formats);
}

template<>
void
View<t_ctx0>::update_data_format(const std::string& col_name, const std::string& data_format) {
    std::string trust_col_name = col_name;
    std::map<std::string, std::string>::iterator it = m_show_type_names.find(col_name);
    if (it != m_show_type_names.end()) {
        trust_col_name = it->second;
    }

    auto df_type = str_to_data_format_type(data_format);

    std::vector<t_data_format_spec> data_formats = {t_data_format_spec(trust_col_name, df_type)};

    // Update data format for config
    m_config.update_data_format(trust_col_name, df_type);

    // Update data format for gnode:
    m_gnode->update_data_formats(data_formats);
}

template<typename CTX_T>
void
View<CTX_T>::update_data_formats(const std::vector<std::string>& col_names, const std::vector<std::string>& formats) {
    // Check size of name and formats
    if (col_names.size() != formats.size()) {
        return;
    }

    // Input for vector of data format spec
    std::vector<t_data_format_spec> data_formats;
    for (t_index idx = 0, fsize = col_names.size(); idx < fsize; ++idx) {
        std::string col_name = col_names[idx];
        std::map<std::string, std::string>::iterator it = m_show_type_names.find(col_name);
        if (it != m_show_type_names.end()) {
            col_name = it->second;
        }
        data_formats.emplace_back(col_name, str_to_data_format_type(formats[idx]));
    }

    // Update data format for config
    m_config.update_data_formats(data_formats);

    // Update data format for context one
    m_ctx->update_data_format(data_formats);
}

template<>
void
View<t_ctx0>::update_data_formats(const std::vector<std::string>& col_names, const std::vector<std::string>& formats) {
    // Check size of name and formats
    if (col_names.size() != formats.size()) {
        return;
    }

    // Input for vector of data format spec
    std::vector<t_data_format_spec> data_formats;
    for (t_index idx = 0, fsize = col_names.size(); idx < fsize; ++idx) {
        std::string col_name = col_names[idx];
        std::map<std::string, std::string>::iterator it = m_show_type_names.find(col_name);
        if (it != m_show_type_names.end()) {
            col_name = it->second;
        }
        data_formats.emplace_back(col_name, str_to_data_format_type(formats[idx]));
    }

    // Update data format for config
    m_config.update_data_formats(data_formats);

    // Update data format for gnode:
    m_gnode->update_data_formats(data_formats);
}

template<typename CTX_T>
const std::map<std::string, std::string>&
View<CTX_T>::update_column_name(const std::string& old_name, const std::string& new_name) {
    if (old_name == new_name) {
        return get_dname_mapping();
    }
    // Update column name for view config
    m_config.update_column_name(old_name, new_name);

    // Update column name for context config
    m_ctx->update_column_name(old_name, new_name);

    // Update dname mapping
    return update_dname_mapping(old_name, new_name);
}

template<typename CTX_T>
void
View<CTX_T>::update_show_type(const std::string& col_name, const std::string& show_type) {
    /*std::string col_name;
    std::map<std::string, std::string>::iterator it = m_show_type_names.find(old_name);
    if (it != m_show_type_names.end()) {
        col_name = it->second;
        m_show_type_names.erase(it);
    } else {
        col_name = old_name;
    }
    m_show_type_names[new_name] = col_name;*/
    auto stype = str_to_show_type(show_type);

    // Update show type for view config
    m_config.update_show_type(col_name, stype);

    // Update show type for context config
    m_ctx->update_show_type(col_name, stype);
}

template<typename CTX_T>
void
View<CTX_T>::update_pagination_setting(t_index page_items, t_index page_num) {
    // Update pagination for view config
    m_config.update_pagination_setting(page_items, page_num);

    // Update show type for context config
    m_ctx->update_pagination_setting(page_items, page_num);
}

template<typename CTX_T>
void
View<CTX_T>::create_suggestion_column(const std::string& colname, const std::string& agg_level_str, const t_binning_info binning_info,
    const std::string& data_format, const std::string& search_term, t_index limit) {
    m_suggestion_col.reset();
    auto table = m_gnode->get_table();
    auto tblcolumn = table->get_const_column(colname);
    auto agg_level = str_to_agg_level_type(agg_level_str);
    t_dataformattype force_df = str_to_data_format_type(data_format);
    //m_suggestion_col = tblcolumn->clone();
    std::set<t_tscalar> vset;
    t_index limit_size = limit;
    t_index max_idx = tblcolumn->size();
    max_idx = (max_idx < 500000) ? max_idx : 500000;
    t_dtype col_type = dtype_from_dtype_and_agg_level(tblcolumn->get_dtype(), agg_level);
    t_dtype agg_ctype = list_type_to_dtype(col_type);
    if (binning_info.type != BINNING_TYPE_NONE) {
        col_type = DTYPE_STR;
    } else {
        col_type = agg_ctype;
    }
    auto df_type = dftype_from_dftype_and_agg_level(tblcolumn->get_data_format_type(), agg_level);
    if (force_df == DATA_FORMAT_FINANCIAL || force_df == DATA_FORMAT_PERCENT) {
        df_type = force_df;
    }
    m_suggestion_col = table->make_column("suggestion_" + colname, col_type, true, df_type);
    if (search_term == "") {
        auto empty_sca = col_type == DTYPE_STR ? get_interned_tscalar("") : mknull(col_type);
        auto error_sca = mkerror(col_type);
        for (t_index idx = 0; idx < max_idx; ++idx) {
            auto col_sca = tblcolumn->get_scalar(idx);
            if (col_sca.is_error()) {
                vset.insert(error_sca);
            } else if (col_sca.is_valid()) {
                if (col_sca.is_list()) {
                    if (col_sca.is_list_empty()) {
                        vset.insert(mkempty(col_type));
                    } else {
                        auto list_sca = col_sca.to_list<std::vector<t_tscalar>>();
                        for (t_uindex lidx = 0, lsize = list_sca.size(); lidx < lsize; ++lidx) {
                            if (agg_level == AGG_LEVEL_NONE) {
                                if (binning_info.type != BINNING_TYPE_NONE) {
                                    auto str_val = list_sca[lidx].to_binning_string(binning_info, df_type);
                                    vset.insert(get_interned_tscalar(str_val.c_str()));
                                } else {
                                    vset.insert(list_sca[lidx]);
                                }
                            } else {
                                auto agg_sca = mk_agg_level_one(list_sca[idx], agg_level, agg_ctype, df_type);
                                if (binning_info.type != BINNING_TYPE_NONE) {
                                    auto str_val = agg_sca.to_binning_string(binning_info, df_type);
                                    vset.insert(get_interned_tscalar(str_val.c_str()));
                                } else {
                                    vset.insert(agg_sca);
                                }
                            }
                            if (vset.size() >= limit_size) {
                                break;
                            }
                        }
                    }
                } else {
                    if (agg_level == AGG_LEVEL_NONE) {
                        if (binning_info.type != BINNING_TYPE_NONE) {
                            auto str_val = col_sca.to_binning_string(binning_info, df_type);
                            vset.insert(get_interned_tscalar(str_val.c_str()));
                        } else {
                            vset.insert(col_sca);
                        }
                    } else {
                        auto agg_sca = mk_agg_level_one(col_sca, agg_level, agg_ctype, df_type);
                        if (binning_info.type != BINNING_TYPE_NONE) {
                            auto str_val = agg_sca.to_binning_string(binning_info, df_type);
                            vset.insert(get_interned_tscalar(str_val.c_str()));
                        } else {
                            vset.insert(agg_sca);
                        }
                    }
                }
            } else {
                vset.insert(empty_sca);
            }
            if (vset.size() >= limit_size) {
                break;
            }
        }
    } else {
        t_tscalar compare_v;
        compare_v.set(search_term);
        for (t_index idx = 0; idx < max_idx; ++idx) {
            t_tscalar v = tblcolumn->get_scalar(idx);
            if (!v.is_valid() || v.is_error() || v.m_status == STATUS_EMPTY) {
                continue;
            }
            if (v.is_list()) {
                auto list_sca = v.to_list<std::vector<t_tscalar>>();
                for (t_uindex lidx = 0, lsize = list_sca.size(); lidx < lsize; ++lidx) {
                    t_tscalar rv = list_sca[lidx];
                    if (agg_level != AGG_LEVEL_NONE) {
                        rv = mk_agg_level_one(rv, agg_level, agg_ctype, df_type);
                        if (binning_info.type != BINNING_TYPE_NONE) {
                            auto str_val = rv.to_binning_string(binning_info, df_type);
                            rv = get_interned_tscalar(str_val.c_str());
                        }
                    }
                    if (rv.contains(compare_v)) {
                        vset.insert(rv);
                        if (vset.size() >= limit_size) {
                            break;
                        }
                    }
                }
            } else {
                if (agg_level != AGG_LEVEL_NONE) {
                    v = mk_agg_level_one(v, agg_level, agg_ctype, df_type);
                    if (agg_level != AGG_LEVEL_NONE) {
                        auto str_val = v.to_binning_string(binning_info, df_type);
                        v = get_interned_tscalar(str_val.c_str());
                    }
                }
                if (v.contains(compare_v)) {
                    vset.insert(v);
                    if (vset.size() >= limit_size) {
                        break;
                    }
                }
            }
        }
    }
    m_suggestion_col->init();
    m_suggestion_col->set_size(vset.size());
    t_index vidx = 0;
    for(auto v : vset) {
        m_suggestion_col->set_scalar(vidx, v);
        vidx++;
    }
}

template<typename CTX_T>
t_index
View<CTX_T>::get_suggestion_size() const {
    if (m_suggestion_col == nullptr) {
        return 0;
    }
    return m_suggestion_col->size();
}

template<typename CTX_T>
std::vector<t_tscalar>
View<CTX_T>::get_suggestion_value(t_index start_row, t_index end_row) const {
    std::vector<t_tscalar> scal_vec;
    t_index end_idx = std::min(static_cast<t_uindex>(end_row), static_cast<t_uindex>(m_suggestion_col->size()));
    for (t_index idx = start_row; idx < end_idx; ++idx) {
        scal_vec.push_back(m_suggestion_col->get_scalar(idx));
    }
    return scal_vec;
}

template<typename CTX_T>
void
View<CTX_T>::reset_suggestion_column() {
    if (m_suggestion_col) {
        m_suggestion_col.reset();
        m_suggestion_col = nullptr;
    }
}

template<typename CTX_T>
bool
View<CTX_T>::has_row_path() const {
    return m_ctx->has_row_path();
}

template<>
std::map<std::string, std::string>
View<t_ctx2>::longest_text_cols() const {
    auto col_names = column_names();
    return m_ctx->longest_text_cols(col_names);
}

template<typename CTX_T>
std::map<std::string, std::string>
View<CTX_T>::longest_text_cols() const {
    return m_ctx->longest_text_cols();
}

template<typename CTX_T>
std::map<std::string, double>
View<CTX_T>::get_default_binning(const std::string& colname) const {
    std::map<std::string, double> default_binning = m_ctx->get_default_binning(colname);
    auto table = m_gnode->get_table();
    auto tblcolumn = table->get_const_column(colname);
    auto dtype = tblcolumn->get_dtype();
    if (dtype == DTYPE_INT64 || dtype == DTYPE_INT8 || dtype == DTYPE_INT16 || dtype == DTYPE_UINT16
        || dtype == DTYPE_UINT8 || dtype == DTYPE_UINT32 || dtype == DTYPE_INT32 || dtype == DTYPE_UINT64
        || dtype == DTYPE_DATE || dtype == DTYPE_TIME || dtype == DTYPE_LIST_INT64 || dtype == DTYPE_LIST_DATE
        || dtype == DTYPE_LIST_TIME) {
        default_binning["size"] = std::ceil(default_binning["size"]);
    }
    return default_binning;
}

template<>
std::map<std::string, t_uindex>
View<t_ctx0>::get_truncated_columns() const {
    return std::map<std::string, t_uindex>();
}

template<typename CTX_T>
std::map<std::string, t_uindex>
View<CTX_T>::get_truncated_columns() const {
    return m_ctx->get_truncated_columns();
}

/******************************************************************************
 *
 * Private
 */

/**
 * @brief Gets the correct type for the specified aggregate, thus remapping columns
 * when they are pivoted. This ensures that we display aggregates with the correct type.
 *
 * @return std::string
 */
template <typename CTX_T>
std::string
View<CTX_T>::_map_aggregate_types(
    const std::string& name, const std::string& typestring) const {
    std::vector<std::string> INTEGER_AGGS
        = {"distinct_count", "distinct count", "distinctcount", "distinct", "count"};
    std::vector<std::string> FLOAT_AGGS
        = {"avg", "mean", "mean by count", "mean_by_count", "weighted mean", "weighted_mean",
            "pct sum parent", "pct_sum_parent", "pct sum grand total", "pct_sum_grand_total"};
    std::vector<std::string> STR_AGGS = {"distinct values"};

    for (const t_aggspec& agg : m_aggregates) {
        if (agg.name() == name) {
            std::string agg_str = agg.agg_str();
            bool int_agg = std::find(INTEGER_AGGS.begin(), INTEGER_AGGS.end(), agg_str)
                != INTEGER_AGGS.end();
            bool float_agg
                = std::find(FLOAT_AGGS.begin(), FLOAT_AGGS.end(), agg_str) != FLOAT_AGGS.end();
            bool string_agg
                = std::find(STR_AGGS.begin(), STR_AGGS.end(), agg_str) != STR_AGGS.end();

            if (int_agg) {
                return "integer";
            } else if (float_agg) {
                return "float";
            } else if (string_agg) {
                return "string";
            } else {
                return typestring;
            }
        }
    }

    return typestring;
}

/**
 * @brief The schema of this View.
 * @par The same as schema() or schema_with_range() but takes a list of columns as an argument.
 * 
 * @param[in] cols A list of columns.
 * @param[out] out Return value.
 */

template <typename CTX_T>
void 
View<CTX_T>::_schema(const std::vector<std::vector<t_tscalar>> &cols, std::map<std::string, std::string> &out) const {
    auto schema = m_ctx->get_schema();
    auto type_list = schema.types();
    auto names = schema.columns();

    std::map<std::string, t_dtype> types;

    for (decltype(names.size()) i = 0, max = names.size(); i != max; ++i) {
        types[names[i]] = type_list[i];
    }

    auto need_aggregate_type = (m_row_pivots.size() > 0 && !is_column_only()) || sides() == 1;
    for (const auto& name : cols) {
        // Pull out the main aggregate column
        auto agg_name = name.back().to_string();
        out.emplace(agg_name,
            need_aggregate_type ? _map_aggregate_types(agg_name, dtype_to_str(types[agg_name]))
                                : dtype_to_str(types[agg_name])
        );
    }
}


// Explicitly instantiate View for each context
template class View<t_ctx0>;
template class View<t_ctx1>;
template class View<t_ctx2>;
} // end namespace perspective
