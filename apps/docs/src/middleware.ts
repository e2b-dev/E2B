import { NextResponse } from 'next/server'

export async function middleware({ nextUrl }) {
  const response = NextResponse.next()
  console.log(JSON.stringify(nextUrl))
  return response
}

