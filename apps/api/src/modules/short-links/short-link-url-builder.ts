/**
 * ShortLinkUrlBuilder
 *
 * Produces canonical destination URLs for each link type.
 * The SHORT link (links.occasionpro.in/xxxxxxx) resolves to these destinations.
 */
export class ShortLinkUrlBuilder {
  static invitation(tenantDomain: string, eventId: string, guestId: string): string {
    return `https://${tenantDomain}/i/${guestId}?e=${eventId}`
  }

  static guestPortal(tenantDomain: string, eventId: string, guestId: string): string {
    return `https://${tenantDomain}/guest/${eventId}/portal?g=${guestId}`
  }

  static clientPortal(tenantDomain: string, eventId: string, accessId?: string): string {
    const base = `https://${tenantDomain}/client/events/${eventId}`
    return accessId ? `${base}?access=${accessId}` : base
  }

  static vendorPortal(tenantDomain: string, eventId: string, vendorId: string): string {
    return `https://${tenantDomain}/vendor-portal/${eventId}?v=${vendorId}`
  }

  static rsvp(tenantDomain: string, eventId: string, guestId?: string): string {
    const base = `https://${tenantDomain}/rsvp/${eventId}`
    return guestId ? `${base}?g=${guestId}` : base
  }

  static payment(tenantDomain: string, invoiceId: string): string {
    return `https://${tenantDomain}/pay/${invoiceId}`
  }

  static document(tenantDomain: string, documentId: string): string {
    return `https://${tenantDomain}/docs/${documentId}`
  }

  /** Resolves which builder to use based on link type */
  static fromType(
    linkType: string,
    tenantDomain: string,
    params: Record<string, string>,
  ): string {
    switch (linkType) {
      case 'invitation':    return ShortLinkUrlBuilder.invitation(tenantDomain, params.eventId!, params.guestId!)
      case 'guest_portal':  return ShortLinkUrlBuilder.guestPortal(tenantDomain, params.eventId!, params.guestId!)
      case 'client_portal': return ShortLinkUrlBuilder.clientPortal(tenantDomain, params.eventId!, params.accessId)
      case 'vendor_portal': return ShortLinkUrlBuilder.vendorPortal(tenantDomain, params.eventId!, params.vendorId!)
      case 'rsvp':          return ShortLinkUrlBuilder.rsvp(tenantDomain, params.eventId!, params.guestId)
      case 'payment':       return ShortLinkUrlBuilder.payment(tenantDomain, params.invoiceId!)
      case 'document':      return ShortLinkUrlBuilder.document(tenantDomain, params.documentId!)
      default:              return params.url ?? `https://${tenantDomain}`
    }
  }
}
