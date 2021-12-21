// Main header
#include "dataset.h"

// STD
#include <cstdint>   // uint8_t, int16_t, int32_t, INT16_MAX
#include <iostream>  // std::cout, std::endl
#include <string>    // std::string
#include <utility>   // std::move
#include <variant>   // std::visit, std::get, std::holds_alternative

// Add a Table to Dataset
void Ingest::Dataset::add_table( std::string name, Ingest::Table&& table ) {
  tables_.push_back( std::move(table) );
  table_names_.push_back( name );
  //tables_.insert( std::pair<std::string, Ingest::Table>(name, table) );
}

int16_t Ingest::Dataset::get_table_count() const {
  return static_cast<int16_t>( this->table_names_.size() );
}

std::string Ingest::Dataset::get_table_name( int idx ) const {
  return table_names_[idx];
}

Ingest::Table Ingest::Dataset::get_table_by_index( int idx ) {
  return std::move(tables_[idx]);
}

void Ingest::Dataset::dump() const {
  int16_t tidx = 0;
  std::cout << "Dumping Table of Dataset..." << std::endl;
  for ( Ingest::Table const& table : this->tables_ ) {
    std::cout << "Table \"" << table_names_[tidx] << "\": {\n";

    table.dump();

    std::cout << "}" << std::endl;
    tidx++;
  }
}

void Ingest::Dataset::set_ingested_status( Ingest::IngestedStatus ingested_status ) {
  ingested_status_ = ingested_status;
}

void Ingest::Dataset::cancel_ingesting_data() {
  set_ingested_status( STATUS_CANCELLED );
}

Ingest::IngestedStatus Ingest::Dataset::get_ingested_status() const {
  return this->ingested_status_;
}