import { Injectable } from '@nestjs/common';

interface HistogramEntry {
  labels: Record<string, string>;
  sum: number;
  count: number;
  buckets: Map<number, number>;
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

@Injectable()
export class MetricsService {
  private counters = new Map<string, Map<string, number>>();
  private histograms = new Map<string, HistogramEntry[]>();
  private gauges = new Map<string, Map<string, number>>();

  incCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.labelKey(labels);
    if (!this.counters.has(name)) this.counters.set(name, new Map());
    const map = this.counters.get(name)!;
    map.set(key, (map.get(key) ?? 0) + value);
  }

  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    if (!this.histograms.has(name)) this.histograms.set(name, []);
    const entries = this.histograms.get(name)!;
    const key = this.labelKey(labels);
    let entry = entries.find(e => this.labelKey(e.labels) === key);
    if (!entry) {
      entry = { labels, sum: 0, count: 0, buckets: new Map(DEFAULT_BUCKETS.map(b => [b, 0])) };
      entries.push(entry);
    }
    entry.sum += value;
    entry.count += 1;
    for (const bucket of DEFAULT_BUCKETS) {
      if (value <= bucket) entry.buckets.set(bucket, (entry.buckets.get(bucket) ?? 0) + 1);
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.labelKey(labels);
    if (!this.gauges.has(name)) this.gauges.set(name, new Map());
    this.gauges.get(name)!.set(key, value);
  }

  serialize(): string {
    const lines: string[] = [];

    for (const [name, map] of this.counters) {
      lines.push(`# TYPE ${name} counter`);
      for (const [key, value] of map) {
        lines.push(`${name}${key} ${value}`);
      }
    }

    for (const [name, entries] of this.histograms) {
      lines.push(`# TYPE ${name} histogram`);
      for (const entry of entries) {
        const lbl = this.labelStr(entry.labels);
        const sortedBuckets = [...entry.buckets.entries()].sort((a, b) => a[0] - b[0]);
        for (const [le, count] of sortedBuckets) {
          const bucketLabels = lbl ? `${lbl},le="${le}"` : `le="${le}"`;
          lines.push(`${name}_bucket{${bucketLabels}} ${count}`);
        }
        const infLabels = lbl ? `${lbl},le="+Inf"` : `le="+Inf"`;
        lines.push(`${name}_bucket{${infLabels}} ${entry.count}`);
        lines.push(`${name}_sum${lbl ? `{${lbl}}` : ''} ${entry.sum}`);
        lines.push(`${name}_count${lbl ? `{${lbl}}` : ''} ${entry.count}`);
      }
    }

    for (const [name, map] of this.gauges) {
      lines.push(`# TYPE ${name} gauge`);
      for (const [key, value] of map) {
        lines.push(`${name}${key} ${value}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  private labelKey(labels: Record<string, string>): string {
    const entries = Object.entries(labels).sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 0) return '';
    return '{' + entries.map(([k, v]) => `${k}="${v}"`).join(',') + '}';
  }

  private labelStr(labels: Record<string, string>): string {
    const entries = Object.entries(labels).sort((a, b) => a[0].localeCompare(b[0]));
    return entries.map(([k, v]) => `${k}="${v}"`).join(',');
  }
}
