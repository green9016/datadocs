/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/context_one.h>
#include <perspective/context_two.h>
#include <perspective/context_zero.h>
#include <perspective/gnode_state.h>
#include <perspective/mask.h>
#include <perspective/sym_table.h>
#ifdef PSP_PARALLEL_FOR
#include <tbb/tbb.h>
#endif

namespace perspective {

t_gstate::t_gstate(const t_schema& tblschema, const t_schema& pkeyed_schema)

    : m_tblschema(tblschema)
    , m_pkeyed_schema(pkeyed_schema)
    , m_init(false) {
    LOG_CONSTRUCTOR("t_gstate");
}

t_gstate::~t_gstate() { LOG_DESTRUCTOR("t_gstate"); }

void
t_gstate::init() {
    m_table = std::make_shared<t_table>(
        "", "", m_pkeyed_schema, DEFAULT_EMPTY_CAPACITY, BACKING_STORE_MEMORY);
    m_table->init();
    m_pkcol = m_table->get_column("psp_pkey");
    m_opcol = m_table->get_column("psp_op");
    m_init = true;
}

t_rlookup
t_gstate::lookup(t_tscalar pkey) const {
    t_rlookup rval(0, false);

    t_mapping::const_iterator iter = m_mapping.find(pkey.get<t_index>());

    if (iter == m_mapping.end())
        return rval;

    rval.m_idx = iter->second;
    rval.m_exists = true;
    return rval;
}

void
t_gstate::_mark_deleted(t_uindex idx) {
    m_free.insert(idx);
}

void
t_gstate::erase(const t_tscalar& pkey) {
    t_mapping::const_iterator iter = m_mapping.find(pkey.get<t_index>());

    if (iter == m_mapping.end()) {
        return;
    }

    auto columns = m_table->get_columns();

    t_uindex idx = iter->second;

    for (auto c : columns) {
        c->clear(idx);
    }

    m_mapping.erase(iter);
    _mark_deleted(idx);
}

t_uindex
t_gstate::lookup_or_create(const t_tscalar& pkey) {
    auto pkey_ = pkey.get<t_index>();

    t_mapping::const_iterator iter = m_mapping.find(pkey_);

    if (iter != m_mapping.end()) {
        return iter->second;
    }

    if (!m_free.empty()) {
        t_free_items::const_iterator iter = m_free.begin();
        t_uindex idx = *iter;
        m_free.erase(iter);
        m_mapping[pkey_] = idx;
        return idx;
    }

    t_uindex nrows = m_table->num_rows();
    if (nrows >= m_table->get_capacity() - 1) {
        m_table->reserve(std::max(
            nrows + 1, static_cast<t_uindex>(m_table->get_capacity() * PSP_TABLE_GROW_RATIO)));
    }

    m_table->set_size(nrows + 1);
    m_opcol->set_nth<std::uint8_t>(nrows, OP_INSERT);
    m_pkcol->set_scalar(nrows, pkey);
    m_mapping[pkey_] = nrows;
    return nrows;
}

void
t_gstate::update_history(const t_table* tbl) {
    const t_schema& fschema = tbl->get_schema();
    const t_schema& sschema = m_table->get_schema();

    auto pkey_col = tbl->get_const_column("psp_pkey").get();
    auto op_col = tbl->get_const_column("psp_op").get();

    t_uindex ncols = m_table->num_columns();
    auto stable = m_table.get();

    std::vector<t_uindex> col_translation(stable->num_columns());

    std::string opname("psp_op");
    std::string pkeyname("psp_pkey");

    std::vector<const t_column*> fcolumns(tbl->num_columns());

    t_uindex count = 0;
    for (t_uindex idx = 0, loop_end = fschema.size(); idx < loop_end; ++idx) {
        const std::string& cname = fschema.m_columns[idx];
        col_translation[count] = idx;
        fcolumns[idx] = tbl->get_const_column(cname).get();
        ++count;
    }

    std::vector<t_column*> scolumns(ncols);

    for (t_uindex idx = 0, loop_end = sschema.size(); idx < loop_end; ++idx) {
        const std::string& cname = sschema.m_columns[idx];
        scolumns[idx] = stable->get_column(cname).get();
    }

    if (size() == 0) {

        MEM_REPORT("gnode_state::notify() / table is going to be cloned again");

        m_free.clear();
        m_mapping.clear();
#ifdef PSP_PARALLEL_FOR
        PSP_PFOR(0, int(ncols), 1,
            [&stable, &fcolumns, &col_translation](int idx)
#else
        for (t_uindex idx = 0; idx < ncols; ++idx)
#endif
            { stable->set_column(idx, fcolumns[col_translation[idx]]->clone()); }
#ifdef PSP_PARALLEL_FOR
        );
#endif
        MEM_REPORT("gnode_state::notify() / table cloned into gnode_state");

        m_pkcol = stable->get_column("psp_pkey");
        m_opcol = stable->get_column("psp_op");

        stable->set_capacity(tbl->get_capacity());
        stable->set_size(tbl->size());

        // GAB: memory optim: we can prereserve m_mapping now, as it is a flat_map
        m_mapping.reserve(tbl->num_rows());

        MEM_REPORT("gnode_state::notify() / m_mappings reserved");

        for (t_uindex idx = 0, loop_end = tbl->num_rows(); idx < loop_end; ++idx) {
            t_tscalar pkey = pkey_col->get_scalar(idx);
            const std::uint8_t* op_ptr = op_col->get_nth<std::uint8_t>(idx);
            t_op op = static_cast<t_op>(*op_ptr);

            switch (op) {
                case OP_INSERT: {
                    m_mapping[pkey.get<t_index>()] = idx;
                    m_opcol->set_nth<std::uint8_t>(idx, OP_INSERT);
                    m_pkcol->set_scalar(idx, pkey);
                } break;
                case OP_DELETE: {
                    _mark_deleted(idx);
                } break;
                default: { PSP_COMPLAIN_AND_ABORT("Unexpected OP"); } break;
            }
        }

#ifdef PSP_TABLE_VERIFY
        stable->verify();
#endif

        return;
    }

    /* size is not zero */
    std::vector<t_uindex> stableidx_vec(tbl->num_rows());

    for (t_uindex idx = 0, loop_end = tbl->num_rows(); idx < loop_end; ++idx) {
        t_tscalar pkey = pkey_col->get_scalar(idx);
        const std::uint8_t* op_ptr = op_col->get_nth<std::uint8_t>(idx);
        t_op op = static_cast<t_op>(*op_ptr);

        switch (op) {
            case OP_INSERT: {
                stableidx_vec[idx] = lookup_or_create(pkey);
                m_opcol->set_nth<std::uint8_t>(stableidx_vec[idx], OP_INSERT);
                m_pkcol->set_scalar(stableidx_vec[idx], pkey);
            } break;
            case OP_DELETE: {
                erase(pkey);
            } break;
            default: { PSP_COMPLAIN_AND_ABORT("Unexpected OP"); } break;
        }
    }

#ifdef PSP_PARALLEL_FOR
    PSP_PFOR(0, int(ncols), 1,
        [tbl, op_col, &col_translation, &fcolumns, &scolumns, &stableidx_vec](int colidx)
#else
    for (t_uindex colidx = 0; colidx < ncols; ++colidx)
#endif

        {
            const t_column* fcolumn = fcolumns[col_translation[colidx]];

            t_column* scolumn = scolumns[colidx];

            for (t_uindex idx = 0, loop_end = tbl->num_rows(); idx < loop_end; ++idx) {
                bool is_valid = fcolumn->is_valid(idx);
                t_uindex stableidx = stableidx_vec[idx];

                if (!is_valid) {
                    bool is_cleared = fcolumn->is_cleared(idx);
                    if (is_cleared) {
                        scolumn->clear(stableidx);
                    }
                    continue;
                }

                const std::uint8_t* op_ptr = op_col->get_nth<std::uint8_t>(idx);
                t_op op = static_cast<t_op>(*op_ptr);

                if (op == OP_DELETE)
                    continue;

                switch (fcolumn->get_dtype()) {
                    case DTYPE_NONE: {
                    } break;
                    case DTYPE_INT64: {
                        scolumn->set_nth<std::int64_t>(
                            stableidx, *(fcolumn->get_nth<std::int64_t>(idx)));
                    } break;
                    case DTYPE_INT32: {
                        scolumn->set_nth<std::int32_t>(
                            stableidx, *(fcolumn->get_nth<std::int32_t>(idx)));
                    } break;
                    case DTYPE_INT16: {
                        scolumn->set_nth<std::int16_t>(
                            stableidx, *(fcolumn->get_nth<std::int16_t>(idx)));
                    } break;
                    case DTYPE_INT8: {
                        scolumn->set_nth<std::int8_t>(
                            stableidx, *(fcolumn->get_nth<std::int8_t>(idx)));
                    } break;
                    case DTYPE_UINT64: {
                        scolumn->set_nth<std::uint64_t>(
                            stableidx, *(fcolumn->get_nth<std::uint64_t>(idx)));
                    } break;
                    case DTYPE_UINT32: {
                        scolumn->set_nth<std::uint32_t>(
                            stableidx, *(fcolumn->get_nth<std::uint32_t>(idx)));
                    } break;
                    case DTYPE_UINT16: {
                        scolumn->set_nth<std::uint16_t>(
                            stableidx, *(fcolumn->get_nth<std::uint16_t>(idx)));
                    } break;
                    case DTYPE_UINT8: {
                        scolumn->set_nth<std::uint8_t>(
                            stableidx, *(fcolumn->get_nth<std::uint8_t>(idx)));
                    } break;
                    case DTYPE_FLOAT64: {
                        scolumn->set_nth<double>(stableidx, *(fcolumn->get_nth<double>(idx)));
                    } break;
                    case DTYPE_FLOAT32: {
                        scolumn->set_nth<float>(stableidx, *(fcolumn->get_nth<float>(idx)));
                    } break;
                    case DTYPE_BOOL: {
                        scolumn->set_nth<std::uint8_t>(
                            stableidx, *(fcolumn->get_nth<std::uint8_t>(idx)));
                    } break;
                    case DTYPE_TIME: {
                        scolumn->set_nth<double>(
                            stableidx, *(fcolumn->get_nth<double>(idx)));
                    } break;
                    case DTYPE_DURATION: {
                        scolumn->set_nth<double>(
                            stableidx, *(fcolumn->get_nth<double>(idx)));
                    } break;
                    case DTYPE_DATE: {
                        scolumn->set_nth<std::int32_t>(
                            stableidx, *(fcolumn->get_nth<std::uint32_t>(idx)));
                    } break;
                    case DTYPE_STR: {
                        const char* s = fcolumn->get_nth<const char>(idx);
                        scolumn->set_nth<const char*>(stableidx, s);
                    } break;
                    default: { PSP_COMPLAIN_AND_ABORT("Unexpected type"); }
                }
            }
        }
#ifdef PSP_PARALLEL_FOR
    );
#endif
}

void
t_gstate::pprint() const {
    std::vector<t_uindex> indices(m_mapping.size());
    t_uindex idx = 0;
    for (t_mapping::const_iterator iter = m_mapping.begin(); iter != m_mapping.end(); ++iter) {
        indices[idx] = iter->second;
        ++idx;
    }
    m_table->pprint(indices);
}

t_mask
t_gstate::get_cpp_mask() const {
    t_uindex sz = m_table->size();
    t_mask msk(sz);
    for (t_mapping::const_iterator iter = m_mapping.begin(); iter != m_mapping.end(); ++iter) {
        msk.set(iter->second, true);
    }
    return msk;
}

std::shared_ptr<t_table>
t_gstate::get_table() {
    return m_table;
}

std::shared_ptr<const t_table>
t_gstate::get_table() const {
    return m_table;
}

void
t_gstate::read_column(const std::string& colname, const std::vector<t_tscalar>& pkeys,
    std::vector<t_tscalar>& out_data, bool include_error) const {
    t_index num = pkeys.size();
    std::shared_ptr<const t_column> col = m_table->get_const_column(colname);
    const t_column* col_ = col.get();
    std::vector<t_tscalar> rval;
    rval.reserve(num);

    for (t_index idx = 0; idx < num; ++idx) {
        t_mapping::const_iterator iter = m_mapping.find(pkeys[idx].get<t_index>());
        if (iter != m_mapping.end()) {
            rval.push_back(col_->get_scalar(iter->second, include_error));
        }
    }

    std::swap(rval, out_data);
}

void
t_gstate::read_column(const std::string& colname, const std::vector<t_tscalar>& pkeys,
    std::vector<double>& out_data) const {
    read_column(colname, pkeys, out_data, true);
}

void
t_gstate::read_column(const std::string& colname, const std::vector<t_tscalar>& pkeys,
    std::vector<double>& out_data, bool include_nones) const {
    t_index num = pkeys.size();
    std::shared_ptr<const t_column> col = m_table->get_const_column(colname);
    const t_column* col_ = col.get();

    // GAB: memory optim: compute in advance the number of elements of the result vector,
    // to be able to reserve memory space needed
    t_index count = 0;
    for (t_index idx = 0; idx < num; ++idx) {
        t_mapping::const_iterator iter = m_mapping.find(pkeys[idx].get<t_index>());
        if (iter != m_mapping.end()) {
            auto tscalar = col_->get_scalar(iter->second);
            if (include_nones || tscalar.is_valid()) {
                count++;
            }
        }
    }

    // GAB: memory optim / bugfix: reserve the number of elements
    std::vector<double> rval;
    rval.reserve(count);
    for (t_index idx = 0; idx < num; ++idx) {
        t_mapping::const_iterator iter = m_mapping.find(pkeys[idx].get<t_index>());
        if (iter != m_mapping.end()) {
            auto tscalar = col_->get_scalar(iter->second);
            if (include_nones || tscalar.is_valid()) {
                rval.push_back(tscalar.to_double());
            }
        }
    }
    std::swap(rval, out_data);
}

t_tscalar
t_gstate::get(t_tscalar pkey, const std::string& colname) const {
    t_mapping::const_iterator iter = m_mapping.find(pkey.get<t_index>());
    if (iter != m_mapping.end()) {
        std::shared_ptr<const t_column> col = m_table->get_const_column(colname);
        return col->get_scalar(iter->second);
    }

    return t_tscalar();
}

std::vector<t_tscalar>
t_gstate::get_row(t_tscalar pkey) const {
    auto columns = m_table->get_const_columns();
    std::vector<t_tscalar> rval(columns.size());

    t_mapping::const_iterator iter = m_mapping.find(pkey.get<t_index>());
    PSP_VERBOSE_ASSERT(iter != m_mapping.end(), "Reached end");

    t_uindex ridx = iter->second;
    t_uindex idx = 0;

    for (auto c : columns) {
        rval[idx].set(c->get_scalar(ridx));
        ++idx;
    }
    return rval;
}

bool
t_gstate::is_unique(
    const std::vector<t_tscalar>& pkeys, const std::string& colname, t_tscalar& value) const {
    std::shared_ptr<const t_column> col = m_table->get_const_column(colname);
    const t_column* col_ = col.get();
    value = mknone();

    for (const auto& pkey : pkeys) {
        t_mapping::const_iterator iter = m_mapping.find(pkey.get<t_index>());
        if (iter != m_mapping.end()) {
            auto tmp = col_->get_scalar(iter->second);
            if (!value.is_none() && value != tmp)
                return false;
            value = tmp;
        }
    }

    return true;
}

bool
t_gstate::apply(const std::vector<t_tscalar>& pkeys, const std::string& colname,
    t_tscalar& value, std::function<bool(const t_tscalar&, t_tscalar&)> fn) const {
    std::shared_ptr<const t_column> col = m_table->get_const_column(colname);
    const t_column* col_ = col.get();

    value = mknone();

    for (const auto& pkey : pkeys) {
        t_mapping::const_iterator iter = m_mapping.find(pkey.get<t_index>());
        if (iter != m_mapping.end()) {
            auto tmp = col_->get_pivot_scalar(iter->second);
            bool done = fn(tmp, value);
            if (done) {
                value = tmp;
                return done;
            }
        }
    }

    return false;
}

const t_schema&
t_gstate::get_schema() const {
    return m_tblschema;
}

void
t_gstate::rename_pkey_columns(const std::map<std::string, std::string> col_map) {
    m_pkeyed_schema.rename_columns(col_map);
}

void
t_gstate::update_data_formats(std::vector<t_data_format_spec> data_formats) {
    // Update m_pkeyed schema
    m_pkeyed_schema.update_data_formats(data_formats);

    // Update pkey table
    m_table->update_data_formats(data_formats);
}

t_dtype
t_gstate::get_pkey_dtype() const {
    if (m_mapping.empty())
        return DTYPE_STR;
    return DTYPE_INT32;
    // GAB: memory optim: pkeys are always INT32 now
}

std::shared_ptr<t_table>
t_gstate::get_sorted_pkeyed_table() const {
    std::map<t_index, t_uindex> ordered(m_mapping.begin(), m_mapping.end());
    auto sch = m_pkeyed_schema.drop({"psp_op"});
    auto rv = std::make_shared<t_table>(sch, 0);
    rv->init();
    rv->reserve(mapping_size());

    auto pkey_col = rv->get_column("psp_pkey");
    std::vector<std::shared_ptr<t_column>> icolumns;
    std::vector<std::shared_ptr<t_column>> ocolumns;

    for (const std::string& cname : m_tblschema.m_columns) {
        ocolumns.push_back(rv->get_column(cname));
        icolumns.push_back(m_table->get_column(cname));
    }

    for (auto it = ordered.begin(); it != ordered.end(); ++it) {
        auto ridx = it->second;
        pkey_col->push_back(it->first);
        for (t_uindex cidx = 0, loop_end = m_tblschema.size(); cidx < loop_end; ++cidx) {
            auto scalar = icolumns[cidx]->get_scalar(ridx);
            ocolumns[cidx]->push_back(scalar);
        }
    }
    rv->set_size(mapping_size());
    return rv;
}

std::shared_ptr<t_table>
t_gstate::get_pkeyed_table(const t_schema& schema) const {
    return std::shared_ptr<t_table>(_get_pkeyed_table(schema));
}

std::shared_ptr<t_table>
t_gstate::get_pkeyed_table() const {
    if (m_mapping.size() == m_table->size())
        return m_table;
    return std::shared_ptr<t_table>(_get_pkeyed_table(m_pkeyed_schema));
}

t_table*
t_gstate::_get_pkeyed_table() const {
    return _get_pkeyed_table(m_pkeyed_schema);
}

t_table*
t_gstate::_get_pkeyed_table(const std::vector<t_tscalar>& pkeys) const {
    return _get_pkeyed_table(m_pkeyed_schema, pkeys);
}

t_table*
t_gstate::_get_pkeyed_table(const t_schema& schema, const std::vector<t_tscalar>& pkeys) const {
    t_mask mask(size());

    for (const auto& pkey : pkeys) {
        auto lk = lookup(pkey);
        if (lk.m_exists) {
            mask.set(lk.m_idx, true);
        }
    }

    return _get_pkeyed_table(schema, mask);
}

t_table*
t_gstate::_get_pkeyed_table(const t_schema& schema) const {
    auto mask = get_cpp_mask();
    return _get_pkeyed_table(schema, mask);
}

t_table*
t_gstate::_get_pkeyed_table(const t_schema& schema, const t_mask& mask) const {
    static bool const enable_pkeyed_table_mask_fix = true;
    t_uindex o_ncols = schema.m_columns.size();
    auto sz = enable_pkeyed_table_mask_fix ? mask.count() : mask.size();
    auto rval = new t_table(schema, sz);
    rval->init();
    rval->set_size(sz);

    const auto& sch_cols = schema.m_columns;

    const t_table* tbl = m_table.get();

#ifdef PSP_PARALLEL_FOR
    PSP_PFOR(0, int(o_ncols), 1,
        [&sch_cols, rval, tbl, &mask](int colidx)
#else
    for (t_uindex colidx = 0; colidx < o_ncols; ++colidx)
#endif
        {
            const std::string& c = sch_cols[colidx];
            if (c != "psp_op" && c != "psp_pkey") {
                rval->set_column(c, tbl->get_const_column(c)->clone(mask));
            }
        }

#ifdef PSP_PARALLEL_FOR
    );
#endif
    auto pkey_col = rval->get_column("psp_pkey").get();
    auto op_col = rval->get_column("psp_op").get();

    op_col->raw_fill<std::uint8_t>(OP_INSERT);
    op_col->valid_raw_fill();
    pkey_col->valid_raw_fill();

    std::vector<std::pair<t_tscalar, t_uindex>> order(
        enable_pkeyed_table_mask_fix ? sz : m_mapping.size());
    if (enable_pkeyed_table_mask_fix) {
        std::vector<t_uindex> mapping;
        mapping.resize(mask.size());
        {
            t_uindex mapped = 0;
            for (t_uindex idx = 0; idx < mask.size(); ++idx) {
                mapping[idx] = mapped;
                if (mask.get(idx))
                    ++mapped;
            }
        }

        t_uindex oidx = 0;
        for (const auto& kv : m_mapping) {
            if (mask.get(kv.second)) {
                order[oidx] = std::make_pair(kv.first, mapping[kv.second]);
                ++oidx;
            }
        }
    } else // enable_pkeyed_table_mask_fix
    {
        t_uindex oidx = 0;
        for (const auto& kv : m_mapping) {
            order[oidx] = kv;
            ++oidx;
        }
    }

    std::sort(order.begin(), order.end(),
        [](const std::pair<t_index, t_uindex>& a, const std::pair<t_index, t_uindex>& b) {
            return a.second < b.second;
        });

    // GAB: memory optim: pkeys are always INT32 now
    // No need to handle the "STR" case
//    if (get_pkey_dtype() == DTYPE_STR) {
//        static const t_tscalar empty = get_interned_tscalar("");
//        static bool const enable_pkeyed_table_vocab_reserve = true;
//
//        t_uindex offset = has_pkey(empty) ? 0 : 1;
//
//        size_t total_string_size = 0;
//
//        if (enable_pkeyed_table_vocab_reserve) {
//            total_string_size += offset;
//            for (t_uindex idx = 0, loop_end = order.size(); idx < loop_end; ++idx) {
//                total_string_size += strlen(order[idx].first.get_char_ptr()) + 1;
//            }
//        }
//
//        // if the m_mapping is empty, get_pkey_dtype() may lie about our pkeys being strings
//        // don't try to reserve in this case
//        if (!order.size())
//            total_string_size = 0;
//
//        pkey_col->set_vocabulary(order, total_string_size);
//        auto base = pkey_col->get_nth<t_uindex>(0);
//
//        for (t_uindex idx = 0, loop_end = order.size(); idx < loop_end; ++idx) {
//            base[idx] = idx + offset;
//        }
//    } else
      {
        t_uindex ridx = 0;
        for (const auto& e : order) {
            pkey_col->set_scalar(ridx, e.first);
            ++ridx;
        }
    }

    return rval;
}

t_uindex
t_gstate::size() const {
    return m_table->size();
}

std::vector<t_tscalar>
t_gstate::get_row_data_pkeys(const std::vector<t_tscalar>& pkeys) const {
    t_uindex ncols = m_table->num_columns();
    const t_schema& schema = m_table->get_schema();
    std::vector<t_tscalar> rval;

    std::vector<const t_column*> columns(ncols);
    for (t_uindex idx = 0, loop_end = schema.size(); idx < loop_end; ++idx) {
        const std::string& cname = schema.m_columns[idx];
        columns[idx] = m_table->get_const_column(cname).get();
    }

    auto none = mknone();

    // GAB: memory optim: do a first pass to compute the number of elements, to be able to reserve memory
    t_index count = 0;
    for (const auto& pkey : pkeys) {
        t_mapping::const_iterator iter = m_mapping.find(pkey.get<t_index>());
        if (iter == m_mapping.end())
            continue;

        for (t_uindex cidx = 0; cidx < ncols; ++cidx) {
            count++;
        }
    }

    rval.reserve(count);
    for (const auto& pkey : pkeys) {
        t_mapping::const_iterator iter = m_mapping.find(pkey.get<t_index>());
        if (iter == m_mapping.end())
            continue;

        for (t_uindex cidx = 0; cidx < ncols; ++cidx) {
            auto v = columns[cidx]->get_scalar(iter->second);
            if (v.is_valid()) {
                rval.push_back(v);
            } else {
                rval.push_back(none);
            }
        }
    }
    return rval;
}

bool
t_gstate::has_pkey(t_tscalar pkey) const {
    return m_mapping.find(pkey.get<t_index>()) != m_mapping.end();
}

std::vector<t_tscalar>
t_gstate::has_pkeys(const std::vector<t_tscalar>& pkeys) const {
    if (pkeys.empty())
        return std::vector<t_tscalar>();

    std::vector<t_tscalar> rval(pkeys.size());
    t_uindex idx = 0;

    for (const auto& p : pkeys) {
        t_tscalar tval;
        tval.set(m_mapping.find(p.get<t_index>()) != m_mapping.end());
        rval[idx].set(tval);
        ++idx;
    }

    return rval;
}

std::vector<t_tscalar>
t_gstate::get_pkeys() const {
    std::vector<t_tscalar> rval(m_mapping.size());
    t_uindex idx = 0;
    for (const auto& kv : m_mapping) {
        rval[idx].set(kv.first);
        ++idx;
    }
    return rval;
}

std::pair<t_tscalar, t_tscalar>
get_vec_min_max(const std::vector<t_tscalar>& vec) {
    t_tscalar min = mknone();
    t_tscalar max = mknone();

    for (const auto& v : vec) {
        if (min.is_none()) {
            min = v;
        } else {
            min = std::min(v, min);
        }

        if (max.is_none()) {
            max = v;
        } else {
            max = std::max(v, max);
        }
    }

    return std::pair<t_tscalar, t_tscalar>(min, max);
}

t_uindex
t_gstate::mapping_size() const {
    return m_mapping.size();
}

void
t_gstate::reset() {
    m_table->clear();
    m_mapping = t_mapping();
    m_free.clear();
}

t_tscalar
t_gstate::get_value(const t_tscalar& pkey, const std::string& colname) const {
    std::shared_ptr<const t_column> col = m_table->get_const_column(colname);
    const t_column* col_ = col.get();
    t_tscalar rval = mknone();

    auto iter = m_mapping.find(pkey.get<t_index>());
    if (iter != m_mapping.end()) {
        rval.set(col_->get_scalar(iter->second));
    }

    return rval;
}

const t_schema&
t_gstate::get_port_schema() const {
    return m_pkeyed_schema;
}

std::vector<t_uindex>
t_gstate::get_pkeys_idx(const std::vector<t_tscalar>& pkeys) const {
    std::vector<t_uindex> rv;
    rv.reserve(pkeys.size());

    for (const auto& p : pkeys) {
        auto lk = lookup(p);
        std::cout << "pkey " << p << " exists " << lk.m_exists << std::endl;
        if (lk.m_exists)
            rv.push_back(lk.m_idx);
    }
    return rv;
}

} // end namespace perspective
