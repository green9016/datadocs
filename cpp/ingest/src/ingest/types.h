//
// Created by gab on 20/06/19.
//

#ifndef DATADOCS_INGEST_TYPES_H
#define DATADOCS_INGEST_TYPES_H

// STD
#include <cstdint>        // uint8_t, int16_t, int32_t, int64_t, INT32_MAX
#include <string>         // std::string
#include <unordered_map>  // std::unordered_map
#include <vector>         // std::vector

// ingest_parser
#include <ingest_parser/inferrer.h>  // ColumnType

namespace Ingest {

/////////////////////////////
/// LogicalType
/////////////////////////////

// Remap "ColumnType" enumeration to "LogicalTypeId"
typedef ColumnType LogicalTypeId;

// Utility function to return the string representation of a LogicalTypeId (eg. "LogicalTypeId::Boolean",
// "LogicalTypeId::Integer", etc.)
std::string TypeIdToString( LogicalTypeId eTypeId );

// LogicalType
//  Maps a LogicalTypeId to a NativeType and ArrayType (bool, int32_t, etc.)
//  Template Paramters:
//   eTypeId      => A value from LogicalTypeId enumeration (LogicalTypeId::Boolean, LogicalTypeId::Integer, etc.)
//   TNativeType  => An associated native C++ type (bool, int32_t, int64_t, double, etc.)
template<LogicalTypeId eTypeId, typename TNativeType>
class LogicalType {
public:
  // Use LogicalType::TypeId to get the logical type id
  // By default, binds to the eLogicalTypeId template parameter
  constexpr static LogicalTypeId TypeId = eTypeId;
  // Use LogicalType::ValueType to get the associated native C++ type of a single value of that LogicalType
  // By default, binds to the TNativeType template parameter
  typedef TNativeType ValueType;
  // Use LogicalType::ArrayType to get the associated native C++ type of an array of values of that LogicalType
  // To be used as "std::vector<ArrayType>" or "ArrayType const*"
  // By default, binds to the TNativeType template parameter
  // Will be overriden for specific types (BooleanType or StringType for example)
  typedef TNativeType ArrayType;

  // Disable all constructors and destructors. This type is only using for Type system logic
  LogicalType() = delete;

  LogicalType( LogicalType const& ) = delete;

  LogicalType( LogicalType&& ) = delete;

  ~LogicalType() = delete;

  LogicalType& operator=( LogicalType const& ) = delete;

  LogicalType& operator=( LogicalType&& ) = delete;
};

// Declares all the LogicalTypes used by Ingest:
// => BooleanType, IntegerType, DateType, DateTimeType, TimeType, DecimalType, StringType
// Example usage:
//    IntegerType::TypeValue  => gives the value LogicalTypeId::Integer
//    IntegerType::ValueType  => gives the C++ type int64_t
//    IntegerType::ArrayType  => gives the C++ type int64_t (to be used as std::vector<int64_t> or int64_t const *)
typedef LogicalType<LogicalTypeId::Integer, int64_t> IntegerType;
typedef LogicalType<LogicalTypeId::Integer32, int32_t> Integer32Type;
typedef LogicalType<LogicalTypeId::Integer16, int16_t> Integer16Type;
typedef LogicalType<LogicalTypeId::Integer8, int8_t> Integer8Type;
typedef LogicalType<LogicalTypeId::Date, int32_t> DateType;
typedef LogicalType<LogicalTypeId::Datetime, double> DateTimeType;
typedef LogicalType<LogicalTypeId::Time, double> TimeType;
typedef LogicalType<LogicalTypeId::Decimal, double> DecimalType;

// Special cases for BooleanType: the ArrayType is uint8_t instead of bool
//  Rationale: Booleans are stored as "packed bools" (1 bit = 1 bool) in an uint8 array
class BooleanType : public LogicalType<LogicalTypeId::Boolean, bool> {
public:
  typedef uint8_t ArrayType;
};

// Special case for StringType: the ArrayType is uint8_t
//  Rationale: Strings are stored as UTF8 unicode points in an uint8 array
class StringType : public LogicalType<LogicalTypeId::String, std::string> {
public:
  typedef uint8_t ArrayType;
};

// Special case for ErrorType: the Arraytype is uint8_t
// Rationale: Errors are stared as UTE7 unicode points in an uint8 array
class ErrorsType : public LogicalType<LogicalTypeId::Error, std::unordered_map<int, ErrorType>> {
public:
  typedef uint8_t ArrayType;
};

// Special case for List Integer: the Arraytype is int64_t
// Rationale: Integers are stared as int in an int64 array
class ListIntegerType : public LogicalType<LogicalTypeId::ListInteger, std::vector<Cell>> {
public:
  typedef int64_t ArrayType;
};

// Special case for List Decimal: the Arraytype is double
// Rationale: Decimals are stared as float in a double array
class ListDecimalType : public LogicalType<LogicalTypeId::ListDecimal, std::vector<Cell>> {
public:
  typedef double ArrayType;
};

// Special case for List DateTime: the Arraytype is double
// Rationale: DateTimes are stared as float in a double array
class ListDateTimeType : public LogicalType<LogicalTypeId::ListDatetime, std::vector<Cell>> {
public:
  typedef double ArrayType;
};

// Special case for List Date: the Arraytype is int32_t
// Rationale: Dates are stared as int in a int32_t array
class ListDateType : public LogicalType<LogicalTypeId::ListDate, std::vector<Cell>> {
public:
  typedef int32_t ArrayType;
};

// Special case for List Time: the Arraytype is double
// Rationale: Times are stared as float in double array
class ListTimeType : public LogicalType<LogicalTypeId::ListTime, std::vector<Cell>> {
public:
  typedef double ArrayType;
};

// Special case for List Boolean: the Arraytype use uint8_t instead of bool
// Rationale: Booleans are stored as "packed bools" (1 bit = 1 bool) in an uint8 array
class ListBooleanType : public LogicalType<LogicalTypeId::ListBoolean, std::vector<Cell>> {
public:
  typedef uint8_t ArrayType;
};

// Special case for List String: the Arraytype is uint8_t
// Rationale: Strings are stored as UTF8 unicode points in an uint8 array
class ListStringType : public LogicalType<LogicalTypeId::ListString, std::vector<Cell>> {
public:
  typedef uint8_t ArrayType;
};
}  // namespace Ingest

#endif
