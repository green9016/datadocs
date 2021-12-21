//
// Created by gab on 23/06/19.
//

// Main header
#include "types.h"

// STD
#include <utility>  // std::move

std::string Ingest::TypeIdToString( LogicalTypeId eTypeId ) {
  switch ( eTypeId ) {
    case LogicalTypeId::String:
      return std::move( "LogicalTypeId::String" );
    case LogicalTypeId::Boolean:
      return std::move( "LogicalTypeId::Boolean" );
    case LogicalTypeId::Integer:
      return std::move( "LogicalTypeId::Integer" );
    case LogicalTypeId::Integer32:
      return std::move( "LogicalTypeId::Integer32" );
    case LogicalTypeId::Integer16:
      return std::move( "LogicalTypeId::Integer16" );
      case LogicalTypeId::Integer8:
      return std::move( "LogicalTypeId::Integer8" );
    case LogicalTypeId::Decimal:
      return std::move( "LogicalTypeId::Decimal" );
    case LogicalTypeId::Date:
      return std::move( "LogicalTypeId::Date" );
    case LogicalTypeId::Time:
      return std::move( "LogicalTypeId::Time" );
    case LogicalTypeId::Datetime:
      return std::move( "LogicalTypeId::Datetime" );
    case LogicalTypeId::Error:
      return std::move( "LogicalTypeId::Error" );
    case LogicalTypeId::ListInteger:
      return std::move( "LogicalTypeId::ListInteger" );
    case LogicalTypeId::ListDecimal:
      return std::move( "LogicalTypeId::ListDecimal" );
    case LogicalTypeId::ListDatetime:
      return std::move( "LogicalTypeId::ListDatetime" );
    case LogicalTypeId::ListDate:
      return std::move( "LogicalTypeId::ListDate" );
    case LogicalTypeId::ListTime:
      return std::move( "LogicalTypeId::ListTime" );
    case LogicalTypeId::ListBoolean:
      return std::move( "LogicalTypeId::ListBoolean" );
    case LogicalTypeId::ListString:
      return std::move( "LogicalTypeId::ListString" );
  }

  return "<unknown LogicalTypeId>";
}
