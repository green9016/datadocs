//
// Created by gab on 16/12/19
//

// Be sure to have loaded ingest.js first, it should have defined the 'emingest' function
// This should be done by loader.js

class Ingest {
  static async CreateInstance() {
    const ingest_wasm_module_access_func = await new Promise((resolve, reject) => {
      console.debug("async initialization of ingest module");
      emingest({
        printErr: (txt) => console.error(txt),
        print: (txt) => console.log(txt),
      }).then((module) => {
        console.debug("ingest wasm module successfully initialized");
        // Resolve to a function returning the module, and NOT the module itself (otherwise there is some issues with await as
        // the module have a .then() method)
        resolve(() => {
          return module
        });
      })
    });
    return new Ingest(ingest_wasm_module_access_func());
  }

  constructor(module) {
    this.wasm_module = module;
  }

  convert(filename, file) {
    this.wasm_module.FS_writeFile(filename, new Uint8Array(file), {canOwn: true}); // canOwn: true is critical here, to prevent doing a copy!!

    this.wasm_module.printMemoryReport();
    let table = new this.wasm_module.Table();
    if (this.wasm_module.convert_file(filename, table, (p) => {
      console.debug("Progress:", p)
    }) == 0) {
      table.dump();
      this.wasm_module.printMemoryReport();
    }

    table.delete();

    this.wasm_module.FS_unlink(filename);
  }
}

async function do_test() {
  // Asynchronously create an instance of Ingest class => this is a promise that will be resolved once wasm have been initialized
  const ingest_promise = Ingest.CreateInstance();

  // Asynchronously fetch the file given in the URL
  let filename = window.location.hash.substr(1);
  if (filename) {
    let resolve_func, reject_func;
    const load_file_promise = new Promise((resolve, reject) => {
      resolve_func = resolve;
      reject_func = reject;
    });
    console.log("Fetching file " + filename + " as ArrayBuffer");
    let t0 = performance.now();
    const url = "./" + filename;
    const xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";
    xhr.open("GET", url, true);
    xhr.onload = function () {
      console.log("[] Fetching completed. Calling convert_file(xhr.response)");
      resolve_func(xhr.response);
    };
    xhr.onerror = function () {
      reject_func(undefined);
    };
    xhr.send(null);

    // Wait for both file and ingest promises to be settled
    const [file, ingest] = await Promise.all([load_file_promise, ingest_promise]);

    // Start the conversion once everybody is ready
    ingest.convert(filename, file);
  }
}

do_test();
