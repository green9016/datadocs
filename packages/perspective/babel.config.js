module.exports = {
    presets: [
        [
            "@babel/preset-env",
            {
                // GAB: minimum versions supporting WebAssembly + ES6/2015
                targets: {
                    chrome: 57,
                    edge: 16,
                    firefox: 54,
                    safari: 11,
                    opera: 44,
                    ios: "11.2",
                    samsung: "7.4",
                    node: "8.16"
                },
                useBuiltIns: "usage",
                corejs: 2
            }
        ]
    ],
    sourceType: "unambiguous",
    plugins: [
        ["@babel/plugin-proposal-decorators", {legacy: true}],
        "transform-custom-element-classes",
        [
            "@babel/plugin-transform-for-of",
            {
                loose: true
            }
        ],
        ["@babel/plugin-transform-async-to-generator"]   // GAB: Needed because of issues with async functions in Node.js not processed by Babel
    ]
};
