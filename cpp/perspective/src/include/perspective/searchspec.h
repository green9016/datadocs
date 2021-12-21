#pragma once
#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/exports.h>
#include <perspective/schema.h>
#include <perspective/schema_column.h>
#include <vector>

namespace perspective {
struct PERSPECTIVE_EXPORT t_searchspec_recipe {
    t_searchspec_recipe() {}
    std::string m_name;
    t_searchtype m_type;
};

class PERSPECTIVE_EXPORT t_searchspec {
public:
    t_searchspec();

    ~t_searchspec();

    t_searchspec(const t_searchspec_recipe& v);

    t_searchspec(
        const std::string& name, t_searchtype type);

    std::string get_name() const;

    t_searchtype get_type() const;

    t_searchspec_recipe get_recipe() const;

private:
    std::string m_name;
    t_searchtype m_type;
};

PERSPECTIVE_EXPORT std::string get_default_search_type(t_dtype coltype);
}