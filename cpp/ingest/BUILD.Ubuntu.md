# Building Ingest standalone from Linux/Ubuntu

This documentation is to build Ingest standalone from a Linux/Ubuntu host, either as a Native Linux build, or Web build.

Table of Contents:
- [Native Linux Build](#native-linux-build)
  - [Using GCC](#using-gcc) 
- [Web Build](#web-build)
  - [Using Emscripten](#using-emscripten)
- [Configure script frontend](#configure-script-frontend)

## Native Linux Build

### Using GCC

This section is for the following scenario: to build from a Linux/Ubuntu host, targeting Linux with the GCC compiler

From the root of ingest C++ project (`cpp/ingest`):

- To configure the project:
```
mkdir build_linuxgcc
cd build_linuxgcc
cmake .. -DCMAKE_BUILD_TYPE=Release
```
It is possible to do a DEBUG build by using `-DCMAKE_BUILD_TYPE=Debug` instead of `Release`, allowing to debug the program with GDB

- To build (from the `build_linuxgcc` folder):
```
make test_ingest
```

The result of compilation is in the `build` subfolder. 

- To run:
```
cd build
./test_ingest <csv_file>
```

Note that the necessary ICU data file needed by the program (`icudt64l.dat`) will be automatically copied to the build folder, along with a sample CSV file (CollegePlaying.csv). 
You may add other CSV files to the build folder if you want.

## Web Build

### Using Emscripten

This section is for the following scenario: to build from a Linux/Ubuntu host, targeting a Web build using Emscripten.

First, be sure to have Emscripten SDK installed locally, an Emscripten version activated (see [Prerequisites](PREREQUISITES.ubuntu.md#emscripten) documentation), 
and have a shell environment started with Emscripten tools enabled. You may enable the Emscripten tools enabled by running:

```
source <emsdk_root>/emsdk_env.sh
```

Then, from the root of ingest C++ project (`cpp/ingest`):

- To configure the project:
```
mkdir build_emscripten
cd build_emscripten
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
```
__IMPORTANT__: notice the `emcmake` command prefixed to `cmake`. This is mandatory to enable Emscripten cross compilation toolchain.

It is possible to do a DEBUG build by using `-DCMAKE_BUILD_TYPE=Debug` instead of `Release`, allowing to profile the program 
from the Browser development tools (mostly to have demangled function names in the profiler, or in a stacktrace in case of crash). Note that
step-by-step debugging on Emscripten is actually not possible.

- To build (from the `build_emscripten` folder): 
```
make test_ingest
```

The result of compilation is in the `build` subfolder. Actually, the output is an html file, `test_ingest.html`, acting as the web page "shell" for the WebAssembly module, 
along with the `test_ingest.js` (Javascript runtime for Emscripten) and `test_ingest.wasm` (the actual WebAssembly compiled code)   

### Running in the Browser

Running a WebAssembly program consists of having a small web server hosting the web page shell (for example using Python SimpleHTTPServer), 
and starting your favorite browser to http://localhost:8080
```
cd build
python -m SimpleHTTPServer 8080
```
Then, open your browser to http://localhost:8080/test_ingest.html#<csv_file>

You have to refresh the page when changing the CSV file in the URL. You will see the result of the process in the HTML page.

Note that the Browser may appears to "hang" in case the CSV file is big. This is normal, as the process is done in the main browser thread (and not in a WebWorker).
If you want to interactivelly see the console output, you have to open the Browser development console.

Finally, the necessary ICU data file needed by the program (`icudt64l.dat`) will be automatically copied to the build folder, and fetched by the HTML shell.
Same thing for the sample CSV file (by default, CollegePlaying.csv is copied in the build folder). You may add other CSV files to the build folder if you want, and update the URL to use it.

### Alternative scenario: building/running test_emingest

You can also build/run the __test_emingest__ project (to test the JS API of Ingest instead of the C++ API). 

Just replace __test_ingest__ in the above commands by __test_emingest__.

Note that in that case, the "main" entry point is in the [test_emingest.js](src/test/test_emingest/test_emingest.js) file, in function __convert__.

## Configure script frontend

The "configure" step of the previous sections might be simplified a bit thanks to the "configure.bat" script.

This script will do the cmake configuration for you, according to the target compiler passed as an argument. A secondary argument allows to choose between
Release and Debug mode.

```
./configure.sh gcc <Debug|Release>
```  

Once configure.bat script is done, you may enter into the `build_<compiler>` folder, and do the usual build and run operations according to the compiler used.
