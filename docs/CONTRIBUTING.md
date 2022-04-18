# Contributing

First off, thanks for taking the time to contribute! 🚀🎉👍

When contributing to this project, please first discuss the changes you wish to make via an [issue](https://github.com/davelopez/galaxy-workflows-vscode/issues) before creating a pull request.

Please note that when participating or interacting with this project you must follow the [Galaxy Project Code of Conduct](https://galaxyproject.org/community/coc/).

## Your First Code Contribution

Unsure where to begin contributing? You can start by looking through the [`good first issue`](https://github.com/davelopez/galaxy-workflows-vscode/labels/good%20first%20issue) or [`help wanted`](https://github.com/davelopez/galaxy-workflows-vscode/labels/help%20wanted) issues.

You can also try to fix a [`paper-cut`](https://github.com/davelopez/galaxy-workflows-vscode/labels/paper-cut) which are trivially fixable usability bugs or easy enhancements.

### Prerequisites

- [Git](https://git-scm.com/)
- [NodeJS](https://nodejs.org/)
- [Visual Studio Code](https://code.visualstudio.com/)

### Getting the code

1. Fork this repo on Github
2. Clone your fork locally:
   ```sh
   git clone https://github.com/<your_github_name>/galaxy-workflows-vscode.git
   ```

### Dependencies

From a terminal, where you have cloned the repository, execute the following command to install the required dependencies:

```
npm install
```

### Build

From a terminal, where you have cloned the repository, execute the following command to re-build the project from scratch:

```
npm run compile
```

### Launch/Debug the extension

Run the `Launch Extension` configuration from the `Run and Debug` action bar (or press F5).

If you want to debug the _Workflow Language Server_, select and run the `Attach to Server` configuration when the extension is already running.

### Test the extension on [vscode.dev](https://vscode.dev/)

After you get your extension working locally, follow the [instructions here](https://code.visualstudio.com/api/extension-guides/web-extensions#test-your-web-extension-in-on-vscode.dev) to try it in _Web_ mode.
