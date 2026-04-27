---
title: Sequence Diagrams (8 flows)
owner: Chris
status: accepted
last_reviewed: 2026-04-25
version: 1.0.0
audience: [engineer, integrator]
sdlc_category: 04-design
related: [docs/sdlc/02-architecture/data-flow.md, docs/sdlc/templates/sequence-diagram-template.md]
---

# Sequence Diagrams

> **TL;DR:** Eight key flows: MCP session establishment, intake → blueprint, blueprint → plan, plan → execute, audit chain write, audit chain rotation, webhook ingestion, context-pack generation, readiness validation. Each is a separate section with a mermaid sequence diagram, narrative, failure-mode notes, and trust-boundary callouts. Per the [`../templates/sequence-diagram-template.md`](../templates/sequence-diagram-template.md) shape.

---

## 1. MCP session establishment

**Pre-conditions:** server running; client speaks MCP.

```mermaid
sequenceDiagram
    actor Client as Build agent
    participant Trans as MCP transport
    participant Caps as Capability negotiator
    participant Sess as SessionRegistry
    participant Audit as Audit chain

    Client->>Trans: initialize (declared capabilities)
    Trans->>Caps: negotiate(client_caps, server_caps)
    Caps-->>Trans: negotiated_caps (intersection)
    Trans->>Sess: register(sessionId, caps)
    Sess->>Audit: append "session.opened"
    Trans-->>Client: initialized (server caps, tools[])
```

**Boundaries crossed:** Boundary 1 (external → server).
**Failure modes:** stdout corruption (Incident A); capability mismatch (negotiation produces downgraded surface).
**Post-conditions:** session live; client can issue tool calls.

## 2. Intake → blueprint

**Pre-conditions:** project exists; intake tool flag enabled.

```mermaid
sequenceDiagram
    actor Op as Operator
    participant Tool as project_intake_create
    participant Wf as intakeWorkflow
    participant Repo as projectRepository
    participant BPTool as project_blueprint_generate
    participant BPWf as blueprintWorkflow
    participant Sample as sampling provider
    participant Triplet as adversarialVerifier
    participant Audit as Audit chain

    Op->>Tool: create(name, key, source)
    Tool->>Wf: capture
    Wf->>Repo: insert ProjectIntake
    Repo-->>Wf: intake row
    Wf->>Audit: "project.intake.create"
    Wf-->>Op: { projectId, state: INTAKE_RECEIVED }

    Op->>BPTool: generate(projectId)
    BPTool->>BPWf: generate
    BPWf->>Repo: load intake
    BPWf->>Sample: sample(blueprint prompt + intake)
    Sample-->>BPWf: candidate blueprint
    BPWf->>Triplet: verify(candidate)
    Triplet->>Sample: critique pass
    Sample-->>Triplet: critique
    Triplet-->>BPWf: accept | reject
    
    alt accept
        BPWf->>Repo: persist blueprint
        BPWf->>Audit: "blueprint.validated"
        BPWf-->>Op: blueprint
    else reject
        BPWf->>Audit: "blueprint.validation_failed"
        BPWf-->>Op: error with reasons
    end
```

**Boundaries crossed:** Boundary 1 (operator), Boundary 2 (sampling provider).
**Failure modes:** sampling unavailable (degraded); triplet rejects (state VALIDATION_FAILED).

## 3. Blueprint → plan

**Pre-conditions:** validated blueprint + ProjectProfile exist.

```mermaid
sequenceDiagram
    actor Op as Operator
    participant Tool as project_provision_preview
    participant Wf as provisioningWorkflow
    participant Planner as planner
    participant JiraP as JiraProvider
    participant ConfP as ConfluenceProvider
    participant Audit as Audit chain

    Op->>Tool: preview(plan params)
    Tool->>Wf: previewPlan
    Wf->>Planner: plan(blueprint, profile)
    Planner->>JiraP: list existing issues (read-only)
    Planner->>ConfP: list existing pages (read-only)
    JiraP-->>Planner: live state
    ConfP-->>Planner: live state
    Planner-->>Wf: ArtifactPlan (idempotency keys + ordering)
    Wf->>Audit: "plan.previewed"
    Wf-->>Op: { plan, triplet results }
```

**Boundaries crossed:** Boundary 1, Boundary 2 (read-only against Atlassian).
**Failure modes:** discovery fails; planner produces partial plan with warnings.

## 4. Plan → execute (Jira)

**Pre-conditions:** plan exists, approval received.

```mermaid
sequenceDiagram
    actor Op as Operator
    participant Tool as project_provision_execute
    participant Wf as provisioningWorkflow
    participant Queue as ProvisionQueue
    participant Worker as ProvisionJobExecutor
    participant Policy as policyDecisionLayer
    participant Provs as JiraProvider
    participant Audit as Audit chain

    Op->>Tool: execute(plan, approved, evidence)
    Tool->>Wf: enqueue
    Wf->>Queue: enqueue(jobId, plan)
    Queue-->>Wf: enqueued
    Wf-->>Op: { jobId, jobResourceUri }

    Note over Worker,Audit: Asynchronous from here

    Worker->>Queue: pull job
    loop per action in plan
        Worker->>Policy: evaluate(action)
        Policy-->>Worker: PolicyDecision
        alt allow
            Worker->>Provs: write
            Provs-->>Worker: created
            Worker->>Audit: "jira.issue.create" signed
        else deny
            Worker->>Audit: "policy.deny" signed
            Worker->>Worker: skip + record
        end
    end
    Worker->>Queue: job complete
```

**Boundaries crossed:** Boundary 1, Boundary 2 (writes!), Boundary 3 (audit on every step).
**Failure modes:** mid-execute crash → job re-pickup, idempotent re-run; policy denial → audit + skip.

## 5. Audit chain write

**Pre-conditions:** an operation needs to be audited.

```mermaid
sequenceDiagram
    participant Caller
    participant Layer as policyDecisionLayer
    participant Audit as auditEntriesRepository
    participant Signer as auditSigner
    participant Registry as audit-key git ref

    Caller->>Layer: evaluate(req)
    Layer->>Layer: compute decision
    Layer->>Audit: append(actor, op, payload, decision)
    Audit->>Audit: load prior entry's serialized form
    Audit->>Audit: prevHash = SHA256(prior canonical)
    Audit->>Audit: payloadHash = SHA256(payload JCS)
    Audit->>Audit: chainHash = SHA256(prevHash || payloadHash)
    Audit->>Signer: sign(chainHash)
    Signer-->>Audit: signature, keyId
    Audit->>Audit: INSERT row
    Audit-->>Layer: ok
    Layer-->>Caller: decision
```

**Boundaries crossed:** Boundary 3.
**Failure modes:** signing key unreachable → fail closed; DB insert fails → fail closed; registry unreachable for new key resolution → fail (use cached active key).

## 6. Audit chain key rotation

**Pre-conditions:** operator decides to rotate (compromise or scheduled).

```mermaid
sequenceDiagram
    actor Op as Operator
    participant Cli as audit-keys-init
    participant Reg as audit-key git ref
    participant Server as orchestrator process
    participant Audit as audit chain

    Op->>Cli: generate new keypair
    Cli-->>Op: new keypair (private + public)
    Op->>Reg: push public-half (new keyId)
    Op->>Server: update AUDIT_KEYPAIR_PATH; restart
    Server->>Server: load new private key
    Server->>Audit: append "audit.key.rotated" with new key
    Note over Server,Audit: First entry signed with new key references the rotation event
    Op->>Cli: archive old private key (retention period)
```

**Boundaries crossed:** Boundary 3.
**Failure modes:** registry push fails → no rotation; restart fails → roll back to old key path.

## 7. Webhook ingestion

**Pre-conditions:** webhook source has shared secret registered.

```mermaid
sequenceDiagram
    participant Source as Atlassian/Bitbucket
    participant Edge as TLS endpoint
    participant Verify as webhookSignatures
    participant Dedup as webhookDeliveries
    participant Wf as webhookWorkflow
    participant Audit as Audit chain

    Source->>Edge: POST + signature header
    Edge->>Verify: verify(rawBody, header, source)
    
    alt signature valid
        Verify->>Dedup: SELECT (source, deliveryId)
        alt new
            Dedup-->>Verify: not found
            Verify->>Dedup: INSERT
            Verify->>Wf: process(parsed event)
            Wf->>Audit: "webhook.received"
            Wf-->>Edge: 202
        else duplicate
            Verify->>Audit: "webhook.duplicate"
            Verify-->>Edge: 200
        end
    else invalid
        Verify->>Audit: "webhook.signature_invalid"
        Verify-->>Edge: 401
    end
```

**Boundaries crossed:** Boundary 1 (external → server).
**Failure modes:** signature failure → 401; dedup table unreachable → reject (fail closed).

## 8. Context pack generation + readiness validation

```mermaid
sequenceDiagram
    actor Agent as Build agent
    participant Tool as context_pack_generate
    participant Engine as Pack engine
    participant Repo as repositories
    participant Class as classification config
    participant Audit as Audit chain

    Agent->>Tool: generate(projectId, issueKey?)
    Tool->>Engine: build pack
    Engine->>Repo: load blueprint, profile, traces, ACL
    Engine->>Engine: hybridRank candidates
    Engine->>Class: lookup field classifications
    Engine->>Engine: redact PRIVATE/SECRET
    Engine->>Engine: progressive truncate to budget
    Engine->>Repo: persist (regenerationKey)
    Engine->>Audit: "context.pack.generated"
    Engine-->>Agent: ContextPack
```

```mermaid
sequenceDiagram
    actor Op as Operator
    participant Tool as readiness_validate
    participant Wf as readinessWorkflow
    participant Repo as repositories
    participant LLM as sampling
    participant Audit as Audit chain

    Op->>Tool: validate(projectId)
    Tool->>Wf: validate
    Wf->>Repo: load project + blueprint + provisioning state
    Wf->>Wf: compute 6-category deterministic score (v6 §17.1)
    Wf->>LLM: judge(blueprint + provisioning + criteria)
    LLM-->>Wf: 4-tier verdict (v6 §17.2)
    Wf->>Repo: persist ReadinessReport
    Wf->>Audit: "readiness.validated"
    Wf-->>Op: ReadinessReport
```

**Failure modes:** missing classification (default INTERNAL); LLM judge unavailable (degraded — score-only); pack over budget (truncation lossiness).

---

## Diagram conventions

- Activations only on non-trivial work.
- `alt` blocks for branches; `opt` for optional; `par` for parallel.
- Audit interactions shown as solid arrows (they're synchronous and load-bearing).
- Lifelines named by role, not by class file.

## Linked artifacts

- **Spec:** v6 §5 (core flow), §6 (state machine), §7 (architecture), §16 (context), §17 (readiness), §18 (write safety), §22 (transport), §26 (webhook), §30 (audit)
- **Sibling docs:** [`module-*.md`](.) (per-module designs), [`../02-architecture/data-flow.md`](../02-architecture/data-flow.md)
- **Template:** [`../templates/sequence-diagram-template.md`](../templates/sequence-diagram-template.md)

---

*Last reviewed: 2026-04-25 by Chris.*
