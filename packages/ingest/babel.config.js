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
          samsung: "7.4"
        },
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
    ]
  ]
};
