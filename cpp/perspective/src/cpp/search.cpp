#include <perspective/first.h>
#include <perspective/search.h>

namespace perspective {

t_sterm::t_sterm() {}

inline bool
is_number(const char* s, double* out = nullptr) {
    if (!s)
        return false;
    char* end = 0;
    double val = strtod(s, &end);
    if (out)
        *out = val;
    return end != s && val != HUGE_VAL;
}

t_sterm::t_sterm(const std::string& v) {
    m_sterm = v;

    double d;
    bool is_num = is_number(m_sterm.data(), &d);
    if (is_num) {
        m_sterm_double.reset(new double(d));
    }

	t_date date;
    if (t_date::from_string(v.data(), date)) {
        m_sterm_date.reset(new t_date(date));
	}
}

t_sterm::t_sterm(const std::string& v, const bool& full_search) {
    m_sterm = v;
    m_full_search = full_search;

	double d;
    bool is_num = is_number(m_sterm.data(), &d);
    if (is_num) {
        m_sterm_double.reset(new double(d));
    }

	t_date date;
    if (t_date::from_string(v.data(), date)) {
        m_sterm_date.reset(new t_date(date));
    }
}

t_sterm::t_sterm(t_date date) { m_sterm_date.reset(new t_date(date)); }

bool
t_sterm::is_full_search() const {
    return m_full_search;
};

const std::string&
t_sterm::get_sterm() const {
    return m_sterm;
}

bool
t_sterm::call_pp(const t_tscalar& s, t_searchtype search_type) const {
    bool rv = false;
    auto sterm_double = m_sterm_double.get();
    auto sterm_date = m_sterm_date.get();

    switch (search_type) {
        case SEARCHTYPE_EQUALS:
            rv = s.pp_search_equals(m_sterm, sterm_double, sterm_date);
            break;

        case SEARCHTYPE_CONTAINS: {
            rv = s.pp_search_contains(m_sterm, sterm_double, sterm_date);
        } break;

        case SEARCHTYPE_EDGE: {
            rv = s.pp_search_edge(m_sterm, sterm_double, sterm_date);
        } break;

        case SEARCHTYPE_STARTS_WITH: {
            rv = s.pp_search_begins_with(m_sterm, sterm_double, sterm_date);
        } break;

        case SEARCHTYPE_NULL:
        default:
            rv = false;
            break;
    }
    return rv;
}

t_search_info::t_search_info() {}

t_search_info::t_search_info(const std::vector<std::string>& columns, const bool unselected_all)
    : m_columns(columns)
    , m_unselected_all(unselected_all) {}

const std::vector<std::string>&
t_search_info::get_search_columns() const {
    return m_columns;
}

bool
t_search_info::have_columns_search() const {
    return m_columns.size() > 0 || m_unselected_all;
}

bool
t_search_info::contain_search_column(const std::string& colname) const {
    if (!have_columns_search()) {
        return true;
    }
    return std::find(m_columns.begin(), m_columns.end(), colname) != m_columns.end();
}

}