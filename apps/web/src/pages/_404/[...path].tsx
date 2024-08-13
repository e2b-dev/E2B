import { GetServerSideProps } from 'next'

// https://github.com/vercel/next.js/discussions/16749#discussioncomment-2992732
export const getServerSideProps: GetServerSideProps = async (context) => {
  if (context.req.url?.startsWith('/docs')) {
    return {
      redirect: {
        destination: '/docs',
        permanent: false,
      },
    }

  }
  return {
    redirect: {
      destination: '/dashboard',
      permanent: false,
    },
  }
}

export default function Custom404() {
  return null
}
