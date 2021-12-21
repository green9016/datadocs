/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/time.h>
#include <perspective/utils.h>

namespace perspective {

t_tdelta::t_tdelta()
    : v(0) {}

t_tdelta::t_tdelta(double v)
    : v(v) {}

t_tdelta&
t_tdelta::operator*=(std::int64_t multiplier) {
    v *= multiplier;
    return *this;
}

t_time::t_time()
    : m_storage(0) {}

t_time::t_time(double raw_val)
    : m_storage(raw_val) {}

t_time::t_time(int year, int month, int day, int hour, int min, int sec)
    : m_storage(to_gmtime(year, month, day, hour, min, sec)) {}

double
t_time::raw_value() const {
    return m_storage;
}

bool
operator<(const t_time& a, const t_time& b) {
    if (std::abs(a.m_storage - b.m_storage) < EPSILON) {
        return false;
    }
    return a.m_storage < b.m_storage;
}

bool
operator<=(const t_time& a, const t_time& b) {
    if (std::abs(a.m_storage - b.m_storage) < EPSILON) {
        return true;
    }
    return a.m_storage <= b.m_storage;
}

bool
operator>(const t_time& a, const t_time& b) {
    if (std::abs(a.m_storage - b.m_storage) < EPSILON) {
        return false;
    }
    return a.m_storage > b.m_storage;
}

bool
operator>=(const t_time& a, const t_time& b) {
    if (std::abs(a.m_storage - b.m_storage) < EPSILON) {
        return true;
    }
    return a.m_storage >= b.m_storage;
}

bool
operator==(const t_time& a, const t_time& b) {
    return std::abs(a.m_storage - b.m_storage) < EPSILON;
}

bool
operator!=(const t_time& a, const t_time& b) {
    return std::abs(a.m_storage - b.m_storage) >= EPSILON;
}

bool
t_time::as_tm(struct tm& out) const {
    return gmtime(out, as_seconds(), 0) == 1;
}

std::int32_t
isleap(long int year) {
    return (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)) ? 1 : 0;
}

std::int32_t
t_time::gmtime(struct tm& out, double secs, std::int32_t offset) const {
    std::int64_t days, rem, y;
    const unsigned short int* ip;

    days = static_cast<std::int64_t>(secs);

    rem = round((secs - days) * SECS_PER_DAY);

    // Difference time between 1/1/1899 and 30/12/1899 is 363 days.
    days += 363;

    rem += offset;
    while (rem < 0) {
        rem += SECS_PER_DAY;
        --days;
    }
    while (rem >= SECS_PER_DAY) {
        rem -= SECS_PER_DAY;
        ++days;
    }
    out.tm_hour = rem / SECS_PER_HOUR;
    rem %= SECS_PER_HOUR;
    out.tm_min = rem / 60;
    out.tm_sec = rem % 60;
    /* Dec 30, 1899 was a Saturday.  */
    out.tm_wday = (days) % 7;
    if (out.tm_wday < 0)
        out.tm_wday += 7;
    y = 1899;

#define DIV(a, b) ((a) / (b) - ((a) % (b) < 0))
#define LEAPS_THRU_END_OF(y) (DIV(y, 4) - DIV(y, 100) + DIV(y, 400))

    while (days < 0 || days >= (isleap(y) ? 366 : 365)) {
        /* Guess a corrected year, assuming 365 days per
         * year.  */
        long int yg = y + days / 365 - (days % 365 < 0);

        /* Adjust DAYS and Y to match the guessed year.
         */
        days -= ((yg - y) * 365 + LEAPS_THRU_END_OF(yg - 1) - LEAPS_THRU_END_OF(y - 1));
        y = yg;
    }
    out.tm_year = y - 1899;
    if (out.tm_year != y - 1899) {
        /* The year cannot be represented due to
         * overflow.  */
        return 0;
    }
    out.tm_yday = days;
    ip = __mon_yday[isleap(y)];
    for (y = 11; days < (long int)ip[y]; --y)
        continue;
    days -= ip[y];
    out.tm_mon = y;
    out.tm_mday = days + 1;
    return 1;
}

std::int32_t
t_time::year(const struct tm& t) const {
    return t.tm_year + 1899;
}
std::int32_t
t_time::month(const struct tm& t) const {
    return t.tm_mon + 1;
}
std::int32_t
t_time::day(const struct tm& t) const {
    return t.tm_mday;
}
std::int32_t
t_time::hours(const struct tm& t) const {
    return t.tm_hour;
}
std::int32_t
t_time::minutes(const struct tm& t) const {
    return t.tm_min;
}
std::int32_t
t_time::seconds(const struct tm& t) const {
    return t.tm_sec;
}

std::int32_t
t_time::weekday(const struct tm& t) const {
    return t.tm_wday;
}

/*std::int32_t
t_time::microseconds() const // component
{
    std::int32_t micros = m_storage % 1000000;
    return micros + ((micros >> 31) & 1000000);
} */

double
t_time::as_seconds() const {
    /*if (m_storage < 0 && m_storage % 1000000)
        return m_storage / 1000000 - 1;
    return m_storage / 1000000; */
    return m_storage;
}

std::string
t_time::str(const struct tm& t, t_dataformattype dftype) const {
    std::stringstream ss;

    double s = seconds(t);// + microseconds() / 1000000.0;

    /*ss << year(t) << "-" << str_(month(t)) << "-" << str_(day(t)) << " " << str_(hours(t))
       << ":" << str_(minutes(t)) << ":" << std::setfill('0') << std::setw(6) << std::fixed
       << std::setprecision(3) << s; */

    if (dftype == DATA_FORMAT_DATETIME) {
        ss << year(t) << "-" << str_(month(t)) << "-" << str_(day(t)) << " " << hours(t)
            << ":" << str_(minutes(t)) << ":" << std::setfill('0') << std::setw(2) << std::fixed
            << std::setprecision(0) << s;
    } else {
        PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
    }

    return ss.str();
}

double
t_time::agg_level_num(const struct tm& t, t_agg_level_type agg_level) const {
    switch(agg_level) {
    case AGG_LEVEL_YEAR: {
        return year(t);
    } break;

    case AGG_LEVEL_QUARTER: {
        return quarter_of_year(month(t) - 1) + 1;
    } break;

    case AGG_LEVEL_WEEK: {
        return week_of_year(year(t), month(t), day(t));
    } break;

    case AGG_LEVEL_MONTH: {
        return month(t) - 1;
    } break;

    case AGG_LEVEL_HOUR: {
        double h = hours(t);
        return (h/24);
    } break;

    case AGG_LEVEL_MINUTE: {
        double h = hours(t);
        double m = minutes(t);
        return (h*60 + m)/(24*60);
    } break;

    case AGG_LEVEL_SECOND: {
        double h = hours(t);
        double m = minutes(t);
        double s = seconds(t);
        return (h*60*60 + m*60 + s)/(24*60*60);
    } break;

    default: {
        PSP_COMPLAIN_AND_ABORT("Unrecognized date aggregate level");
    } break;
    }
    
    return raw_value();
}

std::string
t_time::agg_level_str(const struct tm& t, t_agg_level_type agg_level) const {
    std::stringstream ss;

    switch(agg_level) {
    case AGG_LEVEL_YEAR: {
        ss << year(t);
    } break;

    case AGG_LEVEL_QUARTER: {
        ss << "Q" << (quarter_of_year(month(t) - 1) + 1);
    } break;

    case AGG_LEVEL_MONTH: {
        ss << FULL_MONTHS[month(t) - 1];
    } break;

    case AGG_LEVEL_WEEK: {
        ss << "Wk " << week_of_year(year(t), month(t), day(t));
    } break;

    case AGG_LEVEL_DAY: {
        ss << WEEK_DAYS[weekday(t)] << ", " << FULL_MONTHS[month(t) - 1] << " " << str_(day(t));
    } break;

    case AGG_LEVEL_HOUR: {
        std::int32_t h = hours(t);
        std::int32_t period = h/12;
        std::int32_t formated_h = h > 12 ? h%12 : h;
        ss << formated_h << ":" << str_(0) << " " << TIME_PERIODS[period];
    } break;

    case AGG_LEVEL_MINUTE: {
        std::int32_t h = hours(t);
        std::int32_t period = h/12;
        std::int32_t formated_h = h > 12 ? h%12 : h;
        ss << formated_h << ":" << str_(minutes(t)) << " " << TIME_PERIODS[period];
    } break;

    case AGG_LEVEL_SECOND: {
        double s = seconds(t);
        ss << std::setfill('0') << std::setw(2) << std::fixed
            << std::setprecision(0) << s;
    } break;

    default: {
        PSP_COMPLAIN_AND_ABORT("Unrecognized date aggregate level");
    } break;
    }

    return ss.str();
}

std::int32_t
days_before_year(std::int32_t year) {
    std::int32_t y = year - 1;
    if (y >= 0)
        return y * 365 + y / 4 - y / 100 + y / 400;
    else {
        return -366;
    }
}

std::int32_t
days_before_month(std::int32_t year, std::int32_t month) {
    if (month < 1 || month > 12)
        return 0;
    return __mon_yday[isleap(year)][month - 1];
}

std::int32_t
ymd_to_ord(std::int32_t year, std::int32_t month, std::int32_t day) {
    return days_before_year(year) + days_before_month(year, month) + day;
}

double
to_gmtime(std::int32_t year, std::int32_t month, std::int32_t day, std::int32_t hour,
    std::int32_t min, std::int32_t sec) {
    std::stringstream time_value;
    static std::int32_t EPOCH_ORD = ymd_to_ord(1899, 12, 30);
    std::int64_t days = ymd_to_ord(year, month, day) - EPOCH_ORD;
    double time = static_cast<double>((hour * 60 + min) * 60 + sec)/(static_cast<double>(SECS_PER_DAY));
    time_value << std::setprecision(20) << time;
    int pos = time_value.str().find(".");
    std::string str_time = time_value.str().substr(pos + 1, time_value.str().length() - 1);
    std::string str_value = std::to_string(days) + "." + str_time;
    double value = atof(str_value.c_str());
    return static_cast<double>(value);
}

std::int32_t
quarter_of_year(std::int32_t month) {
    return month/3;
}

std::int32_t
day_of_year(std::int32_t year, std::int32_t month, std::int32_t day) {
    return ymd_to_ord(year, month, day) - ymd_to_ord(year - 1, 12, 31);
}

std::int32_t
day_of_weed(std::int32_t year, std::int32_t month, std::int32_t day) {
    std::int32_t days = ymd_to_ord(year, month, day);
    std::int32_t tm_wday = (days) % 7;
    if (tm_wday < 0)
        tm_wday += 7;
    
    return tm_wday;
}

std::int32_t
week_of_year(std::int32_t year, std::int32_t month, std::int32_t day) {
    std::int32_t days = day_of_year(year, month, day); // Jan 1 = 1, Jan 2 = 2, etc...
    std::int32_t dow = day_of_weed(year, month, day);   // Sun = 0, Mon = 1, etc...
    std::int32_t dow_jan1 = day_of_weed(year, 1, 1);   // find out first of year's day

    std::int32_t week_num = ((days + 6) / 7);
    if (dow < dow_jan1) {                 // adjust for being after Saturday of week #1
        ++week_num;
    }
    return week_num;
}

t_time&
t_time::operator+=(const t_tdelta& d) {
    m_storage += d.v;
    return *this;
}

t_time&
t_time::operator-=(const t_tdelta& d) {
    m_storage -= d.v;
    return *this;
}

t_tdelta
operator-(const t_time& a, const t_time& b) {
    return t_tdelta(a.m_storage - b.m_storage);
}

} // end namespace perspective

namespace std {
std::ostream&
operator<<(std::ostream& s, const perspective::t_tdelta& td) {
    s << "t_tdelta(" << td.v << ")";
    return s;
}

std::ostream&
operator<<(std::ostream& os, const perspective::t_time& t) {
    struct tm tstruct;
    bool rcode = t.as_tm(tstruct);
    if (rcode) {
        os << "t_time<" << t.str(tstruct, perspective::DATA_FORMAT_DATETIME) << ">" << std::endl;
    } else {
        os << "t_time<" << t.raw_value() << ">" << std::endl;
    }

    return os;
}
} // namespace std
