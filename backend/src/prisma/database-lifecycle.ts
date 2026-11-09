import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { db } from './db.js';

@Injectable()
export class DatabaseLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown() { await db.close(); }
}
