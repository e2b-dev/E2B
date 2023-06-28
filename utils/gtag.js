export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url, user_id) => {
  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
    user_id: user_id,
  })
  console.log('tracked pageview', url, user_id)
}
