import { createClient } from 'jsr:@supabase/supabase-js@2'

type Gender = 'boy' | 'girl'

interface CsvRow {
  player_name: string
  dob: string
  gender: string
  parent_name: string
  parent_email: string
}

interface ImportedRow {
  playerName: string
  dob: string
  birthYear: number
  gender: Gender
  parentName: string
  parentEmail: string
}

interface RowResult {
  playerName: string
  parentEmail: string
  teamName: string
  status: 'imported' | 'skipped' | 'error'
  reason?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function teamName(birthYear: number, gender: Gender): string {
  return `${birthYear} ${gender === 'girl' ? 'Girls' : 'Boys'}`
}

function parseGender(raw: string): Gender | null {
  const val = raw.trim().toLowerCase()
  if (val === 'boy' || val === 'm' || val === 'male' || val === 'boys') return 'boy'
  if (val === 'girl' || val === 'f' || val === 'female' || val === 'girls') return 'girl'
  return null
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((header, i) => {
      row[header] = values[i] ?? ''
    })
    return row as unknown as CsvRow
  })
}

Deno.serve(async (request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const appBaseUrl = Deno.env.get('APP_BASE_URL') ?? ''

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase service role credentials are not configured.' }, 500)
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization header.' }, 401)

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Verify caller is an admin
  const { data: actorData, error: actorError } = await adminClient.auth.getUser()
  if (actorError || !actorData.user) return json({ error: 'Unable to validate session.' }, 401)

  const { data: actorProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('name, roles')
    .eq('id', actorData.user.id)
    .maybeSingle()

  if (profileError || !actorProfile || !Array.isArray(actorProfile.roles) || !actorProfile.roles.includes('admin')) {
    return json({ error: 'Only admins can run bulk imports.' }, 403)
  }

  const payload = await request.json() as { csvText?: string; dryRun?: boolean }
  const csvText = payload.csvText ?? ''
  const dryRun = payload.dryRun === true

  if (!csvText.trim()) return json({ error: 'No CSV data provided.' }, 400)

  // Parse and validate rows
  const rawRows = parseCsv(csvText)
  const validRows: ImportedRow[] = []
  const parseErrors: RowResult[] = []

  for (const row of rawRows) {
    const playerName = row.player_name?.trim()
    const dob = row.dob?.trim()
    const gender = parseGender(row.gender ?? '')
    const parentName = row.parent_name?.trim()
    const parentEmail = row.parent_email?.trim().toLowerCase()

    if (!playerName || !dob || !gender || !parentName || !parentEmail) {
      parseErrors.push({
        playerName: playerName || '(unknown)',
        parentEmail: parentEmail || '(unknown)',
        teamName: '—',
        status: 'error',
        reason: 'Missing required fields (player_name, dob, gender, parent_name, parent_email)',
      })
      continue
    }

    const birthYear = new Date(dob).getFullYear()
    if (Number.isNaN(birthYear)) {
      parseErrors.push({
        playerName,
        parentEmail,
        teamName: '—',
        status: 'error',
        reason: `Invalid date of birth: ${dob}`,
      })
      continue
    }

    validRows.push({ playerName, dob, birthYear, gender, parentName, parentEmail })
  }

  if (dryRun) {
    // Return what would happen without writing anything
    const preview = validRows.map((row) => ({
      playerName: row.playerName,
      parentEmail: row.parentEmail,
      teamName: teamName(row.birthYear, row.gender),
      status: 'imported' as const,
    }))
    return json({
      dryRun: true,
      total: rawRows.length,
      valid: validRows.length,
      errors: parseErrors.length,
      rows: [...preview, ...parseErrors],
    })
  }

  // --- Actual import ---

  // 1. Fetch all existing teams once
  const { data: existingTeams } = await adminClient
    .from('teams')
    .select('id, name, age_group')

  const teamCache = new Map<string, string>() // name → id
  for (const team of existingTeams ?? []) {
    teamCache.set(team.name as string, team.id as string)
  }

  // 2. Collect unique year+gender combos and find/create teams
  const neededTeams = new Set(validRows.map((r) => teamName(r.birthYear, r.gender)))
  for (const name of neededTeams) {
    if (!teamCache.has(name)) {
      const birthYear = name.split(' ')[0]
      const { data: newTeam, error: teamError } = await adminClient
        .from('teams')
        .insert({ name, age_group: birthYear })
        .select('id')
        .single()

      if (teamError || !newTeam) continue
      teamCache.set(name, newTeam.id as string)
    }
  }

  // 3. Check for ambiguous teams (multiple teams with same birth year + gender)
  const ambiguousNames = new Set<string>()
  for (const name of neededTeams) {
    const matchCount = (existingTeams ?? []).filter((t) =>
      (t.name as string).startsWith(name)
    ).length
    if (matchCount > 1) ambiguousNames.add(name)
  }

  // 4. Process each row
  const results: RowResult[] = [...parseErrors]

  for (const row of validRows) {
    const tName = teamName(row.birthYear, row.gender)

    if (ambiguousNames.has(tName)) {
      results.push({
        playerName: row.playerName,
        parentEmail: row.parentEmail,
        teamName: tName,
        status: 'skipped',
        reason: `Multiple teams match "${tName}" — assign manually after import`,
      })
      continue
    }

    const teamId = teamCache.get(tName)
    if (!teamId) {
      results.push({
        playerName: row.playerName,
        parentEmail: row.parentEmail,
        teamName: tName,
        status: 'error',
        reason: 'Could not find or create team',
      })
      continue
    }

    try {
      // Create player
      const { data: playerRow, error: playerError } = await adminClient
        .from('players')
        .insert({ name: row.playerName, dob: row.dob })
        .select('id')
        .single()

      if (playerError || !playerRow) throw new Error(playerError?.message ?? 'Could not create player')

      const playerId = playerRow.id as string

      // Link player to team
      await adminClient.from('player_teams').insert({ player_id: playerId, team_id: teamId })

      // Find or create parent account
      const { data: existingUsers } = await adminClient.auth.admin.listUsers()
      const existingUser = existingUsers?.users.find((u) => u.email === row.parentEmail)

      let parentId: string

      if (existingUser) {
        parentId = existingUser.id
      } else {
        // Create parent account and send invite
        const { data: newUser, error: newUserError } = await adminClient.auth.admin.createUser({
          email: row.parentEmail,
          email_confirm: false,
          user_metadata: { name: row.parentName, roles: ['parent'] },
        })

        if (newUserError || !newUser.user) throw new Error(newUserError?.message ?? 'Could not create parent account')

        parentId = newUser.user.id

        // Insert profile
        await adminClient.from('profiles').upsert({
          id: parentId,
          name: row.parentName,
          email: row.parentEmail,
          roles: ['parent'],
        })

        // Send invite email
        await adminClient.auth.admin.generateLink({
          type: 'invite',
          email: row.parentEmail,
          options: { redirectTo: `${appBaseUrl.replace(/\/$/, '')}/` },
        })
      }

      // Link parent to player (ignore duplicate)
      await adminClient.from('player_parents').upsert(
        { player_id: playerId, parent_id: parentId },
        { onConflict: 'player_id,parent_id', ignoreDuplicates: true },
      )

      results.push({ playerName: row.playerName, parentEmail: row.parentEmail, teamName: tName, status: 'imported' })
    } catch (err) {
      results.push({
        playerName: row.playerName,
        parentEmail: row.parentEmail,
        teamName: tName,
        status: 'error',
        reason: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const imported = results.filter((r) => r.status === 'imported').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const errors = results.filter((r) => r.status === 'error').length

  await adminClient.from('audit_logs').insert({
    actor_id: actorData.user.id,
    actor_name: actorProfile.name,
    action: 'bulk_import',
    target_type: 'players',
    target_id: actorData.user.id,
    summary: `${actorProfile.name} bulk imported ${imported} players (${skipped} skipped, ${errors} errors).`,
  })

  return json({ dryRun: false, total: rawRows.length, imported, skipped, errors, rows: results })
})
