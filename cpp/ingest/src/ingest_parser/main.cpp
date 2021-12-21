#include <cmath>
#include <ctime>
#include <memory>
#include <chrono>
#include <iostream>
#include <iomanip>

#include "inferrer.h"

using namespace Ingest;

void print_time(double value, const char* format)
{
	std::tm tm = {};
	tm.tm_year = 400;
	tm.tm_mday = (int)value - 1;
	std::mktime(&tm);
	tm.tm_year -= 400;
	int time = std::lround((value - int(value)) * 86400.0);
	tm.tm_hour = time / 3600;
	time %= 3600;
	tm.tm_min = time / 60;
	tm.tm_sec = time % 60;
	std::cout << std::put_time(&tm, format) << '(' << value << ')';
}

void print_value(const Cell& v, ColumnType col_type)
{
	switch (col_type)
	{
	case ColumnType::String:
		std::cout << std::get<std::string>(v);
		break;
	case ColumnType::Boolean:
		std::cout << (std::get<bool>(v) ? "true" : "false");
		break;
	case ColumnType::Integer:
		std::cout << 'i' << std::get<int64_t>(v);
		break;
	case ColumnType::Integer32:
                std::cout << std::get<int32_t>(v);
                break;
        case ColumnType::Integer16:
               std::cout << std::get<int16_t>(v);
               break;
        case ColumnType::Integer8:
               std::cout << std::get<int8_t>(v);
               break;
	case ColumnType::Decimal:
		std::cout << 'f' << std::get<double>(v);
		break;
	case ColumnType::Date:
		print_time(std::get<int32_t>(v), "%Y-%m-%d");
		break;
	case ColumnType::Time:
		print_time(std::get<double>(v), "%H:%M:%S");
		break;
	case ColumnType::Datetime:
		print_time(std::get<double>(v), "%Y-%m-%d %H:%M:%S");
		break;
	}
}

int main(int argc, char* argv[])
{
	if (argc != 2)
	{
		std::cout << "filename missing" << std::endl;
		return 1;
	}
	std::unique_ptr<Parser> parser(Parser::get_parser(argv[1]));
	if (parser)
	{
		if (parser->get_sheet_count() > 1)
		{
			std::vector<std::string> sheets = parser->get_sheet_names();
			parser->select_sheet(sheets.back());
			//parser->select_sheet(sheets.size() - 1);
		}
		if (!parser->infer_schema())
			return 1;
		Schema& schema = *parser->get_schema();
		//schema.columns[0].is_list = true;
		for (size_t i = 0; i < schema.columns.size(); ++i)
			std::cout << schema.columns[i].column_name << ' ';
		std::cout << std::endl;
		if (schema.status == 0 && parser->open())
		{
			Row row(schema.columns.size());
			auto start = std::chrono::high_resolution_clock::now();
			for (size_t i_row = 0; parser->get_next_row(row); ++i_row)
			{
				if (i_row > 10)
					continue;
				for(size_t cellnum = 0; cellnum < schema.columns.size(); ++cellnum)
				{
					if (!row.flagmap[cellnum])
						std::cout << "NULL ";
					else
					{
						const Cell& cell = row.values[cellnum];
						ColumnType col_type = schema.columns[cellnum].column_type;
						if (schema.columns[cellnum].is_list)
						{
							char c = '[';
							if (schema.columns[cellnum].column_type == ColumnType::Error)
								for (const auto& v : std::get<std::unordered_map<int, ErrorType>>(cell))
								{
									std::cout << c << v.first << ":{" << (int)v.second.error_code << ' ' << v.second.value << '}';
									c = ',';
								}
							else
								for (const Cell& v : std::get<std::vector<Cell>>(cell))
								{
									std::cout << c;
									print_value(v, col_type);
									c = ',';
								}
							if (c == '[')
								std::cout << c;
							std::cout << ']';
						}
						else
							print_value(cell, col_type);
						std::cout << ' ';
					}
				}
				std::cout << parser->get_percent_complete() << '%' << std::endl;
			}
			std::chrono::duration<double> t = std::chrono::high_resolution_clock::now() - start;
			std::cout << "run time " << t.count() << std::endl;
			parser->close();
		}
	}
	return 0;
}
