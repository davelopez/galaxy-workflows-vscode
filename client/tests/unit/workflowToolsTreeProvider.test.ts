import { it } from "@jest/globals";

// Minimal VS Code stub — this file never loads real vscode in tests.
jest.mock(
  "vscode",
  () => {
    class EventEmitter<T> {
      private _listeners: Array<(e: T) => void> = [];
      event = (fn: (e: T) => void) => {
        this._listeners.push(fn);
        return { dispose: () => void 0 };
      };
      fire(e: T): void {
        for (const fn of this._listeners) fn(e);
      }
    }
    class ThemeIcon {
      constructor(public readonly id: string) {}
    }
    class MarkdownString {
      public value = "";
      public isTrusted = false;
      appendMarkdown(md: string): MarkdownString {
        this.value += md;
        return this;
      }
    }
    class TreeItem {
      description?: string;
      tooltip?: unknown;
      contextValue?: string;
      iconPath?: unknown;
      constructor(
        public readonly label: string,
        public readonly collapsibleState?: number
      ) {}
    }
    class Position {
      constructor(
        public readonly line: number,
        public readonly character: number
      ) {}
    }
    class Range {
      constructor(
        public readonly start: Position,
        public readonly end: Position
      ) {}
    }
    class Selection {
      constructor(
        public readonly start: Position,
        public readonly end: Position
      ) {}
    }
    const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 } as const;
    return {
      EventEmitter,
      ThemeIcon,
      MarkdownString,
      TreeItem,
      TreeItemCollapsibleState,
      Position,
      Range,
      Selection,
      Uri: { parse: (s: string) => ({ toString: () => s, path: s }) },
      env: { openExternal: jest.fn() },
      window: { activeTextEditor: undefined },
    };
  },
  { virtual: true }
);

// Mock out the language client import — we drive the provider via _setEntriesForTest.
jest.mock("vscode-languageclient", () => ({}), { virtual: true });

import { WorkflowToolsTreeProvider, WorkflowToolItem } from "../../src/providers/workflowToolsTreeProvider";
import type { WorkflowToolEntry } from "../../src/languageTypes";

const mkEntry = (overrides: Partial<WorkflowToolEntry> = {}): WorkflowToolEntry => ({
  stepId: "0",
  toolId: "toolshed.g2.bx.psu.edu/repos/devteam/bowtie2/bowtie2/2.4.4",
  toolVersion: "2.4.4",
  cached: true,
  resolutionFailed: false,
  name: "Bowtie2",
  description: "Map reads",
  toolshedUrl: "https://toolshed.g2.bx.psu.edu/view/devteam/bowtie2",
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
  ...overrides,
});

describe("WorkflowToolsTreeProvider", () => {
  function makeProvider(): WorkflowToolsTreeProvider {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new WorkflowToolsTreeProvider({} as any, {} as any);
  }

  it("produces one TreeItem per entry in the injected order", () => {
    const provider = makeProvider();
    provider._setEntriesForTest([
      mkEntry({ stepId: "0", name: "First" }),
      mkEntry({ stepId: "1", name: "Second", cached: false }),
    ]);
    const items = provider.getChildren();
    expect(items).toHaveLength(2);
    expect(items[0].label).toBe("First");
    expect(items[1].label).toBe("Second");
  });

  it("falls back to toolId when name missing", () => {
    const provider = makeProvider();
    provider._setEntriesForTest([mkEntry({ name: undefined, toolId: "Cut1" })]);
    const [item] = provider.getChildren() as WorkflowToolItem[];
    expect(item.label).toBe("Cut1");
  });

  it("chooses iconPath by state: cached → check, failed → error, uncached → info", () => {
    const provider = makeProvider();
    provider._setEntriesForTest([
      mkEntry({ cached: true, resolutionFailed: false }),
      mkEntry({ cached: false, resolutionFailed: true }),
      mkEntry({ cached: false, resolutionFailed: false }),
    ]);
    const items = provider.getChildren() as WorkflowToolItem[];
    expect((items[0].iconPath as { id: string }).id).toBe("check");
    expect((items[1].iconPath as { id: string }).id).toBe("error");
    expect((items[2].iconPath as { id: string }).id).toBe("info");
  });

  it("sets contextValue so view/item/context menus can scope themselves", () => {
    const provider = makeProvider();
    provider._setEntriesForTest([mkEntry()]);
    const [item] = provider.getChildren() as WorkflowToolItem[];
    expect(item.contextValue).toBe("workflowTool");
  });
});
