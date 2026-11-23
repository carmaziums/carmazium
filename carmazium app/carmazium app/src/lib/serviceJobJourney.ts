import type { ServiceJob, ServiceJobChange } from './servicesApi';

/** Describe the next action from recorded job and payment states, never a return URL. */
export function customerServiceNextStep(job: Pick<ServiceJob, 'status' | 'payment'>): { title: string; description: string } {
  if (job.payment?.status === 'REFUNDED') return {
    title: 'Refund recorded',
    description: 'Check the payment record below and your original payment method for the refund. Contact support if you still need help.',
  };
  switch (job.status) {
    case 'OPEN': return { title: 'Compare quotes', description: 'Compare the price, provider and proposed scope. Choosing a quote opens secure checkout; work starts only after payment is confirmed.' };
    case 'ACCEPTED': return job.payment?.status === 'PENDING'
      ? { title: 'Continue to payment', description: 'Your quote is chosen. Complete secure checkout to confirm the service. If you have just paid, refresh for confirmation before trying again.' }
      : { title: 'Check payment status', description: 'Refresh this request to check the latest payment record before continuing. Contact support if the status does not update.' };
    case 'PAID': return job.payment?.status === 'PAID'
      ? { title: 'Arrange the service', description: 'Payment is confirmed. Contact your provider to arrange the work; the provider will record when it starts.' }
      : { title: 'Check payment status', description: 'The job and payment records need checking. Refresh or contact support before work starts.' };
    case 'IN_PROGRESS': return { title: 'Work in progress', description: 'Your provider has recorded the work as started. Use the job conversation for updates or open support if plans change.' };
    case 'COMPLETED': return { title: 'Review the completed work', description: 'Check the work and any inspection result before confirming completion. Confirmation authorises provider payout; raise a dispute if something is wrong.' };
    case 'DISPUTED': return { title: 'Dispute under review', description: job.payment?.status === 'RELEASED'
      ? 'This is a post-payout review. Opening the case does not automatically reverse the provider transfer. Add information and evidence in support below.'
      : 'The normal provider payout is paused while CarMazium reviews the case. Add information, evidence or respond to a proposed date in support below.' };
    case 'RELEASED': return { title: 'Service complete', description: job.payment?.status === 'RELEASED'
      ? 'CarMazium has recorded the provider payout. You can leave a verified review if you have not already reviewed this service.'
      : 'Check the recorded payment and any refund below. Contact support if you need help with the completed service.' };
    case 'CANCELLED': return { title: 'Request cancelled', description: 'This request is closed. Any recorded payment or refund is shown below; you can return to My Service Requests to arrange another service.' };
    case 'EXPIRED': return { title: 'Request expired', description: 'This request is no longer open for quotes. Return to My Service Requests if you still need a service.' };
  }
}

/** Keep support choices valid when accepting a quote changes OPEN to ACCEPTED. */
export function serviceJobChangeOptions(status: ServiceJob['status'], role: 'customer' | 'provider'): Array<[ServiceJobChange['kind'], string]> {
  const choices: Array<[ServiceJobChange['kind'], string]> = [];
  if (status !== 'ACCEPTED') choices.push(['OTHER', 'Report a problem']);
  if (role === 'provider') choices.push(['CANNOT_ATTEND', 'I cannot attend or complete this job']);
  if (status !== 'ACCEPTED') choices.push(['NOT_COMPLETED', 'The work was not completed']);
  choices.push(['CANCEL', 'Request cancellation']);
  if (status === 'PAID' || status === 'IN_PROGRESS') choices.push(['RESCHEDULE', 'Request a new date']);
  return choices;
}

export function validServiceJobChangeKind(kind: ServiceJobChange['kind'], status: ServiceJob['status'], role: 'customer' | 'provider'): ServiceJobChange['kind'] {
  const options = serviceJobChangeOptions(status, role);
  return options.some(([value]) => value === kind) ? kind : status === 'ACCEPTED' ? 'CANCEL' : 'OTHER';
}

/** Auction refusal reports the server's actual GBP refund, including a waived fee. */
export function inspectionRefusalNotice(refundedAmount: number): string {
  if (!Number.isFinite(refundedAmount) || refundedAmount < 0) return 'Vehicle refusal recorded. Check your auction purchase for the buyer-fee refund status.';
  const amount = refundedAmount.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
  return `Vehicle refused. Recorded buyer-fee refund: ${amount}. Check your auction purchase for details.`;
}
