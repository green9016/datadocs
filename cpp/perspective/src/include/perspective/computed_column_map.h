#pragma once

#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/exports.h>
#include <perspective/raw_types.h>
#include <perspective/computed.h>

namespace perspective {

/**
 * @brief `t_computed_column_map` keeps track of a set of computed
 * column definitions for a single gnode. 
 * 
 * When contexts are created, call the `add_computed_columns` method to track
 * new computed columns. When contexts are deleted, call the 
 * `remove_computed_columns` method to stop tracking the context's computed
 * columns.
 * 
 */
struct PERSPECTIVE_EXPORT t_computed_column_map {

    t_computed_column_map();

    void add_computed_columns(const std::vector<t_computed_column_definition>& columns);
    void remove_computed_columns(const std::vector<std::string>& names);
    void clear();

    std::map<std::string, t_computed_column_definition> m_computed_columns;
};

} // end namespace perspective