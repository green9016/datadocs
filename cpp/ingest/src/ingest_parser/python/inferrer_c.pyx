# distutils: language = c++
from cython.operator cimport dereference as deref, preincrement as inc
from libc.stdint cimport int64_t, int32_t
from libc.math cimport floor
from libcpp cimport bool
from libcpp.cast cimport dynamic_cast
from libcpp.string cimport string
from libcpp.vector cimport vector
from libcpp.unordered_map cimport unordered_map

cdef extern from "<variant>" namespace "std":
	cdef T& get[T]()

from enum import Enum
import datetime as dt

cdef extern from "inferrer.h" namespace "Ingest::ColumnType":
	cdef enum ColumnType_c "Ingest::ColumnType":
		String_c "Ingest::ColumnType::String"
		Boolean_c "Ingest::ColumnType::Boolean"
		Integer_c "Ingest::ColumnType::Integer"
		Decimal_c "Ingest::ColumnType::Decimal"
		Date_c "Ingest::ColumnType::Date"
		Time_c "Ingest::ColumnType::Time"
		Datetime_c "Ingest::ColumnType::Datetime"
		Error_c "Ingest::ColumnType::Error"

cdef extern from "inferrer.h" namespace "Ingest":
	cpdef enum SchemaStatus:
		STATUS_OK = 0
		STATUS_INVALID_FILE = 1

	cdef cppclass ColumnDefinition_c "Ingest::ColumnDefinition":
		string column_name
		ColumnType_c column_type
		int index
		bool is_list
		string format

	cdef cppclass Schema_c "Ingest::Schema":
		vector[ColumnDefinition_c] columns
		SchemaStatus status
		bool remove_null_strings
		bool has_truncated_string

	cdef cppclass CSVSchema_c "Ingest::CSVSchema" (Schema_c):
		char delimiter
		char quote_char
		char escape_char
		string newline
		string comment
		string charset
		size_t first_data_row
		size_t comment_lines_skipped_in_parsing

	cdef cppclass XLSSchema_c "Ingest::XLSSchema" (Schema_c):
		string comment
		size_t first_data_row
		size_t comment_lines_skipped_in_parsing

	cdef cppclass ErrorCode:
		pass

	cdef cppclass ErrorType:
		ErrorCode error_code
		string value

	cdef cppclass Cell:
		pass

	cdef cppclass Row:
		vector[Cell] values
		vector[bool] flagmap

	cdef cppclass Parser_c "Ingest::Parser":
		@staticmethod
		Parser_c* get_parser(const string& filename)
		bool infer_schema()
		Schema_c* get_schema()
		bool open()
		void close()
		bool get_next_row(Row& row)
		size_t get_sheet_count()
		vector[string] get_sheet_names()
		bool select_sheet(const string& sheet_name)
		bool select_sheet(size_t sheet_number)

class ColumnType(Enum):
	String = <int>String_c
	Boolean = <int>Boolean_c
	Integer = <int>Integer_c
	Decimal = <int>Decimal_c
	Date = <int>Date_c
	Time = <int>Time_c
	Datetime = <int>Datetime_c
	Error = <int>Error_c

cdef class ColumnDefinition:
	"""Provides information about a data column.

	:obj:`Schema` object acts as a list of ColumnDefinitions. Some autogenerated columns are added
	at the end of the column list:

		``__rownum__`` (type `String`, index ``-1``): contains current row number.

		``__count__`` (type `Integer`, index ``-2``): contains value ``1``.

		``__error__`` (type `Error`, index ``-3``): contains a dict with information about errors in the current row, dict elements
		include:

			``error_code``: integer error code,

			``value``: original string value which caused the error.
	"""
	cdef ColumnDefinition_c* _c
	cdef Schema _parent
	@staticmethod
	cdef ColumnDefinition from_parent(Schema parent, ColumnDefinition_c* ptr):
		cdef ColumnDefinition self = ColumnDefinition.__new__(ColumnDefinition)
		self._parent = parent
		self._c = ptr
		return self
	@property
	def column_name(self):
		"""str: column name. Unnamed columns have autogenerated names like ``Field_1``."""
		return self._c.column_name.decode()
	@property
	def column_type(self):
		""":obj:`ColumnType`: type of values in the column or type of values in the list if `is_list` is True"""
		return ColumnType(<int>self._c.column_type)
	@property
	def index(self):
		"""int: 0-based column index in the original data source. Autogenerated columns have negative indexes."""
		return self._c.index
	@property
	def is_list(self):
		"""bool: if True the column contains lists of elements of `column_type`."""
		return self._c.is_list
	@is_list.setter
	def is_list(self, bool value):
		self._c.is_list = value
	@property
	def format(self):
		"""str: additional information about column type

			for `Date`, `Time`, `Datetime` columns: datetime format string (suitable for `strptime`).

			for `String` columns may be one of ``XML``, ``JSON``, ``GeoJSON``, ``WKT`` if all strings
			are of corresponding format.
		"""
		return self._c.format.decode()
	def column_info(self):
		"""Returns a dict of column properties with following elements:

				``initialIndex``: `index`,

				``name``: `column_name`,

				``is_list``: `is_list`,

				``type``: dict with elements:

					``dataType``: uppercase `column_type` name,

					``pattern``: `format` or None if `format` is empty.
		"""
		info = {
			'initialIndex': self.index,
			'name': self.column_name,
			'is_list': self._c.is_list,
			'type': {
				'dataType': self.column_type.name.upper(),
				'pattern': self.format or None,
			}}
		return info

ctypedef CSVSchema_c* CSVSchema_p
ctypedef XLSSchema_c* XLSSchema_p

cdef class Schema:
	"""
	Provides information about datasource properties.

	You can obtain schema from parser by calling :py:meth:`Parser.get_schema`.
	Properties are filled by calling :py:meth:`Parser.infer_schema`.

	The class acts as a list of :obj:`ColumnDefinition` objects,
	``len(schema)`` returns the number of columns, ``schema[i]`` returns i-th column definition,
	columns can be iterated by ``for column in schema:``.
	"""
	cdef Schema_c* _c
	cdef Parser _parent
	@staticmethod
	cdef Schema from_parent(Parser parent, Schema_c* ptr):
		cdef Schema self
		if dynamic_cast[CSVSchema_p](ptr):
			self = CSVSchema.__new__(CSVSchema)
		elif dynamic_cast[XLSSchema_p](ptr):
			self = XLSSchema.__new__(XLSSchema)
		self._parent = parent
		self._c = ptr
		return self
	def __len__(self):
		return self._c.columns.size()
	def __getitem__(self, int key):
		if not 0 <= key < self._c.columns.size():
			raise IndexError(key)
		return ColumnDefinition.from_parent(self, &self._c.columns[key])
	def column_info(self):
		"""Returns a list of :py:meth:`ColumnDefinition.column_info` for all columns.
		"""
		return [col.column_info() for col in self]
	@property
	def status(self):
		""":obj:`SchemaStatus`: indicates success or error status after inferring."""
		return SchemaStatus(self._c.status)
	@property
	def remove_null_strings(self):
		"""bool: treat some strings as null values.

		This property can be set to True prior to inferring. Then string values "NULL" and "null" will be interpreted as null values."""
		return self._c.remove_null_strings
	@remove_null_strings.setter
	def remove_null_strings(self, bool value):
		self._c.remove_null_strings = value
	@property
	def has_truncated_string(self):
		"""bool: parser truncated some string values

		The value is set to True if parser finds a string value longer than 1 MB which will be truncated.
		"""
		return self._c.has_truncated_string
	@has_truncated_string.setter
	def has_truncated_string(self, bool value):
		self._c.has_truncated_string = value

cdef class CSVSchema(Schema):
	"""
	Provides information about CSV-like datasource properties.
	"""
	@property
	def delimiter(self):
		"""str: a character used to separate values in a row."""
		return (&(<CSVSchema_c*>self._c).delimiter)[:1].decode()
	@property
	def quote_char(self):
		"""str: a character used to quote values, None if quoting is not used."""
		cdef char c = (<CSVSchema_c*>self._c).quote_char
		return None if c == 0 else (&c)[:1].decode()
	@property
	def escape_char(self):
		"""str: a character used to escape special characters (removes special meaning from any following character),
		None if escaping is not used."""
		cdef char c = (<CSVSchema_c*>self._c).escape_char
		return None if c == 0 else (&c)[:1].decode()
	@property
	def newline(self):
		"""str: a string used to separate rows in the file."""
		return (<CSVSchema_c*>self._c).newline.decode()
	@property
	def comment(self):
		"""str: rows that start with comment string are ignored."""
		return (<CSVSchema_c*>self._c).comment.decode()
	@property
	def charset(self):
		"""str: file encoding."""
		return (<CSVSchema_c*>self._c).charset.decode()
	@property
	def first_data_row(self):
		"""int: 0-based index of the first row that contains data (ignoring header and comments)."""
		return (<CSVSchema_c*>self._c).first_data_row
	@property
	def comment_lines_skipped_in_parsing(self):
		"""int: how many comment lines were found while parsing the file."""
		return (<CSVSchema_c*>self._c).comment_lines_skipped_in_parsing
	def to_dict(self):
		"""Returns a dict of schema properties with following elements:

				``status``: `status` name,

				``sourceType``: ``CSV``,

				``delimiter``: `delimiter`,

				``rowDelimiter``: `newline`,

				``commentCharacter``: `comment` or None if comments not used,

				``charset``: `charset`,

				``quote``: `quote_char`,

				``escape``: `escape_char`,

				``firstDataRow``: `first_data_row`,

				``commentLinesSkippedInParsing``: `comment_lines_skipped_in_parsing`,

				``columnInfo``: :py:meth:`Schema.column_info`.
		"""
		return {
			'status': self.status.name,
			'sourceType': 'CSV',
			'delimiter': self.delimiter,
			'rowDelimiter': self.newline,
			'commentCharacter': self.comment or None,
			'charset': self.charset,
			'quote': self.quote_char,
			'escape': self.escape_char,
			'firstDataRow': self.first_data_row,
			'commentLinesSkippedInParsing': self.comment_lines_skipped_in_parsing,
			'columnInfo': self.column_info(),
		}

cdef class XLSSchema(Schema):
	"""
	Provides information about Excel datasource properties.
	"""
	@property
	def comment(self):
		"""str: rows that start with comment string are ignored."""
		return (<XLSSchema_c*>self._c).comment.decode()
	@property
	def first_data_row(self):
		"""int: 0-based index of the first row that contains data."""
		return (<XLSSchema_c*>self._c).first_data_row
	@property
	def comment_lines_skipped_in_parsing(self):
		"""int: how many comment lines were found while parsing the file."""
		return (<XLSSchema_c*>self._c).comment_lines_skipped_in_parsing
	def to_dict(self):
		"""Returns a dict of schema properties with following elements:

				``status``: `status` name,

				``sourceType``: ``XLS``,

				``commentCharacter``: `comment` or None if comments not used,

				``firstDataRow``: `first_data_row`,

				``commentLinesSkippedInParsing``: `comment_lines_skipped_in_parsing`,

				``columnInfo``: :py:meth:`Schema.column_info`.
		"""
		return {
			'status': self.status.name,
			'sourceType': 'XLS',
			'commentCharacter': self.comment or None,
			'firstDataRow': self.first_data_row,
			'commentLinesSkippedInParsing': self.comment_lines_skipped_in_parsing,
			'columnInfo': self.column_info(),
		}

##cdef class ErrorValue:
##	cdef readonly int error_code
##	cdef readonly str value
##	@staticmethod
##	cdef create(ErrorCode error_code, const string& value):
##		cdef ErrorValue res = ErrorValue.__new__(ErrorValue)
##		res.error_code = <int>error_code
##		res.value = value.decode()
##		return res
##	def __repr__(self):
##		return '<Error %d: %s>' % (self.error_code, self.value)

cdef object cell_value(const Cell& cell, ColumnType_c tp):
	if tp == String_c:
		return get[string](cell).decode()
	elif tp == Boolean_c:
		return get[bool](cell)
	elif tp == Integer_c:
		return get[int64_t](cell)
	elif tp == Decimal_c:
		return get[double](cell)
	elif tp == Date_c:
		return dt.date.fromordinal(get[int32_t](cell) + 693594)
	elif tp == Time_c:
		return get_dt(cell).time()
	elif tp == Datetime_c:
		return get_dt(cell)
	else:
		return None

cdef class Parser:
	"""Main class of data inferrer and parser.

	Parser object may be iterated, it returns rows of data from the file as lists of typed values. Null values are represented by None.

	Args:
		filename (bytes): Path to the file.
	"""
	cdef Parser_c* _c
	def __init__(self, bytes filename):
		self._c = Parser_c.get_parser(filename)
	def __dealloc__(self):
		del self._c
	def get_sheet_count(self):
		"""Returns number of worksheets in the file, 0 if file format doesn't support multiple worksheets."""
		return self._c.get_sheet_count()
	def get_sheet_names(self):
		"""Returns a list of worksheet names."""
		names = self._c.get_sheet_names()
		return [x.decode() for x in names]
	def select_sheet(self, sheet):
		"""Select worksheet for inferring or parsing.

		Args:
			sheet (int or str): worksheet name or number.

		Returns:
			bool: False if worksheet doesn't exist."""
		if isinstance(sheet, int):
			return self._c.select_sheet(<int>sheet)
		elif isinstance(sheet, str):
			return self._c.select_sheet(<bytes>sheet.encode())
	def infer_schema(self):
		"""Infer file format properties.

		Returns:
			bool: False if inferring failed."""
		return self._c.infer_schema()
	def get_schema(self):
		"""Returns :obj:`Schema` object with the file's properties."""
		return Schema.from_parent(self, self._c.get_schema())
	def open(self):
		"""Open the file before parsing.

		Returns:
			bool: False if opening failed.
		"""
		return self._c.open()
	def close(self):
		"""Close the file after parsing."""
		self._c.close()
	def __iter__(self):
		cdef Schema_c* schema = self._c.get_schema()
		cdef Row row
		cdef ColumnType_c tp
		cdef vector[Cell]* p_cells
		cdef unordered_map[int, ErrorType]* p_errors
		cdef unordered_map[int, ErrorType].iterator it_err
		while self._c.get_next_row(row):
			res = []
			for col in range(schema.columns.size()):
				if not row.flagmap[col]:
					value = None
				else:
					tp = schema.columns[col].column_type
					if schema.columns[col].is_list:
						if tp == Error_c:
							value = {}
							p_errors = &get[unordered_map[int, ErrorType]](row.values[col])
							it_err = p_errors.begin()
							while it_err != p_errors.end():
								value[deref(it_err).first] = {'error_code': <int>deref(it_err).second.error_code, 'value': deref(it_err).second.value.decode()}
								inc(it_err)
						else:
							p_cells = &get[vector[Cell]](row.values[col])
							value = [cell_value(p_cells[0][i], tp) for i in range(p_cells.size())]
					else:
						value = cell_value(row.values[col], tp)
				res.append(value)
			yield res

cdef get_dt(const Cell& cell):
	cdef double v = get[double](cell)
	cdef int d = <int>floor(v)
	return dt.datetime.fromordinal(d + 693594) + dt.timedelta(0, (v - d) * 86400.0)
