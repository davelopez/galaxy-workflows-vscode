# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.3.1] - 2023-10-01

### Changed

- Only workflow files with the extension `.gxwf.yml` will be considered Galaxy Workflows in VSCode [#61](https://github.com/davelopez/galaxy-workflows-vscode/pull/61)

### Removed

- Temporarily disable clean diff comparisons in Timeline [#59](https://github.com/davelopez/galaxy-workflows-vscode/pull/59)

## [0.3.0] - 2022-10-15

### Added

- Multi-language server support [#48](https://github.com/davelopez/galaxy-workflows-vscode/pull/48)
- Basic YAML language service implementation [#50](https://github.com/davelopez/galaxy-workflows-vscode/pull/50)
- Basic gxformat2 schema support for validation, documentation on hover and intellisense [#52](https://github.com/davelopez/galaxy-workflows-vscode/pull/52)

## [0.2.0] - 2022-06-10

### Added

- Support custom validators [#35](https://github.com/davelopez/galaxy-workflows-vscode/pull/35)
- Configuration setting for _cleanable_ properties [#40](https://github.com/davelopez/galaxy-workflows-vscode/pull/40)
- Custom Validation Rule: `workflow_outputs` must have a label [#44](https://github.com/davelopez/galaxy-workflows-vscode/pull/44)
- Configuration setting for _Validation Profiles_ [#46](https://github.com/davelopez/galaxy-workflows-vscode/pull/46)

### Fixed

- Fix `clean workflow command` issue with trailing commas [#39](https://github.com/davelopez/galaxy-workflows-vscode/pull/39)

## [0.1.0] - 2022-05-04

### Added

- Basic syntax highlighting and language configuration for `gxformat2` workflows in YAML.
- Basic schema for native workflows (.ga).
- Support schema-based code completion (IntelliSense) for native workflows (.ga).
- Support schema-based documentation on hover for native workflows (.ga).
- Basic JSON schema-based validation for native workflows (.ga).
- `Cleanup workflow` and `Preview Clean Workflow` commands for native workflows (.ga).
- Simplified workflow diffs in local repositories for native workflows (.ga).
- Custom Outline for native workflows (.ga).
- Syntax highlighting and grammars (based on JSON) for native workflows (.ga).
