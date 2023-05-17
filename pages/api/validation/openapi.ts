import { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const API_KEY = req?.body?.apiKey;

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    "model": "gpt-3.5-turbo",
    "messages": [{ "role": "user", "content": "Say this is a test!" }],
    "temperature": 0.7
  }, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  }).then(response => {
    return { message: 'Valid API Key', error: false }; // i.e. Valid API key
  }).catch(error => {
    if (error.response && error.response.data && error.response.data.error) {
      const errorMessage = error?.response?.data?.error?.message || error.response.data.error.code;
      console.error(error.response.data)
      return { message: errorMessage, error: true }; // For invalid API key the message is empty string for some reason from OpenAI.
    } else {
      console.error('Unknown error occurred');
      return { message: 'Unknown error occurred', error: true };
    }
  });

  res.status(200).json({ data: response });
  return
}

export default handler