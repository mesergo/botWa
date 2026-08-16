/**
 * RecipientResolver — resolves who should receive a push for a given event.
 *
 * Phase 1: agents (assignedAgentId).
 * Future: ambassadors, managers.
 */

/**
 * @interface
 */
export class RecipientResolver {
  /**
   * @param {import('../types/index.js').ConversationMessageReceivedEvent} event
   * @returns {Promise<import('../types/index.js').NotificationRecipient[]>}
   */
  async resolve(_event) {
    throw new Error('RecipientResolver.resolve must be implemented');
  }
}

/**
 * Default resolver used until the host app wires real user/assignment lookups.
 * Resolves the assigned agent only. Ambassadors / managers return empty for now.
 */
export class DefaultRecipientResolver extends RecipientResolver {
  /**
   * @param {{ includeManagers?: boolean, includeAmbassadors?: boolean }} [options]
   */
  constructor(options = {}) {
    super();
    this.includeManagers = Boolean(options.includeManagers);
    this.includeAmbassadors = Boolean(options.includeAmbassadors);
  }

  /**
   * @param {import('../types/index.js').ConversationMessageReceivedEvent} event
   * @returns {Promise<import('../types/index.js').NotificationRecipient[]>}
   */
  async resolve(event) {
    /** @type {import('../types/index.js').NotificationRecipient[]} */
    const recipients = [];

    if (event.assignedAgentId) {
      recipients.push({
        userId: event.assignedAgentId,
        tenantId: event.tenantId,
        type: 'agent',
      });
    }

    // Placeholders for future expansion — intentionally empty until integration.
    if (this.includeAmbassadors) {
      // TODO(integration): resolve ambassadors for tenant / conversation
    }
    if (this.includeManagers) {
      // TODO(integration): resolve managers who opted into push for this conversation
    }

    return recipients;
  }
}
