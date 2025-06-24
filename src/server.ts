import fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { setWebSocketNotifier, fetchKpIndex, getLatestKpData } from './services/noaa.service';
import droneAlertService from './services/drone-alert.service';
import contactService from './services/contact.service';
import { startKpIndexScheduler } from './tasks/kpIndexScheduler';
import fastifyCors from '@fastify/cors';
import { Server } from 'socket.io'; // Importar Server do socket.io

const app = fastify({ logger: true });
const prisma = new PrismaClient();

// Create a Socket.IO server instance and attach it to the Fastify's HTTP server
const io = new Server(app.server, {
  cors: {
    origin: "*", // Permitir todas as origens para desenvolvimento
    methods: ["GET", "POST"]
  }
});

// Set up the WebSocket notifier in noaaService to use Socket.IO
setWebSocketNotifier((data: any) => {
  io.emit('kp-update', data); // Emitir evento 'kp-update' para todos os clientes Socket.IO
});

// Register CORS plugin for Fastify routes
app.register(fastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Rotas Fastify
app.get('/kp-index', async () => {
  const latestEntry = await getLatestKpData(prisma);
  if (latestEntry) {
    return [[latestEntry.timestamp.toISOString(), latestEntry.value.toString()]];
  } else {
    const newKp = await fetchKpIndex(prisma);
    if (newKp && newKp.length > 0) {
      return [[newKp[newKp.length - 1].time.toISOString(), newKp[newKp.length - 1].kp.toString()]];
    } else {
      return [];
    }
  }
});

app.get('/drone-alerts', async () => {
  return await droneAlertService.checkAlerts(prisma);
});

app.post('/contact', async (request, reply) => {
  const { name, email, subject, message } = request.body as { name: string; email: string; subject: string; message: string; };
  try {
    const newContact = await contactService.submitContactForm(prisma, { name, email, subject, message });
    reply.code(201).send(newContact);
  } catch (error: unknown) {
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

// Socket.IO connection handling
io.on('connection', (socket) => {

  // Send initial Kp data when a client connects
  getLatestKpData(prisma).then(data => {
    if (data) {
      socket.emit('kp-update', data); // Enviar dados iniciais para o cliente conectado
    }
  });

  socket.on('disconnect', () => {
  });
});

const start = async () => {
  try {
    // Start the Fastify app and attach the HTTP server
    await app.listen({ port: 3001, host: '0.0.0.0' });

    startKpIndexScheduler(); // Inicia o agendador de tarefas
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
