export default function Custom404() {
  return null
}

export const getStaticProps = () => {
  return {
    redirect: {
      destination: '/',
    },
  }
}