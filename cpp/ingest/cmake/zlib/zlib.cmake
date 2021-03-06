# Zlib CMakefile
# Target Libxml2 version: v2.9.10

# GAB: this file (and its companions cmake files) have been copied from the upstream repository
# with additional modifications marked by # GAB comments

cmake_minimum_required(VERSION 2.4.4)
set(CMAKE_ALLOW_LOOSE_LOOP_CONSTRUCTS ON)

project(zlib C)

set(VERSION "1.2.11")

include(CheckTypeSize)
include(CheckFunctionExists)
include(CheckIncludeFile)
include(CheckCSourceCompiles)
enable_testing()

check_include_file(sys/types.h HAVE_SYS_TYPES_H)
check_include_file(stdint.h    HAVE_STDINT_H)
check_include_file(stddef.h    HAVE_STDDEF_H)

#
# Check to see if we have large file support
#
set(CMAKE_REQUIRED_DEFINITIONS -D_LARGEFILE64_SOURCE=1)
# We add these other definitions here because CheckTypeSize.cmake
# in CMake 2.4.x does not automatically do so and we want
# compatibility with CMake 2.4.x.
if(HAVE_SYS_TYPES_H)
  list(APPEND CMAKE_REQUIRED_DEFINITIONS -DHAVE_SYS_TYPES_H)
endif()
if(HAVE_STDINT_H)
  list(APPEND CMAKE_REQUIRED_DEFINITIONS -DHAVE_STDINT_H)
endif()
if(HAVE_STDDEF_H)
  list(APPEND CMAKE_REQUIRED_DEFINITIONS -DHAVE_STDDEF_H)
endif()
check_type_size(off64_t OFF64_T)
if(HAVE_OFF64_T)
  add_definitions(-D_LARGEFILE64_SOURCE=1)
endif()
set(CMAKE_REQUIRED_DEFINITIONS) # clear variable

#
# Check for fseeko
#
check_function_exists(fseeko HAVE_FSEEKO)
if(NOT HAVE_FSEEKO)
  add_definitions(-DNO_FSEEKO)
endif()

#
# Check for unistd.h
#
check_include_file(unistd.h Z_HAVE_UNISTD_H)

if(MSVC)
  set(CMAKE_DEBUG_POSTFIX "d")
  add_definitions(-D_CRT_SECURE_NO_DEPRECATE)
  add_definitions(-D_CRT_NONSTDC_NO_DEPRECATE)
  include_directories(${CMAKE_CURRENT_BINARY_DIR}/zlib)
endif()

# GAB: updated autogenrated file path to ${CMAKE_CURRENT_BINARY_DIR}/zlib-build
set(ZLIB_PC ${CMAKE_CURRENT_BINARY_DIR}/zlib-build/zlib.pc)
configure_file( cmake/zlib/zlib.pc.cmakein
        ${ZLIB_PC} @ONLY)
configure_file(	cmake/zlib/zconf.h.cmakein
        ${CMAKE_CURRENT_BINARY_DIR}/zlib-build/zconf.h @ONLY)
include_directories(${CMAKE_CURRENT_BINARY_DIR}/zlib ${CMAKE_CURRENT_BINARY_DIR}/zlib-build)


#============================================================================
# zlib
#============================================================================

# GAB: prefixed all source files with ${CMAKE_CURRENT_BINARY_DIR}/zlib, to match with zlib.txt.in

set(ZLIB_PUBLIC_HDRS
        ${CMAKE_CURRENT_BINARY_DIR}/zlib-build/zconf.h
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/zlib.h
        )
set(ZLIB_PRIVATE_HDRS
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/crc32.h
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/deflate.h
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/gzguts.h
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/inffast.h
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/inffixed.h
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/inflate.h
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/inftrees.h
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/trees.h
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/zutil.h
        )
set(ZLIB_SRCS
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/adler32.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/compress.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/crc32.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/deflate.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/gzclose.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/gzlib.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/gzread.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/gzwrite.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/inflate.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/infback.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/inftrees.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/inffast.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/trees.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/uncompr.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/zutil.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/contrib/minizip/unzip.c
        ${CMAKE_CURRENT_BINARY_DIR}/zlib/contrib/minizip/ioapi.c
        )

# parse the full version number from zlib.h and include in ZLIB_FULL_VERSION
file(READ ${CMAKE_CURRENT_BINARY_DIR}/zlib/zlib.h _zlib_h_contents)
string(REGEX REPLACE ".*#define[ \t]+ZLIB_VERSION[ \t]+\"([-0-9A-Za-z.]+)\".*"
        "\\1" ZLIB_FULL_VERSION ${_zlib_h_contents})

# GAB: zlib is now only statically linked
add_library(zlib STATIC ${ZLIB_SRCS} ${ZLIB_ASMS} ${ZLIB_PUBLIC_HDRS} ${ZLIB_PRIVATE_HDRS})

#add_library(zlib SHARED ${ZLIB_SRCS} ${ZLIB_ASMS} ${ZLIB_DLL_SRCS} ${ZLIB_PUBLIC_HDRS} ${ZLIB_PRIVATE_HDRS})
#set_target_properties(zlib PROPERTIES DEFINE_SYMBOL ZLIB_DLL)
#set_target_properties(zlib PROPERTIES SOVERSION 1)
