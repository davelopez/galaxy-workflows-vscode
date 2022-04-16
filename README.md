# Galaxy Workflows VSCode Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)
![GitHub release (latest SemVer)](https://img.shields.io/badge/release-unreleased-orange)

VSCode extension to assist in editing [Galaxy Workflow](https://galaxyproject.org/) files while enforcing [best practices](https://planemo.readthedocs.io/en/latest/best_practices_workflows.html) for maintaining them.

The initial version of the extension is focused on supporting the current **Galaxy Workflow _native_** format (documents with **.ga** extension) but the idea is to include support for the next format called **Format 2** (also known as [gxformat2](https://github.com/galaxyproject/gxformat2)) in the near future.

## Features

TBA

## Development

- Clone this repo (or your own fork) and open it in VSCode:
  ```sh
  git clone https://github.com/davelopez/galaxy-workflows-vscode.git
  cd galaxy-workflows-vscode
  code .
  ```
- Install dependencies:
  ```sh
  npm install
  ```
- Build
  ```sh
  npm run compile
  ```
- Run the `Launch Extension` configuration from the `Run and Debug` action bar (or press F5).
