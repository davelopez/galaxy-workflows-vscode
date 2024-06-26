import {
  GalaxyWorkflowLanguageServer,
  Hover,
  HoverContentContributor,
  HoverParams,
  MarkupContent,
  MarkupKind,
} from "../../languageTypes";
import { ServerEventHandler } from "../handler";

export class HoverHandler extends ServerEventHandler {
  private contributors: HoverContentContributor[];

  constructor(server: GalaxyWorkflowLanguageServer, contributors?: HoverContentContributor[]) {
    super(server);
    this.contributors = contributors ?? [];
    this.register(this.server.connection.onHover((params) => this.onHover(params)));
  }

  private async onHover(params: HoverParams): Promise<Hover | null> {
    const documentContext = this.server.documentsCache.get(params.textDocument.uri);
    if (!documentContext) {
      return null;
    }
    const languageService = this.server.getLanguageServiceById(documentContext.languageId);
    const hover = await languageService.doHover(documentContext, params.position);
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
      const contributedContent = contentContributor.onHoverContent(documentContext, params.position);
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
