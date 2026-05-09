# Projects in this monorepo

This monorepo uses [_pnpm Workspaces_](https://pnpm.io/workspaces) and contains both language servers for Galaxy workflows, `gxformat2` and `native (legacy)` along with some local dependencies.

To install dependencies in any contained project, run `pnpm add` in this root directory with the `--filter` parameter for the target workspace. For example to install a new dependency called `my-dep` for the `gxformat2 language server` you should use:

```
pnpm --filter gx-workflow-ls-format2 add my-dep
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
