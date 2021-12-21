#pragma once
#include <perspective/first.h>
#include <perspective/base.h>
#include <vector>
#include <memory>
#include <perspective/exports.h>
#include <perspective/scalar.h>
#include <perspective/searchspec.h>

namespace perspective {
struct PERSPECTIVE_EXPORT t_sterm {
public:
    t_sterm();

    t_sterm(const std::string& v);

    t_sterm(const std::string& v, const bool& full_search);

	t_sterm(t_date date);

    bool is_full_search() const;

	const std::string &get_sterm() const;

	bool call_pp(const t_tscalar& s, t_searchtype search_type) const;

    friend bool operator ==(const t_sterm &x, const t_sterm &y) {
        // comparing only fields that appear to be relevant for the result of the filter
        return x.m_sterm == y.m_sterm
            && x.m_sterm_double == y.m_sterm_double
            && x.m_sterm_date == y.m_sterm_date
            && x.m_full_search == y.m_full_search;
    }

private:
    std::string m_sterm;
    std::shared_ptr<double> m_sterm_double = nullptr;
	std::shared_ptr<t_date> m_sterm_date = nullptr;
    bool m_full_search = false;
};

struct PERSPECTIVE_EXPORT t_search_info {
public:
    t_search_info();

    t_search_info(const std::vector<std::string>& columns, const bool unselected_all);

    const std::vector<std::string>& get_search_columns() const;
    bool have_columns_search() const;
    bool contain_search_column(const std::string& colname) const;

private:
    std::vector<std::string> m_columns;
    bool m_unselected_all;
};
}