import { inject, injectable } from "inversify";
import {
  ClientCapabilities,
  Connection,
  DidChangeConfigurationNotification,
  DidChangeConfigurationParams,
} from "vscode-languageserver";
import { TYPES } from "./languageTypes";

/** Represents all the available settings of the extension. */
interface ExtensionSettings {
  cleaning: CleaningSettings;
  validation: ValidationSettings;
  toolCache: ToolCacheSettings;
  toolShed: ToolShedSettings;
}

/** Contains settings for workflow cleaning. */
interface CleaningSettings {}

/** Contains settings for the tool cache. */
interface ToolCacheSettings {
  directory: string;
}

/** Contains settings for the ToolShed. */
interface ToolShedSettings {
  url: string;
}

/** Contains settings for validating workflows. */
interface ValidationSettings {
  /**
   * The name of the profile containing the set of custom rules to validate.
   * - `basic`: Basic validation based on the Galaxy workflow schema.
   * - `iwc`: Stricter validation to comply with the `Intergalactic Workflow Commission` best practices.
   */
  profile: "basic" | "iwc";
}

const defaultSettings: ExtensionSettings = {
  cleaning: {},
  validation: {
    profile: "basic",
  },
  toolCache: {
    directory: "~/.galaxy/tool_info_cache",
  },
  toolShed: {
    url: "https://toolshed.g2.bx.psu.edu",
  },
};

let globalSettings: ExtensionSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettingsCache: Map<string, ExtensionSettings> = new Map();

export interface ConfigService {
  readonly connection: Connection;
  initialize(capabilities: ClientCapabilities, onConfigurationChanged: () => void): void;
  getDocumentSettings(uri: string): Promise<ExtensionSettings>;
  onDocumentClose(uri: string): void;
}

@injectable()
export class ConfigServiceImpl implements ConfigService {
  protected hasConfigurationCapability = false;
  private isInitialized = false;
  private onConfigurationChanged: () => void = () => {
    return;
  };

  constructor(@inject(TYPES.Connection) public readonly connection: Connection) {
    this.connection.onInitialized(() => this.onInitialized());
    this.connection.onDidChangeConfiguration((params) => this.onDidChangeConfiguration(params));
  }

  public initialize(capabilities: ClientCapabilities, onConfigurationChanged: () => void): void {
    this.onConfigurationChanged = onConfigurationChanged;
    this.hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
  }

  public async getDocumentSettings(uri: string): Promise<ExtensionSettings> {
    if (!this.hasConfigurationCapability || !this.isInitialized) {
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
    this.isInitialized = true;
    if (this.hasConfigurationCapability) {
      this.connection.client.register(DidChangeConfigurationNotification.type);
    }
    // Now that initialization is complete, fetch real settings from client
    this.onConfigurationChanged();
  }

  private onDidChangeConfiguration(params: DidChangeConfigurationParams): void {
    if (this.hasConfigurationCapability) {
      // Reset all cached document settings
      documentSettingsCache.clear();
    } else {
      globalSettings = <ExtensionSettings>(params.settings.galaxyWorkflows || defaultSettings);
    }
    this.onConfigurationChanged();
  }

  private addToDocumentConfigCache(uri: string, settings: ExtensionSettings): void {
    if (uri.startsWith("temp")) return; // Do not cache config from temp files
    documentSettingsCache.set(uri, settings);
  }
}
