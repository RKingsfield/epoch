import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TrackDocument = HydratedDocument<Track>;

@Schema({ timestamps: true })
export class Track {
  @Prop({ required: true })
  artist!: string;

  @Prop({ required: true })
  title!: string;

  @Prop()
  spotifyId!: string;

  // True when the user explicitly chose this Spotify track via the rematch
  // UI. Manual overrides are sticky: cacheTrack() will not overwrite them
  // with results from automatic Spotify search, and findTrackId() returns
  // them even if the search would normally produce something else.
  @Prop({ default: false })
  manualOverride!: boolean;
}

export const TrackSchema = SchemaFactory.createForClass(Track);
TrackSchema.index({ artist: 1, title: 1 });
