/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import * as defaults from "./defaults.js";
import {DataAccessor} from "./DataAccessor/DataAccessor.js";
import {DateParser} from "./DataAccessor/DateParser.js";
import {extract_map, extract_vector} from "./emscripten.js";
import {bindall, get_column_type} from "./utils.js";

import {Precision} from "@apache-arrow/es2015-esm/enum";
import {Table} from "@apache-arrow/es2015-esm/table";
import {Data} from "@apache-arrow/es2015-esm/data";
import {Vector} from "@apache-arrow/es2015-esm/vector";
import {Utf8, Uint32, Float64, Int32, TimestampSecond, Dictionary} from "@apache-arrow/es2015-esm/type";

import formatters from "./view_formatters";

// IE fix - chrono::steady_clock depends on performance.now() which does not exist in IE workers
if (global.performance === undefined) {
    global.performance = {now: Date.now};
}

if (typeof self !== "undefined" && self.performance === undefined) {
    self.performance = {now: Date.now};
}

/**
 * The main API module for Perspective.
 * @module perspective
 */
export default function(Module) {
    let __MODULE__ = Module;
    let accessor = new DataAccessor();

    /******************************************************************************
     *
     * Private
     *
     */

    /**
     * Determines a table's limit index.
     * @private
     * @param {int} limit_index
     * @param {int} new_length
     * @param {int} options_limit
     */
    function calc_limit_index(limit_index, new_length, options_limit) {
        limit_index += new_length;
        if (options_limit) {
            limit_index = limit_index % options_limit;
        }
        return limit_index;
    }

    /**
     * Common logic for creating and registering a gnode/t_table.
     *
     * @param {*} pdata
     * @param {*} pool
     * @param {*} gnode
     * @param {*} computed
     * @param {*} index
     * @param {*} limit
     * @param {*} limit_index
     * @param {*} is_delete
     * @private
     * @returns {Table}
     */
    function make_table(accessor, pool, gnode, computed, index, limit, limit_index, is_update, is_delete, is_arrow) {
        if (is_arrow) {
            for (let chunk of accessor) {
                gnode = __MODULE__.make_table(pool, gnode, chunk, computed, limit_index, limit || 4294967295, index, is_update, is_delete, is_arrow);
                limit_index = calc_limit_index(limit_index, chunk.cdata[0].length, limit);
            }
        } else {
            gnode = __MODULE__.make_table(pool, gnode, accessor, computed, limit_index, limit || 4294967295, index, is_update, is_delete, is_arrow);
            limit_index = calc_limit_index(limit_index, accessor.row_count, limit);
        }

        return [gnode, limit_index];
    }

    /**
     * Converts arrow data into a canonical representation for
     * interfacing with perspective.
     *
     * @private
     * @param {object} data Array buffer
     * @returns An array containing chunked data objects with five properties:
     * row_count: the number of rows in the chunk
     * is_arrow: internal flag for marking arrow data
     * names: column names for the arrow data
     * types: type mapping for each column
     * cdata: the actual data we load
     */
    function load_arrow_buffer(data, cols, types) {
        // TODO Need to validate that the names/types passed in match those in the buffer
        let arrow = Table.from([new Uint8Array(data)]);
        let loader = arrow.schema.fields.reduce((loader, field, colIdx) => {
            return loader.loadColumn(field, arrow.getColumnAt(colIdx), types[colIdx]);
        }, new ArrowColumnLoader());
        let nchunks = loader.cdata[0].chunks.length;
        let chunks = [];
        for (let x = 0; x < nchunks; x++) {
            chunks.push({
                row_count: loader.cdata[0].chunks[x].length,
                is_arrow: true,
                names: loader.names,
                types: loader.types,
                cdata: loader.cdata.map(y => y.chunks[x])
            });
        }
        return chunks;
    }

    /**
     *
     * @private
     */
    class ArrowColumnLoader {
        constructor(cdata, names, types) {
            this.cdata = cdata || [];
            this.names = names || [];
            this.types = types || [];
        }
        loadColumn(field /*: Arrow.type.Field*/, column /*: Arrow.Vector*/, column_type) {
            if (column_type !== undefined && column_type !== null) {
                this.types.push(get_perspective_type(column_type));
                this.cdata.push(column);
                this.names.push(field.name);
            }
            else if (this.visit(field.type)) {
                this.cdata.push(column);
                this.names.push(field.name);
            }
            return this;
        }
        visitNull(type/*: Arrow.type.Null*/) { return null; }
        visitBool(/* type: Arrow.type.Bool */) {
            this.types.push(__MODULE__.t_dtype.DTYPE_BOOL);
            return true;
        }
        visitInt(type /* : Arrow.type.Int */) {
            const bitWidth = type.bitWidth;
            if (bitWidth === 64) {
                this.types.push(__MODULE__.t_dtype.DTYPE_INT64);
            } else if (bitWidth === 32) {
                this.types.push(__MODULE__.t_dtype.DTYPE_INT32);
            } else if (bitWidth === 16) {
                this.types.push(__MODULE__.t_dtype.DTYPE_INT16);
            } else if (bitWidth === 8) {
                this.types.push(__MODULE__.t_dtype.DTYPE_INT8);
            }
            return true;
        }
        visitFloat(type /* : Arrow.type.Float */) {
            /*const precision = type.precision;
            if (precision === Precision.DOUBLE) {
                this.types.push(__MODULE__.t_dtype.DTYPE_FLOAT64);
            } else if (precision === Precision.SINGLE) {
                this.types.push(__MODULE__.t_dtype.DTYPE_FLOAT32);
            }*/
            const precision = type.precision;
            if (precision === Precision.DOUBLE || precision === Precision.SINGLE) {
                this.types.push(__MODULE__.t_dtype.DTYPE_FLOAT64);
            }
            // todo?
            // else if (type.precision === Arrow.enum_.Precision.HALF) {
            //     this.types.push(__MODULE__.t_dtype.DTYPE_FLOAT16);
            // }
            return true;
        }
        visitDecimal(/* type: Arrow.type.Decimal */) {
            this.types.pust(__MODULE__.t_dtype.DTYPE_FLOAT64);
            return true;
        }
        visitUtf8(/* type: Arrow.type.Utf8 */) {
            this.types.push(__MODULE__.t_dtype.DTYPE_STR);
            return true;
        }
        visitBinary(/* type: Arrow.type.Binary */) {
            this.types.push(__MODULE__.t_dtype.DTYPE_STR);
            return true;
        }
        visitFixedSizeBinary(type/*: Arrow.type.FixedSizeBinary*/) { return null; }
        visitDate(type/*: Arrow.type.Date_*/) { return null; }
        visitTimestamp(/* type: Arrow.type.Timestamp */) {
            this.types.push(__MODULE__.t_dtype.DTYPE_TIME);
            return true;
        }
        visitTime(type/*: Arrow.type.Time*/) { return null; }
        visitDecimal(type/*: Arrow.type.Decimal*/) { return null; }
        visitList(type/*: Arrow.type.List*/) { return null; }
        visitStruct(type/*: Arrow.type.Struct*/) { return null; }
        visitUnion(type/*: Arrow.type.Union<any>*/) { return null; }
        visitDictionary(type /*: Arrow.type.Dictionary */) {
            return this.visit(type.dictionary);
        }
        visitInterval(type/*: Arrow.type.Interval*/) { return null; }
        visitFixedSizeList(type/*: Arrow.type.FixedSizeList*/) { return null; }
        visitMap(type/*: Arrow.type.Map_*/) { return null; }
    }

    function get_perspective_type(ingest_type) {
        if (ingest_type === 0) {
            return __MODULE__.t_dtype.DTYPE_STR;
        } else if (ingest_type === 1) {
            return __MODULE__.t_dtype.DTYPE_BOOL;
        } else if (ingest_type === 2) {
            return __MODULE__.t_dtype.DTYPE_INT64;
        } else if (ingest_type === 3) {
            return __MODULE__.t_dtype.DTYPE_FLOAT64;
        } else if (ingest_type === 4) {
            return __MODULE__.t_dtype.DTYPE_DATE;
        } else if (ingest_type === 5) {
            return __MODULE__.t_dtype.DTYPE_DURATION;
        } else if (ingest_type === 6) {
            return __MODULE__.t_dtype.DTYPE_TIME;
        } else if (ingest_type === 8) {
            return __MODULE__.t_dtype.DTYPE_LIST_INT64;
        } else if (ingest_type === 9) {
            return __MODULE__.t_dtype.DTYPE_LIST_FLOAT64;
        } else if (ingest_type === 10) {
            return __MODULE__.t_dtype.DTYPE_LIST_TIME;
        } else if (ingest_type === 11) {
            return __MODULE__.t_dtype.DTYPE_LIST_DATE;
        } else if (ingest_type === 12) {
            return __MODULE__.t_dtype.DTYPE_LIST_DURATION;
        } else if (ingest_type === 13) {
            return __MODULE__.t_dtype.DTYPE_LIST_BOOL;
        } else if (ingest_type === 14) {
            return __MODULE__.t_dtype.DTYPE_LIST_STR;
        } else if (ingest_type === 15) {
            return __MODULE__.t_dtype.DTYPE_INT32;
        } else if (ingest_type === 16) {
            return __MODULE__.t_dtype.DTYPE_INT16;
        } else if (ingest_type === 17) {
            return __MODULE__.t_dtype.DTYPE_INT8;
        }

        return __MODULE__.t_dtype.DTYPE_STR;
    }

    /******************************************************************************
     *
     * View
     *
     */

    /**
     * A View object represents a specific transform (configuration or pivot,
     * filter, sort, etc) configuration on an underlying {@link module:perspective~table}. A View
     * receives all updates from the {@link module:perspective~table} from which it is derived, and
     * can be serialized to JSON or trigger a callback when it is updated.  View
     * objects are immutable, and will remain in memory and actively process
     * updates until its {@link module:perspective~view#delete} method is called.
     *
     * <strong>Note</strong> This constructor is not public - Views are created
     * by invoking the {@link module:perspective~table#view} method.
     *
     * @example
     * // Returns a new View, pivoted in the row space by the "name" column.
     * table.view({row_pivots: ["name"]});
     *
     * @class
     * @hideconstructor
     */
    async function view(pool, sides, gnode, config, name, callbacks, table, msg_id = undefined, worker = undefined) {
        this._View = undefined;
        table.cancelled = false;
        this.date_parser = new DateParser();
        this.config = config || {};
        var update_query_percentage = percentage => {
            if (msg_id && worker) {
                worker.post({
                    id: msg_id,
                    is_percentage: true,
                    data: percentage
                });
            }
        };

        var enable_query_progress = enabled => {
            if (msg_id && worker) {
                worker.post({
                    id: msg_id,
                    is_progress: true,
                    data: enabled
                });
            }
        };

        const cancel_access = () => {
            return table.cancelled;
        };

        if (sides === 0) {
            this._View = await new Promise((resolve, reject) => {
                __MODULE__.make_view_zero(pool, gnode, name, defaults.COLUMN_SEPARATOR_STRING,
                    this.config, this.date_parser, update_query_percentage, enable_query_progress,
                    cancel_access, resolve, reject);
            });
        } else if (sides === 1) {
            this._View = await new Promise((resolve, reject) => {
                __MODULE__.make_view_one(pool, gnode, name, defaults.COLUMN_SEPARATOR_STRING,
                    this.config, this.date_parser, update_query_percentage, enable_query_progress,
                    cancel_access, resolve, reject);
            });
        } else if (sides === 2) {
            this._View = await new Promise((resolve, reject) => {
                __MODULE__.make_view_two(pool, gnode, name, defaults.COLUMN_SEPARATOR_STRING,
                    this.config, this.date_parser, update_query_percentage, enable_query_progress,
                    cancel_access, resolve, reject);
            });
        }

        if (!table.cancelled) {
            this.ctx = this._View.get_context();
            this.column_only = this._View.is_column_only();
            this.callbacks = callbacks;
            this.name = name;
            this.table = table;
            bindall(this);
        }
        return this;
    }

    /**
     * A copy of the config object passed to the {@link table#view} method
     * which created this {@link module:perspective~view}.
     *
     * @returns {object} Shared the same key/values properties as {@link module:perspective~view}
     */
    view.prototype.get_config = async function() {
        return JSON.parse(JSON.stringify(this.config));
    };

    /**
     * Delete this {@link module:perspective~view} and clean up all resources associated with it.
     * View objects do not stop consuming resources or processing updates when
     * they are garbage collected - you must call this method to reclaim these.
     */
    view.prototype.delete = async function() {
        this._View.delete();
        this.ctx.delete();

        this.table.views.splice(this.table.views.indexOf(this), 1);
        this.table = undefined;
        let i = 0,
            j = 0;
        while (i < this.callbacks.length) {
            let val = this.callbacks[i];
            if (val.view !== this) this.callbacks[j++] = val;
            i++;
        }
        this.callbacks.length = j;
        if (this._delete_callback) {
            this._delete_callback();
        }
    };

    /**
     * How many pivoted sides does this view have?
     *
     * @private
     *
     * @returns {number} sides The number of sides of this `View`.
     */
    view.prototype.sides = function() {
        return this._View.sides();
    };

    view.prototype._num_hidden = function() {
        // Count hidden columns.
        let hidden = 0;
        if (this.config.row_pivots.length > 0 || this.config.column_pivots.length > 0) {
            // Disable hidden column when sort in case context one
            for (const sort of this.config.sort) {
                if (this.config.columns.indexOf(sort[0]) === -1 && this.config.row_pivots.indexOf(sort[0]) === -1
                    && this.config.column_pivots.indexOf(sort[0]) === -1) {
                    hidden++;
                }
            }
        } else {
            for (const sort of this.config.sort) {
                if (this.config.columns.indexOf(sort[0]) === -1) {
                    hidden++;
                }
            }
        }
        return hidden;
    };

    function col_path_vector_to_string(vector) {
        let extracted = [];
        for (let i = 0; i < vector.size(); i++) {
            extracted.push(__MODULE__.scalar_vec_to_string(vector, i));
        }
        vector.delete();
        return extracted;
    }

    const extract_vector_scalar = function(vector) {
        // handles deletion already - do not call delete() on the input vector again
        let extracted = [];
        for (let i = 0; i < vector.size(); i++) {
            let item = vector.get(i);
            extracted.push(col_path_vector_to_string(item));
        }
        vector.delete();
        return extracted;
    };

    /**
     * The schema of this {@link module:perspective~view}. A schema is an Object, the keys of which
     * are the columns of this {@link module:perspective~view}, and the values are their string type names.
     * If this {@link module:perspective~view} is aggregated, theses will be the aggregated types;
     * otherwise these types will be the same as the columns in the underlying
     * {@link module:perspective~table}
     *
     * @async
     *
     * @returns {Promise<Object>} A Promise of this {@link module:perspective~view}'s schema.
     */
    view.prototype.schema = async function() {
        return extract_map(this._View.schema());
    };

    view.prototype.schema_with_range = async function(start_col, end_col) {
        return extract_map(this._View.schema_with_range(start_col, end_col));
    };

    view.prototype.agg_custom_schema = async function() {
        return extract_map(this._View.agg_custom_schema());
    };

    view.prototype.longest_text_cols = async function() {
        return extract_map(this._View.longest_text_cols());
    };

    view.prototype._column_names = function(skip = false, depth = 0, from_shema = false) {
        return extract_vector_scalar(this._View.column_names(skip, depth, from_shema, false)).map(x => x.join(defaults.COLUMN_SEPARATOR_STRING));
    };

    view.prototype.all_column_names = async function() {
        const ns = this._View.all_column_names();
        const col_paths = extract_vector_scalar(ns);
        const col_names = col_paths.map(x => x.join(column_separator_str(this.config.pivot_view_mode)));
        return col_names;
    };

    /**
     * Call cpp to get suggestion value base on paginator
     */
    view.prototype._get_suggestion_value = async function(start, end) {
        var values = [];
        let size = await this._get_suggestion_size();
        var ns = this._View.get_suggestion_value(start, end);
        let end_idx = Math.min(size, end);
        for (let ridx = start; ridx < end_idx; ridx++) {
            let value = __MODULE__.scalar_vec_to_val(ns, ridx - start);
            if (value && value.type === "ERROR") {
                values.push("(error)");
            } else {
                if (value && (typeof value === "object")) {
                    value = "\"" + extract_vector(value).join("\", \"") + "\"";
                }
                values.push(value);
            }
        }
        return values;
    };

    /**
     * get suggestion value and return to client
     */
    view.prototype.get_suggestion_value = async function(start, end) {
        return this._get_suggestion_value(start, end);
    };

    /**
     * get size of suggestion column from cpp
     */
    view.prototype._get_suggestion_size = async function() {
        return this._View.get_suggestion_size();
    };

    /**
     * Call cpp to create suggestion column
     */
    view.prototype._create_suggestion_column = async function(name, agg_level = "OFF", binning = {type: "OFF"}, data_format = "none", search_term = "", limit = 1000) {
        const binning_info = __MODULE__.get_binning_info(binning);
        this._View.create_suggestion_column(name, agg_level, binning_info, data_format, search_term, limit);
    };

    /**
     * Call cpp to reset suggestion column
     */
    view.prototype._reset_suggestion_column = async function() {
        this._View.reset_suggestion_column();
    };

    /**
     * Create suggestion column and get first ten values
     */
    view.prototype.create_suggestion_column = async function(name, agg_level = "OFF", binning = {type: "OFF"}, data_format = "none", search_term = "", limit = 1000) {
        this._create_suggestion_column(name, agg_level, binning, data_format, search_term, limit);
        let rv = await this._get_suggestion_value(0, limit);
        this._reset_suggestion_column();
        return rv;
    };

    view.prototype.get_default_binning = async function(colname) {
        return extract_map(this._View.get_default_binning(colname));
    };

    view.prototype.get_truncated_columns = async function() {
        return extract_map(this._View.get_truncated_columns());
    };

    view.prototype.get_selection_summarize = async function(options) {
        const num_sides = this.sides();
        const num_agg = num_sides !== 0 ? this.config.columns.length : 0;
        options = options || [];

        var has_row_path = false;
        if (this.column_only) {
            has_row_path = this._View.has_row_path() && (this.config.pivot_view_mode !== defaults.PIVOT_VIEW_MODES.flatten
                || (this.config.pivot_view_mode === defaults.PIVOT_VIEW_MODES.flatten && this.column_only && num_agg === 1));
        }
        const max_avail_cols = 2000;
        const max_cols = this._View.num_columns() + ((this.sides() === 0 ||
            (this.config.pivot_view_mode === defaults.PIVOT_VIEW_MODES.flatten && (!this.column_only || num_agg > 1))) ? 0 : 1);
        const max_rows = this._View.num_rows();
        const hidden = this._num_hidden();
        const nidx = ["zero", "one", "two"][num_sides];

        const is_row_pivot = num_sides !=0 && !this.column_only;
        let selections = [];
        for (let option of options) {
            const start_row = (is_row_pivot && this.config.pivot_view_mode !== defaults.PIVOT_VIEW_MODES.flatten)
                ? option.start_row + 1 : option.start_row;
            const end_row = (is_row_pivot && this.config.pivot_view_mode !== defaults.PIVOT_VIEW_MODES.flatten)
                ? option.end_row + 1 : option.end_row;
            const start_col = option.start_col;
            var end_col = (option.end_col) * (hidden + 1);

            if (end_col < max_avail_cols) {
                end_col = Math.min(max_cols, end_col);
            }

            let list_idx = [];
            for (let cidx = start_col; cidx <= end_col; cidx++) {
                list_idx.push((option.index_map && cidx in option.index_map) ? option.index_map[cidx] : cidx);
            }
            selections.push({
                start_row: start_row,
                end_row: end_row > max_rows ? max_rows : end_row,
                start_col: start_col,
                end_col: end_col,
                list_idx: list_idx
            });
        }

        return extract_map(__MODULE__[`get_selection_summarize_${nidx}`](this._View, selections));
    }

    /**
     * get separator string base on pivot mode
     *
     * if pivot view mode:
     * - flatten: " - "
     * - nested: "|"
     *
     * @param {*} pivot_view_mode
     */
    const column_separator_str = function(pivot_view_mode) {
        if (pivot_view_mode === defaults.PIVOT_VIEW_MODES.flatten) {
            return defaults.FLATTEN_COLUMN_SEPARATOR_STRING;
        } else {
            return defaults.COLUMN_SEPARATOR_STRING;
        }
    }

    const to_format = async function(options, formatter) {
        const num_sides = this.sides();
        const num_agg = num_sides !== 0 ? this.config.columns.length : 0;
        const num_pivots = this.config.row_pivots.length + this.config.column_pivots.length;
        options = options || {};
        var has_row_path = false;
        const full_value = options["full_value"] || false;
        const include_error = options["include_error"] != undefined ? options["include_error"] : true;
        if (this.column_only) {
            has_row_path = this._View.has_row_path() && (this.config.pivot_view_mode !== defaults.PIVOT_VIEW_MODES.flatten
                || (this.config.pivot_view_mode === defaults.PIVOT_VIEW_MODES.flatten && this.column_only && num_agg === 1));
        }
        const max_avail_cols = 2000;
        const max_cols = this._View.num_columns() + ((this.sides() === 0 ||
            (this.config.pivot_view_mode === defaults.PIVOT_VIEW_MODES.flatten && (!this.column_only || num_agg > 1))) ? 0 : 1);
        const max_rows = this._View.num_rows();
        const hidden = this._num_hidden();
        const col_separator_str = column_separator_str(this.config.pivot_view_mode);

        const viewport = this.config.viewport ? this.config.viewport : {};
        const is_row_pivot = num_sides !=0 && !this.column_only;
        const start_row = (is_row_pivot && (this.config.pivot_view_mode !== defaults.PIVOT_VIEW_MODES.flatten || num_pivots == 0))
            ? (options.start_row || (viewport.top ? viewport.top : 0)) + 1
            : options.start_row || (viewport.top ? viewport.top : 0);
        const end_row = (is_row_pivot && (this.config.pivot_view_mode !== defaults.PIVOT_VIEW_MODES.flatten || num_pivots == 0))
            ? (options.end_row || (viewport.height ? start_row + viewport.height : max_rows)) + 1
            : options.end_row || (viewport.height ? start_row + viewport.height : max_rows);
        const start_raw_col = options.start_col || (viewport.left ? viewport.left : 0);
        const start_col = (start_raw_col > 0 && (is_row_pivot || has_row_path)) ? start_raw_col - 1 : start_raw_col;
        var end_col = (options.end_col || (viewport.width ? start_col + viewport.width : max_cols)) * (hidden + 1);

        // In pivot mode, end_col can be greater than 2000, the max cols.
        // So in this case, we don't have to limit its column count.
        if (end_col < max_avail_cols) {
            end_col = Math.min(max_cols, end_col);
        }
        // In case of pivot mode, we have to fetch only visible columns, not whole columns.
        var schema = null;
        const nidx = ["zero", "one", "two"][num_sides];
        if (num_sides === 2) {
            schema = await this.schema_with_range(start_col, end_col);
        } else {
            schema = await this.schema();
        }

        let list_idx = [];
        if (!options.index_map) {
            for (let cidx = start_col; cidx < end_col; cidx++) {
                list_idx.push(cidx);
            }
        } else {
            for (let cidx = start_col; cidx < end_col; cidx++) {
                if (cidx in options.index_map) {
                    list_idx.push(options.index_map[cidx]);
                } else {
                    list_idx.push(cidx);
                }
            }
            /*for (var index in options.index_map) {
                list_idx.push(options.index_map[index]);
            }
            if (list_idx.length < end_col - start_col) {
                for (var i = list_idx.length; i < end_col - start_col; i++) {
                    list_idx.push(start_col + i);
                }
            }*/
        }

        console.log('--map--------', options.index_map, list_idx, start_col, end_col);

        const slice = __MODULE__[`get_data_slice_${nidx}`](this._View, start_row, end_row > max_rows ? max_rows : end_row, start_col, end_col, list_idx);
        //const ns = num_sides == 2 ? slice.get_column_names() : slice.get_short_column_names();
        const ns = slice.get_short_column_names();
        //const col_names = extract_vector_scalar(ns).map(x => x.join(defaults.COLUMN_SEPARATOR_STRING));
        var col_names = [];
        var short_col_names = [];
        if (!this.column_only) {
            col_names = extract_vector_scalar(ns).map(x => x.join(col_separator_str));
        } else {
            const col_paths = extract_vector_scalar(ns);
            col_names = col_paths.map(x => x.join(col_separator_str));
            short_col_names = col_paths.map(x => x.join(col_separator_str));
        }

        let data = formatter.initDataValue();
        var is_row_path = idx => {
            return idx === start_col && num_sides !== 0 && (this.config.pivot_view_mode != defaults.PIVOT_VIEW_MODES.flatten
            || (this.config.pivot_view_mode === defaults.PIVOT_VIEW_MODES.flatten && this.column_only && num_agg === 1))
            && !(num_sides === 1 && this.config.row_pivots.length === 0 && this.config.combined_field.combined_mode === defaults.COMBINED_MODES.column)
            && !(num_sides === 2 && this.config.combined_field.combined_mode === defaults.COMBINED_MODES.column && this.config.row_pivots.length === 0 && num_agg > 1);
        };
        //const names = await this._column_names();
        for (let ridx = start_row; ridx < end_row; ridx++) {
            let row = formatter.initRowValue();
            for (let cidx = start_col; cidx < end_col; cidx++) {
                //const cposition = num_sides == 2 ? cidx : cidx - start_col;
                const cposition = cidx - start_col;
                const col_name = has_row_path ? short_col_names[cposition] : col_names[cposition];
                if (num_sides !== 2 && (cidx - (num_sides > 0 ? 1 : 0)) % (this.config.columns.length + hidden) >= this.config.columns.length) {
                    // Hidden columns are always at the end, so don't emit these.
                    continue;
                //} else if (cidx === start_col && num_sides !== 0) {
                } else if (is_row_path(cidx)) {
                    if (!this.column_only) {
                        const row_path = slice.get_row_path(ridx);
                        const row_path_extra = slice.get_row_path_extra(ridx);
                        let extra = extract_vector(row_path_extra);
                        var path_value = {};
                        if (extra[0]) {
                            path_value["is_leaf"] = true;
                        } else {
                            path_value["is_leaf"] = false;
                        }
                        if (extra[1]) {
                            path_value["outside_of_tree"] = true;
                        }
                        if (extra[2]) {
                            path_value["always_expand"] = true;
                        } else {
                            path_value["always_expand"] = false;
                        }
                        path_value["value"] = [];
                        if (ridx < max_rows) {
                            var row_path_size = row_path.size();
                            //formatter.initColumnValue(data, row, "__ROW_PATH__");
                            for (let i = 0; i < row_path_size; i++) {
                                const value = __MODULE__.scalar_vec_to_val(row_path, i);
                                //formatter.addColumnValue(data, row, "__ROW_PATH__", value);
                                if (value && value.type === "ERROR") {
                                    path_value["value"].unshift("(error)");
                                } else {
                                    path_value["value"].unshift((value === null || value === "") ? "(blank)" : value);
                                }
                            }
                            /*if (ridx === max_rows && num_sides === 1 && row_path_size === 0) {
                                //formatter.addColumnValue(data, row, "__ROW_PATH__", "__ROW_TOTAL__");
                                path_value["value"].unshift("__ROW_TOTAL__");
                            }*/
                        }
                        formatter.setColumnValue(data, row, "__ROW_PATH__", path_value);
                        row_path.delete();
                    } else if (has_row_path) {
                        const headers = slice.get_row_header(ridx);
                        //formatter.initColumnValue(data, row, "__ROW_PATH__");
                        var path_value = {
                            value: [],
                            is_leaf: true
                        };
                        if (ridx < max_rows) {
                            for (let i = 0; i < headers.size(); i++) {
                                const value = __MODULE__.scalar_vec_to_val(headers, i);
                                //formatter.addColumnValue(data, row, "__ROW_PATH__", value);
                                path_value["value"].unshift(value);
                            }
                        }
                        formatter.setColumnValue(data, row, "__ROW_PATH__", path_value);
                        headers.delete();
                    }
                } else {
                    if (col_names[cposition] == undefined) {
                        continue;
                    }
                    var name = col_names[cposition];
                    var col_path = name.split(col_separator_str);
                    const type = schema[col_path[col_path.length - 1]];

                    const value = __MODULE__[`get_from_data_slice_${nidx}`](slice, ridx, cidx, full_value, include_error);
                    
                    if (typeof value === "object" && value && value.type !== "ERROR") {
                        const extracted_value = extract_vector(value);
                        formatter.setColumnValue(data, row, col_name, extracted_value);
                    }else {
                        formatter.setColumnValue(data, row, col_name, value);
                    }

                    if (col_name == "(4 / 0)") {
                        console.log("new-col-value--", value);
                    }
                }
            }
            formatter.addRow(data, row);
        }
        // GAB: fix memory leak issue: the slice do have to be deleted as it keep reference on the data
        slice.delete();

        return formatter.formatData(data, options.config);
    };

    /**
     * Serializes this view to JSON data in a column-oriented format.
     *
     * @async
     *
     * @param {Object} [options] An optional configuration object.
     * @param {number} options.start_row The starting row index from which
     * to serialize.
     * @param {number} options.end_row The ending row index from which
     * to serialize.
     * @param {number} options.start_col The starting column index from which
     * to serialize.
     * @param {number} options.end_col The ending column index from which
     * to serialize.
     *
     * @returns {Promise<Array>} A Promise resolving to An array of Objects
     * representing the rows of this {@link module:perspective~view}.  If this {@link module:perspective~view} had a
     * "row_pivots" config parameter supplied when constructed, each row Object
     * will have a "__ROW_PATH__" key, whose value specifies this row's
     * aggregated path.  If this {@link module:perspective~view} had a "column_pivots" config
     * parameter supplied, the keys of this object will be comma-prepended with
     * their comma-separated column paths.
     */
    view.prototype.to_columns = async function(options) {
        return to_format.call(this, options, formatters.jsonTableFormatter);
    };

    /**
     * Serializes this view to JSON data in a row-oriented format.
     *
     * @async
     *
     * @param {Object} [options] An optional configuration object.
     * @param {number} options.start_row The starting row index from which
     * to serialize.
     * @param {number} options.end_row The ending row index from which
     * to serialize.
     * @param {number} options.start_col The starting column index from which
     * to serialize.
     * @param {number} options.end_col The ending column index from which
     * to serialize.
     *
     * @returns {Promise<Array>} A Promise resolving to An array of Objects
     * representing the rows of this {@link module:perspective~view}.  If this {@link module:perspective~view} had a
     * "row_pivots" config parameter supplied when constructed, each row Object
     * will have a "__ROW_PATH__" key, whose value specifies this row's
     * aggregated path.  If this {@link module:perspective~view} had a "column_pivots" config
     * parameter supplied, the keys of this object will be comma-prepended with
     * their comma-separated column paths.
     */
    view.prototype.to_json = async function(options) {
        return to_format.call(this, options, formatters.jsonFormatter);
    };

    /**
     * Serializes this view to CSV data in a standard format.
     *
     * @async
     *
     * @param {Object} [options] An optional configuration object.
     * @param {number} options.start_row The starting row index from which
     * to serialize.
     * @param {number} options.end_row The ending row index from which
     * to serialize.
     * @param {number} options.start_col The starting column index from which
     * to serialize.
     * @param {number} options.end_col The ending column index from which
     * to serialize.
     * @param {Object} options.config A config object for the Papaparse {@link https://www.papaparse.com/docs#json-to-csv}
     * config object.
     *
     * @returns {Promise<string>} A Promise resolving to a string in CSV format
     * representing the rows of this {@link module:perspective~view}.  If this {@link module:perspective~view} had a
     * "row_pivots" config parameter supplied when constructed, each row
     * will have prepended those values specified by this row's
     * aggregated path.  If this {@link module:perspective~view} had a "column_pivots" config
     * parameter supplied, the keys of this object will be comma-prepended with
     * their comma-separated column paths.
     */
    view.prototype.to_csv = async function(options) {
        return to_format.call(this, options, formatters.csvFormatter);
    };

    /**
     * Serializes a view column into a TypedArray.
     *
     * @async
     *
     * @param {string} column_name The name of the column to serialize.
     *
     * @returns {Promise<TypedArray>} A promise resolving to a TypedArray
     * representing the data of the column as retrieved from the {@link module:perspective~view} - all
     * pivots, aggregates, sorts, and filters have been applied onto the values
     * inside the TypedArray. The TypedArray will be constructed based on data type -
     * integers will resolve to Int8Array, Int16Array, or Int32Array. Floats resolve to
     * Float32Array or Float64Array. If the column cannot be found, or is not of an
     * integer/float type, the Promise returns undefined.
     */
    view.prototype.col_to_js_typed_array = async function(col_name, options = {}) {
        const names = await this._column_names();
        const num_rows = await this.num_rows();
        const column_pivot_only = this.column_only === true;

        let idx = names.indexOf(col_name);

        const start_row = options.start_row || 0;
        const end_row = (options.end_row || num_rows) + (column_pivot_only ? 1 : 0);

        // type-checking is handled in c++ to accomodate column-pivoted views
        if (idx === -1) {
            return undefined;
        }

        if (this.sides() === 0) {
            return __MODULE__.col_to_js_typed_array_zero(this._View, idx, false, start_row, end_row);
        } else if (this.sides() === 1) {
            // columns start at 1 for > 0-sided views
            return __MODULE__.col_to_js_typed_array_one(this._View, idx + 1, false, start_row, end_row);
        } else {
            return __MODULE__.col_to_js_typed_array_two(this._View, idx + 1, column_pivot_only, start_row, end_row);
        }
    };

    /**
     * Serializes a view to arrow.
     *
     * @async
     *
     * @param {Object} [options] An optional configuration object.
     * @param {number} options.start_row The starting row index from which
     * to serialize.
     * @param {number} options.end_row The ending row index from which
     * to serialize.
     * @param {number} options.start_col The starting column index from which
     * to serialize.
     * @param {number} options.end_col The ending column index from which
     * to serialize.
     *
     * @returns {Promise<TypedArray>} A Table in the Apache Arrow format containing
     * data from the view.
     */
    view.prototype.to_arrow = async function(options = {}) {
        const names = await this._column_names();
        const schema = await this.schema();

        const vectors = [];

        const start_col = options.start_col || 0;
        const end_col = options.end_col || names.length;
        const col_separator_str = column_separator_str(this.config.pivot_view_mode);

        for (let i = start_col; i < end_col; i++) {
            const name = names[i];
            const col_path = name.split(col_separator_str);
            const type = schema[col_path[col_path.length - 1]];
            if (type === "float") {
                const [vals, nullCount, nullArray] = await this.col_to_js_typed_array(name, options);
                vectors.push(Vector.new(Data.Float(new Float64(), 0, vals.length, nullCount, nullArray, vals)));
            } else if (type === "integer") {
                const [vals, nullCount, nullArray] = await this.col_to_js_typed_array(name, options);
                vectors.push(Vector.new(Data.Int(new Int32(), 0, vals.length, nullCount, nullArray, vals)));
            } else if (type === "date" || type === "datetime" || type === "duration") {
                const [vals, nullCount, nullArray] = await this.col_to_js_typed_array(name, options);
                vectors.push(Vector.new(Data.Timestamp(new TimestampSecond(), 0, vals.length, nullCount, nullArray, vals)));
            } else if (type === "string") {
                const [vals, offsets, indices, nullCount, nullArray] = await this.col_to_js_typed_array(name, options);
                const utf8Vector = Vector.new(Data.Utf8(new Utf8(), 0, offsets.length - 1, 0, null, offsets, vals));
                const type = new Dictionary(utf8Vector.type, new Uint32(), null, null, utf8Vector);
                vectors.push(Vector.new(Data.Dictionary(type, 0, indices.length, nullCount, nullArray, indices)));
            } else {
                throw new Error(`Type ${type} not supported`);
            }
        }

        return Table.fromVectors(vectors, names.slice(start_col, end_col)).serialize("binary", false).buffer;
    };

    /**
     * The number of aggregated rows in this {@link module:perspective~view}.  This is affected by
     * the "row_pivots" configuration parameter supplied to this {@link module:perspective~view}'s
     * contructor.
     *
     * @async
     *
     * @returns {Promise<number>} The number of aggregated rows.
     */
    view.prototype.num_rows = async function() {
        return this._View.num_rows();
    };

    /**
     * The number of aggregated columns in this {@link view}.  This is affected by
     * the "column_pivots" configuration parameter supplied to this {@link view}'s
     * contructor.
     *
     * @async
     *
     * @returns {Promise<number>} The number of aggregated columns.
     */
    view.prototype.num_columns = async function() {
        const ncols = this._View.num_columns();
        const nhidden = this._num_hidden();
        return ncols - (ncols / (this.config.columns.length + nhidden)) * nhidden;
    };

    /**
     * Whether this row at index `idx` is in an expanded or collapsed state.
     *
     * @async
     *
     * @returns {Promise<bool>} Whether this row is expanded.
     */
    view.prototype.get_row_expanded = async function(idx) {
        return this._View.get_row_expanded(idx);
    };

    /**
     * Expands the row at index `idx`.
     *
     * @async
     *
     * @returns {Promise<void>}
     */
    view.prototype.expand = async function(idx) {
        return this._View.expand(idx, this.config.row_pivots.length);
    };

    /**
     * Collapses the row at index `idx`.
     *
     * @async
     *
     * @returns {Promise<void>}
     */
    view.prototype.collapse = async function(idx) {
        return this._View.collapse(idx);
    };

    /**
     * Set expansion `depth` of the pivot tree.
     *
     */
    view.prototype.set_depth = async function(depth) {
        return this._View.set_depth(depth, this.config.row_pivots.length);
    };

    /**
     * Returns the data of all changed rows in JSON format, or for 1+ sided contexts
     * the entire dataset of the view.
     * @private
     */
    view.prototype._get_step_delta = async function() {
        let delta = this._View.get_step_delta(0, 2147483647);
        let data;
        if (delta.cells.size() === 0) {
            // FIXME This is currently not implemented for 1+ sided contexts.
            data = await this.to_json();
        } else {
            let rows = {};
            for (let x = 0; x < delta.cells.size(); x++) {
                rows[delta.cells.get(x).row] = true;
            }
            rows = Object.keys(rows);
            const results = await Promise.all(
                rows.map(row =>
                    this.to_json({
                        start_row: Number.parseInt(row),
                        end_row: Number.parseInt(row) + 1
                    })
                )
            );
            data = [].concat.apply([], results);
        }
        delta.cells.delete();
        return data;
    };

    /**
     * Returns an array of row indices indicating which rows have been changed
     * in an update.
     * @private
     */
    view.prototype._get_row_delta = async function() {
        let d = this._View.get_row_delta(0, 2147483647);
        return extract_vector(d.rows);
    };

    /**
     * Register a callback with this {@link module:perspective~view}.  Whenever the {@link module:perspective~view}'s
     * underlying table emits an update, this callback will be invoked with the
     * aggregated row deltas.
     *
     * @param {function} callback A callback function invoked on update.  The
     * parameter to this callback is dependent on the `mode` parameter:
     *     - "none" (default): The callback is invoked without an argument.
     *     - "rows": The callback is invoked with the changed rows.
     */
    view.prototype.on_update = function(callback, {mode = "none"} = {}) {
        if (["none", "rows", "pkey"].indexOf(mode) === -1) {
            throw new Error(`Invalid update mode "${mode}" - valid modes are "none", "rows" and "pkey".`);
        }
        if (mode === "rows" || mode === "pkey") {
            // Enable deltas only if needed by callback
            if (!this._View._get_deltas_enabled()) {
                this._View._set_deltas_enabled(true);
            }
        }
        this.callbacks.push({
            view: this,
            callback: async () => {
                switch (mode) {
                    case "rows":
                        {
                            callback(await this._get_step_delta());
                        }
                        break;
                    case "pkey":
                        {
                            callback(await this._get_row_delta());
                        }
                        break;
                    default: {
                        callback();
                    }
                }
            }
        });
    };

    view.prototype.remove_update = function(callback) {
        this.callbacks = this.callbacks.filter(x => x.callback !== callback);
    };

    /**
     * Register a callback with this {@link module:perspective~view}.  Whenever the {@link module:perspective~view}
     * is deleted, this callback will be invoked.
     *
     * @param {function} callback A callback function invoked on update.  The
     *     parameter to this callback shares a structure with the return type of
     *     {@link module:perspective~view#to_json}.
     */
    view.prototype.on_delete = function(callback) {
        this._delete_callback = callback;
    };

    view.prototype.remove_delete = function() {
        this._delete_callback = undefined;
    };

    view.prototype.dname_mapping = async function() {
        var sides = this.sides();
        if (sides == 2) {
            const col_separator_str = column_separator_str(this.config.pivot_view_mode);
            var name_vecs = extract_vector_scalar(this._View.column_names(false, 0, true, false));
            var dname_map = extract_map(this._View.get_dname_mapping()) || {};
            var dname_mapping = {};
            name_vecs.forEach((col_vec, _) => {
                if (dname_map[col_vec[col_vec.length - 1]]) {
                    var new_col_vec = [...col_vec];
                    new_col_vec[col_vec.length - 1] = dname_map[col_vec[col_vec.length - 1]];
                    dname_mapping[col_vec.join(col_separator_str)] = new_col_vec.join(col_separator_str);
                }
            });
            return dname_mapping;
        } else {
            return extract_map(this._View.get_dname_mapping()) || {};
        }
    };

    view.prototype.set_dname_mapping = async function(colname, dname) {
        var sides = this.sides();
        var dname_mapping = extract_map(this._View.set_dname_mapping(colname, dname));
        if (sides == 2) {
            const col_separator_str = column_separator_str(this.config.pivot_view_mode);
            var name_vecs = extract_vector_scalar(this._View.column_names(false, 0, true, false));
            var dname_map = {};
            dname_map[colname] = dname;
            dname_mapping = {};
            name_vecs.forEach((col_vec, _) => {
                if (dname_map[col_vec[col_vec.length - 1]]) {
                    var new_col_vec = [...col_vec];
                    new_col_vec[col_vec.length - 1] = dname_map[col_vec[col_vec.length - 1]];
                    dname_mapping[col_vec.join(col_separator_str)] = new_col_vec.join(col_separator_str);
                }
            });
        }
        return dname_mapping;
    };

    view.prototype.clear_dname_mapping = async function(colname) {
        var sides = this.sides();
        var dname_mapping = extract_map(this._View.clear_dname_mapping(colname));
        if (sides == 2) {
            const col_separator_str = column_separator_str(this.config.pivot_view_mode);
            var name_vecs = extract_vector_scalar(this._View.column_names(false, 0, true, false));
            var dname_map = {};
            dname_map[colname] = colname;
            dname_mapping = {};
            name_vecs.forEach((col_vec, _) => {
                if (dname_map[col_vec[col_vec.length - 1]]) {
                    var new_col_vec = [...col_vec];
                    new_col_vec[col_vec.length - 1] = dname_map[col_vec[col_vec.length - 1]];
                    dname_mapping[col_vec.join(col_separator_str)] = new_col_vec.join(col_separator_str);
                }
            });
        }
        return dname_mapping;
    };

    view.prototype.update_dname_mapping = async function(current_name, new_name) {
        var sides = this.sides();
        var dname_mapping = extract_map(this._View.update_dname_mapping(current_name, new_name));
        if (sides == 2) {
            const col_separator_str = column_separator_str(this.config.pivot_view_mode);
            var name_vecs = extract_vector_scalar(this._View.column_names(false, 0, true, false));
            var dname_map = {};
            var all_dname_map = extract_map(this._View.get_dname_mapping()) || {};
            dname_map[new_name] = all_dname_map[new_name];
            dname_mapping = {};
            name_vecs.forEach((col_vec, _) => {
                if (dname_map[col_vec[col_vec.length - 1]]) {
                    var new_col_vec = [...col_vec];
                    new_col_vec[col_vec.length - 1] = dname_map[col_vec[col_vec.length - 1]];
                    dname_mapping[col_vec.join(col_separator_str)] = new_col_vec.join(col_separator_str);
                }
            });
        }
        return dname_mapping;
    };

    view.prototype.update_column_name = async function(old_name, new_name) {
        if (old_name === new_name) {
            return {};
        }
        return extract_map(this._View.update_column_name(old_name, new_name));
    }

    view.prototype.update_show_type = async function(old_name, new_name, show_type) {
        let colname_map = {};
        let dname_map = {};
        if (old_name !== new_name) {
            dname_map = await this.update_column_name(old_name, new_name);
        }
        this._View.update_show_type(new_name, show_type);
        var name_vecs = extract_vector_scalar(this._View.column_names(false, 0, false, false));
        const col_separator_str = column_separator_str(this.config.pivot_view_mode);
        name_vecs.forEach(names => {
            let index = names.indexOf(new_name);
            if (index !== -1) {
                let old_names = [...names];
                old_names[index] = old_name;
                let dname = dname_map[new_name] ? dname_map[new_name] : new_name;
                let dname_names = [...names];
                dname_names[index] = dname;
                colname_map[old_names.join(col_separator_str)] = {
                    new_original_name: names.join(col_separator_str),
                    dname: dname_names.join(col_separator_str)
                };
            }
        });
        return colname_map;
    };

    view.prototype.update_data_format = async function(name, data_format) {
        this._View.update_data_format(name, data_format);
        return {};
    };

    view.prototype.update_data_formats = async function(data_formats) {
        /*for (var name in data_formats) {
            this._View.update_data_format(name, data_formats[name]);
        }*/
        var col_names = [];
        var formats = [];
        for (var name in data_formats) {
            col_names.push(name);
            formats.push(data_formats[name]);
        }
        this._View.update_data_formats(__MODULE__.val_to_string_vec(col_names), __MODULE__.val_to_string_vec(formats));
        return {};
    };

    view.prototype.enable_cache = async function() {
        return this._View.enable_cache();
    };

    view.prototype.disable_cache = async function() {
        return this._View.disable_cache();
    };

    view.prototype.subtotal_list = async function(skip = false, depth = 0, from_shema = false) {
        const col_separator_str = column_separator_str(this.config.pivot_view_mode);
        var col_path = extract_vector_scalar(this._View.column_names(skip, depth, from_shema, true));
        if (this.config.pivot_view_mode) {
            col_path = col_path.slice(this.config.row_pivots.length);
        }
        return [...new Set(col_path.map(x => x.join(col_separator_str)))];
    };

    view.prototype.update_pagination_setting = async function(items_per_page, page_number) {
        this._View.update_pagination_setting(items_per_page, page_number);
        return {};
    };

    /******************************************************************************
     *
     * Table
     *
     */

    /**
     * A Table object is the basic data container in Perspective.  Tables are
     * typed - they have an immutable set of column names, and a known type for
     * each.
     *
     * <strong>Note</strong> This constructor is not public - Tables are created
     * by invoking the {@link module:perspective~table} factory method, either on the perspective
     * module object, or an a {@link module:perspective~worker} instance.
     *
     * @class
     * @hideconstructor
     */
    function table(gnode, pool, index, computed, limit, limit_index) {
        this.gnode = gnode;
        this.pool = pool;
        this.name = Math.random() + "";
        this.initialized = false;
        this.index = index;
        this.pool.set_update_delegate(this);
        this.computed = computed || [];
        this.callbacks = [];
        this.views = [];
        this.limit = limit;
        this.limit_index = limit_index;
        this.cancelled = false;
        bindall(this);
    }

    table.prototype._update_callback = function() {
        for (let e in this.callbacks) {
            this.callbacks[e].callback();
        }
    };

    /**
     * Remove all rows in this {@link module:perspective~table} while preserving the schema and
     * construction options.
     */
    table.prototype.clear = function() {
        this.gnode.reset();
    };

    /**
     * Replace all rows in this {@link module:perspective~table} the input data.
     */
    table.prototype.replace = function(data) {
        this.gnode.reset();
        this.update(data);
    };

    /**
     * Delete this {@link module:perspective~table} and clean up all resources associated with it.
     * Table objects do not stop consuming resources or processing updates when
     * they are garbage collected - you must call this method to reclaim these.
     */
    table.prototype.delete = function() {
        if (this.views.length > 0) {
            throw "Table still has contexts - refusing to delete.";
        }
        this.pool.unregister_gnode(this.gnode.get_id());
        this.gnode.delete();
        this.pool.delete();
        if (this._delete_callback) {
            this._delete_callback();
        }
    };

    /**
     * Register a callback with this {@link module:perspective~table}.  Whenever the {@link module:perspective~view}
     * is deleted, this callback will be invoked.
     *
     * @param {function} callback A callback function invoked on update.  The
     *     parameter to this callback shares a structure with the return type of
     *     {@link module:perspective~table#to_json}.
     */
    table.prototype.on_delete = function(callback) {
        this._delete_callback = callback;
    };

    /**
     * The number of accumulated rows in this {@link module:perspective~table}.  This is affected by
     * the "index" configuration parameter supplied to this {@link module:perspective~view}'s
     * contructor - as rows will be overwritten when they share an idnex column.
     *
     * @async
     *
     * @returns {Promise<number>} The number of accumulated rows.
     */
    table.prototype.size = async function() {
        return this.gnode.get_table().size();
    };

    table.prototype._schema = function(computed) {
        let schema = this.gnode.get_tblschema();
        let columns = schema.columns();
        let types = schema.types();
        let new_schema = {};
        console.log('tblschema--------', schema, columns);
        const computed_schema = this.computed_schema();
        for (let key = 0; key < columns.size(); key++) {
            const name = columns.get(key);
            if (name === "__error__" && (typeof computed_schema[name] === "undefined" || computed)) {
                continue;
            }
            new_schema[name] = get_column_type(types.get(key).value);
        }
        schema.delete();
        columns.delete();
        types.delete();
        return new_schema;
    };

    /**
     * The schema of this {@link module:perspective~table}.  A schema is an Object whose keys are the
     * columns of this {@link module:perspective~table}, and whose values are their string type names.
     *
     * @async
     * @param {boolean} computed Should computed columns be included?
     * (default false)
     * @returns {Promise<Object>} A Promise of this {@link module:perspective~table}'s schema.
     */
    table.prototype.schema = async function(computed = false) {
        return this._schema(computed);
    };

    table.prototype._computed_schema = function(computed_columns, override = true) {
        console.log('----_computed_schema---');
        if (!computed_columns || computed_columns.length === 0) return {};

        const new_schema = {};
        let computed_schema = __MODULE__.get_table_computed_schema(this.gnode, computed_columns);
        let columns = computed_schema.columns();
        let types = computed_schema.types();

        for (let key = 0; key < columns.size(); key++) {
            const name = columns.get(key);
            const type = types.get(key);
            new_schema[name] = get_column_type(type.value);
        }

        computed_schema.delete();
        columns.delete();
        types.delete();

        return new_schema;
    };

    table.prototype.get_computation_input_types = function(computed_function_name) {
        const  types = __MODULE__.get_computation_input_types(computed_function_name);
        const new_types = [];

        for (let i = 0; i < types.size(); i++) {
            const type = types.get(i);
            new_types.push(get_column_type(type.value));
        }

        return new_types;
    }

    /**
     * The computed schema of this {@link module:perspective~table}. Returns a schema of only computed
     * columns added by the user, the keys of which are computed columns and the values an
     * Object containing the associated column_name, column_type, and computation.
     *
     * @async
     *
     * @returns {Promise<Object>} A Promise of this {@link module:perspective~table}'s computed schema.
     */
    table.prototype.computed_schema = async function(computed_columns, override = true) {
        return this._computed_schema(computed_columns, override);
    };

    table.prototype.longest_text_cols = async function() {
        return extract_map(this.gnode.get_table().longest_text_cols());
    };

    table.prototype._is_date_field = function(schema) {
        return key => schema[key] === "datetime" || schema[key] === "date" || schema[key] === "duration" ||
             schema[key] === "list_date" || schema[key] === "list_duration" || schema[key] === "list_datetime";
    };

    table.prototype._is_valid_aggregate = function() {
        return key => {
            switch(key) {
                case "count":
                case "mean by count":
                case "distinct count":
                    return false;

                default: {
                    return true;
                }
            }
        };
    };

    table.prototype._is_one_side_operator = function(operator) {
        if (perspective.ONE_SIDE_OPERATOR.indexOf(operator) !== -1) {
            return true;
        }
        return false;
    };

    table.prototype.is_one_side_operator = function(operator) {
        return this._is_one_side_operator(operator);
    };

    table.prototype._is_valid_filter = function(filter) {
        const schema = this._schema();
        const isDateFilter = this._is_date_field(schema);
        const isValidAggregateHaving = this._is_valid_aggregate();
        if (!filter[1]) {
            return false;
        }
        if (this._is_one_side_operator(filter[1])) {
            return true;
        }
        if (Array.isArray(filter[2])) {
            if (filter[2].length == 1 && filter[2][0] == '') {
                return false;
            }
            if ((filter[1] === "between" || filter[1] === "element between") && filter[2].length !== 2) {
                return false;
            }
            if (filter[1] === "top n") {
                if (filter[2].length !== 2) {
                    return false;
                }
                let num = parseInt(filter[2][0]);
                if (num) {
                    return true;
                }
                return false;
            }
            if (filter[1] === "relative date") {
                if (filter[2].length !== 3) {
                    return false;
                }
                return (typeof filter[2][0] === "string") && (typeof filter[2][1] === "string") && (typeof filter[2][2] === "string");
            }
            for (var i = 0; i < filter[2].length; i++) {
                var elem_value = filter[2][i] !== null && isDateFilter(filter[0]) ? new DateParser().parse(filter[2][i]) : filter[2][i];
                if (elem_value === "undefined" || elem_value === null) {
                    return false;
                }
            }
            return true;
        } else {
            const value = filter[2] && isDateFilter(filter[0]) ? new DateParser().parse(filter[2]) : filter[2];
            return typeof value !== "undefined" && value !== null;
        }
    };

    /**
     * Determines whether a given filter is valid.
     *
     * @param {Array<string>} [filter] A filter configuration array to test
     *
     * @returns {boolean} Whether the filter is valid
     */
    table.prototype.is_valid_filter = function(filter) {
        return this._is_valid_filter(filter);
    };

    table.prototype._is_valid_having = function(having) {
        const schema = this._schema();
        if (this._is_one_side_operator(having[1])) {
            return true;
        }
        const isDateHaving = this._is_date_field(schema);
        const isValidAggregateHaving = this._is_valid_aggregate();
        if (Array.isArray(having[2])) {
            if (having[2].length == 1 && having[2][0] == '') {
                return false;
            }
            for (var i = 0; i < having[2].length; i++) {
                var elem_value = having[2][i] !== null && (isDateHaving(having[0]) && isValidAggregateHaving(having[3])) ? new DateParser().parse(having[2][i]) : having[2][i];
                if (elem_value === "undefined" || elem_value === null) {
                    return false;
                }
            }
            return true;
        } else {
            const value = having[2] && (isDateHaving(having[0]) && isValidAggregateHaving(having[3])) ? new DateParser().parse(having[2]) : having[2];
            return typeof value !== "undefined" && value !== null;
        }
    };

    /**
     * Determines whether a given having is valid.
     *
     * @param {Array<string>} [having] A having configuration array to test
     *
     * @returns {boolean} Whether the having is valid
     */
    table.prototype.is_valid_having = function(having) {
        return this._is_valid_having(having);
    };

    /**
     * Create a new {@link module:perspective~view} from this table with a specified
     * configuration.
     *
     * @param {Object} [config] The configuration object for this {@link module:perspective~view}.
     * @param {Array<string>} [config.row_pivots] An array of column names
     * to use as {@link https://en.wikipedia.org/wiki/Pivot_table#Row_labels Row Pivots}.
     * @param {Array<string>} [config.column_pivots] An array of column names
     * to use as {@link https://en.wikipedia.org/wiki/Pivot_table#Column_labels Column Pivots}.
     * @param {Array<Object>} [config.columns] An array of column names for the
     * output columns.  If none are provided, all columns are output.
     * @param {Object} [config.aggregates] An object, the keys of which are column
     * names, and their respective values ar ethe aggregates calculations to use
     * when this view has `row_pivots`.  A column provided to `config.columns`
     * without an aggregate in this object, will use the default aggregate
     * calculation for its type.
     * @param {Array<Array<string>>} [config.filter] An Array of Filter configurations to
     * apply.  A filter configuration is an array of 3 elements:  A column name,
     * a supported filter comparison string (e.g. '===', '>'), and a value to compare.
     * @param {Array<string>} [config.sort] An Array of Sort configurations to apply.
     * A sort configuration is an array of 2 elements: A column name, and a sort direction,
     * which are: "none", "asc", "desc", "col asc", "col desc", "asc abs", "desc abs", "col asc abs", "col desc abs".
     *
     * @example
     * var view = table.view({
     *      row_pivots: ['region'],
     *      columns: ["region"],
     *      aggregates: {"region": "dominant"},
     *      filter: [['client', 'contains', 'fred']],
     *      sort: [['value', 'asc']]
     * });
     *
     * @returns {view} A new {@link module:perspective~view} object for the supplied configuration,
     * bound to this table
     */
    table.prototype.view = function(_config = {}, msg_id = undefined, worker = undefined) {
        let config = {};
        for (const key of Object.keys(_config)) {
            if (defaults.CONFIG_ALIASES[key]) {
                if (!config[defaults.CONFIG_ALIASES[key]]) {
                    console.warn(`Deprecated: "${key}" config parameter, please use "${defaults.CONFIG_ALIASES[key]}" instead`);
                    config[defaults.CONFIG_ALIASES[key]] = _config[key];
                } else {
                    throw new Error(`Duplicate configuration parameter "${key}"`);
                }
            } else if (key === "aggregate") {
                console.warn(`Deprecated: "aggregate" config parameter has been replaced by "aggregates" and "columns"`);
                config[key] = _config[key];
            } else if (defaults.CONFIG_VALID_KEYS.indexOf(key) > -1) {
                config[key] = _config[key];
            } else {
                throw new Error(`Unrecognized config parameter "${key}"`);
            }
        }

        config.row_pivots = config.row_pivots || [];
        config.column_pivots = config.column_pivots || [];
        config.filter = config.filter || [];
        config.sort = config.sort || [];

        const aggregates = config.aggregates || {};
        const periods = config.periods || {};
        const show_types = config.show_types || {};
        const search_types = config.search_types || {};
        const data_formats = config.data_formats || {};
        const schema = this._schema(true);
        const exist_period = Object.values(periods).indexOf("previous") > -1;
        var first_date = false;
        for (var f of config.filter) {
            if ((schema[f[0]] === "date" || schema[f[0]] === "datetime") && !first_date && exist_period) {
                f[5] = "yes";
                first_date = true;;
            } else {
                f[5] = "no";
            }
            if (!f[6]) {
                f[6] = "OFF";
            }
        }
        var rename_map = {};
        if (config.column_pivots.length == 0 && config.row_pivots.length == 0 && config.column_map.length > 0) {
            config.column_map.forEach(item => {
                rename_map[item.original_name] = item.name
            });
        }

        if (config.columns === undefined && config.aggregate === undefined) {
            config.columns = this._columns(true);
        }

        config.search_type = [];
        if (schema) {
            for (var col_name in schema) {
                var rename = rename_map[col_name] ? rename_map[col_name] : col_name;
                config.search_type.push({column: rename, type: search_types[rename] || defaults.SEARCH_TYPE_NULL});
            }
        }

        config.pivot_info = [];
        if (config.row_pivot_info) {
            config.pivot_info = config.pivot_info.concat(config.row_pivot_info);
        }

        if (config.column_pivot_info) {
            config.pivot_info = config.pivot_info.concat(config.column_pivot_info);
        }

        if (config.columns) {
            if (config.aggregate) {
                throw new Error(`Duplicate configuration parameter "aggregate" and "columns"`);
            }
            config.aggregate = [];
            for (const col of config.columns) {
                config.aggregate.push({column: col, op: aggregates[col] || defaults.AGGREGATE_DEFAULTS[schema[col]]});
            }
        } else {
            config.columns = config.aggregates.map(x => (Array.isArray(x.column) ? x.column[0] : x.column));
            config.aggregate = [];
            for (const col of config.columns) {
                config.aggregate.push({column: col, op: aggregates[col] || defaults.AGGREGATE_DEFAULTS[schema[col]]});
            }
        }

        /*if (config.sort) {
            for (const sort of config.sort) {
                const name = sort[0];
                if (config.columns.indexOf(name) === -1) {
                    if (config.column_pivots.indexOf(name) > -1 || config.row_pivots.indexOf(name) > -1) {
                        config.aggregate.push({column: name, op: "unique"});
                    } else {
                        if (aggregates[name] || schema[name]){
                            config.aggregate.push({column: name, op: aggregates[name] || defaults.AGGREGATE_DEFAULTS[schema[name]]});
                        }
                    }
                }
            }
        }*/

        let name = Math.random() + "";
        let sides;

        if (config.row_pivots.length > 0 || config.column_pivots.length > 0 || config.value_pivots.length > 0) {
            if (config.column_pivots && config.column_pivots.length > 0) {
                sides = 2;
            } else {
                sides = 1;
            }
        } else {
            sides = 0;
        }

        config.data_format = [];
        config.period = [];
        if (sides === 0) {
            if (schema) {
                for (var col_name in schema) {
                    var rename = rename_map[col_name] ? rename_map[col_name] : col_name;
                    config.data_format.push({column: rename, format: data_formats[rename] || defaults.DATA_FORMAT_DEFAULTS[schema[col_name]]});
                }
            }
        } else {
            for (var col_name in aggregates) {
                var rename = rename_map[col_name] ? rename_map[col_name] : col_name;
                if (data_formats[col_name]) {
                    config.data_format.push({column: rename, format: data_formats[rename]});
                }
                if (periods[col_name]) {
                    config.period.push({column: rename, type: periods[rename]});
                }
            }
            for (var col_name of config.row_pivots.concat(config.column_pivots)) {
                var rename = rename_map[col_name] ? rename_map[col_name] : col_name;
                if (data_formats[col_name]) {
                    config.data_format.push({column: rename, format: data_formats[rename]});
                }
            }
        }

        config.show_type = [];
        if (sides !== 0) {
            for (var col_name in show_types) {
                var rename = rename_map[col_name] ? rename_map[col_name] : col_name;
                if (!show_types[rename]) {
                    continue;
                }
                config.show_type.push({column: rename, type: show_types[rename]});
            }
        }

        /*if (config.row_pivots.length == 0 || config.column_pivots.length > 0) {
            config.pivot_view_mode = defaults.PIVOT_VIEW_MODES.nested;
        }*/

        console.log('-------------view config----------', config);

        let v = new view(this.pool, sides, this.gnode, config, name, this.callbacks, this, msg_id, worker);
        this.views.push(v);
        return v;
    };

    /**
     * Updates the rows of a {@link module:perspective~table}. Updated rows are pushed down to any
     * derived {@link module:perspective~view} objects.
     *
     * @param {Object<string, Array>|Array<Object>|string} data The input data
     * for this table.  The supported input types mirror the constructor options, minus
     * the ability to pass a schema (Object<string, string>) as this table has
     * already been constructed, thus its types are set in stone.
     *
     * @see {@link module:perspective~table}
     */
    table.prototype.update = function(data) {
        let pdata;
        let cols = this._columns();
        let schema = this.gnode.get_tblschema();
        let types = schema.types();
        let is_arrow = false;

        pdata = accessor;

        if (data instanceof ArrayBuffer) {
            if (this.size() === 0) {
                throw new Error("Overriding Arrow Schema is not supported.");
            }
            pdata = load_arrow_buffer(data, cols, types);
            is_arrow = true;
        } else if (typeof data === "string") {
            //GAB: the local 'papaparse' library is no more used
            //if (data[0] === ",") {
            //    data = "_" + data;
            //}
            //accessor.init(__MODULE__, papaparse.parse(data.trim(), {header: true}).data);
            //accessor.names = cols;
            //accessor.types = accessor.extract_typevec(types).slice(0, cols.length);
        } else {
            accessor.init(__MODULE__, data);
            accessor.names = cols;
            accessor.types = accessor.extract_typevec(types).slice(0, cols.length);
        }

        if (accessor.row_count === 0) {
            console.warn("table.update called with no data - ignoring");
            return;
        }

        try {
            console.log('---update-table----', this.computed);
            [, this.limit_index] = make_table(pdata, this.pool, this.gnode, this.computed, this.index || "", this.limit, this.limit_index, true, false, is_arrow);
            this.initialized = true;
        } catch (e) {
            console.error(`Update failed: ${e}`);
        } finally {
            schema.delete();
            types.delete();
        }
    };

    /**
     * Removes the rows of a {@link module:perspective~table}. Removed rows are pushed down to any
     * derived {@link module:perspective~view} objects.
     *
     * @param {Array<Object>} data An array of primary keys to remove.
     *
     * @see {@link module:perspective~table}
     */
    table.prototype.remove = function(data) {
        let pdata;
        let cols = this._columns();
        let schema = this.gnode.get_tblschema();
        let types = schema.types();
        let is_arrow = false;

        data = data.map(idx => ({[this.index]: idx}));

        if (data instanceof ArrayBuffer) {
            pdata = load_arrow_buffer(data, [this.index], types);
            is_arrow = true;
        } else {
            accessor.init(__MODULE__, data);
            accessor.names = [this.index];
            accessor.types = [accessor.extract_typevec(types)[cols.indexOf(this.index)]];
            pdata = accessor;
        }

        try {
            console.log('---remove-table----', this.computed);

            [, this.limit_index] = make_table(pdata, this.pool, this.gnode, undefined, this.index || "", this.limit, this.limit_index, false, true, is_arrow);
            this.initialized = true;
        } catch (e) {
            console.error(`Remove failed`, e);
        } finally {
            schema.delete();
            types.delete();
        }
    };

    /**
     * Create a new table with the addition of new computed columns (defined as javascript functions)
     *
     * @param {Computation} computed A computation specification object
     */
    table.prototype.add_computed = function(computed) {
        let pool, gnode;

        try {
            pool = new __MODULE__.t_pool();
            gnode = __MODULE__.clone_gnode_table(pool, this.gnode, computed);
            if (this.computed.length > 0) {
                computed = this.computed.concat(computed);
            }
            return new table(gnode, pool, this.index, computed, this.limit, this.limit_index);
        } catch (e) {
            if (pool) {
                pool.delete();
            }
            if (gnode) {
                gnode.delete();
            }
            throw e;
        }
    };

    table.prototype._columns = function() {
        let schema = this.gnode.get_tblschema();
        let cols = schema.columns();
        let names = [];
        for (let cidx = 0; cidx < cols.size(); cidx++) {
            let name = cols.get(cidx);
            if (name !== "__error__") {
                names.push(name);
            }
        }
        schema.delete();
        cols.delete();
        return names;
    };

    /**
     * The column names of this table.
     *
     * @async
     * @param {boolean} computed Should computed columns be included?
     * (default false)
     * @returns {Array<string>} An array of column names for this table.
     */
    table.prototype.columns = async function() {
        return this._columns();
    };

    table.prototype._column_metadata = function() {
        let schema = this.gnode.get_tblschema();
        let cols = schema.columns();
        let types = schema.types();

        let metadata = [];
        for (let cidx = 0; cidx < cols.size(); cidx++) {
            let name = cols.get(cidx);
            let meta = {};

            meta.name = name;
            meta.type = get_column_type(types.get(cidx).value);
            meta.computed = undefined;
            metadata.push(meta);
        }

        types.delete();
        cols.delete();
        schema.delete();

        return metadata;
    };

    table.prototype._dname_mapping = function() {
        let dname_mapping = this.gnode.get_dname_mapping();
        return extract_map(dname_mapping) || {};
    };

    /**
     * Column metadata for this table.
     *
     * If the column is computed, the `computed` property is an Object containing:
     *  - Array `input_columns`
     *  - String `input_type`
     *  - Object `computation`.
     *
     *  Otherwise, `computed` is `undefined`.
     *
     * @async
     *
     * @returns {Array<object>} An array of Objects containing metadata for each column.
     */
    table.prototype.column_metadata = function() {
        return this._column_metadata();
    };

    table.prototype.execute = function(f) {
        f(this);
    };

    table.prototype.dname_mapping = async function() {
        return this._dname_mapping();
    };

    table.prototype.cancel_query_data = async function() {
        this.cancelled = true;
    };

    table.prototype.get_default_binning = async function(colname) {
        return extract_map(this.gnode.get_default_binning(colname));
    };

    table.prototype.set_dname_mapping = async function(colname, dname) {
        return extract_map(this.gnode.set_dname_mapping(colname, dname));
    };

    table.prototype.set_dname_mappings = async function(dname_mapping) {
        var col_names = [];
        var dnames = [];
        for (var name in dname_mapping) {
            col_names.push(name);
            dnames.push(dname_mapping[name]);
        }
        return extract_map(this.gnode.set_dname_mappings(__MODULE__.val_to_string_vec(col_names), __MODULE__.val_to_string_vec(dnames)));
    };

    table.prototype.clear_dname_mapping = async function(colname) {
        return extract_map(this.gnode.clear_dname_mapping(colname));
    };

    table.prototype.get_computed_functions = async function() {
        let functions = extract_map(__MODULE__.get_computed_functions());

        for (const f in functions) {
            if (functions.hasOwnProperty(f)) {
                functions[f] = extract_map(functions[f]);
                functions[f]["num_params"] = parseInt(functions[f]["num_params"]);
            }
        }

        return functions;
    }

    /******************************************************************************
     *
     * Worker API
     *
     */

    function error_to_json(error) {
        const obj = {};
        if (typeof error !== "string") {
            Object.getOwnPropertyNames(error).forEach(key => {
                obj[key] = error[key];
            }, error);
        } else {
            obj["message"] = error;
        }
        return obj;
    }

    class Host {
        constructor() {
            this._tables = {};
            this._views = {};
        }

        init(msg) {
            this.post(msg);
        }

        post() {
            throw new Error("post() not implemented!");
        }

        clear_views(client_id) {
            for (let key of Object.keys(this._views)) {
                if (this._views[key].client_id === client_id) {
                    try {
                        this._views[key].delete();
                    } catch (e) {
                        console.error(e);
                    }
                    delete this._views[key];
                }
            }
            console.debug(`GC ${Object.keys(this._views).length} views in memory`);
        }

        process(msg, client_id) {
            switch (msg.cmd) {
                case "init":
                    this.init(msg);
                    break;
                case "table":
                    this._tables[msg.name] = perspective.table(msg.args[0], msg.options);
                    break;
                case "add_computed":
                    let table = this._tables[msg.original];
                    let computed = msg.computed;
                    // rehydrate computed column functions
                    for (let i = 0; i < computed.length; ++i) {
                        let column = computed[i];
                        eval("column.func = " + column.func);
                    }
                    this._tables[msg.name] = table.add_computed(computed);
                    break;
                case "table_generate":
                    let g;
                    eval("g = " + msg.args);
                    g(function(tbl) {
                        this._tables[msg.name] = tbl;
                        this.post({
                            id: msg.id,
                            data: "created!"
                        });
                    });
                    break;
                case "table_execute":
                    let f;
                    eval("f = " + msg.f);
                    f(this._tables[msg.name]);
                    break;
                case "view":
                    var _this = this;
                    this._tables[msg.table_name].view(msg.config, msg.id, this).then(view => {
                        if (this._tables[msg.table_name].cancelled) {
                            this._tables[msg.table_name].cancelled = false;
                            _this.post({
                                id: msg.id,
                                error: 3
                            });
                        } else {
                            _this._views[msg.view_name] = view;
                            _this._views[msg.view_name].client_id = client_id;
                            _this.post({
                                id: msg.id,
                                data: {
                                    success: view ? true : false
                                }
                            });
                        }
                    });
                    break;
                case "table_method": {
                    let obj = this._tables[msg.name];
                    let result;

                    try {
                        if (msg.subscribe) {
                            obj[msg.method](e => {
                                this.post({
                                    id: msg.id,
                                    data: e
                                });
                            });
                        } else {
                            result = obj[msg.method].apply(obj, msg.args);
                            if (result && result.then) {
                                result
                                    .then(data => {
                                        if (data) {
                                            this.post({
                                                id: msg.id,
                                                data: data
                                            });
                                        }
                                    })
                                    .catch(error => {
                                        this.post({
                                            id: msg.id,
                                            error: error_to_json(error)
                                        });
                                    });
                            } else {
                                this.post({
                                    id: msg.id,
                                    data: result
                                });
                            }
                        }
                    } catch (e) {
                        this.post({
                            id: msg.id,
                            error: error_to_json(e)
                        });
                        return;
                    }

                    break;
                }
                case "view_method": {
                    let obj = this._views[msg.name];
                    if (!obj) {
                        this.post({
                            id: msg.id,
                            error: {message: "View is not initialized"}
                        });
                        return;
                    }
                    if (msg.subscribe) {
                        try {
                            obj[msg.method](e => {
                                this.post({
                                    id: msg.id,
                                    data: e
                                });
                            });
                        } catch (error) {
                            this.post({
                                id: msg.id,
                                error: error_to_json(error)
                            });
                        }
                    } else {
                        obj[msg.method]
                            .apply(obj, msg.args)
                            .then(result => {
                                if (msg.method === "delete") {
                                    delete this._views[msg.name];
                                }
                                if (msg.method === "to_arrow") {
                                    this.post(
                                        {
                                            id: msg.id,
                                            data: result
                                        },
                                        [result]
                                    );
                                } else {
                                    this.post({
                                        id: msg.id,
                                        data: result
                                    });
                                }
                            })
                            .catch(error => {
                                this.post({
                                    id: msg.id,
                                    error: error_to_json(error)
                                });
                            });
                    }
                    break;
                }
            }
        }
    }

    class WorkerHost extends Host {
        constructor() {
            super();
            self.addEventListener("message", e => this.process(e.data), false);
        }

        post(msg, transfer) {
            self.postMessage(msg, transfer);
        }

        init({buffer}) {
            if (typeof WebAssembly === "undefined") {
                console.log("Loading asm.js");
            } else {
                console.log("Loading wasm");
                __MODULE__ = __MODULE__({
                    wasmBinary: buffer,
                    wasmJSMethod: "native-wasm"
                });
            }
        }
    }

    if (typeof self !== "undefined" && self.addEventListener) {
        new WorkerHost();
    }

    function reparse_data(data) {
        var headers = Object.keys(data[0]);
        var numHeader = headers.length;
        var firstRow = data[0];
        if (headers[numHeader - 1] === '__parsed_extra' && numHeader - 2 >= 0 && firstRow[headers[numHeader - 2]] && firstRow[headers[numHeader - 2]].indexOf('[') !== -1) {
            var listData = [];
            data.forEach(function(row, inx) {
                var listValues = [];
                var lastCol = row[headers[numHeader - 2]];
                if (lastCol.indexOf('[') !== -1) {
                    listValues.push(lastCol.substr(lastCol.indexOf('[') + 1).trim());
                }
                var parsedExtra = row[headers[numHeader - 1]];
                parsedExtra.forEach(function(val) {
                    if (typeof val === "string" && val.charAt(val.length - 1) == ']') {
                        listValues.push(val.substr(0, val.length - 1).trim());
                    } else {
                        if (typeof val === "string") {
                            listValues.push(val.trim());
                        } else {
                            listValues.push(val);
                        }
                    }
                });
                listData[inx] = listValues;
            });

            data.forEach(function(row, inx) {
                row[headers[numHeader - 2]] = listData[inx];
                delete row[headers[numHeader - 1]];
            });
        }
        return data;
    }

    /******************************************************************************
     *
     * Perspective
     *
     */

    const perspective = {
        __module__: __MODULE__,

        Host: Host,

        worker: function() {},

        /**
         * A factory method for constructing {@link module:perspective~table}s.
         *
         * @example
         * // Creating a table directly from node
         * var table = perspective.table([{x: 1}, {x: 2}]);
         *
         * @example
         * // Creating a table from a Web Worker (instantiated via the worker() method).
         * var table = worker.table([{x: 1}, {x: 2}]);
         *
         * @param {Object<string, Array>|Object<string, string>|Array<Object>|string} data The input data
         *     for this table.  When supplied an Object with string values, an empty
         *     table is returned using this Object as a schema.  When an Object with
         *     Array values is supplied, a table is returned using this object's
         *     key/value pairs as name/columns respectively.  When an Array is supplied,
         *     a table is constructed using this Array's objects as rows.  When
         *     a string is supplied, the parameter as parsed as a CSV.
         * @param {Object} [options] An optional options dictionary.
         * @param {string} options.index The name of the column in the resulting
         *     table to treat as an index.  When updating this table, rows sharing an
         *     index of a new row will be overwritten. `index` is mutually exclusive
         *     to `limit`
         * @param {integer} options.limit The maximum number of rows that can be
         *     added to this table.  When exceeded, old rows will be overwritten in
         *     the order they were inserted.  `limit` is mutually exclusive to
         *     `index`.
         *
         * @returns {table} A new {@link module:perspective~table} object.
         */
        table: function(data, options) {
            options = options || {};
            options.index = options.index || "";

            let data_accessor;
            let is_arrow = false;

            if (data instanceof ArrayBuffer || (Buffer && data instanceof Buffer)) {
                data_accessor = load_arrow_buffer(data, null, options["column_types"]);
                is_arrow = true;
            } else {
                //if (typeof data === "string") {
                //    if (data[0] === ",") {
                //        data = "_" + data;
                //    }
                //    data = papaparse.parse(data.trim(), {dynamicTyping: true, header: true}).data;
                //}

                accessor.clean();
                accessor.init(__MODULE__, data);
                data_accessor = accessor;
            }

            if (options.index && options.limit) {
                throw `Cannot specify both index '${options.index}' and limit '${options.limit}'.`;
            }

            let gnode,
                pool,
                limit_index = 0;

            try {
                pool = new __MODULE__.t_pool();

                console.log('---new-table-----', this.computed, pool);

                [gnode, limit_index] = make_table(data_accessor, pool, undefined, undefined, options.index, options.limit, limit_index, false, false, is_arrow);
                console.log('---make_table--', gnode, limit_index);

                return new table(gnode, pool, options.index, undefined, options.limit, limit_index);
            } catch (e) {
                if (pool) {
                    pool.delete();
                }
                if (gnode) {
                    gnode.delete();
                }
                console.error(`Table initialization failed: ${e}`);
                throw e;
            }
        }
    };

    for (let prop of Object.keys(defaults)) {
        perspective[prop] = defaults[prop];
    }

    return perspective;
}
