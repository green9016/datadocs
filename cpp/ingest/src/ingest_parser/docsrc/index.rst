********************
Ingest documentation
********************

Overview
========

Ingest is a library to read various data sources, automatically detect format and present data as a table.
Currently only parsing of text files in a CSV-like format is supported.

CSV Parser
==========

The library can parse text files with rows of delimited values. File encoding, delimiters and other 
properties of the format are inferred automatically. First 1MB of the file is used for inferring.
Data type is determined for each column based on data in the first 100 rows. Following data types are supported:

* *string* - up to 1MB in length, longer strings are truncated.
* *boolean* - values like ``1``/``0``, ``false``/``true``, ``Y``/``N`` etc. can be used.
* *integer* - 64 bit signed integers, range of values from ``-9,223,372,036,854,775,808`` to ``9,223,372,036,854,775,807``.
* *decimal* - `IEEE 754` double precision floating point format.
* *date*, *time*, *datetime* - supports arbitrary formats which can be parsed by `strptime` function,
  e.g ``Tuesday, 22 August 2006 06:30 AM``, format is inferred automatically.
* lists - lists of values of the same type, values are comma-separated, list may be optionally enclosed in ``<`` .. ``>``.
* special strings - `XML`, `JSON`, `GeoJSON` and `WKT` formats are detected but no special handling is applied.

if a value cannot be converted to corresponding type then ``null`` value is produced and an error flag is set indicating
what value in which column caused the error.

Tutorial
================== 
.. literalinclude:: tutorial.py 

Reference
============================================
..
	automodule:: inferrer_c
	:exclude-members: ColumnType


.. py:module:: inferrer_c


.. py:class:: Parser
   :module: inferrer_c

Main class of data inferrer and parser.

Parser object may be iterated, it returns rows of data from the file as lists of typed values. Null values are represented by None.

:param filename: Path to the csv file.
:type filename: bytes

.. py:method:: Parser.close
   :module: inferrer_c

Close the file after parsing.

.. py:method:: Parser.get_schema
   :module: inferrer_c

Returns :obj:`Schema` object with the file's properties.

.. py:method:: Parser.infer_schema
   :module: inferrer_c

Infer file format properties.

:returns: False if inferring failed.
:rtype: bool

.. py:method:: Parser.open
   :module: inferrer_c

Open the file before parsing.

:returns: False if opening failed.
:rtype: bool


.. py:class:: Schema
   :module: inferrer_c

Provides information about datasource properties.

You can obtain schema from parser by calling :py:meth:`Parser.get_schema`.
Properties are filled by calling :py:meth:`Parser.infer_schema`.

The class acts as a list of :obj:`ColumnDefinition` objects,
``len(schema)`` returns the number of columns, ``schema[i]`` returns i-th column definition,
columns can be iterated by ``for column in schema:``.

.. py:method:: Schema.column_info
   :module: inferrer_c

Returns a list of :py:meth:`ColumnDefinition.column_info` for all columns.

.. py:attribute:: Schema.has_truncated_string
   :module: inferrer_c

parser truncated some string values

The value is set to True if parser finds a string value longer than 1 MB which will be truncated.

:type: bool

.. py:attribute:: Schema.remove_null_strings
   :module: inferrer_c

treat some strings as null values.

This property can be set to True prior to inferring. Then string values "NULL" and "null" will be interpreted as null values.

:type: bool

.. py:attribute:: Schema.status
   :module: inferrer_c

indicates success or error status after inferring.

:type: :obj:`SchemaStatus`


.. py:class:: CSVSchema
   :module: inferrer_c

   Bases: :class:`inferrer_c.Schema`

Provides information about CSV-like datasource properties.

.. py:attribute:: CSVSchema.charset
   :module: inferrer_c

file encoding.

:type: str

.. py:attribute:: CSVSchema.comment
   :module: inferrer_c

rows that start with comment string are ignored.

:type: str

.. py:attribute:: CSVSchema.comment_lines_skipped_in_parsing
   :module: inferrer_c

how many comment lines were found while parsing the file.

:type: int

.. py:attribute:: CSVSchema.delimiter
   :module: inferrer_c

a character used to separate values in a row.

:type: str

.. py:attribute:: CSVSchema.escape_char
   :module: inferrer_c

a character used to escape special characters (removes special meaning from any following character),
None if escaping is not used.

:type: str

.. py:attribute:: CSVSchema.first_data_row
   :module: inferrer_c

0-based index of the first row that contains data (ignoring header and comments).

:type: int

.. py:attribute:: CSVSchema.newline
   :module: inferrer_c

a string used to separate rows in the file.

:type: str

.. py:attribute:: CSVSchema.quote_char
   :module: inferrer_c

a character used to quote values, None if quoting is not used.

:type: str

.. py:method:: CSVSchema.to_dict
   :module: inferrer_c

Returns a dict of schema properties with following elements:

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


.. py:class:: ColumnDefinition
   :module: inferrer_c

Provides information about a data column.

:obj:`Schema` object acts as a list of ColumnDefinitions. Some autogenerated columns are added
at the end of the column list:

        ``__rownum__`` (type `String`, index ``-1``): contains current row number.

        ``__count__`` (type `Integer`, index ``-2``): contains value ``1``.

        ``__error__`` (type `Error`, index ``-3``): contains a dict with information about errors in the current row, dict elements
        include:

                ``error_code``: integer error code,

                ``value``: original string value which caused the error.

.. py:method:: ColumnDefinition.column_info
   :module: inferrer_c

Returns a dict of column properties with following elements:

``initialIndex``: `index`,

``name``: `column_name`,

``is_list``: `is_list`,

``type``: dict with elements:

        ``dataType``: uppercase `column_type` name,

        ``pattern``: `format` or None if `format` is empty.

.. py:attribute:: ColumnDefinition.column_name
   :module: inferrer_c

column name. Unnamed columns have autogenerated names like ``Field_1``.

:type: str

.. py:attribute:: ColumnDefinition.column_type
   :module: inferrer_c

type of values in the column or type of values in the list if `is_list` is True

:type: :obj:`ColumnType`

.. py:attribute:: ColumnDefinition.format
   :module: inferrer_c

additional information about column type

for `Date`, `Time`, `Datetime` columns: datetime format string (suitable for `strptime`).

for `String` columns may be one of ``XML``, ``JSON``, ``GeoJSON``, ``WKT`` if all strings
are of corresponding format.

:type: str

.. py:attribute:: ColumnDefinition.index
   :module: inferrer_c

0-based column index in the original data source. Autogenerated columns have negative indexes.

:type: int

.. py:attribute:: ColumnDefinition.is_list
   :module: inferrer_c

if True the column contains lists of elements of `column_type`.

:type: bool


.. py:class:: ColumnType
   :module: inferrer_c

   Bases: :class:`enum.Enum`

   Type of values in a data column

   .. py:attribute:: ColumnType.String
      :module: inferrer_c

      str (including special strings like XML, JSON)

   .. py:attribute:: ColumnType.Boolean
      :module: inferrer_c

      bool

   .. py:attribute:: ColumnType.Integer
      :module: inferrer_c

      int

   .. py:attribute:: ColumnType.Decimal
      :module: inferrer_c

      float

   .. py:attribute:: ColumnType.Date
      :module: inferrer_c

      datetime.date

   .. py:attribute:: ColumnType.Time
      :module: inferrer_c

      datetime.time

   .. py:attribute:: ColumnType.Datetime
      :module: inferrer_c

      datetime.datetime

   .. py:attribute:: ColumnType.Error
      :module: inferrer_c

      dict with information about errors, only for special ``__error__`` column


.. py:class:: SchemaStatus
   :module: inferrer_c

   Bases: :class:`enum.Enum`

   Error values in :py:attr:`Schema.status` after inferring

   .. py:attribute:: SchemaStatus.STATUS_OK
      :module: inferrer_c

      inferring successful

   .. py:attribute:: SchemaStatus.STATUS_INVALID_FILE
      :module: inferrer_c

      file format cannot be determined
