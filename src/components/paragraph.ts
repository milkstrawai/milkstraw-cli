import { type ComponentRenderFormat, renderByFormat } from './types.js';

/*
Example output:

text:
  Status for Acme

markdown:
  Status for Acme
*/
export class ParagraphComponent {
  constructor(private readonly content: string) {}

  render(format: ComponentRenderFormat): string {
    return renderByFormat(
      format,
      () => this.renderText(),
      () => this.renderMarkdown(),
    );
  }

  renderText(): string {
    return this.content;
  }

  renderMarkdown(): string {
    return this.content;
  }
}
