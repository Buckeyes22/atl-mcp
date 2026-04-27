---
description: "Kafka patterns: topic contracts, consumer idempotency, ordering assumptions, and replay-safe processing"
globs: ["src/**/*.ts", "app/**/*.py", "workers/**/*.py", "workers/**/*.ts", "kafka/**/*.ts", "kafka/**/*.py"]
alwaysApply: false
---

# Kafka — Event Streaming Module

**Targets:** Kafka-compatible streaming systems
**Appended to base CLAUDE.md when Kafka is in use.**

---

## Topic and Event Contracts

1. Topics are API surfaces. Name them intentionally and document ownership.
2. Event payloads need durable schemas and versioning rules.
3. Do not treat “whatever the producer emitted” as the consumer contract.

## Consumer Rules

4. Consumers must be idempotent. Replays and duplicate delivery are normal operating conditions.
5. Be explicit about ordering assumptions. Partition-local ordering is not global ordering.
6. Keep poison-message handling, dead-letter routing, or retry policy explicit.

## Data and Side Effects

7. Separate message parsing, schema validation, and domain side effects.
8. Acknowledge only after the required durable side effects are complete under the service’s delivery guarantees.

## Observability

9. Track lag, failure rates, replay behavior, and consumer group health as first-class operational signals.
