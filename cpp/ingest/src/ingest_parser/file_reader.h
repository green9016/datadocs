#ifndef FILE_READER_H
#define FILE_READER_H

#include <cstdio>
#include <string>

#include "xls/xlscommon.h"

namespace Ingest {

class BaseReader
{
public:
	BaseReader(const std::string& filename);
	virtual ~BaseReader();
	const std::string& filename() { return m_filename; }
	size_t filesize() { return m_content.size; }
	virtual bool is_file() = 0;
	virtual bool open() = 0;
	virtual void close() = 0;
	virtual bool startswith(const std::string_view& prefix) = 0;
	virtual bool next_char(char& c) = 0;
	virtual bool check_next_char(char c) = 0;
	virtual size_t read(char* buffer, size_t size) = 0;
	virtual int pos_percent() = 0;
	virtual xls::MemBuffer* read_all() { return &m_content; };

protected:
	std::string m_filename;
	xls::MemBuffer m_content;
};

class FileReader : public BaseReader
{
public:
	FileReader(const std::string& filename);
	virtual bool is_file() override { return true; }
	virtual bool open() override;
	virtual void close() override;
	virtual bool startswith(const std::string_view& prefix) override;
	virtual bool next_char(char& c) override;
	virtual bool check_next_char(char c) override;
	virtual size_t read(char* buffer, size_t size) override;
	virtual int pos_percent() override;

protected:
	std::FILE* m_fp;
};

}

#endif
