import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Track {
  @Prop({ required: true })
  artist!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  spotifyId!: string;

  // Negative-cache marker: when set (and spotifyId absent), the last search
  // found nothing. Re-checked after TRACK_MISS_RECHECK_DAYS so tracks that
  // later appear on Spotify can still match.
  @Prop()
  notFoundAt?: Date;

  // True when the user explicitly chose this Spotify track via the rematch
  // UI. Manual overrides are sticky: cacheTrack() will not overwrite them
  // with results from automatic Spotify search, and findTrackId() returns
  // them even if the search would normally produce something else.
  @Prop({ default: false })
  manualOverride!: boolean;
}

export const TrackSchema = SchemaFactory.createForClass(Track);
// Unique so a racing automatic cacheTrack() can't insert a second row next
// to a manual override — its filtered upsert fails with E11000 (caught and
// logged) instead of silently duplicating the key.
TrackSchema.index({ artist: 1, title: 1 }, { unique: true });
