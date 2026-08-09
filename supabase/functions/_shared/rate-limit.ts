/**
 * Atomic rate-limit leases via try_acquire_rate_limit RPC (Phase 5A.1 / S4).
 */
type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function tryAcquireRateLimit(
  supabase: RpcClient,
  leaseKey: string,
  ttlSeconds: number,
  userId?: string,
): Promise<boolean> {
  const args: Record<string, unknown> = {
    p_lease_key: leaseKey,
    p_ttl_seconds: ttlSeconds,
  };
  if (userId) args.p_user_id = userId;
  const { data, error } = await supabase.rpc('try_acquire_rate_limit', args);
  if (error) {
    console.error('rate_limit_lease_error', error.message);
    return false;
  }
  return data === true;
}
