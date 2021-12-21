# Ingest 3rd-party libraries / dependencies

By default, Ingest depends on the ICU 3rd-party library. But other libraries might be used in case they would be needed.

The build system provides automatically access to the following libraries that may be used with Ingest:
- ICU
- libxml2
- rapidjson
- boost
- zlib

Note that libxml2 depends on both ICU and zlib.

## How the dependencies are declared

The source code for these libraries are fetched and build automatically by the build system. 
Everything is handled in the main CMakeLists.txt file, thanks to usage of the "fetch_dependency" function. Have a look at the line 120:

```
# Zlib
fetch_dependency(zlib "cmake/zlib/zlib.txt.in")
include(cmake/zlib/zlib.cmake)

# ICU
fetch_dependency(icu "cmake/icu/icu.txt.in")
include(cmake/icu/icu.cmake)

# LibXML2
fetch_dependency(xml2 "cmake/libxml2/libxml2.txt.in")
include(cmake/libxml2/libxml2.cmake)

# Rapidjson
fetch_dependency(rapidjson "cmake/rapidjson/rapidjson.txt.in")

# Boost
fetch_dependency(boost "cmake/boost/boost.txt.in")
```

For each dependency, there is a call to "fetch_dependency" function, taking in argument a "template" file located in cmake subfolder.
The template file contains the Git repository URL of the library and the Git tag to use. The function will just fetch the source code of 
the project to ${CMAKE_CURRENT_BINARY_DIR}/<dependency_name> folder, and also creates a ${CMAKE_CURRENT_BINARY_DIR}/<dependency_name>-build that will get some additional 
automatically generated files.

Then, for each "buildable" dependency (zlib, ICU, libxml2), there is an additional "include" directive to include the CMake build definitions files, also located in cmake subfolder.
The CMake build file generally come from a pre-existing one, with various tweaks to customize the build flags / options and paths.

The "headers-only" (rapidjson, boost) dependencies does not need a build step nor a CMake file.

## How to use a library

To use a library in a C++ project/target, do the following in the CMakeList.txt file:

- If it is an header-only library (boost, rapidjson), simply add:

```
  target_include_directories(<your_target> PRIVATE ${CMAKE_CURRENT_BINARY_DIR}/<dependency_name>)
```

You will be able to #include the headers (#include <boost/...>, etc...).

Note that the exact path to use in the target_include_directories might change a bit, depending on the library. 
Please consult each <dependency_name>.txt.in for more detailed instructions and special cases.

- If it is a buildable library, with compiled code (libxml2, zlib, icu), add:

```
  target_include_directories(<your_target> PRIVATE $<TARGET_PROPERTY:<dependency_name>,INTERFACE_INCLUDE_DIRECTORIES>)
  target_link_libraries(<your_target> PUBLIC <dependency_name>)
```

## Sample 'test_dependencies' project

For reference, a sample project is defined in the main CMakeList.txt: 'test_dependencies'. See lines starting at 333.
This project illustrate how to correctly declare a project that would use ALL available 3rd party libraries.

You may build it with (using DOCKER):  

```
yarn run build_test_dependencies
```




 

