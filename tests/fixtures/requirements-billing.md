# Billing Portal

## Goals
- Reduce support handoffs
- Give account owners self-service billing records

## Non-Goals
- Payment processing

## Stakeholders
- Finance Ops - approver - invoice accuracy

## Requirements
- must: Account owner can export invoice history. Acceptance: CSV contains invoices for the selected date range.
- should: Admin can resend failed invoice emails. Acceptance: Resend action records an audit event.

## Architecture
Use the existing customer portal and billing ledger API.

## Risks
- high: Ledger API rate limits could block bulk export. Mitigation: batch by month.

## Testing
- UT: parser and ledger range helpers
- E2E: export happy path

## Release
Pilot with Finance Ops before general availability.
