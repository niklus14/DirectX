const YOU_API_KEY = 'ydc-sk-2ff87a46a519b852-GCjStb9mMKcxKSxLEdHHCq6RbxuFT4D8-6b6a1ada';

async function testYouAPI() {
  const url = 'https://api.you.com/v1/research';
  const options = {
    method: 'POST',
    headers: {'X-API-Key': YOU_API_KEY, 'Content-Type': 'application/json'},
    body: '{"input":"was there any car accident in Baku in last month?\\n ","research_effort":"standard"}'
  };

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error(error);
  } 
}

testYouAPI();
