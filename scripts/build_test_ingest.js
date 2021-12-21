const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const argv = require("minimist")(process.argv.slice(2));
const os = require("os");
const execute = cmd => execSync(cmd, {stdio: "inherit"});
const execSync = require("child_process").execSync;

mkdirp("cpp/ingest/obj");
try {
  console.log("-- Checking emsdk docker image");
  execSync(`docker inspect datadocs/emsdk`);
} catch(e) {
  console.log("-- Image not existing --> Creating emsdk docker image");
  execute(`docker build -t datadocs/emsdk docker/emsdk`);
}
let cmd = `docker run --rm -it -v "${process.cwd()}":/src datadocs/emsdk`;
cmd += ' bash -c "cd cpp/ingest/obj && emcmake cmake .. -DCMAKE_BUILD_TYPE=Release && emmake make test_ingest"';
execute(cmd);
