//
// Created by gab on 07/01/20
//

#include <iostream>
#include <boost/container/flat_map.hpp>
#include <rapidjson/document.h>
#include <unicode/ucnv.h>

extern "C" int libxmltest( int argc, char** argv );
extern "C" int zlibtest( int argc, char** argv );

// main
int main( int argc, char** argv ) {
  std::cout << "testing ICU" << std::endl;
  UErrorCode status = U_ZERO_ERROR;

  std::cout << "testing libxml2" << std::endl;
  libxmltest(argc, argv);

  std::cout << "testing boost" << std::endl;
  boost::container::flat_map<int,int> flatmap;

  std::cout << "testing rapidjson" << std::endl;
  rapidjson::Document doc;

  std::cout << "testing zlib" << std::endl;
  zlibtest(argc, argv);

  return 1;
}
