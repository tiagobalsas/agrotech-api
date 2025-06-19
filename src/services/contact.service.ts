import { PrismaClient } from '@prisma/client';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default {
  async submitContactForm(prisma: PrismaClient, data: ContactFormData) {
    const { name, email, subject, message } = data;

    // Optionally, validate subject against ContactSubject model
    const existingSubject = await prisma.contactSubject.findUnique({
      where: { title: subject },
    });

    if (!existingSubject) {
      // Handle case where subject is not predefined, or create it
      await prisma.contactSubject.create({
        data: { title: subject },
      });
    }

    const newContact = await prisma.contact.create({
      data: {
        name,
        email,
        subject,
        message,
      },
    });

    return newContact;
  },

  async getContactSubjects(prisma: PrismaClient) {
    return prisma.contactSubject.findMany();
  },
};


