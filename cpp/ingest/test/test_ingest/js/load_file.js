if (Module['postRun'] instanceof Array) {
  Module['postRun'].push(load_file);
} else {
  Module['postRun'] = [load_file];
}

function load_file() {
  let filename = window.location.hash.substr(1);
  if (filename) {
    let resolve_func, reject_func;
    const load_file_promise = new Promise((resolve, reject) => {
      resolve_func = resolve;
      reject_func = reject;
    });
    Module.setStatus("Downloading data file");
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

    load_file_promise.then((result) => {
      Module['FS_writeFile'](filename, new Uint8Array(result), {canOwn: true}); // canOwn: true is critical here, to prevent doing a copy!!
      Module.setStatus("Running");
      Module.callMain([filename]);
      Module['FS_unlink'](filename);
      Module.setStatus("Done");
    })
  }
  else {
    Module.callMain();
  }
}
