#include "file_reader.h"

namespace Ingest {

BaseReader::BaseReader(const std::string& filename) :
	m_filename(filename)
{}

BaseReader::~BaseReader()
{}

FileReader::FileReader(const std::string& filename) :
	BaseReader(filename),
	m_fp(nullptr)
{}

bool FileReader::open()
{
	m_fp = std::fopen(m_filename.data(), "rb");
	if (!m_fp)
		return false;
	std::fseek(m_fp, 0, SEEK_END);
	m_content.size = (size_t)std::ftell(m_fp);
	std::fseek(m_fp, 0, SEEK_SET);
	return true;
}

void FileReader::close()
{
	if (m_fp)
	{
		std::fclose(m_fp);
		m_fp = nullptr;
	}
}

bool FileReader::startswith(const std::string_view& prefix)
{
	for (unsigned char c : prefix)
		if (std::fgetc(m_fp) != c)
		{
			std::fseek(m_fp, 0, SEEK_SET);
			return false;
		}
	return true;
}

bool FileReader::next_char(char& c)
{
	int cc = std::fgetc(m_fp);
	c = (char)cc;
	return cc != EOF;
}

bool FileReader::check_next_char(char c)
{
	int cc = std::fgetc(m_fp);
	if (cc == (unsigned char)c)
		return true;
	std::ungetc(cc, m_fp);
	return false;
}

size_t FileReader::read(char* buffer, size_t size)
{
	return std::fread(buffer, 1, size, m_fp);
}

int FileReader::pos_percent()
{
	if (m_content.size == 0)
		return 0;
	long pos = std::ftell(m_fp);
	if (pos < 0)
		return 0;
	return (int)((double)pos * 100 / m_content.size);
}

}
