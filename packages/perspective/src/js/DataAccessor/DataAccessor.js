/******************************************************************************
 *
 * Copyright (c) 2018, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import {DateParser, is_valid_date, is_valid_time, is_valid_date_time} from "./DateParser.js";
import {get_column_type} from "../utils.js";

export class DataAccessor {
    constructor() {
        this.data_formats = {
            row: 0,
            column: 1,
            schema: 2
        };
        this.format = undefined;
        this.data = undefined;
        this.names = undefined;
        this.types = undefined;
        this.row_count = undefined;
        this.date_parsers = {};
        this.date_validator = val => is_valid_date(val);
        this.time_validator = val => is_valid_time(val);
        this.date_time_validator = val => is_valid_date_time(val);
    }

    extract_typevec(typevec) {
        let types = [];
        for (let i = 0; i < typevec.size() - 1; i++) {
            types.push(typevec.get(i));
        }
        return types;
    }

    is_format(data) {
        if (Array.isArray(data)) {
            return this.data_formats.row;
        } else if (Array.isArray(data[Object.keys(data)[0]])) {
            return this.data_formats.column;
        } else if (typeof data[Object.keys(data)[0]] === "string" || typeof data[Object.keys(data)[0]] === "function") {
            return this.data_formats.schema;
        } else {
            throw "Unknown data format!";
        }
    }

    get_row_count(data) {
        if (this.format === this.data_formats.row) {
            return data.length;
        } else if (this.format === this.data_formats.column) {
            return data[Object.keys(data)[0]].length;
        } else {
            return 0;
        }
    }

    get(column_name, row_index) {
        let value = undefined;

        if (this.format === this.data_formats.row) {
            let d = this.data[row_index];
            if (d.hasOwnProperty(column_name)) {
                value = d[column_name];
            }
        } else if (this.format === this.data_formats.column) {
            if (this.data.hasOwnProperty(column_name)) {
                value = this.data[column_name][row_index];
            }
        } else if (this.format === this.data_formats.schema) {
            value = undefined;
        } else {
            throw "Unknown data format!";
        }

        return value;
    }

    marshal(column_index, row_index, type, list_index) {
        const column_name = this.names[column_index];
        let val = clean_data(this.get(column_name, row_index));
        let date_parser;

        if (val === null) {
            return null;
        }

        if (typeof val === "undefined") {
            return undefined;
        }

        if (this.date_parsers[column_name] === undefined) {
            this.date_parsers[column_name] = new DateParser();
        }

        date_parser = this.date_parsers[column_name];

        switch (get_column_type(type.value)) {
            case "float":
            case "integer": {
                val = Number(val);
                break;
            }
            case "boolean": {
                if (typeof val === "string") {
                    val.toLowerCase() === "true" ? (val = true) : (val = false);
                } else {
                    val = !!val;
                }
                break;
            }
            case "datetime":
            case "duration":
            case "date": {
                val = date_parser.parse(val);
                break;
            }
            case "list_float":
            case "list_integer": {
                val = clean_data(val[list_index]);
                if (val === null) {
                    return null;
                }
                val = Number(val);
                break;
            }
            case "list_boolean": {
                val = clean_data(val[list_index]);
                if (val === null) {
                    return null;
                }
                if (typeof val === "string") {
                    val.toLowerCase() === "true" ? (val = true) : (val = false);
                } else {
                    val = !!val;
                }
                break;
            }
            case "list_datetime":
            case "list_duration":
            case "list_date": {
                val = clean_data(val[list_index]);
                if (val === null) {
                    return null;
                }
                val = date_parser.parse(val);
                break;
            }
            case "list_string": {
                val = clean_data(val[list_index]);
                if (val === null) {
                    return null;
                }
                val += "";
                break;
            }
            case "decimal": {
                /*var val_arr = val.split(".");
                if (val[list_index]) {
                    val = val_arr[list_index];
                    if (list_index == 1) {
                        val = "0.".concat(val);
                    }
                } else {
                    val = 0;
                }*/
                val += "";
                break;
            }
            default: {
                val += ""; // TODO this is not right - might not be a string.  Need a data cleaner
            }
        }

        return val;
    }

    list_size(column_index, row_index, type) {
        const column_name = this.names[column_index];
        let val = clean_data(this.get(column_name, row_index));
        if (val === undefined) {
            return 0;
        }

        switch (get_column_type(type.value)) {
            case "list_float":
            case "list_integer": 
            case "list_boolean": 
            case "list_datetime":
            case "list_duration":
            case "list_date": 
            case "list_string": {
                if (Array.isArray(val)) {
                    return val.length;
                } else {
                    return 0;
                }
            }
            default: {
                return 0;
            }
        }
    }

    /**
     * Resets the internal state of the accessor, preventing
     * collisions with previously set data.
     *
     * @private
     */
    clean() {
        this.date_parsers = {};
        this.names = undefined;
        this.types = undefined;
    }

    /**
     * Links the accessor to a package of data for processing,
     * calculating its format and size.
     *
     * @private
     * @param {object} __MODULE__: the Module object generated by Emscripten
     * @param {object} data
     *
     * @returns An object with 5 properties:
     *    cdata - an array of columnar data.
     *    names - the column names.
     *    types - the column t_dtypes.
     *    row_count - the number of rows per column.
     *    is_arrow - an internal flag marking arrow-formatted data
     */
    init(__MODULE__, data) {
        this.data = data;
        this.format = this.is_format(this.data);
        this.row_count = this.get_row_count(this.data);
        if (this.format === this.data_formats.row) {
            if (data.length > 0) {
                this.names = Object.keys(data[0]);
            } else {
                this.clean.names = [];
            }
        } else if (this.format === this.data_formats.column || this.format === this.data_formats.schema) {
            this.names = Object.keys(data);
        } else {
            throw "Unknown data format!";
        }
    }
}

/**
 * Coerce string null into value null.
 * @private
 * @param {*} value
 */
export function clean_data(value) {
    if (value === null || value === "null") {
        return null;
    } else if (value === undefined || value === "undefined") {
        return undefined;
    } else {
        return value;
    }
}
