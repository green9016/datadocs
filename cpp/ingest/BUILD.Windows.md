# Building Ingest standalone from Windows 10

This documentation is to build Ingest standalone from a Windows 10 host, either as a Native Windows build, Native Linux build, or Web build.

Table of Contents:
- [Native Windows Build](#native-windows-build)
  - [Using MinGW](#using-mingw)
  - [Using MSVC](#using-msvc)
- [Native Linux Build](#native-linux-build)
  - [Using WSL](#using-wsl) 
- [Web Build](#web-build)
  - [Using Emscripten](#using-emscripten)
- [Configure script frontend](#configure-script-frontend)

## Native Windows Build

### Using MinGW
     
This section is for the following scenario: to build from a Windows 10 host, targeting the MinGW compiler environment (GCC for Windows)

First, be sure to first have MinGW installed and path to `mingw32-make.exe` configured in the PATH environment
 variable. See [Prerequisites](PREREQUISITES.windows.md#mingw) documentation for more info.

Then, from the root of ingest C++ project (`cpp/ingest`):

- To configure the project:
```
mkdir build_mingw
cd build_mingw
cmake .. -DCMAKE_BUILD_TYPE=Release -G "MinGW Makefiles"
```
It is possible to do a DEBUG build by using `-DCMAKE_BUILD_TYPE=Debug` instead of `Release`, allowing to debug the program with GDB

- To build (from the `build_mingw` folder):
```
mingw32-make.exe test_ingest
```
The result of compilation is in the `build` subfolder. 

- To run:
```
cd build
test_ingest.exe <csv_file>
```

Note that the necessary ICU data file needed by the program (`icudt64l.dat`) will be automatically copied to the build folder, along with a sample CSV file (CollegePlaying.csv). 
You may add other CSV files to the build folder if you want.

### Using MSVC
     
This section is for the following scenario: to build from a Windows 10 host, targeting the MSVC compiler environment (Visual Studio)

First, be sure to first have Visual Studio installed and started a shell environment with the VC++ tools setup. 
You may start VC++ compilation tools by running (Visual Studio 2019):
                                                                                                    
```
%comspec% /k "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
```

.. or through the Start Menu and launch "Visual Studio 2019 / x64 Native Tools Command Prompt for VS 2019"

Then, from the root of ingest C++ project (`cpp/ingest`):

- To configure the project:
```
mkdir build_msvc
cd build_msvc
cmake ..
```

- To build (from the `build_msvc` folder), you may either open `ingest.sln` in Visual Studio (and use the IDE functionality to build the __test_ingest__ project),
 or build from the command line using `MSBUILD.exe` 
```
MSBUILD.exe test_ingest.vcxproj /property:Configuration=Release /property:Platform=x64
```
It is possible to do a DEBUG build by using `/property:Configuration=Debug` instead of `Release`, allowing to debug the program with the Visual Studio debugger

The result of compilation is in the 'build/<configuration>' subfolder. 

- To run:
```
cd build/<configuration>  (Debug or Release) 
test_ingest.exe <csv_file>
``` 

## Native Linux Build

### Using WSL

It is also possible to cross-compile and execute Linux build from Windows 10, using __WSL__ ("Windows Subsystem for Linux"). 

First, be sure to have WSL installed (please read the Prerequisites section to install it), and have a shell environment started 
with the desired Linux distribution. 

You may start WSL with the default linux distribution using the command:

```
wsl.exe
``` 

As the target platform is Linux in that case, please see the [BUILD.Ubuntu.md](BUILD.Ubuntu.md) file for more information on this use case.

## Web Build

### Using Emscripten

This section is for the following scenario: to build from a Windows 10 host, targeting a Web build using Emscripten.

First, be sure to have an Emscripten version installed locally 
(see [Prerequisites](PREREQUISITES.windows.md#emscripten) documentation), and have a shell environment started with Emscripten tools enabled. You may start a shell with the Emscripten tools enabled by running:

```
<emsdk_root>/emcmdprompt.bat
```

Note also that on Windows, MinGW needs to be installed for the purpose to have access to `mingw32-make.exe` needed by 
 the build process. Access to this program must configured in the PATH environment variable. See 
 [Prerequisites](PREREQUISITES.windows.md#mingw documentation).

Then, from the root of ingest C++ project (`cpp/ingest`):

- To configure the project:
```
mkdir build_emscripten
cd build_emscripten
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release -G "MinGW Makefiles"
```
__IMPORTANT__: notice the `emcmake` command prefixed to `cmake`. This is mandatory to enable Emscripten cross compilation toolchain.

It is possible to do a DEBUG build by using `-DCMAKE_BUILD_TYPE=Debug` instead of `Release`, allowing to profile the program 
from the Browser development tools (mostly to have demangled function names in the profiler, or in a stacktrace in case of crash). Note that
step-by-step debugging on Emscripten is actually not possible.

- To build (from the `build_emscripten` folder): 
```
mingw32-make.exe test_ingest
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
configure.bat emscripten <Debug|Release>
configure.bat mingw <Debug|Release>
configure.bat msvc <Debug|Release>
```  

Once configure.bat script is done, you may enter into the `build_<compiler>` folder, and do the usual build and run operations according to the compiler used.
