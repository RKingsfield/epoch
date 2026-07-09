import * as mongoose from 'mongoose';
import { ConfigService } from '@nestjs/config';

export const databaseProviders = [
  {
    provide: 'DATABASE_CONNECTION',
    inject: [ConfigService],
    useFactory: async (config: ConfigService): Promise<typeof mongoose> => {
      const uri = config.get<string>('MONGODB_URI');
      if (!uri) throw new Error('MONGODB_URI is required');
      return mongoose.connect(uri);
    },
  },
];
