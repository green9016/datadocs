if ! [ -a /usr/bin/cmake ]; then
echo "ERROR: cmake not found"
fi

if ! [ -a /usr/bin/gcc ]; then
echo "ERROR: gcc not found"
fi

if ! [ -a /usr/bin/make ]; then
echo "ERROR: make not found"
fi

BUILD_MODE=$2
if [ -z $2 ]; then
  BUILD_MODE=Release
fi

echo "Building for GCC"
mkdir build_gcc
cd build_gcc
cmake .. -DCMAKE_BUILD_TYPE=$BUILD_MODE
cd ..
echo "build directory is build_gcc. You may run:"
echo "cd build_gcc"
echo "make <target>"
echo "possible targets are: test_ingest, ingest"

