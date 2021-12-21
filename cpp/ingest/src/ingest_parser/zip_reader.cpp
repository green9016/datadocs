#include <cstring>
#include <utility>
#include <string_view>
#include <algorithm>

#include <contrib/minizip/unzip.h>

#include "zip_reader.h"
#include "utility.h"
#include "xls/zip_memory.h"

using namespace std::literals;

namespace Ingest {

class ZIPReader : public BaseReader
{
public:
	static constexpr size_t buf_size = 4096;

	ZIPReader(unzFile zip, const std::string& filename);
	virtual bool is_file() override { return false; }
	virtual bool open() override;
	virtual void close() override;
	virtual bool startswith(const std::string_view& prefix) override;
	virtual bool next_char(char& c) override;
	virtual bool check_next_char(char c) override;
	virtual size_t read(char* buffer, size_t size) override;
	virtual int pos_percent() override;
	virtual xls::MemBuffer* read_all() override;

protected:
	bool underflow();

	unzFile m_zip;
	const char* m_read_pos;
	const char* m_read_end;
	char m_buffer[buf_size];
};

ZIPReader::ZIPReader(unzFile zip, const std::string& filename) :
	BaseReader(filename),
	m_zip(zip)
{
	m_read_pos = m_read_end = m_buffer + buf_size;
}

bool ZIPReader::open()
{
	m_content.size = 0;
	unz_file_info64 file_info;
	if (unzLocateFile(m_zip, m_filename.data(), 0) != UNZ_OK ||
		unzGetCurrentFileInfo64(m_zip, &file_info, nullptr, 0, nullptr, 0, nullptr, 0) != UNZ_OK ||
		unzOpenCurrentFile(m_zip) != UNZ_OK)
		return false;
	m_content.size = file_info.uncompressed_size;
	m_read_pos = m_read_end = m_buffer + buf_size;
	return true;
}

void ZIPReader::close()
{
	unzCloseCurrentFile(m_zip);
	m_read_pos = m_read_end = m_buffer + buf_size;
}

bool ZIPReader::startswith(const std::string_view& prefix)
{
	char c_next;
	for (char c : prefix)
		if (next_char(c_next) && c_next != c)
		{
			m_read_pos = m_buffer;
			return false;
		}
	return true;
}

bool ZIPReader::next_char(char& c)
{
	if (!underflow())
		return false;
	c = *m_read_pos++;
	return true;
}

bool ZIPReader::check_next_char(char c)
{
	if (!underflow())
		return false;
	if (*m_read_pos != c)
		return false;
	++m_read_pos;
	return true;
}

size_t ZIPReader::read(char* buffer, size_t size)
{
	size_t from_buffer = 0;
	size_t in_buffer = m_read_end - m_read_pos;
	if (in_buffer > 0)
	{
		from_buffer = std::min(size, in_buffer);
		std::memcpy(buffer, m_read_pos, from_buffer);
		m_read_pos += from_buffer;
		buffer += from_buffer;
		size -= from_buffer;
	}
	int from_zip = unzReadCurrentFile(m_zip, buffer, size);
	if (from_zip < 0)
		return 0;
	return from_buffer + (size_t)from_zip;
}

int ZIPReader::pos_percent()
{
	if (m_content.size == 0)
		return 0;
	ZPOS64_T pos = unztell64(m_zip);
	return (int)((double)pos * 100 / m_content.size);
}

bool ZIPReader::underflow()
{
	if (m_read_pos >= m_read_end)
	{
		int sz = unzReadCurrentFile(m_zip, m_buffer, buf_size);
		if (sz <= 0)
			return false;
		m_read_end = m_buffer + sz;
		m_read_pos = m_buffer;
	}
	return true;
}

xls::MemBuffer* ZIPReader::read_all()
{
	if (!m_content.buffer)
	{
		if (!open())
			return nullptr;
		m_content.buffer = new char[m_content.size];
		if (unzReadCurrentFile(m_zip, m_content.buffer, m_content.size) < 0)
			m_content.clear();
		close();
	}
	return &m_content;
}


Parser* ZIPParser::create_parser(std::shared_ptr<BaseReader> reader)
{
	const std::string& filename = reader->filename();
	if (str_endswith_lc(filename, ".zip"sv))
		return new ZIPParser(reader);
	return nullptr;
}

ZIPParser::ZIPParser(std::shared_ptr<BaseReader> reader) :
	m_reader(reader),
	m_zip(nullptr)
{}

ZIPParser::~ZIPParser()
{
	close();
}

bool ZIPParser::do_infer_schema()
{
	if (m_parser)
		return m_parser->do_infer_schema();
	return false;
}

Schema* ZIPParser::get_schema()
{
	if (m_parser)
		return m_parser->get_schema();
	return &m_invalid_schema;
}

bool ZIPParser::open()
{
	if (m_parser)
		return m_parser->open();
	return false;
}

void ZIPParser::close()
{
	m_parser.reset();
	unzClose(m_zip);
	m_zip = nullptr;
}

int ZIPParser::get_percent_complete()
{
	if (m_parser)
		return m_parser->get_percent_complete();
	return 0;
}

size_t ZIPParser::get_sheet_count()
{
	if (m_parser)
		return m_parser->get_sheet_count();
	return 0;
}

std::vector<std::string> ZIPParser::get_sheet_names()
{
	if (m_parser)
		return m_parser->get_sheet_names();
	return std::vector<std::string>();
}

bool ZIPParser::select_sheet(const std::string& sheet_name)
{
	if (m_parser)
		return m_parser->select_sheet(sheet_name);
	return false;
}

bool ZIPParser::select_sheet(size_t sheet_number)
{
	if (m_parser)
		return m_parser->select_sheet(sheet_number);
	return false;
}

size_t ZIPParser::get_file_count()
{
	if (m_parser)
		return m_parser->get_file_count();
	do_open_zip();
	return m_files.size();
}

std::vector<std::string> ZIPParser::get_file_names()
{
	if (m_parser)
		return m_parser->get_file_names();
	do_open_zip();
	return m_files;
}

bool ZIPParser::select_file(const std::string& file_name)
{
	if (m_parser)
		return m_parser->select_file(file_name);
	size_t file_cnt = get_file_count();
	for (size_t i = 0; i < file_cnt; ++i)
		if (file_name == m_files[i])
			return select_file(i);
	return false;
}

bool ZIPParser::select_file(size_t file_number)
{
	if (m_parser)
		return m_parser->select_file(file_number);
	if (file_number >= get_file_count())
		return false;
	m_parser.reset(Parser::get_parser_from_reader(std::make_shared<ZIPReader>(m_zip, m_files[file_number])));
	return static_cast<bool>(m_parser);
}

bool ZIPParser::do_open_zip()
{
	if (m_zip)
		return true;
	m_files.clear();
	if (m_reader->is_file())
		m_zip = unzOpen(m_reader->filename().data());
	else
		m_zip = xls::unzOpenMemory(m_reader->read_all());
	if (!m_zip)
		return false;
	if (unzGoToFirstFile(m_zip) != UNZ_OK)
		return false;
	unz_file_info64 file_info;
	do {
		if (unzGetCurrentFileInfo64(m_zip, &file_info, nullptr, 0, nullptr, 0, nullptr, 0) != UNZ_OK)
			return false;
		if (file_info.uncompressed_size > 0)
		{
			std::string s;
			s.resize(file_info.size_filename);
			if (unzGetCurrentFileInfo64(m_zip, nullptr, s.data(), s.capacity(), nullptr, 0, nullptr, 0) != UNZ_OK)
				return false;
			m_files.push_back(std::move(s));
		}
	} while (unzGoToNextFile(m_zip) == UNZ_OK);
	return true;
}

int64_t ZIPParser::get_next_row_raw(RowRaw& row)
{
	if (m_parser)
		return m_parser->get_next_row_raw(row);
	return -1;
}

}