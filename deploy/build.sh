if ! [ -a /usr/local/bin/uglifyjs ]; then
npm install -g uglify-js
fi

#uglifyjs hypergrid.plugin.js -cmo hypergrid.plugin.min.js

if ! [ -a /usr/local/bin/terser ]; then
npm install -g terser@4.6.6
fi

rm -rf deploy/build
mkdir -p deploy/build

terser packages/perspective-viewer/build/perspective.view.js -c -o deploy/build/perspective.view.js
terser packages/perspective-viewer-hypergrid/build/hypergrid.plugin.js -c -o deploy/build/hypergrid.plugin.js
terser packages/perspective-viewer-highcharts/build/highcharts.plugin.js -c -o deploy/build/highcharts.plugin.js

terser packages/perspective/build/perspective.wasm.worker.js -c -o deploy/build/perspective.wasm.worker.js
cp -r packages/perspective/build/psp.async.wasm deploy/build/psp.async.wasm

cp -r packages/perspective-viewer/build/material.css deploy/build/material.css
cp -r packages/perspective-viewer/build/material.dark.css deploy/build/material.dark.css

terser packages/ingest/build/ingest.worker.js -c -o deploy/build/ingest.worker.js
cp -r packages/ingest/build/emingest.wasm deploy/build/emingest.wasm
cp -r packages/ingest/build/emingest.data deploy/build/emingest.data

cp -r examples/datadocs/* deploy/build/
cp -r examples/datadocs/.htaccess deploy/build/.htaccess
