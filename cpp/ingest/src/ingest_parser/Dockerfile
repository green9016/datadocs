FROM gcc:8.3.0
RUN apt-get update && apt-get install python3-pip -y
RUN apt-get install -y build-essential autoconf libtool pkg-config
RUN python3 -m pip install virtualenv && \
        python3 -m virtualenv /env36
ENV VIRTUAL_ENV /env36
ENV PATH /env36/bin:$PATH
RUN pip install --upgrade pip && echo "cython" >> requirements.txt && pip install -r requirements.txt
WORKDIR /usr/src/c-ingest
RUN apt-get install -y libicu-dev
COPY . .
RUN cd python && python3 build_cython.py
RUN gcc -std=c++17 -o cingest csv_reader.cpp inferrer.cpp utility.cpp main.cpp -lm -lstdc++ -licuuc \
-L ./vcpkg/installed/x64-linux/lib \
-licudata \
-licui18n \
-licuio \
-licutu \
-licuuc
WORKDIR /usr/src/c-ingest/python

