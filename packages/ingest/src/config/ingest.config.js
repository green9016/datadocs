const path = require("path");

module.exports = Object.assign({}, {}, {
  entry: "./cjs/js/worker/ingest.worker.js",
  output: {
    filename: "ingest.worker.js",
    libraryTarget: "umd",
    path: path.resolve(__dirname, "../../build"),
    globalObject: "self",
  },
  mode: 'production',
  performance: { hints: false }
});
