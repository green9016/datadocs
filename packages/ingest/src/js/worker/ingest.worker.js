import load_ingest_module_func from "../../../obj/emingest";

import {Table} from "@apache-arrow/es2015-esm/table";
import {Data} from "@apache-arrow/es2015-esm/data";
import {Vector} from "@apache-arrow/es2015-esm/vector";
import {Field} from "@apache-arrow/es2015-esm/schema";
import {Utf8, Float64, Int8, Int16, Int32, Int64, Bool, List} from "@apache-arrow/es2015-esm/type";

function error_to_json(error) {
  const obj = {};
  if (typeof error !== "string") {
    Object.getOwnPropertyNames(error).forEach(key => {
      obj[key] = error[key];
    }, error);
  } else {
    obj["message"] = error;
  }
  console.log("ERROR: " + error);
  return obj;
}

class IngestWorker {
  constructor(func) {
    console.debug("[IngestWorker] constructor()");
    this.load_module_func = func;
    this.ingest_module = null;
    self.addEventListener("message", e => this.process(e.data), false);
    this._callback_cache = new Map();
    this.column_types = null;
    this.ingest_table = null;
  }

  _get_file_name(extension = undefined) {
    let filename = "/memfs/arraybuffer.data";
    if (extension) {
      filename = "/memfs/arraybuffer." + extension;
    }
    return filename;
  }

  convert_file(file, selected_files, sheet, extension, msg_id) {
    console.log("[IngestWorker] convert_file(" + file + ")");

    var result_data = null;
    let filename = this._get_file_name(extension);

    if (file === undefined || file instanceof ArrayBuffer) {

      if (file !== undefined) {
        console.debug("[IngestWorker.convert_file] Mounting " + file + " as MEMFS file /memfs/arraybuffer.data'");
        console.log("[IngestWorker.convert_file] Input data size: " + file.byteLength);
        this.ingest_module.FS_mkdir("memfs");
        this.ingest_module.FS_writeFile(filename, new Uint8Array(file), {canOwn: true}); // canOwn: true is critical here, to prevent doing a copy!!
      }
      let file_deleted = false;

      console.log("Memory report before loading file:");
      this.ingest_module.printMemoryReport();

      // Using embind generated classes and functions
      this.ingest_table = new this.ingest_module.Table();
      try {
        let t0 = performance.now();
        var percentage_callback = (percentage) => {
          this.send({
            id: msg_id,
            update_func: true,
            data: percentage
          });
        };

        const retval = this.ingest_module.convert_file(filename, selected_files || [], sheet || "", this.ingest_table, percentage_callback);
        if (retval == 2) {
          throw {
            code: 520,
            message: "Parser error"
          };
        }
        let t1 = performance.now();
        console.log("[IngestWorker.convert_file] convert_file PCS: " + (t1 - t0) + " milliseconds.");

        console.log("Memory report after loading file:");
        this.ingest_module.printMemoryReport();

        // Remove the file from memFS ASAP, to reduce memory pressure
        this.ingest_module.FS_unlink(filename);
        file_deleted = true;

        if (this.ingest_table.get_ingested_status() !== this.ingest_module.IngestedStatus.STATUS_COMPLETED) {
          throw {
            code: this.ingest_table.get_ingested_status().value,
            message: "Cancelled"
          };
        }
        t0 = performance.now();
        const column_count = this.ingest_table.get_column_count();
        const column_names = [];
        const column_types = [];
        const column_vectors = [];

        // Be sure there is at least 1MB available before there is the need to resize the Wasm heap
        // This is a hack to have stable typed memory views on Wasm heap during the next loop...
        this.ingest_module.ensureMemory(1);

        for (let idx = 0; idx < column_count; idx++) {
          const colname = this.ingest_table.get_column_name(idx);
          const coltype = this.ingest_table.get_column_type(idx);
          const coltypestr = this.ingest_table.get_column_type_as_string(idx);
          const eltcount = this.ingest_table.get_column_element_count(idx);
          const child_eltcount = this.ingest_table.get_column_list_element_count(idx);
          const length = this.ingest_table.get_column_array_buffer_size(idx);
          const length_bytes = this.ingest_table.get_column_array_buffer_size_in_bytes(idx);
          const null_count = this.ingest_table.get_column_null_count(idx);
          const nullmap_view = this.ingest_table.get_column_nullbitmap_buffer(idx);
          const array_buffer_view = this.ingest_table.get_column_array_buffer(idx);
          const offsets_buffer = this.ingest_table.get_column_offsets_buffer(idx);
          const sub_offsets_buffer = this.ingest_table.get_column_sub_offsets_buffer(idx);
          console.debug("Column: " + colname + " - Type: " + coltypestr + " - Attrs: " + eltcount + " elems " + length_bytes + " bytes_length " + null_count + " null_count");

          column_names.push(colname);
          column_types.push(coltype.value);

          if ((coltype === this.ingest_module.LogicalTypeId.Decimal) || (coltype === this.ingest_module.LogicalTypeId.Datetime) || (coltype === this.ingest_module.LogicalTypeId.Time)) {
            column_vectors.push(Vector.new(Data.Float(new Float64(), 0, eltcount, null_count, nullmap_view, array_buffer_view)));
          } else if (coltype === this.ingest_module.LogicalTypeId.Date) {
            column_vectors.push(Vector.new(Data.Int(new Int32(), 0, eltcount, null_count, nullmap_view, array_buffer_view)));
          } else if (coltype === this.ingest_module.LogicalTypeId.Integer32) {
            column_vectors.push(Vector.new(Data.Int(new Int32(), 0, eltcount, null_count, nullmap_view, array_buffer_view)));
          } else if (coltype === this.ingest_module.LogicalTypeId.Integer16) {
            column_vectors.push(Vector.new(Data.Int(new Int16(), 0, eltcount, null_count, nullmap_view, array_buffer_view)));
          } else if (coltype === this.ingest_module.LogicalTypeId.Integer8) {
            column_vectors.push(Vector.new(Data.Int(new Int8(), 0, eltcount, null_count, nullmap_view, array_buffer_view)));
          } else if (coltype === this.ingest_module.LogicalTypeId.Integer) {
            // array_buffer_view is a Int32Array with twice the size we would expect (because it is in fact a Int64Array, but JS does not support them yet)
            column_vectors.push(Vector.new(Data.Int(new Int64(), 0, eltcount, null_count, nullmap_view, array_buffer_view)));
          } else if (coltype === this.ingest_module.LogicalTypeId.Boolean) {
            column_vectors.push(Vector.new(Data.Bool(new Bool(), 0, eltcount, null_count, nullmap_view, array_buffer_view)));
          } else if (coltype === this.ingest_module.LogicalTypeId.String) {
            column_vectors.push(Vector.new(Data.Utf8(new Utf8(), 0, eltcount, null_count, nullmap_view, offsets_buffer, array_buffer_view)));
          } else if (coltype === this.ingest_module.LogicalTypeId.Error) {
            column_vectors.push(Vector.new(Data.Utf8(new Utf8(), 0, eltcount, null_count, nullmap_view, offsets_buffer, array_buffer_view)));
          } else if (coltype === this.ingest_module.LogicalTypeId.ListInteger) {
            const child_vector = Vector.new(Data.Int(new Int64(), 0, child_eltcount, null_count, nullmap_view, array_buffer_view));
            column_vectors.push(Vector.new(Data.List(new List(new Field(colname, new Int64())), 0, eltcount, null_count, nullmap_view, offsets_buffer, child_vector)));
          } else if ((coltype === this.ingest_module.LogicalTypeId.ListDecimal) || (coltype === this.ingest_module.LogicalTypeId.ListDatetime) || (coltype === this.ingest_module.LogicalTypeId.ListTime)) {
            const child_vector = Vector.new(Data.Int(new Float64(), 0, child_eltcount, null_count, nullmap_view, array_buffer_view));
            column_vectors.push(Vector.new(Data.List(new List(new Field(colname, new Float64())), 0, eltcount, null_count, nullmap_view, offsets_buffer, child_vector)));
          } else if (coltype === this.ingest_module.LogicalTypeId.ListDate) {
            const child_vector = Vector.new(Data.Int(new Int32(), 0, child_eltcount, null_count, nullmap_view, array_buffer_view));
            column_vectors.push(Vector.new(Data.List(new List(new Field(colname, new Int32())), 0, eltcount, null_count, nullmap_view, offsets_buffer, child_vector)));
          } else if (coltype === this.ingest_module.LogicalTypeId.ListBoolean) {
            const child_vector = Vector.new(Data.Bool(new Bool(), 0, child_eltcount, null_count, nullmap_view, array_buffer_view));
            column_vectors.push(Vector.new(Data.List(new List(new Field(colname, new Bool())), 0, eltcount, null_count, nullmap_view, offsets_buffer, child_vector)));
          } else if (coltype === this.ingest_module.LogicalTypeId.ListString) {
            const child_vector = Vector.new(Data.Utf8(new Utf8(), 0, child_eltcount, 0, undefined, sub_offsets_buffer, array_buffer_view));
            column_vectors.push(Vector.new(Data.List(new List(new Field(colname, new Utf8())), 0, eltcount, null_count, nullmap_view, offsets_buffer, child_vector)));
          }
        }

        const arrow_table = Table.new(column_vectors, column_names);
        result_data = arrow_table.serialize('binary', false).buffer;
        console.log("[IngestWorker.convert_file] Arrow buffer size: " + result_data.byteLength);
        this.column_types = column_types;
        t1 = performance.now();
        console.log("[IngestWorker.convert_file] convert_to_arrow_buffer PCS: " + (t1 - t0) + " milliseconds.");
      } catch (error) {
        this.ingest_table.delete();
        this.ingest_table = null;
        if (!file_deleted) {
          this.ingest_module.FS_unlink(filename);
          file_deleted = true;
        }
        this.ingest_module.FS_rmdir("/memfs");
        throw error;
      }

      // delete the table, to free up wasm memory
      this.ingest_table.delete();
      this.ingest_table = null;

      console.log("Memory report at end of conversion:");
      this.ingest_module.printMemoryReport();

      this.ingest_module.FS_rmdir("/memfs");
    }

    return result_data;
  }

  probe_file(file, extension = undefined, selected_files = []) {
    var result_data = [];
    let filename = this._get_file_name(extension);
    if (file === undefined || file instanceof ArrayBuffer) {
      if (file !== undefined) {
        // mount the file_data as an actual file in Memory Filesystem
        this.ingest_module.FS_mkdir("memfs");
        this.ingest_module.FS_writeFile(filename, new Uint8Array(file), {canOwn: true});
      }
    }
    // call to C++ “probe_file”
    result_data = this.ingest_module.probe_file(filename, selected_files || []);
    // Delete file in memory if sheet have zero sheet
    if (result_data.length === 0) {
      this.ingest_module.FS_unlink(filename);
    }
    // return value is a JS object in the form
    // { sheets: [ "sheet 1", "sheet 2", ... ] }
    return result_data;
  }

  probe_compress(file, extension = undefined, selected_files = []) {
    var result_data = [];
    if (file === undefined || file instanceof ArrayBuffer) {
      let filename = this._get_file_name(extension);
      if (file !== undefined) {
        // mount the file_data as an actual file in Memory Filesystem
        this.ingest_module.FS_mkdir("memfs");
        this.ingest_module.FS_writeFile(filename, new Uint8Array(file), {canOwn: true});
      }
      // call to C++ “probe_file”
      result_data = this.ingest_module.probe_compress(filename, selected_files);
      // Delete file in memory if sheet have zero sheet
      if (result_data.length === 0) {
        this.ingest_module.FS_unlink(filename);
      }
    }
    // return value is a JS object in the form
    // { sheets: [ "sheet 1", "sheet 2", ... ] }
    return result_data;
  }

  get_coumn_types() {
    return this.column_types;
  }

  cancel_ingesting_data() {
    if (this.ingest_dataset) {
      //this.ingest_dataset.set_ingested_status(this.ingest_module.IngestedStatus.STATUS_CANCELLED);
      this.ingest_dataset.cancel_ingesting_data();
    }
    return true;
  }

  init(msg) {
    console.debug("[IngestWorker] init()");
    try {
      if (!this.ingest_module && !this.init_pending) {
        console.debug("[IngestWorker.init] asynchronous loading of ingest.wasm");
        this.init_pending = true;
        this.load_module_func({
          printErr: x => console.error("[emingest] %o", x),
          print: x => console.log("[emingest] %o", x),
          abort: (what) => {
            console.error("Emscripten runtime aborted with: %o", what);
            throw what;
          }
        }).then(theModule => {
          console.log("[IngestWorker.init] ingest.wasm successfully loaded");
          this.ingest_module = theModule;
          this.init_pending = false;
          this.send({id: msg.id, data: "init_ok"});
        });
      } else {
        throw "Worker already initialized";
      }
    } catch (error) {
      this.process_error(msg, error);
      return;
    }
  }

  send(msg, transfer) {
    console.debug("[IngestWorker] Reply '" + (msg.data ? msg.data : msg.error) + "'");
    self.postMessage(msg, transfer);
  }

  process(msg) {
    console.debug("[IngestWorker] Received '" + msg.cmd + (msg.method ? " " + msg.method : "") + "'");
    switch (msg.cmd) {
      case "init": {
        this.init(msg);
        break;
      }
      case "call_method": {
        if (!this.ingest_module) {
          this.process_error(msg, "[IngestWorker.process] Can't call method " + msg.method + ": worker is not initialized");
        } else {
          this.process_method_call(msg);
        }
        break;
      }
    }
  }

  process_error(msg, error) {
    this.send({
      id: msg.id,
      error: error_to_json(error)
    });
  }

  process_subscribe(msg) {
    try {
      let callback;
      if (msg.method.slice(0, 2) === "on") {
        callback = ev => {
          const result = {
            id: msg.id,
            data: ev
          };
          //try {
          // post transferable data for arrow
          //if (msg.args && msg.args[0]) {
          //if (msg.method === "on_update" && msg.args[0]["mode"] === "row") {
          //this.post(result, [ev]);
          //return;
          //}
          //}

          //this.post(result);
          //} catch (e) {
          //console.error("Removing callback after failed on_update() (presumably due to closed connection)");
          //obj["remove_update"](callback);
          //}
        };
        if (msg.callback_id) {
          this._callback_cache.set(msg.callback_id, callback);
        }
      } else if (msg.callback_id) {
        callback = this._callback_cache.get(msg.callback_id);
        this._callback_cache.delete(msg.callback_id);
      }
      if (callback) {
        this[msg.method](callback, ...msg.args);
      } else {
        console.error(`Callback not found for remote call "${msg}"`);
      }
    } catch (error) {
      this.process_error(msg, error);
      return;
    }
  }

  process_method_call_response(msg, result) {
    if (msg.method === "convert_file") {
      this.send(
          {
            id: msg.id,
            data: result // {name1: buffer1, name2: buffer2, ...}
          },
          //[result]
          [result] //[buffer1, buffer2, ...]
      );
    } else {
      this.send({
        id: msg.id,
        data: result
      });
    }
  }

  process_method_call(msg) {
    let result;

    try {
      if (msg.subscribe) {
        this.process_subscribe(msg, this);
        return;
      } else {
        if (msg.method === "convert_file") {
          if (!msg.args) {
            msg.args = [undefined];
          }
          msg.args.push(msg.selected_files || []);
          msg.args.push(msg.sheet);
          msg.args.push(msg.ext);
          msg.args.push(msg.id);
        } else if (msg.method === "probe_file" || msg.method === "probe_compress") {
          msg.args.push(msg.ext);
          msg.args.push(msg.selected_files || []);
        }
        result = this[msg.method].apply(this, msg.args);
        if (result instanceof Promise) {
          result.then(result => this.process_method_call_response(msg, result)).catch(error => this.process_error(msg, error));
        } else {
          this.process_method_call_response(msg, result);
        }
      }
    } catch (error) {
      this.process_error(msg, error);
      return;
    }
  }
}

export default new IngestWorker(load_ingest_module_func);
