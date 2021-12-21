#include <perspective/first.h>
#include <perspective/duration.h>

namespace perspective {
t_duration::t_duration()
    : m_storage(0) {}

void
t_duration::set_psp_duration(t_uindex dt)

{
    m_storage = t_rawtype(dt);
}

t_duration::t_duration(std::int8_t hour, std::int8_t minute, std::int8_t second) {
    set_hour_minute_second(hour, minute, second);
}

void
t_duration::set_hour_minute_second(std::int8_t hour, std::int8_t minute, std::int8_t second) {
    std::int64_t time = (hour*60 + minute)*60 + second;
    m_storage = static_cast<double>(time)/(24*60*60);
}

std::int32_t
t_duration::hour() const {
    std::int64_t secs = round(m_storage * SECS_PER_DAY);
    return static_cast<std::int32_t>(secs / SECS_PER_HOUR);
}
std::int32_t
t_duration::minute() const {
    std::int64_t secs = round(m_storage * SECS_PER_DAY);
    secs %= SECS_PER_HOUR;
    return static_cast<std::int32_t>(secs/60);
}
std::int32_t
t_duration::second() const {
    std::int64_t secs = round(m_storage * SECS_PER_DAY);
    secs %= SECS_PER_HOUR;
    return static_cast<std::int32_t>(secs%60);
}

t_duration::t_duration(double raw_val)
    : m_storage(raw_val) {}

double
t_duration::raw_value() const {
    return m_storage;
}

bool
operator<(const t_duration& a, const t_duration& b) {
    if (std::abs(a.m_storage - b.m_storage) < EPSILON) {
        return false;
    }
    return a.m_storage < b.m_storage;
}
bool
operator<=(const t_duration& a, const t_duration& b) {
    return (a.m_storage <= b.m_storage) || (std::abs(a.m_storage - b.m_storage) < EPSILON);
}
bool
operator>(const t_duration& a, const t_duration& b) {
    if (std::abs(a.m_storage - b.m_storage) < EPSILON) {
        return false;
    }
    return a.m_storage > b.m_storage;
}
bool
operator>=(const t_duration& a, const t_duration& b) {
    return (a.m_storage >= b.m_storage) || (std::abs(a.m_storage - b.m_storage) < EPSILON);
}
bool
operator==(const t_duration& a, const t_duration& b) {
    //return a.m_storage == b.m_storage;
    return std::abs(a.m_storage - b.m_storage) < EPSILON;
}
bool
operator!=(const t_duration& a, const t_duration& b) {
    //return a.m_storage != b.m_storage;
    return std::abs(a.m_storage - b.m_storage) >= EPSILON;
}

std::string
t_duration::str(t_dataformattype dftype) const {
    std::stringstream ss;
    if (dftype == DATA_FORMAT_DURATION) {
        //ss << str_(hour()) << ":" << str_(minute()) << ":" << str_(second());
        ss << hour() << ":" << str_(minute()) << ":" << str_(second());
    } else if (dftype == DATA_FORMAT_TIME) {
        std::int32_t h = hour();
        std::int32_t period = h/12;
        std::int32_t formated_h = h > 12 ? h%12 : h;
        std::int32_t s = second();
        ss << formated_h << ":" << str_(minute());
        if (s > 0) {
            ss << ":" << str_(s);
        }
        ss << " " << TIME_PERIODS[period];
    } else {
        PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
    }
    return ss.str();
}

double
t_duration::agg_level_num(t_agg_level_type agg_level) const {
    if (agg_level == AGG_LEVEL_HOUR) {
        return double(hour())/24;
    } else if (agg_level == AGG_LEVEL_MINUTE) {
        return double((hour()*60 + minute()))/(24*60);
    }
    return raw_value();
}

std::string
t_duration::agg_level_str(t_dataformattype dftype, t_agg_level_type agg_level) const {
    std::stringstream ss;
    if (dftype == DATA_FORMAT_DURATION) {
        ss << hour() << ":";
        if (agg_level == AGG_LEVEL_HOUR) {
            ss << str_(0);
        } else if (agg_level == AGG_LEVEL_MINUTE) {
            ss << str_(minute());
        } else {
            PSP_COMPLAIN_AND_ABORT("Unrecognized aggregate level");
            return "";
        }
    } else if (dftype == DATA_FORMAT_TIME) {
        std::int32_t h = hour();
        std::int32_t period = h/12;
        std::int32_t formated_h = h > 12 ? h%12 : h;
        ss << formated_h << ":";
        if (agg_level == AGG_LEVEL_HOUR) {
            ss << str_(0);
        } else if (agg_level == AGG_LEVEL_MINUTE) {
            ss << str_(minute());
        } else {
            PSP_COMPLAIN_AND_ABORT("Unrecognized aggregate level");
            return "";
        }
        ss << " " << TIME_PERIODS[period];
    } else {
        PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
    }
    //std::int32_t m_second = second();
    return ss.str();
}

} // end namespace perspective

namespace std {
std::ostream&
operator<<(std::ostream& os, const perspective::t_duration& t) {
    os << t.str(perspective::DATA_FORMAT_DURATION);
    return os;
}
}