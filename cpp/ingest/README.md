# Ingest

Table of Contents:
- [Overview](#overview)
- [Building Ingest "Standalone"](#building-ingest-standalone)
  - [Using CMake](#using-cmake)
    - [Prerequisites](#prerequisites)
    - [Building](#building)
  - [Using Node / Docker](#using-node--docker)
    - [Prerequisites](#prerequisites-1)
    - [Building](#building-1)
- [3rd party dependencies](#3rd-party-dependencies)
                   
## Overview

Ingest is the C++ library for files parsing and conversion to column-oriented data.

It is made of several C++ sub-projects / build targets, out of which the following are the most important:

- __ingest_parser__: the lowlevel C++ library for file parsing to row-oriented data (CSV, etc.), authored by Dmitry. More background info can 
be found in the "doc" folder of that subproject ([src/ingest_parser/docs](src/ingest_parser/docs)/index.html)

- __ingest__: the toplevel C++ library, based on __ingest_parser__, that provides a function to build column-oriented data from the the row-oriented data output of 'ingest_parser'.

- __emingest__: the wrapper library for __ingest__ to use the functionalities on the Web platform. It is compiled as a WebAssembly module thanks to Emscripten (notice the __em__ prefix of the project), and exposes/exports all necessary objects and functions to Javascript world.

- __test_ingest__ : the command line tool to play with Ingest using C++ API, and also informally called Ingest "Standalone". It takes a file path as input argument, and outputs whatever the developer wants to do. 

- __test_emingest__ : this target is a bit like the previous one, but instead allows to play with the JS API of ingest instead of the C++ API.

In the context of Datadocs application, the __emingest__ library is being build and used by a specific Javascript library called 'ingest' (sic), in [packages/ingest](../../packages/ingest).

## Development

Ingest is a CMake-based C++ project, with several targets that can be build for different platforms and compilers: Linux (GCC), Windows (MinGW and MSVC compilers), and Web (Emscripten/Clang).

The source for each sub-project are located in [src](./src) sub-folder, and [test](./test) for test* projects.

Ingest relies on only one 3rd party dependency: the ICU library. It is fetched and build automatically by the build system, so nothing is needed to be installed.

### Building Ingest "Standalone"

This section focuses on building Ingest Standalone for all platforms (Windows, Linux, Web), in particular the __test_ingest__ command line tool.

### Using CMake

Using CMake is the most canonical way to develop Ingest in a cross-platform way.

#### Prerequisites

- CMake
- Make
- A C++ toolchain: GCC (Linux/Ubuntu), Visual Studio / MSVC (Windows), MinGW (Windows), Emscripten (Web)

To install these tools on Windows: [PREREQUISITES.windows.md](./PREREQUISITES.windows.md)

To install these tools on Ubuntu: [PREREQUISITES.ubuntu.md](./PREREQUISITES.ubuntu.md)

#### Building

Please look for the build documentation corresponding your host platform (Windows or Linux/Ubuntu).
All platforms allows to do a Native build or a Web build.

- [BUILD.Windows.md](./BUILD.Windows.md)
- [BUILD.Ubuntu.md](./BUILD.Ubuntu.md)

The big picture is the following: there is a "configure" script allowing to check if prerequisites are met and do the basic cmake commands:

```
configure <compiler> (gcc, emscripten, mingw, msvc)
cd build_<compiler>
cmake --build . --target test_ingest --config Release
```

The main program is in the [main.cpp](./test/test_ingest/main.cpp) file located in [test/test_ingest](./test/test_ingest).

In the end, the cpp/ingest folder could look like this:

```
cpp/ingest
+ build_emscripten      <= build dir for Web build
+ build_linux           <= .. for linux gcc build
+ build_mingw           <= .. for windows mingw build
+ build_msvc            <= .. for windows msvc build
+ cmake
+ obj                   <= .. build dir used by the global Node/Docker build system
+ src
+ test
```

### Using Node / Docker

For convenience, and as backward compatibility, it is possible to build the __test_ingest__ and __test_emingest__ targets from the global Node/Docker build system.

This mode is a bit limited, as the target platform is only Web.

#### Prerequisites

The prerequisites are the ones as the toplevel Datadocs project: Node, Yarn and Docker

Please heads up the master [README.md](./../../README.md) file for information on the prerequisites.

#### Building

Issue the following commands:

```
PSP_DOCKER=1 yarn build_test_ingest
```
or
```
PSP_DOCKER=1 yarn build_test_emingest
```

The build directory is in `cpp/ingest/obj/build` folder.

## 3rd party dependencies

Please, look at [DEPENDENCIES.md](./DEPENDENCIES.md) to learn about the project 3rd party dependencies (ICU, libxml, ...), and how to add them for projects.
