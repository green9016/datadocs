//
// Created by gab on 07/01/20
//

// STD
#include <iostream>
#include <string>

// simple_icu_init
#include <simple_icu_init.h>

// ingest
#include <ingest/convert_file.h>  // convert_file
#include <ingest/table.h>         // Table

// ingest_parser (you may also include header files from ingest-parser)
// #include <ingest_parser/inferrer.h>

// memory_utils
#include <memory_utils.h>

// initialize ICU
static const int g_icu_initialized = simple_icu_init( ICU_DATA );

// main
int main( int argc, char** argv ) {
  if ( argc > 1 ) {
    std::cout << "converting file " << argv[1] << std::endl;
    Ingest::Table table;
    printMemoryReport();
    if ( Ingest::convert_file( argv[1], &table, []( int percent ) {
           std::cout << "progress: " << percent << std::endl;
           // printMemoryReport();
         } ) == 0 ) {
      table.dump();
      std::cout << "Finished converting file" << std::endl;
      printMemoryReport();
      std::cout << "Success!" << std::endl;
      return 0;
    } else {
      std::cout << "Unable to ingest the file" << std::endl;
    }
  } else {
    std::cout << "Not enough command line arguments: test_ingest <filename>" << std::endl;
  }
  std::cout << "ERROR!" << std::endl;
  return 1;
}
