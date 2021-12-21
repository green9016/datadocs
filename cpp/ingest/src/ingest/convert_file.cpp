//
// Created by gab on 20/06/19.
//

// Main header
#include "convert_file.h"

// STD
#include <chrono>      // std::chrono
#include <functional>  // std::functional
#include <iostream>    // std::cout, std::endl
#include <memory>      // std::unique_ptr
#include <string>      // std::string

// SYS
#include <sys/stat.h>  // stat
#if !defined( _MSC_VER )
#include <unistd.h>
#endif

// ingest_parser
#include <ingest_parser/inferrer.h>  // Parser, Schema, Row

// ingest
#include "table.h"  // Table

namespace Ingest {

int convert_file( std::string filename, std::vector<std::string> selected_files, std::string sheet, Table* table, std::function<void( int )> percentage_callback ) {
  if ( table == nullptr ) {
    return 1;
  }

#if !defined( _MSC_VER )
  if ( access( filename.c_str(), F_OK ) == -1 ) {
    return 1;
  }
#endif

  std::chrono::high_resolution_clock::time_point t1 = std::chrono::high_resolution_clock::now();

  std::unique_ptr<Parser> parser( Parser::get_parser( ( filename ) ) );
  if ( parser ) {
    if (parser->get_file_count() > 0 && selected_files.size() > 0) {
      /*std::vector<std::string> files = parser->get_file_names();
      if (selected_file == "" || std::find(files.begin(), files.end(), selected_file) == files.end()) {
        return 1;
      }
      parser->select_file(selected_file);*/
      for (std::uint32_t idx = 0, psize = selected_files.size(); idx < psize; ++idx) {
        parser->select_file(selected_files[idx]);
      }
    }
    if (parser->get_sheet_count() > 1)
		{
      std::vector<std::string> sheets = parser->get_sheet_names();
      if (sheet == "" || std::find(sheets.begin(), sheets.end(), sheet) == sheets.end()) {
        return 1;
      }
      parser->select_sheet( sheet );
      //parser->select_sheet(sheets.back());
			//parser->select_sheet(sheets.size() - 1);
		}
    if ( parser->infer_schema() ) {
      Schema* schema = parser->get_schema();

      if ( !schema->columns.empty() ) {
        *table = Table( *schema );

        if ( parser->open() ) {
          std::cout << "file successfully opened. Parsing/loading data..." << std::endl;
          table->set_ingested_status( STATUS_PROCESSING );
          Row row;
          int percentage = 0;
          int prev_percentage = 0;
          while ( ( parser->get_next_row( row ) ) && table->get_ingested_status() == STATUS_PROCESSING ) {
            table->append_row( row );
            prev_percentage = parser->get_percent_complete();
            if ( percentage < prev_percentage ) {
              percentage = prev_percentage;
              percentage_callback( percentage );
            }
          }
          std::cout << "data successfully loaded!" << std::endl;
          parser->close();

          // Shrink column data type sizes if possible
          table->shrink_columns( );
        }

        if ( table->get_ingested_status() == STATUS_PROCESSING ) {
          table->set_ingested_status( STATUS_COMPLETED );
        }
      }
    } else {
      Schema* schema = parser->get_schema();
      if ( schema->status == STATUS_INVALID_FILE ) {
        return 2;
      }
    }
  }

  std::chrono::high_resolution_clock::time_point t2 = std::chrono::high_resolution_clock::now();

  std::cout << "time to ingest: " << std::chrono::duration_cast<std::chrono::milliseconds>( t2 - t1 ).count() << "ms"
            << std::endl;

  return 0;
}

std::vector<std::string> probe_file( std::string filename, std::vector<std::string> selected_files ) {
  std::vector<std::string> sheet_vec;

  #if !defined( _MSC_VER )
  if ( access( filename.c_str(), F_OK ) == -1 ) {
    return sheet_vec;
  }
  #endif

  std::unique_ptr<Parser> parser( Parser::get_parser( ( filename ) ) );
  if ( parser ) {
    if (selected_files.size() > 0) {
      for (std::uint32_t idx = 0, psize = selected_files.size(); idx < psize; ++idx) {
        parser->select_file(selected_files[idx]);
      }
    }
    if (parser->get_sheet_count() > 0)
		{
			sheet_vec = parser->get_sheet_names();
		} else {
      sheet_vec = std::vector<std::string>{ "default" };
    }
  }

  return sheet_vec;
}

std::vector<std::string> probe_compress( std::string filename, std::vector<std::string> selected_files ) {
  std::vector<std::string> file_vec;

  #if !defined( _MSC_VER )
  if ( access( filename.c_str(), F_OK ) == -1 ) {
    return file_vec;
  }
  #endif

  std::unique_ptr<Parser> parser( Parser::get_parser( ( filename ) ) );
  if ( parser ) {
    if (selected_files.size() > 0) {
      for (std::uint32_t idx = 0, psize = selected_files.size(); idx < psize; ++idx) {
        parser->select_file(selected_files[idx]);
      }
    }
    if (parser->get_file_count() > 0)
		{
			file_vec = parser->get_file_names();
		}
  }

  return file_vec;
}

}  // namespace Ingest
