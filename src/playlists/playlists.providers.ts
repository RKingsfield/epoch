import { Connection } from 'mongoose';
import { Playlist, PlaylistSchema } from './schemas/playlist.schema';
import {
  PlaylistTrack,
  PlaylistTrackSchema,
} from './schemas/playlist-track.schema';

export const playlistsProviders = [
  {
    provide: Playlist.name,
    useFactory: (connection: Connection) =>
      connection.model('Playlist', PlaylistSchema),
    inject: ['DATABASE_CONNECTION'],
  },
  {
    provide: PlaylistTrack.name,
    useFactory: (connection: Connection) =>
      connection.model('PlaylistTrack', PlaylistTrackSchema),
    inject: ['DATABASE_CONNECTION'],
  },
];
