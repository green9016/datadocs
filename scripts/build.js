/******************************************************************************
 *
 * Copyright (c) 2017, the Perspective Authors.
 *
 * This file is part of the Perspective library, distributed under the terms of
 * the Apache License 2.0.  The full license can be found in the LICENSE file.
 *
 */

const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const prettier = require("prettier");
const execSync = require("child_process").execSync;
const argv = require("minimist")(process.argv.slice(2));
const minimatch = require("minimatch");
const os = require("os");

const execute = cmd => execSync(cmd, {stdio: "inherit"});

const templateSource = source => `
var window = window || {};

exports.load_perspective = function (Module) {
    ${source};
    return Module;
};`;

/**
 * ASMJS Output Options
 */
// GAB Note Nov 19: disabled asm.js version of perspective
//
// const WEB_ASMJS_OPTIONS = {
//   inputFile: "psp.asmjs.js",
//   format: false,
//   packageName: "perspective",
//   template: templateSource,
//   build: !!argv.asmjs // should we build asm?
// };

/**
 * WASM Output Options
 */
const WEB_WASM_OPTIONS = {
  inputFile: "psp.async.js",
  inputWasmFile: "psp.async.wasm",
  format: false,
  packageName: "perspective",
  template: templateSource,
  build: !!argv.wasm // flag as to whether to build
};

/**
 * Node.JS Output Options
 */
// GAB Note Nov 19: disabled sync Node.js version of perspective
//
// const NODE_OPTIONS = {
//   inputFile: "psp.sync.js",
//   inputWasmFile: "psp.sync.wasm",
//   format: false,
//   packageName: "perspective",
//   template: templateSource,
//   build: !!argv.node // flag as to whether to build the node version
// };

/**
 * Filter for the runtimes we should build
 */
const AVAILABLE_RUNTIMES = [WEB_WASM_OPTIONS]; //, NODE_OPTIONS];

// GAB Note Nov 19: disabled asm.js version of perspective
//
// if (!process.env.PSP_DEBUG) {
//   AVAILABLE_RUNTIMES.push(WEB_ASMJS_OPTIONS);
// }

// Select the runtimes - if no builds are specified then build everything
const RUNTIMES = AVAILABLE_RUNTIMES.filter(runtime => runtime.build).length ? AVAILABLE_RUNTIMES.filter(runtime => runtime.build) : AVAILABLE_RUNTIMES;

// GAB Ingest Runtimes
const INGEST_WASM_OPTIONS = {
  inputFile: "emingest.js",
  inputWasmFile: "emingest.wasm",
  inputDataFile: "emingest.data",
  format: false,
  packageName: "ingest",
  build: !!argv.wasm // flag as to whether to build
};
const AVAILABLE_RUNTIMES_INGEST = [INGEST_WASM_OPTIONS];
const INGEST_RUNTIMES = AVAILABLE_RUNTIMES.filter(runtime => runtime.build).length ? AVAILABLE_RUNTIMES_INGEST.filter(runtime => runtime.build) : AVAILABLE_RUNTIMES_INGEST;

// Directory of Emscripten output
const getBaseDir = packageName => path.join(__dirname, "..", "cpp", packageName, "obj");
const getBuildDir = packageName => path.join(getBaseDir(packageName), "build");
const getOuputDir = packageName => path.join(__dirname, "..", "packages", packageName);

function compileRuntime({inputFile, inputWasmFile, inputDataFile, format, packageName, template}) {
  console.log("-- Building %s", inputFile);

  const OUTPUT_DIRECTORY = getOuputDir(packageName);
  const BUILD_DIRECTORY = getBuildDir(packageName);

  mkdirp.sync(path.join(OUTPUT_DIRECTORY, "obj"));
  mkdirp.sync(path.join(OUTPUT_DIRECTORY, "build"));

  if (inputWasmFile) {
    console.log("-- Copying WASM file %s", inputWasmFile);
    fs.copyFileSync(path.join(BUILD_DIRECTORY, inputWasmFile), path.join(OUTPUT_DIRECTORY, "build", inputWasmFile));
  }
  if (inputDataFile) {
    console.log("-- Copying DATA file %s", inputDataFile);
    fs.copyFileSync(path.join(BUILD_DIRECTORY, inputDataFile), path.join(OUTPUT_DIRECTORY, "build", inputDataFile));
  }

  console.debug("-- Creating wrapped js runtime");
  const runtimeText = String(
    fs.readFileSync(path.join(BUILD_DIRECTORY, inputFile), {
      encoding: "utf8"
    })
  );

  let source;
  if (template !== undefined) {
    source = template(runtimeText);
    if (format) {
      console.debug("Formatting code");
      source = prettier.format(source, {
        printWidth: 200,
        tabWidth: 4,
        parser: "babylon"
      });
    }
  } else {
    source = runtimeText;
  }

  fs.writeFileSync(path.join(OUTPUT_DIRECTORY, "obj", inputFile), source);
}

function docker(image = "emsdk") {
  try {
    console.log("-- Checking emsdk docker image");
    execSync(`docker inspect datadocs/${image}`);
  } catch(e) {
    console.log("-- Image not existing --> Creating emsdk docker image");
    execute(`docker build -t datadocs/${image} docker/${image}`);
  }
  let cmd = "docker run --rm -it";
  if (process.env.PSP_CPU_COUNT) {
    cmd += ` --cpus="${parseInt(process.env.PSP_CPU_COUNT)}.0"`;
  }
  cmd += ` -v ${process.cwd()}:/src -e PACKAGE=${process.env.PACKAGE} datadocs/${image}`;
  return cmd;
}

function compileCPP(packageName, target=undefined) {
  const BASE_DIRECTORY = getBaseDir(packageName);
  let cmd = `emcmake cmake ../ `;
  if (process.env.PSP_DEBUG) {
    cmd += `-DCMAKE_BUILD_TYPE=Debug `;
  } else {
    cmd += `-DCMAKE_BUILD_TYPE=Release `;
  }
  if (process.env.PSP_DOCKER) {
    cmd += `-DVENDOR_BOOST=OFF `
  }
  if (process.env.PSP_WASM_PROFILING == 1) {
    cmd += `-DPSP_WASM_PROFILING=ON `
  }
  else {
    cmd += `-DPSP_WASM_PROFILING=OFF `
  }
  if (process.env.PSP_WASM_MEMORY_DEBUG == 1) {
    cmd += `-DPSP_WASM_MEMORY_DEBUG=ON `
  }
  else {
    cmd += `-DPSP_WASM_MEMORY_DEBUG=OFF `
  }
  cmd += `&& emmake make -j${process.env.PSP_CPU_COUNT || os.cpus().length}`;
  if (target) {
    cmd += ` ${target}`
  }
  if (process.env.PSP_DOCKER) {
    cmd = `${docker()} bash -c "cd cpp/${packageName}/obj && ${cmd}"`;
  } else {
    cmd = `cd ${BASE_DIRECTORY} && ${cmd}`;
  }
  execute(cmd);
}

function lerna() {
  let cmd = `lerna run build --loglevel silent --stream `;
  if (process.env.PACKAGE) {
    cmd += `--scope=@jpmorganchase/${process.env.PACKAGE} `;
  }
  execute(cmd);
}

try {
  if (!process.env.PACKAGE || minimatch("perspective", process.env.PACKAGE)) {
    mkdirp("cpp/perspective/obj");
    compileCPP("perspective");
    RUNTIMES.map(compileRuntime);
  }

  // GAB Aslo build ingest
  if (!process.env.PACKAGE || minimatch("ingest", process.env.PACKAGE)) {
    mkdirp("cpp/ingest/obj");
    compileCPP("ingest", "emingest");
    INGEST_RUNTIMES.map(compileRuntime);
  }

  lerna();
} catch (e) {
  console.log(e.message);
  process.exit(1);
}
