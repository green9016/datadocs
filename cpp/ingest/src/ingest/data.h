//
// Created by gab on 20/06/19.
//

#ifndef DATADOCS_INGEST_DATA_H
#define DATADOCS_INGEST_DATA_H

// STD
#include <algorithm>  // std::copy
#include <cstdint>    // uint8_t, int16_t, int32_t, int64_t, INT32_MAX
#include <iostream>   // std::cout, std::endl
#include <iterator>   // std::back_inserter
#include <string>     // std::string
#include <utility>    // std::move
#include <vector>     // std::vector
#include <iomanip>
#include <sstream>      // std::ostringstream

// Ingest
#include "types.h"

namespace Ingest {

////////////////////////////////////
// Data
////////////////////////////////////

template<typename TLogicalType>
class Data {
public:
  // Use Data::LogicalType to get the associated Logical Type
  typedef TLogicalType LogicalType;
  // Convenience Aliases
  typedef typename TLogicalType::ValueType ValueType;
  typedef typename TLogicalType::ArrayType ArrayType;
  constexpr static const LogicalTypeId TypeId = TLogicalType::TypeId;

  // Constructor
  Data( int32_t element_count_hint = 0,       // Estimated number of elements (for memory prereservation purposes)
        double average_element_size = 0,      // Estimated size of an element, in terms of ArrayType
                                              // Used for variable-sized types, such as Strings (N chars)
                                              // And for short-sized types, such as Booleans (1/8 of int)
        bool prereserve_offsets = false,      // Offsets: used for variable-sized types: String and lists
        bool prereserve_suboffsets = false )  // SubOffsets: only used for List of Strings ("doubly" variable sized)
      : nullcount_( 0 ) {

    // Prereservation of memory
    if ( element_count_hint ) {
      // data buffer prereservation
      if ( !average_element_size ) {
        // if no average_element_size is given, then use 1 (1 element is 1 slot in the array)
        average_element_size = 1;
      }
      // Compute the data buffer size (be sure to cap it to INT32_MAX for total size)
      int array_buffer_size = ( average_element_size * element_count_hint * sizeof( ArrayType ) ) <= INT32_MAX
                                 ? average_element_size * element_count_hint
                                 : INT32_MAX / sizeof( ArrayType );
      // if the average element size is smaller than 1 (eg. boolean), be sure to add an offset
      if (average_element_size < 1) {
        array_buffer_size++;
      }
      this->array_.reserve( array_buffer_size );

      // nullbitmap prereservation
      this->nullbitmap_.reserve( ( ( element_count_hint - 1 ) / 8 ) + 1 );

      // offsets prereservation (optional)
      if ( prereserve_offsets ) {
        this->offsets_.reserve( element_count_hint + 1 );
      }
      if ( prereserve_suboffsets ) {
        this->sub_offsets_.reserve( element_count_hint + 1 );
      }

      std::cout << "creating Data buffer " << TypeIdToString( TypeId ) << " for " << element_count_hint
                << " elements. Memory prereservation report: " << std::endl;
      std::cout << "\tdata buffer: " << array_buffer_size * sizeof( ArrayType ) << " bytes" << std::endl;
      std::cout << "\tnullbitmap: " << ( ( ( element_count_hint - 1 ) / 8 ) + 1 ) << " bytes" << std::endl;
      if ( prereserve_offsets ) {
        std::cout << "\toffsets: " << ( element_count_hint + 1 ) * sizeof( int32_t ) << " bytes" << std::endl;
      }
      if ( prereserve_suboffsets ) {
        std::cout << "\tsub offsets: " << ( element_count_hint + 1 ) * sizeof( int32_t ) << " bytes" << std::endl;
      }
    } else {

    std::cout << "creating Data buffer " << TypeIdToString( TypeId ) << std::endl;
    }
  }

  Data( Data&& other )
      : array_( std::move( other.array_ ) ),
        nullbitmap_( std::move( other.nullbitmap_ ) ),
        nullcount_( std::move( other.nullcount_ ) ),
        offsets_( std::move( other.offsets_ ) ),
        sub_offsets_( std::move( other.sub_offsets_ ) ) {}

  Data& operator=( Data&& other ) {
    array_ = std::move( other.array_ );
    nullbitmap_ = std::move( other.nullbitmap_ );
    nullcount_ = std::move( other.nullcount_ );
    offsets_ = std::move( other.offsets_ );
    sub_offsets_ = std::move( other.sub_offsets_ );
    return *this;
  }

  virtual ~Data() = default;

  Data( Data const& ) = delete;

  Data& operator=( const Data& ) = delete;

  // Element count
  // In terms of number of elements that have being added
  virtual int32_t get_element_count() const = 0;

  // Element count
  // In terms of number of all list elements that being added for case list type only
  virtual int32_t get_list_element_count() const = 0;

  // Append a new element
  virtual void append( ValueType value, bool isnull ) = 0;

  // Offsets
  std::vector<int32_t> const& get_offsets_ref() const { return this->offsets_; }

  int32_t const* get_offsets_buffer() const { return this->offsets_.data(); }

  int32_t get_offsets_buffer_size() const { return static_cast<int32_t>( this->offsets_.size() ); }

  // only usefull for ListStringType
  int32_t const* get_sub_offsets_buffer() const { return this->sub_offsets_.data(); }

  int32_t get_sub_offsets_buffer_size() const { return static_cast<int32_t>( this->sub_offsets_.size() ); }

  // Nullmap
  std::vector<uint8_t> const& get_nullbitmap_ref() const { return this->nullbitmap_; }

  uint8_t const* get_nullbitmap_buffer() const { return this->nullbitmap_.data(); }

  int32_t get_nullbitmap_buffer_size() const { return static_cast<int32_t>( this->nullbitmap_.size() ); }

  int32_t get_null_count() const { return this->nullcount_; }

  // Array
  std::vector<ArrayType> const& get_array_ref() const { return this->array_; }

  ArrayType const* get_array_buffer() const { return this->array_.data(); }

  int32_t get_array_buffer_size() const { return static_cast<int32_t>( this->array_.size() ); }

  int32_t get_array_buffer_size_in_bytes() const {  // In terms of bytes
    // explicit conversion needed as we multiply to int32
    return static_cast<int32_t>( this->get_array_buffer_size() * sizeof( ArrayType ) );
  }

  void dump() const {
    std::cout << "\telemnent count: " << this->get_element_count() << std::endl
              << "\tdata buffer size (bytes): " << this->get_array_buffer_size_in_bytes() << std::endl
              << "\tnull count: " << this->get_null_count() << std::endl
              << "\tnull bitmap size (bytes): " << this->nullbitmap_.size() << std::endl
              << "\toffsets buffer size (bytes): " << this->offsets_.size() * sizeof( int32_t ) << std::endl
              << "\tsuboffsets buffer size (bytes): " << this->sub_offsets_.size() * sizeof( int32_t ) << std::endl
              << "\tTOTAL SIZE (bytes): "
              << this->get_array_buffer_size_in_bytes() + this->nullbitmap_.size() +
                     this->offsets_.size() * sizeof( int32_t ) + this->sub_offsets_.size() * sizeof( int32_t )
              << std::endl;
  }

protected:
  std::vector<ArrayType> array_;
  std::vector<uint8_t> nullbitmap_;
  int32_t nullcount_;
  std::vector<int32_t> offsets_;
  std::vector<int32_t> sub_offsets_;
};

// Utility method to pack a bool in an uint8 vector
// Used by BooleanData as the primary way to store booleans, as well as in all column types to store "null bitmaps"
int32_t pack_bool_in_uint8_vector( bool value, int32_t count, std::vector<uint8_t>& array );

// FlatDataColumn
//  Must be parametrized by a LogicalType (such as IntegerType, ...)
//  This is for FlatData columns, whose underlaying data storage type is directly the LogicalType::NativeType
template<typename TLogicalType>
class FlatData : public Data<TLogicalType> {
public:
  // Constructor
  FlatData( int32_t element_count_hint = 0 ) : Data<TLogicalType>( element_count_hint ) {}

  FlatData( FlatData&& other ) = default;

  FlatData& operator=( FlatData&& other ) = default;

  virtual ~FlatData() = default;

  virtual int32_t get_element_count() const override { return this->get_array_buffer_size(); }

  virtual int32_t get_list_element_count() const override { return this->get_element_count(); }

  virtual void append( typename Data<TLogicalType>::ValueType value, bool isnull ) override {
    if ( ( this->get_array_buffer_size_in_bytes() + sizeof( typename Data<TLogicalType>::ValueType ) ) <= INT32_MAX ) {
      pack_bool_in_uint8_vector( !isnull, this->get_element_count(), this->nullbitmap_ );
      if ( isnull ) {
        this->nullcount_++;
      }
      this->array_.push_back( value );
    } else {
      std::cerr << "[Error]FlatData::append(): can't add a new value to the data buffer as it would grow it "
                   "above the maximum 2GB allowed size"
                << std::endl;
    }
  }
};

typedef FlatData<DateType> DateData;
typedef FlatData<TimeType> TimeData;
typedef FlatData<DateTimeType> DateTimeData;
typedef FlatData<IntegerType> IntegerData;
typedef FlatData<Integer32Type> Integer32Data;
typedef FlatData<Integer16Type> Integer16Data;
typedef FlatData<Integer8Type> Integer8Data;
typedef FlatData<DecimalType> DecimalData;

// BooleanData
//  Special case: the LogicalType::NativeType (bool) is packed in a std::vector<uint_8>
class BooleanData : public Data<BooleanType> {
public:
  // Constructor
  BooleanData( int32_t element_count_hint = 0 )
      : Data<BooleanType>( element_count_hint, element_count_hint ? 1. / 8. : 0 ),
        count_( 0 ) {}  // Booleans are packed as group of 8 bits

  BooleanData( BooleanData&& other ) = default;

  BooleanData& operator=( BooleanData&& other ) = default;

  virtual ~BooleanData() = default;

  virtual int32_t get_element_count() const override { return this->count_; }

  virtual int32_t get_list_element_count() const override { return this->get_element_count(); }

  // Append an element (LogicalType::NativeType)
  virtual void append( BooleanType::ValueType /* bool */ value, bool isnull ) override {
    pack_bool_in_uint8_vector( !isnull, this->get_element_count(), this->nullbitmap_ );
    if ( isnull ) {
      this->nullcount_++;
    }
    pack_bool_in_uint8_vector( value, this->get_element_count(), this->array_ );
    this->count_++;
  }

private:
  int32_t count_;
};

// StringData
//   Special case: the LogicalType::NativeType (std::string) is packed in a std::vector<uint_8> along with offsets to
//   mark the limits between the strings
class StringData : public Data<StringType> {
public:
  // Constructor
  StringData( int32_t element_count_hint = 0 )
      : Data<StringType>( element_count_hint,
                          16,  // Assumes the average string is 16 unicode points
                          true ) {
    // initialize the first offset = 0
    offsets_.push_back( 0 );
  }

  StringData( StringData&& other ) = default;

  StringData& operator=( StringData&& other ) = default;

  virtual ~StringData() = default;

  virtual int32_t get_element_count() const override {
    return static_cast<int32_t>( this->offsets_.size() - 1 );
  }  // explicit conversion needed as we use size_t

  virtual int32_t get_list_element_count() const override { return this->get_element_count(); }

  virtual void append( StringType::ValueType /* std::string */ value, bool isnull ) override {
    if ( ( value.size() + array_.size() ) <= INT32_MAX ) {
      pack_bool_in_uint8_vector( !isnull, this->get_element_count(), this->nullbitmap_ );
      if ( isnull ) {
        this->nullcount_++;
      }
      // do the copy
      std::copy( value.c_str(), value.c_str() + static_cast<int32_t>( value.size() ),
                 std::back_inserter( this->array_ ) );
      // store offset
      this->offsets_.push_back( static_cast<int32_t>( this->array_.size() ) );
    } else {
      std::cerr << "[Error]StringData::append(): can't add a new value to the data buffer as it would grow it "
                   "above the maximum 2GB allowed size"
                << std::endl;
    }
  }
};

template<typename TLogicalType>
class ListFlatData : public Data<TLogicalType> {
public:
  // Constructor
  ListFlatData( int32_t element_count_hint = 0 )
      : Data<TLogicalType>( element_count_hint,
                            1,  // Assume list consist of 1 element only, to simplify prereservation of memory
                            true ) {
    // initialize the first offset = 0
    this->offsets_.push_back( 0 );
  }

  ListFlatData( ListFlatData&& other ) = default;

  ListFlatData& operator=( ListFlatData&& other ) = default;

  virtual ~ListFlatData() = default;

  virtual int32_t get_element_count() const override { return static_cast<int32_t>( this->offsets_.size() - 1 ); }

  virtual int32_t get_list_element_count() const override { return static_cast<int32_t>( this->array_.size() ); }

  virtual void append( typename Data<TLogicalType>::ValueType value, bool isnull ) override {
    if ( ( this->get_array_buffer_size_in_bytes() + sizeof( typename Data<TLogicalType>::ValueType ) ) <= INT32_MAX ) {
      pack_bool_in_uint8_vector( !isnull, this->get_element_count(), this->nullbitmap_ );
      if ( isnull ) {
        this->nullcount_++;
      } else {
        for ( auto v : value ) {
          this->array_.push_back( std::get<typename Data<TLogicalType>::ArrayType>( v ) );
        }
      }
      // store offset
      this->offsets_.push_back( static_cast<int32_t>( this->array_.size() ) );
    } else {
      std::cerr << "[Error]ListFlatData::append(): can't add a new value to the data buffer as it would grow "
                   "it above the maximum 2GB allowed size"
                << std::endl;
    }
  }
};

typedef ListFlatData<ListIntegerType> ListIntegerData;
typedef ListFlatData<ListDecimalType> ListDecimalData;
typedef ListFlatData<ListDateTimeType> ListDateTimeData;
typedef ListFlatData<ListDateType> ListDateData;
typedef ListFlatData<ListTimeType> ListTimeData;

// ListBooleanData
// Special case: the LogicalType::Native (bool) is packed in a std::vector<uint_8>
class ListBooleanData : public Data<ListBooleanType> {
public:
  // Constructor
  ListBooleanData( int32_t element_count_hint = 0 )
      : Data<ListBooleanType>( element_count_hint, element_count_hint ? 1. / 8. : 0, true ), count_( 0 ) {
    // initialize the first offset = 0
    this->offsets_.push_back( 0 );
  }

  ListBooleanData( ListBooleanData&& other ) = default;

  ListBooleanData& operator=( ListBooleanData&& other ) = default;

  virtual ~ListBooleanData() = default;

  virtual int32_t get_element_count() const override { return static_cast<int32_t>( this->offsets_.size() - 1 ); }

  virtual int32_t get_list_element_count() const override { return this->count_; }

  // Append an element (LogicalType::NativeType)
  virtual void append( ListBooleanType::ValueType /* std::vector<Cell> */ value, bool isnull ) override {
    pack_bool_in_uint8_vector( !isnull, this->get_element_count(), this->nullbitmap_ );
    if ( isnull ) {
      this->nullcount_++;
    } else {
      for ( auto v : value ) {
        bool bv = std::get<bool>( v );
        pack_bool_in_uint8_vector( bv, this->get_list_element_count(), this->array_ );
        this->count_++;
      }
    }
    // store offset
    this->offsets_.push_back( static_cast<int32_t>( this->count_ ) );
  }

private:
  int32_t count_;
};

class ListStringData : public Data<ListStringType> {
public:
  // Constructor
  ListStringData( int32_t element_count_hint = 0 )
      : Data<ListStringType>( element_count_hint,
                              16,  // Assume 1 string per list, of 16 unicode points on average
                              true,
                              true  // sub_offsets are needed for that case
        ) {
    // initialize the first offset = 0
    offsets_.push_back( 0 );
    sub_offsets_.push_back( 0 );
  }

  ListStringData( ListStringData&& other ) = default;

  ListStringData& operator=( ListStringData&& other ) = default;

  virtual ~ListStringData() = default;

  virtual int32_t get_element_count() const override {
    return static_cast<int32_t>( this->offsets_.size() - 1 );
  }  // explicit conversion needed as we use size_t

  virtual int32_t get_list_element_count() const override {
    return static_cast<int32_t>( this->sub_offsets_.size() - 1 );
  }

  virtual void append( ListStringType::ValueType /* std::vector<Cell> */ value, bool isnull ) override {
    if ( ( value.size() + array_.size() ) <= INT32_MAX ) {
      pack_bool_in_uint8_vector( !isnull, this->get_element_count(), this->nullbitmap_ );
      if ( isnull ) {
        this->nullcount_++;
      }
      for ( auto v : value ) {
        std::string str_v = std::get<std::string>( v );
        // do the copy
        std::copy( str_v.c_str(), str_v.c_str() + static_cast<int32_t>( str_v.size() ),
                   std::back_inserter( this->array_ ) );
        // store sub offset
        this->sub_offsets_.push_back( static_cast<int32_t>( this->array_.size() ) );
      }
      // store offset
      this->offsets_.push_back( static_cast<int32_t>( this->array_.size() ) );
    } else {
      std::cerr << "[Error]StringData::append(): can't add a new value to the data buffer as it would grow it "
                   "above the maximum 2GB allowed size"
                << std::endl;
    }
  }
};

// ErrorData
//   Special case: the LogicalType::NativeType (std::unordered_map<int, ErrorType>) is packed in a std::vector<uint_8>
//   along with offsets to mark the limits between the strings
class ErrorData : public Data<ErrorsType> {
public:
  // Constructor
  // Assumes it will be empty most of the time
  ErrorData() : Data<ErrorsType>() {
    // initialize the first offset = 0
    offsets_.push_back( 0 );
  }

  ErrorData( ErrorData&& other ) = default;

  ErrorData& operator=( ErrorData&& other ) = default;

  virtual ~ErrorData() = default;

  virtual int32_t get_element_count() const override {
    return static_cast<int32_t>( this->offsets_.size() - 1 );
  }  // explicit conversion needed as we use size_t

  virtual int32_t get_list_element_count() const override { return this->get_element_count(); }

  virtual void append( ErrorsType::ValueType /* std::unordered_map<int, ErrorType> */ value, bool isnull ) override {
    std::string str_value = "";
    auto error_size = value.size();
    if ( error_size > 0 ) {
      str_value = "{";
    }
    std::int32_t index = 0;
    for ( auto iter : value ) {
      str_value += std::string( index > 0 ? ",\"" : "\"" ) + std::to_string( iter.first ) + "\":{\"c\":\"" +
                   std::to_string( static_cast<std::underlying_type<ErrorCode>::type>( iter.second.error_code ) ) +
                   "\",\"v\":\"" + escape_json(iter.second.value) + "\"}";
      index++;
    }
    if ( error_size > 0 ) {
      str_value += "}";
    }
    if ( ( str_value.size() + array_.size() ) <= INT32_MAX ) {
      pack_bool_in_uint8_vector( !isnull, this->get_element_count(), this->nullbitmap_ );
      if ( isnull ) {
        this->nullcount_++;
      }
      // do the copy
      std::copy( str_value.c_str(), str_value.c_str() + static_cast<int32_t>( str_value.size() ),
                 std::back_inserter( this->array_ ) );
      // store offset
      this->offsets_.push_back( static_cast<int32_t>( this->array_.size() ) );
    } else {
      std::cerr << "[Error]ErrorData::append(): can't add a new value to the data buffer as it would grow it "
                   "above the maximum 2GB allowed size"
                << std::endl;
    }
  }

  std::string escape_json(const std::string &s) {
    std::ostringstream o;
    for (auto c = s.cbegin(); c != s.cend(); c++) {
        switch (*c) {
        case '"': o << "\\\""; break;
        case '\\': o << "\\\\"; break;
        case '\b': o << "\\b"; break;
        case '\f': o << "\\f"; break;
        case '\n': o << "\\n"; break;
        case '\r': o << "\\r"; break;
        case '\t': o << "\\t"; break;
        default:
            if ('\x00' <= *c && *c <= '\x1f') {
                o << "\\u"
                  << std::hex << std::setw(4) << std::setfill('0') << (int)*c;
            } else {
                o << *c;
            }
        }
    }
    return o.str();
}
};

}  // namespace Ingest

#endif
