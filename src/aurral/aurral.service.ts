import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Track } from '../lastfm/lastfm.service';

@Injectable()
export class AurralService {
  private readonly logger = new Logger(AurralService.name);

  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return Boolean(this.exportDir());
  }

  async export(title: string, tracks: Track[]): Promise<void> {
    const dir = this.exportDir();
    if (!dir) return;

    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${this.slug(title)}.json`);
    const payload = {
      type: 'aurral-static-tracklist',
      version: 1,
      name: title,
      trackCount: tracks.length,
      tracks: tracks.map((t) => ({
        artistName: t.artist,
        trackName: t.title,
      })),
    };
    await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
    this.logger.log(`Exported "${title}" → ${file} (${tracks.length} tracks)`);
  }

  private exportDir(): string | undefined {
    return this.config.get<string>('AURRAL_EXPORT_DIR');
  }

  private slug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
