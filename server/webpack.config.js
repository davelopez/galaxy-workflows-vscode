/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

//@ts-check
"use strict";

const withDefaults = require("../shared.webpack.config");
const path = require("path");

/** @type WebpackConfig */
const nodeServerConfig = withDefaults({
  mode: "none",
  context: path.join(__dirname),
  target: "node", // regular extensions run in node context
  entry: {
    nativeServer: "./src/nativeServer/node/server.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "dist"),
    libraryTarget: "var",
    library: "serverExportVar",
  },
});

/** @type WebpackConfig */
const browserServerConfig = withDefaults({
  mode: "none",
  context: path.join(__dirname),
  target: "webworker", // web extensions run in a webworker context
  entry: {
    nativeServer: "./src/nativeServer/browser/server.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "dist", "web"),
    libraryTarget: "var",
    library: "serverExportVar",
  },
});

module.exports = [nodeServerConfig, browserServerConfig];
