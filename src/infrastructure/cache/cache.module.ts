import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { KeyvAdapter } from 'cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        stores: [
          new KeyvAdapter(
            await redisStore({
              socket: {
                host: config.get<string>('REDIS_HOST', 'localhost'),
                port: config.get<number>('REDIS_PORT', 6379),
              },
              ttl: 60_000,
            }),
          ),
        ],
      }),
    }),
  ],
  exports: [CacheModule],
})
/**
 * ### How to use:
 * 1. Import dependencies:`import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';`
 * 2. Inject services: `@Inject(CACHE_MANAGER) private cacheManager: Cache`
 *
 * The module is global so it can be injected on any other module
 */
export class AppCacheModule {}
