#pragma once
#include <perspective/first.h>
#include <perspective/base.h>
#include <perspective/exports.h>
#include <perspective/schema_column.h>
#include <vector>

namespace perspective {
struct PERSPECTIVE_EXPORT t_data_format_spec_recipe {
    t_data_format_spec_recipe() {}
    std::string m_name;
    t_dataformattype m_type;
};

class PERSPECTIVE_EXPORT t_data_format_spec {
public:
    t_data_format_spec();

    ~t_data_format_spec();

    t_data_format_spec(const t_data_format_spec_recipe& v);

    t_data_format_spec(
        const std::string& name, t_dataformattype type);

    std::string get_name() const;

    t_dataformattype get_type() const;

    t_data_format_spec_recipe get_recipe() const;

    bool operator==(const t_data_format_spec& other) const;

    void update_column_name(const std::string& old_name, const std::string& new_name);

private:
    std::string m_name;
    t_dataformattype m_type;
};

PERSPECTIVE_EXPORT std::string get_default_data_format(t_dtype coltype);
PERSPECTIVE_EXPORT t_dataformattype get_default_data_format_type(t_dtype coltype);
}