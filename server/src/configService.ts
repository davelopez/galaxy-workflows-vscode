import {
  ClientCapabilities,
  Connection,
  DidChangeConfigurationNotification,
  DidChangeConfigurationParams,
} from "vscode-languageserver";

/** Represents all the available settings of the extension. */
interface ExtensionSettings {
  cleaning: CleaningSettings;
}

/** Contains settings for workflow cleaning. */
interface CleaningSettings {
  /** A list of property names that will be removed from the workflow document when cleaning. */
  cleanableProperties: string[];
}

const defaultSettings: ExtensionSettings = {
  cleaning: {
    cleanableProperties: ["position", "uuid", "errors", "version"],
  },
};

let globalSettings: ExtensionSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettingsCache: Map<string, ExtensionSettings> = new Map();

export class ConfigService {
  protected hasConfigurationCapability = false;

  constructor(public readonly connection: Connection) {
    this.connection.onInitialized(() => this.onInitialized());
    this.connection.onDidChangeConfiguration((params) => this.onDidChangeConfiguration(params));
  }

  public initialize(capabilities: ClientCapabilities): void {
    this.hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
  }

  public async getDocumentSettings(uri: string): Promise<ExtensionSettings> {
    if (!this.hasConfigurationCapability) {
      return Promise.resolve(globalSettings);
    }
    let result = documentSettingsCache.get(uri);
    if (!result) {
      result = await this.connection.workspace.getConfiguration({
        scopeUri: uri,
        section: "galaxyWorkflows",
      });
      result = result || globalSettings;
      this.addToDocumentConfigCache(uri, result);
    }
    return result;
  }

  public onDocumentClose(uri: string): void {
    documentSettingsCache.delete(uri);
  }

  private onInitialized(): void {
    if (this.hasConfigurationCapability) {
      this.connection.client.register(DidChangeConfigurationNotification.type);
    }
  }

  private onDidChangeConfiguration(params: DidChangeConfigurationParams): void {
    if (this.hasConfigurationCapability) {
      // Reset all cached document settings
      documentSettingsCache.clear();
    } else {
      globalSettings = <ExtensionSettings>(params.settings.galaxyWorkflows || defaultSettings);
    }
  }

  private addToDocumentConfigCache(uri: string, settings: ExtensionSettings): void {
    if (uri.startsWith("temp")) return; // Do not cache config from temp files
    documentSettingsCache.set(uri, settings);
  }
}
