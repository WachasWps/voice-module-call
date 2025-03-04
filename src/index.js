import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import fastifyFormBody from '@fastify/formbody';


dotenv.config();

const { ELEVENLABS_API_KEY, PORT = 8001 } = process.env;
if (!ELEVENLABS_API_KEY) {
  console.error('Missing ELEVENLABS_API_KEY in environment variables');
  process.exit(1);
}

const BASE_URL = 'https://api.elevenlabs.io/v1/convai';
const fastify = Fastify();

fastify.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
});
fastify.register(fastifyFormBody);
fastify.register(fastifyMultipart);

/**
 * Helper function to send JSON-based requests to ElevenLabs API.
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
  const response = await axios({
    url,
    method,
    data: options.body,
    headers: options.headers,
  });
  return response.data;
}

/* ===== AGENTS ENDPOINTS ===== */
fastify.post('/webhook/create-agent', async (request, reply) => {
  try {
    const payload = request.body;
    const data = await elevenLabsRequest('/agents/create', 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error creating agent:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.get('/webhook/get-agent', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/agents/${agent_id}`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting agent:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.get('/webhook/list-agents', async (request, reply) => {
  try {
    const queryParams = new URLSearchParams(request.query).toString();
    const endpoint = queryParams ? `/agents?${queryParams}` : '/agents';
    const data = await elevenLabsRequest(endpoint, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error listing agents:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.patch('/webhook/update-agent', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const payload = request.body;
    const data = await elevenLabsRequest(`/agents/${agent_id}`, 'PATCH', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error updating agent:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.delete('/webhook/delete-agent', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/agents/${agent_id}`, 'DELETE');
    reply.send(data);
  } catch (error) {
    console.error('Error deleting agent:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.get('/webhook/get-agent-link', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/agents/${agent_id}/link`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting agent link:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.post('/webhook/upload-agent-avatar', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id) return reply.code(400).send({ error: 'agent_id is required' });
    const payload = request.body;
    const data = await elevenLabsRequest(`/agents/${agent_id}/avatar`, 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error uploading agent avatar:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

/* ===== KNOWLEDGE BASE ENDPOINTS ===== */
// Create Knowledge Base Document endpoint
// This endpoint accepts a multipart/form-data request with either a file and/or a URL field.
fastify.post('/webhook/create-knowledge', async (request, reply) => {
  try {
    // Create a new FormData instance using the form-data package.
    const form = new FormData();

    // Use Fastify's multipart support to get the file.
    // request.file() returns the first uploaded file.
    const file = await request.file();

    // Also retrieve any text fields (if provided) from request.body.
    // For example, you can send a "name" and a "url" field.
    const { name = '', url = '' } = request.body || {};

    // Append the name field (even if empty).
    form.append('name', name);

    // Append the url field.
    form.append('url', url);

    // At least one of a file or a URL must be provided.
    if (!file && !url) {
      return reply
        .code(400)
        .send({ error: 'Either a file or a url must be provided' });
    }

    // If a file was uploaded, append it as a stream.
    if (file) {
      form.append('file', file.file, {
        filename: file.filename,
        contentType: file.mimetype,
      });
      console.log('Processed file:', file.filename);
    }

    if (url) {
      console.log('Processed URL:', url);
    }

    // Send the multipart/form-data request using axios.
    const response = await axios.post(`${BASE_URL}/knowledge-base`, form, {
      headers: {
        ...form.getHeaders(),
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    });

    console.log('Knowledge base document created:', response.data);
    reply.send(response.data);
  } catch (error) {
    console.error('Knowledge base error:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.get('/webhook/get-agent-knowledge-base', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id)
      return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/agents/${agent_id}/knowledge-base`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting agent knowledge base:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.post('/webhook/add-to-knowledge-base', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id)
      return reply.code(400).send({ error: 'agent_id is required' });
    const payload = request.body;
    const data = await elevenLabsRequest(`/agents/${agent_id}/knowledge-base`, 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error adding to agent knowledge base:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.post('/webhook/add-agent-secret', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id)
      return reply.code(400).send({ error: 'agent_id is required' });
    const payload = request.body;
    const data = await elevenLabsRequest(`/agents/${agent_id}/secrets`, 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error adding agent secret:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

/* ===== CONVERSATIONS ENDPOINTS ===== */
fastify.get('/webhook/get-signed-url', async (request, reply) => {
  try {
    const { agent_id } = request.query;
    if (!agent_id)
      return reply.code(400).send({ error: 'agent_id is required' });
    const data = await elevenLabsRequest(`/conversation/get_signed_url?agent_id=${agent_id}`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting signed URL:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.get('/webhook/get-conversations', async (request, reply) => {
  try {
    const queryParams = new URLSearchParams(request.query).toString();
    const endpoint = queryParams ? `/conversations?${queryParams}` : '/conversations';
    const data = await elevenLabsRequest(endpoint, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error listing conversations:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.get('/webhook/get-conversation-details', async (request, reply) => {
  try {
    const { conversation_id } = request.query;
    if (!conversation_id)
      return reply.code(400).send({ error: 'conversation_id is required' });
    const data = await elevenLabsRequest(`/conversations/${conversation_id}`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting conversation details:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.get('/webhook/get-conversation-audio', async (request, reply) => {
  try {
    const { conversation_id } = request.query;
    if (!conversation_id)
      return reply.code(400).send({ error: 'conversation_id is required' });
    const data = await elevenLabsRequest(`/conversations/${conversation_id}/audio`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting conversation audio:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.post('/webhook/send-conversation-feedback', async (request, reply) => {
  try {
    const { conversation_id } = request.query;
    if (!conversation_id)
      return reply.code(400).send({ error: 'conversation_id is required' });
    const payload = request.body;
    const data = await elevenLabsRequest(`/conversations/${conversation_id}/feedback`, 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error sending conversation feedback:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

/* ===== PHONE NUMBERS ENDPOINTS ===== */
fastify.get('/webhook/list-phone-numbers', async (request, reply) => {
  try {
    const queryParams = new URLSearchParams(request.query).toString();
    const endpoint = queryParams ? `/phone_numbers?${queryParams}` : '/phone_numbers';
    const data = await elevenLabsRequest(endpoint, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error listing phone numbers:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.get('/webhook/get-phone-number', async (request, reply) => {
  try {
    const { phone_number_id } = request.query;
    if (!phone_number_id)
      return reply.code(400).send({ error: 'phone_number_id is required' });
    const data = await elevenLabsRequest(`/phone_numbers/${phone_number_id}`, 'GET');
    reply.send(data);
  } catch (error) {
    console.error('Error getting phone number details:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.post('/webhook/create-phone-number', async (request, reply) => {
  try {
    const payload = request.body;
    const data = await elevenLabsRequest('/phone_numbers/create', 'POST', payload);
    reply.send(data);
  } catch (error) {
    console.error('Error creating phone number:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

fastify.delete('/webhook/delete-phone-number', async (request, reply) => {
  try {
    const { phone_number_id } = request.query;
    if (!phone_number_id)
      return reply.code(400).send({ error: 'phone_number_id is required' });
    const data = await elevenLabsRequest(`/phone_numbers/${phone_number_id}`, 'DELETE');
    reply.send(data);
  } catch (error) {
    console.error('Error deleting phone number:', error.response?.data || error.message);
    reply.code(500).send({ error: error.response?.data || error.message });
  }
});

/* ===== HEALTH CHECK ===== */
fastify.get('/', async (_, reply) => {
  reply.send({ message: 'ElevenLabs webhook server is running' });
});

fastify.listen({ port: PORT }, (err, address) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`[Server] Listening on ${address}`);
});
