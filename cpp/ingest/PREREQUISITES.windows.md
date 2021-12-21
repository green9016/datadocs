# Windows 10 Prerequisites for Ingest Standalone

[CMake](#cmake) is a mandatory requirement, and at least one C++ toolchain is needed depending on which platform/compiler you are targeting: 
- [MinGW](#mingw) (Windows/GCC)
- [Visual Studio 2019](#visual-studio-2019) (Windows/MSVC)
- [Emscripten](#emscripten) (Web/Clang)
- [WSL / Linux](#wsl-linux) (Linux/Ubuntu/GCC) 

## CMake

This is a mandatory requirement in all cases.

https://cmake.org/download/

Choose the .msi installer for Windows. 

During installation, let CMake be registered in the PATH environment variable.

## MinGW

This is a requirement for MinGW/GCC native builds, as well as for Web/Emscripten builds (MinGW provides the `mingw32-make.exe` program, the Make
program that is used by CMake). 

http://mingw-w64.org/doku.php/download

Choose the __MingW-W64-builds__ installer (and NOT 'Win-Builds', which is deprecated).

Be sure to manually add the path to `mingw32-make.exe` program to the PATH environment variable, as __this is NOT done automatically__. 
The path is to add is:

```
<mingw_install_folder>\mingw64\bin
```

## Visual Studio 2019 

Community Edition or Professional Edition.

This is a requirement for MSVC native builds.

https://visualstudio.microsoft.com/fr/downloads/

Building a Visual Studio project from the command line, as CMake does, requires to have some environment variables correctly setup and tools enabled. 
You have to run the following command to start a shell with VC++ compilation tools enabled:

```
%comspec% /k "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
```

Alternatively, such a shell may be started through the Start Menu: "Visual Studio 2019 / x64 Native Tools Command Prompt for VS 2019"

## Emscripten

This is requirement for Web/Emscripten builds.

Run the following commands to install Emscripten SDK and activate the latest Emscripten version:

```
> git clone https://github.com/emscripten-core/emsdk.git
> cd emsdk
> emsdk.bat install 1.39.6
> emsdk.bat activate 1.39.6
```

Building an Emscripten project require to have some environment variables correctly setup and tools enabled. 
You have to run the following command to start a shell with the Emscripten tools enabled:
```
> <emsdk_root>/emcmdprompt.bat
```

Please, note that [MinGW](#mingw) prerequisite will also need to be installed for the purpose to have access to the Make program.

## WSL / Linux

This is a requirement for Linux/Ubuntu native builds (eg. doing a Linux/Ubuntu build from a Windows 10 host).

First, install WSL (aka. 'Windows Subsystem for Linux'):

https://docs.microsoft.com/en-us/windows/wsl/install-win10

Then install an Ubuntu distribution (version 18 preferred) from the Windows Store. 

You may start the distribution from command line with `wsl.exe`, or with the new Start menu icon.

Proceed to [PREREQUISITES.ubuntu.md](PREREQUISITES.ubuntu.md) to install prerequisites for Ubuntu.
