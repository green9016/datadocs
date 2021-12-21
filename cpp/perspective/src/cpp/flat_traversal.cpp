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
#include <perspective/config.h>
#include <perspective/flat_traversal.h>
#include <perspective/filter_utils.h>
#include <perspective/search_utils.h>
#include <perspective/scalar.h>
#include <perspective/schema.h>

namespace perspective {

t_ftrav::t_ftrav(bool handle_nan_sort)
{
}

std::vector<t_tscalar>
t_ftrav::get_all_pkeys(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const {
    // assumes the code calling this has already validated cells
    std::vector<t_tscalar> rval;
    rval.reserve(cells.size());
    for (auto iter = cells.begin(); iter != cells.end(); ++iter) {
        rval.push_back(m_index->v[iter->first]);
    }
    return rval;
}

std::vector<t_tscalar>
t_ftrav::get_pkeys(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const {
    // GAB: memory optim: use the t_index type instead of t_scalar type (lower data type size)
    std::set<t_index> all_rows;

    for (t_index idx = 0, loop_end = cells.size(); idx < loop_end; ++idx) {
        all_rows.insert(cells[idx].first);
    }

    std::vector<t_tscalar> rval(all_rows.size());
    t_index count = 0;
    for (auto it = all_rows.begin(); it != all_rows.end(); ++it) {
        rval[count] = m_index->v[*it];
        ++count;
    }
    return rval;
}

std::vector<t_tscalar>
t_ftrav::get_pkeys(t_index begin_row, t_index end_row) const {
    t_index index_size = m_index->v.size();
    end_row = std::min(end_row, index_size);
    std::vector<t_tscalar> rval(end_row - begin_row);
    for (t_index ridx = begin_row; ridx < end_row; ++ridx) {
        rval[ridx - begin_row] = m_index->v[ridx];
    }
    return rval;
}

std::vector<t_tscalar>
t_ftrav::get_pkeys() const {
    return get_pkeys(0, size());
}

t_tscalar
t_ftrav::get_pkey(t_index idx) const {
    return m_index->v[idx];
}

void
t_ftrav::sort_by(std::shared_ptr<const t_gstate> state, const t_config& config,
    const std::vector<t_sortspec>& sortby) {
    if (sortby.empty())
        return;
    m_sortby = sortby;
}

t_index
t_ftrav::size() const {
    return m_nrows;
}

void
t_ftrav::get_row_indices(const std::unordered_set<t_tscalar>& pkeys,
    std::unordered_map<t_tscalar, t_index>& out_map) const {
    for (t_index idx = 0, loop_end = size(); idx < loop_end; ++idx) {
        t_tscalar pkey = m_index->v[idx];
        if (pkeys.find(pkey) != pkeys.end()) {
            out_map[pkey] = idx;
        }
    }
}

void
t_ftrav::get_row_indices(t_index bidx, t_index eidx, const std::unordered_set<t_tscalar>& pkeys,
    std::unordered_map<t_tscalar, t_index>& out_map) const {
    for (t_index idx = bidx; idx < eidx; ++idx) {
        t_tscalar pkey = m_index->v[idx];
        if (pkeys.find(pkey) != pkeys.end()) {
            out_map[pkey] = idx;
        }
    }
}

void
t_ftrav::reset() {
	m_index = nullptr;
    m_nrows = 0;
}

bool
t_ftrav::validate_cells(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const {
    t_index trav_size = size();

    for (t_index idx = 0, loop_end = cells.size(); idx < loop_end; ++idx) {
        t_index ridx = cells[idx].first;
        if (ridx >= trav_size)
            return false;
    }
    return true;
}

void
t_ftrav::step_begin() {
}

template<size_t nbins = 0x10000, class F>
static void psp_radix_sort(std::vector<int> &index, std::vector<int> &tmp, bool descending, F key, size_t maxkey = nbins)
{
    size_t N = index.size();
    size_t count[nbins];
    memset(count, 0, maxkey*sizeof(size_t));
    for(size_t i = 0; i < N; ++i)
        ++count[key(index[i])];

    if(!descending) {
        for(size_t i = 0, total = 0; i < maxkey; ++i) {
            size_t c = count[i];
            count[i] = total;
            total += c;
        }
    } else {
        for(size_t i = maxkey, total = 0; i --> 0; ) {
            size_t c = count[i];
            count[i] = total;
            total += c;
        }
    }

    tmp.resize(N);
    for(size_t i = 0; i < N; ++i) {
        int v = index[i];
        tmp[count[key(v)]++] = v;
    }
    index.swap(tmp);
}

static bool is_descending(t_sorttype type) {
    return type == SORTTYPE_DESCENDING || type == SORTTYPE_DESCENDING_ABS;
}

template<class T, typename std::enable_if<!std::is_scalar<T>::value, T>::type* = nullptr>
static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const T *key, const t_sortspec &spec)
{
    if(!is_descending(spec.m_sort_type))
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return key[x] < key[y]; });
    else
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return key[x] > key[y]; });
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const int64_t *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    switch(spec.m_sort_type) {
    default:
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)key[i]; });
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(key[i] >> 16); });
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(key[i] >> 32); });
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)((key[i] >> 48) ^ 0x8000); });
        break;
    case SORTTYPE_ASCENDING_ABS:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return abs(key[x]) < abs(key[y]); });
        break;
    case SORTTYPE_DESCENDING_ABS:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return abs(key[x]) > abs(key[y]); });
        break;
    }
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const int32_t *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    switch(spec.m_sort_type) {
    default:
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)key[i]; });
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)((key[i] >> 16) ^ 0x8000); });
        break;
    case SORTTYPE_ASCENDING_ABS:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return abs(key[x]) < abs(key[y]); });
        break;
    case SORTTYPE_DESCENDING_ABS:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return abs(key[x]) > abs(key[y]); });
        break;
    }
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const int16_t *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    switch(spec.m_sort_type) {
    default:
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(key[i] ^ 0x8000); });
        break;
    case SORTTYPE_ASCENDING_ABS:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return abs(key[x]) < abs(key[y]); });
        break;
    case SORTTYPE_DESCENDING_ABS:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return abs(key[x]) > abs(key[y]); });
        break;
    }
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const int8_t *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    switch(spec.m_sort_type) {
    default:
        psp_radix_sort<0x100>(index, tmp, desc, [&](int i){ return (uint8_t)(key[i] ^ 0x80); });
        break;
    case SORTTYPE_ASCENDING_ABS:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return abs(key[x]) < abs(key[y]); });
        break;
    case SORTTYPE_DESCENDING_ABS:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return abs(key[x]) > abs(key[y]); });
        break;
    }
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const uint64_t *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)key[i]; });
    psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(key[i] >> 16); });
    psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(key[i] >> 32); });
    psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(key[i] >> 48); });
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const uint32_t *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)key[i]; });
    psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(key[i] >> 16); });
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const uint16_t *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    psp_radix_sort(index, tmp, desc, [&](int i){ return key[i]; });
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const uint8_t *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    psp_radix_sort<0x100>(index, tmp, desc, [&](int i){ return key[i]; });
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const double *key, const t_sortspec &spec)
{
    // todo: possible way to apply radix sort -- sort as-is, then permute in the very end.
    bool desc = is_descending(spec.m_sort_type);
    auto k = (const int64_t*)key;
    switch(spec.m_sort_type) {
    default:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return key[x] < key[y]; });
        break;
    case SORTTYPE_DESCENDING:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return key[x] > key[y]; });
        break;
    case SORTTYPE_ASCENDING_ABS:
    case SORTTYPE_DESCENDING_ABS:
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)k[i]; });
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(k[i] >> 16); });
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(k[i] >> 32); });
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(k[i] >> 48) & 0x7fff; }, 0x8000);
        break;
    }
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const float *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    auto k = (const int32_t*)key;
    switch(spec.m_sort_type) {
    default:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return key[x] < key[y]; });
        break;
    case SORTTYPE_DESCENDING:
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return key[x] > key[y]; });
        break;
    case SORTTYPE_ASCENDING_ABS:
    case SORTTYPE_DESCENDING_ABS:
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)k[i]; });
        psp_radix_sort(index, tmp, desc, [&](int i){ return (uint16_t)(k[i] >> 16) & 0x7fff; }, 0x8000);
        break;
    }
}

static void psp_sort(std::vector<int> &index, std::vector<int> &tmp, const bool *key, const t_sortspec &spec)
{
    bool desc = is_descending(spec.m_sort_type);
    psp_radix_sort<2>(index, tmp, desc, [&](int i){ return key[i]; });
}


int psp_strcasecmp(const char *x, const char *y) {
    // collation order: iscntrl < isspace < ispunct < isalnum < unicode
    // upper and lower are equal
    static const uint8_t ascii_collate[] = {
        0,1,2,3,4,5,6,7,8,28,29,30,31,32,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,
        33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,66,67,68,69,70,71,72,73,74,75,49,50,51,52,53,54,
        55,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,56,57,58,59,60,
        61,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,62,63,64,65,27,
        102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,
        134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,
        166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,
        198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,
    };
    for(int i = 0;; ++i) {
        int d = ascii_collate[(uint8_t)x[i]] - ascii_collate[(uint8_t)y[i]];
        if(d || !x[i])
            return d;
    }
}

static void psp_sort_str(std::vector<int> &index, std::vector<int> &tmp, const t_column *col, const t_sortspec &spec)
{
    // todo: replace with radix sort on the few first chars? or better merge-sort
    // also because the strings are interned may be better to sort the interned table
    const t_uindex *sidx = col->get_nth<t_uindex>(0);
    const t_vocab *vocab = &*col->get_vocab();
    const t_extent_pair *extents = vocab->get_extents_base(); // pair::first is an offset into vlen where ith string begins
    const char *vlen = vocab->get_vlen_base(); // string data
    t_uindex vlenidx = vocab->get_vlenidx(); // number of extents
    bool desc = is_descending(spec.m_sort_type);
    auto get = [&](int x) { return vlen + extents[x].m_begin; };

    if(vlenidx < 0x10000 && vlenidx*2 < index.size())
    {
        // small vocabulary, sort it separately
        std::vector<uint16_t> perm(vlenidx);
        for(int i = 0; i < vlenidx; ++i)
            perm[i] = i;

        std::sort(perm.begin(), perm.end(), [&](uint16_t x, uint16_t y) { return psp_strcasecmp(get(x), get(y)) < 0; });

        std::vector<uint16_t> perm_inv(vlenidx);
        for(int i = 0; i < vlenidx; ++i)
            perm_inv[perm[i]] = i;

        psp_radix_sort(index, tmp, desc, [&](int i){ return perm_inv[sidx[i]]; }, vlenidx);
    }
    else if(desc)
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return psp_strcasecmp(get(sidx[x]), get(sidx[y])) > 0; });
    else
        std::stable_sort(index.begin(), index.end(), [&](int x, int y) { return psp_strcasecmp(get(sidx[x]), get(sidx[y])) < 0; });
}

static void sort_by_column(std::vector<int> &index, std::vector<int> &tmp, const t_column *col, const t_sortspec &spec)
{
    switch(col->get_dtype())
    {
    case DTYPE_INT64: psp_sort(index, tmp, col->get_nth<int64_t>(0), spec); break;
    case DTYPE_INT32: psp_sort(index, tmp, col->get_nth<int32_t>(0), spec); break;
    case DTYPE_INT16: psp_sort(index, tmp, col->get_nth<int16_t>(0), spec); break;
    case DTYPE_INT8: psp_sort(index, tmp, col->get_nth<int8_t>(0), spec); break;
    case DTYPE_UINT64: psp_sort(index, tmp, col->get_nth<uint64_t>(0), spec); break;
    case DTYPE_UINT32: psp_sort(index, tmp, col->get_nth<uint32_t>(0), spec); break;
    case DTYPE_UINT16: psp_sort(index, tmp, col->get_nth<uint16_t>(0), spec); break;
    case DTYPE_UINT8: psp_sort(index, tmp, col->get_nth<uint8_t>(0), spec); break;
    case DTYPE_FLOAT64: psp_sort(index, tmp, col->get_nth<double>(0), spec); break;
    case DTYPE_FLOAT32: psp_sort(index, tmp, col->get_nth<float>(0), spec); break;
    case DTYPE_BOOL: psp_sort(index, tmp, col->get_nth<bool>(0), spec); break;
    case DTYPE_TIME: psp_sort(index, tmp, col->get_nth<t_time::t_rawtype>(0), spec); break;
    case DTYPE_DATE: psp_sort(index, tmp, col->get_nth<t_date::t_rawtype>(0), spec); break;
    case DTYPE_STR: psp_sort_str(index, tmp, col, spec); break;
    case DTYPE_DURATION: psp_sort(index, tmp, col->get_nth<t_duration::t_rawtype>(0), spec); break;

    case DTYPE_LIST_BOOL: psp_sort(index, tmp, col->get_nth<std::vector<bool>>(0), spec); break;
    case DTYPE_LIST_FLOAT64: psp_sort(index, tmp, col->get_nth<std::vector<double>>(0), spec); break;
    case DTYPE_LIST_INT64: psp_sort(index, tmp, col->get_nth<std::vector<std::int64_t>>(0), spec); break;
    case DTYPE_LIST_DATE: psp_sort(index, tmp, col->get_nth<std::vector<t_date>>(0), spec); break;
    case DTYPE_LIST_TIME: psp_sort(index, tmp, col->get_nth<std::vector<t_time>>(0), spec); break;
    case DTYPE_LIST_DURATION: psp_sort(index, tmp, col->get_nth<std::vector<t_duration>>(0), spec); break;
    case DTYPE_LIST_STR: psp_sort(index, tmp, col->get_nth<std::vector<std::string>>(0), spec); break;

    default: break;
    }

    if(col->is_status_enabled()) {
        const t_status *status = col->get_nth_status(0);
        psp_radix_sort<5>(index, tmp, false, [&](int i){ return 4-status[i]; });
    }
}

size_t reuse_sort_suffix(const std::vector<t_sortspec> &newOrder, const std::vector<t_sortspec> &oldOrder) {
    auto half_eq = [](const t_sortspec &x, const t_sortspec &y) { return x.m_agg_index == y.m_agg_index; };
    auto full_eq = [](const t_sortspec &x, const t_sortspec &y) { return x.m_agg_index == y.m_agg_index && x.m_sort_type == y.m_sort_type; };
    size_t i = newOrder.size(), j = oldOrder.size();

    // find last occurance of newOrder.back() in oldOrder
    while(i > 0 && j > 0 && !full_eq(newOrder[i-1], oldOrder[j-1]))
        --j;

    while(i > 0 && j > 0) {
        if(full_eq(newOrder[i-1], oldOrder[j-1]))
            --i, --j;
        else if(std::find_if(newOrder.begin(), newOrder.begin() + i,
            [&](const t_sortspec &x) { return half_eq(x, oldOrder[j-1]); }) != newOrder.begin() + i)
            --j;
        else
            break;
    }
    printf("reusing order. Need to sort by %d/%d columns\n", (int)i, (int)newOrder.size());
    return i;
}

void
t_ftrav::step_end(std::shared_ptr<const t_gstate> state, t_config& config) {
    MEM_REPORT("ftrav::step_end() / before allocating new indices");
    m_index = nullptr;
    m_ncols = m_nrows = 0;

    std::shared_ptr<const t_table> table = state->get_table();
    if(!m_index) m_index = table->get_last_index();
    table->set_last_index(nullptr);

    if(!m_index || config.get_fterms() != m_index->filters || config.get_sterms() != m_index->searchs) {
        m_index = std::make_shared<t_table_index>();
        size_t tab_size = table->size(); 
        m_index->v.reserve(tab_size);

        const uint8_t *op_col = table->get_const_column("psp_op")->get_nth<uint8_t>(0);
        t_mask mask;
        if(config.has_filters())
            mask = filter_table_for_config(*table, config);
        
        t_mask s_mask;
        if (config.has_search()) {
            s_mask = search_table_for_config(*table, config);
        }
        for(size_t i = 0; i < tab_size; ++i)
            if(op_col[i] == OP_INSERT && (mask.size() <= i || mask.get(i)) && (s_mask.size() <= i || s_mask.get(i)))
                m_index->v.push_back(i);
    } else if(m_index.use_count() != 1) {
        m_index = std::make_shared<t_table_index>(*m_index);
    }

    std::vector<int> tmp;
    for(size_t i = reuse_sort_suffix(m_sortby, m_index->sortby); i --> 0; ) {
        int icol = m_sortby[i].m_agg_index;
        std::string colname = config.col_at(icol);
        std::string sortby_colname = config.get_sort_by(colname);
        const t_column *col = &*table->get_const_column(sortby_colname);
        sort_by_column(m_index->v, tmp, col, m_sortby[i]);
    }

    m_index->sortby = m_sortby;
    m_index->filters = config.get_fterms();
    m_index->searchs = config.get_sterms();
    m_nrows = m_index->v.size();
    table->set_last_index(m_index);

    // Apply percent limit (build_sql_query can do only for fixed limit).
    size_t n = m_nrows;
    auto apply_limit = [&](size_t limit, t_limit_type limit_type) {
        if(limit != -1) {
            n = std::min(n, limit_type == LIMIT_TYPE_PECENT ? std::max(size_t(1), size_t(m_nrows/100.*limit)) : limit);
        }
    };
    if(!m_sortby.empty())
        apply_limit(m_sortby[0].m_limit, m_sortby[0].m_limit_type);
    for (auto &filter : config.get_top_n_filters())
        apply_limit(filter.m_bag[0].to_int64(), str_to_limit_type(filter.m_bag[1].to_string()));
    if(n < m_nrows)
        m_nrows = n;

    MEM_REPORT("quit ftrav::step_end()");

    config.update_query_percentage_store(QUERY_PERCENT_TRAVERSAL_STEP_END, 100);
}

const std::vector<t_sortspec>&
t_ftrav::get_sort_by() const {
    return m_sortby;
}

bool
t_ftrav::empty_sort_by() const {
    return m_sortby.empty();
}

void
t_ftrav::reset_step_state() {
}

} // end namespace perspective
