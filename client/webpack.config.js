/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

//@ts-check
("use strict");

const withDefaults = require("../shared.webpack.config");
const path = require("path");

/** @type WebpackConfig */
const nodeExtensionConfig = withDefaults({
  context: path.join(__dirname),
  mode: "none",
  target: "node", // regular extensions run in a node context
  entry: {
    extension: "./src/extension.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "dist"),
    libraryTarget: "commonjs",
  },
});

/** @type WebpackConfig */
const webExtensionConfig = withDefaults({
  context: path.join(__dirname),
  mode: "none",
  target: "webworker", // web extensions run in a webworker context
  entry: {
    extension: "./src/browser/extension.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "dist", "web"),
    libraryTarget: "commonjs",
  },
});

module.exports = [nodeExtensionConfig, webExtensionConfig];
