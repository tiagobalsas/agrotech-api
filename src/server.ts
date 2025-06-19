import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { setWebSocketNotifier, fetchKpIndex, getLatestKpData } from './services/noaa.service';
import droneAlertService from './services/drone-alert.service';
import contactService from './services/contact.service';
import { startKpIndexScheduler } from './tasks/kpIndexScheduler';
import websocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';

const app = fastify({ logger: true });
const prisma = new PrismaClient();

// Store active WebSocket connections
const clients = new Set<any>();

// Register WebSocket plugin
app.register(websocket);

// Register CORS plugin
app.register(fastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Set up the WebSocket notifier in noaaService
setWebSocketNotifier((data: any) => {
  clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
});

// Rotas
app.get('/kp-index', async () => {
  // Antes de criar um novo registro, verifique se já existe um para o mesmo timestamp e tipo
  // Isso evita o erro de violação de chave única (P2002)
  const latestData = await getLatestKpData(prisma);
  if (latestData && latestData.timestamp.toDateString() === new Date().toDateString()) {
    // Se já existe um registro para hoje, retorne-o ou decida como lidar
    // Por simplicidade, vamos apenas retornar o último dado existente e não criar um novo
    return latestData;
  }
  return await fetchKpIndex(prisma);
});

app.get('/drone-alerts', async () => {
  return await droneAlertService.checkAlerts(prisma);
});

app.post('/contact', async (request, reply) => {
  console.log('Received contact form submission:', request.body); // Log de depuração
  console.log('Content-Type:', request.headers['content-type']); // Novo log para Content-Type
  const { name, email, subject, message } = request.body as { name: string; email: string; subject: string; message: string; };
  try {
    const newContact = await contactService.submitContactForm(prisma, { name, email, subject, message });
    reply.code(201).send(newContact);
  } catch (error: unknown) { // Explicitly type error as unknown
    console.error('Error processing contact form:', error); // This line might cause the 'unknown' error
    let errorMessage = 'Ocorreu um erro desconhecido ao processar o formulário de contato.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    reply.code(500).send({ message: 'Error submitting contact form', error: errorMessage });
  }
});

app.get('/contact/subjects', async () => {
  return await contactService.getContactSubjects(prisma);
});

// WebSocket route for Kp Index updates
app.get('/ws/kp-index', { websocket: true }, (connection, req) => {
  clients.add(connection);
  console.log('WebSocket client connected to /ws/kp-index. Total clients:', clients.size);

  connection.on('message', (message: string) => {
    console.log(`Received WebSocket message: ${message}`);
  });

  // Send initial Kp data when a client connects
  getLatestKpData(prisma).then(data => {
    if (data) {
      connection.send(JSON.stringify(data));
    }
  });

  connection.on('close', () => {
    clients.delete(connection);
    console.log('WebSocket client disconnected from /ws/kp-index. Total clients:', clients.size);
  });
});

const start = async () => {
  try {
    await app.listen({ port: 3001, host: '0.0.0.0' }); // Changed port to 3001
    console.log('Server running on http://localhost:3001');
    startKpIndexScheduler(); // Inicia o agendador de tarefas
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
