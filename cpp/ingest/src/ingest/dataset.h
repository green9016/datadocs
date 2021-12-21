#ifndef DATADOCS_INGEST_DATASET_H
#define DATADOCS_INGEST_DATASET_H

// STD
#include <cstdint>   // uint8_t, int16_t, int32_t, int64_t, INT32_MAX
#include <iostream>  // std::cout, std::endl
#include <string>    // std::string
#include <utility>   // std::move
#include <vector>    // std::vector

// table
#include "table.h"

namespace Ingest {

enum IngestedStatus { STATUS_PENDING, STATUS_PROCESSING, STATUS_COMPLETED, STATUS_CANCELLED };

////////////////////////////////////
// Dataset
////////////////////////////////////

class Dataset {
public:
  Dataset() {
      this->ingested_status_ = STATUS_PENDING;
  }

  Dataset( Dataset&& other )
      : table_names_( std::move( other.table_names_ ) ),
        tables_( std::move( other.tables_ ) ),
        ingested_status_( other.ingested_status_ ) {}

  Dataset& operator=( Dataset&& other ) {
    table_names_ = std::move( other.table_names_ );
    tables_ = std::move( other.tables_ );
    ingested_status_ = other.ingested_status_;
    return *this;
  }

  ~Dataset() {}

  Dataset( Dataset const& ) = delete;

  Dataset& operator=( const Dataset& ) = delete;

  void add_table( std::string name, Table&& table );

  void dump() const;

  int16_t get_table_count( ) const;

  std::string get_table_name( int idx ) const;

  Table get_table_by_index( int idx );

  void set_ingested_status( IngestedStatus ingested_status );

  void cancel_ingesting_data();

  IngestedStatus get_ingested_status() const;

private:
  std::vector< std::string > table_names_;
  std::vector< Table > tables_;
  IngestedStatus ingested_status_;
};

}  // namespace Ingest

#endif