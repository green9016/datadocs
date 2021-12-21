import {threads, simd, bigInt} from "wasm-feature-detect"

class IngestClient {

  static async init_ingest_client() {
    if (await threads()) {
      console.info("Multithreading supported in current Browser")
      // Need to instanciate the MT enabled Ingest.
      // !!! But for now, let's use the Worker based Ingest as MT is not ready
      return new IngestClient(new Worker("./ingest.worker.js"));
    } else if (typeof Worker === 'function') {
      return new IngestClient(new Worker("./ingest.worker.js"));
    } else {
      throw "No Multithreading or Workers supported by current browser";
    }
    // could also check for SIMD to enable SIMD-compatile Ingest, as well as BigInt (native int64 support in JS)
  }

  constructor(worker) {
    self.console.debug("[IngestClient] constructor()");

    this._worker = {
      initialized: false,
      transferable: false,
      msg_id: 0,
      handlers: {},
      messages: [],
      theworker: worker
    };

    this._worker.theworker.addEventListener("message", e => this._handle(e.data));

    self.console.debug("[IngestClient.constructor] starting asynchronous init()");
    this.init_promise = this.init();
  }

  async init() {
    self.console.debug("[IngestClient] async init()");
    self.console.debug("[IngestClient.init] asynchronous RPC method call to Worker.init(). Awaiting...");
    await new Promise((resolve, reject) => {
      let msg = {
        cmd: "init"
      };
      this.post(msg, resolve, reject);
    });
    self.console.debug("[IngestClient.init] RPC method call 'init' completed. Resuming.");
    this._worker.initialized = true;
  }

  async convert_file(file, selected_files = [], sheet_name = undefined, percentage_callback = null, extension = undefined) {
    self.console.log("[IngestClient] async convert_file(" + file + ")");
    if (!this._worker.initialized) {
      self.console.debug("[IngestClient.convert_file] init() not yet completed. Awaiting...");
      await this.init_promise;
      self.console.debug("[IngestClient.convert_file] init() completed. Resuming.");
    }
    self.console.debug("[IngestClient.convert_file] RPC method call to Worker.convert_file(" + file + "). Awaiting...");
    let t0 = performance.now();
    let result = await new Promise((resolve, reject) => {
      var msg = {
        cmd: "call_method",
        method: "convert_file",
        selected_files: selected_files,
        sheet: sheet_name,
        ext: extension
      };
      if (file) {
        msg['args'] = [file];
      }

      this.post(msg, resolve, reject, false, percentage_callback);
    });
    let t1 = performance.now();
    console.log("[IngestClient.convert_file] PCS: " + (t1 - t0) + " milliseconds.");
    self.console.debug("[IngestClient.convert_file] RPC method call 'convert_file' completed. Resuming.");

    return result;
  }

  async probe_file(file, extension = undefined, selected_files = []) {
    if (!this._worker.initialized) {
      self.console.debug("[IngestClient.convert_file] init() not yet completed. Awaiting...");
      await this.init_promise;
      self.console.debug("[IngestClient.convert_file] init() completed. Resuming.");
    }
    let result = await new Promise((resolve, reject) => {
      let msg = {
        cmd: "call_method",
        method: "probe_file",
        args: [file],
        ext: extension,
        selected_files: selected_files
      };
      this.post(msg, resolve, reject);
    });

    return result;
  } 

  async probe_compress(file, extension = undefined, selected_files = []) {
    if (!this._worker.initialized) {
      self.console.debug("[IngestClient.convert_file] init() not yet completed. Awaiting...");
      await this.init_promise;
      self.console.debug("[IngestClient.convert_file] init() completed. Resuming.");
    }
    let result = await new Promise((resolve, reject) => {
      let msg = {
        cmd: "call_method",
        method: "probe_compress",
        args: [file],
        ext: extension,
        selected_files: selected_files
      };
      this.post(msg, resolve, reject);
    });
    return result;
  }

  async get_coumn_types() {
    if (!this._worker.initialized) {
      await this.init_promise;
    }
    let result = await new Promise((resolve, reject) => {
      let msg = {
        cmd: "call_method",
        method: "get_coumn_types"
      };

      this.post(msg, resolve, reject);
    });

    return result;
  }

  async cancel_ingesting_data() {
    /*if (!this._worker.initialized) {
      await this.init_promise;
    }
    let result = await new Promise((resolve, reject) => {
      let msg = {
        cmd: "call_method",
        method: "cancel_ingesting_data"
      };

      this.post(msg, resolve, reject);
    });

    return result;*/
    for (var id in this._worker.handlers) {
      var handler = this._worker.handlers[id];
      if (handler) {
        handler.reject({code: 500, message: "Cancelled"});
      }
    }
    this.terminate();
    return true;
  }

  post(msg, resolve, reject, keep_alive = false, update_func = null) {
    if (resolve) {
      this._worker.handlers[++this._worker.msg_id] = {resolve, reject, keep_alive, update_func};
    }
    msg.id = this._worker.msg_id;
    this.send(msg);
  }

  send(msg) {
    self.console.debug("[IngestClient] Send '" + msg.cmd + (msg.method ? " " + msg.method : "") + "' to Worker");
    if (msg.args && msg.args[0] instanceof ArrayBuffer) {
      this._worker.theworker.postMessage(msg, msg.args);
    } else {
      this._worker.theworker.postMessage(msg);
    }
  }

  _handle(e) {
    self.console.debug("[IngestClient] Received '" + (e.data ? e.data : e.error) + "' from Worker");
    if (e.id) {
      var handler = this._worker.handlers[e.id];
      if (handler) {
        if (e.error) {
          handler.reject(e.error);
        } else if (e.update_func) {
          if (handler.update_func) {
            handler.update_func(e.data);
          }
        } else {
          handler.resolve(e.data);
        }
        if (!handler.keep_alive && !e.update_func) {
          delete this._worker.handlers[e.id];
        }
      }
    }
  }

  terminate() {
    this._worker.theworker.terminate();
    this._worker.theworker = undefined;
  }
}

export default IngestClient;
