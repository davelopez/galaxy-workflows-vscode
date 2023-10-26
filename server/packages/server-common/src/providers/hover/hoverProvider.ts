import { Hover, HoverParams, MarkupKind, MarkupContent, HoverContentContributor } from "../../languageTypes";
import { GalaxyWorkflowLanguageServer } from "../../server";
import { Provider } from "../provider";

export class HoverProvider extends Provider {
  private contributors: HoverContentContributor[];

  public static register(
    server: GalaxyWorkflowLanguageServer,
    contributors?: HoverContentContributor[]
  ): HoverProvider {
    return new HoverProvider(server, contributors);
  }

  constructor(server: GalaxyWorkflowLanguageServer, contributors?: HoverContentContributor[]) {
    super(server);
    this.contributors = contributors ?? [];
    this.connection.onHover((params) => this.onHover(params));
  }

  private async onHover(params: HoverParams): Promise<Hover | null> {
    const workflowDocument = this.documentsCache.get(params.textDocument.uri);
    if (!workflowDocument) {
      return null;
    }
    const hover = await this.workflowLanguageService.doHover(workflowDocument, params.position);
    if (!hover) {
      return null;
    }
    const contentSections: string[] = [
      this.hoverHasEmptyContent(hover)
        ? `No documentation available`
        : MarkupContent.is(hover.contents)
        ? hover.contents.value
        : `${hover.contents}`,
    ];
    this.contributors.forEach((contentContributor) => {
      const contributedContent = contentContributor.onHoverContent(workflowDocument, params.position);
      contentSections.push(contributedContent);
    });
    this.setHoverContentSections(hover, contentSections);
    return hover;
  }

  private setHoverContentSections(hover: Hover, contentSections: string[]): void {
    const markdownContent: MarkupContent = {
      kind: MarkupKind.Markdown,
      value: contentSections.join("\n\n---\n\n"),
    };
    hover.contents = markdownContent;
  }

  private hoverHasEmptyContent(hover: Hover): boolean {
    return hover.contents.toString() === "";
  }
}
