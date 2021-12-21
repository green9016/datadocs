#include <stddef.h>
#include <stdint.h>
#include <ctype.h>
#include <cctype>
#include <cmath>
#include <limits>
#include <regex>

#include "utility.h"

namespace Ingest {

bool str_endswith_lc(const std::string& s, const std::string_view& suffix)
{
	return s.size() >= suffix.size() && std::equal(suffix.rbegin(), suffix.rend(), s.rbegin(),
		[](char a, char b) { return ::tolower(a) == b; }
	);
}

bool is_integer(double v)
{ return v >= std::numeric_limits<int64_t>::min() && v <= std::numeric_limits<int64_t>::max() && v == std::trunc(v); }

static const char* _weekdays[] = { "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday" };
static const char* _months[] = { "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december" };

static const std::regex _re_z(R"([+-]\d\d:?[0-5]\d(:?[0-5]\d(\.\d{1,6})?)?)", std::regex::nosubs);

inline static char _to_lower(char c)
{
	return c >= 'A' && c <= 'Z' ? c - ('A' - 'a') : c;
}

static bool find_string(const char*& src, const char** lookup, size_t size, int& result)
{
	for (size_t n = 0; n < size; ++n)
	{
		const char* cmp = lookup[n];
		for (size_t i = 0; ; ++i)
		{
			char c = _to_lower(src[i]);
			if (c != cmp[i])
			{
				if (i < 3)
					break;
				result = (int)n + 1;
				src += cmp[i] == '\0' ? i : 3; // matched whole string or first three chars
				return true;
			}
			else if (c == '\0') // matched to the end of src
			{
				result = (int)n + 1;
				src += i;
				return true;
			}
		}
	}
	return false;
}

static int read_number(const char*& src, size_t limit, int& result)
{
	int n = 0;
	size_t i;
	for (i = 0; i < limit; ++i)
	{
		char c = src[i];
		if (c < '0' || c > '9')
			break;
		n *= 10;
		n += c - '0';
	}
	if (i > 0)
	{
		result = n;
		src += i;
	}
	return (int)i;
}

bool strptime(const std::string& s_src, const std::string& s_fmt, double& dt)
{
	int day = 1;
	int month = 1;
	int year = 1904;
	int h = 0;
	bool h_12 = false;
	int m = 0;
	int s = 0;
	int ms = 0;
	int weekday = 0;
	bool h_pm = false;
	const char* src = s_src.data();
	for (const char* fmt = s_fmt.data(); *fmt != 0; ++fmt)
	{
		switch (*fmt)
		{
		case '%':
			switch (*++fmt)
			{
			case 'a':
			case 'A':
				if (!find_string(src, _weekdays, 7, weekday)) return false;
				break;
			case 'd':
				if (!read_number(src, 2, day) || day == 0) return false;
				break;
			case 'b':
			case 'B':
				if (!find_string(src, _months, 12, month)) return false;
				break;
			case 'm':
				if (!read_number(src, 2, month) || month == 0 || month > 12) return false;
				break;
			case 'y':
				if (read_number(src, 2, year) != 2) return false;
				year += year < 68 ? 2000 : 1900;
				break;
			case 'Y':
				if (read_number(src, 4, year) != 4 || year == 0) return false;
				break;
			case 'H':
				if (!read_number(src, 2, h) || h > 23) return false;
				h_12 = false;
				break;
			case 'I':
				if (!read_number(src, 2, h) || h == 0 || h > 12) return false;
				if (h == 12)
					h = 0;
				h_12 = true;
				break;
			case 'p':
				if (_to_lower(src[1]) != 'm')
					return false;
				if (char c = _to_lower(*src); c == 'p')
					h_pm = true;
				else if (c != 'a')
					return false;
				src += 2;
				break;
			case 'M':
				if (!read_number(src, 2, m) || m > 59) return false;
				break;
			case 'S':
				if (!read_number(src, 2, s) || s > 59) return false;
				break;
			case 'f':
				if (int i; !(i = read_number(src, 6, ms))) return false;
				else
					while (i < 6)
						ms *= 10, ++i;
				break;
			case 'z':
				{
					std::cmatch mm;
					if (!std::regex_search(src, mm, _re_z, std::regex_constants::match_continuous))
						return false;
					src += mm.length();
				}
				break;
			case 'Z':
				while (std::isalnum(*src)) ++src;
				break;
			case '%':
				if (*src++ != '%')
					return false;
				break;
			default:
				return false;
			}
			break;
		case ' ':
		case '\t':
		case '\r':
		case '\n':
		case '\f':
		case '\v':
			while (std::isspace(*src))
				++src;
			break;
		default:
			if (*src++ != *fmt)
				return false;
			break;
		}
	}
	if (*src != '\0')
		return false;

	int max_day;
	if (month == 4 || month == 6 || month == 9 || month == 11)
		max_day = 30;
	else if (month == 2)
		max_day = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0) ? 29 : 28;
	else
		max_day = 31;
	if (day > max_day)
		return false;
	if (h_12 && h_pm)
		h += 12;

	int y = year;
	y -= month <= 2;
	int era = (y >= 0 ? y : y - 399) / 400;
	unsigned yoe = (unsigned)(y - era * 400); // [0, 399]
	unsigned doy = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1; // [0, 365]
	unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy; // [0, 146096]
	dt = era * 146097 + (int)doe - 719468 + 25569 +
		(h * 3600 + m * 60 + s + ms / 1000000.0) / 86400.0;
	return true;
}

//double strptime(const std::string& src, const std::string& fmt)
//{
//	double dt;
//	if (!strptime(src.data(), fmt.data(), dt))
//		throw std::invalid_argument("invalid value");
//	return dt;
//}

}
