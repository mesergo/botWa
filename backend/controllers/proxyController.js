
import fetch from 'node-fetch';

export const proxyWebservice = async (req, res) => {
  const { url, payload } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Missing Webservice URL' });
  }

  console.log(`Calling Webservice URL: ${url}`);

  try {
    // Ensure URL is encoded for Hebrew characters
    const encodedUrl = encodeURI(url);

    const response = await fetch(encodedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://data.message.co.il/',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: `External server returned error: ${response.status}`,
        details: text.substring(0, 500)
      });
    }

    // Find the start of the JSON in case there is garbage/scripts before it
    const jsonStart = text.indexOf('{');
    if (jsonStart === -1) {
      return res.status(500).json({
        error: 'No JSON found in response',
        raw: text.substring(0, 500)
      });
    }

    const jsonText = text.slice(jsonStart);
    const data = JSON.parse(jsonText);

    console.log(`Response from ${url}:`, JSON.stringify(data, null, 2));

    res.json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({
      error: 'Failed to connect to external Webservice',
      details: error.message
    });
  }
};
