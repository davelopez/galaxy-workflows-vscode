import * as fs from "fs";
import * as path from "path";
import * as Mocha from "mocha";

function findE2eTests(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return findE2eTests(entryPath);
      }
      return entry.isFile() && entry.name.endsWith(".e2e.js") ? [entryPath] : [];
    })
    .sort();
}

export function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
    timeout: 60000,
    inlineDiffs: true,
  });

  const testsRoot = path.resolve(__dirname, "..");

  return new Promise((c, e) => {
    try {
      // Add files to the test suite
      findE2eTests(testsRoot).forEach((f) => mocha.addFile(f));

      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          e(new Error(`${failures} tests failed.`));
        } else {
          c();
        }
      });
    } catch (err) {
      e(err);
    }
  });
}
