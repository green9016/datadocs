//
// Created by gab on 23/06/19.
//

// Main header
#include "table.h"

// STD
#include <cstdint>   // uint8_t, int16_t, int32_t, INT16_MAX
#include <iostream>  // std::cout, std::endl
#include <string>    // std::string
#include <utility>   // std::move
#include <variant>   // std::visit, std::get, std::holds_alternative

// ingest_parser
#include <ingest_parser/inferrer.h>  // Schema, ColumnDefinition, Row, RowValues, Cell

Ingest::Table::Table( Schema const& schema ) {
  std::cout << "Table created from Schema" << std::endl;

  int16_t column_number = 0;
  for ( ColumnDefinition const& coldef : schema.columns ) {
    if ( ( column_number + 1 ) > INT16_MAX ) {
      std::cerr << "Error: too many columns..." << std::endl;
      break;
    }

    this->column_names_.push_back( coldef.column_name );

    switch ( coldef.column_type ) {
      case LogicalTypeId::Boolean: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListBooleanData() );
        } else {
          this->columns_.push_back( BooleanData() );
        }
      } break;
      case LogicalTypeId::Date: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListDateData() );
        } else {
          this->columns_.push_back( DateData() );
        }
      } break;
      case LogicalTypeId::Time: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListTimeData() );
        } else {
          this->columns_.push_back( TimeData() );
        }
      } break;
      case LogicalTypeId::Datetime: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListDateTimeData() );
        } else {
          this->columns_.push_back( DateTimeData() );
        }
      } break;
      case LogicalTypeId::Integer: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListIntegerData() );
        } else {
          this->columns_.push_back( IntegerData() );
        }
      } break;
      case LogicalTypeId::Integer32: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListIntegerData() );
        } else {
          this->columns_.push_back( Integer32Data() );
        }
      } break;
      case LogicalTypeId::Integer16: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListIntegerData() );
        } else {
          this->columns_.push_back( Integer16Data() );
        }
      } break;
      case LogicalTypeId::Integer8: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListIntegerData() );
        } else {
          this->columns_.push_back( Integer8Data() );
        }
      } break;
      case LogicalTypeId::Decimal: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListDecimalData() );
        } else {
          this->columns_.push_back( DecimalData() );
        }
      } break;
      case LogicalTypeId::String: {
        if ( coldef.is_list ) {
          this->columns_.push_back( ListStringData() );
        } else {
          this->columns_.push_back( StringData() );
        }
      } break;
      case LogicalTypeId::Error:
        this->columns_.push_back( ErrorData() );
        break;
      default:
        // Do nothing
        break;
    }

    column_number++;
  }
}

template<typename T>
void feed_cell_into_data( T& data, Ingest::Cell const& cell, bool filled ) {
  // A cell is considered to be "really filled" if it is filled (row flag is "true") AND the cell type matches the
  // column data type
  const bool really_filled = filled && std::holds_alternative<typename T::ValueType>( cell );
  data.append( really_filled ? std::get<typename T::ValueType>( cell ) : typename T::ValueType(), !really_filled );
}

// Append a Row to Table
void Ingest::Table::append_row( Row const& row ) {
  int16_t column_number = 0;
  for ( ColumnData& column : columns_ ) {
    if ( ( column_number + 1 ) > INT16_MAX ) {
      std::cerr << "Error: too many columns..." << std::endl;
      break;
    }

    Cell const& cell = row.values[column_number];
    // RowFlag const &flag = row.flagmap[column_number];
    bool const& flag = row.flagmap[column_number];

    // A cell is assumed to be filled if the associated row flag is true.
    // If the flag is false, or if the flag is "error", then the cell is assumed to be NULL.
    // const bool filled = std::holds_alternative<bool>(flag) ? std::get<bool>(flag) : false;
    const bool filled = flag;

    // Generic Visitor for all the different column types (BooleanData, IntegerData, etc...)
    // This works because of C++ magic std::visit/std::variant/auto keyword/template
    std::visit( [filled, &cell]( auto& data ) { feed_cell_into_data( data, cell, filled ); }, column );

    column_number++;
  }
}

int16_t Ingest::Table::get_column_count() const {
  return static_cast<int16_t>( this->columns_.size() );
}

std::string Ingest::Table::get_column_name( int16_t colidx ) const {
  return this->column_names_[colidx];
}

Ingest::LogicalTypeId Ingest::Table::get_column_type( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> LogicalTypeId { return arg.TypeId; }, this->columns_[colidx] );
}

std::string Ingest::Table::get_column_type_as_string( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> std::string { return TypeIdToString( arg.TypeId ); },
                     this->columns_[colidx] );
}

int32_t const* Ingest::Table::get_column_offsets_buffer( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t const* { return arg.get_offsets_buffer(); },
                     this->columns_[colidx] );
}

int32_t const* Ingest::Table::get_column_sub_offsets_buffer( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t const* { return arg.get_sub_offsets_buffer(); },
                     this->columns_[colidx] );
}

uint8_t const* Ingest::Table::get_column_nullbitmap_buffer( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> uint8_t const* { return arg.get_nullbitmap_buffer(); },
                     this->columns_[colidx] );
}

int32_t Ingest::Table::get_column_null_count( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t { return arg.get_null_count(); }, this->columns_[colidx] );
}

int32_t Ingest::Table::get_column_element_count( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t { return arg.get_element_count(); }, this->columns_[colidx] );
}

void const* Ingest::Table::get_column_array_buffer( int16_t colidx ) const {
  return std::visit(
      []( auto const& arg ) -> void const* { return static_cast<void const*>( arg.get_array_buffer() ); },
      this->columns_[colidx] );
}

int32_t Ingest::Table::get_column_array_buffer_size( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t { return arg.get_array_buffer_size(); }, this->columns_[colidx] );
}

int32_t Ingest::Table::get_column_array_buffer_size_in_bytes( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t { return arg.get_array_buffer_size_in_bytes(); },
                     this->columns_[colidx] );
}

int32_t Ingest::Table::get_column_offsets_buffer_size( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t { return arg.get_offsets_buffer_size(); },
                     this->columns_[colidx] );
}

int32_t Ingest::Table::get_column_sub_offsets_buffer_size( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t { return arg.get_sub_offsets_buffer_size(); },
                     this->columns_[colidx] );
}

int32_t Ingest::Table::get_column_nullbitmap_buffer_size( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t { return arg.get_nullbitmap_buffer_size(); },
                     this->columns_[colidx] );
}

int32_t Ingest::Table::get_column_list_element_count( int16_t colidx ) const {
  return std::visit( []( auto const& arg ) -> int32_t { return arg.get_list_element_count(); },
                     this->columns_[colidx] );
}

void Ingest::Table::dump() const {
  std::cout << "Dumping Buffers Headers..." << std::endl;
  int16_t colidx = 0;
  for ( ColumnData const& col : this->columns_ ) {
    std::cout << "Column \"" << this->column_names_[colidx] << "\" (Type: \"";

    std::visit( []( auto const& arg ) { std::cout << TypeIdToString( arg.TypeId ); }, col );

    std::cout << "\"): {\n";

    std::visit( []( auto const& arg ) { arg.dump(); }, col );

    std::cout << "}" << std::endl;

    colidx++;
  }
}

void Ingest::Table::shrink_columns() {
  // Attempt to shrink down Integer columns data type size to 32, 16 or 8 bits
  for ( ColumnData& col : this->columns_ ) {
    if ( std::holds_alternative<IntegerData>( col ) ) {
      auto& data = std::get<IntegerData>( col );
      auto array = data.get_array_ref();
      int maxintbits = 8;
      for ( auto val : array ) {
        const auto absval = abs(val);
        if ( absval > INT32_MAX ) {
          maxintbits = std::max( maxintbits, 64 );
        } else if ( absval > INT16_MAX ) {
          maxintbits = std::max( maxintbits, 32 );
        } else if ( absval > INT8_MAX ) {
          maxintbits = std::max( maxintbits, 16 );
        }
      }
      auto nullbitmap = data.get_nullbitmap_ref();
      int idx = 0;
      if ( maxintbits == 8 ) {
        std::cout << "Shrinking column Integer64 to Integer8" << std::endl;
        Integer8Data newColumn( data.get_element_count() );
        for ( auto val : array ) {
          newColumn.append( static_cast<int8_t>( val ), !static_cast<bool>(nullbitmap[idx / 8] & (1 << (idx % 8) )));
          idx++;
        }
        col.emplace<Integer8Data>( std::move( newColumn ) );
      } else if ( maxintbits == 16 ) {
        std::cout << "Shrinking column Integer64 to Integer16" << std::endl;
        Integer16Data newColumn( data.get_element_count() );
        for ( auto val : array ) {
          newColumn.append( static_cast<int16_t>( val ), !static_cast<bool>(nullbitmap[idx / 8] & (1 << (idx % 8) )));
          idx++;
        }
        col.emplace<Integer16Data>( std::move( newColumn ) );
      } else if ( maxintbits == 32 ) {
        std::cout << "Shrinking column Integer64 to Integer32" << std::endl;
        Integer32Data newColumn( data.get_element_count() );
        for ( auto val : array ) {
          newColumn.append( static_cast<int32_t>( val ), !static_cast<bool>(nullbitmap[idx / 8] & (1 << (idx % 8) )));
          idx++;
        }
        col.emplace<Integer32Data>( std::move( newColumn ) );
      }
    }
  }
}

void Ingest::Table::set_ingested_status( Ingest::IngestedStatus ingested_status ) {
  ingested_status_ = ingested_status;
}

void Ingest::Table::cancel_ingesting_data() {
  set_ingested_status( STATUS_CANCELLED );
}

Ingest::IngestedStatus Ingest::Table::get_ingested_status() const {
  return this->ingested_status_;
}
