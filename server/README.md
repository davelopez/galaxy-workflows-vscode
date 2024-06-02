# Projects in this monorepo

This monorepo uses [_NPM Workspaces_](https://docs.npmjs.com/cli/v8/using-npm/workspaces) and contains both language servers for Galaxy workflows, `gxformat2` and `native (legacy)` along with some local dependencies.

To install dependencies in any of the contained projects you need run the `npm install` command in this root directory and provide the `-w` parameter with the name of the target workspace. For example to install a new dependency called `my-dep` for the `gxformat2 language server` you should use:

```
npm install my-dep -w gx-workflow-ls-format2
```

## Galaxy Workflow Language Servers

### gx-workflow-ls-format2

This project contains the [LSP](https://microsoft.github.io/language-server-protocol/) implementation for the [gxformat2](https://github.com/galaxyproject/gxformat2) Galaxy workflow format in YAML.

### gx-workflow-ls-format2

This project contains the [LSP](https://microsoft.github.io/language-server-protocol/) implementation for the legacy native (.ga) Galaxy workflow format in JSON.

## Packages

### packages/server-common

This library contains common classes, interfaces and type definitions used by both language server implementations.

### packages/yaml-language-service

This library implements a language service to provide basic _smarts_ for YAML documents. It is based and inspired by both the [YAML Language Server](https://github.com/redhat-developer/yaml-language-server) implementation from Red Hat and the [vscode-json-languageservice](https://github.com/microsoft/vscode-json-languageservice) by Microsoft.

### packages/workflow-tests-language-service

This library implements a language service to provide basic _smarts_ for **Galaxy workflow test documents**. This library is used by the `gxformat2` language server to provide autocompletion, validation and hover information for test documents.
