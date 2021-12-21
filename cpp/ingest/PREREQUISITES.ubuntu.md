# Ubuntu 18 Prerequisites for Ingest Standalone

[CMake / Make](#cmake--make) are mandatory requirements, and at least one C++ toolchain is needed depending on which platform/compiler you are targeting: 
- [GCC](#GCC) (Linux/GCC)
- [Emscripten](#emscripten) (Web/Clang)

First, be sure to have your Ubuntu distribution correctly updated

```
$ sudo apt-get update
$ sudo apt-get upgrade
```

## CMake / Make / GCC

This is a mandatory requirement in all cases.

```
$ sudo apt-get install cmake build-essential gcc git git-lfs
```

## Emscripten

This is a requirement for Web/Emscripten builds.

Install python and java (needed for closure compiler):

```
$ sudo apt-get install python default-jre-headless
```

Run the following commands to install Emscripten SDK and activate the latest Emscripten version:

```
$ git clone https://github.com/emscripten-core/emsdk.git
$ cd emsdk
$ ./emsdk install 1.39.6
> ./emsdk activate 1.39.6
```

Building an Emscripten project require to have some environment variables correctly setup and tools enabled. 
You have to run the following command to enable Emscripten tools:

```
$ source <emsdk_root>/emsdk_env.sh
```
