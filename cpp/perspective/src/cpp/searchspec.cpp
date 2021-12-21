#include <perspective/first.h>
#include <perspective/searchspec.h>
#include <perspective/base.h>
#include <sstream>

namespace perspective {
t_searchspec::t_searchspec() {}

t_searchspec::t_searchspec(const t_searchspec_recipe& v) {
    m_name = v.m_name;
    m_type = v.m_type;
}

t_searchspec::t_searchspec(
    const std::string& name, t_searchtype type)
    : m_name(name)
    , m_type(type) {}

t_searchspec::~t_searchspec() {}

std::string
t_searchspec::get_name() const {
    return m_name;
}

t_searchtype
t_searchspec::get_type() const {
    return m_type;
}

t_searchspec_recipe
t_searchspec::get_recipe() const {
    t_searchspec_recipe rv;
    rv.m_name = m_name;
    rv.m_type = m_type;

    return rv;
}

std::string
get_default_search_type(t_dtype coltype) {
    switch (coltype) {
        case DTYPE_STR:
        case DTYPE_LIST_STR: {
            return "edge";
        }
        
        case DTYPE_BOOL:
        case DTYPE_INT16:
        case DTYPE_INT32:
        case DTYPE_INT64:
        case DTYPE_FLOAT32:
        case DTYPE_FLOAT64:
        case DTYPE_DECIMAL:
        case DTYPE_LIST_BOOL:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64: {
            return "equals";
        }

        case DTYPE_TIME:
        case DTYPE_DATE:
        case DTYPE_DURATION:
        case DTYPE_LIST_TIME:
        case DTYPE_LIST_DATE:
        case DTYPE_LIST_DURATION: {
            return "null";
        }

        default: { PSP_COMPLAIN_AND_ABORT("Unexpected coltype"); }
    }
    return "null";
}
}