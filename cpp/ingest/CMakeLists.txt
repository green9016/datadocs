cmake_minimum_required(VERSION 3.8.2)
project(ingest)

# Global options

# C++ 17 is required
set(CMAKE_CXX_STANDARD 17)

if (NOT WIN32)
  # No exceptions
  add_compile_options(-fno-exceptions)
  # Enable all warnings
  add_compile_options(-Wall)
  #add_compile_options(-Wextra)
endif ()

# Emscripten specific options
if (EMSCRIPTEN)
  # Use strict mode
  add_compile_options(-s STRICT=1)

  # Tweak Release mode to O3
  string(REGEX MATCH "-O2" IS_O2_CXX "${CMAKE_CXX_FLAGS_RELEASE}")
  if (IS_O2_CXX)
    string(REGEX REPLACE "-O2" "-O3" CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE}")
  else ()
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3")
  endif ()

  string(REGEX MATCH "-O2" IS_O2_C "${CMAKE_C_FLAGS_RELEASE}")
  if (IS_O2_C)
    string(REGEX REPLACE "-O2" "-O3" CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE}")
  else ()
    set(CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE} -O3")
  endif ()

  string(REGEX MATCH "-O2" IS_O2_EXE "${CMAKE_EXE_LINKER_FLAGS_RELEASE}")
  if (IS_O2_EXE)
    string(REGEX REPLACE "-O2" "-O3" CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_RELEASE}")
  else ()
    set(CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_RELEASE} -O3")
  endif ()

  # Tweak Debug mode to O1
  string(REGEX MATCH "-O0" IS_O1_CXX "${CMAKE_CXX_FLAGS_DEBUG}")
  if (IS_O0_CXX)
    string(REGEX REPLACE "-O0" "-O1" CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG}")
  else ()
    set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -O1")
  endif ()

  string(REGEX MATCH "-O0" IS_O0_C "${CMAKE_C_FLAGS_DEBUG}")
  if (IS_O0_C)
    string(REGEX REPLACE "-O0" "-O1" CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG}")
  else ()
    set(CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} -O1")
  endif ()

  string(REGEX MATCH "-O0" IS_O0_EXE "${CMAKE_EXE_LINKER_FLAGS_DEBUG}")
  if (IS_O0_EXE)
    string(REGEX REPLACE "-O0" "-O1" CMAKE_EXE_LINKER_FLAGS_RELEASE "${CMAKE_EXE_LINKER_FLAGS_DEBUG}")
  else ()
    set(CMAKE_EXE_LINKER_FLAGS_DEBUG "${CMAKE_EXE_LINKER_FLAGS_DEBUG} -O1")
  endif ()

  # Tweak MinSizeRel mode to Oz => Disabled for now
  #set(CMAKE_C_FLAGS_MINSIZEREL "-Oz")
  #set(CMAKE_EXE_LINKER_FLAGS_MINSIZEREL "-Oz")
  #set(CMAKE_CXX_FLAGS_MINSIZEREL "-DNDEBUG ${CMAKE_C_FLAGS_MINSIZEREL}")

  # Disable assertions (for slight performance gain): let the flag be driven by overall optimization level
  # set(emscripten_common_ldflags "${emscripten_common_ldflags}  -s ASSERTIONS=0")
  # Use dlmalloc (faster than emmalloc, though bigger in size)
  set(emscripten_common_ldflags "${emscripten_common_ldflags}  -s MALLOC=dlmalloc")
  # Strict mode
  set(emscripten_common_ldflags "${emscripten_common_ldflags}  -s STRICT=1")
  # Initial memory size
  set(emscripten_common_ldflags "${emscripten_common_ldflags}  -s TOTAL_MEMORY=67108864") # 64MB of memory initially, which is sufficient to process 150MB data (typical cases ?)
  # Allow memory growth (in case of bigger files)
  set(emscripten_common_ldflags "${emscripten_common_ldflags}  -s ALLOW_MEMORY_GROWTH=1")
  # Disable exception catching
  set(emscripten_common_ldflags "${emscripten_common_ldflags}  -s DISABLE_EXCEPTION_CATCHING=1")

  # Main browser thread linker options
  # Environment is 'web'
  set(emscripten_main_ldflags "${emscripten_main_ldflags}      -s ENVIRONMENT=web")

  # Worker thread linker options
  # Environment is 'worker'
  set(emscripten_worker_ldflags "${emscripten_worker_ldflags}   -s ENVIRONMENT=worker")
endif ()

function (fetch_dependency name cmake_file)
  if(EXISTS ${CMAKE_BINARY_DIR}/${name}-build)
    message(WARNING "${Cyan}Dependency found - not rebuilding - ${CMAKE_BINARY_DIR}/${name}-build${ColorReset}")
  else()
    message("${Cyan}Fetching Dependency '${name}' - ${CMAKE_BINARY_DIR}/${name}-download${ColorReset}")
    configure_file(${cmake_file} ${name}-download/CMakeLists.txt)
    execute_process(COMMAND ${CMAKE_COMMAND} -G "${CMAKE_GENERATOR}" .
            RESULT_VARIABLE result
            WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/${name}-download )
    if(result)
      message(FATAL_ERROR "CMake step for ${name} failed: ${result}")
    endif()
    execute_process(COMMAND ${CMAKE_COMMAND} --build .
            RESULT_VARIABLE result
            WORKING_DIRECTORY ${CMAKE_BINARY_DIR}/${name}-download )
    if(result)
      message(FATAL_ERROR "Build step for ${name} failed: ${result}")
    endif()
  endif()
endfunction()


###################
# fetch dependencies
###################

# Zlib
fetch_dependency(zlib "cmake/zlib/zlib.txt.in")
include(cmake/zlib/zlib.cmake)

# ICU
fetch_dependency(icu "cmake/icu/icu.txt.in")
include(cmake/icu/icu.cmake)

# LibXML2
fetch_dependency(libxml2 "cmake/libxml2/libxml2.txt.in")
include(cmake/libxml2/libxml2.cmake)
# libexpat
fetch_dependency(expat "cmake/libexpat/libexpat.txt.in")
include(cmake/libexpat/libexpat.cmake)

# Rapidjson
fetch_dependency(rapidjson "cmake/rapidjson/rapidjson.txt.in")

# Boost
fetch_dependency(boost "cmake/boost/boost.txt.in")

##########################
# simple_icu_init library
##########################
add_library(simple_icu_init STATIC src/simple_icu_init/simple_icu_init.cpp)

# Includes
target_include_directories(simple_icu_init
        # Interface headers
        PUBLIC src/simple_icu_init
        # Privately includes icu
        PRIVATE $<TARGET_PROPERTY:icu,INTERFACE_INCLUDE_DIRECTORIES>
        )

target_link_libraries(simple_icu_init
        # Publicly link to icu
        PUBLIC icu)

##########################
# memory_utils library
##########################
add_library(memory_utils STATIC src/memory_utils/memory_utils.cpp)

# Includes
target_include_directories(memory_utils
        # Interface headers
        PUBLIC src/memory_utils
        )

###################
# ingest_parser library (Dmitry)
###################

add_library(ingest_parser STATIC
        src/ingest_parser/inferrer.cpp
        src/ingest_parser/file_reader.cpp
        src/ingest_parser/csv_reader.cpp
        src/ingest_parser/xls_reader.cpp
        src/ingest_parser/zip_reader.cpp
        src/ingest_parser/utility.cpp
        src/ingest_parser/xls/read_xls.cpp
        src/ingest_parser/xls/read_xlsx.cpp
        src/ingest_parser/xls/xlscommon.cpp
        src/ingest_parser/xls/zip_memory.cpp
        src/ingest_parser/xls/xlsx/xlsxio_read.c
        src/ingest_parser/xls/src/endian.c
        src/ingest_parser/xls/src/ole.c
        src/ingest_parser/xls/src/xls.c
        src/ingest_parser/xls/src/xlstool.c)

# Includes
target_include_directories(ingest_parser
        # Local headers
        PUBLIC src/ingest_parser
        # Interface headers (to be used with "ingest_parser" suffix)
        INTERFACE src
        # libexpat includes
        PRIVATE $<TARGET_PROPERTY:expat,INTERFACE_INCLUDE_DIRECTORIES>
        # Privately includes icu
        PRIVATE $<TARGET_PROPERTY:icu,INTERFACE_INCLUDE_DIRECTORIES>)

target_link_libraries(ingest_parser
        PRIVATE zlib
        PRIVATE expat
        # Publicly link to icu
        PUBLIC icu)

if(WIN32)
  target_compile_definitions(ingest_parser PUBLIC LIBXML_STATIC)
endif()

###################
# ingest library (Gabriel)
###################
set(ingest_files
        src/ingest/convert_file.cpp
        src/ingest/types.cpp
        src/ingest/data.cpp
        src/ingest/table.cpp)

add_library(ingest STATIC ${ingest_files})

# Includes
target_include_directories(ingest
        # Local headers
        PUBLIC src/ingest
        # Interface headers (to be used with the "ingest" suffix)
        INTERFACE src
        # Publicly uses ingest_parser
        PUBLIC $<TARGET_PROPERTY:ingest_parser,INTERFACE_INCLUDE_DIRECTORIES>
        )

target_link_libraries(ingest
        # Publicly link ingest_parser
        PUBLIC ingest_parser)

###################
# emingest
###################
if (EMSCRIPTEN)
  # On emscripten, this is an "executable". Though, it will be used as a JS library
  add_executable(emingest
          src/emingest/emscripten_main.cpp
          src/emingest/emscripten_exports.cpp)

  # Includes
  target_include_directories(emingest
          PRIVATE $<TARGET_PROPERTY:memory_utils,INTERFACE_INCLUDE_DIRECTORIES>
          PRIVATE $<TARGET_PROPERTY:simple_icu_init,INTERFACE_INCLUDE_DIRECTORIES>
          PRIVATE $<TARGET_PROPERTY:ingest,INTERFACE_INCLUDE_DIRECTORIES>
          )

  # Dependent libraries
  target_link_libraries(emingest
          PRIVATE ingest simple_icu_init memory_utils)

  # Common and Worker thread link flags
  # Additional flags are:
  #  FORCE_FILESYSTEM=1 to force filesystem libraries inclusion
  #  EXTRA_EXPORTED_RUNTIME_METHODS=['FS'] to expose filesystem libraries to Javscript
  #  --bind for embind
  set(ingest_ldflags "${emscripten_common_ldflags} ${emscripten_worker_ldflags} \
                        -s MODULARIZE=1 \
                        -s FORCE_FILESYSTEM=1 \
                        -s EXIT_RUNTIME=0 \
                        -s EXPORT_NAME=emingest \
                        -s EXTRA_EXPORTED_RUNTIME_METHODS=[\"ENV\",\"FS\",\"FS_readFile\",\"FS_mkdir\",\"FS_writeFile\",\"FS_unlink\",\"FS_mount\",\"FS_rmdir\"] \
                        --preload-file ${CMAKE_SOURCE_DIR}/src/simple_icu_init/icudt64l.dat@/icu/icudt64l.dat --no-heap-copy --lz4 \
                        --post-js ${CMAKE_SOURCE_DIR}/src/emingest/js/emscripten_export_fs.js \
                        -s LZ4=1 \
                        --closure 1 \
                        --bind")

  set_target_properties(emingest PROPERTIES LINK_FLAGS ${ingest_ldflags})

  # Output to ./build/ to match perspective build scripts
  set_target_properties(emingest PROPERTIES RUNTIME_OUTPUT_DIRECTORY "./build/")
endif ()


###################
# test_ingest
###################
add_executable(test_ingest test/test_ingest/main.cpp)

if (EMSCRIPTEN)
  # icu data file is given using a preloaded file
else ()
  # copy icu data file to build folder
  add_custom_command(TARGET test_ingest POST_BUILD
          COMMAND "${CMAKE_COMMAND}" -E copy "${CMAKE_SOURCE_DIR}/src/simple_icu_init/icudt64l.dat" "${CMAKE_CURRENT_BINARY_DIR}/build/icudt64l.dat")
endif ()

# copy the sample data
add_custom_command(TARGET test_ingest POST_BUILD
        COMMAND "${CMAKE_COMMAND}" -E copy "${CMAKE_SOURCE_DIR}/test/sample_data/CollegePlaying.csv" "${CMAKE_CURRENT_BINARY_DIR}/build/CollegePlaying.csv")

if (EMSCRIPTEN)
  target_compile_definitions(test_ingest PRIVATE ICU_DATA="/icu/")  # assume the icu data file is in /icu/ (MemFS)
else ()
  if (MSVC)
    target_compile_definitions(test_ingest PRIVATE ICU_DATA="../")    # assume the icu data file is in the parent folder as the binary
                                                                      # (this is a bit hackish, but due to the way output binaries are put in a configuration subfolder)
  else ()
    target_compile_definitions(test_ingest PRIVATE ICU_DATA="")    # assume the icu data file is in the same folder as the binary
  endif()
endif()

# Includes
target_include_directories(test_ingest
        PRIVATE $<TARGET_PROPERTY:memory_utils,INTERFACE_INCLUDE_DIRECTORIES>
        PRIVATE $<TARGET_PROPERTY:ingest,INTERFACE_INCLUDE_DIRECTORIES>
        PRIVATE $<TARGET_PROPERTY:simple_icu_init,INTERFACE_INCLUDE_DIRECTORIES>
        )

target_link_libraries(test_ingest
        PRIVATE ingest
        PRIVATE simple_icu_init
        PRIVATE memory_utils)

if (EMSCRIPTEN)
  # Common and Worker thread link flags
  set(test_ingest_ldflags "${emscripten_common_ldflags} ${emscripten_worker_ldflags} \
                        -s FORCE_FILESYSTEM=1 \
                        -s EXIT_RUNTIME=1 \
                        -s INVOKE_RUN=0 \
                        --preload-file ${CMAKE_SOURCE_DIR}/src/simple_icu_init/icudt64l.dat@/icu/icudt64l.dat --no-heap-copy --lz4 \
                        --pre-js ${CMAKE_SOURCE_DIR}/test/test_ingest/js/hide_canvas.js \
                        --post-js ${CMAKE_SOURCE_DIR}/test/test_ingest/js/load_file.js \
                        -s EXTRA_EXPORTED_RUNTIME_METHODS=[\"callMain\",\"FS_writeFile\",\"FS_unlink\"] \
                        -s LZ4=1")

  set_target_properties(test_ingest PROPERTIES LINK_FLAGS ${test_ingest_ldflags})
  set_target_properties(test_ingest PROPERTIES SUFFIX .html)
endif ()

# Output to ./build/ to match perspective build scripts
set_target_properties(test_ingest PROPERTIES RUNTIME_OUTPUT_DIRECTORY "./build/")

###################
# test_emingest
###################
if (EMSCRIPTEN)
  add_custom_target(test_emingest
          COMMAND "${CMAKE_COMMAND}" -E copy "${CMAKE_SOURCE_DIR}/test/test_emingest/js/test_emingest_loader.js" "${CMAKE_CURRENT_BINARY_DIR}/build/test_emingest_loader.js"
          COMMAND "${CMAKE_COMMAND}" -E copy "${CMAKE_SOURCE_DIR}/test/test_emingest/js/test_emingest.js" "${CMAKE_CURRENT_BINARY_DIR}/build/test_emingest.js"
          COMMAND "${CMAKE_COMMAND}" -E copy "${CMAKE_SOURCE_DIR}/test/test_emingest/js/test_emingest.html" "${CMAKE_CURRENT_BINARY_DIR}/build/test_emingest.html"
          COMMAND "${CMAKE_COMMAND}" -E copy "${CMAKE_SOURCE_DIR}/test/sample_data/CollegePlaying.csv" "${CMAKE_CURRENT_BINARY_DIR}/build/CollegePlaying.csv"
          DEPENDS emingest
          )
endif ()

###################
# test_dependencies
# Sample project to illustrate how to declare and use the dependencies: ICU, libxml2, zlib, boost, rapidjson
###################
add_executable(test_dependencies
               test/test_dependencies/main.cpp
               test/test_dependencies/testxml2.c
               test/test_dependencies/testzlib.c)

if(MSVC OR MINGW)
  # GAB: very important, or this will not work!
  target_compile_definitions(test_dependencies PUBLIC LIBXML_STATIC)
endif()

# Includes
target_include_directories(test_dependencies
        # libxml2 includes
        PRIVATE $<TARGET_PROPERTY:xml2,INTERFACE_INCLUDE_DIRECTORIES>
        # zlib includes
        PRIVATE $<TARGET_PROPERTY:zlib,INTERFACE_INCLUDE_DIRECTORIES>
        # simple_icu_init includes
        PRIVATE $<TARGET_PROPERTY:icu,INTERFACE_INCLUDE_DIRECTORIES>
        # Boost includes
        PRIVATE ${CMAKE_CURRENT_BINARY_DIR}/boost
        # Rapidjson includes
        PRIVATE ${CMAKE_CURRENT_BINARY_DIR}/rapidjson/include
        )

# Link
target_link_libraries(test_dependencies
        PRIVATE xml2
        PRIVATE zlib
        PRIVATE icu)

if (EMSCRIPTEN)
  set(test_dependencies_ldflags "${emscripten_common_ldflags} ${emscripten_worker_ldflags} \
                        -s FORCE_FILESYSTEM=1 \
                        -s EXIT_RUNTIME=1 \
                        -s INVOKE_RUN=0 \
                        --preload-file ${CMAKE_SOURCE_DIR}/src/simple_icu_init/icudt64l.dat@/icu/icudt64l.dat --no-heap-copy --lz4 \
                        --pre-js ${CMAKE_SOURCE_DIR}/test/test_dependencies/js/hide_canvas.js \
                        --post-js ${CMAKE_SOURCE_DIR}/test/test_dependencies/js/load_file.js \
                        -s EXTRA_EXPORTED_RUNTIME_METHODS=[\"callMain\",\"FS_writeFile\",\"FS_unlink\"] \
                        -s LZ4=1")

  set_target_properties(test_dependencies PROPERTIES LINK_FLAGS ${test_dependencies_ldflags})
  set_target_properties(test_dependencies PROPERTIES SUFFIX .html)
endif ()

# Output to ./build/ to match perspective build scripts
set_target_properties(test_dependencies PROPERTIES RUNTIME_OUTPUT_DIRECTORY "./build/")
