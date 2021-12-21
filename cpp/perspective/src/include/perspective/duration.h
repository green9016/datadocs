#pragma once
#include <perspective/first.h>
#include <perspective/raw_types.h>
#include <perspective/base.h>
#include <perspective/utils.h>
#include <perspective/exports.h>
#include <perspective/time.h>
#include <boost/functional/hash.hpp>
#include <sstream>
#include <string>
#include <algorithm>
#include <cmath>

namespace perspective {

const int MINUTES_PER_DAY = 60 * 24;

// In terms of (non-tm based) inputs/outputs, t_time
// represents an instant in time as:
// A hour().
// A minute() in the range [0..59].
// A second() of the minute in the range [0..59].
class PERSPECTIVE_EXPORT t_duration {
public:
    typedef double t_rawtype;

    t_duration();

    t_duration(std::int8_t hour, std::int8_t minute, std::int8_t second);

    void set_hour_minute_second(std::int8_t hour, std::int8_t minute, std::int8_t second);

    explicit t_duration(double raw_val);

    double raw_value() const;

    friend bool operator<(const t_duration& a, const t_duration& b);
    friend bool operator<=(const t_duration& a, const t_duration& b);
    friend bool operator>(const t_duration& a, const t_duration& b);
    friend bool operator>=(const t_duration& a, const t_duration& b);
    friend bool operator==(const t_duration& a, const t_duration& b);
    friend bool operator!=(const t_duration& a, const t_duration& b);
    std::int32_t hour() const;
    std::int32_t minute() const;
    std::int32_t second() const;

    std::string str(t_dataformattype dftype) const;
    double agg_level_num(t_agg_level_type agg_level) const;
    std::string agg_level_str(t_dataformattype dftype, t_agg_level_type agg_level) const;
    friend inline size_t hash_value(const t_duration& d);

    void set_psp_duration(t_uindex dt);

private:
    t_rawtype m_storage;
};

inline size_t
hash_value(const t_duration& d) {
    boost::hash<double> hasher;
    return hasher(d.m_storage);
}
} // end namespace perspective

namespace std {
std::ostream& operator<<(std::ostream& os, const perspective::t_duration& t);
}