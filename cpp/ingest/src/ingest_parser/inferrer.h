#ifndef INFERRER_H
#define INFERRER_H

#include <stddef.h>
#include <stdint.h>
#include <memory>
#include <vector>
#include <string>
#include <unordered_map>
#include <variant>

namespace Ingest {

const int INFER_MAX_ROWS = 100;

enum class ColumnType { String, Boolean, Integer, Decimal, Date, Time, Datetime, Error, ListInteger, ListDecimal,
						ListDatetime, ListDate, ListTime, ListBoolean, ListString, Integer32,
						Integer16, Integer8};

enum ServiceColumns { COL_ROWNUM = -1, COL_COUNT = -2, COL_ERROR = -3 };

enum SchemaStatus { STATUS_OK = 0, STATUS_INVALID_FILE = 1 };

struct ColumnDefinition
{
	std::string column_name;
	ColumnType column_type;
	int index; // 0-based
	bool is_list;
	std::string format; // datetime format
};

class Schema
{
public:
	std::vector<ColumnDefinition> columns;
	SchemaStatus status = STATUS_OK;
	bool remove_null_strings = true; // "NULL" and "null" strings signify null values
	bool has_truncated_string = false; // if a string longer than allowed limit was truncated
	virtual ~Schema() {}
};

class CSVSchema : public Schema
{
public:
	char delimiter;
	char quote_char; // \0 if not used
	char escape_char; // \0 if not used
	std::string newline; // empty string means any combination of \r\n
	std::string comment;
	std::string charset;
	size_t first_data_row; // 0-based ignoring empty text rows
	size_t comment_lines_skipped_in_parsing = 0;
	virtual ~CSVSchema() {}
};

class XLSSchema : public Schema
{
public:
	std::string comment;
	size_t first_data_row;
	size_t comment_lines_skipped_in_parsing = 0;
	virtual ~XLSSchema() {}
};

enum class ErrorCode { TypeError = 1 };

struct ErrorType
{
	ErrorCode error_code;
	std::string value;
};

class Cell;
class Cell : public std::variant<std::string, bool, int64_t, int32_t, int16_t, int8_t, double, std::vector<Cell>, std::unordered_map<int, ErrorType>>
{
public:
	using base = std::variant<std::string, bool, int64_t, int32_t, int16_t, int8_t, double, std::vector<Cell>, std::unordered_map<int, ErrorType>>;
	using base::base;
	using base::operator =;
};

typedef std::vector<Cell> RowValues;
class Row
{
public:
	RowValues values;
	std::vector<bool> flagmap; // false means value is Null
	Row() {}
	Row(size_t count) : values(count), flagmap(count) {}
};

struct CellRawDate {
	double d;
	bool operator== (const CellRawDate& other) const { return other.d == d; }
};
typedef std::variant<std::string, int64_t, bool, double, CellRawDate> CellRaw;
typedef std::vector<CellRaw> RowRaw;
class Column;

class BaseReader;
class ZIPParser;

class Parser
{
public:
	static Parser* get_parser(const std::string& filename);
	virtual ~Parser();
	bool infer_schema();
	virtual Schema* get_schema() = 0; // returns pointer to instance member, do not delete
	virtual bool open();
	virtual void close();
	bool get_next_row(Row& row);
	virtual int get_percent_complete();
	virtual size_t get_sheet_count();
	virtual std::vector<std::string> get_sheet_names();
	virtual bool select_sheet(const std::string& sheet_name);
	virtual bool select_sheet(size_t sheet_number);
	virtual size_t get_file_count();
	virtual std::vector<std::string> get_file_names();
	virtual bool select_file(const std::string& file_name);
	virtual bool select_file(size_t file_number);

protected:
	friend class ZIPParser;
	static Parser* get_parser_from_reader(std::shared_ptr<BaseReader> reader);
	virtual bool do_infer_schema() = 0;
	virtual int64_t get_next_row_raw(RowRaw& row) = 0;
	void build_column_info(const std::vector<Column>& columns);
	void infer_table(const std::string* comment);
};

}

#endif
