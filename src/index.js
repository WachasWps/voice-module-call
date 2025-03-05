import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import dotenv from 'dotenv';
import Fastify from 'fastify';
import WebSocket from 'ws';
import fetch from 'node-fetch';

// Load environment variables from .env file
dotenv.config();

// Ensure required ElevenLabs environment variables are provided
const { ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, PORT } = process.env;
if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
  console.error('Missing required ElevenLabs environment variables');
  throw new Error('Missing required environment variables');
}

// Initialize Fastify server
const fastify = Fastify();

fastify.register(fastifyCors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

const port = PORT || 8000;

// Root route for health check
fastify.get('/', async (_, reply) => {
  reply.send({ message: 'Server is running' });
});

// Helper: Get a signed URL from ElevenLabs for the conversation
async function getSignedUrl() {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: 'GET',
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      }
    );
    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }
    const data = await response.json();
    return data.signed_url;
  } catch (error) {
    console.error('Error getting signed URL:', error);
    throw error;
  }
}

/**
 * WebSocket endpoint for Knowlarity.
 *
 * Knowlarity will connect to this endpoint to send/receive call media.
 * The endpoint immediately establishes a connection to ElevenLabs (via its signed URL)
 * so that audio data can be bridged between Knowlarity and ElevenLabs.
 */
fastify.register(async (fastifyInstance) => {
  fastifyInstance.get('/knowlarity-media-stream', { websocket: true }, (ws, req) => {
    console.info('[Server] Knowlarity connected to media stream');

    let streamSid = null;
    let knowlarityCallId = null;
    let elevenLabsWs = null;
    let customParameters = null; // This can hold prompt, first_message, etc.

    // Set up the ElevenLabs WebSocket connection
    async function setupElevenLabsConnection() {
      try {
        const signedUrl = await getSignedUrl();
        elevenLabsWs = new WebSocket(signedUrl);

        elevenLabsWs.on('open', () => {
          console.log('[ElevenLabs] Connected to Conversational AI');

          // Send initial configuration, passing any custom parameters provided by Knowlarity
          const initialConfig = {
            type: 'conversation_initiation_client_data',
            dynamic_variables: {
              user_name: customParameters?.user_name || "User",
              user_id: customParameters?.user_id || 0,
            },
            conversation_config_override: {
              agent: {
                prompt: {
                  prompt: customParameters?.prompt || 'Default prompt for agent',
                },
                first_message:
                  customParameters?.first_message ||
                  'Hello, how can I help you today?',
              },
            },
          };

          console.log('[ElevenLabs] Sending initial configuration:', initialConfig);
          elevenLabsWs.send(JSON.stringify(initialConfig));
        });

        elevenLabsWs.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            switch (message.type) {
              case 'audio':
                if (streamSid) {
                  // Handle different audio payload formats
                  const payload =
                    message.audio?.chunk ||
                    message.audio_event?.audio_base_64;
                  if (payload) {
                    const audioData = {
                      event: 'media',
                      streamSid,
                      media: { payload },
                    };
                    ws.send(JSON.stringify(audioData));
                  }
                }
                break;

              case 'interruption':
                if (streamSid) {
                  ws.send(JSON.stringify({ event: 'clear', streamSid }));
                }
                break;

              case 'ping':
                if (message.ping_event?.event_id) {
                  elevenLabsWs.send(
                    JSON.stringify({
                      type: 'pong',
                      event_id: message.ping_event.event_id,
                    })
                  );
                }
                break;

              case 'agent_response':
                console.log('[ElevenLabs] Agent response received:', message.agent_response_event?.agent_response);
                break;

              case 'user_transcript':
                console.log('[ElevenLabs] User transcript received:', message.user_transcription_event?.user_transcript);
                break;

              default:
                console.log('[ElevenLabs] Unhandled message type:', message.type);
            }
          } catch (error) {
            console.error('[ElevenLabs] Error processing message:', error);
          }
        });

        elevenLabsWs.on('error', (error) => {
          console.error('[ElevenLabs] WebSocket error:', error);
        });

        elevenLabsWs.on('close', () => {
          console.log('[ElevenLabs] Connection closed');
        });
      } catch (error) {
        console.error('Error setting up ElevenLabs connection:', error);
      }
    }

    // Start the connection to ElevenLabs
    setupElevenLabsConnection();

    // Handle messages coming from Knowlarity
    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.event !== 'media') {
          console.log('[Knowlarity] Event received:', msg.event);
        }

        switch (msg.event) {
          case 'start':
            streamSid = msg.start.streamSid;
            knowlarityCallId = msg.start.callId;
            customParameters = msg.start.customParameters;
            console.log(`[Knowlarity] Stream started - StreamSid: ${streamSid}, CallId: ${knowlarityCallId}`);
            console.log('[Knowlarity] Start parameters:', customParameters);
            break;

          case 'media':
            if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
              // Forward Knowlarity's audio chunk to ElevenLabs
              const audioMessage = {
                user_audio_chunk: Buffer.from(msg.media.payload, 'base64').toString('base64'),
              };
              elevenLabsWs.send(JSON.stringify(audioMessage));
            }
            break;

          case 'stop':
            console.log(`[Knowlarity] Stream ${streamSid} ended`);
            if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
              elevenLabsWs.close();
            }
            break;

          default:
            console.log(`[Knowlarity] Unhandled event: ${msg.event}`);
        }
      } catch (error) {
        console.error('[Knowlarity] Error processing message:', error);
      }
    });

    // Clean up when Knowlarity disconnects
    ws.on('close', () => {
      console.log('[Knowlarity] Client disconnected');
      if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
        elevenLabsWs.close();
      }
    });
  });
});

// Start the Fastify server
fastify.listen({ port: port }, (err) => {
  if (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
  console.log(`[Server] Listening on port ${port}`);
});
