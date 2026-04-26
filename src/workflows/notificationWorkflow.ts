export interface NotificationMessage {
  readonly kind: "provisioning_complete" | "waiver_event";
  readonly projectId: string;
  readonly text: string;
  readonly artifactIds?: readonly string[];
}

export interface NotificationTransport {
  send(message: NotificationMessage): Promise<void>;
}

export function createNotificationWorkflow(input: { readonly transports: readonly NotificationTransport[] }) {
  return {
    async notifyProvisioningComplete(args: { readonly projectId: string; readonly artifactIds: readonly string[] }): Promise<void> {
      const message: NotificationMessage = {
        kind: "provisioning_complete",
        projectId: args.projectId,
        text: `Provisioning complete for ${args.projectId}`,
        artifactIds: args.artifactIds,
      };
      await Promise.all(input.transports.map((transport) => transport.send(message)));
    },
  };
}
