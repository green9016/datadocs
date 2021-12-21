echo off
where cmake.exe
IF %ERRORLEVEL% NEQ 0 GOTO :ERR04

SET BUILD_MODE=%2
if "%BUILD_MODE%" == "" (
SET BUILD_MODE=Release
)

if "%1" == "emscripten" (
  echo: Building for Emscripten
  GOTO :BUILD_EMSCRIPTEN
)

if "%1" == "mingw" (
  echo: Building for MinGW
  GOTO :BUILD_MINGW
)
if "%1" == "msvc" (
  echo: Building for MSVC
  GOTO :BUILD_MSVC
)
GOTO :ERR02

:ERR01
  ECHO: ERROR: Emscripten compiler not found. Please activate with "<emsdk_root>/emcmdprompt.bat"
  exit /b 1

:ERR02
  ECHO: ERROR: Missing target compiler argument: emscripten, mingw, msvc
  exit /b 2

:ERR03
  ECHO: ERROR: mingw32-make.exe not found. Please install MinGW and set the PATH to mingw32-make.exe program
  exit /b 3

:ERR04
  ECHO: ERROR: cmake.exe not found. Please install CMake
  exit /b 4

:ERR05
  ECHO: ERROR: MSBUILD.exe not found. Please enable Visual Studio C++ tools with:
  ECHO %comspec% /k "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\VC\Auxiliary\Build\vcvars64.bat"
  exit /b 5

:BUILD_EMSCRIPTEN
  where emcc.bat
  IF %ERRORLEVEL% NEQ 0 GOTO :ERR01
  where mingw32-make.exe
  IF %ERRORLEVEL% NEQ 0 GOTO :ERR03

  if not exist "build_emscripten" mkdir build_emscripten
  cd build_emscripten
  call emcmake cmake .. -DCMAKE_BUILD_TYPE=%BUILD_MODE% -G "MinGW Makefiles"
  cd ..
  echo:
  echo: build directory is build_emscripten. You may run:
  echo:   "cd build_emscripten"
  echo:   "mingw32-make.exe <target>"
  echo: possible targets are: test_ingest, test_emingest, emingest, ingest
  exit /b 0

:BUILD_MINGW
  where mingw32-make.exe
  IF %ERRORLEVEL% NEQ 0 GOTO :ERR03

  if not exist "build_mingw" mkdir build_mingw
  cd build_mingw
  call cmake .. -DCMAKE_BUILD_TYPE=%BUILD_MODE% -G "MinGW Makefiles"
  cd ..
  echo:
  echo: build directory is build_mingw. You may run:
  echo:   "cd build_mingw"
  echo:   "mingw32-make.exe <target>"
  echo: possible targets are: test_ingest, ingest
  exit /b 0

:BUILD_MSVC
  where MSBUILD.exe
  IF %ERRORLEVEL% NEQ 0 GOTO :ERR05

  if not exist "build_msvc" mkdir build_msvc
  cd build_msvc
  call cmake ..
  cd ..
  echo:
  echo: build directory is build_msvc. You may run:
  echo:   "cd build_msvc"
  echo:   "MSBUILD.exe <target>.vcxproj /property:Configuration=Release /property:Platform=x64"
  echo: possible targets are: test_ingest, ingest
  echo:
  echo: You may also open ingest.sln in Visual Studio
  exit /b 0
