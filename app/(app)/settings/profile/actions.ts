'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ════════════════════════════════════════════════════════════════════════════
//  updateProfile — server action
//
//  Called from the profile form. Reads form values, runs basic validation,
//  upserts into public.profiles using the authenticated user's id, and
//  revalidates the report-generate route so the next download picks up the
//  new cover-page metadata immediately.
// ════════════════════════════════════════════════════════════════════════════

export type ProfileFormState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const TRIM_LIMITS = {
  full_name:   120,
  firm_name:   160,
  nec_reg_no:  60,
  designation: 120,
  phone:       40,
}

function cleanField(value: FormDataEntryValue | null, max: number): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, max)
}

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { status: 'error', message: 'You must be signed in to update your profile.' }
  }

  const payload = {
    id:          user.id,
    full_name:   cleanField(formData.get('full_name'),   TRIM_LIMITS.full_name),
    firm_name:   cleanField(formData.get('firm_name'),   TRIM_LIMITS.firm_name),
    nec_reg_no:  cleanField(formData.get('nec_reg_no'),  TRIM_LIMITS.nec_reg_no),
    designation: cleanField(formData.get('designation'), TRIM_LIMITS.designation),
    phone:       cleanField(formData.get('phone'),       TRIM_LIMITS.phone),
  }

  // Light validation: full_name is the only field that actually appears on
  // the DFS cover. If it's blank, warn the user but still save (they may be
  // filling other fields first).
  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })

  if (error) {
    console.error('[settings/profile] upsert failed:', error)
    return {
      status: 'error',
      message: 'Could not save profile: ' + error.message,
    }
  }

  // Bust the cache on the report-generate route so the next download reads
  // the fresh profile row. The route is force-dynamic so this is belt-and-
  // braces, but worth keeping for any future ISR adjustments.
  revalidatePath('/projects', 'layout')

  return {
    status: 'success',
    message: payload.full_name
      ? 'Profile saved. The next DFS report will show your details on the cover.'
      : 'Profile saved. Add your full name so it appears on the DFS cover.',
  }
}