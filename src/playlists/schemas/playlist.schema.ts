import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { PlaylistPeriod } from '../../../shared/types';

export type PlaylistDocument = HydratedDocument<Playlist>;

@Schema({ timestamps: true })
export class Playlist {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true, enum: ['yearly', 'seasonal', 'monthly'] })
  period!: PlaylistPeriod;

  @Prop({ required: true })
  periodKey!: string;

  @Prop({ required: true })
  spotifyPlaylistId!: string;

  @Prop({ default: false })
  aurralExported!: boolean;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PlaylistSchema = SchemaFactory.createForClass(Playlist);
PlaylistSchema.index({ userId: 1, periodKey: 1, period: 1 }, { unique: true });
PlaylistSchema.index({ userId: 1, createdAt: -1 });
