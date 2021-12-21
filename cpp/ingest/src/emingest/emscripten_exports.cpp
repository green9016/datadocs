//
// Created by gab on 20/06/19.
//

// STD
#include <cstdint>  // uint8_t, int16_t, int32_t
#include <string>   // std::string

// Emscripten
#include <emscripten/bind.h>  // emscripten::enum_, class_, function, EMSCRIPTEN_BINDINGS
#include <emscripten/val.h>   // emscripten::val
#include <emscripten/wire.h>  // emscripten::typed_memory_view

// memory_utils
#include <memory_utils.h>

// Ingest
#include <ingest/convert_file.h>  // convert_file
#include <ingest/table.h>  // Table, LogicalTypeId, BooleanData, DateData, DateTimeData, TimeData, IntegerData, DecimalData,
                           // StringData, ErrorData, ListIntegerData, ListDecimalData, ListDateTimeData, ListDateData,
                           // ListTimeData, ListBooleanData, ListStringData

// Local wrapper functions to bridge JS and C++
namespace {

template <typename T, typename U>
std::vector<U>
vecFromArray(T& arr) {
    return emscripten::vecFromJSArray<U>(arr);
}

// call Ingest::convert_file, wrapping the 'percentage_callback' JS function (emscripten::val) into a std::function
int convert_file( std::string filename, emscripten::val j_selected_files, std::string sheet, Ingest::Table* table, emscripten::val percentage_callback ) {
  std::vector<std::string> selected_files = vecFromArray<emscripten::val, std::string>(j_selected_files);
  return Ingest::convert_file( std::move( filename ), std::move( selected_files ), std::move( sheet ), table, [percentage_callback]( int percentage ) {
    percentage_callback.call<emscripten::val>( "call", emscripten::val::object(), percentage );
  } );
}

// call Ingest::probe_file,
emscripten::val probe_file( std::string filename, emscripten::val j_selected_files ) {
  std::vector<std::string> selected_files = vecFromArray<emscripten::val, std::string>(j_selected_files);
  std::vector<std::string> sheet_vec = Ingest::probe_file( std::move( filename ), std::move( selected_files ) );
  emscripten::val sheets = emscripten::val::global("Array").new_();
  for (std::int32_t idx = 0, ssize = sheet_vec.size(); idx < ssize; ++idx) {
    sheets.call<void>("push", sheet_vec[idx]);
  }
  return sheets;
}

// call Ingest::probe_compress
emscripten::val probe_compress( std::string filename, emscripten::val j_selected_files ) {
  std::vector<std::string> selected_files = vecFromArray<emscripten::val, std::string>(j_selected_files);
  std::vector<std::string> file_vec = Ingest::probe_compress( std::move( filename ), std::move( selected_files ) );
  emscripten::val files = emscripten::val::global("Array").new_();
  for (std::int32_t idx = 0, fsize = file_vec.size(); idx < fsize; ++idx) {
    files.call<void>("push", file_vec[idx]);
  }
  return files;
}

// Wrapper functions to provide JS typed memory views JS (direct wasm memory access) to Ingest table buffers
emscripten::val js_get_column_nullbitmap_buffer( Ingest::Table const& table, int16_t column_index ) {
  uint8_t const* buf = table.get_column_nullbitmap_buffer( column_index );
  int32_t length = table.get_column_nullbitmap_buffer_size( column_index );
  if ( !length ) {
    return emscripten::val::global( "undefined" );
  } else {
    return emscripten::val( emscripten::typed_memory_view( length, buf ) );
  }
}

emscripten::val js_get_column_array_buffer( Ingest::Table const& table, int16_t column_index ) {
  void const* buf = table.get_column_array_buffer( column_index );
  Ingest::LogicalTypeId type = table.get_column_type( column_index );
  int32_t length = table.get_column_array_buffer_size( column_index );

  if ( !length ) {
    return emscripten::val::global( "undefined" );
  } else {
    switch ( type ) {
      case Ingest::LogicalTypeId::Boolean:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::BooleanData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::Date:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::DateData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::Time:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::TimeData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::Datetime:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::DateTimeData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::Integer: {
        // Special case for integer: Javascript does not support yet int64 array buffer types
        // So we cast to int32 array buffer, and double the length
        return emscripten::val( emscripten::typed_memory_view( length * 2, static_cast<int32_t const*>( buf ) ) );
      } break;
      case Ingest::LogicalTypeId::Integer32: {
        return emscripten::val( emscripten::typed_memory_view( length, static_cast<int32_t const*>( buf ) ) );
      }
      case Ingest::LogicalTypeId::Integer16: {
        return emscripten::val( emscripten::typed_memory_view( length, static_cast<int16_t const*>( buf ) ) );
      }
      case Ingest::LogicalTypeId::Integer8: {
        return emscripten::val( emscripten::typed_memory_view( length, static_cast<int8_t const*>( buf ) ) );
      }
      case Ingest::LogicalTypeId::Decimal:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::DecimalData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::String:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::StringData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::Error:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::ErrorData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::ListInteger:
        return emscripten::val( emscripten::typed_memory_view( length * 2, static_cast<int32_t const*>( buf ) ) );
      case Ingest::LogicalTypeId::ListDecimal:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::ListDecimalData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::ListDatetime:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::ListDateTimeData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::ListDate:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::ListDateData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::ListTime:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::ListTimeData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::ListBoolean:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::ListBooleanData::ArrayType const*>( buf ) ) );
      case Ingest::LogicalTypeId::ListString:
        return emscripten::val(
            emscripten::typed_memory_view( length, static_cast<Ingest::ListStringData::ArrayType const*>( buf ) ) );
    }
  }
}

emscripten::val js_get_column_offsets_buffer( Ingest::Table const& table, int16_t column_index ) {
  int32_t const* buf = table.get_column_offsets_buffer( column_index );
  int32_t length = table.get_column_offsets_buffer_size( column_index );
  if ( !length ) {
    return emscripten::val::global( "undefined" );
  } else {
    return emscripten::val( emscripten::typed_memory_view( length, buf ) );
  }
}

emscripten::val js_get_column_sub_offsets_buffer( Ingest::Table const& table, int16_t column_index ) {
  int32_t const* buf = table.get_column_sub_offsets_buffer( column_index );
  int32_t length = table.get_column_sub_offsets_buffer_size( column_index );
  if ( !length ) {
    return emscripten::val::global( "undefined" );
  } else {
    return emscripten::val( emscripten::typed_memory_view( length, buf ) );
  }
}

}  // namespace

// Emscripten exports
EMSCRIPTEN_BINDINGS( ingest_exports ) {
  // convert_file function
  emscripten::function( "convert_file", &convert_file, emscripten::allow_raw_pointers() );
  // probe_file function
  emscripten::function( "probe_file", &probe_file, emscripten::allow_raw_pointers() );
  // probe_compress function
  emscripten::function( "probe_compress", &probe_compress, emscripten::allow_raw_pointers() );
  // test_ingest function
  // emscripten::function( "test_ingest", &test_ingest );
  // LogicalTypeId enumeration
  emscripten::enum_<Ingest::LogicalTypeId>( "LogicalTypeId" )
      .value( "Boolean", Ingest::LogicalTypeId::Boolean )
      .value( "Integer", Ingest::LogicalTypeId::Integer )
      .value( "Integer32", Ingest::LogicalTypeId::Integer32 )
      .value( "Integer16", Ingest::LogicalTypeId::Integer16 )
      .value( "Integer8", Ingest::LogicalTypeId::Integer8 )
      .value( "String", Ingest::LogicalTypeId::String )
      .value( "Decimal", Ingest::LogicalTypeId::Decimal )
      .value( "Date", Ingest::LogicalTypeId::Date )
      .value( "Datetime", Ingest::LogicalTypeId::Datetime )
      .value( "Time", Ingest::LogicalTypeId::Time )
      .value( "Error", Ingest::LogicalTypeId::Error )
      .value( "ListInteger", Ingest::LogicalTypeId::ListInteger )
      .value( "ListDecimal", Ingest::LogicalTypeId::ListDecimal )
      .value( "ListDatetime", Ingest::LogicalTypeId::ListDatetime )
      .value( "ListDate", Ingest::LogicalTypeId::ListDate )
      .value( "ListTime", Ingest::LogicalTypeId::ListTime )
      .value( "ListBoolean", Ingest::LogicalTypeId::ListBoolean )
      .value( "ListString", Ingest::LogicalTypeId::ListString );

  // Ingested status enumeration
  emscripten::enum_<Ingest::IngestedStatus>( "IngestedStatus" )
      .value( "STATUS_PENDING", Ingest::IngestedStatus::STATUS_PENDING )
      .value( "STATUS_PROCESSING", Ingest::IngestedStatus::STATUS_PROCESSING )
      .value( "STATUS_COMPLETED", Ingest::IngestedStatus::STATUS_COMPLETED )
      .value( "STATUS_CANCELLED", Ingest::IngestedStatus::STATUS_CANCELLED );

  // Table class
  emscripten::class_<Ingest::Table>( "Table" )
      .constructor<>()
      .function( "dump", &Ingest::Table::dump )
      .function( "get_column_count", &Ingest::Table::get_column_count )
      .function( "get_column_name", &Ingest::Table::get_column_name )
      .function( "get_column_type", &Ingest::Table::get_column_type )
      .function( "get_column_type_as_string", &Ingest::Table::get_column_type_as_string )
      .function( "get_column_element_count", &Ingest::Table::get_column_element_count )
      .function( "get_column_array_buffer_size", &Ingest::Table::get_column_array_buffer_size )
      .function( "get_column_array_buffer_size_in_bytes", &Ingest::Table::get_column_array_buffer_size_in_bytes )
      .function( "get_column_offsets_buffer_size", &Ingest::Table::get_column_offsets_buffer_size )
      .function( "get_column_nullbitmap_buffer_size", &Ingest::Table::get_column_nullbitmap_buffer_size )
      .function( "get_column_null_count", &Ingest::Table::get_column_null_count )
      .function( "get_column_list_element_count", &Ingest::Table::get_column_list_element_count )
      .function( "get_ingested_status", &Ingest::Table::get_ingested_status )
      .function( "cancel_ingesting_data", &Ingest::Table::cancel_ingesting_data )
      // These methods use local wrapper function
      .function( "get_column_array_buffer", &js_get_column_array_buffer )
      .function( "get_column_nullbitmap_buffer", &js_get_column_nullbitmap_buffer )
      .function( "get_column_offsets_buffer", &js_get_column_offsets_buffer )
      .function( "get_column_sub_offsets_buffer", &js_get_column_sub_offsets_buffer );

}

EMSCRIPTEN_BINDINGS( memory_utils ) {
  emscripten::function( "printMemoryReport", &printMemoryReport );
  emscripten::function( "ensureMemory", &ensureMemory );
}
