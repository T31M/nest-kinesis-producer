import { Injectable, Logger } from '@nestjs/common';
import { PutRecordsInput, PutRecordsRequestEntry } from 'aws-sdk/clients/kinesis';

import { Kinesis } from 'aws-sdk';
import { KinesisEvent } from './kinesis-event.interface';

@Injectable()
export class BatchKinesisPublisher {
  private readonly baseLogger: Logger;
  private static readonly ONE_MEG = 1024 * 1024;
  protected entries: PutRecordsRequestEntry[] = [];
  protected streamName: string;
  private dataSize = 0;
  constructor(protected readonly kinesis: Kinesis) {
    this.baseLogger = new Logger(BatchKinesisPublisher.name);
  }

  async putRecords(streamName: string, events: KinesisEvent[]): Promise<void> {
    this.baseLogger.log(`putRecords() invoked for ${events.length} records on stream ${streamName}`);
    this.streamName = streamName;
    for (const x of events) {
      await this.addEntry({
        Data: this.getDataBytes(x.Data),
        PartitionKey: x.PartitionKey.toString(),
      });
    }
    await this.flush();
    this.baseLogger.log(`putRecords() completed for ${events.length} records`);
  }
  protected getDataBytes(data: string): Buffer {
    return Buffer.from(data, 'utf8');
  }

  protected async flush(): Promise<void> {
    if (this.entries.length < 1) {
      return;
    }
    const putRecordsInput: PutRecordsInput = {
      StreamName: this.streamName,
      Records: this.entries,
    };
    await this.kinesis.putRecords(putRecordsInput).promise();
    this.entries = [];
  }

  protected async addEntry(entry: PutRecordsRequestEntry): Promise<void> {
    const entryDataSize: number = entry.Data.toString('utf8').length + entry.PartitionKey.length;
    if (Number.isNaN(entryDataSize)) {
      this.baseLogger.error(
        `Cannot produce data size of partitionKey: ${entry.PartitionKey}  |  Data: ${entry.Data.toString('utf8')}`,
      );
      return;
    }
    if (entryDataSize > BatchKinesisPublisher.ONE_MEG) {
      this.baseLogger.error(
        `FATAL: entry exceeds maximum size of 1M and will not be published, partitionkey: ${entry.PartitionKey}`,
      );
      return;
    }

    const newDataSize = this.dataSize + entryDataSize;
    if (newDataSize <= 5 * 1024 * 1024 && this.entries.length < 500) {
      this.dataSize = newDataSize;
      this.entries.push(entry);
    } else {
      await this.flush();
      this.dataSize = 0;
      await this.addEntry(entry);
    }
  }
}
