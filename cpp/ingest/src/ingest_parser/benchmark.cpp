#include <cstdio>
#include <memory>
#include <chrono>
#include <iostream>

#include "inferrer.h"

using namespace Ingest;

int main(int argc, char* argv[])
{
	if (argc != 2)
	{
		std::cout << "filename missing" << std::endl;
		return 1;
	}
	std::FILE* fp = std::fopen(argv[1], "rb");
	if (!fp)
	{
		std::cout << "cannot open file" << std::endl;
		return 1;
	}
	while ((std::fgetc(fp)) != EOF);
	std::fseek(fp, 0, SEEK_SET);

	typedef std::chrono::high_resolution_clock clock;
	std::chrono::time_point<clock> start;
	clock::duration dur1, dur2;
	start = clock::now();
	while ((std::fgetc(fp)) != EOF);
	dur1 = clock::now() - start;
	std::fclose(fp);

	std::unique_ptr<Parser> parser(Parser::get_parser(argv[1]));
	if (!parser || !parser->infer_schema())
		return 1;
	Schema& schema = *(parser->get_schema());
	if (schema.status != 0 || !parser->open())
		return 1;
	Row row(schema.columns.size());
	start = clock::now();
	while (parser->get_next_row(row));
	dur2 = clock::now() - start;
	parser->close();
	std::cout << (double)(dur2.count() - dur1.count()) / dur1.count() * 100.0 << "% (" << std::chrono::duration_cast<std::chrono::duration<double>>(dur2).count() << " sec.)\n";
	return 0;
}
