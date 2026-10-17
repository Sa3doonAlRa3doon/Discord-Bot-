import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonStore {
  constructor(filePath, fallback = {}) {
    this.filePath = filePath;
    this.fallback = structuredClone(fallback);
    this.data = structuredClone(fallback);
    this.writeQueue = Promise.resolve();
  }

  async load() {
    try {
      this.data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.data = structuredClone(this.fallback);
    }
    return this.data;
  }

  get(key, fallback = undefined) {
    return Object.hasOwn(this.data, key) ? this.data[key] : fallback;
  }

  async set(key, value) {
    this.data[key] = value;
    await this.save();
    return value;
  }

  async delete(key) {
    const existed = delete this.data[key];
    if (existed) await this.save();
    return existed;
  }

  async update(mutator) {
    const result = await mutator(this.data);
    await this.save();
    return result;
  }

  save() {
    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryPath = `${this.filePath}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
      await fs.rename(temporaryPath, this.filePath);
    });
    return this.writeQueue;
  }
}
