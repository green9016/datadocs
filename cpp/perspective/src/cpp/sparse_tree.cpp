/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <algorithm>
#include <cmath>
#include <fstream>
#include <perspective/base.h>
#include <perspective/compat.h>
#include <perspective/extract_aggregate.h>
#include <perspective/multi_sort.h>
#include <perspective/sparse_tree.h>
#include <perspective/sym_table.h>
#include <perspective/tracing.h>
#include <perspective/utils.h>
#include <perspective/env_vars.h>
#include <perspective/dense_tree.h>
#include <perspective/dense_tree_context.h>
#include <perspective/gnode_state.h>
#include <perspective/config.h>
#include <perspective/table.h>
#include <perspective/filter_utils.h>
#include <perspective/having_utils.h>
#include <perspective/search_utils.h>
#include <perspective/context_two.h>
#include <set>

namespace perspective {

t_tscalar
get_dominant(std::vector<t_tscalar>& values) {
    if (values.empty())
        return mknone();

    std::sort(values.begin(), values.end());

    t_tscalar delem = values[0];
    t_index dcount = 1;
    t_index count = 1;

    for (t_index idx = 1, loop_end = values.size(); idx < loop_end; ++idx) {
        const t_tscalar& prev = values[idx - 1];
        const t_tscalar& curr = values[idx];

        if (curr == prev && curr.is_valid()) {
            ++count;
        }

        if ((idx + 1) == static_cast<t_index>(values.size()) || curr != prev) {
            if (count > dcount) {
                delem = prev;
                dcount = count;
            }

            count = 1;
        }
    }

    return delem;
}

t_tree_unify_rec::t_tree_unify_rec(
    t_uindex sptidx, t_uindex daggidx, t_uindex saggidx, t_uindex nstrands)
    : m_sptidx(sptidx)
    , m_daggidx(daggidx)
    , m_saggidx(saggidx)
    , m_nstrands(nstrands) {}

t_stree::t_stree(const std::vector<t_pivot>& pivots, const std::vector<t_aggspec>& aggspecs,
    const t_schema& schema, const t_config& cfg)
    : m_pivots(pivots)
    , m_init(false)
    , m_curidx(1)
    , m_aggspecs(aggspecs)
    , m_schema(schema)
    , m_cur_aggidx(1)
    , m_minmax(aggspecs.size())
    , m_has_delta(false) {
    auto g_agg_str = cfg.get_grand_agg_str();
    m_grand_agg_str = g_agg_str.empty() ? "Grand Aggregate" : g_agg_str;
}

t_stree::~t_stree() {
    for (t_sidxmap::iterator iter = m_smap.begin(); iter != m_smap.end(); ++iter) {
        free(const_cast<char*>(iter->first));
    }
}

t_uindex
t_stree::get_num_aggcols() const {
    return m_aggspecs.size();
}

std::string
t_stree::repr() const {
    std::stringstream ss;
    ss << "t_stree<" << this << ">";
    return ss.str();
}

void
t_stree::init() {
    m_nodes = std::make_shared<t_treenodes>();
    m_idxpkey = std::make_shared<t_idxpkey>();
    m_idxleaf = std::make_shared<t_idxleaf>();
    m_period_map = std::map<t_index, t_index>();
    m_binning_vec = std::vector<t_binning_info>();

    t_tscalar value = m_symtable.get_interned_tscalar(m_grand_agg_str.c_str());
    t_tnode node(0, root_pidx(), value, 0, value, 1, 0);
    m_nodes->insert(node);

    std::vector<std::string> columns;
    std::vector<t_dtype> dtypes;
    std::vector<t_dataformattype> dftypes;

    for (const auto& spec : m_aggspecs) {
        auto cinfo = spec.get_output_specs(m_schema);

        for (const auto& ci : cinfo) {
            columns.push_back(ci.m_name);
            dtypes.push_back(ci.m_type);
            dftypes.push_back(ci.m_dftype);
        }
    }

    t_schema schema(columns, dtypes, dftypes);

    t_uindex capacity = DEFAULT_EMPTY_CAPACITY;
    m_aggregates = std::make_shared<t_table>(schema, capacity);
    m_aggregates->init();
    m_aggregates->set_size(capacity);

    // For running total table
    t_schema running_schema({}, {}, {});
    m_running_tbl = std::make_shared<t_table>(running_schema, capacity);
    m_running_tbl->init();
    m_running_tbl->set_size(capacity);

    m_aggcols = std::vector<const t_column*>(columns.size());

    for (t_uindex idx = 0, loop_end = columns.size(); idx < loop_end; ++idx) {
        //m_aggcols[idx] = m_aggregates->get_const_column(columns[idx]).get();
        m_aggcols[idx] = m_aggregates->get_const_column(idx).get();
    }

    m_deltas = std::make_shared<t_tcdeltas>();
    m_features = std::vector<bool>(CTX_FEAT_LAST_FEATURE);
    m_init = true;
}

t_tscalar
t_stree::get_value(t_index idx) const {
    iter_by_idx iter = m_nodes->get<by_idx>().find(idx);
    PSP_VERBOSE_ASSERT(iter != m_nodes->get<by_idx>().end(), "Reached end iterator");
    return iter->m_value;
}

t_tscalar
t_stree::get_sortby_value(t_index idx) const {
    iter_by_idx iter = m_nodes->get<by_idx>().find(idx);
    PSP_VERBOSE_ASSERT(iter != m_nodes->get<by_idx>().end(), "Reached end iterator");
    return iter->m_sort_value;
}

void
t_stree::build_strand_table_phase_1(t_tscalar pkey, t_op op, t_uindex idx, t_uindex npivots,
    t_uindex strand_count_idx, t_uindex aggcolsize, bool force_current_row,
    const std::vector<const t_column*>& piv_ccols,
    const std::vector<const t_column*>& piv_tcols,
    const std::vector<const t_column*>& agg_ccols,
    const std::vector<const t_column*>& agg_dcols, std::vector<t_column*>& piv_scols,
    std::vector<t_column*>& agg_acols, t_column* agg_scount, t_column* spkey,
    t_uindex& insert_count, bool& pivots_neq,
    const std::vector<std::string>& pivot_like) const {
    pivots_neq = false;
    std::set<std::string> pivmap;
    bool all_eq_tt = true;

    for (t_uindex pidx = 0, ploop_end = pivot_like.size(); pidx < ploop_end; ++pidx) {
        const std::string& colname = pivot_like.at(pidx);
        if (pivmap.find(colname) != pivmap.end()) {
            continue;
        }
        pivmap.insert(colname);
        piv_scols[pidx]->push_back(piv_ccols[pidx]->get_scalar(idx));
        const std::uint8_t* trans_ = piv_tcols[pidx]->get_nth<std::uint8_t>(idx);
        t_value_transition trans = static_cast<t_value_transition>(*trans_);
        if (trans != VALUE_TRANSITION_EQ_TT)
            all_eq_tt = false;

        if (pidx < npivots) {
            pivots_neq = pivots_neq || pivots_changed(trans);
        }
    }

    for (t_uindex aggidx = 0; aggidx < aggcolsize; ++aggidx) {
        if (aggidx != strand_count_idx) {
            if (pivots_neq || force_current_row) {
                agg_acols[aggidx]->push_back(agg_ccols[aggidx]->get_scalar(idx));
            } else {
                agg_acols[aggidx]->push_back(agg_dcols[aggidx]->get_scalar(idx));
            }
        }
    }

    std::int8_t cval;

    if (op == OP_DELETE) {
        cval = -1;
    } else {
        if (t_env::backout_force_current_row()) {
            cval = !all_eq_tt || pivots_neq ? 1 : 0;
        } else {

            cval = npivots == 0 || !all_eq_tt || pivots_neq || force_current_row ? 1 : 0;
        }
    }
    agg_scount->push_back<std::int8_t>(cval);
    spkey->push_back(pkey);

    ++insert_count;
}

void
t_stree::build_strand_table_phase_2(t_tscalar pkey, t_uindex idx, t_uindex npivots,
    t_uindex strand_count_idx, t_uindex aggcolsize,
    const std::vector<const t_column*>& piv_pcols,
    const std::vector<const t_column*>& agg_pcols, std::vector<t_column*>& piv_scols,
    std::vector<t_column*>& agg_acols, t_column* agg_scount, t_column* spkey,
    t_uindex& insert_count, const std::vector<std::string>& pivot_like) const {
    std::set<std::string> pivmap;
    for (t_uindex pidx = 0, ploop_end = pivot_like.size(); pidx < ploop_end; ++pidx) {
        const std::string& colname = pivot_like.at(pidx);
        if (pivmap.find(colname) != pivmap.end()) {
            continue;
        }
        pivmap.insert(colname);
        piv_scols[pidx]->push_back(piv_pcols[pidx]->get_scalar(idx));
    }

    for (t_uindex aggidx = 0; aggidx < aggcolsize; ++aggidx) {
        if (aggidx != strand_count_idx) {
            agg_acols[aggidx]->push_back(agg_pcols[aggidx]->get_scalar(idx).negate());
        }
    }

    agg_scount->push_back<std::int8_t>(std::int8_t(-1));
    spkey->push_back(pkey);
    ++insert_count;
}

t_build_strand_table_common_rval
t_stree::build_strand_table_common(const t_table& flattened,
    const std::vector<t_aggspec>& aggspecs, const t_config& config) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");

    t_build_strand_table_common_rval rv;

    rv.m_flattened_schema = flattened.get_schema();
    auto df_map = config.get_data_format_map();
    // 23/08/2019: allow aggregate multiple aggregations for same column name
    //std::set<std::string> sschema_colset;
    std::vector<std::string> sschema_colvec;
    std::set<std::string> pivot_colset;

    auto get_strand_schema_column_type = [&rv, config](const t_dtype col_type, std::string colname,
        t_agg_level_type agg_level, t_binning_info binning) {
        t_dtype rtype = col_type;
        switch (col_type)
        {
        case DTYPE_LIST_STR:
            rv.m_unnest = true;
            rtype = DTYPE_STR;
            break;
        
        case DTYPE_LIST_BOOL:
            rv.m_unnest = true;
            rtype = DTYPE_BOOL;
            break;

        case DTYPE_LIST_FLOAT64:
            rv.m_unnest = true;
            if (binning.type == BINNING_TYPE_NONE) {
                rtype = DTYPE_FLOAT64;
            } else {
                rtype = DTYPE_FLOAT64;
            }
            break;

        case DTYPE_LIST_INT64:
            rv.m_unnest = true;
            if (binning.type == BINNING_TYPE_NONE) {
                rtype = DTYPE_INT64;
            } else {
                rtype = DTYPE_FLOAT64;
            }
            break;

        case DTYPE_LIST_DATE: {
            rv.m_unnest = true;
            if (agg_level == AGG_LEVEL_YEAR || agg_level == AGG_LEVEL_QUARTER || agg_level == AGG_LEVEL_WEEK
                || agg_level == AGG_LEVEL_MONTH) {
                if (binning.type != BINNING_TYPE_NONE && agg_level == AGG_LEVEL_YEAR) {
                    rtype = DTYPE_FLOAT64;
                } else {
                    rtype = DTYPE_INT64;
                }
            } else if (agg_level != AGG_LEVEL_NONE && agg_level != AGG_LEVEL_DAY) {
                rtype = DTYPE_STR;
            } else {
                rtype = DTYPE_DATE;
            }
        } break;

        case DTYPE_LIST_TIME: {
            rv.m_unnest = true;
            if (agg_level == AGG_LEVEL_YEAR || agg_level == AGG_LEVEL_QUARTER || agg_level == AGG_LEVEL_WEEK
                || agg_level == AGG_LEVEL_MONTH) {
                if (binning.type != BINNING_TYPE_NONE && agg_level == AGG_LEVEL_YEAR) {
                    rtype = DTYPE_FLOAT64;
                } else {
                    rtype = DTYPE_INT64;
                }
            } else if (agg_level == AGG_LEVEL_HOUR || agg_level == AGG_LEVEL_MINUTE || agg_level == AGG_LEVEL_SECOND) {
                rtype = DTYPE_DURATION;
            } else if (agg_level == AGG_LEVEL_DAY || agg_level == AGG_LEVEL_DATE) {
                rtype = DTYPE_DATE;
            } else if (agg_level != AGG_LEVEL_NONE) {
                rtype = DTYPE_STR;
            } else {
                rtype = DTYPE_TIME;
            }
        } break;

        case DTYPE_LIST_DURATION:
            rv.m_unnest = true;
            /*if (agg_level != AGG_LEVEL_NONE) {
                rtype = DTYPE_STR;
            } else {
                rtype = DTYPE_DURATION;
            }*/
            rtype = DTYPE_DURATION;
            break;

        case DTYPE_DATE: {
            if (agg_level == AGG_LEVEL_YEAR || agg_level == AGG_LEVEL_QUARTER || agg_level == AGG_LEVEL_WEEK
                || agg_level == AGG_LEVEL_MONTH) {
                if (binning.type != BINNING_TYPE_NONE && agg_level == AGG_LEVEL_YEAR) {
                    rtype = DTYPE_FLOAT64;
                } else {
                    rtype = DTYPE_INT64;
                }
            } else if (agg_level != AGG_LEVEL_NONE && agg_level != AGG_LEVEL_DAY) {
                rtype = DTYPE_STR;
            }
        } break;

        case DTYPE_TIME: {
            if (agg_level == AGG_LEVEL_YEAR || agg_level == AGG_LEVEL_QUARTER || agg_level == AGG_LEVEL_WEEK
                || agg_level == AGG_LEVEL_MONTH) {
                if (binning.type != BINNING_TYPE_NONE && agg_level == AGG_LEVEL_YEAR) {
                    rtype = DTYPE_FLOAT64;
                } else {
                    rtype = DTYPE_INT64;
                }
            } else if (agg_level == AGG_LEVEL_HOUR || agg_level == AGG_LEVEL_MINUTE || agg_level == AGG_LEVEL_SECOND) {
                rtype = DTYPE_DURATION;
            } else if (agg_level == AGG_LEVEL_DAY || agg_level == AGG_LEVEL_DATE) {
                rtype = DTYPE_DATE;
            } else if (agg_level != AGG_LEVEL_NONE) {
                rtype = DTYPE_STR;
            }
        } break;

        case DTYPE_DURATION: {
            /*if (agg_level != AGG_LEVEL_NONE) {
                rtype = DTYPE_STR;
            }*/
        } break;
        
        case DTYPE_FLOAT32:
        case DTYPE_FLOAT64:
        case DTYPE_INT64:
        case DTYPE_INT32:
        case DTYPE_INT16:
        case DTYPE_INT8:
        case DTYPE_UINT64:
        case DTYPE_UINT32:
        case DTYPE_UINT16:
        case DTYPE_UINT8: {
            if (binning.type != BINNING_TYPE_NONE) {
                rtype = DTYPE_FLOAT64;
            }
        } break;

        default:
            break;
        }

        rv.m_agg_level_vec.push_back(agg_level);
        rv.m_binning_vec.push_back(binning);

        return rtype;
    };

    auto get_strand_schema_column_dftype = [config](const t_dataformattype col_dftype, std::string colname,
        t_agg_level_type agg_level, t_binning_type binning_type, t_dtype col_type) {
        t_dataformattype rdftype = col_dftype;
        if (agg_level == AGG_LEVEL_YEAR) {
            /*if (binning_type != BINNING_TYPE_NONE) {
                rdftype = DATA_FORMAT_TEXT;
            } else {
                rdftype = DATA_FORMAT_NUMBER;
            }*/
            rdftype = DATA_FORMAT_NUMBER;
        } else if (agg_level == AGG_LEVEL_QUARTER) {
            rdftype = DATA_FORMAT_QUARTER;
        } else if (agg_level == AGG_LEVEL_WEEK) {
            rdftype = DATA_FORMAT_WEEK;
        } else if (agg_level == AGG_LEVEL_MONTH) {
            rdftype = DATA_FORMAT_MONTH;
        } else if (agg_level == AGG_LEVEL_HOUR || agg_level == AGG_LEVEL_MINUTE || agg_level == AGG_LEVEL_SECOND) {
            if (col_type == DTYPE_TIME || col_type == DTYPE_LIST_TIME) {
                rdftype = DATA_FORMAT_TIME;
            }
        } else if (agg_level == AGG_LEVEL_DAY) {
            if (col_type == DTYPE_TIME || col_type == DTYPE_LIST_TIME) {
                rdftype = DATA_FORMAT_DAY_V2;
            } else {
                if (col_dftype == DATA_FORMAT_DATE_V2) {
                    rdftype = DATA_FORMAT_DAY_V2;
                } else if (col_dftype == DATA_FORMAT_DATE_V3) {
                    rdftype = DATA_FORMAT_DAY_V3;
                } else {
                    rdftype = DATA_FORMAT_DAY_V1;
                }
            }
        } else if (agg_level == AGG_LEVEL_DATE) {
            rdftype = DATA_FORMAT_DATE_V2;
        } else if (agg_level != AGG_LEVEL_NONE) {
            rdftype = DATA_FORMAT_TEXT;
        }/* else if (binning_type != BINNING_TYPE_NONE) {
            rdftype = DATA_FORMAT_TEXT;
        }*/

        return rdftype;
    };

    for (const auto& piv : m_pivots) {
        const std::string& colname = piv.colname();
        auto binning = piv.binning();
        // 23/08/2019: allow aggregate multiple aggregations for same column name
        const std::string& pivot_name = piv.pivot_name();
        std::string sortby_colname = config.get_sort_by(colname);
        t_agg_level_type agg_level = piv.agg_level();
        auto add_col = [&sschema_colvec, &rv, &get_strand_schema_column_type, &get_strand_schema_column_dftype,
            &agg_level, &pivot_colset, &binning, &df_map](const std::string& cname, const std::string& pname) {
            // 23/08/2019: allow aggregate multiple aggregations for same column name
            //if (sschema_colset.find(cname) == sschema_colset.end()) {
            if (pivot_colset.find(pname) == pivot_colset.end()) {
                rv.m_pivot_like_columns.push_back(cname);
                /*rv.m_strand_schema.add_column(
                    pname, get_strand_schema_column_type(rv.m_flattened_schema.get_dtype(cname), cname, agg_level, binning),
                    get_strand_schema_column_dftype(rv.m_flattened_schema.get_data_format_type(cname), cname, agg_level, binning.type),
                    cname);*/
                rv.m_strand_schema.add_column(
                    pname, get_strand_schema_column_type(rv.m_flattened_schema.get_dtype(cname), cname, agg_level, binning),
                    get_strand_schema_column_dftype(df_map[cname], cname, agg_level, binning.type, rv.m_flattened_schema.get_dtype(cname)),
                    cname);
                // 23/08/2019: allow aggregate multiple aggregations for same column name
                // sschema_colset.insert(cname);
                sschema_colvec.push_back(cname);
                pivot_colset.insert(pname);
            }
        };

        add_col(colname, pivot_name);
        // 23/08/2019: allow aggregate multiple aggregations for same column name
        //add_col(sortby_colname);
        if (colname != sortby_colname) {
            add_col(sortby_colname, pivot_name);
        }
    }

    //rv.m_pivsize = sschema_colset.size();
    rv.m_pivsize = sschema_colvec.size();
    std::set<std::string> schema_dtype;
    std::set<std::string> aggcolset;
    for (const auto& aggspec : aggspecs) {
        for (const auto& dep : aggspec.get_dependencies()) {
            if (dep.type() == DEPTYPE_COLUMN) {
                const std::string& depname = dep.name();
                aggcolset.insert(depname);

                if (aggspec.is_non_delta()
                    // 23/08/2019: allow aggregate multiple aggregations for same column name
                    //&& sschema_colset.find(depname) == sschema_colset.end()) {
                    && std::find(sschema_colvec.begin(), sschema_colvec.end(), depname) == sschema_colvec.end()) {
                    rv.m_pivot_like_columns.push_back(depname);
                    auto tbl_colname = m_schema.get_tbl_colname(depname);
                    rv.m_strand_schema.add_column(
                        depname, get_strand_schema_column_type(rv.m_flattened_schema.get_dtype(tbl_colname), tbl_colname, AGG_LEVEL_NONE, t_binning_info{BINNING_TYPE_NONE}),
                        get_strand_schema_column_dftype(df_map[tbl_colname], tbl_colname, AGG_LEVEL_NONE, BINNING_TYPE_NONE, rv.m_flattened_schema.get_dtype(tbl_colname)),
                        tbl_colname);
                    // 23/08/2019: allow aggregate multiple aggregations for same column name
                    //sschema_colset.insert(depname);
                    sschema_colvec.push_back(depname);
                }
            }
        }
    }

    //rv.m_npivotlike = sschema_colset.size();
    rv.m_npivotlike = sschema_colvec.size();
    t_dtype psp_pkey_type = flattened.get_const_column("psp_pkey")->get_dtype();
    t_dataformattype psp_pkey_dftype = flattened.get_const_column("psp_pkey")->get_data_format_type();
    rv.m_strand_schema.add_column("psp_pkey", psp_pkey_type, psp_pkey_dftype, "psp_pkey");

    for (const auto& aggcol : aggcolset) {
        //rv.m_aggschema.add_column(aggcol, rv.m_flattened_schema.get_dtype(aggcol),
        //                            rv.m_flattened_schema.get_data_format_type(aggcol));
        if (aggcol == "psp_pkey") {
            rv.m_aggschema.add_column(aggcol, psp_pkey_type, psp_pkey_dftype, aggcol);
        } else {
            rv.m_aggschema.add_column(aggcol, m_schema.get_dtype(aggcol),
                m_schema.get_data_format_type(aggcol),
                m_schema.get_tbl_colname(aggcol));
        }
    }

    rv.m_aggschema.add_column("psp_strand_count", DTYPE_INT8, DATA_FORMAT_NUMBER, "psp_strand_count");
    return rv;
}

t_uindex
t_stree::unnest_strands_row(std::vector<const t_column*>& piv_fcols, t_build_strand_table_common_rval rv,
    t_uindex row_idx, std::vector<t_column*>& unnest_piv_scols, std::vector<t_agg_level_type> agg_level_vec,
    std::vector<t_binning_info> binning_vec, std::vector<std::vector<double>>& default_binning_vec) const {
    t_uindex num_rows = 1;
    std::vector<t_uindex> cell_unnest_size(rv.m_pivot_like_columns.size());
    for (t_uindex cidx = 0, loop_end = rv.m_pivot_like_columns.size(); cidx < loop_end; ++cidx) {
        t_tscalar value = piv_fcols[cidx]->get_scalar(row_idx);
        cell_unnest_size[cidx] = value.m_list_size > 0 ? value.m_list_size : 1;
        num_rows *= cell_unnest_size[cidx];
    }

    for (t_uindex cidx = 0, loop_end = rv.m_pivot_like_columns.size(); cidx < loop_end; ++cidx) {
        t_uindex num_rows_before = 0;
        if (cidx > 0) {
            for (t_uindex bidx = 0; bidx < cidx; ++bidx) {
                num_rows_before += cell_unnest_size[bidx];
            }
        } else {
            num_rows_before = 1;
        }
        t_uindex num_rows_after = 0;
        if (cidx < loop_end - 1) {
            for (t_uindex aidx = cidx + 1; aidx < loop_end; ++aidx) {
                num_rows_after += cell_unnest_size[aidx];
            }
        } else {
            num_rows_after = 1;
        }
        for (t_uindex bidx = 0; bidx < num_rows_before; ++bidx) {
            for (t_uindex uidx = 0; uidx < cell_unnest_size[cidx]; ++uidx) {
                for (t_uindex adix = 0; adix < num_rows_after; ++adix) {
                    unnest_piv_scols[cidx]->push_back(piv_fcols[cidx]->get_unnest_scalar(row_idx, uidx, agg_level_vec[cidx],
                        binning_vec[cidx], unnest_piv_scols[cidx]->get_data_format_type(), default_binning_vec[cidx]));
                }
            }
        }
    }

    return num_rows;
}

void
t_stree::update_column_name(const std::string& old_name, const std::string& new_name) {
    // Update column name for aggregate spec
    for (auto& aggspec: m_aggspecs) {
        if (old_name == aggspec.name()) {
            aggspec.update_column_name(old_name, new_name);
        }
    }

    std::map<std::string, std::string> col_map = {{new_name, old_name}};

    // Update column name for running table
    auto running_schema = m_running_tbl->get_schema();
    auto it = std::find(running_schema.m_columns.begin(), running_schema.m_columns.end(), old_name);
    if (it != running_schema.m_columns.end()) {
        m_running_tbl->rename_columns(col_map);
    }

    // Update column name for aggregate table
    m_aggregates->rename_columns(col_map);
}

t_tscalar
t_stree::format_pivot_scalar(t_tscalar value, t_agg_level_type agg_level, t_binning_info binning, t_dataformattype df_type) const {
    auto dtype = value.get_dtype();
    switch (dtype) {
        case DTYPE_TIME:
        case DTYPE_DATE:
        case DTYPE_DURATION: {
            if (!value.is_valid()) {
                return value;
            }
            if (agg_level == AGG_LEVEL_DAY) {
                t_date date;
                if (dtype == DTYPE_DATE) {
                    date = value.get<t_date>();
                }
                if (dtype == DTYPE_TIME) {
                    t_time time = value.get<t_time>();
                    date = t_date(std::int32_t(time.raw_value()));
                }
                struct tm t;
                bool rcode = date.as_tm(t);
                if (rcode) {
                    // 2016 is leap year
                    t_date new_date = t_date(2016, date.month(t), date.day(t));
                    t_tscalar rv;
                    rv.set(new_date);
                    return rv;
                }
                return value;
            } else if (agg_level == AGG_LEVEL_DATE) {
                t_date date;
                if (dtype == DTYPE_DATE) {
                    date = value.get<t_date>();
                }
                if (dtype == DTYPE_TIME) {
                    t_time time = value.get<t_time>();
                    date = t_date(std::int32_t(time.raw_value()));
                }
                t_tscalar rv;
                rv.set(date);
                return rv;
            }
            if (agg_level == AGG_LEVEL_YEAR || agg_level == AGG_LEVEL_QUARTER || agg_level == AGG_LEVEL_WEEK
                || agg_level == AGG_LEVEL_MONTH) {
                std::int64_t num = std::int64_t(value.to_agg_level_number(agg_level));
                t_tscalar rv;
                rv.set(num);
                if (binning.type != BINNING_TYPE_NONE && agg_level == AGG_LEVEL_YEAR) {
                    t_tscalar binning_rv;
                    binning_rv = rv.to_binning_middle_value(binning);
                    binning_rv.m_data_format_type = df_type;
                    return binning_rv;
                } else {
                    return rv;
                }
            }
            if (agg_level == AGG_LEVEL_HOUR || agg_level == AGG_LEVEL_MINUTE || agg_level == AGG_LEVEL_SECOND) {
                double num = value.to_agg_level_number(agg_level);
                t_duration duration = t_duration(num);
                t_tscalar rv;
                rv.set(duration);
                return rv;
            }
            if (agg_level != AGG_LEVEL_NONE) {
                t_tscalar rv;
                std::string str = value.to_agg_level_string(agg_level);
                rv.set(get_interned_tscalar(str.c_str()));
                return rv;
            } else {
                return value;
            }
        } break;

        case DTYPE_FLOAT64:
        case DTYPE_FLOAT32:
        case DTYPE_INT64:
        case DTYPE_INT32:
        case DTYPE_INT16:
        case DTYPE_INT8:
        case DTYPE_UINT64:
        case DTYPE_UINT32:
        case DTYPE_UINT16:
        case DTYPE_UINT8: {
            if (binning.type != BINNING_TYPE_NONE) {
                t_tscalar rv;
                rv = value.to_binning_middle_value(binning);
                rv.m_data_format_type = df_type;
                //std::string str = value.to_binning_string(binning, df_type);
                //rv.set(get_interned_tscalar(str.c_str()));
                return rv;
            } else {
                return value;
            }
        } break;

        default: {
            return value;
        } break;
    }
}

// can contain additional rows
// notably pivot changed rows will be added
std::pair<std::shared_ptr<t_table>, std::shared_ptr<t_table>>
t_stree::build_strand_table(const t_table& flattened, const t_table& delta, const t_table& prev,
    const t_table& current, const t_table& transitions, const std::vector<t_aggspec>& aggspecs,
    t_config& config, std::map<t_index, t_index>& period_map, std::vector<t_binning_info>& binning_vec,
    std::map<std::string, std::vector<double>>& default_binning) const {

    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");

    auto rv = build_strand_table_common(flattened, aggspecs, config);

    // strand table
    std::shared_ptr<t_table> strands = std::make_shared<t_table>(rv.m_strand_schema);
    strands->init();

    // strand table
    std::shared_ptr<t_table> aggs = std::make_shared<t_table>(rv.m_aggschema);
    aggs->init();

    std::shared_ptr<const t_column> pkey_col = flattened.get_const_column("psp_pkey");
    std::shared_ptr<const t_column> op_col = flattened.get_const_column("psp_op");

    t_uindex npivotlike = rv.m_npivotlike;
    std::vector<const t_column*> piv_pcols(npivotlike);
    std::vector<const t_column*> piv_ccols(npivotlike);
    std::vector<const t_column*> piv_tcols(npivotlike);
    std::vector<t_column*> piv_scols(npivotlike);

    t_uindex insert_count = 0;

    for (t_uindex pidx = 0; pidx < npivotlike; ++pidx) {
        const std::string& piv = rv.m_strand_schema.m_columns[pidx];
        piv_pcols[pidx] = prev.get_const_column(piv).get();
        piv_ccols[pidx] = current.get_const_column(piv).get();
        piv_tcols[pidx] = transitions.get_const_column(piv).get();
        piv_scols[pidx] = strands->get_column(piv).get();
    }

    t_uindex aggcolsize = rv.m_aggschema.m_columns.size();
    std::vector<const t_column*> agg_ccols(aggcolsize);
    std::vector<const t_column*> agg_pcols(aggcolsize);
    std::vector<const t_column*> agg_dcols(aggcolsize);
    std::vector<t_column*> agg_acols(aggcolsize);

    t_uindex strand_count_idx = 0;

    for (t_uindex aggidx = 0; aggidx < aggcolsize; ++aggidx) {
        const std::string& aggcol = rv.m_aggschema.m_columns[aggidx];
        if (aggcol == "psp_strand_count") {
            agg_dcols[aggidx] = 0;
            agg_ccols[aggidx] = 0;
            agg_pcols[aggidx] = 0;
            strand_count_idx = aggidx;
        } else {
            agg_dcols[aggidx] = delta.get_const_column(aggcol).get();
            agg_ccols[aggidx] = current.get_const_column(aggcol).get();
            agg_pcols[aggidx] = prev.get_const_column(aggcol).get();
        }

        agg_acols[aggidx] = aggs->get_column(aggcol).get();
    }

    t_column* agg_scount = aggs->get_column("psp_strand_count").get();

    t_column* spkey = strands->get_column("psp_pkey").get();

    t_mask msk_prev, msk_curr;

    bool has_filters = config.has_filters();

    if (has_filters) {
        msk_prev = filter_table_for_config(prev, config);
        msk_curr = filter_table_for_config(current, config);
        for (t_uindex idx = 0, loop_end = flattened.size(); idx < loop_end; ++idx) {
            bool filter_prev = msk_prev.get(idx);
            bool filter_curr = msk_curr.get(idx);

            t_tscalar pkey = pkey_col->get_scalar(idx);
            std::uint8_t op_ = *(op_col->get_nth<std::uint8_t>(idx));
            t_op op = static_cast<t_op>(op_);
            bool pivots_neq;

            if (!filter_prev && !filter_curr) {
                // nothing to do
                continue;
            } else if (!filter_prev && filter_curr) {
                // apply current row
                build_strand_table_phase_1(pkey, op, idx, rv.m_pivsize, strand_count_idx,
                    aggcolsize, true, piv_ccols, piv_tcols, agg_ccols, agg_dcols, piv_scols,
                    agg_acols, agg_scount, spkey, insert_count, pivots_neq,
                    rv.m_pivot_like_columns);
            } else if (filter_prev && !filter_curr) {
                // reverse prev row
                build_strand_table_phase_2(pkey, idx, rv.m_pivsize, strand_count_idx,
                    aggcolsize, piv_pcols, agg_pcols, piv_scols, agg_acols, agg_scount, spkey,
                    insert_count, rv.m_pivot_like_columns);
            } else if (filter_prev && filter_curr) {
                // should be handled as normal
                build_strand_table_phase_1(pkey, op, idx, rv.m_pivsize, strand_count_idx,
                    aggcolsize, false, piv_ccols, piv_tcols, agg_ccols, agg_dcols, piv_scols,
                    agg_acols, agg_scount, spkey, insert_count, pivots_neq,
                    rv.m_pivot_like_columns);

                if (op == OP_DELETE || !pivots_neq) {
                    continue;
                }

                build_strand_table_phase_2(pkey, idx, rv.m_pivsize, strand_count_idx,
                    aggcolsize, piv_pcols, agg_pcols, piv_scols, agg_acols, agg_scount, spkey,
                    insert_count, rv.m_pivot_like_columns);
            }
        }
    } else {
        for (t_uindex idx = 0, loop_end = flattened.size(); idx < loop_end; ++idx) {

            t_tscalar pkey = pkey_col->get_scalar(idx);
            std::uint8_t op_ = *(op_col->get_nth<std::uint8_t>(idx));
            t_op op = static_cast<t_op>(op_);
            bool pivots_neq;

            build_strand_table_phase_1(pkey, op, idx, rv.m_pivsize, strand_count_idx,
                aggcolsize, false, piv_ccols, piv_tcols, agg_ccols, agg_dcols, piv_scols,
                agg_acols, agg_scount, spkey, insert_count, pivots_neq,
                rv.m_pivot_like_columns);

            if (op == OP_DELETE || !pivots_neq) {
                continue;
            }

            build_strand_table_phase_2(pkey, idx, rv.m_pivsize, strand_count_idx, aggcolsize,
                piv_pcols, agg_pcols, piv_scols, agg_acols, agg_scount, spkey, insert_count,
                rv.m_pivot_like_columns);
        }
    }

    strands->reserve(insert_count);
    strands->set_size(insert_count);
    aggs->reserve(insert_count);
    aggs->set_size(insert_count);
    agg_scount->valid_raw_fill();
    return std::pair<std::shared_ptr<t_table>, std::shared_ptr<t_table>>(strands, aggs);
}

// can contain additional rows
// notably pivot changed rows will be added
std::pair<std::shared_ptr<t_table>, std::shared_ptr<t_table>>
t_stree::build_strand_table(const t_table& flattened, const std::vector<t_aggspec>& aggspecs,
    t_config& config, std::map<t_index, t_index>& period_map, std::vector<t_binning_info>& binning_vec,
    std::map<std::string, std::vector<double>>& default_binning) const {
    PSP_TRACE_SENTINEL();
    PSP_VERBOSE_ASSERT(m_init, "touching uninited object");
    
    auto has_previous_filters = config.has_previous_filters();
    bool has_filters = config.has_filters();
    bool has_search = config.has_search();

	const_cast<t_table&>(flattened).build_metadata();

    auto rv = build_strand_table_common(flattened, aggspecs, config);

    // strand table
    std::shared_ptr<t_table> strands = std::make_shared<t_table>(rv.m_strand_schema);
    strands->init();

    // strand table
    std::shared_ptr<t_table> aggs = std::make_shared<t_table>(rv.m_aggschema);
    aggs->init();

    std::shared_ptr<const t_column> pkey_col = flattened.get_const_column("psp_pkey");

    std::shared_ptr<const t_column> op_col = flattened.get_const_column("psp_op");

    t_uindex npivotlike = rv.m_npivotlike;
    std::vector<const t_column*> piv_fcols(npivotlike);
    std::vector<t_column*> piv_scols(npivotlike);

    t_uindex insert_count = 0;

    std::vector<std::vector<double>> default_binning_vec;

    for (t_uindex pidx = 0; pidx < npivotlike; ++pidx) {
        const std::string& piv = rv.m_strand_schema.m_columns[pidx];
        //23/08/2019: allow aggregate multiple aggregations for same column name
        //piv_fcols[pidx] = flattened.get_const_column(tbl_colname).get();
        const std::string& tbl_colname = rv.m_strand_schema.m_customcol_map[piv];
        piv_fcols[pidx] = flattened.get_const_column(tbl_colname).get();
        if (rv.m_binning_vec[pidx].type == BINNING_TYPE_AUTO) {
            auto binning_params = piv_fcols[pidx]->get_column_binning_params();
            if (binning_params.size() == 3) {
                rv.m_binning_vec[pidx].min = binning_params[0];
                rv.m_binning_vec[pidx].max = binning_params[1];
                rv.m_binning_vec[pidx].size = binning_params[2];
            }
        }
        switch(piv_fcols[pidx]->get_dtype()) {
        case DTYPE_FLOAT32:
        case DTYPE_FLOAT64:
        case DTYPE_INT64:
        case DTYPE_INT32:
        case DTYPE_INT16:
        case DTYPE_INT8:
        case DTYPE_UINT64:
        case DTYPE_UINT32:
        case DTYPE_UINT16:
        case DTYPE_UINT8:
        case DTYPE_DATE:
        case DTYPE_TIME:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_TIME:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64: {
            default_binning_vec.push_back(std::vector<double>{std::numeric_limits<double>::infinity(),
                                            std::numeric_limits<double>::infinity() * -1.0, 0.0});
        } break;
        
        default: {
            default_binning_vec.push_back(std::vector<double>{});
        } break;
        }
        binning_vec.push_back(rv.m_binning_vec[pidx]);
        piv_scols[pidx] = strands->get_column(piv).get();
    }

    t_uindex aggcolsize = rv.m_aggschema.m_columns.size();
    std::vector<const t_column*> agg_fcols(aggcolsize);
    std::vector<t_column*> agg_acols(aggcolsize);

    t_uindex strand_count_idx = 0;
    std::vector<t_uindex> computed_cols_index;

    for (t_uindex aggidx = 0; aggidx < aggcolsize; ++aggidx) {
        const std::string& aggcol = rv.m_aggschema.m_columns[aggidx];
        if (aggcol == "psp_strand_count") {
            agg_fcols[aggidx] = 0;
            strand_count_idx = aggidx;
        } else {
            if (m_schema.is_computed_col(aggcol)) {
                computed_cols_index.push_back(aggidx);
                agg_fcols[aggidx] = 0;
            } else {
                const std::string& tbl_colname = rv.m_aggschema.get_tbl_colname(aggcol);
                //agg_fcols[aggidx] = flattened.get_const_column(aggcol).get();
                agg_fcols[aggidx] = flattened.get_const_column(tbl_colname).get();
            }
        }

        agg_acols[aggidx] = aggs->get_column(aggcol).get();
    }

    t_column* agg_scount = aggs->get_column("psp_strand_count").get();

    t_column* spkey = strands->get_column("psp_pkey").get();

    t_mask msk;
    t_mask smsk;

    if (has_filters) {
        msk = filter_table_for_config(flattened, config);
        if (config.get_cancel_query_status()) {
            return std::pair<std::shared_ptr<t_table>, std::shared_ptr<t_table>>(nullptr, nullptr);
        }
    }

    t_mask cmsk;
    t_mask pmsk;
    if (has_previous_filters) {
        cmsk = filter_table_for_config(flattened, config, true, false);
        pmsk = filter_table_for_config(flattened, config, true, true);
    }

    if (has_search) {
        smsk = search_table_for_config(flattened, config);
        if (config.get_cancel_query_status()) {
            return std::pair<std::shared_ptr<t_table>, std::shared_ptr<t_table>>(nullptr, nullptr);
        }
    }

    for (t_uindex idx = 0, loop_end = flattened.size(); idx < loop_end; ++idx) {
        bool filter = !has_filters || msk.get(idx);
        bool search = !has_search || smsk.get(idx);
        t_tscalar pkey = pkey_col->get_scalar(idx);
        std::uint8_t op_ = *(op_col->get_nth<std::uint8_t>(idx));
        t_op op = static_cast<t_op>(op_);

        if (!filter || !search || op == OP_DELETE) {
            // nothing to do
            continue;
        }
        if (rv.m_unnest) {
            std::vector<t_column*> unnest_piv_scols(npivotlike);
            t_schema unnest_schema;
            for (t_uindex cidx = 0, loop_end = npivotlike; cidx < loop_end; ++cidx) {
                t_dtype col_type = rv.m_strand_schema.m_types[cidx];
                t_dataformattype col_dftype = rv.m_strand_schema.m_data_format_types[cidx];
                switch (col_type)
                {
                case DTYPE_LIST_STR:
                    col_type = DTYPE_STR;
                    break;
                
                case DTYPE_LIST_BOOL:
                    col_type = DTYPE_BOOL;
                    break;
                
                case DTYPE_LIST_FLOAT64:
                    col_type = DTYPE_FLOAT64;
                    break;

                case DTYPE_LIST_INT64:
                    col_type = DTYPE_INT64;
                    break;

                case DTYPE_LIST_DATE:
                    col_type = DTYPE_DATE;
                    break;

                case DTYPE_LIST_TIME:
                    col_type = DTYPE_TIME;
                    break;

                case DTYPE_LIST_DURATION:
                    col_type = DTYPE_DURATION;
                    break;
                
                default:
                    col_type = rv.m_strand_schema.m_types[cidx];
                    break;
                }
                std::string colname = rv.m_strand_schema.m_columns[cidx];
                unnest_schema.add_column(colname, col_type, col_dftype, rv.m_strand_schema.m_customcol_map[colname]);
            }

            // unnest table
            std::shared_ptr<t_table> unnests = std::make_shared<t_table>(unnest_schema);
            unnests->init();
            for (t_uindex pidx = 0; pidx < npivotlike; ++pidx) {
                const std::string& piv = rv.m_strand_schema.m_columns[pidx];
                unnest_piv_scols[pidx] = unnests->get_column(piv).get();
            }
            t_uindex unnest_rows_count = unnest_strands_row(piv_fcols, rv, idx, unnest_piv_scols, rv.m_agg_level_vec, rv.m_binning_vec, default_binning_vec);

            for (t_uindex pidx = 0, ploop_end = rv.m_pivot_like_columns.size(); pidx < ploop_end;
                ++pidx) {
                for (t_uindex unnest_idx = 0; unnest_idx < unnest_rows_count; ++unnest_idx) {
                    t_tscalar value = unnest_piv_scols[pidx]->get_scalar(unnest_idx);
                    piv_scols[pidx]->push_back(value);
                }
            }

            for (t_uindex aggidx = 0; aggidx < aggcolsize; ++aggidx) {
                if (aggidx != strand_count_idx &&
                    std::find(computed_cols_index.begin(), computed_cols_index.end(), aggidx) == computed_cols_index.end()) {
                    for (t_uindex unnest_idx = 0; unnest_idx < unnest_rows_count; ++unnest_idx) {
                        agg_acols[aggidx]->push_back(agg_fcols[aggidx]->get_scalar(idx));
                    }
                }
            }

            if (has_previous_filters) {
                if (cmsk.get(pkey.to_double())) {
                    period_map[pkey.to_double()] = 1;
                } else if (pmsk.get(pkey.to_double())) {
                    period_map[pkey.to_double()] = 2;
                } else {
                    period_map[pkey.to_double()] = 0;
                }
            }
            for (t_uindex unnest_idx = 0; unnest_idx < unnest_rows_count; ++unnest_idx) {
                agg_scount->push_back<std::int8_t>(1);
                //spkey->push_back(pkey_col->get_scalar(idx));
                spkey->push_back(pkey);
                ++insert_count;
            }
        } else {
            for (t_uindex pidx = 0, ploop_end = rv.m_pivot_like_columns.size(); pidx < ploop_end;
                ++pidx) {
                //piv_scols[pidx]->push_back(piv_fcols[pidx]->get_scalar(idx));
                auto scalar_val = piv_fcols[pidx]->get_scalar(idx);
                auto dbinning = default_binning_vec[pidx];
                if (dbinning.size() == 3) {
                    if (scalar_val.is_valid()) {
                        auto dtype = piv_fcols[pidx]->get_dtype();
                        double tmp_double;
                        if (dtype == DTYPE_DATE || dtype == DTYPE_TIME) {
                            tmp_double = scalar_val.to_agg_level_number(AGG_LEVEL_YEAR);
                        } else {
                            tmp_double = scalar_val.to_double();
                        }
                        if (tmp_double < dbinning[0])
                            default_binning_vec[pidx][0] = tmp_double;
                        if (tmp_double > dbinning[1])
                            default_binning_vec[pidx][1] = tmp_double;
                    }
                    default_binning_vec[pidx][2]++;
                }
                piv_scols[pidx]->push_back(format_pivot_scalar(scalar_val, rv.m_agg_level_vec[pidx], rv.m_binning_vec[pidx], piv_scols[pidx]->get_data_format_type()));
            }

            for (t_uindex aggidx = 0; aggidx < aggcolsize; ++aggidx) {
                if (aggidx != strand_count_idx &&
                    std::find(computed_cols_index.begin(), computed_cols_index.end(), aggidx) == computed_cols_index.end()) {
                    agg_acols[aggidx]->push_back(agg_fcols[aggidx]->get_scalar(idx));
                }
            }

            agg_scount->push_back<std::int8_t>(1);
            //agg_scount->push_back<std::int8_t>(idx % 2 == 0 ? 1 : 0);
            spkey->push_back(pkey);
            if (has_previous_filters) {
                if (cmsk.get(pkey.to_double())) {
                    period_map[pkey.to_double()] = 1;
                } else if (pmsk.get(pkey.to_double())) {
                    period_map[pkey.to_double()] = 2;
                } else {
                    period_map[pkey.to_double()] = 0;
                }
            }
            ++insert_count;
        }
    }

    for (t_uindex pidx = 0; pidx < npivotlike; ++pidx) {
        const std::string& piv = rv.m_strand_schema.m_columns[pidx];
        const std::string& tbl_colname = rv.m_strand_schema.m_customcol_map[piv];
        auto binning = default_binning_vec[pidx];
        if (binning.size() == 3) {
            default_binning[tbl_colname] = binning;
            default_binning[tbl_colname][2] = std::ceil(std::sqrt(default_binning[tbl_colname][2]));
            if (default_binning[tbl_colname][2] > 100) {
                default_binning[tbl_colname][2] = 100;
            }
        }
    }

    strands->reserve(insert_count);
    strands->set_size(insert_count);
    aggs->reserve(insert_count);
    aggs->set_size(insert_count);
    agg_scount->valid_raw_fill();
    return std::pair<std::shared_ptr<t_table>, std::shared_ptr<t_table>>(strands, aggs);
}

bool
t_stree::pivots_changed(t_value_transition t) const {

    return t == VALUE_TRANSITION_NEQ_TF || t == VALUE_TRANSITION_NVEQ_FT
        || t == VALUE_TRANSITION_NEQ_TT;
}

void
t_stree::populate_pkey_idx(const t_dtree_ctx& ctx, const t_dtree& dtree, t_uindex dptidx,
    t_uindex sptidx, t_uindex ndepth, t_idxpkey& new_idx_pkey) {
    if (ndepth == dtree.last_level()) {
        auto pkey_col = ctx.get_pkey_col();
        auto strand_count_col = ctx.get_strand_count_col();
        auto liters = ctx.get_leaf_iterators(dptidx);

        for (auto lfiter = liters.first; lfiter != liters.second; ++lfiter) {

            auto lfidx = *lfiter;
            auto pkey = m_symtable.get_interned_tscalar(pkey_col->get_scalar(lfidx));
            auto strand_count = *(strand_count_col->get_nth<std::int8_t>(lfidx));

            if (strand_count > 0) {
                t_stpkey s(sptidx, pkey);
                new_idx_pkey.insert(s);
            }

            if (strand_count < 0) {
                remove_pkey(sptidx, pkey);
            }
        }
    }
}

void
t_stree::update_shape_from_static(const t_dtree_ctx& ctx, t_config& config) {
    std::int32_t percentage = 0;
    std::int32_t prev_percentage = 0;

    m_newids.clear();
    m_newleaves.clear();
    m_tree_unification_records.clear();

    const std::shared_ptr<const t_column> scount
        = ctx.get_aggtable().get_const_column("psp_strand_count_sum");

    const t_dtree& dtree = ctx.get_tree();

    // map dptidx to sptidx
    std::map<t_uindex, t_uindex> nmap;
    nmap[0] = 0;

    t_filter filter;

    // update root
    auto root_iter = m_nodes->get<by_idx>().find(0);
    auto root_node = *root_iter;
    t_index root_nstrands = *(scount->get_nth<t_index>(0)) + root_node.m_nstrands;
    root_node.set_nstrands(root_nstrands);
    m_nodes->get<by_idx>().replace(root_iter, root_node);

    t_tree_unify_rec unif_rec(0, 0, 0, root_nstrands);
    m_tree_unification_records.push_back(unif_rec);

    t_idxpkey new_idx_pkey;

    std::int32_t idx = 0;
    std::int32_t dt_size = dtree.size();
    for (auto dptidx : dtree.dfs()) {
        percentage = idx * 100 / dt_size;
        if (percentage > prev_percentage) {
            prev_percentage = percentage;
            config.update_query_percentage_store(QUERY_PERCENT_UPDATE_SHAPE, percentage);
        }

        if (config.get_cancel_query_status()) {
            return;
        }
        
        idx++;

        t_uindex sptidx = 0;
        t_depth ndepth = dtree.get_depth(dptidx);

        if (dptidx == 0) {
            populate_pkey_idx(ctx, dtree, dptidx, sptidx, ndepth, new_idx_pkey);
            continue;
        }

        t_uindex p_dptidx = dtree.get_parent(dptidx);
        t_uindex p_sptidx = nmap[p_dptidx];

        t_tscalar value = m_symtable.get_interned_tscalar(dtree.get_value(filter, dptidx));

        t_tscalar sortby_value
            = m_symtable.get_interned_tscalar(dtree.get_sortby_value(filter, dptidx));

        t_uindex src_ridx = dptidx;

        auto iter = m_nodes->get<by_pidx_hash>().find(std::make_tuple(p_sptidx, value));

        auto nstrands = *(scount->get_nth<std::int64_t>(dptidx));

        if (iter == m_nodes->get<by_pidx_hash>().end() && nstrands < 0) {
            continue;
        }

        if (iter == m_nodes->get<by_pidx_hash>().end()) {
            // create node and enqueue
            sptidx = genidx();
            t_uindex aggsize = m_aggregates->size();
            if (sptidx == aggsize) {
                double scale = 1.3;
                t_uindex new_size = scale * aggsize;
                m_aggregates->extend(new_size);
            }

            t_uindex dst_ridx = gen_aggidx();

            t_tnode node(sptidx, p_sptidx, value, ndepth, sortby_value, nstrands, dst_ridx);

            m_newids.insert(sptidx);

            if (ndepth == dtree.last_level()) {
                m_newleaves.insert(sptidx);
            }

            auto insert_pair = m_nodes->insert(node);
            if (!insert_pair.second) {
                auto failed_because = *(insert_pair.first);
                std::cout << "failed because of " << failed_because << std::endl;
            }
            PSP_VERBOSE_ASSERT(insert_pair.second, "Failed to insert node");
            t_tree_unify_rec unif_rec(sptidx, src_ridx, dst_ridx, nstrands);
            m_tree_unification_records.push_back(unif_rec);
        } else {
            sptidx = iter->m_idx;

            // update node
            t_tnode node = *iter;
            node.set_sort_value(sortby_value);

            t_uindex dst_ridx = node.m_aggidx;

            nstrands = node.m_nstrands + nstrands;

            t_tree_unify_rec unif_rec(sptidx, src_ridx, dst_ridx, nstrands);
            m_tree_unification_records.push_back(unif_rec);

            sptidx = iter->m_idx;
            node.set_nstrands(nstrands);
            PSP_VERBOSE_ASSERT(m_nodes->get<by_pidx_hash>().replace(iter, node), ,
                "Failed to replace"); // middle argument ignored
        }

        populate_pkey_idx(ctx, dtree, dptidx, sptidx, ndepth, new_idx_pkey);
        nmap[dptidx] = sptidx;
    }

    config.update_query_percentage_store(QUERY_PERCENT_UPDATE_SHAPE, 100);

    if (config.get_cancel_query_status()) {
        return;
    }

    auto biter = new_idx_pkey.get<by_idx_pkey>().begin();
    auto eiter = new_idx_pkey.get<by_idx_pkey>().end();

    for (auto iter = biter; iter != eiter; ++iter) {
        t_stpkey s(iter->m_idx, iter->m_pkey);
        m_idxpkey->insert(s);
    }

    mark_zero_desc();
}

void
t_stree::mark_zero_desc() {
    auto zeros = zero_strands();
    std::set<t_uindex> z_desc;

    for (auto z : zeros) {
        auto d = get_descendents(z);
        std::copy(d.begin(), d.end(), std::inserter(z_desc, z_desc.end()));
    }

    for (auto n : z_desc) {
        auto iter = m_nodes->get<by_idx>().find(n);
        auto node = *iter;
        node.set_nstrands(0);
        m_nodes->get<by_idx>().replace(iter, node);
    }
}

void
t_stree::update_aggs_from_static(const t_dtree_ctx& ctx, const t_gstate& gstate, t_config& config) {
    // Set default for saved save mask
    const t_dtree& dtree = ctx.get_tree();
    std::int32_t dt_size = dtree.size();

    const t_table& src_aggtable = ctx.get_aggtable();

    t_agg_update_info agg_update_info;
    t_schema aggschema = m_aggregates->get_schema();

    for (auto colname : aggschema.m_columns) {
        agg_update_info.m_src.push_back(src_aggtable.get_const_column(colname).get());
        agg_update_info.m_dst.push_back(m_aggregates->get_column(colname).get());
        agg_update_info.m_aggspecs.push_back(ctx.get_aggspec(colname));
    }

    auto is_col_scaled_aggregate = [&](int col_idx) -> bool {
        int agg_type = agg_update_info.m_aggspecs[col_idx].agg();

        return agg_type == AGGTYPE_SCALED_DIV || agg_type == AGGTYPE_SCALED_ADD
            || agg_type == AGGTYPE_SCALED_MUL;
    };

    size_t col_cnt = aggschema.m_columns.size();
    auto& cols_topo_sorted = agg_update_info.m_dst_topo_sorted;
    cols_topo_sorted.clear();
    cols_topo_sorted.reserve(col_cnt);

    static bool const enable_aggregate_reordering = true;
    static bool const enable_fix_double_calculation = true;

    std::unordered_set<t_column*> dst_visited;
    auto push_column = [&](size_t idx) {
        if (enable_fix_double_calculation) {
            t_column* dst = agg_update_info.m_dst[idx];
            if (dst_visited.find(dst) != dst_visited.end()) {
                return;
            }
            dst_visited.insert(dst);
        }
        cols_topo_sorted.push_back(idx);
    };

    if (enable_aggregate_reordering) {
        // Move scaled agg columns to the end
        // This does not handle case where scaled aggregate depends on other scaled aggregate
        // ( not sure if that is possible )
        for (size_t i = 0; i < col_cnt; ++i) {
            if (!is_col_scaled_aggregate(i)) {
                push_column(i);
            }
        }
        for (size_t i = 0; i < col_cnt; ++i) {
            if (is_col_scaled_aggregate(i)) {
                push_column(i);
            }
        }
    } else {
        // If backed out, use same column order as before ( not topo sorted )
        for (size_t i = 0; i < col_cnt; ++i) {
            push_column(i);
        }
    }

    std::int32_t idx = 0;
    std::int32_t total = m_tree_unification_records.size();
    std::int32_t percentage = 0;
    std::int32_t prev_percentage = 0;
    for (const auto& r : m_tree_unification_records) {
        if (!node_exists(r.m_sptidx)) {
            continue;
        }

        update_agg_table(
            r.m_sptidx, agg_update_info, r.m_daggidx, r.m_saggidx, r.m_nstrands, gstate, config);

        percentage = idx * 100 / total;
        if (percentage > prev_percentage) {
            prev_percentage = percentage;
            config.update_query_percentage_store(QUERY_PERCENT_UPDATE_AGG, percentage);
        }

        if (config.get_cancel_query_status()) {
            return;
        }

        idx++;
    }

    // Update show nodes
    update_show_nodes(config);

    config.update_query_percentage_store(QUERY_PERCENT_UPDATE_AGG, 100);
}

void
t_stree::update_tree_from_combined_field(const t_dtree_ctx& ctx, t_config& config) {
    /*std::cout << "update_tree_from_combined_field ===== 2" << std::endl;
    auto aggschema = m_aggregates->get_schema();
    for(t_uindex cidx = 0, size = aggschema.size(); cidx < size; ++cidx) {
        auto colname = aggschema.m_columns[cidx];
        std::cout << "==========colname " << colname << std::endl;
        auto col_ = m_aggregates->get_column(colname).get();
        for (t_uindex ridx = 0, rsize = col_->size(); ridx < rsize; ++ridx) {
            auto value = col_->get_scalar(ridx);
            std::cout << "value at " << ridx << " is " << value.to_string() << std::endl;
        }
    }*/

    auto combined_idx = config.get_combined_field().m_combined_index;
    std::shared_ptr<t_treenodes> new_nodes;
    std::map<std::int32_t, std::int32_t> parent_idx_map;
    parent_idx_map[0] = 0;
    for (t_index curidx = 0, tsize = size(); curidx < tsize; ++curidx) {
        auto node = get_node(curidx);
        std::cout << "key at tree index " << curidx << " is " << node.m_sort_value.to_string()
            << " with depth " << node.m_depth << std::endl;
        
        if (combined_idx >= node.m_depth) {
            std::cout << "need to add here ===== " << std::endl;
        }
    }
}

t_mask
t_stree::having_mask(t_config& config, const std::vector<t_fterm>& fterms_, t_uindex level,
    std::map<t_uindex, t_depth> dmap, t_mask cmsk, t_ctx2* ctx2) {
    t_mask hmsk(cmsk.size());

    // Case 1: having mask for context two
    if (ctx2) {
        auto fsize = fterms_.size();
        auto combiner = config.get_combiner();
        for (t_index idx = 0, msize = cmsk.size(); idx < msize; ++idx) {
            if (hmsk.get(idx)) {
                continue;
            }
            // Check current index not have filter or hidden for previous condition
            if (dmap[idx] != level - 1 || !cmsk.get(idx)) {
                hmsk.set(idx, false);
                continue;
            }
            t_stnode_vec tchildren;
            get_child_nodes(idx, tchildren);
            t_index n_changed = tchildren.size();

            std::vector<t_tscalar> aggregates(fsize);
            std::vector<t_index> sortby_agg_indices(fsize);
            std::vector<t_index> subtotal_indices(fsize);
            for (t_index fidx = 0; fidx < fsize; ++fidx) {
                sortby_agg_indices[fidx] = fterms_[fidx].m_filterby_index;
                subtotal_indices[fidx] = fterms_[fidx].m_subtotal_index;
            }

            for (t_stnode_vec::const_iterator iter = tchildren.begin(); iter != tchildren.end();
                ++iter) {
                get_aggregates_for_sorting(
                    iter->m_idx, sortby_agg_indices, aggregates, ctx2, subtotal_indices);
                switch (combiner) {
                case FILTER_OP_AND: {
                    t_tscalar cell_val;
                    bool pass = true;
                    for (t_index cidx = 0; cidx < fsize; ++cidx) {
                        if (!pass)
                            break;
                        const auto& ft = fterms_[cidx];
                        bool tval;

                        cell_val = aggregates[cidx];
                        tval = ft(cell_val);

                        if (!(cell_val.is_valid() || ft.m_op == FILTER_OP_IS_EMPTY) || !tval) {
                            pass = false;
                            break;
                        }
                    }
                    hmsk.set(iter->m_idx, pass);
                } break;
                case FILTER_OP_OR: {
                } break;
                default: { PSP_COMPLAIN_AND_ABORT("Unknown filter op"); } break;
                }
            }
        }
    }
    // Case 2: having mask for context one
    else {
        t_table* tbl = m_aggregates.get();
        t_schema aggschema = m_aggregates->get_schema();
        std::vector<t_fterm> fterms;
        for (const auto& h : fterms_) {
            auto filterby_index = h.m_filterby_index;
            if (filterby_index == -1) {
                continue;
            }
            if (filterby_index >= aggschema.size()) {
                continue;
            }
            t_fterm_recipe frecipe = h.get_recipe();
            frecipe.m_colname = aggschema.m_columns[filterby_index];
            t_fterm nh(frecipe);
            fterms.push_back(nh);
        }

        hmsk = having_table_for_config(*tbl, config, fterms, level, dmap);
    }
    hmsk.set(0, true);

    return hmsk;
}

t_mask
t_stree::limiting_mask(t_sortspec sort, t_uindex level, std::map<t_uindex, t_depth> dmap, t_mask cmsk,
    bool handle_nan_sort, t_ctx2* ctx2) {
    t_mask lmsk(cmsk.size());
    lmsk.set(0, true);
    // Get limit of sort
    t_index slimit = sort.m_limit;
    // Get limit type of sort
    t_limit_type limit_type = sort.m_limit_type;
    for (t_index idx = 0, msize = cmsk.size(); idx < msize; ++idx) {
        // Check current index not have limit or hidden for previous condition
        if (dmap[idx] != level || !cmsk.get(idx)) {
            lmsk.set(idx, cmsk.get(idx));
            continue;
        }
        lmsk.set(idx, true);
        t_stnode_vec tchildren;
        get_child_nodes(idx, tchildren);
        t_index n_changed = tchildren.size();
        // Check num of children for limit
        auto limit = slimit;
        // Get limit of case limit type is percent
        if (limit_type == LIMIT_TYPE_PECENT) {
            limit = std::max(t_index(1), t_index((double)n_changed*(double)slimit/100.0));
        }
        
        if (n_changed <= limit) {
            lmsk.set(idx, cmsk.get(idx));
            continue;
        }
        t_index count = 0;
        std::vector<t_index> sorted_idx(n_changed);

        auto sortelems
            = std::make_shared<std::vector<t_mselem>>(static_cast<size_t>(n_changed));
        std::vector<t_tscalar> aggregates(1);
        std::vector<t_index> sortby_agg_indices(t_index(1));
        sortby_agg_indices[0] = sort.m_sortby_index;
        std::vector<t_index> subtotal_indices(t_index(1));
        subtotal_indices[0] = sort.m_subtotal_index;

        t_uindex child_idx = 0;
        for (t_stnode_vec::const_iterator iter = tchildren.begin(); iter != tchildren.end();
             ++iter) {
            get_aggregates_for_sorting(
                iter->m_idx, sortby_agg_indices, aggregates, ctx2, subtotal_indices);
            (*sortelems)[count] = t_mselem(aggregates, child_idx);
            ++count;
            ++child_idx;
        }

        std::vector<t_sorttype> sort_orders = {sort.m_sort_type};
        t_multisorter sorter(sortelems, sort_orders, handle_nan_sort);
        argsort(sorted_idx, sorter);
        t_index cur_limit = t_index(0);
        t_index next_idx = idx + 1;
        for (t_index sidx = 0; sidx < n_changed; ++sidx) {
            auto curr_idx = tchildren[sorted_idx[sidx]].m_idx;
            next_idx = std::max(next_idx, t_index(curr_idx + 1));
            if (cur_limit < limit && cmsk.get(curr_idx)) {
                lmsk.set(curr_idx, true);
                for (t_index stidx = curr_idx + 1; stidx < msize; ++stidx) {
                    if (dmap[stidx] <= level + 1) {
                        next_idx = std::max(next_idx, stidx);
                        break;
                    }
                    lmsk.set(stidx, cmsk.get(stidx));
                    if (stidx == msize - 1) {
                        next_idx = msize;
                    }
                }
                cur_limit++;
            } else {
                lmsk.set(curr_idx, false);
                for (t_index stidx = curr_idx + 1; stidx < msize; ++stidx) {
                    if (dmap[stidx] <= level + 1) {
                        next_idx = std::max(next_idx, stidx);
                        break;
                    }
                    lmsk.set(stidx, false);
                    if (stidx == msize - 1) {
                        next_idx = msize;
                    }
                }
            }
        }
        idx = next_idx - 1;
    }

    return lmsk;
}

void
t_stree::recalculate_aggs_from_static(const t_dtree_ctx& ctx, t_depth level, std::map<t_uindex,
    t_depth> dmap, t_mask msk, const t_gstate& gstate, t_config& config) {
    const t_table& src_aggtable = ctx.get_aggtable();

    t_agg_update_info agg_update_info;
    t_schema aggschema = m_aggregates->get_schema();

    for (auto colname : aggschema.m_columns) {
        agg_update_info.m_src.push_back(src_aggtable.get_const_column(colname).get());
        agg_update_info.m_dst.push_back(m_aggregates->get_column(colname).get());
        agg_update_info.m_aggspecs.push_back(ctx.get_aggspec(colname));
    }

    auto is_col_scaled_aggregate = [&](int col_idx) -> bool {
        int agg_type = agg_update_info.m_aggspecs[col_idx].agg();

        return agg_type == AGGTYPE_SCALED_DIV || agg_type == AGGTYPE_SCALED_ADD
            || agg_type == AGGTYPE_SCALED_MUL;
    };

    size_t col_cnt = aggschema.m_columns.size();
    auto& cols_topo_sorted = agg_update_info.m_dst_topo_sorted;
    cols_topo_sorted.clear();
    cols_topo_sorted.reserve(col_cnt);

    static bool const enable_aggregate_reordering = true;
    static bool const enable_fix_double_calculation = true;

    std::unordered_set<t_column*> dst_visited;
    auto push_column = [&](size_t idx) {
        if (enable_fix_double_calculation) {
            t_column* dst = agg_update_info.m_dst[idx];
            if (dst_visited.find(dst) != dst_visited.end()) {
                return;
            }
            dst_visited.insert(dst);
        }
        cols_topo_sorted.push_back(idx);
    };

    if (enable_aggregate_reordering) {
        // Move scaled agg columns to the end
        // This does not handle case where scaled aggregate depends on other scaled aggregate
        // ( not sure if that is possible )
        for (size_t i = 0; i < col_cnt; ++i) {
            if (!is_col_scaled_aggregate(i)) {
                push_column(i);
            }
        }
        for (size_t i = 0; i < col_cnt; ++i) {
            if (is_col_scaled_aggregate(i)) {
                push_column(i);
            }
        }
    } else {
        // If backed out, use same column order as before ( not topo sorted )
        for (size_t i = 0; i < col_cnt; ++i) {
            push_column(i);
        }
    }

    for (t_tree_unify_rec_vec::reverse_iterator r = m_tree_unification_records.rbegin();
        r!= m_tree_unification_records.rend(); ++r) {
        if (!node_exists(r->m_sptidx)) {
            continue;
        }

        /*if ((level <= dmap[r->m_sptidx]) || (!msk.get(r->m_sptidx))) {
            continue;
        }*/

        update_agg_table_with_having(
            r->m_sptidx, agg_update_info, r->m_daggidx, r->m_saggidx, r->m_nstrands, msk, level, dmap, gstate, config);
    }
}

void
t_stree::update_limiting_having_tree(const t_dtree_ctx& ctx, const t_gstate& gstate, t_config& config,
    const std::vector<t_sortspec>& ctx_sortby, const std::vector<t_fterm>& ctx_fterms, t_ctx2* ctx2) {
    const t_dtree& dtree = ctx.get_tree();
    std::int32_t dt_size = dtree.size();
    
    // Create depth map
    std::int32_t tridx = 0;
    std::map<t_uindex, t_depth> dmap;
    for (auto dptidx : dtree.dfs()) {
        dmap[tridx] = dtree.get_depth(dptidx);
        tridx++;
    }

    // Set default for current mask and saved mask
    t_mask cmsk(dt_size);
    for (t_uindex idx = 0; idx < dt_size; ++idx) {
        cmsk.set(idx, true);
    }

    // Get sort map
    std::map<t_depth, t_sortspec> sort_map;
    for (const auto& s : ctx_sortby) {
        if (s.m_limit != t_index(-1)) {
            sort_map[s.m_agg_index] = s;
        }
    }

    // Get having map
    std::map<t_depth, std::vector<t_fterm>> having_map;
    for (const auto& h : ctx_fterms) {
        if (having_map.find(h.m_level) == having_map.end()) {
            having_map[h.m_level] = {h};
        } else {
            having_map[h.m_level].push_back(h);
        }
    }

    for (t_index level = dtree.last_level(); level >= 0; --level) {
        // Check have limit at level
        auto sit = sort_map.find(level);
        if (sit != sort_map.end()) {
            auto s = sit->second;
            //t_index limit = s.m_limit;
            t_mask lmsk = limiting_mask(s, level, dmap, cmsk, config.handle_nan_sort(), ctx2);

            // Update current mask for limiting
            for (t_uindex midx = 0; midx < dt_size; ++midx) {
                if (lmsk.get(midx) && cmsk.get(midx)) {
                    cmsk.set(midx, true);
                } else {
                    cmsk.set(midx, false);
                }
            }

            // Recalculate parent node for limiting
            recalculate_aggs_from_static(ctx, level + 1, dmap, cmsk, gstate, config);
        }

        // Check having at level
        auto hit = having_map.find(level);
        if (hit == having_map.end() || level == 0) {
            continue;
        }
        auto hterms = hit->second;

        // Filter for each level
        t_mask msk = having_mask(config, hterms, level, dmap, cmsk, ctx2);

        // Get mask for tree
        tridx = 0;
        std::map<t_uindex, t_uindex> pmap;
        pmap[0] = 0;
        t_mask tmsk(dt_size);
        for (auto dptidx : dtree.dfs()) {
            t_depth ndepth = dtree.get_depth(dptidx);
            if (dptidx == 0) {
                tmsk.set(tridx, msk.get(tridx));
                tridx++;
                continue;
            }
            t_uindex p_dptidx = dtree.get_parent(dptidx);
            t_uindex p_sptidx = pmap[p_dptidx];
            bool show = msk.get(tridx);
            if (show) {
                tmsk.set(p_sptidx, show);
                tmsk.set(tridx, show);
            } else if (level < ndepth) {
                if (msk.get(p_sptidx) && p_sptidx != 0) {
                    tmsk.set(tridx, true);
                }
            }
            pmap[dptidx] = tridx;
            tridx++;
        }

        // Update current mask
        for (t_uindex midx = 0; midx < dt_size; ++midx) {
            if (tmsk.get(midx) && cmsk.get(midx)) {
                cmsk.set(midx, true);
            } else {
                cmsk.set(midx, false);
            }
        }

        // Recalculate parent node
        recalculate_aggs_from_static(ctx, level, dmap, cmsk, gstate, config);
    }

    // Save a mask for limit
    update_saved_mask_for_leave(cmsk);

    // Update show nodes
    update_show_nodes(config);

    // Update m_aggcols for sorting
    m_aggcols = std::vector<const t_column*>(m_aggregates->get_schema().size());

    for (t_uindex idx = 0, loop_end = m_aggregates->get_schema().size(); idx < loop_end; ++idx) {
        m_aggcols[idx] = m_aggregates->get_const_column(idx).get();
    }
}

t_uindex
t_stree::genidx() {
    return m_curidx++;
}

std::vector<t_uindex>
t_stree::get_children(t_uindex idx) const {
    t_by_pidx_ipair iterators = m_nodes->get<by_pidx>().equal_range(idx);

    t_uindex nchild = std::distance(iterators.first, iterators.second);

    std::vector<t_uindex> temp(nchild);

    t_index count = 0;
    for (iter_by_pidx iter = iterators.first; iter != iterators.second; ++iter) {
        temp[count] = iter->m_idx;
        ++count;
    }
    return temp;
}

t_uindex
t_stree::size() const {
    return m_nodes->size();
}

void
t_stree::get_child_nodes(t_uindex idx, t_tnodevec& nodes) const {
    t_index num_children = get_num_children(idx);
    t_tnodevec temp(num_children);
    auto iterators = m_nodes->get<by_pidx>().equal_range(idx);
    std::copy(iterators.first, iterators.second, temp.begin());
    std::swap(nodes, temp);
}

t_uindex
t_stree::get_num_children(t_uindex ptidx) const {
    auto iterators = m_nodes->get<by_pidx>().equal_range(ptidx);
    return std::distance(iterators.first, iterators.second);
}

t_uindex
t_stree::gen_aggidx() {
    if (!m_agg_freelist.empty()) {
        t_uindex rval = m_agg_freelist.back();
        m_agg_freelist.pop_back();
        return rval;
    }

    t_uindex cur_cap = m_aggregates->size();
    t_uindex rval = m_cur_aggidx;
    ++m_cur_aggidx;
    if (rval >= cur_cap) {
        double nrows = ceil(.3 * double(rval));
        m_aggregates->extend(static_cast<t_uindex>(nrows));
    }

    return rval;
}

void
t_stree::update_agg_table(t_uindex nidx, t_agg_update_info& info, t_uindex src_ridx,
    t_uindex dst_ridx, t_index nstrands, const t_gstate& gstate, const t_config& config) {
    static bool const enable_sticky_nan_fix = true;
    std::vector<t_uindex> computed_cols_index;
    std::map<std::string, t_tscalar> col_scalar_map;
    auto has_previous_filters = config.has_previous_filters();
    for (t_uindex idx : info.m_dst_topo_sorted) {
        const t_column* src = info.m_src[idx];
        t_column* dst = info.m_dst[idx];
        const t_aggspec& spec = info.m_aggspecs[idx];
        t_tscalar new_value = mknone();
        t_tscalar old_value = mknone();
        auto period_type = PERIOD_TYPE_NONE;
        if (has_previous_filters) {
            period_type = config.get_period_type(spec.get_dependencies()[0].name());
        }

        switch (spec.agg()) {
            case AGGTYPE_PCT_SUM_PARENT:
            case AGGTYPE_PCT_SUM_GRAND_TOTAL:
            case AGGTYPE_SUM: {
                /*t_tscalar src_scalar = src->get_scalar(src_ridx);
                t_tscalar dst_scalar = dst->get_scalar(dst_ridx);
                old_value.set(dst_scalar);
                new_value.set(dst_scalar.add(src_scalar));
                if (enable_sticky_nan_fix
                    && old_value.is_nan()) // is_nan returns false for non-float types
                {*/
                    // if we previously had a NaN, add can't make it finite again; recalculate
                    // entire sum in case it is now finite
                    //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    std::vector<double> values;

                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    gstate.read_column(tbl_colname, pkeys, values);
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    if (agg_col_name_type.m_type == DTYPE_INT64) {
                        new_value.set(std::int64_t(std::accumulate(values.begin(), values.end(), double(0))));
                    } else {
                        new_value.set(std::accumulate(values.begin(), values.end(), double(0)));
                    }
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                //}
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_COUNT: {
                /*if (nidx == 0) {
                    new_value.set(nstrands - 1);
                } else {
                    new_value.set(nstrands);
                }*/
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);
                if (pkeys.size() > 0) {
                    new_value.set(t_index(pkeys.size()));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_MEAN: {
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    std::vector<double> values;

                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
                    gstate.read_column(tbl_colname, pkeys, values, false);

                    auto nr = std::accumulate(values.begin(), values.end(), double(0));
                    double dr = values.size();

                    std::pair<double, double>* dst_pair
                        = dst->get_nth<std::pair<double, double>>(dst_ridx);

                    old_value.set(dst_pair->first / dst_pair->second);

                    dst_pair->first = nr;
                    dst_pair->second = dr;

                    dst->set_valid(dst_ridx, true);

                    new_value.set(nr / dr);
                } else {
                    dst->set_valid(dst_ridx, false);
                }
            } break;
            case AGGTYPE_WEIGHTED_MEAN: {
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    double nr = 0;
                    double dr = 0;
                    std::vector<t_tscalar> values;
                    std::vector<t_tscalar> weights;

                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname_0 = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
                    gstate.read_column(tbl_colname_0, pkeys, values);
                    const std::string& tbl_colname_1 = m_schema.get_tbl_colname(spec.get_dependencies()[1].name());
                    gstate.read_column(tbl_colname_1, pkeys, weights);

                    auto weights_it = weights.begin();
                    auto values_it = values.begin();

                    for (; weights_it != weights.end() && values_it != values.end();
                        ++weights_it, ++values_it) {
                        if (weights_it->is_valid() && values_it->is_valid() && !weights_it->is_nan()
                            && !values_it->is_nan()) {
                            nr += weights_it->to_double() * values_it->to_double();
                            dr += weights_it->to_double();
                        }
                    }

                    std::pair<double, double>* dst_pair
                        = dst->get_nth<std::pair<double, double>>(dst_ridx);
                    old_value.set(dst_pair->first / dst_pair->second);

                    dst_pair->first = nr;
                    dst_pair->second = dr;

                    bool valid = (dr != 0);
                    dst->set_valid(dst_ridx, valid);
                    new_value.set(nr / dr);
                } else {
                    dst->set_valid(dst_ridx, false);
                }
            } break;
            case AGGTYPE_UNIQUE: {
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);
                old_value.set(dst->get_scalar(dst_ridx));

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
                    bool is_unique
                        = (pkeys.size() == 0) ? false : gstate.is_unique(pkeys, tbl_colname, new_value);

                    if (new_value.m_type == DTYPE_STR) {
                        if (is_unique) {
                            new_value = m_symtable.get_interned_tscalar(new_value);
                        } else {
                            new_value = m_symtable.get_interned_tscalar("-");
                        }
                        dst->set_scalar(dst_ridx, new_value);
                    } else {
                        if (is_unique) {
                            dst->set_scalar(dst_ridx, new_value);
                        } else {
                            dst->set_valid(dst_ridx, false);
                            new_value = old_value;
                        }
                    }
                } else {
                    dst->set_valid(dst_ridx, false);
                }
            } break;
            case AGGTYPE_OR:
            case AGGTYPE_ANY: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
                    gstate.apply(pkeys, tbl_colname, new_value,
                        [](const t_tscalar& row_value, t_tscalar& output) {
                            if (row_value) {
                                output.set(row_value);
                                return true;
                            } else {
                                output.set(row_value);
                                return false;
                            }
                        });
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_MEDIAN: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                if (values.size() == 0) {
                                    return t_tscalar();
                                } else if (values.size() == 1) {
                                    return values[0];
                                } else {
                                    std::vector<t_tscalar>::iterator middle
                                        = values.begin() + (values.size() / 2);

                                    std::nth_element(values.begin(), middle, values.end());

                                    return *middle;
                                }
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_JOIN: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(
                        pkeys, tbl_colname,
                        [this](std::vector<t_tscalar>& values) {
                            std::set<t_tscalar> vset;
                            for (const auto& v : values) {
                                vset.insert(v);
                            }

                            std::stringstream ss;
                            for (std::set<t_tscalar>::const_iterator iter = vset.begin();
                                iter != vset.end(); ++iter) {
                                ss << *iter << ", ";
                            }
                            return m_symtable.get_interned_tscalar(ss.str().c_str());
                        }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_SCALED_DIV: {
                const t_column* src_1 = info.m_dst[spec.get_agg_one_idx()];
                const t_column* src_2 = info.m_dst[spec.get_agg_two_idx()];

                t_column* dst = info.m_dst[idx];
                old_value.set(dst->get_scalar(dst_ridx));

                double agg1 = src_1->get_scalar(dst_ridx).to_double();
                double agg2 = src_2->get_scalar(dst_ridx).to_double();

                double w1 = spec.get_agg_one_weight();
                double w2 = spec.get_agg_two_weight();

                double v = (agg1 * w1) / (agg2 * w2);

                new_value.set(v);
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_SCALED_ADD: {

                const t_column* src_1 = info.m_dst[spec.get_agg_one_idx()];
                const t_column* src_2 = info.m_dst[spec.get_agg_two_idx()];

                t_column* dst = info.m_dst[idx];
                old_value.set(dst->get_scalar(dst_ridx));

                double v = (src_1->get_scalar(dst_ridx).to_double() * spec.get_agg_one_weight())
                    + (src_2->get_scalar(dst_ridx).to_double() * spec.get_agg_two_weight());

                new_value.set(v);
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_SCALED_MUL: {
                const t_column* src_1 = info.m_dst[spec.get_agg_one_idx()];
                const t_column* src_2 = info.m_dst[spec.get_agg_two_idx()];

                t_column* dst = info.m_dst[idx];
                old_value.set(dst->get_scalar(dst_ridx));

                double v = (src_1->get_scalar(dst_ridx).to_double() * spec.get_agg_one_weight())
                    * (src_2->get_scalar(dst_ridx).to_double() * spec.get_agg_two_weight());

                new_value.set(v);
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_DOMINANT: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(
                        pkeys, tbl_colname,
                        [](std::vector<t_tscalar>& values) { return get_dominant(values); }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_FIRST:
            case AGGTYPE_LAST: {
                old_value.set(dst->get_scalar(dst_ridx));
                new_value.set(first_last_helper(nidx, spec, gstate, has_previous_filters, period_type));
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_AND: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                t_tscalar rval;
                                rval.set(true);

                                for (const auto& v : values) {
                                    if (!v) {
                                        rval.set(false);
                                        break;
                                    }
                                }
                                return rval;
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_LAST_VALUE: {
                t_tscalar src_scalar = src->get_scalar(src_ridx);
                t_tscalar dst_scalar = dst->get_scalar(dst_ridx);

                old_value.set(dst_scalar);
                new_value.set(src_scalar);

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_HIGH_WATER_MARK: {
                t_tscalar src_scalar = src->get_scalar(src_ridx);
                t_tscalar dst_scalar = dst->get_scalar(dst_ridx);

                old_value.set(dst_scalar);
                new_value.set(src_scalar);

                if (dst_scalar.is_valid()) {
                    new_value.set(std::max(dst_scalar, src_scalar));
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_LOW_WATER_MARK: {
                t_tscalar src_scalar = src->get_scalar(src_ridx);
                t_tscalar dst_scalar = dst->get_scalar(dst_ridx);

                old_value.set(dst_scalar);
                new_value.set(src_scalar);

                if (dst_scalar.is_valid()) {
                    new_value.set(std::min(dst_scalar, src_scalar));
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_UDF_COMBINER:
            case AGGTYPE_UDF_REDUCER: {
                // these will be filled in later
            } break;
            case AGGTYPE_SUM_NOT_NULL: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                if (values.empty()) {
                                    return mknone();
                                }

                                t_tscalar rval;
                                rval.set(std::uint64_t(0));
                                rval.m_type = values[0].m_type;
                                for (const auto& v : values) {
                                    if (v.is_nan())
                                        continue;
                                    rval = rval.add(v);
                                }
                                return rval;
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_SUM_ABS: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                if (values.empty()) {
                                    return mknone();
                                }

                                t_tscalar rval;
                                rval.set(std::uint64_t(0));
                                rval.m_type = values[0].m_type;
                                for (const auto& v : values) {
                                    rval = rval.add(v.abs());
                                }
                                return rval;
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_MUL: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                if (values.size() == 0) {
                                    return t_tscalar();
                                } else if (values.size() == 1) {
                                    return values[0];
                                } else {
                                    t_tscalar v = values[0];
                                    for (t_uindex vidx = 1, vloop_end = values.size();
                                        vidx < vloop_end; ++vidx) {
                                        v = v.mul(values[vidx]);
                                    }
                                    return v;
                                }
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_DISTINCT_COUNT: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<std::uint32_t(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                std::unordered_set<t_tscalar> vset;
                                for (const auto& v : values) {
                                    vset.insert(v);
                                }
                                std::uint32_t rv = vset.size();
                                return rv;
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_DISTINCT_LEAF: {
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);
                old_value.set(dst->get_scalar(dst_ridx));
                bool skip = false;

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    bool is_unique
                        = (pkeys.size() == 0) ? false : gstate.is_unique(pkeys, tbl_colname, new_value);

                    if (is_leaf(nidx) && is_unique) {
                        if (new_value.m_type == DTYPE_STR) {
                            new_value = m_symtable.get_interned_tscalar(new_value);
                        }
                    } else {
                        if (new_value.m_type == DTYPE_STR) {
                            new_value = m_symtable.get_interned_tscalar("");
                        } else {
                            dst->set_valid(dst_ridx, false);
                            new_value = old_value;
                            skip = true;
                        }
                    }
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                if (!skip)
                    dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_CUSTOM: {
                computed_cols_index.push_back(idx);
            } break;
            case AGGTYPE_DISTINCT_VALUES: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);
                t_uindex is_oversize = 0;

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    auto value_pair = gstate.reduce<std::function<std::pair<t_uindex, std::set<t_tscalar>>(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                std::set<t_tscalar> vset;
                                t_uindex oversize = 0;
                                t_uindex set_in_byte = 0;
                                t_uindex str_size = sizeof(t_uindex);
                                for (const auto& v : values) {
                                    // distinct values exit at first 1000 values
                                    if (vset.size() >= 1000) {
                                        oversize = 1;
                                        break;
                                    }
                                    if (v.is_valid()) {
                                        auto size_before = vset.size();
                                        vset.insert(v);
                                        if (size_before != vset.size() && v.m_type == DTYPE_STR) {
                                            set_in_byte += v.to_string().size() * str_size;
                                            if (set_in_byte >= 2 * 1024 * 1024) {
                                                oversize = 2;
                                                break;
                                            }
                                        }
                                    }
                                }
                                return std::pair<t_uindex, std::set<t_tscalar>>(oversize, vset);
                            });

                    is_oversize = value_pair.first;
                    new_value.set_list(value_pair.second, dst->get_dtype());
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
                if (is_oversize > 0) {
                    auto current_truncated = dst->get_truncated();
                    t_warning_type new_truncated = current_truncated;
                    if (is_oversize == 1) {
                        if (current_truncated == WARNING_TYPE_LIMITED_SIZE || current_truncated == WARNING_TYPE_LIMITED_BOTH) {
                            new_truncated = WARNING_TYPE_LIMITED_BOTH;
                        } else {
                            new_truncated = WARNING_TYPE_LIMITED_VALUES;
                        }
                    } else {
                        if (current_truncated == WARNING_TYPE_LIMITED_VALUES || current_truncated == WARNING_TYPE_LIMITED_BOTH) {
                            new_truncated = WARNING_TYPE_LIMITED_BOTH;
                        } else {
                            new_truncated = WARNING_TYPE_LIMITED_SIZE;
                        }
                    }
                    dst->set_warning_status(dst_ridx);
                    dst->set_truncated(new_truncated);
                }
            } break;
            default: { PSP_COMPLAIN_AND_ABORT("Not implemented"); }
        } // end switch

        // store value for computed col
        col_scalar_map[spec.name()] = mktscalar(new_value);

        bool val_neq = old_value != new_value;

        m_has_delta = m_has_delta || val_neq;
        bool deltas_enabled = m_features.at(CTX_FEAT_DELTA);
        if (deltas_enabled && val_neq) {
            m_deltas->insert(t_tcdelta(nidx, idx, old_value, new_value));
        }

    } // end for

std::cout << "computed specs----------" << std::endl;
    // update computed value
    for (t_uindex idx = 0, loop_end = computed_cols_index.size(); idx < loop_end; ++idx) {
        t_uindex cidx = computed_cols_index[idx];
        const t_column* src = info.m_src[cidx];
        t_column* dst = info.m_dst[cidx];
        const t_aggspec& spec = info.m_aggspecs[cidx];
        std::vector<t_computedspec> computedspecs = config.get_computedspecs();
        const auto iter = std::find(computedspecs.begin(), computedspecs.end(), t_computedspec(spec.name(), {}));
        if (iter != computedspecs.end()) {
            t_calculation calculation(computedspecs[std::distance(computedspecs.begin(), iter)].get_formulaspec());
            switch (spec.agg()) {
                case AGGTYPE_CUSTOM: {
                    dst->set_scalar(dst_ridx, calculation.get_formula_result(col_scalar_map));
                } break;
                default: { PSP_COMPLAIN_AND_ABORT("Not implemented"); }
            }
        } else {
            PSP_COMPLAIN_AND_ABORT("Computed func not found");
        }
    }
}

void
t_stree::update_agg_table_with_having(t_uindex nidx, t_agg_update_info& info, t_uindex src_ridx,
    t_uindex dst_ridx, t_index nstrands, t_mask msk, t_depth level, std::map<t_uindex, t_depth> dmap,
    const t_gstate& gstate, const t_config& config) {

    std::vector<t_uindex> computed_cols_index;
    std::map<std::string, t_tscalar> col_scalar_map;
    auto has_previous_filters = config.has_previous_filters();

    // Get pkeys for parent node
    auto children = get_child_idx(nidx);
    std::function<std::set<t_tscalar>(t_uindex, t_period_type)> get_current_pkeys;
    get_current_pkeys = [&get_current_pkeys, this, msk, has_previous_filters](t_uindex idx, t_period_type period_type) {
        if (!msk.get(idx)) {
            return std::set<t_tscalar>();
        }
        std::set<t_tscalar> s_pkeys;
        //if (level <= dmap[idx]) {
        if (this->is_leaf(idx)) {
            //auto pkeys = this->get_pkeys(idx);
            auto pkeys = this->get_show_pkeys(idx, has_previous_filters, period_type);
            for (auto& key: pkeys) {
                s_pkeys.insert(key);
            }
            return s_pkeys;
        }
        auto sub_children = this->get_child_idx(idx);
        for (t_uindex cidx = 0, cnum = sub_children.size(); cidx < cnum; ++cidx) {
            auto s = get_current_pkeys(sub_children[cidx], period_type);
            for (auto key = s.begin(); key != s.end(); ++key) {
                s_pkeys.insert(*key);
            }
        }
        return s_pkeys;
    };
    for (t_uindex idx : info.m_dst_topo_sorted) {
        const t_column* src = info.m_src[idx];
        t_column* dst = info.m_dst[idx];
        const t_aggspec& spec = info.m_aggspecs[idx];
        t_tscalar new_value = mknone();
        t_tscalar old_value = mknone();
        t_period_type period_type = PERIOD_TYPE_NONE;
        if (has_previous_filters) {
            period_type = config.get_period_type(spec.get_dependencies()[0].name());
        }

        switch (spec.agg()) {
            /*case AGGTYPE_PCT_SUM_PARENT:
            case AGGTYPE_PCT_SUM_GRAND_TOTAL:
            case AGGTYPE_SUM:
            case AGGTYPE_SUM_NOT_NULL:
            case AGGTYPE_SUM_ABS:
            case AGGTYPE_COUNT: {
                std::vector<double> values;
                for (t_uindex cidx = 0, cnum = children.size(); cidx < cnum; ++cidx) {
                    if (msk.get(children[cidx])) {
                        auto value = dst->get_scalar(children[cidx]).to_double();
                        values.push_back(value);
                    }
                }
                auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                if (agg_col_name_type.m_type == DTYPE_INT64) {
                    new_value.set(std::int64_t(std::accumulate(values.begin(), values.end(), double(0))));
                } else {
                    new_value.set(std::accumulate(values.begin(), values.end(), double(0)));
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;*/
            case AGGTYPE_PCT_SUM_PARENT:
            case AGGTYPE_PCT_SUM_GRAND_TOTAL:
            case AGGTYPE_SUM: {
                /*t_tscalar src_scalar = src->get_scalar(src_ridx);
                t_tscalar dst_scalar = dst->get_scalar(dst_ridx);
                old_value.set(dst_scalar);
                new_value.set(dst_scalar.add(src_scalar));*/
                //auto pkeys = get_pkeys(nidx);
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());
                if (pkeys.size() > 0) {
                    std::vector<double> values;

                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    gstate.read_column(tbl_colname, pkeys, values);
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    if (agg_col_name_type.m_type == DTYPE_INT64) {
                        new_value.set(std::int64_t(std::accumulate(values.begin(), values.end(), double(0))));
                    } else {
                        new_value.set(std::accumulate(values.begin(), values.end(), double(0)));
                    }
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_COUNT: {
                /*if (nidx == 0) {
                    new_value.set(nstrands - 1);
                } else {
                    new_value.set(nstrands);
                }*/
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                if (pkeys_set.size() > 0) {
                    new_value.set(t_index(pkeys_set.size()));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_MEAN: {
                std::vector<double> values;
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
                    gstate.read_column(tbl_colname, pkeys, values, false);

                    auto nr = std::accumulate(values.begin(), values.end(), double(0));
                    double dr = values.size();

                    std::pair<double, double>* dst_pair
                        = dst->get_nth<std::pair<double, double>>(dst_ridx);

                    old_value.set(dst_pair->first / dst_pair->second);

                    dst_pair->first = nr;
                    dst_pair->second = dr;

                    dst->set_valid(dst_ridx, true);

                    new_value.set(nr / dr);
                } else {
                    dst->set_valid(dst_ridx, false);
                }
            } break;
            case AGGTYPE_WEIGHTED_MEAN: {
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    double nr = 0;
                    double dr = 0;
                    std::vector<t_tscalar> values;
                    std::vector<t_tscalar> weights;

                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname_0 = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
                    gstate.read_column(tbl_colname_0, pkeys, values);
                    const std::string& tbl_colname_1 = m_schema.get_tbl_colname(spec.get_dependencies()[1].name());
                    gstate.read_column(tbl_colname_1, pkeys, weights);

                    auto weights_it = weights.begin();
                    auto values_it = values.begin();

                    for (; weights_it != weights.end() && values_it != values.end();
                        ++weights_it, ++values_it) {
                        if (weights_it->is_valid() && values_it->is_valid() && !weights_it->is_nan()
                            && !values_it->is_nan()) {
                            nr += weights_it->to_double() * values_it->to_double();
                            dr += weights_it->to_double();
                        }
                    }

                    std::pair<double, double>* dst_pair
                        = dst->get_nth<std::pair<double, double>>(dst_ridx);
                    old_value.set(dst_pair->first / dst_pair->second);

                    dst_pair->first = nr;
                    dst_pair->second = dr;

                    bool valid = (dr != 0);
                    dst->set_valid(dst_ridx, valid);
                    new_value.set(nr / dr);
                } else {
                    dst->set_valid(dst_ridx, false);
                }
            } break;
            case AGGTYPE_UNIQUE: {
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());
                if (pkeys.size() > 0) {
                    old_value.set(dst->get_scalar(dst_ridx));
                    
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
                    bool is_unique
                        = (pkeys.size() == 0) ? false : gstate.is_unique(pkeys, tbl_colname, new_value);

                    if (new_value.m_type == DTYPE_STR) {
                        if (is_unique) {
                            new_value = m_symtable.get_interned_tscalar(new_value);
                        } else {
                            new_value = m_symtable.get_interned_tscalar("-");
                        }
                        dst->set_scalar(dst_ridx, new_value);
                    } else {
                        if (is_unique) {
                            dst->set_scalar(dst_ridx, new_value);
                        } else {
                            dst->set_valid(dst_ridx, false);
                            new_value = old_value;
                        }
                    }
                } else {
                    dst->set_valid(dst_ridx, false);
                }
            } break;
            case AGGTYPE_OR:
            case AGGTYPE_ANY: {
                old_value.set(dst->get_scalar(dst_ridx));
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
                    gstate.apply(pkeys, tbl_colname, new_value,
                        [](const t_tscalar& row_value, t_tscalar& output) {
                            if (row_value) {
                                output.set(row_value);
                                return true;
                            } else {
                                output.set(row_value);
                                return false;
                            }
                        });
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_MEDIAN: {
                old_value.set(dst->get_scalar(dst_ridx));
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                if (values.size() == 0) {
                                    return t_tscalar();
                                } else if (values.size() == 1) {
                                    return values[0];
                                } else {
                                    std::vector<t_tscalar>::iterator middle
                                        = values.begin() + (values.size() / 2);

                                    std::nth_element(values.begin(), middle, values.end());

                                    return *middle;
                                }
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_JOIN: {
                old_value.set(dst->get_scalar(dst_ridx));
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());
                
                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(
                        pkeys, tbl_colname,
                        [this](std::vector<t_tscalar>& values) {
                            std::set<t_tscalar> vset;
                            for (const auto& v : values) {
                                vset.insert(v);
                            }

                            std::stringstream ss;
                            for (std::set<t_tscalar>::const_iterator iter = vset.begin();
                                iter != vset.end(); ++iter) {
                                ss << *iter << ", ";
                            }
                            return m_symtable.get_interned_tscalar(ss.str().c_str());
                        }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_SCALED_DIV: {
                PSP_COMPLAIN_AND_ABORT("Not implemented");
            } break;
            case AGGTYPE_SCALED_ADD: {
                PSP_COMPLAIN_AND_ABORT("Not implemented");
            } break;
            case AGGTYPE_SCALED_MUL: {
                PSP_COMPLAIN_AND_ABORT("Not implemented");
            } break;
            case AGGTYPE_DOMINANT: {
                old_value.set(dst->get_scalar(dst_ridx));
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(
                        pkeys, tbl_colname,
                        [](std::vector<t_tscalar>& values) { return get_dominant(values); }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_FIRST:
            case AGGTYPE_LAST: {
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    old_value.set(dst->get_scalar(dst_ridx));
                    new_value.set(first_last_helper_with_pkeys(nidx, spec, gstate, pkeys));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_AND: {
                old_value.set(dst->get_scalar(dst_ridx));
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                t_tscalar rval;
                                rval.set(true);

                                for (const auto& v : values) {
                                    if (!v) {
                                        rval.set(false);
                                        break;
                                    }
                                }
                                return rval;
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_LAST_VALUE: {
                for (t_uindex cidx = children.size() - 1, cnum = children.size(); cidx >= 0; --cidx) {
                    if (msk.get(children[cidx])) {
                        auto value = dst->get_pivot_scalar(children[cidx]);
                        new_value.set(value);
                        break;
                    }
                }
                if (!new_value.is_none()) {
                    dst->set_scalar(dst_ridx, new_value);
                }
            } break;
            case AGGTYPE_HIGH_WATER_MARK: {
                for (t_uindex cidx = 0, cnum = children.size(); cidx < cnum; ++cidx) {
                    if (msk.get(children[cidx])) {
                        auto value = dst->get_scalar(children[cidx]);
                        if (new_value.is_none() || new_value < value) {
                            new_value.set(value);
                        }
                    }
                }
                if (!new_value.is_none()) {
                    dst->set_scalar(dst_ridx, new_value);
                }
            } break;
            case AGGTYPE_LOW_WATER_MARK: {
                for (t_uindex cidx = 0, cnum = children.size(); cidx < cnum; ++cidx) {
                    if (msk.get(children[cidx])) {
                        auto value = dst->get_scalar(children[cidx]);
                        if (new_value.is_none() || new_value > value) {
                            new_value.set(value);
                        }
                    }
                }
                if (!new_value.is_none()) {
                    dst->set_scalar(dst_ridx, new_value);
                }
            } break;
            case AGGTYPE_UDF_COMBINER:
            case AGGTYPE_UDF_REDUCER: {
                // these will be filled in later
            } break;
            case AGGTYPE_SUM_NOT_NULL: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                if (values.empty()) {
                                    return mknone();
                                }

                                t_tscalar rval;
                                rval.set(std::uint64_t(0));
                                rval.m_type = values[0].m_type;
                                for (const auto& v : values) {
                                    if (v.is_nan())
                                        continue;
                                    rval = rval.add(v);
                                }
                                return rval;
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_SUM_ABS: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                if (values.empty()) {
                                    return mknone();
                                }

                                t_tscalar rval;
                                rval.set(std::uint64_t(0));
                                rval.m_type = values[0].m_type;
                                for (const auto& v : values) {
                                    rval = rval.add(v.abs());
                                }
                                return rval;
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_MUL: {
                old_value.set(dst->get_scalar(dst_ridx));
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<t_tscalar(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                if (values.size() == 0) {
                                    return t_tscalar();
                                } else if (values.size() == 1) {
                                    return values[0];
                                } else {
                                    t_tscalar v = values[0];
                                    for (t_uindex vidx = 1, vloop_end = values.size();
                                        vidx < vloop_end; ++vidx) {
                                        v = v.mul(values[vidx]);
                                    }
                                    return v;
                                }
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_DISTINCT_COUNT: {
                old_value.set(dst->get_scalar(dst_ridx));
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    new_value.set(
                        gstate.reduce<std::function<std::uint32_t(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                std::unordered_set<t_tscalar> vset;
                                for (const auto& v : values) {
                                    vset.insert(v);
                                }
                                std::uint32_t rv = vset.size();
                                return rv;
                            }));
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_DISTINCT_LEAF: {
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());
                old_value.set(dst->get_scalar(dst_ridx));
                bool skip = false;

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    bool is_unique
                        = (pkeys.size() == 0) ? false : gstate.is_unique(pkeys, tbl_colname, new_value);

                    if (is_leaf(nidx) && is_unique) {
                        if (new_value.m_type == DTYPE_STR) {
                            new_value = m_symtable.get_interned_tscalar(new_value);
                        }
                    } else {
                        if (new_value.m_type == DTYPE_STR) {
                            new_value = m_symtable.get_interned_tscalar("");
                        } else {
                            dst->set_valid(dst_ridx, false);
                            new_value = old_value;
                            skip = true;
                        }
                    }
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }
                if (!skip)
                    dst->set_scalar(dst_ridx, new_value);
            } break;
            case AGGTYPE_CUSTOM: {
                computed_cols_index.push_back(idx);
            } break;
            case AGGTYPE_DISTINCT_VALUES: {
                old_value.set(dst->get_scalar(dst_ridx));
                //auto pkeys = get_pkeys(nidx);
                auto pkeys_set = get_current_pkeys(nidx, period_type);
                std::vector<t_tscalar> pkeys(pkeys_set.begin(), pkeys_set.end());
                t_uindex is_oversize = 0;

                if (pkeys.size() > 0) {
                    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
                    const std::string& tbl_colname = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());

                    auto value_pair = gstate.reduce<std::function<std::pair<t_uindex, std::set<t_tscalar>>(std::vector<t_tscalar>&)>>(pkeys,
                            tbl_colname, [](std::vector<t_tscalar>& values) {
                                std::set<t_tscalar> vset;
                                t_uindex oversize = 0;
                                t_uindex set_in_byte = 0;
                                t_uindex str_size = sizeof(t_uindex);
                                for (const auto& v : values) {
                                    // distinct values exit at first 1000 values
                                    if (vset.size() >= 1000) {
                                        oversize = 1;
                                        break;
                                    }
                                    if (v.is_valid()) {
                                        auto size_before = vset.size();
                                        vset.insert(v);
                                        if (size_before != vset.size() && v.m_type == DTYPE_STR) {
                                            set_in_byte += v.to_string().size() * str_size;
                                            if (set_in_byte >= 2 * 1024 * 1024) {
                                                oversize = 2;
                                                break;
                                            }
                                        }
                                    }
                                }
                                return std::pair<t_uindex, std::set<t_tscalar>>(oversize, vset);
                            });

                    is_oversize = value_pair.first;
                    new_value.set_list(value_pair.second, dst->get_dtype());
                } else {
                    auto agg_col_name_type = spec.get_output_specs(m_schema)[0];
                    new_value = mknull(agg_col_name_type.m_type);
                }

                dst->set_scalar(dst_ridx, new_value);
                if (is_oversize > 0) {
                    dst->set_warning_status(dst_ridx);
                    dst->set_truncated(is_oversize == 1 ? WARNING_TYPE_LIMITED_VALUES : WARNING_TYPE_LIMITED_SIZE);
                }
            } break;
            default: { PSP_COMPLAIN_AND_ABORT("Not implemented"); } break;
        }

        // store value for computed col
        col_scalar_map[spec.name()] = mktscalar(new_value);
    }

std::cout << "computed specs-----2-----" << std::endl;
    // update computed value
    for (t_uindex idx = 0, loop_end = computed_cols_index.size(); idx < loop_end; ++idx) {
        t_uindex cidx = computed_cols_index[idx];
        const t_column* src = info.m_src[cidx];
        t_column* dst = info.m_dst[cidx];
        const t_aggspec& spec = info.m_aggspecs[cidx];
        std::vector<t_computedspec> computedspecs = config.get_computedspecs();
        const auto iter = std::find(computedspecs.begin(), computedspecs.end(), t_computedspec(spec.name(), {}));
        if (iter != computedspecs.end()) {
            t_calculation calculation(computedspecs[std::distance(computedspecs.begin(), iter)].get_formulaspec());
            switch (spec.agg()) {
                case AGGTYPE_CUSTOM: {
                    dst->set_scalar(dst_ridx, calculation.get_formula_result(col_scalar_map));
                } break;
                default: { PSP_COMPLAIN_AND_ABORT("Not implemented"); }
            }
        } else {
            PSP_COMPLAIN_AND_ABORT("Computed func not found");
        }
    }
}

std::vector<t_uindex>
t_stree::zero_strands() const {
    auto iterators = m_nodes->get<by_nstrands>().equal_range(0);
    std::vector<t_uindex> rval;

    // GAB: memory optim: do a first pass to compute the number of elements to be able to pre-reserve memory
    t_index count = 0;
    for (auto& iter = iterators.first; iter != iterators.second; ++iter) {
        count++;
    }

    rval.reserve(count);
    for (auto& iter = iterators.first; iter != iterators.second; ++iter) {
        rval.push_back(iter->m_idx);
    }
    return rval;
}

std::set<t_uindex>
t_stree::non_zero_leaves(const std::vector<t_uindex>& zero_strands) const {
    return non_zero_ids(m_newleaves, zero_strands);
}

std::set<t_uindex>
t_stree::non_zero_ids(const std::vector<t_uindex>& zero_strands) const {
    return non_zero_ids(m_newids, zero_strands);
}

std::set<t_uindex>
t_stree::non_zero_ids(
    const std::set<t_uindex>& ptiset, const std::vector<t_uindex>& zero_strands) const {
    std::set<t_uindex> zeroset;
    for (auto idx : zero_strands) {
        zeroset.insert(idx);
    }

    std::set<t_uindex> rval;
    for (const auto& newid : ptiset) {
        if (zeroset.find(newid) == zeroset.end()) {
            rval.insert(newid);
        }
    }

    return rval;
}

t_uindex
t_stree::get_parent_idx(t_uindex ptidx) const {
    iter_by_idx iter = m_nodes->get<by_idx>().find(ptidx);
    if (iter == m_nodes->get<by_idx>().end()) {
        std::cout << "Failed in tree => " << repr() << std::endl;
        PSP_VERBOSE_ASSERT(false, "Did not find node");
    }
    return iter->m_pidx;
}

std::vector<t_uindex>
t_stree::get_ancestry(t_uindex idx) const {
    t_uindex rpidx = root_pidx();
    std::vector<t_uindex> rval;

    // GAB: memory optim: do a first pass to compute the number of elements to be able to pre-reserve memory
    t_index count = 0;
    t_uindex oldidx = idx;
    while (oldidx != rpidx) {
        count++;
        oldidx = get_parent_idx(oldidx);
    }

    rval.reserve(count);
    rpidx = root_pidx();
    while (idx != rpidx) {
        rval.push_back(idx);
        idx = get_parent_idx(idx);
    }

    std::reverse(rval.begin(), rval.end());
    return rval;
}

t_index
t_stree::get_sibling_idx(t_index p_ptidx, t_index p_nchild, t_uindex c_ptidx) const {
    t_by_pidx_ipair iterators = m_nodes->get<by_pidx>().equal_range(p_ptidx);
    iter_by_pidx c_iter = m_nodes->project<by_pidx>(m_nodes->get<by_idx>().find(c_ptidx));
    return std::distance(iterators.first, c_iter);
}

t_uindex
t_stree::get_aggidx(t_uindex idx) const {
    iter_by_idx iter = m_nodes->get<by_idx>().find(idx);
    PSP_VERBOSE_ASSERT(iter != m_nodes->get<by_idx>().end(), "Failed in get_aggidx");
    return iter->m_aggidx;
}

std::shared_ptr<const t_table>
t_stree::get_aggtable() const {
    return m_aggregates;
}

std::shared_ptr<t_table>
t_stree::get_running_table() {
    return m_running_tbl;
}

t_table*
t_stree::_get_aggtable() {
    return m_aggregates.get();
}

t_stree::t_tnode
t_stree::get_node(t_uindex idx) const {
    iter_by_idx iter = m_nodes->get<by_idx>().find(idx);
    PSP_VERBOSE_ASSERT(iter != m_nodes->get<by_idx>().end(), "Failed in get_node");
    return *iter;
}

void
t_stree::get_path(t_uindex idx, std::vector<t_tscalar>& rval) const {
    t_uindex curidx = idx;

    if (curidx == 0)
        return;

    while (1) {
        auto iter = m_nodes->get<by_idx>().find(curidx);
        //rval.push_back(iter->m_value);
        auto value = format_with_binning(iter->m_value, curidx);
        rval.push_back(value);
        curidx = iter->m_pidx;
        if (curidx == 0) {
            break;
        }
    }
    return;
}

t_uindex
t_stree::resolve_child(t_uindex root, const t_tscalar& datum) const {
    auto iter = m_nodes->get<by_pidx_hash>().find(std::make_tuple(root, datum));

    if (iter == m_nodes->get<by_pidx_hash>().end()) {
        return INVALID_INDEX;
    }

    return iter->m_idx;
}

void
t_stree::clear_aggregates(const std::vector<t_uindex>& indices) {
    auto cols = m_aggregates->get_columns();
    for (auto c : cols) {
        for (auto aggidx : indices) {
            c->set_valid(aggidx, false);
        }
    }

    m_agg_freelist.insert(std::end(m_agg_freelist), std::begin(indices), std::end(indices));
}

void
t_stree::drop_zero_strands() {
    auto iterators = m_nodes->get<by_nstrands>().equal_range(0);

    std::vector<t_uindex> leaves;

    auto lst = last_level();

    std::vector<t_uindex> node_ids;

    for (auto iter = iterators.first; iter != iterators.second; ++iter) {
        if (iter->m_depth == lst)
            leaves.push_back(iter->m_idx);
        node_ids.push_back(iter->m_aggidx);
    }

    clear_aggregates(node_ids);

    for (auto nidx : leaves) {
        auto ancestry = get_ancestry(nidx);

        for (auto ancidx : ancestry) {
            if (ancidx == nidx)
                continue;
            remove_leaf(ancidx, nidx);
        }
    }

    auto iterators2 = m_nodes->get<by_nstrands>().equal_range(0);

    m_nodes->get<by_nstrands>().erase(iterators2.first, iterators2.second);
}

void
t_stree::add_pkey(t_uindex idx, t_tscalar pkey) {
    t_stpkey s(idx, pkey);
    m_idxpkey->insert(s);
}

void
t_stree::remove_pkey(t_uindex idx, t_tscalar pkey) {
    auto iter = m_idxpkey->get<by_idx_pkey>().find(std::make_tuple(idx, pkey));

    if (iter == m_idxpkey->get<by_idx_pkey>().end())
        return;

    m_idxpkey->get<by_idx_pkey>().erase(iter);
}

void
t_stree::add_leaf(t_uindex nidx, t_uindex lfidx) {
    t_stleaves s(nidx, lfidx);
    m_idxleaf->insert(s);
}

void
t_stree::remove_leaf(t_uindex nidx, t_uindex lfidx) {
    auto iter = m_idxleaf->get<by_idx_lfidx>().find(std::make_tuple(nidx, lfidx));

    if (iter == m_idxleaf->get<by_idx_lfidx>().end())
        return;

    m_idxleaf->get<by_idx_lfidx>().erase(iter);
}

t_by_idx_pkey_ipair
t_stree::get_pkeys_for_leaf(t_uindex idx) const {
    return m_idxpkey->get<by_idx_pkey>().equal_range(idx);
}

std::vector<t_tscalar>
t_stree::get_pkeys(t_uindex idx) const {
    std::vector<t_tscalar> rval;
    std::vector<t_uindex> leaves = get_leaves(idx);

    // GAB: memory optim: do a first pass to compute the number of elements to be able to pre-reserve memory
    t_index count = 0;
    for (auto leaf : leaves) {
        auto iters = get_pkeys_for_leaf(leaf);
        for (auto iter = iters.first; iter != iters.second; ++iter) {
            count++;
        }
    }

    rval.reserve(count);
    for (auto leaf : leaves) {
        auto iters = get_pkeys_for_leaf(leaf);
        for (auto iter = iters.first; iter != iters.second; ++iter) {
            rval.push_back(iter->m_pkey);
        }
    }
    return rval;
}

std::vector<t_tscalar>
t_stree::get_show_pkeys(t_uindex idx, bool has_previous_filters, t_period_type period_type) const {
    std::vector<t_tscalar> rval;
    auto pkeys = get_pkeys(idx);

    // GAB: memory optim: do a first pass to compute the number of elements to be able to pre-reserve memory
    t_index count = 0;
    for (t_index idx = 0, psize = pkeys.size(); idx < psize; ++idx) {
        t_index key = t_index(pkeys[idx].to_double());
        if (m_saved_msk.get(key)) {
            if (has_previous_filters) {
                switch(period_type) {
                    case PERIOD_TYPE_NONE: {
                        if (m_period_map.at(key) == t_index(1)) {
                            count++;
                        }
                    } break;

                    case PERIOD_TYPE_PREVIOUS: {
                        if (m_period_map.at(key) == t_index(2)) {
                            count++;
                        }
                    } break;

                    default: {
                        count++;
                    } break;
                }
            } else {
                count++;
            }
        }
    }

    rval.reserve(count);

    for (t_index idx = 0, psize = pkeys.size(); idx < psize; ++idx) {
        t_index key = t_index(pkeys[idx].to_double());
        if (m_saved_msk.get(key)) {
            if (has_previous_filters) {
                switch(period_type) {
                    case PERIOD_TYPE_NONE: {
                        if (m_period_map.at(key) == t_index(1)) {
                            rval.push_back(pkeys[idx]);
                        }
                    } break;

                    case PERIOD_TYPE_PREVIOUS: {
                        if (m_period_map.at(key) == t_index(2)) {
                            rval.push_back(pkeys[idx]);
                        }
                    } break;

                    default: {
                        rval.push_back(pkeys[idx]);
                    } break;
                }
            } else {
                rval.push_back(pkeys[idx]);
            }
        }
    }

    return rval;
}

std::vector<t_uindex>
t_stree::get_leaves(t_uindex idx) const {
    std::vector<t_uindex> rval;

    if (is_leaf(idx)) {
        rval.push_back(idx);
        return rval;
    }

    auto iters = m_idxleaf->get<by_idx_lfidx>().equal_range(idx);

    // GAB: memory optim: do a first pass to compute the number of elements to be able to pre-reserve memory
    t_index count = 0;
    for (auto iter = iters.first; iter != iters.second; ++iter) {
        count++;
    }

    rval.reserve(count);
    for (auto iter = iters.first; iter != iters.second; ++iter) {
        rval.push_back(iter->m_lfidx);
    }
    return rval;
}

t_depth
t_stree::get_depth(t_uindex ptidx) const {
    auto iter = m_nodes->get<by_idx>().find(ptidx);
    return iter->m_depth;
}

t_binning_info
t_stree::get_binning_info(t_uindex idx) const {
    auto depth = get_depth(idx);
    if (depth > m_binning_vec.size() && depth < 1) {
        return t_binning_info{BINNING_TYPE_NONE};
    }
    return m_binning_vec[depth - 1];
}

t_tscalar
t_stree::format_with_binning(t_tscalar value, t_uindex idx) const {
    auto binning_info = get_binning_info(idx);
    if (binning_info.type == BINNING_TYPE_NONE) {
        return value;
    }
    return get_interned_tscalar(value.formatted_with_binning(binning_info));
}

void
t_stree::get_drd_indices(
    t_uindex ridx, t_depth rel_depth, std::vector<t_uindex>& leaves) const {
    std::vector<std::pair<t_index, t_index>> pending;

    if (rel_depth == 0) {
        leaves.push_back(ridx);
        return;
    }

    t_depth rdepth = get_depth(ridx);
    t_depth edepth = rdepth + rel_depth;

    pending.push_back(std::pair<t_index, t_index>(ridx, rdepth));

    while (!pending.empty()) {
        std::pair<t_index, t_index> head = pending.back();
        pending.pop_back();

        if (head.second == edepth - 1) {
            auto children = get_child_idx(head.first);
            std::copy(children.begin(), children.end(), std::back_inserter(leaves));
        } else {
            auto children = get_child_idx_depth(head.first);
            std::copy(children.begin(), children.end(), std::back_inserter(pending));
        }
    }
}

std::vector<t_uindex>
t_stree::get_child_idx(t_uindex idx) const {
    t_index num_children = get_num_children(idx);
    std::vector<t_uindex> children(num_children);
    auto iterators = m_nodes->get<by_pidx>().equal_range(idx);
    t_index count = 0;
    while (iterators.first != iterators.second) {
        children[count] = iterators.first->m_idx;
        ++count;
        ++iterators.first;
    }
    return children;
}

std::vector<std::pair<t_index, t_index>>
t_stree::get_child_idx_depth(t_uindex idx) const {
    t_index num_children = get_num_children(idx);
    std::vector<std::pair<t_index, t_index>> children(num_children);
    auto iterators = m_nodes->get<by_pidx>().equal_range(idx);
    t_index count = 0;
    while (iterators.first != iterators.second) {
        children[count]
            = std::pair<t_index, t_index>(iterators.first->m_idx, iterators.first->m_depth);
        ++count;
        ++iterators.first;
    }
    return children;
}

void
t_stree::populate_leaf_index(const std::set<t_uindex>& leaves) {
    for (auto nidx : leaves) {
        std::vector<t_uindex> ancestry = get_ancestry(nidx);

        for (auto ancidx : ancestry) {
            if (ancidx == nidx)
                continue;

            add_leaf(ancidx, nidx);
        }
    }
}

t_uindex
t_stree::last_level() const {
    return m_pivots.size();
}

bool
t_stree::is_leaf(t_uindex nidx) const {
    auto iter = m_nodes->get<by_idx>().find(nidx);
    PSP_VERBOSE_ASSERT(iter != m_nodes->get<by_idx>().end(), "Did not find node");
    return iter->m_depth == last_level();
}

std::vector<t_uindex>
t_stree::get_descendents(t_uindex nidx) const {
    std::vector<t_uindex> rval;

    std::vector<t_uindex> queue;
    queue.push_back(nidx);

    while (!queue.empty()) {
        auto h = queue.back();
        queue.pop_back();
        auto children = get_children(h);
        queue.insert(std::end(queue), std::begin(children), std::end(children));
        rval.insert(std::end(rval), std::begin(children), std::end(children));
    }

    return rval;
}

const std::vector<t_pivot>&
t_stree::get_pivots() const {
    return m_pivots;
}

const std::map<std::string, t_depth>
t_stree::get_pivot_map() const {
    std::map<std::string, t_depth> pivot_map;
    for (t_index d = 0, depth = m_pivots.size(); d < depth; ++d) {
        auto pivot = m_pivots[d];
        pivot_map[pivot.name()] = d + 1;
    }
    return pivot_map;
}

t_index
t_stree::resolve_path(t_uindex root, const std::vector<t_tscalar>& path) const {
    t_index curidx = root;

    if (path.empty())
        return curidx;

    for (t_index i = path.size() - 1; i >= 0; i--) {
        iter_by_pidx_hash iter
            = m_nodes->get<by_pidx_hash>().find(std::make_tuple(curidx, path[i]));
        if (iter == m_nodes->get<by_pidx_hash>().end()) {
            return INVALID_INDEX;
        }
        curidx = iter->m_idx;
    }

    return curidx;
}

// aggregates should be presized to be same size
// as agg_indices
void
t_stree::get_aggregates_for_sorting(t_uindex nidx, const std::vector<t_index>& agg_indices,
    std::vector<t_tscalar>& aggregates, t_ctx2* ctx2, const std::vector<t_index>& subtotal_indices) const {
    t_uindex aggidx = get_aggidx(nidx);
    for (t_uindex idx = 0, loop_end = agg_indices.size(); idx < loop_end; ++idx) {
        auto which_agg = agg_indices[idx];
        if (which_agg < 0) {
            aggregates[idx] = get_sortby_value(nidx);
        } else if (ctx2 || (size_t(which_agg) >= m_aggcols.size())) {
            aggregates[idx].set(t_none());
            if (ctx2) {
                auto subtotal_index = t_index(-1);
                if (idx < subtotal_indices.size() && subtotal_indices[idx] != -1) {
                    if (!ctx2->has_row_combined()) {
                        which_agg = subtotal_indices[idx] * m_aggcols.size() + which_agg;
                    } else {
                        subtotal_index = subtotal_indices[idx];
                    }
                }
                if ((ctx2->get_config().get_totals() == TOTALS_BEFORE)
                    && (size_t(which_agg) < m_aggcols.size())) {
                    aggregates[idx] = m_aggcols[which_agg]->get_scalar(aggidx);
                    continue;
                }

                // two sided pivoted column
                // we don't have enough information here to work out the shape of the data
                // so we have to use ctx2 to resolve

                // fetch the row/column path from ctx2
                std::vector<t_tscalar> col_path;
                if (ctx2->has_row_combined()) {
                    col_path = ctx2->get_column_path_userspace(subtotal_index + 1);
                } else {
                    col_path = ctx2->get_column_path_userspace(which_agg + 1);
                }
                if (col_path.empty()) {
                    if (ctx2->get_config().get_totals() == TOTALS_AFTER) {
                        aggregates[idx]
                            = m_aggcols[which_agg % m_aggcols.size()]->get_scalar(aggidx);
                    }
                    continue;
                }

                std::vector<t_tscalar> row_path;
                get_path(nidx, row_path);

                auto target_tree = ctx2->get_trees()[get_node(nidx).m_depth];
                t_index target = target_tree->resolve_path(0, row_path);
                if (target != INVALID_INDEX)
                    target = target_tree->resolve_path(target, col_path);
                if (target != INVALID_INDEX) {
                    aggregates[idx]
                        = target_tree->get_aggregate(target, which_agg % m_aggcols.size());
                }
            }
        } else {
            aggregates[idx] = m_aggcols[which_agg]->get_scalar(aggidx);
        }
    }
}

t_tscalar
t_stree::get_aggregate(t_index idx, t_index aggnum) const {
    if (aggnum < 0) {
        return get_value(idx);
    }

    auto aggtable = get_aggtable();
    auto c = aggtable->get_const_column(aggnum).get();
    auto agg_ridx = get_aggidx(idx);

    t_index pidx = get_parent_idx(idx);

    t_index agg_pridx = pidx == INVALID_INDEX ? INVALID_INDEX : get_aggidx(pidx);

    return extract_aggregate(m_aggspecs[aggnum], c, agg_ridx, agg_pridx);
}

void
t_stree::get_child_indices(t_index idx, std::vector<t_index>& out_data) const {
    t_index num_children = get_num_children(idx);
    std::vector<t_index> temp(num_children);
    t_by_pidx_ipair iterators = m_nodes->get<by_pidx>().equal_range(idx);
    t_index count = 0;
    for (iter_by_pidx iter = iterators.first; iter != iterators.second; ++iter) {
        temp[count] = iter->m_idx;
        ++count;
    }
    std::swap(out_data, temp);
}

void
t_stree::clear_deltas() {
    m_deltas->clear();
    m_has_delta = false;
}

void
t_stree::clear() {
    m_nodes->clear();
    clear_deltas();
}

void
t_stree::set_alerts_enabled(bool enabled_state) {
    m_features[CTX_FEAT_ALERT] = enabled_state;
}

void
t_stree::set_deltas_enabled(bool enabled_state) {
    m_features[CTX_FEAT_DELTA] = enabled_state;
}

void
t_stree::set_minmax_enabled(bool enabled_state) {
    m_features[CTX_FEAT_MINMAX] = enabled_state;
}

void
t_stree::set_feature_state(t_ctx_feature feature, bool state) {
    m_features[feature] = state;
}

t_minmax
t_stree::get_agg_min_max(t_uindex aggidx, t_depth depth) const {
    auto iterators = m_nodes->get<by_depth>().equal_range(depth);
    return get_agg_min_max(iterators.first, iterators.second, aggidx);
}

std::vector<t_minmax>
t_stree::get_min_max() const {
    t_uindex naggs = m_aggspecs.size();
    std::vector<t_minmax> rval(naggs);
    for (t_uindex cidx = 0; cidx < naggs; ++cidx) {

        auto biter = m_nodes->get<by_idx>().begin();
        auto eiter = m_nodes->get<by_idx>().end();
        rval[cidx] = get_agg_min_max(biter, eiter, cidx);
    }
    return rval;
}

void
t_stree::init_saved_mask(t_mask msk) {
    m_saved_msk = t_mask(msk.size());
    for (t_index idx = 0, lsize = msk.size(); idx < lsize; ++idx) {
        m_saved_msk.set(idx, msk.get(idx));
    }
}

void
t_stree::update_saved_mask_for_leave(t_mask msk) {
    // Get all leaves of root
    std::vector<t_uindex> leaves = get_leaves(0);
    for (t_index idx = 0, lsize = leaves.size(); idx < lsize; ++idx) {
        auto pkeys = get_pkeys(leaves[idx]);
        for (t_index pidx = 0, psize = pkeys.size(); pidx < psize; ++pidx) {
            auto ridx = t_index(pkeys[pidx].to_double());
            m_saved_msk.set(ridx, msk.get(leaves[idx]) && m_saved_msk.get(ridx));
        }
    }
}

void
t_stree::update_saved_mask(t_mask msk) {
    if (msk.size() != m_saved_msk.size()) {
        return;
    }
    for (t_uindex ridx = 0, msize = m_saved_msk.size(); ridx < msize; ++ridx) {
        m_saved_msk.set(ridx, msk.get(ridx) && m_saved_msk.get(ridx));
    }
}

t_mask
t_stree::get_saved_mask() const {
    return m_saved_msk;
}

void
t_stree::update_period_map(std::map<t_index, t_index> period_map) {
    for (auto iter: period_map) {
        m_period_map[iter.first] = iter.second;
    }
}

void
t_stree::update_binning_vec(std::vector<t_binning_info> binning_vec) {
    m_binning_vec = binning_vec;
}

void
t_stree::update_show_nodes(t_config config) {
    auto has_previous_filters = config.has_previous_filters();
    // Update show for all node
    for (t_index curidx = 1, tsize = size(); curidx < tsize; ++curidx) {
        iter_by_idx iter = m_nodes->get<by_idx>().find(curidx);
        auto node = *iter;
        auto pkeys = get_show_pkeys(curidx, has_previous_filters, PERIOD_TYPE_NONE);
        if (pkeys.size() == 0) {
            node.set_show(false);
        } else {
            node.set_show(true);
        }
        m_nodes->get<by_idx>().replace(iter, node);
    }
}

void
t_stree::update_data_format_depth(std::map<t_depth, t_dataformattype> df_depth_map) {
    for (t_index curidx = 1, tsize = size(); curidx < tsize; ++curidx) {
        iter_by_idx iter = m_nodes->get<by_idx>().find(curidx);
        auto node = *iter;
        if (df_depth_map.find(node.m_depth) == df_depth_map.end()) {
            continue;
        }
        auto pivot = m_pivots[node.m_depth - 1];
        if (pivot.agg_level() != AGG_LEVEL_NONE && pivot.agg_level() != AGG_LEVEL_DAY) {
            continue;
        }
        t_tscalar value = node.m_value;
        auto pre_df = value.m_data_format_type;
        value.m_data_format_type = df_depth_map[node.m_depth];
        if (value.is_valid() && !value.is_error() && value.m_type == DTYPE_STR && (value.m_data_format_type == DATA_FORMAT_NUMBER
            || value.m_data_format_type == DATA_FORMAT_FINANCIAL || value.m_data_format_type == DATA_FORMAT_PERCENT)) {
            value = get_interned_tscalar(value.format_binning_string(pre_df));
            value.m_data_format_type = df_depth_map[node.m_depth];
        } else {
            t_dataformattype df = df_depth_map[node.m_depth];
            if (pivot.agg_level() == AGG_LEVEL_DAY) {
                if (df == DATA_FORMAT_DATE_V1) {
                    df = DATA_FORMAT_DAY_V1;
                } else if (df == DATA_FORMAT_DATE_V2) {
                    df = DATA_FORMAT_DAY_V2;
                } else if (df == DATA_FORMAT_DATE_V3) {
                    df = DATA_FORMAT_DAY_V3;
                }
                value.m_data_format_type = df;
            }
        }
        node.set_value(value);
        m_nodes->get<by_idx>().replace(iter, node);
    }
}

const std::shared_ptr<t_tcdeltas>&
t_stree::get_deltas() const {
    return m_deltas;
}

t_tscalar
t_stree::first_last_helper(t_uindex nidx, const t_aggspec& spec, const t_gstate& gstate, bool has_previous_filters, t_period_type period_type) const {
    //auto pkeys = get_pkeys(nidx);
    auto pkeys = get_show_pkeys(nidx, has_previous_filters, period_type);

    if (pkeys.empty())
        return mknone();

    std::vector<t_tscalar> values;
    std::vector<t_tscalar> sort_values;

    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
    const std::string& tbl_colname_0 = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
    const std::string& tbl_colname_1 = m_schema.get_tbl_colname(spec.get_dependencies()[1].name());

    gstate.read_column(tbl_colname_0, pkeys, values);
    gstate.read_column(tbl_colname_1, pkeys, sort_values);

    auto minmax_idx = get_minmax_idx(sort_values, spec.get_sort_type());

    switch (spec.get_sort_type()) {
        case SORTTYPE_ASCENDING:
        case SORTTYPE_ASCENDING_ABS: {
            if (spec.agg() == AGGTYPE_FIRST) {
                if (minmax_idx.m_min >= 0) {
                    return values[minmax_idx.m_min];
                }
            } else {
                if (minmax_idx.m_max >= 0) {
                    return values[minmax_idx.m_max];
                }
            }
        } break;
        case SORTTYPE_DESCENDING:
        case SORTTYPE_DESCENDING_ABS: {
            if (spec.agg() == AGGTYPE_FIRST) {
                if (minmax_idx.m_max >= 0) {
                    return values[minmax_idx.m_max];
                }
            } else {
                if (minmax_idx.m_min >= 0) {
                    return values[minmax_idx.m_min];
                }
            }
        } break;
        default: {
            // return none
        }
    }

    return mknone();
}

t_tscalar
t_stree::first_last_helper_with_pkeys(t_uindex nidx, const t_aggspec& spec, const t_gstate& gstate,
    std::vector<t_tscalar> pkeys) const {
    if (pkeys.empty())
        return mknone();

    std::vector<t_tscalar> values;
    std::vector<t_tscalar> sort_values;

    //const std::string& tbl_colname = spec.get_dependencies()[0].name();
    const std::string& tbl_colname_0 = m_schema.get_tbl_colname(spec.get_dependencies()[0].name());
    const std::string& tbl_colname_1 = m_schema.get_tbl_colname(spec.get_dependencies()[1].name());

    gstate.read_column(tbl_colname_0, pkeys, values);
    gstate.read_column(tbl_colname_1, pkeys, sort_values);

    auto minmax_idx = get_minmax_idx(sort_values, spec.get_sort_type());

    switch (spec.get_sort_type()) {
        case SORTTYPE_ASCENDING:
        case SORTTYPE_ASCENDING_ABS: {
            if (spec.agg() == AGGTYPE_FIRST) {
                if (minmax_idx.m_min >= 0) {
                    return values[minmax_idx.m_min];
                }
            } else {
                if (minmax_idx.m_max >= 0) {
                    return values[minmax_idx.m_max];
                }
            }
        } break;
        case SORTTYPE_DESCENDING:
        case SORTTYPE_DESCENDING_ABS: {
            if (spec.agg() == AGGTYPE_FIRST) {
                if (minmax_idx.m_max >= 0) {
                    return values[minmax_idx.m_max];
                }
            } else {
                if (minmax_idx.m_min >= 0) {
                    return values[minmax_idx.m_min];
                }
            }
        } break;
        default: {
            // return none
        }
    }

    return mknone();
}

bool
t_stree::node_exists(t_uindex idx) {
    iter_by_idx iter = m_nodes->get<by_idx>().find(idx);
    return iter != m_nodes->get<by_idx>().end();
}

t_table*
t_stree::get_aggtable() {
    return m_aggregates.get();
}

std::pair<iter_by_idx, bool>
t_stree::insert_node(const t_tnode& node) {
    return m_nodes->insert(node);
}

bool
t_stree::has_deltas() const {
    return m_has_delta;
}

void
t_stree::get_sortby_path(t_uindex idx, std::vector<t_tscalar>& rval) const {
    t_uindex curidx = idx;
    //std::cout << "get_sortby_path ===== index " << idx << std::endl;

    if (curidx == 0)
        return;

    //std::cout << "Path ==== " ;
    while (1) {
        iter_by_idx iter = m_nodes->get<by_idx>().find(curidx);
        //std::cout << iter->m_sort_value.to_string() << " ---> ";
        rval.push_back(iter->m_sort_value);
        curidx = iter->m_pidx;
        if (curidx == 0) {
            break;
        }
    }
    //std::cout << std::endl;
    return;
}

void
t_stree::set_has_deltas(bool v) {
    m_has_delta = v;
}

t_bfs_iter<t_stree>
t_stree::bfs() const {
    return t_bfs_iter<t_stree>(this);
}

t_dfs_iter<t_stree>
t_stree::dfs() const {
    return t_dfs_iter<t_stree>(this);
}

void
t_stree::pprint() const {
    for (auto idx : dfs()) {
        std::vector<t_tscalar> path;
        get_path(idx, path);
        for (t_uindex space_idx = 0; space_idx < path.size(); ++space_idx) {
            std::cout << "  ";
        }
        std::cout << idx << " <" << path << ">";
        for (t_uindex aidx = 0; aidx < get_num_aggcols(); ++aidx) {
            std::cout << get_aggregate(idx, aidx) << ", ";
        }
        std::cout << std::endl;
    }
}

} // end namespace perspective
