import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_TIMEOUT_MS = 2_147_000_000;

export class ReminderStore {
  constructor(filePath, deliver) {
    this.filePath = filePath;
    this.deliver = deliver;
    this.reminders = [];
    this.timers = new Map();
  }

  async load() {
    try {
      this.reminders = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (!Array.isArray(this.reminders)) this.reminders = [];
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.reminders = [];
    }

    for (const reminder of this.reminders) this.schedule(reminder);
  }

  async add(reminder) {
    this.reminders.push(reminder);
    await this.save();
    this.schedule(reminder);
  }

  schedule(reminder) {
    const remaining = reminder.dueAt - Date.now();
    if (remaining > MAX_TIMEOUT_MS) {
      const timer = setTimeout(() => this.schedule(reminder), MAX_TIMEOUT_MS);
      timer.unref();
      this.timers.set(reminder.id, timer);
      return;
    }

    const timer = setTimeout(() => this.fire(reminder), Math.max(0, remaining));
    timer.unref();
    this.timers.set(reminder.id, timer);
  }

  async fire(reminder) {
    this.timers.delete(reminder.id);
    try {
      await this.deliver(reminder);
      this.reminders = this.reminders.filter((item) => item.id !== reminder.id);
      await this.save();
    } catch (error) {
      console.error(`Reminder ${reminder.id} could not be delivered:`, error);
      if ((reminder.attempts ?? 0) >= 1) {
        this.reminders = this.reminders.filter((item) => item.id !== reminder.id);
        await this.save();
        return;
      }

      const retry = { ...reminder, attempts: 1, dueAt: Date.now() + 60_000 };
      this.reminders = this.reminders.map((item) => item.id === reminder.id ? retry : item);
      await this.save();
      this.schedule(retry);
    }
  }

  async save() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(this.reminders, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, this.filePath);
  }
}
