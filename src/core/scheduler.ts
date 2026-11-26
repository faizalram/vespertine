/**
 * Generator-based coroutines. Stage scripts and boss patterns are written as
 * generator functions that `yield` once per simulation tick.
 */
export type Task = Generator<void, void, void>;

export function* wait(frames: number): Task {
  for (let i = 0; i < frames; i++) yield;
}

export class Scheduler {
  private tasks: Task[] = [];

  add(task: Task): Task {
    this.tasks.push(task);
    return task;
  }

  clear(): void {
    this.tasks.length = 0;
  }

  get size(): number {
    return this.tasks.length;
  }

  tick(): void {
    for (let i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].next().done) {
        this.tasks.splice(i, 1);
        i--;
      }
    }
  }
}
