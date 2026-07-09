import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AurralService } from './aurral.service';

describe('AurralService', () => {
  let service: AurralService;
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aurral-test-'));
    const module = await Test.createTestingModule({
      providers: [
        AurralService,
        { provide: ConfigService, useValue: { get: () => dir } },
      ],
    }).compile();
    service = module.get(AurralService);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes an Aurral-format playlist JSON', async () => {
    await service.export('Top of 2024', [
      { artist: 'Burial', title: 'Archangel' },
      { artist: 'Air', title: "La Femme d'Argent" },
    ]);
    const file = path.join(dir, 'top-of-2024.json');
    const payload = JSON.parse(await fs.readFile(file, 'utf8'));
    expect(payload).toEqual({
      type: 'aurral-static-tracklist',
      version: 1,
      name: 'Top of 2024',
      trackCount: 2,
      tracks: [
        { artistName: 'Burial', trackName: 'Archangel' },
        { artistName: 'Air', trackName: "La Femme d'Argent" },
      ],
    });
  });

  it('is a no-op when AURRAL_EXPORT_DIR is unset', async () => {
    const module = await Test.createTestingModule({
      providers: [
        AurralService,
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    const noopService = module.get(AurralService);
    expect(noopService.enabled()).toBe(false);
    await expect(noopService.export('whatever', [])).resolves.toBeUndefined();
  });
});
