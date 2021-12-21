# Datadocs

Table of Contents:
- [Overview](#overview)
  - [Logical View](#logical-view)
  - [Physical View](#physical-view)
- [Development](#development)
  - [Building Datadocs](#building-datadocs)
  - [Building Ingest "Standalone"](#building-ingest-standalone)

## Overview

Datadocs is a Web Application allowing to efficiently load, view and manipulate large column-oriented data sets coming from various input data sources (CSV, XML, etc.).

### Logical view

Datatocs is made of several logical parts and libraries:
- __Ingest__: the library for files parsing and conversion to column-oriented data.

  It is made of a C++ project with several sub-projects, compilable to Native platform and WebAssembly (exposing a Javascript API),
  and an additional Javascript library that packages the WebAssembly module in a Web Worker and provide additional functionality such as conversion to Apache Arrow format.

- __Perspective__: the data vizualization engine, accepting Apache Arrow buffer as input data format.

  It is made of a C++ project implementing the core functionalities, compilable to Native platform and WebAssembly (exposing a Javascript API), and a set of
  additional Javascript libraries that allows to use the engine from the Web in various ways (Web Worker, data visualization, etc.).

  It is based on a modified version of the original [FINOS Perspective](https://github.com/finos/perspective) engine (fork of v2.23), the physical layout and build system of this Datadocs repository being historically modeled after it.

- __Hypergrid__: this is a JS package for grid rendering. It is a modified version of the Hypergrid JS package originally used by Perspective.

- __Datadocs__: the Sample Web Application itself that use all the previous elements.

### Physical view

The physical project organization is the following: all the C++ code is in the [cpp](cpp) subfolder, and the JS code in the [packages](packages) subfolder (with the notable exception of [hypergrid](fin-hypergrid) library in its own
folder at the root). Finally, the build scripts are in the [scripts](scripts) subfolder.

To summarize:
```
<datadocs_root>
 + cpp                  <= cpp projects root
  + ingest                  <= 'ingest' C++ project
  + perspective             <= 'perspective' engine C++ project
 + examples
  + datadocs            <= 'datadocs' web application folder
 + fin-hypergrid        <= 'hypergrid' JS library
 + packages             <= js packages root
  + ingest                  <= 'ingest' JS library
  + perspective             <= 'perspective' JS library
  + perspective-viewer      <= ... and so on
  + perspective-viewer-highcharts
  + perspective-viewer-hypergrid
 + scripts              <= build scripts
```

## Development

Development occurs in this repository, this is a 'monorepo'.

The Datadocs build system uses Node.js with Yarn package manager and Docker. See [next section](#building-datadocs) about how to build the project.

It is possible to develop the Ingest library using only a regular C++ toolchain. See [Building Ingest "Standalone"](#building-ingest-standalone) section for this use case.

### Building Datadocs

#### Prerequisites

- Node.js
- Yarn
- Docker

To install these tools on Ubuntu: [PREREQUISITES.ubuntu.md](PREREQUISITES.ubuntu.md)

To install these tools on Windows: [PREREQUISITES.windows.md](PREREQUISITES.windows.md)

#### Development

1. Build Datadocs

    - On Linux/Ubuntu:

    ```
    $ yarn
    $ PSP_DOCKER=1 PSP_CPU_COUNT=2 yarn build
    ```

    - On Windows:

    ```
    > yarn
    > set PSP_DOCKER=1
    > yarn build
    ```

    - Build Options:

      - PACKAGE will restrict the build to only specific @jpmorganchase/ packages (OPTIONAL)

        `$ PSP_DOCKER=1 PACKAGE=[PACKAGE-NAME] yarn build`

      - PSP_CPU_COUNT=<number> will set the number of CPU to use in Docker

        `$ PSP_DOCKER=1 PSP_CPU_COUNT=2 yarn build`

      - PSP_DOCKER=0 (or variable not defined) will allow to build without Docker.

        For this build mode, a local installation of Emscripten is needed and the tools have to be enabled in the shell.
        More information on Emscripten installation and tools activation can be found [there](cpp/ingest/PREREQUISITES.windows.md#emscripten)
        for Windows and [there](cpp/ingest/PREREQUISITES.ubuntu.md#emscripten) for Linux/Ubuntu.

      - PSP_WASM_PROFILING=1 allow to use performance profiling tools against Wasm binaries in Browsers

        `$ PSP_DOCKER=1 PSP_WASM_PROFILING=1 yarn build`

      - PSP_WASM_MEMORY_DEBUG=1 allow to report memory information of Wasm binaries in console

        `$ PSP_DOCKER=1 PSP_WASM_MEMORY_DEBUG=1 yarn build`

    The build system will:
    - Create the docker image for Emscripten SDK
    - Compile Ingest C++ WebAssembly module
    - Compile Perspective C++ WebAssembly module
    - Compile/Bundle all the Javascript libraries, along with the WebAssembly modules

2. Run

    `$ yarn start datadocs`

    Heads up to http://localhost:8080

3. Troubleshooting

  - Docker

    If you need to update the Emscripten SDK docker image (newer version of Emscripten for example), you may rebuild the
  image specific for Emscripten SDK:

    `$ docker build -t datadocs/emsdk docker/emsdk`

    You may also prune all Docker images and restart from scratch in case of issue or uncertainties about their statuses:

    `$ docker system prune -a`

  - Yarn

    In case of issues with yarn, you may issue the following commands:

    `$ yarn cache clean`

    `$ yarn`

#### Deployment

NB: this is from a Linux host only

1. Build Datadocs

    `$ yarn clean`

    `$ yarn`

    `$ PSP_DOCKER=1 yarn build`

2. Prepare for Deployment

    `$ ./deploy/build.sh`

3. Stop and remove a running docker container if existed

    `$ docker container ls`

    `$ docker container stop [CONTAINER]`

    `$ docker container rm [CONTAINER]`

4. Build and run docker

    `$ docker build -t perspective/apache ./deploy`

5. Run Apache with docker

    `$ docker run -dit --name perspx-datadocs -p 80:80 perspective/apache`

### Building Ingest Standalone

Ingest C++ development can be done in "standalone" mode, that is, without the need to use the Node/Docker-based build system.
Only a regular CMake/Make/C++ toolchain can be used.

This is mostly interesting for C++-only developers working on Ingest.

For more information on this development use case, heads up to [cpp/ingest/README.md](cpp/ingest/README.md)
