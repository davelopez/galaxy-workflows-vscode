# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.5.0] - 2024-06-22

### Added

- Add validation rule to IWC profile to check all steps are documented [#79](https://github.com/davelopez/galaxy-workflows-vscode/pull/79)
- Handle union types in Format2 Schema [#76](https://github.com/davelopez/galaxy-workflows-vscode/pull/76)

### Changed

- Improve validation profiles [#71](https://github.com/davelopez/galaxy-workflows-vscode/pull/71)
- Improve symbols provider [#70](https://github.com/davelopez/galaxy-workflows-vscode/pull/70)
- Improve document detection [#69](https://github.com/davelopez/galaxy-workflows-vscode/pull/69)

### Fixed

- Fix some completion edge cases in Format2 [#78](https://github.com/davelopez/galaxy-workflows-vscode/pull/78)
- Ignore auto-complete suggestions for some schema elements in Format2 [#77](https://github.com/davelopez/galaxy-workflows-vscode/pull/77)
- Fix Format2 validation for Any type [#75](https://github.com/davelopez/galaxy-workflows-vscode/pull/75)
- Fix Format2 compatible primitive types validation [#74](https://github.com/davelopez/galaxy-workflows-vscode/pull/74)
- Fix duplicated document cache on remote GitHub repositories [#73](https://github.com/davelopez/galaxy-workflows-vscode/pull/73)
- Fix step export error validation rule [#72](https://github.com/davelopez/galaxy-workflows-vscode/pull/72)

## [0.4.0] - 2024-06-02

### Added

- Add basic support for Workflow Test Files (`*-test.yml`) [#63](https://github.com/davelopez/galaxy-workflows-vscode/pull/63)

### Changed

- Improve gxFormat2 auto-completion support [#67](https://github.com/davelopez/galaxy-workflows-vscode/pull/67)

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
