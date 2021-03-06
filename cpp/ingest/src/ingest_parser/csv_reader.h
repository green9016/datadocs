#ifndef CSV_READER_H
#define CSV_READER_H

#include "inferrer.h"
#include "file_reader.h"

namespace Ingest {

class ucvt_streambuf;

class CSVParser : public Parser
{
public:
	static Parser* create_parser(std::shared_ptr<BaseReader> reader);
	CSVParser(std::shared_ptr<BaseReader> reader);
	virtual ~CSVParser() override;
	virtual bool do_infer_schema() override;
	virtual Schema* get_schema() override { return &m_schema; }
	virtual bool open() override;
	virtual void close() override;
	virtual int get_percent_complete() override;

protected:
	bool next_char(char& c);
	bool check_next_char(char c);
	bool is_newline(char c);
	virtual int64_t get_next_row_raw(RowRaw& row) override;

	CSVSchema m_schema;
	std::shared_ptr<BaseReader> m_reader;
	std::unique_ptr<ucvt_streambuf> m_cvt_buf;
	size_t m_row_number;
};

}

#endif
