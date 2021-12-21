//
// Created by gab on 20/06/19.
//

#ifndef DATADOCS_INGEST_IMPORT_H
#define DATADOCS_INGEST_IMPORT_H

// STD
#include <functional>  // std::function
#include <string>      // std::string

// Ingest
#include "table.h"  // Table

namespace Ingest {
int convert_file( std::string filename, std::vector<std::string> selected_files, std::string sheet, Table* table, std::function<void( int )> percentage_callback );
std::vector<std::string> probe_file( std::string filename, std::vector<std::string> selected_files );
std::vector<std::string> probe_compress( std::string filename, std::vector<std::string> selected_files );
}  // namespace Ingest

#endif  // DATADOCS_INGEST_IMPORT_H
