/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

#include <perspective/first.h>
#include <perspective/date.h>

inline char*
strsep(char** stringp, const char* delim) {
    if (*stringp == NULL) {
        return NULL;
    }
    char* token_start = *stringp;
    *stringp = strpbrk(token_start, delim);
    if (*stringp) {
        **stringp = '\0';
        (*stringp)++;
    }
    return token_start;
}

namespace perspective {

t_date::t_date()
    : m_storage(0) {}

void
t_date::set_psp_date(t_uindex dt)

{
    m_storage = t_rawtype(dt);
}

t_date::t_date(std::int16_t year, std::int8_t month, std::int8_t day) {
    set_year_month_day(year, month, day);
}

static const std::vector<std::string> month_names = {"_____________________zero", "jan", "feb",
    "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"};

bool
t_date::from_string(const char* str, t_date& out) noexcept {

    int delpos = -1;
    auto len = strlen(str);
    for (int i = 0; i < int(len); ++i) {
        if (str[i] == '/' || str[i] == '-' || str[i] == ' ') {
            delpos = i;
            break;
        }
    }
    if (delpos == -1)
        return false;
    char delch = str[delpos];
    char delstr[2] = {delch, 0};

    char *token, *str_, *tofree;
    tofree = str_ = strdup(str);
    int tok = 0;
    int year = 0, month = 0, day = 0;
    while ((token = strsep(&str_, delstr))) {
        if (delch == '-') {
            if (tok == 0) {
                year = atoi(token);
            }
            if (tok == 1) {
                month = atoi(token);
            }
            if (tok == 2) {
                day = atoi(token);
            }
        }
        if (delch == '/') {
            if (tok == 0) {
                month = atoi(token);
            }
            if (tok == 1) {
                day = atoi(token);
            }
            if (tok == 2) {
                year = atoi(token);
            }
        }
        if (delch == ' ') {
            if (tok == 0) {
                std::string token_copy(token);
                for (auto& ch : token_copy)
                    ch = tolower(ch);
                auto it = std::find(month_names.begin(), month_names.end(), token_copy);
                if (it != month_names.end()) {
                    month = it - month_names.begin();
                } else
                    return false;
            }
            if (tok == 1) {
                day = atoi(token);
            }
            if (tok == 2) {
                year = atoi(token);
            }
        }
        ++tok;
    }
    free(tofree);

    if (year < 100)
        year = 2000 + year;

    out = t_date(year, month, day);

    return tok >= 3;
}

void
t_date::set_year_month_day(std::int16_t year, std::int8_t month, std::int8_t day) {
    m_storage = to_days(year, month, day);
}

bool
t_date::as_tm(struct tm& out) const {
    return gmtime(out, m_storage, 0) == 1;
}

std::int32_t
t_date::gmtime(struct tm& out, std::int32_t days, std::int32_t offset) const {
    std::int64_t y;
    const unsigned short int* ip;

    // Difference time between 1/1/1899 and 30/12/1899 is 363 days.
    days += 363;

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
t_date::to_days(std::int32_t year, std::int32_t month, std::int32_t day) {
    static std::int32_t EPOCH_ORD = ymd_to_ord(1899, 12, 30);
    std::int32_t days = ymd_to_ord(year, month, day) - EPOCH_ORD;
    return days;
}

/*void
t_date::set_year(std::int16_t year) {
    m_storage = (m_storage & ~YEAR_MASK) | (year << YEAR_SHIFT);
}
void
t_date::set_month(std::int8_t month) {
    m_storage = (m_storage & ~MONTH_MASK) | (month << MONTH_SHIFT);
}
void
t_date::set_day(std::int8_t day) {
    m_storage = (m_storage & ~DAY_MASK) | (day << DAY_SHIFT);
} */

t_date::t_date(std::int32_t raw_val)
    : m_storage(raw_val) {}

std::int32_t
t_date::raw_value() const {
    return m_storage;
}
// Index such that
// a.consecutive_day_idx()-b.consecutive_day_idx() is
// number of days a is after b.
//(Start point is unspecified, may not be stable and
// only works for dates after 1900AD.)
/*std::int32_t
t_date::consecutive_day_idx() const {
    std::int32_t m = month();
    std::int32_t y = year();
    std::int32_t yP = y - 1;
    std::int32_t leap_selector = (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)) ? 1 : 0;
    return day() + 365 * y + yP / 4 - yP / 100 + yP / 400
        + CUMULATIVE_DAYS[leap_selector][m - 1];
} */

/*t_date
from_consecutive_day_idx(std::int32_t idx) {
    std::int32_t y = static_cast<std::int32_t>(idx / 365.2425);
    std::int32_t yP = y - 1;
    std::int32_t idx_year_removed = idx - (y * 365 + yP / 4 - yP / 100 + yP / 400);
    std::int32_t tgt_substraction = (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)) ? 366 : 365;
    if (idx_year_removed > tgt_substraction) {
        idx_year_removed -= tgt_substraction;
        y += 1;
    }
    std::int32_t yearkind = (y % 4 == 0 && (y % 100 != 0 || y % 400 == 0)) ? 1 : 0;
    const std::int32_t* const pos = std::lower_bound(CUMULATIVE_DAYS[yearkind],
                                        CUMULATIVE_DAYS[yearkind] + 13, idx_year_removed)
        - 1;
    return t_date(
        y, std::distance(CUMULATIVE_DAYS[yearkind], pos) + 1, idx_year_removed - *pos );
    //return t_date(
    //    y, std::distance(CUMULATIVE_DAYS[yearkind], pos) + 1, idx_year_removed - *pos);
} */

std::int32_t
t_date::year(const struct tm& t) const {
    return t.tm_year + 1899;
}
std::int32_t
t_date::month(const struct tm& t) const {
    return t.tm_mon + 1;
}
std::int32_t
t_date::day(const struct tm& t) const {
    return t.tm_mday;
}

std::int32_t
t_date::weekday(const struct tm& t) const {
    return t.tm_wday;
}

std::string
t_date::str(const struct tm& t, t_dataformattype dftype) const {
    std::stringstream ss;

    if (dftype == DATA_FORMAT_DATE_V1) {
        ss << FULL_MONTHS[month(t) - 1] << " " << day(t) << ", " << year(t);
    } else if (dftype == DATA_FORMAT_DATE_V2) {
        ss << year(t) << "-" << str_(month(t)) << "-" << str_(day(t));
    } else if (dftype == DATA_FORMAT_DATE_V3) {
        ss << str_(month(t)) << "/" << str_(day(t)) << "/" << year(t);
    } else if (dftype == DATA_FORMAT_DAY_V1) {
        ss << FULL_MONTHS[month(t) - 1] << " " << str_(day(t));
    } else if (dftype == DATA_FORMAT_DAY_V2) {
        ss << str_(month(t)) << "-" << str_(day(t));
    } else if (dftype == DATA_FORMAT_DAY_V3) {
        ss << str_(month(t)) << "/" << str_(day(t));
    } else {
        PSP_COMPLAIN_AND_ABORT("Unrecognized data format type");
    }
    return ss.str();
}

double
t_date::agg_level_num(const struct tm& t, t_agg_level_type agg_level) const {
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

    default: {
        PSP_COMPLAIN_AND_ABORT("Unrecognized date aggregate level");
    } break;
    }
    
    return raw_value();
}

std::string
t_date::agg_level_str(const struct tm& t, t_agg_level_type agg_level) const {
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

    default: {
        PSP_COMPLAIN_AND_ABORT("Unrecognized date aggregate level");
    } break;
    }

    return ss.str();
}

} // end namespace perspective

namespace std {
std::ostream&
operator<<(std::ostream& os, const perspective::t_date& t) {
    struct tm tstruct;
    bool rcode = t.as_tm(tstruct);
    if (rcode) {
        os << "t_date<" << t.str(tstruct, perspective::DATA_FORMAT_DATE_V1) << ">" << std::endl;
    } else {
        os << "t_date<" << t.raw_value() << ">" << std::endl;
    }
    return os;
}
} // namespace std
