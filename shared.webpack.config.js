/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

//@ts-check
"use strict";

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require("path");
const merge = require("merge-options");

module.exports = function withDefaults(/**@type WebpackConfig*/ extConfig) {
  /** @type WebpackConfig */
  let defaultConfig = {
    mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
    target: "node", // extensions run in node context
    node: {
      __dirname: false, // leave the __dirname-behaviour intact
    },
    resolve: {
      mainFields: ["module", "main"],
      extensions: [".ts", ".js"], // support ts-files and js-files
      fallback: {
        path: require.resolve("path-browserify"),
      },
      alias: {
        "@schemas": path.resolve(__dirname, "./workflow-languages/schemas/"),
      },
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "ts-loader",
              options: {
                compilerOptions: {
                  sourceMap: true,
                  paths: {
                    "@schemas": [path.resolve(__dirname, "./workflow-languages/schemas/")],
                  },
                },
              },
            },
          ],
        },
        {
          test: /\.ya?ml$/,
          use: "yaml-loader",
        },
      ],
    },
    externals: {
      vscode: "commonjs vscode",
    },
    output: {
      filename: "[name].js",
      path: path.join(extConfig.context, "dist"),
      libraryTarget: "commonjs",
    },
    devtool: "source-map",
  };

  return merge(defaultConfig, extConfig);
};
