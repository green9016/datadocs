/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#pragma once
#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/raw_types.h>
#include <perspective/storage.h>
#include <perspective/column.h>
#include <perspective/comparators.h>
#include <perspective/dense_nodes.h>
#include <perspective/node_processor_types.h>
#include <perspective/partition.h>
#include <perspective/mask.h>
#include <csignal>
#include <cmath>
#include <map>

namespace perspective {

template <int DTYPE_T>
struct t_pivot_processor {
    typedef t_chunk_value_span<t_tscalar> t_spans;
    typedef std::vector<t_spans> t_spanvec;
    typedef std::vector<t_spanvec> t_spanvvec;
    typedef std::map<t_tscalar, t_uindex, t_comparator<t_tscalar, DTYPE_T>> t_map;

    // For now we dont do any inter node
    // parallelism. this should be trivial
    // to fix in the future.
    t_uindex operator()(const t_column* data, std::vector<t_dense_tnode>* nodes,
        t_column* values, t_column* leaves, t_uindex nbidx, t_uindex neidx, const t_mask* mask, t_config& config, t_mask &dt_msk,
        t_sorttype sort_type = SORTTYPE_ASCENDING, t_index sort_limit = t_index(-1), t_limit_type limit_type = LIMIT_TYPE_ITEMS);
};

template <int DTYPE_T>
t_uindex
t_pivot_processor<DTYPE_T>::operator()(const t_column* data, std::vector<t_dense_tnode>* nodes,
    t_column* values,

    t_column* leaves, t_uindex nbidx, t_uindex neidx, const t_mask* mask, t_config& config, t_mask &dt_msk,
    t_sorttype sort_type, t_index sort_limit, t_limit_type limit_type) {

    t_lstore lcopy(leaves->data_lstore(), t_lstore_tmp_init_tag());

    // add accessor api and move these to that
    t_uindex* leaves_ptr = leaves->get_nth<t_uindex>(0);
    t_uindex* lcopy_ptr = lcopy.get_nth<t_uindex>(0);
    t_uindex lvl_nidx = neidx;
    t_uindex offset = 0;

    std::int32_t percentage = 0;
    std::int32_t prev_percentage = 0;
    std::int32_t base_percentage = 0;
    for (t_uindex nidx = nbidx; nidx < neidx; ++nidx) {
        t_dense_tnode* pnode = &nodes->at(nidx);
        t_uindex cbidx = pnode->m_flidx;
        t_uindex ceidx = pnode->m_flidx + pnode->m_nleaves;
        t_uindex parent_idx = pnode->m_idx;
        // Offset will set at begin of parent node
        offset = pnode->m_flidx;
        t_spanvvec spanvec;
        {
            t_spanvec spans;
            partition(data, leaves, cbidx, ceidx, spans, sort_type);
            spanvec.push_back(spans);
        }

        percentage = prev_percentage + 10 * (nidx + 1)/neidx;
        if (percentage > prev_percentage && percentage <= 100) {
            prev_percentage = percentage;
            config.update_query_percentage_store(QUERY_PERCENT_CHECK_PIVOT, percentage);
        }

        if (config.get_cancel_query_status()) {
            return 0;
        }

        // map value to number of rows with value
        t_map globcount((t_comparator<t_tscalar, DTYPE_T>()));
        // map hidden value to store value over than limit
        t_map hidden_map((t_comparator<t_tscalar, DTYPE_T>()));

        auto limit = sort_limit;
        // Get limit for case limit type is percent
        // with size of spanvec at index 0 
        if (sort_limit != t_index(-1) && limit_type == LIMIT_TYPE_PECENT && spanvec.size() == 1) {
            limit = std::max(t_index(1), t_index((double)spanvec[0].size()*(double)sort_limit/100.0));
        }
        base_percentage = prev_percentage;
        for (t_index idx = 0, loop_end = spanvec.size(); idx < loop_end; ++idx) {
            const t_spanvec& sp = spanvec[idx];
            for (t_uindex spidx = 0, sp_loop_end = sp.size(); spidx < sp_loop_end; ++spidx) {
                const t_spans& vsp = sp[spidx];
                auto miter = globcount.find(vsp.m_value);
                if (miter == globcount.end()) {
                    // Add value to hidden value in case have sort and limit
                    if (limit != -1) {
                        if (globcount.size() >= limit) {
                            hidden_map[vsp.m_value] = t_uindex(1);
                        }
                    }
                    globcount[vsp.m_value] = vsp.m_eidx - vsp.m_bidx;
                } else {
                    miter->second = miter->second + vsp.m_eidx - vsp.m_bidx;
                }
            }
            percentage = base_percentage + 30 * ((idx + 1)/loop_end) * ((nidx + 1)/neidx);
            if (percentage > prev_percentage && percentage <= 100) {
                prev_percentage = percentage;
                config.update_query_percentage_store(QUERY_PERCENT_CHECK_PIVOT, percentage);
            }

            if (config.get_cancel_query_status()) {
                return 0;
            }
        }

        percentage = base_percentage + 30 * ((nidx + 1)/neidx);
        if (percentage > prev_percentage && percentage <= 100) {
            prev_percentage = percentage;
            config.update_query_percentage_store(QUERY_PERCENT_CHECK_PIVOT, percentage);
        }

        if (config.get_cancel_query_status()) {
            return 0;
        }

        // map value to leaf offset
        t_map globcursor((t_comparator<t_tscalar, DTYPE_T>()));
        base_percentage = prev_percentage;
        std::int32_t globidx = 0;
        std::int32_t globend = globcount.size();
        for (typename t_map::const_iterator miter = globcount.begin(),
                                            loop_end = globcount.end();
             miter != loop_end; ++miter) {
            globcursor[miter->first] = offset;
            offset += miter->second;

            percentage = base_percentage + 20 * ((globidx + 1)/globend) * ((nidx + 1)/neidx);
            if (percentage > prev_percentage && percentage <= 100) {
                prev_percentage = percentage;
                config.update_query_percentage_store(QUERY_PERCENT_CHECK_PIVOT, percentage);
            }

            if (config.get_cancel_query_status()) {
                return 0;
            }

            globidx++;
        }

        percentage = base_percentage + 20 * ((nidx + 1)/neidx);
        if (percentage > prev_percentage && percentage <= 100) {
            prev_percentage = percentage;
            config.update_query_percentage_store(QUERY_PERCENT_CHECK_PIVOT, percentage);
        }

        if (config.get_cancel_query_status()) {
            return 0;
        }

        auto running_cursor = globcursor;
        base_percentage = prev_percentage;
        for (t_index idx = 0, loop_end = spanvec.size(); idx < loop_end; ++idx) {
            const t_spanvec& sp = spanvec[idx];
            for (t_index spidx = 0, sp_loop_end = sp.size(); spidx < sp_loop_end; ++spidx) {
                const auto& cvs = sp[spidx];
                t_uindex voff = running_cursor[cvs.m_value];
                memcpy(lcopy_ptr + voff, leaves_ptr + cvs.m_bidx,
                    sizeof(t_uindex) * (cvs.m_eidx - cvs.m_bidx));

                running_cursor[cvs.m_value] = voff + cvs.m_eidx - cvs.m_bidx;
            }
            percentage = base_percentage + 30 * ((idx + 1)/loop_end) * ((nidx + 1)/neidx);
            if (percentage > prev_percentage && percentage <= 100) {
                prev_percentage = percentage;
                config.update_query_percentage_store(QUERY_PERCENT_CHECK_PIVOT, percentage);
            }

            if (config.get_cancel_query_status()) {
                return 0;
            }
        }

        percentage = base_percentage + 30 * ((nidx + 1)/neidx);
        if (percentage > prev_percentage && percentage <= 100) {
            prev_percentage = percentage;
            config.update_query_percentage_store(QUERY_PERCENT_CHECK_PIVOT, percentage);
        }

        if (config.get_cancel_query_status()) {
            return 0;
        }

        // Update current node
        pnode->m_fcidx = lvl_nidx;
        // pnode->m_nchild = globcount.size();
        // Update number of children for parent node
        pnode->m_nchild = globcount.size() - hidden_map.size();

        globidx = 0;
        globend = globcursor.size();
        base_percentage = prev_percentage;
        for (typename t_map::const_iterator miter = globcursor.begin(),
                                            loop_end = globcursor.end();
             miter != loop_end; ++miter) {
            // Check value exists in hidden map.
            // If value is in hidden map (over than limit), ignore it.
            if (hidden_map.find(miter->first) != hidden_map.end()) {
                // update mask key for sort, limit
                for (t_index idx = 0, ssize = globcount[miter->first]; idx < ssize; ++idx) {
                    dt_msk.set(*(lcopy_ptr + miter->second + idx), false);
                }
                continue;
            }
            nodes->push_back(
                {lvl_nidx, parent_idx, 0, 0, miter->second, globcount[miter->first], true});
            lvl_nidx += 1;
            values->push_back<t_tscalar>(miter->first);

            percentage = base_percentage + 10 * ((globidx + 1)/globend) * ((nidx + 1)/neidx);
            if (percentage > prev_percentage && percentage <= 100) {
                prev_percentage = percentage;
                config.update_query_percentage_store(QUERY_PERCENT_CHECK_PIVOT, percentage);
            }

            if (config.get_cancel_query_status()) {
                return 0;
            }

            globidx++;
        }

        percentage = base_percentage + 10 * ((nidx + 1)/neidx);
        if (percentage > prev_percentage && percentage <= 100) {
            prev_percentage = percentage;
            config.update_query_percentage_store(QUERY_PERCENT_CHECK_PIVOT, percentage);
        }

        if (config.get_cancel_query_status()) {
            return 0;
        }
    }

    t_lstore* llstore = leaves->_get_data_lstore();

    memcpy(leaves_ptr, lcopy_ptr, llstore->size());

    return lvl_nidx;
}

} // end namespace perspective
