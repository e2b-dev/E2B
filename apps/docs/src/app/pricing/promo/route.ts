import { NextResponse as Response } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export const dynamic = 'force-dynamic' // defaults to force-static
export async function POST(request: Request) {
  // Read json data from request
  const { promoCode, teamID } = await request.json()

  if (!promoCode) {
    return new Response('Missing promo code', { status: 400 })
  }

  if (!teamID) {
    return new Response('Missing team ID', { status: 400 })
  }

  // Check if there's associated tier with promo code
  const { data: tiersData, error: tiersError } = await supabase
    .from('tiers')
    .select('id, promo_code, promo_starts_at, promo_ends_at')
    .eq('promo_code', promoCode)

  if (tiersError) {
    return new Response(tiersError.message, { status: 500 })
  }

  if (tiersData.length === 0) {
    return Response.json({
      error: `Invalid promo code '${promoCode}'`,
    })
  }


  const { data: teamData, error: teamError } = await supabase
    .from('teams')
    .select('tier')
    .eq('id', teamID)

  if (tiersError) {
    return new Response(teamError.message, { status: 500 })
  }

  if (teamData.length === 0) {
    return Response.json({
      error: `Invalid team ID '${teamID}' - team not found`,
    })
  }

  const teamTier: string = teamData[0].tier

  // If team tier isn't a pro tier already, apply the promo tier
  if (teamTier.startsWith('free_')) {
    const now = new Date()

    const validFrom = new Date(tiersData[0].promo_starts_at)
    if (now < validFrom) {
      return Response.json({
        error: `Promo code '${promoCode}' is not valid yet`,
      })
    }

    const validTo = new Date(tiersData[0].promo_ends_at)
    if (now > validTo) {
      return Response.json({
        error: `Promo code '${promoCode}' has expired`,
      })
    }

    await supabase
      .from('teams')
      .update({ tier: tiersData[0].id })
      .eq('id', teamID)

  } else if (teamTier.startsWith('promo_')) {
    return Response.json({
      error: 'Team already has promo active',
    })
  } else if (teamTier.startsWith('pro_')) {
    return Response.json({
      error: 'Team already has a pro tier',
    })
  }

  return Response.json({
    message: `Applied promo code '${promoCode}' to team '${teamID}'`,
  })
}

// Get the info about promo
export async function GET(request: Request) {
  // Check if there's associated tier with promo code
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  const { data: tiersData, error: tiersError } = await supabase
    .from('tiers')
    .select('id, promo_starts_at, promo_ends_at')
    .eq('id', id)

  if (tiersError) {
    return new Response(tiersError.message, { status: 500 })
  }

  if (tiersData.length === 0) {
    return Response.json({
      error: `Invalid tier ID '${id}'`,
    })
  }

  const promo = tiersData[0]

  return Response.json({
    name: promo.id,
    validFrom: promo.promo_starts_at,
    validTo: promo.promo_ends_at,
  })
}