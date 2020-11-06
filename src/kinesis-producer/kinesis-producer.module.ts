import { DynamicModule, Global, Module } from '@nestjs/common';
import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { BatchKinesisPublisher } from './batch-kinesis-publisher';
import { Kinesis } from 'aws-sdk';
import { RetryingBatchKinesisPublisher } from './retrying-batch-kinesis-publisher';

@Global()
@Module({})
export class KinesisProducerModule {
  static forRoot(kinesis: Kinesis): DynamicModule {
    return {
      imports: [
        WinstonModule.forRoot({
          transports: [
            new winston.transports.Console({
              level: process.env.LOG_LEVEL || 'info',
              format: winston.format.combine(
                winston.format.timestamp(),
                nestWinstonModuleUtilities.format.nestLike(),
                winston.format.uncolorize(),
              ),
            }),
          ],
        }),
      ],
      module: KinesisProducerModule,
      providers: [
        BatchKinesisPublisher,
        RetryingBatchKinesisPublisher,
        {
          provide: Kinesis,
          useValue: kinesis,
        },
      ],
      exports: [RetryingBatchKinesisPublisher],
    };
  }
}
