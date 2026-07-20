import * as mongoose from 'mongoose';
import { ConfigService } from '@nestjs/config';

export const databaseProviders = [
  {
    provide: 'DATABASE_CONNECTION',
    inject: [ConfigService],
    useFactory: async (config: ConfigService): Promise<typeof mongoose> => {
      return mongoose.connect(config.getOrThrow<string>('MONGODB_URI'));
    },
  },
];
