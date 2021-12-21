#include <perspective/computed_column_map.h>

namespace perspective {

t_computed_column_map::t_computed_column_map() {};

void
t_computed_column_map::add_computed_columns(
    const std::vector<t_computed_column_definition>& columns) {
    for (const auto& col : columns) {
        std::string name = std::get<0>(col);
        m_computed_columns[name] = col;
    }
}

void
t_computed_column_map::remove_computed_columns(
    const std::vector<std::string>& names) {
    for (const auto& name : names) {
        if (m_computed_columns.count(name)) {
            m_computed_columns.erase(name);
        }
    }
}

void
t_computed_column_map::clear() {
    std::cout << "t_computed_column_map->size()=" <<  m_computed_columns.size() << std::endl;
    m_computed_columns.clear();
}

} // end namespace perspective