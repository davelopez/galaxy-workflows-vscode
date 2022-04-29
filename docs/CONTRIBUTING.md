# Contributing

First off, thanks for taking the time to contribute! 🚀🎉👍

When contributing to this project, please first discuss the changes you wish to make via an [issue](https://github.com/davelopez/galaxy-workflows-vscode/issues) before creating a pull request.

Please note that when participating or interacting with this project you must follow the [Galaxy Project Code of Conduct](https://galaxyproject.org/community/coc/).

## Your First Code Contribution

Unsure where to begin contributing? You can start by looking through the [`good first issue`](https://github.com/davelopez/galaxy-workflows-vscode/labels/good%20first%20issue) or [`help wanted`](https://github.com/davelopez/galaxy-workflows-vscode/labels/help%20wanted) issues.

You can also try to fix a [`paper-cut`](https://github.com/davelopez/galaxy-workflows-vscode/labels/paper-cut) which are trivially fixable usability bugs or easy enhancements.

When you decide what to contribute follow the steps below and then open a Pull Request to this repository.

Happy coding! 🎉

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

### Code Style

Once you are happy with your changes you can lint the code using:

```
npm run lint
```

or fix the formatting style using:

```
npm run format
```

If you have installed the recommended extensions in [extensions.json](../.vscode/extensions.json) the code style will be automatically enforced every time you save a file, so you probably won't need to run `npm run format`.

### Launch/Debug the extension locally

Run the `Launch Extension` configuration from the `Run and Debug` action bar (or press F5).

If you want to debug the _Workflow Language Server_, select and run the `Attach to Server` configuration when the extension is already running.

### Test the extension on [vscode.dev](https://vscode.dev/)

After you get your extension working locally, follow the [instructions here](https://code.visualstudio.com/api/extension-guides/web-extensions#test-your-web-extension-in-on-vscode.dev) to try it in _Web_ mode.

### Running the tests

You can run all the unit tests with:

```
npm test
```

Alternatively, you can choose to run only the [server](../server/tests/unit/) or the [client](../client/tests/unit/) tests using `npm run test-unit-server` or `npm run test-unit-client` respectively.

The [integration or end to end (e2e) tests](../client/tests/e2e/suite/) will download (the first time) and launch a testing version of VSCode and then run the tests on it. You can run these tests with:

```
npm run test:e2e
```
