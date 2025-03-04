// elevenlabsWebhook.js
import Fastify from 'fastify';
import fastifyFormBody from '@fastify/formbody';
import fastifyCors from '@fastify/cors';
import dotenv from 'dotenv';

dotenv.config();

const { ELEVENLABS_API_KEY, PORT = 8001 } = process.env;

if (!ELEVENLABS_API_KEY) {
  console.error('Missing ELEVENLABS_API_KEY in environment variables');
  process.exit(1);
}

// Base URL for ElevenLabs Conversational AI API
const BASE_URL = 'https://api.elevenlabs.io/v1/convai';

const fastify = Fastify();

fastify.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
});
fastify.register(fastifyFormBody);

/**
 * Helper function to send requests to ElevenLabs API.
 * @param {string} endpoint - API endpoint (starting with a slash)
 * @param {string} method - HTTP method (GET, POST, PATCH, DELETE)
 * @param {object} [body] - Optional JSON payload for POST/PATCH requests.
 * @returns {object} - Parsed JSON response.
 */
async function elevenLabsRequest(endpoint, method = 'GET', body) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }
  return response.json();
}

/* ===== AGENTS ENDPOINTS ===== */
// Create Agent - POST /agents/create (&#8203;:contentReference[oaicite:5]{index=5})
fastify.post('/webhook/create-agent', async (request, reply) => {
  try {
    const payload = request.body;
    const data = await elevenLabsRequest('/agents/create', 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error creating agent:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Get Agent - GET /agents/:agent_id (&#8203;:contentReference[oaicite:6]{index=6})
fastify.get('/webhook/get-agent', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/agents/${agent_id}`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting agent:', error);
    reply.code(500).send({ error: error.message });
  }
});

// List Agents - GET /agents (&#8203;:contentReference[oaicite:7]{index=7})
fastify.get('/webhook/list-agents', async (request, reply) => {
  try {
    const queryParams = new URLSearchParams(request.query).toString();
    const endpoint = queryParams ? `/agents?${queryParams}` : '/agents';
    const data = await elevenLabsRequest(endpoint, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error listing agents:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Update Agent - PATCH /agents/:agent_id (&#8203;:contentReference[oaicite:8]{index=8})
fastify.patch('/webhook/update-agent', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const payload = request.body;
    const data = await elevenLabsRequest(`/agents/${agent_id}`, 'PATCH', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error updating agent:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Delete Agent - DELETE /agents/:agent_id
fastify.delete('/webhook/delete-agent', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/agents/${agent_id}`, 'DELETE');
    reply.send(data);
  } catch (error) {
    console.error('Error deleting agent:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Get Agent Widget Config - GET /agents/:agent_id/widget
fastify.get('/webhook/get-agent-widget', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/agents/${agent_id}/widget`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting agent widget config:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Get Shareable Agent Link - GET /agents/:agent_id/link
fastify.get('/webhook/get-agent-link', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/agents/${agent_id}/link`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting agent link:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Upload Agent Avatar - POST /agents/:agent_id/avatar
fastify.post('/webhook/upload-agent-avatar', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    // Assume avatar data is provided as a base64 string or similar in JSON payload.
    const payload = request.body;
    const data = await elevenLabsRequest(`/agents/${agent_id}/avatar`, 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error uploading agent avatar:', error);
    reply.code(500).send({ error: error.message });
  }
});

/* --- KNOWLEDGE BASE (under Agents) --- */
// Get Agent Knowledge Base - GET /agents/:agent_id/knowledge-base
fastify.get('/webhook/get-agent-knowledge-base', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/agents/${agent_id}/knowledge-base`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting agent knowledge base:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Add to Agent Knowledge Base - POST /agents/:agent_id/knowledge-base
fastify.post('/webhook/add-to-knowledge-base', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const payload = request.body;
    const data = await elevenLabsRequest(`/agents/${agent_id}/knowledge-base`, 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error adding to agent knowledge base:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Add Agent Secret - POST /agents/:agent_id/secrets
fastify.post('/webhook/add-agent-secret', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const payload = request.body;
    const data = await elevenLabsRequest(`/agents/${agent_id}/secrets`, 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error adding agent secret:', error);
    reply.code(500).send({ error: error.message });
  }
});

/* ===== CONVERSATIONS ENDPOINTS ===== */
// Get Signed URL for an Agent Conversation - GET /conversation/get_signed_url?agent_id=...
fastify.get('/webhook/get-signed-url', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/conversation/get_signed_url?agent_id=${agent_id}`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting signed URL:', error);
    reply.code(500).send({ error: error.message });
  }
});

// List Conversations - GET /conversations (&#8203;:contentReference[oaicite:9]{index=9})
fastify.get('/webhook/get-conversations', async (request, reply) => {
  try {
    const queryParams = new URLSearchParams(request.query).toString();
    const endpoint = queryParams ? `/conversations?${queryParams}` : '/conversations';
    const data = await elevenLabsRequest(endpoint, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error listing conversations:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Get Conversation Details - GET /conversations/:conversation_id
fastify.get('/webhook/get-conversation-details', async (request, reply) => {
  try {
    const { conversation_id } = request.query;
    if (!conversation_id) return reply.code(400).send({ error: 'conversation_id is required' });
    const data = await elevenLabsRequest(`/conversations/${conversation_id}`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting conversation details:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Get Conversation Audio - GET /conversations/:conversation_id/audio
fastify.get('/webhook/get-conversation-audio', async (request, reply) => {
  try {
    const { conversation_id } = request.query;
    if (!conversation_id) return reply.code(400).send({ error: 'conversation_id is required' });
    const data = await elevenLabsRequest(`/conversations/${conversation_id}/audio`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting conversation audio:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Send Conversation Feedback - POST /conversations/:conversation_id/feedback
fastify.post('/webhook/send-conversation-feedback', async (request, reply) => {
  try {
    const { conversation_id } = request.query;
    if (!conversation_id) return reply.code(400).send({ error: 'conversation_id is required' });
    const payload = request.body;
    const data = await elevenLabsRequest(`/conversations/${conversation_id}/feedback`, 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error sending conversation feedback:', error);
    reply.code(500).send({ error: error.message });
  }
});

/* ===== PHONE NUMBERS ENDPOINTS ===== */
// List Phone Numbers - GET /phone_numbers
fastify.get('/webhook/list-phone-numbers', async (request, reply) => {
  try {
    const queryParams = new URLSearchParams(request.query).toString();
    const endpoint = queryParams ? `/phone_numbers?${queryParams}` : '/phone_numbers';
    const data = await elevenLabsRequest(endpoint, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error listing phone numbers:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Get Phone Number Details - GET /phone_numbers/:phone_number_id
fastify.get('/webhook/get-phone-number', async (request, reply) => {
  try {
    const { phone_number_id } = request.query;
    if (!phone_number_id) return reply.code(400).send({ error: 'phone_number_id is required' });
    const data = await elevenLabsRequest(`/phone_numbers/${phone_number_id}`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting phone number details:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Create / Assign Phone Number - POST /phone_numbers
fastify.post('/webhook/create-phone-number', async (request, reply) => {
  try {
    const payload = request.body;
    const data = await elevenLabsRequest('/phone_numbers', 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error creating phone number:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Delete Phone Number - DELETE /phone_numbers/:phone_number_id
fastify.delete('/webhook/delete-phone-number', async (request, reply) => {
  try {
    const { phone_number_id } = request.query;
    if (!phone_number_id) return reply.code(400).send({ error: 'phone_number_id is required' });
    const data = await elevenLabsRequest(`/phone_numbers/${phone_number_id}`, 'DELETE');
    reply.send(data);
  } catch (error) {
    console.error('Error deleting phone number:', error);
    reply.code(500).send({ error: error.message });
  }
});

/* ===== HEALTH CHECK ===== */
fastify.get('/', async (_, reply) => {
  reply.send({ message: 'ElevenLabs webhook server is running' });
});

/* ===== START SERVER ===== */
fastify.listen({ port: PORT }, (err, address) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`[Server] Listening on ${address}`);
});
