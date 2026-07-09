import { Connection } from 'mongoose';
import { Track, TrackSchema } from './schemas/track.schema';

export const tracksProviders = [
  {
    provide: Track.name,
    useFactory: (connection: Connection) =>
      connection.model('Track', TrackSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
