'use strict';

exports.grid = [
'.hypergrid-container {',
'	position: relative;',
'	height: 510px;',
'}',
'.hypergrid-container > div:first-child {',
'	position: absolute;',
'	left: 0;',
'	top: 0;',
'	right: 0;',
'	bottom: 0;',
'}',
'.hypergrid-container > div:first-child > div.info {',
'	position: absolute;',
'	display: none; /* initially hidden */',
'	margin-top: 150px; /* to place below headers */',
'	color: #eee;',
'	text-shadow: 1px 1px #ccc;',
'	font-size: 36pt;',
'	font-weight: bold;',
'	text-align: center;',
'	top: 0; right: 0; bottom: 0; left: 0;',
'}',
'.hypergrid-textfield {',
'	position: absolute;',
'	font-size: 12px;',
'	color: black;',
'	/*background-color: ivory;*/',
'	box-sizing: border-box;',
'	margin: 0;',
'	padding-right: 5px;',
'	padding-left: 5px;',
'	padding-bottom: 2px;',
'	border: 1px #5292f7 solid;',
'	/*border: 0; */',
'	/*border: 1px solid #777;*/',
'	outline: 0;',
'	-webkit-box-shadow: 0 2px 5px rgba(0,0,0,0.4);',
'	-moz-box-shadow: 0 2px 5px rgba(0,0,0,0.4);',
'	box-shadow: 0 2px 5px rgba(0,0,0,0.4);',
'}',
'',
'.fin-link-details-div > a:hover {',
'	text-decoration: underline !important;',
'}',
'',
'',
''
].join('\n');