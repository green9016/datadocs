/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

perspective::t_index get_row_count() const;

perspective::t_index get_column_count() const;

std::vector<t_tscalar> get_data(
    t_index start_row, t_index end_row, t_index start_col, t_index end_col,
    std::map<std::uint32_t, std::uint32_t> idx_map = {}) const;

std::map<std::pair<t_uindex, t_uindex>, t_tscalar> get_selection_summarize(std::vector<t_selection_info> selections) const;

void sort_by(const std::vector<t_sortspec>& sortby);

void reset_sortby();

// will only work on empty contexts
void notify(const t_table& flattened);

void notify(const t_table& flattened, const t_table& delta, const t_table& prev,
    const t_table& current, const t_table& transitions, const t_table& existed);

void step_begin();

void step_end();

std::string repr() const;

void init();

void reset();

t_index sidedness() const;

bool get_deltas_enabled() const;

void set_alerts_enabled(bool enabled_state);

void set_deltas_enabled(bool enabled_state);

void set_minmax_enabled(bool enabled_state);

void set_feature_state(t_ctx_feature feature, bool state);

std::vector<t_tscalar> get_pkeys(const std::vector<std::pair<t_uindex, t_uindex>>& cells) const;

std::vector<t_tscalar> get_cell_data(
    const std::vector<std::pair<t_uindex, t_uindex>>& cells) const;

const std::vector<t_minmax>& get_min_max() const;

t_stepdelta get_step_delta(t_index bidx, t_index eidx);

t_rowdelta get_row_delta(t_index bidx, t_index eidx);

std::vector<t_cellupd> get_cell_delta(t_index bidx, t_index eidx) const;

void clear_deltas();

void reset_step_state();

void disable();

void enable();

std::vector<t_stree*> get_trees();

bool has_deltas() const;

void pprint() const;

t_dtype get_column_dtype(t_uindex idx) const;

std::shared_ptr<t_table> get_table() const;

void build_running_table(std::string col_name, t_show_type show_type);

void update_column_name(const std::string& old_name, const std::string& new_name);

void update_show_type(std::string col_name, t_show_type show_type);

void update_pagination_setting(t_index page_items, t_index page_num);

// Unity api
std::vector<t_tscalar> unity_get_row_data(t_uindex idx) const;
std::vector<t_tscalar> unity_get_column_data(t_uindex idx) const;
std::vector<t_tscalar> unity_get_row_path(t_uindex idx) const;
std::vector<std::int8_t> unity_get_row_path_extra(t_uindex idx) const;
std::vector<t_tscalar> unity_get_row_header(t_uindex idx) const;
std::vector<t_tscalar> unity_get_column_path(t_uindex idx) const;
t_uindex unity_get_row_depth(t_uindex ridx) const;
t_uindex unity_get_column_depth(t_uindex cidx) const;
std::vector<std::string> unity_get_column_names() const;
std::vector<std::string> unity_get_column_display_names() const;
std::string unity_get_column_name(t_uindex idx) const;
std::string unity_get_column_display_name(t_uindex idx) const;
t_uindex unity_get_column_count() const;
bool get_show_leave() const;
t_uindex unity_get_row_count() const;
t_table unity_get_table() const;
bool unity_get_row_expanded(t_uindex idx) const;
bool unity_get_column_expanded(t_uindex idx) const;
void unity_init_load_step_end();
// TODO

// add unity api for tables