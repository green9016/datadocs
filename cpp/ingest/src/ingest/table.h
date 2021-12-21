//
// Created by gab on 20/06/19.
//

#ifndef DATADOCS_INGEST_TABLE_H
#define DATADOCS_INGEST_TABLE_H

// STD
#include <cstdint>   // uint8_t, int16_t, int32_t, int64_t, INT32_MAX
#include <iostream>  // std::cout, std::endl
#include <string>    // std::string
#include <utility>   // std::move
#include <vector>    // std::vector

// ingest_parser
#include <ingest_parser/inferrer.h>  // ColumnType, Row, Schema

// Ingest
#include "data.h"

namespace Ingest {

////////////////////////////////////
// Table
////////////////////////////////////

enum IngestedStatus { STATUS_PENDING, STATUS_PROCESSING, STATUS_COMPLETED, STATUS_CANCELLED };

// The ColumnData type: this is one of of the supported Data types: BooleanData, IntegerData, etc...
typedef std::variant<BooleanData,
                     IntegerData,
                     Integer32Data,
                     Integer16Data,
                     Integer8Data,
                     DateData,
                     TimeData,
                     DateTimeData,
                     DecimalData,
                     StringData,
                     ErrorData,
                     ListIntegerData,
                     ListDecimalData,
                     ListDateTimeData,
                     ListDateData,
                     ListTimeData,
                     ListBooleanData,
                     ListStringData>
    ColumnData;

class Table {
public:
  Table() {}

  Table( Schema const& schema );

  Table( Table&& other )
      : column_names_( std::move( other.column_names_ ) ),
        columns_( std::move( other.columns_ ) ),
        ingested_status_( std::move( other.ingested_status_ ) ) {}

  Table& operator=( Table&& other ) {
    column_names_ = std::move( other.column_names_ );
    columns_ = std::move( other.columns_ );
    ingested_status_ = std::move( other.ingested_status_ );
    return *this;
  }

  ~Table() {}

  Table( Table const& ) = delete;

  Table& operator=( const Table& ) = delete;

  void append_row( Row const& row );

  void dump() const;

  std::vector<ColumnData> const& get_columns_ref() const { return columns_; }

  int16_t get_column_count() const;

  std::string get_column_name( int16_t column_index ) const;

  LogicalTypeId get_column_type( int16_t column_index ) const;

  std::string get_column_type_as_string( int16_t column_index ) const;

  int32_t get_column_element_count( int16_t column_index ) const;

  int32_t get_column_array_buffer_size( int16_t column_index ) const;

  int32_t get_column_array_buffer_size_in_bytes( int16_t column_index ) const;

  int32_t get_column_offsets_buffer_size( int16_t column_index ) const;

  int32_t get_column_sub_offsets_buffer_size( int16_t column_index ) const;

  int32_t get_column_nullbitmap_buffer_size( int16_t column_index ) const;

  int32_t get_column_null_count( int16_t column_index ) const;

  uint8_t const* get_column_nullbitmap_buffer( int16_t column_index ) const;

  void const* get_column_array_buffer( int16_t column_index ) const;

  int32_t const* get_column_offsets_buffer( int16_t column_index ) const;

  int32_t const* get_column_sub_offsets_buffer( int16_t column_index ) const;

  int32_t get_column_list_element_count( int16_t column_index ) const;

  void shrink_columns( );

  void set_ingested_status( IngestedStatus ingested_status );

  void cancel_ingesting_data();

  IngestedStatus get_ingested_status() const;

private:
  std::vector<std::string> column_names_;
  std::vector<ColumnData> columns_;
  IngestedStatus ingested_status_;
};

}  // namespace Ingest

#endif
