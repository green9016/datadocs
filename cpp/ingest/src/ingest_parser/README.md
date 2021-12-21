## Docker

### Building
Type `docker build -t c-ingest .` to build an image.

After building you can do the following things:
- Enter Python shell: `docker run -it c-ingest python3`
- Run a script: `docker run c-ingest python3 sample.py ../test_file.csv`


### Passing your files to Python scripts
To pass `.csv` file which is not located in the repo use this command:
```
docker run -v /MyAwesomeFileDirOnMyMachine:/usr/src/c-ingest/files c-ingest python3 sample.py ../files/MyAwesomeFile.csv
```
OR

 1. Place your `.csv` into your local repository.
 2. Build again (`docker build -t c-ingest .` )
 3. Run a script `docker run c-ingest python3 sample.py ../MyAwesomeFile.csv`

### Running C version
```
docker run c-ingest ../cingest ../test_file.csv
```

---

### Running with Python shell

```
$ docker run -v /tmp:/usr/src/c-ingest/files -it c-ingest python3
```

```
import inferrer_c

# Build Schema
filename = "../Sales1M.csv"
parser = inferrer_c.Parser(filename.encode())
parser.infer_schema()
schema = parser.get_schema()

# Print Column Info
print ([(col.column_name, col.column_type) for col in schema])

# Print row data
if parser.open():
	for row in parser:
		print(*row)

		
parser.close()
```
