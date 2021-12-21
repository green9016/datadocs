#include <ctype.h>
#include <cstdlib>
#include <cctype>
#include <cmath>
#include <ctime>
#include <type_traits>
#include <utility>
#include <functional>
#include <tuple>
#include <unordered_set>
#include <sstream>
#include <iomanip>
#include <regex>

#include "inferrer.h"
#include "file_reader.h"
#include "csv_reader.h"
#include "xls_reader.h"
#include "zip_reader.h"
#include "utility.h"

namespace std
{
	template<> struct hash<Ingest::CellRawDate>
	{
		size_t operator() (const Ingest::CellRawDate& v) const noexcept
		{
			return std::hash<double>()(v.d);
		}
	};
}

namespace Ingest {

static bool cell_empty(const CellRaw& cell)
{
	const std::string* s = std::get_if<std::string>(&cell);
	return s && s->empty();
}

static bool cell_null_str(const CellRaw& cell)
{
	const std::string* s = std::get_if<std::string>(&cell);
	return s && (*s == "NULL" || *s == "null");
}

Parser::~Parser() {}

Parser* Parser::get_parser(const std::string& filename)
{
	return get_parser_from_reader(std::make_shared<FileReader>(filename));
}

Parser* Parser::get_parser_from_reader(std::shared_ptr<BaseReader> reader)
{
	Parser* parser = nullptr;
	for (auto create_func : { ZIPParser::create_parser, XLSXParser::create_parser, XLSParser::create_parser, CSVParser::create_parser })
	{
		parser = create_func(reader);
		if (parser)
			break;
		reader->close();
	}
	return parser;
}

bool Parser::open()
{
	return true;
}

void Parser::close() {}

typedef int (*ConvertFunc)(CellRaw& src, Cell& dst, const ColumnDefinition& format);

static int ConvertToString(CellRaw& src, Cell& dst, const ColumnDefinition& format)
{
	std::visit(overloaded{
	[&](std::string& s) { dst = std::move(s); },
	[&](int64_t v) { dst = std::to_string(v); },
	[&](bool v) { dst.emplace<std::string>(v ? "true" : "false"); },
	[&](double v) { std::ostringstream ss; ss << v; dst = ss.str(); },
	[&](const CellRawDate& v)
	{
		double value = v.d;
		const char* fmt;
		std::tm tm = {};
		if (value >= 1.0)
		{
			int l = (int)value + 68569 + 2415019;
			int n = 4 * l / 146097;
			l -= (146097 * n + 3) / 4;
			int i = 4000 * (l + 1) / 1461001;
			l -= 1461 * i / 4 - 31;
			int j = 80 * l / 2447;
			tm.tm_mday = l - 2447 * j / 80;
			l = j / 11;
			tm.tm_mon = j + 2 - 12 * l - 1;
			tm.tm_year = 100 * (n - 49) + i + l - 1900;
			/*tm.tm_year = 400;
			tm.tm_mday = (int)value - 1;
			std::mktime(&tm);
			tm.tm_year -= 400;*/
		}
		if (value != std::trunc(value))
		{
			int time = std::lround((value - int(value)) * 86400.0);
			tm.tm_hour = time / 3600;
			time %= 3600;
			tm.tm_min = time / 60;
			tm.tm_sec = time % 60;
			fmt = value > 1.0 ? "%Y-%m-%d %H:%M:%S" : "%H:%M:%S";
		}
		else
			fmt = "%Y-%m-%d";
		std::ostringstream ss;
		ss << std::put_time(&tm, fmt);
		dst = ss.str();
	}
	}, src);
	return 1;
}

static std::string ConvertRawToString(CellRaw& src)
{
	Cell tmp;
	ConvertToString(src, tmp, ColumnDefinition());
	return std::move(std::get<std::string>(tmp));
}

static const std::unordered_map<std::string, bool> _bool_dict {
	{"0", false}, {"1", true},
	{"false", false}, {"False", false}, {"FALSE", false}, {"true", true}, {"True", true}, {"TRUE", true},
	{"n", false}, {"N", false}, {"no", false}, {"No", false}, {"NO", false},
	{"y", true}, {"Y", true}, {"yes", true}, {"Yes", true}, {"YES", true}
};

static int ConvertToBool(CellRaw& src, Cell& dst, const ColumnDefinition& format)
{
	return std::visit(overloaded{
	[&](const std::string& s) -> int
	{
		if (s.empty())
			return 0;
		auto it = _bool_dict.find(s);
		if (it == _bool_dict.end())
			return -1; //throw std::invalid_argument("invalid value");
		dst = it->second;
		return 1;
	},
	[&](bool v) -> int
	{
		dst = v;
		return 1;
	},
	[&](int64_t v) -> int
	{
		if (v != 0 && v != 1)
			return -1;
		dst = (bool)v;
		return 1;
	},
	[](auto v) -> int
	{ return -1;},
	}, src);
}

static int ConvertToInteger(CellRaw& src, Cell& dst, const ColumnDefinition& format)
{
	return std::visit(overloaded{
	[&](const std::string& s) -> int
	{
		if (s.empty())
			return 0;
		char* endptr; //size_t pos;
		int64_t v = std::strtoll(s.data(), &endptr, 10); //std::stoll(s, &pos);
		if (*endptr) //(pos != s.size())
		{
			double d = std::strtod(s.data(), &endptr);
			if (*endptr || !is_integer(d))
				return -1;
			dst = (int64_t)d;
			return 1;
		}
		dst = v;
		return 1;
	},
	[&](double v) -> int
	{
		if (!is_integer(v))
			return -1;
		dst = (int64_t)v;
		return 1;
	},
	[&](auto v) -> int
	{
		if constexpr (std::is_integral_v<decltype(v)>)
		{
			dst = static_cast<int64_t>(v);
			return 1;
		}
		else
			return -1;
	},
	}, src);
}

static int ConvertToDouble(CellRaw& src, Cell& dst, const ColumnDefinition& format)
{
	return std::visit(overloaded{
	[&](const std::string& s) -> int
	{
		if (s.empty())
			return 0;
		char* endptr; //size_t pos;
		double v = std::strtod(s.data(), &endptr); //double v = std::stod(s, &pos);
		if (*endptr) //(pos != s.size())
			return -1; //throw std::invalid_argument("invalid value");
		dst = v;
		return 1;
	},
	[&](auto v) -> int
	{
		if constexpr (std::is_arithmetic_v<decltype(v)>)
		{
			dst = static_cast<double>(v);
			return 1;
		}
		else
			return -1;
	},
	}, src);
}

static int ConvertToDate(CellRaw& src, Cell& dst, const ColumnDefinition& format)
{
	return std::visit(overloaded{
	[&](const std::string& s) -> int
	{
		if (s.empty())
			return 0;
		// dst.emplace<int32_t>((int)strptime(s, format.format));
		double t;
		if (!strptime(s, format.format, t))
			return -1;
		dst.emplace<int32_t>((int)t);
		return 1;
	},
	[&](const CellRawDate& v) -> int
	{
		dst.emplace<int32_t>((int)v.d);
		return 1;
	},
	[](auto v) -> int { return -1; },
	}, src);
}

static int ConvertToTime(CellRaw& src, Cell& dst, const ColumnDefinition& format)
{
	return std::visit(overloaded{
	[&](const std::string& s) -> int
	{
		if (s.empty())
			return 0;
		double t; // = strptime(s, format.format);
		if (!strptime(s, format.format, t))
			return -1;
		dst.emplace<double>(t - int(t));
		return 1;
	},
	[&](const CellRawDate& v) -> int
	{
		dst.emplace<double>(v.d - std::trunc(v.d));
		return 1;
	},
	[](auto v) -> int { return -1; },
	}, src);
}

static int ConvertToDateTime(CellRaw& src, Cell& dst, const ColumnDefinition& format)
{
	return std::visit(overloaded{
	[&](const std::string& s) -> int
	{
		if (s.empty())
			return 0;
		//dst.emplace<double>(strptime(s, format.format));
		double t;
		if (!strptime(s, format.format, t))
			return -1;
		dst.emplace<double>(t);
		return 1;
	},
	[&](const CellRawDate& v) -> int
	{
		dst.emplace<double>(v.d);
		return 1;
	},
	[](auto v) -> int { return -1; },
	}, src);
}

static ConvertFunc _converters[] = { ConvertToString, ConvertToBool, ConvertToInteger, ConvertToDouble, ConvertToDate, ConvertToTime, ConvertToDateTime };

static int ConvertToList(CellRaw& src, Cell& dst, const ColumnDefinition& format)
{
	const std::string* sp = std::get_if<std::string>(&src);
	if (!sp)
		return -1;
	const std::string& s = *sp;
	if (s.empty())
		return 0;
	ConvertFunc converter = _converters[static_cast<size_t>(format.column_type)];
	std::vector<Cell> values;

	size_t pos, last_pos, new_pos, end_pos;
	if (s.front() == '<' && s.back() == '>')
	{
		pos = 1;
		last_pos = s.size() - 1;
		while (pos < last_pos && std::isspace(s[pos]))
			++pos;
		while (pos < last_pos && std::isspace(s[last_pos - 1]))
			--last_pos;
		if (pos == last_pos) // empty list "<   >"
		{
			dst.emplace<std::vector<Cell>>(std::move(values));
			return 1;
		}
	}
	else
	{
		pos = 0;
		last_pos = s.size();
	}
	while (true)
	{
		new_pos = end_pos = s.find(',', pos);
		if (end_pos == std::string::npos)
			end_pos = last_pos;
		while (pos < end_pos && std::isspace(s[pos]))
			++pos;
		while (pos < end_pos && std::isspace(s[end_pos - 1]))
			--end_pos;
		CellRaw value = s.substr(pos, end_pos - pos);
		if (converter(value, values.emplace_back(), format) != 1)
			return -1;
		if (new_pos == std::string::npos)
			break;
		pos = new_pos + 1;
	}
	dst.emplace<std::vector<Cell>>(std::move(values));
	return 1;
}

bool Parser::get_next_row(Row& row)
{
	RowRaw raw_row;
	int64_t row_number = get_next_row_raw(raw_row);
	if (row_number < 0)
		return false;
	const Schema& schema = *get_schema();
	size_t n_columns = schema.columns.size();
	row.values.resize(n_columns);
	row.flagmap.resize(n_columns);
	std::unordered_map<int, ErrorType> errors;
	for (size_t i_col = 0; i_col < n_columns; ++i_col)
	{
		const ColumnDefinition& col = schema.columns[i_col];
		if (col.index >= 0)
		{
			if (col.index >= (int)raw_row.size())
				row.flagmap[i_col] = false;
			else
			{
				CellRaw& cell = raw_row[col.index];
				if (schema.remove_null_strings && cell_null_str(cell))
					row.flagmap[i_col] = false;
				else
				{
					int res = col.is_list ?
						ConvertToList(cell, row.values[i_col], col) :
						_converters[static_cast<size_t>(col.column_type)](cell, row.values[i_col], col);
					if (res >= 0)
						row.flagmap[i_col] = (bool)res;
					else
					{
						errors[(int)i_col] = { ErrorCode::TypeError, ConvertRawToString(cell) };
						row.flagmap[i_col] = false;
					}
				}
			}
		}
		else
		{
			switch (col.index)
			{
			case COL_ROWNUM:
				row.flagmap[i_col] = true;
				row.values[i_col].emplace<int32_t>(row_number);
				break;
			//GAB: no more needed
			//case COL_COUNT:
			//	row.flagmap[i_col] = true;
			//	row.values[i_col].emplace<int8_t>(1);
			//	break;
			case COL_ERROR:
				row.flagmap[i_col] = errors.size() > 0;
				row.values[i_col] = std::move(errors);
				break;
			}
		}
	}
	return true;
}

int Parser::get_percent_complete()
{
	return 0;
}

size_t Parser::get_sheet_count()
{
	return 0;
}

std::vector<std::string> Parser::get_sheet_names()
{
	return std::vector<std::string>();
}

bool Parser::select_sheet(const std::string& sheet_name)
{
	return false;
}

bool Parser::select_sheet(size_t sheet_number)
{
	return false;
}

size_t Parser::get_file_count()
{
	return 0;
}

std::vector<std::string> Parser::get_file_names()
{
	return std::vector<std::string>();
}

bool Parser::select_file(const std::string& file_name)
{
	return false;
}

bool Parser::select_file(size_t file_number)
{
	return false;
}

namespace {

template<ColumnType column_type>
class TType
{
public:
	bool create_schema(ColumnDefinition& col) const
	{
		if (m_valid)
			col.column_type = column_type;
		return m_valid;
	}

	int infer(const CellRaw& cell) = delete;

	bool m_valid = true;
};

template<>
int TType<ColumnType::Boolean>::infer(const CellRaw& cell)
{
	if (!m_valid)
		return 0;
	return m_valid = std::visit(overloaded{
	[](const std::string& s) -> bool { return _bool_dict.find(s) != _bool_dict.end(); },
	[](bool v) -> bool { return true; },
	[](int64_t v) -> bool { return v == 0 || v == 1; },
	[](auto v) -> bool { return false; },
	}, cell);
}

static const std::regex _re_check_integer(R"(0|-?[1-9]\d*)");
template<>
int TType<ColumnType::Integer>::infer(const CellRaw& cell)
{
	if (!m_valid)
		return 0;
	return m_valid = std::visit(overloaded{
	[](const std::string& s) -> bool { return std::regex_match(s, _re_check_integer); },
	[](double v) -> bool { return is_integer(v); },
	[](auto v) -> bool { return std::is_integral_v<decltype(v)>; },
	}, cell);
}

template<>
int TType<ColumnType::Integer32>::infer(const CellRaw& cell)
{
  if (!m_valid)
    return 0;
  return m_valid = std::regex_match(std::get<std::string>(cell), _re_check_integer);
}

template<>
int TType<ColumnType::Integer16>::infer(const CellRaw& cell)
{
  if (!m_valid)
    return 0;
  return m_valid = std::regex_match(std::get<std::string>(cell), _re_check_integer);
}

template<>
int TType<ColumnType::Integer8>::infer(const CellRaw& cell)
{
  if (!m_valid)
    return 0;
  return m_valid = std::regex_match(std::get<std::string>(cell), _re_check_integer);
}

static const std::regex _re_check_decimal(R"([+-]?(0|[1-9]\d*|\d+\.|\d*\.\d+)([eE][+-]\d+)?)", std::regex::nosubs);

template<>
int TType<ColumnType::Decimal>::infer(const CellRaw& cell)
{
	if (!m_valid)
		return 0;
	return m_valid = std::visit(overloaded{
	[](const std::string& s) -> bool { return std::regex_match(s, _re_check_decimal); },
	[](auto v) -> bool { return std::is_arithmetic_v<decltype(v)>; },
	}, cell);
}

static const std::unordered_map<std::string, char> _dt_tokens {
	{"utc", 'Z'}, {"gmt", 'Z'},
	{"am", 'p'}, {"pm", 'p'},
	{"sunday", 'a'}, {"monday", 'a'}, {"tuesday", 'a'}, {"wednesday", 'a'}, {"thursday", 'a'}, {"friday", 'a'}, {"saturday", 'a'},
	{"sun", 'a'}, {"mon", 'a'}, {"tue", 'a'}, {"wed", 'a'}, {"thu", 'a'}, {"fri", 'a'}, {"sat", 'a'},
	{"january", 'b'}, {"february", 'b'}, {"march", 'b'}, {"april", 'b'}, {"may", 'b'}, {"june", 'b'}, {"july", 'b'}, {"august", 'b'}, {"september", 'b'}, {"october", 'b'}, {"november", 'b'}, {"december", 'b'},
	{"jan", 'b'}, {"feb", 'b'}, {"mar", 'b'}, {"apr", 'b'}, {"may", 'b'}, {"jun", 'b'}, {"jul", 'b'}, {"aug", 'b'}, {"sep", 'b'}, {"oct", 'b'}, {"nov", 'b'}, {"dec", 'b'}
};

// time | number | word | non-word
static const std::regex _re_dt_components(R"((\d\d?\s*:\s*\d\d(?:\s*:\s*\d\d(?:[.,]\d{1,6})?)?(?!\d))|(\d+)|[a-zA-Z]+|[^\da-zA-Z]+)");

class TDateTime
{
public:
	bool infer_dt_format(const std::string& input_string, bool month_first = true)
	{
		char c;
		std::string fmt_s; // current format string with "%_" placeholders for d/m/y tokens
		std::vector<std::pair<int, int>> dmy_pos_length; // positions of '_' placeholders in fmt_s and lengths of corresponding d/m/y tokens (1- or 2- digits)

		int where_hour = -1; // position of 'H' in fmt_s
		int where_year = -1; // if found definite year token - how many d/m/y placeholders were found before it
		bool have_ampm = false, have_month = false;
		// separate time, numbers, words and delimiters, time is H:MM[:SS[.FFFFFF]]
		for (std::sregex_iterator m(input_string.begin(), input_string.end(), _re_dt_components); m != std::sregex_iterator(); ++m)
		{
			if ((*m)[2].matched) // token is number
			{
				int lng = (int)m->length();
				if ((lng == 4 || lng == 6) && m->position() > 0 && (c = input_string[m->position() - 1], c == '+' || c == '-') && // may be timezone offset -0100
						!(lng == 4 && std::stoi(m->str()) > 1500)) // though it also may be year. Limit offset to 1500 in the hopes that Samoa or Kiribati won't shift further east.
				{
					fmt_s.back() = '%'; // instead of previous '+|-'
					fmt_s += 'z';
				}
				else
				{
					if (lng == 8 && "19000101" <= (*m)[0] && (*m)[0] <= "20991231") // YYYYMMDD
					{
						if (where_year >= 0)
							return false;
						fmt_s += "%Y%m";
						where_year = (int)dmy_pos_length.size();
						have_month = true;
						lng = 2; // let day be handled by regular algorithm
					}
					if (lng == 4) // four digits is year
					{
						if (where_year >= 0)
							return false;
						fmt_s += "%Y";
						where_year = (int)dmy_pos_length.size();
					}
					else if (lng < 3) // found a d/m/y token, split format string here
					{
						fmt_s += "%_";
						dmy_pos_length.emplace_back((int)fmt_s.size() - 1, lng); // length is 1 or 2
					}
					else // wrong number of digits
						return false;
				}
			}
			else if ((*m)[1].matched) // valid time sequence, encode as 't'
			{
				if (where_hour >= 0)
					return false;
				where_hour = (int)fmt_s.size() + 1; // first token to append is '%H'
				static const char time_fmt[] = { 'H', 'M', 'S', 'f' };
				size_t i_fmt = 0;
				bool in_digits = false;
				for (auto i = (*m)[0].first, end = (*m)[0].second; i < end; ++i) // substitute all numbers in time with corresponding format codes
				{
					bool is_digit = std::isdigit(*i);
					if (!is_digit)
						fmt_s += *i;
					else if (!in_digits)
						fmt_s += {'%', time_fmt[i_fmt++]};
					in_digits = is_digit;
				}
			}
			else
			{
				std::string s = m->str();
				std::transform(s.begin(), s.end(), s.begin(), ::tolower);
				auto new_s = _dt_tokens.find(s); // find a format code of a word
				if (new_s == _dt_tokens.end())
				{
					for (auto i = (*m)[0].first, end = (*m)[0].second; i < end; ++i)
					{
						if (*i == '%') // escape literal %
							fmt_s += '%';
						fmt_s += *i;
					}
				}
				else
				{
					if (new_s->second == 'p')
						have_ampm = true;
					else if (new_s->second == 'b') // || new_s->second == 'B')
						have_month = true;
					fmt_s += {'%', new_s->second};
				}
			}
		}

		if (have_ampm && where_hour >= 0) // use 12-hour format if am/pm found
			fmt_s[where_hour] = 'I';

		double t = 0.0;
		size_t n_dmy = dmy_pos_length.size(), n_tokens;
		const char* dmys;
		if (n_dmy > 0) // sequence of applied d/m/y combinations in priority order
		{
			if (have_month) // month in fixed position
				if (where_year < 0)
					dmys = "dy" "yd", n_tokens = 2;
				else
					dmys = "d", n_tokens = 1;
			else
				if (where_year < 0)
					if (month_first)
						dmys = "mdy" "dmy" "ymd" "ydm" "myd" "dym", n_tokens = 3;
					else
						dmys = "dmy" "mdy" "ymd" "ydm" "myd" "dym", n_tokens = 3;
				else if (!month_first && where_year >= 2) // month_first=False only applies when year is last
					dmys = "dm" "md", n_tokens = 2;
				else
					dmys = "md" "dm", n_tokens = 2;
			if (n_tokens != n_dmy) // wrong number of d/m/y tokens
				return false;

			for (const char* dmy = dmys; *dmy; dmy += n_dmy) // try all possible combinations of d/m/y
			{
				for (size_t i = 0; i < n_dmy; ++i) // substitute each token
				{
					if (dmy[i] == 'y' && dmy_pos_length[i].second == 1) // year can only be 2-digit, skip this combination
						goto continue_dmy_loop;
					fmt_s[dmy_pos_length[i].first] = dmy[i]; // put format specifier into its place
				}
				if (strptime(input_string, fmt_s, t))
					m_formats.push_back(fmt_s);
			continue_dmy_loop:;
			}

			m_have_date = true;
			if (where_hour >= 0 && t - int(t) != 0.0)
				m_have_time = true;
		}
		else // only time
		{
			if (where_hour < 0) // neither time nor date found
				return false;
			if (strptime(input_string, fmt_s, t))
				m_formats.push_back(fmt_s);
			m_have_time = true;
		}
		return !m_formats.empty();
	}

	int infer(const CellRaw& cell)
	{
		if (!m_valid)
			return 0;
		return m_valid = std::visit(overloaded{
		[this](const std::string& input_string) -> bool
		{
			if (m_formats.empty())
				return infer_dt_format(input_string);
			for (auto it = m_formats.end(); it > m_formats.begin();)
			{
				--it;
				double t;
				if (!strptime(input_string, *it, t))
					it = m_formats.erase(it);
				else if (t - int(t) != 0.0)
					m_have_time = true;
			}
			return !m_formats.empty();
		},
		[this](const CellRawDate& v) -> bool
		{
			double value = v.d;
			if (!m_have_time && value != std::trunc(value))
				m_have_time = true;
			if (!m_have_date && value >= 1.0)
				m_have_date = true;
			return true;
		},
		[](auto v) -> bool { return false; },
		}, cell);
	}

	bool create_schema(ColumnDefinition& col) const
	{
		if (m_valid)
		{
			if (m_have_date)
				col.column_type = m_have_time ? ColumnType::Datetime : ColumnType::Date;
			else
				col.column_type = ColumnType::Time;
			if (!m_formats.empty())
				col.format = std::move(m_formats[0]);
		}
		return m_valid;
	}

	bool m_valid = true;
	bool m_have_time = false;
	bool m_have_date = false;
	std::vector<std::string> m_formats;
};

class TList
{
public:
	int infer(const CellRaw& cell)
	{
		if (!m_valid)
			return 0;
		const std::string* sp = std::get_if<std::string>(&cell);
		if (!sp)
			return m_valid = false;
		const std::string& s = *sp;

		size_t pos, last_pos, new_pos, end_pos;
		if (s.front() == '<' && s.back() == '>')
		{
			pos = 1;
			last_pos = s.size() - 1;
			while (pos < last_pos && std::isspace(s[pos]))
				++pos;
			while (pos < last_pos && std::isspace(s[last_pos - 1]))
				--last_pos;
			if (pos == last_pos) // empty list "<   >"
				return 1;
		}
		else
		{
			pos = 0;
			last_pos = s.size();
		}
		while (true)
		{
			new_pos = end_pos = s.find(',', pos);
			if (end_pos == std::string::npos)
				end_pos = last_pos;
			while (pos < end_pos && std::isspace((unsigned char)s[pos]))
				++pos;
			while (pos < end_pos && std::isspace((unsigned char)s[end_pos - 1]))
				--end_pos;
			CellRaw value = s.substr(pos, end_pos - pos);
			if (std::apply([&value](auto&& ... args) { return (args.infer(value) + ...); }, m_types) == 0)
				return m_valid = false;
			if (new_pos == std::string::npos)
				break;
			pos = new_pos + 1;
		}
		return 1;
	}

	bool create_schema(ColumnDefinition& col) const
	{
		if (m_valid)
		{
			std::apply([&col](auto&& ... args) { (args.create_schema(col) || ...); }, m_types);
			col.is_list = true;
		}
		return m_valid;
	}

	bool m_valid = true;
	std::tuple<
		TType<ColumnType::Boolean>,
		TType<ColumnType::Integer>,
		TType<ColumnType::Decimal>,
		TDateTime
	> m_types;
};

static const std::regex _re_not_list_item(R"(\.(\W|$))", std::regex::nosubs);

class TStringList
{
public:
	int infer(const CellRaw& cell)
	{
		if (!m_valid)
			return 0;
		const std::string* sp = std::get_if<std::string>(&cell);
		if (!sp)
			return m_valid = false;
		const std::string& s = *sp;
		return m_valid =
			s.front() == '<' && s.back() == '>' ||
			s.find(',') != std::string::npos && !std::regex_search(s, _re_not_list_item);
	}

	bool create_schema(ColumnDefinition& col) const
	{
		if (m_valid)
		{
			col.column_type = ColumnType::String;
			col.is_list = true;
		}
		return m_valid;
	}

	bool m_valid = true;
};

static const std::regex _re_is_xml(R"(^<(?:\?xml|(\w+)(?:.*</\1|/)>$))");

class TXML
{
public:
	int infer(const CellRaw& cell)
	{
		if (!m_valid)
			return 0;
		const std::string* sp = std::get_if<std::string>(&cell);
		if (!sp)
			return m_valid = false;
		return m_valid = std::regex_search(*sp, _re_is_xml);
	}

	bool create_schema(ColumnDefinition& col) const
	{
		if (m_valid)
		{
			col.column_type = ColumnType::String;
			col.format = "XML";
		}
		return m_valid;
	}

	bool m_valid = true;
};

#if defined(_MSC_VER) && defined(_WIN64)
static const std::regex _re_is_json(R"((\[|\{\s*"([^"\\]|\\.)*"\s*:\s*((?=")|[{[0-9.\-]|true|false|null))([,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]|"[^"]*")*[}\]]|\{\s*\})", std::regex::nosubs);
#else
static const std::regex _re_is_json(R"((\[|\{\s*"([^"\\]|\\.)*"\s*:\s*((?=")|[{[0-9.\-]|true|false|null))([,:{}\[\]0-9.\-+Eaeflnr-u \n\r\t]|"([^"\\]|\\.)*")*[}\]]|\{\s*\})", std::regex::nosubs);
#endif

static const std::regex _re_is_geojson(R"~("type"\s*:\s*"(Point|MultiPoint|LineString|MultiLineString|Polygon|MultiPolygon|GeometryCollection|Feature|FeatureCollection)"|^\{\s*\}$)~", std::regex::nosubs);

class TJSON
{
public:
	int infer(const CellRaw& cell)
	{
		if (!m_valid)
			return 0;
		const std::string* sp = std::get_if<std::string>(&cell);
		if (!sp)
			return m_valid = false;
		m_valid = std::regex_match(*sp, _re_is_json);
		if (m_valid && m_is_geo)
			m_is_geo = std::regex_search(*sp, _re_is_geojson);
		return m_valid;
	}

	bool create_schema(ColumnDefinition& col) const
	{
		if (m_valid)
		{
			col.column_type = ColumnType::String;
			col.format = m_is_geo ? "GeoJSON" : "JSON";
		}
		return m_valid;
	}

	bool m_valid = true;
	bool m_is_geo = true;
};

static const std::regex _re_is_wkt(R"(\s*(POINT|LINESTRING|CIRCULARSTRING|COMPOUNDCURVE|CURVEPOLYGON|POLYGON|TRIANGLE|MULTIPOINT|MULTICURVE|MULTILINESTRING|MULTISURFACE|MULTIPOLYGON|POLYHEDRALSURFACE|TIN|GEOMETRYCOLLECTION)(\s+(Z|M|ZM))?\s*(\(|EMPTY)[\sa-zA-Z0-9()+\-.,]*)", std::regex::nosubs | std::regex::icase);

class TWKT
{
public:
	int infer(const CellRaw& cell)
	{
		if (!m_valid)
			return 0;
		const std::string* sp = std::get_if<std::string>(&cell);
		if (!sp)
			return m_valid = false;
		return m_valid = std::regex_match(*sp, _re_is_wkt);
	}

	bool create_schema(ColumnDefinition& col) const
	{
		if (m_valid)
		{
			col.column_type = ColumnType::String;
			col.format = "WKT";
		}
		return m_valid;
	}

	bool m_valid = true;
};

}

class Column
{
public:
	bool infer(const CellRaw& cell)
	{
		if (!cell_empty(cell))
		{
			empty = false;
			return std::apply([&cell](auto&& ... args) { return (args.infer(cell) + ...); }, m_types) > 0;
		}
		return true;
	}
	void create_schema(ColumnDefinition& col) const
	{
		if (!empty)
			std::apply([&col](auto&& ... args) { (args.create_schema(col) || ...); }, m_types);
	}
	bool is_typed() const
	{
		return std::apply([](auto&& ... args) { return (args.m_valid || ...); }, m_types);
	}
	std::string name;
	bool empty = true;
private:
	std::tuple<
		TType<ColumnType::Boolean>,
		TType<ColumnType::Integer>,
		TType<ColumnType::Decimal>,
		TDateTime,
		TXML,
		TJSON,
		TWKT,
		TList,
		TStringList
	> m_types;
};

void Parser::build_column_info(const std::vector<Column>& columns)
{
	Schema& schema = *get_schema();
	std::unordered_set<std::string> have_columns; // columns we already have
	std::string prefix, new_name;
	for (size_t i_col = 0; i_col < columns.size(); ++i_col)
	{
		const std::string* col_name = &columns[i_col].name;
		size_t no_start = 0;
		if (col_name->empty())
			prefix = "Field_", no_start = i_col + 1;
		else if (have_columns.find(*col_name) != have_columns.end())
			prefix = *col_name + '_', no_start = 2;
		if (no_start > 0)
			for (size_t no = no_start; ; ++no)
			{
				new_name = prefix + std::to_string(no);
				if (have_columns.find(new_name) == have_columns.end())
				{
					col_name = &new_name;
					break;
				}
			}
		have_columns.insert(*col_name);
		schema.columns.push_back({ *col_name, ColumnType::String, (int)i_col, false });
		columns[i_col].create_schema(schema.columns.back());
	}
}

void Parser::infer_table(const std::string* comment)
{
	size_t comment_lines_skipped_in_parsing = 0;
	std::vector<RowRaw> rows(INFER_MAX_ROWS);
	for (size_t i_row = 0; i_row < rows.size(); ++i_row)
		if (get_next_row_raw(rows[i_row]) < 0)
		{
			rows.resize(i_row);
			break;
		}
	if (rows.empty())
		return;

	if (get_schema()->remove_null_strings)
		for (RowRaw& row : rows)
			for (CellRaw& cell : row)
				if (cell_null_str(cell))
					std::get<std::string>(cell).clear();

	// remove trailing columns which are empty across all lines
	size_t n_columns = 0;
	for (const RowRaw& row : rows)
		for (size_t i_col = row.size(); i_col > 0; --i_col)
			if (!cell_empty(row[i_col - 1]))
			{
				if (i_col > n_columns)
					n_columns = i_col;
				break;
			}
	std::unordered_map<size_t, size_t> cnt_columns;
	for (RowRaw& row : rows)
	{
		if (row.size() > n_columns)
			row.resize(n_columns);
		++cnt_columns[row.size()];
	}
	// most common number of columns
	n_columns = std::max_element(cnt_columns.begin(), cnt_columns.end(),
		[](auto p1, auto p2) { return p1.second < p2.second || (p1.second == p2.second && p1.first < p2.first); }
		)->first;
	if (n_columns == 0)
		return;

	std::vector<Column> columns(n_columns);

	size_t header_row = 0, data_row;
	bool found_header;
	if (rows.size() == 1)
	{
		data_row = 1;
		found_header = true;
	}
	else
	{
		int header_score = 0;
		for (size_t i_row = 0; i_row < rows.size(); ++i_row)
		{
			const RowRaw& row = rows[i_row];
			int sep_value = row.size() == n_columns;
			int nonblanks = std::none_of(row.begin(), row.end(), cell_empty);
			int row_offset = INFER_MAX_ROWS - (int)i_row;
			int num_uniques = (int)std::unordered_set<CellRaw>(row.begin(), row.end()).size();
			int num_strings = (int)std::count_if(row.begin(), row.end(),
				[](const CellRaw& cell)
				{
					const std::string* sp = std::get_if<std::string>(&cell);
					return sp && !sp->empty() && std::isalpha((unsigned char)(*sp)[0]);
				});
			int score = sep_value * nonblanks + (row_offset + (num_strings * 2) + (num_uniques * 2));
			if (score > header_score)
				header_score = score, header_row = i_row;
		}
		RowRaw& header = rows[header_row];
		header.resize(n_columns);
		if (comment != nullptr)
		{
			std::string* sp = std::get_if<std::string>(&header[0]);
			if (sp && startswith(*comment)(*sp)) // found a comment
				sp->erase(0, comment->size()); // strip comment_char
		}

		if (header_row > 0)
			rows[0] = std::move(header);
		size_t iw = 1;
		data_row = 0;
		for (size_t i_row = header_row + 1; i_row < rows.size(); ++i_row)
		{
			RowRaw& row = rows[i_row];
			if (!std::all_of(row.begin(), row.end(), cell_empty)) // exclude empty lines
			{
				if (comment != nullptr)
				{
					const std::string* sp = std::get_if<std::string>(&row[0]);
					if (sp && startswith(*comment)(*sp)) // found a comment)
					{
						++comment_lines_skipped_in_parsing;
						continue;
					}
				}
				if (row.size() == n_columns)
				{
					if (data_row == 0)
						data_row = i_row;
					if (i_row != iw)
						rows[iw] = std::move(row);
					++iw;
				}
			}
		}
		rows.resize(iw);
		if (data_row == 0)
			data_row = header_row + 1;

		for (size_t i_col = 0; i_col < n_columns; ++i_col)
			for (size_t i_row = 1; i_row < rows.size(); ++i_row) // ignore potential header for now
				if (!columns[i_col].infer(rows[i_row][i_col])) // no consistent type
					break;

		found_header = false;
		std::vector<Column> columns_header = columns;
		for (size_t i_col = 0; i_col < n_columns; ++i_col) // check if types of first row inconsistent with the rest
		{
			if (!columns[i_col].is_typed())
				continue;
			const CellRaw& v = rows[0][i_col];
			if (cell_empty(v))
				continue;
			// include header into type detection
			if (!columns_header[i_col].infer(v) && !columns[i_col].empty) // do not detect header for empty columns
			{
				found_header = true;
				break;
			}
		}

		if (!found_header && std::all_of(columns_header.begin(), columns_header.end(), [](const Column& col) { return col.empty || !col.is_typed(); }))
			found_header = true; // assume first row is header
		if (!found_header)
			columns = std::move(columns_header); // no header, include refined types from first row
	}

	if (found_header)
		for (size_t i = 0; i < columns.size(); ++i)
			columns[i].name = ConvertRawToString(rows[0][i]);

	build_column_info(columns);
	if (CSVSchema* schema = dynamic_cast<CSVSchema*>(get_schema()))
	{
		schema->first_data_row = found_header ? data_row : header_row;
		schema->comment_lines_skipped_in_parsing = comment_lines_skipped_in_parsing;
	}
	else if (XLSSchema* schema = dynamic_cast<XLSSchema*>(get_schema()))
	{
		schema->first_data_row = found_header ? data_row : header_row;
		schema->comment_lines_skipped_in_parsing = comment_lines_skipped_in_parsing;
	}
}

bool Parser::infer_schema()
{
	Schema& schema = *get_schema();
	if (!do_infer_schema())
	{
		schema.status = STATUS_INVALID_FILE;
		return false;
	}
	schema.status = STATUS_OK;
	schema.columns.push_back({ "__rownum__", ColumnType::Integer32, COL_ROWNUM, false });
	//GAB: no more needed
	//schema.columns.push_back({ "__count__", ColumnType::Integer8, COL_COUNT, false });
	schema.columns.push_back({ "__error__", ColumnType::Error, COL_ERROR, true });
	return true;
}

}
