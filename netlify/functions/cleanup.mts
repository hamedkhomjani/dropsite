import type { Config } from '@netlify/functions'
import { cleanupExpired } from '../lib/files.mts'

// Removes files older than 3 days (replaces the Flask app's cleanup_uploads()).
export default async () => {
  const removed = await cleanupExpired()
  console.log(`Removed ${removed} expired file(s)`)
}

export const config: Config = {
  schedule: '@hourly',
}
