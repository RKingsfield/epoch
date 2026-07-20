import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PlaylistTrackDocument = HydratedDocument<PlaylistTrack>;

@Schema({ timestamps: true })
export class PlaylistTrack {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Playlist',
    required: true,
    index: true,
  })
  playlistId!: Types.ObjectId;

  @Prop({ required: true })
  position!: number;

  @Prop({ required: true })
  lastfmArtist!: string;

  @Prop({ required: true })
  lastfmTitle!: string;

  @Prop()
  spotifyTrackId?: string;

  @Prop()
  matchedAt?: Date;

  @Prop({ default: false })
  manualOverride!: boolean;
}

export const PlaylistTrackSchema = SchemaFactory.createForClass(PlaylistTrack);
PlaylistTrackSchema.index({ playlistId: 1, position: 1 }, { unique: true });
