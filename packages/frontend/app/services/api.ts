const API_BASE_URL = 'http://localhost:5000'; // Adjust to your backend URL

export async function post(
  endpoint: string,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send data');
  }
}

export async function get(endpoint: string): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch data');
  }

  return response.json();
}
