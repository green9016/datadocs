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
#include <perspective/config.h>
#include <perspective/table.h>
#include <perspective/mask.h>

namespace perspective {

inline t_mask
filter_table_for_config(const t_table& tbl, t_config& config, bool has_previous = false, bool is_previous = false) {

    switch (config.get_fmode()) {
        case FMODE_SIMPLE_CLAUSES: {
            std::vector<t_fterm> fterms;
            if (has_previous) {
                auto previous_fterms = config.get_previous_fterms();
                if (is_previous) {
                    auto fterm = previous_fterms[0];
                    std::vector<t_fterm> new_fterms;
                    switch(fterm.m_op) {
                        case FILTER_OP_LAST_7_DAYS:
                        case FILTER_OP_LAST_10_DAYS:
                        case FILTER_OP_LAST_30_DAYS: {
                            std::vector<t_tscalar> terms{};
                            terms.push_back(fterm.m_bag[0]);
                            terms.push_back(fterm.m_threshold);
                            new_fterms.push_back(t_fterm(fterm.m_colname, FILTER_OP_BETWEEN, mktscalar(0), terms));
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
                            std::vector<t_tscalar> terms{};
                            terms.push_back(fterm.m_bag[2]);
                            terms.push_back(fterm.m_bag[0]);
                            new_fterms.push_back(t_fterm(fterm.m_colname, FILTER_OP_BETWEEN, mktscalar(0), terms));
                        } break;

                        default: {
                        } break;
                    }
                    fterms = new_fterms;
                } else {
                    fterms = previous_fterms;
                }
            } else {
                fterms = config.get_fterms();
            }
            return tbl.filter_cpp(config.get_combiner(), fterms, config);
        } break;
        default: {}
    }

    return t_mask(tbl.size());
}

} // end namespace perspective
