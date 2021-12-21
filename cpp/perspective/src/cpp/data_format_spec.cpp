#include <perspective/first.h>
#include <perspective/data_format_spec.h>
#include <perspective/base.h>
#include <sstream>

namespace perspective {
t_data_format_spec::t_data_format_spec() {}

t_data_format_spec::t_data_format_spec(const t_data_format_spec_recipe& v) {
    m_name = v.m_name;
    m_type = v.m_type;
}

t_data_format_spec::t_data_format_spec(
    const std::string& name, t_dataformattype type)
    : m_name(name)
    , m_type(type) {}

t_data_format_spec::~t_data_format_spec() {}

std::string
t_data_format_spec::get_name() const {
    return m_name;
}

t_dataformattype
t_data_format_spec::get_type() const {
    return m_type;
}

t_data_format_spec_recipe
t_data_format_spec::get_recipe() const {
    t_data_format_spec_recipe rv;
    rv.m_name = m_name;
    rv.m_type = m_type;

    return rv;
}

std::string
get_default_data_format(t_dtype coltype) {
    switch (coltype) {
        case DTYPE_ENUM:
        case DTYPE_OID:
        case DTYPE_PTR:
        case DTYPE_F64PAIR:
        case DTYPE_USER_FIXED:
        case DTYPE_USER_VLEN:
        case DTYPE_LAST_VLEN:
        case DTYPE_NONE: {
            return "null";
        }
        case DTYPE_STR:
        case DTYPE_LIST_STR: {
            return "text";
        }
        
        case DTYPE_BOOL:
        case DTYPE_LIST_BOOL: {
            return "true/false";
        }
        case DTYPE_INT8:
        case DTYPE_INT16:
        case DTYPE_INT32:
        case DTYPE_INT64:
         case DTYPE_UINT64:
        case DTYPE_UINT32:
        case DTYPE_UINT16:
        case DTYPE_UINT8:
        case DTYPE_FLOAT32:
        case DTYPE_FLOAT64:
        case DTYPE_DECIMAL:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64: {
            return "number";
        }

        case DTYPE_TIME:
        case DTYPE_LIST_TIME: {
            return "date time";
        }
        case DTYPE_DATE:
        case DTYPE_LIST_DATE: {
            return "date v1";
        }
        case DTYPE_DURATION:
        case DTYPE_LIST_DURATION: {
            return "duration";
        }

        default: { PSP_COMPLAIN_AND_ABORT("Unexpected coltype"); }
    }
    return "text";
}

t_dataformattype
get_default_data_format_type(t_dtype coltype) {
    switch (coltype) {
        case DTYPE_ENUM:
        case DTYPE_OID:
        case DTYPE_PTR:
        case DTYPE_F64PAIR:
        case DTYPE_USER_FIXED:
        case DTYPE_USER_VLEN:
        case DTYPE_LAST_VLEN:
        case DTYPE_NONE: {
            return t_dataformattype::DATA_FORMAT_NONE;
        }
        case DTYPE_STR:
        case DTYPE_LIST_STR: {
            return t_dataformattype::DATA_FORMAT_TEXT;
        }
        
        case DTYPE_BOOL:
        case DTYPE_LIST_BOOL: {
            return t_dataformattype::DATA_FORMAT_TRUE_FALSE;
        }
        case DTYPE_INT8:
        case DTYPE_INT16:
        case DTYPE_INT32:
        case DTYPE_INT64:
        case DTYPE_UINT64:
        case DTYPE_UINT32:
        case DTYPE_UINT16:
        case DTYPE_UINT8:
        case DTYPE_FLOAT32:
        case DTYPE_FLOAT64:
        case DTYPE_DECIMAL:
        case DTYPE_LIST_INT64:
        case DTYPE_LIST_FLOAT64: {
            return t_dataformattype::DATA_FORMAT_NUMBER;
        }

        case DTYPE_TIME:
        case DTYPE_LIST_TIME: {
            return t_dataformattype::DATA_FORMAT_DATETIME;
        }
        case DTYPE_DATE:
        case DTYPE_LIST_DATE: {
            return t_dataformattype::DATA_FORMAT_DATE_V1;
        }
        case DTYPE_DURATION:
        case DTYPE_LIST_DURATION: {
            return t_dataformattype::DATA_FORMAT_TIME;
        }

        default: { PSP_COMPLAIN_AND_ABORT("Unexpected coltype"); }
    }
    return t_dataformattype::DATA_FORMAT_TEXT;
}

bool
t_data_format_spec::operator==(const t_data_format_spec& other) const {
    return m_name == other.m_name;
}

void
t_data_format_spec::update_column_name(const std::string& old_name, const std::string& new_name) {
    if (m_name != old_name) {
        return;
    }
    m_name = new_name;
}
}