import inferrer_c

csv_file = 'sample.csv'

#create a parser object, csv file name is passed as a byte string
parser = inferrer_c.Parser(csv_file.encode())

#obtain schema object prior to inferring in order to modify some parameters
schema = parser.get_schema()

#treat "NULL" strings as null values
schema.remove_null_strings = True

#infer file format
parser.infer_schema()

#check that inferring is successful
assert schema.status == inferrer_c.SchemaStatus.STATUS_OK

#inferred information is available from schema object
assert schema.charset == 'UTF-8'
assert schema.delimiter == ','

# iterate schema object to get column objects
for column in schema:
    print(column.column_name, '(', column.column_type, ')')

#open csv file for parsing
parser.open()

#iterate parser object to obtain rows from csv file
for row in parser:
    #row is a list of values
    print(*row)

#close the file
parser.close()
