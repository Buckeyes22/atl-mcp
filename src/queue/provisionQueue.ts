import { Queue, Worker } from "bullmq";
import type { TenantScope } from "../domain/tenantScope.js";
import type { ProvisionExecutionInput, ProvisionExecutionResult } from "./jobs/provisionJob.js";
import type { ProvisionJobRepository } from "../storage/repositories/provisionJobRepository.js";

export interface ProvisionQueue {
  enqueue(scope: TenantScope, input: ProvisionExecutionInput): Promise<{ readonly jobId: string; readonly jobResourceUri: string }>;
  /** Pauses the queue worker; in-flight jobs continue to completion. */
  pause(): Promise<void>;
  /** Resumes a paused queue. */
  resume(): Promise<void>;
  /** Reports whether the queue is currently paused. */
  isPaused(): Promise<boolean>;
  close(): Promise<void>;
}

interface ProvisionJobData {
  readonly scope: TenantScope;
  readonly input: ProvisionExecutionInput;
}

export function createBullMqProvisionQueue(args: {
  readonly redisUrl: string;
  readonly provisionJobs: ProvisionJobRepository;
  readonly execute: (scope: TenantScope, input: ProvisionExecutionInput) => Promise<ProvisionExecutionResult>;
}): ProvisionQueue {
  const queue = new Queue<ProvisionJobData>("project-provision", { connection: { url: args.redisUrl } });
  const worker = new Worker<ProvisionJobData>(
    "project-provision",
    async (job) => {
      const { scope, input } = job.data;
      await args.provisionJobs.update(scope, job.id!, { status: "running" });
      try {
        const result = await args.execute(scope, input);
        await args.provisionJobs.update(scope, job.id!, { status: "completed", result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await args.provisionJobs.update(scope, job.id!, { status: "failed", error: message });
        throw err;
      }
    },
    { connection: { url: args.redisUrl } },
  );

  return {
    async enqueue(scope, input) {
      await args.provisionJobs.create(scope, { id: input.plan.id, projectId: input.plan.projectId, status: "queued" });
      const job = await queue.add("project-provision", { scope, input }, { jobId: input.plan.id, removeOnComplete: false, removeOnFail: false });
      return { jobId: job.id!, jobResourceUri: `orchestrator://job/${job.id}` };
    },
    async pause() {
      await queue.pause();
    },
    async resume() {
      await queue.resume();
    },
    async isPaused() {
      return queue.isPaused();
    },
    async close() {
      await worker.close();
      await queue.close();
    },
  };
}
