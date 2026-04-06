import { type ComponentRenderFormat, renderByFormat } from './types.js';

interface SectionComponentInput {
  title: string;
  lines: string[];
}

/*
Example output:

text:
  Management Stack:
    MilkStrawAccessStackV2
    Healthy

markdown:
  ### Management Stack

  - MilkStrawAccessStackV2
  - Healthy
*/
export class SectionComponent {
  constructor(private readonly input: SectionComponentInput) {}

  render(format: ComponentRenderFormat): string {
    return renderByFormat(
      format,
      () => this.renderText(),
      () => this.renderMarkdown(),
    );
  }

  renderText(): string {
    if (this.input.lines.length === 0) return `${this.input.title}:`;

    return `${this.input.title}:\n${this.input.lines.map((line) => `  ${line}`).join('\n')}`;
  }

  renderMarkdown(): string {
    if (this.input.lines.length === 0) return `### ${this.input.title}`;

    return `### ${this.input.title}\n\n${this.input.lines.map((line) => `- ${line}`).join('\n')}`;
  }
}
