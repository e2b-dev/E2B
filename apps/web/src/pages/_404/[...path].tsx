import { GetServerSideProps } from 'next'

// https://github.com/vercel/next.js/discussions/16749#discussioncomment-2992732
export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/',
      permanent: false,
    },
  }
}

export default function Custom404() {
  return null
}
