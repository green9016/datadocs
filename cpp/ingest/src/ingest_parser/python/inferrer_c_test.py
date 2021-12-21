import sys, datetime, csv, json
from itertools import islice
from pathlib import Path
import unittest
dt = datetime

csv.field_size_limit(1024*1024)

import inferrer_c

ROOT_DIR = Path(r'../test')
INPUT_DIR = ROOT_DIR / 'csv_files'
OUTPUT_DIR = ROOT_DIR / 'csv_result'
VERIFY_MAX_ROWS = 100000 # None to verify all

CONVERTERS = {
	'String': str,
	'Boolean': 'True'.__eq__,
	'Integer': int,
	'Decimal': float,
	'Date': dt.date.fromisoformat,
	'Time': dt.time.fromisoformat,
	'Datetime': dt.datetime.fromisoformat,
}

class TestDataInferrer(unittest.TestCase):
	def test_inferring(self):
		self.maxDiff = None
		src_files = [f for f in INPUT_DIR.iterdir() if f.is_file()]
		for num_file, src_file in enumerate(src_files, 1):
			print ("%s/%s. %s" % (num_file, len(src_files), src_file.name))

			with self.subTest(src_file.name):
				parser = inferrer_c.Parser(bytes(src_file))
				schema = parser.get_schema()
				schema.remove_null_strings = True
				sheets = parser.get_sheet_names()
				for sheet_no in range(max(parser.get_sheet_count(), 1)):
					res_file = OUTPUT_DIR / src_file.with_suffix('.%d.csv' % sheet_no if sheet_no else '.csv').name
					schema_file = res_file.with_suffix('.json')
					if sheet_no % 2:
						parser.select_sheet(sheets[sheet_no])
					else:
						parser.select_sheet(sheet_no)

					parser.infer_schema()
					if schema_file.exists():
						with schema_file.open(encoding='utf_8_sig') as f:
							js = json.load(f)
							js['rowDelimiter'] = schema.to_dict()['rowDelimiter'] # ignore the difference in delimiters caused by git
							self.assertEqual(schema.to_dict(), js)
					else:
						with schema_file.open('w', encoding='utf_8_sig') as f:
							json.dump(schema.to_dict(), f, indent='\t', ensure_ascii=False)

					if len(schema) == 0:
						self.assertEqual(schema.status, inferrer_c.SchemaStatus.STATUS_INVALID_FILE)
						self.assertFalse(res_file.exists())
						continue
					self.assertEqual(schema.status, inferrer_c.SchemaStatus.STATUS_OK)

					header = [col.column_name for col in schema]
					converters = [eval if col.is_list else CONVERTERS[col.column_type.name] for col in schema]
					self.assertTrue(parser.open())
					try:
						if res_file.exists():
							with res_file.open(encoding='utf_8_sig', newline='') as f:
								reader = csv.reader(f)
								self.assertEqual(header, next(reader))
								for i_row, row_parser in enumerate(islice(parser, VERIFY_MAX_ROWS)):
									for i, value in enumerate(row_parser):
										if value == '':
											row_parser[i] = None
									row_csv = next(reader)
									for i, value in enumerate(row_csv):
										if value in ('', 'NULL', 'null'):
											row_csv[i] = None
										else:
											row_csv[i] = converters[i](value)
									self.assertEqual(row_parser, row_csv)
								if VERIFY_MAX_ROWS is None or i_row < VERIFY_MAX_ROWS - 1:
									self.assertIsNone(next(reader, None))
						else:
							with res_file.open('w', encoding='utf_8_sig', newline='') as f:
								writer = csv.writer(f)
								writer.writerow(header)
								writer.writerows(parser)
					finally:
						parser.close()

if __name__ == '__main__':
	unittest.main(warnings='ignore')
