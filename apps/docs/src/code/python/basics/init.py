import asyncio
from e2b import Session

banner = """import { Box, Text, Link } from "@chakra-ui/react";
import { FaStar } from 'react-icons/fa';

const Banner = () => {
  return (
    <Box w="100%" p={2} color="white" bgColor="blackAlpha.400">
      <Link href="https://github.com/sweepai/sweep" isExternal>
        <Text fontSize="lg" display="flex" justifyContent="center" alignItems="center" color="lightgrey">
          <FaStar />&nbsp;Star us on GitHub&nbsp;&nbsp;<img src="https://img.shields.io/github/stars/sweepai/sweep?style=social" alt="GitHub stars badge" style={{ display: 'inline-block', marginBottom: '2px' }} />
        </Text>
      </Link>
    </Box>
  );
};

export default Banner;"""

async def main():
  session = await Session.create(id="Nodejs")

  await session.close()

asyncio.new_event_loop().run_until_complete(main())