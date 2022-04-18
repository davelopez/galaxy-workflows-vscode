# Galaxy Workflows VSCode Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)
![GitHub release (latest SemVer)](https://img.shields.io/badge/release-unreleased-orange)

VSCode extension to assist in editing [Galaxy Workflow](https://galaxyproject.org/) files while enforcing [best practices](https://planemo.readthedocs.io/en/latest/best_practices_workflows.html) for maintaining them.

The extension can be installed either locally, or in a web context, like [github.dev](https://github.dev) or [vscode.dev](https://vscode.dev). The aim is to support the maximum number of features in both modes but the web mode may have some limitations.

Although the initial version of the extension is focused on supporting the current **Galaxy Workflow _native_** format (documents with **.ga** extension), the idea is to include support for the next format called **Format 2** (also known as [gxformat2](https://github.com/galaxyproject/gxformat2)) in the near future.

## Features

The following table shows all the implemented features and the current support for each workflow format.

| Feature                                                    | Native Workflows (.ga) | Format 2 Workflows (gxformat2) |
| ---------------------------------------------------------- | :--------------------: | :----------------------------: |
| [Validation](#workflow-validation)                         |           ✔️           |               ❌               |
| [Documentation on Hover](#documentation-on-hover)          |           ✔️           |               ❌               |
| [IntelliSense](#intellisense)                              |           ✔️           |               ❌               |
| [Formatting](#formatting)                                  |           ✔️           |               ❌               |
| [Custom Outline](#custom-outline)                          |           ✔️           |               ❌               |
| [Workflow Cleanup Command](#workflow-cleanup-command)      |           ✔️           |               ❌               |
| [Simplified Workflow Diffs](#simplified-workflow-diffs) \* |           ✔️           |               ❌               |

(\*) This feature is not supported in _Web_ mode or _Virtual File Systems_.

### Workflow Validation

You will get diagnostics for every syntax error or incorrect property value as you type so you can fix them right away.

![Workflow Validation Demo](images/validation-native.gif)

[Back to Features ⬆️](#features)

### Documentation on Hover

Hover over properties to get a description of what they are and how can you use them. The documentation displayed is based on the Workflow schema annotations, if you think you need more details or something is off, please help us improve the schema [here](https://github.com/davelopez/galaxy-workflows-vscode/tree/main/workflow-languages/schemas)!

![Documentation on Hover Demo](images/doc-hover-native.gif)

[Back to Features ⬆️](#features)

### IntelliSense

Get [IntelliSense](https://code.visualstudio.com/docs/editor/intellisense#:~:text=IntelliSense%20is%20a%20general%20term,%2C%20and%20%22code%20hinting.%22) suggestions depending on your cursor context. Remember that you can manually trigger the suggestions at your current cursor position using `Ctrl+Space`.

![IntelliSense Demo](images/intellisense-native.gif)

[Back to Features ⬆️](#features)

### Formatting

Keep your workflow document consistently formatted. We recommend enabling your VSCode setting to `Format on Save` so you don't have to manually format after the changes.

![Auto Formatting Demo](images/format-document-native.gif)

[Back to Features ⬆️](#features)

### Custom Outline

The `Custom Outline` allows you to navigate and find different parts of the Workflow faster using the Outline panel or the [Breadcrumbs](https://code.visualstudio.com/docs/editor/editingevolved#_breadcrumbs). The Outline representation has been enhanced, in comparison to the standard JSON Outline, by displaying relevant information more prominently (like using the workflow step name instead of the index on step nodes) or hiding non-essential nodes.

![Custom Outline Demo](images/custom-outline-native.gif)

[Back to Features ⬆️](#features)

### Workflow Cleanup Command

You can clean up the non-essential properties of a workflow with this command. These properties are usually related to the display of the workflow in the editor and are not part of the workflow semantics. This command will remove those properties from the document, but you can also use the `Preview clean workflow` command, which will show you a preview of the clean workflow instead of making the changes to the original.

![Cleanup Command Demo](images/clean-up-command-native.gif)

[Back to Features ⬆️](#features)

### Simplified Workflow Diffs

> ⚠️ This feature is experimental and is only available using a local git repository.

Sometimes you want to compare different revisions of the same workflow and see what has changed between them. If the workflow has been through the Galaxy editor or some of the nodes have been moved around, there can be many changes that are just cosmetical and not part of the workflow logic. In those cases, you may want to get a 'simplified' diff so you can focus on the 'real' changes. You can do so in the `Timeline` or the `File Explorer` by using `Select workflow for (clean) compare` in one revision and then `Compare with this workflow (clean)` on the other revision, this will compare both revisions using the 'clean' version of the workflow (see the clean workflow command), meaning the non-essential parts are removed from them before the comparison.

![Simplified Workflow Diffs Demo](images/clean-diff-native.gif)

[Back to Features ⬆️](#features)

## Changelog

See the [full changelog here](docs/CHANGELOG.md).

## Contributing

✨ Contributors are welcome! ✨

Just make sure to read the [Contributing Guidelines](docs/CONTRIBUTING.md) 😉
