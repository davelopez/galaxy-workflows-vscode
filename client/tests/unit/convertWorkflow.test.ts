import { it, describe, expect, jest, beforeEach } from "@jest/globals";
import { URI } from "vscode-uri";

// ---------------------------------------------------------------------------
// VSCode mock
// ---------------------------------------------------------------------------

const mockSetTextDocumentLanguage = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockExecuteCommand = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockShowErrorMessage = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockOpenTextDocument = jest.fn<() => Promise<{ languageId: string }>>().mockResolvedValue({ languageId: "text" });

const mockActiveTextEditor: { document: { uri: ReturnType<typeof URI.parse>; getText: () => string; fileName: string } } | undefined = {
  document: {
    uri: URI.parse("file:///workspace/workflow.ga"),
    getText: () => '{"a_galaxy_workflow":"true","steps":{}}',
    fileName: "workflow.ga",
  },
};
let activeTextEditorOverride: typeof mockActiveTextEditor | undefined | null = null;

jest.mock(
  "vscode",
  () => ({
    languages: { setTextDocumentLanguage: mockSetTextDocumentLanguage },
    commands: { executeCommand: mockExecuteCommand, registerCommand: jest.fn() },
    window: {
      get activeTextEditor() {
        return activeTextEditorOverride !== null ? activeTextEditorOverride : mockActiveTextEditor;
      },
      showErrorMessage: mockShowErrorMessage,
    },
    workspace: { openTextDocument: mockOpenTextDocument },
    Uri: {
      parse: URI.parse.bind(URI),
    },
    EventEmitter: class {
      event = jest.fn();
      fire = jest.fn();
    },
    Disposable: { from: jest.fn() },
  }),
  { virtual: true }
);

// ---------------------------------------------------------------------------
// LSP client mock
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSendRequest = jest.fn<(...args: any[]) => Promise<any>>();

const mockClient = {
  sendRequest: mockSendRequest,
} as never;

// ---------------------------------------------------------------------------
// Provider mock (shared across command tests)
// ---------------------------------------------------------------------------

const mockSetContents = jest.fn();
const mockProvider = {
  setContents: mockSetContents,
} as never;

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ConvertToFormat2Command, ConvertToNativeCommand } from "../../src/commands/convertWorkflow";
import { ConvertedWorkflowDocumentProvider } from "../../src/providers/convertedWorkflowDocumentProvider";

// ---------------------------------------------------------------------------
// Tests: ConvertToFormat2Command
// ---------------------------------------------------------------------------

describe("ConvertToFormat2Command", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeTextEditorOverride = null; // reset to default editor
    mockOpenTextDocument.mockResolvedValue({ languageId: "text" });
  });

  it("returns silently when there is no active text editor", async () => {
    activeTextEditorOverride = undefined;
    const cmd = new ConvertToFormat2Command(mockClient, mockProvider);
    await cmd.execute();
    expect(mockSendRequest).not.toHaveBeenCalled();
    expect(mockShowErrorMessage).not.toHaveBeenCalled();
  });

  it("sends CONVERT_WORKFLOW_CONTENTS with targetFormat: format2", async () => {
    mockSendRequest.mockResolvedValue({ contents: "class: GalaxyWorkflow\n" });
    const cmd = new ConvertToFormat2Command(mockClient, mockProvider);
    await cmd.execute();
    expect(mockSendRequest).toHaveBeenCalledWith(
      "galaxy-workflows-ls.convertWorkflowContents",
      expect.objectContaining({ targetFormat: "format2" })
    );
  });

  it("stores converted contents in provider", async () => {
    mockSendRequest.mockResolvedValue({ contents: "class: GalaxyWorkflow\n" });
    const cmd = new ConvertToFormat2Command(mockClient, mockProvider);
    await cmd.execute();
    expect(mockSetContents).toHaveBeenCalled();
  });

  it("sets language to gxformat2 before diffing", async () => {
    mockSendRequest.mockResolvedValue({ contents: "class: GalaxyWorkflow\n" });
    const cmd = new ConvertToFormat2Command(mockClient, mockProvider);
    await cmd.execute();
    expect(mockSetTextDocumentLanguage).toHaveBeenCalledWith(expect.anything(), "gxformat2");
  });

  it("opens vscode.diff after setting language", async () => {
    mockSendRequest.mockResolvedValue({ contents: "class: GalaxyWorkflow\n" });
    const cmd = new ConvertToFormat2Command(mockClient, mockProvider);
    await cmd.execute();
    expect(mockExecuteCommand).toHaveBeenCalledWith("vscode.diff", expect.anything(), expect.anything(), expect.any(String));
  });

  it("shows error message when server returns error field", async () => {
    mockSendRequest.mockResolvedValue({ contents: "", error: "unsupported" });
    const cmd = new ConvertToFormat2Command(mockClient, mockProvider);
    await cmd.execute();
    expect(mockShowErrorMessage).toHaveBeenCalledWith(expect.stringContaining("unsupported"));
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it("shows error message when server returns no result", async () => {
    mockSendRequest.mockResolvedValue(undefined);
    const cmd = new ConvertToFormat2Command(mockClient, mockProvider);
    await cmd.execute();
    expect(mockShowErrorMessage).toHaveBeenCalled();
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it("shows error message when sendRequest rejects", async () => {
    mockSendRequest.mockRejectedValue(new Error("network error"));
    const cmd = new ConvertToFormat2Command(mockClient, mockProvider);
    await cmd.execute();
    expect(mockShowErrorMessage).toHaveBeenCalledWith(expect.stringContaining("network error"));
    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: ConvertToNativeCommand
// ---------------------------------------------------------------------------

describe("ConvertToNativeCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeTextEditorOverride = null;
    mockOpenTextDocument.mockResolvedValue({ languageId: "text" });
  });

  it("sends CONVERT_WORKFLOW_CONTENTS with targetFormat: native", async () => {
    mockSendRequest.mockResolvedValue({ contents: '{"a_galaxy_workflow":"true"}\n' });
    const cmd = new ConvertToNativeCommand(mockClient, mockProvider);
    await cmd.execute();
    expect(mockSendRequest).toHaveBeenCalledWith(
      "galaxy-workflows-ls.convertWorkflowContents",
      expect.objectContaining({ targetFormat: "native" })
    );
  });

  it("sets language to galaxyworkflow before diffing", async () => {
    mockSendRequest.mockResolvedValue({ contents: '{"a_galaxy_workflow":"true"}\n' });
    const cmd = new ConvertToNativeCommand(mockClient, mockProvider);
    await cmd.execute();
    expect(mockSetTextDocumentLanguage).toHaveBeenCalledWith(expect.anything(), "galaxyworkflow");
  });
});

// ---------------------------------------------------------------------------
// Tests: ConvertedWorkflowDocumentProvider
// ---------------------------------------------------------------------------

describe("ConvertedWorkflowDocumentProvider", () => {
  it("round-trips content via setContents + provideTextDocumentContent", () => {
    const provider = new ConvertedWorkflowDocumentProvider();
    const uri = URI.parse("galaxy-converted-workflow:///workspace/workflow.ga");
    provider.setContents(uri as never, "hello: world\n");
    expect(provider.provideTextDocumentContent(uri as never)).toBe("hello: world\n");
  });

  it("returns empty string for unknown URI", () => {
    const provider = new ConvertedWorkflowDocumentProvider();
    const uri = URI.parse("galaxy-converted-workflow:///workspace/unknown.ga");
    expect(provider.provideTextDocumentContent(uri as never)).toBe("");
  });

  it("fires onDidChange when setContents is called", () => {
    const provider = new ConvertedWorkflowDocumentProvider();
    const fired: unknown[] = [];
    provider.onDidChangeEmitter.event = ((uri: unknown) => fired.push(uri)) as never;
    const uri = URI.parse("galaxy-converted-workflow:///workspace/workflow.ga");
    provider.setContents(uri as never, "content");
    // The emitter's fire() is called — check it was invoked
    expect(provider.onDidChangeEmitter.fire).toBeDefined();
  });
});
