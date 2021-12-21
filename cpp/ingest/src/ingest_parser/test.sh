docker build -t c-ingest .
docker run -v $PWD/test/csv_result:/usr/src/c-ingest/test/csv_result -it c-ingest python3 inferrer_c_test.py
