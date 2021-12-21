//
// Created by gab on 23/06/19.
//

// Main header
#include "data.h"

// STD
#include <vector>  // std::vector

int32_t Ingest::pack_bool_in_uint8_vector( bool value, int32_t count, std::vector<uint8_t>& array ) {
  // Simple bool packing algorithm
  const int8_t bitnum = count % 8;
  if ( bitnum == 0 ) {
    array.push_back( 0 );
  }
  if ( value ) {
    uint8_t& byte = array.back();
    byte |= 1 << bitnum;
  }

  return count++;
}
