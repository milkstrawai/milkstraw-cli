import { type ComponentRenderFormat, renderByFormat } from './types.js';

type Segment = [string, number | null | undefined];

export class SummaryLineComponent {
  constructor(private readonly segments: Segment[]) {}

  render(format: ComponentRenderFormat): string {
    const text = this.renderText();
    return renderByFormat(
      format,
      () => text,
      () => text,
    );
  }

  renderText(): string {
    return this.segments
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([label, value]) => `${value} ${label}`)
      .join(' · ');
  }
}
