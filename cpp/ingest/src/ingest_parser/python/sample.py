import sys

import inferrer_c

def main():
	if len(sys.argv) != 2:
		return 'filename missing'
	filename = sys.argv[1]
	parser = inferrer_c.Parser(filename.encode())
	parser.infer_schema()
	schema = parser.get_schema()

	# schema attribute:
	schema.delimiter # ','
	schema.newline # '\r\n'
	schema.comment # '#'
	schema.quote_char # '"'
	schema.escape_char # '\\'
	schema.first_data_row # 0-based ignoring empty text rows
	len(schema) # number of columns

	for col in schema:
		col.index # 0-based
		col.column_name
		col.column_type # one of:
		# inferrer_c.ColumnType.String
		# inferrer_c.ColumnType.Boolean
		# inferrer_c.ColumnType.Integer
		# inferrer_c.ColumnType.Decimal
		# inferrer_c.ColumnType.Date
		# inferrer_c.ColumnType.Time
		# inferrer_c.ColumnType.Datetime
		col.format # '%Y-%m-%d %H:%M:%S'

	if parser.open():
		for row in parser:
			print(*row)
	parser.close()

if __name__ == '__main__':
	sys.exit(main())
