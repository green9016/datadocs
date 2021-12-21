/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

import {bindall} from "./utils.js";

function unsubscribe(method, cmd) {
    return function() {
        let resolve;
        let reject = () => {};
        let args = Array.prototype.slice.call(arguments, 0, arguments.length);
        for (let i = args.length - 1; i >= 0; i--) {
            if (typeof args[i] === "function") {
                resolve = args.splice(i, 1)[0];
            }
        }
        let msg = {
            cmd: cmd || "view_method",
            name: this._name,
            method: method,
            args: args,
            subscribe: true
        };
        this._worker.post(msg, resolve, reject);
        this._worker.unsubscribe(cmd, resolve);
    };
}

function subscribe(method, cmd) {
    return function() {
        let resolve;
        let reject = () => {};
        let args = Array.prototype.slice.call(arguments, 0, arguments.length);
        for (let i = args.length - 1; i >= 0; i--) {
            if (typeof args[i] === "function") {
                resolve = args.splice(i, 1)[0];
            }
        }
        let msg = {
            cmd: cmd || "view_method",
            name: this._name,
            method: method,
            args: args,
            subscribe: true
        };
        this._worker.post(msg, resolve, reject, true);
    };
}

function async_queue(method, cmd) {
    return function() {
        var args = Array.prototype.slice.call(arguments, 0, arguments.length);
        return new Promise(
            function(resolve, reject) {
                var msg = {
                    cmd: cmd || "view_method",
                    name: this._name,
                    method: method,
                    args: args,
                    subscribe: false
                };
                this._worker.post(msg, resolve, reject);
            }.bind(this)
        );
    };
}

function view(worker, table_name, config, percentage_func, enable_progress_func, resolve, reject) {
    this._worker = worker;
    //this._config = config;
    this._name = Math.random() + "";
    var msg = {
        cmd: "view",
        view_name: this._name,
        table_name: table_name,
        config: config
    };
    this._worker.post(msg, resolve, reject, false, percentage_func, enable_progress_func);
    bindall(this);
}

function proxy_view(worker, name) {
    this._worker = worker;
    this._name = name;
}

proxy_view.prototype = view.prototype;

view.prototype.get_config = async_queue("get_config");

view.prototype.to_json = async_queue("to_json");

view.prototype.to_arrow = async_queue("to_arrow");

view.prototype.to_columns = async_queue("to_columns");

view.prototype.to_csv = async_queue("to_csv");

view.prototype.schema = async_queue("schema");

view.prototype.agg_custom_schema = async_queue("agg_custom_schema");

view.prototype.longest_text_cols = async_queue("longest_text_cols");

view.prototype.num_columns = async_queue("num_columns");

view.prototype.num_rows = async_queue("num_rows");

view.prototype.set_depth = async_queue("set_depth");

view.prototype.get_row_expanded = async_queue("get_row_expanded");

view.prototype.expand = async_queue("expand");

view.prototype.collapse = async_queue("collapse");

view.prototype.delete = async_queue("delete");

view.prototype.dname_mapping = async_queue("dname_mapping");

view.prototype.set_dname_mapping = async_queue("set_dname_mapping");

view.prototype.get_default_binning = async_queue("get_default_binning");

view.prototype.get_truncated_columns = async_queue("get_truncated_columns");

view.prototype.clear_dname_mapping = async_queue("clear_dname_mapping");

view.prototype.update_dname_mapping = async_queue("update_dname_mapping");

view.prototype.update_show_type = async_queue("update_show_type");

view.prototype.update_data_format = async_queue("update_data_format");

view.prototype.update_data_formats = async_queue("update_data_formats");

view.prototype.update_pagination_setting = async_queue("update_pagination_setting");

view.prototype.subtotal_list = async_queue("subtotal_list");

view.prototype.col_to_js_typed_array = async_queue("col_to_js_typed_array");

view.prototype.all_column_names = async_queue("all_column_names");

view.prototype.create_suggestion_column = async_queue("create_suggestion_column");

view.prototype.get_suggestion_value = async_queue("get_suggestion_value");

view.prototype.get_selection_summarize = async_queue("get_selection_summarize");

view.prototype.on_update = subscribe("on_update", "view_method", true);

view.prototype.remove_update = unsubscribe("remove_update", "view_method", true);

view.prototype.on_delete = subscribe("on_delete", "view_method", true);

view.prototype.remove_delete = unsubscribe("remove_delete", "view_method", true);

view.prototype.enable_cache = async_queue("enable_cache");

view.prototype.disable_cache = async_queue("disable_cache");

function table(worker, data, options) {
    this._worker = worker;
    // Set up msg
    name = options.name || Math.random() + "";
    var msg = {
        cmd: "table",
        name: name,
        args: [data],
        options: options || {}
    };
    this._worker.post(msg);
    this._name = name;

    bindall(this);
}

function computed_table(worker, computed, name) {
    this._worker = worker;
    this._name = Math.random() + "";
    let original = name;
    // serialize functions
    for (let i = 0; i < computed.length; ++i) {
        let column = computed[i];
        let func = column["func"];
        if (typeof func == "function") {
            column["func"] = func.toString();
        }
    }
    var msg = {
        cmd: "add_computed",
        original: original,
        name: this._name,
        computed: computed
    };
    this._worker.post(msg);
}

function proxy_table(worker, name) {
    this._worker = worker;
    this._name = name;
}

computed_table.prototype = table.prototype;
proxy_table.prototype = table.prototype;

table.prototype.add_computed = function(computed) {
    return new computed_table(this._worker, computed, this._name);
};

table.prototype.view = function(config, percentage_func, enable_progress_func, resolve, reject) {
    return new view(this._worker, this._name, config, percentage_func, enable_progress_func, resolve, reject);
};

table.prototype.schema = async_queue("schema", "table_method");

table.prototype.column_metadata = async_queue("column_metadata", "table_method");

table.prototype.computed_schema = async_queue("computed_schema", "table_method");

table.prototype.get_computation_input_types = async_queue("get_computation_input_types", "table_method");

table.prototype.longest_text_cols = async_queue("longest_text_cols", "table_method");

table.prototype.is_valid_filter = async_queue("is_valid_filter", "table_method");

table.prototype.is_valid_having = async_queue("is_valid_having", "table_method");

table.prototype.is_one_side_operator = async_queue("is_one_side_operator", "table_method");

table.prototype.size = async_queue("size", "table_method");

table.prototype.columns = async_queue("columns", "table_method");

table.prototype.clear = async_queue("clear", "table_method");

table.prototype.replace = async_queue("replace", "table_method");

table.prototype.delete = async_queue("delete", "table_method");

table.prototype.set_dname_mapping = async_queue("set_dname_mapping", "table_method");

table.prototype.set_dname_mappings = async_queue("set_dname_mappings", "table_method");

table.prototype.clear_dname_mapping = async_queue("clear_dname_mapping", "table_method");

table.prototype.on_delete = subscribe("on_delete", "table_method", true);

table.prototype.remove = async_queue("remove", "table_method");

table.prototype.dname_mapping = async_queue("dname_mapping", "table_method");

table.prototype.cancel_query_data = async_queue("cancel_query_data", "table_method");

table.prototype.get_default_binning = async_queue("get_default_binning", "table_method");

table.prototype.get_computed_functions = async_queue("get_computed_functions", "table_method");

table.prototype.update = function(data) {
    return new Promise((resolve, reject) => {
        var msg = {
            name: this._name,
            cmd: "table_method",
            method: "update",
            args: [data]
        };
        this._worker.post(msg, resolve, reject, false);
    });
};

table.prototype.execute = function(f) {
    var msg = {
        cmd: "table_execute",
        name: this._name,
        f: f.toString()
    };
    this._worker.post(msg);
};

export function worker() {
    this._worker = {
        initialized: {value: false},
        transferable: false,
        msg_id: 0,
        handlers: {},
        messages: []
    };
    bindall(this);
}

worker.prototype.unsubscribe = function(cmd, handler) {
    for (let key of Object.keys(this._worker.handlers)) {
        if (this._worker.handlers[key].resolve === handler) {
            delete this._worker.handlers[key];
        }
    }
};

worker.prototype.post = function(msg, resolve, reject, keep_alive = false, percentage_func = undefined, enable_progress_func = undefined) {
    if (resolve || percentage_func || enable_progress_func) {
        this._worker.handlers[++this._worker.msg_id] = {resolve, reject, keep_alive, percentage_func, enable_progress_func};
    }
    msg.id = this._worker.msg_id;
    if (this._worker.initialized.value) {
        this.send(msg);
    } else {
        this._worker.messages.push(() => this.send(msg));
    }
};

worker.prototype.send = function() {
    throw new Error("post() not implemented");
};

worker.prototype.open_table = function(name) {
    return new proxy_table(this, name);
};

worker.prototype.open_view = function(name) {
    return new proxy_view(this, name);
};

let _initialized = false;

worker.prototype._handle = function(e) {
    if (!this._worker.initialized.value) {
        if (!_initialized) {
            var event = document.createEvent("Event");
            event.initEvent("perspective-ready", false, true);
            window.dispatchEvent(event);
            _initialized = true;
        }
        for (var m in this._worker.messages) {
            if (this._worker.messages.hasOwnProperty(m)) {
                this._worker.messages[m]();
            }
        }
        this._worker.initialized.value = true;
        this._worker.messages = [];
    }
    if (e.data.id) {
        var handler = this._worker.handlers[e.data.id];
        if (handler) {
            if (e.data.error) {
                handler.reject(e.data.error);
            } else if (e.data.is_percentage && handler.percentage_func) {
                handler.percentage_func(e.data.data);
            } else if (e.data.is_progress && handler.enable_progress_func) {
                handler.enable_progress_func(e.data.data);
            } else {
                handler.resolve(e.data.data);
            }
            if (!handler.keep_alive && !(e.data.is_percentage || e.data.is_progress)) {
                delete this._worker.handlers[e.data.id];
            }
        }
    }
};

worker.prototype.table = function(data, options) {
    return new table(this, data, options || {});
};

worker.prototype.terminate = function() {
    this._worker.terminate();
    this._worker = undefined;
};
